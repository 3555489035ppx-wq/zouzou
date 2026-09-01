import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GroupPlanError, GroupPlanRepository } from './group-plans'
import type { GroupPlanInput } from '../src/services/groupPlans'

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
