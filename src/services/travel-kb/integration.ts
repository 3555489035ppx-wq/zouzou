import bundledRelease from '../../../data/travel-kb-release.json'
import type { GeneratedPlan, TripIntent } from '../trip/planner'
import { parseRelease, retrieveKnowledge, type KnowledgeBundle } from './retrieval'
import { timeMinutes, validateItinerary, type RuleTrip, type RuleStop } from './rules'
import type { Release } from './contracts'

export type KnowledgeOptions = { enabled?: boolean; release?: Release | null; now?: Date }
export type KnowledgeTrace = { bundle: KnowledgeBundle; validation: ReturnType<typeof validateItinerary> }
export function planningKnowledge(intent: TripIntent, options?: KnowledgeOptions): KnowledgeBundle | null {
  const enabled = options?.enabled ?? (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_TRAVEL_KB === '1'
  if (!enabled) return null
  try {
    const release = options && 'release' in options ? options.release ?? null : bundledRelease ? parseRelease(bundledRelease) : null
    return retrieveKnowledge({ city: intent.destination, query: [intent.destination, ...intent.preferences, ...intent.mustVisit].join(' '),
      date: intent.dates?.start, end_date: intent.dates?.end, duration_days: intent.durationDays, party_size: intent.partySize,
      budget_minor: intent.budget === null ? null : Math.round(intent.budget * 100), preferences: intent.preferences,
      constraints: intent.constraints, arrival: { location: intent.arrivalLocation, time: intent.arrivalTime },
      departure: { location: intent.departureLocation, time: intent.departureTime }, booked: intent.hotel ? [intent.hotel] : [] }, release, options?.now)
  } catch {
    return { release: null, status: 'unavailable', units: [], gaps: ['知识版本无法读取，已保留原生成链路'], provenance: [] }
  }
}
export function ruleTrip(plan: GeneratedPlan): RuleTrip {
  const stops: RuleStop[] = Object.entries(plan.days).flatMap(([day, list], di) => list.map(s => {
    const dayIndex = Number(day.match(/\d+/)?.[0] ?? di + 1)
    return { id: s.id, name: s.name, day: dayIndex, start: timeMinutes(s.time, dayIndex), duration: s.durationMinutes,
      // Existing planning estimates are not promoted to verified road transit evidence.
      transit: null, area: s.zone, category: /餐|美食|小吃/.test(s.type) ? 'meal' : /住宿|到达|返程/.test(s.type) ? 'anchor' : 'activity',
      opening: s.factState === 'verified' && s.opening ? { start: timeMinutes(s.opening.from, dayIndex), end: timeMinutes(s.opening.to, dayIndex) } : null,
      reservation: 'unknown' as const, locked: s.fixed ?? false,
      completed: plan.execution?.some(e => e.stopId === s.id && e.action === 'completed') ?? false,
      cost: { amount_minor: null, currency: 'CNY', basis: 'per_person' as const, period: 'per_visit' as const, status: 'unknown' as const },
      coordinate_crs: null }
  }))
  return { id: plan.tripId ?? plan.optionId ?? plan.id, stops, city: plan.city, days: plan.intent.durationDays,
    arrival: plan.intent.arrivalTime ? timeMinutes(plan.intent.arrivalTime) : null,
    departure: plan.intent.departureTime ? timeMinutes(plan.intent.departureTime, plan.intent.durationDays) : null,
    return_transit: null, return_buffer: null, must_visit: plan.intent.mustVisit, avoid: plan.intent.unavailablePlaces,
    party_size: plan.partySize, rooms: plan.intent.roomCount, nights: plan.nights, budget_minor: plan.budgetLimit == null ? null : Math.round(plan.budgetLimit * 100),
    pace: plan.intent.pace, source_units: plan.knowledgeTrace?.bundle.units, invalid_claims: [] }
}
export function attachKnowledge(plan: GeneratedPlan, bundle: KnowledgeBundle | null): GeneratedPlan {
  if (!bundle) return plan
  const validation = validateItinerary({ ...ruleTrip(plan), source_units: bundle.units })
  return { ...plan, knowledgeTrace: { bundle, validation }, evidence: [...plan.evidence,
    ...bundle.units.map(u => `规划依据 ${u.subject}：${u.summary}`), ...bundle.gaps],
    validation: { ...plan.validation, passed: plan.validation.passed && validation.hard_failures.length === 0,
      issues: [...new Set([...plan.validation.issues, ...validation.hard_failures.map(r => r.suggested_fix), ...bundle.gaps])] } }
}
export function refreshKnowledgeValidation(plan: GeneratedPlan, previous?: GeneratedPlan): GeneratedPlan {
  if (!plan.knowledgeTrace) return plan
  const trip = ruleTrip(plan)
  const validation = validateItinerary({ ...trip, ...(previous ? { previous: { id: ruleTrip(previous).id, stops: ruleTrip(previous).stops } } : {}) })
  return { ...plan, knowledgeTrace: { ...plan.knowledgeTrace, validation },
    validation: { ...plan.validation, passed: plan.validation.passed && validation.hard_failures.length === 0,
      issues: [...new Set([...plan.validation.issues, ...validation.hard_failures.map(r => r.suggested_fix)])] } }
}
