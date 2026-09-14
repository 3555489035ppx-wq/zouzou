import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMapOptions, getRouteMapOptions } from '../mapLauncher'
import { writeVersioned } from '../storage'
import { completePlanOptions, delayPlanStop, undoPlanEdit, replacePlanPlace, getReplacementCandidates, generatePlans, understandTrip, updateGeneratedPlan, validatePlan, readSavedPlans, writeSavedPlan } from './planner'

afterEach(() => vi.unstubAllGlobals())
describe('PRD v2 original defects', () => {
  const base = '2026年9月18日到9月20日去南京3天2晚，2人，总预算6000元。10:30到南京南站，住南京中心酒店，18:30从南京南站返程。'
  const minutes = (time: string) => { const [h,m] = time.split(':').map(Number); return h * 60 + m }
  it('Q-24 delay and undo preserve earlier days, fixed tickets and completed events', () => {
    const original=generatePlans(understandTrip({text:base,media:[]}).intent)[0]
    const day='Day 3',target=original.days[day].find(stop=>!stop.fixed)!
    const first=original.days['Day 1'][0]
    const plan={...original,execution:[{day:'Day 1',stopId:first.id,action:'completed' as const,source:'manual' as const,at:'2026-09-18T10:30:00+08:00'}]}
    const next=delayPlanStop(plan,day,target.id,30)
    expect(next.days['Day 1']).toEqual(plan.days['Day 1'])
    expect(next.days[day].find(stop=>stop.id===target.id)?.time).not.toBe(target.time)
    expect(next.days[day].find(stop=>stop.type==='返程')).toEqual(plan.days[day].find(stop=>stop.type==='返程'))
    expect(next.execution).toEqual(plan.execution)
    const restored=undoPlanEdit(next)
    expect(restored.days).toEqual(plan.days)
    expect(restored.budget).toBe(plan.budget)
    expect(restored.tripId).toBe(plan.tripId)
    expect(restored.revision).toBeGreaterThan(next.revision!)
  })
  it('V-05 explicit hotel replacement can be undone with lodging and selected hotel restored', () => {
    const plan=generatePlans(understandTrip({text:base,media:[]}).intent)[0]
    const hotel=Object.values(plan.days).flat().find(stop=>stop.type==='住宿')!
    const replacement=plan.hotelRecommendations![1]
    const changed=replacePlanPlace(plan,hotel.id,replacement.name)
    expect(changed.selectedHotelId).toBe(replacement.id)
    const restored=undoPlanEdit(changed)
    expect(restored.selectedHotelId).toBe(plan.selectedHotelId)
    expect(restored.days).toEqual(plan.days)
    expect(restored.budgetBreakdown.lodging).toBe(plan.budgetBreakdown.lodging)
  })
  it('Q-08 applies dated National Day opening exceptions and the last admission cutoff', () => {
    const plan=generatePlans(understandTrip({text:'2026年10月5日去上海1天预算2000元，想去上海博物馆（人民广场馆）。',media:[]}).intent)[0]
    const source=Object.values(plan.days).flat().find(stop=>stop.name==='上海博物馆（人民广场馆）')!
    expect(source).toBeDefined()
    const check=(date:string,time:string)=>validatePlan({...plan,dates:{start:date,end:date},days:{'Day 1':[{...source,date,time,durationMinutes:60}]}}).checks.find(x=>x.name==='营业时间')?.passed
    expect(check('2026-10-05','10:00')).toBe(true)
    expect(check('2026-09-14','10:00')).toBe(false)
    expect(check('2026-10-05','15:00')).toBe(false)
  })
  it('Q-16 keeps the primary destination and blocks unresolved cross-city execution', () => {
    const intent = understandTrip({text:base+'下午再加杭州西湖。',media:[]}).intent
    expect(intent.destination).toBe('南京')
    const plan = generatePlans(intent)[0]
    expect(Object.values(plan.days).flat().some(stop=>stop.name.includes('杭州'))).toBe(false)
    expect(plan.validation.passed).toBe(false)
  })
  it('Q-03 meal insertion respects the half-day activity window', () => {
    const intent = understandTrip({text:'上海同城周末半天，1人预算600元，10:00到上海图书馆，20:00从上海图书馆回家。',media:[]}).intent
    expect(intent.missing).not.toContain('酒店位置')
    const plans = generatePlans(intent)
    expect(completePlanOptions(plans)).toHaveLength(3)
    for (const plan of plans) {
      const stops = Object.values(plan.days).flat()
      expect(stops.filter(stop=>!stop.fixed).every(stop=>minutes(stop.time)+stop.durationMinutes<=16*60)).toBe(true)
      expect(stops.reduce((sum,stop)=>sum+stop.durationMinutes+stop.travelFromPreviousMinutes,0)).toBeLessThanOrEqual(360)
      expect(stops.find(stop=>stop.type==='返程')?.time).toBe('19:00')
      expect(stops.some(stop=>stop.type==='午餐')).toBe(true)
      expect(stops.some(stop=>!stop.fixed&&!/餐|小吃|休息/.test(stop.type))).toBe(true)
      expect(plan.validation.checks.find(check=>check.name==='时间顺序')?.passed).toBe(true)
    }
  })
  it('Q-01 reserves real meal periods even when a district lacks restaurant evidence', () => {
    const plan = generatePlans(understandTrip({text:'10月2号09:30到南京动车站，南京3天预算4000元，看展吃本地美食。',media:[]}).intent)[0]
    for(const stops of Object.values(plan.days)) {
      for(const [meal,start,end] of [['午餐',11*60,14*60+30],['晚餐',16*60,20*60+30]] as const) {
        const stop=stops.find(item=>item.type===meal)
        expect(stop,meal).toBeDefined()
        expect(minutes(stop!.time)).toBeGreaterThanOrEqual(start)
        expect(minutes(stop!.time)).toBeLessThanOrEqual(end)
        if(stop!.pendingVenue) {
          expect(stop!.priceState).toBe('unknown')
          expect(getMapOptions(stop!,plan.city)).toEqual([])
          expect(getRouteMapOptions({city:plan.city,places:[stops[0],stop!]})).toEqual([])
        }
      }
    }
  })
  it('Q-06 preserves daily rest after inserting meals and keeps lunch before dinner', () => {
    const plan = generatePlans(understandTrip({text:base+'老人和儿童同行，低体力，每段步行不超过15分钟。',media:[]}).intent)[0]
    for(const stops of Object.values(plan.days)) {
      expect(stops.some(stop=>stop.type==='休息')).toBe(true)
      expect(stops.filter(stop=>stop.type==='午餐').every(stop=>minutes(stop.time)<=14*60+30)).toBe(true)
    }
    expect(plan.validation.checks.find(check=>check.name==='时间顺序')?.passed).toBe(true)
  })
  it('Q-11 never treats an unverified restaurant as a confirmed indoor venue', () => {
    const plan=generatePlans(understandTrip({text:base+'全部安排室内。',media:[]}).intent)[0]
    for(const stop of Object.values(plan.days).flat().filter(stop=>!stop.fixed && !stop.name.includes('待选'))) {
      expect(plan.knowledge.items.find(item=>item.name===stop.name)?.tags).toContain('室内')
    }
  })
  it('Q-09/Q-11 replacement choices preserve unavailable and indoor constraints', () => {
    for (const city of ['南京', '上海']) {
      const generated = generatePlans(understandTrip({ text: `去${city}3天，预算6000元，全部室内。`, media: [] }).intent)[0]
      // Simulate removing a future visit: its sourced venue is now available
      // for replacement rather than already consumed by this itinerary.
      const spare = city === '南京' ? '六朝博物馆' : '浦东美术馆'
      expect(generated.knowledge.items.find(item=>item.name===spare)?.tags).toContain('室内')
      const plan = { ...generated, days: Object.fromEntries(Object.entries(generated.days).map(([day,stops])=>[day,stops.filter(stop=>stop.name!==spare)])) }
      const target = Object.values(plan.days).flat().find(stop => !stop.fixed && !stop.pendingVenue)!
      const candidates = getReplacementCandidates(plan, target.id)
      expect(candidates.length).toBeGreaterThan(0)
      expect(candidates.some(candidate=>candidate.name===spare)).toBe(true)
      for (const candidate of candidates) expect(plan.knowledge.items.find(item => item.name === candidate.name)?.tags).toContain('室内')
      const unavailable = candidates[0].name
      const constrained = { ...plan, intent: { ...plan.intent, unavailablePlaces: [unavailable] } }
      expect(getReplacementCandidates(constrained, target.id).some(item => item.name === unavailable)).toBe(false)
      expect(replacePlanPlace(constrained, target.id, unavailable)).toBe(constrained)
    }
  })

  it('Q-09 leaves exhausted indoor replacement choices empty instead of repeating a scheduled venue', () => {
    const plan=generatePlans(understandTrip({text:'去南京3天，预算6000元，全部室内。',media:[]}).intent)[0]
    const stops=Object.values(plan.days).flat()
    const target=stops.find(stop=>!stop.fixed&&!stop.pendingVenue)!
    const indoorVisits=plan.knowledge.items.filter(item=>item.tags.includes('室内')&&!['food','restaurant'].includes(item.category))
    expect(indoorVisits.length).toBeGreaterThan(0)
    expect(indoorVisits.every(item=>stops.some(stop=>stop.name===item.name))).toBe(true)
    expect(getReplacementCandidates(plan,target.id)).toEqual([])
    const used=stops.find(stop=>!stop.fixed&&!stop.pendingVenue&&stop.id!==target.id)!
    expect(replacePlanPlace(plan,target.id,used.name)).toBe(plan)
    expect(()=>completePlanOptions([plan])).toThrow('全部室内尚未满足')
  })

  it('Q-11 publishes feasible indoor variants but rechecks outdoor edits and pending known venues', () => {
    const plans=generatePlans(understandTrip({text:'2026年9月19日去南京1天，1人预算2000元，11:00到南京南站，18:30从南京南站返程，全部室内。',media:[]}).intent)
    const feasible=completePlanOptions(plans)
    expect(feasible.length).toBeGreaterThan(0)
    for(const plan of feasible){
      expect(plan.validation.checks.find(check=>check.name==='室内约束')?.passed).toBe(true)
      expect(Object.values(plan.days).flat().some(stop=>stop.pendingVenue)).toBe(false)
    }
    const plan=feasible[0]
    const target=Object.values(plan.days).flat().find(stop=>!stop.fixed&&!/餐|小吃/.test(stop.type))!
    expect(target).toBeDefined()
    // Preserve the old passing validation deliberately: publication must inspect
    // actual edited stops, not trust this stale report.
    for(const patch of [{name:'中山陵'},{pendingVenue:true}]){
      const edited={...plan,days:Object.fromEntries(Object.entries(plan.days).map(([day,stops])=>[day,stops.map(stop=>stop.id===target.id?{...stop,...patch}:stop)]))}
      expect(()=>completePlanOptions([edited])).toThrow('全部室内尚未满足')
      expect(completePlanOptions([edited,plan])).toEqual([plan])
    }
  })

  it('Q-11 pending venues remain unconfirmed and outdoor edits fail validation', () => {
    const plan = generatePlans(understandTrip({ text: base + '全部室内。', media: [] }).intent)[0]
    const pendingMeals=Object.values(plan.days).flat().filter(stop => stop.pendingVenue)
    // Two sourced indoor restaurants cannot fill six distinct lunches/dinners.
    expect(pendingMeals.some(stop=>/午餐|晚餐/.test(stop.type))).toBe(true)
    expect(pendingMeals.every(stop=>stop.priceState==='unknown'&&stop.budget===0)).toBe(true)
    expect(plan.validation.checks.find(check => check.name === '室内约束')?.passed).toBe(false)
    expect(()=>completePlanOptions([plan])).toThrow('全部室内尚未满足')
    const template = Object.values(plan.days).flat().find(stop => !stop.fixed)!
    const pending = { ...plan, days: { 'Day 1': [{ ...template, name: '室内餐厅待选', pendingVenue: true }] } }
    expect(validatePlan(pending).checks.find(check => check.name === '室内约束')?.passed).toBe(false)
    const pendingKnown = {...plan,days:{'Day 1':[{...template,name:'六朝博物馆',pendingVenue:true}]}}
    expect(validatePlan(pendingKnown).checks.find(check=>check.name==='室内约束')?.passed).toBe(false)
    const target = Object.values(plan.days).flat().find(stop => !stop.fixed && !stop.pendingVenue)!
    const edited = updateGeneratedPlan(plan, { 'Day 1': [{ ...target, name: '中山陵' }] })
    expect(edited.validation.checks.find(check => check.name === '室内约束')?.passed).toBe(false)
    const unavailable = { ...edited, intent: { ...edited.intent, unavailablePlaces: ['中山陵'] } }
    expect(validatePlan(unavailable).checks.find(check => check.name === '地点可用性')?.passed).toBe(false)
  })
  it('Q-09 applies a sourced walk-in alternative without reintroducing the unavailable museum', () => {
    for (const plan of generatePlans(understandTrip({ text: base + '想去南京博物院，但没有预约到票。', media: [] }).intent)) {
      const stops = Object.values(plan.days).flat()
      expect(stops.some(stop => stop.name === '南京博物院')).toBe(false)
      expect(stops.some(stop => stop.name === '江苏省美术馆')).toBe(true)
      expect(plan.intent.alternatives?.[0].sourceUrl).toBe('https://www.jssmsg.cn/')
      expect(plan.validation.checks.find(check => check.name === '必去覆盖')?.passed).toBe(true)
    }
    const monday = generatePlans(understandTrip({ text: '2026年9月21日去南京1天，预算1000元。南京博物院没有预约到票。', media: [] }).intent)[0]
    expect(monday.intent.alternatives).toBeUndefined()
  })

  it('Q-11 preserves indoor meal evidence and rain transfers, rejecting incomplete variants', () => {
    for (const plan of generatePlans(understandTrip({ text: base + '两天大雨，全部安排室内。', media: [] }).intent)) {
      const stops = Object.values(plan.days).flat()
      expect(stops.filter(stop => !stop.fixed && !stop.pendingVenue).every(stop => plan.knowledge.items.find(item => item.name === stop.name)?.tags.includes('室内'))).toBe(true)
      const namedMeals=stops.filter(stop=>/早餐|午餐|晚餐/.test(stop.type)&&!stop.pendingVenue)
      expect(new Set(namedMeals.map(stop=>stop.canonicalName??stop.name)).size).toBe(namedMeals.length)
      for(const day of Object.values(plan.days))expect(day.filter(stop=>/午餐|晚餐/.test(stop.type)).map(stop=>stop.type)).toEqual(['午餐','晚餐'])
      expect(stops.filter(stop=>stop.pendingVenue).every(stop=>stop.priceState==='unknown'&&stop.budget===0)).toBe(true)
      expect(plan.validation.checks.find(check=>check.name==='室内约束')?.passed).toBe(false)
      expect(()=>completePlanOptions([plan])).toThrow('全部室内尚未满足')
      expect(stops.filter(stop => stop.travelFromPreviousMinutes > 0).every(stop => stop.mode === 'taxi' && stop.transport.includes('雨天'))).toBe(true)
      expect(plan.validation.checks.find(check => check.name === '时间顺序')?.passed).toBe(true)
    }
  })
  it('ZZ-32 retains more than three saved Trips and repeated saves preserve identity', () => {
    const values=new Map<string,string>()
    vi.stubGlobal('window',{dispatchEvent:vi.fn(),localStorage:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}})
    const intent=understandTrip({text:'南京3天预算4000元',media:[]}).intent
    for(let i=0;i<6;i++) { const plan=generatePlans(intent)[0];writeSavedPlan(plan);writeSavedPlan(plan) }
    expect(readSavedPlans()).toHaveLength(6)
    expect(new Set(readSavedPlans()!.map(plan=>plan.tripId)).size).toBe(6)
  })
  it('ZZ-27 applies ticket quantity once, and rooms round up for odd parties', () => {
    const intent=understandTrip({text:'南京3天预算10000元',media:[]}).intent
    const single=generatePlans({...intent,partySize:1})[0]
    const three=generatePlans({...intent,partySize:3})[0]
    expect(three.budgetBreakdown.tickets).toBe(single.budgetBreakdown.tickets*3)
    expect(three.budgetBreakdown.lodging).toBe(single.budgetBreakdown.lodging*2)
    for(const stop of Object.values(single.days).flat().filter(stop=>/景点|展览/.test(stop.type))) {
      const item=single.knowledge.items.find(item=>item.name===stop.name)!
      expect(stop.budget).toBe(Math.round((item.price.min+item.price.max)/2))
    }
  })
  it('ZZ-45 no provider searches an arrow-joined itinerary', () => {
    for (const option of getRouteMapOptions({city:'广州',places:[{id:'a',name:'广州塔'},{id:'b',name:'海珠湿地公园'},{id:'c',name:'小洲村'}]})) {
      expect(decodeURIComponent(option.url)).not.toContain('→')
      expect(decodeURIComponent(option.url)).not.toContain('小洲村')
    }
  })
  it('ZZ-33 storage quota failure is observable', () => {
    vi.stubGlobal('window', {localStorage:{setItem:()=>{throw Error('QuotaExceeded')}}})
    expect(writeVersioned('trip', {}, 'local')).toBe(false)
  })
  it('ZZ-11 keeps month/day/time and asks only for year', () => {
    const {intent} = understandTrip({text:'10月2号9:30到南京动车站，南京3天预算4000元，看展吃本地美食',media:[]})
    expect(intent.arrivalTime).toBe('09:30')
    expect(intent.missing).toContain('出行年份（已识别10月2日）')
    expect(intent.missing).not.toContain('具体出行日期')
    expect(intent.mustVisit).not.toContain('浦口火车站旧址')
  })
  it('ZZ-22 rejects the recorded 11:20 overlap', () => {
    const plan = generatePlans(understandTrip({text:'南京3天预算4000元',media:[]}).intent)[0]
    const stop = plan.days['Day 1'][0]
    const bad = {...plan,days:{'Day 1':[{...stop,id:'a',name:'馆A',time:'11:20',durationMinutes:180},{...stop,fixed:false,id:'b',name:'馆B',time:'13:45',durationMinutes:150,travelFromPreviousMinutes:25}]}}
    expect(validatePlan(bad).checks.find(x=>x.name==='时间顺序')?.passed).toBe(false)
    expect(updateGeneratedPlan(bad,bad.days).days['Day 1'][1].time).toBe('14:45')
  })
  it('ZZ-27 low budget does not discount the same activities', () => {
    const intent=understandTrip({text:'南京3天预算4000元',media:[]}).intent
    const high=generatePlans(intent)[0]
    const low=generatePlans({...intent,budget:1})[0]
    const tickets=Object.values(low.days).flat().filter(x=>/景点|展览|园林/.test(x.type)).reduce((sum,x)=>sum+x.budget,0)
    expect(low.budgetBreakdown.tickets).toBe(tickets * intent.partySize)
    expect(low.validation.passed).toBe(false)
    expect(high.budgetBreakdown.total).toBe(high.budget)
  })
})
