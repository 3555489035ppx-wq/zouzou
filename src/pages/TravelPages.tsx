import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Building2, Copy, ImagePlus, Link2, Lock, Plus, Share2, X } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { RealRouteMap } from '../components/RealRouteMap'
import {
  Check, DestinationPicker, FriendStatus, ZouAvatar, ZouAvatarStack, ZouBottomSheet, ZouButton, ZouDaySelector,
  ZouMotionBot, ZouNavigationBar, ZouPlaceCard, ZouPlanCard, ZouSegmentedControl, ZouToast,
} from '../components/ui'
import { aiService, type AIStage } from '../services/ai'
import { friends, plans as fallbackPlans } from '../demo-data/trips'
import { cityNames, getCityProfile } from '../demo-data/cities'
import { emptyDietaryProfile, foodCompatibilityIssues } from '../services/trip/dietary'
import { isConcreteKnowledgeItem } from '../services/trip/cityKnowledge'
import {
  DEFAULT_SHANGHAI_PROMPT,
  TRIP_INPUT_STORAGE,
  TRIP_MEDIA_STORAGE,
  TRIP_PLANS_STORAGE,
  TRIP_UNDERSTANDING_STORAGE,
  getDefaultGeneratedPlans,
  getHotelRecommendationsForPlan,
  getReplacementCandidates,
  isHotelStop,
  paceLabel,
  readSavedPlans,
  readStoredPlans,
  writeSavedPlan,
  updateGeneratedPlan,
  writeStoredPlans,
  type GeneratedPlan,
  type PlannedStop,
  type TripMedia,
  type TripUnderstanding,
} from '../services/trip/planner'
import { readVersioned, removeStored, writeVersioned } from '../services/storage'
import { parseTripMediaList } from '../services/trip/schemas'
import { track } from '../services/analytics'
import { useAppStore } from '../stores/appStore'

const defaultPrompt = DEFAULT_SHANGHAI_PROMPT

function readTripMedia(): TripMedia[] {
  return parseTripMediaList(readVersioned<unknown>(TRIP_MEDIA_STORAGE, 'session'))
}

export const TravelNewPage = () => {
  const navigate = useNavigate()
  const advanceTripFlow = useAppStore((state) => state.transitionTripFlow)
  const [input, setInput] = useState(defaultPrompt)
  const [isExample, setIsExample] = useState(true)
  const [destination, setDestination] = useState('上海')
  const [days, setDays] = useState('3')
  const [budget, setBudget] = useState('4000')
  const [goal, setGoal] = useState('城市漫步、看展和本地美食')
  const [screenshots, setScreenshots] = useState<TripMedia[]>([])
  const [uploadError, setUploadError] = useState('')
  const [dragging,setDragging]=useState<number|null>(null)
  const reorder=(from:number,to:number)=>{if(from===to)return;setScreenshots(items=>{const next=[...items],item=next.splice(from,1)[0];next.splice(to,0,item);return next})}
  const updateStructured = (setter: (value: string) => void, value: string) => {
    setter(value)
    if (isExample) {
      setInput('')
      setIsExample(false)
    }
  }
  const submit = () => {
    const structuredPrompt = `${days}天去${destination}，预算${budget || '待定'}元，想做${goal || '城市漫步和本地美食'}。`
    const prompt = isExample ? input : `${structuredPrompt}${input.trim()}`
    writeVersioned(TRIP_INPUT_STORAGE, prompt, 'session')
    writeVersioned(TRIP_MEDIA_STORAGE, screenshots, 'session')
    removeStored(TRIP_PLANS_STORAGE, 'session')
    track('journey_create_start', { days: Number(days) || 0, hasMedia: screenshots.length > 0 })
    advanceTripFlow('START_DRAFT')
    advanceTripFlow('SUBMIT_DRAFT')
    navigate('/travel/understanding')
  }
  return <AppShell><ZouNavigationBar title="创建旅行" /><div className="page-content travel-new"><header><h1>想去哪走走？</h1><p>先告诉我城市、预算、天数和想做什么，我会把景点、吃住和移动排成完整攻略。</p></header><section className="trip-constraints" aria-label="旅行条件"><label><span>目的地</span><DestinationPicker value={destination} onChange={(value) => updateStructured(setDestination, value)} ariaLabel="目的地" /></label><label><span>天数</span><input aria-label="旅行天数" type="number" min="1" max="14" value={days} onChange={(event) => updateStructured(setDays, event.target.value)} /></label><label><span>预算（元）</span><input aria-label="旅行预算" type="number" min="0" step="100" value={budget} onChange={(event) => updateStructured(setBudget, event.target.value)} /></label><label className="trip-constraints__wide"><span>想做什么</span><input aria-label="旅行目的" value={goal} placeholder="本地美食、城市漫步、看展、夜景" onChange={(event) => updateStructured(setGoal, event.target.value)} /></label></section><label className="trip-prompt"><span>补充想法（可选）</span><textarea aria-label="旅行想法" value={input} onChange={(event) => { setInput(event.target.value); setIsExample(false) }} placeholder="例如：9月18日 10:30 到长沙南站，住五一广场附近，想吃臭豆腐和湘菜。" /><small aria-live="polite">{input.length}/500{isExample ? ' · 示例' : ''}</small>{isExample ? <button type="button" className="trip-prompt__clear" onClick={() => { setInput(''); setIsExample(false) }}>清空示例</button> : null}</label><section className="upload-section"><div className="section-title"><h2>旅行截图</h2><span>{screenshots.length} 张 · 长按排序</span></div><div className="screenshot-row">{screenshots.map((shot,index)=><article key={shot.id} draggable onDragStart={()=>setDragging(index)} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(dragging!==null)reorder(dragging,index);setDragging(null)}}><img src={shot.src} alt={`${shot.name}截图`} width={120} height={160} /><span>{shot.name}</span><button aria-label={`删除${shot.name}`} onClick={() => setScreenshots((items) => items.filter((item) => item.id !== shot.id))}><X /></button></article>)}<label className="add-screenshot"><ImagePlus /><span>添加</span><input type="file" multiple accept="image/*" onChange={(event) => { const selected = Array.from(event.target.files ?? []); const files = selected.filter((file) => file.type.startsWith('image/') && file.size <= 8 * 1024 * 1024); setUploadError(files.length < selected.length ? '仅支持 8MB 以内的图片截图。' : ''); setScreenshots((items) => [...items, ...files.map((file) => ({ id: `${file.name}-${file.lastModified}`, src: URL.createObjectURL(file), name: file.name, category: '上传截图' }))]) }} /></label></div>{uploadError ? <p className="upload-error" role="alert">{uploadError}</p> : null}</section><ZouButton aria-label="帮我看看" onClick={submit}>生成完整攻略</ZouButton></div></AppShell>
}

const understandingSteps: Record<AIStage, string> = {
  listening: '正在理解你的旅行', reading: '正在读取截图', thinking: '整理地点', planning: '检查路线与天气', done: '正在生成方案', updating: '正在局部更新', success: '理解完成', error: '理解没有完成',
}
const understandingStepOrder: AIStage[] = ['listening', 'reading', 'thinking', 'planning', 'done']

export const UnderstandingPage = () => {
  const navigate = useNavigate()
  const advanceTripFlow = useAppStore((state) => state.transitionTripFlow)
  const [searchParams] = useSearchParams()
  const errorParam = searchParams.get('error')
  const [stage, setStage] = useState<AIStage>('listening')
  const [label, setLabel] = useState('准备理解你的旅行')
  const [understanding, setUnderstanding] = useState<TripUnderstanding | null>(null)
  const [ready, setReady] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [editorOpen, setEditorOpen] = useState(false)
  const [draftDestination, setDraftDestination] = useState('上海')
  const [draftPartySize, setDraftPartySize] = useState('2')
  const [draftBudget, setDraftBudget] = useState('')
  useEffect(() => {
    if (errorParam === '1') {
      advanceTripFlow('ERROR')
      setStage('error')
      setError('无法读取当前输入，请返回检查后重试。')
      return
    }
    let active = true
    setReady(false)
    setError('')
    setStage('listening')
    const request = { text: readVersioned<string>(TRIP_INPUT_STORAGE, 'session', true) ?? defaultPrompt, media: readTripMedia() }
    aiService.understandTrip(request, (next, text) => { if (active) { setStage(next); setLabel(text) } })
      .then((result) => { if (active) { advanceTripFlow('UNDERSTANDING_READY'); setUnderstanding(result); setReady(true); setDraftDestination(result.intent.destination); setDraftPartySize(String(result.intent.partySize)); setDraftBudget(result.intent.budget === null ? '' : String(result.intent.budget)); writeVersioned(TRIP_UNDERSTANDING_STORAGE, result, 'session'); track('journey_generated', { hasMedia: request.media.length > 0 }) } })
      .catch((reason: Error) => { if (active) { advanceTripFlow('ERROR'); setStage('error'); setError(reason.message) } })
    return () => { active = false }
  }, [attempt, errorParam])
  const retryUnderstanding = () => {
    if (errorParam) {
      navigate('/travel/understanding', { replace: true })
      return
    }
    track('trip_understanding_retried')
    advanceTripFlow('RETRY')
    setAttempt((value) => value + 1)
  }
  const saveIntentCorrections = () => {
    if (!understanding) return
    const partySize = Math.max(1, Math.min(20, Number.parseInt(draftPartySize, 10) || understanding.intent.partySize))
    const parsedBudget = draftBudget.trim() === '' ? null : Number(draftBudget)
    const budget = parsedBudget !== null && Number.isFinite(parsedBudget) && parsedBudget >= 0 ? Math.round(parsedBudget) : understanding.intent.budget
    const destination = cityNames.includes(draftDestination) ? draftDestination : understanding.intent.destination
    const missing = understanding.intent.missing.filter((item) => item !== '总预算')
    if (budget === null && !missing.includes('总预算')) missing.push('总预算')
    const next: TripUnderstanding = { ...understanding, intent: { ...understanding.intent, destination, partySize, budget, missing } }
    setUnderstanding(next)
    writeVersioned(TRIP_UNDERSTANDING_STORAGE, next, 'session')
    setEditorOpen(false)
  }
  const startPlanning = async () => {
    if (!understanding) return
    advanceTripFlow('START_PLANNING')
    setPlanning(true)
    try {
      const generatedPlans = await aiService.generatePlans(understanding, (next, text) => { setStage(next); setLabel(text) })
      writeStoredPlans(generatedPlans)
      if (generatedPlans[0]) writeSavedPlan(generatedPlans[0])
      track('journey_generated', { planCount: generatedPlans.length })
      advanceTripFlow('PLANS_READY')
      navigate('/travel/plans')
    } catch (reason) {
      advanceTripFlow('ERROR')
      setPlanning(false)
      setStage('error')
      setError(reason instanceof Error ? reason.message : '方案生成失败，请稍后重试。')
    }
  }
  const mediaCount = readTripMedia().length
  const intent = understanding?.intent
  const mediaFacts = understanding?.mediaFacts ?? []
  const uncertainMediaCount = mediaFacts.filter((fact) => fact.needsConfirmation).length
  const knowledge = understanding?.knowledge
  return <AppShell><ZouNavigationBar title="理解旅行" /><div className="page-content understanding-page"><div className="bot-stage"><ZouMotionBot state={stage === 'error' ? 'error' : stage} label="Bloub / Grok Bot" /><h1>{planning ? '正在生成 3 套方案' : ready ? '这是我理解的旅行' : error ? '这次没有理解完成' : '正在理解你的旅行'}</h1><p aria-live="polite">{error || label}</p><div className="progress-steps">{['读取你的描述', `识别 ${mediaCount} 张截图`, '整理地点与偏好', '检查路线与天气', '生成可行方案'].map((item, index) => { const stageIndex = understandingStepOrder.indexOf(stage); const done = ready ? index < 4 : stageIndex >= 0 && index < stageIndex; return <span key={item} className={done ? 'is-done' : ''}>{done ? <Check /> : <i />}{item}</span> })}</div></div>{ready && !planning && intent ? <><section className="understanding-card"><div className="understanding-card__top"><div><span>目的地</span><strong>{intent.destination}</strong></div><div><span>行程</span><strong>{intent.durationDays} 天 {intent.nights} 晚</strong></div><div><span>朋友</span><strong>{intent.partySize} 人</strong></div><div><span>预算</span><strong>{intent.budget ? `¥${intent.budget}` : '待确认'}</strong></div></div><p className="understanding-card__summary">我理解的是一趟{paceLabel(intent.pace)}的 {intent.destination} 行程{intent.mustVisit.length > 0 ? `，重点包括 ${intent.mustVisit.join('、')}` : ''}{intent.preferences.length > 0 ? `，同时照顾${intent.preferences.join('、')}偏好` : ''}。</p><dl><div><dt>节奏</dt><dd>{paceLabel(intent.pace)}</dd></div><div><dt>必去</dt><dd>{intent.mustVisit.length > 0 ? intent.mustVisit.join(' · ') : '暂未识别'}</dd></div><div><dt>偏好</dt><dd>{intent.preferences.length > 0 ? intent.preferences.join(' · ') : '暂未识别'}</dd></div></dl><button className="text-button intent-edit-button" type="button" onClick={() => setEditorOpen(true)}>调整行程条件</button></section><section className="missing-card"><h2>{intent.missing.length > 0 ? `还有 ${intent.missing.length} 项需要确认` : '关键条件已确认'}</h2>{intent.missing.length > 0 ? <ul>{intent.missing.map((item) => <li key={item}>{item}</li>)}</ul> : <p>日期、到达、返程、住宿和预算已经作为排程约束。</p>}{mediaFacts.length > 0 ? <p>已读取 {mediaFacts.length} 张旅行截图{uncertainMediaCount > 0 ? `，有 ${uncertainMediaCount} 张信息需要你确认。` : ''}</p> : null}{knowledge ? <p>已为你整理{knowledge.city}的重点地点、吃饭和住宿，路线按片区连续安排。</p> : null}</section><ZouButton onClick={startPlanning}>开始规划</ZouButton></> : null}{error ? <><ZouButton variant="secondary" onClick={retryUnderstanding}>重试理解</ZouButton><ZouButton onClick={() => navigate('/travel/new')}>返回修改输入</ZouButton></> : null}<ZouBottomSheet open={editorOpen} onClose={() => setEditorOpen(false)} title="调整行程条件"><div className="intent-editor"><label>目的地<DestinationPicker value={draftDestination} onChange={setDraftDestination} name="trip-destination" ariaLabel="目的地" /></label><label>同行人数<input name="trip-party-size" type="number" min="1" max="20" inputMode="numeric" value={draftPartySize} onChange={(event) => setDraftPartySize(event.target.value)} /></label><label>总预算（元）<input name="trip-budget" type="number" min="0" inputMode="decimal" value={draftBudget} onChange={(event) => setDraftBudget(event.target.value)} placeholder="暂不填写" /></label><p>可以调整人数和预算，地点与时间会按新的条件重新安排。</p><ZouButton onClick={saveIntentCorrections}>保存修改</ZouButton></div></ZouBottomSheet></div></AppShell>
}

export const PlansPage = () => {
  const navigate = useNavigate()
  const advanceTripFlow = useAppStore((state) => state.transitionTripFlow)
  const carouselRef = useRef<HTMLDivElement>(null)
  const programmaticSelection = useRef<string | null>(null)
  const selectionTimer = useRef<number | null>(null)
  const [selected, setSelected] = useState('match')
  const generatedPlans = useMemo(() => readStoredPlans() ?? getDefaultGeneratedPlans(), [])
  const intent = generatedPlans[0]?.intent
  useEffect(() => { advanceTripFlow('PLANS_READY') }, [advanceTripFlow])
  useEffect(() => () => { if (selectionTimer.current !== null) window.clearTimeout(selectionTimer.current) }, [])
  const selectPlan = (planId: string) => {
    setSelected(planId)
    track('plan_selected', { planId })
    const carousel = carouselRef.current
    const item = carousel?.querySelector<HTMLElement>(`[data-plan-id="${planId}"]`)
    if (!carousel || !item) return
    programmaticSelection.current = planId
    const left = Math.max(0, item.offsetLeft - (carousel.clientWidth - item.offsetWidth) / 2)
    carousel.scrollTo({ left, behavior: 'smooth' })
    if (selectionTimer.current !== null) window.clearTimeout(selectionTimer.current)
    selectionTimer.current = window.setTimeout(() => {
      programmaticSelection.current = null
      setSelected(planId)
    }, 500)
  }
  const syncSelectedPlan = () => {
    const carousel = carouselRef.current
    if (!carousel || programmaticSelection.current) return
    const center = carousel.scrollLeft + carousel.clientWidth / 2
    const nearest = Array.from(carousel.querySelectorAll<HTMLElement>('[data-plan-id]')).reduce<HTMLElement | null>((closest, item) => {
      if (!closest) return item
      const itemDistance = Math.abs(item.offsetLeft + item.offsetWidth / 2 - center)
      const closestDistance = Math.abs(closest.offsetLeft + closest.offsetWidth / 2 - center)
      return itemDistance < closestDistance ? item : closest
    }, null)
    const planId = nearest?.dataset.planId
    if (planId) setSelected(planId)
  }
  return <AppShell><ZouNavigationBar title="选择方案" /><div className="plans-page"><header className="page-header"><h1>选择一种走法</h1><p>{intent ? `${intent.destination} · ${intent.durationDays} 天 · 同一批真实需求，只调整节奏、移动与体验密度。` : '三套方案使用同一批真实需求，只调整节奏、移动与体验密度。'}</p></header><div className="plans-carousel" id="plans-carousel" ref={carouselRef} onScroll={syncSelectedPlan}>{generatedPlans.map((plan) => <div key={plan.id} className="plans-carousel__item" data-plan-id={plan.id}><ZouPlanCard plan={plan} selected={selected === plan.id} onSelect={() => selectPlan(plan.id)} onOpen={() => navigate(`/travel/plan/${plan.id}`)} /></div>)}</div><div className="plans-dots" aria-label="方案页码">{generatedPlans.map((plan) => <button key={plan.id} aria-label={plan.label} aria-controls="plans-carousel" aria-current={selected === plan.id ? 'true' : undefined} onClick={() => selectPlan(plan.id)} />)}</div></div></AppShell>
}

export const PlanDetailPage = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [day, setDay] = useState('Day 1')
  const [view, setView] = useState('时间轴')
  const [activePlan, setActivePlan] = useState<GeneratedPlan>(() => {
    const available = readStoredPlans() ?? readSavedPlans() ?? getDefaultGeneratedPlans()
    return available.find((item) => item.id === id) ?? available[0]
  })
  const [locked, setLocked] = useState<string[]>(() => {
    const museum = Object.values(activePlan.days).flat().find((place) => place.type.includes('展'))
    return museum ? [museum.id] : []
  })
  const [replaceId, setReplaceId] = useState<string | null>(null)
  const [editPlaceId, setEditPlaceId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [draftTime, setDraftTime] = useState('09:30')
  const [draftDay, setDraftDay] = useState('Day 1')
  const [draftNote, setDraftNote] = useState('')
  const [newPlaceName, setNewPlaceName] = useState('')
  const [newPlaceDay, setNewPlaceDay] = useState('Day 1')
  const [updating, setUpdating] = useState(false)
  const [toast, setToast] = useState('')
  const currentPlaces = activePlan.days[day] ?? []
  const dayOptions = Object.keys(activePlan.days)
  const editingPlace = editPlaceId ? Object.values(activePlan.days).flat().find((place) => place.id === editPlaceId) : undefined
  const cityProfile = getCityProfile(activePlan.city)
  const knowledge = activePlan.knowledge
  const selectedHotel = Object.values(activePlan.days).flat().find((place) => place.type === '住宿')
  const hotelOptions = useMemo(() => getHotelRecommendationsForPlan(activePlan), [activePlan])
  const selectedHotelOption = hotelOptions.find((option) => option.id === activePlan.selectedHotelId || option.name === selectedHotel?.name) ?? hotelOptions[0]
  const foodRecommendations = useMemo(() => {
    const dietary = activePlan.intent.dietary ?? emptyDietaryProfile()
    return (knowledge?.items ?? [])
      .filter((item) => (item.category === 'food' || item.category === 'restaurant') && isConcreteKnowledgeItem(item))
      .filter((item) => foodCompatibilityIssues(`${item.name} ${(item.menuHighlights ?? []).join(' ')}`, dietary, item.dietaryTags).length === 0)
      .slice(0, 4)
  }, [activePlan.intent.dietary, knowledge])
  const replacements = replaceId ? getReplacementCandidates(activePlan, replaceId) : []
  const replacePlace = replaceId ? Object.values(activePlan.days).flat().find((place) => place.id === replaceId) : undefined
  const replacingHotel = Boolean(replacePlace && isHotelStop(replacePlace))
  const selectedHotelTier = selectedHotelOption?.tier === 'budget' ? '经济' : selectedHotelOption?.tier === 'comfort' ? '舒适' : selectedHotelOption ? '高星' : ''
  const persistPlan = (nextPlan: GeneratedPlan, message = '行程已保存') => {
    setActivePlan(nextPlan)
    const stored = readStoredPlans() ?? []
    writeStoredPlans(stored.length > 0 ? stored.map((item) => item.id === nextPlan.id ? nextPlan : item) : [nextPlan])
    writeSavedPlan(nextPlan)
    track('journey_saved', { planId: nextPlan.id, places: nextPlan.places })
    setToast(message)
  }
  const persistResolvedPlaces = (resolvedPlaces: PlannedStop[]) => {
    const previousPlaces = activePlan.days[day] ?? []
    const changed = previousPlaces.length !== resolvedPlaces.length || resolvedPlaces.some((place, index) => {
      const previous = previousPlaces[index]
      return !previous
        || previous.name !== place.name
        || previous.lng !== place.lng
        || previous.lat !== place.lat
        || previous.poiId !== place.poiId
        || previous.amapPoiId !== place.amapPoiId
        || previous.mapStatus !== place.mapStatus
        || previous.address !== place.address
        || previous.coordinateSource !== place.coordinateSource
    })
    if (!changed) return
    const nextPlan = updateGeneratedPlan(activePlan, { ...activePlan.days, [day]: resolvedPlaces })
    setActivePlan(nextPlan)
    const stored = readStoredPlans() ?? []
    writeStoredPlans(stored.length > 0 ? stored.map((item) => item.id === nextPlan.id ? nextPlan : item) : [nextPlan])
    writeSavedPlan(nextPlan)
  }
  const openEditor = (place: PlannedStop) => {
    const owningDay = dayOptions.find((key) => activePlan.days[key]?.some((item) => item.id === place.id)) ?? day
    setEditPlaceId(place.id)
    setDraftTime(place.time)
    setDraftDay(owningDay)
    setDraftNote(place.note)
  }
  const replace = async (name: string) => {
    if (!replaceId) return
    setUpdating(true)
    try {
      const nextPlan = await aiService.replacePlace(activePlan, replaceId, name, () => undefined)
      persistPlan(nextPlan, nextPlan.validation.passed ? '已局部更新，其他地点没有改变' : '已局部更新，但有条件需要重新确认')
      setReplaceId(null)
    } finally {
      setUpdating(false)
    }
  }
  const removePlace = (placeId: string) => {
    const nextDays = Object.fromEntries(Object.entries(activePlan.days).map(([key, places]) => [key, places.filter((place) => place.id !== placeId)])) as Record<string, GeneratedPlan['days'][string]>
    const nextPlan = updateGeneratedPlan(activePlan, nextDays)
    persistPlan(nextPlan, '地点已删除，行程已保存')
    setConfirmDeleteId(null)
  }
  const savePlace = () => {
    if (!editingPlace || !draftTime) return
    const nextDays = Object.fromEntries(Object.entries(activePlan.days).map(([key, places]) => [key, [...places]])) as Record<string, PlannedStop[]>
    const updated = { ...editingPlace, time: draftTime, note: draftNote.trim() || editingPlace.note }
    for (const [key, places] of Object.entries(nextDays)) nextDays[key] = places.filter((place) => place.id !== editingPlace.id)
    nextDays[draftDay] = [...(nextDays[draftDay] ?? []), updated]
    const nextPlan = updateGeneratedPlan(activePlan, nextDays)
    persistPlan(nextPlan)
    setEditPlaceId(null)
    setDay(draftDay)
  }
  const reorderPlace = (offset: -1 | 1) => {
    if (!editingPlace) return
    const owningDay = dayOptions.find((key) => activePlan.days[key]?.some((place) => place.id === editingPlace.id))
    if (!owningDay) return
    const places = [...(activePlan.days[owningDay] ?? [])]
    const index = places.findIndex((place) => place.id === editingPlace.id)
    const target = index + offset
    if (index < 0 || target < 0 || target >= places.length) return
    const [moved] = places.splice(index, 1)
    places.splice(target, 0, moved)
    const nextPlan = updateGeneratedPlan(activePlan, { ...activePlan.days, [owningDay]: places })
    persistPlan(nextPlan)
  }
  const addPlace = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newPlaceName.trim()
    if (!name) return
    const targetDay = activePlan.days[newPlaceDay] ?? []
    const anchor = targetDay[targetDay.length - 1] ?? Object.values(activePlan.days).flat()[0]
    if (!anchor) return
    const added: PlannedStop = {
      ...anchor,
      id: `${activePlan.id}-${newPlaceDay.toLowerCase().replace(' ', '-')}-custom-${Date.now()}`,
      name,
      type: '自由探索',
      stay: '1h',
      budget: 0,
      transport: `从${anchor.name}步行约 10 分钟`,
      note: '按你的想法新增，先作为路线草稿保存。',
      lng: cityProfile.mapCenter[0],
      lat: cityProfile.mapCenter[1],
      x: 0,
      z: 0,
      inputName: name,
      canonicalName: undefined,
      address: undefined,
      poiId: undefined,
      amapPoiId: undefined,
      district: undefined,
      adcode: undefined,
      citycode: undefined,
      poiType: undefined,
      tel: undefined,
      verifiedAt: undefined,
      resolutionStatus: undefined,
      coordinateSystem: undefined,
      mapStatus: 'unresolved',
      searchKeyword: name,
      coordinateSource: '等待高德 POI 核验',
      verified: false,
      durationMinutes: 60,
      travelFromPreviousMinutes: 10,
      fixed: false,
      factState: 'estimated',
      factSource: '用户手动添加',
    }
    const nextPlan = updateGeneratedPlan(activePlan, { ...activePlan.days, [newPlaceDay]: [...targetDay, added] })
    persistPlan(nextPlan, '地点已添加，行程已保存')
    track('place_added', { planId: activePlan.id, placeType: 'custom' })
    setNewPlaceName('')
    setAddOpen(false)
    setDay(newPlaceDay)
  }
  const budgetLimit = activePlan.budgetLimit ?? activePlan.budget
  const budgetOver = activePlan.budgetLimit !== null && activePlan.budget > activePlan.budgetLimit
  const remaining = Math.max(0, budgetLimit - activePlan.budget)
  const routeStatus = activePlan.validation.passed
    ? activePlan.intent.missing.length > 0 ? '先按当前信息排好，补充后可再调整' : '按片区排好，走起来少折返'
    : '还有几项信息需要确认'
    return <AppShell>
      <ZouNavigationBar title={activePlan.label} right={<button className="icon-button" aria-label="分享方案"><Share2 /></button>} />
      <div className="page-content plan-detail">
        <header><h1>{activePlan.city}{activePlan.nights + 1}天{activePlan.nights}晚</h1><p>{activePlan.pace} · 计划约 ¥{activePlan.budget} · {routeStatus}</p><ZouAvatarStack friends={friends} /></header>
        <ZouDaySelector day={day} onChange={setDay} />
        <div className="plan-edit-actions"><button type="button" onClick={() => { setNewPlaceDay(day); setAddOpen(true) }}><Plus />添加地点</button><button type="button" onClick={() => persistPlan(activePlan)}>保存行程</button></div>
        <ZouSegmentedControl options={["时间轴", "地图"]} value={view} onChange={setView} />
        {view === "时间轴"
          ? <div className="timeline-list">{currentPlaces.map((place) => <ZouPlaceCard key={place.id} place={place} locked={locked.includes(place.id)} onLock={() => setLocked((items) => items.includes(place.id) ? items.filter((item) => item !== place.id) : [...items, place.id])} onReplace={() => setReplaceId(place.id)} onDelete={() => setConfirmDeleteId(place.id)} onMore={() => openEditor(place)} />)}</div>
           : <div className="mini-map"><RealRouteMap city={activePlan.city} center={cityProfile.mapCenter} places={currentPlaces} progress={0} compact onPlacesResolved={(places) => persistResolvedPlaces(places as PlannedStop[])} /></div>}
        {foodRecommendations.length > 0 ? <section className="food-recommendations" aria-label="本地美食推荐">
          <div className="food-recommendations__header"><div><span>本地美食推荐</span><strong>具体店名，按片区选择</strong></div><small>可替换进时间轴</small></div>
          <div className="food-recommendations__list">{foodRecommendations.map((item) => <article key={item.id}>
            <div><strong>{item.name}</strong><span>{item.address ?? item.area}</span></div>
            {item.menuHighlights?.length ? <p>可点：{item.menuHighlights.join('、')}</p> : null}
            <small>人均约 ¥{item.price.min}–¥{item.price.max} · 预算按人均区间估算</small>
          </article>)}</div>
        </section> : null}
        <section className="trip-logistics">
          <h2>行程条件</h2>
          <div className="trip-logistics__row">
            <Building2 />
            <div>
              <strong>{selectedHotel ? `行程内住宿 · ${selectedHotelTier}档` : activePlan.intent.hotel ? "住宿已锁定" : "住宿待确认"}</strong>
              <small>{selectedHotelOption?.name ?? selectedHotel?.name ?? activePlan.intent.hotel ?? "请补充酒店位置"} · 连住 {activePlan.nights} 晚{selectedHotelOption ? ` · ¥${selectedHotelOption.nightly.min}–${selectedHotelOption.nightly.max}/晚` : ''}</small>
              {selectedHotelOption ? <small>{selectedHotelOption.summary}{selectedHotelOption.communityTags?.length ? ` 走走推荐：${selectedHotelOption.communityTags.slice(0, 2).join('、')}` : ''}</small> : null}
            </div>
            {selectedHotel ? <button type="button" onClick={() => setReplaceId(selectedHotel.id)}>更换酒店</button> : null}
          </div>
        </section>
        {knowledge ? <section className="knowledge-card">
          <div><span>这趟重点</span><strong>{knowledge.city} · 按片区连续安排</strong></div>
          <p>{knowledge.intro}</p>
          <div className="knowledge-hotels">{selectedHotelOption ? <span>已选住宿 · {selectedHotelOption.tier === "budget" ? "经济" : selectedHotelOption.tier === "comfort" ? "舒适" : "高星"} · ¥{selectedHotelOption.nightly.min}–{selectedHotelOption.nightly.max}/晚</span> : null}</div>
        </section> : null}
        <section className="budget-card"><div><span>预算上限</span><strong>¥{budgetLimit}</strong></div>{budgetOver ? <p className="budget-card__over">当前计划估算 ¥{activePlan.budget}，超出上限 ¥{activePlan.budget - budgetLimit}；可更换住宿或调整行程。</p> : null}<dl><div><dt>住宿</dt><dd>¥{activePlan.budgetBreakdown.lodging}</dd></div><div><dt>餐饮</dt><dd>¥{activePlan.budgetBreakdown.meals}</dd></div><div><dt>交通</dt><dd>¥{activePlan.budgetBreakdown.transport}</dd></div><div><dt>门票</dt><dd>¥{activePlan.budgetBreakdown.tickets}</dd></div><div><dt>咖啡</dt><dd>¥{activePlan.budgetBreakdown.coffee}</dd></div><div><dt>缓冲</dt><dd>¥{activePlan.budgetBreakdown.buffer}</dd></div><div><dt>剩余</dt><dd>¥{remaining}</dd></div></dl></section>
        <ZouButton onClick={() => navigate("/travel/friends")}>邀请朋友一起决定</ZouButton>
      </div>
      <ZouBottomSheet open={Boolean(replaceId)} onClose={() => setReplaceId(null)} title={replacingHotel ? "选择住宿" : "替换这个地点"}>
        {updating
          ? <div className="sheet-bot"><ZouMotionBot state="updating" label="Bloub / Grok Bot" /><p>重新检查前后路程</p></div>
          : <div className="replacement-list">
            {replacingHotel ? <p className="replacement-note">只更换住宿节点，其他景点、餐饮与时间不变。</p> : null}
            {replacements.map((item) => <button type="button" key={item.name} onClick={() => replace(item.name)}><div><strong>{item.name}</strong><span>{item.meta}</span><p>{item.reason}</p></div><span>{replacingHotel ? "选择" : "替换"}</span></button>)}
          </div>}
      </ZouBottomSheet>
      <ZouBottomSheet open={Boolean(editPlaceId)} onClose={() => setEditPlaceId(null)} title="编辑地点">
        {editingPlace ? <form className="journey-form place-edit-form" onSubmit={(event) => { event.preventDefault(); savePlace() }}><label>时间<input name="place-time" type="time" value={draftTime} onChange={(event) => setDraftTime(event.target.value)} required /></label><label>所在行程日<select name="place-day" value={draftDay} onChange={(event) => setDraftDay(event.target.value)}>{dayOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label>备注<textarea name="place-note" value={draftNote} onChange={(event) => setDraftNote(event.target.value)} maxLength={120} /></label><div className="place-edit-reorder"><button type="button" onClick={() => reorderPlace(-1)} disabled={activePlan.days[dayOptions.find((key) => activePlan.days[key]?.some((place) => place.id === editingPlace.id)) ?? '']?.[0]?.id === editingPlace.id}><ArrowUp />上移</button><button type="button" onClick={() => reorderPlace(1)}><ArrowDown />下移</button></div><ZouButton type="submit">保存地点</ZouButton><button type="button" className="danger-text-action" onClick={() => { setConfirmDeleteId(editingPlace.id); setEditPlaceId(null) }}>删除这个地点</button></form> : null}
      </ZouBottomSheet>
      <ZouBottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="添加地点"><form className="journey-form place-edit-form" onSubmit={addPlace}><label>地点名称<input name="new-place-name" autoComplete="off" value={newPlaceName} onChange={(event) => setNewPlaceName(event.target.value)} placeholder="例如：一间喜欢的书店…" required /></label><label>安排在<select name="new-place-day" value={newPlaceDay} onChange={(event) => setNewPlaceDay(event.target.value)}>{dayOptions.map((option) => <option key={option}>{option}</option>)}</select></label><p className="journey-note">新增地点会先作为待核验的自由探索点保存，不会假装有实时票价或营业时间。</p><ZouButton type="submit">添加并保存</ZouButton></form></ZouBottomSheet>
      <ZouBottomSheet open={Boolean(confirmDeleteId)} onClose={() => setConfirmDeleteId(null)} title="删除这个地点？"><p>删除后会从当前计划中移除，但其他天和其他地点不变。</p><ZouButton onClick={() => { if (confirmDeleteId) removePlace(confirmDeleteId) }}>确认删除</ZouButton><ZouButton variant="secondary" onClick={() => setConfirmDeleteId(null)}>取消</ZouButton></ZouBottomSheet>
      {toast ? <ZouToast message={toast} onClose={() => setToast("")} /> : null}
    </AppShell>
}
export const FriendsPage = () => {
  const navigate = useNavigate()
  const advanceTripFlow = useAppStore((state) => state.transitionTripFlow)
  const [invite, setInvite] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const accepted = useAppStore((state) => state.friendInviteAccepted)
  const setAccepted = useAppStore((state) => state.setFriendInviteAccepted)
  const inviteUrl = `${window.location.origin}/travel/friends?invite=1`
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); setInvite(false); setInviteMessage('邀请链接已复制，发给朋友即可打开。') }
    catch { window.prompt('复制邀请链接', inviteUrl) }
  }
  const shareInvite = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: '和我一起决定这趟行程', text: '打开走走，一起选出最合适的安排。', url: inviteUrl }); setInvite(false); setInviteMessage('邀请已发送。') }
      else await copyInvite()
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) await copyInvite() }
  }
  useEffect(() => { advanceTripFlow('OPEN_DECISION') }, [advanceTripFlow])
  return <AppShell><ZouNavigationBar title="朋友" right={<button className="text-button" onClick={() => setInvite(true)}>邀请</button>} /><div className="page-content friends-page"><header><h1>和朋友一起决定</h1><p>意见表控制在 30 秒内，AI 只总结共识和冲突。</p></header><section className="friend-list">{friends.map((friend, index) => { const isAccepted = friend.status === 'accepted' || (friend.status === 'pending' && accepted); return <article key={friend.id}><ZouAvatar src={friend.image} name={friend.name} muted={!isAccepted} /><div><strong>{friend.name}</strong><small>{index === 0 ? '发起人' : '已填写意见'}</small></div><FriendStatus accepted={isAccepted} /></article> })}</section>{!accepted ? <ZouButton variant="secondary" onClick={() => setAccepted(true)}>确认安安已接受</ZouButton> : null}<section className="opinion-summary"><span>AI 总结</span><h2>4 位朋友已提交</h2><ul><li>3 人希望行程松弛</li><li>1 人不吃海鲜</li><li>3 人希望去外滩</li></ul><div className="conflict"><strong>有 1 项需要协调</strong><p>安安希望加入夜景，但周周希望第二天更早结束。</p></div></section><div className="floating-cta"><ZouButton onClick={() => navigate('/travel/vote')}>进入方案投票</ZouButton></div></div><ZouBottomSheet open={invite} onClose={() => setInvite(false)} title="邀请朋友"><button className="sheet-action" onClick={() => void shareInvite()}><Link2 /><span><strong>分享链接</strong><small>用系统分享发给朋友</small></span></button><button className="sheet-action" onClick={() => void copyInvite()}><Copy /><span><strong>复制链接</strong><small>朋友在浏览器打开即可加入</small></span></button></ZouBottomSheet>{inviteMessage ? <ZouToast message={inviteMessage} onClose={() => setInviteMessage('')} /> : null}</AppShell>
}

export const VotePage = () => {
  const navigate = useNavigate()
  const advanceTripFlow = useAppStore((state) => state.transitionTripFlow)
  const [searchParams] = useSearchParams()
  const selectedVote = useAppStore((s) => s.vote)
  const setVote = useAppStore((s) => s.setVote)
  const setTripMode = useAppStore((s) => s.setTripMode)
  const setCity = useAppStore((s) => s.setCity)
  const setTripCity = useAppStore((s) => s.setTripCity)
  const [ended, setEnded] = useState(searchParams.get('complete') === '1')
  const votePlans = useMemo(() => readStoredPlans() ?? fallbackPlans, [])
  const voteCounts = useMemo(() => votePlans.map((plan, index) => ({ ...plan, count: [3, 2, 1][index] + (selectedVote === plan.id ? 1 : 0) })), [selectedVote, votePlans])
  return <AppShell><ZouNavigationBar title="方案投票" /><div className="page-content vote-page"><header><h1>{ended ? '投票结果' : '每位朋友 1 票'}</h1><p>{ended ? '「最匹配」获得最多票。' : '选择最适合大家的一套走法。'}</p></header><div className="vote-list">{voteCounts.map((plan) => <button key={plan.id} aria-pressed={selectedVote === plan.id} onClick={() => !ended && setVote(plan.id)}><span className="vote-radio">{selectedVote === plan.id ? <Check /> : null}</span><div><strong>{plan.label}</strong><small>{plan.difference}</small></div><b>{plan.count} 票</b></button>)}</div>{!ended ? <ZouButton variant="secondary" onClick={() => setEnded(true)}>结束投票</ZouButton> : <ZouButton onClick={() => { const chosen = votePlans.find((plan) => plan.id === (selectedVote ?? 'match')) ?? votePlans[0]; const chosenCity = (chosen && 'city' in chosen && typeof chosen.city === 'string' ? chosen.city : '上海'); if (chosen && 'days' in chosen) writeSavedPlan(chosen as GeneratedPlan); advanceTripFlow('CONFIRM_PLAN'); advanceTripFlow('START_TRIP'); setTripCity(chosenCity); setCity(chosenCity); setTripMode('active'); navigate('/trips') }}>保存行程</ZouButton>}<p className="privacy-note">如果同票，会保留并列方案供你二选一。</p></div></AppShell>
}
