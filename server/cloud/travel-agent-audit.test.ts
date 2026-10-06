import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GeneratedPlan, TripIntent } from '../../src/services/trip/planner'
const validate = vi.hoisted(() => vi.fn())
vi.mock('../../src/services/trip/planner', () => ({ validatePlan: validate }))
import { auditAgentPlan } from './travel-agent-audit'

const intent = {
  destination: '上海', durationDays: 2, nights: 1, partySize: 1, dates: null,
  budget: null, conflicts: [], missing: ['总预算'],
} as TripIntent
const makePlan = () => ({
  city: '上海', nights: 1, partySize: 1, dates: null, budget: 0, budgetLimit: 10000,
  intent: { ...intent, budget: 10000 }, validation: { passed: true },
  days: { '1': [{ name: '外滩', type: '景点', time: '19:00', mode: 'metro', travelFromPreviousMinutes: 10 }],
    '2': [{ name: '博物馆', type: '景点', time: '10:00', mode: 'metro', travelFromPreviousMinutes: 10 }] },
  knowledge: { items: [{ name: '外滩', tags: ['户外', '滨江'] }] },
}) as unknown as GeneratedPlan
const policy = { mobility: 'normal' as const, eveningWalk: false }

describe('independent itinerary audit', () => {
  beforeEach(() => { validate.mockReset(); validate.mockReturnValue({ passed: true, checks: [], issues: [], score: 100 }) })
  it('revalidates against requested intent rather than the cached pass flag', () => {
    validate.mockReturnValue({ checks: [{ name: '时间顺序', passed: false, detail: '时间重叠' }] })
    const plan = makePlan()
    expect(auditAgentPlan(plan, intent, policy).accepted).toBe(false)
    expect(validate).toHaveBeenCalledWith(expect.objectContaining({ intent, budgetLimit: null }))
  })
  it('does not prompt or warn for an omitted optional budget', () => {
    validate.mockReturnValue({ checks: [{ name: '出行信息', passed: false, detail: '缺预算' }] })
    const audit = auditAgentPlan(makePlan(), intent, policy)
    expect(audit.accepted).toBe(true)
    expect(audit.warnings.some(item => item.includes('预算'))).toBe(false)
  })
  it('never downgrades an input conflict to an optional warning', () => {
    validate.mockReturnValue({ checks: [{ name: '出行信息', passed: false, detail: '冲突' }] })
    expect(auditAgentPlan(makePlan(), { ...intent, conflicts: ['不能步行与步行冲突'] }, policy).accepted).toBe(false)
  })
  it('checks nights and people', () => {
    const plan = makePlan(); plan.nights = 2; plan.partySize = 3
    const audit = auditAgentPlan(plan, intent, policy)
    expect(audit.blocking).toContain('住宿晚数不一致')
    expect(audit.blocking).toContain('出行人数不一致')
  })
  it('does not accept a missing day', () => {
    const plan = makePlan(); delete plan.days['2']
    expect(auditAgentPlan(plan, intent, policy).accepted).toBe(false)
  })
  it('does not accept placeholder venues as a complete plan', () => {
    const plan = makePlan(); plan.days['1'][0].pendingVenue = true
    expect(auditAgentPlan(plan, intent, policy).accepted).toBe(false)
  })
  it('requires knowledge evidence for outdoor night walks', () => {
    const plan = makePlan(); plan.knowledge.items = []
    expect(auditAgentPlan(plan, intent, { ...policy, eveningWalk: true }).accepted).toBe(false)
  })
  it('accepts a knowledge-backed evening outdoor candidate with warnings', () => {
    const audit = auditAgentPlan(makePlan(), intent, { ...policy, eveningWalk: true })
    expect(audit.accepted).toBe(true)
    expect(audit.warnings.some(item => item.includes('风雨'))).toBe(true)
  })
  it('rejects a long daytime walking transfer after low-walking clarification', () => {
    const plan = makePlan(); plan.days['2'][0].mode = 'walk'; plan.days['2'][0].travelFromPreviousMinutes = 40
    expect(auditAgentPlan(plan, intent, { mobility: 'day_reduced_evening_walk', eveningWalk: true }).accepted).toBe(false)
  })
  it('does not confuse an indoor venue with a waterfront outdoor place', () => {
    const plan = makePlan(); plan.days['1'][0].name = '海洋馆'
    plan.knowledge.items = [{ name: '海洋馆', tags: ['室内'] }] as GeneratedPlan['knowledge']['items']
    expect(auditAgentPlan(plan, intent, { ...policy, eveningWalk: true }).accepted).toBe(false)
  })
})
