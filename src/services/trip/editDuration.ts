import {generatePlans,replacePlanHotel,updateGeneratedPlan,type GeneratedPlan} from './planner'

export function previewTripDuration(plan:GeneratedPlan,durationDays:number):GeneratedPlan {
  if(!Number.isInteger(durationDays)||durationDays<1||durationDays>14)throw new Error('请输入1—14天。')
  if(plan.execution?.length||['active','paused','completed','archived'].includes(plan.status??''))throw new Error('已开始的行程不能整体调整天数，请逐站修改未完成安排。')
  if(!plan.dates)throw new Error('请先确认出行日期。')
  if(durationDays===Object.keys(plan.days).length)return plan
  const dates={start:plan.dates.start,end:new Date(Date.parse(plan.dates.start)+(durationDays-1)*86400000).toISOString().slice(0,10)}
  const intent={...plan.intent,dates,durationDays,nights:durationDays-1}
  let generated=generatePlans(intent).find(item=>item.id===plan.id)??generatePlans(intent)[0]
  const chosenHotel=plan.hotelRecommendations?.find(item=>item.id===plan.selectedHotelId)
  const hotel=Object.values(generated.days).flat().find(stop=>stop.type==='住宿')
  if(chosenHotel&&hotel)generated=replacePlanHotel(generated,hotel.id,chosenHotel.name)
  for(const [day,stops] of Object.entries(plan.days))for(const stop of stops.filter(item=>item.fixed&&!['到达','返程','住宿','取行李','退房'].includes(item.type))){
    if(!generated.days[day])throw new Error(`${day}有锁定的${stop.name}，不能缩短后删除。请先调整这个预订。`)
    generated.days[day]=[...generated.days[day].filter(item=>item.name!==stop.name),stop].sort((a,b)=>a.time.localeCompare(b.time))
  }
  return {...updateGeneratedPlan({...plan,intent,dates,nights:intent.nights,selectedHotelId:generated.selectedHotelId,hotelRecommendations:generated.hotelRecommendations},generated.days),previousVersion:{days:plan.days,selectedHotelId:plan.selectedHotelId,intent:plan.intent,dates:plan.dates,nights:plan.nights}}
}
