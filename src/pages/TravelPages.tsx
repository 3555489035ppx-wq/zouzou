import { FormSelect } from '../components/FormSelect'
import { UnderstandingBot } from '../components/UnderstandingBot'
import { FormPicker } from '../components/FormPicker'
import '../task01.css'
import { PrivateShare } from '../components/PrivateShare'
import { TripPreparation, TripExport } from '../components/TripPreparation'
import { previewTripDuration } from '../services/trip/editDuration'
import { collaborationSnapshot } from '../services/trip/collaborationSnapshot'
import { saveGroupTrip } from '../services/trip/groupTrip'
import { tripSummary } from '../services/trip/summary'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Building2, Copy, ImagePlus, Link2, Plus, Share2, X } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ItineraryContent } from '../components/ItineraryContent'
import { OpenRouteMapButton } from '../components/MapLauncher'
import { RealRouteMap } from '../components/RealRouteMap'
import {
  Check, DestinationPicker, ZouAvatar, ZouAvatarStack, ZouBottomSheet, ZouButton, ZouDaySelector,
  ZouMotionBot, ZouNavigationBar, ZouPlaceCard, ZouPlanCard, ZouSegmentedControl, ZouToast,
} from '../components/ui'
import { aiService, type AIStage } from '../services/ai'
import { TripGenerationJob, getTripGenerationJob, readGenerationJob } from '../services/trip/generationJob'
import { friends, plans as fallbackPlans } from '../demo-data/trips'
import { cityNames } from '../demo-data/cities'
import { emptyDietaryProfile, foodCompatibilityIssues } from '../services/trip/dietary'
import { isConcreteKnowledgeItem } from '../services/trip/cityKnowledge'
import {
  DEFAULT_SHANGHAI_PROMPT,
  TRIP_INPUT_STORAGE,
  TRIP_MEDIA_STORAGE,
  TRIP_PLANS_STORAGE,
  TRIP_UNDERSTANDING_STORAGE,
  getDefaultGeneratedPlans,
  generatePlans,
  completePlanOptions,
  getHotelRecommendationsForPlan,
  getReplacementCandidates,
  isHotelStop,
  paceLabel,
  readSavedPlans,
  readStoredPlans,
  writeSavedPlan,
  selectPlanOption,
  updateGeneratedPlan,
  undoPlanEdit,
  writeStoredPlans,
  type GeneratedPlan,
  type PlannedStop,
  type TripMedia,
  type TripUnderstanding,
} from '../services/trip/planner'
import { readVersioned, removeStored, writeVersioned } from '../services/storage'
import { parseTripMediaList } from '../services/trip/schemas'
import { resolveDraftMedia } from '../services/trip/mediaStore'
import { track } from '../services/analytics'
import { useAppStore } from '../stores/appStore'
import { getGroupPlanUserId, groupPlanApi, GroupPlanApiError } from '../services/groupPlanApi'
import type { GroupPlan, GroupPlanInput } from '../services/groupPlans'
import { getShareUrl } from '../services/share'
import { JourneyPlaceSheet } from '../components/JourneyPlaceSheet'

const defaultPrompt = DEFAULT_SHANGHAI_PROMPT

function readTripMedia(): TripMedia[] {
  return parseTripMediaList(readVersioned<unknown>(TRIP_MEDIA_STORAGE, 'session'))
}

export { TripRequestForm as TravelNewPage } from './TripRequestForm'

const getUnderstandingProgressSteps = (mediaCount: number) => [
  { key: 'description', label: '读懂想法' },
  ...(mediaCount > 0 ? [{ key: 'screenshots', label: `识别 ${mediaCount} 张截图` }] : []),
  { key: 'places', label: '整理偏好' },
  { key: 'route', label: '核对信息' },
  { key: 'plan', label: '安排路线' },
  { key: 'complete', label: '完成' },
]

const getUnderstandingProgressIndex = (stage: AIStage, hasMedia: boolean, planning: boolean, stepCount: number) => {
  if (stage === 'success' && planning) return stepCount - 1
  if (planning) return stepCount - 2
  if (stage === 'updating') return stepCount - 3
  if (stage === 'listening') return 0
  if (stage === 'reading' && hasMedia) return 1
  if (stage === 'thinking') return hasMedia ? 2 : 1
  if (stage === 'planning') return hasMedia ? 3 : 2
  if (stage === 'done') return hasMedia ? 4 : 3
  return stepCount - 2
}

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
  const generationJob = useRef<TripGenerationJob | null>(null)
  const presentationRun = useRef(0)
  const showStage = async (next: AIStage, text: string, run: number, ms = 650) => {
    if (run !== presentationRun.current) throw new DOMException('已取消', 'AbortError')
    setStage(next); setLabel(text)
    await new Promise(resolve => window.setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : ms))
    if (run !== presentationRun.current) throw new DOMException('已取消', 'AbortError')
  }
  useEffect(() => {
    if (errorParam === '1') {
      advanceTripFlow('ERROR')
      setStage('error')
      setError('无法读取当前输入，请返回检查后重试。')
      return
    }
    let active = true
    const run = ++presentationRun.current
    setReady(false)
    setError('')
    setStage('listening')
    const text = readVersioned<string>(TRIP_INPUT_STORAGE, 'session', true) ?? readGenerationJob()?.text
    if (!text?.trim()) { setStage('error'); setError('当前没有旅行输入，请返回创建页填写。'); return }
    resolveDraftMedia(readTripMedia().length ? readTripMedia() : readVersioned<TripMedia[]>(TRIP_MEDIA_STORAGE,'local') ?? []).then(async media=>{
    const job = getTripGenerationJob({text,media},aiService)
    generationJob.current=job
    await showStage('listening', '正在读取你的旅行想法', run)
    await job.understand((next, text) => { if (active) { setStage(next); setLabel(text) } })
      .then(async(result) => {
        await showStage('thinking', '已读懂需求，正在整理你的偏好', run)
        await showStage('updating', '正在核对日期、地点与待确认信息', run)
        if(active){advanceTripFlow('UNDERSTANDING_READY');setUnderstanding(result);setReady(true);setDraftDestination(result.intent.destination);setDraftPartySize(String(result.intent.partySize));setDraftBudget(result.intent.budget===null?'':String(result.intent.budget));writeVersioned(TRIP_UNDERSTANDING_STORAGE,result,'session')}
        if(!result.intent.conflicts.length && result.intent.destination!=='未确定' && !result.mediaFacts?.length) {
          if(active)setPlanning(true)
          await showStage('planning', '正在安排每天的路线与时间', run)
          await job.plan((next,text)=>{if(active){setStage(next);setLabel(text)}})
          await showStage('success', '方案已准备好，马上为你展开', run, 700)
          if(active){advanceTripFlow('PLANS_READY');navigate('/travel/plans',{replace:true})}
        }
      })
    }).catch((reason: Error) => { if (active && reason.name!=='AbortError') { advanceTripFlow('ERROR'); setPlanning(false); setStage('error'); setError(reason.message) } })
    return () => { active = false; presentationRun.current++ }
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
    const next: TripUnderstanding = { ...understanding, intent: { ...understanding.intent, destination, partySize, budget, missing,conflicts:understanding.intent.conflicts.filter(item=>!(/预算/.test(item)&&budget!==null)&&!(/人数/.test(item)&&partySize!==understanding.intent.partySize)) } }
    try { generationJob.current?.updateUnderstanding(next) } catch(cause) {setError(String(cause));return}
    setUnderstanding(next)
    writeVersioned(TRIP_UNDERSTANDING_STORAGE, next, 'session')
    setEditorOpen(false)
    if(!next.intent.conflicts.length)void startPlanning()
  }
  const startPlanning = async (reviewedUncertainMedia=false) => {
    if (!understanding || planning || !generationJob.current) return
    if(!reviewedUncertainMedia&&generationJob.current.record.understanding?.mediaFacts?.some(fact=>fact.needsConfirmation))return
    advanceTripFlow('START_PLANNING')
    setPlanning(true)
    try {
      const run = ++presentationRun.current
      await showStage('planning', '正在安排每天的路线与时间', run)
      const generatedPlans = await generationJob.current.plan((next, text) => { setStage(next); setLabel(text) })
      await showStage('success', '方案已准备好，马上为你展开', run, 700)
      track('journey_generated', { planCount: generatedPlans.length })
      advanceTripFlow('PLANS_READY')
      navigate('/travel/plans', { replace: true })
    } catch (reason) {
      if(reason instanceof Error && reason.name==='AbortError')return
      advanceTripFlow('ERROR')
      setPlanning(false)
      setStage('error')
      setError(reason instanceof Error ? reason.message : '方案生成失败，请稍后重试。')
    }
  }
  const confirmSource = (field:'dates'|'arrivalLocation'|'departureLocation', value:TripUnderstanding['intent']['dates']|string, source:string) => {
    if(!understanding)return
    const term=field==='dates'?'日期':field==='arrivalLocation'?'到达地点':'返程地点'
    const nextIntent={...understanding.intent,[field]:value,conflicts:understanding.intent.conflicts.filter(item=>!item.includes(term))}
    if(field==='dates'&&value&&typeof value!=='string'){nextIntent.durationDays=Math.round((Date.parse(value.end)-Date.parse(value.start))/86400000)+1;nextIntent.nights=nextIntent.durationDays-1;nextIntent.missing=nextIntent.missing.filter(item=>!item.includes('日期')&&!item.includes('年份'))}
    const draft=readVersioned<Record<string,unknown>>('zouzou-current-draft-v2','local')
    if(draft){const patch=field==='dates'&&typeof value!=='string'?{date:value?.start,days:String(nextIntent.durationDays)}:field==='arrivalLocation'?{arrival:value}:{departure:value};if(!writeVersioned('zouzou-current-draft-v2',{...draft,...patch,revision:Number(draft.revision??0)+1,updatedAt:new Date().toISOString()},'local')){setError('确认结果未能保存，原草稿保留');return}}
    const next={...understanding,intent:nextIntent,evidence:[...understanding.evidence,`用户确认${term}采用${source}`]}
    try{generationJob.current?.updateUnderstanding(next);writeVersioned(TRIP_UNDERSTANDING_STORAGE,next,'session');setUnderstanding(next);if(!next.intent.conflicts.length)void startPlanning()}catch(cause){setError(String(cause))}
  }
  const mediaCount = readTripMedia().length
  const progressSteps = getUnderstandingProgressSteps(mediaCount)
  const progressIndex = getUnderstandingProgressIndex(stage, mediaCount > 0, planning, progressSteps.length)
  const intent = understanding?.intent
  const fieldKey=(text:string)=>/日期|年份/.test(text)?'dates':/到达/.test(text)?'arrival':/返程/.test(text)?'departure':/预算/.test(text)?'budget':/人数/.test(text)?'party':/酒店|住宿/.test(text)?'hotel':text
  const conflictItems=[...new Map((intent?.conflicts??[]).map(item=>[fieldKey(item),item])).values()]
  const missingForDisplay=[...new Map((intent?.missing??[]).filter(item=>!conflictItems.some(conflict=>fieldKey(conflict)===fieldKey(item))).map(item=>[fieldKey(item),item])).values()]
  const mediaFacts = understanding?.mediaFacts ?? []
  const uncertainMediaCount = mediaFacts.filter((fact) => fact.needsConfirmation).length
  const knowledge = understanding?.knowledge
  const cancelGeneration = () => {
    try { presentationRun.current++; generationJob.current?.cancel(); setPlanning(false); setReady(false); setStage('error'); setError('任务已取消。已完成阶段保留，可重试继续。') }
    catch(cause) {setError(String(cause))}
  }
  return <AppShell><ZouNavigationBar title="理解旅行" /><div className={`page-content understanding-page${!ready || planning ? ' is-processing' : ''}`}><div className="bot-stage"><UnderstandingBot busy={(!ready || planning) && stage !== 'success'} failed={Boolean(error) || stage === 'error'} /><h1>{planning ? '正在生成旅行方案' : ready ? '这是我理解的旅行' : error ? '这次没有理解完成' : '正在理解你的旅行'}</h1><p aria-live="polite">{error || (label.includes('连接') ? '正在读懂你的目的地、时间与偏好' : label)}</p>{!ready || planning ? <div className="progress-steps" aria-label="旅行规划进度">{progressSteps.map((item, index) => { const done = index < progressIndex; const active = !error && index === progressIndex; return <span key={item.key} className={`${done ? 'is-done ' : ''}${active ? 'is-active' : ''}`} aria-current={active ? 'step' : undefined}>{done ? <Check /> : <i>{index + 1}</i>}{item.label}</span> })}</div> : null}</div>{ready && !planning && intent ? <><section className="understanding-card"><div className="understanding-card__top"><div><span>目的地</span><strong>{intent.destination}</strong></div><div><span>行程</span><strong>{intent.durationDays} 天 {intent.nights} 晚</strong></div><div><span>出行人数</span><strong>{intent.partySize} 人</strong></div><div><span>预算</span><strong>{intent.budget !== null ? `¥${intent.budget}` : '待确认'}</strong></div></div><p className="understanding-card__summary">我理解的是一趟{paceLabel(intent.pace)}的 {intent.destination} 行程{intent.mustVisit.length > 0 ? `，重点包括 ${intent.mustVisit.join('、')}` : ''}{intent.preferences.length > 0 ? `，同时照顾${intent.preferences.join('、')}偏好` : ''}。</p><dl><div><dt>节奏</dt><dd>{paceLabel(intent.pace)}</dd></div><div><dt>必去</dt><dd>{intent.mustVisit.length > 0 ? intent.mustVisit.join(' · ') : '未指定，可自由安排'}</dd></div><div><dt>偏好</dt><dd>{intent.preferences.length > 0 ? intent.preferences.join(' · ') : '未指定，可自由安排'}</dd></div></dl><button className="text-button intent-edit-button" type="button" onClick={() => setEditorOpen(true)}>调整行程条件</button></section><section className="missing-card"><h2>{missingForDisplay.length > 0 ? `还有 ${missingForDisplay.length} 项可补充` : '关键条件已确认'}</h2>{missingForDisplay.length > 0 ? <ul>{missingForDisplay.map((item) => <li key={item}>{item}</li>)}</ul> : <p>日期、到达、返程、住宿和预算已经作为排程约束。</p>}{mediaFacts.length > 0 ? <p>已读取 {mediaFacts.length} 张旅行截图{uncertainMediaCount > 0 ? `，有 ${uncertainMediaCount} 张信息需要你确认。` : ''}</p> : null}{knowledge ? <p>已为你整理{knowledge.city}的重点地点、吃饭和住宿，路线按片区连续安排。</p> : null}</section>{intent.conflicts?.length ? <div role="alert"><p>以下条件冲突需修改后继续：</p><ul>{conflictItems.map(conflict=><li key={conflict}>{conflict}</li>)}</ul>{(['dates','arrivalLocation','departureLocation'] as const).map(field=>{const term=field==='dates'?'日期':field==='arrivalLocation'?'到达地点':'返程地点';if(!intent.conflicts.some(item=>item.includes(term)))return null;const arrival=mediaFacts.find(fact=>fact.facts.arrivalLocation&&fact.facts.dates)?.facts.dates?.start;const departure=mediaFacts.find(fact=>fact.facts.departureLocation&&fact.facts.dates)?.facts.dates?.end;const choices=[{value:intent[field],source:'当前条件'},...(field==='dates'&&arrival&&departure?[{value:{start:arrival,end:departure},source:'截图到离日期'}]:mediaFacts.map(fact=>({value:fact.facts[field],source:fact.name})))].filter(choice=>choice.value);return <fieldset key={field}><legend>确认{term}来源</legend>{choices.map((choice,index)=><button type="button" key={index} onClick={()=>confirmSource(field,choice.value!,choice.source)}>采用{choice.source}：{typeof choice.value==='string'?choice.value:`${choice.value?.start}—${choice.value?.end}`}</button>)}</fieldset>})}</div> : null}{mediaFacts.length>0?<section className="screenshot-facts"><h2>从截图读到了这些</h2><p>核对后，再用这些信息安排旅行。</p>{mediaFacts.map((fact,index)=><article key={fact.mediaId}><strong>截图 {index+1}</strong><dl>{[['日期',fact.facts.dates?`${fact.facts.dates.start} — ${fact.facts.dates.end}`:''],['时间',fact.facts.times.join(' · ')],['地点',fact.facts.locations.join(' · ')],['酒店',fact.facts.hotel??'']].filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{!fact.rawText?<p>未读到清晰信息，请重新上传或补充文字。</p>:<details><summary>查看识别文字</summary><p>{fact.rawText}</p></details>}</article>)}</section>:null}{uncertainMediaCount>0?<section role="status"><h2>截图信息尚未确认</h2>{mediaFacts.filter(fact=>fact.needsConfirmation).map(fact=><p key={fact.mediaId}>{fact.name}：{fact.rawText||'未读取到可靠文字'} {fact.warnings.join('；')}</p>)}<p>请核对上方条件；不清楚的日期、地点请返回补充，未识别信息不会当成已确认订单。</p></section>:null}<ZouButton disabled={planning || Boolean(intent.conflicts?.length)} onClick={()=>void startPlanning(true)}>{uncertainMediaCount>0?'已核对当前条件，继续生成':'开始规划'}</ZouButton><ZouButton variant="secondary" onClick={() => navigate('/travel/new')}>修改日期、站点和其他条件</ZouButton></> : null}{!error && (!ready || planning) ? <div className="understanding-cancel"><p>可以稍等一下，走走正在为你整理。</p><ZouButton variant="plain" onClick={cancelGeneration}>取消本次规划</ZouButton></div> : null}{error ? <><ZouButton variant="secondary" onClick={retryUnderstanding}>重试理解</ZouButton><ZouButton onClick={() => navigate('/travel/new')}>返回修改输入</ZouButton></> : null}<ZouBottomSheet open={editorOpen} onClose={() => setEditorOpen(false)} title="调整行程条件"><div className="intent-editor"><label>目的地<DestinationPicker value={draftDestination} onChange={setDraftDestination} name="trip-destination" ariaLabel="目的地" /></label><label>同行人数<input name="trip-party-size" type="number" min="1" max="20" inputMode="numeric" value={draftPartySize} onChange={(event) => setDraftPartySize(event.target.value)} /></label><label>总预算（元）<input name="trip-budget" type="number" min="0" inputMode="decimal" value={draftBudget} onChange={(event) => setDraftBudget(event.target.value)} placeholder="暂不填写" /></label><p>可以调整人数和预算，地点与时间会按新的条件重新安排。</p><ZouButton onClick={saveIntentCorrections}>保存修改</ZouButton></div></ZouBottomSheet></div></AppShell>
}

export const PlansPage = () => {
  const navigate = useNavigate()
  const advanceTripFlow = useAppStore((state) => state.transitionTripFlow)
  const [generatedPlans,setGeneratedPlans] = useState(() => readStoredPlans() ?? [])
  useEffect(()=>{const reload=()=>setGeneratedPlans(readStoredPlans()??[]);window.addEventListener('zouzou-options-updated',reload);return()=>window.removeEventListener('zouzou-options-updated',reload)},[])
  const intent = generatedPlans[0]?.intent
  useEffect(() => { advanceTripFlow('PLANS_READY') }, [advanceTripFlow])
  const selected = generatedPlans.find(plan => plan.savedAt)?.id
  const choose = (plan: GeneratedPlan) => {
    try { const saved = selectPlanOption(plan); useAppStore.setState({activeRouteId:saved.tripId,tripCity:saved.city,tripMode:'upcoming'}); navigate('/trips') }
    catch(cause) { setChoiceError(cause instanceof Error ? cause.message : '保存失败，请重试') }
  }
  const [choiceError, setChoiceError] = useState('')
  return <AppShell><ZouNavigationBar title="选择方案" right={<button className="text-button" onClick={() => navigate('/travel/new?from=results',{replace:true})}>修改条件</button>} /><div className="plans-page"><header className="page-header"><h1>选择一种走法</h1><p>{intent ? `${intent.destination} · ${intent.durationDays} 天 · 同一批真实需求，只调整节奏、移动与体验密度。` : '三套方案使用同一批真实需求，只调整节奏、移动与体验密度。'}</p></header>{generatedPlans.length>0&&generatedPlans.every(plan=>plan.budgetLimit!==null&&plan.budget>plan.budgetLimit)?<section className="plans-budget-alert" role="alert"><h2>当前预算需要调整</h2><p>三套都超出预算。最低全员估算 ¥{Math.min(...generatedPlans.map(plan=>plan.budget))}，至少超出 ¥{Math.min(...generatedPlans.map(plan=>plan.budget-(plan.budgetLimit??0)))}；未知费用仍需另行确认。</p><ZouButton variant="secondary" onClick={()=>navigate('/travel/new?from=results',{replace:true})}>调整预算、天数或住宿条件</ZouButton><p>也可以先查看明细、删除可选活动后重新核算；超限方案可保存待完善，不能开始。</p></section>:null}{generatedPlans.length === 0 ? <ZouButton onClick={() => navigate('/travel/new')}>填写需求后生成方案</ZouButton> : null}<div className="plans-stack" aria-label="三种走法">{generatedPlans.map((plan) => <div key={plan.id} className="plans-stack__item" data-plan-id={plan.id}><ZouPlanCard plan={plan} selected={selected === plan.id} onSelect={() => choose(plan)} onOpen={() => navigate(`/travel/plan/${plan.optionId??plan.id}`)} /><p className="plan-comparison">{tripSummary(plan).uniquePoiCount}个地点 · {tripSummary(plan).visitCount}项安排 · 转场预留{Object.values(plan.days).flat().reduce((sum,stop)=>sum+stop.travelFromPreviousMinutes,0)}分钟（规划估算）</p></div>)}</div>{choiceError ? <p role="alert">{choiceError}</p> : null}</div></AppShell>
}

export const PlanDetailPage = () => {
  const { id } = useParams()
  const plan = [...(readSavedPlans() ?? []), ...(readStoredPlans() ?? [])].find(item => item.tripId === id) ?? (readStoredPlans() ?? []).find(item => item.optionId === id || item.id === id)
  const navigate = useNavigate()
  if (!plan) return <AppShell><ZouNavigationBar title="行程未找到" /><p>此设备没有这份行程，请从已保存列表选择。</p><ZouButton onClick={() => navigate('/trips')}>查看我的行程</ZouButton></AppShell>
  return <PlanDetailContent key={plan.tripId ?? plan.optionId ?? plan.id} initialPlan={plan} />
}
const PlanDetailContent = ({initialPlan}: {initialPlan: GeneratedPlan}) => {
  const [detailParams] = useSearchParams()
  const [editorOpen, setEditorOpen] = useState(detailParams.get('edit') === '1')
  const navigate = useNavigate()
  const { id } = useParams()
  const [day, setDay] = useState(()=>readVersioned<string>(`zouzou-detail-day-${initialPlan.tripId??initialPlan.optionId??initialPlan.id}`,'session')??'Day 1')
  useEffect(()=>{writeVersioned(`zouzou-detail-day-${initialPlan.tripId??initialPlan.optionId??initialPlan.id}`,day,'session')},[day,initialPlan.tripId,initialPlan.id])
  const [durationOpen,setDurationOpen]=useState(false)
  const [durationDays,setDurationDays]=useState(String(Object.keys(initialPlan.days).length))
  const [durationPreview,setDurationPreview]=useState<GeneratedPlan|null>(null)
  const [moreOpen,setMoreOpen]=useState(false)
  const [shareOpen,setShareOpen]=useState(false)
  const [view, setView] = useState('时间轴')
  const [activePlan, setActivePlan] = useState<GeneratedPlan>(initialPlan)
  useEffect(()=>{if(!activePlan.days[day])setDay(Object.keys(activePlan.days)[0]??'Day 1')},[activePlan.days,day])
  const locked = Object.values(activePlan.days).flat().filter(place => place.fixed).map(place => place.id)
  const isProtected = (placeId: string) => locked.includes(placeId) || activePlan.execution?.some(event => event.stopId === placeId && event.action === 'completed')
  const [replaceId, setReplaceId] = useState<string | null>(detailParams.get('replace'))
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
  const [placeSheet, setPlaceSheet] = useState<PlannedStop | null>(null)
  const currentPlaces = activePlan.days[day] ?? []
  const dayOptions = Object.keys(activePlan.days)
  const editingPlace = editPlaceId ? Object.values(activePlan.days).flat().find((place) => place.id === editPlaceId) : undefined
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
  const editPending=useRef(false)
  const persistPlan = async (nextPlan: GeneratedPlan, message = '已保存到此设备') => {
    if(editPending.current)return
    editPending.current=true
    try {
      if(nextPlan.sourceGroup && nextPlan.sceneType==='travel'){const remote=await groupPlanApi.updateTrip(nextPlan);nextPlan={...nextPlan,sourceGroup:remote.trip?.sourceGroup,savedAt:readSavedPlans()?.find(item=>item.tripId===nextPlan.tripId)?.savedAt}}
      const saved = nextPlan.savedAt ? writeSavedPlan(nextPlan) : nextPlan
      setActivePlan(saved)
      const stored = readStoredPlans() ?? []
      writeStoredPlans(stored.length ? stored.map(item => (item.optionId??item.id) === (saved.optionId??saved.id) ? saved : item) : [saved])
      if(saved.savedAt)useAppStore.setState({ activeRouteId: saved.tripId, tripCity: saved.city, tripMode: saved.status === 'active' ? 'active' : 'upcoming' })
      track('journey_saved', { planId: saved.tripId??saved.optionId??saved.id, places: saved.places })
      setToast(saved.savedAt ? message : '备选修改已保留，尚未加入我的行程');return saved
    } catch (error) { setToast(error instanceof Error ? error.message : '保存失败，请重试') } finally{editPending.current=false}
  }
  const choosePlan = () => {
    if (activePlan.savedAt && activePlan.tripId) { navigate(`/trips/${activePlan.tripId}`); return }
    try {
      const saved=selectPlanOption(activePlan)
      setActivePlan(saved)
      const stored=readStoredPlans()??[]
      writeStoredPlans(stored.map(item=>(item.optionId??item.id)===(saved.optionId??saved.id)?saved:item))
      useAppStore.setState({activeRouteId:saved.tripId,tripCity:saved.city,tripMode:'upcoming'})
      navigate(`/trips/${saved.tripId}`)
    } catch(cause) {setToast(cause instanceof Error?cause.message:'保存失败，请重试')}
  }
  const refreshGuide = () => {
    if(activePlan.sourceGroup||activePlan.execution?.length||(activePlan.status&&activePlan.status!=='planned'))return
    let next:GeneratedPlan
    try {const options=completePlanOptions(generatePlans(activePlan.intent));next=options.find(p=>p.id===activePlan.id)??options[0]}
    catch(error){setToast(error instanceof Error?error.message:'重新规划失败，原行程已保留');return}
    void persistPlan({...next,optionId:activePlan.optionId,generationId:activePlan.generationId,tripId:activePlan.tripId,savedAt:activePlan.savedAt,status:activePlan.status,
      revision:(activePlan.revision??1)+1,previousVersion:{days:activePlan.days,selectedHotelId:activePlan.selectedHotelId,intent:activePlan.intent,dates:activePlan.dates,nights:activePlan.nights}},'已按最新知识重新规划，可撤销恢复上一版')
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
    if (!replacingHotel && isProtected(replaceId)) { setToast('该站已锁定或完成，未替换。'); return }
    setUpdating(true)
    try {
      const nextPlan = await aiService.replacePlace(activePlan, replaceId, name, () => undefined)
      persistPlan(nextPlan, nextPlan.validation.passed ? '已局部更新，其他地点没有改变' : '已局部更新，但有条件需要重新确认')
      setReplaceId(null)
    } catch (cause) { setToast(cause instanceof Error ? cause.message : '替换失败，原行程已保留') } finally {
      setUpdating(false)
    }
  }
  const removePlace = (placeId: string) => {
    if (isProtected(placeId)) { setToast('该站已锁定或完成，未删除。'); return }
    const nextDays = Object.fromEntries(Object.entries(activePlan.days).map(([key, places]) => [key, places.filter((place) => place.id !== placeId)])) as Record<string, GeneratedPlan['days'][string]>
    const nextPlan = updateGeneratedPlan(activePlan, nextDays)
    persistPlan(nextPlan, '地点已删除，行程已保存')
    setConfirmDeleteId(null)
  }
  const savePlace = () => {
    if (!editingPlace || !draftTime) return
    if (isProtected(editingPlace.id)) { setToast('该站已锁定或完成，未修改。'); return }
    const nextDays = Object.fromEntries(Object.entries(activePlan.days).map(([key, places]) => [key, [...places]])) as Record<string, PlannedStop[]>
    const updated = { ...editingPlace, time: draftTime, note: draftNote.trim() || editingPlace.note }
    const originalDay=dayOptions.find(key=>activePlan.days[key].some(place=>place.id===editingPlace.id))
    if(originalDay===draftDay)nextDays[draftDay]=nextDays[draftDay].map(place=>place.id===editingPlace.id?updated:place)
    else {
      for (const [key, places] of Object.entries(nextDays)) nextDays[key] = places.filter((place) => place.id !== editingPlace.id)
      nextDays[draftDay] = [...(nextDays[draftDay] ?? []), updated].sort((a,b)=>a.time.localeCompare(b.time))
    }
    const nextPlan = updateGeneratedPlan(activePlan, nextDays)
    persistPlan(nextPlan)
    setEditPlaceId(null)
    setDay(draftDay)
  }
  const reorderPlace = (offset: -1 | 1) => {
    if (!editingPlace) return
    if (isProtected(editingPlace.id)) { setToast('该站已锁定或完成，未移动。'); return }
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
      priceState: 'unknown',
      stay: '1h',
      budget: 0,
      transport: '转场待确认，请在地图中核对',
      note: '按你的想法新增，先作为路线草稿保存。',
      lng: undefined,
      lat: undefined,
      longitude: undefined,
      latitude: undefined,
      coordinates: undefined,
      x: undefined,
      z: undefined,
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
      coordinateSource: '地点坐标待核验',
      verified: false,
      durationMinutes: 60,
      travelFromPreviousMinutes: 0,
      opening: undefined,
      hotelOptionId: undefined,
      dietaryTags: undefined,
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
    return <AppShell showTabBar>
      <ZouNavigationBar title={editorOpen ? '调整日程' : '行程安排'} right={<button className="text-button" onClick={()=>setMoreOpen(true)}>更多</button>} />
      {!editorOpen ? <ItineraryContent plan={activePlan} onEdit={() => setEditorOpen(true)} onReplace={stop => setReplaceId(stop.id)}>
        <div className="generated-itinerary-action"><ZouButton onClick={choosePlan}>{activePlan.savedAt ? '查看已选行程' : '选用并保存'}</ZouButton>{!activePlan.sourceGroup&&!activePlan.execution?.length&&(!activePlan.status||activePlan.status==='planned') ? <ZouButton variant="secondary" onClick={refreshGuide}>按最新知识重新规划</ZouButton> : null}{!activePlan.validation.passed ? <p>部分安排仍待确认，可在“调整日程”中完善。</p> : null}</div>
      </ItineraryContent> : <div className="page-content plan-detail">
        <button className="text-button" onClick={() => setEditorOpen(false)}>返回行程总览</button>
        <header><h1>{tripSummary(activePlan).title}</h1><p>{tripSummary(activePlan).dates}</p><p>{activePlan.pace} · 计划约 ¥{activePlan.budget} · {routeStatus}</p><p>出行人数：{activePlan.partySize}人；成员以实际接受邀请为准。</p></header>
        <ZouDaySelector day={day} days={Object.keys(activePlan.days)} onChange={setDay} />
        <div className="plan-edit-actions"><button type="button" onClick={() => { setNewPlaceDay(day); setAddOpen(true) }}><Plus />添加地点</button><button type="button" onClick={choosePlan}>{activePlan.savedAt?"查看已选行程":"选用并保存"}</button>{activePlan.previousVersion?<button type="button" onClick={()=>{const restored=undoPlanEdit(activePlan);if(restored===activePlan)setToast('已有完成记录，不能撤销影响已完成地点的修改');else persistPlan(restored,'已撤销上次编辑，恢复上一版安排')}}>撤销上次编辑</button>:null}</div>
        <ZouSegmentedControl options={["时间轴", "地点顺序"]} value={view} onChange={setView} />
        {view === "时间轴" ? <div className="plan-route-action"><OpenRouteMapButton places={currentPlaces} city={activePlan.city} /></div> : null}
        {view === "时间轴"
           ? <div className="timeline-list">{currentPlaces.map((place) => <ZouPlaceCard key={place.id} place={place} locked={locked.includes(place.id)} onOpen={() => setPlaceSheet(place)} onLock={() => { if(['到达','返程','住宿'].includes(place.type)){setToast('到离站和住宿是固定锚点，请通过行程条件或更换酒店调整');return} const days = Object.fromEntries(Object.entries(activePlan.days).map(([key, items]) => [key, items.map(item => item.id === place.id ? { ...item, fixed: !item.fixed } : item)])); persistPlan(updateGeneratedPlan(activePlan, days), place.fixed ? '已解除锁定' : '已锁定并保存') }} onReplace={() => setReplaceId(place.id)} onDelete={() => setConfirmDeleteId(place.id)} onMore={() => openEditor(place)} />)}</div>
           : <div className="mini-map"><RealRouteMap city={activePlan.city} places={currentPlaces} progress={0} compact /></div>}
        {foodRecommendations.length > 0 ? <section className="food-recommendations" aria-label="本地美食推荐">
          <div className="food-recommendations__header"><div><span>本地美食推荐</span><strong>具体店名，按片区选择</strong></div><small>可替换进时间轴</small></div>
          <div className="food-recommendations__list">{foodRecommendations.map((item) => <article key={item.id}>
             <div className="food-recommendations__title"><div><strong>{item.name}</strong><span>{item.address ?? item.area}</span></div><span className="food-recommendations__status">可加入时间轴</span></div>
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
        <TripPreparation plan={activePlan} day={day} onChooseReplacement={setReplaceId} /><section className="budget-card"><div><span>预算上限</span><strong>¥{budgetLimit}</strong></div>{budgetOver ? <p className="budget-card__over">当前计划估算 ¥{activePlan.budget}，超出上限 ¥{activePlan.budget - budgetLimit}；可更换住宿或调整行程。</p> : null}<dl><div><dt>住宿</dt><dd>¥{activePlan.budgetBreakdown.lodging}</dd></div><div><dt>餐饮</dt><dd>¥{activePlan.budgetBreakdown.meals}</dd></div><div><dt>交通</dt><dd>¥{activePlan.budgetBreakdown.transport}</dd></div><div><dt>门票</dt><dd>¥{activePlan.budgetBreakdown.tickets}</dd></div><div><dt>咖啡</dt><dd>¥{activePlan.budgetBreakdown.coffee}</dd></div><div><dt>缓冲</dt><dd>¥{activePlan.budgetBreakdown.buffer}</dd></div><div><dt>剩余</dt><dd>¥{remaining}</dd></div></dl></section>
        <ZouButton disabled={!activePlan.savedAt} onClick={() => navigate(`/travel/friends?tripId=${activePlan.tripId}`)}>邀请朋友一起决定</ZouButton>{!activePlan.savedAt?<p>选用并保存后，可邀请朋友或创建分享。</p>:null}
      </div>}
      <ZouBottomSheet open={durationOpen} onClose={()=>{setDurationOpen(false);setDurationPreview(null)}} title="调整旅行天数"><label>旅行天数<input aria-label="调整后的天数" type="number" min="1" max="14" value={durationDays} onChange={event=>{setDurationDays(event.target.value);setDurationPreview(null)}}/></label><p>保留出发日和锁定预订，重新安排未锁定内容；已开始的行程不能整体改天数。</p><ZouButton variant="secondary" onClick={()=>{try{setDurationPreview(previewTripDuration(activePlan,Number(durationDays)))}catch(cause){setToast(String(cause))}}}>预览天数调整</ZouButton>{durationPreview?<section><h3>{tripSummary(durationPreview).title}</h3><p>{tripSummary(durationPreview).dates} · 全员估算 ¥{durationPreview.budget}（原 ¥{activePlan.budget}）</p>{Object.entries(durationPreview.days).map(([day,stops])=><p key={day}>{day}：{stops.map(stop=>`${stop.time} ${stop.name}`).join(' → ')}</p>)}<p>{durationPreview.validation.issues.join('；')||'时间和预算检查未发现冲突'}</p><ZouButton onClick={async()=>{if(await persistPlan(durationPreview,'天数、日期和费用已重新保存')){setDurationOpen(false);setDurationPreview(null);setDay('Day 1')}}}>确认天数调整</ZouButton></section>:null}</ZouBottomSheet>
      <ZouBottomSheet open={moreOpen} onClose={()=>setMoreOpen(false)} title="更多行程操作"><TripExport plan={activePlan}/><ZouButton variant="secondary" onClick={()=>{setMoreOpen(false);setDurationOpen(true)}}>调整天数</ZouButton><ZouButton disabled={!activePlan.savedAt} onClick={()=>{setMoreOpen(false);setShareOpen(true)}}>只读分享</ZouButton><ZouButton variant="secondary" onClick={()=>navigate('/travel/new?from=results',{replace:true})}>修改旅行条件</ZouButton></ZouBottomSheet>
      <ZouBottomSheet open={shareOpen} onClose={()=>setShareOpen(false)} title="只读分享"><PrivateShare plan={activePlan}/></ZouBottomSheet>
      <ZouBottomSheet open={Boolean(replaceId)} onClose={() => setReplaceId(null)} title={replacingHotel ? "选择住宿" : "替换这个地点"}>
        {updating
          ? <div className="sheet-bot"><ZouMotionBot state="focused" label="Bloub / Grok Bot" /><p>重新检查前后路程</p></div>
          : <div className="replacement-list">
            {replacingHotel ? <p className="replacement-note">只更换住宿节点，其他景点、餐饮与时间不变。</p> : null}
            {replacements.map((item) => <button type="button" key={item.name} onClick={() => replace(item.name)}><div><strong>{item.name}</strong><span>{item.meta}</span><p>{item.reason}</p></div><span>{replacingHotel ? "选择" : "替换"}</span></button>)}
          </div>}
      </ZouBottomSheet>
      <ZouBottomSheet open={Boolean(editPlaceId)} onClose={() => setEditPlaceId(null)} title="编辑地点">
        {editingPlace ? <form className="journey-form place-edit-form" onSubmit={(event) => { event.preventDefault(); savePlace() }}><label>时间<FormPicker aria-label="时间" name="place-time" type="time" value={draftTime} onChange={(event) => setDraftTime(event.target.value)} required /></label><label>所在行程日<FormSelect name="place-day" value={draftDay} onChange={(event) => setDraftDay(event.target.value)}>{dayOptions.map((option) => <option key={option}>{option}</option>)}</FormSelect></label><label>备注<textarea aria-label="备注" name="place-note" value={draftNote} onChange={(event) => setDraftNote(event.target.value)} maxLength={120} /></label><div className="place-edit-reorder"><button type="button" onClick={() => reorderPlace(-1)} disabled={activePlan.days[dayOptions.find((key) => activePlan.days[key]?.some((place) => place.id === editingPlace.id)) ?? '']?.[0]?.id === editingPlace.id}><ArrowUp />上移</button><button type="button" onClick={() => reorderPlace(1)}><ArrowDown />下移</button></div><ZouButton type="submit">保存地点</ZouButton><button type="button" className="danger-text-action" onClick={() => { setConfirmDeleteId(editingPlace.id); setEditPlaceId(null) }}>删除这个地点</button></form> : null}
      </ZouBottomSheet>
      <ZouBottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="添加地点"><form className="journey-form place-edit-form" onSubmit={addPlace}><label>地点名称<input name="new-place-name" autoComplete="off" value={newPlaceName} onChange={(event) => setNewPlaceName(event.target.value)} placeholder="例如：一间喜欢的书店…" required /></label><label>安排在<FormSelect name="new-place-day" value={newPlaceDay} onChange={(event) => setNewPlaceDay(event.target.value)}>{dayOptions.map((option) => <option key={option}>{option}</option>)}</FormSelect></label><p className="journey-note">新增地点会先作为待核验的自由探索点保存，不会假装有实时票价或营业时间。</p><ZouButton type="submit">添加并保存</ZouButton></form></ZouBottomSheet>
      <ZouBottomSheet open={Boolean(confirmDeleteId)} onClose={() => setConfirmDeleteId(null)} title="删除这个地点？"><p>删除后会从当前计划中移除，但其他天和其他地点不变。</p><ZouButton onClick={() => { if (confirmDeleteId) removePlace(confirmDeleteId) }}>确认删除</ZouButton><ZouButton variant="secondary" onClick={() => setConfirmDeleteId(null)}>取消</ZouButton></ZouBottomSheet>
      <JourneyPlaceSheet open={Boolean(placeSheet)} onClose={() => setPlaceSheet(null)} place={placeSheet} city={activePlan.city} journeyId={activePlan.tripId??activePlan.optionId??activePlan.id} dayId={day} />
      {toast ? <ZouToast message={toast} onClose={() => setToast("")} /> : null}
    </AppShell>
}
const FRIENDS_PLAN_STORAGE = 'zouzou-friends-plan-v1'

function readFriendsPlanReference(): { sourcePlanId: string; planId: string } | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(FRIENDS_PLAN_STORAGE) ?? '') as { sourcePlanId?: unknown; planId?: unknown }
    return typeof value.sourcePlanId === 'string' && typeof value.planId === 'string' ? { sourcePlanId: value.sourcePlanId, planId: value.planId } : null
  } catch { return null }
}

function friendsPlanInput(source: GeneratedPlan, nickname: string, avatar: string): GroupPlanInput {
  const firstDay = Object.values(source.days)[0] ?? []
  const interests = [...source.intent.mustVisit, ...source.intent.preferences].filter(Boolean).slice(0, 12)
  return {
    type: source.sceneType??'travel',
    trip: collaborationSnapshot(source),
    tripOptions:(readStoredPlans()??[]).filter(option=>option.generationId===source.generationId).map(collaborationSnapshot),
    city: source.city,
    date: source.dates?.start ?? '',
    startTime: firstDay[0]?.time ?? '10:00',
    endTime: firstDay.at(-1)?.time ?? '18:00',
    budget: Math.max(0, source.budgetLimit ?? source.budget),
    partySize: source.partySize,
    interests: interests.length ? interests : ['城市漫步', '看看展'],
    avoidTags: source.intent.constraints.slice(0, 12),
    transportMode: '步行 + 地铁',
    owner: { userId: getGroupPlanUserId(), displayName: nickname, avatar },
  }
}

export const FriendsPage = () => {
  const navigate = useNavigate()
  const advanceTripFlow = useAppStore((state) => state.transitionTripFlow)
  const nickname = useAppStore((state) => state.nickname)
  const avatar = useAppStore((state) => state.avatar)
  const [query]=useSearchParams()
  const sourcePlan = useMemo(() => readSavedPlans()?.find(plan => plan.tripId === (query.get('tripId')??useAppStore.getState().activeRouteId)), [query])
  const [consent,setConsent]=useState(false)
  const [plan, setPlan] = useState<GroupPlan | null>(null)
  const [invite, setInvite] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { advanceTripFlow('OPEN_DECISION') }, [advanceTripFlow])
  useEffect(() => {
    let active = true
    if(!consent){setLoading(false);return}
    const load = async () => {
      setLoading(true); setError('')
      try {
        if (!sourcePlan) throw new Error('请先选择并保存一份行程，再创建邀请。')
        const stored = readFriendsPlanReference()
        let next: GroupPlan | null = null
        if (stored && stored.sourcePlanId === sourcePlan.tripId) {
          try { next = await groupPlanApi.get(stored.planId) } catch { window.localStorage.removeItem(FRIENDS_PLAN_STORAGE) }
        }
        if (!next) {
          next = await groupPlanApi.create(friendsPlanInput(sourcePlan, nickname, avatar))
          window.localStorage.setItem(FRIENDS_PLAN_STORAGE, JSON.stringify({ sourcePlanId: sourcePlan.tripId, planId: next.id }))
        }
        if (active) {const current=readSavedPlans()?.find(item=>item.tripId===sourcePlan.tripId);if(current&&!current.sourceGroup)writeSavedPlan({...current,sourceGroup:next.trip?.sourceGroup,sceneType:'travel'});setPlan(next)}
      } catch (reason) {
        if (active) setError(reason instanceof GroupPlanApiError ? reason.message : reason instanceof Error ? reason.message : '计划服务暂时没有连接，请稍后重试。')
      } finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [attempt, avatar, nickname, sourcePlan, consent])
  useEffect(() => {
    if (!plan) return
    return groupPlanApi.subscribe(plan.id, (event) => setPlan(event.plan), () => undefined)
  }, [plan?.id])
  const inviteUrl = plan ? getShareUrl(`/group-plans/invite/${plan.inviteCode}`) : ''
  const copyInvite = async () => {
    if (!inviteUrl) return
    try { await navigator.clipboard.writeText(inviteUrl); setInvite(false); setInviteMessage('真实邀请链接已复制，朋友打开即可填写偏好。') }
    catch { setInviteMessage(`请复制这个邀请链接：${inviteUrl}`) }
  }
  const shareInvite = async () => {
    if (!inviteUrl) return
    try {
      if (navigator.share) { await navigator.share({ title: `加入${plan?.title ?? '这趟行程'}`, text: '打开走走，告诉我你想做什么、想吃什么。', url: inviteUrl }); setInvite(false); setInviteMessage('已交给系统分享；尚未确认对方收到或加入。') }
      else await copyInvite()
    } catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError')) await copyInvite() }
  }
  if(!consent)return <AppShell><ZouNavigationBar title="邀请协作"/><main className="page-content"><h1>{sourcePlan?tripSummary(sourcePlan).title:'先选用一份行程'}</h1><p>本机行程将建立服务端协作副本，保留同一行程ID。成员可查看日期、计划人数、完整日程及你主动共享的偏好；原截图、输入原文和私人站点备注不上传。</p><p>当前为设备访客身份。计划人数与已加入成员分别显示，加入协作不会自动修改预算计价人数。</p><ZouButton disabled={!sourcePlan?.savedAt||!sourcePlan.dates} onClick={()=>setConsent(true)}>确认建立协作副本</ZouButton><ZouButton variant="secondary" onClick={()=>navigate('/trips')}>保留本机行程并返回</ZouButton></main></AppShell>
  if (loading) return <AppShell><ZouNavigationBar title="朋友" /><div className="page-content group-loading">正在准备这趟行程的邀请…</div></AppShell>
  if (!plan) return <AppShell><ZouNavigationBar title="朋友" /><main className="page-content group-loading"><p className="group-error" role="alert">{error}</p><ZouButton onClick={() => setAttempt((value) => value + 1)}>重新连接计划服务</ZouButton></main></AppShell>
  const members = plan.participants.filter((participant) => participant.inviteStatus === 'accepted')
  const submitted = members.filter((participant) => participant.role === 'member' && (participant.activityPreferences?.length || participant.foodPreferences?.length || participant.note))
  return <AppShell><ZouNavigationBar title="朋友" right={<button className="text-button" disabled={!plan} onClick={() => setInvite(true)}>邀请</button>} /><div className="page-content friends-page"><header><h1>{plan.title}</h1><p>{plan.trip?.dates?`${plan.trip.dates.start}—${plan.trip.dates.end}`:plan.date} · 计划{plan.partySize}人 · 已加入{members.length}人</p><p>把真实邀请发给朋友，他们提交的想做什么、想吃什么会直接回到这份计划。</p></header><section className="friend-list">{members.map((member) => <article key={member.id}><ZouAvatar src={member.avatar ?? '/assets/date.jpg'} name={member.displayName} /><div><strong>{member.displayName}</strong><small>{member.role === 'owner' ? '发起人' : member.activityPreferences?.length || member.foodPreferences?.length || member.note ? '已填写偏好' : '已加入，等待填写'}</small></div><span className="friend-status">{member.role === 'owner' ? '我' : '已加入'}</span></article>)}</section><section className="opinion-summary"><span>偏好汇总</span><h2>{submitted.length ? `${submitted.length} 位朋友已提交` : '还没有朋友提交偏好'}</h2>{submitted.length ? <ul>{submitted.map((member) => <li key={member.id}>{member.displayName}{member.activityPreferences?.length ? `想做 ${member.activityPreferences.join('、')}` : ''}{member.foodPreferences?.length ? ` · 想吃 / 忌口 ${member.foodPreferences.join('、')}` : ''}{member.note ? ` · ${member.note}` : ''}</li>)}</ul> : <p>先邀请朋友，打开链接后就能填写自己的安排。</p>}</section><div className="floating-cta"><ZouButton onClick={() => navigate(`/group-plans/${plan.id}`)}>进入方案投票</ZouButton></div></div><ZouBottomSheet open={invite} onClose={() => setInvite(false)} title="邀请朋友"><button className="sheet-action" onClick={() => void shareInvite()}><Link2 /><span><strong>分享链接</strong><small>用手机系统分享发送真实邀请</small></span></button><button className="sheet-action" onClick={() => void copyInvite()}><Copy /><span><strong>复制链接</strong><small>朋友打开后可直接填写偏好</small></span></button><p className="invite-link-preview">{inviteUrl}</p><p>邀请7天有效。设备访客不是手机号、微信或Apple账号。</p><button type="button" onClick={async () => { try { setPlan(await groupPlanApi.revokeInvite(plan.id)); setInviteMessage('旧邀请已撤销') } catch { setInviteMessage('撤销失败，请重试') } }}>撤销旧邀请并更新</button></ZouBottomSheet>{inviteMessage ? <ZouToast message={inviteMessage} onClose={() => setInviteMessage('')} /> : null}</AppShell>
}

export const VotePage = () => {
  const navigate=useNavigate()
  const stored=readFriendsPlanReference()
  useEffect(()=>{if(stored?.planId)navigate(`/group-plans/${stored.planId}`,{replace:true})},[stored?.planId,navigate])
  return <AppShell><ZouNavigationBar title="方案投票"/><main className="page-content"><p>投票以服务端参与者的真实选择为准。</p><ZouButton onClick={()=>navigate('/travel/friends')}>打开邀请与共同决策</ZouButton></main></AppShell>
}
