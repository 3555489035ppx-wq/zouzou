import type { GuideContext } from './guides'
import { z } from 'zod'

export type ClientGuideContext = GuideContext & {
  status: 'loading' | 'ready' | 'unavailable'
  knowledgeVersion?: string
  query: string
}
const texts = z.array(z.string())
const candidateSchema = z.object({
  id: z.string(), city: z.string(), platform: z.enum(['xiaohongshu', 'bilibili', 'douyin', 'user-import', 'licensed-search']),
  sourceUrl: z.string(), title: z.string(), author: z.string(), publishedAt: z.string().nullable(), fetchedAt: z.string(), likes: z.number().nullable(),
  summary: z.string(), tags: texts, placeHints: texts,
  foodHints: texts.optional(), localExperienceHints: texts.optional(), hotelHints: texts.optional(), hotelNames: texts.optional(), dietaryTags: texts.optional(),
  claims: z.array(z.object({ type: z.enum(['place', 'activity', 'tip', 'route', 'food']), text: z.string(), placeName: z.string().optional(), confidence: z.number(), verified: z.boolean() })),
  permission: z.enum(['user-provided', 'licensed', 'unknown']),
  experiences: z.array(z.object({ library: z.enum(['city_clusters', 'structure_pace', 'scenarios', 'food_photo_culture', 'pitfalls_plan_b']), subject: z.string(), summary: z.string(), level: z.enum(['candidate', 'supported_pattern', 'high_confidence_experience_pattern']), evidenceLocator: z.string() })).optional(),
  research: z.object({ batch: z.string(), lastReadBatch: z.string().optional(), readLevel: z.enum(['search-metadata', 'note-text', 'video-description', 'video-subtitle']), bodyCharacters: z.number(), evidence: z.array(z.object({ term: z.string(), field: z.string(), locator: z.string() })) }).optional(),
}).passthrough()
const contextSchema = z.object({
  city: z.string().min(1), candidates: z.array(candidateSchema).max(8), matchedTerms: texts,
  generatedAt: z.string(), disclaimer: z.string(), knowledgeVersion: z.string().min(1), query: z.string().optional(),
}).passthrough()
const entries = new Map<string, { context: ClientGuideContext; expires: number }>()
const inFlight = new Map<string, Promise<ClientGuideContext>>()
const listeners = new Set<() => void>()
const TTL_MS = 5 * 60_000
const ERROR_RETRY_MS = 30_000
const MAX_ENTRIES = 64
const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '')
const keyFor = (city: string, query: string) => JSON.stringify([city.trim(), query.trim()])
const notify = () => { for (const listener of listeners) listener() }

function store(key: string, context: ClientGuideContext, ttl = TTL_MS) {
  entries.delete(key)
  entries.set(key, { context, expires: Date.now() + ttl })
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!)
  return context
}
function pending(city: string, query: string): ClientGuideContext {
  return { city: city.trim(), query: query.trim(), candidates: [], matchedTerms: [], generatedAt: '', status: 'loading', disclaimer: '该城市的社区攻略尚未加载，暂不能提供社区依据。' }
}

/** Seed only server-returned contexts, not caller-authored itinerary content. */
export function primeClientGuideContext(value: unknown, query?: string): void {
  const parsed = contextSchema.safeParse(value)
  if (!parsed.success || parsed.data.candidates.some(item => item.city !== parsed.data.city)) return
  const actualQuery = query ?? parsed.data.query ?? ''
  const context = { ...parsed.data, query: actualQuery.trim(), status: 'ready' as const } as ClientGuideContext
  store(keyFor(context.city, actualQuery), context)
  notify()
}

export function subscribeClientGuideContext(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

async function retrieve(city: string, query: string, signal: AbortSignal) {
  const url = `${apiBase}/api/guides?${new URLSearchParams({ city: city.trim(), q: query.trim() })}`
  const response = await fetch(url, { credentials: 'include', signal })
  if (!response.ok) { await response.body?.cancel(); throw new Error(`社区攻略加载失败（${response.status}），请稍后重试。`) }
  const parsed = contextSchema.safeParse(await response.json())
  signal.throwIfAborted()
  if (!parsed.success || parsed.data.city !== city.trim() || parsed.data.query !== query.trim() || parsed.data.candidates.some(item => item.city !== city.trim())) throw new Error('社区攻略响应与当前城市或查询不符。')
  return { ...parsed.data, query: query.trim(), status: 'ready' as const } as ClientGuideContext
}

/** Explicit async callers can await evidence before planning; cancellation is per caller. */
export function loadClientGuideContext(city: string, query: string, signal?: AbortSignal): Promise<ClientGuideContext> {
  if (signal?.aborted) return Promise.reject(signal.reason)
  const key = keyFor(city, query)
  const cached = entries.get(key)
  if (cached?.context.status === 'ready' && cached.expires > Date.now()) return Promise.resolve(cached.context)
  if (!signal && inFlight.has(key)) return inFlight.get(key)!
  const placeholder = store(key, pending(city, query))
  const deadline = AbortSignal.timeout(10_000)
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline
  const running = retrieve(city, query, combined).then(context => {
    // Do not overwrite newer understanding evidence or a newer request.
    const current = entries.get(key)?.context
    if (current === placeholder || current?.status !== 'ready') { store(key, context); notify() }
    return context
  }).catch(error => {
    if (entries.get(key)?.context === placeholder) {
      store(key, { ...placeholder, status: 'unavailable', disclaimer: signal?.aborted ? '社区攻略加载已取消。' : error instanceof Error ? error.message : '社区攻略暂不可用。' }, ERROR_RETRY_MS)
      notify()
    }
    throw error
  }).finally(() => { if (inFlight.get(key) === running) inFlight.delete(key) })
  if (!signal) inFlight.set(key, running)
  return running
}

/** Legacy synchronous readers get explicit pending/error state, never invented evidence. */
export function getLocalGuideContext(city: string, query: string): ClientGuideContext {
  const key = keyFor(city, query)
  const cached = entries.get(key)
  if (cached && cached.expires > Date.now()) return cached.context
  // Start after the current React render; subscribers are notified only on completion.
  const context = store(key, pending(city, query))
  queueMicrotask(() => { void loadClientGuideContext(city, query).catch(() => undefined) })
  return context
}
