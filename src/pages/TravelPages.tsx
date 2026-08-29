import { useEffect, useMemo, useState } from 'react'
import { Building2, ExternalLink, ImagePlus, Link2, Lock, QrCode, Share2, X } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import {
  Check, FriendStatus, ZouAvatar, ZouAvatarStack, ZouBottomSheet, ZouButton, ZouDaySelector,
  ZouMotionBot, ZouNavigationBar, ZouPlaceCard, ZouPlanCard, ZouSegmentedControl, ZouToast,
} from '../components/ui'
import { aiService, type AIStage } from '../services/ai'
import { friends, plans as fallbackPlans } from '../demo-data/trips'
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
  const [screenshots, setScreenshots] = useState<TripMedia[]>([
    { id: 'guide', src: '/assets/wukang-road.jpg', name: '武康路攻略', category: '攻略' },
    { id: 'cafe', src: '/assets/coffee.jpg', name: '咖啡店收藏', category: '咖啡' },
    { id: 'hotel', src: '/assets/hotel.jpg', name: '静安寺附近酒店', category: '酒店' },
    { id: 'chat', src: '/assets/date.jpg', name: '返程时间聊天', category: '聊天' },
  ])
  const [dragging,setDragging]=useState<number|null>(null)
  const reorder=(from:number,to:number)=>{if(from===to)return;setScreenshots(items=>{const next=[...items],item=next.splice(from,1)[0];next.splice(to,0,item);return next})}
  return <AppShell><ZouNavigationBar title="创建旅行" /><div className="page-content travel-new"><header><h1>想去哪走走？</h1><p>一句话加几张截图，就能开始规划。</p></header><label className="trip-prompt"><span>旅行想法</span><textarea value={input} onChange={(event) => setInput(event.target.value)} /><small>{input.length}/500</small></label><section className="upload-section"><div className="section-title"><h2>旅行截图</h2><span>{screenshots.length} 张 · 长按排序</span></div><div className="screenshot-row">{screenshots.map((shot,index)=><article key={shot.id} draggable onDragStart={()=>setDragging(index)} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(dragging!==null)reorder(dragging,index);setDragging(null)}}><img src={shot.src} alt={`${shot.name}截图`} width={120} height={160} /><span>{shot.name}</span><button aria-label={`删除${shot.name}`} onClick={() => setScreenshots((items) => items.filter((item) => item.id !== shot.id))}><X /></button></article>)}<label className="add-screenshot"><ImagePlus /><span>添加</span><input type="file" multiple accept="image/*" onChange={(event) => { const files = Array.from(event.target.files ?? []); setScreenshots((items) => [...items, ...files.map((file) => ({ id: `${file.name}-${file.lastModified}`, src: URL.createObjectURL(file), name: file.name, category: '上传截图' }))]) }} /></label></div></section><ZouButton onClick={() => { sessionStorage.setItem(TRIP_INPUT_STORAGE, input); sessionStorage.setItem(TRIP_MEDIA_STORAGE, JSON.stringify(screenshots)); sessionStorage.removeItem(TRIP_PLANS_STORAGE); navigate('/travel/understanding') }}>帮我看看</ZouButton></div></AppShell>
}

const understandingSteps: Record<AIStage, string> = {
  listening: '正在理解你的旅行', reading: '正在读取截图', thinking: '整理地点', planning: '检查路线与天气', done: '正在生成方案', updating: '正在局部更新', success: '理解完成', error: '理解没有完成',
}
const understandingStepOrder: AIStage[] = ['listening', 'reading', 'thinking', 'planning', 'done']

export const UnderstandingPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [stage, setStage] = useState<AIStage>('listening')
  const [label, setLabel] = useState('准备理解你的旅行')
  const [understanding, setUnderstanding] = useState<TripUnderstanding | null>(null)
  const [ready, setReady] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (searchParams.get('error') === '1') {
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
  }, [searchParams])
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
  return <AppShell><ZouNavigationBar title="理解旅行" /><div className="page-content understanding-page"><div className="bot-stage"><ZouMotionBot state={stage === 'error' ? 'error' : stage} /><h1>{planning ? '正在生成 3 套方案' : ready ? '这是我理解的旅行' : error ? '这次没有理解完成' : '正在理解你的旅行'}</h1><p aria-live="polite">{error || label}</p><div className="progress-steps">{['读取你的描述', `识别 ${mediaCount} 张截图`, '整理地点与偏好', '检查路线与天气', '生成可行方案'].map((item, index) => { const done = ready || index <= understandingStepOrder.indexOf(stage); return <span key={item} className={done ? 'is-done' : ''}>{done ? <Check /> : <i />}{item}</span> })}</div></div>{ready && !planning && intent ? <><section className="understanding-card"><div className="understanding-card__top"><div><span>目的地</span><strong>{intent.destination}</strong></div><div><span>行程</span><strong>{intent.durationDays} 天 {intent.nights} 晚</strong></div><div><span>朋友</span><strong>{intent.partySize} 人</strong></div><div><span>预算</span><strong>{intent.budget ? `¥${intent.budget}` : '待确认'}</strong></div></div><dl><div><dt>节奏</dt><dd>{paceLabel(intent.pace)}</dd></div><div><dt>必去</dt><dd>{intent.mustVisit.length > 0 ? intent.mustVisit.join(' · ') : '暂未识别'}</dd></div><div><dt>偏好</dt><dd>{intent.preferences.length > 0 ? intent.preferences.join(' · ') : '暂未识别'}</dd></div></dl></section><section className="missing-card"><h2>{intent.missing.length > 0 ? `还有 ${intent.missing.length} 项需要确认` : '关键条件已确认'}</h2>{intent.missing.length > 0 ? <ul>{intent.missing.map((item) => <li key={item}>{item}</li>)}</ul> : <p>日期、到达、返程、住宿和预算已经作为排程约束。</p>}</section><ZouButton onClick={startPlanning}>开始规划</ZouButton></> : null}{error ? <ZouButton onClick={() => navigate('/travel/new')}>返回修改输入</ZouButton> : null}</div></AppShell>
}

export const PlansPage = () => {
  const navigate = useNavigate()
  const [selected, setSelected] = useState('match')
  const generatedPlans = useMemo(() => readStoredPlans() ?? getDefaultGeneratedPlans(), [])
  const intent = generatedPlans[0]?.intent
  return <AppShell><ZouNavigationBar title="选择方案" /><div className="plans-page"><header className="page-header"><h1>选择一种走法</h1><p>{intent ? `${intent.destination} · ${intent.durationDays} 天 · 同一批真实需求，只调整节奏、移动与体验密度。` : '三套方案使用同一批真实需求，只调整节奏、移动与体验密度。'}</p></header><div className="plans-carousel">{generatedPlans.map((plan) => <ZouPlanCard key={plan.id} plan={plan} selected={selected === plan.id} onSelect={() => setSelected(plan.id)} onOpen={() => navigate(`/travel/plan/${plan.id}`)} />)}</div><div className="plans-dots" aria-label="方案页码">{generatedPlans.map((plan) => <button key={plan.id} aria-label={plan.label} aria-current={selected === plan.id ? 'true' : undefined} onClick={() => setSelected(plan.id)} />)}</div></div></AppShell>
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
  return <AppShell><ZouNavigationBar title={activePlan.label} right={<button className="icon-button" aria-label="分享方案"><Share2 /></button>} /><div className="page-content plan-detail"><header><h1>{activePlan.city}{activePlan.nights + 1}天{activePlan.nights}晚</h1><p>{activePlan.pace} · 计划约 ¥{activePlan.budget} · {activePlan.validation.passed ? '时间与预算已校验' : '仍有待确认项'}</p><ZouAvatarStack friends={friends} /></header><ZouDaySelector day={day} onChange={setDay} /><ZouSegmentedControl options={['时间轴', '地图']} value={view} onChange={setView} />{view === '时间轴' ? <div className="timeline-list">{currentPlaces.map((place) => <ZouPlaceCard key={place.id} place={place} locked={locked.includes(place.id)} onLock={() => setLocked((items) => items.includes(place.id) ? items.filter((item) => item !== place.id) : [...items, place.id])} onReplace={() => setReplaceId(place.id)} onDelete={() => removePlace(place.id)} />)}</div> : <div className="mini-map"><svg viewBox="0 0 340 390" aria-label="抽象路线地图"><path d="M42 320 C70 230 125 285 154 194 S255 142 298 48" /><g>{currentPlaces.map((place, index) => <g key={place.id} transform={`translate(${42 + index * (256 / Math.max(1, currentPlaces.length - 1))} ${320 - index * (272 / Math.max(1, currentPlaces.length - 1))})`}><circle r="11" /><text y="-18" textAnchor="middle">{place.name}</text></g>)}</g></svg></div>}<section className="trip-logistics"><h2>行程条件</h2><div className="trip-logistics__row"><Building2 /><div><strong>{activePlan.intent.hotel ? '住宿已锁定' : '住宿待确认'}</strong><small>{activePlan.intent.hotel ?? '请补充酒店位置'} · 连住 {activePlan.nights} 晚</small></div><Lock aria-label="已锁定" /></div><div className="trip-logistics__row"><ExternalLink /><div><strong>第三方预订信息</strong><small>本地执行器不提供支付或实时库存</small></div><button onClick={() => setToast('第三方跳转仅为演示，尚未接入真实服务')}>查看说明</button></div></section><section className="budget-card"><div><span>预算上限</span><strong>¥{budgetLimit}</strong></div><dl><div><dt>住宿</dt><dd>¥{activePlan.budgetBreakdown.lodging}</dd></div><div><dt>餐饮</dt><dd>¥{activePlan.budgetBreakdown.meals}</dd></div><div><dt>交通</dt><dd>¥{activePlan.budgetBreakdown.transport}</dd></div><div><dt>门票</dt><dd>¥{activePlan.budgetBreakdown.tickets}</dd></div><div><dt>咖啡</dt><dd>¥{activePlan.budgetBreakdown.coffee}</dd></div><div><dt>缓冲</dt><dd>¥{activePlan.budgetBreakdown.buffer}</dd></div><div><dt>剩余</dt><dd>¥{remaining}</dd></div></dl></section><ZouButton onClick={() => navigate('/travel/friends')}>邀请朋友一起决定</ZouButton></div><ZouBottomSheet open={Boolean(replaceId)} onClose={() => setReplaceId(null)} title="替换这个地点">{updating ? <div className="sheet-bot"><ZouMotionBot state="updating" /><p>重新检查前后路程</p></div> : <div className="replacement-list">{replacements.map((item) => <button key={item.name} onClick={() => replace(item.name)}><div><strong>{item.name}</strong><span>{item.meta}</span><p>{item.reason}</p></div><span>替换</span></button>)}</div>}</ZouBottomSheet>{toast ? <ZouToast message={toast} onClose={() => setToast('')} /> : null}</AppShell>
}

export const FriendsPage = () => {
  const navigate = useNavigate()
  const [invite, setInvite] = useState(false)
  const [accepted, setAccepted] = useState(false)
  return <AppShell><ZouNavigationBar title="朋友" right={<button className="text-button" onClick={() => setInvite(true)}>邀请</button>} /><div className="page-content friends-page"><header><h1>和朋友一起决定</h1><p>意见表控制在 30 秒内，AI 只总结共识和冲突。</p></header><section className="friend-list">{friends.map((friend, index) => { const isAccepted = friend.status === 'accepted' || (friend.status === 'pending' && accepted); return <article key={friend.id}><ZouAvatar src={friend.image} name={friend.name} muted={!isAccepted} /><div><strong>{friend.name}</strong><small>{index === 0 ? '发起人' : '已填写意见'}</small></div><FriendStatus accepted={isAccepted} /></article> })}</section>{!accepted ? <ZouButton variant="secondary" onClick={() => setAccepted(true)}>模拟安安接受邀请</ZouButton> : null}<section className="opinion-summary"><span>AI 总结</span><h2>4 位朋友已提交</h2><ul><li>3 人希望行程松弛</li><li>1 人不吃海鲜</li><li>3 人希望去外滩</li></ul><div className="conflict"><strong>有 1 项需要协调</strong><p>安安希望加入夜景，但周周希望第二天更早结束。</p></div></section><ZouButton onClick={() => navigate('/travel/vote')}>进入方案投票</ZouButton></div><ZouBottomSheet open={invite} onClose={() => setInvite(false)} title="邀请朋友"><button className="sheet-action"><Link2 /><span><strong>分享链接</strong><small>复制本地 Demo 邀请链接</small></span></button><button className="sheet-action"><QrCode /><span><strong>二维码</strong><small>面对面扫描加入</small></span></button></ZouBottomSheet></AppShell>
}

export const VotePage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const selectedVote = useAppStore((s) => s.vote)
  const setVote = useAppStore((s) => s.setVote)
  const setTripMode = useAppStore((s) => s.setTripMode)
  const [ended, setEnded] = useState(searchParams.get('complete') === '1')
  const votePlans = useMemo(() => readStoredPlans() ?? fallbackPlans, [])
  const voteCounts = useMemo(() => votePlans.map((plan, index) => ({ ...plan, count: [3, 2, 1][index] + (selectedVote === plan.id ? 1 : 0) })), [selectedVote, votePlans])
  return <AppShell><ZouNavigationBar title="方案投票" /><div className="page-content vote-page"><header><h1>{ended ? '投票结果' : '每位朋友 1 票'}</h1><p>{ended ? '「最匹配」获得最多票。' : '票数会在这个本地 Demo 中即时更新。'}</p></header><div className="vote-list">{voteCounts.map((plan) => <button key={plan.id} aria-pressed={selectedVote === plan.id} onClick={() => !ended && setVote(plan.id)}><span className="vote-radio">{selectedVote === plan.id ? <Check /> : null}</span><div><strong>{plan.label}</strong><small>{plan.difference}</small></div><b>{plan.count} 票</b></button>)}</div>{!ended ? <ZouButton variant="secondary" onClick={() => setEnded(true)}>结束投票</ZouButton> : <ZouButton onClick={() => { setTripMode('active'); navigate('/trips') }}>保存行程</ZouButton>}<p className="privacy-note">如果同票，系统会只保留并列方案进行二选一。</p></div></AppShell>
}
