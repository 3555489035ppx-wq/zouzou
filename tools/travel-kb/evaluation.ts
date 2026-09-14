import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { generatePlans, understandTrip, type TripIntent, type GeneratedPlan } from '../../src/services/trip/planner'
import { emptyDietaryProfile } from '../../src/services/trip/dietary'
import { atomicJson, type KnowledgeStore } from './store'
import { workspace, root } from './cli'
import { validateItinerary, timeMinutes, type RuleTrip } from '../../src/services/travel-kb/rules'

type Scenario = { id: string; input: string; expected: string; data_origin: string }
function intentFor(s: Scenario): TripIntent {
  const n = Number(s.id.slice(3))
  const cities = ['成都', '上海', '南京', '北京', '广州', '杭州', '苏州', '西安', '重庆']
  const city = cities.find(c => s.input.includes(c)) ?? (n <= 5 ? '成都' : '上海')
  const understanding = understandTrip({ text: `2026年9月18日去${city}3天2晚，两人预算4000元。${s.input}`, media: [] })
  const days = /一日|全天|全天|半日|夜间|周末/.test(s.input) ? 1 : /两天|两日|两人/.test(s.input) ? 2 : 3
  let intent: TripIntent = { ...understanding.intent, destination: city, durationDays: days, nights: days - 1,
    dates: { start: '2026-09-18', end: `2026-09-${17 + days}` }, arrivalTime: '09:00', departureTime: '19:00',
    arrivalLocation: `${city}到达站（测试条件）`, departureLocation: `${city}返程站（测试条件）`, budget: 4000, roomCount: 1 }
  if (n === 2) intent.arrivalTime = '17:30'
  if (n === 3) intent.arrivalTime = '01:00'
  if (n === 4) intent.dietary = { ...emptyDietaryProfile(), avoidSpicy: true }
  if (n === 5) { intent.mustVisit = ['人民公园']; intent.unavailablePlaces = ['宽窄巷子'] }
  if (n === 6) { intent.partySize = 1; intent.pace = 'relaxed' }
  if (n === 7) intent.pace = 'full'
  if (n === 8) intent.hotel = '已订酒店（测试约束）'
  if (n === 16 || n === 28) intent.lowMobility = true
  if (n === 20) intent.indoorOnly = true
  if (n === 22) { intent.partySize = 4; intent.nights = 0; intent.dietary = { ...emptyDietaryProfile(), avoidSeafood: true, avoidSpicy: true } }
  if (n === 25) intent.arrivalTime = '19:00'
  if (n === 26) intent.nights = 0
  if (n === 27) { intent.arrivalTime = '14:00'; intent.departureTime = '12:00' }
  if (n === 29) { intent.roomCount = 2; intent.nights = 2; intent.partySize = 4 }
  if (n === 33) { intent.mustVisit = ['南京博物院']; intent.unavailablePlaces = ['南京博物院'] }
  if (n === 37) intent.dates = { start: '2027-09-18', end: '2027-09-20' }
  return intent
}
function stats(plans: GeneratedPlan[]) {
  return { plans: plans.length, old_validator_failures: plans.reduce((n, p) => n + p.validation.issues.length, 0),
    new_hard_failures: plans.reduce((n, p) => n + (p.knowledgeTrace?.validation.hard_failures.length ?? 0), 0),
    unknown_rule_inputs: plans.reduce((n, p) => n + (p.knowledgeTrace?.validation.results.filter(r => r.status === 'UNKNOWN').length ?? 0), 0),
    referenced_units: [...new Set(plans.flatMap(p => p.knowledgeTrace?.bundle.units.map(u => u.unit_id) ?? []))],
    stops: plans.map(p => Object.values(p.days).flat().map(s => ({ name: s.name, time: s.time, duration_minutes: s.durationMinutes, day: s.date ?? null }))) }
}
export async function evaluate(store: KnowledgeStore) {
  const scenarios: Scenario[] = JSON.parse(readFileSync(join(root, 'tests/evaluation/scenarios.json'), 'utf8').replace(/^\uFEFF/, ''))
  const release = store.currentRelease()
  const rows = scenarios.map(s => {
    const intent = intentFor(s), started = performance.now()
    try {
      const a = generatePlans(structuredClone(intent), undefined, { enabled: false })
      const b = generatePlans(structuredClone(intent), undefined, { enabled: true, release: ['EV-39', 'EV-40'].includes(s.id) ? null : release })
      return { ...s, structured_input: intent, model: 'existing-local-deterministic-planner; no API calls', randomization: 'UUID differs; deterministic scheduling inputs held constant',
        fixed_test_date: '2026-09-18 (synthetic, not current venue verification)', elapsed_ms: performance.now() - started,
        a: stats(a), b: stats(b), release: release?.release_id ?? null,
        scorecard: { constraints: null, time: null, facts: null, completeness: null, personalization: null, plan_b: null, expression: null, total: null },
        result: 'INSUFFICIENT_EVIDENCE', reason: 'No Gooh samples, no independent gold ratings, no verified current venue facts; deterministic regression only' }
    } catch (e) {
      return { ...s, structured_input: intent, elapsed_ms: performance.now() - started, result: 'FAIL', error: e instanceof Error ? e.message : 'GENERATION_FAILED' }
    }
  })
  // Independently calculable EV-12 is evaluated against an explicit numerical oracle.
  const arithmetic: RuleTrip = { id: 'fixture:EV-12', stops: [
    { id: 'a', name: '示例展馆', day: 1, start: timeMinutes('11:20'), duration: 180, transit: 0 },
    { id: 'b', name: '下一站', day: 1, start: timeMinutes('13:45'), duration: 60, transit: 25 },
  ] }
  const result = { scenarios: rows.length, generated_pairs: rows.filter(r => 'a' in r).length, generation_failures: rows.filter(r => r.result === 'FAIL').length,
    median_gain: null, non_inferior_fraction: null, blind_review_status: 'BLOCKED', quality_gate: 'INSUFFICIENT_EVIDENCE',
    ev12: { expected_earliest: '14:45', rejected_13_45: validateItinerary(arithmetic).hard_failures.some(r => r.rule_id === 'R-01') },
    default_enabled: false, evaluation_kind: 'synthetic paired regression, not Gooh quality evaluation' }
  mkdirSync(join(root, 'runs/latest'), { recursive: true })
  writeFileSync(join(root, 'runs/latest/evaluation.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n')
  atomicJson(join(root, 'runs/latest/evaluation-summary.json'), result)
  return result
}
