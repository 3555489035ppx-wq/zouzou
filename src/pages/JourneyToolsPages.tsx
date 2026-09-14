import { FormSelect } from '../components/FormSelect'
import { FormPicker } from '../components/FormPicker'
import { useTripMembers } from '../services/trip/useTripMembers'
import { MediaAsset, resolveMediaAsset } from '../components/MediaAsset'
import { tripCounts, tripSummary, tripToolUrl, countLabel } from '../services/trip/summary'
import { PlaceKnowledgeContent } from '../components/JourneyPlaceSheet'
export { JourneyPlaceSheet } from '../components/JourneyPlaceSheet'
import { readSavedPlans } from '../services/trip/planner'
import { readVersioned, writeVersioned } from '../services/storage'
import { allocateExpense, splitExpenseBalances } from '../services/trip/journeyTools'
import { PrivateShare } from '../components/PrivateShare'
import { Backpack, CalendarDays, Check, ChevronRight, CircleDollarSign, Footprints, MapPin, Plus, Share2, Trash2, WalletCards } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { OpenMapButton } from '../components/MapLauncher'
import { ZouBottomSheet, ZouButton, ZouNavigationBar, ZouToast } from '../components/ui'
import type { Route as DiscoverRoute } from '../demo-data/discover'
import { getDemoTripPlaces } from '../demo-data/cities'
import type { Place } from '../demo-data/trips'
import { getPlaceKnowledge } from '../services/trip/goohKnowledge'
import { createPackingSeed, mergePackingSuggestions, formatExpenseMoney, EXPENSE_CATEGORIES, PACKING_CATEGORIES, packingProgress, summarizeExpenses, type Footprint, type PackingItem, type TripExpense } from '../services/trip/journeyTools'
import { useAppStore } from '../stores/appStore'
import { track } from '../services/analytics'
import { getPlaceCoordinates } from '../services/places'

type JourneyContext = {
  journeyId: string
  city: string
  title: string
  durationDays: number
  cover: string
  places: Place[]
}

const useJourneyContext = (_requiresTrip = true) => {
  const [params] = useSearchParams()
  const plan = readSavedPlans()?.find(plan => plan.tripId === params.get('tripId'))
  return { journeyId: plan?.tripId ?? '', city: plan?.city ?? '', title: plan ? tripSummary(plan).title : '全部城市记忆', durationDays: plan ? Object.keys(plan.days).length : 0, cover: plan ? resolveMediaAsset(plan.city)?.src ?? '' : '', places: plan ? Object.values(plan.days).flat() : [], plan, url: (path: string) => plan ? tripToolUrl(path, plan) : path }
}

const dateValue = (value = new Date()) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
const formatDate = (value: string) => new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

function usePreparedPacking(context: ReturnType<typeof useJourneyContext>) {
  const stored = useAppStore(state => state.packingItems)
  const dismissed = useAppStore(state => state.packingDismissed)
  const addSuggestions = useAppStore(state => state.addPackingSuggestions)
  const activities = context.places.map(place => place.name).join(' ')
  const revision = context.plan?.revision
  const seed = useMemo(() => context.journeyId ? createPackingSeed({ journeyId: context.journeyId, city: context.city, days: context.durationDays, activities }).map(item => ({ ...item, tripRevision: revision })) : [], [context.journeyId, context.city, context.durationDays, activities, revision])
  const [error, setError] = useState('')
  const items = useMemo(() => mergePackingSuggestions(stored, seed, dismissed), [stored, seed, dismissed])
  useEffect(() => {
    if (items === stored) return
    try { addSuggestions(seed) } catch { setError('清单暂时无法保存，请保持当前页面并重试。') }
  }, [addSuggestions, seed, items, stored])
  return { items, error }
}

const JourneyToolCard = ({ icon: Icon, title, description, metric, onClick }: { icon: typeof WalletCards; title: string; description: string; metric: string; onClick: () => void }) => <button className="journey-tool-card" onClick={onClick}>
  <span className="journey-tool-card__icon"><Icon /></span>
  <span className="journey-tool-card__copy"><strong>{title}</strong><small>{description}</small><em>{metric}</em></span>
  <ChevronRight />
</button>

export const JourneyToolsPage = () => {
  const navigate = useNavigate()
  const context = useJourneyContext()
  const expenses = useAppStore((state) => state.expenses)
  const { items: packingItems, error: packingError } = usePreparedPacking(context)
  const footprints = useAppStore((state) => state.footprints)
  const summary = useMemo(() => summarizeExpenses(expenses.filter(item=>item.currency==='CNY'), context.journeyId), [context.journeyId, expenses])
  const progress = useMemo(() => packingProgress(packingItems, context.journeyId), [context.journeyId, packingItems])
  const [confirmed,setConfirmed]=useState<string[]>(()=>readVersioned<string[]>('zouzou-preparation-confirmed','local')??[])
  const actionKey=(day:string,id:string)=>context.journeyId+':'+(context.plan?.revision??1)+':'+day+':'+id
  const confirmAction=(day:string,id:string)=>{const next=[...confirmed,actionKey(day,id)];if(writeVersioned('zouzou-preparation-confirmed',next,'local'))setConfirmed(next)}
  const visitedCount = footprints.filter((item) => item.journeyId === context.journeyId).length
  const openPlace = (place: Place, day?: string) => { track('place_open', { placeType: place.type }); navigate(context.url(`/journey/place/${encodeURIComponent(place.id)}?name=${encodeURIComponent(place.name)}&day=${encodeURIComponent(day??'')}`)) }
  return <AppShell showTabBar><ZouNavigationBar title="行程工具" /><main className="journey-tools-page page-content">
    <section className="journey-hero"><MediaAsset city={context.city} src={context.cover} /><div><span>{context.city} · {context.durationDays}天</span><h1>{context.title}</h1><p>把要花的钱、要带的东西和走过的地方，放在同一个行程里。</p></div></section>
    <section className="journey-tool-grid" aria-label="行程工具">
      <JourneyToolCard icon={WalletCards} title="费用记录" description="按天和类别记下旅途花销" metric={`人民币账本 ¥${summary.total}`} onClick={() => navigate(context.url('/journey/expense'))} />
      <JourneyToolCard icon={Backpack} title="出发清单" description="物品已备好，带齐一件勾一件" metric={`${progress.completed}/${progress.total} 已带齐`} onClick={() => navigate(context.url('/journey/packing'))} />
      <JourneyToolCard icon={Footprints} title="城市记忆" description="按城市整理走过的记忆" metric={`${visitedCount} 个地点记录`} onClick={() => navigate(context.url('/journey/footprint'))} />
      <JourneyToolCard icon={Share2} title="分享行程" description="生成一张可以带走的路线卡片" metric={`${context.plan ? countLabel(tripCounts(context.plan.days)) : "0 个地点"}`} onClick={() => navigate(context.url('/journey/share'))} />
    </section>
    {packingError ? <p role="alert">{packingError}</p> : null}<section className="journey-section">
      <h2>出发前要确认</h2><p>根据本次行程的预约、营业时间和待定地点整理。自行核对记录只对当前行程版本有效。</p>
      {context.plan ? (() => {
        const actions=Object.entries(context.plan.days).flatMap(([day,stops])=>stops.filter(stop=>!confirmed.includes(actionKey(day,stop.id)) && (stop.pendingVenue || /预约/.test(stop.opening?.label??'') || stop.factState!=='verified')).map(stop=>({day,stop})))
        const renderAction=({day,stop}:typeof actions[number])=><div key={day+stop.id}><button className="sheet-row" onClick={()=>openPlace(stop,day)}>{day} · {stop.name}：{stop.pendingVenue?'确定具体地点':/预约/.test(stop.opening?.label??'')?'核对预约和出行日期':'核对营业时间与费用'}</button>{!stop.pendingVenue?<button onClick={()=>confirmAction(day,stop.id)}>我已自行核对本次日期</button>:null}</div>
        return <>{actions.slice(0,5).map(renderAction)}{actions.length>5?<details><summary>其余 {actions.length-5} 项待确认</summary>{actions.slice(5).map(renderAction)}</details>:null}{!actions.length?<p>目前没有待确认事项。</p>:null}</>
      })() : null}
    </section>
  </main></AppShell>
}

export const ExpensePage = () => {
  const navigate = useNavigate()
  const context = useJourneyContext()
  const [params] = useSearchParams()
  const expenses = useAppStore((state) => state.expenses)
  const addExpense = useAppStore((state) => state.addExpense)
  const updateExpense = useAppStore((state) => state.updateExpense)
  const deleteExpense = useAppStore((state) => state.deleteExpense)
  const [amount, setAmount] = useState('')
  const membership=useTripMembers(context.plan), members=membership.members
  const [payer,setPayer]=useState(members[0]?.id??'')
  const [participants,setParticipants]=useState<string[]>(members.map(member=>member.id))
  const [kind,setKind]=useState<'payment'|'refund'>('payment')
  const [currency,setCurrency]=useState('CNY')
  const [splitMode,setSplitMode]=useState<'equal'|'amount'|'shares'>('equal')
  const [allocations,setAllocations]=useState<Record<string,string>>({})
  useEffect(()=>{if(membership.shared&&members.length){setPayer(previous=>members.some(member=>member.id===previous)?previous:members[0].id);setParticipants(previous=>previous.some(id=>members.some(member=>member.id===id))?previous.filter(id=>members.some(member=>member.id===id)):members.map(member=>member.id))}},[members,membership.shared])
  const submissionId=useRef(newId('expense'))
  const [category, setCategory] = useState<TripExpense['category']>('交通')
  const [dayId, setDayId] = useState(params.get('day') ?? 'Day 1')
  const [placeId, setPlaceId] = useState(params.get('place') ?? '')
  const [note, setNote] = useState('')
  const [occurredAt, setOccurredAt] = useState(dateValue())
  const [editingId, setEditingId] = useState<string | null>(null)
  const expenseForm = useRef<HTMLFormElement>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const scopedExpenses = useMemo(() => expenses.filter((expense) => expense.journeyId === context.journeyId), [context.journeyId, expenses])
  const summary = useMemo(() => summarizeExpenses(expenses.filter(item=>item.currency==='CNY'), context.journeyId), [context.journeyId, expenses])

  const resetForm = () => {
    setAmount(''); setCategory('交通'); setDayId(params.get('day') ?? 'Day 1'); setPlaceId(params.get('place') ?? ''); setNote(''); setOccurredAt(dateValue()); setEditingId(null); setError('')
    setCurrency('CNY'); setKind('payment'); setSplitMode('equal'); setAllocations({}); setPayer(members[0]?.id ?? ''); setParticipants(members.map(member => member.id))
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if(membership.loading || membership.error || !members.length){setError('请先成功读取有权访问的同行成员');return}
    const parsed = Number(amount)
    if(!/^\d+(?:\.\d{1,2})?$/.test(amount)){setError('金额最多保留两位小数');return}
    if (!Number.isFinite(parsed) || parsed <= 0) { setError('请输入大于 0 的金额'); return }
    const participantIds=participants.filter(id=>members.some(member=>member.id===id))
    if(!members.some(member=>member.id===payer) || !participantIds.length){setError('请填写付款人和至少一位分摊人');return}
    if(dayId && !context.plan?.days[dayId]){setError('所选行程日已改变，请重新选择');return}
    if(placeId && !context.places.some(place=>place.id===placeId)){setError('所选地点已改变，请重新选择');return}
    const payload = { tripRevision:context.plan?.revision??1, dayId: dayId || undefined, placeId: placeId || undefined, amount: Math.round(parsed * 100) / 100, amountMinor: Math.round(parsed * 100), kind, splitMode, allocations: Object.fromEntries(participantIds.map(id=>[id, splitMode==='amount'?Math.round(Number(allocations[id]??0)*100):Number(allocations[id]??1)])), currency, category, payerId:payer.trim(), participantIds, note: note.trim() || undefined, occurredAt: `${occurredAt}T12:00:00.000Z` }
    try {
      const record={ id: submissionId.current, journeyId: context.journeyId, ...payload, createdAt: new Date().toISOString() }; allocateExpense(record)
      if (editingId) updateExpense(editingId, payload); else addExpense(record)
      submissionId.current=newId('expense')
    } catch(cause) { setError(String(cause)); return }
    track('expense_added', { category, editing: Boolean(editingId) })
    setMessage(editingId ? '费用已更新' : '费用已保存')
    resetForm()
  }
  const edit = (expense: TripExpense) => { setEditingId(expense.id); setAmount(String(expense.amount)); setPayer(expense.payerId ?? members[0]?.id ?? ''); setParticipants(expense.participantIds); setKind(expense.kind??'payment'); setCurrency(expense.currency); setSplitMode(expense.splitMode??'equal'); setAllocations(Object.fromEntries(Object.entries(expense.allocations??{}).map(([id,n])=>[id,String(expense.splitMode==='amount'?n/100:n)]))); setCategory(expense.category); setDayId(expense.dayId ?? 'Day 1'); setPlaceId(expense.placeId ?? ''); setNote(expense.note ?? ''); setOccurredAt(dateValue(new Date(expense.occurredAt))) }

  return <AppShell showTabBar>
    <ZouNavigationBar title="旅行账单" right={<button className="text-button" onClick={() => navigate(context.url('/journey/tools'))}>行程工具</button>} />
    <main className="journey-form-page expense-page page-content">
      <section className="journey-page-intro"><h1>这趟旅行，花了多少</h1><p>随手记一笔，花销和分摊都清楚。账本保存在此设备。</p></section>
      <section className="journey-summary-card expense-overview" aria-label="人民币账单汇总">
        <span>累计支出 · 人民币</span><strong>{formatExpenseMoney(summary.total)}</strong>
        <small>已扣除退款</small>
        <div>{Object.entries(summary.byCategory).filter(([, value]) => value !== 0).map(([key, value]) => <span key={key}>{key} {formatExpenseMoney(value)}</span>)}</div>
        {scopedExpenses.some(item => item.currency !== 'CNY') ? <small>历史外币记录按原币种保留，未计入人民币合计。</small> : null}
      </section>
      {membership.loading ? <p role="status">正在读取同行成员…</p> : null}
      {membership.error ? <div className="journey-inline-notice" role="alert"><span>同行成员暂时无法读取。</span><button onClick={membership.retry}>重试</button></div> : null}
      <form ref={expenseForm} className="journey-form expense-entry" onSubmit={submit}>
        <header><h2>{editingId ? '编辑这一笔' : '记一笔'}</h2>{editingId ? <button type="button" className="text-button" onClick={resetForm}>取消编辑</button> : <span className="expense-currency">人民币 ¥</span>}</header>
        <div className="journey-filter" aria-label="记录类型"><button type="button" aria-pressed={kind === 'payment'} onClick={() => setKind('payment')}>支出</button><button type="button" aria-pressed={kind === 'refund'} onClick={() => setKind('refund')}>退款</button></div>
        <label className="expense-amount">{currency === 'CNY' ? '金额（元）' : `金额（${currency}，保留原币种）`}<input aria-label="账单金额" inputMode="decimal" min="0.01" step="0.01" type="number" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" required /></label>
        <div className="journey-form__row"><label>分类<FormSelect value={category} onChange={event => setCategory(event.target.value as TripExpense['category'])}>{EXPENSE_CATEGORIES.map(item => <option key={item}>{item}</option>)}</FormSelect></label><label>付款日期<FormPicker type="date" value={occurredAt} onChange={event => setOccurredAt(event.target.value)} required /></label></div>
        <label>备注（可选）<input value={note} onChange={event => setNote(event.target.value)} placeholder="例如：两个人的咖啡" maxLength={80} /></label>
        <details className="journey-form-details">
          <summary>付款人与分摊<span>{members.find(member => member.id === payer)?.name ?? '待确认'} · {participants.length}人{splitMode === 'equal' ? '均分' : '自定义'}</span></summary>
          <div><label>付款人<FormSelect aria-label="付款人" value={payer} onChange={event => setPayer(event.target.value)}>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</FormSelect></label>
          <fieldset><legend>分摊成员</legend>{members.map(member => <label key={member.id}><input type="checkbox" checked={participants.includes(member.id)} onChange={event => setParticipants(event.target.checked ? [...participants, member.id] : participants.filter(id => id !== member.id))} />{member.name}</label>)}</fieldset>
          <label>分摊方式<FormSelect aria-label="分摊方式" value={splitMode} onChange={event => setSplitMode(event.target.value as typeof splitMode)}><option value="equal">平均分摊</option><option value="amount">自定义金额</option><option value="shares">按份数</option></FormSelect></label>
          {splitMode !== 'equal' ? members.filter(member => participants.includes(member.id)).map(member => <label key={member.id}>{member.name}的{splitMode === 'amount' ? '金额' : '份数'}<input type="number" min="0" step="0.01" value={allocations[member.id] ?? ''} onChange={event => setAllocations({ ...allocations, [member.id]: event.target.value })} /></label>) : null}
          <small>{membership.shared ? '使用已加入本次旅行的成员。' : '同行人是这份本机账本中的记账名称。'}</small></div>
        </details>
        <details className="journey-form-details"><summary>关联行程日与地点<span>可选</span></summary><div>
          <label>行程日<FormSelect aria-label="行程日" value={dayId} onChange={event => setDayId(event.target.value)}>{['', ...Object.keys(context.plan?.days ?? {})].map(item => <option key={item} value={item}>{item || '行前支付 / 不关联'}</option>)}</FormSelect></label>
          <label>关联地点<FormSelect value={placeId} onChange={event => setPlaceId(event.target.value)}><option value="">不关联地点</option>{context.places.filter((place, index, places) => places.findIndex(item => item.id === place.id) === index).map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</FormSelect></label>
        </div></details>
        {error ? <p className="journey-form__error" role="alert">{error}</p> : null}
        <ZouButton type="submit" disabled={membership.loading || Boolean(membership.error)}>{editingId ? '保存修改' : kind === 'refund' ? '记下退款' : '记下这笔'}</ZouButton>
      </form>
      <section className="journey-section expense-records"><header className="journey-section__header"><h2>账单明细</h2><small>{scopedExpenses.length} 笔</small></header>
        {scopedExpenses.length ? <div className="journey-record-list">{scopedExpenses.map(expense => <article className="journey-record" key={expense.id}>
          <div><strong>{expense.kind === 'refund' ? '退款 −' : ''}{formatExpenseMoney(expense.amount, expense.currency)}</strong><span>{expense.category} · {formatDate(expense.occurredAt)}</span>
            {expense.note ? <small>{expense.note}</small> : null}
            <small>{expense.dayId ?? '行前支付'}{expense.placeId ? ' · ' + (context.places.find(place => place.id === expense.placeId)?.name ?? '地点') : ''} · {expense.settled ? '已结清' : '待结算'}</small>
          </div><div className="journey-record__actions">
            <button type="button" aria-label="编辑费用" onClick={() => { edit(expense); expenseForm.current?.scrollIntoView({ behavior: 'auto', block: 'start' }) }}>编辑</button>
            <details><summary>更多</summary><button type="button" onClick={() => { try { updateExpense(expense.id, { settled: !expense.settled }) } catch (cause) { setError(String(cause)) } }}>{expense.settled ? '撤销结清' : '标记结清'}</button>
              <button type="button" aria-label="删除费用" onClick={() => { try { deleteExpense(expense.id); if (editingId === expense.id) resetForm() } catch (cause) { setError(String(cause)) } }}>删除</button>
            </details>
          </div>
        </article>)}</div> : <p className="journey-empty-copy">还没有记录，从今天的第一笔花销开始。</p>}
      </section>
      {scopedExpenses.length ? <details className="journey-form-details expense-balances"><summary>查看 AA 结算<span>按未结清记录计算</span></summary><div>
        <p>正数应收，负数应付；标记结清仅作记录。</p>
        {splitExpenseBalances(scopedExpenses.filter(expense => !expense.settled)).map(group => <div key={group.currency}>{group.people.map(person => <p className="expense-balance-row" key={person.name}><span>{members.find(member => member.id === person.name)?.name ?? person.name}</span><strong>{person.cents > 0 ? '应收 ' : person.cents < 0 ? '应付 ' : '已平 '}{formatExpenseMoney(Math.abs(person.cents) / 100, group.currency)}</strong></p>)}</div>)}
        {scopedExpenses.every(expense => expense.settled) ? <p>目前的记录都已标记结清。</p> : null}
      </div></details> : null}
      {message ? <ZouToast message={message} onClose={() => setMessage('')} /> : null}
    </main>
  </AppShell>
}

export const PackingPage = () => {
  const navigate = useNavigate()
  const context = useJourneyContext()
  const { items: packingItems, error } = usePreparedPacking(context)
  const addPackingItem = useAppStore(state => state.addPackingItem)
  const togglePackingItem = useAppStore(state => state.togglePackingItem)
  const deletePackingItem = useAppStore(state => state.deletePackingItem)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PackingItem | null>(null)
  const [deletedItem, setDeletedItem] = useState<PackingItem | null>(null)
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<PackingItem['category']>('个人')
  const [owner, setOwner] = useState('本人')
  const [packingNote, setPackingNote] = useState('')
  const [remainingOnly, setRemainingOnly] = useState(false)
  const [message, setMessage] = useState('')
  const scopedItems = useMemo(() => packingItems.filter(item => item.journeyId === context.journeyId), [context.journeyId, packingItems])
  const progress = packingProgress(scopedItems)
  const openEditor = (item: PackingItem | null = null) => {
    setEditingItem(item); setLabel(item?.label ?? ''); setCategory(item?.category ?? '个人')
    setOwner(item?.ownerId ?? '本人'); setPackingNote(item?.note ?? ''); setSheetOpen(true)
    setMessage('')
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!label.trim()) return
    if (scopedItems.some(item => item.label.trim() === label.trim() && item.id !== editingItem?.id)) { setMessage('这件物品已在清单中'); return }
    try {
      addPackingItem({ ...(editingItem ?? { id: newId('packing'), journeyId: context.journeyId, checked: false, createdAt: new Date().toISOString() }), label: label.trim(), category, tripRevision: context.plan?.revision, ownerId: owner.trim(), note: packingNote.trim(), recommended: editingItem?.recommended ?? false })
      setSheetOpen(false); setMessage(editingItem ? '物品已更新' : '已加入清单')
    } catch (cause) { setMessage(String(cause)) }
  }
  return <AppShell showTabBar>
    <ZouNavigationBar title="行李清单" right={<button className="text-button" onClick={() => navigate(context.url('/journey/tools'))}>行程工具</button>} />
    <main className="journey-form-page packing-page page-content">
      <section className="journey-page-intro"><h1>带齐了，就出发</h1><p>物品已为你整理好，放进行李就打勾。不用带的可以移除，进度自动保存在此设备。</p></section>
      <section className="journey-summary-card journey-summary-card--progress">
        <div><span>已带齐</span><strong>{progress.completed}<small> / {progress.total}</small></strong></div>
        <div className="journey-progress" role="progressbar" aria-label="行李准备进度" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed}><span style={{ width: `${progress.total ? progress.completed / progress.total * 100 : 0}%` }} /></div>
        <small>{progress.state === 'completed' ? '清单已经全部勾选，出发前再检查一次证件。' : `还有 ${progress.total - progress.completed} 件待准备，按自己的需要取舍。`}</small>
      </section>
      <div className="packing-toolbar"><div className="journey-filter" aria-label="清单筛选">
        <button aria-pressed={!remainingOnly} onClick={() => setRemainingOnly(false)}>全部物品</button>
        <button aria-pressed={remainingOnly} onClick={() => setRemainingOnly(true)}>还没带齐</button>
      </div><button className="text-button" onClick={() => openEditor()}><Plus size={16} />补充物品</button></div>
      {deletedItem ? <div className="journey-inline-notice" role="status"><span>已移除「{deletedItem.label}」</span><button onClick={() => { try { addPackingItem(deletedItem); setDeletedItem(null) } catch (cause) { setMessage(String(cause)) } }}>撤销</button></div> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="journey-packing-list">
        {PACKING_CATEGORIES.map(group => {
          const allItems = scopedItems.filter(item => item.category === group)
          const items = allItems.filter(item => !remainingOnly || !item.checked)
          return items.length ? <section key={group} aria-label={group}>
            <header><h2>{group === '必带' ? '证件与凭证' : group}</h2><small>{allItems.filter(item => item.checked).length} / {allItems.length}</small></header>
            {items.map(item => <div className={`packing-row ${item.checked ? 'is-checked' : ''}`} key={item.id}>
              <button className="packing-row__toggle" aria-label={item.label} aria-pressed={item.checked} onClick={() => { try { togglePackingItem(item.id); track('packing_checked', { checked: !item.checked }) } catch (cause) { setMessage(String(cause)) } }}><span>{item.checked ? <Check /> : null}</span><strong>{item.label}</strong></button>
              <button className="packing-row__edit" aria-label={`编辑${item.label}`} onClick={() => openEditor(item)}>···</button>
              {item.note || item.ownerId && item.ownerId !== '本人' ? <small className="packing-row__note">{item.ownerId && item.ownerId !== '本人' ? item.ownerId + ' · ' : ''}{item.note}</small> : null}
            </div>)}
          </section> : null
        })}
      </div>
      {remainingOnly && progress.completed === progress.total ? <p className="journey-empty-copy">都带齐了，可以切回全部物品再检查一遍。</p> : null}
      <ZouBottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editingItem ? '物品详情' : '补充一件物品'}>
        <form className="journey-form" onSubmit={submit}>
          <label>物品名称<input value={label} onChange={event => setLabel(event.target.value)} placeholder="例如：保温杯" maxLength={40} required /></label>
          <label>分类<FormSelect value={category} onChange={event => setCategory(event.target.value as PackingItem['category'])}>{PACKING_CATEGORIES.map(group => <option key={group}>{group}</option>)}</FormSelect></label>
          <details className="journey-form-details"><summary>准备人和备注（可选）</summary><div>
            <label>准备人<input value={owner} onChange={event => setOwner(event.target.value)} maxLength={30} /></label>
            <label>物品备注<input value={packingNote} onChange={event => setPackingNote(event.target.value)} maxLength={100} /></label>
          </div></details>
          <ZouButton type="submit">{editingItem ? '保存修改' : '加入清单'}</ZouButton>
          {sheetOpen && message ? <p className="journey-form__error" role="alert">{message}</p> : null}
          {editingItem ? <ZouButton type="button" variant="secondary" onClick={() => { try { deletePackingItem(editingItem.id); setDeletedItem(editingItem); setSheetOpen(false) } catch (cause) { setMessage(String(cause)) } }}>{editingItem.recommended ? '这次不需要带' : '移除这件物品'}</ZouButton> : null}
        </form>
      </ZouBottomSheet>
      {message ? <ZouToast message={message} onClose={() => setMessage('')} /> : null}
    </main>
  </AppShell>
}

type CityMemory = { city: string; entries: Footprint[] }

export const FootprintPage = () => {
  const context = useJourneyContext(false)
  const allFootprints = useAppStore(state=>state.footprints)
  const addFootprint = useAppStore(state=>state.addFootprint)
  const updateFootprint = useAppStore(state=>state.updateFootprint)
  const deleteFootprint = useAppStore(state=>state.deleteFootprint)
  const [all,setAll] = useState(!context.journeyId)
  const [formOpen,setFormOpen] = useState(false)
  const [selectedId,setSelectedId] = useState<string|null>(null)
  const [city,setCity] = useState(context.city), [place,setPlace] = useState(''), [visitedAt,setVisitedAt] = useState(dateValue()), [note,setNote] = useState('')
  const [photos,setPhotos] = useState<string[]>([]), [photoBusy,setPhotoBusy] = useState(false)
  const [editingId,setEditingId] = useState<string|null>(null), [formError,setFormError] = useState(''), [message,setMessage] = useState('')
  const footprints = useMemo(()=>all?allFootprints:allFootprints.filter(item=>item.journeyId===context.journeyId),[all,allFootprints,context.journeyId])
  const cityMemories = useMemo<CityMemory[]>(()=>{
    const groups=new Map<string,Footprint[]>()
    footprints.forEach(item=>groups.set(item.city,[...(groups.get(item.city)??[]),item]))
    return [...groups].map(([city,entries])=>({city,entries:entries.sort((a,b)=>b.visitedAt.localeCompare(a.visitedAt))})).sort((a,b)=>b.entries[0].visitedAt.localeCompare(a.entries[0].visitedAt))
  },[footprints])
  const selected=footprints.find(item=>item.id===selectedId)
  const editing=allFootprints.find(item=>item.id===editingId)
  const placeName=(item:Footprint)=>{
    if(!item.placeId)return '城市随记'
    const plan=readSavedPlans()?.find(plan=>plan.tripId===item.journeyId)
    return Object.values(plan?.days??{}).flat().find(stop=>stop.id===item.placeId)?.name ?? (item.source==='journey'?'行程地点':item.placeId)
  }
  const openNew=()=>{setEditingId(null);setCity(context.city);setPlace('');setVisitedAt(dateValue());setNote('');setPhotos([]);setFormError('');setFormOpen(true)}
  const edit=(item:Footprint)=>{setSelectedId(null);setEditingId(item.id);setCity(item.city);setPlace(item.placeId??'');setVisitedAt(dateValue(new Date(item.visitedAt)));setNote(item.note??'');setPhotos(item.photos??[]);setFormError('');setFormOpen(true)}
  const submit=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault()
    if(!city.trim()||!visitedAt||photoBusy)return
    const payload={photos,city:city.trim(),country:'中国',placeId:place.trim()||undefined,visitedAt:`${visitedAt}T12:00:00.000Z`,note:note.trim()||undefined}
    try{
      if(editingId)updateFootprint(editingId,payload)
      else{addFootprint({id:newId('footprint'),userId:'local-guest',journeyId:all?undefined:context.journeyId,tripRevision:all?undefined:context.plan?.revision,source:'manual',createdAt:new Date().toISOString(),...payload});track('footprint_created',{source:'manual'})}
      setFormOpen(false);setMessage(editingId?'足迹已更新':'足迹已保存')
    }catch(cause){setFormError(String(cause))}
  }
  return <AppShell showTabBar><ZouNavigationBar title="旅行足迹" right={footprints.length?<button className="text-button" onClick={openNew}>添加足迹</button>:undefined}/><main className="footprint-page">
    {context.journeyId?<div className="footprint-scope"><button aria-pressed={!all} onClick={()=>setAll(false)}>本次行程</button><button aria-pressed={all} onClick={()=>setAll(true)}>全部足迹</button></div>:null}
    {footprints.length?<><header className="footprint-page__summary"><h1>去过 {cityMemories.length} 座城市</h1><p>{footprints.length} 条足迹</p></header><div className="footprint-groups">{cityMemories.map(memory=><section className="footprint-group" key={memory.city} aria-label={`${memory.city}的足迹`}><header><h2>{memory.city}</h2><span>{memory.entries.length} 条</span></header><ol>{memory.entries.map(item=><li key={item.id}><button className="footprint-entry" onClick={()=>setSelectedId(item.id)} aria-label={`查看${item.city}·${placeName(item)}足迹`}>
      <div className="footprint-entry__copy"><time dateTime={item.visitedAt}>{new Date(item.visitedAt).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'})}</time><h3>{placeName(item)}</h3>{item.note?<p>{item.note}</p>:null}</div>{item.photos?.[0]?<img className="footprint-entry__photo" src={item.photos[0]} alt="足迹照片"/>:<ChevronRight size={18} aria-hidden="true"/>}
    </button></li>)}</ol></section>)}</div></>:<section className="footprint-page__empty"><Footprints size={44} aria-hidden="true"/><h1>还没有足迹</h1><p>把去过的地方，记在这里。</p><ZouButton onClick={openNew}>添加第一条足迹</ZouButton></section>}
    <ZouBottomSheet open={Boolean(selected)} onClose={()=>setSelectedId(null)} title={selected?`${selected.city} · ${placeName(selected)}`:'足迹详情'}>{selected?<div className="footprint-detail"><p className="footprint-detail__date">{new Date(selected.visitedAt).toLocaleDateString('zh-CN')} · {selected.source==='journey'?'来自行程':'个人记录'}</p>{selected.note?<p>{selected.note}</p>:null}{selected.photos?.length?<div className="footprint-detail__photos">{selected.photos.map((src,index)=><img src={src} key={index} alt={`足迹照片${index+1}`}/>)}</div>:null}<div className="footprint-detail__actions"><ZouButton variant="secondary" onClick={()=>edit(selected)}>编辑足迹</ZouButton><button onClick={()=>{try{deleteFootprint(selected.id);setSelectedId(null);setMessage('足迹已删除')}catch(cause){setMessage(String(cause))}}}>删除足迹</button></div></div>:null}</ZouBottomSheet>
    <ZouBottomSheet open={formOpen} onClose={()=>setFormOpen(false)} title={editingId?'编辑足迹':'添加足迹'}><form className="footprint-form" onSubmit={submit}><label>城市<input value={city} onChange={e=>setCity(e.target.value)} placeholder="例如：苏州" required maxLength={40}/></label><label>地点（选填）<input value={editing?.source==='journey'?placeName(editing):place} onChange={e=>setPlace(e.target.value)} placeholder="例如：平江路" readOnly={Boolean(editingId&&allFootprints.find(item=>item.id===editingId)?.source==='journey')} aria-describedby={editingId&&allFootprints.find(item=>item.id===editingId)?.source==='journey'?'footprint-place-note':undefined}/></label>{editingId&&allFootprints.find(item=>item.id===editingId)?.source==='journey'?<small id="footprint-place-note">关联地点：{placeName(allFootprints.find(item=>item.id===editingId)!)}</small>:null}<label>去过的日期<FormPicker type="date" value={visitedAt} onChange={e=>setVisitedAt(e.target.value)} required/></label><label>一句话记录（选填）<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="记下一点印象" maxLength={80} rows={3}/></label><label className="footprint-photo-input">照片（选填，最多3张）<input type="file" accept="image/*" multiple disabled={photoBusy} onChange={async e=>{const files=Array.from(e.target.files??[]).slice(0,3);if(!files.length)return;setPhotoBusy(true);setFormError('');try{setPhotos(await Promise.all(files.map(file=>new Promise<string>((resolve,reject)=>{if(file.size>2*1024*1024){reject(Error('每张照片须小于2MB'));return}const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('照片读取失败'));reader.readAsDataURL(file)}))))}catch(cause){setFormError(String(cause))}finally{setPhotoBusy(false)}}}/></label>{photos.length?<div className="footprint-form__photos">{photos.map((src,index)=><div key={index}><img src={src} alt={`照片${index+1}`}/><button type="button" onClick={()=>setPhotos(photos.filter((_,i)=>i!==index))}>移除照片 {index+1}</button></div>)}</div>:null}{formError?<p role="alert">{formError}</p>:null}<ZouButton type="submit" disabled={photoBusy}>{photoBusy?'正在读取照片…':'保存足迹'}</ZouButton></form></ZouBottomSheet>
    {message?<ZouToast message={message} onClose={()=>setMessage('')}/>:null}
  </main></AppShell>
}


export const PlaceKnowledgePage = () => {
  const navigate = useNavigate()
  const context = useJourneyContext()
  const { placeId } = useParams()
  const [params] = useSearchParams()
  const place = (context.plan?.days[params.get('day')??''] ?? context.places).find((item) => item.id === decodeURIComponent(placeId ?? ''))
  useEffect(() => { if (place) track('place_open', { placeType: place.type }) }, [place])
  if (!place) return <AppShell><ZouNavigationBar title="地点资料" /><main className="journey-empty-page"><p>暂时没有找到这个地点。</p><ZouButton onClick={() => navigate(context.url('/journey/tools'))}>回到行程工具</ZouButton></main></AppShell>
  return <AppShell showTabBar><ZouNavigationBar title="地点资料" right={<button className="text-button" onClick={() => navigate(context.url('/journey/share'))}>分享</button>} /><main className="place-knowledge-page page-content"><header className="place-knowledge-hero"><span>{context.city} · {place.type}</span><h1>{place.name}</h1><p>行程衔接 · {place.transport}</p></header><section className="journey-place-card"><PlaceKnowledgeContent place={place} city={context.city} /></section><div className="journey-form__row place-knowledge-actions"><OpenMapButton place={place} city={context.city} /><ZouButton variant="secondary" onClick={() => navigate(context.url(`/journey/expense?place=${encodeURIComponent(place.id)}`))}><CircleDollarSign />记一笔</ZouButton></div><button className="journey-back-link" onClick={() => navigate(context.url('/journey/tools'))}>回到行程工具<ChevronRight /></button></main></AppShell>
}

export const JourneySharePage = () => {
  const context = useJourneyContext()
  const plan = (readSavedPlans() ?? []).find(item => item.tripId === context.journeyId)
  return plan ? <AppShell showTabBar><ZouNavigationBar title="分享行程"/><main className="journey-form-page journey-share-page page-content"><section className="journey-page-intro"><h1>分享这趟走走</h1><p>先看看分享内容，再创建只读链接。</p></section><PrivateShare plan={plan} heading={false}/></main></AppShell> : <p>请选择已保存的行程。</p>
}
