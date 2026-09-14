import { FormSelect } from '../components/FormSelect'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { TripLibrary } from '../components/TripLibrary'
import { tripSummary, tripToolUrl } from '../services/trip/summary'
import { AppShell } from '../components/AppShell'
import { ItineraryContent } from '../components/ItineraryContent'
import { ZouBottomSheet, ZouNavigationBar, ZouMotionBot } from '../components/ui'
import { refreshRepeatedMeals, completeSavedItinerary, readSavedPlans, writeSavedPlan, type GeneratedPlan } from '../services/trip/planner'
import { useAppStore } from '../stores/appStore'

const statusNames = { planned: '待出发', active: '进行中', paused: '已暂停', completed: '已完成', archived: '已归档' }
export function SavedTripExecution() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [statusMessage, setStatusMessage] = useState('')
  const [manageOpen, setManageOpen] = useState(false)
  const attemptedMealRevision = useRef('')
  const [plans, setPlans] = useState(() => readSavedPlans() ?? [])
  useEffect(() => {
    const reload = () => setPlans(readSavedPlans() ?? [])
    window.addEventListener('zouzou-saved-trips-updated', reload)
    return () => window.removeEventListener('zouzou-saved-trips-updated', reload)
  }, [])
  const plan = plans.find(item => item.tripId === id)
  const summary = plan ? tripSummary(plan) : null

  useEffect(() => { setStatusMessage('') }, [id])
  useEffect(() => {
    if (!plan) return
    const key = `${plan.tripId}:${plan.revision}`
    if (attemptedMealRevision.current === key) return
    attemptedMealRevision.current = key
    const next = completeSavedItinerary(plan)
    if (next !== plan) {
      try { writeSavedPlan(next); setStatusMessage('已修正酒店出发与早餐顺序，并更新重复餐饮；费用已重新计算。') }
      catch { setStatusMessage('用餐安排未能保存，请稍后重新打开行程。') }
    }
  }, [plan])

  if (!id) return <AppShell showTabBar><main className="trips-hub">
    <header className="trips-hub__hero"><h1 className="trips-hub__go">GoGoGo!</h1><div className="trips-hub__welcome"><p>让我们一起出发吧！</p><ZouMotionBot interactive size="lg" label="和走走打个招呼" /></div></header><TripLibrary />
  </main></AppShell>

  return <AppShell showTabBar><ZouNavigationBar title="行程安排" right={plan ? <button className="icon-button" aria-label="更多行程操作" onClick={() => setManageOpen(true)}><MoreHorizontal /></button> : null} />
    {plan && summary ? <ItineraryContent plan={plan} statusMessage={statusMessage} onEdit={() => navigate(`/travel/plan/${plan.tripId}?edit=1`)} onReplace={stop => navigate(`/travel/plan/${plan.tripId}?replace=${encodeURIComponent(stop.id)}`)} /> : <section className="page-content"><h1>全部行程</h1><p role="alert">此设备没有这份行程，请从已保存列表选择。</p><TripLibrary /></section>}
    <ZouBottomSheet open={manageOpen} onClose={() => setManageOpen(false)} title="行程管理">{plan && !plan.sourceGroup && !plan.execution?.length && (!plan.status || plan.status==='planned') ? <button className="sheet-row" type="button" onClick={()=>{try {const next=refreshRepeatedMeals(plan);if(next!==plan)writeSavedPlan(next);setStatusMessage(next===plan?'餐饮安排已是当前可匹配的结果。':'已按最新知识更新餐饮，保留原时间与锁定安排；未匹配门店的餐次待确认。');setManageOpen(false)}catch{setStatusMessage('更新未能保存，原行程保留。')}}}>按最新知识更新餐饮</button>:null}{plan ? <div className="itinerary-management">
      <label>旅行状态<FormSelect aria-label="旅行状态" value={plan.status ?? 'planned'} onChange={event => { try { writeSavedPlan({ ...plan, status: event.target.value as GeneratedPlan['status'], revision: (plan.revision ?? 1) + 1 }); setStatusMessage('旅行状态已保存') } catch (cause) { setStatusMessage(String(cause)) } }}>{Object.entries(statusNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</FormSelect></label>
      <p>全员参考费用 ¥{plan.budget}{plan.budgetLimit ? ` · 预算 ¥${plan.budgetLimit}` : ''}</p>
      {plan.validation.issues.length ? <details><summary>需要留意的安排</summary>{plan.validation.issues.map((issue, i) => <p key={i}>{issue}</p>)}</details> : null}
      {statusMessage ? <p role="status">{statusMessage}</p> : null}
      <button onClick={() => navigate(`/travel/plan/${plan.tripId}?edit=1`)}>调整日程</button>
      <button onClick={() => { useAppStore.setState({ activeRouteId: plan.tripId, tripCity: plan.city }); navigate(tripToolUrl('/journey/tools', plan)) }}>行程工具</button>
      {plan.sourceGroup ? <button onClick={() => navigate(`/group-plans/${plan.sourceGroup!.planId}`)}>同行与投票</button> : null}
    </div> : null}</ZouBottomSheet>
  </AppShell>
}
