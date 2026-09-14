import { parseGeneratedPlans } from './trip/schemas'
import type { GeneratedPlan } from './trip/planner'

let sessionReady: Promise<void> | undefined
async function request(path:string, init:RequestInit={}) {
  const response=await fetch(path,{...init,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',...init.headers}})
  const value=await response.json().catch(()=>null)
  if(!response.ok)throw Error(value?.message??'云端保存暂不可用，本机原记录保留。')
  return value
}
export function ensureCloudSession() {
  return sessionReady??=(async()=>{await request('/api/session')})().catch(cause=>{sessionReady=undefined;throw cause})
}
export async function saveCloudTrip(plan:GeneratedPlan) {
  await ensureCloudSession()
  const result=await request('/api/trips',{method:'PUT',body:JSON.stringify(plan)})
  if(!parseGeneratedPlans([result?.plan]))throw Error('云端没有确认有效行程，请稍后重试。')
  return result as {plan:GeneratedPlan;updatedAt:string}
}
export async function loadCloudTrips() {
  await ensureCloudSession()
  const result=await request('/api/trips')
  const plans=parseGeneratedPlans(result?.trips)
  if(!plans)throw Error('云端行程格式不完整，本机原记录未改变。')
  return plans
}
