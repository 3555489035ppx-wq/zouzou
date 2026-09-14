import { afterEach, expect, it, vi } from 'vitest'
import { GroupPlanRepository } from './group-plans'
import { saveGroupTrip } from '../src/services/trip/groupTrip'
import { readSavedPlans, writeSavedPlan } from '../src/services/trip/planner'
import { parseGroupPlan } from '../src/services/groupPlanSchemas'

afterEach(() => vi.unstubAllGlobals())
it('Q-04/Q-05 saves the decided Trip once and propagates member constraints without erasing history', async () => {
  const storage = new Map<string, string>()
  vi.stubGlobal('window', { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) }, dispatchEvent: () => true })
  const repo = new GroupPlanRepository(':memory:')
  try {
    let plan = await repo.create({ type: 'date', city: '上海', date: '2026-09-18', startTime: '14:00', endTime: '18:00', budget: 200, partySize: 2, interests: ['咖啡'], avoidTags: [], transportMode: '地铁', owner: { userId: 'owner', displayName: '组织者' } })
    plan = await repo.join(plan.inviteCode, { userId: 'friend', displayName: '朋友', activityPreferences: ['看展'], foodPreferences: ['不吃辣'] })
    plan = await repo.resolve(plan.id, plan.polls[0].id, plan.ownerId, plan.polls[0].options[0].id, plan.revision)
    expect(parseGroupPlan(plan)?.trip?.tripId).toBe(plan.id)
    expect(plan.trip?.intent.preferences).toEqual(expect.arrayContaining(['咖啡', '看展']))
    expect(plan.trip?.intent.dietary.avoidSpicy).toBe(true)
    const saved = saveGroupTrip(plan, true)!
    expect(saved.days['Day 1'][0].id).toBe(plan.selectedOptionId)
    saveGroupTrip(plan, true)
    expect(readSavedPlans()).toHaveLength(1)
    const execution = [{ day: 'Day 1', stopId: saved.days['Day 1'][0].id, action: 'arrived' as const, source: 'manual' as const, at: '2026-09-18T14:00:00+08:00' }]
    writeSavedPlan({ ...saved, status: 'active', execution, days: { 'Day 1': [{ ...saved.days['Day 1'][0], note: '我补充的集合说明' }] } })
    plan = await repo.join(plan.inviteCode, { userId: 'friend', displayName: '朋友', note: '花生过敏且海鲜过敏' })
    const updated = saveGroupTrip(plan)!
    expect(updated.intent.dietary.allergies.join('、')).toContain('花生')
    expect(updated.intent.dietary.avoidSeafood).toBe(true)
    expect(updated.tripId).toBe(saved.tripId)
    expect(updated.sourceGroup?.revision).toBe(plan.revision)
    expect(updated.days['Day 1'][0].note).toBe('我补充的集合说明')
    expect(updated.execution).toEqual(execution)
    plan = await repo.reopen(plan.id, plan.polls[0].id, plan.ownerId)
    const invalid = saveGroupTrip(plan)!
    expect(invalid.status).toBe('paused')
    expect(invalid.validation.passed).toBe(false)
    expect(invalid.sourceGroup?.needsDecision).toBe(true)
    expect(invalid.days).toEqual(updated.days)
    expect(invalid.execution).toEqual(execution)
  } finally { repo.close() }
})
