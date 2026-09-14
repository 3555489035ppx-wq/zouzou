import { z } from 'zod'

export const SCHEMA_VERSION = '1.0.0'
const id = z.string().min(1).max(240)
const date = z.iso.datetime({ offset: true }).nullable()
export const usageSchema = z.object({
  read: z.enum(['approved', 'unknown', 'denied']),
  export: z.enum(['approved', 'unknown', 'denied']),
  external_model: z.enum(['approved', 'unknown', 'denied']),
  runtime: z.enum(['approved', 'unknown', 'denied']),
}).strict()
export const sourceSchema = z.object({
  source_id: id, product: id, entry: z.string(), access: z.enum(['local', 'web', 'visual']),
  scope: z.string().min(1), usage: usageSchema, revoked: z.boolean(),
  allowed_urls: z.array(z.url()), local_paths: z.array(z.string()),
  origin: z.enum(['source_extraction', 'official_verification', 'user_provided', 'synthetic_fixture']),
}).strict()
export const evidenceSchema = z.object({
  source_record_id: id, source_hash: z.string().regex(/^[0-9a-f]{64}$/), locator: id,
  kind: z.enum(['json_pointer', 'dom_fragment', 'text_span', 'image_region', 'video_timecode', 'rule_trace']),
}).strict()
export const claimSchema = z.object({
  claim_id: id, data_origin: sourceSchema.shape.origin, subject_id: id, predicate: id,
  value: z.json(), unit: z.string().nullable(),
  status: z.enum(['observed', 'verified', 'derived', 'inferred', 'unknown', 'conflicted']),
  evidence_refs: z.array(evidenceSchema), collected_at: z.iso.datetime({ offset: true }),
  published_at: date, source_updated_at: date, last_verified_at: date, valid_from: date, valid_to: date,
  derivation: z.object({ rule_id: id, input_claim_ids: z.array(id).min(1) }).strict().nullable(),
  runtime_allowed: z.boolean(),
}).strict().superRefine((c, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message })
  if (c.status === 'unknown' && c.value !== null) fail('Unknown values must be null')
  if (c.status !== 'unknown' && (c.value === null || !c.evidence_refs.length)) fail('Non-null claim requires evidence')
  if (c.status === 'verified' && !c.last_verified_at) fail('Verification date required')
  if (c.status === 'derived' && !c.derivation) fail('Derivation inputs required')
  if ((['unknown', 'inferred', 'conflicted'].includes(c.status) || c.data_origin === 'synthetic_fixture') && c.runtime_allowed) fail('Ineligible runtime claim')
  if (c.valid_from && c.valid_to && Date.parse(c.valid_from) > Date.parse(c.valid_to)) fail('Invalid validity interval')
})
export const costSchema = z.object({
  amount_minor: z.number().int().nonnegative().nullable(), currency: z.string().regex(/^[A-Z]{3}$/),
  basis: z.enum(['per_person', 'group']), period: z.enum(['per_visit', 'per_day', 'whole_trip', 'per_room_night']),
  status: z.enum(['observed', 'verified', 'derived', 'unknown']),
}).strict().refine(c => (c.status === 'unknown') === (c.amount_minor === null), 'Unknown cost is null')
export const entitySchema = z.object({
  canonical_id: id, source_ids: z.array(id), name: id, city_id: id, address: z.string().nullable(),
  category: id, aliases: z.array(id),
  coordinates: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), crs: z.enum(['wgs84', 'gcj02', 'bd09ll', 'unknown']), source: id }).strict().nullable(),
  evidence_refs: z.array(evidenceSchema),
}).strict()
export const visitSchema = z.object({
  visit_id: id, poi_ref: id, name: id, order: z.number().int().nonnegative(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  duration_minutes: z.number().nonnegative().nullable(), entry_cost: costSchema,
}).strict()
export const guideSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION), record_id: id, source_id: id, source_record_id: id,
  data_origin: sourceSchema.shape.origin, title: id, theme: z.string().nullable(),
  city: z.object({ name: id, canonical_id: id }).strict(), duration_days: z.number().int().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), timezone: id,
  days: z.array(z.object({ index: z.number().int().positive(), visits: z.array(visitSchema), gaps: z.array(z.string()) }).strict()),
  usage: usageSchema, completeness: z.enum(['partial', 'complete']), claims: z.array(claimSchema),
  dimensions: z.record(z.string().regex(/^G(0[1-9]|1[0-9]|20)$/), z.enum(['present', 'partial', 'unknown', 'not_applicable'])),
}).strict().superRefine((g, ctx) => {
  const indexes = g.days.map(d => d.index)
  if (new Set(indexes).size !== indexes.length || indexes.some(i => i > g.duration_days)) ctx.addIssue({ code: 'custom', message: 'Invalid Day grouping' })
  if (g.completeness === 'complete' && (g.days.length !== g.duration_days || g.days.some(d => !d.visits.length))) ctx.addIssue({ code: 'custom', message: 'Missing days cannot be complete' })
  try { new Intl.DateTimeFormat('en', { timeZone: g.timezone }) } catch { ctx.addIssue({ code: 'custom', message: 'Invalid IANA timezone' }) }
})
export const patternSchema = z.object({
  pattern_id: id, version: id, city_scope: z.array(id), scenario: id,
  applicable_conditions: z.array(z.string()), excluded_conditions: z.array(z.string()),
  recommended_sequence: z.array(z.array(id)), supporting_record_ids: z.array(id),
  independent_source_cluster_count: z.number().int().nonnegative(), counterexamples: z.array(id),
  evidence_refs: z.array(evidenceSchema), status: z.enum(['candidate', 'supported', 'reviewed', 'retired']),
}).strict()
export const ruleSchema = z.object({ rule_id: id, version: id, kind: z.enum(['hard', 'soft', 'default']), description: z.string(), source: z.string() }).strict()
export const unitSchema = z.object({
  unit_id: id, source_id: id, record_id: id, city: id, city_id: id,
  kind: z.enum(['fact', 'pattern', 'rule']), subject: id, predicate: id, value: z.json(), summary: z.string().max(1000),
  status: z.enum(['observed', 'verified', 'derived', 'candidate', 'reviewed']),
  data_origin: sourceSchema.shape.origin, runtime_allowed: z.boolean(), usage: usageSchema,
  evidence_refs: z.array(evidenceSchema).min(1), valid_from: date, valid_to: date, last_verified_at: date,
  revoked: z.boolean(), conditions: z.array(z.string()), excluded_conditions: z.array(z.string()),
}).strict()
export const releaseSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION), release_id: id, created_at: z.iso.datetime({ offset: true }),
  previous: id.nullable(), scope_hash: z.string().regex(/^[0-9a-f]{64}$/),
  units: z.array(unitSchema), source_ids: z.array(id), rule_version: id,
  quality: z.object({ schema: z.boolean(), evidence: z.boolean(), usage: z.boolean(), privacy: z.boolean() }).strict(),
}).strict()
export type Source = z.infer<typeof sourceSchema>
export type Claim = z.infer<typeof claimSchema>
export type Evidence = z.infer<typeof evidenceSchema>
export type Guide = z.infer<typeof guideSchema>
export type Entity = z.infer<typeof entitySchema>
export type Unit = z.infer<typeof unitSchema>
export type Release = z.infer<typeof releaseSchema>
export type Cost = z.infer<typeof costSchema>
export type KnowledgeRequest = {
  city: string; city_id?: string; query: string; date?: string | null; end_date?: string | null;
  scenario?: string; duration_days?: number; party_size?: number; budget_minor?: number | null;
  preferences?: string[]; constraints?: string[]; arrival?: unknown; departure?: unknown;
  booked?: string[]; completed?: string[]; allowed_source_ids?: string[];
}
