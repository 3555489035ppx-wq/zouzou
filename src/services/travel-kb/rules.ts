import type { Cost, Unit } from './contracts'

export const RULE_VERSION = 'travel-kb-rules-1.0.0'
export type RuleResult = { rule_id: string; status: 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_APPLICABLE'; kind: 'hard' | 'soft' | 'default'; affected_items: string[]; evidence: string[]; suggested_fix: string }
export type RuleStop = {
  id: string; name: string; day: number; start: number | null; duration: number | null;
  transit: number | null; buffer?: number; area?: string; category?: string;
  opening?: { start: number; end: number; last_entry?: number } | null;
  reservation?: 'required' | 'optional' | 'unknown'; confirmed?: boolean; guaranteed?: boolean;
  locked?: boolean; completed?: boolean; cost?: Cost; coordinate_crs?: string | null;
  precise_distance?: number | null; forbidden?: boolean; accessibility?: boolean | null;
  dietary_conflict?: boolean; priority?: 'primary' | 'secondary' | 'rest'; local_food?: boolean;
}
export type RuleTrip = {
  id: string; stops: RuleStop[]; arrival?: number | null; departure?: number | null;
  return_transit?: number | null; return_buffer?: number | null; must_visit?: string[]; avoid?: string[];
  previous?: { id: string; stops: RuleStop[] }; city?: string; days?: number; party_size?: number;
  rooms?: number; nights?: number; budget_minor?: number | null; currency?: string;
  accessibility_required?: boolean; source_units?: Unit[]; invalid_claims?: string[];
  pace?: string; luggage?: boolean; late_arrival?: boolean; meal_preference?: number;
  meal_default?: number; meals_expected?: number; needs_plan_b?: boolean; plan_b_validated?: boolean;
  variant_signature?: string; compared_variant_signature?: string; duration_range?: [number, number];
  reserve_fraction?: number; spent_minor?: number;
  calculated_cost_minor?: number | null;
}
export function timeMinutes(clock: string, day = 1): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock) || !Number.isInteger(day) || day < 1) throw Error('Invalid local time/day')
  const [h, m] = clock.split(':').map(Number)
  return (day - 1) * 1440 + h * 60 + m
}
export function instantMinutes(value: string): number {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw Error('Explicit date and offset required')
  return Date.parse(value) / 60000
}
export function costTotal(cost: Cost, counts: { people: number; days: number; rooms: number; nights: number }): number | null {
  if (cost.amount_minor === null) return null
  if (Object.values(counts).some(n => !Number.isInteger(n) || n < 0)) throw Error('Invalid counts')
  if (cost.period === 'per_room_night') return cost.amount_minor * counts.rooms * counts.nights
  return cost.amount_minor * (cost.basis === 'per_person' ? counts.people : 1) * (cost.period === 'per_day' ? counts.days : 1)
}
export function validateItinerary(t: RuleTrip, version = RULE_VERSION): { rule_version: string; results: RuleResult[]; hard_failures: RuleResult[]; warnings: RuleResult[]; repair_hints: string[] } {
  if (version !== RULE_VERSION) throw Error('Unsupported rule version')
  const results: RuleResult[] = []
  const add = (n: number, failures: RuleStop[], unknown: boolean, fix: string, applies = true, evidence: string[] = []) => {
    results.push({ rule_id: `R-${String(n).padStart(2, '0')}`, kind: n <= 12 ? 'hard' : n <= 20 ? 'soft' : 'default',
      status: !applies ? 'NOT_APPLICABLE' : failures.length ? 'FAIL' : unknown ? 'UNKNOWN' : 'PASS',
      affected_items: failures.map(s => s.id), evidence, suggested_fix: fix })
  }
  const all = t.stops
  const badSequence = all.filter((s, i) => {
    const p = all[i - 1]
    return p && p.day === s.day && s.start !== null && p.start !== null && p.duration !== null && s.transit !== null && s.start < p.start + p.duration + s.transit + (s.buffer ?? 0)
  })
  add(1, badSequence, all.some((s, i) => s.start === null || s.duration === null || (i > 0 && all[i - 1].day === s.day && s.transit === null)), '按停留、有效转场和必要缓冲推迟后续站；未知转场待核验')
  add(2, all.filter(s => s.start !== null && ((t.arrival != null && s.start < t.arrival) || (t.departure != null && s.duration !== null && s.start + s.duration > t.departure))), t.arrival == null || t.departure == null, '活动须落在实际到达与离开之间')
  add(3, all.filter(s => s.opening && s.start !== null && s.duration !== null && (s.start < s.opening.start || s.start + s.duration > s.opening.end || s.start > (s.opening.last_entry ?? s.opening.end))), all.some(s => s.opening == null || s.start === null || s.duration === null), '按出行日营业及最后入场窗口调整；没有营业证据则待确认')
  add(4, all.filter(s => s.reservation === 'required' && !s.confirmed && s.guaranteed), all.some(s => s.reservation === 'unknown' || (s.reservation === 'required' && !s.confirmed)), '预约必需但未确认时取消可保证入场标记')
  const missingMust = (t.must_visit ?? []).filter(name => !all.some(s => s.name === name))
  add(5, [...all.filter(s => (t.avoid ?? []).includes(s.name) || s.forbidden), ...missingMust.map(name => ({ id: name } as RuleStop))], false, '满足必去、不去与锁定约束；不可行时明确取舍')
  const costs = all.flatMap(s => s.cost ? [s.cost] : [])
  const counts = { people: t.party_size ?? 1, days: t.days ?? 1, rooms: t.rooms ?? 1, nights: t.nights ?? 0 }
  const knownTotal = costs.reduce((sum, c) => sum + (costTotal(c, counts) ?? 0), 0)
  const costFailures = all.filter(s => s.cost && ((s.cost.status === 'unknown' && s.cost.amount_minor !== null) || (s.cost.status !== 'unknown' && s.cost.amount_minor === null) || s.cost.currency !== (t.currency ?? 'CNY')))
  if (t.budget_minor != null && knownTotal > t.budget_minor) costFailures.push({ id: 'budget' } as RuleStop)
  add(6, costFailures, all.some(s => !s.cost || s.cost.amount_minor === null) || ((t.nights ?? 0) > 0 && t.rooms == null), '统一币种、人数和房晚；已知费用超支需取舍，未覆盖费用不能当免费', true, costs.map(c => `${c.currency}:${c.basis}:${c.period}`))
  add(7, all.filter(s => s.dietary_conflict || (t.accessibility_required && s.accessibility === false)), Boolean(t.accessibility_required && all.some(s => s.accessibility == null)), '排除饮食冲突并核对无障碍要求')
  const last = all.at(-1)
  add(8, last && last.start !== null && last.duration !== null && t.departure != null && t.return_transit != null && t.return_buffer != null && last.start + last.duration + t.return_transit + t.return_buffer > t.departure ? [last] : [], t.return_transit == null || t.return_buffer == null, '依据真实返程站、交通与必要缓冲反推末站离开时间', t.departure != null)
  add(9, all.filter(s => s.precise_distance != null && (!s.coordinate_crs || s.coordinate_crs === 'unknown')), all.some(s => s.transit === null), '缺坐标系或道路来源时删除伪精确距离与时长')
  const invalidSources = (t.source_units ?? []).filter(u => u.revoked || !u.runtime_allowed || u.usage.runtime !== 'approved' || u.data_origin === 'synthetic_fixture')
  add(10, invalidSources.map(u => ({ id: u.unit_id } as RuleStop)), false, '移除过期、撤回和用途不符知识', Boolean(t.source_units), invalidSources.flatMap(u => u.evidence_refs.map(e => e.locator)))
  const changed = t.previous?.stops.filter(p => (p.completed || p.locked) && JSON.stringify(all.find(s => s.id === p.id)) !== JSON.stringify(p)) ?? []
  add(11, [...changed, ...(t.previous && t.id !== t.previous.id ? [{ id: t.id } as RuleStop] : [])], false, '保留原 Trip ID、已完成历史和锁定项', Boolean(t.previous))
  add(12, (t.invalid_claims ?? []).map(id => ({ id } as RuleStop)), false, '未知保留 null；推测不得提升为来源事实', Boolean(t.invalid_claims))
  add(13, all.filter((s, i) => i > 0 && all[i - 1].day === s.day && s.area && all[i - 1].area !== s.area && s.transit === null), false, '优先同片区，跨区需明确收益及可用转场时间')
  add(14, (t.late_arrival || t.luggage) && all.filter(s => s.day === 1 && s.category === 'activity').length > 3 ? all.filter(s => s.day === 1) : [], false, '较晚到达或携带行李时减少首日强度', Boolean(t.late_arrival || t.luggage))
  add(15, [], t.departure != null && (t.return_transit == null || t.return_buffer == null), '返程日前段选择时长可控的活动', t.departure != null)
  const meals = all.filter(s => s.category === 'meal')
  add(16, [], meals.length < (t.meals_expected ?? (t.days ?? 1) * 2), '逐日安排用餐、主体验和休息，费用覆盖需逐餐核对')
  add(17, [], !meals.some(s => s.local_food), '将本地饮食落实到具体餐次；先满足忌口')
  add(18, [], Boolean(t.needs_plan_b && !t.plan_b_validated), '替换后重新校验时间、预算和返程', Boolean(t.needs_plan_b))
  add(19, t.variant_signature && t.variant_signature === t.compared_variant_signature ? all.slice(0, 1) : [], false, '松弛与丰富方案应有真实删减和停留差异', Boolean(t.compared_variant_signature))
  add(20, all.filter((s, i) => i > 0 && s.name === all[i - 1].name && s.category === 'activity'), false, '删除没有目的的连续重复访问；保留有理由的再次访问')
  add(21, [], false, `餐期采用用户设置 ${t.meal_preference ?? t.meal_default ?? 720} 分钟；这是可改偏好`)
  add(22, [], !t.duration_range, '停留区间随场馆、用户、日期修正，未知不套精确时长')
  add(23, [], t.return_buffer == null, '交通缓冲须由站点要求、方式、行李和证据确定')
  add(24, [], t.budget_minor == null, `风险预留比例 ${t.reserve_fraction ?? 0.1}；不计为已支出`)
  const hard_failures = results.filter(r => r.kind === 'hard' && r.status === 'FAIL')
  const warnings = results.filter(r => r.status === 'UNKNOWN' || (r.kind !== 'hard' && r.status === 'FAIL'))
  return { rule_version: version, results, hard_failures, warnings, repair_hints: [...hard_failures, ...warnings].map(r => r.suggested_fix) }
}

export function replan(t: RuleTrip, replacement: RuleStop, resolveTransit?: (from: RuleStop, to: RuleStop) => number | null): RuleTrip {
  const old = t.stops.find(s => s.id === replacement.id)
  if (!old || old.completed || old.locked) throw Error('Cannot replace missing, completed or locked stop')
  const next: RuleTrip = { ...t, previous: { id: t.id, stops: structuredClone(t.stops) }, stops: t.stops.map(s => ({ ...(s.id === replacement.id ? replacement : s) })) }
  const replacedIndex = next.stops.findIndex(s => s.id === replacement.id)
  if (old.name !== replacement.name) {
    for (const i of [replacedIndex, replacedIndex + 1]) {
      const p = next.stops[i - 1], s = next.stops[i]
      if (p && s && p.day === s.day) {
        if (s.completed || s.locked) throw Error('Replan requires changing a protected transition')
        s.transit = resolveTransit?.(p, s) ?? null
      }
    }
  }
  for (let i = 1; i < next.stops.length; i++) {
    const p = next.stops[i - 1], s = next.stops[i]
    if (p.day !== s.day || s.locked || s.completed || p.start === null || p.duration === null || s.transit === null || s.start === null) continue
    s.start = Math.max(s.start, p.start + p.duration + s.transit + (s.buffer ?? 0))
  }
  const check = validateItinerary(next)
  if (check.hard_failures.length) throw Error(`Replan infeasible: ${check.hard_failures.map(r => r.rule_id).join(',')}`)
  next.calculated_cost_minor = next.stops.some(s => !s.cost || s.cost.amount_minor === null) ? null : next.stops.reduce((sum, s) => sum + (costTotal(s.cost!, { people: next.party_size ?? 1, days: next.days ?? 1, rooms: next.rooms ?? 1, nights: next.nights ?? 0 }) ?? 0), 0)
  next.plan_b_validated = !check.results.some(r => r.kind === 'hard' && r.status === 'UNKNOWN')
  return next
}
