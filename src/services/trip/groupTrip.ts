import type { GroupPlan } from '../groupPlans'
import { emptyDietaryProfile, extractDietaryProfile } from './dietary'
import { getCityKnowledge } from './cityKnowledge'
import { understandTrip, validatePlan, readSavedPlans, writeSavedPlan, type GeneratedPlan, type PlannedStop } from './planner'

export function groupDietary(plan: GroupPlan) {
  const texts = [plan.avoidTags.map(term => `忌口：${term}`).join('，'), ...plan.participants.filter(member => member.inviteStatus === 'accepted').map(member => [...(member.foodPreferences ?? []), member.note ?? ''].join('，'))]
  return texts.map(extractDietaryProfile).reduce((all, profile) => ({
    avoidSpicy: all.avoidSpicy || profile.avoidSpicy, avoidSeafood: all.avoidSeafood || profile.avoidSeafood,
    vegetarian: all.vegetarian || profile.vegetarian, halal: all.halal || profile.halal,
    allergies: [...new Set([...all.allergies, ...profile.allergies])], dislikes: [...new Set([...all.dislikes, ...profile.dislikes])],
  }), plan.baseDietary ?? (plan.type==='travel'?plan.tripOptions?.[0]?.intent.dietary:undefined) ?? emptyDietaryProfile())
}

export function groupTrip(plan: GroupPlan): GeneratedPlan | undefined {
  if (plan.type === 'travel' && plan.trip) {
    const trip = { ...plan.trip, sceneType:'travel' as const, intent:{...plan.trip.intent,dietary:groupDietary(plan)}, sourceGroup:{planId:plan.id,revision:plan.revision??1,tripRevision:plan.trip.revision??1,selectedOptionId:plan.selectedOptionId} }
    trip.validation=validatePlan(trip)
    return trip
  }
  if (!plan.journey || !plan.selectedOptionId) return undefined
  const chosen = (plan.candidates ?? plan.polls.flatMap(poll => poll.options)).find(option => option.id === plan.selectedOptionId)
  if (!chosen || chosen.metadata.blockedReason) return undefined
  const knowledge = getCityKnowledge(plan.city), item = knowledge.items.find(item => item.name === chosen.title)
  const preferences = [...new Set([...plan.interests, ...plan.participants.filter(member => member.inviteStatus === 'accepted').flatMap(member => member.activityPreferences ?? [])])]
  const intent = { ...understandTrip({ text: `${plan.date}去${plan.city}1天，${plan.partySize}人，总预算${plan.type === 'dining' ? plan.budget * plan.partySize : plan.budget}元。`, media: [] }).intent,
    nights: 0, arrivalTime: plan.startTime, departureTime: plan.endTime, arrivalLocation: null, departureLocation: null, hotel: null,
    preferences, mustVisit: [chosen.title], dietary: groupDietary(plan), missing: [], conflicts: [],
    constraints: plan.avoidTags, indoorOnly: plan.indoorOutdoor === '只在室内',
  }
  const source = plan.journey.stops[0]
  const durationMinutes = chosen.metadata.durationMinutes ?? 90
  const stop: PlannedStop = { ...source, id: chosen.id, name: chosen.title, date: plan.date,
    type: plan.type === 'dining' ? (Number(plan.startTime.slice(0, 2)) < 16 ? '午餐' : '晚餐') : '活动',
    durationMinutes, travelFromPreviousMinutes: 0, zone: item?.area ?? plan.city, mode: 'metro',
    x: 0, z: 0, address: item?.address, searchKeyword: chosen.title, opening: item?.opening, dietaryTags: item?.dietaryTags,
    factState: 'estimated', factSource: item?.source.url ?? '成员提交的候选，地点资料待确认',
    note: `${plan.candidates ? '攻略推荐' : '投票确定'}：${chosen.title}。${item?.summary ?? '具体地址和营业待确认。'}${intent.dietary.allergies.length ? '请向餐厅核对过敏原与交叉接触，未确认前不可视为安全。' : ''}`,
  }
  const total = source.budget * plan.partySize
  const trip: GeneratedPlan = { tripId: plan.id, revision: plan.revision ?? 1, id: 'group', label: plan.title,
    sourceGroup: { planId: plan.id, revision: plan.revision ?? 1, selectedOptionId: chosen.id },
    budget: total, places: 1, walking: '集合交通由地图核对', pace: plan.candidates ? '轻松安排' : '共同决定', difference: plan.candidates ? '根据本次偏好直接生成' : '已应用成员真实投票结果',
    city: plan.city, dates: { start: plan.date, end: plan.date }, nights: 0, partySize: plan.partySize,
    budgetLimit: intent.budget, status: 'planned', days: { 'Day 1': [stop] }, intent, knowledge,
    budgetBreakdown: { lodging: 0, meals: plan.type === 'dining' ? total : 0, transport: 0, tickets: plan.type === 'dining' ? 0 : total, coffee: 0, buffer: 0, total },
    evidence: [`共同计划 ${plan.id} / 版本 ${plan.revision ?? 1}`, `实际加入成员：${plan.participants.filter(member => member.inviteStatus === 'accepted').length}；偏好：${preferences.join('、')}`],
    validation: { passed: false, score: 0, checks: [], issues: [] },
  }
  trip.validation = validatePlan(trip)
  const end = Number(plan.startTime.slice(0, 2)) * 60 + Number(plan.startTime.slice(3)) + durationMinutes
  if (end > Number(plan.endTime.slice(0, 2)) * 60 + Number(plan.endTime.slice(3))) {
    trip.validation.passed = false; trip.validation.issues.push('所选活动超出共同可用时段，请重新决定时间。')
    trip.validation.checks.push({ name: '共同可用时间', passed: false, detail: '所选活动超出结束时间。' })
  }
  return trip
}

export function saveGroupTrip(plan: GroupPlan, explicit = false) {
  const previous = readSavedPlans()?.find(trip => trip.tripId === plan.id)
  if (!previous && !explicit) return undefined
  if (previous && previous.sourceGroup?.revision === plan.revision) return previous
  let trip = plan.trip ?? groupTrip(plan)
  if (trip && plan.type!=='travel' && previous?.sourceGroup && previous.sourceGroup.selectedOptionId === plan.selectedOptionId && !previous.sourceGroup.needsDecision) {
    trip = { ...trip, days: previous.days, budget: previous.budget, budgetBreakdown: previous.budgetBreakdown, places: previous.places, status: previous.status }
    trip.validation = validatePlan(trip)
    if (!trip.validation.passed && trip.status === 'active') trip.status = 'paused'
  }
  if (!trip) {
    if (!previous) throw new Error('尚未确定共同结果，请先完成投票。')
    trip = { ...previous, intent: { ...previous.intent, dietary: groupDietary(plan) }, status: 'paused', sourceGroup: { planId: plan.id, revision: plan.revision ?? 1, needsDecision: true } }
    trip.validation = validatePlan(trip)
    trip.validation.passed = false
    trip.validation.issues.push('共同决定已失效或重新投票，请返回共同计划确认新结果。')
  }
  if(plan.type==='travel'&&previous)trip={...trip,days:Object.fromEntries(Object.entries(trip.days).map(([day,stops])=>[day,stops.map(stop=>({...stop,note:Object.values(previous.days).flat().find(item=>item.id===stop.id)?.note??stop.note}))]))}
  const saved = writeSavedPlan({ ...trip, savedAt: previous?.savedAt, revision: plan.type==='travel' ? trip.revision??1 : Math.max(trip.revision ?? 1, (previous?.revision ?? 0) + 1), execution: plan.type==='travel'?trip.execution:previous?.execution })
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('zouzou-saved-trips-updated'))
  return saved
}
