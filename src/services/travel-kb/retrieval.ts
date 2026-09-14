import { releaseSchema, type KnowledgeRequest, type Release, type Unit } from './contracts'
import { isRuntimeCityAllowed } from '../trip/runtimeKnowledgePolicy'

export function tokenize(text: string): string[] {
  const parts = text.toLowerCase().match(/[\p{Script=Han}]+|[a-z0-9]+/gu) ?? []
  return [...new Set(parts.flatMap(p => /\p{Script=Han}/u.test(p)
    ? [p, ...Array.from({ length: Math.max(0, p.length - 1) }, (_, i) => p.slice(i, i + 2))] : [p]))]
}

export const freshnessDays: Record<string, number> = {
  name: 365, address: 180, opening: 30, ticket: 7, inventory: 0, hotel_price: 1, weather: 1,
}
export function eligibleUnit(unit: Unit, request: KnowledgeRequest, now = new Date()): boolean {
  if (!isRuntimeCityAllowed(request.city) || (unit.city !== '*' && !isRuntimeCityAllowed(unit.city))) return false
  if (unit.revoked || !unit.runtime_allowed || unit.usage.runtime !== 'approved' || unit.usage.export !== 'approved'
    || unit.usage.read !== 'approved' || unit.data_origin === 'synthetic_fixture') return false
  if (!unit.evidence_refs.length || !['verified', 'derived', 'reviewed'].includes(unit.status)) return false
  if (unit.city !== '*' && unit.city !== request.city) return false
  if (request.city_id && unit.city_id !== '*' && unit.city_id !== request.city_id) return false
  if (request.allowed_source_ids && !request.allowed_source_ids.includes(unit.source_id)) return false
  const conditions = [request.scenario, ...(request.preferences ?? []), ...(request.constraints ?? [])].filter(Boolean)
  if (!unit.conditions.every(c => conditions.includes(c)) || unit.excluded_conditions.some(c => conditions.includes(c))) return false
  // A dated fact cannot be selected for an undated trip. The complete trip range must fit.
  if ((unit.valid_from || unit.valid_to) && !request.date) return false
  const start = request.date ? Date.parse(request.date.length === 10 ? `${request.date}T00:00:00+08:00` : request.date) : now.getTime()
  const endDate = request.end_date ?? request.date
  const end = endDate ? Date.parse(endDate.length === 10 ? `${endDate}T23:59:59+08:00` : endDate) : start
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false
  if (unit.valid_from && start < Date.parse(unit.valid_from)) return false
  if (unit.valid_to && end > Date.parse(unit.valid_to)) return false
  const ttl = freshnessDays[unit.predicate]
  if (unit.kind === 'fact' && ttl !== undefined) {
    if (!unit.last_verified_at || now.getTime() - Date.parse(unit.last_verified_at) > ttl * 86400000) return false
    if (['inventory', 'hotel_price', 'weather'].includes(unit.predicate) && !unit.valid_to) return false
  }
  return true
}

export type KnowledgeBundle = {
  release: string | null; status: 'ready' | 'partial' | 'disabled' | 'unavailable';
  units: Unit[]; gaps: string[]; provenance: Array<{ unit_id: string; source_id: string; evidence: Unit['evidence_refs'] }>;
}
export function retrieveKnowledge(request: KnowledgeRequest, release: Release | null, now = new Date()): KnowledgeBundle {
  if (!release) return { release: null, status: 'unavailable', units: [], gaps: ['没有可用知识版本'], provenance: [] }
  if (!isRuntimeCityAllowed(request.city)) {
    return { release: release.release_id, status: 'disabled', units: [], gaps: [`${request.city.trim()}知识暂未发布到走走本地浏览`], provenance: [] }
  }
  const tokens = tokenize(request.query)
  const allowed = release.units.filter(unit => eligibleUnit(unit, request, now))
  const score = (u: Unit) => tokenize(`${u.city} ${u.subject} ${u.summary}`).filter(t => tokens.includes(t)).length
  const rules = allowed.filter(u => u.kind === 'rule')
  const ranked = allowed.filter(u => u.kind !== 'rule' && score(u) > 0).sort((a, b) => score(b) - score(a)).slice(0, 20).slice(0, 10)
  const units = [...rules, ...ranked]
  const gaps = ranked.length ? [] : [`${request.city}暂无满足日期、用途与证据要求的城市事实`]
  return { release: release.release_id, status: gaps.length ? 'partial' : 'ready', units, gaps,
    provenance: units.map(u => ({ unit_id: u.unit_id, source_id: u.source_id, evidence: u.evidence_refs })) }
}
export function explainRecommendation(unit: Unit) {
  return { why: unit.summary, evidence: unit.evidence_refs, uncertainty: unit.status === 'verified' ? '仅在证据适用范围内核验' : '规划规则或建议，不是实时事实' }
}
export function getKnowledgeVersion(release: Release | null) {
  return { release: release?.release_id ?? null, freshness: release?.created_at ?? null, source_scope: release?.source_ids ?? [] }
}
export function parseRelease(value: unknown) { return releaseSchema.parse(value) }
