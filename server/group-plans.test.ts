import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GroupPlanError, GroupPlanRepository } from './group-plans'
import type { GroupPlanInput } from '../src/services/groupPlans'
import { parseGroupPlan } from '../src/services/groupPlanSchemas'

const folders: string[] = []
const repositories: GroupPlanRepository[] = []
afterEach(async () => { repositories.splice(0).forEach((repo) => repo.close()); await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true }))) })

async function repository() {
  const folder = await mkdtemp(join(tmpdir(), 'zouzou-poll-')); folders.push(folder)
  const repo = new GroupPlanRepository(join(folder, 'plans.sqlite')); repositories.push(repo); return repo
}
function input(overrides: Partial<GroupPlanInput> = {}): GroupPlanInput {
  return { type: 'dining', city: '上海', date: '2026-09-05', startTime: '19:00', endTime: '22:00', budget: 200, partySize: 4, interests: ['火锅'], avoidTags: [], transportMode: '地铁', owner: { userId: 'owner-user', displayName: '组织者' }, ...overrides }
}

describe('persistent group plan poll', () => {
  it.each(['weekend', 'date', 'dining'] as const)('generates %s directly without polls', async type => {
    const repo = await repository()
    const plan = await repo.create(input({ type, direct: true }))
    expect(plan.status).toBe('planned')
    expect(plan.polls).toEqual([])
    expect(plan.journey?.stops[0].name).toBe(plan.candidates?.[0].title)
    expect(parseGroupPlan(plan)).not.toBeNull()
  })
  it('uses an explicitly shared location to resolve the nearby city and rank nearby plans', async () => {
    const repo = await repository()
    const plan = await repo.create(input({
      type: 'date',
      city: '北京',
      interests: ['夜景'],
      origin: { latitude: 31.2393, longitude: 121.4902, accuracy: 36.4 },
    }))
    expect(plan.city).toBe('上海')
    expect(plan).not.toHaveProperty('origin')
    expect(plan.polls[0].options[0]).toMatchObject({ title: '外滩', metadata: { distanceKm: 0 } })
    expect(plan.polls[0].options[0].subtitle).toContain('距你约')
    expect(plan.polls[0].options[0].metadata.reason).toContain('实际路线请用地图确认')
    expect(parseGroupPlan(plan)).not.toBeNull()
  })

  it('falls back to the selected city when the shared location is outside supported nearby coverage', async () => {
    const repo = await repository()
    const plan = await repo.create(input({ city: '上海', origin: { latitude: 40.7128, longitude: -74.006 } }))
    expect(plan.city).toBe('上海')
    expect(plan).not.toHaveProperty('origin')
    expect(plan.polls[0].options.every(option => option.metadata.distanceKm === undefined)).toBe(true)
  })

  it('offers distinct named restaurants rather than several dishes from the same shop', async () => {
    const repo = await repository()
    const plan = await repo.create(input({ interests: ['中餐'], budget: 150 }))
    const names = plan.polls[0].options.map(option => option.title)
    expect(names.length).toBeGreaterThanOrEqual(2)
    expect(new Set(names.map(name => name.split('｜')[0])).size).toBe(names.length)
    expect(names).toEqual(expect.arrayContaining(['大壶春', '味香斋']))
    expect(names.some(name => name.includes('｜') || name.includes('附近'))).toBe(false)
  })
  it('rejects a stale decision after another member changes the plan', async () => {
    const repo = await repository(); const plan = await repo.create(input({ type: 'date' }))
    const poll = plan.polls[0]
    const joined = await repo.join(plan.inviteCode, { userId: 'friend', displayName: '朋友', activityPreferences: ['咖啡'] })
    await expect(repo.resolve(plan.id, poll.id, plan.ownerId, poll.options[0].id, plan.revision)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
    expect(await repo.get(plan.id)).toEqual(joined)
  })

  it('locks resolved results, retries idempotently, and binds the journey to the committed revision', async () => {
    const repo = await repository(); const plan = await repo.create(input({ type: 'date' }))
    const poll = plan.polls[0]
    const decided = await repo.resolve(plan.id, poll.id, plan.ownerId, poll.options[0].id, plan.revision)
    expect(decided.revision).toBeGreaterThan(plan.revision!)
    expect(decided.journey).toMatchObject({ planId: plan.id, revision: decided.revision })
    expect(decided.polls[0].resolvedRevision).toBe(decided.revision)
    const retry = await repo.resolve(plan.id, poll.id, plan.ownerId, poll.options[0].id, plan.revision)
    expect(retry).toEqual(decided)
    const reloaded = new GroupPlanRepository((repo as unknown as { storePath: string }).storePath); repositories.push(reloaded)
    expect(parseGroupPlan(await reloaded.get(plan.id))).toEqual(decided)
    await expect(repo.resolve(plan.id, poll.id, plan.ownerId, poll.options[1].id, decided.revision)).rejects.toMatchObject({ code: 'POLL_RESOLVED' })
    expect(await repo.get(plan.id)).toEqual(decided)
    const reopened = await repo.reopen(plan.id, poll.id, plan.ownerId)
    expect(reopened.journey).toBeUndefined()
    expect(reopened.polls[0].resolvedRevision).toBeUndefined()
    await expect(repo.resolve(plan.id, poll.id, plan.ownerId, poll.options[0].id, decided.revision)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  })

  it('serializes competing decisions so only one result is committed', async () => {
    const repo = await repository(); const plan = await repo.create(input({ type: 'date' }))
    const poll = plan.polls[0]
    const results = await Promise.allSettled(poll.options.slice(0, 2).map(option => repo.resolve(plan.id, poll.id, plan.ownerId, option.id, plan.revision)))
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    const stored = await repo.get(plan.id)
    expect(stored.revision).toBe(plan.revision! + 1)
    expect(stored.journey?.revision).toBe(stored.revision)
  })

  it('updates restrictions, preserves compatible multiple votes and does not restore invalidated votes on leave', async () => {
    const repo = await repository(); const plan = await repo.create(input({ partySize: 6 }))
    const custom = await repo.createPoll(plan.id, plan.ownerId, { title: '菜系', type: 'multiple', options: ['花生甜品', '海鲜', '蔬菜'], maxSelections: 3 })
    const poll = custom.polls.at(-1)!; const [peanut, seafood, vegetables] = poll.options
    await repo.vote(poll.id, plan.ownerId, [peanut.id, seafood.id, vegetables.id])
    const joined = await repo.join(plan.inviteCode, { userId: 'friend', displayName: '朋友', foodPreferences: ['喜欢海鲜'], note: '花生过敏' })
    expect(joined.polls.at(-1)?.votes[plan.ownerId]).toEqual([seafood.id, vegetables.id])
    expect(parseGroupPlan(joined)?.polls.at(-1)?.options[0].metadata.blockedReason).toContain('过敏原')
    const updated = await repo.join(plan.inviteCode, { userId: 'friend', displayName: '朋友', foodPreferences: ['不吃海鲜'] })
    expect(updated.polls.at(-1)?.votes[plan.ownerId]).toEqual([vegetables.id])
    const left = await repo.leave(plan.id, joined.participants.find(member => member.userId === 'friend')!.id)
    expect(left.polls.at(-1)?.options.every(option => !option.metadata.blockedReason)).toBe(true)
    expect(left.polls.at(-1)?.votes[plan.ownerId]).toEqual([vegetables.id])
    await expect(repo.vote(poll.id, plan.ownerId, [peanut.id])).resolves.toBeDefined()
  })

  it('invalidates a resolved restaurant and its journey when a new restriction arrives', async () => {
    const repo = await repository(); const plan = await repo.create(input({ interests: ['大壶春'], partySize: 6 }))
    const poll = plan.polls[0], option = poll.options[0]
    const chosen = await repo.resolve(plan.id, poll.id, plan.ownerId, option.id)
    const timePoll = chosen.polls.find(item => item.type === 'time')!
    const planned = await repo.resolve(plan.id, timePoll.id, plan.ownerId, timePoll.options[0].id)
    expect(planned.journey).toBeDefined()
    const joined = await repo.join(plan.inviteCode, { userId: 'vegetarian', displayName: '朋友', foodPreferences: ['素食'] })
    expect(joined.status).toBe('voting')
    expect(joined.selectedOptionId).toBeUndefined()
    expect(joined.journey).toBeUndefined()
    expect(joined.polls.find(item => item.id === poll.id)?.winningOptionId).toBeUndefined()
    expect(joined.polls.find(item => item.id === timePoll.id)?.status).toBe('closed')
    await expect(repo.resolve(plan.id, timePoll.id, plan.ownerId, timePoll.options[0].id)).rejects.toMatchObject({ code: 'INVALID_STATE' })
    const reloaded = new GroupPlanRepository((repo as unknown as { storePath: string }).storePath); repositories.push(reloaded)
    const stored = await reloaded.get(plan.id)
    expect(stored.journey).toBeUndefined()
    expect(stored.polls[0].options[0].metadata.blockedReason).toBeTruthy()
  })

  it('applies existing member restrictions to new polls and permits voting after an explicit preference update', async () => {
    const repo = await repository(); const plan = await repo.create(input())
    await repo.join(plan.inviteCode, { userId: 'friend', displayName: '朋友', foodPreferences: ['不吃海鲜'] })
    const next = await repo.createPoll(plan.id, plan.ownerId, { title: '吃什么', type: 'single', options: ['海鲜', '蔬菜'] })
    const poll = next.polls.at(-1)!
    expect(poll.options[0].metadata.blockedReason).toBeTruthy()
    await expect(repo.vote(poll.id, plan.ownerId, [poll.options[0].id])).rejects.toMatchObject({ code: 'CONSTRAINT_CONFLICT' })
    await repo.join(plan.inviteCode, { userId: 'friend', displayName: '朋友', foodPreferences: [] })
    await expect(repo.vote(poll.id, plan.ownerId, [poll.options[0].id])).resolves.toBeDefined()
  })

  it('persists a created plan and its candidates across repository instances', async () => {
    const repo = await repository(); const plan = await repo.create(input())
    expect(plan.polls[0].options.length).toBeGreaterThanOrEqual(2)
    const reloaded = new GroupPlanRepository((repo as unknown as { storePath: string }).storePath); repositories.push(reloaded)
    await expect(reloaded.get(plan.id)).resolves.toMatchObject({ id: plan.id, city: '上海' })
  })

  it('upserts a single choice despite repeated concurrent requests', async () => {
    const repo = await repository(); const plan = await repo.create(input()); const owner = plan.participants[0]; const poll = plan.polls[0]
    const optionId = poll.options[0].id
    await Promise.all(Array.from({ length: 5 }, () => repo.vote(poll.id, owner.id, [optionId])))
    const next = await repo.get(plan.id)
    expect(next.polls[0].votes[owner.id]).toEqual([optionId])
    expect(Object.values(next.polls[0].votes).flat()).toHaveLength(1)
  })

  it('replaces rather than accumulates a changed vote and rejects non-members', async () => {
    const repo = await repository(); const plan = await repo.create(input()); const poll = plan.polls[0]; const owner = plan.participants[0]
    await repo.vote(poll.id, owner.id, [poll.options[0].id]); const next = await repo.vote(poll.id, owner.id, [poll.options[1].id])
    expect(next.polls[0].votes[owner.id]).toEqual([poll.options[1].id])
    await expect(repo.vote(poll.id, 'not-a-member', [poll.options[0].id])).rejects.toMatchObject({ code: 'FORBIDDEN' } satisfies Partial<GroupPlanError>)
  })

  it('rejects votes after a deadline', async () => {
    const repo = await repository(); const plan = await repo.create(input({ deadline: '2020-01-01T00:00:00.000Z' })); const poll = plan.polls[0]
    await expect(repo.vote(poll.id, plan.participants[0].id, [poll.options[0].id])).rejects.toMatchObject({ code: 'POLL_CLOSED' } satisfies Partial<GroupPlanError>)
  })

  it('allows multiple selections without duplicate option votes', async () => {
    const repo = await repository(); const plan = await repo.create(input()); const owner = plan.participants[0]
    const withCuisinePoll = await repo.createPoll(plan.id, owner.id, { title: '哪些菜系可以？', type: 'multiple', options: ['火锅', '日料', '西餐'], maxSelections: 2 })
    const poll = withCuisinePoll.polls.at(-1)!
    const voted = await repo.vote(poll.id, owner.id, [poll.options[0].id, poll.options[0].id, poll.options[1].id])
    expect(voted.polls.at(-1)?.votes[owner.id]).toEqual([poll.options[0].id, poll.options[1].id])
    await expect(repo.vote(poll.id, owner.id, poll.options.map((option) => option.id))).rejects.toMatchObject({ code: 'INVALID_VOTE' } satisfies Partial<GroupPlanError>)
  })

  it('stores a friend\'s activity, food, and note preferences with the participant', async () => {
    const repo = await repository(); const plan = await repo.create(input({ partySize: 3 }))
    const next = await repo.join(plan.inviteCode, { userId: 'friend-user', displayName: '朋友', activityPreferences: ['散步', '看展'], foodPreferences: ['不吃海鲜'], note: '想留一点时间喝咖啡。' })
    expect(next.participants.find((item) => item.userId === 'friend-user')).toMatchObject({ activityPreferences: ['散步', '看展'], foodPreferences: ['不吃海鲜'], note: '想留一点时间喝咖啡。' })
  })

  it('handles a tie without random resolution and locks the explicit decision', async () => {
    const repo = await repository(); const plan = await repo.create(input()); const owner = plan.participants[0]; const joined = await repo.join(plan.inviteCode, { userId: 'friend-user', displayName: '朋友' }); const member = joined.participants.find((item) => item.userId === 'friend-user')!
    const poll = joined.polls[0]; await repo.vote(poll.id, owner.id, [poll.options[0].id]); await repo.vote(poll.id, member.id, [poll.options[1].id])
    const closed = await repo.closePoll(plan.id, poll.id, owner.id)
    expect(closed.polls[0].status).toBe('closed')
    const resolvedRestaurant = await repo.resolve(plan.id, poll.id, owner.id, poll.options[1].id)
    expect(resolvedRestaurant.polls[0]).toMatchObject({ status: 'resolved', winningOptionId: poll.options[1].id })
    const timePoll = resolvedRestaurant.polls.find((item) => item.type === 'time')!
    expect(timePoll.options).toHaveLength(3)
    const resolved = await repo.resolve(plan.id, timePoll.id, owner.id, timePoll.options[1].id)
    expect(resolved.journey?.stops[0].name).toBe(poll.options[1].title)
    await expect(repo.vote(poll.id, member.id, [poll.options[0].id])).rejects.toMatchObject({ code: 'POLL_CLOSED' } satisfies Partial<GroupPlanError>)
  })
})
