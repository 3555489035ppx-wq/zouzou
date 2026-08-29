import { afterEach, describe, expect, test, vi } from 'vitest'

const { chatCompletionsCreate, responsesCreate } = vi.hoisted(() => ({
  chatCompletionsCreate: vi.fn(),
  responsesCreate: vi.fn(),
}))

vi.mock('openai', () => ({
  default: class OpenAIMock {
    chat = { completions: { create: chatCompletionsCreate } }
    responses = { create: responsesCreate }
  },
}))

import {
  analyzeTripMediaWithProvider,
  getVisionProviderConfig,
  normalizeMediaFacts,
  sanitizeTripMediaRequest,
} from './trip-vision'

const environmentKeys = [
  'VISION_ENABLED',
  'VISION_PROVIDER',
  'VISION_MODEL',
  'VISION_API_KEY',
  'VISION_BASE_URL',
  'VISION_PROTOCOL',
  'ZHIPU_API_KEY',
  'ZHIPUAI_API_KEY',
  'ZHIPU_VISION_MODEL',
  'ZHIPU_BASE_URL',
  'DASHSCOPE_API_KEY',
  'DEEPSEEK_API_KEY',
] as const
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]))

const media = [{
  id: 'ticket-1',
  name: '车票.png',
  category: '票据',
  dataUrl: 'data:image/png;base64,AA==',
}]

afterEach(() => {
  chatCompletionsCreate.mockReset()
  responsesCreate.mockReset()
  environmentKeys.forEach((key) => {
    const value = originalEnvironment[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  })
})

describe('trip media vision integration', () => {
  test('accepts only bounded base64 image inputs', () => {
    const request = sanitizeTripMediaRequest({ text: '上海三天', media })
    expect(request.media[0]).toMatchObject({ id: 'ticket-1', name: '车票.png', dataUrl: media[0].dataUrl })

    expect(() => sanitizeTripMediaRequest({ text: '上海', media: [{ ...media[0], dataUrl: 'blob:http://local/private' }] })).toThrow('只接受 base64 图片')
    expect(() => sanitizeTripMediaRequest({ text: '上海', media: [{ ...media[0], dataUrl: 'https://example.com/ticket.png' }] })).toThrow('只接受 base64 图片')
  })

  test('marks low-confidence facts for confirmation and normalizes fields', () => {
    const result = normalizeMediaFacts({
      items: [{
        mediaId: 'ticket-1',
        kind: 'ticket',
        rawText: '2026-09-18 10:30 虹桥火车站',
        facts: {
          dates: { start: '2026-09-18', end: '2026-09-18' },
          times: ['10:30', '25:70'],
          locations: ['虹桥火车站'],
          arrivalLocation: '虹桥火车站',
          departureLocation: null,
          hotel: null,
          placeNames: [],
          budget: null,
          notes: [],
        },
        confidence: 0.62,
        needsConfirmation: false,
        warnings: [],
      }],
    }, media, 'zhipu')

    expect(result[0]).toMatchObject({
      kind: 'ticket',
      confidence: 0.62,
      needsConfirmation: true,
      provider: 'zhipu',
      facts: { times: ['10:30'], arrivalLocation: '虹桥火车站' },
    })
    expect(result[0].warnings).toContain('关键字段置信度较低，请确认。')
  })

  test('supports a low-cost domestic vision provider through Chat Completions', async () => {
    process.env.VISION_PROVIDER = 'zhipu'
    process.env.ZHIPU_API_KEY = 'zhipu-test-key'
    process.env.ZHIPU_VISION_MODEL = 'glm-4.6v-flash'
    chatCompletionsCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        items: [{
          mediaId: 'ticket-1',
          kind: 'ticket',
          rawText: '上海虹桥 10:30',
          facts: { dates: null, times: ['10:30'], locations: ['上海虹桥'], arrivalLocation: '虹桥火车站', departureLocation: null, hotel: null, placeNames: [], budget: null, notes: [] },
          confidence: 0.94,
          needsConfirmation: false,
          warnings: [],
        }],
      }) } }],
    })

    expect(getVisionProviderConfig()).toMatchObject({
      provider: 'zhipu',
      configured: true,
      model: 'glm-4.6v-flash',
      protocol: 'chat',
    })
    const result = await analyzeTripMediaWithProvider({ text: '我去上海', media })
    const [options] = chatCompletionsCreate.mock.calls[0]
    const content = options.messages[0].content as Array<{ type: string; image_url?: { url: string }; text?: string }>

    expect(result.provider).toBe('zhipu')
    expect(result.mediaFacts[0].facts.arrivalLocation).toBe('虹桥火车站')
    expect(content.some((part) => part.type === 'image_url' && part.image_url?.url === media[0].dataUrl)).toBe(true)
    expect(content.some((part) => part.type === 'text' && part.text?.includes('不能规划行程'))).toBe(true)
  })

  test('returns a safe low-confidence fallback when no vision key is configured', async () => {
    process.env.VISION_ENABLED = '0'
    const result = await analyzeTripMediaWithProvider({ text: '上海', media })

    expect(result.provider).toBe('local')
    expect(result.mediaFacts[0]).toMatchObject({ confidence: 0, needsConfirmation: true, rawText: '' })
    expect(chatCompletionsCreate).not.toHaveBeenCalled()
  })
})
