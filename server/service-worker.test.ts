import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'

it('serves cached offline HTML as a fresh non-redirect response for navigation', async () => {
  const listeners = new Map<string, (event: any) => void>()
  const cached = new Response('<h1>暂时没有网络</h1>', { headers: { 'Content-Type': 'text/html' } })
  // Cloudflare Pages redirects /offline.html to /offline before cache.add resolves.
  Object.defineProperty(cached, 'redirected', { value: true })
  const self = { location: { origin: 'https://release.example' }, addEventListener: (name: string, callback: (event: any) => void) => listeners.set(name, callback) }
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self, URL, Response, caches: { match: async () => cached }, fetch: async () => { throw new TypeError('Network offline') },
  })
  let pending!: Promise<Response>
  listeners.get('fetch')!({ request: { url: 'https://release.example/share/test', method: 'GET', mode: 'navigate' }, respondWith: (value: Promise<Response>) => { pending = value } })
  const response = await pending
  expect(response.redirected).toBe(false)
  expect(response.headers.get('Content-Type')).toBe('text/html')
  expect(await response.text()).toContain('暂时没有网络')
})
