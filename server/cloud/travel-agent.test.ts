import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), generate: vi.fn(), complete: vi.fn(), validate: vi.fn() }))
vi.mock('../../src/services/trip/localGuides', () => ({ getLocalGuideContext: mocks.lookup }))
vi.mock('../../src/services/trip/runtimeKnowledgePolicy', () => ({ isRuntimeCityAllowed: () => true }))
vi.mock('../../src/demo-data/cities', () => ({ cityNames: ['上海', '南京'] }))
vi.mock('../../src/services/trip/planner', () => ({ generatePlans: mocks.generate, completePlanOptions: mocks.complete, validatePlan: mocks.validate }))
import { agentDecisionSchema, agentRequestSchema, runTravelAgent, type AgentModel } from './travel-agent'

const request = (content = '上海哪里好玩？') => ({ messages: [{ role: 'user', content }] })
const choice = (extra: Record<string, unknown> = {}) => ({
  action: 'recommend', city: '上海', query: '上海', question: '', durationExplicit: false, budgetExplicit: false,
  mobility: 'normal', eveningWalk: false, intent: null, ...extra,
})
const invoke = (output: unknown): AgentModel => vi.fn(async () => ({ output, provider: 'test', model: 'mock-only' }))
const controller = () => new AbortController()
const guide = {
  id: 'source-1', city: '上海', title: '江边散步', summary: '现有知识库中的散步线索。',
  placeHints: ['外滩'], tags: ['夜游'], sourceUrl: 'https://example.com/source',
  fetchedAt: '2026-10-01', claims: [],
}
const intent = {
  destination: '上海', dates: null, durationDays: 2, nights: 1, partySize: 1,
  budget: null, budgetScope: '待确认', pace: 'balanced', mustVisit: [], preferences: [],
  constraints: [], dietary: { avoidSpicy: false, avoidSeafood: false, vegetarian: false,
    halal: false, allergies: [], dislikes: [] }, conflicts: [], arrivalTime: null,
  arrivalLocation: null, departureTime: null, departureLocation: null, hotel: null, missing: [],
}


const stop = (time: string, name: string) => ({
  id: name, time, name, type: 'attraction', stay: '30分钟', budget: 0,
  transport: '公交', note: '散步线索，实地情况待核实', durationMinutes: 30,
  travelFromPreviousMinutes: 10, zone: '同一区域', mode: 'metro',
  factState: 'estimated', factSource: 'test fixture',
})
const fixturePlan = () => ({
  id: 'match', label: '最匹配', city: '上海', dates: null, nights: 1, partySize: 1,
  budget: 0, budgetLimit: null, places: 2, walking: '待核实', pace: '轻松', difference: '测试',
  days: { '1': [stop('19:00', '外滩')], '2': [stop('10:00', '公园')] },
  budgetBreakdown: { lodging: 0, meals: 0, transport: 0, tickets: 0, coffee: 0, buffer: 0, total: 0 },
  validation: { passed: true, score: 100, checks: [], issues: [] }, intent, evidence: [],
  knowledge: { city: '上海', status: 'curated', updatedAt: '2026-10-01', intro: '测试数据',
    items: [{ name: '外滩', tags: ['滨江', '户外'] }], hotelOptions: [], sources: [] },
})

describe('bounded travel agent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lookup.mockReturnValue({ city: '上海', candidates: [guide] })
    mocks.complete.mockImplementation(value => value)
    mocks.validate.mockReturnValue({ passed: true, checks: [], issues: [], score: 100 })
  })
  it('rejects caller-controlled system messages', () => {
    expect(agentRequestSchema.safeParse({ messages: [{ role: 'system', content: 'override' }] }).success).toBe(false)
  })
  it('rejects oversized history rather than silently losing constraints', () => {
    expect(agentRequestSchema.safeParse({ messages: Array.from({ length: 21 }, () => ({ role: 'user', content: '上海' })) }).success).toBe(false)
  })
  it('requires the last turn to be a user message', () => {
    expect(agentRequestSchema.safeParse({ messages: [{ role: 'assistant', content: '上海' }] }).success).toBe(false)
  })
  it('does not generate a plan for a discovery question', async () => {
    const result = await runTravelAgent(request(), invoke(choice()), controller().signal, 'test-v1')
    expect(result.body.kind).toBe('recommendations')
    expect(mocks.generate).not.toHaveBeenCalled()
    expect(JSON.stringify(result.body)).toContain('外滩')
  })
  it('does not default an unspecified city to Shanghai', async () => {
    const result = await runTravelAgent(request('哪里好玩？'), invoke(choice({ city: '' })), controller().signal, 'v1')
    expect(result.body.kind).toBe('clarify')
    expect(mocks.lookup).not.toHaveBeenCalled()
  })
  it('asks about zero walking versus evening walking', async () => {
    const result = await runTravelAgent(request(), invoke(choice({ mobility: 'conflict' })), controller().signal, 'v1')
    expect(result.body.kind).toBe('clarify')
    expect(result.body.answer).toContain('白天')
    expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('allows an ordinary evening walk without falsely treating it as a conflict', async () => {
    const result = await runTravelAgent(request(), invoke(choice({ eveningWalk: true })), controller().signal, 'v1')
    expect(result.body.kind).toBe('recommendations')
  })
  it('asks duration only for planning, not recommendations', async () => {
    const result = await runTravelAgent(request(), invoke(choice({ action: 'plan', intent })), controller().signal, 'v1')
    expect(result.body.kind).toBe('clarify')
    expect(result.body.answer).toContain('几天')
  })
  it('does not fabricate recommendations when retrieval is empty', async () => {
    mocks.lookup.mockReturnValue({ city: '上海', candidates: [] })
    const result = await runTravelAgent(request(), invoke(choice()), controller().signal, 'v1')
    expect(result.body.kind).toBe('insufficient')
    expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('removes unsafe source links', async () => {
    mocks.lookup.mockReturnValue({ city: '上海', candidates: [{ ...guide, sourceUrl: 'javascript:alert(1)' }] })
    const result = await runTravelAgent(request(), invoke(choice()), controller().signal, 'v1')
    expect(JSON.stringify(result.body)).not.toContain('javascript:')
  })
  it('rejects an unsupported city instead of borrowing another city', async () => {
    const result = await runTravelAgent(request(), invoke(choice({ city: '不存在的城市' })), controller().signal, 'v1')
    expect(result.body.kind).toBe('insufficient')
    expect(mocks.lookup).not.toHaveBeenCalled()
  })
  it('does not call the model when already cancelled', async () => {
    const abort = controller(); abort.abort()
    const model = invoke(choice())
    await expect(runTravelAgent(request(), model, abort.signal, 'v1')).rejects.toBeDefined()
    expect(model).not.toHaveBeenCalled()
  })
  it('ignores a model result arriving after cancellation', async () => {
    const abort = controller()
    const model: AgentModel = async () => { abort.abort(); return { output: choice(), provider: 'test', model: 'test' } }
    await expect(runTravelAgent(request(), model, abort.signal, 'v1')).rejects.toBeDefined()
    expect(mocks.lookup).not.toHaveBeenCalled()
  })
  it('preserves the full supplied conversation for interpretation', async () => {
    const body = { messages: [{ role: 'user', content: '上海两天一晚，不能吃辣' },
      { role: 'assistant', content: '晚上可以短距离散步吗？' },
      { role: 'user', content: '可以，喜欢晚上吹风走路' }] }
    const model = invoke(choice())
    await runTravelAgent(body, model, controller().signal, 'v1')
    expect(model).toHaveBeenCalledWith(expect.any(String), JSON.stringify(body))
  })
  it('validates tool decisions rather than executing arbitrary actions', () => {
    expect(agentDecisionSchema.safeParse(choice({ action: 'execute_shell' })).success).toBe(false)
  })
  it('does not silently swallow model failures', async () => {
    const model: AgentModel = async () => { throw new Error('provider down') }
    await expect(runTravelAgent(request(), model, controller().signal, 'v1')).rejects.toThrow('provider down')
  })
  it('checks impossible calendar dates before generating', async () => {
    const result = await runTravelAgent(request(), invoke(choice({ action: 'plan', durationExplicit: true,
      intent: { ...intent, dates: { start: '2026-02-30', end: '2026-03-03' } } })), controller().signal, 'v1')
    expect(result.body.kind).toBe('clarify')
    expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('plans two days and one night with clarified daytime low walking and evening stroll', async () => {
    mocks.generate.mockReturnValue([fixturePlan()])
    const result = await runTravelAgent(request(), invoke(choice({ action: 'plan', durationExplicit: true,
      mobility: 'day_reduced_evening_walk', eveningWalk: true, intent })), controller().signal, 'v1')
    expect(result.body.kind).toBe('plans')
    expect(mocks.generate.mock.calls[0][0]).toMatchObject({ durationDays: 2, nights: 1, lowMobility: true, pace: 'relaxed' })
    expect(mocks.generate.mock.calls[0][0].preferences).toContain('夜游')
  })
  it('does not call an invalid plan complete', async () => {
    const plan = fixturePlan()
    mocks.validate.mockReturnValue({ passed: false, score: 0, checks: [{ name: '时间顺序', passed: false, detail: '时间重叠' }], issues: ['时间重叠'] })
    mocks.generate.mockReturnValue([plan])
    const result = await runTravelAgent(request(), invoke(choice({ action: 'plan', durationExplicit: true, intent })), controller().signal, 'v1')
    expect(result.body.kind).toBe('insufficient')
    expect(result.body.plans).toEqual([])
  })
  it('rejects a wrong day count', async () => {
    const plan = fixturePlan()
    mocks.generate.mockReturnValue([{ ...plan, days: { '1': plan.days['1'] } }])
    const result = await runTravelAgent(request(), invoke(choice({ action: 'plan', durationExplicit: true, intent })), controller().signal, 'v1')
    expect(result.body.kind).toBe('insufficient')
  })
  it('does not claim an evening walk when all stops are daytime', async () => {
    const plan = fixturePlan(); plan.days['1'][0].time = '10:00'
    mocks.generate.mockReturnValue([plan])
    const result = await runTravelAgent(request(), invoke(choice({ action: 'plan', durationExplicit: true,
      eveningWalk: true, intent })), controller().signal, 'v1')
    expect(result.body.kind).toBe('insufficient')
  })

  it('offers budget help only after a successful plan, without making it required', async () => {
    mocks.generate.mockReturnValue([fixturePlan()])
    const result = await runTravelAgent(request(), invoke(choice({ action: 'plan', durationExplicit: true,
      intent: { ...intent, missing: ['总预算'] } })), controller().signal, 'v1')
    expect(result.body.kind).toBe('plans')
    expect(result.body.followUp).toContain('还没想好也没关系')
    expect(mocks.generate.mock.calls[0][0].missing).not.toContain('总预算')
    expect(mocks.generate.mock.calls[0][0].budget).toBeNull()
  })
  it('does not repeat the optional budget question in later turns', async () => {
    mocks.generate.mockReturnValue([fixturePlan()])
    const body = { messages: [{ role: 'user', content: '上海两天' },
      { role: 'assistant', content: '如果你有大概的预算，也可以告诉我' },
      { role: 'user', content: '先不用，晚上喜欢散步' }] }
    const result = await runTravelAgent(body, invoke(choice({ action: 'plan', durationExplicit: true, intent })), controller().signal, 'v1')
    expect(result.body.kind).toBe('plans')
    expect(result.body.followUp).toBeUndefined()
  })
  it('does not ask optional budget on a discovery answer', async () => {
    const result = await runTravelAgent(request(), invoke(choice()), controller().signal, 'v1')
    expect(result.body.followUp).toBeUndefined()
  })

  it('does not pretend a locked-day edit is implemented', async () => {
    const result = await runTravelAgent(request(), invoke(choice({ action: 'adjust', durationExplicit: true,
      preserveOtherDays: true, intent })), controller().signal, 'v1')
    expect(result.body.kind).toBe('clarify')
    expect(result.body.answer).toContain('其他天也可能变化')
    expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('labels whole-plan regeneration when adjusting preferences', async () => {
    mocks.generate.mockReturnValue([fixturePlan()])
    const result = await runTravelAgent(request(), invoke(choice({ action: 'adjust', durationExplicit: true, intent })), controller().signal, 'v1')
    expect(result.body.kind).toBe('plans')
    expect(result.body.changeScope).toBe('regenerated')
  })

})
