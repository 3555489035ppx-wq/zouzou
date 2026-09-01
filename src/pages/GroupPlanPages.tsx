import { useEffect, useMemo, useState } from 'react'
import { Check, Clock3, Copy, MapPin, Share2, UsersRound } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { RealRouteMap } from '../components/RealRouteMap'
import { ZouAvatar, ZouButton, ZouNavigationBar } from '../components/ui'
import { useAppStore } from '../stores/appStore'
import { track } from '../services/analytics'
import { getGroupPlanUserId, groupPlanApi, GroupPlanApiError } from '../services/groupPlanApi'
import type { GroupPlan, GroupPlanInput, GroupPlanType, Poll } from '../services/groupPlans'
import { friends } from '../demo-data/trips'

const scenario = {
  weekend: { title: '这个周末想怎么玩？', intro: '先选一个方向，其他细节可以慢慢补。', interests: ['随便走走', '喝咖啡', '看看展', '晒太阳', '拍照', '运动'], action: '生成候选计划' },
  date: { title: '想怎么约？', intro: '让路线自然一点，不赶，也留出聊天的余地。', interests: ['第一次约会', '吃饭聊天', '看展', '夜景', '散步', '纪念日'], action: '生成一起选的候选' },
  dining: { title: '这顿饭几个人？', intro: '先排除不合适的店，再让大家一起决定。', interests: ['火锅', '烧烤', '日料', '中餐', '西餐', '甜品'], action: '生成餐厅候选' },
} as const

const titleFor = (type: GroupPlanType) => type === 'weekend' ? '周末' : type === 'date' ? '约会' : '聚餐'
const dateTomorrow = () => { const value = new Date(); value.setDate(value.getDate() + 1); return value.toISOString().slice(0, 10) }

function ToggleList({ options, value, onChange }: { options: readonly string[]; value: string[]; onChange: (value: string[]) => void }) {
  return <div className="group-toggle-list">{options.map((option) => <button type="button" className={value.includes(option) ? 'is-selected' : ''} key={option} onClick={() => onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option])}>{option}</button>)}</div>
}

const datePartyOptions = [1, 2, 3, 4]

function DatePartyPicker({ value, onChange, members }: { value: number; onChange: (value: number) => void; members: { id: string; name: string; image: string }[] }) {
  return <fieldset className="group-people-picker"><legend>同行人数</legend><span className="group-people-picker__hint">已选 {value} 人 · 点击头像组合切换</span><div className="group-people-options" role="radiogroup" aria-label="同行人数">{datePartyOptions.map((count) => <button key={count} type="button" role="radio" aria-label={`${count}人`} aria-checked={value === count} className={`group-people-option ${value === count ? 'is-selected' : ''}`} onClick={() => onChange(count)}><span className="group-people-option__avatars" aria-hidden="true">{members.slice(0, count).map((member) => <ZouAvatar key={member.id} src={member.image} name={member.name} size="sm" />)}</span><strong>{count}人</strong></button>)}</div></fieldset>
}

export const GroupPlanCreatePage = ({ type }: { type: GroupPlanType }) => {
  const navigate = useNavigate(); const city = useAppStore((state) => state.city); const nickname = useAppStore((state) => state.nickname); const avatar = useAppStore((state) => state.avatar)
  const config = scenario[type]; const [interests, setInterests] = useState<string[]>(type === 'dining' ? ['火锅'] : type === 'date' ? ['吃饭聊天', '散步'] : ['喝咖啡', '看看展'])
  const partyMembers = [{ id: 'me', name: nickname, image: avatar }, ...friends.filter((friend) => friend.id !== 'xiaopeng')]
  const [form, setForm] = useState({ city, date: dateTomorrow(), startTime: type === 'dining' ? '19:00' : type === 'date' ? '18:00' : '14:00', endTime: type === 'dining' ? '22:00' : type === 'date' ? '22:00' : '18:00', budget: type === 'dining' ? 150 : type === 'date' ? 500 : 300, partySize: type === 'date' ? 2 : type === 'dining' ? 4 : 2, transportMode: '步行 + 地铁', avoidTags: '', deadline: '', dateStage: type === 'date' ? '日常约会' : '', indoorOutdoor: type === 'date' ? '室内外都可以' : '' })
  const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false)
  const update = (key: keyof typeof form, value: string | number) => setForm((current) => ({ ...current, [key]: value }))
  const create = async () => {
    setSubmitting(true); setError('')
    try {
      const input: GroupPlanInput = { type, city: form.city, date: form.date, startTime: form.startTime, endTime: form.endTime, budget: Number(form.budget), partySize: Number(form.partySize), interests, avoidTags: form.avoidTags.split(/[，,、]/).map((item) => item.trim()).filter(Boolean), transportMode: form.transportMode, deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined, dateStage: form.dateStage || undefined, indoorOutdoor: form.indoorOutdoor || undefined, owner: { userId: getGroupPlanUserId(), displayName: nickname, avatar } }
      const plan = await groupPlanApi.create(input); track(`${type}_create` as 'weekend_create', { partySize: plan.partySize }); track('group_plan_created', { type }); navigate(`/group-plans/${plan.id}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : '暂时无法生成候选，请重试。') } finally { setSubmitting(false) }
  }
  return <AppShell><ZouNavigationBar title={titleFor(type)} /><main className="page-content group-create"><header><span>{type === 'dining' ? '多人真实决策' : '从一个想法开始'}</span><h1>{config.title}</h1><p>{config.intro}</p></header><section className="group-form-section"><strong>先选方向</strong><ToggleList options={config.interests} value={interests} onChange={setInterests} /></section><section className="group-form-section group-form-section--details"><strong>安排一下时间与范围</strong><label>城市<input value={form.city} onChange={(event) => update('city', event.target.value)} /></label>{type === 'date' ? <><label>日期<input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} /></label><DatePartyPicker value={form.partySize} onChange={(value) => update('partySize', value)} members={partyMembers} /></> : <div><label>日期<input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} /></label><label>几个人<input type="number" min="1" max="100" value={form.partySize} onChange={(event) => update('partySize', event.target.value)} /></label></div>}<div><label>开始<input type="time" value={form.startTime} onChange={(event) => update('startTime', event.target.value)} /></label><label>结束<input type="time" value={form.endTime} onChange={(event) => update('endTime', event.target.value)} /></label></div><label>{type === 'dining' ? '人均预算' : '预算'}<input type="number" min="0" value={form.budget} onChange={(event) => update('budget', event.target.value)} /></label><label>投票截止 <small>可选</small><input type="datetime-local" value={form.deadline} onChange={(event) => update('deadline', event.target.value)} /></label>{type === 'date' ? <div><label>约会阶段<select value={form.dateStage} onChange={(event) => update('dateStage', event.target.value)}><option>第一次约会</option><option>日常约会</option><option>纪念日</option></select></label><label>室内 / 室外<select value={form.indoorOutdoor} onChange={(event) => update('indoorOutdoor', event.target.value)}><option>室内外都可以</option><option>偏室内</option><option>偏室外</option></select></label></div> : null}<label>不想要的事情 / 忌口 <small>可选，用逗号分隔</small><input placeholder={type === 'dining' ? '海鲜，辣，花生' : '太累，排队'} value={form.avoidTags} onChange={(event) => update('avoidTags', event.target.value)} /></label></section>{error ? <p className="group-error" role="alert">{error}</p> : null}<ZouButton disabled={submitting || !interests.length} onClick={() => void create()}>{submitting ? '正在检查地点与营业信息…' : config.action}</ZouButton></main></AppShell>
}

function voteSummary(poll: Poll) {
  const counts = Object.fromEntries(poll.options.map((option) => [option.id, 0])) as Record<string, number>
  Object.values(poll.votes).flat().forEach((optionId) => { if (counts[optionId] !== undefined) counts[optionId] += 1 })
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  return { counts, total, leaders: poll.options.filter((option) => counts[option.id] === Math.max(...Object.values(counts))) }
}

function PollCard({ plan, poll, participantId, isOwner, refresh }: { plan: GroupPlan; poll: Poll; participantId?: string; isOwner: boolean; refresh: (action: () => Promise<GroupPlan>) => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const { counts, total, leaders } = voteSummary(poll)
  const mine = participantId ? poll.votes[participantId] ?? [] : []; const deadline = poll.deadline ? new Date(poll.deadline).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' }) : null
  const submitVote = async (optionId: string) => { if (!participantId || poll.status !== 'open') return; setBusy(true); setError(''); try { const optionIds = poll.type === 'multiple' ? (mine.includes(optionId) ? mine.filter((item) => item !== optionId) : [...mine, optionId].slice(-poll.maxSelections)) : mine.includes(optionId) ? [] : [optionId]; await refresh(() => groupPlanApi.vote(plan.id, poll.id, participantId, optionIds)); track(mine.length ? 'poll_vote_changed' : 'poll_vote', { type: plan.type }) } catch (reason) { setError(reason instanceof Error ? reason.message : '投票未能保存。') } finally { setBusy(false) } }
  const close = () => refresh(() => groupPlanApi.close(plan.id, poll.id, plan.ownerId))
  const resolve = async (optionId: string) => { await refresh(() => groupPlanApi.resolve(plan.id, poll.id, plan.ownerId, optionId)); track('poll_resolved', { type: plan.type }); if (poll.type === 'time' || plan.type !== 'dining') track('journey_generated_from_poll', { type: plan.type }) }
  const reopen = () => refresh(() => groupPlanApi.reopen(plan.id, poll.id, plan.ownerId))
  return <section className="poll-card"><header><div><span>{plan.type === 'dining' ? '大家投一下' : plan.type === 'date' ? '一起选' : '一起选个周末计划'}</span><h2>{poll.title}</h2></div><small><UsersRound /> {Object.keys(poll.votes).length} / {plan.participants.filter((item) => item.inviteStatus === 'accepted').length} 人已投</small></header>{deadline ? <p className="poll-deadline"><Clock3 /> 截止：{deadline}</p> : null}<div className="poll-options">{poll.options.map((option) => { const count = counts[option.id]; const percent = total ? Math.round(count / total * 100) : 0; const selected = mine.includes(option.id); return <button key={option.id} type="button" disabled={busy || poll.status !== 'open' || !participantId} className={`poll-option ${selected ? 'is-selected' : ''}`} onClick={() => void submitVote(option.id)}><span className="poll-option__check">{selected ? <Check /> : null}</span><span className="poll-option__copy"><strong>{option.title}</strong><small>{option.subtitle}</small><em>{option.metadata.reason}</em></span><span className="poll-option__score"><strong>{count}票 · {percent}%</strong><i style={{ width: `${percent}%` }} /></span></button> })}</div>{error ? <p className="group-error" role="alert">{error}</p> : null}{!participantId ? <p className="group-muted">加入计划后即可投票。</p> : null}{isOwner && poll.status === 'open' ? <button type="button" className="group-text-button" onClick={() => void close()}>截止投票</button> : null}{isOwner && poll.status === 'closed' && poll.type === 'multiple' ? <div className="poll-resolution"><p>偏好已收集，成员仍可继续参加其他投票。</p><button type="button" className="group-text-button" onClick={() => void reopen()}>重新开启一轮</button></div> : null}{isOwner && poll.status === 'closed' && poll.type !== 'multiple' ? <div className="poll-resolution">{leaders.length > 1 && total > 0 ? <p>目前平票。请选择重新开启投票，或由组织者明确最终方案。</p> : <p>投票已结束，选择最终方案后将锁定结果并生成 Journey。</p>}<div>{leaders.map((option) => <button key={option.id} type="button" onClick={() => void resolve(option.id)}>确定「{option.title}」</button>)}</div><button type="button" className="group-text-button" onClick={() => void reopen()}>重新开启一轮</button></div> : null}{poll.status === 'resolved' ? <p className="poll-resolved">结果已锁定，成员现在可以查看最终 Journey。</p> : null}</section>
}

function JourneyCard({ plan }: { plan: GroupPlan }) {
  const navigate = useNavigate(); const journey = plan.journey
  if (!journey) return null
  return <section className="group-journey"><header><span>最终 Journey</span><h2>{journey.title}</h2><p>已由大家共同确定。地图服务暂时不可用时，行程仍可正常查看。</p></header><RealRouteMap places={journey.stops} center={[journey.stops[0]?.lng ?? 121.47, journey.stops[0]?.lat ?? 31.23]} compact /><div className="group-journey__stops">{journey.stops.map((stop) => <div key={stop.id}><time>{stop.time}</time><span><strong>{stop.name}</strong><small>{stop.type} · {stop.note}</small></span></div>)}</div>{plan.type === 'dining' ? <ZouButton onClick={() => navigate('/journey/expense')}>聚餐后记一笔</ZouButton> : null}</section>
}

export const GroupPlanDetailPage = () => {
  const { planId = '' } = useParams(); const navigate = useNavigate(); const userId = getGroupPlanUserId(); const [plan, setPlan] = useState<GroupPlan | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const nickname = useAppStore((state) => state.nickname); const avatar = useAppStore((state) => state.avatar)
  const load = async () => { setLoading(true); try { setPlan(await groupPlanApi.get(planId)); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : '无法读取计划。') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [planId])
  useEffect(() => { if (!planId) return; return groupPlanApi.subscribe(planId, (event) => setPlan(event.plan), () => undefined) }, [planId])
  const me = plan?.participants.find((participant) => participant.userId === userId && participant.inviteStatus === 'accepted')
  const refresh = async (action: () => Promise<GroupPlan>) => { try { setPlan(await action()); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : '操作没有保存。') } }
  const invite = async () => { if (!plan) return; const url = `${window.location.origin}/group-plans/invite/${plan.inviteCode}`; try { await navigator.clipboard.writeText(url); alert('邀请链接已复制，发给朋友即可加入。') } catch { window.prompt('复制邀请链接', url) } track('invite_sent', { type: plan.type }) }
  const join = () => plan && refresh(() => groupPlanApi.join(plan.inviteCode, { userId, displayName: nickname, avatar }))
  if (loading) return <AppShell><ZouNavigationBar title="计划" /><div className="page-content group-loading">正在加载计划…</div></AppShell>
  if (!plan) return <AppShell><ZouNavigationBar title="计划" /><div className="page-content group-loading">{error}<ZouButton onClick={() => navigate('/home')}>回到首页</ZouButton></div></AppShell>
  const isOwner = plan.ownerId === me?.id
  const addCuisinePoll = async () => { await refresh(() => groupPlanApi.createPoll(plan.id, plan.ownerId, { title: '哪些菜系你都可以？', type: 'multiple', options: ['火锅', '烧烤', '日料', '中餐', '西餐'], maxSelections: 3 })); track('poll_created', { type: plan.type }) }
  return <AppShell><ZouNavigationBar title={titleFor(plan.type)} /><main className="page-content group-plan"><header className="group-plan__hero"><span>{plan.type === 'dining' ? '多人真实投票' : '已生成候选'}</span><h1>{plan.title}</h1><p><MapPin /> {plan.city} · {plan.date} · {plan.startTime} 开始</p><div><span>{plan.partySize} 人</span><span>{plan.budget ? `¥${plan.budget}${plan.type === 'dining' ? '/人' : ''}` : '预算待定'}</span><span>{plan.interests.join(' · ')}</span></div></header><section className="group-members"><header><div><span>参与成员</span><h2>{plan.participants.filter((item) => item.inviteStatus === 'accepted').length} 人已加入</h2></div><button type="button" onClick={() => void invite()}><Share2 /> 邀请</button></header><div>{plan.participants.filter((item) => item.inviteStatus === 'accepted').map((participant) => <span key={participant.id}>{participant.avatar ? <img src={participant.avatar} alt="" /> : participant.displayName.slice(0, 1)}<small>{participant.displayName}{participant.role === 'owner' ? ' · 组织者' : ''}</small></span>)}</div>{!me ? <ZouButton onClick={() => void join()}>加入并参与投票</ZouButton> : null}{isOwner && plan.type === 'dining' && !plan.polls.some((poll) => poll.type === 'multiple') ? <button type="button" className="group-text-button" onClick={() => void addCuisinePoll()}>先收集大家能接受的菜系</button> : null}</section>{plan.polls.map((poll) => <PollCard key={poll.id} plan={plan} poll={poll} participantId={me?.id} isOwner={isOwner} refresh={refresh} />)}<JourneyCard plan={plan} />{error ? <p className="group-error" role="alert">{error}</p> : null}</main></AppShell>
}

export const GroupPlanInvitePage = () => {
  const { code = '' } = useParams(); const navigate = useNavigate(); const userId = getGroupPlanUserId(); const nickname = useAppStore((state) => state.nickname); const avatar = useAppStore((state) => state.avatar); const [plan, setPlan] = useState<GroupPlan | null>(null); const [error, setError] = useState(''); const [joining, setJoining] = useState(false)
  useEffect(() => { groupPlanApi.getInvite(code).then(setPlan).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '邀请链接无法打开。')) }, [code])
  const join = async () => { setJoining(true); try { const next = await groupPlanApi.join(code, { userId, displayName: nickname, avatar }); track('participant_joined', { type: next.type }); navigate(`/group-plans/${next.id}`) } catch (reason) { setError(reason instanceof Error ? reason.message : '加入失败。') } finally { setJoining(false) } }
  return <AppShell><ZouNavigationBar title="邀请" /><main className="page-content group-invite">{plan ? <><span>朋友邀请你一起决定</span><h1>{plan.title}</h1><p>{plan.city} · {plan.date} · {plan.participants.filter((item) => item.inviteStatus === 'accepted').length} 人已加入</p><ZouButton disabled={joining} onClick={() => void join()}>{joining ? '正在加入…' : '加入计划'}</ZouButton></> : <p className="group-error">{error || '正在读取邀请…'}</p>}</main></AppShell>
}
