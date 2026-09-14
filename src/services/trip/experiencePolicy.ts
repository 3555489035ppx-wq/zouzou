import policy from '../../../data/travel-experience-policy.json'
import reviewedExperiences from '../../../data/travel-experience-reviewed.json'
import type { TripIntent } from './planner'

export type ExperienceVariant = 'match' | 'easy' | 'rich'
export function experienceRouteStart(route: {timePeriod?: readonly string[]; category?: string}) {
  const periods=route.timePeriod??[]
  if(periods.includes('早上'))return '07:30'
  if(periods.includes('上午'))return '09:30'
  if(periods.includes('中午'))return '11:30'
  if(periods.includes('下午'))return '15:30'
  if(periods.some(period=>/晚上|夜间/.test(period)))return '18:00'
  return route.category==='聚餐'?'11:30':'09:30'
}
export type ExperienceSource = {
  platform: 'bilibili' | 'xiaohongshu' | 'douyin'
  author: string
  independentAuthorId?: string
  url: string
  readLevel: 'search-metadata' | 'note-text' | 'video-description' | 'video-subtitle'
  supports: boolean
  conflicts?: boolean
}

/** Agreement is claim-specific; merely mentioning the same place is not support. */
export function experienceConsensus(sources: ExperienceSource[]) {
  const seen = new Set<string>()
  const independent = sources.filter(source => {
    const author = (source.independentAuthorId || source.author).trim().toLowerCase()
    const key = author.replace(/[\s·_\-]/g, '')
    if (!key || seen.has(key) || !source.supports || source.readLevel === 'search-metadata') return false
    seen.add(key)
    return true
  })
  const counts = new Map<string, number>()
  independent.forEach(source => counts.set(source.platform, (counts.get(source.platform) ?? 0) + 1))
  const conflict = sources.some(source => source.conflicts)
  const balanced = independent.length > 0 && [...counts.values()].every(n => n / independent.length <= policy.consensus.maxPlatformShare)
  const level = conflict ? 'candidate' : counts.size === 3 && balanced && [...counts.values()].every(n => n >= policy.consensus.minimumHighConfidenceAuthorsPerPlatform)
    ? 'high_confidence_experience_pattern' : counts.size >= 2 && balanced ? 'supported_pattern' : 'candidate'
  return { level, independentAuthors: independent.length, platforms: [...counts.keys()], balanced, conflict }
}

export function experiencePace(intent: Pick<TripIntent, 'pace' | 'lowMobility'> & {preferences?: string[]}, variant: ExperienceVariant) {
  const family = intent.preferences?.some(term => ['亲子','父母'].includes(term))
  const selected = intent.lowMobility || family || intent.pace === 'relaxed' || variant === 'easy' ? policy.pace.easy : policy.pace[variant]
  return { ...selected, core: variant === 'easy' && (intent.pace === 'relaxed' || family || intent.lowMobility) ? 1 : selected.core, light: intent.lowMobility ? 0 : selected.light }
}

export function dayExperiencePattern(intent: Pick<TripIntent, 'durationDays' | 'availableMinutes'>, index: number) {
  if (intent.availableMinutes && intent.availableMinutes <= 360) return policy.dayPatterns.half_day
  if (intent.durationDays === 1) return policy.dayPatterns.one_day
  if (index === 0) return policy.dayPatterns.arrival
  if (index === intent.durationDays - 1) return policy.dayPatterns.departure
  return policy.dayPatterns.core
}

export function experienceCoreLimit(intent: TripIntent, variant: ExperienceVariant, dayIndex: number) {
  const pace = experiencePace(intent, variant)
  // Full-length arrival/departure days may hold two cores, but late arrival is a light day.
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
  const pattern = dayExperiencePattern(intent, dayIndex)
  if (pattern === policy.dayPatterns.arrival && intent.arrivalTime && toMinutes(intent.arrivalTime) >= 15 * 60) return 1
  if (pattern === policy.dayPatterns.departure && intent.departureTime && toMinutes(intent.departureTime) <= 13 * 60) return 1
  const boundaryCap = pattern === policy.dayPatterns.arrival || pattern === policy.dayPatterns.departure ? 2 : pattern.maxCore
  return Math.min(pace.core, boundaryCap)
}

export function experienceAdvice(intent: TripIntent, variant: ExperienceVariant = 'match') {
  const query = [...intent.preferences, ...intent.constraints, ...intent.mustVisit].join(' ')
  const scenario = policy.scenarios.filter(item => item.terms.some(term => query.toLowerCase().includes(term.toLowerCase())))
  const structure = intent.durationDays === 1 ? policy.dayPatterns.one_day : intent.durationDays === 2 ? policy.dayPatterns.weekend
    : intent.durationDays === 3 ? policy.dayPatterns.classic_three : policy.dayPatterns.deep_four_five
  const pace = experiencePace(intent, variant)
  return {
    strategy: `${intent.destination}按“${intent.durationDays > 5 ? '抵达适应—分片区深入体验—轻松返程' : structure.sequence.join('—')}”组织。${pace.summary}`,
    scenario: scenario.slice(0, 3).map(item => item.advice),
    days: Array.from({length: intent.durationDays}, (_, index) => `第${index + 1}天 · ${dayExperiencePattern(intent, index).label}`),
    meal: intent.dietary?.avoidSpicy
      ? '优先清淡正餐和可单独调味的小吃；辣油、蘸水与底料另放，不能只靠“微辣”满足不吃辣。'
      : '正餐轮换地方菜与小吃组合，夜宵少量补充；避免午餐火锅、晚餐火锅、宵夜再吃串串。',
    planB: policy.planB.map(item => `${item.trigger}：${item.action}`),
    notice: policy.dynamic.notice,
  }
}

export function extractExperiencePreferences(text: string) {
  return policy.scenarios.flatMap(item => item.terms.some(term => {
    const index = text.toLowerCase().indexOf(term.toLowerCase())
    return index >= 0 && !/(?:不|不要|不想|不喜欢|不考虑).{0,3}$/.test(text.slice(Math.max(0,index-7),index))
  }) ? [item.terms[0]] : [])
}

export function experienceStartTime(intent: TripIntent) {
  return intent.preferences.includes('晚起') ? '10:30' : intent.preferences.includes('早起') ? '08:30' : '09:30'
}

export function reviewedExperienceAdvice(city: string, names: string[], excluded: string[] = []) {
  return reviewedExperiences.patterns.filter(pattern => pattern.city === city
    && pattern.names.every(name => names.some(actual => actual.includes(name)))
    && !pattern.names.some(name => excluded.some(value => value.includes(name)))
    && experienceConsensus(pattern.sources as ExperienceSource[]).level !== 'candidate')
    .map(pattern => ({id:pattern.id,summary:pattern.summary,sources:pattern.sources.map(source=>source.url)}))
}
