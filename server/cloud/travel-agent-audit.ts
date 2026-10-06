import { validatePlan, type GeneratedPlan, type TripIntent } from '../../src/services/trip/planner'

export type MobilityPolicy = 'normal' | 'reduced' | 'no_walking' | 'day_reduced_evening_walk' | 'conflict'
export type PlanAudit = { accepted: boolean; blocking: string[]; warnings: string[] }

/**
 * Independent of the model's claims and of a plan's cached validation.passed.
 * This is a knowledge/structure check, not a real-world route certification.
 */
export function auditAgentPlan(plan: GeneratedPlan, intent: TripIntent, policy: {
  mobility: MobilityPolicy; eveningWalk: boolean
}): PlanAudit {
  const blocking: string[] = []
  const warnings: string[] = []
  const days = Object.entries(plan.days)
  if (plan.city !== intent.destination) blocking.push('目的地不一致')
  if (days.length !== intent.durationDays || days.some(([, stops]) => !stops.length)) blocking.push('天数不完整')
  if (plan.nights !== intent.nights) blocking.push('住宿晚数不一致')
  if (plan.partySize !== intent.partySize) blocking.push('出行人数不一致')
  if (JSON.stringify(plan.dates) !== JSON.stringify(intent.dates)) blocking.push('日期不一致')
  const dayNumbers = days.map(([key]) => Number(key.replace(/\D/g, '')))
  if (dayNumbers.some((day, index) => day !== index + 1)) blocking.push('每日编号不连续')
  // Re-run using current user intent so a generator cannot quietly relax it.
  const validation = validatePlan({ ...plan, intent, budgetLimit: intent.budget })
  for (const check of validation.checks) {
    if (check.passed) continue
    // A missing optional budget is not a reason to reject an otherwise useful draft.
    // Unresolved input conflicts are always blocking.
    if (check.name === '出行信息' && !intent.conflicts.length) {
      if (intent.missing.some(item => !/预算|费用|花费/.test(item)))
        warnings.push('部分出行信息尚未确认，当前仅为可编辑草案。')
    } else blocking.push(check.detail || check.name)
  }
  if (intent.conflicts.length) blocking.push(...intent.conflicts)
  const pending = intent.missing.filter(item => intent.budget !== null || !/预算|费用|花费/.test(item))
  if (pending.length) warnings.push('待确认：' + pending.join('、'))
  const stops = days.flatMap(([, day]) => day)
  if (stops.some(stop => stop.pendingVenue)) blocking.push('仍有待选地点，不能标记为完整方案')
  if (policy.mobility === 'no_walking' || policy.mobility === 'conflict') blocking.push('步行要求尚未确认')
  if (policy.mobility === 'day_reduced_evening_walk' && stops.some(stop =>
    Number(stop.time.split(':')[0]) < 18 && stop.mode === 'walk' && stop.travelFromPreviousMinutes > 15)) {
    blocking.push('白天仍有超过15分钟的步行转场，未满足当前低步行策略')
  }
  const outdoorNames = new Set(plan.knowledge.items.filter(item =>
    /滨江|江畔|河畔|海滨|江岸|海岸|滨水|户外|公园|散步/.test(
      [item.name, ...item.tags].join(' '))).map(item => item.name))
  const hasEveningOutdoor = stops.some(stop =>
    Number(stop.time.split(':')[0]) >= 18 && outdoorNames.has(stop.name) &&
    !/餐|酒店|住宿|休息/.test(stop.type))
  if (policy.eveningWalk && !hasEveningOutdoor) blocking.push('缺少有知识库依据的晚间户外散步安排')
  if (policy.mobility !== 'normal') warnings.push('低步行检查只覆盖资料中的转场时间，不能保证景区内部无需步行或具备无障碍设施。')
  if (policy.eveningWalk) warnings.push('晚间户外安排仍需核实当天风雨和开放情况。')
  return { accepted: blocking.length === 0, blocking: [...new Set(blocking)], warnings: [...new Set(warnings)] }
}
