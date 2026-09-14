import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type * as Client from './clientGuides'

let client: typeof Client
const context = (city = '上海', query = '咖啡') => ({ city, query, candidates: [], matchedTerms: ['咖啡'], generatedAt: '2026-09-14', disclaimer: '真实检索无匹配结果', knowledgeVersion: 'test-v1' })
beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unmocked requests prohibited') }))
  client = await import('./clientGuides')
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

test('cold synchronous reads expose loading and deduplicate the deferred city query', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(context())))
  const first = client.getLocalGuideContext('上海', '咖啡')
  expect(first).toMatchObject({ status: 'loading', candidates: [], generatedAt: '' })
  expect(first.disclaimer).toContain('尚未加载')
  expect(client.getLocalGuideContext('上海', '咖啡')).toBe(first)
  const listener = vi.fn()
  const unsubscribe = client.subscribeClientGuideContext(listener)
  await client.loadClientGuideContext('上海', '咖啡')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(client.getLocalGuideContext('上海', '咖啡')).toMatchObject({ status: 'ready', knowledgeVersion: 'test-v1', candidates: [] })
  expect(listener).toHaveBeenCalledTimes(1)
  unsubscribe()
})

test('server understanding context primes exactly its city and query', () => {
  client.primeClientGuideContext(context())
  expect(client.getLocalGuideContext('上海', '咖啡')).toMatchObject({ status: 'ready', knowledgeVersion: 'test-v1' })
  expect(fetch).not.toHaveBeenCalled()
})

test('queries with different dietary preferences cannot reuse each others evidence', async () => {
  client.primeClientGuideContext(context())
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(context('上海', '清真'))))
  await client.loadClientGuideContext('上海', '清真')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(client.getLocalGuideContext('上海', '清真').query).toBe('清真')
  expect(client.getLocalGuideContext('上海', '咖啡').query).toBe('咖啡')
})

test('failed lookup becomes unavailable, not a successful empty context or request loop', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
  await expect(client.loadClientGuideContext('上海', '咖啡')).rejects.toThrow('503')
  expect(client.getLocalGuideContext('上海', '咖啡')).toMatchObject({ status: 'unavailable', candidates: [] })
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('mismatched city or query responses are rejected', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(context('北京'))))
  await expect(client.loadClientGuideContext('上海', '咖啡')).rejects.toThrow('不符')
  expect(client.getLocalGuideContext('上海', '咖啡').status).toBe('unavailable')
})

test('newly primed understanding is not overwritten by an older pending lookup', async () => {
  let finish!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
  const pending = client.loadClientGuideContext('上海', '咖啡')
  client.primeClientGuideContext({ ...context(), knowledgeVersion: 'test-v2' })
  finish(Response.json(context()))
  await pending
  expect(client.getLocalGuideContext('上海', '咖啡').knowledgeVersion).toBe('test-v2')
})

test('caller cancellation aborts only that fetch', async () => {
  const controller = new AbortController()
  vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))))
  const pending = client.loadClientGuideContext('上海', '咖啡', controller.signal)
  controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  expect(client.getLocalGuideContext('上海', '咖啡').status).toBe('unavailable')
})

test('cancelling a separate caller cannot discard a successful shared lookup', async () => {
  let finish!: (response: Response) => void
  const controller = new AbortController()
  vi.stubGlobal('fetch', vi.fn()
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
    .mockImplementationOnce((_url, options: RequestInit) => new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))))
  const shared = client.loadClientGuideContext('上海', '咖啡')
  const cancelled = client.loadClientGuideContext('上海', '咖啡', controller.signal)
  controller.abort()
  await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
  finish(Response.json(context()))
  await shared
  expect(client.getLocalGuideContext('上海', '咖啡').status).toBe('ready')
})
