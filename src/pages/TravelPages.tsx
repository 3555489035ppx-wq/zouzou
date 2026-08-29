import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, ExternalLink, ImagePlus, Link2, Lock, QrCode, Share2, X } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { RealRouteMap } from '../components/RealRouteMap'
import {
  Check, FriendStatus, ZouAvatar, ZouAvatarStack, ZouBottomSheet, ZouButton, ZouDaySelector,
  ZouMotionBot, ZouNavigationBar, ZouPlaceCard, ZouPlanCard, ZouSegmentedControl, ZouToast,
} from '../components/ui'
import { aiService, type AIStage } from '../services/ai'
import { friends, plans as fallbackPlans } from '../demo-data/trips'
import { cityNames, getCityProfile } from '../demo-data/cities'
import { getCityImage } from '../demo-data/city-images'
import {
  DEFAULT_SHANGHAI_PROMPT,
  TRIP_INPUT_STORAGE,
  TRIP_MEDIA_STORAGE,
  TRIP_PLANS_STORAGE,
  TRIP_UNDERSTANDING_STORAGE,
  getDefaultGeneratedPlans,
  getReplacementCandidates,
  paceLabel,
  readStoredPlans,
  updateGeneratedPlan,
  writeStoredPlans,
  type GeneratedPlan,
  type TripMedia,
  type TripUnderstanding,
} from '../services/trip/planner'
import { useAppStore } from '../stores/appStore'

const defaultPrompt = DEFAULT_SHANGHAI_PROMPT

function readTripMedia(): TripMedia[] {
  try {
    const raw = sessionStorage.getItem(TRIP_MEDIA_STORAGE)
    return raw ? JSON.parse(raw) as TripMedia[] : []
  } catch {
    return []
  }
}

export const TravelNewPage = () => {
  const navigate = useNavigate()
  const [input, setInput] = useState(defaultPrompt)
  const [isExample, setIsExample] = useState(true)
  const [destination, setDestination] = useState('上海')
  const [days, setDays] = useState('3')
  const [budget, setBudget] = useState('4000')
  const [goal, setGoal] = useState('城市漫步、看展和本地美食')
  const [screenshots, setScreenshots] = useState<TripMedia[]>([
    { id: 'guide', src: getCityImage('上海').src, name: '上海外滩攻略参考', category: '攻略' },
    { id: 'citywalk', src: getCityImage('上海').src, name: '上海城市漫步参考', category: '攻略' },
    { id: 'museum', src: getCityImage('上海').src, name: '上海展览参考', category: '攻略' },
    { id: 'return', src: getCityImage('上海').src, name: '上海返程路线参考', category: '攻略' },
  ])
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
    sessionStorage.setItem(TRIP_INPUT_STORAGE, prompt)
    sessionStorage.setItem(TRIP_MEDIA_STORAGE, JSON.stringify(screenshots))
    sessionStorage.removeItem(TRIP_PLANS_STORAGE)
    navigate('/travel/understanding')
  }
  return <AppShell><ZouNavigationBar title="创建旅行" /><div className="page-content travel-new"><header><h1>想去哪走走？</h1><p>先告诉我城市、预算、天数和想做什么，我会把景点、吃住和移动排成完整攻略。</p></header><section className="trip-constraints" aria-label="旅行条件"><label><span>目的地</span><select aria-label="目的地" value={destination} onChange={(event) => updateStructured(setDestination, event.target.value)}>{cityNames.map((city) => <option key={city} value={city}>{city}</option>)}</select></label><label><span>天数</span><input aria-label="旅行天数" type="number" min="1" max="14" value={days} onChange={(event) => updateStructured(setDays, event.target.value)} /></label><label><span>预算（元）</span><input aria-label="旅行预算" type="number" min="0" step="100" value={budget} onChange={(event) => updateStructured(setBudget, event.target.value)} /></label><label className="trip-constraints__wide"><span>想做什么</span><input aria-label="旅行目的" value={goal} placeholder="本地美食、城市漫步、看展、夜景" onChange={(event) => updateStructured(setGoal, event.target.value)} /></label></section><label className="trip-prompt"><span>补充想法（可选）</span><textarea aria-label="旅行想法" value={input} onChange={(event) => { setInput(event.target.value); setIsExample(false) }} placeholder="例如：9月18日 10:30 到长沙南站，住五一广场附近，想吃臭豆腐和湘菜。" /><small aria-live="polite">{input.length}/500{isExample ? ' · 示例' : ''}</small>{isExample ? <button type="button" className="trip-prompt__clear" onClick={() => { setInput(''); setIsExample(false) }}>清空示例</button> : null}</label><section className="upload-section"><div className="section-title"><h2>旅行截图</h2><span>{screenshots.length} 张 · 长按排序</span></div><div className="screenshot-row">{screenshots.map((shot,index)=><article key={shot.id} draggable onDragStart={()=>setDragging(index)} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(dragging!==null)reorder(dragging,index);setDragging(null)}}><img src={shot.src} alt={`${shot.name}截图`} width={120} height={160} /><span>{shot.name}</span><button aria-label={`删除${shot.name}`} onClick={() => setScreenshots((items) => items.filter((item) => item.id !== shot.id))}><X /></button></article>)}<label className="add-screenshot"><ImagePlus /><span>添加</span><input type="file" multiple accept="image/*" onChange={(event) => { const selected = Array.from(event.target.files ?? []); const files = selected.filter((file) => file.type.startsWith('image/') && file.size <= 8 * 1024 * 1024); setUploadError(files.length < selected.length ? '仅支持 8MB 以内的图片截图。' : ''); setScreenshots((items) => [...items, ...files.map((file) => ({ id: `${file.name}-${file.lastModified}`, src: URL.createObjectURL(file), name: file.name, category: '上传截图' }))]) }} /></label></div>{uploadError ? <p className="upload-error" role="alert">{uploadError}</p> : null}</section><ZouButton aria-label="帮我看看" onClick={submit}>生成完整攻略</ZouButton></div></AppShell>
}

const understandingSteps: Record<AIStage, string> = {
  listening: '正在理解你的旅行', reading: '正在读取截图', thinking: '整理地点', planning: '检查路线与天气', done: '正在生成方案', updating: '正在局部更新', success: '理解完成', error: '理解没有完成',
}
const understandingStepOrder: AIStage[] = ['listening', 'reading', 'thinking', 'planning', 'done']

export const UnderstandingPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const errorParam = searchParams.get('error')
  const [stage, setStage] = useState<AIStage>('listening')
  const [label, setLabel] = useState('准备理解你的旅行')
  const [understanding, setUnderstanding] = useState<TripUnderstanding | null>(null)
  const [ready, setReady] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (errorParam === '1') {
      setStage('error')
      setError('无法读取当前输入，请返回检查后重试。')
      return
    }
    let active = true
    const request = { text: sessionStorage.getItem(TRIP_INPUT_STORAGE) ?? defaultPrompt, media: readTripMedia() }
    aiService.understandTrip(request, (next, text) => { if (active) { setStage(next); setLabel(text) } })
      .then((result) => { if (active) { setUnderstanding(result); setReady(true); sessionStorage.setItem(TRIP_UNDERSTANDING_STORAGE, JSON.stringify(result)) } })
      .catch((reason: Error) => { if (active) { setStage('error'); setError(reason.message) } })
    return () => { active = false }
  }, [errorParam])
  const startPlanning = async () => {
    if (!understanding) return
    setPlanning(true)
    try {
      const generatedPlans = await aiService.generatePlans(understanding, (next, text) => { setStage(next); setLabel(text) })
      writeStoredPlans(generatedPlans)
      navigate('/travel/plans')
    } catch (reason) {
      setPlanning(false)
      setStage('error')
      setError(reason instanceof Error ? reason.message : '方案生成失败，请稍后重试。')
    }
  }
  const mediaCount = readTripMedia().length
  const intent = understanding?.intent
  const mediaFacts = understanding?.mediaFacts ?? []
  const uncertainMediaCount = mediaFacts.filter((fact) => fact.needsConfirmation).length
  const guideContext = understanding?.guideContext
  const knowledge = understanding?.knowledge
  return <AppShell><ZouNavigationBar title="理解旅行" /><div className="page-content understanding-page"><div className="bot-stage"><ZouMotionBot state={stage === 'error' ? 'error' : stage} label="Bloub / Grok Bot" /><h1>{planning ? '正在生成 3 套方案' : ready ? '这是我理解的旅行' : error ? '这次没有理解完成' : '正在理解你的旅行'}</h1><p aria-live="polite">{error || label}</p><div className="progress-steps">{['读取你的描述', `识别 ${mediaCount} 张截图`, '整理地点与偏好', '检查路线与天气', '生成可行方案'].map((item, index) => { const stageIndex = understandingStepOrder.indexOf(stage); const done = ready ? index < 4 : stageIndex >= 0 && index < stageIndex; return <span key={item} className={done ? 'is-done' : ''}>{done ? <Check /> : <i />}{item}</span> })}</div></div>{ready && !planning && intent ? <><section className="understanding-card"><div className="understanding-card__top"><div><span>目的地</span><strong>{intent.destination}</strong></div><div><span>行程</span><strong>{intent.durationDays} 天 {intent.nights} 晚</strong></div><div><span>朋友</span><strong>{intent.partySize} 人</strong></div><div><span>预算</span><strong>{intent.budget ? `¥${intent.budget}` : '待确认'}</strong></div></div><p className="understanding-card__summary">我理解的是一趟{paceLabel(intent.pace)}的 {intent.destination} 行程{intent.mustVisit.length > 0 ? `，重点包括 ${intent.mustVisit.join('、')}` : ''}{intent.preferences.length > 0 ? `，同时照顾${intent.preferences.join('、')}偏好` : ''}。</p><dl><div><dt>节奏</dt><dd>{paceLabel(intent.pace)}</dd></div><div><dt>必去</dt><dd>{intent.mustVisit.length > 0 ? intent.mustVisit.join(' · ') : '暂未识别'}</dd></div><div><dt>偏好</dt><dd>{intent.preferences.length > 0 ? intent.preferences.join(' · ') : '暂未识别'}</dd></div></dl></section><section className="missing-card"><h2>{intent.missing.length > 0 ? `还有 ${intent.missing.length} 项需要确认` : '关键条件已确认'}</h2>{intent.missing.length > 0 ? <ul>{intent.missing.map((item) => <li key={item}>{item}</li>)}</ul> : <p>日期、到达、返程、住宿和预算已经作为排程约束。</p>}{mediaFacts.length > 0 ? <p>{mediaFacts.length} 张截图已纳入理解{uncertainMediaCount > 0 ? `，其中 ${uncertainMediaCount} 张关键字段置信度较低，请在开始规划前核对。` : '，关键字段已完成初步提取。'}</p> : null}{guideContext && guideContext.candidates.length > 0 ? <p>已参考 {guideContext.candidates.length} 条{guideContext.city}社区攻略线索，来源只用于体验候选和偏好排序。</p> : null}{knowledge ? <p>已载入{knowledge.city}城市攻略包：{knowledge.items.length} 个景点、餐饮和体验候选，住宿按预算分为 {knowledge.hotelOptions.length} 档；事实条目优先来自官方页面，社区内容只用于发现线索。</p> : null}</section><ZouButton onClick={startPlanning}>开始规划</ZouButton></> : null}{error ? <ZouButton onClick={() => navigate('/travel/new')}>返回修改输入</ZouButton> : null}</div></AppShell>
}

export const PlansPage = () => {
  const navigate = useNavigate()
  const carouselRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState('match')
  const generatedPlans = useMemo(() => readStoredPlans() ?? getDefaultGeneratedPlans(), [])
  const intent = generatedPlans[0]?.intent
  const selectPlan = (planId: string) => {
    setSelected(planId)
    carouselRef.current?.querySelector<HTMLElement>(`[data-plan-id="${planId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }
  const syncSelectedPlan = () => {
    const carousel = carouselRef.current
    if (!carousel) return
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
    const available = readStoredPlans() ?? getDefaultGeneratedPlans()
    return available.find((item) => item.id === id) ?? available[0]
  })
  const [locked, setLocked] = useState<string[]>(() => {
    const museum = Object.values(activePlan.days).flat().find((place) => place.type.includes('展'))
    return museum ? [museum.id] : []
  })
  const [replaceId, setReplaceId] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [toast, setToast] = useState('')
  const currentPlaces = activePlan.days[day] ?? []
  const cityProfile = getCityProfile(activePlan.city)
  const guideContext = activePlan.guideContext
  const knowledge = activePlan.knowledge
  const selectedHotel = Object.values(activePlan.days).flat().find((place) => place.type === '住宿')
  const replacements = replaceId ? getReplacementCandidates(activePlan, replaceId) : []
  const replace = async (name: string) => {
    if (!replaceId) return
    setUpdating(true)
    try {
      const nextPlan = await aiService.replacePlace(activePlan, replaceId, name, () => undefined)
      setActivePlan(nextPlan)
      const stored = readStoredPlans() ?? []
      writeStoredPlans(stored.length > 0 ? stored.map((item) => item.id === nextPlan.id ? nextPlan : item) : [nextPlan])
      setReplaceId(null)
      setToast(nextPlan.validation.passed ? '已局部更新，其他地点没有改变' : '已局部更新，但有条件需要重新确认')
    } finally {
      setUpdating(false)
    }
  }
  const removePlace = (placeId: string) => {
    const nextDays = Object.fromEntries(Object.entries(activePlan.days).map(([key, places]) => [key, places.filter((place) => place.id !== placeId)])) as Record<string, GeneratedPlan['days'][string]>
    const nextPlan = updateGeneratedPlan(activePlan, nextDays)
    setActivePlan(nextPlan)
    const stored = readStoredPlans() ?? []
    writeStoredPlans(stored.length > 0 ? stored.map((item) => item.id === nextPlan.id ? nextPlan : item) : [nextPlan])
  }
  const budgetLimit = activePlan.budgetLimit ?? activePlan.budget
  const remaining = Math.max(0, budgetLimit - activePlan.budget)
  const routeStatus = activePlan.validation.passed
    ? activePlan.intent.missing.length > 0 ? '已生成完整可编辑草案，锚点信息仍需复核' : activePlan.city === '上海' ? '结构化时间与预算检查通过，出行前仍需复核' : '完整时间轴已生成，真实 POI 与路线待复核'
    : '仍有待确认项，暂不宣称可直接执行'
    return <AppShell><ZouNavigationBar title={activePlan.label} right={<button className="icon-button" aria-label="分享方案"><Share2 /></button>} /><div className="page-content plan-detail"><header><h1>{activePlan.city}{activePlan.nights + 1}天{activePlan.nights}晚</h1><p>{activePlan.pace} · 计划约 ¥{activePlan.budget} · {routeStatus}</p><ZouAvatarStack friends={friends} /></header><ZouDaySelector day={day} onChange={setDay} /><ZouSegmentedControl options={['时间轴', '地图']} value={view} onChange={setView} />{view === '时间轴' ? <div className="timeline-list">{currentPlaces.map((place) => <ZouPlaceCard key={place.id} place={place} locked={locked.includes(place.id)} onLock={() => setLocked((items) => items.includes(place.id) ? items.filter((item) => item !== place.id) : [...items, place.id])} onReplace={() => setReplaceId(place.id)} onDelete={() => removePlace(place.id)} onMore={() => setToast('更多操作已收起，向左滑动可删除或复制地点')} />)}</div> : <div className="mini-map"><RealRouteMap center={cityProfile.mapCenter} places={currentPlaces} progress={0} compact /><svg viewBox="0 0 340 390" aria-label="路线预览地图"><path d="M42 320 C70 230 125 285 154 194 S255 142 298 48" /><g>{currentPlaces.map((place, index) => <g key={place.id} transform={`translate(${42 + index * (256 / Math.max(1, currentPlaces.length - 1))} ${320 - index * (272 / Math.max(1, currentPlaces.length - 1))})`}><circle r="11" /><text y="-18" textAnchor="middle">{place.name}</text></g>)}</g></svg></div>}<section className="trip-logistics"><h2>行程条件</h2><div className="trip-logistics__row"><Building2 /><div><strong>{selectedHotel ? '已按预算选择住宿档位' : activePlan.intent.hotel ? '住宿已锁定' : '住宿待确认'}</strong><small>{selectedHotel?.name ?? activePlan.intent.hotel ?? '请补充酒店位置'} · 连住 {activePlan.nights} 晚</small></div><Lock aria-label="已锁定" /></div><div className="trip-logistics__row"><ExternalLink /><div><strong>第三方预订信息</strong><small>最终价格与库存以第三方平台为准。</small></div><button onClick={() => setToast('将跳转到第三方平台查看实时信息')}>查看说明</button></div></section>{knowledge ? <section className="knowledge-card"><div><span>城市攻略包</span><strong>{knowledge.city} · {knowledge.status === 'curated' ? '事实层已整理' : '候选层待核验'}</strong></div><p>{knowledge.intro}</p><div className="knowledge-hotels">{knowledge.hotelOptions.map((hotel) => <span key={hotel.id}>{hotel.tier === 'budget' ? '经济' : hotel.tier === 'comfort' ? '舒适' : '高星'} ¥{hotel.nightly.min}–{hotel.nightly.max}/晚</span>)}</div></section> : null}{guideContext && guideContext.candidates.length > 0 ? <section className="missing-card"><h2>参考的社区攻略</h2><p>这套方案参考了 {guideContext.candidates.length} 条{guideContext.city}小红书线索，仅用于体验候选和节奏排序。</p><ul>{guideContext.candidates.slice(0, 3).map((guide) => <li key={guide.id}><a href={guide.sourceUrl} target="_blank" rel="noreferrer">{guide.title}</a><small>{guide.author} · {guide.placeHints.slice(0, 3).join('、') || '体验线索'}</small></li>)}</ul><p>{guideContext.disclaimer}</p></section> : null}<section className="budget-card"><div><span>预算上限</span><strong>¥{budgetLimit}</strong></div><dl><div><dt>住宿</dt><dd>¥{activePlan.budgetBreakdown.lodging}</dd></div><div><dt>餐饮</dt><dd>¥{activePlan.budgetBreakdown.meals}</dd></div><div><dt>交通</dt><dd>¥{activePlan.budgetBreakdown.transport}</dd></div><div><dt>门票</dt><dd>¥{activePlan.budgetBreakdown.tickets}</dd></div><div><dt>咖啡</dt><dd>¥{activePlan.budgetBreakdown.coffee}</dd></div><div><dt>缓冲</dt><dd>¥{activePlan.budgetBreakdown.buffer}</dd></div><div><dt>剩余</dt><dd>¥{remaining}</dd></div></dl></section><ZouButton onClick={() => navigate('/travel/friends')}>邀请朋友一起决定</ZouButton></div><ZouBottomSheet open={Boolean(replaceId)} onClose={() => setReplaceId(null)} title="替换这个地点">{updating ? <div className="sheet-bot"><ZouMotionBot state="updating" label="Bloub / Grok Bot" /><p>重新检查前后路程</p></div> : <div className="replacement-list">{replacements.map((item) => <button key={item.name} onClick={() => replace(item.name)}><div><strong>{item.name}</strong><span>{item.meta}</span><p>{item.reason}</p></div><span>替换</span></button>)}</div>}</ZouBottomSheet>{toast ? <ZouToast message={toast} onClose={() => setToast('')} /> : null}</AppShell>
}
export const FriendsPage = () => {
  const navigate = useNavigate()
  const [invite, setInvite] = useState(false)
  const [accepted, setAccepted] = useState(false)
  return <AppShell><ZouNavigationBar title="朋友" right={<button className="text-button" onClick={() => setInvite(true)}>邀请</button>} /><div className="page-content friends-page"><header><h1>和朋友一起决定</h1><p>意见表控制在 30 秒内，AI 只总结共识和冲突。</p></header><section className="friend-list">{friends.map((friend, index) => { const isAccepted = friend.status === 'accepted' || (friend.status === 'pending' && accepted); return <article key={friend.id}><ZouAvatar src={friend.image} name={friend.name} muted={!isAccepted} /><div><strong>{friend.name}</strong><small>{index === 0 ? '发起人' : '已填写意见'}</small></div><FriendStatus accepted={isAccepted} /></article> })}</section>{!accepted ? <ZouButton variant="secondary" onClick={() => setAccepted(true)}>确认安安已接受</ZouButton> : null}<section className="opinion-summary"><span>AI 总结</span><h2>4 位朋友已提交</h2><ul><li>3 人希望行程松弛</li><li>1 人不吃海鲜</li><li>3 人希望去外滩</li></ul><div className="conflict"><strong>有 1 项需要协调</strong><p>安安希望加入夜景，但周周希望第二天更早结束。</p></div></section><div className="floating-cta"><ZouButton onClick={() => navigate('/travel/vote')}>进入方案投票</ZouButton></div></div><ZouBottomSheet open={invite} onClose={() => setInvite(false)} title="邀请朋友"><button className="sheet-action"><Link2 /><span><strong>分享链接</strong><small>复制邀请链接</small></span></button><button className="sheet-action"><QrCode /><span><strong>二维码</strong><small>面对面扫描加入</small></span></button></ZouBottomSheet></AppShell>
}

export const VotePage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const selectedVote = useAppStore((s) => s.vote)
  const setVote = useAppStore((s) => s.setVote)
  const setTripMode = useAppStore((s) => s.setTripMode)
  const setCity = useAppStore((s) => s.setCity)
  const setTripCity = useAppStore((s) => s.setTripCity)
  const [ended, setEnded] = useState(searchParams.get('complete') === '1')
  const votePlans = useMemo(() => readStoredPlans() ?? fallbackPlans, [])
  const voteCounts = useMemo(() => votePlans.map((plan, index) => ({ ...plan, count: [3, 2, 1][index] + (selectedVote === plan.id ? 1 : 0) })), [selectedVote, votePlans])
  return <AppShell><ZouNavigationBar title="方案投票" /><div className="page-content vote-page"><header><h1>{ended ? '投票结果' : '每位朋友 1 票'}</h1><p>{ended ? '「最匹配」获得最多票。' : '选择最适合大家的一套走法。'}</p></header><div className="vote-list">{voteCounts.map((plan) => <button key={plan.id} aria-pressed={selectedVote === plan.id} onClick={() => !ended && setVote(plan.id)}><span className="vote-radio">{selectedVote === plan.id ? <Check /> : null}</span><div><strong>{plan.label}</strong><small>{plan.difference}</small></div><b>{plan.count} 票</b></button>)}</div>{!ended ? <ZouButton variant="secondary" onClick={() => setEnded(true)}>结束投票</ZouButton> : <ZouButton onClick={() => { const chosen = votePlans.find((plan) => plan.id === (selectedVote ?? 'match')) ?? votePlans[0]; const chosenCity = (chosen && 'city' in chosen && typeof chosen.city === 'string' ? chosen.city : '上海'); setTripCity(chosenCity); setCity(chosenCity); setTripMode('active'); navigate('/trips') }}>保存行程</ZouButton>}<p className="privacy-note">如果同票，会保留并列方案供你二选一。</p></div></AppShell>
}
