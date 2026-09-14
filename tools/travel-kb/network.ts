import { lookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import type { Source } from '../../src/services/travel-kb/contracts'

export class ScopeError extends Error {}
export function publicAddress(address: string): boolean {
  if (isIP(address) !== 4) return false // Conservative: IPv6 requires a separately reviewed route.
  const [a, b] = address.split('.').map(Number)
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0))
}
export function guardUrl(raw: string, source: Source, method = 'GET'): URL {
  const u = new URL(raw)
  if (source.revoked || source.usage.read !== 'approved' || method !== 'GET' || u.protocol !== 'https:' || u.username || u.password
    || (u.port && u.port !== '443') || u.hash || !source.allowed_urls.includes(u.href)
    || /(?:localhost|\.local|\.internal)$/.test(u.hostname) || (isIP(u.hostname) && !publicAddress(u.hostname))
    || [...u.searchParams.keys()].some(k => /token|secret|password|auth|session|key/i.test(k))) throw new ScopeError('URL_OR_METHOD_OUT_OF_SCOPE')
  return u
}
export function retryAfter(value: string | null, now = Date.now()): number {
  if (!value) return 60000
  if (/^\d+$/.test(value.trim())) return Number(value) * 1000
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? Math.max(1000, parsed - now) : 60000
}
export type ResponseData = { status: number; headers: Record<string, string>; body: Uint8Array }
export async function fetchPublic(raw: string, source: Source): Promise<ResponseData> {
  const url = guardUrl(raw, source)
  const addresses = await lookup(url.hostname, { all: true, family: 4 })
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new ScopeError('DNS_PRIVATE_ADDRESS')
  const address = addresses[0].address
  return new Promise((resolve, reject) => {
    // Pin the validated address to this connection; redirects are returned, never auto-followed.
    const req = httpsRequest(url, { method: 'GET', headers: { 'User-Agent': 'ZouzouTravelKnowledge/1.0', Accept: 'application/json,text/html' },
      lookup: ((_host: unknown, opts: unknown, cb: (...args: unknown[]) => void) => {
        if ((opts as { all?: boolean }).all) cb(null, [{ address, family: 4 }]); else cb(null, address, 4)
      }) as never,
    }, res => {
      const chunks: Buffer[] = []; let bytes = 0
      res.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 10485760) req.destroy(Error('TEXT_BUDGET_STOP')); else chunks.push(chunk) })
      res.on('error', reject)
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k, String(v ?? '')])), body: Buffer.concat(chunks) }))
    })
    req.setTimeout(30000, () => req.destroy(Error('TIMEOUT')))
    req.on('error', reject); req.end()
  })
}
export type NetworkState = { requests: number; failures: number; retry_at: number; stopped: string | null }
export class NetworkPolicy {
  state: NetworkState
  constructor(readonly maxRequests = 4000, state?: NetworkState) { this.state = state ?? { requests: 0, failures: 0, retry_at: 0, stopped: null } }
  async read(url: string, source: Source, fetcher = fetchPublic, now = Date.now()) {
    guardUrl(url, source)
    if (this.state.stopped) return { status: this.state.stopped, response: null }
    if (this.state.requests >= this.maxRequests) { this.state.stopped = 'BUDGET_STOP'; return { status: 'BUDGET_STOP', response: null } }
    if (now < this.state.retry_at) return { status: 'RETRY_WAIT', response: null }
    this.state.requests++; this.state.retry_at = now + 2000
    try {
      const r = await fetcher(url, source)
      if ([401, 403].includes(r.status)) this.state.stopped = 'AUTH_STOP'
      else if (r.status === 429) { this.state.retry_at = now + Math.max(2000, retryAfter(r.headers['retry-after'] ?? null, now)); return { status: 'RATE_LIMITED', response: null } }
      else if (r.status >= 500 || r.status === 0) throw Error('TRANSIENT_HTTP')
      else if (r.status >= 300 && r.status < 400) this.state.stopped = 'REDIRECT_REQUIRES_OBSERVED_SCOPE'
      else if (r.status !== 200) this.state.stopped = 'HTTP_STOP'
      if (this.state.stopped) return { status: this.state.stopped, response: null }
      this.state.failures = 0
      return { status: 'PASS', response: r }
    } catch (e) {
      if (e instanceof ScopeError) throw e
      this.state.failures++
      this.state.retry_at = now + 2000 * 2 ** this.state.failures
      // Initial attempt plus at most three retries; state persists in the caller's checkpoint.
      if (this.state.failures >= 4) this.state.stopped = 'CIRCUIT_OPEN'
      return { status: this.state.stopped ?? 'RETRY_WAIT', response: null }
    }
  }
}
export class Pagination {
  seenCursors = new Set<string>(); seenIds = new Set<string>(); total: number | null = null
  stopped: string | null = null
  page(ids: string[], next: string | null, total?: number, limit = 1000) {
    const newIds = ids.filter(id => !this.seenIds.has(id)); newIds.forEach(id => this.seenIds.add(id))
    if (Number.isInteger(total) && total! >= this.seenIds.size) this.total = total!
    if (!next) this.stopped = 'LIST_EXHAUSTED'
    else if (this.seenCursors.has(next)) this.stopped = 'REPEATED_CURSOR'
    else if (this.seenIds.size >= limit) this.stopped = 'BUDGET_STOP'
    else if (!newIds.length) this.stopped = 'NO_NEW_IDS'
    if (next) this.seenCursors.add(next)
    return { next: this.stopped ? null : next, new_ids: newIds, total_available: this.total, stop_reason: this.stopped }
  }
}
