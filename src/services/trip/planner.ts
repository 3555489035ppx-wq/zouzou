import { cityNames, getCityProfile } from '../../demo-data/cities'
import type { Place, Plan } from '../../demo-data/trips'
import { dietarySummary, emptyDietaryProfile, extractDietaryProfile, foodCompatibilityIssues, inferFoodTags } from './dietary'
import { guidePlatformsLabel, type GuideCandidate, type GuideContext } from './guides'
import { getCityKnowledge, knowledgeMatches, selectHotelOption, type CityKnowledge, type CityKnowledgeItem, type KnowledgeSource } from './cityKnowledge'
import { readVersioned, writeVersioned } from '../storage'

export const DEFAULT_SHANGHAI_PROMPT = '我和朋友计划 2026年9月18日到9月20日去上海 3天2晚。9月18日10:30到虹桥火车站，住静安寺附近酒店，9月20日18:30从虹桥返程。两个人，本地总预算4000元（含住宿和市内交通，不含往返车票）。想去武康路、安福路、看展和外滩，不想太赶，喜欢咖啡，最好每天留一段缓冲。'

export const TRIP_INPUT_STORAGE = 'zouzou-trip-input'
export const TRIP_MEDIA_STORAGE = 'zouzou-trip-media'
export const TRIP_UNDERSTANDING_STORAGE = 'zouzou-trip-understanding'
export const TRIP_PLANS_STORAGE = 'zouzou-generated-plans-v1'

export type TripMedia = {
  id: string
  src: string
  name: string
  category?: string
}

export type MediaFactKind = 'ticket' | 'hotel' | 'reservation' | 'chat' | 'map' | 'other'

export type MediaFact = {
  mediaId: string
  name: string
  kind: MediaFactKind
  rawText: string
  facts: {
    dates: { start: string; end: string } | null
    times: string[]
    locations: string[]
    arrivalLocation: string | null
    departureLocation: string | null
    hotel: string | null
    placeNames: string[]
    budget: number | null
    notes: string[]
  }
  confidence: number
  needsConfirmation: boolean
  warnings: string[]
  provider: string
}

export type TripRequest = {
  text: string
  media: TripMedia[]
  mediaFacts?: MediaFact[]
}

export type Pace = 'relaxed' | 'balanced' | 'full'

export type TripIntent = {
  destination: string
  dates: { start: string; end: string } | null
  durationDays: number
  nights: number
  partySize: number
  budget: number | null
  budgetScope: string
  pace: Pace
  mustVisit: string[]
  preferences: string[]
  constraints: string[]
  dietary: import('./dietary').DietaryProfile
  conflicts: string[]
  arrivalTime: string | null
  arrivalLocation: string | null
  departureTime: string | null
  departureLocation: string | null
  hotel: string | null
  missing: string[]
}

export type TripUnderstanding = {
  intent: TripIntent
  evidence: string[]
  summary: string
  mediaFacts?: MediaFact[]
  guideContext?: GuideContext
  knowledge?: CityKnowledge
}

export type TravelMode = 'walk' | 'metro' | 'taxi' | 'train'

export type OpeningWindow = {
  from: string
  to: string
  label: string
  closedWeekdays?: number[]
}

export type PlannedStop = Place & {
  durationMinutes: number
  travelFromPreviousMinutes: number
  zone: string
  mode: TravelMode
  opening?: OpeningWindow
  fixed?: boolean
  dietaryTags?: string[]
  factState: 'verified' | 'estimated'
  factSource: string
}

export type BudgetBreakdown = {
  lodging: number
  meals: number
  transport: number
  tickets: number
  coffee: number
  buffer: number
  total: number
}

export type ValidationCheck = {
  name: string
  passed: boolean
  detail: string
}

export type ValidationReport = {
  passed: boolean
  score: number
  checks: ValidationCheck[]
  issues: string[]
}

export type GeneratedPlan = Plan & {
  city: string
  dates: { start: string; end: string } | null
  nights: number
  partySize: number
  budgetLimit: number | null
  days: Record<string, PlannedStop[]>
  budgetBreakdown: BudgetBreakdown
  validation: ValidationReport
  intent: TripIntent
  evidence: string[]
  guideContext?: GuideContext
  knowledge: CityKnowledge
}

export type ReplacementCandidate = {
  name: string
  meta: string
  reason: string
}

type StopInput = Omit<PlannedStop, 'x' | 'z'>

const makeStop = (input: StopInput): PlannedStop => ({
  ...input,
  x: Math.round((input.lng - 121.47) * 100),
  z: Math.round((31.23 - input.lat) * 100),
})

const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

const unique = (items: string[]) => [...new Set(items)]

const cloneDays = (days: Record<string, PlannedStop[]>): Record<string, PlannedStop[]> => Object.fromEntries(
  Object.entries(days).map(([day, stops]) => [day, stops.map((stop) => ({
    ...stop,
    opening: stop.opening ? { ...stop.opening, closedWeekdays: stop.opening.closedWeekdays ? [...stop.opening.closedWeekdays] : undefined } : undefined,
  }))]),
)

function parseDateRange(text: string): { start: string; end: string } | null {
  const startMatch = text.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/)
  if (!startMatch || startMatch.index === undefined) return null

  const [, startYear, startMonth, startDay] = startMatch
  const rest = text.slice(startMatch.index + startMatch[0].length)
  const endMatch = rest.match(/(?:到|至|—|-)\s*(?:(20\d{2})年\s*)?(?:(\d{1,2})月\s*)?(\d{1,2})日/)
  if (!endMatch) return null

  const endYear = endMatch[1] ?? startYear
  const endMonth = endMatch[2] ?? startMonth
  const endDay = endMatch[3]
  return {
    start: `${startYear}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`,
    end: `${endYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`,
  }
}

function inclusiveDays(dates: { start: string; end: string } | null) {
  if (!dates) return null
  const start = Date.parse(`${dates.start}T00:00:00Z`)
  const end = Date.parse(`${dates.end}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return Math.floor((end - start) / 86_400_000) + 1
}

function parseBudget(text: string) {
  const match = text.match(/(?:总预算|预算)(?:[^\d]{0,12})([\d,，]+)/)
  if (!match) return null
  const amount = Number(match[1].replaceAll(',', '').replaceAll('，', ''))
  return Number.isFinite(amount) ? amount : null
}

function parsePartySize(text: string) {
  const numeric = text.match(/(\d+)\s*(?:个)?人/)
  if (numeric) return Number(numeric[1])
  if (/两个人|两位|我和朋友/.test(text)) return 2
  return 1
}

function parseTimes(text: string) {
  return [...text.matchAll(/(\d{1,2})[:：](\d{2})/g)].map((match) => `${match[1].padStart(2, '0')}:${match[2]}`)
}

function parseAnchorLocation(text: string, direction: 'arrival' | 'departure') {
  const pattern = direction === 'arrival'
    ? /(?:到达|抵达|落地|到站|到)\s*([^，。；,;\s]{2,24}(?:机场|火车站|高铁站|站|码头|港|客运站))/
    : /(?:从|由|离开|返程(?:从)?|返回)\s*([^，。；,;\s]{2,24}(?:机场|火车站|高铁站|站|码头|港|客运站))/
  return text.match(pattern)?.[1] ?? null
}

export function paceLabel(pace: Pace) {
  return pace === 'relaxed' ? '松弛' : pace === 'full' ? '充实' : '平衡'
}

export function buildUnderstandingSummary(intent: TripIntent) {
  const conflicts = intent.conflicts ?? []
  const dateText = intent.dates ? `${intent.dates.start} 到 ${intent.dates.end}` : `${intent.durationDays} 天（日期待确认）`
  const budgetText = intent.budget === null ? '预算待确认' : `预算约 ¥${intent.budget}`
  const parts = [`我理解你要去${intent.destination}，计划在 ${dateText} 出行，${intent.partySize} 人同行，${budgetText}，整体节奏偏${paceLabel(intent.pace)}`]
  if (intent.arrivalTime || intent.arrivalLocation) parts.push(`已记录到达锚点：${intent.arrivalTime ?? '时间待确认'} · ${intent.arrivalLocation ?? '地点待确认'}`)
  if (intent.departureTime || intent.departureLocation) parts.push(`已记录返程锚点：${intent.departureTime ?? '时间待确认'} · ${intent.departureLocation ?? '地点待确认'}`)
  if (intent.mustVisit.length > 0) parts.push(`重点是${intent.mustVisit.join('、')}`)
  if (intent.preferences.length > 0) parts.push(`同时照顾${intent.preferences.join('、')}偏好`)
  const diet = dietarySummary(intent.dietary ?? emptyDietaryProfile())
  if (diet.length > 0) parts.push(`饮食上${diet.join('、')}`)
  if (intent.constraints.length > 0) parts.push(`并且${intent.constraints.join('、')}`)
  if (conflicts.length > 0) parts.push(`发现需要先核对的冲突：${conflicts.join('；')}`)
  if (intent.missing.length > 0) parts.push(`目前还缺${intent.missing.join('、')}`)
  return `${parts.join('。')}。`
}

export function understandTrip(request: TripRequest): TripUnderstanding {
  const text = request.text.trim()
  const mediaFacts = request.mediaFacts ?? []
  const confirmedMediaFacts = mediaFacts.filter((fact) => fact.confidence >= 0.85 && !fact.needsConfirmation)
  const confirmedFactText = confirmedMediaFacts.map((fact) => [
    fact.rawText,
    fact.facts.locations.join(' '),
    fact.facts.arrivalLocation ?? '',
    fact.facts.departureLocation ?? '',
    fact.facts.hotel ?? '',
    fact.facts.placeNames.join(' '),
    fact.facts.notes.join(' '),
  ].join(' ')).join(' ')
  const combined = `${text} ${confirmedFactText}`
  const textDates = parseDateRange(text)
  const durationMatch = text.match(/(\d+)\s*(?:天|日)/)
  const mediaDateRanges = mediaFacts.map((fact) => fact.facts.dates).filter((value): value is { start: string; end: string } => Boolean(value))
  const confirmedMediaDateRanges = confirmedMediaFacts.map((fact) => fact.facts.dates).filter((value): value is { start: string; end: string } => Boolean(value))
  const uniqueMediaDates = unique(mediaDateRanges.map((value) => `${value.start}~${value.end}`))
  const uniqueConfirmedMediaDates = unique(confirmedMediaDateRanges.map((value) => `${value.start}~${value.end}`))
  const textDurationDays = durationMatch ? Number(durationMatch[1]) : null
  const confirmedMediaDurationDays = uniqueConfirmedMediaDates.length === 1 ? inclusiveDays(confirmedMediaDateRanges[0] ?? null) : null
  const mediaDateMatchesTextDuration = textDurationDays === null || confirmedMediaDurationDays === textDurationDays
  const dates = textDates ?? (uniqueConfirmedMediaDates.length === 1 && mediaDateMatchesTextDuration ? confirmedMediaDateRanges[0] : null)
  const durationDays = inclusiveDays(textDates) ?? textDurationDays ?? inclusiveDays(dates) ?? 3
  const textTimes = parseTimes(text)
  const confirmedMediaTimes = unique(confirmedMediaFacts.flatMap((fact) => fact.facts.times))
  const times = unique([...textTimes, ...confirmedMediaTimes])
  const destination = cityNames.find((city) => combined.includes(city)) ?? '上海'
  const cityProfile = getCityProfile(destination)
  const knowledge = getCityKnowledge(destination)
  const normalizeAnchorLocation = (value: string) => {
    if (/浦东机场/.test(value)) return '浦东机场'
    if (/虹桥机场/.test(value)) return '虹桥机场'
    if (/虹桥火车站|虹桥站|虹桥/.test(value)) return '虹桥火车站'
    if (/机场/.test(value)) return '机场'
    return value || null
  }
  const knownAnchor = (direction: 'arrival' | 'departure') => {
    const prefix = direction === 'arrival' ? '(?:到达|抵达|落地|到站|到)' : '(?:从|由|离开|返程(?:从)?|返回)'
    return text.match(new RegExp(`${prefix}\\s*(浦东机场|虹桥机场|虹桥火车站|虹桥站|虹桥|机场)`))?.[1] ?? null
  }
  const textArrivalLocation = normalizeAnchorLocation(parseAnchorLocation(text, 'arrival') ?? knownAnchor('arrival') ?? '')
  const textDepartureLocation = normalizeAnchorLocation(parseAnchorLocation(text, 'departure') ?? knownAnchor('departure') ?? '')
  const mediaArrivalLocation = confirmedMediaFacts.map((fact) => fact.facts.arrivalLocation).find((value): value is string => Boolean(value))
  const mediaDepartureLocation = confirmedMediaFacts.map((fact) => fact.facts.departureLocation).find((value): value is string => Boolean(value))
  const arrivalLocation = textArrivalLocation ?? mediaArrivalLocation ?? null
  const departureLocation = textDepartureLocation ?? mediaDepartureLocation ?? null
  const mustVisit: string[] = []
  const preferences: string[] = []
  const constraints: string[] = []
  const conflicts: string[] = []
  const dietary = extractDietaryProfile(combined)

  const mediaArrivalLocations = mediaFacts.map((fact) => fact.facts.arrivalLocation).filter((value): value is string => Boolean(value))
  const mediaDepartureLocations = mediaFacts.map((fact) => fact.facts.departureLocation).filter((value): value is string => Boolean(value))
  if (uniqueMediaDates.length > 1) conflicts.push(`截图日期存在冲突：${uniqueMediaDates.join(' 与 ')}`)
  if (textDates && uniqueMediaDates.some((value) => value !== `${textDates.start}~${textDates.end}`)) conflicts.push(`文字日期 ${textDates.start}~${textDates.end} 与截图日期 ${uniqueMediaDates.find((value) => value !== `${textDates.start}~${textDates.end}`)}`)
  if (new Set(mediaArrivalLocations).size > 1) conflicts.push(`截图到达地点存在冲突：${unique(mediaArrivalLocations).join('、')}`)
  if (new Set(mediaDepartureLocations).size > 1) conflicts.push(`截图返程地点存在冲突：${unique(mediaDepartureLocations).join('、')}`)
  if (textArrivalLocation && mediaArrivalLocations.some((value) => !value.includes(textArrivalLocation.replace('火车站', '')) && !textArrivalLocation.includes(value.replace('火车站', '')))) conflicts.push(`文字到达地点 ${textArrivalLocation} 与截图地点 ${mediaArrivalLocations[0]}`)
  if (textDepartureLocation && mediaDepartureLocations.some((value) => !value.includes(textDepartureLocation.replace('火车站', '')) && !textDepartureLocation.includes(value.replace('火车站', '')))) conflicts.push(`文字返程地点 ${textDepartureLocation} 与截图地点 ${mediaDepartureLocations[0]}`)

  if (/武康路/.test(combined)) mustVisit.push('武康路')
  if (/安福路/.test(combined)) mustVisit.push('安福路')
  if (/外滩/.test(combined)) mustVisit.push('外滩')
  if (/豫园|老城厢/.test(combined)) mustVisit.push('豫园')
  if (/看展|展览|美术馆|博物馆/.test(combined)) mustVisit.push('展览')
  const explicitCityPlaces = unique([
    ...cityProfile.demoLabels,
    ...Object.values(cityProfile.stopNames ?? {}),
  ]).filter((place) => place.length >= 2 && !/咖啡|午餐|晚餐|本地|散步|夜景|路线|酒店|城市/.test(place) && combined.includes(place))
  mustVisit.push(...explicitCityPlaces)
  knowledge.items.forEach((item) => {
    const aliases = [item.name, item.name.replace(/风景名胜区|历史文化街区|（待核验）/g, '')]
    if (aliases.some((alias) => alias.length >= 2 && combined.includes(alias))
      && !mustVisit.some((existing) => existing.includes(item.name) || item.name.includes(existing))) mustVisit.push(item.name)
  })
  if (/咖啡|coffee/.test(combined.toLowerCase())) preferences.push('咖啡')
  if (/city\s*walk|散步|慢走|街区/.test(combined.toLowerCase())) preferences.push('City Walk')
  if (/美食|小吃|餐厅|餐馆|湘菜|臭豆腐|糖油粑粑|口味虾|吃/.test(combined)) preferences.push('本地美食')
  if (/夜景|灯光|日落/.test(combined)) preferences.push('夜景')
  if (/室内|下雨|雨天/.test(combined)) preferences.push('室内备选')
  if (/不要太赶|不想太赶|不太赶|不赶|轻松|松弛|慢慢/.test(combined)) constraints.push('每天至少保留一段缓冲，不安排连续跨区移动')
  const dietaryLabels = dietarySummary(dietary)
  if (dietaryLabels.length > 0) constraints.push(`饮食限制：${dietaryLabels.join('、')}；下单前确认调味、配料和交叉接触风险`)

  const missing: string[] = []
  if (!dates) missing.push('具体出行日期')
  if (!times[0] || !arrivalLocation) missing.push('到达时间和地点')
  if (!times[1] || !departureLocation) missing.push('返程时间和地点')
  const textHotel = text.match(/(?:住在|住于|入住(?:在)?|住)\s*([^，。；,;\n]{2,32}?酒店)(?=[，。；,;\n]|$)/)?.[1]?.trim() ?? null
  if (!textHotel && !confirmedMediaFacts.some((fact) => fact.facts.hotel)) missing.push('酒店位置')

  const textBudget = parseBudget(text)
  const mediaBudget = confirmedMediaFacts.map((fact) => fact.facts.budget).find((value): value is number => value !== null)

  const intent: TripIntent = {
    destination,
    dates,
    durationDays: Math.max(1, durationDays),
    nights: Math.max(0, durationDays - 1),
    partySize: parsePartySize(combined),
    budget: textBudget ?? mediaBudget ?? null,
    budgetScope: /不含[^。！？]*车票|不含[^。！？]*机票/.test(text) ? '含住宿和市内交通，不含城际交通' : '范围待确认',
    pace: /特种兵|赶行程|充实/.test(combined) ? 'full' : /不要太赶|不想太赶|不太赶|不赶|轻松|松弛|慢慢/.test(combined) ? 'relaxed' : 'balanced',
    mustVisit: unique(mustVisit),
    preferences: unique(preferences),
    constraints: unique(constraints),
    dietary,
    conflicts: unique(conflicts),
    arrivalTime: times[0] ?? null,
    arrivalLocation,
    departureTime: times[1] ?? null,
    departureLocation,
    hotel: confirmedMediaFacts.map((fact) => fact.facts.hotel).find((value): value is string => Boolean(value))
      ?? textHotel
      ?? (/静安寺|静安/.test(text) ? '静安寺附近酒店' : null),
    missing: unique(missing),
  }

  if (intent.budget === null) intent.missing.push('总预算')

  const evidence = [
    `用户文字：${text || '未提供文字描述'}`,
    ...request.media.map((item) => `截图线索：${item.name}`),
    ...(request.mediaFacts ?? []).map((fact) => `截图识别：${fact.name} · ${fact.kind} · 置信度 ${Math.round(fact.confidence * 100)}%${fact.needsConfirmation ? ' · 需要确认' : ''}`),
    `${destination}城市知识库：${knowledge.status === 'curated' ? '官方地点事实 + 地图候选' : '候选地点占位'}；交通、价格和营业状态在生产环境需由服务端实时复核。`,
  ]

  return {
    intent,
    evidence,
    summary: buildUnderstandingSummary(intent),
    knowledge,
    ...(request.mediaFacts && request.mediaFacts.length > 0 ? { mediaFacts: request.mediaFacts } : {}),
  }
}

const realShanghaiDays = (): Record<string, PlannedStop[]> => ({
  'Day 1': [
    makeStop({ id: 'arrival-hongqiao', time: '10:30', name: '虹桥火车站', type: '到达', stay: '30min', budget: 0, transport: '前往静安寺约 35 分钟', note: '到站后先去酒店放行李，把到达作为今天的固定锚点。', lng: 121.327, lat: 31.198, durationMinutes: 30, travelFromPreviousMinutes: 0, zone: '虹桥', mode: 'train', fixed: true, factState: 'estimated', factSource: '用户计划 + 真实交通节点' }),
    makeStop({ id: 'jingan-hotel-checkin', time: '11:45', name: '静安寺附近酒店', type: '住宿', stay: '30min', budget: 490, transport: '步行 / 地铁约 20 分钟', note: '两晚住宿参考价 ¥980，按 ¥490/晚展示，实际以预订平台为准。', lng: 121.445, lat: 31.223, durationMinutes: 30, travelFromPreviousMinutes: 35, zone: '静安', mode: 'taxi', fixed: true, factState: 'estimated', factSource: '用户计划：住宿已锁定；住宿为本地参考价' }),
    makeStop({ id: 'jingan-lunch', time: '12:20', name: '静安午餐', type: '午餐', stay: '45min', budget: 80, transport: '前往武康路约 25 分钟', note: '用一顿不需要排长队的午餐开始，给下午留出弹性。', lng: 121.444, lat: 31.225, durationMinutes: 45, travelFromPreviousMinutes: 5, zone: '静安', mode: 'walk', factState: 'estimated', factSource: '本地餐饮估算' }),
    makeStop({ id: 'wukang-road', time: '13:30', name: '武康路', type: 'City Walk', stay: '1h 30min', budget: 0, transport: '步行 10 分钟', note: '保留街区漫步时间，不把整条路压成打卡点。', lng: 121.4374, lat: 31.2111, durationMinutes: 90, travelFromPreviousMinutes: 25, zone: '徐汇', mode: 'taxi', fixed: true, factState: 'estimated', factSource: '真实公共街区' }),
    makeStop({ id: 'anfu-road', time: '15:10', name: '安福路', type: '街区', stay: '1h', budget: 0, transport: '步行 10 分钟', note: '和武康路放在同一片区，减少折返。', lng: 121.4435, lat: 31.2161, durationMinutes: 60, travelFromPreviousMinutes: 10, zone: '徐汇', mode: 'walk', fixed: true, factState: 'estimated', factSource: '真实公共街区' }),
    makeStop({ id: 'wukang-cafe', time: '16:20', name: '武康路咖啡休息', type: '咖啡', stay: '1h', budget: 85, transport: '前往静安约 20 分钟', note: '把收藏的咖啡店作为缓冲，不把它当成必须打卡的硬任务。', lng: 121.4385, lat: 31.2145, durationMinutes: 60, travelFromPreviousMinutes: 10, zone: '徐汇', mode: 'walk', factState: 'estimated', factSource: '用户收藏线索 + 价格估算' }),
    makeStop({ id: 'jingan-dinner', time: '18:00', name: '静安晚餐', type: '晚餐', stay: '1h 30min', budget: 220, transport: '步行回酒店约 12 分钟', note: '晚餐后直接回酒店，第一天不安排夜间跨区。', lng: 121.448, lat: 31.229, durationMinutes: 90, travelFromPreviousMinutes: 20, zone: '静安', mode: 'taxi', factState: 'estimated', factSource: '本地餐饮估算' }),
  ],
  'Day 2': [
    makeStop({ id: 'hotel-start', time: '09:30', name: '静安寺附近酒店', type: '住宿', stay: '15min', budget: 490, transport: '前往浦东约 35 分钟', note: '第二晚住宿参考价 ¥490，实际以预订平台为准。', lng: 121.445, lat: 31.223, durationMinutes: 15, travelFromPreviousMinutes: 0, zone: '静安', mode: 'walk', fixed: true, factState: 'estimated', factSource: '用户计划：住宿已锁定；住宿为本地参考价' }),
    makeStop({ id: 'shanghai-museum-east', time: '10:25', name: '上海博物馆东馆', type: '展览', stay: '2h', budget: 60, transport: '步行 10 分钟', note: '安排在上午的室内主活动，避开午后跨区和天气波动。', lng: 121.544, lat: 31.228, durationMinutes: 120, travelFromPreviousMinutes: 35, zone: '浦东', mode: 'metro', opening: { from: '10:00', to: '18:00', label: '周二至周日 10:00–18:00', closedWeekdays: [1] }, fixed: true, factState: 'estimated', factSource: '真实博物馆；开放状态需出行前复核' }),
    makeStop({ id: 'lujiazui-lunch', time: '12:35', name: '陆家嘴午餐', type: '午餐', stay: '1h 15min', budget: 100, transport: '前往滨江约 10 分钟', note: '用餐地点靠近下一段滨江路线，不为找餐厅额外绕路。', lng: 121.507, lat: 31.239, durationMinutes: 75, travelFromPreviousMinutes: 10, zone: '陆家嘴', mode: 'walk', factState: 'estimated', factSource: '本地餐饮估算' }),
    makeStop({ id: 'pudong-riverside', time: '14:00', name: '陆家嘴滨江', type: '散步', stay: '1h 10min', budget: 0, transport: '前往外滩约 30 分钟', note: '给看展和晚餐之间留出一段无任务的江边时间。', lng: 121.518, lat: 31.240, durationMinutes: 70, travelFromPreviousMinutes: 10, zone: '浦东', mode: 'walk', factState: 'estimated', factSource: '真实公共滨水空间' }),
    makeStop({ id: 'bund', time: '16:00', name: '外滩', type: '散步', stay: '1h 30min', budget: 0, transport: '步行 5 分钟', note: '下午到傍晚连续停留，不把外滩和浦东两侧来回切换。', lng: 121.4902, lat: 31.2393, durationMinutes: 90, travelFromPreviousMinutes: 30, zone: '外滩', mode: 'taxi', fixed: true, factState: 'estimated', factSource: '真实公共滨水空间' }),
    makeStop({ id: 'bund-dinner', time: '18:10', name: '外滩晚餐', type: '晚餐', stay: '1h 30min', budget: 220, transport: '回酒店约 30 分钟', note: '晚餐后回静安，不再叠加夜景景点。', lng: 121.487, lat: 31.240, durationMinutes: 90, travelFromPreviousMinutes: 5, zone: '外滩', mode: 'walk', factState: 'estimated', factSource: '本地餐饮估算' }),
  ],
  'Day 3': [
    makeStop({ id: 'hotel-checkout', time: '09:30', name: '静安寺附近酒店', type: '退房', stay: '20min', budget: 0, transport: '前往豫园约 25 分钟', note: '退房后把行李寄存到返程前，避免拖着行李逛老城。', lng: 121.445, lat: 31.223, durationMinutes: 20, travelFromPreviousMinutes: 0, zone: '静安', mode: 'walk', fixed: true, factState: 'estimated', factSource: '用户计划：住宿已锁定' }),
    makeStop({ id: 'yuyuan', time: '10:15', name: '豫园', type: '园林', stay: '1h 30min', budget: 40, transport: '步行 10 分钟', note: '最后一天只安排一个老城主景点，给返程留出充足缓冲。', lng: 121.492, lat: 31.227, durationMinutes: 90, travelFromPreviousMinutes: 25, zone: '老城厢', mode: 'taxi', opening: { from: '08:30', to: '16:30', label: '日间开放时段，需按当日公告复核' }, fixed: true, factState: 'estimated', factSource: '真实园林；开放状态需出行前复核' }),
    makeStop({ id: 'oldtown-lunch', time: '12:00', name: '老城厢午餐', type: '午餐', stay: '1h 15min', budget: 90, transport: '前往思南约 25 分钟', note: '午餐不安排过远，避免下午为了找店折返。', lng: 121.493, lat: 31.225, durationMinutes: 75, travelFromPreviousMinutes: 10, zone: '老城厢', mode: 'walk', factState: 'estimated', factSource: '本地餐饮估算' }),
    makeStop({ id: 'sinan-bookstore', time: '13:50', name: '思南书局', type: '书店', stay: '1h 10min', budget: 0, transport: '回酒店取行李约 20 分钟', note: '安排一个安静收尾，和前两天的街区与展览形成节奏变化。', lng: 121.466, lat: 31.212, durationMinutes: 70, travelFromPreviousMinutes: 25, zone: '黄浦', mode: 'taxi', opening: { from: '10:00', to: '18:00', label: '日间开放时段，需按当日公告复核' }, factState: 'estimated', factSource: '真实书店；开放状态需出行前复核' }),
    makeStop({ id: 'hotel-luggage', time: '15:30', name: '酒店取行李', type: '取行李', stay: '20min', budget: 0, transport: '前往虹桥约 40 分钟', note: '出发前回酒店取行李，给市内交通预留缓冲。', lng: 121.445, lat: 31.223, durationMinutes: 20, travelFromPreviousMinutes: 20, zone: '静安', mode: 'taxi', fixed: true, factState: 'estimated', factSource: '用户计划：住宿已锁定' }),
    makeStop({ id: 'return-hongqiao', time: '16:30', name: '虹桥火车站', type: '返程', stay: '1h 30min', budget: 0, transport: '18:30 返程', note: '提前到站，留出安检、取票和临时改签的空间。', lng: 121.327, lat: 31.198, durationMinutes: 90, travelFromPreviousMinutes: 40, zone: '虹桥', mode: 'taxi', fixed: true, factState: 'estimated', factSource: '用户计划：18:30 返程' }),
  ],
})

const cityRouteOffsets = [
  { lng: -0.018, lat: 0.012 },
  { lng: -0.006, lat: 0.009 },
  { lng: 0.006, lat: 0.004 },
  { lng: 0.016, lat: -0.002 },
  { lng: 0.023, lat: -0.012 },
]

function cityStopName(city: string, profileLabels: string[], stop: PlannedStop, intent: TripIntent) {
  if (stop.type === '到达') return intent.arrivalLocation ?? `${city}到达点（待确认）`
  if (stop.type === '返程') return intent.departureLocation ?? `${city}返程点（待确认）`
  if (['住宿', '退房', '取行李'].includes(stop.type)) return intent.hotel ?? `${city}中心酒店（待确认）`

  const roleNames: Record<string, string | undefined> = {
    'wukang-road': profileLabels[0],
    'anfu-road': profileLabels[1],
    'wukang-cafe': profileLabels[2],
    'shanghai-museum-east': profileLabels[3],
    'lujiazui-lunch': `${city}本地午餐`,
    'pudong-riverside': `${city}滨水散步`,
    bund: profileLabels[0] ?? `${city}城市地标`,
    'bund-dinner': `${city}特色晚餐`,
    yuyuan: profileLabels[1] ?? `${city}历史街区`,
    'oldtown-lunch': `${city}本地午餐`,
    'sinan-bookstore': profileLabels[3] ?? `${city}文化空间`,
    'suzhou-creek-night': `${city}夜景`,
    'jingan-lunch': `${city}本地午餐`,
    'jingan-dinner': `${city}特色晚餐`,
  }
  return getCityProfile(city).stopNames?.[stop.id] ?? roleNames[stop.id] ?? `${city} · ${stop.type}`
}

/**
 * The first prototype has a fully specified Shanghai route. For the other
 * supported cities, preserve the time/budget skeleton while replacing
 * Shanghai-only names and coordinates with the selected city's profile. All
 * such stops stay estimated until a POI/route provider verifies them.
 */
function adaptDaysForCity(days: Record<string, PlannedStop[]>, intent: TripIntent) {
  if (intent.destination === '上海') return days
  const profile = getCityProfile(intent.destination)
  const center = profile.mapCenter
  const labels = profile.demoLabels

  return Object.fromEntries(Object.entries(days).map(([day, stops]) => {
    const dayNumber = Number(day.replace(/\D/g, '')) || 1
    return [day, stops.map((stop, index) => {
      const offset = cityRouteOffsets[(index + dayNumber) % cityRouteOffsets.length]
      const isAnchor = ['到达', '返程', '住宿', '退房', '取行李'].includes(stop.type)
      const transport = stop.type === '到达'
        ? '到达后前往住宿点，交通时间待核验'
        : stop.type === '返程'
          ? '预留返程交通缓冲，时间待核验'
          : '相邻片区移动时间待核验'
      return {
        ...stop,
        name: cityStopName(intent.destination, labels, stop, intent),
        lng: center[0] + offset.lng * profile.routeScale,
        lat: center[1] + offset.lat * profile.routeScale,
        coordinateSource: `${intent.destination}结构化候选地点；坐标待 POI 核验`,
        verified: false,
        zone: `${intent.destination}参考片区`,
        mode: isAnchor ? stop.mode : 'metro',
        transport,
        opening: undefined,
        fixed: isAnchor ? stop.fixed : undefined,
        factState: 'estimated' as const,
        factSource: `${intent.destination}结构化候选地点；路线、营业状态和价格需出行前复核`,
        note: `${stop.note} 当前为${intent.destination}的城市候选映射，需结合攻略来源和实时 POI 再确认。`,
      }
    })]
  }))
}

const midpoint = (value: { min: number; max: number }) => Math.round((value.min + value.max) / 2)

function knowledgeItemType(item: CityKnowledgeItem) {
  if (item.category === 'restaurant') return item.tags.includes('午餐') ? '午餐' : '晚餐'
  if (item.category === 'food') return item.tags.includes('咖啡') ? '咖啡' : '本地小吃'
  if (item.tags.includes('夜景')) return '夜景'
  if (item.tags.includes('城市漫步')) return 'City Walk'
  if (item.category === 'attraction') return item.tags.includes('展览') ? '展览' : '景点'
  return '体验'
}

function knowledgeItemToStop(
  item: CityKnowledgeItem,
  city: string,
  profile: ReturnType<typeof getCityProfile>,
  time: string,
  travelFromPreviousMinutes: number,
  mode: TravelMode,
): PlannedStop {
  const [fallbackLng, fallbackLat] = profile.mapCenter
  const [lng, lat] = item.coordinates[0] === 0 && item.coordinates[1] === 0
    ? [fallbackLng, fallbackLat]
    : item.coordinates
  const budget = midpoint(item.price) * (item.price.unit === 'person' || item.price.unit === 'ticket' ? 2 : 1)
  const type = knowledgeItemType(item)
  const factState = item.verified ? 'verified' : 'estimated'
  const sourceText = item.verified ? `${item.source.label}（事实层）` : `${item.source.label}（候选，需核验）`
  return makeStop({
    id: `${city}-${item.id}`,
    time,
    name: item.name,
    type,
    stay: item.durationMinutes >= 60 ? `${Math.floor(item.durationMinutes / 60)}h${item.durationMinutes % 60 ? ` ${item.durationMinutes % 60}min` : ''}` : `${item.durationMinutes}min`,
    budget,
    transport: travelFromPreviousMinutes === 0 ? '从住宿点出发' : `${mode === 'walk' ? '步行' : mode === 'metro' ? '地铁' : '打车'}约 ${travelFromPreviousMinutes} 分钟`,
    note: `${item.summary}${item.price.note ? ` ${item.price.note}。` : ''}`,
    lng,
    lat,
    coordinateSource: `${item.source.label} · ${item.source.checkedAt}`,
    verified: item.verified,
    durationMinutes: Math.min(item.durationMinutes, type === '景点' || type === '展览' ? 120 : 90),
    travelFromPreviousMinutes,
    zone: item.area,
    mode,
    opening: item.opening,
    dietaryTags: item.dietaryTags,
    factState,
    factSource: sourceText,
  })
}

function generatedAreaItem(city: string, name: string, index: number, profile: ReturnType<typeof getCityProfile>): CityKnowledgeItem {
  const [lng, lat] = profile.mapCenter
  return {
    id: `${city}-area-${index}`,
    name,
    category: 'activity',
    area: `${city}市中心`,
    tags: ['城市漫步', '自由探索'],
    summary: '把这段时间留给附近小店、街景和临时发现，不把每一分钟排满。',
    coordinates: [lng + (index - 2) * 0.006, lat + (index % 2 ? 0.004 : -0.003)],
    durationMinutes: 55,
    price: { min: 0, max: 0, unit: 'person', note: '自由探索，不设固定消费' },
    source: { label: '走走节奏设计', url: '#', kind: 'community', checkedAt: '2026-08-30' },
    verified: false,
  }
}

const COMMUNITY_CHECKED_AT = '2026-08-30'

function communitySource(candidates: GuideCandidate[], hint: string, kind: 'place' | 'food' | 'local'): KnowledgeSource {
  const candidate = candidates.find((item) => kind === 'place'
    ? item.placeHints.includes(hint)
    : kind === 'food'
      ? item.foodHints?.includes(hint)
      : item.localExperienceHints?.includes(hint))
  return {
    label: candidate ? `${guidePlatformsLabel([candidate])}社区攻略线索` : '社区攻略线索',
    url: candidate?.sourceUrl ?? '#',
    kind: 'community',
    checkedAt: COMMUNITY_CHECKED_AT,
  }
}

function guideHintItem(city: string, name: string, index: number, profile: ReturnType<typeof getCityProfile>, candidates: GuideCandidate[]): CityKnowledgeItem {
  const [lng, lat] = profile.mapCenter
  return {
    id: `${city}-guide-hint-${index}`,
    name: `${name}（社区线索）`,
    category: 'activity',
    area: `${city}候选片区`,
    tags: ['社区线索', '待核验'],
    summary: '社区内容反复提到的体验线索；门店、路线、价格和开放状态需要实时确认。',
    coordinates: [lng + (index - 1) * 0.008, lat + (index % 2 ? 0.004 : -0.004)],
    durationMinutes: 75,
    price: { min: 0, max: 60, unit: 'person', note: '社区线索估算，出行前核验' },
    source: communitySource(candidates, name, 'place'),
    verified: false,
  }
}

function guideFoodHintItem(city: string, name: string, index: number, profile: ReturnType<typeof getCityProfile>, candidates: GuideCandidate[]): CityKnowledgeItem {
  const [lng, lat] = profile.mapCenter
  const sourceLabel = guidePlatformsLabel(candidates)
  return {
    id: `${city}-guide-food-${index}`,
    name: `${name}（社区线索）`,
    category: 'food',
    area: `${city}本地生活线索`,
    tags: ['本地小吃', '社区线索', '待核验'],
    summary: `${sourceLabel}社区内容提到的${name}体验；具体门店、排队和价格需要实时确认。`,
    coordinates: [lng + (index - 1) * 0.006, lat + (index % 2 ? 0.003 : -0.003)],
    durationMinutes: 45,
    price: { min: 15, max: 80, unit: 'person', note: '社区体验估算，出行前核验' },
    dietaryTags: inferFoodTags(name),
    source: communitySource(candidates, name, 'food'),
    verified: false,
  }
}

function guideLocalExperienceHintItem(city: string, name: string, index: number, profile: ReturnType<typeof getCityProfile>, candidates: GuideCandidate[]): CityKnowledgeItem {
  const [lng, lat] = profile.mapCenter
  return {
    id: `${city}-guide-local-${index}`,
    name: `${name}（社区线索）`,
    category: 'activity',
    area: `${city}本地生活线索`,
    tags: ['本地人项目', '社区线索', '待核验'],
    summary: `社区内容提到的本地生活项目：${name}；是否适合当天、具体地点和开放状态需要实时确认。`,
    coordinates: [lng + (index - 1) * 0.007, lat + (index % 2 ? 0.004 : -0.004)],
    durationMinutes: 75,
    price: { min: 0, max: 80, unit: 'person', note: '社区体验估算，出行前核验' },
    source: communitySource(candidates, name, 'local'),
    verified: false,
  }
}

function applyLegacyGuideHints(days: Record<string, PlannedStop[]>, intent: TripIntent, guideContext: GuideContext | undefined) {
  const candidates = guideContext?.candidates ?? []
  const profile = getCityProfile(intent.destination)
  const foodHints = unique(candidates.flatMap((candidate) => candidate.foodHints ?? []))
    .filter((hint) => foodCompatibilityIssues(hint, intent.dietary ?? emptyDietaryProfile(), inferFoodTags(hint)).length === 0)
    .slice(0, 2)
  const localHints = unique(candidates.flatMap((candidate) => candidate.localExperienceHints ?? [])).slice(0, 1)
  const replaceStop = (day: string, stopId: string, item: CityKnowledgeItem) => {
    const stops = days[day]
    const current = stops?.find((stop) => stop.id === stopId)
    if (!current) return
    const replacement = knowledgeItemToStop(item, intent.destination, profile, current.time, current.travelFromPreviousMinutes, current.mode)
    days[day] = stops.map((stop) => stop.id === stopId
      ? { ...replacement, id: current.id, transport: current.transport, note: `${replacement.note} ${current.note}` }
      : stop)
  }

  foodHints.forEach((hint, index) => {
    replaceStop(index === 0 ? 'Day 1' : 'Day 3', index === 0 ? 'jingan-lunch' : 'oldtown-lunch', guideFoodHintItem(intent.destination, hint, index, profile, candidates))
  })
  localHints.forEach((hint, index) => {
    replaceStop('Day 3', 'sinan-bookstore', guideLocalExperienceHintItem(intent.destination, hint, index, profile, candidates))
  })
  return days
}

function buildCityKnowledgeItems(intent: TripIntent, knowledge: CityKnowledge, guideContext: GuideContext | undefined) {
  const profile = getCityProfile(intent.destination)
  const dietary = intent.dietary ?? emptyDietaryProfile()
  const compatibleKnowledge = knowledge.items.filter((item) => item.category !== 'food' && item.category !== 'restaurant'
    || foodCompatibilityIssues(`${item.name} ${item.summary}`, dietary, item.dietaryTags).length === 0)
  const matched = compatibleKnowledge.filter((item) => knowledgeMatches(item, [...intent.mustVisit, ...intent.preferences]))
  const guideCandidates = guideContext?.candidates ?? []
  const guideFoodHints = unique(guideCandidates.flatMap((candidate) => candidate.foodHints ?? []))
    .filter((hint) => foodCompatibilityIssues(hint, dietary, inferFoodTags(hint)).length === 0)
    .slice(0, 4)
  const guideLocalHints = unique(guideCandidates.flatMap((candidate) => candidate.localExperienceHints ?? [])).slice(0, 4)
  const guidePlaceHints = unique(guideCandidates.flatMap((candidate) => candidate.placeHints)).slice(0, 6)
  const communityItems = [
    ...guideFoodHints.map((hint, index) => guideFoodHintItem(intent.destination, hint, index, profile, guideCandidates)),
    ...guideLocalHints.map((hint, index) => guideLocalExperienceHintItem(intent.destination, hint, index, profile, guideCandidates)),
    ...guidePlaceHints.map((hint, index) => guideHintItem(intent.destination, hint, index, profile, guideCandidates)),
  ]
  const byName = new Map<string, CityKnowledgeItem>()
  const addItem = (item: CityKnowledgeItem) => {
    if (!byName.has(item.name)) byName.set(item.name, item)
  }
  if (knowledge.status === 'curated') {
    matched.forEach(addItem)
    communityItems.forEach(addItem)
    compatibleKnowledge.filter((item) => !matched.includes(item)).forEach(addItem)
  } else {
    communityItems.forEach(addItem)
    matched.forEach(addItem)
    compatibleKnowledge.filter((item) => !matched.includes(item)).forEach(addItem)
  }
  profile.demoLabels.forEach((label, index) => {
    if (knowledge.status === 'curated' && /咖啡|午餐|晚餐|本地/.test(label)) return
    if (![...byName.keys()].some((name) => name.includes(label) || label.includes(name))) addItem(generatedAreaItem(intent.destination, label, index, profile))
  })
  const items = [...byName.values()]
  let index = 0
  while (items.length < Math.max(5, intent.durationDays * 5)) {
    items.push(generatedAreaItem(intent.destination, `${intent.destination}片区自由探索 ${index + 1}`, index + 6, profile))
    index += 1
  }
  return items
}

function addMinutes(value: string, amount: number) {
  const total = timeToMinutes(value) + amount
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function buildKnowledgeDays(intent: TripIntent, knowledge: CityKnowledge, guideContext: GuideContext | undefined, density: 'easy' | 'match' | 'rich') {
  const profile = getCityProfile(intent.destination)
  const items = buildCityKnowledgeItems(intent, knowledge, guideContext)
  const dayCount = Math.max(1, intent.durationDays)
  const buckets = Array.from({ length: dayCount }, () => [] as CityKnowledgeItem[])
  items.forEach((item, index) => buckets[index % dayCount].push(item))
  const days: Record<string, PlannedStop[]> = {}

  buckets.forEach((dayItems, dayIndex) => {
    const dayNumber = dayIndex + 1
    const isFirst = dayIndex === 0
    const isLast = dayIndex === dayCount - 1
    const stops: PlannedStop[] = []
    let cursor = isFirst ? (intent.arrivalTime ?? '09:30') : '09:30'
    let previous: PlannedStop | undefined
    const addStop = (stop: PlannedStop) => {
      stops.push(stop)
      previous = stop
      cursor = addMinutes(stop.time, stop.durationMinutes)
    }

    if (isFirst) {
      const arrivalName = intent.arrivalLocation ?? `${intent.destination}到达点（待确认）`
      addStop(makeStop({
        id: `${intent.destination}-arrival`, time: intent.arrivalTime ?? '09:30', name: arrivalName, type: '到达', stay: '30min', budget: 0,
        transport: '前往住宿点，交通时间待核验', note: '把到达作为当天固定锚点；如果还未买票，请在出发前补充车站或机场。',
        lng: profile.mapCenter[0], lat: profile.mapCenter[1], durationMinutes: 30, travelFromPreviousMinutes: 0, zone: `${intent.destination}到达`, mode: 'train', fixed: true,
        factState: intent.arrivalLocation ? 'estimated' : 'estimated', factSource: intent.arrivalLocation ? '用户输入的到达锚点' : '城市中心占位锚点',
      }))
    } else {
      const hotel = selectHotelOption(knowledge, intent.budget, intent.nights)
      addStop(makeStop({
        id: `${intent.destination}-hotel-day-${dayNumber}`, time: cursor, name: hotel.name, type: '住宿', stay: '15min', budget: midpoint(hotel.nightly),
        transport: '从上一片区返回约 20 分钟', note: `${hotel.summary} ${intent.nights > 0 ? `连续 ${intent.nights} 晚参考价 ¥${midpoint(hotel.nightly) * intent.nights}。` : ''}`,
        lng: profile.mapCenter[0], lat: profile.mapCenter[1], durationMinutes: 15, travelFromPreviousMinutes: 0, zone: hotel.area, mode: 'walk', fixed: true,
        factState: hotel.verified ? 'verified' : 'estimated', factSource: `${hotel.source.label}（实时库存和价格需核验）`,
      }))
    }

    if (isFirst) {
      const hotel = selectHotelOption(knowledge, intent.budget, intent.nights)
      addStop(makeStop({
        id: `${intent.destination}-hotel-check-in`, time: addMinutes(cursor, 25), name: hotel.name, type: '住宿', stay: '30min', budget: midpoint(hotel.nightly),
        transport: '步行 / 地铁约 20 分钟', note: `${hotel.summary} ${intent.nights > 0 ? `连续 ${intent.nights} 晚参考价 ¥${midpoint(hotel.nightly) * intent.nights}，实际以预订平台为准。` : ''}`,
        lng: profile.mapCenter[0], lat: profile.mapCenter[1], durationMinutes: 30, travelFromPreviousMinutes: 25, zone: hotel.area, mode: 'metro', fixed: true,
        factState: hotel.verified ? 'verified' : 'estimated', factSource: `${hotel.source.label}（实时库存和价格需核验）`,
      }))
    }

    const itemLimit = density === 'easy' ? 4 : density === 'rich' ? 6 : 5
    const selectedItems = dayItems.slice(0, itemLimit)
    const lunches = selectedItems.filter((item) => knowledgeItemType(item) === '午餐')
    const dinners = selectedItems.filter((item) => knowledgeItemType(item) === '晚餐')
    const nightItems = selectedItems.filter((item) => knowledgeItemType(item) === '夜景')
    const otherItems = selectedItems.filter((item) => !lunches.includes(item) && !dinners.includes(item) && !nightItems.includes(item))
    ;[...lunches, ...otherItems, ...dinners, ...nightItems].forEach((item) => {
      const travel = previous && previous.zone === item.area ? 10 : previous ? 25 : 0
      const mode: TravelMode = travel <= 12 ? 'walk' : 'metro'
      let time = addMinutes(cursor, travel)
      const type = knowledgeItemType(item)
      const mealFloor = /午餐/.test(type) ? '12:00' : /晚餐/.test(type) ? (isLast && intent.departureTime ? '16:00' : '18:00') : null
      if (mealFloor && timeToMinutes(time) < timeToMinutes(mealFloor)) time = mealFloor
      if (type === '夜景' && !isLast && timeToMinutes(time) < timeToMinutes('18:00')) time = '18:00'
      if (item.opening && timeToMinutes(time) < timeToMinutes(item.opening.from)) time = item.opening.from
      const latestEnd = isLast && intent.departureTime ? timeToMinutes(intent.departureTime) - 30 : 22 * 60
      if (timeToMinutes(time) + Math.min(item.durationMinutes, type === '景点' || type === '展览' ? 120 : 90) > latestEnd) return
      const stop = knowledgeItemToStop(item, intent.destination, profile, time, travel, mode)
      addStop(stop)
    })

    if (isLast && dayCount > 1) {
      const returnTime = intent.departureTime ?? addMinutes(cursor, 30)
      const travel = previous ? 30 : 0
      const time = timeToMinutes(returnTime) >= timeToMinutes(addMinutes(cursor, travel)) ? returnTime : addMinutes(cursor, travel)
      addStop(makeStop({
        id: `${intent.destination}-return`, time, name: intent.departureLocation ?? `${intent.destination}返程点（待确认）`, type: '返程', stay: '1h', budget: 0,
        transport: intent.departureTime ? `${intent.departureTime} 出发` : '返程时间待确认', note: '提前到站，留出安检、取票和临时改签的空间。',
        lng: profile.mapCenter[0], lat: profile.mapCenter[1], durationMinutes: 60, travelFromPreviousMinutes: travel, zone: `${intent.destination}返程`, mode: 'train', fixed: true,
        factState: intent.departureLocation ? 'estimated' : 'estimated', factSource: intent.departureLocation ? '用户输入的返程锚点' : '返程占位锚点',
      }))
    }
    days[`Day ${dayNumber}`] = stops
  })
  return days
}

function knowledgeBudget(days: Record<string, PlannedStop[]>, intent: TripIntent, knowledge: CityKnowledge, density: 'easy' | 'match' | 'rich'): Omit<BudgetBreakdown, 'total'> {
  const allStops = Object.values(days).flat()
  const hotel = selectHotelOption(knowledge, intent.budget, intent.nights)
  const lodging = midpoint(hotel.nightly) * intent.nights
  const coffee = allStops.filter((stop) => stop.type.includes('咖啡')).reduce((sum, stop) => sum + stop.budget, 0)
  const meals = allStops.filter((stop) => /午餐|晚餐|小吃/.test(stop.type)).reduce((sum, stop) => sum + stop.budget, 0)
  const tickets = allStops.filter((stop) => /景点|展览|园林/.test(stop.type)).reduce((sum, stop) => sum + stop.budget, 0)
  const transport = Math.max(80, Object.keys(days).length * (density === 'rich' ? 80 : density === 'easy' ? 50 : 65))
  const buffer = density === 'rich' ? 320 : density === 'easy' ? 180 : 240
  const subtotal = lodging + meals + transport + tickets + coffee + buffer
  if (intent.budget !== null && subtotal > intent.budget) {
    const fixed = lodging + transport
    const flexible = Math.max(0, intent.budget - fixed)
    const other = meals + tickets + coffee + buffer
    if (other > flexible && other > 0) {
      const scale = flexible / other
      return {
        lodging,
        meals: Math.floor(meals * scale),
        transport,
        tickets: Math.floor(tickets * scale),
        coffee: Math.floor(coffee * scale),
        buffer: Math.max(0, Math.floor(buffer * scale)),
      }
    }
  }
  return { lodging, meals, transport, tickets, coffee, buffer }
}

const countVisiblePlaces = (days: Record<string, PlannedStop[]>) => Object.values(days).flat().filter((stop) => !['到达', '住宿', '退房', '取行李', '返程'].includes(stop.type)).length

const breakdown = (values: Omit<BudgetBreakdown, 'total'>): BudgetBreakdown => ({ ...values, total: Object.values(values).reduce((sum, value) => sum + value, 0) })

function matchesMustVisit(stop: PlannedStop, requirement: string) {
  if (requirement === '展览') return stop.type.includes('展') || /美术馆|博物馆/.test(stop.name)
  return stop.name.includes(requirement) || stop.type.includes(requirement)
}

export function validatePlan(plan: Pick<GeneratedPlan, 'days' | 'intent' | 'budget' | 'budgetLimit' | 'dates'>): ValidationReport {
  const checks: ValidationCheck[] = []
  const issues: string[] = []
  let scheduleValid = true
  let openingValid = true
  let dietaryValid = true
  const dietary = plan.intent.dietary ?? emptyDietaryProfile()

  Object.entries(plan.days).forEach(([day, stops]) => {
    const dayNumber = Number(day.replace(/\D/g, '')) || 1
    const dayDate = plan.dates ? new Date(`${plan.dates.start}T00:00:00`) : null
    if (dayDate) dayDate.setDate(dayDate.getDate() + dayNumber - 1)
    const weekday = dayDate?.getDay()

    stops.forEach((stop, index) => {
      const start = timeToMinutes(stop.time)
      const end = start + stop.durationMinutes
      const previous = stops[index - 1]
      if (previous) {
        const previousEnd = timeToMinutes(previous.time) + previous.durationMinutes + stop.travelFromPreviousMinutes
        if (start < previousEnd) {
          scheduleValid = false
          issues.push(`${day}：${previous.name} 到 ${stop.name} 的时间不够（至少还需要 ${previousEnd - start} 分钟）。`)
        }
      }
      if (stop.opening) {
        const closed = weekday !== undefined && stop.opening.closedWeekdays?.includes(weekday)
        const withinWindow = start >= timeToMinutes(stop.opening.from) && end <= timeToMinutes(stop.opening.to)
        if (closed || !withinWindow) {
          openingValid = false
          issues.push(`${day}：${stop.name} 不在营业时间内。`)
        }
      }
      if (/午餐|晚餐|本地小吃|餐馆|餐饮/.test(stop.type)) {
        const foodIssues = foodCompatibilityIssues(`${stop.name} ${stop.note}`, dietary, stop.dietaryTags)
        if (foodIssues.length > 0) {
          dietaryValid = false
          issues.push(`${day}：${stop.name} 与饮食限制冲突（${foodIssues.join('、')}）。`)
        }
      }
    })
  })

  checks.push({ name: '时间顺序', passed: scheduleValid, detail: scheduleValid ? '每段交通和停留均有足够间隔。' : '存在交通或停留时间重叠。' })
  checks.push({ name: '营业时间', passed: openingValid, detail: openingValid ? '有营业时间的地点均落在可访问窗口内。' : '至少一个地点超出营业窗口。' })
  checks.push({ name: '饮食匹配', passed: dietaryValid, detail: dietaryValid ? '行程中的餐饮节点没有命中已知忌口或过敏风险。' : '至少一个餐饮节点命中饮食限制，需要替换或人工确认。' })

  const allStops = Object.values(plan.days).flat()
  const requiredValid = plan.intent.mustVisit.every((requirement) => allStops.some((stop) => matchesMustVisit(stop, requirement)))
  if (!requiredValid) issues.push(`缺少必去地点：${plan.intent.mustVisit.filter((requirement) => !allStops.some((stop) => matchesMustVisit(stop, requirement))).join('、')}`)
  checks.push({ name: '必去覆盖', passed: requiredValid, detail: requiredValid ? '用户提出的必去地点均已安排。' : '至少一个必去地点没有被安排。' })

  const budgetValid = plan.budgetLimit === null || plan.budget <= plan.budgetLimit
  if (!budgetValid) issues.push(`预算超出上限 ¥${plan.budget - (plan.budgetLimit ?? 0)}。`)
  checks.push({ name: '预算上限', passed: budgetValid, detail: budgetValid ? `计划估算 ¥${plan.budget}，不超过 ¥${plan.budgetLimit ?? '待确认'}。` : `计划估算 ¥${plan.budget}，超过预算。` })

  const conflicts = plan.intent.conflicts ?? []
  const requiredMissing = plan.intent.missing.filter((item) => item === '总预算')
  const inputComplete = requiredMissing.length === 0 && conflicts.length === 0
  if (plan.intent.missing.length > 0) issues.push(`已生成可编辑草案，出发前确认：${plan.intent.missing.join('、')}。`)
  if (conflicts.length > 0) issues.push(`存在待核对冲突：${conflicts.join('；')}。`)
  checks.push({ name: '出行信息', passed: inputComplete, detail: inputComplete ? (plan.intent.missing.length > 0 ? '核心城市、天数和预算可排程，锚点信息仍可补充。' : '日期、到达、返程、住宿和预算信息完整。') : '预算或输入冲突仍需确认。' })

  const passed = checks.every((check) => check.passed)
  return { passed, score: Math.round((checks.filter((check) => check.passed).length / checks.length) * 100), checks, issues }
}

function createPlan(
  id: string,
  label: string,
  days: Record<string, PlannedStop[]>,
  intent: TripIntent,
  walking: string,
  difference: string,
  budgetValues: Omit<BudgetBreakdown, 'total'>,
  knowledge: CityKnowledge,
  guideContext?: GuideContext,
): GeneratedPlan {
  const budgetBreakdown = breakdown(budgetValues)
  const plan: GeneratedPlan = {
    id,
    label,
    budget: budgetBreakdown.total,
    places: countVisiblePlaces(days),
    walking,
    pace: id === 'easy' ? '很轻松' : id === 'rich' ? '充实' : paceLabel(intent.pace),
    difference,
    city: intent.destination,
    dates: intent.dates,
    nights: intent.nights,
    partySize: intent.partySize,
    budgetLimit: intent.budget,
    days,
    budgetBreakdown,
    intent,
    knowledge,
    ...(guideContext && guideContext.candidates.length > 0 ? { guideContext } : {}),
    validation: { passed: false, score: 0, checks: [], issues: [] },
    evidence: [
      `地点为${intent.destination}的城市结构化候选地点或区域。`,
      knowledge.intro,
      ...(guideContext && guideContext.candidates.length > 0
        ? [`参考了 ${guideContext.candidates.length} 条${guidePlatformsLabel(guideContext.candidates)}社区攻略线索；仅用于体验排序，不把内容中的价格、营业时间或路线当成事实。`]
        : []),
      '交通耗时、餐饮价格和门票为本地演示估算，不是实时库存或订单。',
      '出行前应重新核对营业时间、预约规则和当天路况。',
    ],
  }
  return { ...plan, validation: validatePlan(plan) }
}

export function generatePlans(intent: TripIntent, guideContext?: GuideContext): GeneratedPlan[] {
  const knowledge = getCityKnowledge(intent.destination)
  const useLegacyShanghai = intent.destination === '上海'
    && intent.durationDays === 3
    && intent.mustVisit.includes('武康路')
    && intent.arrivalLocation === '虹桥火车站'
  if (!useLegacyShanghai) {
    const variants: Array<{ id: 'match' | 'easy' | 'rich'; label: string; density: 'easy' | 'match' | 'rich'; walking: string; difference: string }> = [
      { id: 'match', label: '最匹配', density: 'match', walking: '片区优先', difference: '把必去地点、本地小吃、餐厅和住宿档位放进同一条不绕路的时间轴。' },
      { id: 'easy', label: '最轻松', density: 'easy', walking: '少走动', difference: '每天减少一个非必要停留，保留完整用餐和自由探索时间。' },
      { id: 'rich', label: '体验最丰富', density: 'rich', walking: '体验更多', difference: '增加一段夜景或本地体验，但仍按预算和返程锚点留缓冲。' },
    ]
    return variants.map((variant) => {
      const days = buildKnowledgeDays(intent, knowledge, guideContext, variant.density)
      const budgetValues = knowledgeBudget(days, intent, knowledge, variant.density)
      return createPlan(variant.id, variant.label, days, intent, variant.walking, variant.difference, budgetValues, knowledge, guideContext)
    })
  }
  const base = applyLegacyGuideHints(adaptDaysForCity(realShanghaiDays(), intent), intent, guideContext)
  const city = intent.destination
  const profile = getCityProfile(city)
  const easy = cloneDays(base)
  easy['Day 2'] = easy['Day 2'].filter((stop) => stop.id !== 'pudong-riverside')
  easy['Day 3'] = easy['Day 3'].filter((stop) => stop.id !== 'sinan-bookstore')

  const rich = cloneDays(base)
  rich['Day 2'].push(makeStop({
    id: 'suzhou-creek-night',
    time: '20:15',
    name: city === '上海' ? '苏州河夜景' : profile.stopNames?.['suzhou-creek-night'] ?? `${city}夜景`,
    type: '夜景',
    stay: '1h',
    budget: 0,
    transport: '回酒店约 20 分钟，时间待核验',
    note: '只在体力允许时加这一站，作为丰富方案的可选夜间收尾。',
    lng: city === '上海' ? 121.462 : profile.mapCenter[0] + 0.012,
    lat: city === '上海' ? 31.246 : profile.mapCenter[1] + 0.006,
    durationMinutes: 60,
    travelFromPreviousMinutes: 25,
    zone: city === '上海' ? '苏河' : `${city}参考片区`,
    mode: city === '上海' ? 'taxi' : 'metro',
    factState: 'estimated',
    factSource: `${city}公共夜景候选；路线和开放状态需出行前复核`,
  }))

  const guideNote = `按${city}的结构化城市知识库候选地点安排。`
  const lodging = city === '上海' ? 980 : 760

  return [
    createPlan('match', '最匹配', base, intent, '7.4 km', `${guideNote}保留到达日和返程日缓冲。`, { lodging, meals: 790, transport: 260, tickets: 100, coffee: 85, buffer: 500 }, knowledge, guideContext),
    createPlan('easy', '最轻松', easy, intent, '5.6 km', `${guideNote}减少两个非必要停留，保留必去地点和休息时间。`, { lodging, meals: 650, transport: 220, tickets: 100, coffee: 60, buffer: 500 }, knowledge, guideContext),
    createPlan('rich', '体验最丰富', rich, intent, '9.1 km', `${guideNote}增加一段夜间体验，但不改变返程日的安全缓冲。`, { lodging, meals: 920, transport: 340, tickets: 180, coffee: 120, buffer: 550 }, knowledge, guideContext),
  ]
}

const replacementCatalog: Record<string, { candidate: ReplacementCandidate; patch: Partial<PlannedStop> }> = {
  '衡山和集': {
    candidate: { name: '衡山和集', meta: '步行 8 分钟 · ¥40–80', reason: '仍然承担休息和逛书店的中段作用。' },
    patch: { type: '咖啡 / 书店', stay: '1h', budget: 70, lng: 121.4388, lat: 31.2151, zone: '徐汇', mode: 'walk', note: '已替换为同片区的休息点，原时间骨架保持不变。' },
  },
  'Seesaw Coffee（武康路）': {
    candidate: { name: 'Seesaw Coffee（武康路）', meta: '步行 6 分钟 · ¥35–70', reason: '仍满足咖啡偏好，不增加跨区移动。' },
    patch: { type: '咖啡', stay: '1h', budget: 70, lng: 121.438, lat: 31.212, zone: '徐汇', mode: 'walk', note: '同片区替换，保留原来的缓冲时间。' },
  },
  '浦东美术馆': {
    candidate: { name: '浦东美术馆', meta: '步行 12 分钟 · ¥80', reason: '继续留在浦东，满足看展但不改变当天区域。' },
    patch: { type: '展览', stay: '2h', budget: 80, lng: 121.506, lat: 31.241, zone: '浦东', mode: 'walk', opening: { from: '10:00', to: '21:00', label: '日间开放时段，需按当日公告复核' }, note: '同样承担室内展览作用，路线区域保持在浦东。' },
  },
  '上海自然博物馆': {
    candidate: { name: '上海自然博物馆', meta: '地铁约 25 分钟 · ¥30', reason: '室内替代项，适合天气变差时使用。' },
    patch: { type: '展览', stay: '2h', budget: 30, lng: 121.445, lat: 31.228, zone: '静安', mode: 'metro', opening: { from: '09:00', to: '17:00', label: '日间开放时段，需按当日公告复核' }, note: '根据天气切换到室内展览，保留当天节奏。' },
  },
  '外白渡桥': {
    candidate: { name: '外白渡桥', meta: '步行 12 分钟 · 免费', reason: '仍是外滩片区的开放式散步，不增加门票。' },
    patch: { type: '建筑', stay: '1h', budget: 0, lng: 121.496, lat: 31.247, zone: '外滩', mode: 'walk', note: '同片区替换，保留江边散步的路线作用。' },
  },
}

export function getReplacementCandidates(plan: GeneratedPlan, placeId: string): ReplacementCandidate[] {
  const place = Object.values(plan.days).flat().find((item) => item.id === placeId)
  if (!place) return []
  if (place.type.includes('咖啡')) return [replacementCatalog['衡山和集'].candidate, replacementCatalog['Seesaw Coffee（武康路）'].candidate]
  if (place.type.includes('展')) return [replacementCatalog['浦东美术馆'].candidate, replacementCatalog['上海自然博物馆'].candidate]
  if (place.name.includes('外滩')) return [replacementCatalog['外白渡桥'].candidate, replacementCatalog['浦东美术馆'].candidate]
  return [replacementCatalog['衡山和集'].candidate, replacementCatalog['Seesaw Coffee（武康路）'].candidate]
}

export function updateGeneratedPlan(plan: GeneratedPlan, days: Record<string, PlannedStop[]>): GeneratedPlan {
  return {
    ...plan,
    days,
    places: countVisiblePlaces(days),
    validation: validatePlan({ ...plan, days }),
  }
}

export function replacePlanPlace(plan: GeneratedPlan, placeId: string, replacementName: string): GeneratedPlan {
  const replacement = replacementCatalog[replacementName]
  if (!replacement) return plan
  const days = cloneDays(plan.days)
  Object.keys(days).forEach((day) => {
    days[day] = days[day].map((place) => place.id === placeId ? { ...place, ...replacement.patch, name: replacementName, factState: 'estimated', factSource: '本地替换候选；生产环境需重新查询 POI 和路线' } : place)
  })
  return updateGeneratedPlan(plan, days)
}

export function getDefaultGeneratedPlans() {
  return generatePlans(understandTrip({ text: DEFAULT_SHANGHAI_PROMPT, media: [] }).intent)
}

function readSession<T>(key: string): T | null {
  return readVersioned<T>(key, 'session')
}

export function readStoredUnderstanding() {
  return readSession<TripUnderstanding>(TRIP_UNDERSTANDING_STORAGE)
}

export function readStoredPlans() {
  const value = readSession<GeneratedPlan[]>(TRIP_PLANS_STORAGE)
  return value && value.length > 0 ? value : null
}

export function writeStoredUnderstanding(value: TripUnderstanding) {
  writeVersioned(TRIP_UNDERSTANDING_STORAGE, value, 'session')
}

export function writeStoredPlans(value: GeneratedPlan[]) {
  writeVersioned(TRIP_PLANS_STORAGE, value, 'session')
}
