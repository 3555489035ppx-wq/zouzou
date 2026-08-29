import { cityNames } from '../../demo-data/cities'
import type { Place, Plan } from '../../demo-data/trips'

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
  const numeric = text.match(/(\d+)\s*人/)
  if (numeric) return Number(numeric[1])
  if (/两个人|两位|我和朋友/.test(text)) return 2
  return 1
}

function parseTimes(text: string) {
  return [...text.matchAll(/(\d{1,2})[:：](\d{2})/g)].map((match) => `${match[1].padStart(2, '0')}:${match[2]}`)
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
  const normalizeAnchorLocation = (value: string) => {
    if (/浦东机场/.test(value)) return '浦东机场'
    if (/虹桥机场/.test(value)) return '虹桥机场'
    if (/虹桥火车站|虹桥站|虹桥/.test(value)) return '虹桥火车站'
    if (/机场/.test(value)) return '机场'
    return null
  }
  const textArrivalLocation = normalizeAnchorLocation(text.match(/(?:到达|抵达|落地|到站|到)\s*(浦东机场|虹桥机场|虹桥火车站|虹桥站|虹桥|机场)/)?.[1] ?? '')
  const textDepartureLocation = normalizeAnchorLocation(text.match(/(?:从|由|离开|返程(?:从)?|返回)\s*(浦东机场|虹桥机场|虹桥火车站|虹桥站|虹桥|机场)/)?.[1] ?? '')
  const mediaArrivalLocation = confirmedMediaFacts.map((fact) => fact.facts.arrivalLocation).find((value): value is string => Boolean(value))
  const mediaDepartureLocation = confirmedMediaFacts.map((fact) => fact.facts.departureLocation).find((value): value is string => Boolean(value))
  const arrivalLocation = textArrivalLocation ?? mediaArrivalLocation ?? null
  const departureLocation = textDepartureLocation ?? mediaDepartureLocation ?? null
  const mustVisit: string[] = []
  const preferences: string[] = []
  const constraints: string[] = []
  const conflicts: string[] = []

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
  if (/咖啡|coffee/.test(combined.toLowerCase())) preferences.push('咖啡')
  if (/city\s*walk|散步|慢走|街区/.test(combined.toLowerCase())) preferences.push('City Walk')
  if (/室内|下雨|雨天/.test(combined)) preferences.push('室内备选')
  if (/不想太赶|不太赶|不赶|轻松|松弛|慢慢/.test(combined)) constraints.push('每天至少保留一段缓冲，不安排连续跨区移动')
  if (/不吃|忌口/.test(combined)) constraints.push('存在饮食限制，需要在订餐前确认')

  const missing: string[] = []
  if (!dates) missing.push('具体出行日期')
  if (!times[0] || !arrivalLocation) missing.push('到达时间和地点')
  if (!times[1] || !departureLocation) missing.push('返程时间和地点')
  if (!/酒店|住宿|住在|住于/.test(text) && !confirmedMediaFacts.some((fact) => fact.facts.hotel)) missing.push('酒店位置')

  const textBudget = parseBudget(text)
  const mediaBudget = confirmedMediaFacts.map((fact) => fact.facts.budget).find((value): value is number => value !== null)

  const destination = cityNames.find((city) => combined.includes(city)) ?? '上海'
  const intent: TripIntent = {
    destination,
    dates,
    durationDays: Math.max(1, durationDays),
    nights: Math.max(0, durationDays - 1),
    partySize: parsePartySize(combined),
    budget: textBudget ?? mediaBudget ?? null,
    budgetScope: /不含[^。！？]*车票|不含[^。！？]*机票/.test(text) ? '含住宿和市内交通，不含城际交通' : '范围待确认',
    pace: /特种兵|赶行程|充实/.test(combined) ? 'full' : /不想太赶|不太赶|不赶|轻松|松弛|慢慢/.test(combined) ? 'relaxed' : 'balanced',
    mustVisit: unique(mustVisit),
    preferences: unique(preferences),
    constraints: unique(constraints),
    conflicts: unique(conflicts),
    arrivalTime: times[0] ?? null,
    arrivalLocation,
    departureTime: times[1] ?? null,
    departureLocation,
    hotel: confirmedMediaFacts.map((fact) => fact.facts.hotel).find((value): value is string => Boolean(value))
      ?? (/静安寺|静安/.test(text) ? '静安寺附近酒店' : /酒店|住宿|住在|住于/.test(text) ? '已提供住宿，但地址待确认' : null),
    missing: unique(missing),
  }

  if (intent.budget === null) intent.missing.push('总预算')

  const evidence = [
    `用户文字：${text || '未提供文字描述'}`,
    ...request.media.map((item) => `截图线索：${item.name}`),
    ...(request.mediaFacts ?? []).map((fact) => `截图识别：${fact.name} · ${fact.kind} · 置信度 ${Math.round(fact.confidence * 100)}%${fact.needsConfirmation ? ' · 需要确认' : ''}`),
    '本地上海地点库：真实公共地标；交通、价格和营业状态在生产环境需由服务端实时复核。',
  ]

  return {
    intent,
    evidence,
    summary: buildUnderstandingSummary(intent),
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
    })
  })

  checks.push({ name: '时间顺序', passed: scheduleValid, detail: scheduleValid ? '每段交通和停留均有足够间隔。' : '存在交通或停留时间重叠。' })
  checks.push({ name: '营业时间', passed: openingValid, detail: openingValid ? '有营业时间的地点均落在可访问窗口内。' : '至少一个地点超出营业窗口。' })

  const allStops = Object.values(plan.days).flat()
  const requiredValid = plan.intent.mustVisit.every((requirement) => allStops.some((stop) => matchesMustVisit(stop, requirement)))
  if (!requiredValid) issues.push(`缺少必去地点：${plan.intent.mustVisit.filter((requirement) => !allStops.some((stop) => matchesMustVisit(stop, requirement))).join('、')}`)
  checks.push({ name: '必去覆盖', passed: requiredValid, detail: requiredValid ? '用户提出的必去地点均已安排。' : '至少一个必去地点没有被安排。' })

  const budgetValid = plan.budgetLimit === null || plan.budget <= plan.budgetLimit
  if (!budgetValid) issues.push(`预算超出上限 ¥${plan.budget - (plan.budgetLimit ?? 0)}。`)
  checks.push({ name: '预算上限', passed: budgetValid, detail: budgetValid ? `计划估算 ¥${plan.budget}，不超过 ¥${plan.budgetLimit ?? '待确认'}。` : `计划估算 ¥${plan.budget}，超过预算。` })

  const conflicts = plan.intent.conflicts ?? []
  const inputComplete = plan.intent.missing.length === 0 && conflicts.length === 0
  if (plan.intent.missing.length > 0) issues.push(`需要先确认：${plan.intent.missing.join('、')}。`)
  if (conflicts.length > 0) issues.push(`存在待核对冲突：${conflicts.join('；')}。`)
  checks.push({ name: '出行信息', passed: inputComplete, detail: inputComplete ? '日期、到达、返程、住宿和预算信息完整。' : '仍有关键输入未确认。' })

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
    validation: { passed: false, score: 0, checks: [], issues: [] },
    evidence: [
      '地点为上海真实公共地标或城市区域。',
      '交通耗时、餐饮价格和门票为本地演示估算，不是实时库存或订单。',
      '出行前应重新核对营业时间、预约规则和当天路况。',
    ],
  }
  return { ...plan, validation: validatePlan(plan) }
}

export function generatePlans(intent: TripIntent): GeneratedPlan[] {
  const base = realShanghaiDays()
  const easy = cloneDays(base)
  easy['Day 2'] = easy['Day 2'].filter((stop) => stop.id !== 'pudong-riverside')
  easy['Day 3'] = easy['Day 3'].filter((stop) => stop.id !== 'sinan-bookstore')

  const rich = cloneDays(base)
  rich['Day 2'].push(makeStop({ id: 'suzhou-creek-night', time: '20:15', name: '苏州河夜景', type: '夜景', stay: '1h', budget: 0, transport: '回酒店约 20 分钟', note: '只在体力允许时加这一站，作为丰富方案的可选夜间收尾。', lng: 121.462, lat: 31.246, durationMinutes: 60, travelFromPreviousMinutes: 25, zone: '苏河', mode: 'taxi', factState: 'estimated', factSource: '真实公共滨水空间' }))

  return [
    createPlan('match', '最匹配', base, intent, '7.4 km', '把必去地点按徐汇、浦东、老城厢分区，保留到达日和返程日缓冲。', { lodging: 980, meals: 790, transport: 260, tickets: 100, coffee: 85, buffer: 500 }),
    createPlan('easy', '最轻松', easy, intent, '5.6 km', '减少两个非必要停留，保留必去地点和咖啡缓冲。', { lodging: 980, meals: 650, transport: 220, tickets: 100, coffee: 60, buffer: 500 }),
    createPlan('rich', '体验最丰富', rich, intent, '9.1 km', '增加苏州河夜景，但不改变返程日的安全缓冲。', { lodging: 980, meals: 920, transport: 340, tickets: 180, coffee: 120, buffer: 550 }),
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
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

export function readStoredUnderstanding() {
  return readSession<TripUnderstanding>(TRIP_UNDERSTANDING_STORAGE)
}

export function readStoredPlans() {
  const value = readSession<GeneratedPlan[]>(TRIP_PLANS_STORAGE)
  return value && value.length > 0 ? value : null
}

export function writeStoredUnderstanding(value: TripUnderstanding) {
  if (typeof window !== 'undefined') window.sessionStorage.setItem(TRIP_UNDERSTANDING_STORAGE, JSON.stringify(value))
}

export function writeStoredPlans(value: GeneratedPlan[]) {
  if (typeof window !== 'undefined') window.sessionStorage.setItem(TRIP_PLANS_STORAGE, JSON.stringify(value))
}
