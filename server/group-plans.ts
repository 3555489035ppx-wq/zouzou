import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { getCityKnowledge, type CityKnowledgeItem } from '../src/services/trip/cityKnowledge'
import { extractDietaryProfile, foodCompatibilityIssues } from '../src/services/trip/dietary'
import type { GroupJourney, GroupPlan, GroupPlanInput, GroupPlanType, PlanCandidate, PlanParticipant, Poll, PollType } from '../src/services/groupPlans'

type StoredData = { plans: GroupPlan[] }
export class GroupPlanError extends Error {
  constructor(public readonly code: string, message: string) { super(message) }
}

const now = () => new Date().toISOString()
const id = (prefix: string) => `${prefix}_${randomUUID()}`
const normalizeText = (value: unknown, max = 80) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const unique = (items: string[]) => [...new Set(items.filter(Boolean))]
const defaultStorePath = resolve(process.cwd(), 'data', 'group-plans.local.sqlite')

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function isOpen(poll: Poll) { return poll.status === 'open' && (!poll.deadline || Date.parse(poll.deadline) > Date.now()) }

function candidatesFor(input: GroupPlanInput): PlanCandidate[] {
  const knowledge = getCityKnowledge(input.city)
  const dietary = extractDietaryProfile(input.avoidTags.join(' '))
  const interestTerms = input.interests.length ? input.interests : input.type === 'dining' ? ['晚餐'] : input.type === 'date' ? ['约会', '散步'] : ['城市漫步', '咖啡']
  const allowed = knowledge.items.filter((item) => {
    const content = [item.name, item.area, item.summary, ...item.tags].join(' ')
    if (input.avoidTags.some((term) => term && content.includes(term))) return false
    if (input.type === 'dining') {
      if (!['food', 'restaurant'].includes(item.category)) return false
      if (item.price.min > input.budget * 1.25) return false
      const hour = Number(input.startTime.split(':')[0] ?? 19)
      const tags = item.tags.join(' ')
      if (hour >= 16 && /早餐|早晨|上午/.test(tags)) return false
      if (hour <= 11 && /晚餐|夜宵|深夜/.test(tags)) return false
      return foodCompatibilityIssues(content, dietary, item.dietaryTags).length === 0
    }
    return item.category !== 'food' && item.price.min <= Math.max(input.budget, 1)
  })
  const ranked = allowed.map((item) => ({ item, score: interestTerms.reduce((score, term) => score + ([item.name, item.area, item.summary, ...item.tags].join(' ').includes(term) ? 3 : 0), 0) + (item.verified ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.item.price.min - b.item.price.min)
    .slice(0, 3)
  const fallback = knowledge.items.filter((item) => input.type === 'dining' ? ['food', 'restaurant'].includes(item.category) : item.category !== 'food').slice(0, 3)
  return (ranked.length >= 2 ? ranked.map(({ item }) => item) : fallback).map((item, order) => toCandidate(item, order, input))
}

function toCandidate(item: CityKnowledgeItem, order: number, input: GroupPlanInput): PlanCandidate {
  const price = Math.max(item.price.min, item.price.max)
  const opening = item.opening?.label ?? '按路线安排时段'
  return {
    id: id('option'), type: input.type === 'dining' ? 'restaurant' : item.category === 'activity' ? 'activity' : 'place', title: item.name,
    subtitle: `${item.area} · ¥${price || 0}/人`, order, createdAt: now(),
    metadata: { area: item.area, price, opening, capacity: input.type === 'dining' ? Math.max(4, input.partySize) : undefined, tags: item.tags, lng: item.coordinates[0], lat: item.coordinates[1], durationMinutes: item.durationMinutes, verified: item.verified, reason: `${input.type === 'dining' ? '符合人数、预算与忌口筛选' : '按兴趣、距离与时间窗口排序'} · ${item.summary}` },
  }
}

function createJourney(plan: GroupPlan, selected: PlanCandidate): GroupJourney {
  const firstTime = plan.startTime || (plan.type === 'dining' ? '19:00' : '14:00')
  const duration = selected.metadata.durationMinutes ?? (plan.type === 'dining' ? 110 : 90)
  const [hour, minute] = firstTime.split(':').map(Number)
  const after = `${String((hour + Math.floor((minute + duration) / 60)) % 24).padStart(2, '0')}:${String((minute + duration) % 60).padStart(2, '0')}`
  const lng = selected.metadata.lng ?? 121.47
  const lat = selected.metadata.lat ?? 31.23
  const stop = (name: string, time: string, type: string, budget: number, offset: number, note: string) => ({ id: id('stop'), time, name, type, stay: `${duration}分钟`, budget, transport: offset ? '步行 10 分钟' : '集合', note, lng: lng + offset, lat: lat + offset, x: offset * 100, z: offset * -100 })
  const stops = [stop(selected.title, firstTime, plan.type === 'dining' ? '聚餐' : '活动', selected.metadata.price ?? 0, 0, '已由大家共同确定。')]
  if (plan.type !== 'dining') stops.push(stop(plan.type === 'date' ? '附近散步 / 夜景' : '附近自由探索', after, '可选', 0, .003, '保留弹性，按当天状态决定。'))
  else stops.push(stop('附近散步或甜品（可选）', after, '可选', 0, .003, '用餐结束后再决定，不影响已确定的餐厅。'))
  return { id: id('journey'), title: `${plan.title} · ${selected.title}`, estimatedCost: (selected.metadata.price ?? 0) * plan.partySize, estimatedDistance: stops.length > 1 ? '约 0.8 km' : '到店集合', stops }
}

export class GroupPlanRepository {
  private data: StoredData = { plans: [] }
  private loaded = false
  private database: DatabaseSync | null = null
  private queue = Promise.resolve()
  private listeners = new Map<string, Set<(plan: GroupPlan) => void>>()

  constructor(private readonly storePath = defaultStorePath) {}

  private async load() {
    if (this.loaded) return
    this.database = new DatabaseSync(this.storePath)
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS group_plans (id TEXT PRIMARY KEY, invite_code TEXT NOT NULL UNIQUE, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS poll_single_votes (poll_id TEXT NOT NULL, participant_id TEXT NOT NULL, option_id TEXT NOT NULL, PRIMARY KEY (poll_id, participant_id));
      CREATE TABLE IF NOT EXISTS poll_multi_votes (poll_id TEXT NOT NULL, participant_id TEXT NOT NULL, option_id TEXT NOT NULL, PRIMARY KEY (poll_id, participant_id, option_id));
    `)
    const rows = this.database.prepare('SELECT payload FROM group_plans').all() as Array<{ payload: string }>
    this.data = { plans: rows.map((row) => JSON.parse(row.payload) as GroupPlan) }
    if (!Array.isArray(this.data.plans)) this.data = { plans: [] }
    this.loaded = true
  }
  private async persist() {
    const database = this.database
    if (!database) throw new Error('计划数据库尚未初始化。')
    database.exec('DELETE FROM group_plans; DELETE FROM poll_single_votes; DELETE FROM poll_multi_votes;')
    const savePlan = database.prepare('INSERT INTO group_plans (id, invite_code, payload) VALUES (?, ?, ?)')
    const saveSingleVote = database.prepare('INSERT INTO poll_single_votes (poll_id, participant_id, option_id) VALUES (?, ?, ?)')
    const saveMultiVote = database.prepare('INSERT INTO poll_multi_votes (poll_id, participant_id, option_id) VALUES (?, ?, ?)')
    for (const plan of this.data.plans) {
      savePlan.run(plan.id, plan.inviteCode, JSON.stringify(plan))
      for (const poll of plan.polls) for (const [participantId, optionIds] of Object.entries(poll.votes)) {
        for (const optionId of optionIds) {
          if (poll.type === 'multiple') saveMultiVote.run(poll.id, participantId, optionId)
          else saveSingleVote.run(poll.id, participantId, optionId)
        }
      }
    }
  }
  private async transaction<T>(fn: () => T | Promise<T>) {
    const work = this.queue.then(async () => {
      await this.load()
      this.database?.exec('BEGIN IMMEDIATE')
      try { const value = await fn(); await this.persist(); this.database?.exec('COMMIT'); return value } catch (error) { this.database?.exec('ROLLBACK'); throw error }
    })
    this.queue = work.then(() => undefined, () => undefined)
    return work
  }
  private publish(plan: GroupPlan) { this.listeners.get(plan.id)?.forEach((listener) => listener(clone(plan))) }
  subscribe(planId: string, listener: (plan: GroupPlan) => void) { const set = this.listeners.get(planId) ?? new Set(); set.add(listener); this.listeners.set(planId, set); return () => { set.delete(listener); if (!set.size) this.listeners.delete(planId) } }
  close() { this.database?.close(); this.database = null; this.loaded = false }
  async get(planId: string) { await this.load(); const plan = this.data.plans.find((item) => item.id === planId); if (!plan) throw new GroupPlanError('NOT_FOUND', '计划不存在或已被删除。'); return clone(plan) }
  async getByInvite(inviteCode: string) { await this.load(); const plan = this.data.plans.find((item) => item.inviteCode === inviteCode); if (!plan) throw new GroupPlanError('NOT_FOUND', '邀请链接已失效。'); return clone(plan) }
  async create(input: GroupPlanInput) {
    const city = normalizeText(input.city) || '上海'; const displayName = normalizeText(input.owner?.displayName, 40) || '我'
    if (!['weekend', 'date', 'dining'].includes(input.type)) throw new GroupPlanError('INVALID_INPUT', '计划类型无效。')
    if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new GroupPlanError('INVALID_INPUT', '请选择有效日期。')
    if (!Number.isFinite(input.partySize) || input.partySize < 1 || input.partySize > 100) throw new GroupPlanError('INVALID_INPUT', '人数需要在 1 到 100 之间。')
    if (!Number.isFinite(input.budget) || input.budget < 0) throw new GroupPlanError('INVALID_INPUT', '预算无效。')
    return this.transaction(async () => {
      const createdAt = now(); const planId = id('plan'); const owner: PlanParticipant = { id: id('participant'), planId, userId: normalizeText(input.owner.userId, 100) || undefined, displayName, avatar: normalizeText(input.owner.avatar, 300) || undefined, role: 'owner', inviteStatus: 'accepted', joinedAt: createdAt }
      const cleanInput = { ...input, city, interests: unique(input.interests.map((item) => normalizeText(item, 30))), avoidTags: unique(input.avoidTags.map((item) => normalizeText(item, 30))) }
      const options = candidatesFor(cleanInput)
      if (options.length < 2) throw new GroupPlanError('NO_CANDIDATES', '当前约束下没有足够候选，请放宽预算或忌口。')
      const deadline = input.deadline && Number.isFinite(Date.parse(input.deadline)) ? input.deadline : undefined
      const poll: Poll = { id: id('poll'), planId, title: input.type === 'dining' ? '大家投一下，今晚吃哪家？' : input.type === 'date' ? '一起选，这次想去哪？' : '一起选个周末计划', type: 'single', status: 'open', allowChangeVote: true, maxSelections: 1, deadline, createdBy: owner.id, createdAt, updatedAt: createdAt, options, votes: {} }
      const plan: GroupPlan = { id: planId, type: input.type, ownerId: owner.id, title: input.type === 'dining' ? `${city}聚餐` : input.type === 'date' ? `${city}约会` : `${city}周末计划`, city, date: input.date, startTime: normalizeText(input.startTime, 5), endTime: normalizeText(input.endTime, 5), budget: input.budget, partySize: input.partySize, interests: cleanInput.interests, avoidTags: cleanInput.avoidTags, transportMode: normalizeText(input.transportMode, 20) || '步行', dateStage: normalizeText(input.dateStage, 30) || undefined, indoorOutdoor: normalizeText(input.indoorOutdoor, 20) || undefined, status: 'voting', inviteCode: randomUUID().replace(/-/g, '').slice(0, 10), participants: [owner], polls: [poll], createdAt, updatedAt: createdAt }
      this.data.plans.push(plan); this.publish(plan); return clone(plan)
    })
  }
  async join(inviteCode: string, user: { userId?: string; displayName: string; avatar?: string }) {
    return this.transaction(() => {
      const plan = this.data.plans.find((item) => item.inviteCode === inviteCode); if (!plan) throw new GroupPlanError('NOT_FOUND', '邀请链接已失效。')
      if (plan.status === 'completed' || plan.status === 'cancelled') throw new GroupPlanError('PLAN_CLOSED', '该计划已结束，不能加入。')
      const userId = normalizeText(user.userId, 100); const existing = plan.participants.find((item) => item.userId && item.userId === userId)
      if (existing) { existing.inviteStatus = 'accepted'; existing.joinedAt ??= now(); plan.updatedAt = now(); this.publish(plan); return clone(plan) }
      if (plan.participants.filter((item) => item.inviteStatus === 'accepted').length >= plan.partySize) throw new GroupPlanError('PLAN_FULL', '计划人数已满。')
      const participant: PlanParticipant = { id: id('participant'), planId: plan.id, userId: userId || undefined, displayName: normalizeText(user.displayName, 40) || '朋友', avatar: normalizeText(user.avatar, 300) || undefined, role: 'member', inviteStatus: 'accepted', joinedAt: now() }
      plan.participants.push(participant); plan.updatedAt = now(); this.publish(plan); return clone(plan)
    })
  }
  async vote(pollId: string, participantId: string, optionIds: string[]) {
    return this.transaction(() => {
      const plan = this.data.plans.find((item) => item.polls.some((poll) => poll.id === pollId)); const poll = plan?.polls.find((item) => item.id === pollId)
      if (!plan || !poll) throw new GroupPlanError('NOT_FOUND', '投票不存在。')
      const participant = plan.participants.find((item) => item.id === participantId && item.inviteStatus === 'accepted'); if (!participant) throw new GroupPlanError('FORBIDDEN', '只有已加入计划的成员可以投票。')
      if (!isOpen(poll)) { if (poll.status === 'open') poll.status = 'closed'; throw new GroupPlanError('POLL_CLOSED', '投票已截止。') }
      const wanted = unique(optionIds).filter((optionId) => poll.options.some((option) => option.id === optionId))
      if (wanted.length > poll.maxSelections || (poll.type === 'single' && wanted.length > 1)) throw new GroupPlanError('INVALID_VOTE', '选择数量超过本次投票限制。')
      if (!poll.allowChangeVote && poll.votes[participantId]) throw new GroupPlanError('VOTE_LOCKED', '本次投票不支持修改。')
      if (wanted.length) poll.votes[participantId] = wanted; else delete poll.votes[participantId]
      poll.updatedAt = now(); plan.updatedAt = now(); this.publish(plan); return clone(plan)
    })
  }
  async createPoll(planId: string, actorId: string, input: { title: string; type: PollType; options: string[]; maxSelections?: number }) {
    return this.transaction(() => {
      const plan = this.requirePlan(planId); this.requireOwner(plan, actorId)
      if (!['single', 'multiple', 'time'].includes(input.type)) throw new GroupPlanError('INVALID_INPUT', '投票类型无效。')
      const labels = unique(input.options.map((item) => normalizeText(item, 60))).slice(0, 8)
      if (labels.length < 2) throw new GroupPlanError('INVALID_INPUT', '至少需要两个候选。')
      const createdAt = now(); const poll: Poll = { id: id('poll'), planId, title: normalizeText(input.title, 80) || '一起选', type: input.type, status: 'open', allowChangeVote: true, maxSelections: input.type === 'multiple' ? Math.max(1, Math.min(input.maxSelections ?? 3, labels.length)) : 1, createdBy: actorId, createdAt, updatedAt: createdAt, options: labels.map((title, order) => ({ id: id('option'), type: input.type === 'time' ? 'time' : 'custom', title, subtitle: input.type === 'multiple' ? '可多选' : undefined, order, createdAt, metadata: { reason: input.type === 'multiple' ? '只选择你可以接受的选项。' : '等待成员投票。' } })), votes: {} }
      plan.polls.push(poll); plan.status = 'voting'; plan.updatedAt = now(); this.publish(plan); return clone(plan)
    })
  }
  async closePoll(planId: string, pollId: string, actorId: string) {
    return this.transaction(() => { const plan = this.requirePlan(planId); this.requireOwner(plan, actorId); const poll = this.requirePoll(plan, pollId); if (poll.status === 'resolved') throw new GroupPlanError('POLL_RESOLVED', '结果已锁定。'); poll.status = 'closed'; poll.updatedAt = now(); plan.updatedAt = now(); this.publish(plan); return clone(plan) })
  }
  async resolve(planId: string, pollId: string, actorId: string, winningOptionId: string) {
    return this.transaction(() => {
      const plan = this.requirePlan(planId); this.requireOwner(plan, actorId); const poll = this.requirePoll(plan, pollId)
      if (!poll.options.some((option) => option.id === winningOptionId)) throw new GroupPlanError('INVALID_OPTION', '请选择本次投票中的候选。')
      const winner = poll.options.find((option) => option.id === winningOptionId)!; poll.status = 'resolved'; poll.winningOptionId = winningOptionId; poll.updatedAt = now()
      if (poll.type === 'multiple') {
        plan.status = 'voting'
      } else if (plan.type === 'dining' && poll.type === 'single' && !plan.polls.some((item) => item.type === 'time')) {
        const createdAt = now(); const hours = ['18:30', '19:00', '19:30']
        plan.polls.push({ id: id('poll'), planId: plan.id, title: '再一起定个时间', type: 'time', status: 'open', allowChangeVote: true, maxSelections: 1, createdBy: actorId, createdAt, updatedAt: createdAt, options: hours.map((time, order) => ({ id: id('option'), type: 'time', title: time, subtitle: `${plan.date} · 可参加`, order, createdAt, metadata: { reason: '选择你方便参加的时间。' } })), votes: {} })
        plan.status = 'voting'; plan.selectedOptionId = winningOptionId
      } else {
        const restaurant = poll.type === 'time' ? plan.polls.find((item) => item.type === 'single' && item.status === 'resolved')?.options.find((item) => item.id === plan.selectedOptionId) : winner
        if (!restaurant) throw new GroupPlanError('INVALID_STATE', '请先确定餐厅，再确定时间。')
        if (poll.type === 'time') plan.startTime = winner.title
        plan.status = 'planned'; plan.selectedOptionId = restaurant.id; plan.journey = createJourney(plan, restaurant)
      }
      plan.updatedAt = now(); this.publish(plan); return clone(plan)
    })
  }
  async reopen(planId: string, pollId: string, actorId: string) {
    return this.transaction(() => { const plan = this.requirePlan(planId); this.requireOwner(plan, actorId); const poll = this.requirePoll(plan, pollId); poll.status = 'open'; poll.votes = {}; delete poll.winningOptionId; poll.updatedAt = now(); plan.status = 'voting'; delete plan.selectedOptionId; delete plan.journey; plan.updatedAt = now(); this.publish(plan); return clone(plan) })
  }
  async leave(planId: string, participantId: string) {
    return this.transaction(() => { const plan = this.requirePlan(planId); const participant = plan.participants.find((item) => item.id === participantId); if (!participant || participant.role === 'owner') throw new GroupPlanError('FORBIDDEN', '组织者不能通过此操作退出计划。'); participant.inviteStatus = 'left'; plan.polls.forEach((poll) => delete poll.votes[participantId]); plan.updatedAt = now(); this.publish(plan); return clone(plan) })
  }
  private requirePlan(id: string) { const plan = this.data.plans.find((item) => item.id === id); if (!plan) throw new GroupPlanError('NOT_FOUND', '计划不存在。'); return plan }
  private requirePoll(plan: GroupPlan, id: string) { const poll = plan.polls.find((item) => item.id === id); if (!poll) throw new GroupPlanError('NOT_FOUND', '投票不存在。'); return poll }
  private requireOwner(plan: GroupPlan, actorId: string) { if (plan.ownerId !== actorId) throw new GroupPlanError('FORBIDDEN', '只有组织者可以执行此操作。') }
}

export const groupPlans = new GroupPlanRepository()
