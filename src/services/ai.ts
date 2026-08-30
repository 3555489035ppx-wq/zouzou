import {
  generatePlans,
  replacePlanPlace,
  understandTrip,
  type GeneratedPlan,
  type MediaFact,
  type TripRequest,
  type TripUnderstanding,
} from './trip/planner'
import { getLocalGuideContext } from './trip/localGuides'
import { ServiceError } from './asyncState'
import { trackPerformance } from './analytics'

export type AIStage = 'listening' | 'reading' | 'thinking' | 'planning' | 'updating' | 'done' | 'success' | 'error'
export type StageListener = (stage: AIStage, label: string) => void

const wait = (ms: number) => new Promise((resolve) => globalThis.setTimeout(resolve, ms))
const remoteAIEnabled = import.meta.env.VITE_REMOTE_AI === '1'
const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '')
// The local parser is the reliable path for this private prototype. Keep a
// remote provider from holding the first-run flow open when a key, model, or
// network is unavailable.
const REMOTE_AI_TIMEOUT_MS = 1_500
const REMOTE_VISION_TIMEOUT_MS = 1_500
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

async function mediaSourceToDataUrl(source: string) {
  if (source.startsWith('data:image/')) return source
  const response = await fetch(source)
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
    media: request.media.map(({ id, name, category }) => ({ id, name, category })),
    mediaFacts: request.mediaFacts ?? [],
  })
}

function isTripUnderstanding(value: unknown): value is TripUnderstanding {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<TripUnderstanding>
  return Boolean(candidate.intent && Array.isArray(candidate.evidence) && typeof candidate.summary === 'string')
}

function isUsableRemoteUnderstanding(value: TripUnderstanding) {
  const intent = value.intent
  if (!intent || typeof intent !== 'object') return false
  // A provider response that contains only defaults is structurally valid but
  // cannot drive the planner. Treat it as a failed provider response and use
  // the deterministic local parser instead.
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
  understandTrip(request: TripRequest, onStage: StageListener): Promise<TripUnderstanding>
  generatePlans(understanding: TripUnderstanding, onStage: StageListener): Promise<GeneratedPlan[]>
  replacePlace(plan: GeneratedPlan, placeId: string, replacementName: string, onStage: StageListener): Promise<GeneratedPlan>
  personalizeTrip(postId: string, mode: 'keep' | 'optimize'): Promise<{ tripId: string; mode: string }>
}

/**
 * Offline execution adapter for the prototype. It performs real parsing and
 * deterministic schedule validation against real Shanghai places, while
 * keeping the provider boundary ready for a server-backed AI adapter later.
 */
class LocalPlanningAIAdapter implements AIService {
  async understandTrip(request: TripRequest, onStage: StageListener) {
    if (!request.text.trim()) throw new Error('请先写下你的旅行想法。')
    onStage('listening', '正在提取日期、预算和必去地点')
    await wait(180)
    onStage('reading', `正在读取 ${request.media.length} 张截图线索`)
    await wait(180)
    const result = understandTrip(request)
    const guideContext = getLocalGuideContext(result.intent.destination, request.text)
    onStage('thinking', result.intent.missing.length > 0 ? '已识别需求，正在标记待确认信息' : '已识别需求和固定行程锚点')
    await wait(180)
    onStage('planning', '检查地点、时间窗口与预算')
    await wait(180)
    onStage('success', '理解完成')
    return {
      ...result,
      ...(guideContext.candidates.length > 0 ? { guideContext } : {}),
    }
  }

  async generatePlans(understanding: TripUnderstanding, onStage: StageListener) {
    for (const label of ['整理真实地点', '安排固定到达与返程', '计算片区移动', '校验营业时间', '平衡预算与缓冲']) {
      onStage('planning', label)
      await wait(140)
    }
    const result = generatePlans(understanding.intent, understanding.guideContext)
    onStage('success', result.every((plan) => plan.validation.passed) ? '3 套可执行方案已准备好' : '方案已生成，还有信息需要确认')
    return result
  }

  async replacePlace(plan: GeneratedPlan, placeId: string, replacementName: string, onStage: StageListener) {
    onStage('updating', '理解这个地点在路线中的作用')
    await wait(180)
    onStage('updating', '重新检查前后路程与营业时间')
    await wait(180)
    const nextPlan = replacePlanPlace(plan, placeId, replacementName)
    onStage('success', nextPlan.validation.passed ? '已局部更新，路线仍然可执行' : '已更新，但需要重新确认行程条件')
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

  private fetchRemoteMediaFacts(request: TripRequest) {
    const key = JSON.stringify({
      text: request.text,
      media: request.media.slice(0, MAX_VISION_MEDIA_COUNT).map(({ id, name, category }) => ({ id, name, category })),
    })
    const existing = this.mediaInFlight.get(key)
    if (existing) return existing

    const requestPromise = (async () => {
      const media = (await Promise.all(request.media.slice(0, MAX_VISION_MEDIA_COUNT).map(async (item) => {
        if (!item.src) return null
        try {
          const dataUrl = await mediaSourceToDataUrl(item.src)
          return dataUrl ? { id: item.id, name: item.name, category: item.category, dataUrl } : null
        } catch {
          return null
        }
      }))).filter((item): item is { id: string; name: string; category: string | undefined; dataUrl: string } => Boolean(item))

      if (media.length === 0) {
        return { mediaFacts: [], provider: 'local', warnings: ['截图无法从当前页面读取，已继续使用文字理解。'] }
      }

      const controller = new AbortController()
      try {
        return await withTimeout((async () => {
          const response = await fetch(`${this.apiBase}/api/trips/media/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({ text: request.text, media }),
          })
          const payload: unknown = await response.json().catch(() => null)
          if (!response.ok) {
            const message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
              ? payload.message
              : `截图理解服务返回 ${response.status}`
            throw new ServiceError(message, response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : response.status === 429 ? 'RATE_LIMITED' : 'UNKNOWN')
          }
          if (!isMediaAnalysisResponse(payload)) throw new ServiceError('截图理解服务没有返回结构化事实。', 'INVALID_RESPONSE')
          return payload
        })(), REMOTE_VISION_TIMEOUT_MS, () => controller.abort())
      } finally {
        controller.abort()
      }
    })()

    this.mediaInFlight.set(key, requestPromise)
    void requestPromise.then(
      () => { if (this.mediaInFlight.get(key) === requestPromise) this.mediaInFlight.delete(key) },
      () => { if (this.mediaInFlight.get(key) === requestPromise) this.mediaInFlight.delete(key) },
    )
    return requestPromise
  }

  private fetchRemoteUnderstanding(request: TripRequest) {
    const key = remoteRequestKey(request)
    const existing = this.inFlight.get(key)
    if (existing) return existing

    const requestPromise = (async () => {
      const controller = new AbortController()
      try {
        return await withTimeout((async () => {
          const response = await fetch(`${this.apiBase}/api/trips/understand`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              text: request.text,
              media: request.media.map(({ id, name, category }) => ({ id, name, category })),
              ...(request.mediaFacts && request.mediaFacts.length > 0 ? { mediaFacts: request.mediaFacts } : {}),
            }),
          })
          const payload: unknown = await response.json().catch(() => null)
          if (!response.ok) {
            const message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
              ? payload.message
              : `文本理解服务返回 ${response.status}`
            throw new ServiceError(message, response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : response.status === 429 ? 'RATE_LIMITED' : 'UNKNOWN')
          }
          if (!isTripUnderstanding(payload) || !isUsableRemoteUnderstanding(payload)) {
            throw new ServiceError('文本理解服务没有返回可用于排程的旅行意图。', 'INVALID_RESPONSE')
          }
          return payload
        })(), REMOTE_AI_TIMEOUT_MS, () => controller.abort())
      } finally {
        controller.abort()
      }
    })()

    this.inFlight.set(key, requestPromise)
    void requestPromise.then(
      () => { if (this.inFlight.get(key) === requestPromise) this.inFlight.delete(key) },
      () => { if (this.inFlight.get(key) === requestPromise) this.inFlight.delete(key) },
    )
    return requestPromise
  }

  private async runRemoteUnderstanding(request: TripRequest, onStage: StageListener) {
    if (!request.text.trim()) throw new Error('请先写下你的旅行想法。')
    onStage('listening', '正在连接文本理解服务')

    let enrichedRequest = request
    if (request.media.length > 0) {
      onStage('reading', `正在识别 ${request.media.length} 张截图中的日期、时间和地点`)
      try {
        const mediaResult = await this.fetchRemoteMediaFacts(request)
        if (mediaResult.mediaFacts.length > 0) {
          enrichedRequest = { ...request, mediaFacts: mediaResult.mediaFacts }
          const uncertainCount = mediaResult.mediaFacts.filter((fact) => fact.needsConfirmation).length
          onStage('thinking', uncertainCount > 0 ? `已提取截图事实，还有 ${uncertainCount} 张需要核对` : '已提取截图事实，正在结合旅行描述')
        } else {
          onStage('thinking', '截图没有得到确定事实，正在结合旅行描述')
        }
      } catch {
        onStage('thinking', '截图识别暂不可用，先根据文字继续理解')
      }
    }

    try {
      const payload = await this.fetchRemoteUnderstanding(enrichedRequest)
      onStage('success', '已完成结构化理解')
      return payload
    } catch {
      // Local fallback keeps the prototype usable before a server or API key is configured.
      onStage('reading', '服务端暂不可用，切换本地解析')
      return this.local.understandTrip(enrichedRequest, onStage)
    }
  }

  async understandTrip(request: TripRequest, onStage: StageListener) {
    const startedAt = typeof performance === 'undefined' ? Date.now() : performance.now()
    if (!this.remoteAIEnabled) {
      try {
        return await this.local.understandTrip(request, onStage)
      } finally {
        trackPerformance('trip_understanding', (typeof performance === 'undefined' ? Date.now() : performance.now()) - startedAt)
      }
    }
    const key = remoteRequestKey(request)
    const existing = this.understandingInFlight.get(key)
    if (existing) return existing
    const requestPromise = this.runRemoteUnderstanding(request, onStage).finally(() => {
      trackPerformance('trip_understanding', (typeof performance === 'undefined' ? Date.now() : performance.now()) - startedAt)
    })
    this.understandingInFlight.set(key, requestPromise)
    void requestPromise.then(
      () => { if (this.understandingInFlight.get(key) === requestPromise) this.understandingInFlight.delete(key) },
      () => { if (this.understandingInFlight.get(key) === requestPromise) this.understandingInFlight.delete(key) },
    )
    return requestPromise
  }

  generatePlans(understanding: TripUnderstanding, onStage: StageListener) {
    return this.local.generatePlans(understanding, onStage)
  }

  replacePlace(plan: GeneratedPlan, placeId: string, replacementName: string, onStage: StageListener) {
    return this.local.replacePlace(plan, placeId, replacementName, onStage)
  }

  personalizeTrip(postId: string, mode: 'keep' | 'optimize') {
    return this.local.personalizeTrip(postId, mode)
  }
}

export const aiService: AIService = new PlanningAIAdapter()
