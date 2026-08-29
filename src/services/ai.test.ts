import { afterEach, describe, expect, test, vi } from 'vitest'
import { PlanningAIAdapter } from './ai'

const remoteUnderstanding = {
  intent: {
    destination: '上海',
    dates: null,
    durationDays: 3,
    nights: 2,
    partySize: 2,
    budget: 4000,
    budgetScope: '总预算',
    pace: 'relaxed' as const,
    mustVisit: ['外滩'],
    preferences: [],
    constraints: [],
    arrivalTime: null,
    arrivalLocation: null,
    departureTime: null,
    departureLocation: null,
    hotel: null,
    missing: ['具体出行日期'],
  },
  evidence: ['测试响应'],
  summary: '上海 · 3天2晚 · 2人 · 松弛',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PlanningAIAdapter remote requests', () => {
  test('deduplicates identical concurrent understanding requests', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => remoteUnderstanding,
    }))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new PlanningAIAdapter({ remoteAIEnabled: true, apiBase: 'http://test.local' })
    const request = { text: '上海三天，两个人，预算4000元。', media: [] }

    const first = adapter.understandTrip(request, () => {})
    const second = adapter.understandTrip(request, () => {})
    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(firstResult).toEqual(remoteUnderstanding)
    expect(secondResult).toEqual(remoteUnderstanding)
  })

  test('falls back when the provider returns only default empty fields', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ...remoteUnderstanding,
        intent: {
          ...remoteUnderstanding.intent,
          destination: '未确定',
          dates: null,
          budget: null,
          mustVisit: [],
          preferences: [],
          arrivalTime: null,
          arrivalLocation: null,
          departureTime: null,
          departureLocation: null,
          hotel: null,
          missing: ['具体出行日期', '到达时间和地点', '返程时间和地点', '酒店位置', '总预算'],
        },
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new PlanningAIAdapter({ remoteAIEnabled: true, apiBase: 'http://test.local' })
    const result = await adapter.understandTrip({ text: '上海三天，两个人，预算4000元。', media: [] }, () => {})

    expect(result.intent.destination).toBe('上海')
    expect(result.intent.budget).toBe(4000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('reads image facts before sending the trip to text understanding', async () => {
    const mediaFacts = [{
      mediaId: 'ticket-1',
      name: '车票.png',
      kind: 'ticket' as const,
      rawText: '上海虹桥 10:30',
      facts: {
        dates: null,
        times: ['10:30'],
        locations: ['上海虹桥'],
        arrivalLocation: '虹桥火车站',
        departureLocation: null,
        hotel: null,
        placeNames: [],
        budget: null,
        notes: [],
      },
      confidence: 0.94,
      needsConfirmation: false,
      warnings: [],
      provider: 'zhipu',
    }]
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('/api/trips/media/analyze')) {
        const body = JSON.parse(String(options?.body)) as { media: Array<{ dataUrl: string }> }
        expect(body.media[0].dataUrl).toBe('data:image/png;base64,AA==')
        return { ok: true, json: async () => ({ mediaFacts, provider: 'zhipu', warnings: [] }) }
      }
      return { ok: true, json: async () => ({ ...remoteUnderstanding, mediaFacts }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new PlanningAIAdapter({ remoteAIEnabled: true, apiBase: 'http://test.local' })

    const result = await adapter.understandTrip({
      text: '上海三天，两个人，预算4000元。',
      media: [{ id: 'ticket-1', src: 'data:image/png;base64,AA==', name: '车票.png', category: '票据' }],
    }, () => {})

    expect(result.mediaFacts?.[0].facts.arrivalLocation).toBe('虹桥火车站')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const understandingCall = fetchMock.mock.calls[1]
    const understandingBody = JSON.parse(String(understandingCall[1]?.body)) as { mediaFacts?: typeof mediaFacts }
    expect(understandingBody.mediaFacts?.[0].mediaId).toBe('ticket-1')
  })
})
