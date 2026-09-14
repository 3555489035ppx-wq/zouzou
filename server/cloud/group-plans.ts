import type { GroupPlan, PlanCandidate, PlanParticipant, Poll } from '../../src/services/groupPlans'
import { parseGeneratedPlans } from '../../src/services/trip/schemas'
import { groupTrip } from '../../src/services/trip/groupTrip'
import { getCityKnowledge } from '../../src/services/trip/cityKnowledge'
import { extractDietaryProfile, foodCompatibilityIssues } from '../../src/services/trip/dietary'
import { updateGeneratedPlan } from '../../src/services/trip/planner'
import { tripSummary } from '../../src/services/trip/summary'
import { body as readBody, CloudError, type CloudDatabase } from './database'

type Stored = { id: string; owner: string; invite_code: string; revision: number; payload: string }
type BatchResult = { results: Record<string, unknown>[]; success?: boolean }
type Input = Record<string, unknown>
class GroupError extends Error {
  constructor(readonly code: string, message: string, readonly status?: number) { super(message) }
}
const now = () => new Date().toISOString()
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`
const inviteCode = () => crypto.randomUUID().replaceAll('-', '')
const text = (value: unknown, max = 80) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const unique = (items: string[]) => [...new Set(items.filter(Boolean))]
const list = (value: unknown) => Array.isArray(value) ? unique(value.map(item => text(item))).slice(0, 12) : []
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
function invalid(message: string): never { throw new GroupError('INVALID_INPUT', message) }
const member = (plan: GroupPlan, actor: string) => {
  const found = plan.participants.find(item => item.userId === actor && item.inviteStatus === 'accepted')
  if (!found) throw new GroupError('FORBIDDEN', '请使用有效邀请加入这份计划。')
  return found
}
function owner(plan: GroupPlan, actor: string) {
  const found = member(plan, actor)
  if (found.id !== plan.ownerId) throw new GroupError('FORBIDDEN', '只有组织者可以执行此操作。')
  return found
}
function validInvite(plan: GroupPlan, code: string) {
  if (plan.inviteCode !== code || Date.parse(plan.createdAt) + 7 * 86400000 <= Date.now()) throw new GroupError('NOT_FOUND', '邀请链接已失效。')
}
function requirePoll(plan: GroupPlan, pollId: string) {
  const poll = plan.polls.find(item => item.id === pollId)
  if (!poll) throw new GroupError('NOT_FOUND', '投票不属于当前计划。')
  return poll
}

// Port of the repository's constraint transition; groupTrip itself remains the
// shared pure implementation, including its existing trip revision semantics.
function refreshDietaryConstraints(plan: GroupPlan) {
  const profiles = [extractDietaryProfile(plan.avoidTags.map(term => `忌口：${term}`).join('，')),
    ...plan.participants.filter(m => m.inviteStatus === 'accepted').map(m => extractDietaryProfile([...(m.foodPreferences ?? []), m.note].filter(Boolean).join('，')))]
  if (plan.baseDietary) profiles.push(plan.baseDietary)
  const knowledge = getCityKnowledge(plan.city), blocked = new Set<string>()
  for (const poll of plan.polls) {
    for (const option of poll.options) {
      const item = knowledge.items.find(item => item.name === option.title)
      const isFood = option.type === 'restaurant' || item?.category === 'food' || item?.category === 'restaurant'
      const description = [option.title, item?.summary, ...(item?.tags ?? option.metadata.tags ?? [])].join(' ')
      const itinerary = plan.tripOptions?.find(trip => (trip.optionId ?? trip.id) === option.id)
      const issues = itinerary ? unique(Object.values(itinerary.days).flat().filter(stop => /午餐|晚餐|小吃/.test(stop.type)).flatMap(stop => profiles.flatMap(profile => foodCompatibilityIssues(`${stop.name} ${knowledge.items.find(item => item.name === stop.name)?.summary ?? ''}`, profile, stop.dietaryTags))))
        : isFood ? unique(profiles.flatMap(profile => foodCompatibilityIssues(description, profile, item?.dietaryTags))) : []
      if (issues.length) { option.metadata.blockedReason = `不符合当前成员饮食限制：${issues.join('；')}`.slice(0, 1000); blocked.add(option.id) }
      else delete option.metadata.blockedReason
    }
    for (const [participantId, choices] of Object.entries(poll.votes)) {
      const remaining = choices.filter(optionId => !blocked.has(optionId))
      if (remaining.length === choices.length) continue
      if (remaining.length) poll.votes[participantId] = remaining; else delete poll.votes[participantId]
      poll.updatedAt = now()
    }
    if (poll.winningOptionId && blocked.has(poll.winningOptionId)) {
      delete poll.winningOptionId; delete poll.resolvedRevision; poll.status = 'closed'; poll.updatedAt = now()
    }
  }
  if (plan.selectedOptionId && blocked.has(plan.selectedOptionId)) {
    delete plan.selectedOptionId; delete plan.journey; plan.status = 'voting'
    for (const poll of plan.polls.filter(p => p.type === 'time' && p.status === 'resolved')) {
      delete poll.winningOptionId; delete poll.resolvedRevision; poll.status = 'closed'; poll.updatedAt = now()
    }
  }
}
function publish(plan: GroupPlan) {
  plan.revision = (plan.revision ?? 0) + 1
  const previous = plan.trip, next = groupTrip(plan)
  if (previous && next && JSON.stringify(previous.intent.dietary) !== JSON.stringify(next.intent.dietary)) {
    next.revision = (previous.revision ?? 1) + 1
    if (next.sourceGroup) next.sourceGroup.tripRevision = next.revision
  }
  plan.trip = next
}

class CloudGroups {
  constructor(private db: CloudDatabase, private actor: string) {}
  private statement(sql: string, ...values: unknown[]) { return this.db.prepare(sql).bind(...values) }
  private async batch(statements: ReturnType<CloudDatabase['prepare']>[]) {
    const results = await this.db.batch(statements) as BatchResult[]
    if (results.length !== statements.length || results.some(r => !r || r.success === false)) throw Error('D1 batch failed')
    return results
  }
  private async read(key: string, byInvite = false) {
    const row = await this.statement(`SELECT * FROM cloud_group_plans WHERE ${byInvite ? 'invite_code' : 'id'}=?`, key).first<Stored>()
    if (!row) throw new GroupError('NOT_FOUND', byInvite ? '邀请链接已失效。' : '计划不存在或已被删除。')
    const plan = JSON.parse(row.payload) as GroupPlan
    if (byInvite) validInvite(plan, key)
    return { row, plan }
  }
  async get(key: string, byInvite = false) {
    const { plan } = await this.read(key, byInvite)
    if (!byInvite) member(plan, this.actor)
    return plan
  }
  private async mutate(key: string, fn: (plan: GroupPlan) => boolean | void, byInvite = false) {
    // Retry only the pure transition, against the latest committed snapshot.
    // Explicit trip/poll expectedRevision checks run again on every retry.
    for (let attempt = 0; attempt < 8; attempt++) {
      const { row, plan } = await this.read(key, byInvite)
      if (!byInvite) member(plan, this.actor)
      if (plan.type !== 'travel') throw new GroupError('FEATURE_REMOVED', '此功能已下线，请使用旅行规划。', 410)
      if (fn(plan) === false) return plan
      plan.updatedAt = now(); publish(plan)
      const payload = JSON.stringify(plan)
      const results = await this.batch([
        this.statement(`UPDATE cloud_group_plans SET payload=?,invite_code=?,revision=?
          WHERE id=? AND owner=? AND revision=? RETURNING id`, payload, plan.inviteCode, plan.revision, row.id, row.owner, row.revision),
      ])
      if (results[0].results.length) return plan
    }
    throw new GroupError('VERSION_CONFLICT', '成员或投票已更新，请刷新计划后重新确认。')
  }
  async create(input: Input) {
    if (['weekend', 'date', 'dining'].includes(String(input.type))) throw new GroupError('FEATURE_REMOVED', '此功能已下线，请使用旅行规划。', 410)
    if (input.type !== 'travel') invalid('计划类型无效。')
    if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) invalid('请选择有效日期。')
    if (typeof input.partySize !== 'number' || !Number.isFinite(input.partySize) || input.partySize < 1 || input.partySize > 100) invalid('人数需要在 1 到 100 之间。')
    if (typeof input.budget !== 'number' || !Number.isFinite(input.budget) || input.budget < 0) invalid('预算无效。')
    const trip = parseGeneratedPlans([input.trip])?.[0]
    if (!trip?.tripId || !trip.savedAt || !trip.dates) invalid('先保存有明确日期的行程，再建立协作副本。')
    const createdAt = now(), planId = trip.tripId
    const rawOwner = input.owner && typeof input.owner === 'object' ? input.owner as Input : {}
    const participant: PlanParticipant = { id: id('participant'), planId, userId: this.actor, displayName: text(rawOwner.displayName, 40) || '我', role: 'owner', inviteStatus: 'accepted', joinedAt: createdAt }
    const options = (parseGeneratedPlans(input.tripOptions) ?? []).filter(option => option.city === trip.city && option.dates?.start === trip.dates?.start && option.dates?.end === trip.dates?.end && option.partySize === trip.partySize)
    const pollOptions = options.map((option, order): PlanCandidate => ({ id: option.optionId ?? option.id, type: 'custom', title: option.label, subtitle: `${Object.keys(option.days).length}天${option.nights}晚 · 全员估算¥${option.budget}`, metadata: { reason: option.difference }, order, createdAt }))
    const polls: Poll[] = pollOptions.length >= 2 ? [{ id: id('poll'), planId, title: `整套${Object.keys(trip.days).length}天路线投票（基于行程版本${trip.revision ?? 1}）`, type: 'single', status: 'open', allowChangeVote: true, maxSelections: 1, createdBy: participant.id, createdAt, updatedAt: createdAt, options: pollOptions, votes: {} }] : []
    const plan: GroupPlan = { id: planId, type: 'travel', ownerId: participant.id, title: tripSummary(trip).title, city: trip.city, date: trip.dates.start,
      startTime: trip.intent.arrivalTime ?? '', endTime: trip.intent.departureTime ?? '', budget: trip.budgetLimit ?? trip.budget, partySize: trip.partySize,
      interests: trip.intent.preferences, avoidTags: trip.intent.constraints, transportMode: '按日程逐站核对', status: polls.length ? 'voting' : 'planned',
      inviteCode: inviteCode(), participants: [participant], polls, trip, baseDietary: clone(trip.intent.dietary), tripOptions: options, createdAt, updatedAt: createdAt }
    publish(plan)
    const results = await this.batch([
      this.statement('INSERT INTO cloud_group_plans(id,owner,invite_code,revision,payload) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING', planId, this.actor, plan.inviteCode, plan.revision, JSON.stringify(plan)),
      this.statement('SELECT * FROM cloud_group_plans WHERE id=?', planId),
    ])
    const stored = results[1].results[0] as Stored | undefined
    if (!stored) throw Error('Missing group snapshot')
    if (stored.owner !== this.actor) throw new GroupError('FORBIDDEN', '此行程已有其他组织者。')
    return JSON.parse(stored.payload) as GroupPlan
  }
  join(code: string, input: Input) {
    return this.mutate(code, plan => {
      validInvite(plan, code)
      if (['completed', 'cancelled'].includes(plan.status)) throw new GroupError('PLAN_CLOSED', '该计划已结束，不能加入。')
      const existing = plan.participants.find(item => item.userId === this.actor)
      const preferences = {
        ...(Array.isArray(input.activityPreferences) ? { activityPreferences: list(input.activityPreferences) } : {}),
        ...(Array.isArray(input.foodPreferences) ? { foodPreferences: list(input.foodPreferences) } : {}),
        ...(typeof input.note === 'string' ? { note: text(input.note, 500) || undefined } : {}),
      }
      if (existing) { existing.inviteStatus = 'accepted'; existing.joinedAt ??= now(); Object.assign(existing, preferences) }
      else plan.participants.push({ id: id('participant'), planId: plan.id, userId: this.actor, displayName: text(input.displayName, 40) || '朋友', avatar: text(input.avatar, 300) || undefined, ...preferences, role: 'member', inviteStatus: 'accepted', joinedAt: now() })
      refreshDietaryConstraints(plan)
    }, true)
  }
  updateTrip(planId: string, input: Input) {
    return this.mutate(planId, plan => {
      owner(plan, this.actor)
      if (!plan.trip) throw new GroupError('INVALID_STATE', '此接口仅用于完整旅行协作。')
      if (input.expectedRevision !== (plan.trip.revision ?? 1)) throw new GroupError('VERSION_CONFLICT', '共同日程已更新，请重新打开最新版本后修改。')
      const next = parseGeneratedPlans([input.trip])?.[0]
      if (!next || next.tripId !== plan.id || !next.dates) invalid('行程身份或日期无效。')
      plan.trip = { ...next, revision: (plan.trip.revision ?? 1) + 1 }
      plan.city = next.city; plan.date = next.dates.start; plan.partySize = next.partySize; plan.budget = next.budgetLimit ?? next.budget; plan.title = tripSummary(next).title
    })
  }
  revoke(planId: string) { return this.mutate(planId, plan => { owner(plan, this.actor); plan.inviteCode = inviteCode() }) }
  leave(planId: string) {
    return this.mutate(planId, plan => {
      const participant = member(plan, this.actor)
      if (participant.role === 'owner') throw new GroupError('FORBIDDEN', '组织者不能通过此操作退出计划。')
      participant.inviteStatus = 'left'; plan.polls.forEach(poll => delete poll.votes[participant.id]); refreshDietaryConstraints(plan)
    })
  }
  createPoll(planId: string, input: Input) {
    return this.mutate(planId, plan => {
      const actor = owner(plan, this.actor), type = input.type ?? 'single'
      if (type !== 'single' && type !== 'multiple' && type !== 'time') invalid('投票类型无效。')
      const labels = unique((Array.isArray(input.options) ? input.options : []).map(item => text(item, 60))).slice(0, 8)
      if (labels.length < 2) invalid('至少需要两个候选。')
      const createdAt = now()
      const poll: Poll = { id: id('poll'), planId, title: text(input.title) || '一起选', type: type as Poll['type'], status: 'open', allowChangeVote: true,
        maxSelections: type === 'multiple' ? Math.max(1, Math.min(typeof input.maxSelections === 'number' ? input.maxSelections : 3, labels.length)) : 1,
        createdBy: actor.id, createdAt, updatedAt: createdAt, options: labels.map((title, order) => ({ id: id('option'), type: type === 'time' ? 'time' : 'custom', title,
          subtitle: type === 'multiple' ? '可多选' : undefined, order, createdAt, metadata: { reason: type === 'multiple' ? '只选择你可以接受的选项。' : '等待成员投票。' } })), votes: {} }
      plan.polls.push(poll); refreshDietaryConstraints(plan); plan.status = 'voting'
    })
  }
  pollAction(planId: string, pollId: string, action: string, input: Input) {
    return this.mutate(planId, plan => {
      const participant = member(plan, this.actor), poll = requirePoll(plan, pollId)
      if (action === 'vote') {
        if (poll.status !== 'open' || (poll.deadline && Date.parse(poll.deadline) <= Date.now())) throw new GroupError('POLL_CLOSED', '投票已截止。')
        const wanted = unique((Array.isArray(input.optionIds) ? input.optionIds : []).filter((value): value is string => typeof value === 'string')).filter(optionId => poll.options.some(option => option.id === optionId))
        const blocked = poll.options.find(option => wanted.includes(option.id) && option.metadata.blockedReason)
        if (blocked) throw new GroupError('CONSTRAINT_CONFLICT', blocked.metadata.blockedReason!)
        if (wanted.length > poll.maxSelections || (poll.type === 'single' && wanted.length > 1)) throw new GroupError('INVALID_VOTE', '选择数量超过本次投票限制。')
        if (!poll.allowChangeVote && poll.votes[participant.id]) throw new GroupError('VOTE_LOCKED', '本次投票不支持修改。')
        if (wanted.length) poll.votes[participant.id] = wanted; else delete poll.votes[participant.id]
      } else {
        owner(plan, this.actor)
        if (action === 'close') {
          if (poll.status === 'resolved') throw new GroupError('POLL_RESOLVED', '结果已锁定。')
          poll.status = 'closed'
        } else if (action === 'reopen') {
          poll.status = 'open'; poll.votes = {}; delete poll.winningOptionId; delete poll.resolvedRevision
          plan.status = 'voting'; delete plan.selectedOptionId; delete plan.journey
        } else if (action === 'resolve') {
          if (!Number.isInteger(input.expectedRevision) || Number(input.expectedRevision) < 1) throw new GroupError('VERSION_CONFLICT', '请刷新计划后重新确认。')
          if (!plan.trip) throw new GroupError('INVALID_STATE', '此接口仅用于完整旅行协作。')
          if (poll.status === 'resolved' && poll.winningOptionId === input.winningOptionId) return false
          if (input.expectedRevision !== (plan.revision ?? 1)) throw new GroupError('VERSION_CONFLICT', '成员或投票已更新，请刷新后重新确认。')
          const option = plan.tripOptions?.find(item => (item.optionId ?? item.id) === input.winningOptionId)
          if (!option || !poll.options.some(item => item.id === input.winningOptionId)) throw new GroupError('INVALID_OPTION', '本轮没有这套路线。')
          const blocked = poll.options.find(item => item.id === input.winningOptionId)?.metadata.blockedReason
          if (blocked) throw new GroupError('CONSTRAINT_CONFLICT', blocked)
          if (plan.trip.execution?.length || ['active', 'paused', 'completed', 'archived'].includes(plan.trip.status ?? '')) throw new GroupError('INVALID_STATE', '已开始的行程不能整套替换，请使用局部修改。')
          const protectedStops = Object.values(plan.trip.days).flat().filter(stop => stop.fixed)
          if (protectedStops.some(stop => !Object.values(option.days).flat().some(next => next.name === stop.name && next.time === stop.time))) throw new GroupError('CONSTRAINT_CONFLICT', '新方案改变了锁定站点，请先明确解除锁定后再决定。')
          plan.trip = updateGeneratedPlan({ ...option, tripId: plan.id, savedAt: plan.trip.savedAt, revision: plan.trip.revision, originOptionId: option.optionId ?? option.id, status: 'planned' }, option.days)
          poll.status = 'resolved'; poll.winningOptionId = String(input.winningOptionId); poll.resolvedRevision = (plan.revision ?? 1) + 1
          plan.selectedOptionId = String(input.winningOptionId); plan.status = 'planned'
        }
      }
      poll.updatedAt = now()
    })
  }
}

// Workers have no in-process repository listeners. Keep the same EventSource
// wire contract while polling D1; authorization is rechecked on each poll.
function events(request: Request, groups: CloudGroups, initial: GroupPlan) {
  const encoder = new TextEncoder()
  let timer: ReturnType<typeof setTimeout> | undefined, stopped = false, revision = initial.revision
  let close: (() => void) | undefined
  const cleanup = () => { stopped = true; if (timer !== undefined) clearTimeout(timer); request.signal.removeEventListener('abort', abort) }
  const abort = () => { cleanup(); close?.() }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      close = () => controller.close()
      const send = (plan: GroupPlan) => controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'plan.updated', plan })}\n\n`))
      if (request.signal.aborted) { abort(); return }
      controller.enqueue(encoder.encode('retry: 3000\n\n')); send(initial)
      request.signal.addEventListener('abort', abort, { once: true })
      const poll = async () => {
        try {
          const plan = await groups.get(initial.id)
          if (stopped) return
          if (plan.revision !== revision) { revision = plan.revision; send(plan) }
          else controller.enqueue(encoder.encode(': keep-alive\n\n'))
          timer = setTimeout(poll, 3000)
        } catch { if (!stopped) { cleanup(); controller.close() } }
      }
      timer = setTimeout(poll, 3000)
    },
    cancel() { cleanup() },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' } })
}

export async function handleCloudGroupPlans(request: Request, db: CloudDatabase, actor: string): Promise<Response> {
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Zouzou-User': actor } })
  try {
    const url = new URL(request.url), parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    if (parts[0] !== 'api' || parts[1] !== 'group-plans') return json({ error: 'NOT_FOUND', message: '接口不存在。' }, 404)
    const groups = new CloudGroups(db, actor), [, , planId, action, pollId, operation] = parts
    if (planId && planId !== 'invite') {
      const plan = await groups.get(planId)
      if (action === 'polls' && pollId) requirePoll(plan, pollId)
      if (request.method === 'GET' && parts.length === 3) return json(plan)
      if (request.method === 'GET' && parts.length === 4 && action === 'events') return events(request, groups, plan)
    }
    if (planId === 'invite' && request.method === 'GET' && parts.length === 4) return json(await groups.get(action, true))
    let input: Input = {}
    if (request.method === 'POST' || request.method === 'PUT') {
      const raw = await readBody(request)
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) invalid('请求格式不正确。')
      input = raw as Input
    }
    if (parts.length === 2 && request.method === 'POST') return json(await groups.create(input), 201)
    if (planId === 'invite' && parts.length === 5 && pollId === 'join' && request.method === 'POST') return json(await groups.join(action, input))
    if (parts.length === 4 && request.method === 'PUT' && action === 'trip') return json(await groups.updateTrip(planId, input))
    if (parts.length === 4 && request.method === 'POST') {
      if (action === 'revoke-invite') return json(await groups.revoke(planId))
      if (action === 'leave') return json(await groups.leave(planId))
      if (action === 'polls') return json(await groups.createPoll(planId, input), 201)
      // Preserve the old alias's invite-code semantics and prior member guard.
      if (action === 'join') return json(await groups.join(planId, input))
    }
    if (parts.length === 6 && action === 'polls' && ((request.method === 'PUT' && operation === 'vote') || (request.method === 'POST' && ['close', 'resolve', 'reopen'].includes(operation)))) return json(await groups.pollAction(planId, pollId, operation, input))
    return json({ error: 'NOT_FOUND', message: '接口不存在。' }, 404)
  } catch (error) {
    const code = error instanceof GroupError ? error.code : error instanceof CloudError || error instanceof URIError ? 'INVALID_INPUT' : 'GROUP_PLAN_FAILED'
    const status = error instanceof GroupError ? error.status ?? (code === 'NOT_FOUND' ? 404 : code === 'FORBIDDEN' ? 403 : ['POLL_CLOSED', 'PLAN_CLOSED', 'CONSTRAINT_CONFLICT', 'VERSION_CONFLICT', 'POLL_RESOLVED'].includes(code) ? 409 : 400) : error instanceof CloudError ? error.status : error instanceof URIError ? 400 : 500
    return json({ error: code, message: error instanceof GroupError || error instanceof CloudError ? error.message : status === 400 ? '请求格式不正确。' : '计划服务暂时不可用。' }, status)
  }
}
