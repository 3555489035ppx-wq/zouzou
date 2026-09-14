import { createHash } from 'node:crypto'
import { readFileSync, realpathSync, existsSync, statSync, readdirSync } from 'node:fs'
import { resolve, relative, isAbsolute, extname } from 'node:path'
import { z } from 'zod'
import { claimSchema, guideSchema, type Source, type Guide, type Claim, type Entity, type Evidence } from '../../src/services/travel-kb/contracts'

export function canonical(value: unknown): string {
  if (value === undefined) throw Error('Undefined is not a persisted value')
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
}
export const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
export const hashObject = (value: unknown) => hash(canonical(value))
export const redactText = (s: string): string => s
  .replace(/\b(?:Bearer\s+)[\w.\-]+/gi, '[REDACTED]')
  .replace(/\b(?:sk-[a-zA-Z0-9_-]{8,}|1[3-9]\d{9}|\d{17}[\dXx])\b/g, '[REDACTED]')
  .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[REDACTED]')
  .replace(/https?:\/\/[^\s<>"']+/gi, '[LINK_REMOVED]')
  .replace(/(?:订单号|身份证|手机号|token|password|secret|api[_-]?key)\s*[:：=]\s*[^\s,，;；]+/gi, '[REDACTED]')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '[SCRIPT_REMOVED]')

// Only these travel fields survive Raw minimization. Usage/provenance come from the registry, never from imported content.
const allowed = new Set(['id', 'record_id', 'version', 'title', 'city', 'city_id', 'name', 'canonical_id', 'theme', 'duration_days', 'duration', 'days', 'day', 'index', 'visits', 'places', 'poi_id', 'address', 'category', 'order', 'start_time', 'duration_minutes', 'entry_cost', 'amount_minor', 'currency', 'basis', 'period', 'status', 'date', 'timezone', 'description', 'food', 'transport', 'tips', 'published_at', 'source_updated_at', 'valid_from', 'valid_to', 'completeness', 'latitude', 'longitude', 'crs', 'parent_id'])
export function sanitize(input: unknown, depth = 0): unknown {
  if (depth > 30) throw Error('Input nesting limit exceeded')
  if (typeof input === 'string') return redactText(input).slice(0, 20000)
  if (input === null || typeof input === 'number' || typeof input === 'boolean') return input
  if (Array.isArray(input)) return input.map(v => sanitize(v, depth + 1))
  if (typeof input !== 'object') return null
  const obj = input as Record<string, unknown>
  if (obj.private === true || obj.visibility === 'private' || obj.is_private === true) throw Error('PRIVATE_OBJECT_EXCLUDED')
  return Object.fromEntries(Object.entries(obj).filter(([k]) => allowed.has(k)).map(([k, v]) => [k, sanitize(v, depth + 1)]))
}
export function within(path: string, root: string): boolean {
  const rel = relative(resolve(root), resolve(path))
  return !rel.startsWith('..') && !isAbsolute(rel)
}
export function allowedFile(path: string, source: Source): string {
  const actual = realpathSync(path)
  if (source.revoked || source.usage.read !== 'approved' || source.usage.export !== 'approved') throw Error('SCOPE_DENIED')
  if (!source.local_paths.some(p => existsSync(p) && (statSync(p).isDirectory() ? within(actual, realpathSync(p)) : actual === realpathSync(p)))) throw Error('PATH_OUT_OF_SCOPE')
  if (statSync(actual).size > 10485760) throw Error('TEXT_BUDGET_STOP')
  return actual
}
export function discoverFiles(roots: string[]) {
  const files: Array<{ path: string; bytes: number; hash: string; format: string }> = []
  const walk = (path: string, root: string) => {
    const real = realpathSync(path)
    if (!within(real, root)) return
    const s = statSync(real)
    if (s.isDirectory()) {
      for (const e of readdirSync(real, { withFileTypes: true })) if (!e.isSymbolicLink() && !['node_modules', '.git', 'private'].includes(e.name)) walk(resolve(real, e.name), root)
    } else if (/\.(jsonl?|csv|html?|md|txt|png|jpe?g|webp|har|mp4)$/i.test(real)) {
      files.push({ path: real, bytes: s.size, hash: s.size <= 10485760 ? hash(readFileSync(real)) : 'NOT_HASHED_SIZE_LIMIT', format: extname(real).slice(1) })
    }
  }
  for (const p of roots) if (existsSync(p)) walk(p, statSync(p).isDirectory() ? realpathSync(p) : resolve(realpathSync(p), '..'))
  return files
}
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted }
    else if (c === ',' && !quoted) { row.push(cell); cell = '' }
    else if (c === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (quoted) throw Error('SCHEMA_DRIFT: malformed CSV')
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row) }
  const header = rows.shift() ?? []
  if (!header.includes('id') || !header.includes('title') || !header.includes('city')) throw Error('SCHEMA_DRIFT: CSV id/title/city required')
  return rows.filter(r => r.some(Boolean)).map(r => {
    if (r.length !== header.length) throw Error('SCHEMA_DRIFT: CSV width')
    return Object.fromEntries(header.map((k, i) => [k, r[i]]))
  })
}
export type Decoded = { records: unknown[]; status: 'READY' | 'PENDING_MODEL' | 'PENDING_VISUAL'; format: string }
export function decode(bytes: Uint8Array, extension: string): Decoded {
  if (bytes.length > 10485760) throw Error('TEXT_BUDGET_STOP')
  const text = Buffer.from(bytes).toString('utf8').replace(/^\uFEFF/, '').trim()
  if (/^(\[|\{)/.test(text)) {
    let v: unknown
    try { v = JSON.parse(text) } catch {
      if (extension === '.jsonl') return { records: text.split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l)), status: 'READY', format: 'jsonl' }
      throw Error('SCHEMA_DRIFT: invalid JSON')
    }
    if (Array.isArray(v)) return { records: v, status: 'READY', format: 'json' }
    const obj = v as Record<string, unknown>
    for (const k of ['guides', 'journeys', 'entries', 'records']) if (Array.isArray(obj[k])) return { records: obj[k], status: 'READY', format: `json:${k}` }
    if ('title' in obj && 'city' in obj) return { records: [obj], status: 'READY', format: 'json:record' }
    throw Error('SCHEMA_DRIFT: no known guide structure')
  }
  if (text.startsWith('<')) {
    // A supported, explicit export island; arbitrary script and DOM content are never evaluated.
    const match = text.match(/<script\b(?=[^>]*\btype=["']application\/json["'])(?=[^>]*\bid=["']travel-kb-export["'])[^>]*>([\s\S]*?)<\/script>/i)
    if (!match) throw Error('SCHEMA_DRIFT: unsupported HTML export island')
    return { ...decode(Buffer.from(match[1]), '.json'), format: 'html:travel-kb-export' }
  }
  if (extension === '.csv') return { records: parseCsv(text), status: 'READY', format: 'csv' }
  if (['.png', '.jpg', '.jpeg', '.webp', '.mp4'].includes(extension)) return { records: [], status: 'PENDING_VISUAL', format: extension.slice(1) }
  return { records: [], status: 'PENDING_MODEL', format: 'text' }
}
const nullableText = z.string().nullable().optional()
const inputVisit = z.union([z.string(), z.object({
  name: z.string(), poi_id: nullableText, address: nullableText, category: nullableText,
  start_time: nullableText, duration_minutes: z.number().nonnegative().nullable().optional(), entry_cost: z.unknown().optional(),
}).passthrough()])
const inputSchema = z.object({
  id: z.string().optional(), record_id: z.string().optional(), title: z.string().min(1),
  city: z.union([z.string().min(1), z.object({ name: z.string(), canonical_id: z.string().optional() })]),
  city_id: z.string().optional(), theme: nullableText, duration_days: z.coerce.number().int().min(1).max(60).optional(),
  duration: z.coerce.number().int().min(1).max(60).optional(), date: nullableText, timezone: z.string().optional(),
  days: z.array(z.object({ index: z.number().optional(), day: z.number().optional(), visits: z.array(inputVisit).optional(), places: z.array(inputVisit).optional() }).passthrough()).optional(),
  completeness: z.string().optional(), published_at: nullableText, source_updated_at: nullableText,
}).passthrough()
export function normalizeRecord(raw: unknown, source: Source, collected = new Date().toISOString()): { raw: unknown; guide: Guide; entities: Entity[] } {
  const clean = sanitize(raw), input = inputSchema.parse(clean)
  const contentHash = hashObject(clean)
  const originalId = input.id ?? input.record_id ?? `content:${contentHash}`
  const recordId = `${source.source_id}:${originalId}`
  const sourceRecord = `${recordId}@${contentHash.slice(0, 16)}`
  const city = typeof input.city === 'string' ? input.city : input.city.name
  const cityId = input.city_id ?? (typeof input.city === 'object' ? input.city.canonical_id : null) ?? `${source.source_id}:city:${hash(city).slice(0, 16)}`
  const claims: Claim[] = [], entities: Entity[] = []
  const evidence = (locator: string): Evidence => ({ source_record_id: sourceRecord, source_hash: contentHash, locator, kind: 'json_pointer' })
  const claim = (predicate: string, value: unknown, locator: string, subject = recordId, unit: string | null = null) => {
    const item = claimSchema.parse({ claim_id: `${sourceRecord}:${claims.length}`, data_origin: source.origin, subject_id: subject, predicate,
      value: value ?? null, unit, status: value == null ? 'unknown' : 'observed', evidence_refs: value == null ? [] : [evidence(locator)],
      collected_at: collected, published_at: input.published_at ?? null, source_updated_at: input.source_updated_at ?? null,
      valid_from: null, valid_to: null, last_verified_at: null, derivation: null, runtime_allowed: false })
    claims.push(item)
  }
  claim('title', input.title, '/title'); claim('city', city, typeof input.city === 'string' ? '/city' : '/city/name')
  for (const field of ['theme', 'food', 'transport', 'tips'] as const) {
    const value = (clean as Record<string, unknown>)[field]
    if (Array.isArray(value)) value.forEach((item, i) => { if (typeof item === 'string') claim(field, item, `/${field}/${i}`) })
    else if (typeof value === 'string') claim(field, value, `/${field}`)
  }
  const declaredDays = input.duration_days ?? input.duration
  const duration = declaredDays ?? Math.max(1, ...(input.days ?? []).map((d, i) => d.index ?? d.day ?? i + 1))
  if (declaredDays) claim('duration_days', declaredDays, input.duration_days ? '/duration_days' : '/duration', recordId, 'days')
  const days = (input.days ?? []).map((day, di) => ({ index: day.index ?? day.day ?? di + 1,
    visits: (day.visits ?? day.places ?? []).map((v, vi) => {
      const obj = typeof v === 'string' ? { name: v } : v
      const prefix = `/days/${di}/${day.visits ? 'visits' : 'places'}/${vi}`
      const entityId = obj.poi_id ? `${source.source_id}:poi:${obj.poi_id}` : `${cityId}:poi:${hashObject({ name: obj.name, address: obj.address ?? null }).slice(0, 16)}`
      claim('name', obj.name, `${prefix}${typeof v === 'string' ? '' : '/name'}`, entityId)
      if (obj.duration_minutes != null) claim('duration_minutes', obj.duration_minutes, `${prefix}/duration_minutes`, entityId, 'minutes')
      if (obj.start_time != null) claim('start_time', obj.start_time, `${prefix}/start_time`, entityId)
      if (obj.address != null) claim('address', obj.address, `${prefix}/address`, entityId)
      const unknownCost = { amount_minor: null, currency: 'CNY', basis: 'per_person', period: 'per_visit', status: 'unknown' }
      let cost = obj.entry_cost ?? unknownCost
      // Imported verification labels are source statements, never independent verification.
      if (typeof cost === 'object' && cost && (cost as Record<string, unknown>).amount_minor !== null) cost = { ...cost, status: 'observed' }
      if (obj.entry_cost != null) claim('entry_cost', obj.entry_cost, `${prefix}/entry_cost`, entityId)
      entities.push({ canonical_id: entityId, source_ids: obj.poi_id ? [`${source.source_id}:${obj.poi_id}`] : [], name: obj.name, city_id: cityId,
        address: obj.address ?? null, category: obj.category ?? 'unknown', aliases: [], coordinates: null, evidence_refs: [evidence(`${prefix}${typeof v === 'string' ? '' : '/name'}`)] })
      return { visit_id: `${recordId}:day${di + 1}:visit${vi + 1}`, poi_ref: entityId, name: obj.name, order: vi,
        start_time: obj.start_time ?? null, duration_minutes: obj.duration_minutes ?? null, entry_cost: cost }
    }), gaps: ['营业、预约、真实转场与费用覆盖待核验'] }))
  const dimensions = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`G${String(i + 1).padStart(2, '0')}`, 'unknown']))
  dimensions.G02 = 'partial'; dimensions.G05 = days.length ? 'partial' : 'unknown'; dimensions.G06 = entities.length ? 'partial' : 'unknown'
  if (claims.some(c => c.predicate === 'transport')) dimensions.G07 = 'partial'
  if (claims.some(c => c.predicate === 'food')) dimensions.G08 = 'partial'
  if (claims.some(c => c.predicate === 'tips')) dimensions.G16 = 'partial'
  const complete = input.completeness === 'complete' && days.length === duration && days.every(d => d.visits.length)
  const guide = guideSchema.parse({ schema_version: '1.0.0', record_id: recordId, source_id: source.source_id, source_record_id: sourceRecord,
    data_origin: source.origin, title: input.title, theme: input.theme ?? null, city: { name: city, canonical_id: cityId },
    duration_days: duration, date: input.date ?? null, timezone: input.timezone ?? 'Asia/Shanghai', days,
    usage: source.usage, completeness: complete ? 'complete' : 'partial', claims, dimensions })
  return { raw: clean, guide, entities }
}
export function pointer(value: unknown, locator: string): unknown {
  if (!locator.startsWith('/')) throw Error('Unsupported locator')
  return locator.slice(1).split('/').reduce<unknown>((v, k) => v && typeof v === 'object' ? (v as Record<string, unknown>)[k.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined, value)
}
export function verifyEvidence(claim: Claim, read: (id: string) => unknown): boolean {
  if (claim.status === 'unknown') return claim.value === null
  return claim.evidence_refs.every(e => {
    const raw = read(e.source_record_id)
    if (!raw || hashObject(raw) !== e.source_hash || e.kind !== 'json_pointer') return false
    const value = pointer(raw, e.locator)
    return value !== undefined && canonical(value) === canonical(claim.value)
  })
}
export function entityMatch(a: Entity, b: Entity): 'same' | 'distinct' | 'candidate' {
  if (a.city_id !== b.city_id) return 'distinct'
  if (a.source_ids.some(id => b.source_ids.includes(id))) return 'same'
  if (a.address && b.address) return a.address === b.address && a.name === b.name ? 'same' : 'distinct'
  if (a.coordinates && b.coordinates && a.coordinates.crs !== b.coordinates.crs) return 'candidate'
  return a.name === b.name || a.name.includes(b.name) || b.name.includes(a.name) ? 'candidate' : 'distinct'
}
export function routeSignature(g: Guide) {
  return hashObject({ city: g.city.canonical_id, theme: g.theme, date: g.date, duration: g.duration_days,
    days: g.days.map(d => ({ index: d.index, visits: d.visits.map(v => ({ poi: v.poi_ref, time: v.start_time, duration: v.duration_minutes })) })) })
}
export function conflicts(claims: Claim[]): Claim[][] {
  const grouped = new Map<string, Claim[]>()
  for (const c of claims.filter(c => c.status !== 'unknown')) {
    const key = `${c.subject_id}:${c.predicate}:${c.unit}`
    grouped.set(key, [...(grouped.get(key) ?? []), c])
  }
  return [...grouped.values()].filter(items => items.some((a, i) => items.slice(i + 1).some(b =>
    canonical(a.value) !== canonical(b.value)
    && (!a.valid_to || !b.valid_from || Date.parse(a.valid_to) >= Date.parse(b.valid_from))
    && (!b.valid_to || !a.valid_from || Date.parse(b.valid_to) >= Date.parse(a.valid_from)))))
}
export function modelBatches(records: Array<{ id: string; text: string }>, context = 16000, reserve = 0.3) {
  const budget = Math.floor(context * (1 - reserve)); if (budget < 64) throw Error('Invalid token budget')
  const batches: Array<Array<{ id: string; chunk: number; text: string; estimated_tokens: number }>> = []; let batch: typeof batches[number] = [], used = 0
  for (const r of records) {
    // UTF-8 byte count is deliberately conservative; this is an estimate, not billed model tokens.
    const chars = Array.from(r.text); let chunk = '', tokens = 0, index = 0
    const flush = () => { if (!chunk) return; if (used + tokens > budget) { batches.push(batch); batch = []; used = 0 } batch.push({ id: r.id, chunk: index++, text: chunk, estimated_tokens: tokens }); used += tokens; chunk = ''; tokens = 0 }
    for (const c of chars) { const n = Buffer.byteLength(c); if (tokens + n > budget) flush(); chunk += c; tokens += n }
    flush()
  }
  if (batch.length) batches.push(batch)
  return batches
}
