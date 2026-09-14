import type { GeneratedPlan } from './planner'
import { tripSummary, tripCounts } from './summary'

export function shareSnapshot(plan:GeneratedPlan) {
  const days=Object.fromEntries(Object.entries(plan.days).map(([day,stops])=>[day,stops.filter(stop=>!['住宿','到达','返程','取行李','退房'].includes(stop.type)).map(stop=>({id:stop.id,pendingVenue:stop.pendingVenue??false,name:stop.name,time:stop.time,type:stop.type,stay:stop.stay,address:stop.address??'',budget:stop.budget,priceState:stop.priceState??'estimated'}))]))
  const {places,arrangements}=tripCounts(days)
  return {tripId:plan.tripId,revision:plan.revision??1,city:plan.city,title:tripSummary(plan).title,dates:plan.dates,partySize:plan.partySize,days,places,arrangements,scope:'持链接的人可查看；固定此版本，7天有效，可撤销。原截图、私人备注、住宿和到离信息均已排除。'}
}
