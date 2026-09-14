import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleCloudGroupPlans } from './group-plans'
import type { CloudDatabase, CloudStatement } from './database'
import { GroupPlanRepository } from '../group-plans'
import { generatePlans, understandTrip, type GeneratedPlan } from '../../src/services/trip/planner'
import { collaborationSnapshot } from '../../src/services/trip/collaborationSnapshot'
import { parseGroupPlan, parseGroupPlanEvent } from '../../src/services/groupPlanSchemas'
import type { GroupPlan, GroupPlanInput } from '../../src/services/groupPlans'

const migration = readFileSync(new URL('../../migrations/0003_group_plans.sql', import.meta.url), 'utf8')
class Statement implements CloudStatement {
  constructor(readonly db: Adapter, readonly sql: string, readonly values: unknown[] = []) {}
  bind(...values: unknown[]) { return new Statement(this.db, this.sql, values) }
  execute<T>() { return { results: this.db.sqlite.prepare(this.sql).all(...this.values as SQLInputValue[]) as T[], success: true } }
  async first<T>() { return this.execute<T>().results[0] ?? null }
  async all<T>() { return this.execute<T>() }
  async run() { return { ...this.execute(), meta: {} } }
}
class Adapter implements CloudDatabase {
  sqlite = new DatabaseSync(':memory:')
  failAfterWrite = false
  rejectWrites = false
  constructor() { this.sqlite.exec(migration) }
  prepare(sql: string) { return new Statement(this, sql) }
  async batch(statements: CloudStatement[]) {
    this.sqlite.exec('BEGIN IMMEDIATE')
    try {
      const results = statements.map(statement => {
        if (!(statement instanceof Statement)) throw Error('foreign statement')
        const result = this.rejectWrites && statement.sql.startsWith('UPDATE') ? { results: [], success: true } : statement.execute()
        if (this.failAfterWrite && /^(UPDATE|INSERT)/.test(statement.sql)) throw Error('private D1 diagnostics')
        return result
      })
      this.sqlite.exec('COMMIT'); return results
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error }
  }
}
const databases: Adapter[] = [], repositories: GroupPlanRepository[] = []
const open = () => { const db = new Adapter(); databases.push(db); return db }
const clone = <T>(input: T): T => JSON.parse(JSON.stringify(input))
const options = generatePlans(understandTrip({ text: '2026年9月18日去上海玩1天，2个人，预算2000元。', media: [] }).intent)
function fixture(withPoll = false): GroupPlanInput {
  const trip: GeneratedPlan = { ...clone(options[0]), tripId: randomUUID(), revision: 1, savedAt: '2026-09-14T08:00:00.000Z', status: 'planned' }
  return { type: 'travel', trip: collaborationSnapshot(trip), ...(withPoll ? { tripOptions: clone(options) } : {}), city: trip.city, date: trip.dates!.start, startTime: '', endTime: '', partySize: trip.partySize, budget: trip.budget, interests: [], avoidTags: [], transportMode: '地铁', owner: { userId: 'forged', displayName: '组织者' } }
}
const url = (path: string) => `https://test.invalid/api/group-plans${path}`
async function call(db: CloudDatabase, actor: string, path: string, method = 'GET', body?: unknown) {
  const response = await handleCloudGroupPlans(new Request(url(path), { method, body: body === undefined ? undefined : JSON.stringify(body) }), db, actor)
  return { status: response.status, data: await response.json() as GroupPlan & { error?: string; message?: string } }
}
async function create(db: CloudDatabase, input = fixture()) {
  const result = await call(db, 'owner', '', 'POST', input)
  expect(result.status, JSON.stringify(result.data)).toBe(201)
  expect(parseGroupPlan(result.data)).not.toBeNull()
  return result.data
}
const comparable = (plan: GroupPlan) => JSON.parse(JSON.stringify({ ...plan, inviteCode: 'invite' }).replace(/(?:participant|poll)_[a-f0-9-]{36}/g, 'generated-id'))
afterEach(() => { databases.splice(0).forEach(db => db.sqlite.close()); repositories.splice(0).forEach(repo => repo.close()); vi.useRealTimers(); vi.restoreAllMocks() })

describe('cloud travel group contract', () => {
  it('persists real snapshots only, accepts existing frontend parser and never trusts submitted owner', async () => {
    const db = open(); db.sqlite.exec(migration)
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM cloud_group_plans').get()!.n).toBe(0)
    const input = fixture(), plan = await create(db, input)
    expect(plan.id).toBe(input.trip!.tripId)
    expect(plan.participants[0]).toMatchObject({ userId: 'owner', role: 'owner', inviteStatus: 'accepted' })
    expect(plan.trip!.sourceGroup).toMatchObject({ planId: plan.id, revision: 1, tripRevision: 1 })
    expect((await call(db, 'owner', `/${plan.id}`)).data).toEqual(plan)
    expect((await call(db, 'forged', `/${plan.id}`)).status).toBe(403)
  })
  it('matches original repository create, join, dietary revision, update, leave and revoke semantics', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-14T09:00:00Z'))
    const db = open(), repo = new GroupPlanRepository(':memory:'); repositories.push(repo)
    const input = fixture(), cloud = await create(db, input)
    let local = await repo.create({ ...input, owner: { ...input.owner, userId: 'owner' } })
    expect(comparable(cloud)).toEqual(comparable(local))
    const preferences = { displayName: '朋友', foodPreferences: ['不吃辣'], note: '花生过敏', activityPreferences: ['看展'] }
    let next = (await call(db, 'friend', `/invite/${cloud.inviteCode}/join`, 'POST', { ...preferences, userId: 'forged', actorId: cloud.ownerId })).data
    local = await repo.join(local.inviteCode, { ...preferences, userId: 'friend' })
    expect(comparable(next)).toEqual(comparable(local))
    const trip = clone(next.trip!); trip.days[Object.keys(trip.days)[0]][0].note = 'updated shared note'
    next = (await call(db, 'owner', `/${cloud.id}/trip`, 'PUT', { trip, expectedRevision: next.trip!.revision })).data
    local = await repo.updateTrip(local.id, local.ownerId, trip, local.trip!.revision!)
    expect(comparable(next)).toEqual(comparable(local))
    next = (await call(db, 'friend', `/${cloud.id}/leave`, 'POST', { participantId: cloud.ownerId })).data
    local = await repo.leave(local.id, local.participants.find(m => m.userId === 'friend')!.id)
    expect(comparable(next)).toEqual(comparable(local))
    next = (await call(db, 'owner', `/${cloud.id}/revoke-invite`, 'POST', {})).data
    local = await repo.revokeInvite(local.id, local.ownerId)
    expect(comparable(next)).toEqual(comparable(local))
  })
  it('supports create retries and disallows another session taking an existing trip ID', async () => {
    const db = open(), input = fixture()
    const results = await Promise.all(Array.from({ length: 4 }, () => call(db, 'owner', '', 'POST', input)))
    expect(results.every(r => r.status === 201 && r.data.revision === 1)).toBe(true)
    expect(new Set(results.map(r => r.data.inviteCode)).size).toBe(1)
    expect((await call(db, 'attacker', '', 'POST', input)).status).toBe(403)
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM cloud_group_plans').get()!.n).toBe(1)
  })
  it('checks accepted membership for reads, updates, polling and all owner operations', async () => {
    const db = open(), plan = await create(db)
    for (const path of [`/${plan.id}`, `/${plan.id}/events`]) expect((await call(db, 'outsider', path)).status).toBe(403)
    await call(db, 'friend', `/invite/${plan.inviteCode}/join`, 'POST', { displayName: '朋友' })
    expect((await call(db, 'friend', `/${plan.id}/trip`, 'PUT', { trip: plan.trip, expectedRevision: 1, actorId: plan.ownerId })).status).toBe(403)
    expect((await call(db, 'friend', `/${plan.id}/revoke-invite`, 'POST', { actorId: plan.ownerId })).status).toBe(403)
    expect((await call(db, 'friend', `/${plan.id}/polls`, 'POST', { title: '伪造', options: ['a', 'b'], actorId: plan.ownerId })).status).toBe(403)
    expect((await call(db, 'owner', `/${plan.id}/leave`, 'POST', {})).status).toBe(403)
    expect((await call(db, 'friend', `/${plan.id}/leave`, 'POST', { participantId: plan.ownerId })).status).toBe(200)
    expect((await call(db, 'friend', `/${plan.id}`)).status).toBe(403)
    expect((await call(db, 'friend', `/${plan.id}/leave`, 'POST', {})).status).toBe(403)
    expect((await call(db, 'friend', `/invite/${plan.inviteCode}/join`, 'POST', { displayName: 'rejoin' })).data.participants.filter(m => m.userId === 'friend')).toHaveLength(1)
  })
  it('reads invite snapshots before joining, expires in seven days and rotates the old link', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-14T09:00:00Z'))
    const db = open(), plan = await create(db)
    expect((await call(db, 'guest', `/invite/${plan.inviteCode}`)).data).toEqual(plan)
    const rotated = (await call(db, 'owner', `/${plan.id}/revoke-invite`, 'POST', {})).data
    expect(rotated.inviteCode).not.toBe(plan.inviteCode)
    expect((await call(db, 'guest', `/invite/${plan.inviteCode}`)).status).toBe(404)
    expect((await call(db, 'guest', `/invite/${plan.inviteCode}/join`, 'POST', {})).status).toBe(404)
    expect((await call(db, 'guest', `/invite/${rotated.inviteCode}/join`, 'POST', {})).status).toBe(200)
    vi.setSystemTime(new Date('2026-09-21T09:00:00Z'))
    expect((await call(db, 'guest', `/invite/${rotated.inviteCode}`)).status).toBe(404)
    expect((await call(db, 'guest', `/invite/${rotated.inviteCode}/join`, 'POST', {})).status).toBe(404)
    expect((await call(db, 'owner', `/${plan.id}`)).status).toBe(200)
  })
  it('keeps accepted participants distinct during concurrent joins and preserves member preferences', async () => {
    const db = open(), plan = await create(db)
    const users = ['a', 'b', 'c', 'd']
    const results = await Promise.all(users.map(actor => call(db, actor, `/invite/${plan.inviteCode}/join`, 'POST', { displayName: actor, activityPreferences: [actor] })))
    expect(results.map(r => r.status)).toEqual([200, 200, 200, 200])
    const latest = (await call(db, 'owner', `/${plan.id}`)).data
    expect(latest.participants).toHaveLength(5) // Travel membership is not capped by partySize.
    expect(new Set(latest.participants.map(m => m.id)).size).toBe(5)
    expect(latest.revision).toBe(5)
    const retry = await Promise.all(Array.from({ length: 3 }, () => call(db, 'a', `/invite/${plan.inviteCode}/join`, 'POST', { displayName: 'ignored on existing member', foodPreferences: ['不吃辣'] })))
    expect(retry.every(r => r.status === 200)).toBe(true)
    const after = (await call(db, 'owner', `/${plan.id}`)).data
    expect(after.participants.filter(m => m.userId === 'a')).toHaveLength(1)
    expect(after.trip!.intent.dietary.avoidSpicy).toBe(true)
    expect(after.trip!.sourceGroup!.tripRevision).toBe(after.trip!.revision)
  })
  it('allows only one concurrent trip edit per expected revision and preserves CAS failure state', async () => {
    const db = open(), plan = await create(db)
    const results = await Promise.all(['first', 'second'].map(note => {
      const trip = clone(plan.trip!); trip.days[Object.keys(trip.days)[0]][0].note = note
      return call(db, 'owner', `/${plan.id}/trip`, 'PUT', { trip, expectedRevision: 1 })
    }))
    expect(results.map(r => r.status).sort()).toEqual([200, 409])
    const latest = (await call(db, 'owner', `/${plan.id}`)).data
    expect(latest.revision).toBe(2); expect(latest.trip!.revision).toBe(2)
    expect((await call(db, 'owner', `/${plan.id}/trip`, 'PUT', { trip: plan.trip, expectedRevision: 1 })).data.error).toBe('VERSION_CONFLICT')
    db.rejectWrites = true
    expect((await call(db, 'reader', `/invite/${plan.inviteCode}/join`, 'POST', {})).data.error).toBe('VERSION_CONFLICT')
    db.rejectWrites = false
    expect((await call(db, 'owner', `/${plan.id}`)).data.participants).toHaveLength(1)
  })
  it('returns 410 for removed types and meaningful errors for malformed input and unknown routes', async () => {
    const db = open()
    for (const type of ['weekend', 'date', 'dining']) expect(await call(db, 'owner', '', 'POST', { type })).toMatchObject({ status: 410, data: { error: 'FEATURE_REMOVED' } })
    expect((await call(db, 'owner', '', 'POST', { type: 'unknown' })).status).toBe(400)
    expect((await call(db, 'owner', '', 'POST', { ...fixture(), trip: {} })).status).toBe(400)
    expect((await call(db, 'owner', '', 'POST', { ...fixture(), date: 'bad' })).status).toBe(400)
    expect((await call(db, 'owner', '', 'POST', { ...fixture(), partySize: 0 })).status).toBe(400)
    expect((await call(db, 'owner', '', 'POST', { ...fixture(), budget: -1 })).status).toBe(400)
    expect((await call(db, 'owner', '/missing')).status).toBe(404)
    const plan = await create(db)
    expect((await call(db, 'owner', `/${plan.id}/unknown`, 'POST', {})).status).toBe(404)
    expect((await call(db, 'owner', `/${plan.id}/trip`, 'PUT', { expectedRevision: 1, trip: { ...plan.trip, tripId: 'foreign' } })).status).toBe(400)
    for (const raw of ['[]', 'null', '{']) expect((await handleCloudGroupPlans(new Request(url(''), { method: 'POST', body: raw }), db, 'owner')).status).toBe(400)
    expect((await handleCloudGroupPlans(new Request(url(''), { method: 'POST', body: 'x'.repeat(1_000_001) }), db, 'owner')).status).toBe(413)
  })
  it('serializes invite revocation against joins and never accepts a revoked link afterward', async () => {
    for (const revokeFirst of [true, false]) {
      const db = open(), plan = await create(db)
      const revoke = () => call(db, 'owner', `/${plan.id}/revoke-invite`, 'POST', {})
      const join = () => call(db, 'friend', `/invite/${plan.inviteCode}/join`, 'POST', {})
      const results = await Promise.all((revokeFirst ? [revoke, join] : [join, revoke]).map(action => action()))
      const joined = results[revokeFirst ? 1 : 0]
      expect([200, 404]).toContain(joined.status)
      const latest = (await call(db, 'owner', `/${plan.id}`)).data
      expect(latest.inviteCode).not.toBe(plan.inviteCode)
      expect(latest.participants).toHaveLength(joined.status === 200 ? 2 : 1)
      expect((await call(db, 'newcomer', `/invite/${plan.inviteCode}/join`, 'POST', {})).status).toBe(404)
    }
  })
  it('keeps concurrent dietary joins and trip edits coherent and refuses closed-plan joins', async () => {
    const db = open(), plan = await create(db)
    const results = await Promise.all([
      call(db, 'friend', `/invite/${plan.inviteCode}/join`, 'POST', { foodPreferences: ['不吃辣'] }),
      call(db, 'owner', `/${plan.id}/trip`, 'PUT', { trip: plan.trip, expectedRevision: 1 }),
    ])
    expect(results[0].status).toBe(200); expect([200, 409]).toContain(results[1].status)
    const latest = (await call(db, 'owner', `/${plan.id}`)).data
    expect(latest.participants).toHaveLength(2)
    expect(latest.trip!.intent.dietary.avoidSpicy).toBe(true)
    expect(latest.trip!.sourceGroup!.tripRevision).toBe(latest.trip!.revision)
    expect(latest.trip!.sourceGroup!.revision).toBe(latest.revision)
    const closed = { ...latest, status: 'completed' }
    db.sqlite.prepare('UPDATE cloud_group_plans SET payload=? WHERE id=?').run(JSON.stringify(closed), plan.id)
    expect((await call(db, 'other', `/invite/${plan.inviteCode}/join`, 'POST', {})).data.error).toBe('PLAN_CLOSED')
  })
  it('rolls back writes on D1 failures, masks storage errors and permits retry', async () => {
    const db = open(), input = fixture(); db.failAfterWrite = true
    expect((await call(db, 'owner', '', 'POST', input))).toMatchObject({ status: 500, data: { error: 'GROUP_PLAN_FAILED', message: '计划服务暂时不可用。' } })
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM cloud_group_plans').get()!.n).toBe(0)
    db.failAfterWrite = false
    const plan = await create(db, input); db.failAfterWrite = true
    expect((await call(db, 'friend', `/invite/${plan.inviteCode}/join`, 'POST', {})).status).toBe(500)
    db.failAfterWrite = false
    expect((await call(db, 'owner', `/${plan.id}`)).data).toEqual(plan)
    expect((await call(db, 'friend', `/invite/${plan.inviteCode}/join`, 'POST', {})).status).toBe(200)
  })
})

describe('cloud travel polls and SSE', () => {
  it('persists simultaneous member votes and owner-only close/reopen, without trusting participant IDs', async () => {
    const db = open(), plan = await create(db, fixture(true)), poll = plan.polls[0]
    expect(poll).toBeDefined()
    await call(db, 'a', `/invite/${plan.inviteCode}/join`, 'POST', {})
    await call(db, 'b', `/invite/${plan.inviteCode}/join`, 'POST', {})
    const results = await Promise.all(['a', 'b'].map(actor => call(db, actor, `/${plan.id}/polls/${poll.id}/vote`, 'PUT', { participantId: plan.ownerId, optionIds: [poll.options[0].id] })))
    expect(results.every(r => r.status === 200)).toBe(true)
    const latest = (await call(db, 'owner', `/${plan.id}`)).data
    expect(Object.keys(latest.polls[0].votes)).toHaveLength(2)
    expect(latest.polls[0].votes).not.toHaveProperty(plan.ownerId)
    expect((await call(db, 'a', `/${plan.id}/polls/${poll.id}/close`, 'POST', { actorId: plan.ownerId })).status).toBe(403)
    expect((await call(db, 'owner', `/${plan.id}/polls/${poll.id}/close`, 'POST', {})).status).toBe(200)
    expect((await call(db, 'a', `/${plan.id}/polls/${poll.id}/vote`, 'PUT', { optionIds: [poll.options[0].id] })).data.error).toBe('POLL_CLOSED')
    const reopened = (await call(db, 'owner', `/${plan.id}/polls/${poll.id}/reopen`, 'POST', {})).data
    expect(reopened.polls[0]).toMatchObject({ status: 'open', votes: {} })
    expect((await call(db, 'a', `/${plan.id}/polls/foreign/vote`, 'PUT', {})).status).toBe(404)
  })
  it('matches original whole-trip resolution and its retry/version protections', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-14T09:00:00Z'))
    const db = open(), input = fixture(true), cloud = await create(db, input)
    const repo = new GroupPlanRepository(':memory:'); repositories.push(repo)
    let local = await repo.create({ ...input, owner: { ...input.owner, userId: 'owner' } })
    const winningOptionId = cloud.polls[0].options[1].id
    expect((await call(db, 'owner', `/${cloud.id}/polls/${cloud.polls[0].id}/resolve`, 'POST', { winningOptionId, expectedRevision: 99 })).data.error).toBe('VERSION_CONFLICT')
    const resolved = (await call(db, 'owner', `/${cloud.id}/polls/${cloud.polls[0].id}/resolve`, 'POST', { winningOptionId, expectedRevision: cloud.revision })).data
    local = await repo.resolve(local.id, local.polls[0].id, local.ownerId, winningOptionId, local.revision)
    expect(comparable(resolved)).toEqual(comparable(local))
    expect(parseGroupPlan(resolved)).not.toBeNull()
    const retry = (await call(db, 'owner', `/${cloud.id}/polls/${cloud.polls[0].id}/resolve`, 'POST', { winningOptionId, expectedRevision: cloud.revision })).data
    expect(retry).toEqual(resolved)
    expect((await call(db, 'owner', `/${cloud.id}/polls/${cloud.polls[0].id}/close`, 'POST', {})).data.error).toBe('POLL_RESOLVED')
  })
  it('supports travel custom polls and keeps existing unsupported custom-route resolution explicit', async () => {
    const db = open(), plan = await create(db)
    const result = await call(db, 'owner', `/${plan.id}/polls`, 'POST', { title: '时间意向', type: 'multiple', options: ['上午', '下午', '晚上'], maxSelections: 2 })
    expect(result.status).toBe(201); expect(parseGroupPlan(result.data)).not.toBeNull()
    const poll = result.data.polls[0]
    expect((await call(db, 'owner', `/${plan.id}/polls/${poll.id}/vote`, 'PUT', { optionIds: poll.options.map(o => o.id) })).data.error).toBe('INVALID_VOTE')
    expect((await call(db, 'owner', `/${plan.id}/polls/${poll.id}/resolve`, 'POST', { expectedRevision: result.data.revision, winningOptionId: poll.options[0].id })).data.error).toBe('INVALID_OPTION')
  })
  it('invalidates a voted route when a joined member adds a conflicting dietary restriction', async () => {
    const db = open(), input = fixture(true)
    const option = input.tripOptions![1], day = Object.keys(option.days)[0]
    option.days[day][0] = { ...option.days[day][0], name: '辣椒虾仁', type: '午餐', dietaryTags: ['spicy', 'seafood'] }
    const plan = await create(db, input), poll = plan.polls[0], optionId = poll.options[1].id
    expect((await call(db, 'owner', `/${plan.id}/polls/${poll.id}/vote`, 'PUT', { optionIds: [optionId] })).status).toBe(200)
    const joined = (await call(db, 'friend', `/invite/${plan.inviteCode}/join`, 'POST', { foodPreferences: ['不吃辣', '海鲜过敏'] })).data
    expect(joined.polls[0].options[1].metadata.blockedReason).toContain('饮食限制')
    expect(joined.polls[0].votes).not.toHaveProperty(plan.ownerId)
    expect((await call(db, 'owner', `/${plan.id}/polls/${poll.id}/vote`, 'PUT', { optionIds: [optionId] })).data.error).toBe('CONSTRAINT_CONFLICT')
    expect((await call(db, 'owner', `/${plan.id}/polls/${poll.id}/resolve`, 'POST', { expectedRevision: joined.revision, winningOptionId: optionId })).data.error).toBe('CONSTRAINT_CONFLICT')
  })
  it('blocks replacing started trips and fixed stops rather than silently rewriting them', async () => {
    const db = open(), input = fixture(true); input.trip!.status = 'active'
    const plan = await create(db, input), poll = plan.polls[0]
    expect((await call(db, 'owner', `/${plan.id}/polls/${poll.id}/resolve`, 'POST', { expectedRevision: plan.revision, winningOptionId: poll.options[1].id })).data.error).toBe('INVALID_STATE')
    const fixed = fixture(true), firstDay = Object.keys(fixed.trip!.days)[0]
    fixed.trip!.days[firstDay][0] = { ...fixed.trip!.days[firstDay][0], fixed: true, name: '用户锁定的独立集合点' }
    const locked = await create(db, fixed)
    expect((await call(db, 'owner', `/${locked.id}/polls/${locked.polls[0].id}/resolve`, 'POST', { expectedRevision: locked.revision, winningOptionId: locked.polls[0].options[1].id })).data.error).toBe('CONSTRAINT_CONFLICT')
  })
  it('streams parseable events, polls updated revisions, closes on membership loss and cancels timers', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-14T09:00:00Z'))
    const db = open(), plan = await create(db)
    const joined = (await call(db, 'friend', `/invite/${plan.inviteCode}/join`, 'POST', {})).data
    const abort = new AbortController()
    const response = await handleCloudGroupPlans(new Request(url(`/${plan.id}/events`), { signal: abort.signal }), db, 'friend')
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const reader = response.body!.getReader(), decoder = new TextDecoder()
    expect(decoder.decode((await reader.read()).value)).toContain('retry: 3000')
    const frame = decoder.decode((await reader.read()).value)
    expect(parseGroupPlanEvent(JSON.parse(frame.slice(6).trim()))!.plan.revision).toBe(joined.revision)
    await call(db, 'owner', `/${plan.id}/trip`, 'PUT', { trip: joined.trip, expectedRevision: joined.trip!.revision })
    await vi.advanceTimersByTimeAsync(3000)
    const update = decoder.decode((await reader.read()).value)
    expect(parseGroupPlanEvent(JSON.parse(update.slice(6).trim()))!.plan.revision).toBe(joined.revision! + 1)
    await call(db, 'friend', `/${plan.id}/leave`, 'POST', {})
    await vi.advanceTimersByTimeAsync(3000)
    expect((await reader.read()).done).toBe(true)
    abort.abort()
    const ownerStream = await handleCloudGroupPlans(new Request(url(`/${plan.id}/events`)), db, 'owner')
    await ownerStream.body!.cancel()
    expect(vi.getTimerCount()).toBe(0)
    const aborted = new AbortController()
    const pending = await handleCloudGroupPlans(new Request(url(`/${plan.id}/events`), { signal: aborted.signal }), db, 'owner')
    aborted.abort()
    await pending.body!.cancel()
    expect(vi.getTimerCount()).toBe(0)
  })
})
