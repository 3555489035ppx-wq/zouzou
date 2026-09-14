import {
  generatePlans,
  completePlanOptions,
  replacePlanPlace,
  understandTrip,
  type GeneratedPlan,
  type MediaFact,
  type TripRequest,
  type TripUnderstanding,
} from './trip/planner'
import { getLocalGuideContext, primeClientGuideContext } from './trip/localGuides'
import { ServiceError } from './asyncState'
import { trackPerformance } from './analytics'
import { parseGeneratedPlans, parseTripUnderstanding } from './trip/schemas'
import { extractExperiencePreferences } from './trip/experiencePolicy'

export type AIStage = 'listening' | 'reading' | 'thinking' | 'planning' | 'updating' | 'done' | 'success' | 'error'
export type StageListener = (stage: AIStage, label: string) => void

const wait = (ms: number) => new Promise((resolve) => globalThis.setTimeout(resolve, ms))
const UNDERSTANDING_STAGE_DELAY = 0
const remoteAIEnabled = import.meta.env.VITE_REMOTE_AI === '1' || (import.meta.env.PROD && import.meta.env.VITE_REMOTE_AI !== '0')
const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '')
// Cloud failures remain visible. Local planning is an explicitly selected mode.
const REMOTE_AI_TIMEOUT_MS = 25_000
const REMOTE_VISION_TIMEOUT_MS = 30_000
const MAX_VISION_MEDIA_COUNT = 6
const MAX_VISION_IMAGE_BYTES = 3_500_000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout?: () => void) {
  return new Promise<T>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      onTimeout?.()
      reject(new ServiceError(`远程服务超过 ${timeoutMs}ms 未响应`, 'TIMEOUT'))
    }, timeoutMs)
    promise.then(
      (value) => { globalThis.clearTimeout(timeout); resolve(value) },
      (reason) => { globalThis.clearTimeout(timeout); reject(reason) },
    )
  })
}

function remoteServiceError(payload: unknown, status: number, fallback: string) {
  const value = payload && typeof payload === 'object' ? payload as { message?: unknown; code?: unknown } : {}
  const message = typeof value.message === 'string' ? value.message : `${fallback}（${status}）`
  const code = value.code === 'TIMEOUT' || status === 504 ? 'TIMEOUT'
    : value.code === 'CANCELLED' || status === 499 ? 'CANCELLED'
    : status === 401 || status === 403 ? 'UNAUTHORIZED'
    : status === 429 ? 'RATE_LIMITED'
    : value.code === 'AI_INVALID_RESPONSE' ? 'INVALID_RESPONSE' : 'UNKNOWN'
  return new ServiceError(message, code)
}

type MediaAnalysisResponse = {
  mediaFacts: MediaFact[]
  provider: string
  model?: string
  warnings: string[]
}

function isMediaAnalysisResponse(value: unknown): value is MediaAnalysisResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MediaAnalysisResponse>
  return Array.isArray(candidate.mediaFacts) && typeof candidate.provider === 'string' && Array.isArray(candidate.warnings)
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片读取失败'))
    reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

async function mediaSourceToDataUrl(source: string, signal?: AbortSignal) {
  signal?.throwIfAborted()
  if (source.startsWith('data:image/')) return source
  const deadline = AbortSignal.timeout(REMOTE_VISION_TIMEOUT_MS)
  const response = await fetch(source, { signal: signal ? AbortSignal.any([signal, deadline]) : deadline })
  if (!response.ok) throw new ServiceError(`图片读取失败（${response.status}）`, response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : 'UNKNOWN')
  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) return null
  if (blob.size <= MAX_VISION_IMAGE_BYTES || typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return readBlobAsDataUrl(blob)
  }

  const bitmap = await createImageBitmap(blob)
  try {
    const maxSide = 2_000
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return readBlobAsDataUrl(blob)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.84)
  } finally {
    bitmap.close()
  }
}

type PlanningAIAdapterOptions = {
  remoteAIEnabled?: boolean
  apiBase?: string
}

function remoteRequestKey(request: TripRequest) {
  return JSON.stringify({
    text: request.text,
    media: request.media.map(({ id, name, category, src }) => ({ id, name, category, src })),
    mediaFacts: request.mediaFacts ?? [],
  })
}

function isUsableRemoteUnderstanding(value: TripUnderstanding) {
  const intent = value.intent
  if (!intent || typeof intent !== 'object') return false
  // A provider response that contains only defaults cannot drive the planner.
  if (intent.destination === '未确定') return false
  if (intent.durationDays < 1 || intent.partySize < 1) return false
  return Boolean(
    intent.dates
      || intent.budget !== null
      || intent.arrivalTime
      || intent.departureTime
      || intent.hotel
      || intent.mustVisit.length > 0
      || intent.preferences.length > 0,
  )
}

export interface AIService {
  understandTrip(request: TripRequest, onStage: StageListener, signal?: AbortSignal): Promise<TripUnderstanding>
  generatePlans(understanding: TripUnderstanding, onStage: StageListener, signal?: AbortSignal): Promise<GeneratedPlan[]>
  replacePlace(plan: GeneratedPlan, placeId: string, replacementName: string, onStage: StageListener): Promise<GeneratedPlan>
  personalizeTrip(postId: string, mode: 'keep' | 'optimize'): Promise<{ tripId: string; mode: string }>
}

/**
 * Offline execution adapter for the prototype. It performs real parsing and
 * deterministic schedule validation against real Shanghai places, while
 * keeping the provider boundary ready for a server-backed AI adapter later.
 */
class LocalPlanningAIAdapter implements AIService {
  async understandTrip(request: TripRequest, onStage: StageListener, signal?: AbortSignal) {
    signal?.throwIfAborted()
    if (!request.text.trim()) throw new Error('请先写下你的旅行想法。')
    onStage('listening', '正在提取日期、预算和必去地点')
    await wait(UNDERSTANDING_STAGE_DELAY)
    if (request.media.length > 0) {
      onStage('reading', `正在读取 ${request.media.length} 张截图线索`)
      await wait(UNDERSTANDING_STAGE_DELAY)
    }
    const result = understandTrip(request)
    signal?.throwIfAborted()
    const guideContext = getLocalGuideContext(result.intent.destination, request.text)
    onStage('thinking', result.intent.missing.length > 0 ? '已识别需求，正在标记待确认信息' : '已识别需求和固定行程锚点')
    await wait(UNDERSTANDING_STAGE_DELAY)
    onStage('thinking', '整理已提取条件与待确认项')
    await wait(UNDERSTANDING_STAGE_DELAY)
    onStage('success', '理解完成')
    return {
      ...result,
      ...(guideContext.candidates.length > 0 ? { guideContext } : {}),
    }
  }

  async generatePlans(understanding: TripUnderstanding, onStage: StageListener, signal?: AbortSignal) {
    signal?.throwIfAborted()
    onStage('planning', '正在按当前资料排程并检查时间与预算')
    await wait(0)
    signal?.throwIfAborted()
    onStage('planning', '正在配齐每天的餐厅、住宿与游览安排')
    const result = completePlanOptions(generatePlans(understanding.intent, understanding.guideContext))
    onStage('success', result.every((plan) => plan.validation.passed) ? '方案算术检查完成；营业与交通仍需确认' : '方案已生成，还有信息需要确认')
    return result
  }

  async replacePlace(plan: GeneratedPlan, placeId: string, replacementName: string, onStage: StageListener) {
    onStage('updating', '理解这个地点在路线中的作用')
    await wait(180)
    onStage('updating', '重新检查前后路程与营业时间')
    await wait(180)
    const nextPlan = replacePlanPlace(plan, placeId, replacementName)
    onStage('success', nextPlan.validation.passed ? '已局部更新，请复核受影响的安排' : '已更新，但需要重新确认行程条件')
    return nextPlan
  }

  async personalizeTrip(postId: string, mode: 'keep' | 'optimize') {
    await wait(220)
    return { tripId: `copy-${postId}`, mode }
  }
}

export class PlanningAIAdapter implements AIService {
  private readonly local = new LocalPlanningAIAdapter()
  private readonly remoteAIEnabled: boolean
  private readonly apiBase: string
  private readonly inFlight = new Map<string, Promise<TripUnderstanding>>()
  private readonly understandingInFlight = new Map<string, Promise<TripUnderstanding>>()
  private readonly mediaInFlight = new Map<string, Promise<MediaAnalysisResponse>>()

  constructor(options: PlanningAIAdapterOptions = {}) {
    this.remoteAIEnabled = options.remoteAIEnabled ?? remoteAIEnabled
    this.apiBase = options.apiBase ?? apiBase
  }

  private fetchRemoteMediaFacts(request: TripRequest, signal?: AbortSignal) {
    const key = JSON.stringify({
      text: request.text,
      media: request.media.slice(0, MAX_VISION_MEDIA_COUNT).map(({ id, name, category, src }) => ({ id, name, category, src })),
    })
    const existing = this.mediaInFlight.get(key)
    if (existing && !signal) return existing

    const requestPromise = (async () => {
      if (this.remoteAIEnabled && request.media.length > MAX_VISION_MEDIA_COUNT) throw new ServiceError('每次最多识别 6 张截图。', 'INVALID_RESPONSE')
      const media = (await Promise.all(request.media.slice(0, MAX_VISION_MEDIA_COUNT).map(async (item) => {
        if (!item.src) {
          if (this.remoteAIEnabled) throw new ServiceError('截图无法读取，请重新上传。', 'INVALID_RESPONSE')
          return null
        }
        try {
          const dataUrl = await mediaSourceToDataUrl(item.src, signal)
          if (!dataUrl && this.remoteAIEnabled) throw new ServiceError('截图格式无法识别，请重新上传。', 'INVALID_RESPONSE')
          return dataUrl ? { id: item.id, name: item.name, category: item.category, dataUrl } : null
        } catch (error) {
          signal?.throwIfAborted()
          if (this.remoteAIEnabled) throw error
          return null
        }
      }))).filter((item): item is { id: string; name: string; category: string | undefined; dataUrl: string } => Boolean(item))

      if (media.length === 0) {
        if (this.remoteAIEnabled) throw new ServiceError('截图无法读取，请重新上传。', 'INVALID_RESPONSE')
        return { mediaFacts: [], provider: 'local', warnings: ['截图无法从当前页面读取，已继续使用文字理解。'] }
      }

      const controller = new AbortController()
      try {
        return await withTimeout((async () => {
          const response = await fetch(`${this.apiBase}/api/trips/media/analyze`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            signal: signal ? AbortSignal.any([signal,controller.signal]) : controller.signal,
            body: JSON.stringify({ text: request.text, media }),
          })
          const payload: unknown = await response.json().catch(() => null)
          if (!response.ok) {
            throw remoteServiceError(payload, response.status, '截图理解服务失败')
          }
          if (!isMediaAnalysisResponse(payload)) throw new ServiceError('截图理解服务没有返回结构化事实。', 'INVALID_RESPONSE')
          if (this.remoteAIEnabled && payload.provider === 'local') throw new ServiceError('云端没有执行截图识别。', 'INVALID_RESPONSE')
          return payload
        })(), REMOTE_VISION_TIMEOUT_MS, () => controller.abort())
      } finally {
        controller.abort()
      }
    })()

    if (!signal) this.mediaInFlight.set(key, requestPromise)
    void requestPromise.then(
      () => { if (this.mediaInFlight.get(key) === requestPromise) this.mediaInFlight.delete(key) },
      () => { if (this.mediaInFlight.get(key) === requestPromise) this.mediaInFlight.delete(key) },
    )
    return requestPromise
  }

  private fetchRemoteUnderstanding(request: TripRequest, signal?: AbortSignal) {
    const key = remoteRequestKey(request)
    const existing = this.inFlight.get(key)
    if (existing && !signal) return existing

    const requestPromise = (async () => {
      const controller = new AbortController()
      try {
        return await withTimeout((async () => {
          const response = await fetch(`${this.apiBase}/api/trips/understand`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            signal: signal ? AbortSignal.any([signal,controller.signal]) : controller.signal,
            body: JSON.stringify({
              text: request.text,
              media: request.media.map(({ id, name, category }) => ({ id, name, category })),
              ...(request.mediaFacts && request.mediaFacts.length > 0 ? { mediaFacts: request.mediaFacts } : {}),
            }),
          })
          const payload: unknown = await response.json().catch(() => null)
          if (!response.ok) {
            throw remoteServiceError(payload, response.status, '文本理解服务失败')
          }
          const understanding = parseTripUnderstanding(payload)
          if (payload && typeof payload === 'object' && 'provider' in payload && payload.provider === 'local') throw new ServiceError('云端没有执行模型理解。', 'INVALID_RESPONSE')
          if (!understanding || !isUsableRemoteUnderstanding(understanding)) {
            throw new ServiceError('文本理解服务没有返回可用于排程的旅行意图。', 'INVALID_RESPONSE')
          }
          primeClientGuideContext(understanding.guideContext, request.text)
          return understanding
        })(), REMOTE_AI_TIMEOUT_MS, () => controller.abort())
      } finally {
        controller.abort()
      }
    })()

    if (!signal) this.inFlight.set(key, requestPromise)
    void requestPromise.then(
      () => { if (this.inFlight.get(key) === requestPromise) this.inFlight.delete(key) },
      () => { if (this.inFlight.get(key) === requestPromise) this.inFlight.delete(key) },
    )
    return requestPromise
  }

  private async runRemoteUnderstanding(request: TripRequest, onStage: StageListener, signal?: AbortSignal) {
    signal?.throwIfAborted()
    if (!request.text.trim()) throw new Error('请先写下你的旅行想法。')
    onStage('listening', '正在连接文本理解服务')

    let enrichedRequest = request
    if (request.media.length > 0) {
      onStage('reading', `正在识别 ${request.media.length} 张截图中的日期、时间和地点`)
      try {
        const mediaResult = await this.fetchRemoteMediaFacts(request,signal)
        if (mediaResult.mediaFacts.length > 0) {
          enrichedRequest = { ...request, mediaFacts: mediaResult.mediaFacts }
          const uncertainCount = mediaResult.mediaFacts.filter((fact) => fact.needsConfirmation).length
          onStage('thinking', uncertainCount > 0 ? `已提取截图事实，还有 ${uncertainCount} 张需要核对` : '已提取截图事实，正在结合旅行描述')
        } else {
          onStage('thinking', '截图没有得到确定事实，正在结合旅行描述')
        }
      } catch (error) {
        signal?.throwIfAborted()
        if (this.remoteAIEnabled) { onStage('error', '截图识别失败，请重试'); throw error }
        onStage('thinking', '截图识别暂不可用，先根据文字继续理解')
      }
    }

    if (request.media.length && !enrichedRequest.mediaFacts?.length) {
      enrichedRequest = {...request, mediaFacts: request.media.map(item => ({mediaId:item.id, name:item.name, kind:'other', rawText:'', facts:{dates:null,times:[],locations:[],arrivalLocation:null,departureLocation:null,hotel:null,placeNames:[],budget:null,notes:[]}, confidence:0, needsConfirmation:true, warnings:['截图暂未识别，请核对或重新上传。'], provider:'local'}))}
    }
    if (!this.remoteAIEnabled) return this.local.understandTrip(enrichedRequest, onStage, signal)

    try {
      let payload = await this.fetchRemoteUnderstanding(enrichedRequest,signal)
      signal?.throwIfAborted()
      // Keep explicit scenario constraints even with an older deployed intent API.
      const explicit = extractExperiencePreferences(enrichedRequest.text)
      const localIntent = understandTrip(enrichedRequest).intent
      if (explicit.length || localIntent.pace === 'relaxed' || localIntent.lowMobility) {
        payload = {...payload,intent:{...payload.intent,
          preferences:[...new Set([...payload.intent.preferences,...explicit])],
          ...(localIntent.pace === 'relaxed' ? {pace:'relaxed' as const} : {}),
          ...(localIntent.lowMobility ? {lowMobility:true} : {}),
        }}
      }
      onStage('success', '已完成结构化理解')
      return payload
    } catch (error) {
      signal?.throwIfAborted()
      onStage('error', error instanceof Error ? error.message : '云端理解失败，请重试')
      throw error
    }
  }

  async understandTrip(request: TripRequest, onStage: StageListener, signal?: AbortSignal) {
    signal?.throwIfAborted()
    const startedAt = typeof performance === 'undefined' ? Date.now() : performance.now()
    if (!this.remoteAIEnabled && request.media.length === 0) {
      try {
        return await this.local.understandTrip(request, onStage,signal)
      } finally {
        trackPerformance('trip_understanding', (typeof performance === 'undefined' ? Date.now() : performance.now()) - startedAt)
      }
    }
    const key = remoteRequestKey(request)
    const existing = this.understandingInFlight.get(key)
    if (existing && !signal) return existing
    const requestPromise = this.runRemoteUnderstanding(request, onStage,signal).finally(() => {
      trackPerformance('trip_understanding', (typeof performance === 'undefined' ? Date.now() : performance.now()) - startedAt)
    })
    if (!signal) this.understandingInFlight.set(key, requestPromise)
    void requestPromise.then(
      () => { if (this.understandingInFlight.get(key) === requestPromise) this.understandingInFlight.delete(key) },
      () => { if (this.understandingInFlight.get(key) === requestPromise) this.understandingInFlight.delete(key) },
    )
    return requestPromise
  }

  async generatePlans(understanding: TripUnderstanding, onStage: StageListener, signal?: AbortSignal) {
    signal?.throwIfAborted()
    if (!this.remoteAIEnabled) return this.local.generatePlans(understanding, onStage, signal)
    const controller = new AbortController()
    onStage('planning', '正在由云端按已确认条件和知识资料排程')
    try {
      const plans = await withTimeout((async () => {
        const response = await fetch(`${this.apiBase}/api/trips/generate`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
          body: JSON.stringify({ understanding: { intent: understanding.intent } }),
        })
        const payload: unknown = await response.json().catch(() => null)
        if (!response.ok) throw remoteServiceError(payload, response.status, '云端行程生成失败')
        // Accept the legacy array envelope as well as the cloud metadata envelope.
        const values = Array.isArray(payload) ? payload : payload && typeof payload === 'object' && 'plans' in payload ? payload.plans : null
        const result = parseGeneratedPlans(values)
        if (!result?.length) throw new ServiceError('云端未返回有效行程。', 'INVALID_RESPONSE')
        return result
      })(), REMOTE_AI_TIMEOUT_MS, () => controller.abort())
      signal?.throwIfAborted()
      onStage('success', plans.every(plan => plan.validation.passed) ? '云端排程完成；营业与交通仍需确认' : '云端方案已生成，还有信息需要确认')
      return plans
    } catch (error) {
      signal?.throwIfAborted()
      onStage('error', error instanceof Error ? error.message : '云端行程生成失败')
      throw error
    } finally { controller.abort() }
  }

  replacePlace(plan: GeneratedPlan, placeId: string, replacementName: string, onStage: StageListener) {
    return this.local.replacePlace(plan, placeId, replacementName, onStage)
  }

  personalizeTrip(postId: string, mode: 'keep' | 'optimize') {
    return this.local.personalizeTrip(postId, mode)
  }
}

export const aiService: AIService = new PlanningAIAdapter()
