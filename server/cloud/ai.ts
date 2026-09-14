import { z } from 'zod'
import { TRIP_INTENT_INSTRUCTIONS, TRIP_VISION_INSTRUCTIONS } from '../ai-guidelines'
import { buildUnderstandingSummary, completePlanOptions, generatePlans, type TripIntent } from '../../src/services/trip/planner'
import { mediaFactSchema, tripIntentSchema } from '../../src/services/trip/schemas'
import { getLocalGuideContext } from '../../src/services/trip/localGuides'
import { cityNames } from '../../src/demo-data/cities'
import { isRuntimeCityAllowed } from '../../src/services/trip/runtimeKnowledgePolicy'

export type CloudAIEnv = {
  KNOWLEDGE_RELEASE_APPROVED?: string
  AI_PROVIDER?: string
  DEEPSEEK_API_KEY?: string
  DEEPSEEK_MODEL?: string
  OPENAI_API_KEY?: string
  OPENAI_MODEL?: string
}

export const CLOUD_AI_TIMEOUT_MS = 20_000
const MAX_BODY_BYTES = 26_000_000
const MAX_MODEL_BYTES = 256_000
const mediaInfo = z.object({ id: z.string().min(1).max(160), name: z.string().max(240), category: z.string().max(80).optional() })
const requestSchema = z.object({ text: z.string().trim().min(1).max(10_000), media: z.array(mediaInfo).max(6).default([]), mediaFacts: z.array(mediaFactSchema).max(6).optional() })
// Strip caller/model extras: guideContext, knowledge and arbitrary planner flags
// cannot introduce unreviewed recommendations into cloud scheduling.
const intentSchema = tripIntentSchema.strip().extend({
  lowMobility: z.boolean().optional(), indoorOnly: z.boolean().optional(),
  roomCount: z.number().int().min(1).max(100).optional(),
  unavailablePlaces: z.array(z.string().min(1).max(240)).max(40).optional(),
}).superRefine((intent, ctx) => {
  if (intent.nights > intent.durationDays || (intent.dates && (
    !Number.isFinite(Date.parse(intent.dates.start)) || !Number.isFinite(Date.parse(intent.dates.end)) ||
    new Date(intent.dates.start).toISOString().slice(0, 10) !== intent.dates.start ||
    new Date(intent.dates.end).toISOString().slice(0, 10) !== intent.dates.end ||
    Math.round((Date.parse(intent.dates.end) - Date.parse(intent.dates.start)) / 86_400_000) + 1 !== intent.durationDays
  ))) ctx.addIssue({ code: 'custom', message: '日期与行程天数不一致' })
})

class CloudAIError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function readJson(input: Request | Response, limit: number, signal: AbortSignal): Promise<unknown> {
  if (Number(input.headers.get('content-length')) > limit) {
    await input.body?.cancel().catch(() => undefined)
    throw new CloudAIError(413, 'PAYLOAD_TOO_LARGE', '请求或模型响应超过大小限制。')
  }
  const reader = input.body?.getReader()
  if (!reader) throw new CloudAIError(400, 'INVALID_JSON', '缺少 JSON 内容。')
  const chunks: Uint8Array[] = []
  let size = 0
  const cancel = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    signal.throwIfAborted()
    for (;;) {
      const { done, value } = await reader.read()
      signal.throwIfAborted()
      if (done) break
      size += value.byteLength
      if (size > limit) throw new CloudAIError(413, 'PAYLOAD_TOO_LARGE', '请求或模型响应超过大小限制。')
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    try { return JSON.parse(new TextDecoder().decode(bytes)) }
    catch { throw new CloudAIError(400, 'INVALID_JSON', '内容不是有效 JSON。') }
  } finally {
    signal.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function providerConfig(env: CloudAIEnv, vision: boolean) {
  const provider = env.AI_PROVIDER?.trim() || (env.DEEPSEEK_API_KEY?.trim() ? 'deepseek' : 'openai')
  if (provider !== 'deepseek' && provider !== 'openai') throw new CloudAIError(503, 'AI_NOT_CONFIGURED', '云端 AI_PROVIDER 必须配置为 deepseek 或 openai。')
  // The supplied environment has no dedicated vision binding. Do not pretend
  // a text-only DeepSeek model can inspect images, or silently switch providers.
  if (vision && provider !== 'openai') throw new CloudAIError(422, 'VISION_UNSUPPORTED', '当前云端文本模型不支持截图识别，请配置 OpenAI 视觉模型。')
  const key = (provider === 'deepseek' ? env.DEEPSEEK_API_KEY : env.OPENAI_API_KEY)?.trim()
  if (!key) throw new CloudAIError(503, 'AI_NOT_CONFIGURED', '云端 AI 密钥尚未配置。')
  const model = (provider === 'deepseek' ? env.DEEPSEEK_MODEL?.trim() : env.OPENAI_MODEL?.trim()) || (provider === 'deepseek' ? 'deepseek-flash' : 'gpt-5.4')
  return { provider, model, key, url: provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions' }
}

async function callModel(env: CloudAIEnv, signal: AbortSignal, instructions: string, content: unknown, vision = false) {
  const config = providerConfig(env, vision)
  let response: Response
  try {
    response = await fetch(config.url, {
      method: 'POST', signal,
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: instructions }, { role: 'user', content }], response_format: { type: 'json_object' }, ...(config.provider === 'openai' ? { max_completion_tokens: 6000 } : { max_tokens: 6000 }) }),
    })
  } catch { signal.throwIfAborted(); throw new CloudAIError(502, 'AI_UNAVAILABLE', '无法连接云端模型，请重试。') }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    throw new CloudAIError(response.status === 429 ? 429 : 502, response.status === 429 ? 'RATE_LIMITED' : 'AI_PROVIDER_ERROR', response.status === 429 ? '模型服务请求过于频繁，请稍后重试。' : '模型服务拒绝请求，请检查云端配置或稍后重试。')
  }
  let payload: unknown
  try { payload = await readJson(response, MAX_MODEL_BYTES, signal) }
  catch { signal.throwIfAborted(); throw new CloudAIError(502, 'AI_INVALID_RESPONSE', '模型响应不是有效的完整 JSON。') }
  const completion = z.object({ model: z.string().min(1), choices: z.array(z.object({ finish_reason: z.literal('stop'), message: z.object({ content: z.string().min(1), refusal: z.string().nullish() }) })).min(1) }).safeParse(payload)
  if (!completion.success || completion.data.choices[0].message.refusal) throw new CloudAIError(502, 'AI_INVALID_RESPONSE', '模型未返回完整的结构化结果。')
  let output: unknown
  try { output = JSON.parse(completion.data.choices[0].message.content) }
  catch { throw new CloudAIError(502, 'AI_INVALID_RESPONSE', '模型内容不是有效 JSON。') }
  return { output, provider: config.provider, model: completion.data.model, requestedModel: config.model }
}

async function understand(body: unknown, env: CloudAIEnv, signal: AbortSignal, knowledgeVersion: string) {
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) throw new CloudAIError(400, 'INVALID_REQUEST', '请提供旅行文字和有效的截图信息。')
  const schema = z.toJSONSchema(tripIntentSchema.strip(), { unrepresentable: 'any' })
  const result = await callModel(env, signal, `${TRIP_INTENT_INSTRUCTIONS}\nJSON Schema: ${JSON.stringify(schema)}`, JSON.stringify(parsed.data))
  const checked = intentSchema.safeParse(result.output)
  if (!checked.success) throw new CloudAIError(502, 'AI_INVALID_RESPONSE', '模型返回的旅行意图字段或日期不合法。')
  // tsconfig.node disables strictNullChecks, which makes Zod's nullable fields
  // infer as optional; safeParse above has already required every field.
  const intent = checked.data as TripIntent
  const guideContext = { ...getLocalGuideContext(intent.destination, parsed.data.text), knowledgeVersion, query: parsed.data.text }
  return { intent, evidence: [parsed.data.text], summary: buildUnderstandingSummary(intent), guideContext, mediaFacts: parsed.data.mediaFacts ?? [], provider: result.provider, model: result.model, requestedModel: result.requestedModel, knowledgeVersion }
}

/** Worker routing only; authentication, persistence and deployment belong to the caller. */
export async function handleCloudAI(request: Request, env: CloudAIEnv, knowledgeVersion: string): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/\/$/, '')
  const guidesRequest = path === '/api/guides'
  if (!guidesRequest && !['/api/trips/understand', '/api/trips/generate', '/api/trips/media/analyze', '/api/trips/media'].includes(path)) return json({ code: 'NOT_FOUND', message: 'AI 接口不存在。' }, 404)
  const method = guidesRequest ? 'GET' : 'POST'
  if (request.method !== method) return new Response(JSON.stringify({ code: 'METHOD_NOT_ALLOWED', message: `请使用 ${method}。` }), { status: 405, headers: { Allow: method, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  const controller = new AbortController()
  const signal = AbortSignal.any([request.signal, controller.signal])
  const timeout = setTimeout(() => controller.abort(), CLOUD_AI_TIMEOUT_MS)
  try {
    signal.throwIfAborted()
    if (env.KNOWLEDGE_RELEASE_APPROVED !== 'true' || !knowledgeVersion.trim()) throw new CloudAIError(503, 'KNOWLEDGE_NOT_APPROVED', '运行时知识尚未获准发布，云端 AI 暂不可用。')
    if (guidesRequest) {
      const params = new URL(request.url).searchParams
      const city = params.get('city')?.trim() ?? ''
      const query = (params.get('q') ?? '').trim()
      if (!city || city.length > 120 || query.length > 10_000) throw new CloudAIError(400, 'INVALID_REQUEST', '请提供有效城市和查询。')
      if (!cityNames.includes(city) || !isRuntimeCityAllowed(city)) throw new CloudAIError(422, 'UNSUPPORTED_DESTINATION', '当前城市资料不足。')
      return json({ ...getLocalGuideContext(city, query), knowledgeVersion, query })
    }
    if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new CloudAIError(415, 'UNSUPPORTED_MEDIA_TYPE', '请发送 application/json。')
    const body = await readJson(request, path.includes('/media') ? MAX_BODY_BYTES : 256_000, signal)
    if (path.endsWith('/understand')) return json(await understand(body, env, signal, knowledgeVersion))
    if (path.endsWith('/generate')) {
      const structured = z.object({ understanding: z.object({ intent: intentSchema }) }).safeParse(body)
      const understanding = structured.success ? { intent: structured.data.understanding.intent, provider: 'deterministic', model: 'knowledge-constrained-scheduler', knowledgeVersion } : await understand(body, env, signal, knowledgeVersion)
      const intent = understanding.intent as TripIntent
      if (!cityNames.includes(intent.destination) || !isRuntimeCityAllowed(intent.destination)) throw new CloudAIError(422, 'UNSUPPORTED_DESTINATION', '当前目的地尚无已审核运行时知识，请确认城市。')
      // Re-fetch server-owned runtime context; never use caller-supplied guides.
      const context = getLocalGuideContext(intent.destination, [intent.destination, ...intent.mustVisit, ...intent.preferences].join(' '))
      signal.throwIfAborted()
      let plans
      try { plans = completePlanOptions(generatePlans(intent, context, { enabled: false })) }
      catch { throw new CloudAIError(422, 'PLANNING_INCOMPLETE', '当前知识和条件不足以完成行程，请调整日期、目的地或约束。') }
      signal.throwIfAborted()
      const metadata = { provider: understanding.provider, model: understanding.model, knowledgeVersion, generationMethod: structured.success ? 'knowledge-constrained-scheduler' : 'model-intent+knowledge-constrained-scheduler' }
      return json({ plans: plans.map(plan => ({ ...plan, ...metadata })), understanding, ...metadata })
    }
    const mediaRequest = z.object({ text: z.string().max(10_000).default(''), media: z.array(mediaInfo.extend({ dataUrl: z.string().max(10_500_000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/) })).min(1).max(6) }).safeParse(body)
    if (!mediaRequest.success || new Set(mediaRequest.data.media.map(item => item.id)).size !== mediaRequest.data.media.length) throw new CloudAIError(400, 'INVALID_MEDIA', '截图必须是有效的 PNG、JPEG 或 WebP，且标识不能重复。')
    const media = mediaRequest.data.media
    const fields = z.toJSONSchema(mediaFactSchema.strip(), { unrepresentable: 'any' })
    const content = [{ type: 'text', text: JSON.stringify({ text: mediaRequest.data.text, media: media.map(({ id, name }) => ({ mediaId: id, name })) }) }, ...media.map(item => ({ type: 'image_url', image_url: { url: item.dataUrl } }))]
    const result = await callModel(env, signal, `${TRIP_VISION_INSTRUCTIONS}\n每个 items 元素符合此 JSON Schema: ${JSON.stringify(fields)}`, content, true)
    const checked = z.object({ items: z.array(mediaFactSchema.strip()).min(1).max(6) }).safeParse(result.output)
    if (!checked.success || checked.data.items.length !== media.length || new Set(checked.data.items.map(item => item.mediaId)).size !== media.length || media.some(item => !checked.data.items.some(fact => fact.mediaId === item.id))) throw new CloudAIError(502, 'AI_INVALID_RESPONSE', '模型没有返回与每张截图对应的有效事实。')
    const mediaFacts = media.map(item => { const fact = checked.data.items.find(fact => fact.mediaId === item.id)!; return { ...fact, name: item.name, provider: result.provider, needsConfirmation: true, warnings: [...new Set([...fact.warnings, '截图提取结果需由你核对确认。'])] } })
    return json({ mediaFacts, provider: result.provider, model: result.model, requestedModel: result.requestedModel, knowledgeVersion, warnings: ['截图提取结果需由你核对确认。'] })
  } catch (error) {
    if (request.signal.aborted) return json({ code: 'CANCELLED', message: '请求已取消。' }, 499)
    if (controller.signal.aborted) return json({ code: 'TIMEOUT', message: '云端模型处理超时，请重试。' }, 504)
    if (error instanceof CloudAIError) return json({ code: error.code, message: error.message }, error.status)
    return json({ code: 'AI_INTERNAL_ERROR', message: '云端处理失败，请稍后重试。' }, 500)
  } finally { clearTimeout(timeout) }
}
