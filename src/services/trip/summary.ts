import type { GeneratedPlan, PlannedStop } from './planner'

export function tripCounts(days: Record<string, Array<Pick<PlannedStop,'name'|'type'|'pendingVenue'>>>) {
  const isVenue = (stop: Pick<PlannedStop,'name'|'type'|'pendingVenue'>) => !stop.pendingVenue && !['到达','返程','取行李','退房'].includes(stop.type)
  return { places:new Set(Object.values(days).flat().filter(isVenue).map(stop=>stop.name)).size, visits:Object.values(days).reduce((sum,stops)=>sum+new Set(stops.filter(isVenue).map(stop=>stop.name)).size,0), arrangements:Object.values(days).flat().length }
}
export const countLabel = (counts: {places:number;visits:number;arrangements:number}) => `${counts.places}个地点 · ${counts.arrangements}项安排`
export const tripToolUrl = (path:string, plan:GeneratedPlan) => `${path}${path.includes('?')?'&':'?'}tripId=${encodeURIComponent(plan.tripId??'')}&revision=${plan.revision??1}`

export const tripStatusLabel = (plan: GeneratedPlan) => ({active:'进行中',paused:'已暂停',completed:'已完成',archived:'已归档',planned:plan.validation.passed?'待出发':'待完善'}[plan.status ?? 'planned'])
export function tripSummary(plan: GeneratedPlan) {
  const stops = Object.values(plan.days).flat()
  const pois = stops.filter(stop => !stop.pendingVenue && !['到达','返程','取行李','退房'].includes(stop.type))
  return { ...tripCounts(plan.days), statusCode:plan.status??'planned', revision:plan.revision??1, tripId: plan.tripId, title: `${plan.city} · ${Object.keys(plan.days).length}天${plan.nights}晚`, dates: plan.dates ? `${plan.dates.start}—${plan.dates.end}` : '日期待确认', status: tripStatusLabel(plan), partySize:plan.partySize, version:plan.revision ?? 1, uniquePoiCount: new Set(pois.map(stop=>stop.name)).size, visitCount:stops.length, estimatedCost:plan.budget }
}
