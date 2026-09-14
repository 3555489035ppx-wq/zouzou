import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Plane } from 'lucide-react'
import { ZouAvatar } from './ui'
import { readSavedPlans, writeSavedPlan } from '../services/trip/planner'
import { tripSummary } from '../services/trip/summary'
import { useAppStore } from '../stores/appStore'
import { CloudTripStorage } from './CloudTripStorage'

export function useSavedTrips() {
  const [plans, setPlans] = useState(() => readSavedPlans() ?? [])
  useEffect(() => {
    const reload = () => setPlans(readSavedPlans() ?? [])
    window.addEventListener('storage', reload); window.addEventListener('zouzou-saved-trips-updated', reload)
    return () => { window.removeEventListener('storage', reload); window.removeEventListener('zouzou-saved-trips-updated', reload) }
  }, [])
  return plans
}
const labels: Record<string, string> = { planned: '待出发', active: '进行中', paused: '进行中', completed: '已完成', archived: '已归档' }
export function TripLibrary() {
  const plans = useSavedTrips(), navigate = useNavigate()
  const legacy = useAppStore(state=>state.personalTrips)
  const avatar = useAppStore(state=>state.avatar), nickname = useAppStore(state=>state.nickname)
  const [error, setError] = useState('')
  return <section className="trip-library" aria-label="已保存的行程">
    <CloudTripStorage plans={plans}/>
    {['待出发','进行中','已完成','已归档'].map(label=>{
      const items=plans.filter(plan=>labels[plan.status??'planned']===label)
      if(!items.length) return null
      return <section className="trip-ticket-group" key={label} aria-label={label}><h2>{label}<span>{items.length}</span></h2><div className="trip-ticket-list">{items.map((plan,index)=>{
        const summary=tripSummary(plan)
        return <article className="trip-ticket" key={plan.tripId??index}><button className="trip-ticket__open" aria-label={`打开${summary.title}`} onClick={()=>{try{const saved=plan.tripId?plan:writeSavedPlan(plan);navigate(`/trips/${saved.tripId}`)}catch(cause){setError(String(cause))}}}>
          <div className="trip-ticket__main"><div className="trip-ticket__heading"><h3>{plan.city}</h3><ArrowUpRight size={20} aria-hidden="true"/></div><p className="trip-ticket__date"><span>出发日期</span><time>{plan.dates?.start??'待定'}</time></p><div className="trip-ticket__bottom"><div className="trip-ticket__party"><ZouAvatar src={avatar} name={nickname} size="sm"/><span>{plan.partySize}人同行</span></div>{!plan.validation.passed?<small className="trip-ticket__status">待完善</small>:null}</div></div>
          <div className="trip-ticket__stub"><Plane size={20} aria-hidden="true"/><div><span>时长</span><strong>{Object.keys(plan.days).length}天{plan.nights}晚</strong></div><div><span>地点</span><strong>{summary.places}个</strong></div></div>
        </button>{['completed','archived'].includes(summary.statusCode)?<button className="trip-ticket__archive" onClick={()=>{try{writeSavedPlan({...plan,status:summary.statusCode==='archived'?'completed':'archived',revision:summary.revision+1})}catch(cause){setError(String(cause))}}}>{summary.statusCode==='archived'?'恢复行程':'归档行程'}</button>:null}</article>
      })}</div></section>
    })}
    {!plans.length?<section className="trip-library__empty"><h2>待出发</h2><p>下一趟旅程，从这里开始。</p></section>:null}
    <button className="trip-library__create zou-button zou-button--primary" onClick={()=>navigate('/travel/new')}>规划新行程</button>
    {legacy.length?<details className="trip-library__legacy"><summary>旧版路线记录 · {legacy.length}</summary>{legacy.map(item=><article key={item.id}><strong>{item.city} · {item.createdAt.slice(0,10)}</strong><button onClick={async()=>{const module=await import('../demo-data/discover');const source=module.discoverItems.find(source=>source.routeId===item.routeId);if(source)navigate(`/discover/${source.id}`);else setError('旧路线来源已不可用，原记录仍保留在本机备份中')}}>查看路线参考</button></article>)}</details>:null}
    {error?<p role="alert">{error}</p>:null}
  </section>
}

