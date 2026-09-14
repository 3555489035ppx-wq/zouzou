import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CLOUD_AI_TIMEOUT_MS, handleCloudAI, type CloudAIEnv } from './ai'
import { PlanningAIAdapter } from '../../src/services/ai'
import { understandTrip } from '../../src/services/trip/planner'

// The production-default test reloads the frontend after changing Vite env.
const frontendModulePath = '../../src/services/ai'

const version = 'test-fixture-only-not-a-release'
const env: CloudAIEnv = { KNOWLEDGE_RELEASE_APPROVED: 'true', AI_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'test-key', DEEPSEEK_MODEL: 'fixture-model' }
const intent = understandTrip({ text: '呼和浩特3天，2人预算4000元，不要太累', media: [] }).intent
const noop = () => undefined
function request(path: string, body: unknown, signal?: AbortSignal) {
  return new Request(`https://test.invalid/api/trips/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
}
function completion(output: unknown = intent, model = 'actual-model-snapshot') {
  return Response.json({ model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] })
}
beforeEach(() => {
  // No test may reach a paid endpoint even if it forgets to configure a mock.
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unmocked external request prohibited') }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('Cloud AI approval and protocol boundaries', () => {
  test.each(['understand', 'generate', 'media/analyze'])('%s refuses unapproved knowledge before any model call', async path => {
    for (const approved of [undefined, 'false', 'TRUE']) {
      const response = await handleCloudAI(request(path, {}), { ...env, KNOWLEDGE_RELEASE_APPROVED: approved }, version)
      expect(response.status).toBe(503)
      expect(await response.json()).toMatchObject({ code: 'KNOWLEDGE_NOT_APPROVED' })
    }
    expect(fetch).not.toHaveBeenCalled()
  })
  test('approved flag cannot bypass a missing knowledge version', async () => {
    const result = await handleCloudAI(request('generate', { understanding: { intent } }), env, ' ')
    expect(result.status).toBe(503)
    expect(fetch).not.toHaveBeenCalled()
  })
  test('unknown routes and methods do not call a model', async () => {
    expect((await handleCloudAI(request('other', {}), env, version)).status).toBe(404)
    const response = await handleCloudAI(new Request('https://test.invalid/api/trips/understand'), env, version)
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
    expect(fetch).not.toHaveBeenCalled()
  })
  test('invalid JSON, content type and oversize bodies return client errors', async () => {
    expect((await handleCloudAI(new Request('https://test.invalid/api/trips/understand', { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } }), env, version)).status).toBe(400)
    expect((await handleCloudAI(new Request('https://test.invalid/api/trips/understand', { method: 'POST', body: '{}' }), env, version)).status).toBe(415)
    expect((await handleCloudAI(request('understand', { text: 'x'.repeat(256_001) }), env, version)).status).toBe(413)
    expect(fetch).not.toHaveBeenCalled()
  })
  test('unconfigured provider returns an explicit error with no local fallback', async () => {
    const response = await handleCloudAI(request('understand', { text: '上海3天' }), { KNOWLEDGE_RELEASE_APPROVED: 'true' }, version)
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'AI_NOT_CONFIGURED' })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('Cloud AI actual provider provenance and failures', () => {
  test('understand uses a provider request and reports returned model and injected version', async () => {
    const mock = vi.fn(async (_url: string, _options: RequestInit) => completion())
    vi.stubGlobal('fetch', mock)
    const response = await handleCloudAI(request('understand', { text: '呼和浩特3天', media: [] }), env, version)
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result).toMatchObject({ provider: 'deepseek', model: 'actual-model-snapshot', requestedModel: 'fixture-model', knowledgeVersion: version, intent: { destination: '呼和浩特' } })
    expect(result.guideContext).toMatchObject({ city: '呼和浩特', query: '呼和浩特3天', knowledgeVersion: version })
    expect(result.guideContext.candidates.length).toBeGreaterThan(0)
    expect(mock).toHaveBeenCalledTimes(1)
    const [url, options] = mock.mock.calls[0]
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    expect(JSON.parse(String(options.body))).toMatchObject({ model: 'fixture-model', response_format: { type: 'json_object' } })
  })
  test.each([429, 401, 500])('upstream %s remains an error and does not leak provider body', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('secret test-key provider-internal-details', { status })))
    const response = await handleCloudAI(request('understand', { text: '上海3天' }), env, version)
    expect(response.status).toBe(status === 429 ? 429 : 502)
    expect(await response.text()).not.toMatch(/test-key|provider-internal-details/)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  test('invalid model shape and impossible dates are rejected', async () => {
    for (const output of [{}, { ...intent, dates: { start: '2026-02-30', end: '2026-03-02' } }]) {
      vi.stubGlobal('fetch', vi.fn(async () => completion(output)))
      const response = await handleCloudAI(request('understand', { text: '上海3天' }), env, version)
      expect(response.status).toBe(502)
      expect(await response.json()).toMatchObject({ code: 'AI_INVALID_RESPONSE' })
    }
  })
  test('truncated completion never becomes success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ model: 'fixture', choices: [{ finish_reason: 'length', message: { content: JSON.stringify(intent) } }] })))
    expect((await handleCloudAI(request('understand', { text: '上海3天' }), env, version)).status).toBe(502)
  })
  test('deadline aborts an active provider request', async () => {
    vi.useFakeTimers()
    let providerSignal: AbortSignal | undefined
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      providerSignal = options.signal ?? undefined
      providerSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })))
    const pending = handleCloudAI(request('understand', { text: '上海3天' }), env, version)
    await vi.advanceTimersByTimeAsync(CLOUD_AI_TIMEOUT_MS + 1)
    const result = await pending
    expect(result.status).toBe(504)
    expect(providerSignal?.aborted).toBe(true)
    expect(await result.json()).toMatchObject({ code: 'TIMEOUT' })
  })
  test('deadline includes a stalled response body', async () => {
    vi.useFakeTimers()
    const cancel = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ cancel }))))
    const pending = handleCloudAI(request('understand', { text: '上海3天' }), env, version)
    await vi.advanceTimersByTimeAsync(CLOUD_AI_TIMEOUT_MS + 1)
    expect((await pending).status).toBe(504)
    expect(cancel).toHaveBeenCalled()
  })
  test('pre-cancelled request does not start a provider request', async () => {
    const controller = new AbortController(); controller.abort()
    const result = await handleCloudAI(request('understand', { text: '上海3天' }, controller.signal), env, version)
    expect(result.status).toBe(499)
    expect(fetch).not.toHaveBeenCalled()
  })
  test('caller cancellation reaches the active provider request', async () => {
    const controller = new AbortController()
    let started!: () => void
    const ready = new Promise<void>(resolve => { started = resolve })
    let providerSignal: AbortSignal | null | undefined
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      providerSignal = options.signal
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      started()
    })))
    const pending = handleCloudAI(request('understand', { text: '上海3天' }, controller.signal), env, version)
    await ready
    controller.abort()
    expect((await pending).status).toBe(499)
    expect(providerSignal?.aborted).toBe(true)
  })
  test('oversize model bodies are rejected instead of buffered without limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(256_001))))
    const response = await handleCloudAI(request('understand', { text: '上海3天' }), env, version)
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ code: 'AI_INVALID_RESPONSE' })
  })
})

describe('Cloud scheduler and media', () => {
  test('guides endpoint returns complete server retrieval results without a model request', async () => {
    const response = await handleCloudAI(new Request('https://test.invalid/api/guides?city=%E4%B8%8A%E6%B5%B7&q=%E5%92%96%E5%95%A1'), env, version)
    expect(response.status).toBe(200)
    const value = await response.json()
    const { getLocalGuideContext } = await import('../../src/services/trip/localGuides')
    expect(value).toEqual({ ...getLocalGuideContext('上海', '咖啡'), query: '咖啡', knowledgeVersion: version })
    expect(value.candidates).toHaveLength(8)
    expect(fetch).not.toHaveBeenCalled()
  })
  test('guides endpoint validates city and method', async () => {
    expect((await handleCloudAI(new Request('https://test.invalid/api/guides'), env, version)).status).toBe(400)
    expect((await handleCloudAI(new Request('https://test.invalid/api/guides?city=unknown'), env, version)).status).toBe(422)
    expect((await handleCloudAI(new Request('https://test.invalid/api/guides', { method: 'POST' }), env, version)).status).toBe(405)
    expect(fetch).not.toHaveBeenCalled()
  })
  test('confirmed intent is scheduled on the backend, without claiming model generation', async () => {
    const response = await handleCloudAI(request('generate', { understanding: { intent, guideContext: { candidates: [{ title: 'UNTRUSTED_INJECTED_GUIDE' }] } } }), env, version)
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result).toMatchObject({ provider: 'deterministic', model: 'knowledge-constrained-scheduler', knowledgeVersion: version, generationMethod: 'knowledge-constrained-scheduler' })
    expect(result.plans).toHaveLength(3)
    expect(result.plans[0].days).toBeDefined()
    expect(JSON.stringify(result)).not.toContain('UNTRUSTED_INJECTED_GUIDE')
    expect(fetch).not.toHaveBeenCalled()
  })
  test('text generation actually extracts intent before scheduling', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => completion()))
    const response = await handleCloudAI(request('generate', { text: '呼和浩特3天，2人预算4000元' }), env, version)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ provider: 'deepseek', model: 'actual-model-snapshot', generationMethod: 'model-intent+knowledge-constrained-scheduler', plans: expect.any(Array) })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  test('unknown cities do not fall back to Shanghai', async () => {
    const response = await handleCloudAI(request('generate', { understanding: { intent: { ...intent, destination: '未知测试城' } } }), env, version)
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ code: 'UNSUPPORTED_DESTINATION' })
  })
  test('unsupported vision remains an error, without manufactured local facts', async () => {
    const response = await handleCloudAI(request('media/analyze', { media: [{ id: 'a', name: 'ticket', dataUrl: 'data:image/png;base64,YQ==' }] }), env, version)
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ code: 'VISION_UNSUPPORTED' })
    expect(fetch).not.toHaveBeenCalled()
  })
  test('OpenAI vision binds the result to the image and keeps human confirmation', async () => {
    const fact = { mediaId: 'a', name: 'untrusted-name', kind: 'ticket', rawText: '上海', facts: { dates: null, times: [], locations: ['上海'], arrivalLocation: null, departureLocation: null, hotel: null, placeNames: [], budget: null, notes: [] }, confidence: 1, needsConfirmation: false, warnings: [], provider: 'fake' }
    vi.stubGlobal('fetch', vi.fn(async () => completion({ items: [fact] })))
    const response = await handleCloudAI(request('media/analyze', { media: [{ id: 'a', name: 'ticket', dataUrl: 'data:image/png;base64,YQ==' }] }), { ...env, AI_PROVIDER: 'openai', OPENAI_API_KEY: 'fixture', OPENAI_MODEL: 'fixture-vision' }, version)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ provider: 'openai', model: 'actual-model-snapshot', knowledgeVersion: version, mediaFacts: [{ mediaId: 'a', name: 'ticket', needsConfirmation: true, provider: 'openai' }] })
  })
})

describe('Frontend remote adapter contract', () => {
  test('production defaults to remote and exposes the approval gate error', async () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_REMOTE_AI', '')
    vi.resetModules()
    const { PlanningAIAdapter: DefaultAdapter } = await import(frontendModulePath)
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 'KNOWLEDGE_NOT_APPROVED', message: '知识尚未批准' }, { status: 503 })))
    await expect(new DefaultAdapter().understandTrip({ text: '上海3天', media: [] }, noop)).rejects.toThrow('知识尚未批准')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  test('a legacy backend local fallback is rejected in remote mode', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ intent, evidence: [], summary: '', provider: 'local' })))
    await expect(new PlanningAIAdapter({ remoteAIEnabled: true }).understandTrip({ text: '上海3天', media: [] }, noop)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  test('remote vision errors do not continue with text-only local facts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 'VISION_UNSUPPORTED', message: '当前模型不支持识图' }, { status: 422 })))
    await expect(new PlanningAIAdapter({ remoteAIEnabled: true }).understandTrip({ text: '上海3天', media: [{ id: 'a', name: 'a', src: 'data:image/png;base64,YQ==' }] }, noop)).rejects.toThrow('当前模型不支持识图')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  test('remote understanding errors never resolve with a local result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 'KNOWLEDGE_NOT_APPROVED', message: '知识许可待确认' }, { status: 503 })))
    const stages: string[] = []
    await expect(new PlanningAIAdapter({ remoteAIEnabled: true }).understandTrip({ text: '上海3天', media: [] }, stage => stages.push(stage))).rejects.toThrow('知识许可待确认')
    expect(stages).not.toContain('success')
  })
  test('generate goes to the backend and retains cloud plan provenance', async () => {
    const cloud = await handleCloudAI(request('generate', { understanding: { intent } }), env, version)
    const payload = await cloud.json()
    const mock = vi.fn(async () => Response.json(payload))
    vi.stubGlobal('fetch', mock)
    const result = await new PlanningAIAdapter({ remoteAIEnabled: true, apiBase: 'https://test.invalid' }).generatePlans({ intent, summary: '', evidence: [] }, noop)
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ knowledgeVersion: version, provider: 'deterministic' })
    expect(mock).toHaveBeenCalledWith('https://test.invalid/api/trips/generate', expect.objectContaining({ credentials: 'include', method: 'POST' }))
  })
  test.each([['TIMEOUT', 504], ['RATE_LIMITED', 429], ['CANCELLED', 499]] as const)('generation preserves %s semantics', async (code, status) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code, message: 'fixture error' }, { status })))
    await expect(new PlanningAIAdapter({ remoteAIEnabled: true }).generatePlans({ intent, summary: '', evidence: [] }, noop)).rejects.toMatchObject({ code })
  })
  test('generation cancellation aborts fetch and never reports success', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => { options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))) })))
    const stages: string[] = []
    const pending = new PlanningAIAdapter({ remoteAIEnabled: true }).generatePlans({ intent, summary: '', evidence: [] }, stage => stages.push(stage), controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(stages).not.toContain('success')
  })
})
