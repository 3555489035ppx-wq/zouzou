import { isConcreteKnowledgeItem, type CityKnowledgeItem } from './cityKnowledge'
import { getCityRouteZone } from './cityRouteSpecs'

export type MealPeriod = '早餐' | '午餐' | '晚餐'
export type VisitPeriod = '上午' | '下午' | '晚间'
export const DAILY_MEALS = [
  {type:'早餐' as const, start:7*60+30, end:9*60, duration:40},
  {type:'午餐' as const, start:12*60, end:13*60+30, duration:60},
  {type:'晚餐' as const, start:18*60, end:19*60+30, duration:60},
]
export const DAILY_VISITS = [
  {type:'上午' as const, start:9*60, end:11*60+35},
  {type:'下午' as const, start:13*60+45, end:17*60+30},
  {type:'晚间' as const, start:19*60+30, end:22*60},
]
export const agendaMinutes = (time:string) => Number(time.split(':')[0])*60+Number(time.split(':')[1])
export const agendaTime = (time:number) => `${String(Math.floor(time/60)).padStart(2,'0')}:${String(time%60).padStart(2,'0')}`
export const agendaVenueKey = (item:Pick<CityKnowledgeItem,'name'|'venueName'>) => (item.venueName||item.name).split('｜')[0].replace(/[（(][^）)]*(?:片区|附近|店)[）)]/g,'').replace(/(?:慢看|看展|早走|晨走|逛吃|散步|夜逛|慢走|拍照|观景|看日落)$/,'').replace(/[（）()·/—\-\s]/g,'').toLowerCase()
export function supportsMeal(item:CityKnowledgeItem, meal:MealPeriod) {
  if(!isConcreteKnowledgeItem(item)||!['food','restaurant'].includes(item.category)||item.tags.includes('加餐'))return false
  if(meal==='早餐') {
    if(item.tags.includes('早餐'))return true
    if(item.tags.includes('午餐')||item.tags.includes('晚餐'))return false
    return /早餐|早饭|早茶|过早|豆浆|包子|生煎|汤包|肠粉|烧饼|热干面|糯米饭|粥/.test([item.name,item.summary,...item.tags,...(item.menuHighlights??[])].join(' '))
  }
  return (item.category==='restaurant'||item.tags.some(tag=>['午餐','晚餐','正餐'].includes(tag)))&&!item.tags.includes('早餐专用')
}
export function supportsEvening(item:CityKnowledgeItem) {
  if(['restaurant','food'].includes(item.category))return false
  // An unknown closing time does not turn a museum or mountain into a night stop.
  const text=[item.name,...item.tags,item.summary].join(' ')
  return /夜景|夜逛|夜游|夜市|晚间|晚上|傍晚/.test(text)
    ||(/步行街|老街|街区|广场|滨水|江边|河畔/.test(text)&&!/寺|博物|美术馆|山地|登山|徒步|远郊/.test([item.name,...item.tags].join(' ')))
    || Boolean(item.opening && agendaMinutes(item.opening.to)>=21*60 && !/山地|登山|徒步|远郊/.test(item.tags.join(' ')))
}
export function supportsVisitPeriod(item:CityKnowledgeItem,period:VisitPeriod) {
  if(/晨练|晨走|早走|早市|过早|早餐/.test(item.name)&&period!=='上午')return false
  if(/夜游|夜逛|夜走|夜骑|夜景|夜市|灯光秀|日落/.test(item.name)&&period!=='晚间')return false
  return period!=='晚间'||supportsEvening(item)
}
export type AgendaEntry = {item:CityKnowledgeItem; time:string; duration:number; period:MealPeriod|VisitPeriod; transfer:number}
export type AgendaDay = {entries:AgendaEntry[]; missing:string[]}

/** Shared city-day rhythm. Only named, sourced catalog entries can become stops.
 * Meals are reserved before sightseeing, rather than squeezed into its leftovers. */
export function buildDailyAgenda(options:{city:string; days:number; items:CityKnowledgeItem[]; anchors?:string[][]; variant?:number; density?:'easy'|'match'|'rich'; lightEvening?:boolean; isAvailable?:(item:CityKnowledgeItem,day:number,start:number,duration:number)=>boolean}) : AgendaDay[] {
  const {city,days,anchors=[],variant=0,density='match'}=options
  const items=[...new Map(options.items.filter(isConcreteKnowledgeItem).map(item=>[agendaVenueKey(item),item])).values()]
  const used=new Set<string>()
  const result:AgendaDay[]=Array.from({length:days},()=>({entries:[],missing:[]}))
  const zone=(item:CityKnowledgeItem)=>getCityRouteZone(city,item.name,item.area)
  const anchor=(day:number)=>items.find(item=>anchors[day]?.includes(item.name))
  const distance=(a:CityKnowledgeItem|undefined,b:CityKnowledgeItem)=>!a?0:zone(a).name===zone(b).name?0:Math.abs(zone(a).order-zone(b).order)+1
  const available=(item:CityKnowledgeItem,day:number,start:number,duration:number)=>(!item.opening||(start>=agendaMinutes(item.opening.from)&&start+duration<=agendaMinutes(item.opening.to)))
    &&(options.isAvailable?.(item,day,start,duration)??true)
  const ordered=(pool:CityKnowledgeItem[],day:number,near?:CityKnowledgeItem)=>pool.map((item,index)=>({item,index})).sort((a,b)=>
    Number(anchors[day]?.includes(b.item.name))-Number(anchors[day]?.includes(a.item.name))
    ||distance(near??anchor(day),a.item)-distance(near??anchor(day),b.item)
    ||(a.index+variant*3)%Math.max(1,pool.length)-(b.index+variant*3)%Math.max(1,pool.length)).map(x=>x.item)
  // Reserve every day's breakfast first so lunch cannot consume scarce breakfast venues.
  for(const meal of DAILY_MEALS)for(let day=0;day<days;day++){
    const candidates=ordered(items.filter(item=>!used.has(agendaVenueKey(item))&&supportsMeal(item,meal.type)),day)
    const item=candidates.find(item=>available(item,day,Math.max(meal.start,item.opening?agendaMinutes(item.opening.from):0),meal.duration)
      &&Math.max(meal.start,item.opening?agendaMinutes(item.opening.from):0)+meal.duration<=meal.end)
    if(!item){result[day].missing.push(meal.type);continue}
    const start=Math.max(meal.start,item.opening?agendaMinutes(item.opening.from):0)
    result[day].entries.push({item,time:agendaTime(start),duration:meal.duration,period:meal.type,transfer:day===0&&meal.type==='早餐'?0:25})
    used.add(agendaVenueKey(item))
  }
  // Reserve night-specific places before daytime slots can use them up.
  for(const period of [DAILY_VISITS[2],DAILY_VISITS[0],DAILY_VISITS[1]])for(let day=0;day<days;day++){
    const dayResult=result[day]
    let cursor=period.start
    let count=0
    const maxCount=period.type==='晚间'||density==='easy'?1:2
    // A relaxed night is a short stroll, not a third long core visit. Keep
    // museum/exhibition durations intact; only shorten an open-air evening walk.
    const duration=(item:CityKnowledgeItem)=>options.lightEvening&&period.type==='晚间'&&!item.tags.includes('室内')&&!/博物|美术馆|展览|演出/.test([item.name,...item.tags].join(' '))
      ?Math.min(45,item.durationMinutes):item.durationMinutes
    while(count<maxCount){
      const near=dayResult.entries.filter(entry=>agendaMinutes(entry.time)<cursor).sort((a,b)=>agendaMinutes(b.time)-agendaMinutes(a.time))[0]?.item??anchor(day)
      const candidates=ordered(items.filter(item=>!used.has(agendaVenueKey(item))&&!['food','restaurant'].includes(item.category)
        &&supportsVisitPeriod(item,period.type)
        &&(!options.lightEvening||period.type!=='晚间'||duration(item)<60)
        &&duration(item)<=period.end-cursor),day,near)
      const item=candidates.find(item=>{
        const start=Math.max(cursor,item.opening?agendaMinutes(item.opening.from):0)
        return start+duration(item)<=period.end&&available(item,day,start,duration(item))
      })
      if(!item)break
      const start=Math.max(cursor,item.opening?agendaMinutes(item.opening.from):0)
      dayResult.entries.push({item,time:agendaTime(start),duration:duration(item),period:period.type,transfer:25})
      used.add(agendaVenueKey(item));cursor=start+duration(item)+25;count++
    }
    if(!count)dayResult.missing.push(period.type)
  }
  return result.map(day=>({...day,entries:day.entries.sort((a,b)=>agendaMinutes(a.time)-agendaMinutes(b.time))}))
}
