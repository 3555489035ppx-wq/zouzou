import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { cityKnowledge, getCityKnowledge, type CityKnowledgeItem } from '../src/services/trip/cityKnowledge'
import { extractDietaryProfile, foodCompatibilityIssues } from '../src/services/trip/dietary'
import { getPlaceCoordinates } from '../src/services/places'
import { groupTrip } from '../src/services/trip/groupTrip'
import { parseGeneratedPlans } from '../src/services/trip/schemas'
import { updateGeneratedPlan } from '../src/services/trip/planner'
import { tripSummary } from '../src/services/trip/summary'
import type { GroupJourney, GroupPlan, GroupPlanInput, GroupPlanJoinInput, GroupPlanType, PlanCandidate, PlanParticipant, Poll, PollType, UserPlanOrigin } from '../src/services/groupPlans'

type StoredData = { plans: GroupPlan[] }
export class GroupPlanError extends Error {
  constructor(public readonly code: string, message: string) { super(message) }
}

const now = () => new Date().toISOString()
const id = (prefix: string) => `${prefix}_${randomUUID()}`
const normalizeText = (value: unknown, max = 80) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const unique = (items: string[]) => [...new Set(items.filter(Boolean))]
const normalizeList = (value: unknown, max = 12) => Array.isArray(value) ? unique(value.map((item) => normalizeText(item, 80))).slice(0, max) : []
const defaultStorePath = process.env.ZOUZOU_DB_PATH ?? resolve(process.cwd(), 'data', 'group-plans.local.sqlite')

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function isOpen(poll: Poll) { return poll.status === 'open' && (!poll.deadline || Date.parse(poll.deadline) > Date.now()) }

function normalizeOrigin(value: GroupPlanInput['origin']): UserPlanOrigin | undefined {
  if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) return undefined
  if (value.latitude < -90 || value.latitude > 90 || value.longitude < -180 || value.longitude > 180) return undefined
  return {
    latitude: Number(value.latitude.toFixed(5)),
    longitude: Number(value.longitude.toFixed(5)),
    ...(Number.isFinite(value.accuracy) ? { accuracy: Math.round(Math.max(0, Math.min(value.accuracy!, 100_000))) } : {}),
  }
}

function distanceKm(origin: Pick<UserPlanOrigin, 'latitude' | 'longitude'>, coordinates: [number, number]) {
  const radians = (value: number) => value * Math.PI / 180
  const latitudeDelta = radians(coordinates[1] - origin.latitude)
  const longitudeDelta = radians(coordinates[0] - origin.longitude)
  const start = radians(origin.latitude)
  const end = radians(coordinates[1])
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(start) * Math.cos(end) * Math.sin(longitudeDelta / 2) ** 2
  return 6_371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function cityForOrigin(origin: UserPlanOrigin) {
  let nearest: { city: string; distance: number } | undefined
  for (const [city, knowledge] of Object.entries(cityKnowledge)) {
    for (const item of knowledge.items) {
      if (!item.coordinates) continue
      const distance = distanceKm(origin, item.coordinates)
      if (!nearest || distance < nearest.distance) nearest = { city, distance }
    }
  }
  return nearest && nearest.distance <= 80 ? nearest.city : undefined
}

function refreshDietaryConstraints(plan: GroupPlan) {
  const profiles = [extractDietaryProfile(plan.avoidTags.map(term => `忌口：${term}`).join('，')),
    ...plan.participants.filter(member => member.inviteStatus === 'accepted')
      .map(member => extractDietaryProfile([...(member.foodPreferences ?? []), member.note].filter(Boolean).join('，')))]
  if(plan.baseDietary)profiles.push(plan.baseDietary)
  const knowledge = getCityKnowledge(plan.city)
  const blocked = new Set<string>()
  for (const poll of plan.polls) {
    for (const option of poll.options) {
      const item = knowledge.items.find(item => item.name === option.title)
      const isFood = option.type === 'restaurant' || item?.category === 'food' || item?.category === 'restaurant' || (plan.type === 'dining' && option.type === 'custom')
      const text = [option.title, item?.summary, ...(item?.tags ?? option.metadata.tags ?? [])].join(' ')
      const itinerary=plan.type==='travel'?plan.tripOptions?.find(trip=>(trip.optionId??trip.id)===option.id):undefined
      const issues = itinerary ? unique(Object.values(itinerary.days).flat().filter(stop=>/午餐|晚餐|小吃/.test(stop.type)).flatMap(stop=>profiles.flatMap(profile=>foodCompatibilityIssues(`${stop.name} ${knowledge.items.find(item=>item.name===stop.name)?.summary??''}`,profile,stop.dietaryTags)))) : isFood ? unique(profiles.flatMap(profile => foodCompatibilityIssues(text, profile, item?.dietaryTags))) : []
      if (issues.length) {
        option.metadata.blockedReason = `不符合当前成员饮食限制：${issues.join('；')}`.slice(0, 1000)
        blocked.add(option.id)
      } else delete option.metadata.blockedReason
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
    for (const poll of plan.polls.filter(poll => poll.type === 'time' && poll.status === 'resolved')) {
      delete poll.winningOptionId; delete poll.resolvedRevision; poll.status = 'closed'; poll.updatedAt = now()
    }
  }
}

function candidatesFor(input: GroupPlanInput): PlanCandidate[] {
  const knowledge = getCityKnowledge(input.city)
  const namedRestaurants = new Map(knowledge.items.filter(item => item.venueName && item.name === item.venueName).map(item => [item.venueName!, item]))
  // Dish aliases are useful to plan meals, but a restaurant poll needs distinct shops.
  const items = input.type === 'dining' ? knowledge.items.filter(item => ['food', 'restaurant'].includes(item.category) && item.venueName).map(item => namedRestaurants.get(item.venueName!) ?? item) : knowledge.items
  const dietary = extractDietaryProfile(input.avoidTags.join(' '))
  const interestTerms = input.interests.length ? input.interests : input.type === 'dining' ? ['晚餐'] : input.type === 'date' ? ['约会', '散步'] : ['城市漫步', '咖啡']
  const allowed = items.filter((item) => {
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
  const ranked = allowed.map((item) => {
    const distance = input.origin && item.coordinates ? distanceKm(input.origin, item.coordinates) : undefined
    const proximityScore = distance === undefined ? 0 : distance <= 2 ? 6 : distance <= 5 ? 5 : distance <= 10 ? 4 : distance <= 20 ? 2 : distance <= 40 ? 1 : 0
    const interestScore = interestTerms.reduce((score, term) => score + ([item.name, item.area, item.summary, ...item.tags].join(' ').includes(term) ? 3 : 0), 0)
    return { item, distance, score: interestScore + proximityScore + (item.verified ? 1 : 0) }
  })
    .sort((a, b) => b.score - a.score || (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY) || a.item.price.min - b.item.price.min)
  const seen = new Set<string>()
  return ranked.filter(({ item }) => {
    const key = input.type === 'dining' ? item.venueName! : item.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
    .slice(0, 3)
    .map(({ item, distance }, order) => toCandidate(item, order, input, distance))
}

function toCandidate(item: CityKnowledgeItem, order: number, input: GroupPlanInput, distance?: number): PlanCandidate {
  const price = Math.max(item.price.min, item.price.max)
  const opening = item.opening?.label ?? '按路线安排时段'
  const coordinates = item.verified ? getPlaceCoordinates({ coordinates: item.coordinates, coordinateSystem: item.coordinateSystem }) : null
  return {
    id: id('option'), type: input.type === 'dining' ? 'restaurant' : item.category === 'activity' ? 'activity' : 'place', title: item.name,
    subtitle: `${item.area}${distance === undefined ? '' : ` · 距你约${distance < 1 ? `${Math.max(100, Math.round(distance * 10) * 100)}米` : `${distance.toFixed(1)}公里`}`} · ¥${price || 0}/人`, order, createdAt: now(),
    metadata: { area: item.area, price, opening, capacity: input.type === 'dining' ? Math.max(4, input.partySize) : undefined, tags: item.tags, ...(coordinates ? { lng: coordinates.longitude, lat: coordinates.latitude, longitude: coordinates.longitude, latitude: coordinates.latitude, coordinateSystem: coordinates.coordinateSystem } : {}), durationMinutes: item.durationMinutes, ...(distance === undefined ? {} : { distanceKm: Number(distance.toFixed(2)) }), verified: item.verified, reason: `${distance === undefined ? '' : '按当前位置与规划坐标估算距离，实际路线请用地图确认 · '}${input.type === 'dining' ? '符合人数、预算与忌口筛选' : '按兴趣、距离与时间窗口排序'} · ${item.summary}` },
  }
}

function createJourney(plan: GroupPlan, selected: PlanCandidate): GroupJourney {
  const firstTime = plan.startTime || (plan.type === 'dining' ? '19:00' : '14:00')
  const duration = selected.metadata.durationMinutes ?? (plan.type === 'dining' ? 110 : 90)
  const [hour, minute] = firstTime.split(':').map(Number)
  const after = `${String((hour + Math.floor((minute + duration) / 60)) % 24).padStart(2, '0')}:${String((minute + duration) % 60).padStart(2, '0')}`
  const coordinates = getPlaceCoordinates(selected.metadata)
  const stop = (name: string, time: string, type: string, budget: number, transport: string, note: string, includeCoordinates = false) => ({
    id: id('stop'), time, name, type, stay: `${duration}分钟`, budget, transport, note,
    ...(includeCoordinates && coordinates ? { lng: coordinates.longitude, lat: coordinates.latitude, longitude: coordinates.longitude, latitude: coordinates.latitude, coordinateSystem: coordinates.coordinateSystem, verified: selected.metadata.verified } : {}),
  })
  const stops = [stop(selected.title, firstTime, plan.type === 'dining' ? '聚餐' : '活动', selected.metadata.price ?? 0, '集合', '已由大家共同确定。', true)]
  if (plan.type !== 'dining') stops.push(stop(plan.type === 'date' ? '附近散步 / 夜景' : '附近自由探索', after, '可选', 0, '前往方式由地图 App 计算', '保留弹性；打开具体地点的地图后再决定。'))
  else stops.push(stop('附近散步或甜品（可选）', after, '可选', 0, '前往方式由地图 App 计算', '用餐结束后再决定，不影响已确定的餐厅。'))
  return { id: id('journey'), title: `${plan.title} · ${selected.title}`, estimatedCost: (selected.metadata.price ?? 0) * plan.partySize, estimatedDistance: stops.length > 1 ? '打开地图后计算' : '到店集合', stops }
}

export class GroupPlanRepository {
  private data: StoredData = { plans: [] }
  private loaded = false
  private database: DatabaseSync | null = null
  private queue = Promise.resolve()
  private listeners = new Map<string, Set<(plan: GroupPlan) => void>>()
  private pendingUpdates = new Set<string>()

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
    this.data = { plans: rows.map((row) => ({ revision: 1, ...JSON.parse(row.payload) } as GroupPlan)) }
    if (!Array.isArray(this.data.plans)) this.data = { plans: [] }
    this.data.plans.filter(plan => !['completed', 'cancelled'].includes(plan.status)).forEach(plan => { refreshDietaryConstraints(plan); plan.trip = groupTrip(plan) })
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
      const before = clone(this.data)
      this.database?.exec('BEGIN IMMEDIATE')
      let value: T
      try { value = await fn(); await this.persist(); this.database?.exec('COMMIT') } catch (error) { this.database?.exec('ROLLBACK'); this.data = before; this.pendingUpdates.clear(); throw error }
      for (const planId of this.pendingUpdates) {
        const plan = this.data.plans.find(item => item.id === planId)!
        this.listeners.get(planId)?.forEach(listener => { try { listener(clone(plan)) } catch { /* A disconnected subscriber cannot roll back committed data. */ } })
      }
      this.pendingUpdates.clear()
      return value
    })
    this.queue = work.then(() => undefined, () => undefined)
    return work
  }
  private publish(plan: GroupPlan) {
    plan.revision = (plan.revision ?? 0) + 1
    const previous=plan.trip,next=groupTrip(plan)
    if(plan.type==='travel'&&previous&&next&&JSON.stringify(previous.intent.dietary)!==JSON.stringify(next.intent.dietary)){next.revision=(previous.revision??1)+1;if(next.sourceGroup)next.sourceGroup.tripRevision=next.revision}
    plan.trip=next;this.pendingUpdates.add(plan.id)
  }
  subscribe(planId: string, listener: (plan: GroupPlan) => void) { const set = this.listeners.get(planId) ?? new Set(); set.add(listener); this.listeners.set(planId, set); return () => { set.delete(listener); if (!set.size) this.listeners.delete(planId) } }
  close() { this.database?.close(); this.database = null; this.loaded = false }
  async get(planId: string) { await this.load(); const plan = this.data.plans.find((item) => item.id === planId); if (!plan) throw new GroupPlanError('NOT_FOUND', '计划不存在或已被删除。'); return clone(plan) }
  async getByInvite(inviteCode: string) { await this.load(); const plan = this.data.plans.find((item) => item.inviteCode === inviteCode); if (!plan || Date.parse(plan.createdAt) + 7 * 86400000 <= Date.now()) throw new GroupPlanError('NOT_FOUND', '邀请链接已失效。'); return clone(plan) }
  async revokeInvite(planId: string, actorId: string) { return this.transaction(() => { const plan = this.requirePlan(planId); this.requireOwner(plan, actorId); plan.inviteCode = randomUUID().replaceAll('-', ''); plan.updatedAt = now(); this.publish(plan); return clone(plan) }) }
  async create(input: GroupPlanInput) {
    const requestedCity = normalizeText(input.city) || '上海'; const requestedOrigin = normalizeOrigin(input.origin); const resolvedCity = requestedOrigin ? cityForOrigin(requestedOrigin) : undefined; const origin = resolvedCity ? requestedOrigin : undefined; const city = resolvedCity ?? requestedCity; const displayName = normalizeText(input.owner?.displayName, 40) || '我'
    if (!['travel', 'weekend', 'date', 'dining'].includes(input.type)) throw new GroupPlanError('INVALID_INPUT', '计划类型无效。')
    if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new GroupPlanError('INVALID_INPUT', '请选择有效日期。')
    if (!Number.isFinite(input.partySize) || input.partySize < 1 || input.partySize > 100) throw new GroupPlanError('INVALID_INPUT', '人数需要在 1 到 100 之间。')
    if (!Number.isFinite(input.budget) || input.budget < 0) throw new GroupPlanError('INVALID_INPUT', '预算无效。')
    return this.transaction(async () => {
      if (input.type === 'travel') {
        const trip=parseGeneratedPlans([input.trip])?.[0]
        if(!trip?.tripId || !trip.savedAt || !trip.dates)throw new GroupPlanError('INVALID_INPUT','先保存有明确日期的行程，再建立协作副本。')
        const existing=this.data.plans.find(plan=>plan.id===trip.tripId)
        if(existing){if(!existing.participants.some(member=>member.role==='owner'&&member.userId===input.owner.userId))throw new GroupPlanError('FORBIDDEN','此行程已有其他组织者。');return clone(existing)}
        const createdAt=now(),planId=trip.tripId
        const owner:PlanParticipant={id:id('participant'),planId,userId:input.owner.userId,displayName,role:'owner',inviteStatus:'accepted',joinedAt:createdAt}
        const options=(parseGeneratedPlans(input.tripOptions)??[]).filter(option=>option.city===trip.city&&option.dates?.start===trip.dates?.start&&option.dates?.end===trip.dates?.end&&option.partySize===trip.partySize)
        const pollOptions=options.map((option,order):PlanCandidate=>({id:option.optionId??option.id,type:'custom',title:option.label,subtitle:`${Object.keys(option.days).length}天${option.nights}晚 · 全员估算¥${option.budget}`,metadata:{reason:option.difference},order,createdAt}))
        const polls:Poll[]=pollOptions.length>=2?[{id:id('poll'),planId,title:`整套${Object.keys(trip.days).length}天路线投票（基于行程版本${trip.revision??1}）`,type:'single',status:'open',allowChangeVote:true,maxSelections:1,createdBy:owner.id,createdAt,updatedAt:createdAt,options:pollOptions,votes:{}}]:[]
        const plan:GroupPlan={id:planId,type:'travel',ownerId:owner.id,title:tripSummary(trip).title,city:trip.city,date:trip.dates.start,startTime:trip.intent.arrivalTime??'',endTime:trip.intent.departureTime??'',budget:trip.budgetLimit??trip.budget,partySize:trip.partySize,interests:trip.intent.preferences,avoidTags:trip.intent.constraints,transportMode:'按日程逐站核对',status:polls.length?'voting':'planned',inviteCode:randomUUID().replaceAll('-',''),participants:[owner],polls,trip,baseDietary:clone(trip.intent.dietary),tripOptions:options,createdAt,updatedAt:createdAt}
        this.data.plans.push(plan);this.publish(plan);return clone(plan)
      }
      const createdAt = now(); const planId = id('plan'); const owner: PlanParticipant = { id: id('participant'), planId, userId: normalizeText(input.owner.userId, 100) || undefined, displayName, avatar: normalizeText(input.owner.avatar, 300) || undefined, role: 'owner', inviteStatus: 'accepted', joinedAt: createdAt }
      const cleanInput = { ...input, city, origin, interests: unique(input.interests.map((item) => normalizeText(item, 30))), avoidTags: unique(input.avoidTags.map((item) => normalizeText(item, 30))) }
      const options = candidatesFor(cleanInput)
      if (options.length < (input.direct ? 1 : 2)) throw new GroupPlanError('NO_CANDIDATES', '当前约束下没有足够候选，请放宽预算或忌口。')
      const deadline = input.deadline && Number.isFinite(Date.parse(input.deadline)) ? input.deadline : undefined
      const poll: Poll = { id: id('poll'), planId, title: input.type === 'dining' ? '大家投一下，今晚吃哪家？' : input.type === 'date' ? '一起选，这次想去哪？' : '一起选个周末计划', type: 'single', status: 'open', allowChangeVote: true, maxSelections: 1, deadline, createdBy: owner.id, createdAt, updatedAt: createdAt, options, votes: {} }
      const plan: GroupPlan = { id: planId, type: input.type, ownerId: owner.id, title: input.type === 'dining' ? `${city}聚餐` : input.type === 'date' ? `${city}约会` : `${city}周末计划`, city, date: input.date, startTime: normalizeText(input.startTime, 5), endTime: normalizeText(input.endTime, 5), budget: input.budget, partySize: input.partySize, interests: cleanInput.interests, avoidTags: cleanInput.avoidTags, transportMode: normalizeText(input.transportMode, 20) || '步行', dateStage: normalizeText(input.dateStage, 30) || undefined, indoorOutdoor: normalizeText(input.indoorOutdoor, 20) || undefined, status: 'voting', inviteCode: randomUUID().replace(/-/g, '').slice(0, 10), participants: [owner], polls: [poll], createdAt, updatedAt: createdAt }
      if (input.direct) {
        plan.candidates = options
        plan.polls = []
        plan.status = 'planned'
        plan.selectedOptionId = options[0].id
        plan.journey = createJourney(plan, options[0])
        plan.journey.stops[0].note = options[0].metadata.reason ?? '按你的偏好生成，出发前确认开放与预约。'
      }
      this.data.plans.push(plan); this.publish(plan); return clone(plan)
    })
  }
  async join(inviteCode: string, user: GroupPlanJoinInput) {
    return this.transaction(() => {
      const plan = this.data.plans.find((item) => item.inviteCode === inviteCode); if (!plan || Date.parse(plan.createdAt) + 7 * 86400000 <= Date.now()) throw new GroupPlanError('NOT_FOUND', '邀请链接已失效。')
      if (plan.status === 'completed' || plan.status === 'cancelled') throw new GroupPlanError('PLAN_CLOSED', '该计划已结束，不能加入。')
      const userId = normalizeText(user.userId, 100); const existing = plan.participants.find((item) => item.userId && item.userId === userId)
      const preferences = {
        ...(Array.isArray(user.activityPreferences) ? { activityPreferences: normalizeList(user.activityPreferences) } : {}),
        ...(Array.isArray(user.foodPreferences) ? { foodPreferences: normalizeList(user.foodPreferences) } : {}),
        ...(typeof user.note === 'string' ? { note: normalizeText(user.note, 500) || undefined } : {}),
      }
      if (existing) { existing.inviteStatus = 'accepted'; existing.joinedAt ??= now(); Object.assign(existing, preferences); refreshDietaryConstraints(plan); plan.updatedAt = now(); this.publish(plan); return clone(plan) }
      if (plan.type!=='travel' && plan.participants.filter((item) => item.inviteStatus === 'accepted').length >= plan.partySize) throw new GroupPlanError('PLAN_FULL', '计划人数已满。')
      const participant: PlanParticipant = { id: id('participant'), planId: plan.id, userId: userId || undefined, displayName: normalizeText(user.displayName, 40) || '朋友', avatar: normalizeText(user.avatar, 300) || undefined, ...preferences, role: 'member', inviteStatus: 'accepted', joinedAt: now() }
      plan.participants.push(participant); refreshDietaryConstraints(plan); plan.updatedAt = now(); this.publish(plan); return clone(plan)
    })
  }
  async vote(pollId: string, participantId: string, optionIds: string[]) {
    return this.transaction(() => {
      const plan = this.data.plans.find((item) => item.polls.some((poll) => poll.id === pollId)); const poll = plan?.polls.find((item) => item.id === pollId)
      if (!plan || !poll) throw new GroupPlanError('NOT_FOUND', '投票不存在。')
      const participant = plan.participants.find((item) => item.id === participantId && item.inviteStatus === 'accepted'); if (!participant) throw new GroupPlanError('FORBIDDEN', '只有已加入计划的成员可以投票。')
      if (!isOpen(poll)) { if (poll.status === 'open') poll.status = 'closed'; throw new GroupPlanError('POLL_CLOSED', '投票已截止。') }
      const wanted = unique(optionIds).filter((optionId) => poll.options.some((option) => option.id === optionId))
      const blocked = poll.options.find(option => wanted.includes(option.id) && option.metadata.blockedReason)
      if (blocked) throw new GroupPlanError('CONSTRAINT_CONFLICT', blocked.metadata.blockedReason!)
      if (wanted.length > poll.maxSelections || (poll.type === 'single' && wanted.length > 1)) throw new GroupPlanError('INVALID_VOTE', '选择数量超过本次投票限制。')
      if (!poll.allowChangeVote && poll.votes[participantId]) throw new GroupPlanError('VOTE_LOCKED', '本次投票不支持修改。')
      if (wanted.length) poll.votes[participantId] = wanted; else delete poll.votes[participantId]
      poll.updatedAt = now(); plan.updatedAt = now(); this.publish(plan); return clone(plan)
    })
  }
  async updateTrip(planId:string,actorId:string,raw:unknown,expectedRevision:number) {
    return this.transaction(()=>{
      const plan=this.requirePlan(planId);this.requireOwner(plan,actorId)
      if(plan.type!=='travel'||!plan.trip)throw new GroupPlanError('INVALID_STATE','此接口仅用于完整旅行协作。')
      if(expectedRevision!==(plan.trip.revision??1))throw new GroupPlanError('VERSION_CONFLICT','共同日程已更新，请重新打开最新版本后修改。')
      const next=parseGeneratedPlans([raw])?.[0]
      if(!next||next.tripId!==plan.id||!next.dates)throw new GroupPlanError('INVALID_INPUT','行程身份或日期无效。')
      plan.trip={...next,revision:(plan.trip.revision??1)+1};plan.city=next.city;plan.date=next.dates.start;plan.partySize=next.partySize;plan.budget=next.budgetLimit??next.budget;plan.title=tripSummary(next).title
      plan.updatedAt=now();this.publish(plan);return clone(plan)
    })
  }
  async createPoll(planId: string, actorId: string, input: { title: string; type: PollType; options: string[]; maxSelections?: number }) {
    return this.transaction(() => {
      const plan = this.requirePlan(planId); this.requireOwner(plan, actorId)
      if (!['single', 'multiple', 'time'].includes(input.type)) throw new GroupPlanError('INVALID_INPUT', '投票类型无效。')
      const labels = unique(input.options.map((item) => normalizeText(item, 60))).slice(0, 8)
      if (labels.length < 2) throw new GroupPlanError('INVALID_INPUT', '至少需要两个候选。')
      const createdAt = now(); const poll: Poll = { id: id('poll'), planId, title: normalizeText(input.title, 80) || '一起选', type: input.type, status: 'open', allowChangeVote: true, maxSelections: input.type === 'multiple' ? Math.max(1, Math.min(input.maxSelections ?? 3, labels.length)) : 1, createdBy: actorId, createdAt, updatedAt: createdAt, options: labels.map((title, order) => ({ id: id('option'), type: input.type === 'time' ? 'time' : 'custom', title, subtitle: input.type === 'multiple' ? '可多选' : undefined, order, createdAt, metadata: { reason: input.type === 'multiple' ? '只选择你可以接受的选项。' : '等待成员投票。' } })), votes: {} }
      plan.polls.push(poll); refreshDietaryConstraints(plan); plan.status = 'voting'; plan.updatedAt = now(); this.publish(plan); return clone(plan)
    })
  }
  async closePoll(planId: string, pollId: string, actorId: string) {
    return this.transaction(() => { const plan = this.requirePlan(planId); this.requireOwner(plan, actorId); const poll = this.requirePoll(plan, pollId); if (poll.status === 'resolved') throw new GroupPlanError('POLL_RESOLVED', '结果已锁定。'); poll.status = 'closed'; poll.updatedAt = now(); plan.updatedAt = now(); this.publish(plan); return clone(plan) })
  }
  async resolve(planId: string, pollId: string, actorId: string, winningOptionId: string, expectedRevision?: number) {
    return this.transaction(() => {
      const plan = this.requirePlan(planId); this.requireOwner(plan, actorId); const poll = this.requirePoll(plan, pollId)
      if(plan.type==='travel' && plan.trip) {
        if(poll.status==='resolved'&&poll.winningOptionId===winningOptionId)return clone(plan)
        if(expectedRevision!==(plan.revision??1))throw new GroupPlanError('VERSION_CONFLICT','成员或投票已更新，请刷新后重新确认。')
        const option=plan.tripOptions?.find(item=>(item.optionId??item.id)===winningOptionId)
        if(!option || !poll.options.some(item=>item.id===winningOptionId))throw new GroupPlanError('INVALID_OPTION','本轮没有这套路线。')
        const blocked=poll.options.find(item=>item.id===winningOptionId)?.metadata.blockedReason
        if(blocked)throw new GroupPlanError('CONSTRAINT_CONFLICT',blocked)
        if(plan.trip.execution?.length || ['active','paused','completed','archived'].includes(plan.trip.status??''))throw new GroupPlanError('INVALID_STATE','已开始的行程不能整套替换，请使用局部修改。')
        const protectedStops=Object.values(plan.trip.days).flat().filter(stop=>stop.fixed)
        if(protectedStops.some(stop=>!Object.values(option.days).flat().some(next=>next.name===stop.name&&next.time===stop.time)))throw new GroupPlanError('CONSTRAINT_CONFLICT','新方案改变了锁定站点，请先明确解除锁定后再决定。')
        plan.trip=updateGeneratedPlan({...option,tripId:plan.id,savedAt:plan.trip.savedAt,revision:plan.trip.revision,originOptionId:option.optionId??option.id,status:'planned'},option.days)
        poll.status='resolved';poll.winningOptionId=winningOptionId;poll.resolvedRevision=(plan.revision??1)+1;poll.updatedAt=now();plan.selectedOptionId=winningOptionId;plan.status='planned';plan.updatedAt=now();this.publish(plan);return clone(plan)
      }
      if (!poll.options.some((option) => option.id === winningOptionId)) throw new GroupPlanError('INVALID_OPTION', '请选择本次投票中的候选。')
      const winner = poll.options.find((option) => option.id === winningOptionId)!
      if (winner.metadata.blockedReason) throw new GroupPlanError('CONSTRAINT_CONFLICT', winner.metadata.blockedReason)
      if (poll.status === 'resolved') {
        if (poll.winningOptionId === winningOptionId) return clone(plan)
        throw new GroupPlanError('POLL_RESOLVED', '结果已锁定，请重新开启投票后再修改。')
      }
      if (expectedRevision !== undefined && expectedRevision !== (plan.revision ?? 1)) throw new GroupPlanError('VERSION_CONFLICT', '成员或投票已更新，请刷新计划后重新确认。')
      poll.resolvedRevision = (plan.revision ?? 1) + 1
      poll.status = 'resolved'; poll.winningOptionId = winningOptionId; poll.updatedAt = now()
      if (poll.type === 'multiple') {
        plan.status = 'voting'
      } else if (plan.type === 'dining' && poll.type === 'single' && !plan.polls.some((item) => item.type === 'time')) {
        const createdAt = now(); const hours = ['18:30', '19:00', '19:30']
        plan.polls.push({ id: id('poll'), planId: plan.id, title: '再一起定个时间', type: 'time', status: 'open', allowChangeVote: true, maxSelections: 1, createdBy: actorId, createdAt, updatedAt: createdAt, options: hours.map((time, order) => ({ id: id('option'), type: 'time', title: time, subtitle: `${plan.date} · 可参加`, order, createdAt, metadata: { reason: '选择你方便参加的时间。' } })), votes: {} })
        plan.status = 'voting'; plan.selectedOptionId = winningOptionId
      } else {
        const restaurant = poll.type === 'time' ? plan.polls.find((item) => item.type === 'single' && item.status === 'resolved')?.options.find((item) => item.id === plan.selectedOptionId) : winner
        if (!restaurant) throw new GroupPlanError('INVALID_STATE', '请先确定餐厅，再确定时间。')
        if (restaurant.metadata.blockedReason) throw new GroupPlanError('CONSTRAINT_CONFLICT', restaurant.metadata.blockedReason)
        if (poll.type === 'time') plan.startTime = winner.title
        plan.status = 'planned'; plan.selectedOptionId = restaurant.id; plan.journey = { ...createJourney(plan, restaurant), planId: plan.id, revision: poll.resolvedRevision }
      }
      plan.updatedAt = now(); this.publish(plan); return clone(plan)
    })
  }
  async reopen(planId: string, pollId: string, actorId: string) {
    return this.transaction(() => { const plan = this.requirePlan(planId); this.requireOwner(plan, actorId); const poll = this.requirePoll(plan, pollId); poll.status = 'open'; poll.votes = {}; delete poll.winningOptionId; delete poll.resolvedRevision; poll.updatedAt = now(); plan.status = 'voting'; delete plan.selectedOptionId; delete plan.journey; plan.updatedAt = now(); this.publish(plan); return clone(plan) })
  }
  async leave(planId: string, participantId: string) {
    return this.transaction(() => { const plan = this.requirePlan(planId); const participant = plan.participants.find((item) => item.id === participantId); if (!participant || participant.role === 'owner') throw new GroupPlanError('FORBIDDEN', '组织者不能通过此操作退出计划。'); participant.inviteStatus = 'left'; plan.polls.forEach((poll) => delete poll.votes[participantId]); refreshDietaryConstraints(plan); plan.updatedAt = now(); this.publish(plan); return clone(plan) })
  }
  private requirePlan(id: string) { const plan = this.data.plans.find((item) => item.id === id); if (!plan) throw new GroupPlanError('NOT_FOUND', '计划不存在。'); return plan }
  private requirePoll(plan: GroupPlan, id: string) { const poll = plan.polls.find((item) => item.id === id); if (!poll) throw new GroupPlanError('NOT_FOUND', '投票不存在。'); return poll }
  private requireOwner(plan: GroupPlan, actorId: string) { if (plan.ownerId !== actorId) throw new GroupPlanError('FORBIDDEN', '只有组织者可以执行此操作。') }
}

export const groupPlans = new GroupPlanRepository()
