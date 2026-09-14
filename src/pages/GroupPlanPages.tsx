import { FormDateTime } from '../components/FormDateTime'
import { useEffect, useState, type FormEvent } from 'react'
import { Check, Clock3, Copy, MapPin, Share2, UsersRound } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { RealRouteMap } from '../components/RealRouteMap'
import { ZouAvatar, ZouButton, ZouNavigationBar, ZouToast } from '../components/ui'
import { useAppStore } from '../stores/appStore'
import { track } from '../services/analytics'
import { getGroupPlanUserId, groupPlanApi, GroupPlanApiError } from '../services/groupPlanApi'
import type { GroupPlan, GroupPlanJoinInput, GroupPlanType, Poll } from '../services/groupPlans'
import { getShareUrl } from '../services/share'
import { saveGroupTrip } from '../services/trip/groupTrip'

const titleFor = (type: GroupPlanType) => type === 'travel' ? '旅行协作' : type === 'weekend' ? '周末' : type === 'date' ? '约会' : '聚餐'
const activityPreferences = ['散步', '看展', '咖啡', '夜景', '拍照', '逛街', '公园', '运动']
const foodPreferences = ['火锅', '烧烤', '日料', '本地小吃', '不吃海鲜', '不吃辣', '素食', '不忌口']

function ToggleList({ options, value, onChange }: { options: readonly string[]; value: string[]; onChange: (value: string[]) => void }) {
  return <div className="group-toggle-list">{options.map((option) => <button type="button" className={value.includes(option) ? 'is-selected' : ''} key={option} onClick={() => onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option])}>{option}</button>)}</div>
}

function voteSummary(poll: Poll) {
  const counts = Object.fromEntries(poll.options.map((option) => [option.id, 0])) as Record<string, number>
  Object.values(poll.votes).flat().forEach((optionId) => { if (counts[optionId] !== undefined) counts[optionId] += 1 })
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  return { counts, total, leaders: poll.options.filter((option) => !option.metadata.blockedReason && counts[option.id] === Math.max(...poll.options.filter(item => !item.metadata.blockedReason).map(item => counts[item.id]))) }
}

function PollCard({ plan, poll, participantId, isOwner, refresh }: { plan: GroupPlan; poll: Poll; participantId?: string; isOwner: boolean; refresh: (action: () => Promise<GroupPlan>) => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const { counts, total, leaders } = voteSummary(poll)
  const mine = participantId ? poll.votes[participantId] ?? [] : []; const deadline = poll.deadline ? new Date(poll.deadline).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' }) : null
  const submitVote = async (optionId: string) => { if (!participantId || poll.status !== 'open') return; setBusy(true); setError(''); try { const optionIds = poll.type === 'multiple' ? (mine.includes(optionId) ? mine.filter((item) => item !== optionId) : [...mine, optionId].slice(-poll.maxSelections)) : mine.includes(optionId) ? [] : [optionId]; await refresh(() => groupPlanApi.vote(plan.id, poll.id, participantId, optionIds)); track(mine.length ? 'poll_vote_changed' : 'poll_vote', { type: plan.type }) } catch (reason) { setError(reason instanceof Error ? reason.message : '投票未能保存。') } finally { setBusy(false) } }
  const close = () => refresh(() => groupPlanApi.close(plan.id, poll.id, plan.ownerId))
  const resolve = async (optionId: string) => { await refresh(() => groupPlanApi.resolve(plan.id, poll.id, plan.ownerId, optionId, plan.revision ?? 1)); track('poll_resolved', { type: plan.type }); if (poll.type === 'time' || plan.type !== 'dining') track('journey_generated_from_poll', { type: plan.type }) }
  const reopen = () => refresh(() => groupPlanApi.reopen(plan.id, poll.id, plan.ownerId))
  return <section className="poll-card"><header><div><span>{poll.status === 'open' ? '选择偏好' : poll.status === 'closed' ? '等待确认' : '已选定'}</span><h2>{poll.title}</h2></div><small><UsersRound /> {Object.keys(poll.votes).length} / {plan.participants.filter((item) => item.inviteStatus === 'accepted').length} 人已投</small></header>{deadline ? <p className="poll-deadline"><Clock3 /> 截止：{deadline}</p> : null}<div className="poll-options">{poll.options.map((option) => { const count = counts[option.id]; const percent = total ? Math.round(count / total * 100) : 0; const selected = mine.includes(option.id); return <button key={option.id} type="button" disabled={busy || poll.status !== 'open' || !participantId || Boolean(option.metadata.blockedReason)} className={`poll-option ${selected ? 'is-selected' : ''}`} onClick={() => void submitVote(option.id)}><span className="poll-option__check">{selected ? <Check /> : null}</span><span className="poll-option__copy"><strong>{option.title}</strong><small>{option.subtitle}</small><em>{option.metadata.blockedReason ?? option.metadata.reason}</em></span><span className="poll-option__score"><strong>{count}票 · {percent}%</strong><i style={{ width: `${percent}%` }} /></span></button> })}</div>{poll.options.every(option => option.metadata.blockedReason) ? <p role="status">当前候选均不符合成员饮食限制，请补充可接受的候选后重新投票。</p> : null}{error ? <p className="group-error" role="alert">{error}</p> : null}{!participantId ? <p className="group-muted">加入计划后即可投票。</p> : null}{isOwner && poll.status === 'open' ? <button type="button" className="group-text-button" onClick={() => void close()}>截止投票</button> : null}{isOwner && poll.status === 'closed' && poll.type === 'multiple' ? <div className="poll-resolution"><p>偏好已收集，成员仍可继续参加其他投票。</p><button type="button" className="group-text-button" onClick={() => void reopen()}>重新开启一轮</button></div> : null}{isOwner && poll.status === 'closed' && poll.type !== 'multiple' ? <div className="poll-resolution">{leaders.length > 1 && total > 0 ? <p>目前平票。请选择重新开启投票，或由组织者明确最终方案。</p> : <p>投票已结束，确认后将应用最终方案并更新行程版本。</p>}<div>{leaders.map((option) => <button key={option.id} type="button" onClick={() => void resolve(option.id)}>确定「{option.title}」</button>)}</div><button type="button" className="group-text-button" onClick={() => void reopen()}>重新开启一轮</button></div> : null}{poll.status === 'resolved' ? <p className="poll-resolved">结果已锁定，成员现在可以查看更新后的行程。</p> : null}</section>
}

function JourneyCard({ plan }: { plan: GroupPlan }) {
  const navigate = useNavigate(); const journey = plan.journey; const [saveError, setSaveError] = useState('')
  const openTrip = () => { try { const saved = saveGroupTrip(plan, true)!; useAppStore.setState({ activeRouteId: saved.tripId, tripCity: saved.city }); navigate(`/trips/${saved.tripId}`) } catch (error) { setSaveError(error instanceof Error ? error.message : '保存失败，请重试。') } }
  if(plan.type==='travel'&&plan.trip)return <section className="group-journey"><header><h2>共同日程</h2><p>{Object.keys(plan.trip.days).length}天安排 · {plan.trip.partySize}人同行</p></header><ZouButton onClick={openTrip}>打开共同日程</ZouButton>{saveError?<p role="alert">{saveError}</p>:null}</section>
  if (!journey) return null
  return <section className="group-journey"><header><span>已确定的安排</span><h2>{journey.title}</h2><p>地点顺序已确定；打开某一站的地图即可查看真实道路和导航。</p></header><RealRouteMap city={plan.city} places={journey.stops} compact /><div className="group-journey__stops">{journey.stops.map((stop) => <div key={stop.id}><time>{stop.time}</time><span><strong>{stop.name}</strong><small>{stop.type} · {stop.note}</small></span></div>)}</div><ZouButton onClick={openTrip}>{plan.candidates ? '保存并打开攻略' : '打开共同日程'}</ZouButton>{saveError ? <p role="alert">{saveError}</p> : null}</section>
}

export const GroupPlanDetailPage = () => {
  const { planId = '' } = useParams(); const navigate = useNavigate(); const userId = getGroupPlanUserId(); const [plan, setPlan] = useState<GroupPlan | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const nickname = useAppStore((state) => state.nickname); const avatar = useAppStore((state) => state.avatar)
  const load = async () => { setLoading(true); try { setPlan(await groupPlanApi.get(planId)); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : '无法读取计划。') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [planId])
  useEffect(() => { if (!planId) return; return groupPlanApi.subscribe(planId, (event) => setPlan(event.plan), () => undefined) }, [planId])
  useEffect(()=>{if(plan?.type==='travel'&&plan.trip){try{saveGroupTrip(plan)}catch(cause){setError(String(cause))}}},[plan])
  const me = plan?.participants.find((participant) => participant.userId === userId && participant.inviteStatus === 'accepted')
  const refresh = async (action: () => Promise<GroupPlan>) => { try { setPlan(await action()); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : '操作没有保存。') } }
  const [message, setMessage] = useState('')
  const invite = async () => {
    if (!plan) return
    const url = getShareUrl(`/group-plans/invite/${plan.inviteCode}`)
    try {
      if (navigator.share) { await navigator.share({ title: `加入${plan.title}`, text: '打开走走，告诉我你想做什么、想吃什么。', url }); setMessage('已交给系统分享，尚未确认对方收到或加入') }
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); setMessage('邀请链接已复制') }
      else setMessage(url)
      track('invite_sent', { type: plan.type })
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      try { await navigator.clipboard.writeText(url); setMessage('系统分享不可用，邀请链接已复制'); track('invite_sent', { type: plan.type }) }
      catch { setMessage(`请复制这个链接：${url}`) }
    }
  }
  const join = () => plan && refresh(() => groupPlanApi.join(plan.inviteCode, { userId, displayName: nickname, avatar }))
  if (loading) return <AppShell><ZouNavigationBar title="计划" /><div className="page-content group-loading">正在加载计划…</div></AppShell>
  if (!plan) return <AppShell><ZouNavigationBar title="计划" /><div className="page-content group-loading">{error}<ZouButton onClick={() => navigate('/home')}>回到首页</ZouButton></div></AppShell>
  if (plan.candidates) return <AppShell><ZouNavigationBar title={`${titleFor(plan.type)}攻略`} /><main className="page-content group-plan"><header className="group-plan__hero"><h1>{plan.title}</h1><p>{plan.date} · {plan.startTime}–{plan.endTime} · {plan.partySize}人</p></header><JourneyCard plan={plan} /></main></AppShell>
  const isOwner = plan.ownerId === me?.id
  const addCuisinePoll = async () => { await refresh(() => groupPlanApi.createPoll(plan.id, plan.ownerId, { title: '哪些菜系你都可以？', type: 'multiple', options: ['火锅', '烧烤', '日料', '中餐', '西餐'], maxSelections: 3 })); track('poll_created', { type: plan.type }) }
  const submittedPreferences = plan.participants.filter((participant) => participant.role === 'member' && participant.inviteStatus === 'accepted' && (participant.activityPreferences?.length || participant.foodPreferences?.length || participant.note))
  return <AppShell><ZouNavigationBar title={titleFor(plan.type)} /><main className="page-content group-plan"><header className="group-plan__hero"><span>{plan.type === 'dining' ? '多人真实投票' : '已生成候选'}</span><h1>{plan.title}</h1><p><MapPin /> {plan.city} · {plan.trip?.dates?`${plan.trip.dates.start}—${plan.trip.dates.end}`:plan.date} · {plan.startTime||'时间待确认'} 开始</p><div><span>计划{plan.partySize} 人</span><span>{plan.budget ? `¥${plan.budget}${plan.type === 'dining' ? '/人' : ''}` : '预算待定'}</span><span>{plan.interests.join(' · ')}</span></div></header><section className="group-members"><header><div><span>参与成员</span><h2>{plan.participants.filter((item) => item.inviteStatus === 'accepted').length} 人已加入</h2></div><button type="button" onClick={() => void invite()}><Share2 /> 邀请</button></header><div className="group-member-list">{plan.participants.filter((item) => item.inviteStatus === 'accepted').map((participant) => <article className="group-member" key={participant.id}><span className="group-member__avatar">{participant.avatar ? <img src={participant.avatar} alt="" /> : participant.displayName.slice(0, 1)}</span><div><strong>{participant.displayName}</strong><small>{participant.role === 'owner' ? '组织者' : '已加入'}</small></div></article>)}</div>{!me ? <ZouButton onClick={() => void join()}>加入并参与投票</ZouButton> : null}{isOwner && plan.type === 'dining' && !plan.polls.some((poll) => poll.type === 'multiple') ? <button type="button" className="group-text-button" onClick={() => void addCuisinePoll()}>先收集大家能接受的菜系</button> : null}</section>{submittedPreferences.length ? <section className="group-preferences"><header><span>朋友偏好</span><h2>已收到的想法</h2></header>{submittedPreferences.map((participant) => <article key={participant.id}><strong>{participant.displayName}</strong>{participant.activityPreferences?.length ? <p>想做：{participant.activityPreferences.join('、')}</p> : null}{participant.foodPreferences?.length ? <p>想吃 / 忌口：{participant.foodPreferences.join('、')}</p> : null}{participant.note ? <p>补充：{participant.note}</p> : null}</article>)}</section> : null}{plan.polls.map((poll) => <PollCard key={poll.id} plan={plan} poll={poll} participantId={me?.id} isOwner={isOwner} refresh={refresh} />)}<JourneyCard plan={plan} />{error ? <p className="group-error" role="alert">{error}</p> : null}{message ? <ZouToast message={message} onClose={() => setMessage('')} /> : null}</main></AppShell>
}

export const GroupPlanInvitePage = () => {
  const { code = '' } = useParams(); const navigate = useNavigate(); const userId = getGroupPlanUserId(); const nickname = useAppStore((state) => state.nickname); const avatar = useAppStore((state) => state.avatar); const [plan, setPlan] = useState<GroupPlan | null>(null); const [error, setError] = useState(''); const [joining, setJoining] = useState(false); const [displayName, setDisplayName] = useState(nickname); const [activities, setActivities] = useState<string[]>([]); const [foods, setFoods] = useState<string[]>([]); const [note, setNote] = useState('')
  useEffect(() => { groupPlanApi.getInvite(code).then(setPlan).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '邀请链接无法打开。')) }, [code])
  const join = async (event: FormEvent) => { event.preventDefault(); setJoining(true); setError(''); const input: GroupPlanJoinInput = { userId, displayName: displayName.trim() || nickname, avatar, activityPreferences: activities, foodPreferences: foods, note: note.trim() || undefined }; try { const next = await groupPlanApi.join(code, input); track('participant_joined', { type: next.type }); navigate(`/group-plans/${next.id}`) } catch (reason) { setError(reason instanceof Error ? reason.message : '偏好没有保存，请稍后重试。') } finally { setJoining(false) } }
  const loginPath = `/login?next=${encodeURIComponent(`/group-plans/invite/${code}`)}`
  const owner = plan?.participants.find((participant) => participant.role === 'owner')
  return <AppShell><ZouNavigationBar title="邀请" /><main className="page-content group-invite">{plan ? <><section className="group-invite__hero"><span>朋友邀请你一起决定</span><div className="group-invite__owner"><ZouAvatar src={owner?.avatar ?? '/assets/date.jpg'} name={owner?.displayName ?? '发起人'} size="sm" /><span><small>发起人</small><strong>{owner?.displayName ?? '发起人'}</strong></span></div><h1>{plan.title}</h1><p>{plan.city} · {plan.trip?.dates?`${plan.trip.dates.start}—${plan.trip.dates.end}`:plan.date} · {plan.startTime||'到达待定'}–{plan.endTime||'返程待定'}</p><p>这趟计划已有 {plan.participants.filter((item) => item.inviteStatus === 'accepted').length} 人加入，告诉发起人你想怎么走。</p></section><form className="group-invite__form" onSubmit={(event) => void join(event)}><section className="group-form-section"><strong>提交你的偏好</strong><p className="group-muted">填完后会直接加入这次计划，发起人可以据此安排路线。</p><label>你的名字<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} required /></label><label>想做什么<ToggleList options={activityPreferences} value={activities} onChange={setActivities} /></label><label>想吃什么 / 有什么忌口<ToggleList options={foodPreferences} value={foods} onChange={setFoods} /></label><label>补充说明 <small>可选</small><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="例如：想留一点时间喝咖啡，不想排队太久。" /></label></section>{error ? <p className="group-error" role="alert">{error}</p> : null}<ZouButton type="submit" disabled={joining}>{joining ? '正在加入并保存…' : '提交偏好并加入'}</ZouButton><button type="button" className="group-text-button group-invite__login" onClick={() => navigate(loginPath)}>已有账号？登录后继续</button></form></> : <p className="group-error">{error || '正在读取邀请…'}</p>}</main></AppShell>
}
