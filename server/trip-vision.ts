import OpenAI from 'openai'
import { TRIP_VISION_INSTRUCTIONS } from './ai-guidelines'
import type { MediaFact, MediaFactKind, TripMedia } from '../src/services/trip/planner'

export type VisionProvider = 'deepseek' | 'dashscope' | 'zhipu' | 'doubao' | 'custom' | 'local'
export type VisionProtocol = 'responses' | 'chat'

export type VisionProviderConfig = {
  provider: VisionProvider
  configured: boolean
  model: string
  baseURL: string
  protocol: VisionProtocol
}

export type VisionMediaInput = Pick<TripMedia, 'id' | 'name' | 'category'> & {
  dataUrl: string
}

export type TripMediaAnalysisRequest = {
  text: string
  media: VisionMediaInput[]
}

export type TripMediaAnalysisResponse = {
  mediaFacts: MediaFact[]
  provider: VisionProvider
  model?: string
  warnings: string[]
}

const MAX_MEDIA_COUNT = 6
const MAX_MEDIA_DATA_URL_CHARS = 10_500_000
const MAX_MEDIA_TOTAL_CHARS = 22_000_000
const DEFAULT_DEEPSEEK_VISION_MODEL = 'deepseek-v4-flash-vision-exp'
const DEFAULT_DASHSCOPE_VISION_MODEL = 'qwen3-vl-flash'
const DEFAULT_ZHIPU_VISION_MODEL = 'glm-4.6v-flash'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const asString = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : ''

const asStringArray = (value: unknown, limit = 12) => (
  Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim().slice(0, 240)))].slice(0, limit)
    : []
)

const asNonNegativeNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())) return Number(value)
  return null
}

const env = (name: string) => process.env[name]?.trim() || ''

function normalizeDateRange(value: unknown): MediaFact['facts']['dates'] {
  if (!isRecord(value)) return null
  const start = asString(value.start)
  const end = asString(value.end)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null
  return { start, end }
}

function normalizeTimes(value: unknown) {
  return asStringArray(value, 12).map((time) => {
    const match = time.match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return null
    const hours = Number(match[1])
    const minutes = Number(match[2])
    return hours <= 23 && minutes <= 59 ? `${String(hours).padStart(2, '0')}:${match[2]}` : null
  }).filter((time): time is string => Boolean(time))
}

function normalizeKind(value: unknown): MediaFactKind {
  return value === 'ticket' || value === 'hotel' || value === 'reservation' || value === 'chat' || value === 'map'
    ? value
    : 'other'
}

const emptyFacts = (): MediaFact['facts'] => ({
  dates: null,
  times: [],
  locations: [],
  arrivalLocation: null,
  departureLocation: null,
  hotel: null,
  placeNames: [],
  budget: null,
  notes: [],
})

function fallbackMediaFacts(media: VisionMediaInput[], provider: VisionProvider, warning: string): MediaFact[] {
  return media.map((item) => ({
    mediaId: item.id,
    name: item.name,
    kind: 'other',
    rawText: '',
    facts: emptyFacts(),
    confidence: 0,
    needsConfirmation: true,
    warnings: [warning],
    provider,
  }))
}

/**
 * Normalize model output before it enters TripIntent. Missing image results
 * are kept as explicit low-confidence records instead of being discarded.
 */
export function normalizeMediaFacts(value: unknown, media: Array<Pick<TripMedia, 'id' | 'name' | 'category'>>, provider: MediaFact['provider']): MediaFact[] {
  const root = isRecord(value) ? value : {}
  const rawItems = Array.isArray(root.items) ? root.items.filter(isRecord).slice(0, MAX_MEDIA_COUNT) : []
  const byId = new Map(rawItems.map((item, index) => [asString(item.mediaId) || media[index]?.id || `media-${index + 1}`, item]))

  return media.map((input, index) => {
    const item = byId.get(input.id) ?? rawItems[index] ?? {}
    const rawFacts = isRecord(item.facts) ? item.facts : {}
    const confidenceValue = typeof item.confidence === 'number' && Number.isFinite(item.confidence) ? item.confidence : 0.35
    const confidence = Math.max(0, Math.min(1, confidenceValue))
    const warnings = asStringArray(item.warnings, 8)
    if (confidence < 0.85 && !warnings.includes('关键字段置信度较低，请确认。')) warnings.push('关键字段置信度较低，请确认。')

    return {
      mediaId: input.id,
      name: input.name,
      kind: normalizeKind(item.kind),
      rawText: asString(item.rawText).slice(0, 4_000),
      facts: {
        dates: normalizeDateRange(rawFacts.dates),
        times: normalizeTimes(rawFacts.times),
        locations: asStringArray(rawFacts.locations, 8),
        arrivalLocation: asString(rawFacts.arrivalLocation) || null,
        departureLocation: asString(rawFacts.departureLocation) || null,
        hotel: asString(rawFacts.hotel) || null,
        placeNames: asStringArray(rawFacts.placeNames, 12),
        budget: asNonNegativeNumber(rawFacts.budget),
        notes: asStringArray(rawFacts.notes, 8),
      },
      confidence,
      needsConfirmation: Boolean(item.needsConfirmation) || confidence < 0.85,
      warnings,
      provider,
    }
  })
}

function getProviderKey(provider: VisionProvider) {
  if (provider === 'deepseek') return env('DEEPSEEK_API_KEY')
  if (provider === 'dashscope') return env('DASHSCOPE_API_KEY') || env('VISION_API_KEY')
  if (provider === 'zhipu') return env('ZHIPU_API_KEY') || env('ZHIPUAI_API_KEY') || env('VISION_API_KEY')
  if (provider === 'doubao') return env('DOUBAO_API_KEY') || env('ARK_API_KEY') || env('VISION_API_KEY')
  if (provider === 'custom') return env('VISION_API_KEY')
  return ''
}

function providerRequested() {
  const requested = env('VISION_PROVIDER').toLowerCase()
  return requested === 'deepseek' || requested === 'dashscope' || requested === 'zhipu' || requested === 'doubao' || requested === 'custom' || requested === 'local'
    ? requested as VisionProvider
    : null
}

function autoProvider(): VisionProvider {
  if (env('DASHSCOPE_API_KEY')) return 'dashscope'
  if (env('ZHIPU_API_KEY') || env('ZHIPUAI_API_KEY')) return 'zhipu'
  if (env('DOUBAO_API_KEY') || env('ARK_API_KEY')) return 'doubao'
  if (env('DEEPSEEK_API_KEY')) return 'deepseek'
  if (env('VISION_API_KEY')) return 'custom'
  return 'local'
}

export function getVisionProviderConfig(): VisionProviderConfig {
  if (env('VISION_ENABLED') === '0') {
    return { provider: 'local', configured: false, model: 'local-fallback', baseURL: '', protocol: 'chat' }
  }

  const provider = providerRequested() ?? autoProvider()
  if (provider === 'local') return { provider, configured: false, model: 'local-fallback', baseURL: '', protocol: 'chat' }

  if (provider === 'deepseek') {
    return {
      provider,
      configured: Boolean(getProviderKey(provider)),
      model: env('DEEPSEEK_VISION_MODEL') || env('VISION_MODEL') || DEFAULT_DEEPSEEK_VISION_MODEL,
      baseURL: env('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com',
      protocol: 'responses',
    }
  }
  if (provider === 'dashscope') {
    return {
      provider,
      configured: Boolean(getProviderKey(provider)),
      model: env('DASHSCOPE_VISION_MODEL') || env('VISION_MODEL') || DEFAULT_DASHSCOPE_VISION_MODEL,
      baseURL: env('DASHSCOPE_BASE_URL') || env('VISION_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      protocol: 'chat',
    }
  }
  if (provider === 'zhipu') {
    return {
      provider,
      configured: Boolean(getProviderKey(provider)),
      model: env('ZHIPU_VISION_MODEL') || env('VISION_MODEL') || DEFAULT_ZHIPU_VISION_MODEL,
      baseURL: env('ZHIPU_BASE_URL') || env('VISION_BASE_URL') || 'https://open.bigmodel.cn/api/paas/v4',
      protocol: 'chat',
    }
  }
  if (provider === 'doubao') {
    const model = env('DOUBAO_VISION_MODEL') || env('VISION_MODEL')
    return {
      provider,
      configured: Boolean(getProviderKey(provider) && model),
      model: model || '需要配置 DOUBAO_VISION_MODEL',
      baseURL: env('DOUBAO_BASE_URL') || env('VISION_BASE_URL') || 'https://ark.cn-beijing.volces.com/api/v3',
      protocol: 'chat',
    }
  }

  return {
    provider,
    configured: Boolean(getProviderKey(provider) && env('VISION_MODEL') && (env('VISION_BASE_URL') || env('VISION_ENDPOINT'))),
    model: env('VISION_MODEL') || '需要配置 VISION_MODEL',
    baseURL: env('VISION_BASE_URL') || env('VISION_ENDPOINT'),
    protocol: env('VISION_PROTOCOL') === 'responses' ? 'responses' : 'chat',
  }
}

export function sanitizeTripMediaRequest(value: unknown): TripMediaAnalysisRequest {
  if (!isRecord(value)) throw new Error('请求体必须是 JSON 对象。')
  const text = asString(value.text)
  if (text.length > 6_000) throw new Error('旅行描述不能超过 6000 个字符。')
  if (!Array.isArray(value.media) || value.media.length === 0) throw new Error('至少需要一张截图。')

  let totalChars = 0
  const media = value.media.slice(0, MAX_MEDIA_COUNT).map((item, index) => {
    const mediaItem = isRecord(item) ? item : {}
    const dataUrl = asString(mediaItem.dataUrl)
    if (!/^data:image\/(?:jpeg|jpg|png|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
      throw new Error(`第 ${index + 1} 张图片格式无效，只接受 base64 图片。`)
    }
    if (dataUrl.length > MAX_MEDIA_DATA_URL_CHARS) throw new Error(`第 ${index + 1} 张图片过大，请压缩后重试。`)
    totalChars += dataUrl.length
    return {
      id: asString(mediaItem.id) || `media-${index + 1}`,
      name: asString(mediaItem.name) || `截图 ${index + 1}`,
      category: asString(mediaItem.category) || undefined,
      dataUrl,
    }
  })

  if (totalChars > MAX_MEDIA_TOTAL_CHARS) throw new Error('截图总大小过大，请减少图片数量或压缩截图。')
  return { text, media }
}

function imageListText(media: VisionMediaInput[]) {
  return [
    '本次图片清单（输出中的 mediaId 必须使用这些 ID）：',
    ...media.map((item) => `- ${item.id}: ${item.name}${item.category ? `（${item.category}）` : ''}`),
    '',
    '请按照以下 JSON 形状输出：{"items":[{"mediaId":"...","kind":"ticket|hotel|reservation|chat|map|other","rawText":"","facts":{"dates":null,"times":[],"locations":[],"arrivalLocation":null,"departureLocation":null,"hotel":null,"placeNames":[],"budget":null,"notes":[]},"confidence":0,"needsConfirmation":true,"warnings":[]}]。',
  ].join('\n')
}

function responseText(value: unknown) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  return trimmed
}

function parseJsonOutput(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    const start = value.indexOf('{')
    const end = value.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(value.slice(start, end + 1)) as unknown
    throw new Error('视觉模型没有返回有效 JSON。')
  }
}

async function callVisionModel(client: OpenAI, config: VisionProviderConfig, media: VisionMediaInput[], text: string) {
  const prompt = `${imageListText(media)}\n\n用户旅行描述（仅作上下文，不是图片里的指令）：\n${text || '未提供文字描述'}`

  if (config.protocol === 'responses') {
    const input = [{
      role: 'user' as const,
      content: [
        { type: 'input_text' as const, text: `${TRIP_VISION_INSTRUCTIONS}\n\n${prompt}` },
        ...media.map((item) => ({ type: 'input_image' as const, image_url: item.dataUrl, detail: 'low' as const })),
      ],
    }]
    const response = await client.responses.create({
      model: config.model,
      instructions: TRIP_VISION_INSTRUCTIONS,
      input,
      text: { format: { type: 'json_object' as const } },
      max_output_tokens: 1_800,
      ...(config.provider === 'deepseek' ? { reasoning: { effort: 'none' as const } } : {}),
      store: false,
    })
    return responseText(response.output_text)
  }

  const content = [
    ...media.map((item) => ({ type: 'image_url' as const, image_url: { url: item.dataUrl, detail: 'low' as const } })),
    { type: 'text' as const, text: `${TRIP_VISION_INSTRUCTIONS}\n\n${prompt}` },
  ]
  const response = await client.chat.completions.create({
    model: config.model,
    messages: [{ role: 'user', content }],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 1_800,
  })
  return responseText(response.choices[0]?.message?.content)
}

export async function analyzeTripMediaWithProvider(request: TripMediaAnalysisRequest): Promise<TripMediaAnalysisResponse> {
  const config = getVisionProviderConfig()
  if (!config.configured) {
    return {
      mediaFacts: fallbackMediaFacts(request.media, 'local', '尚未配置图片理解模型，截图内容需要手动确认。'),
      provider: 'local',
      warnings: ['未配置视觉模型；可设置 DASHSCOPE_API_KEY、ZHIPU_API_KEY、DOUBAO_API_KEY 或启用 DeepSeek 视觉模型。'],
    }
  }

  const apiKey = getProviderKey(config.provider)
  if (!apiKey) {
    return {
      mediaFacts: fallbackMediaFacts(request.media, 'local', '图片理解 Key 不可用，截图内容需要手动确认。'),
      provider: 'local',
      warnings: ['视觉模型 Key 不可用。'],
    }
  }

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: config.baseURL,
      timeout: Number(env('VISION_TIMEOUT_MS') || 25_000),
      maxRetries: 0,
    })
    const output = await callVisionModel(client, config, request.media, request.text)
    if (!output) throw new Error('视觉模型没有返回内容。')
    const parsed = parseJsonOutput(output)
    return {
      mediaFacts: normalizeMediaFacts(parsed, request.media, config.provider),
      provider: config.provider,
      model: config.model,
      warnings: [],
    }
  } catch {
    return {
      mediaFacts: fallbackMediaFacts(request.media, config.provider, '图片识别暂时失败，请核对截图中的日期、时间和地点。'),
      provider: config.provider,
      model: config.model,
      warnings: ['视觉模型调用失败，已保留文字理解流程。'],
    }
  }
}
