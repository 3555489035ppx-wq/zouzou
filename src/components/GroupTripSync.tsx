import { useEffect, useState } from 'react'
import { groupPlanApi } from '../services/groupPlanApi'
import { readSavedPlans } from '../services/trip/planner'
import { saveGroupTrip } from '../services/trip/groupTrip'

export function GroupTripSync() {
  const [error, setError] = useState('')
  useEffect(() => {
    const plans = (readSavedPlans() ?? []).filter(plan => plan.sourceGroup)
    const sync = (plan: Awaited<ReturnType<typeof groupPlanApi.get>>) => { try { saveGroupTrip(plan); setError('') } catch { setError('共同计划更新未能保存，请检查本机存储后重新打开。') } }
    const refresh = () => { plans.forEach(plan => { void groupPlanApi.get(plan.sourceGroup!.planId).then(sync).catch(() => setError('共同计划暂未同步，当前显示本机保存版本，请联网后核对最新决定。')) }) }
    refresh()
    const disconnect = plans.map(plan => groupPlanApi.subscribe(plan.sourceGroup!.planId, event => sync(event.plan)))
    window.addEventListener('online', refresh)
    return () => { disconnect.forEach(close => close()); window.removeEventListener('online', refresh) }
  }, [])
  return error ? <p role="status">{error}</p> : null
}
