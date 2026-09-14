import { cloneElement, useState, type ReactElement } from 'react'
import { ChevronRight } from 'lucide-react'
import { writeSavedPlan } from '../services/trip/planner'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useSavedTrips } from './TripLibrary'
import { tripSummary, tripToolUrl } from '../services/trip/summary'
import { AppShell } from './AppShell'
import { ZouNavigationBar } from './ui'
import { TripScopeHeaderContext } from './TripScopeHeader'

/** Tools are never mounted without an explicit, existing Trip ID. Remounting discards old form state. */
export function TripScope({ children, global = false }: { children: ReactElement; global?: boolean }) {
  const plans = useSavedTrips(), [params] = useSearchParams(), location = useLocation(), navigate = useNavigate()
  const id = params.get('tripId'), plan = plans.find(plan => plan.tripId === id)
  const [error,setError]=useState('')
  if (global && !id) return children
  if (plan) return <TripScopeHeaderContext.Provider value={<aside className="trip-scope" aria-label="当前工具所属行程"><div><strong>{tripSummary(plan).title}</strong><small>{tripSummary(plan).dates}</small></div><button onClick={() => { if (window.confirm('切换行程会离开当前表单；尚未保存的输入将被丢弃。已保存的记录会保留。')) navigate(`${location.pathname}?select=1`) }}>切换</button>{params.get('revision')&&params.get('revision')!==String(plan.revision??1)?<p role="status">行程已更新，请核对日期与关联地点。</p>:null}</aside>}>{cloneElement(children, { key: id })}</TripScopeHeaderContext.Provider>
  return <AppShell showTabBar><ZouNavigationBar title="选择行程" /><main className="page-content trip-scope-picker"><h1>这次要整理哪趟旅行？</h1>{id ? <p role="alert">这次行程不存在或已移除。请选择行程，原记录没有转移到其他行程。</p> : null}<div className="trip-scope-picker__list">{plans.map((plan,index) => <button className="trip-scope-picker__item" key={plan.tripId??index} onClick={() => {try{navigate(tripToolUrl(location.pathname, plan.tripId?plan:writeSavedPlan(plan)), { replace: true })}catch(cause){setError(String(cause))}}}><span><strong>{tripSummary(plan).title}</strong><small>{tripSummary(plan).dates}</small></span><ChevronRight aria-hidden="true"/></button>)}</div>{error?<p role="alert">{error}</p>:null}{!plans.length ? <><p>先创建并保存一次旅行，再准备清单、记账和分享。</p><button onClick={() => navigate('/travel/new')}>创建行程</button></> : null}</main></AppShell>
}
