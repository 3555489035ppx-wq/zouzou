import { afterEach, describe, expect, test, vi } from 'vitest'

const { responsesCreate } = vi.hoisted(() => ({ responsesCreate: vi.fn() }))

vi.mock('openai', () => ({
  default: class OpenAIMock {
    responses = { create: responsesCreate }
  },
}))
import {
  getAIProviderConfig,
  normalizeTripIntent,
  sanitizeTripRequest,
  understandTripWithProvider,
} from './trip-intent'

const originalKey = process.env.OPENAI_API_KEY
const originalModel = process.env.OPENAI_MODEL
const originalProvider = process.env.AI_PROVIDER
const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY
const originalDeepSeekModel = process.env.DEEPSEEK_MODEL

afterEach(() => {
  responsesCreate.mockReset()
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = originalKey
  if (originalModel === undefined) delete process.env.OPENAI_MODEL
  else process.env.OPENAI_MODEL = originalModel
  if (originalProvider === undefined) delete process.env.AI_PROVIDER
  else process.env.AI_PROVIDER = originalProvider
  if (originalDeepSeekKey === undefined) delete process.env.DEEPSEEK_API_KEY
  else process.env.DEEPSEEK_API_KEY = originalDeepSeekKey
  if (originalDeepSeekModel === undefined) delete process.env.DEEPSEEK_MODEL
  else process.env.DEEPSEEK_MODEL = originalDeepSeekModel
})

describe('server text intent integration', () => {
  test('sanitizes text requests and drops browser media URLs', () => {
    const request = sanitizeTripRequest({
      text: '  9月去上海三天  ',
      media: [{ id: 'shot-1', src: 'blob:http://local/private', name: '车票.png', category: '票据' }],
    })

    expect(request.text).toBe('9月去上海三天')
    expect(request.media[0]).toMatchObject({ id: 'shot-1', name: '车票.png', category: '票据', src: '' })
    expect(request.mediaFacts).toBeUndefined()
  })

  test('normalizes a strict intent and adds missing scheduling anchors', () => {
    const intent = normalizeTripIntent({
      destination: '上海',
      dates: { start: '2026-09-18', end: '2026-09-20' },
      durationDays: 99,
      nights: 99,
      partySize: 2,
      budget: 4000,
      budgetScope: '含住宿和市内交通',
      pace: 'relaxed',
      mustVisit: ['武康路', '外滩'],
      preferences: ['咖啡'],
      constraints: [],
      arrivalTime: '10:30',
      arrivalLocation: '虹桥火车站',
      departureTime: null,
      departureLocation: null,
      hotel: '静安寺附近',
      missing: [],
    })

    expect(intent.durationDays).toBe(3)
    expect(intent.nights).toBe(2)
    expect(intent.missing).toContain('返程时间和地点')
  })

  test('uses the local provider when no OpenAI key is configured', async () => {
    delete process.env.OPENAI_API_KEY
    delete process.env.DEEPSEEK_API_KEY
    delete process.env.AI_PROVIDER
    const result = await understandTripWithProvider({
      text: '2026年9月18日到9月20日去上海，两个人，预算4000，10:30到虹桥火车站，18:30从虹桥返程。',
      media: [],
    })

    expect(result.provider).toBe('local')
    expect(result.intent.destination).toBe('上海')
    expect(result.intent.partySize).toBe(2)
  })

  test('selects DeepSeek without exposing the key', () => {
    process.env.AI_PROVIDER = 'deepseek'
    process.env.DEEPSEEK_API_KEY = 'test-key-that-must-not-be-logged'
    process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash'

    expect(getAIProviderConfig()).toEqual({
      provider: 'deepseek',
      configured: true,
      model: 'deepseek-v4-flash',
    })
  })

  test('uses non-thinking short output for DeepSeek intent extraction', async () => {
    process.env.AI_PROVIDER = 'deepseek'
    process.env.DEEPSEEK_API_KEY = 'test-key'
    process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash'
    responsesCreate.mockResolvedValueOnce({
      output_text: `\`\`\`json\n${JSON.stringify({
        destination: '上海',
        dates: null,
        durationDays: 3,
        nights: 2,
        partySize: 2,
        budget: 4000,
        budgetScope: '总预算',
        pace: 'relaxed',
        mustVisit: ['外滩'],
        preferences: [],
        constraints: [],
        arrivalTime: null,
        arrivalLocation: null,
        departureTime: null,
        departureLocation: null,
        hotel: null,
        missing: ['具体出行日期'],
      })}\n\`\`\``,
    })

    const result = await understandTripWithProvider({ text: '上海三天，两个人，预算4000元。', media: [] })
    const [options] = responsesCreate.mock.calls[0]

    expect(result.provider).toBe('deepseek')
    expect(options).toMatchObject({
      model: 'deepseek-v4-flash',
      reasoning: { effort: 'none' },
      max_output_tokens: 1200,
      store: false,
    })
    expect(options.input).toContain('社区攻略知识库线索')
    expect(result.guideContext?.city).toBe('上海')
    expect(result.guideContext?.candidates.length).toBeGreaterThan(0)
  })
})
