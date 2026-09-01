import { Backpack, CalendarDays, Check, ChevronRight, CircleDollarSign, Footprints, MapPin, Plus, Share2, Trash2, WalletCards } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { RealRouteMap } from '../components/RealRouteMap'
import { ZouBottomSheet, ZouButton, ZouNavigationBar, ZouToast } from '../components/ui'
import { getRoute } from '../demo-data/discover'
import { cityProfiles, getDemoTripPlaces } from '../demo-data/cities'
import type { Place } from '../demo-data/trips'
import { getPlaceKnowledge } from '../services/trip/goohKnowledge'
import { createPackingSeed, EXPENSE_CATEGORIES, PACKING_CATEGORIES, packingProgress, summarizeExpenses, type Footprint, type PackingItem, type TripExpense } from '../services/trip/journeyTools'
import { useAppStore } from '../stores/appStore'
import { track } from '../services/analytics'

type JourneyContext = {
  journeyId: string
  city: string
  title: string
  durationDays: number
  cover: string
  places: Place[]
}

const routePlaces = (route: NonNullable<ReturnType<typeof getRoute>>) => route.pois.map((poi, index) => ({
  id: poi.id,
  time: `${9 + index}:30`,
  name: poi.name,
  type: poi.category,
  stay: poi.stay,
  budget: Math.round(route.budgetMax / Math.max(1, route.pois.length)),
  transport: poi.transportation,
  note: poi.introduction,
  x: index,
  z: index,
  lng: poi.longitude,
  lat: poi.latitude,
  coordinateSource: poi.coordinateSource,
  verified: Boolean(poi.coordinateSource),
})) satisfies Place[]

const getJourneyContext = (city: string, activeRouteId: string | null): JourneyContext => {
  const activeRoute = activeRouteId ? getRoute(activeRouteId) : undefined
  const route = activeRoute?.cityId === city ? activeRoute : undefined
  const places = route ? routePlaces(route) : getDemoTripPlaces(city, 'Day 1')
  return {
    journeyId: route?.id ?? `journey-${city}`,
    city,
    title: route?.title ?? `${city}慢慢走`,
    durationDays: 3,
    cover: route?.cover ?? '/assets/shanghai-skyline.jpg',
    places,
  }
}

const useJourneyContext = () => {
  const city = useAppStore((state) => state.tripCity ?? state.city)
  const activeRouteId = useAppStore((state) => state.activeRouteId)
  return useMemo(() => getJourneyContext(city, activeRouteId), [activeRouteId, city])
}

const dateValue = (value = new Date()) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
const formatDate = (value: string) => new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const PlaceKnowledgeContent = ({ place, city }: { place: Place; city: string }) => {
  const knowledge = getPlaceKnowledge(place.name, city)
  return <>
    <p className="journey-place__summary">{knowledge?.summary ?? place.note}</p>
    <div className="journey-fact-grid">
      <span><small>建议停留</small><strong>{knowledge?.recommendedDuration ?? place.stay}</strong></span>
      <span><small>开放时间</small><strong>{knowledge?.openingHours ?? '按地点资料安排'}</strong></span>
      <span><small>门票 / 消费</small><strong>{knowledge?.ticket ?? `约 ¥${place.budget}`}</strong></span>
      <span><small>适合时段</small><strong>{knowledge?.bestTime ?? '按当天状态调整'}</strong></span>
    </div>
    {knowledge?.highlights.length ? <section className="journey-place__section"><h3>可以怎么走</h3><div className="journey-chip-list">{knowledge.highlights.map((item) => <span key={item}>{item}</span>)}</div></section> : null}
    {knowledge?.recommendedActivities.length ? <section className="journey-place__section"><h3>适合做什么</h3><p>{knowledge.recommendedActivities.join(' · ')}</p></section> : null}
    {knowledge?.tips.length ? <section className="journey-place__section"><h3>出发前提醒</h3><ul>{knowledge.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></section> : null}
    {knowledge?.timeSensitive ? <p className="journey-note">路线与停留时长可按当天节奏灵活调整。</p> : null}
  </>
}

export const JourneyPlaceSheet = ({ open, onClose, place, city, journeyId, dayId = 'Day 1' }: { open: boolean; onClose: () => void; place: Place | null; city: string; journeyId: string; dayId?: string }) => {
  const navigate = useNavigate()
  const footprints = useAppStore((state) => state.footprints)
  const addFootprint = useAppStore((state) => state.addFootprint)
  const [marked, setMarked] = useState(false)
  const alreadyVisited = Boolean(place && footprints.some((item) => item.journeyId === journeyId && item.placeId === place.id && item.city === city))

  useEffect(() => {
    setMarked(false)
    if (open && place) track('place_open', { placeType: place.type })
  }, [open, place])

  const markVisited = () => {
    if (!place || alreadyVisited) {
      setMarked(true)
      return
    }
    const now = new Date().toISOString()
    addFootprint({ id: newId('footprint'), userId: 'local-user', journeyId, placeId: place.id, city, country: '中国', visitedAt: now, coordinates: [place.lng, place.lat], source: 'journey', note: place.note, createdAt: now })
    track('footprint_created', { source: 'journey', placeType: place.type })
    setMarked(true)
  }

  return <ZouBottomSheet open={open} onClose={onClose} title={place?.name ?? '地点详情'}>
    {place ? <>
      <div className="journey-place__eyebrow"><MapPin />{city} · {place.type}</div>
      <PlaceKnowledgeContent place={place} city={city} />
      <div className="journey-action-stack">
        <ZouButton onClick={markVisited}><Check />{marked || alreadyVisited ? '已标记去过' : '标记去过'}</ZouButton>
        <ZouButton variant="secondary" onClick={() => navigate(`/journey/expense?place=${encodeURIComponent(place.id)}&day=${encodeURIComponent(dayId)}`)}><CircleDollarSign />记一笔费用</ZouButton>
        <ZouButton variant="secondary" onClick={() => navigate('/journey/packing')}><Backpack />加入出发清单</ZouButton>
        <button className="journey-text-action" onClick={() => navigate(`/journey/place/${encodeURIComponent(place.id)}?city=${encodeURIComponent(city)}&name=${encodeURIComponent(place.name)}&journey=${encodeURIComponent(journeyId)}`)}>查看完整地点资料<ChevronRight /></button>
      </div>
    </> : null}
  </ZouBottomSheet>
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
  const packingItems = useAppStore((state) => state.packingItems)
  const footprints = useAppStore((state) => state.footprints)
  const summary = useMemo(() => summarizeExpenses(expenses, context.journeyId), [context.journeyId, expenses])
  const progress = useMemo(() => packingProgress(packingItems, context.journeyId), [context.journeyId, packingItems])
  const visitedCount = footprints.filter((item) => item.journeyId === context.journeyId).length
  const openPlace = (place: Place) => { track('place_open', { placeType: place.type }); navigate(`/journey/place/${encodeURIComponent(place.id)}?city=${encodeURIComponent(context.city)}&name=${encodeURIComponent(place.name)}&journey=${encodeURIComponent(context.journeyId)}`) }
  return <AppShell showTabBar><ZouNavigationBar title="行程工具" /><main className="journey-tools-page page-content">
    <section className="journey-hero"><img src={context.cover} alt={`${context.city}行程封面`} /><div><span>{context.city} · {context.durationDays}天</span><h1>{context.title}</h1><p>把要花的钱、要带的东西和走过的地方，放在同一个行程里。</p></div></section>
    <section className="journey-tool-grid" aria-label="行程工具">
      <JourneyToolCard icon={WalletCards} title="费用记录" description="按天和类别记下旅途花销" metric={`已记 ¥${summary.total}`} onClick={() => navigate('/journey/expense')} />
      <JourneyToolCard icon={Backpack} title="出发清单" description="按天气和活动准备行李" metric={progress.total ? `${progress.completed}/${progress.total} 已完成` : '还没有清单'} onClick={() => navigate('/journey/packing')} />
      <JourneyToolCard icon={Footprints} title="我的足迹" description="标记去过的城市与地点" metric={`${visitedCount} 个行程地点`} onClick={() => navigate('/journey/footprint')} />
      <JourneyToolCard icon={Share2} title="分享行程" description="生成一张可以带走的路线卡片" metric={`${context.places.length} 个地点`} onClick={() => navigate('/journey/share')} />
    </section>
    <section className="journey-section"><header className="journey-section__header"><div><span>地点资料</span><h2>走之前先知道</h2></div><small>{context.places.length} 个地点</small></header><div className="journey-place-list">{context.places.map((place) => <button key={place.id} onClick={() => openPlace(place)}><span><strong>{place.name}</strong><small>{place.type} · {place.stay} · {place.note}</small></span><ChevronRight /></button>)}</div></section>
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
  const [category, setCategory] = useState<TripExpense['category']>('交通')
  const [dayId, setDayId] = useState(params.get('day') ?? 'Day 1')
  const [placeId, setPlaceId] = useState(params.get('place') ?? '')
  const [note, setNote] = useState('')
  const [occurredAt, setOccurredAt] = useState(dateValue())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const scopedExpenses = useMemo(() => expenses.filter((expense) => expense.journeyId === context.journeyId), [context.journeyId, expenses])
  const summary = useMemo(() => summarizeExpenses(expenses, context.journeyId), [context.journeyId, expenses])

  const resetForm = () => {
    setAmount(''); setCategory('交通'); setDayId(params.get('day') ?? 'Day 1'); setPlaceId(params.get('place') ?? ''); setNote(''); setOccurredAt(dateValue()); setEditingId(null); setError('')
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = Number(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) { setError('请输入大于 0 的金额'); return }
    const payload = { dayId, placeId: placeId || undefined, amount: Math.round(parsed * 100) / 100, currency: 'CNY', category, participantIds: ['local-user'], note: note.trim() || undefined, occurredAt: `${occurredAt}T12:00:00.000Z` }
    if (editingId) updateExpense(editingId, payload)
    else addExpense({ id: newId('expense'), journeyId: context.journeyId, ...payload, createdAt: new Date().toISOString() })
    track('expense_added', { category, editing: Boolean(editingId) })
    setMessage(editingId ? '费用已更新' : '费用已保存')
    resetForm()
  }
  const edit = (expense: TripExpense) => { setEditingId(expense.id); setAmount(String(expense.amount)); setCategory(expense.category); setDayId(expense.dayId ?? 'Day 1'); setPlaceId(expense.placeId ?? ''); setNote(expense.note ?? ''); setOccurredAt(dateValue(new Date(expense.occurredAt))) }

  return <AppShell showTabBar><ZouNavigationBar title="费用记录" right={<button className="text-button" onClick={() => navigate('/journey/tools')}>行程工具</button>} /><main className="journey-form-page page-content">
    <section className="journey-page-intro"><span>{context.city} · {context.title}</span><h1>花销记下来，旅途更轻松</h1><p>费用只保存在当前设备，按行程独立统计。</p></section>
    <section className="journey-summary-card"><span>当前行程总花销</span><strong>¥{summary.total.toFixed(2)}</strong><div>{Object.entries(summary.byCategory).filter(([, value]) => value > 0).map(([key, value]) => <span key={key}>{key} ¥{value.toFixed(2)}</span>)}</div></section>
    <form className="journey-form" onSubmit={submit}><header><div><span>{editingId ? '编辑记录' : '新增记录'}</span><h2>{editingId ? '把这笔费用改准确' : '今天花了什么？'}</h2></div>{editingId ? <button type="button" className="text-button" onClick={resetForm}>取消编辑</button> : null}</header><label>金额（元）<input inputMode="decimal" min="0.01" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></label><div className="journey-form__row"><label>类别<select value={category} onChange={(event) => setCategory(event.target.value as TripExpense['category'])}>{EXPENSE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><label>日期<input type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} /></label></div><div className="journey-form__row"><label>行程日<select value={dayId} onChange={(event) => setDayId(event.target.value)}>{['Day 1', 'Day 2', 'Day 3'].map((item) => <option key={item}>{item}</option>)}</select></label><label>关联地点<select value={placeId} onChange={(event) => setPlaceId(event.target.value)}><option value="">不关联地点</option>{context.places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label></div><label>备注（可选）<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：两个人的咖啡" maxLength={80} /></label>{error ? <p className="journey-form__error" role="alert">{error}</p> : null}<ZouButton type="submit"><Plus />{editingId ? '保存修改' : '记下这笔'}</ZouButton></form>
    <section className="journey-section"><header className="journey-section__header"><div><span>记录明细</span><h2>{scopedExpenses.length ? '这趟旅程的每一笔' : '还没有费用记录'}</h2></div><small>{scopedExpenses.length} 笔</small></header>{scopedExpenses.length ? <div className="journey-record-list">{scopedExpenses.map((expense) => <article className="journey-record" key={expense.id}><div><strong>¥{expense.amount.toFixed(2)}</strong><span>{expense.category} · {expense.dayId ?? '未分日'}{expense.placeId ? ` · ${context.places.find((place) => place.id === expense.placeId)?.name ?? '地点'}` : ''}</span><small>{formatDate(expense.occurredAt)}{expense.note ? ` · ${expense.note}` : ''}</small></div><div><button type="button" aria-label="编辑费用" onClick={() => edit(expense)}>编辑</button><button type="button" aria-label="删除费用" onClick={() => deleteExpense(expense.id)}><Trash2 /></button></div></article>)}</div> : <p className="journey-empty-copy">从一杯咖啡开始，回来时就能看到这趟路真正花了多少。</p>}</section>{message ? <ZouToast message={message} onClose={() => setMessage('')} /> : null}
  </main></AppShell>
}

export const PackingPage = () => {
  const navigate = useNavigate()
  const context = useJourneyContext()
  const packingItems = useAppStore((state) => state.packingItems)
  const seedPackingItems = useAppStore((state) => state.seedPackingItems)
  const addPackingItem = useAppStore((state) => state.addPackingItem)
  const togglePackingItem = useAppStore((state) => state.togglePackingItem)
  const deletePackingItem = useAppStore((state) => state.deletePackingItem)
  const seededJourneys = useRef(new Set<string>())
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<PackingItem['category']>('个人')
  const [message, setMessage] = useState('')
  const scopedItems = useMemo(() => packingItems.filter((item) => item.journeyId === context.journeyId), [context.journeyId, packingItems])
  const progress = useMemo(() => packingProgress(packingItems, context.journeyId), [context.journeyId, packingItems])
  useEffect(() => {
    if (!scopedItems.length && !seededJourneys.current.has(context.journeyId)) {
      seedPackingItems(context.journeyId, createPackingSeed({ journeyId: context.journeyId, city: context.city, days: context.durationDays, weather: context.city === '三亚' ? '高温晴朗' : '晴朗', activities: context.title }))
    }
    seededJourneys.current.add(context.journeyId)
  }, [context, scopedItems.length, seedPackingItems])
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!label.trim()) return; addPackingItem({ id: newId('packing'), journeyId: context.journeyId, label: label.trim(), category, checked: false, recommended: false, createdAt: new Date().toISOString() }); setLabel(''); setMessage('已加入出发清单') }
  const toggleItem = (item: PackingItem) => { togglePackingItem(item.id); track('packing_checked', { checked: !item.checked }); setMessage(item.checked ? '已取消勾选' : '已勾选') }
  return <AppShell showTabBar><ZouNavigationBar title="出发清单" right={<button className="text-button" onClick={() => navigate('/journey/tools')}>行程工具</button>} /><main className="journey-form-page page-content">
    <section className="journey-page-intro"><span>{context.city} · 出发前</span><h1>少带一点焦虑，多带一点准备</h1><p>清单会按照当前行程保存在本地，勾选进度不会丢。</p></section>
    <section className="journey-summary-card journey-summary-card--progress"><div><span>准备进度</span><strong>{progress.completed} / {progress.total}</strong></div><div className="journey-progress" aria-label={`已完成 ${progress.completed} 项，共 ${progress.total} 项`}><span style={{ width: `${progress.total ? progress.completed / progress.total * 100 : 0}%` }} /></div><small>{progress.state === 'completed' ? '可以出发了' : '先处理最容易忘的那几样'}</small></section>
    <form className="journey-inline-form" onSubmit={submit}><label className="sr-only" htmlFor="packing-label">新增物品</label><input id="packing-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="添加一件要带的东西" maxLength={40} /><select aria-label="物品分类" value={category} onChange={(event) => setCategory(event.target.value as PackingItem['category'])}>{PACKING_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select><button type="submit" aria-label="添加物品"><Plus /></button></form>
    <section className="journey-section"><div className="journey-packing-list">{PACKING_CATEGORIES.map((group) => { const items = scopedItems.filter((item) => item.category === group); return items.length ? <section key={group}><header><h2>{group}</h2><small>{items.filter((item) => item.checked).length}/{items.length}</small></header>{items.map((item) => <div className={`packing-row ${item.checked ? 'is-checked' : ''}`} key={item.id}><button className="packing-row__toggle" aria-pressed={item.checked} onClick={() => toggleItem(item)}><span>{item.checked ? <Check /> : null}</span><strong>{item.label}</strong></button>{item.recommended ? <em>推荐</em> : null}<button className="icon-button" aria-label={`删除${item.label}`} onClick={() => deletePackingItem(item.id)}><Trash2 /></button></div>)}</section> : null })}</div></section>{message ? <ZouToast message={message} onClose={() => setMessage('')} /> : null}
  </main></AppShell>
}

export const FootprintPage = () => {
  const navigate = useNavigate()
  const context = useJourneyContext()
  const footprints = useAppStore((state) => state.footprints)
  const addFootprint = useAppStore((state) => state.addFootprint)
  const updateFootprint = useAppStore((state) => state.updateFootprint)
  const deleteFootprint = useAppStore((state) => state.deleteFootprint)
  const [city, setCity] = useState(context.city)
  const [place, setPlace] = useState('')
  const [visitedAt, setVisitedAt] = useState(dateValue())
  const [note, setNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const cities = useMemo(() => [...new Set(footprints.map((item) => item.city).filter(Boolean))], [footprints])
  const cityCounts = useMemo(() => footprints.reduce<Record<string, number>>((counts, item) => { counts[item.city] = (counts[item.city] ?? 0) + 1; return counts }, {}), [footprints])
  const footprintPlaces = useMemo(() => Object.entries(cityCounts).flatMap(([name]) => {
    const footprint = footprints.find((item) => item.city === name)
    const coordinates = footprint?.coordinates ?? cityProfiles[name]?.mapCenter
    if (!coordinates) return []
    const [lng, lat] = coordinates
    return [{ id: `footprint-city-${name}`, time: '', name, type: '城市足迹', stay: '', budget: 0, transport: '', note: '已记录足迹', x: 0, z: 0, lng, lat, coordinateSource: '已保存城市坐标', verified: true } satisfies Place]
  }), [cityCounts, footprints])
  const reset = () => { setCity(context.city); setPlace(''); setVisitedAt(dateValue()); setNote(''); setEditingId(null) }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!city.trim()) return
    const payload = { city: city.trim(), country: '中国', placeId: place.trim() || undefined, visitedAt: `${visitedAt}T12:00:00.000Z`, note: note.trim() || undefined }
    if (editingId) updateFootprint(editingId, payload)
    else { addFootprint({ id: newId('footprint'), userId: 'local-user', source: 'manual', createdAt: new Date().toISOString(), ...payload }); track('footprint_created', { source: 'manual' }) }
    setMessage(editingId ? '足迹已更新' : '足迹已保存')
    reset()
  }
  const edit = (item: Footprint) => { setEditingId(item.id); setCity(item.city); setPlace(item.placeId ?? ''); setVisitedAt(dateValue(new Date(item.visitedAt))); setNote(item.note ?? '') }
  return <AppShell showTabBar><ZouNavigationBar title="我的足迹" right={<button className="text-button" onClick={() => navigate('/journey/tools')}>行程工具</button>} /><main className="journey-form-page page-content">
    <section className="journey-page-intro"><span>我的地图 · {footprints.length} 个记录</span><h1>走过的地方，都会留下来</h1><p>从进行中的行程标记地点，也可以手动补一座已经去过的城市。</p></section>
    <section className="footprint-map" aria-label="我的足迹城市概览"><RealRouteMap places={footprintPlaces} center={[104.1954, 35.8617]} overview compact onNodeSelect={(index) => setCity(footprintPlaces[index]?.name ?? context.city)} /></section>
    <section className="journey-summary-card journey-summary-card--metrics"><span>足迹统计</span><div><strong>{new Set(footprints.map((item) => item.city)).size}<small>座城市</small></strong><strong>{footprints.length}<small>个地点</small></strong><strong>{new Set(footprints.map((item) => item.journeyId).filter(Boolean)).size}<small>次行程</small></strong></div></section>
    <form className="journey-form" onSubmit={submit}><header><div><span>{editingId ? '编辑足迹' : '手动添加'}</span><h2>{editingId ? '把这段记忆补完整' : '还记得哪座城市？'}</h2></div>{editingId ? <button type="button" className="text-button" onClick={reset}>取消编辑</button> : null}</header><label>城市<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="例如：苏州" required /></label><div className="journey-form__row"><label>地点（可选）<input value={place} onChange={(event) => setPlace(event.target.value)} placeholder="例如：平江路" /></label><label>去过的日期<input type="date" value={visitedAt} onChange={(event) => setVisitedAt(event.target.value)} /></label></div><label>一句话记录（可选）<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="那天的风很舒服" maxLength={80} /></label><ZouButton type="submit"><Plus />{editingId ? '保存足迹' : '留下足迹'}</ZouButton></form>
    <section className="journey-section"><header className="journey-section__header"><div><span>最近记录</span><h2>{footprints.length ? '你走过的路' : '还没有足迹'}</h2></div><small>{cities.length} 座城市</small></header>{footprints.length ? <div className="journey-record-list">{footprints.map((item) => <article className="journey-record footprint-record" key={item.id}><div><strong>{item.city}{item.placeId ? ` · ${context.places.find((place) => place.id === item.placeId)?.name ?? item.placeId}` : ''}</strong><span>{item.source === 'journey' ? '来自行程' : '手动添加'} · {formatDate(item.visitedAt)}</span>{item.note ? <small>{item.note}</small> : null}</div><div><button type="button" aria-label="编辑足迹" onClick={() => edit(item)}>编辑</button><button type="button" aria-label="删除足迹" onClick={() => deleteFootprint(item.id)}><Trash2 /></button></div></article>)}</div> : <p className="journey-empty-copy">下一次在行程里点一下“标记去过”，这里就会出现第一枚足迹。</p>}</section>{message ? <ZouToast message={message} onClose={() => setMessage('')} /> : null}
  </main></AppShell>
}

export const PlaceKnowledgePage = () => {
  const navigate = useNavigate()
  const context = useJourneyContext()
  const { placeId } = useParams()
  const [params] = useSearchParams()
  const footprints = useAppStore((state) => state.footprints)
  const addFootprint = useAppStore((state) => state.addFootprint)
  const place = context.places.find((item) => item.id === decodeURIComponent(placeId ?? '')) ?? context.places.find((item) => item.name === params.get('name')) ?? context.places[0]
  const visited = Boolean(place && footprints.some((item) => item.journeyId === context.journeyId && item.placeId === place.id && item.city === context.city))
  useEffect(() => { if (place) track('place_open', { placeType: place.type }) }, [place])
  const markVisited = () => {
    if (!place || visited) return
    const now = new Date().toISOString()
    addFootprint({ id: newId('footprint'), userId: 'local-user', journeyId: context.journeyId, placeId: place.id, city: context.city, country: '中国', visitedAt: now, coordinates: [place.lng, place.lat], source: 'journey', note: place.note, createdAt: now })
    track('footprint_created', { source: 'journey', placeType: place.type })
  }
  if (!place) return <AppShell><ZouNavigationBar title="地点资料" /><main className="journey-empty-page"><p>暂时没有找到这个地点。</p><ZouButton onClick={() => navigate('/journey/tools')}>回到行程工具</ZouButton></main></AppShell>
  return <AppShell showTabBar><ZouNavigationBar title="地点资料" right={<button className="text-button" onClick={() => navigate('/journey/share')}>分享</button>} /><main className="place-knowledge-page page-content"><header className="place-knowledge-hero"><span>{context.city} · {place.type}</span><h1>{place.name}</h1><p>{place.transport}</p></header><section className="journey-place-card"><PlaceKnowledgeContent place={place} city={context.city} /></section><div className="journey-form__row"><ZouButton onClick={markVisited}><Check />{visited ? '已标记去过' : '标记去过'}</ZouButton><ZouButton variant="secondary" onClick={() => navigate(`/journey/expense?place=${encodeURIComponent(place.id)}`)}><CircleDollarSign />记一笔</ZouButton></div><button className="journey-back-link" onClick={() => navigate('/journey/tools')}>回到行程工具<ChevronRight /></button></main></AppShell>
}

export const JourneySharePage = () => {
  const navigate = useNavigate()
  const context = useJourneyContext()
  const [message, setMessage] = useState('')
  const shareText = `我在走走安排了「${context.title}」：${context.city}，${context.places.length} 个地点。`
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: context.title, text: shareText, url: window.location.href }); track('journey_shared', { method: 'system' }) }
      else if (navigator.clipboard) { await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`); setMessage('分享内容已复制'); track('journey_shared', { method: 'copy' }) }
      else setMessage(shareText)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setMessage('分享没有完成，可以再试一次')
    }
  }
  return <AppShell showTabBar><ZouNavigationBar title="分享行程" /><main className="journey-share-page page-content"><section className="share-card"><img src={context.cover} alt={`${context.city}行程封面`} /><div className="share-card__body"><span>走走 · {context.city}</span><h1>{context.title}</h1><p>{context.durationDays}天 · {context.places.length} 个地点 · 按自己的节奏走</p><div className="share-card__route">{context.places.slice(0, 4).map((place, index) => <span key={place.id}><b>{index + 1}</b>{place.name}</span>)}</div></div></section><section className="journey-share-copy"><span>一张卡片，带走这趟路</span><h2>分享给一起出发的人</h2><p>{shareText}</p><ZouButton onClick={share}><Share2 />系统分享 / 复制内容</ZouButton><button className="journey-text-action" onClick={() => navigate('/journey/tools')}>继续整理行程<ChevronRight /></button></section>{message ? <ZouToast message={message} onClose={() => setMessage('')} /> : null}</main></AppShell>
}
