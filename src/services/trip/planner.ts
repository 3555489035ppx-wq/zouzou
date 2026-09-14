import { getLocalGuideContext } from './localGuides'
import { buildDailyAgenda, supportsMeal, supportsEvening, supportsVisitPeriod, DAILY_VISITS, agendaVenueKey } from './dailyAgenda'
import { tripCounts } from './summary'
import { experienceCoreLimit, experiencePace, extractExperiencePreferences, experienceStartTime, experienceRouteStart } from './experiencePolicy'
import { cityNames, getCityProfile } from '../../demo-data/cities'
import type { Place, Plan } from '../../demo-data/trips'
import { dietarySummary, emptyDietaryProfile, extractDietaryProfile, foodCompatibilityIssues, type DietaryProfile } from './dietary'
import { type GuideContext } from './guides'
import { getCityKnowledge, isConcreteKnowledgeItem, knowledgeMatches, selectHotelOption, type CityKnowledge, type CityKnowledgeItem, type HotelOption } from './cityKnowledge'
import { getHotelRecommendations, hotelOptionMeta, hotelOptionReason } from './hotelRecommendation'
import { cityRouteSpecs, getCityRouteZone } from './cityRouteSpecs'
import { readVersioned, writeVersioned } from '../storage'
import { parseGeneratedPlans, parseTripUnderstanding } from './schemas'
import { getPlaceCoordinates, normalizePlace } from '../places'
import { isOfficiallyClosed, verifiedOpeningForDate } from './verifiedFacts'
import { planningKnowledge, attachKnowledge, refreshKnowledgeValidation, type KnowledgeOptions, type KnowledgeTrace } from '../travel-kb/integration'

const genericKnowledgeAliases = new Set(['城市', '地区', '景区', '风景区', '风景名胜区', '公园', '博物馆', '美术馆', '历史街区', '文化街区', '步行街', '古镇', '老街', '广场', '市场', '菜市场', '早市', '夜市', '路线', '体验', '中心', '餐馆', '餐厅', '酒店', '小吃', '美食', '本地美食', '本地小吃', '饭店', '饭馆', '面馆', '粉店', '小馆', '菜馆', '食堂', '老店', '苍蝇馆子'])
const genericKnowledgeAliasFragments = new Set([...genericKnowledgeAliases].flatMap((term) => {
  const fragments: string[] = []
  for (let length = 2; length <= term.length; length += 1) {
    for (let start = 0; start + length <= term.length; start += 1) fragments.push(term.slice(start, start + length))
  }
  return fragments
}))

function knowledgeAliases(item: CityKnowledgeItem, city: string) {
  const compactName = item.name.replace(/[（）()]/g, '')
  const text = compactName.replace(/[—\-/：:·|]/g, '')
  const aliases = new Set<string>([
    item.name,
    item.venueName ?? '',
    ...(item.menuHighlights ?? []),
    compactName,
    ...compactName.split(/[—\-/：:·|]/).map((part) => part.trim()).filter(Boolean),
  ])
  for (let length = 2; length <= Math.min(6, text.length); length += 1) {
    for (let start = 0; start + length <= text.length; start += 1) {
      aliases.add(text.slice(start, start + length))
    }
  }
  return [...aliases].filter((alias) => alias.length >= 2
    && alias !== city
    && !genericKnowledgeAliasFragments.has(alias))
}

function knowledgeRequirementMatches(item: CityKnowledgeItem, requirement: string) {
  const normalizedRequirement = requirement.trim()
  if (!normalizedRequirement) return false
  if (normalizedRequirement === '展览') return item.category === 'attraction' && item.tags.includes('展览')
  const searchableNames = [item.name, item.venueName, ...(item.menuHighlights ?? [])].filter((name): name is string => Boolean(name))
  return searchableNames.some((name) => name.includes(normalizedRequirement) || normalizedRequirement.includes(name))
}

export const DEFAULT_SHANGHAI_PROMPT = '我和朋友计划 2026年9月18日到9月20日去上海 3天2晚。9月18日10:30到虹桥火车站，住静安寺附近酒店，9月20日18:30从虹桥返程。两个人，本地总预算4000元（含住宿和市内交通，不含往返车票）。想去武康路、安福路、看展和外滩，不想太赶，喜欢咖啡，最好每天留一段缓冲。'

export const TRIP_INPUT_STORAGE = 'zouzou-trip-input'
export const TRIP_MEDIA_STORAGE = 'zouzou-trip-media'
export const TRIP_UNDERSTANDING_STORAGE = 'zouzou-trip-understanding'
export const TRIP_PLANS_STORAGE = 'zouzou-generated-plans-v3'
export const TRIP_SAVED_PLANS_STORAGE = 'zouzou-saved-plans-v1'
export const PLANNER_CONTENT_VERSION = '2026-09-14-full-daily-agenda-v2'

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
  alternatives?: Array<{ unavailable: string; replacement: string; reason: string; sourceUrl: string }>
  timeZone?: 'Asia/Shanghai'
  availableMinutes?: number
  roomCount?: number
  indoorOnly?: boolean
  lowMobility?: boolean
  unavailablePlaces?: string[]
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
  pendingVenue?: boolean
  date?: string
  durationMinutes: number
  travelFromPreviousMinutes: number
  zone: string
  mode: TravelMode
  opening?: OpeningWindow
  fixed?: boolean
  hotelOptionId?: string
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
  plannerContentVersion?: string
  knowledgeTrace?: KnowledgeTrace
  optionId?: string
  generationId?: string
  draftRevision?: number
  example?: boolean
  originOptionId?: string
  sceneType?: 'travel' | 'weekend' | 'date' | 'dining'
  sourceGroup?: { planId: string; revision: number; tripRevision?: number; selectedOptionId?: string; needsDecision?: boolean }
  previousVersion?: { days: Record<string, PlannedStop[]>; selectedHotelId?: string; intent?: TripIntent; dates?: { start: string; end: string } | null; nights?: number }
  sourceTripId?: string
  sourceVersion?: string
  tripId?: string
  revision?: number
  savedAt?: string
  status?: 'planned' | 'active' | 'paused' | 'completed' | 'archived'
  execution?: Array<{ day: string; stopId: string; action: 'arrived' | 'completed' | 'skipped'; source: 'manual'; at: string }>
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
  hotelRecommendations?: HotelOption[]
  selectedHotelId?: string
}

export type ReplacementCandidate = {
  name: string
  meta: string
  reason: string
}

type StopInput = Omit<PlannedStop, 'x' | 'z'>

const makeStop = (input: StopInput): PlannedStop => ({
  ...input,
  area: input.area ?? input.zone,
})

const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

const unique = (items: string[]) => [...new Set(items)]

function knowledgeWithRememberedPlaces(city: string): CityKnowledge {
  // Place verification is now explicit and user-controlled. External map
  // apps can search an unresolved name, but a search result is not silently
  // written back as a verified knowledge-base record.
  return getCityKnowledge(city)
}

const cloneDays = (days: Record<string, PlannedStop[]>): Record<string, PlannedStop[]> => Object.fromEntries(
  Object.entries(days).map(([day, stops]) => [day, stops.map((stop) => ({
    ...stop,
    opening: stop.opening ? { ...stop.opening, closedWeekdays: stop.opening.closedWeekdays ? [...stop.opening.closedWeekdays] : undefined } : undefined,
  }))]),
)

function parseDateRange(text: string): { start: string; end: string } | null {
  text = text.replace(/(20\d{2})-(\d{2})-(\d{2})/g, '$1年$2月$3日')
  const startMatch = text.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})[日号]/)
  if (!startMatch || startMatch.index === undefined) return null

  const [, startYear, startMonth, startDay] = startMatch
  const rest = text.slice(startMatch.index + startMatch[0].length)
  const endMatch = rest.match(/(?:到|至|—|-)\s*(?:(20\d{2})年\s*)?(?:(\d{1,2})月\s*)?(\d{1,2})[日号]/)
  const start = `${startYear}-${startMonth.padStart(2,'0')}-${startDay.padStart(2,'0')}`
  const startDate = new Date(`${start}T00:00:00Z`)
  if (!Number.isFinite(startDate.getTime()) || startDate.toISOString().slice(0,10) !== start) return null
  if (!endMatch) {
    const days = Number(text.match(/(\d+)\s*天/)?.[1] ?? 1)
    return { start, end: new Date(startDate.getTime() + (days - 1) * 86400000).toISOString().slice(0,10) }
  }

  const endYear = endMatch[1] ?? String(Number(startYear) + (endMatch[2] && Number(endMatch[2]) < Number(startMonth) ? 1 : 0))
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
  const match = text.match(/(?:总预算|人均预算|预算)(?:[^\d]{0,12})([\d,，]+(?:\.\d{1,2})?)/)
  if (!match) return null
  const amount = Number(match[1].replaceAll(',', '').replaceAll('，', ''))
  return Number.isFinite(amount) ? amount * (/人均预算|预算.{0,8}每人/.test(text) && !/全员总预算/.test(text) ? parsePartySize(text) : 1) : null
}

function parsePartySize(text: string) {
  const numeric = text.match(/(\d+)\s*(?:个)?人/)
  if (numeric) return Number(numeric[1])
  if (/两人|两个人|两位|我和朋友/.test(text)) return 2
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

/** Resolve a negative instruction within its clause, never across unrelated places. */
function negativelyMentioned(text: string, names: string[]) {
  return text.replace(/[，,]\s*(?:但是|但)?\s*(?=没有预约到|没约到|无票|没票|约满)/g, '').split(/[，,。；;！!？?\n]|但是|不过|但|而是/).some(clause => names.some(name => {
    if (name.length < 2) return false
    const index = clause.indexOf(name)
    if (index < 0) return false
    const before = clause.slice(0, index)
    const after = clause.slice(index + name.length)
    return /(?:不去|不想去|不要去|不吃|不想吃|不要吃|不安排|不想逛|不想看|不看|跳过|排除|取消)(?:\s|再|逛|参观)*(?:[^，。；;]*[、和及])?$/.test(before)
      || /^(?:这次|暂时|已经|也|都|暂)?(?:不去|不想去|不吃|不想吃|不安排|跳过|取消|没有预约到|没约到|约满|无票|没票)/.test(after)
      || /(?:没有预约到|没约到|无票|没票)\s*$/.test(before)
  }))
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
  const combined = `${text} ${confirmedFactText}`.replaceAll('红膏炝蟹', '红膏呛蟹')
  const textDates = parseDateRange(text)
  const durationMatch = text.match(/(\d+)\s*天/)
  const arrivalDates=unique(mediaFacts.filter(fact=>fact.facts.arrivalLocation&&fact.facts.dates).map(fact=>fact.facts.dates!.start))
  const departureDates=unique(mediaFacts.filter(fact=>fact.facts.departureLocation&&fact.facts.dates).map(fact=>fact.facts.dates!.end))
  const fullRanges=(facts:MediaFact[])=>facts.filter(fact=>!((fact.facts.arrivalLocation||fact.facts.departureLocation)&&fact.facts.dates?.start===fact.facts.dates?.end)).map(fact=>fact.facts.dates).filter((value):value is {start:string;end:string}=>Boolean(value))
  const mediaDateRanges = fullRanges(mediaFacts)
  const confirmedMediaDateRanges = fullRanges(confirmedMediaFacts)
  if(arrivalDates.length===1&&departureDates.length===1&&arrivalDates[0]<=departureDates[0]){mediaDateRanges.push({start:arrivalDates[0],end:departureDates[0]});if(confirmedMediaFacts.length===mediaFacts.length)confirmedMediaDateRanges.push({start:arrivalDates[0],end:departureDates[0]})}
  const uniqueMediaDates = unique(mediaDateRanges.map((value) => `${value.start}~${value.end}`))
  const uniqueConfirmedMediaDates = unique(confirmedMediaDateRanges.map((value) => `${value.start}~${value.end}`))
  const textDurationDays = durationMatch ? Number(durationMatch[1]) : /半天|当天|同城周末/.test(text) ? 1 : null
  const confirmedMediaDurationDays = uniqueConfirmedMediaDates.length === 1 ? inclusiveDays(confirmedMediaDateRanges[0] ?? null) : null
  const mediaDateMatchesTextDuration = textDurationDays === null || confirmedMediaDurationDays === textDurationDays
  const dates = textDates ?? (uniqueConfirmedMediaDates.length === 1 && mediaDateMatchesTextDuration ? confirmedMediaDateRanges[0] : null)
  const durationDays = inclusiveDays(textDates) ?? textDurationDays ?? inclusiveDays(dates) ?? 3
  const textTimes = parseTimes(text)
  const confirmedMediaTimes = unique(confirmedMediaFacts.flatMap((fact) => fact.facts.times))
  const times = unique([...textTimes, ...confirmedMediaTimes])
  const mentionedDestinations = cityNames.filter(city => combined.includes(city)).sort((a,b) => combined.indexOf(a) - combined.indexOf(b))
  const explicitDestination = mentionedDestinations.find(city => new RegExp(`(?:去|游玩|旅行到)\\s*${city}`).test(combined))
  const destination = explicitDestination ?? mentionedDestinations[0] ?? '未确定'
  const cityProfile = getCityProfile(destination)
  const knowledge = knowledgeWithRememberedPlaces(destination)
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
  if(arrivalDates.length>1||departureDates.length>1)conflicts.push('截图日期存在冲突：同方向交通记录有多个日期，请确认采用哪份资料。')
  if(textDates&&arrivalDates.some(date=>date!==textDates.start))conflicts.push(`文字到达日期${textDates.start}与截图日期${arrivalDates.join('、')}不一致`)
  if(textDates&&departureDates.some(date=>date!==textDates.end))conflicts.push(`文字返程日期${textDates.end}与截图日期${departureDates.join('、')}不一致`)
  const mentionedCities=cityNames.filter(city=>combined.includes(city))
  if(mentionedCities.length>1)conflicts.push(`涉及多个城市：${mentionedCities.join('、')}。需确认城际交通和分日安排，不能按市内转场排程。`)
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
  const profilePlaceTerms = new Set(unique([
    ...cityProfile.demoLabels,
    ...Object.values(cityProfile.stopNames ?? {}),
  ]).flatMap((term) => [term, term.replace(/(?:边|咖啡|晚餐|夜景)$/, '')]).filter((term) => term.length >= 2))
  const aliasesByItem = knowledge.items.map((item) => ({ item, aliases: knowledgeAliases(item, destination) }))
  const aliasCounts = new Map<string, number>()
  aliasesByItem.forEach(({ aliases }) => aliases.forEach((alias) => aliasCounts.set(alias, (aliasCounts.get(alias) ?? 0) + 1)))
  const matchedProfilePlaceAliases = new Set<string>()
  const matchedFoodVenues = new Set<string>()
  const matchedFoodDishes = new Set<string>()
  aliasesByItem.forEach(({ item, aliases }) => {
    const matchedAlias = aliases.find((alias) => {
      const isProfilePlace = profilePlaceTerms.has(alias) && (item.category === 'attraction' || item.category === 'activity')
      const isMenuAlias = item.menuHighlights?.includes(alias) ?? false
      if (isProfilePlace && matchedProfilePlaceAliases.has(alias)) return false
      return (alias.length >= 3 || aliasCounts.get(alias) === 1 || isProfilePlace || (isMenuAlias && isConcreteKnowledgeItem(item))) && combined.includes(alias)
    })
    if (matchedAlias && isConcreteKnowledgeItem(item)) {
      const isFood = item.category === 'food' || item.category === 'restaurant'
      if (isFood) {
        // Several menu hints can resolve to the same shop. Keep one concrete
        // venue requirement so the planner can satisfy all of them with a
        // single named stop and still show the full menu in its note.
        const venue = item.venueName ?? item.name
        const requestedDishes = (item.menuHighlights ?? []).filter(dish => combined.includes(dish) && !negativelyMentioned(combined, [dish]))
        if (negativelyMentioned(combined, [venue]) || negativelyMentioned(combined, [matchedAlias])) return
        if (!combined.includes(venue) && requestedDishes.length > 0 && requestedDishes.every(dish => matchedFoodDishes.has(dish))) return
        if (!matchedFoodVenues.has(venue)) {
          matchedFoodVenues.add(venue)
          requestedDishes.forEach(dish => matchedFoodDishes.add(dish))
          if (!combined.includes(venue) && requestedDishes.length > 0) mustVisit.push(...requestedDishes)
          else if (!mustVisit.includes(venue)) mustVisit.push(venue)
        }
      } else if (!mustVisit.includes(item.name)) {
        mustVisit.push(item.name)
      }
    }
    if (matchedAlias && profilePlaceTerms.has(matchedAlias)) matchedProfilePlaceAliases.add(matchedAlias)
  })
  // A requested local dish remains a requirement even before a restaurant is found.
  // Its cuisine-only knowledge entry must never become a fabricated restaurant stop.
  mustVisit.push(...knowledge.items.filter(item => item.tags.includes('菜品线索') && combined.includes(item.name) && !negativelyMentioned(combined, [item.name])).map(item => item.name))
  if (/咖啡|coffee/.test(combined.toLowerCase())) preferences.push('咖啡')
  if (/city\s*walk|散步|慢走|街区/.test(combined.toLowerCase())) preferences.push('City Walk')
  if (/美食|小吃|餐厅|餐馆|湘菜|臭豆腐|糖油粑粑|口味虾|吃/.test(combined)) preferences.push('本地美食')
  if (/湘菜/.test(combined)) preferences.push('湘菜')
  preferences.push(...unique(knowledge.items.flatMap(item => item.menuHighlights ?? []).filter(dish => combined.includes(dish) && !negativelyMentioned(combined, [dish]))))
  if (/夜景|灯光|日落/.test(combined)) preferences.push('夜景')
  if (/室内|下雨|雨天/.test(combined)) preferences.push('室内备选')
  preferences.push(...extractExperiencePreferences(combined))
  if (/不要太赶|不想太赶|不太赶|不赶|不想.{0,3}累|轻松|松弛|慢慢/.test(combined)) constraints.push('每天至少保留一段缓冲，不安排连续跨区移动')
  if (/老人|儿童|低体力|轮椅/.test(combined)) constraints.push('老人/儿童或低体力同行：减少节点、加入休息；单段步行上限和无障碍设施需另行核实。')
  const dietaryLabels = dietarySummary(dietary)
  if (dietaryLabels.length > 0) constraints.push(`饮食限制：${dietaryLabels.join('、')}；下单前确认调味、配料和交叉接触风险`)

  const missing: string[] = []
  if(destination==='未确定')missing.push('目的地城市')
  if (!dates) {
    const partialDate = text.match(/(\d{1,2})月\s*(\d{1,2})[日号]/)
    missing.push(partialDate ? `出行年份（已识别${Number(partialDate[1])}月${Number(partialDate[2])}日）` : '具体出行日期')
  }
  if (arrivalLocation && /动车站|高铁站/.test(arrivalLocation)) missing.push(`到达站正式名称（原文：${arrivalLocation}）`)
  if (!times[0] || !arrivalLocation) missing.push('到达时间和地点')
  if (!times[1] || !departureLocation) missing.push('返程时间和地点')
  const textHotelArea = text.match(/(?:住在|住于|入住|住)\s*([^，。；,;\n]{2,24}?(?:附近|周边|一带))(?=[，。；,;\n]|$)/)?.[1]?.trim() ?? null
  const textHotel = text.match(/(?:住在|住于|入住(?:在)?|住)\s*([^，。；,;\n]{2,32}?酒店)(?=[，。；,;\n]|$)/)?.[1]?.trim() ?? null
  if (durationDays > 1 && !textHotel && !textHotelArea && !confirmedMediaFacts.some((fact) => fact.facts.hotel)) missing.push('酒店位置')

  const textBudget = parseBudget(text)
  const mediaBudget = confirmedMediaFacts.map((fact) => fact.facts.budget).find((value): value is number => value !== null)

  const unavailablePlaces = knowledge.items.filter(item => negativelyMentioned(combined, [item.name, ...knowledgeAliases(item, destination).filter(alias => aliasCounts.get(alias) === 1)])).map(item => item.name)
  const intent: TripIntent = {
    timeZone: 'Asia/Shanghai',
    availableMinutes: /半天/.test(combined)?360:undefined,
    roomCount: Number(combined.match(/(\d+)\s*间房/)?.[1])||undefined,
    indoorOnly: /全部.{0,4}室内|只.{0,4}室内/.test(combined),
    lowMobility: /老人|儿童|低体力|轮椅/.test(combined) || preferences.some(term=>['父母','亲子'].includes(term)),
    unavailablePlaces,
    destination,
    dates,
    durationDays: Math.max(1, durationDays),
    nights: Math.max(0, durationDays - 1),
    partySize: parsePartySize(combined),
    budget: textBudget ?? mediaBudget ?? null,
    budgetScope: /不含[^。！？]*车票|不含[^。！？]*机票/.test(text) ? '含住宿和市内交通，不含城际交通' : '范围待确认',
    pace: /特种兵|赶行程|充实/.test(combined) ? 'full' : /不要太赶|不想太赶|不太赶|不赶|不想.{0,3}累|轻松|松弛|慢慢/.test(combined) ? 'relaxed' : 'balanced',
    mustVisit: unique(mustVisit).filter(name => !unavailablePlaces.includes(name)).filter(name => !negativelyMentioned(combined, [name, ...(name === '展览' ? ['看展', '展览', '美术馆', '博物馆'] : [])])).filter((name) => {
      if (name === '展览' || combined.includes(name) || matchedFoodVenues.has(name)) return true
      const short = name.replace(destination, '').replace(/风景名胜区|风景区|景区|公园$/g, '')
      if (short.length >= 2 && combined.includes(short)) return true
      // A catalog route can be requested by one distinctive endpoint (北外滩
      // in 外白渡桥—北外滩). Do not turn a shared/generic fragment into several
      // required routes, or include an endpoint the user explicitly excluded.
      const endpoints = name.split(/[—–]/).map(part=>part.trim())
      if (endpoints.length > 1 && !endpoints.some(part=>negativelyMentioned(combined,[part]))
        && endpoints.some(part=>part.length>=3 && part!==destination && !genericKnowledgeAliasFragments.has(part)
          && combined.includes(part) && knowledge.items.filter(item=>item.name.includes(part)).length===1)) return true
      // Accept explicit, distinctive abbreviated venue names, never generic intent such as 看展.
      return ['音乐台','欢乐谷','橘子洲','岳麓山','西湖'].some(alias => name.includes(alias) && combined.includes(alias))
    }),
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
      ?? textHotelArea
      ?? (/静安寺|静安/.test(text) ? '静安寺附近酒店' : null),
    missing: unique(missing),
  }

  if (intent.budget === null) intent.missing.push('总预算')

  const evidence = [
    `用户文字：${text || '未提供文字描述'}`,
    ...request.media.map((item) => `截图线索：${item.name}`),
    ...(request.mediaFacts ?? []).map((fact) => `截图识别：${fact.name} · ${fact.kind} · 置信度 ${Math.round(fact.confidence * 100)}%${fact.needsConfirmation ? ' · 需要确认' : ''}`),
    `${destination}城市知识库：${knowledge.status === 'curated' ? '官方地点资料 + 片区索引' : '城市地点索引'}；路线和预算按规划参考整理。`,
  ]

  return {
    intent,
    evidence,
    summary: buildUnderstandingSummary(intent),
    knowledge,
    ...(request.mediaFacts && request.mediaFacts.length > 0 ? { mediaFacts: request.mediaFacts } : {}),
  }
}

export function isHotelStop(stop: Pick<PlannedStop, 'type'>) {
  return ['住宿', '退房', '取行李'].includes(stop.type)
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
  time: string,
  travelFromPreviousMinutes: number,
  mode: TravelMode,
  dietary: DietaryProfile,
): PlannedStop {
  const coordinates = item.verified ? getPlaceCoordinates({ coordinates: item.coordinates, coordinateSystem: item.coordinateSystem }) : null
  const budget = midpoint(item.price)
  const type = knowledgeItemType(item)
  const factState = item.verified ? 'verified' : 'estimated'
  const sourceText = `${item.source.label}；${item.verified ? '地点资料有原核验标记' : '地点信息需出发前复核'}，动态事实逐字段核对`
  const routeZone = getCityRouteZone(city, item.name, item.area)
  const visibleMenu = (item.menuHighlights ?? []).filter((dish) => foodCompatibilityIssues(dish, dietary).length === 0)
  return makeStop({
    id: `${city}-${item.id}`,
    time,
    name: item.name,
    type,
    stay: item.durationMinutes >= 60 ? `${Math.floor(item.durationMinutes / 60)}h${item.durationMinutes % 60 ? ` ${item.durationMinutes % 60}min` : ''}` : `${item.durationMinutes}min`,
    budget,
    priceState: item.price.state ?? 'estimated',
    transport: travelFromPreviousMinutes === 0 ? '从住宿点出发' : `${mode === 'walk' ? '步行' : mode === 'metro' ? '地铁' : '打车'}约 ${travelFromPreviousMinutes} 分钟`,
    note: [
      item.summary,
      item.address ? `地址：${item.address}` : '',
      visibleMenu.length > 0 ? `可点：${visibleMenu.join('、')}` : '',
    ].filter(Boolean).join(' '),
    ...(coordinates ? { longitude: coordinates.longitude, latitude: coordinates.latitude, lng: coordinates.longitude, lat: coordinates.latitude } : {}),
    area: item.area,
    ...(item.venueName ? { canonicalName: item.venueName } : {}),
    ...(item.address ? { address: item.address } : {}),
    ...(item.amapPoiId ? { poiId: item.amapPoiId, amapPoiId: item.amapPoiId } : {}),
    ...(item.coordinateSystem ? { coordinateSystem: item.coordinateSystem } : {}),
    ...(item.verified && item.coordinateSystem ? { mapStatus: 'resolved' as const } : {}),
    searchKeyword: item.searchKeyword ?? item.venueName ?? item.name,
    coordinateSource: item.verified ? '走走知识库 · 地点已核验' : '走走知识库 · 地点坐标待核验',
    verified: item.verified,
    durationMinutes: item.durationMinutes,
    travelFromPreviousMinutes,
    zone: routeZone.name,
    mode,
    opening: item.opening,
    dietaryTags: item.dietaryTags,
    factState,
    factSource: sourceText,
  })
}

function tripItemPriority(item: CityKnowledgeItem, intent: TripIntent) {
  const required = intent.mustVisit.some((term) => knowledgeRequirementMatches(item, term))
  const preferred = intent.preferences.some((term) => knowledgeMatches(item, [term]))
  const meal = item.category === 'food' || item.category === 'restaurant'
  return (required ? 100 : 0) + (preferred ? 20 : 0) + (meal ? 5 : 0)
}

function routeBands(items: CityKnowledgeItem[], city: string) {
  const bands = new Map<string, { zone: ReturnType<typeof getCityRouteZone>; items: CityKnowledgeItem[] }>()
  items.forEach((item) => {
    const zone = getCityRouteZone(city, item.name, item.area)
    const key = `${zone.order}:${zone.name}`
    bands.set(key, { zone, items: [...(bands.get(key)?.items ?? []), item] })
  })
  const declaredOrder = new Map((cityRouteSpecs[city] ?? []).map((zone, index) => [zone.name, index]))
  return [...bands.values()]
    .sort((left, right) => left.zone.order - right.zone.order
      || (declaredOrder.get(left.zone.name) ?? Number.MAX_SAFE_INTEGER) - (declaredOrder.get(right.zone.name) ?? Number.MAX_SAFE_INTEGER))
    .map((band) => band.items)
}

function itemIsMeal(item: CityKnowledgeItem) {
  return item.category === 'restaurant' || (item.category === 'food' && !item.tags.includes('咖啡'))
}

function plannedStopIsMeal(stop: Pick<PlannedStop, 'type'>) {
  return /早餐|午餐|晚餐|本地小吃/.test(stop.type)
}

function mealIdentity(item: CityKnowledgeItem) {
  return normalizeMealVenue(item.venueName ?? item.name)
}

function assignItemsToDays(items: CityKnowledgeItem[], city: string, dayCount: number, intent: TripIntent, itemLimit: number, density: 'easy' | 'match' | 'rich' = 'match') {
  const buckets = Array.from({ length: dayCount }, () => [] as CityKnowledgeItem[])
  // Restaurants without a known district must not consume a sightseeing day.
  const bands = routeBands(items.filter(item=>!itemIsMeal(item)), city).map(band=>[
    ...band,...items.filter(item=>itemIsMeal(item)&&getCityRouteZone(city,item.name,item.area).name===getCityRouteZone(city,band[0].name,band[0].area).name),
  ])
  if (bands.length === 0) return buckets

  // Allocate available days to each geographic band before allocating stops.
  // Mapping one band to one day left all remaining days empty on longer trips.
  const bandDays = bands.map(() => 1)
  if (bands.length < dayCount) {
    while (bandDays.reduce((sum, count) => sum + count, 0) < dayCount) {
      const next = bands.map((band, index) => ({ index, count: band.filter(item => !itemIsMeal(item)).length }))
        .filter(({ index, count }) => count > bandDays[index])
        .sort((a, b) => b.count / bandDays[b.index] - a.count / bandDays[a.index])[0]
      if (!next) break
      bandDays[next.index]++
    }
  }

  bands.forEach((band, bandIndex) => {
    const dayIndex = bands.length <= dayCount
      ? Math.min(dayCount - 1, bandDays.slice(0, bandIndex).reduce((sum, count) => sum + count, 0))
      : Math.ceil((bandIndex * (dayCount - 1)) / (bands.length - 1))
    const experienceRank = (item: CityKnowledgeItem) => (item.category === 'activity' ? 4 : 0) + (/茶|市井|非遗|手作|生活|文创/.test(item.tags.join(' ')) ? 2 : 0)
    const ordered = [...band].sort((left, right) => tripItemPriority(right, intent) - tripItemPriority(left, intent)
      || (density === 'easy' ? left.durationMinutes - right.durationMinutes : density === 'rich' ? experienceRank(right) - experienceRank(left) : 0))
    const required = ordered.filter((item) => intent.mustVisit.some((term) => knowledgeRequirementMatches(item, term)))
    const preferred = ordered.filter((item) => !required.includes(item)
      && intent.preferences.some((term) => knowledgeMatches(item, [term])))
    const meals = ordered.filter(itemIsMeal)
    const nonMeals = ordered.filter((item) => !itemIsMeal(item))
    const selected: CityKnowledgeItem[] = []
    const selectedMealKeys = new Set<string>()
    const add = (item: CityKnowledgeItem) => {
      if (selected.includes(item)) return
      if (itemIsMeal(item)) {
        const key = mealIdentity(item)
        if (selectedMealKeys.has(key)) return
        if (!required.includes(item) && selectedMealKeys.size > 0) return
        selectedMealKeys.add(key)
      }
      selected.push(item)
    }
    required.forEach(add)
    preferred.filter((item) => !itemIsMeal(item)).slice(0, 2).forEach(add)
    preferred.filter(itemIsMeal).slice(0, 1).forEach(add)
    meals.slice(0, 1).forEach(add)
    nonMeals.forEach(add)
    const selectedForBand = selected.slice(0, Math.max(itemLimit * bandDays[bandIndex], required.length))
    const visits = selectedForBand.filter(item => !itemIsMeal(item))
    visits.forEach((item, index) => buckets[dayIndex + Math.floor(index * bandDays[bandIndex] / visits.length)].push(item))
    selectedForBand.filter(itemIsMeal).forEach((item, index) => buckets[dayIndex + index % bandDays[bandIndex]].push(item))
  })

  // Keep a same-band local meal on the first day when the core route has one
  // but the band allocator placed it on a later day. This gives an arriving
  // traveler a concrete local meal without pulling a far-away stop forward.
  if (buckets.length > 1 && !buckets[0].some(itemIsMeal)) {
    const firstDayOrders = new Set(buckets[0].map((item) => getCityRouteZone(city, item.name, item.area).order))
    const mealCandidate = buckets
      .slice(1)
      .flatMap((bucket, dayIndex) => bucket
        .filter(itemIsMeal)
        .map((item) => ({ item, dayIndex: dayIndex + 1, order: getCityRouteZone(city, item.name, item.area).order })))
      .filter(({ order }) => firstDayOrders.has(order))
      .sort((left, right) => left.dayIndex - right.dayIndex)[0]
    if (mealCandidate) {
      buckets[mealCandidate.dayIndex] = buckets[mealCandidate.dayIndex].filter((item) => item !== mealCandidate.item)
      buckets[0].push(mealCandidate.item)
    }
  }
  if (dayCount >= 3) {
    const last = dayCount - 1
    const zoneOrder = (bucket: CityKnowledgeItem[]) => Math.max(0, ...bucket.filter(item=>!itemIsMeal(item)).map(item=>getCityRouteZone(city,item.name,item.area).order))
    const lastOrder = zoneOrder(buckets[last])
    const middle = buckets.map((bucket,index)=>({index,order:zoneOrder(bucket)})).filter(entry=>entry.index>0 && entry.index<last && entry.order>0).sort((a,b)=>a.order-b.order)[0]
    if (lastOrder >= 3 && middle && middle.order < lastOrder) [buckets[middle.index],buckets[last]] = [buckets[last],buckets[middle.index]]
  }
  return buckets
}

function scheduleItemRank(item: CityKnowledgeItem) {
  const type = knowledgeItemType(item)
  if (type === '午餐') return 1
  if (type === '晚餐') return 3
  if (type === '夜景') return 4
  return 0
}

function keepMealWithinItemLimit(
  selectedItems: CityKnowledgeItem[],
  requiredItems: CityKnowledgeItem[],
  itemLimit: number,
) {
  const limit = Math.max(itemLimit, requiredItems.length)
  const limited = selectedItems.slice(0, limit)
  const meal = selectedItems.find(itemIsMeal)
  if (!meal || limited.some(itemIsMeal)) return limited

  const replaceIndex = [...limited.keys()]
    .reverse()
    .find((index) => !requiredItems.includes(limited[index]) && !itemIsMeal(limited[index]))
  if (replaceIndex !== undefined) limited[replaceIndex] = meal
  else limited.push(meal)
  return limited
}

function fitsRequestedPace(item: CityKnowledgeItem, intent: TripIntent) {
  if (intent.pace !== 'relaxed' && !intent.lowMobility) return true
  const remote = /远郊|远线|远程/.test(`${item.area} ${item.tags.join(' ')} ${getCityRouteZone(intent.destination, item.name, item.area).name}`)
  return !remote || intent.mustVisit.some(term => knowledgeRequirementMatches(item, term))
}

function buildCityKnowledgeItems(intent: TripIntent, knowledge: CityKnowledge, guideContext: GuideContext | undefined) {
  const dietary = intent.dietary ?? emptyDietaryProfile()
  const compatibleKnowledge = knowledge.items.filter(item=>!isOfficiallyClosed(intent.destination, item.name, intent.dates) && !intent.unavailablePlaces?.includes(item.name) && (!intent.indoorOnly || item.tags.includes('室内'))).filter((item) => item.category !== 'food' && item.category !== 'restaurant'
    || (isConcreteKnowledgeItem(item) && foodCompatibilityIssues(`${item.name} ${item.summary}`, dietary, item.dietaryTags).length === 0))
    .filter((item) => isConcreteKnowledgeItem(item) && fitsRequestedPace(item, intent))
  const matched = compatibleKnowledge.filter((item) => intent.mustVisit.some((term) => knowledgeRequirementMatches(item, term))
    || intent.preferences.some((term) => knowledgeMatches(item, [term])))
  const guideCandidates = guideContext?.candidates ?? []
  const guideHints = guideCandidates.flatMap((candidate) => [
    ...candidate.placeHints,
    ...(candidate.foodHints ?? []),
    ...(candidate.localExperienceHints ?? []),
  ])
  const guideMatched = compatibleKnowledge.filter((item) => guideHints.some((hint) => {
    const menu = item.menuHighlights ?? []
    return item.name.includes(hint) || hint.includes(item.name) || menu.some((dish) => dish.includes(hint) || hint.includes(dish))
  }))
  const byName = new Map<string, CityKnowledgeItem>()
  const visitKey = (item: CityKnowledgeItem) => {
    const base = item.name.replace(/(?:慢看|看展|早走|晨走|逛吃|散步|夜逛|慢走|拍照|观景|看日落)$/, '')
    return compatibleKnowledge.some(other => other.name === base) ? base : item.name
  }
  const addItem = (item: CityKnowledgeItem) => {
    const key = item.category === 'food' || item.category === 'restaurant'
      ? mealIdentity(item)
      : visitKey(item)
    const existing = byName.get(key)
    const existingIsVenue = Boolean(existing && existing.name === existing.venueName)
    const nextIsVenue = item.name === item.venueName
    const breakfastPriority = item.tags.includes('早餐专用') && !existing?.tags.includes('早餐专用')
    if (!existing || breakfastPriority || (itemIsMeal(item) && !existing.tags.includes('早餐专用') && !existingIsVenue && nextIsVenue) || (!itemIsMeal(item) && item.name === key && existing.name !== key)) {
      if (existing) byName.delete(key)
      byName.set(key, item)
    }
  }
  if (knowledge.status === 'curated') {
    matched.forEach(addItem)
    guideMatched.forEach(addItem)
    compatibleKnowledge.filter((item) => !matched.includes(item)).forEach(addItem)
  } else {
    guideMatched.forEach(addItem)
    matched.forEach(addItem)
    compatibleKnowledge.filter((item) => !matched.includes(item)).forEach(addItem)
  }
  const items = [...byName.values()]
  const requiredTerms = intent.mustVisit
  const priorityPreferenceTerms = intent.preferences.filter((term) => !['本地美食', '夜景', '室内备选', 'City Walk'].includes(term))
  const priority = (item: CityKnowledgeItem) => {
    if (requiredTerms.some((term) => knowledgeRequirementMatches(item, term))) return 2
    if (priorityPreferenceTerms.some((term) => knowledgeMatches(item, [term]))) return 1
    return 0
  }
  items.sort((left, right) => {
    const leftPriority = priority(left)
    const rightPriority = priority(right)
    if (leftPriority !== rightPriority) return rightPriority - leftPriority
    const leftNamedRestaurant = left.category === 'restaurant' && left.tags.includes('本地餐馆') ? 1 : 0
    const rightNamedRestaurant = right.category === 'restaurant' && right.tags.includes('本地餐馆') ? 1 : 0
    return rightNamedRestaurant - leftNamedRestaurant
  })
  return items
}

function addMinutes(value: string, amount: number) {
  const total = timeToMinutes(value) + amount
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function buildKnowledgeDays(intent: TripIntent, knowledge: CityKnowledge, guideContext: GuideContext | undefined, density: 'easy' | 'match' | 'rich', selectedHotel: HotelOption) {
  const dietary = intent.dietary ?? emptyDietaryProfile()
  let items = buildCityKnowledgeItems(intent, knowledge, guideContext)
  // City + days means full city days. Use the same meal-first rhythm as Discover;
  // dated/arrival-constrained trips continue through the fixed-anchor scheduler.
  if (!intent.arrivalTime && !intent.arrivalLocation && !intent.departureTime && !intent.departureLocation
    && !intent.mustVisit.length && !intent.availableMinutes && !intent.lowMobility && !intent.preferences.includes('晚起')) {
    const dateFor=(day:number)=>intent.dates?new Date(Date.parse(intent.dates.start+'T12:00:00Z')+day*86400000).toISOString().slice(0,10):undefined
    const agenda=buildDailyAgenda({city:intent.destination,days:intent.durationDays,items,density:intent.pace==='relaxed'?'easy':density,lightEvening:intent.pace==='relaxed',variant:density==='rich'?2:density==='easy'?1:0,
      isAvailable:(item,day,start,duration)=>{
        const date=dateFor(day)
        if(!date)return true
        if(isOfficiallyClosed(intent.destination,item.name,{start:date,end:date})||item.opening?.closedWeekdays?.includes(new Date(date+'T12:00:00Z').getUTCDay()))return false
        const opening=verifiedOpeningForDate(intent.destination,item.name,date)
        return !opening||(start>=timeToMinutes(opening.from)&&start+duration<=timeToMinutes(opening.to))
      }})
    if(agenda.every(day=>day.missing.length===0)) return Object.fromEntries(agenda.map((day,index)=>{
      const stops:PlannedStop[]=day.entries.map(entry=>({...knowledgeItemToStop(entry.item,intent.destination,entry.time,entry.transfer,'metro',dietary),
        id:`${entry.item.id}-day-${index+1}`,date:dateFor(index),type:['早餐','午餐','晚餐'].includes(entry.period)?entry.period:entry.period==='晚间'?(intent.pace==='relaxed'?'可选夜游':'夜游'):knowledgeItemType(entry.item),
        durationMinutes:entry.duration,stay:`${entry.duration}min`,transport:entry.transfer?`规划预留${entry.transfer}分钟转场，实际路线请查看地图`:'当天起点'}))
      if(intent.nights>0)stops.unshift(makeStop({id:`${intent.destination}-hotel-day-${index+1}`,name:selectedHotel.name,type:'住宿',time:'06:50',stay:'15min',durationMinutes:15,
        budget:midpoint(selectedHotel.nightly),hotelOptionId:selectedHotel.id,travelFromPreviousMinutes:0,zone:selectedHotel.area,mode:'walk',fixed:true,date:dateFor(index),
        note:index===0?'先安排行李寄存；实际入住按酒店办理时间，再出发吃早餐。':'从酒店出发，先吃早餐再开始当天游览。',
        transport:'住宿出发点',factState:selectedHotel.verified?'verified':'estimated',factSource:selectedHotel.source.label}))
      return [`Day ${index+1}`,stops]
    }))
  }
  if(!intent.mustVisit.length&&!intent.preferences.length){
    const signature=knowledge.items.find(item=>item.category==='attraction'&&items.some(candidate=>candidate.name===item.name)&&!/远郊|北郊|南郊|远线/.test(item.area))
    if(signature)intent={...intent,mustVisit:[signature.name]}
  }
  // A full-day destination needs an explicit interest; it must not silently
  // consume the return day of a short city visit (for example Disneyland).
  if(intent.durationDays<=3){
    const cityVisit=items.filter(item=>itemIsMeal(item)||item.durationMinutes<300
      ||intent.mustVisit.some(term=>knowledgeRequirementMatches(item,term))
      ||intent.preferences.some(term=>knowledgeMatches(item,[term])&&!['美食','本地美食','室内备选','City Walk'].includes(term)))
    if(cityVisit.filter(item=>!itemIsMeal(item)).length>=intent.durationDays*2)items=cityVisit
  }
  if (intent.durationDays <= 3 && !intent.preferences.some(term=>/近郊|远郊|登山|徒步|雪山|露营/.test(term))) {
      const central = items.filter(item=>itemIsMeal(item) || (getCityRouteZone(intent.destination,item.name,item.area).order<3 && !/远郊|北郊|南郊|远线/.test(item.area)) || intent.mustVisit.some(term=>knowledgeRequirementMatches(item,term)))
    if (central.filter(item=>!itemIsMeal(item)).length >= intent.durationDays * 2) items = central
  }
  // One generic exhibition request needs one venue, not every museum in the city.
  const requiredNames = intent.mustVisit.flatMap(term => {
    const candidates = items.filter(item => knowledgeRequirementMatches(item, term))
    if (term === '展览') candidates.sort((left, right) => getCityRouteZone(intent.destination, left.name, left.area).order - getCityRouteZone(intent.destination, right.name, right.area).order)
    const match = candidates.find(item => item.name === term) ?? candidates[0]
    return match ? [match.name] : [term]
  })
  const requiredDishes = intent.mustVisit.filter(term => items.some(item => item.menuHighlights?.includes(term)))
  items = items.filter(item => !itemIsMeal(item) || requiredNames.includes(item.name)
    || !requiredDishes.some(dish => item.menuHighlights?.includes(dish)))
  const wantsCommunityFood = /美食|小吃|逛吃|早餐|午餐|晚餐|餐厅|餐馆|夜市|早市|菜市场/.test([...intent.preferences, ...intent.mustVisit].join(' '))
  const foodHints = [...(wantsCommunityFood ? guideContext?.candidates.flatMap(candidate => candidate.foodHints ?? []) ?? [] : []), ...intent.preferences]
  const preferredMeal = items.find(item => itemIsMeal(item) && (item.menuHighlights ?? []).some(dish => foodHints.some(hint => dish.includes(hint) || hint.includes(dish))))
  intent = { ...intent, mustVisit: unique(requiredNames), preferences: [...intent.preferences, ...(preferredMeal ? [preferredMeal.name] : [])] }
  const dayCount = Math.max(1, intent.durationDays)
  const experience = experiencePace(intent, density)
  const itemLimit = experience.core + experience.light + 1
  const buckets = assignItemsToDays(items, intent.destination, dayCount, intent, itemLimit, density)
  const days: Record<string, PlannedStop[]> = {}

  buckets.forEach((dayItems, dayIndex) => {
    const dayNumber = dayIndex + 1
    const isFirst = dayIndex === 0
    const isLast = dayIndex === dayCount - 1
    const stops: PlannedStop[] = []
    let cursor = isFirst ? (intent.arrivalTime ?? (intent.preferences.includes('晚起') ? experienceStartTime(intent) : '07:00')) : isLast && intent.departureTime && timeToMinutes(intent.departureTime)<10*60 ? addMinutes(intent.departureTime,-105) : experienceStartTime(intent)
    let previous: PlannedStop | undefined
    const addStop = (stop: PlannedStop) => {
      if(intent.dates){
        const baseDate=previous?.date??new Date(Date.parse(`${intent.dates.start}T00:00:00Z`)+dayIndex*86400000).toISOString().slice(0,10)
        const rollover=previous&&timeToMinutes(stop.time)<timeToMinutes(previous.time)?86400000:0
        stop.date=new Date(Date.parse(`${baseDate}T00:00:00Z`)+rollover).toISOString().slice(0,10)
        if(rollover)stop.note=`跨午夜：${stop.date} ${stop.time}。${stop.note}`
      }
      const officialOpening=verifiedOpeningForDate(intent.destination,stop.name,stop.date)
      if(officialOpening)stop.opening=officialOpening
      stops.push(stop)
      previous = stop
      cursor = addMinutes(stop.time, stop.durationMinutes)
    }

    if (isFirst && (intent.arrivalTime || intent.arrivalLocation)) {
      const arrivalName = intent.arrivalLocation ?? `${intent.destination}到达点（待确认）`
      addStop(makeStop({
        id: `${intent.destination}-arrival`, time: intent.arrivalTime ?? '09:30', name: arrivalName, type: '到达', stay: '30min', budget: 0,
        transport: '前往住宿点，交通时间待核验', note: '把到达作为当天固定锚点；如果还未买票，请在出发前补充车站或机场。',
        durationMinutes: 30, travelFromPreviousMinutes: 0, zone: `${intent.destination}到达`, mode: 'train', fixed: true,
        factState: intent.arrivalLocation ? 'estimated' : 'estimated', factSource: intent.arrivalLocation ? '用户输入的到达锚点' : '城市中心占位锚点',
      }))
    } else if (!isFirst && intent.nights > 0) {
      const outingStart = cursor
      const hotelStart = Math.min(timeToMinutes(cursor), intent.preferences.includes('晚起') ? 9*60+45 : 7*60+30)
      addStop(makeStop({
        id: `${intent.destination}-hotel-day-${dayNumber}`, time: addMinutes('00:00', hotelStart), name: selectedHotel.name, type: '住宿', stay: '15min', budget: midpoint(selectedHotel.nightly), hotelOptionId: selectedHotel.id,
        transport: '从住宿点出发', note: '在酒店洗漱、整理随身物品，准备出发；先去吃早餐，再按当天路线游览。',
        durationMinutes: 15, travelFromPreviousMinutes: 0, zone: selectedHotel.area, mode: 'walk', fixed: true,
        factState: selectedHotel.verified ? 'verified' : 'estimated', factSource: `${selectedHotel.source.label}（价格和房态按当天公开信息为准）`,
      }))
      cursor = addMinutes(outingStart, 15)
    }

    if (isFirst && intent.nights > 0) {
      addStop(makeStop({
        id: `${intent.destination}-hotel-check-in`, time: addMinutes(cursor, 25), name: selectedHotel.name, type: '住宿', stay: '30min', budget: midpoint(selectedHotel.nightly), hotelOptionId: selectedHotel.id,
        transport: '步行 / 地铁约 20 分钟', note: `${selectedHotel.summary} ${intent.nights > 0 ? `连续 ${intent.nights} 晚参考价 ¥${midpoint(selectedHotel.nightly) * intent.nights}，实际以酒店当天公开信息为准。` : ''}`,
        durationMinutes: 30, travelFromPreviousMinutes: 25, zone: selectedHotel.area, mode: 'metro', fixed: true,
        factState: selectedHotel.verified ? 'verified' : 'estimated', factSource: `${selectedHotel.source.label}（价格和房态按当天公开信息为准）`,
      }))
    }

    const requiredItems = dayItems.filter((item) => intent.mustVisit.some((term) => knowledgeRequirementMatches(item, term)))
    const preferredItems = dayItems.filter((item) => !requiredItems.includes(item)
      && intent.preferences.some((term) => knowledgeMatches(item, [term])))
    const mealItems = dayItems.filter((item) => itemIsMeal(item) && !requiredItems.includes(item) && !preferredItems.includes(item))
    const requiredOrders = requiredItems.map((item) => getCityRouteZone(intent.destination, item.name, item.area).order)
    const alignedDayItems = requiredOrders.length === 0
      ? dayItems
      : dayItems.filter((item) => {
        const order = getCityRouteZone(intent.destination, item.name, item.area).order
        return order >= Math.min(...requiredOrders) && order <= Math.max(...requiredOrders)
      })
    const alignedPreferredItems = preferredItems.filter((item) => alignedDayItems.includes(item))
    const alignedMealItems = mealItems.filter((item) => alignedDayItems.includes(item))
    const selectedItems: CityKnowledgeItem[] = []
    const selectedMealKeys = new Set<string>()
    const hasRequiredMeal = intent.mustVisit.some((term) => items.some((item) => itemIsMeal(item) && knowledgeRequirementMatches(item, term)))
    let optionalMealAdded = false
    ;[...requiredItems, ...alignedPreferredItems, ...alignedMealItems, ...alignedDayItems].forEach((item) => {
      if (selectedItems.includes(item)) return
      if (itemIsMeal(item)) {
        const key = mealIdentity(item)
        if (selectedMealKeys.has(key)) return
        if (!requiredItems.includes(item)) {
          if (hasRequiredMeal || optionalMealAdded) return
          optionalMealAdded = true
        }
        selectedMealKeys.add(key)
      }
      selectedItems.push(item)
    })
    const itemsForDay = keepMealWithinItemLimit(selectedItems, requiredItems, itemLimit)
    const orderedItems = [...itemsForDay].sort((left, right) => {
      const leftZone = getCityRouteZone(intent.destination, left.name, left.area)
      const rightZone = getCityRouteZone(intent.destination, right.name, right.area)
      const leftRequired = intent.mustVisit.some((term) => knowledgeRequirementMatches(left, term)) ? 1 : 0
      const rightRequired = intent.mustVisit.some((term) => knowledgeRequirementMatches(right, term)) ? 1 : 0
      const leftMeal = itemIsMeal(left)
      const rightMeal = itemIsMeal(right)
      const leftNight = scheduleItemRank(left) === 4
      const rightNight = scheduleItemRank(right) === 4
      const mealBeforeNight = leftMeal && rightNight ? -1 : leftNight && rightMeal ? 1 : 0
      return leftZone.order - rightZone.order || Number(leftNight) - Number(rightNight) || mealBeforeNight || rightRequired - leftRequired || scheduleItemRank(left) - scheduleItemRank(right)
    })
    orderedItems.forEach((item, itemIndex) => {
      if (item.tags.includes('早餐专用')) return
      if(isBreakfastItem(item)&&!intent.mustVisit.some(term=>knowledgeRequirementMatches(item,term)))return
      const coreLimit = experienceCoreLimit(intent, density, dayIndex)
      const isCore = (candidate: CityKnowledgeItem) => !itemIsMeal(candidate) && candidate.durationMinutes >= 60
      const scheduledCoreCount = stops.filter(stop => !stop.fixed && !plannedStopIsMeal(stop) && stop.type !== '休息' && stop.durationMinutes >= 60).length
      if (isCore(item) && scheduledCoreCount >= coreLimit && !intent.mustVisit.includes(item.name)) return
      const travel = previous && previous.zone === item.area ? 10 : previous ? 25 : 0
      const mode: TravelMode = travel <= 12 ? 'walk' : 'metro'
      let time = addMinutes(cursor, travel)
      if(/晨练|晨走|早走|早市/.test(item.name)&&timeToMinutes(time)>11*60&&!intent.mustVisit.includes(item.name))return
      const type = item.category === 'restaurant' ? (timeToMinutes(time) < 16 * 60 ? '午餐' : '晚餐') : knowledgeItemType(item)
      const mealFloor = /午餐/.test(type) ? '12:00' : /晚餐/.test(type) ? (isLast && intent.departureTime ? '16:00' : '18:00') : null
      if (mealFloor && timeToMinutes(time) < timeToMinutes(mealFloor)) time = mealFloor
      if (type === '夜景' && !isLast && timeToMinutes(time) < timeToMinutes('18:00')) time = '18:00'
      if (item.opening && timeToMinutes(time) < timeToMinutes(item.opening.from)) time = item.opening.from
      if (type === '午餐' && timeToMinutes(time) > 14*60+30 || type === '晚餐' && timeToMinutes(time) > 20*60+30) return
      const latestEnd = Math.min(isLast && intent.departureTime ? timeToMinutes(intent.departureTime) - 90 : 22 * 60, intent.availableMinutes ? timeToMinutes(intent.arrivalTime ?? '09:30') + intent.availableMinutes - 90 : 24*60)
      // No opening evidence and no night-time activity label: use a conservative daytime planning window.
      const nightActivity = /夜景|夜逛|夜游|夜市|灯光/.test(`${item.name} ${item.tags.join(' ')}`)
      if (item.source.label.startsWith('地图检索：') && (intent.pace === 'relaxed' || intent.lowMobility) && !itemIsMeal(item) && !nightActivity && !item.opening && timeToMinutes(time) + item.durationMinutes > 18 * 60) return
      const remainingRequired = orderedItems.slice(itemIndex + 1).filter(candidate => intent.mustVisit.includes(candidate.name))
      const reservedMinutes = remainingRequired.reduce((sum, candidate) => sum + candidate.durationMinutes + 25, 0)
      if (!intent.mustVisit.includes(item.name) && timeToMinutes(time) + item.durationMinutes + reservedMinutes > latestEnd) return
      if (timeToMinutes(time) + item.durationMinutes > latestEnd) return
      if(intent.lowMobility && stops.filter(stop=>!stop.fixed && stop.type!=='休息').length>=2 && !stops.some(stop=>stop.type==='休息') && previous) {
        addStop({...previous,id:`${previous.id}-rest`,time:cursor,type:'休息',stay:'20min',durationMinutes:20,travelFromPreviousMinutes:0,budget:0,priceState:'unknown',fixed:false,note:'计划在当前地点附近休息20分钟；座位、卫生间和无障碍设施待现场确认。'})
        time=addMinutes(cursor,travel)
      }
      const stop = { ...knowledgeItemToStop(item, intent.destination, time, travel, mode, dietary), type }
      addStop(stop)
    })

    if (isLast && (intent.departureTime || intent.departureLocation)) {
      const returnTime = intent.departureTime ? addMinutes(intent.departureTime,-60) : '19:00'
      const travel = previous ? 30 : 0
      const time = returnTime
      addStop(makeStop({
        id: `${intent.destination}-return`, time, name: intent.departureLocation ?? `${intent.destination}返程点（待确认）`, type: '返程', stay: '1h', budget: 0,
        transport: intent.departureTime ? `${intent.departureTime} 出发` : '暂按晚间返程预留，可修改', note: intent.departureTime ? '提前到站，留出安检、取票和临时改签的空间。' : '未提供车次，暂按晚间返程预留准备时间；这是可调整的规划时间。确认车站、机场与班次后再核对出发时间。',
        durationMinutes: 60, travelFromPreviousMinutes: travel, zone: `${intent.destination}返程`, mode: 'train', fixed: true,
        factState: intent.departureLocation ? 'estimated' : 'estimated', factSource: intent.departureLocation ? '用户输入的返程锚点' : '返程占位锚点',
      }))
    }
    days[`Day ${dayNumber}`] = stops
  })
  // A venue outside its known service window must not prevent the morning meal from being inserted.
  for(const [day,stops] of Object.entries(days)) days[day]=stops.map(stop=>{
    if(!plannedStopIsMeal(stop)||stop.fixed||!stop.opening)return stop
    const end=timeToMinutes(stop.time)+stop.durationMinutes
    if(timeToMinutes(stop.time)>=timeToMinutes(stop.opening.from)&&end<=timeToMinutes(stop.opening.to))return stop
    return makeStop({id:stop.id,name:`${day} ${stop.type}餐厅待选`,type:stop.type,time:stop.time,stay:stop.stay,durationMinutes:stop.durationMinutes,date:stop.date,
      travelFromPreviousMinutes:stop.travelFromPreviousMinutes,mode:stop.mode,zone:stop.zone,area:stop.area,budget:0,priceState:'unknown',pendingVenue:true,
      factState:'estimated',factSource:'原门店不在已知营业窗口，保留用餐时间等待确认',transport:stop.transport,note:'在当前片区选择营业中的另一家餐厅；门店和价格待确认。'})
  })
  addMissingMeals(days, items, intent)
  addDailyRest(days, intent)
  if(density==='easy')for(const stops of Object.values(days))for(const period of DAILY_VISITS){
    const visits=stops.filter(stop=>!stop.fixed&&!plannedStopIsMeal(stop)&&stop.type!=='休息'
      &&timeToMinutes(stop.time)<period.end&&timeToMinutes(stop.time)+stop.durationMinutes>period.start)
    for(const optional of [...visits].reverse()){
      if(visits.filter(stop=>stops.includes(stop)).length<=1)break
      if(!intent.mustVisit.some(term=>matchesMustVisit(optional,term)))stops.splice(stops.indexOf(optional),1)
    }
  }
  addMissingVisitPeriods(days,items,intent,density)
  // Rich variants add a genuine, nearby short evening walk, not a renamed
  // second visit to the same attraction. It remains optional in the itinerary.
  if(!intent.lowMobility) {
    const visitName=(name:string)=>name.replace(/(?:慢看|看展|早走|晨走|逛吃|散步|夜逛|慢走|拍照|观景|看日落)$/,'')
    const used=new Set(Object.values(days).flat().map(s=>visitName(s.name)))
    for(const [day,stops] of Object.entries(days)) {
      const last=stops.at(-1),anchor=[...stops].reverse().find(s=>!s.fixed&&!plannedStopIsMeal(s)&&s.type!=='休息')
      if(!last||!anchor||last.type==='返程')continue
      const time=addMinutes(last.time,last.durationMinutes+25)
      if(timeToMinutes(time)+45>intentEnd(intent) || (intent.availableMinutes && stops.reduce((sum,stop)=>sum+stop.durationMinutes+stop.travelFromPreviousMinutes,0)+70>intent.availableMinutes) || stops.some(stop=>/夜游|夜逛/.test(stop.type)))continue
      const candidate=items.find(item=>supportsEvening(item)&&!used.has(visitName(item.name))
        && getCityRouteZone(intent.destination,item.name,item.area).name===anchor.zone
        && (!item.opening||(timeToMinutes(time)>=timeToMinutes(item.opening.from)&&timeToMinutes(time)+45<=timeToMinutes(item.opening.to))))
      if(candidate){const stop=knowledgeItemToStop(candidate,intent.destination,time,25,'walk',intent.dietary)
        stops.push({...stop,id:stop.id+'-evening',date:last.date,durationMinutes:45,stay:'45min',type:'可选夜游',transport:'预留25分钟转场，具体路线用地图确认',note:`可选：晚饭后散步45分钟，走累可直接回酒店。${stop.note}`});used.add(visitName(candidate.name))}
    }
  }
  if (Object.values(days).flat().some(plannedStopIsMeal)) return days

  const mealCandidates = [...items.filter(itemIsMeal)].sort((left, right) => {
    const leftRequired = intent.mustVisit.some((term) => knowledgeRequirementMatches(left, term)) ? 1 : 0
    const rightRequired = intent.mustVisit.some((term) => knowledgeRequirementMatches(right, term)) ? 1 : 0
    return rightRequired - leftRequired || Number(right.category === 'restaurant') - Number(left.category === 'restaurant')
  })
  const slots = Object.entries(days).flatMap(([day, stops]) => stops.map((stop, index) => ({ day, stops, stop, index })))
    .filter(({ stop }) => !stop.fixed && !isHotelStop(stop) && !intent.mustVisit.some((term) => matchesMustVisit(stop, term)))
  if (mealCandidates.length === 0 || slots.length === 0) return days

  const mealSlot = mealCandidates.flatMap((candidate) => slots.map((slot) => {
    const candidateZone = getCityRouteZone(intent.destination, candidate.name, candidate.area)
    const slotZone = getCityRouteZone(intent.destination, slot.stop.name, slot.stop.area ?? slot.stop.zone)
    return { candidate, slot, distance: Math.abs(slotZone.order - candidateZone.order) }
  })).filter((option) => option.distance === 0).sort((left, right) => left.distance - right.distance
    || Number(intent.mustVisit.some((term) => knowledgeRequirementMatches(right.candidate, term))) - Number(intent.mustVisit.some((term) => knowledgeRequirementMatches(left.candidate, term)))
    || Number(right.candidate.category === 'restaurant') - Number(left.candidate.category === 'restaurant')
    || Number(left.slot.day.replace(/\D/g, '')) - Number(right.slot.day.replace(/\D/g, ''))
    || left.slot.index - right.slot.index)[0]
  if (!mealSlot) return days

  const { candidate: meal, slot } = mealSlot
  const replacement = knowledgeItemToStop(meal, intent.destination, slot.stop.time, slot.stop.travelFromPreviousMinutes, slot.stop.mode, dietary)
  const replacementStop = meal.category === 'restaurant'
    ? { ...replacement, type: timeToMinutes(slot.stop.time) < 16 * 60 ? '午餐' : '晚餐' }
    : replacement
  return {
    ...days,
    [slot.day]: slot.stops.map((stop, index) => index === slot.index ? replacementStop : stop),
  }
}

function normalizeMealVenue(name: string) {
  return name.split('｜')[0].replace(/[（(][^）)]*(?:片区|附近|店)[）)]/g, '').replace(/[（）()·/—\-\s]/g, '').toLowerCase()
}
function mealVenueName(item: Pick<PlannedStop, 'name' | 'canonicalName'>) {
  return normalizeMealVenue(item.canonicalName ?? item.name)
}

function mealTransfer(city: string, from: { name: string; area?: string; fixed?: boolean }, to: { name: string; area?: string; fixed?: boolean }) {
  if (from.fixed || to.fixed) return 30
  const a = getCityRouteZone(city, from.name, from.area ?? '')
  const b = getCityRouteZone(city, to.name, to.area ?? '')
  return a.name === b.name ? 25 : 35 + Math.abs(a.order - b.order) * 15
}

function isBreakfastItem(item: CityKnowledgeItem) {
  return supportsMeal(item,'早餐')
}

/** Fill unused morning/afternoon/evening time without moving a booked anchor,
 * shortening an existing visit, repeating a place, or taking away meal/rest time. */
function addMissingVisitPeriods(days:Record<string,PlannedStop[]>,items:CityKnowledgeItem[],intent:TripIntent,density:'easy'|'match'|'rich') {
  const used=new Set(Object.values(days).flat().map(stop=>agendaVenueKey({name:stop.canonicalName??stop.name})))
  const periods=[DAILY_VISITS[2],DAILY_VISITS[1],DAILY_VISITS[0],...(density==='rich'?[DAILY_VISITS[1],DAILY_VISITS[0]]:[])]
  for(const [day,stops] of Object.entries(days))for(const period of periods){
    if(period.type==='晚间'&&intent.lowMobility)continue
    if(stops.filter(stop=>!stop.fixed&&!plannedStopIsMeal(stop)&&stop.type!=='休息'&&timeToMinutes(stop.time)<period.end&&timeToMinutes(stop.time)+stop.durationMinutes>period.start).length>=(density==='rich'&&period.type!=='晚间'?2:1))continue
    const dayIndex=Object.keys(days).indexOf(day)
    const coreCount=stops.filter(stop=>!stop.fixed&&!plannedStopIsMeal(stop)&&stop.type!=='休息'&&stop.durationMinutes>=60).length
    const candidates=items.filter(item=>!itemIsMeal(item)&&!used.has(agendaVenueKey(item))&&supportsVisitPeriod(item,period.type)
      &&(item.durationMinutes<60||coreCount<experienceCoreLimit(intent,density,dayIndex)))
    let chosen:{stop:PlannedStop,index:number,cost:number,outgoing:number}|undefined
    for(let index=0;index<=stops.length;index++){
      const before=stops[index-1],after=stops[index]
      if(before?.type==='返程'||after?.type==='到达'||after?.fixed&&index===0)continue
      for(const candidate of candidates){
        const incoming=before?mealTransfer(intent.destination,before,candidate):0
        const outgoing=after?Math.max(after.travelFromPreviousMinutes,mealTransfer(intent.destination,candidate,after)):0
        if(Math.max(incoming,outgoing)>(intent.lowMobility?35:50))continue
        const beforeVisit=[...stops.slice(0,index)].reverse().find(stop=>!stop.fixed&&!plannedStopIsMeal(stop)&&stop.type!=='休息')
        const afterVisit=stops.slice(index).find(stop=>!stop.fixed&&!plannedStopIsMeal(stop)&&stop.type!=='休息')
        const order=getCityRouteZone(intent.destination,candidate.name,candidate.area).order
        if(beforeVisit&&order<getCityRouteZone(intent.destination,beforeVisit.name,beforeVisit.area??beforeVisit.zone).order)continue
        if(afterVisit&&order>getCityRouteZone(intent.destination,afterVisit.name,afterVisit.area??afterVisit.zone).order)continue
        const date=before?.date??after?.date
        const opening=verifiedOpeningForDate(intent.destination,candidate.name,date)??candidate.opening
        const start=Math.max(period.start,before?timeToMinutes(before.time)+before.durationMinutes+incoming:period.start,opening?timeToMinutes(opening.from):0)
        const end=Math.min(period.end,after?timeToMinutes(after.time)-outgoing:period.end,opening?timeToMinutes(opening.to):period.end,intentEnd(intent))
        if(start+candidate.durationMinutes>end)continue
        // Fixed arrival/return preparation and both transfers consume the same
        // half-day allowance, even when the return ticket is later that evening.
        if(intent.availableMinutes && stops.reduce((sum,stop)=>sum+stop.durationMinutes+stop.travelFromPreviousMinutes,0)
          +candidate.durationMinutes+incoming+outgoing-(after?.travelFromPreviousMinutes??0)>intent.availableMinutes)continue
        const stop={...knowledgeItemToStop(candidate,intent.destination,addMinutes('00:00',start),incoming,'metro',intent.dietary),
          id:`${candidate.id}-${day}-${period.type}`,date,opening,type:period.type==='晚间'?'可选夜游':knowledgeItemType(candidate),
          transport:incoming?`规划预留${incoming}分钟转场，实际路线请查看地图`:'当天起点'}
        const cost=incoming+outgoing+Math.abs(start-period.start)/30
        if(!chosen||cost<chosen.cost)chosen={stop,index,cost,outgoing}
      }
    }
    if(chosen){
      const after=stops[chosen.index]
      if(after&&!after.fixed){after.travelFromPreviousMinutes=chosen.outgoing;after.transport=`规划预留${chosen.outgoing}分钟转场，实际路线请查看地图`}
      stops.splice(chosen.index,0,chosen.stop);used.add(agendaVenueKey({name:chosen.stop.name}))
    }
  }
}

function fitsMeal(item: CityKnowledgeItem, meal: string) {
  return meal === '早餐' ? isBreakfastItem(item) : !item.tags.includes('早餐专用')
}

function addMissingMeals(days:Record<string,PlannedStop[]>, items:CityKnowledgeItem[], intent:TripIntent) {
  // Snack-only shops stay snack stops; they cannot silently stand in for lunch.
  const restaurants=items.filter(item=>item.category==='restaurant' && isConcreteKnowledgeItem(item) && fitsMeal(item,'午餐'))
  const breakfastItems=items.filter(isBreakfastItem)
  for(const [day,original] of Object.entries(days)) {
    for(const [meal,floor,ceiling] of [['早餐',7*60,11*60],['午餐',12*60,14*60+30],['晚餐',18*60,20*60+30]] as const) {
      if(days[day].some(stop=>stop.type===meal))continue
      const lastDay=day===Object.keys(days).at(-1)
      const mealFloor=meal!=='早餐'&&lastDay&&intent.departureTime?(meal==='晚餐'?16*60:11*60):floor
      const latest=Math.min(lastDay&&intent.departureTime?timeToMinutes(intent.departureTime)-90:22*60, intent.availableMinutes ? timeToMinutes(intent.arrivalTime??'09:30')+intent.availableMinutes-90 : 24*60)
      if(latest<mealFloor || (original[0] && timeToMinutes(original[0].time)>ceiling))continue
      const allMeals=Object.values(days).flat().filter(plannedStopIsMeal)
      const visits=(item:CityKnowledgeItem)=>allMeals.filter(stop=>mealVenueName(stop)===mealIdentity(item)).length
      const unusedBreakfasts=breakfastItems.filter(item=>visits(item)===0).length
      const breakfastDays=Object.values(days).filter(stops=>!stops.some(stop=>stop.type==='早餐')&&stops[0]
        &&timeToMinutes(stops[0].time)+stops[0].durationMinutes+25<=11*60).length
      const candidates=[...(meal==='早餐'?breakfastItems:restaurants)].filter(item=>visits(item)===0
        &&(meal==='早餐'||!isBreakfastItem(item)||unusedBreakfasts>breakfastDays))
        .sort((a,b)=>visits(a)-visits(b)||midpoint(a.price)-midpoint(b.price))
      let best: { stops: PlannedStop[]; cost: number } | undefined
      for(const candidate of [...candidates, undefined]) {
        const current=days[day]
        // A day always starts at its accommodation/arrival anchor.
        for(let index=1;index<=current.length;index++) {
          const before=current[index-1],after=current[index]
          if(before?.type==='返程')continue
          const areaAnchor=!before ? after : before.fixed&&after&&!after.fixed ? after : before
          const pendingArea=`${areaAnchor.name}附近 · ${areaAnchor.area??areaAnchor.zone}`
          const incoming=!before ? 0 : candidate?mealTransfer(intent.destination,before,candidate):25
          const outgoing=candidate&&after?mealTransfer(intent.destination,candidate,after):25
          // In a short relaxed itinerary, a distant known restaurant is not a
          // better match than keeping the meal in the current sightseeing area.
          if(candidate && intent.durationDays<=3 && (intent.pace==='relaxed'||intent.lowMobility) && Math.max(incoming,outgoing)>(intent.lowMobility?35:50))continue
          const start=Math.max(mealFloor,before ? timeToMinutes(before.time)+before.durationMinutes+incoming : 8*60)
          const mealDuration=meal==='早餐'?35:(candidate?.durationMinutes??60)
          if(start>ceiling || start+mealDuration>latest)continue
          const stop: PlannedStop=candidate
            ? {...knowledgeItemToStop(candidate,intent.destination,addMinutes('00:00',start),incoming,'metro',intent.dietary),id:`${candidate.id}-${day}-${meal}`,type:meal,date:before?.date??after?.date,transport:`转场预留${incoming}分钟，实际路线请查看地图`}
            : {id:`${day}-${meal}-pending`,name:`${day} ${meal}餐厅待选`,time:addMinutes('00:00',start),type:meal,stay:'1h',durationMinutes:60,travelFromPreviousMinutes:25,mode:'walk',zone:pendingArea,area:pendingArea,budget:0,priceState:'unknown',pendingVenue:true,factState:'estimated',factSource:'排程预留用餐时间，尚无匹配餐厅证据',date:before?.date??after?.date,transport:'预留25分钟寻找附近餐厅，实际路线待确认',note:`在${pendingArea}附近选择${intent.indoorOnly?'室内':''}餐厅；地址、营业、${intent.dietary.allergies.length?'过敏原与交叉接触、':''}价格待确认。当前金额未计入总预算，不是免费。`}
          if(meal==='早餐'){stop.durationMinutes=mealDuration;stop.stay='35min';stop.note=`早餐安排。${stop.note}`}
          if (candidate && visits(candidate)>0) stop.note += ' 本次行程再次安排这家店，可按菜单换一种口味。'
          let trial=[...current.slice(0,index),stop,...current.slice(index)].map(item=>({...item}))
          if(candidate&&after){trial[index+1].travelFromPreviousMinutes=Math.max(after.travelFromPreviousMinutes,outgoing);trial[index+1].transport=`转场预留${trial[index+1].travelFromPreviousMinutes}分钟，实际路线请查看地图`}
          const originalTimes=new Map(trial.map(item=>[item.id,item.time]))
          const reschedule=()=>{
            trial.forEach(item=>{item.time=originalTimes.get(item.id)!})
            for(let i=1;i<trial.length;i++) {
              const earliest=timeToMinutes(trial[i-1].time)+trial[i-1].durationMinutes+trial[i].travelFromPreviousMinutes
              const generatedHotel=meal==='早餐' && /-hotel-check-in$/.test(trial[i].id) // Arrival-day breakfast may precede luggage drop-off; morning departures may not.
              if((!trial[i].fixed || generatedHotel || trial[i].type==='返程'&&!intent.departureTime) && timeToMinutes(trial[i].time)<earliest)trial[i].time=`${String(Math.floor(earliest/60)).padStart(2,'0')}:${String(earliest%60).padStart(2,'0')}`
            }
          }
          reschedule()
          // A necessary meal can replace an optional activity, but never a booked or requested stop.
          const removable=trial.filter(item=>item.id!==stop.id && !item.fixed && item.type!=='休息' && !plannedStopIsMeal(item) && !intent.mustVisit.some(term=>matchesMustVisit(item,term))).reverse()
          const valid=()=>{
            const check=validatePlan({days:{[day]:trial},intent,budget:0,budgetLimit:null,dates:intent.dates})
            return check.checks.filter(item=>['时间顺序','营业时间','餐期'].includes(item.name)).every(item=>item.passed)
              &&(!intent.availableMinutes||trial.reduce((sum,item)=>sum+item.durationMinutes+item.travelFromPreviousMinutes,0)<=intent.availableMinutes)
              &&trial.every(item=>timeToMinutes(item.time)<1440&&(item.fixed||timeToMinutes(item.time)+item.durationMinutes<=latest))
          }
          while(!valid()&&removable.length){
            const remove=removable.shift()!
            // Arrival mornings can be too short; full sightseeing days must keep an experience.
            if((meal !== '早餐' || day !== Object.keys(days)[0] || intent.durationDays >= 5) && trial.filter(item=>!item.fixed&&!plannedStopIsMeal(item)&&item.type!=='休息').length<=1)break
            trial=trial.filter(item=>item.id!==remove.id);reschedule()
          }
          if(valid()) {
            const removed=current.filter(item=>!trial.some(next=>next.id===item.id)).length
            const sameDay=candidate?current.filter(item=>mealVenueName(item)===mealIdentity(candidate)).length:0
            // A requested signature dish is satisfied by one visit, not by sending
            // the traveler to every branch that serves the same dish.
            const repeatsRequestedDish=candidate&&intent.mustVisit.some(term=>candidate.menuHighlights?.includes(term)&&allMeals.some(item=>matchesMustVisit(item,term)))
            // Prefer a meal gap that preserves the planned experience times, rather
            // than pushing an afternoon visit to night just because costs tie.
            const shiftedMinutes=current.reduce((sum,item)=>{
              const next=trial.find(value=>value.id===item.id)
              return sum+(next?Math.max(0,timeToMinutes(next.time)-timeToMinutes(item.time)):0)
            },0)
            // A real meal is part of the itinerary, not an optional extra. Prefer
            // a feasible named venue over preserving every optional visit. Fixed
            // bookings, requested sights, dietary rules and time windows still win.
            const cost=removed*2000+shiftedMinutes/10+(candidate?visits(candidate)*5+sameDay*50+(repeatsRequestedDish?400:0)+(incoming+outgoing)/5:100000)
            if(!best || cost<best.cost)best={stops:trial,cost}
          }
        }
      }
      if ((!best || best.stops.some(stop => stop.type === '午餐' && stop.pendingVenue)) && meal === '午餐') {
        const current = days[day]
        const longIndex = current.findIndex(stop => !stop.fixed && !plannedStopIsMeal(stop) && stop.durationMinutes >= 300
          && timeToMinutes(stop.time) < 12 * 60 + 30 && timeToMinutes(stop.time) + stop.durationMinutes > 14 * 60)
        if (longIndex >= 0) {
          const activity = current[longIndex]
          const lunchStart = 12 * 60 + 30
          const morningMinutes = lunchStart - timeToMinutes(activity.time)
          const lunchMinutes = 45
          const afternoonMinutes = activity.durationMinutes - morningMinutes - lunchMinutes
          if (morningMinutes >= 90 && afternoonMinutes >= 90) {
            const morning = { ...activity, durationMinutes: morningMinutes, stay: `${Math.floor(morningMinutes / 60)}h${morningMinutes % 60 ? `${morningMinutes % 60}min` : ''}` }
            const pendingArea = `${activity.name}内或入口附近 · ${activity.area ?? activity.zone}`
            const lunch = makeStop({
              id: `${day}-long-activity-lunch`, name: `${day} 午餐餐厅待选`, time: addMinutes('00:00', lunchStart), type: '午餐', stay: '45min',
              durationMinutes: lunchMinutes, travelFromPreviousMinutes: 0, mode: 'walk', zone: pendingArea, area: pendingArea,
              budget: 0, priceState: 'unknown', pendingVenue: true, factState: 'estimated', factSource: '长时游览中的正式午餐时间，尚无匹配餐厅证据',
              date: activity.date, transport: '在当前长时游览地点内或入口附近步行寻找餐厅，实际路线请查看地图',
              note: `长时游览中保留45分钟正式午餐；在${pendingArea}选择餐厅。地址、营业、价格和能否中途离场待确认，当前金额未计入总预算，不是免费。`,
            })
            const afternoon = { ...activity, id: `${activity.id}-after-lunch`, name: `${activity.name}｜午餐后继续`, time: addMinutes(lunch.time, lunchMinutes),
              durationMinutes: afternoonMinutes, stay: `${Math.floor(afternoonMinutes / 60)}h${afternoonMinutes % 60 ? `${afternoonMinutes % 60}min` : ''}`,
              travelFromPreviousMinutes: 0, transport: '午餐后在同一游览区域继续，实际步行路线请查看地图' }
            days[day] = [...current.slice(0, longIndex), morning, lunch, afternoon, ...current.slice(longIndex + 1)]
            continue
          }
        }
      }
      if(best)days[day]=best.stops
    }
  }
}

function addDailyRest(days: Record<string,PlannedStop[]>, intent: TripIntent) {
  if(!intent.lowMobility)return
  for(const [day,stops] of Object.entries(days)) {
    if(stops.some(stop=>stop.type==='休息'))continue
    for(let i=0;i<stops.length;i++) {
      const before=stops[i],after=stops[i+1]
      if(before.type==='返程' || before.type==='到达')continue
      const start=timeToMinutes(before.time)+before.durationMinutes
      const end=after?timeToMinutes(after.time)-after.travelFromPreviousMinutes:22*60
      if(start+20>end)continue
      const rest:PlannedStop={...before,id:`${day}-rest`,name:`${before.name}附近休息`,time:addMinutes(before.time,before.durationMinutes),type:'休息',stay:'20min',durationMinutes:20,travelFromPreviousMinutes:0,budget:0,priceState:'unknown',fixed:false,pendingVenue:true,opening:undefined,transport:'原地休息，具体座位待确认',factState:'estimated',factSource:'按用户体力要求预留休息',note:'预留20分钟休息；具体座位、卫生间和无障碍设施待确认。'}
      days[day]=[...stops.slice(0,i+1),rest,...stops.slice(i+1)]
      break
    }
  }
}

function knowledgeBudget(days: Record<string, PlannedStop[]>, intent: TripIntent, selectedHotel: HotelOption, density: 'easy' | 'match' | 'rich'): Omit<BudgetBreakdown, 'total'> {
  const allStops = Object.values(days).flat()
  const lodging = midpoint(selectedHotel.nightly) * intent.nights * (intent.roomCount ?? Math.ceil(intent.partySize / 2))
  const coffee = allStops.filter((stop) => stop.type.includes('咖啡')).reduce((sum, stop) => sum + stop.budget, 0) * intent.partySize
  const meals = allStops.filter((stop) => /早餐|午餐|晚餐|小吃/.test(stop.type)).reduce((sum, stop) => sum + stop.budget, 0) * intent.partySize
  const tickets = allStops.filter((stop) => /景点|展览|园林/.test(stop.type)).reduce((sum, stop) => sum + stop.budget, 0) * intent.partySize
  const transport = intent.indoorOnly ? allStops.filter(stop => stop.travelFromPreviousMinutes > 0).length * 35 * Math.ceil(intent.partySize / 4) : Math.max(80, Object.keys(days).length * (density === 'rich' ? 80 : density === 'easy' ? 50 : 65))
  const buffer = density === 'rich' ? 320 : density === 'easy' ? 180 : 240
  return { lodging, meals, transport, tickets, coffee, buffer }
}

const countVisiblePlaces = (days: Record<string, PlannedStop[]>) => tripCounts(days).places

const breakdown = (values: Omit<BudgetBreakdown, 'total'>): BudgetBreakdown => ({ ...values, total: Object.values(values).reduce((sum, value) => sum + value, 0) })

function matchesMustVisit(stop: PlannedStop, requirement: string) {
  if (requirement === '展览') return stop.type.includes('展') || /美术馆|博物馆/.test(stop.name)
  const menu = stop.note.match(/可点：([^\s]+)/)?.[1]?.split('、') ?? []
  return stop.name.includes(requirement) || stop.type.includes(requirement) || Boolean(stop.searchKeyword?.includes(requirement)) || menu.includes(requirement)
}

export function validatePlan(plan: Pick<GeneratedPlan, 'days' | 'intent' | 'budget' | 'budgetLimit' | 'dates'>): ValidationReport {
  const checks: ValidationCheck[] = []
  const issues: string[] = []
  let scheduleValid = true
  let openingValid = true
  let dietaryValid = true
  let mealsValid = true
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
      if (stop.type==='早餐' && (start<6*60 || start>11*60) || stop.type==='午餐' && (start<11*60 || start>14*60+30) || stop.type==='晚餐' && (start<16*60 || start>20*60+30)) {
        mealsValid=false
        issues.push(`${day}：${stop.name}的${stop.type}时段不合理，请调整。`)
      }
      if (previous) {
        const previousEnd = timeToMinutes(previous.time) + previous.durationMinutes + stop.travelFromPreviousMinutes
        const dayOffset=stop.date&&previous.date?(Date.parse(stop.date)-Date.parse(previous.date))/60000:0
        if (start + dayOffset < previousEnd) {
          scheduleValid = false
          issues.push(`${day}：${previous.name} 到 ${stop.name} 的时间不够（至少还需要 ${previousEnd - start - dayOffset} 分钟）。`)
        }
      }
      const officialOpening=verifiedOpeningForDate(plan.intent.destination,stop.name,stop.date??dayDate?.toLocaleDateString('en-CA'))
      const opening=officialOpening??stop.opening
      if (stop.factSource?.startsWith('地图检索：') && !opening && (plan.intent.pace === 'relaxed' || plan.intent.lowMobility) && !stop.fixed && !stop.pendingVenue && stop.type !== '休息' && !plannedStopIsMeal(stop) && !/夜景|夜逛|夜游|夜市|灯光/.test(`${stop.name} ${stop.type}`) && end > 18 * 60) {
        openingValid = false
        issues.push(`${day}：${stop.name}缺少夜间开放依据，轻松行程需移至日间或替换。`)
      }
      if (opening) {
        const closed = weekday !== undefined && opening.closedWeekdays?.includes(weekday)
        const withinWindow = start >= timeToMinutes(opening.from) && end <= timeToMinutes(opening.to) && (!officialOpening || start<timeToMinutes(officialOpening.lastAdmission))
        if (closed || !withinWindow) {
          openingValid = false
          issues.push(`${day}：${stop.name} 不在营业时间内。`)
        }
      }
      if (/早餐|午餐|晚餐|本地小吃|餐馆|餐饮/.test(stop.type)) {
        const foodIssues = foodCompatibilityIssues(stop.name, dietary, stop.dietaryTags)
        if (foodIssues.length > 0) {
          dietaryValid = false
          issues.push(`${day}：${stop.name} 与饮食限制冲突（${foodIssues.join('、')}）。`)
        }
      }
    })
  })

  checks.push({ name: '时间顺序', passed: scheduleValid, detail: scheduleValid ? '每段交通和停留均有足够间隔。' : '存在交通或停留时间重叠。' })
  checks.push({ name: '餐期', passed: mealsValid, detail: mealsValid ? '已安排的午餐、晚餐处于对应餐期。' : '存在错过餐期的用餐安排。' })
  checks.push({ name: '营业时间', passed: openingValid, detail: openingValid ? '有营业时间的地点均落在可访问窗口内。' : '至少一个地点超出营业窗口。' })
  checks.push({ name: '饮食匹配', passed: dietaryValid, detail: dietaryValid ? '行程中的餐饮节点没有命中已知忌口或过敏风险。' : '至少一个餐饮节点命中饮食限制，需要替换或人工确认。' })

  const allStops = Object.values(plan.days).flat()
  if (plan.intent.indoorOnly) {
    const knowledge = getCityKnowledge(plan.intent.destination)
    const unconfirmed = allStops.filter(stop => !stop.fixed && !knowledge.items.find(item => item.name === stop.name)?.tags.includes('室内'))
    if (unconfirmed.length) issues.push(`全部室内尚未满足：${unconfirmed.map(stop => stop.name).join('、')}缺少室内场所依据，请替换或确认。`)
    checks.push({ name: '室内约束', passed: unconfirmed.length === 0, detail: unconfirmed.length ? '部分活动或待选餐厅尚未确认室内，不能视为完整室内方案。' : '活动地点均有室内标记；站间交通仍需核对。' })
  }
  if (plan.intent.unavailablePlaces?.length) {
    const unavailable = allStops.filter(stop => plan.intent.unavailablePlaces!.includes(stop.name))
    if (unavailable.length) issues.push(`已明确不可用的地点仍在行程中：${unavailable.map(stop => stop.name).join('、')}。`)
    checks.push({ name: '地点可用性', passed: unavailable.length === 0, detail: unavailable.length ? '需要移除用户已明确无票或不可用的地点。' : '已排除用户明确不可用的地点；不代表其他地点有实时余票。' })
  }
  const requiredValid = plan.intent.mustVisit.every((requirement) => allStops.some((stop) => matchesMustVisit(stop, requirement)))
  if (!requiredValid) issues.push(`缺少必去地点：${plan.intent.mustVisit.filter((requirement) => !allStops.some((stop) => matchesMustVisit(stop, requirement))).join('、')}`)
  checks.push({ name: '必去覆盖', passed: requiredValid, detail: requiredValid ? '用户提出的必去地点均已安排。' : '至少一个必去地点没有被安排。' })

  const closedStops = allStops.filter(stop => isOfficiallyClosed(plan.intent.destination, stop.name, plan.intent.dates))
  if (closedStops.length) issues.push(`官方闭馆期间不能参观：${closedStops.map(stop => stop.name).join('、')}。`)
  checks.push({name: '官方临时闭馆', passed: closedStops.length === 0, detail: closedStops.length ? '请替换闭馆地点。' : '未命中已收录的日期闭馆公告；不代表全部场馆已实时核验。'})
  const budgetValid = plan.budgetLimit === null || plan.budget <= plan.budgetLimit
  if (!budgetValid) issues.push(`预算超出上限 ¥${plan.budget - (plan.budgetLimit ?? 0)}。`)
  checks.push({ name: '预算上限', passed: budgetValid, detail: plan.budgetLimit === null ? `已列费用估算 ¥${plan.budget}，用户预算上限待确认。` : budgetValid ? `已列费用估算 ¥${plan.budget}，在预算 ¥${plan.budgetLimit} 内；未知费用未计入，最终是否超支待确认。` : `计划估算 ¥${plan.budget}，超过预算。` })

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
  hotelRecommendations: HotelOption[],
  selectedHotel: HotelOption,
  guideContext?: GuideContext,
): GeneratedPlan {
  const communityExperienceEvidence = unique((guideContext?.candidates ?? [])
    .flatMap(candidate => candidate.experiences ?? [])
    .map(experience => `${experience.subject}：${experience.summary}`))
    .slice(0, 6)
  const budgetBreakdown = breakdown({
    ...budgetValues,
    lodging: midpoint(selectedHotel.nightly) * intent.nights * (intent.roomCount ?? Math.ceil(intent.partySize / 2)),
  })
  const plan: GeneratedPlan = {
    optionId: crypto.randomUUID(),
    revision: 1,
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
    hotelRecommendations,
    selectedHotelId: selectedHotel.id,
    ...(guideContext && guideContext.candidates.length > 0 ? { guideContext } : {}),
    validation: { passed: false, score: 0, checks: [], issues: [] },
    evidence: [
      `地点为${intent.destination}；最终行程只使用走走知识库中可搜索的具体地点，真实道路由你选择的地图 App 计算。`,
      knowledge.intro,
      ...(guideContext && guideContext.candidates.length > 0
        ? [
            `参考了 ${guideContext.candidates.length} 条公开攻略证据；用于匹配走走知识库中的具体地点和安排顺序。`,
            ...communityExperienceEvidence.map(summary => `攻略经验候选：${summary}；执行前按出行日期复核。`),
          ]
        : []),
      `住宿默认选择：${selectedHotel.name}；按住宿片区、预算和路线匹配。`,
      '交通耗时、餐饮价格和门票为规划参考，不是实时库存或订单。',
      '路线是可编辑规划，时间与预算可按你的安排调整。',
    ],
  }
  return { ...plan, validation: validatePlan(plan) }
}

export function generatePlans(intent: TripIntent, guideContext?: GuideContext, knowledgeOptions?: KnowledgeOptions): GeneratedPlan[] {
  guideContext ??= getLocalGuideContext(intent.destination, [intent.destination, ...intent.mustVisit, ...intent.preferences].join(' '))
  const generationId = crypto.randomUUID()
  const knowledgeBundle = planningKnowledge(intent, knowledgeOptions)
  if(!cityNames.includes(intent.destination))throw new Error('目的地尚未确定或当前城市资料不足，请确认支持的城市；没有使用上海示例替代。')
  const knowledge = knowledgeWithRememberedPlaces(intent.destination)
  if (intent.destination === '南京' && intent.unavailablePlaces?.includes('南京博物院') && !intent.unavailablePlaces.includes('江苏省美术馆') && intent.dates) {
    const date = new Date(`${intent.dates.start}T12:00:00+08:00`)
    if (date.getUTCDay() !== 1) intent = { ...intent, mustVisit: unique([...intent.mustVisit.filter(name => name !== '南京博物院'), '江苏省美术馆']), alternatives: [{ unavailable: '南京博物院', replacement: '江苏省美术馆', sourceUrl: 'https://www.jssmsg.cn/', reason: '散客无需预约，携有效证件；周二至周日开放，16:30停止入馆。团队另需预约，临时公告出发前复核。' }] }
  }
  const hotelRecommendations = getHotelRecommendations(knowledge, intent, guideContext)
  const selectedHotel = (intent.hotel ? hotelRecommendations.find(h=>h.name.includes(intent.hotel!)||h.area.includes(intent.hotel!)) : undefined)
    ?? (intent.budget===null ? hotelRecommendations.find(h=>h.tier==='comfort') : undefined)
    ?? hotelRecommendations[0] ?? selectHotelOption(knowledge, intent.budget, intent.nights)
  const variants: Array<{ id: 'match' | 'easy' | 'rich'; label: string; density: 'easy' | 'match' | 'rich'; walking: string; difference: string }> = [
    { id: 'match', label: '最匹配', density: 'match', walking: '片区优先', difference: '把必去地点、具体餐饮门店和住宿档位放进同一条不绕路的时间轴。' },
    { id: 'easy', label: '最轻松', density: 'easy', walking: '少走动', difference: '每天减少一个非必要停留，保留完整用餐和缓冲时间。' },
    { id: 'rich', label: '体验最丰富', density: 'rich', walking: '体验更多', difference: '增加一段已命名的城市体验，但仍按预算和返程锚点留缓冲。' },
  ]
  const plans = variants.map((variant) => {
    const days = buildKnowledgeDays(intent, knowledge, guideContext, variant.density, selectedHotel)
    if (intent.indoorOnly) Object.values(days).forEach(stops => stops.forEach(stop => {
      if (stop.travelFromPreviousMinutes > 0) { stop.mode = 'taxi'; stop.transport = `雨天点到点打车，规划预留${stop.travelFromPreviousMinutes}分钟；上落客短距离需雨具，实时路况与费用在地图核对。` }
    }))
    const foodGuides = guideContext?.candidates.filter(guide=>guide.city===intent.destination) ?? []
    const foodHints = unique(foodGuides.flatMap(guide=>guide.foodHints??[])).filter(hint=>foodCompatibilityIssues(hint,intent.dietary).length===0)
    let pendingIndex=0
    Object.values(days).flat().filter(stop=>stop.pendingVenue).forEach(stop=>{
      const hints=foodHints.length ? [foodHints[pendingIndex++ % foodHints.length]] : []
      if(hints.length){
        stop.note += ` 当地饮食线索：${hints.join('、')}；这是菜品或店名线索，尚未确认适合此餐次的门店。`
        const guide=foodGuides.find(guide=>guide.foodHints?.includes(hints[0]))
        if(guide)stop.factSource += `；饮食线索来源：${guide.sourceUrl}`
      }
    })
    const budgetValues = knowledgeBudget(days, intent, selectedHotel, variant.density)
    return attachKnowledge({ ...createPlan(variant.id, variant.label, days, intent, variant.walking, variant.difference, budgetValues, knowledge, hotelRecommendations, selectedHotel, guideContext), generationId, plannerContentVersion: PLANNER_CONTENT_VERSION }, knowledgeBundle)
  })
  const visits=(plan:GeneratedPlan)=>Object.values(plan.days).flat().filter(s=>!s.fixed&&!plannedStopIsMeal(s)&&s.type!=='休息')
  const signature=(plan:GeneratedPlan)=>visits(plan).map(s=>s.name).sort().join('|')
  const seenSignatures=new Set<string>()
  for(let i=0;i<plans.length;i++){
    let plan=plans[i]
    if(seenSignatures.has(signature(plan))){
      const used=new Set(visits(plan).map(s=>s.name))
      outer: for(const stop of [...visits(plan)].reverse()){
        if(intent.mustVisit.some(term=>matchesMustVisit(stop,term)))continue
        for(const candidate of buildCityKnowledgeItems(intent,knowledge,guideContext).filter(item=>!itemIsMeal(item)&&!used.has(item.name)&&item.durationMinutes<=stop.durationMinutes
          &&getCityRouteZone(intent.destination,item.name,item.area).name===stop.zone)){
          const replacement=knowledgeItemToStop(candidate,intent.destination,stop.time,stop.travelFromPreviousMinutes,stop.mode,intent.dietary)
          const days=Object.fromEntries(Object.entries(plan.days).map(([day,stops])=>[day,stops.map(s=>s.id===stop.id?{...replacement,date:s.date}:s)]))
          const next=updateGeneratedPlan(plan,days)
          if(!seenSignatures.has(signature(next))&&next.validation.checks.filter(c=>['时间顺序','营业时间','餐期','必去覆盖'].includes(c.name)).every(c=>c.passed)){
            plans[i]=plan={...next,revision:1,previousVersion:undefined};break outer
          }
        }
      }
    }
    seenSignatures.add(signature(plan))
  }
  for(const plan of plans){
    const other=new Set(plans.filter(p=>p!==plan).flatMap(p=>visits(p).map(s=>s.name)))
    const distinctive=visits(plan).filter(s=>!other.has(s.name)).map(s=>s.name).slice(0,3)
    plan.difference=`${visits(plan).length}项游览，${plan.id==='easy'?'减少长时停留，留出自由活动时间':plan.id==='rich'?'增加本地体验与可选夜游':'代表景点与片区游览结合'}。${distinctive.length?`这套独有：${distinctive.join('、')}。`:''}`
  }
  return plans
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

function withCurrentPlaceKnowledge(plan: GeneratedPlan): GeneratedPlan {
  const current=getCityKnowledge(plan.city)
  const items=[...new Map([...plan.knowledge.items,...current.items].map(item=>[item.name,item])).values()]
  return {...plan,knowledge:{...plan.knowledge,items}}
}

/** Publishing is stricter than constructing a draft: never return an unfinished
 * meal slot as a successfully generated travel option. */
export function completePlanOptions(plans: GeneratedPlan[]): GeneratedPlan[] {
  const complete=plans.filter(plan=>{
    const stops=Object.values(plan.days).flat()
    const dayEntries=Object.entries(plan.days)
    const mealsCovered=dayEntries.every(([,day],index)=>{
      if(!day.length)return false
      const first=day[0]
      const start=timeToMinutes(first.time)+(first.fixed?first.durationMinutes+25:0)
      const returning=day.find(stop=>stop.type==='返程')
      const end=Math.min(returning?timeToMinutes(returning.time)-30:22*60,intentEnd(plan.intent))
      const earlyReturn=index===dayEntries.length-1&&Boolean(plan.intent.departureTime)
      const windows:[string,number,number,number][]=[['早餐',7*60,11*60,35],['午餐',earlyReturn?11*60:12*60,14*60+30,60],['晚餐',earlyReturn?16*60:18*60,20*60+30,60]]
      return windows.every(([type,floor,ceiling,duration])=>(type==='晚餐'&&earlyReturn&&timeToMinutes(plan.intent.departureTime!)<19*60)
        ||start>ceiling||Math.max(start,floor)+duration>end||day.some(stop=>stop.type===type&&!stop.pendingVenue))
    })
    const visitsCovered=dayEntries.every(([,day])=>{
      const start=timeToMinutes(day[0]?.time??'23:59')
      const returning=day.find(stop=>stop.type==='返程')
      const end=Math.min(returning?timeToMinutes(returning.time)-30:22*60,intentEnd(plan.intent))
      return DAILY_VISITS.every(period=>start>period.start+30||end<period.end||(period.type==='晚间'&&plan.intent.lowMobility)
        ||day.some(stop=>!stop.fixed&&!plannedStopIsMeal(stop)&&stop.type!=='休息'
          &&timeToMinutes(stop.time)<period.end&&timeToMinutes(stop.time)+stop.durationMinutes>period.start))
    })
    return mealsCovered && visitsCovered && !stops.some(stop=>plannedStopIsMeal(stop)&&stop.pendingVenue)
      && (plan.nights===0 || stops.some(stop=>isHotelStop(stop)&&!/待选|待确认/.test(stop.name)))
  })
  if(!complete.length)throw new Error('这次还没能配齐适合路线的餐厅或全天游览，攻略未生成完成。你的旅行条件已保留，请调整条件或稍后重试。')
  return complete
}

function intentEnd(intent:TripIntent) {
  return intent.availableMinutes?Math.min(22*60,timeToMinutes(intent.arrivalTime??'07:00')+intent.availableMinutes):22*60
}

export function getReplacementCandidates(plan: GeneratedPlan, placeId: string): ReplacementCandidate[] {
  // A saved plan contains a historical knowledge snapshot. Replacement choices
  // must include newly reviewed venues without rewriting the saved itinerary.
  plan = withCurrentPlaceKnowledge(plan)
  const place = Object.values(plan.days).flat().find((item) => item.id === placeId)
  if (!place) return []
  if (isHotelStop(place)) {
    const currentHotelId = place.hotelOptionId ?? plan.selectedHotelId
    const options = getHotelRecommendationsForPlan(plan)
    return [...options.filter((option) => option.id !== currentHotelId && option.name !== place.name), ...options.filter((option) => option.id === currentHotelId || option.name === place.name)]
      .map((option) => ({
        name: option.name,
        meta: hotelOptionMeta(option),
        reason: hotelOptionReason(option),
      }))
  }
  const scheduledNames = new Set(Object.values(plan.days).flat().map(stop => stop.name))
  const requestedDishes = plan.intent.mustVisit.filter(term => plan.knowledge.items.some(item => item.name === place.name && item.menuHighlights?.includes(term)))
  const usedMealVenues = new Set(Object.values(plan.days).flat().filter(stop=>stop.id!==placeId && !stop.pendingVenue && plannedStopIsMeal(stop)).map(mealVenueName))
  const allowed = (name: string) => !scheduledNames.has(name) && !isOfficiallyClosed(plan.city, name, plan.intent.dates) && !plan.intent.unavailablePlaces?.includes(name) && (!plan.intent.indoorOnly || Boolean(plan.knowledge.items.find(item => item.name === name)?.tags.includes('室内')))
  const cityCandidates = plan.knowledge.items.filter(item => fitsRequestedPace(item, plan.intent) && allowed(item.name) && item.name !== place.name && isConcreteKnowledgeItem(item)
    && (plannedStopIsMeal(place) ? itemIsMeal(item) && fitsMeal(item,place.type) && !usedMealVenues.has(mealIdentity(item)) && foodCompatibilityIssues(`${item.name} ${item.summary}`, plan.intent.dietary, item.dietaryTags).length === 0 : !itemIsMeal(item)))
    .sort((left,right)=>Number(requestedDishes.every(dish=>right.menuHighlights?.includes(dish)))-Number(requestedDishes.every(dish=>left.menuHighlights?.includes(dish))) || Number(right.area===place.area)-Number(left.area===place.area) || Math.abs(left.durationMinutes-place.durationMinutes)-Math.abs(right.durationMinutes-place.durationMinutes)).slice(0,8)
    .map(item=>({name:item.name,meta:`${item.area} · 建议${item.durationMinutes}分钟 · ${item.price.state === 'unknown' ? '费用待确认，未计入合计' : `参考¥${midpoint(item.price)}/人`}`,reason:`${requestedDishes.length ? requestedDishes.every(dish=>item.menuHighlights?.includes(dish)) ? `菜单资料包含所选${requestedDishes.join('、')}；` : `尚无所选${requestedDishes.join('、')}的菜单依据；` : ''}${item.area === place.area ? '与原地点在同一区域' : '本城市另一处具体选择'}；${item.durationMinutes <= place.durationMinutes ? '建议停留不长于原地点' : `建议多留${item.durationMinutes-place.durationMinutes}分钟`}。替换后重新检查时长和营业窗口，实际交通待地图确认。`}))
  if (plan.city !== '上海' || plannedStopIsMeal(place)) return cityCandidates
  const candidates = place.type.includes('咖啡') ? [replacementCatalog['衡山和集'].candidate, replacementCatalog['Seesaw Coffee（武康路）'].candidate]
    : place.type.includes('展') ? [replacementCatalog['浦东美术馆'].candidate, replacementCatalog['上海自然博物馆'].candidate]
    : place.name.includes('外滩') ? [replacementCatalog['外白渡桥'].candidate, replacementCatalog['浦东美术馆'].candidate]
    : [replacementCatalog['衡山和集'].candidate, replacementCatalog['Seesaw Coffee（武康路）'].candidate]
  return [...candidates.filter(candidate => allowed(candidate.name)), ...cityCandidates].filter((candidate, index, all) => all.findIndex(item => item.name === candidate.name) === index).slice(0, 8)
}

export function updateGeneratedPlan(plan: GeneratedPlan, days: Record<string, PlannedStop[]>): GeneratedPlan {
  const scheduled = Object.fromEntries(Object.entries(days).map(([day, stops]) => [day, stops.map((stop) => ({ ...stop }))]))
  for (const stops of Object.values(scheduled)) {
    for (let i = 1; i < stops.length; i++) {
      const previous = stops[i - 1]
      const earliest = timeToMinutes(previous.time) + previous.durationMinutes + stops[i].travelFromPreviousMinutes
      // A fixed reservation keeps its original time and remains a validation error.
      const completed=plan.execution?.some(event=>event.stopId===stops[i].id&&event.action==='completed')
      if (!stops[i].fixed && !completed && timeToMinutes(stops[i].time) < earliest && earliest < 1440) stops[i].time = addMinutes('00:00', earliest)
    }
  }
  const hotel = getHotelRecommendationsForPlan(plan).find(x => x.id === plan.selectedHotelId) ?? getHotelRecommendationsForPlan(plan)[0]
  const budgetBreakdown = hotel ? breakdown(knowledgeBudget(scheduled, plan.intent, hotel, plan.id === 'easy' ? 'easy' : plan.id === 'rich' ? 'rich' : 'match')) : plan.budgetBreakdown
  return refreshKnowledgeValidation({
    ...plan,
    previousVersion: { days: plan.days, selectedHotelId: plan.selectedHotelId, intent: plan.intent, dates: plan.dates, nights: plan.nights },
    days: scheduled,
    revision: (plan.revision ?? 0) + 1,
    budget: budgetBreakdown.total,
    budgetBreakdown,
    places: countVisiblePlaces(scheduled),
    validation: validatePlan({ ...plan, days: scheduled, budget: budgetBreakdown.total }),
  }, plan)
}

/** Upgrade only untouched meal placeholders. Existing venues, IDs, bookings and
 * user-edited times stay intact; a rejected candidate never changes the trip. */
export function completePendingMeals(plan: GeneratedPlan): GeneratedPlan {
  if (plan.sourceGroup || plan.execution?.length || ![undefined, 'planned'].includes(plan.status)) return plan
  if (!Object.values(plan.days).flat().some(stop => stop.pendingVenue && plannedStopIsMeal(stop) && !stop.fixed)) return plan
  const knowledge = getCityKnowledge(plan.city)
  const candidates = buildCityKnowledgeItems(plan.intent, knowledge, plan.guideContext).filter(item => item.category === 'restaurant')
  const days = Object.fromEntries(Object.entries(plan.days).map(([day, stops]) => [day, stops.map(stop => ({ ...stop }))]))
  let changed = false
  for (const [day, stops] of Object.entries(days)) {
    for (let index = 0; index < stops.length; index++) {
      const old = stops[index]
      if (!old.pendingVenue || !plannedStopIsMeal(old) || old.fixed) continue
      const before = stops[index - 1], after = stops[index + 1]
      const usedVenues = new Set(Object.values(days).flat().filter(stop=>!stop.pendingVenue && plannedStopIsMeal(stop)).map(mealVenueName))
      const ranked = candidates.filter(item => fitsMeal(item,old.type) && !usedVenues.has(mealIdentity(item))).map(item => {
        const visits = Object.values(days).flat().filter(stop => mealVenueName(stop) === mealIdentity(item)).length
        const incoming = before ? mealTransfer(plan.city, before, item) : old.travelFromPreviousMinutes
        const outgoing = after ? mealTransfer(plan.city, item, after) : 0
        return { item, incoming, outgoing, score: visits * 5 + incoming + outgoing }
      }).sort((a, b) => a.score - b.score)
      for (const { item, incoming, outgoing } of ranked) {
        if (before && timeToMinutes(old.time) < timeToMinutes(before.time) + before.durationMinutes + incoming) continue
        if (after && timeToMinutes(after.time) < timeToMinutes(old.time) + old.durationMinutes + outgoing) continue
        const next = { ...knowledgeItemToStop(item, plan.city, old.time, incoming, 'metro', plan.intent.dietary),
          id: old.id, type: old.type, date: old.date, durationMinutes: old.durationMinutes, stay: old.stay,
          transport: `转场预留${incoming}分钟，实际路线请查看地图` }
        const trial = [...stops]; trial[index] = next
        if (after) trial[index + 1] = { ...after, travelFromPreviousMinutes: Math.max(after.travelFromPreviousMinutes, outgoing), transport: `转场预留${Math.max(after.travelFromPreviousMinutes, outgoing)}分钟，实际路线请查看地图` }
        const check = validatePlan({ ...plan, days: { [day]: trial } })
        if (!check.checks.filter(entry => ['时间顺序', '餐期', '营业时间', '饮食匹配'].includes(entry.name)).every(entry => entry.passed)) continue
        stops.splice(0, stops.length, ...trial); changed = true; break
      }
    }
  }
  return changed ? updateGeneratedPlan({ ...plan, knowledge }, days) : plan
}

export function refreshRepeatedMeals(plan: GeneratedPlan): GeneratedPlan {
  if (plan.sourceGroup || plan.execution?.length || ![undefined,'planned'].includes(plan.status)) return plan
  const seen = new Set(Object.values(plan.days).flat().filter(stop=>plannedStopIsMeal(stop) && stop.fixed && !stop.pendingVenue).map(mealVenueName))
  let changed = false
  const days = Object.fromEntries(Object.entries(plan.days).map(([day,stops])=>[day,stops.map(stop=>{
    if (!plannedStopIsMeal(stop) || stop.fixed || stop.pendingVenue) return stop
    const key=mealVenueName(stop)
    if (!seen.has(key)) {seen.add(key);return stop}
    changed=true
    // Discard the old venue facts together; retaining old coordinates/menu would be misleading.
    return {id:stop.id,time:stop.time,date:stop.date,type:stop.type,stay:stop.stay,durationMinutes:stop.durationMinutes,travelFromPreviousMinutes:stop.travelFromPreviousMinutes,mode:stop.mode,
      name:`${day} ${stop.type}餐厅待选`,zone:stop.area??stop.zone,area:stop.area??stop.zone,budget:0,priceState:'unknown' as const,pendingVenue:true,factState:'estimated' as const,
      factSource:'已移除重复门店，等待匹配不同餐厅',transport:stop.transport,note:'保留原用餐时间，在当前片区确认另一家餐厅；价格、营业与过敏原待确认。'}
  })]))
  if (!changed) return completePendingMeals(plan)
  const fresh={...plan,days,knowledge:getCityKnowledge(plan.city),guideContext:getLocalGuideContext(plan.city,[...plan.intent.mustVisit,...plan.intent.preferences].join(' '))}
  const filled=completePendingMeals(fresh)
  return updateGeneratedPlan({...plan,knowledge:fresh.knowledge,guideContext:fresh.guideContext},filled.days)
}

/** Repair only the generated morning hotel marker; keep breakfast and visit times. */
export function completeSavedItinerary(plan: GeneratedPlan): GeneratedPlan {
  if (plan.sourceGroup || plan.execution?.length || ![undefined,'planned'].includes(plan.status) || Object.values(plan.days).some(stops=>!stops.length)) return plan
  let morningChanged=false
  const days=Object.fromEntries(Object.entries(plan.days).map(([day,stops])=>{
    const hotelIndex=stops.findIndex(stop=>/-hotel-day-\d+$/.test(stop.id) && stop.type==='住宿')
    const breakfastIndex=stops.findIndex(stop=>stop.type==='早餐')
    if(hotelIndex<=0 || breakfastIndex<0 || breakfastIndex>hotelIndex)return [day,stops]
    const hotel=stops[hotelIndex], breakfast=stops[breakfastIndex]
    const start=timeToMinutes(breakfast.time)-hotel.durationMinutes-Math.max(30,breakfast.travelFromPreviousMinutes)
    if(start<0 || stops.slice(0,hotelIndex).some(stop=>stop.fixed))return [day,stops]
    morningChanged=true
    return [day,[{...hotel,time:addMinutes('00:00',start),travelFromPreviousMinutes:0,transport:'从住宿点出发',note:'在酒店洗漱、整理随身物品，准备出发；先去吃早餐，再按当天路线游览。'},...stops.filter((_,i)=>i!==hotelIndex)]]
  }))
  const base=morningChanged ? {...plan,days} : plan
  const completed=refreshRepeatedMeals(completeLegacyItinerary(base))
  if(!morningChanged && completed===plan)return plan
  return updateGeneratedPlan({...plan,knowledge:completed.knowledge,guideContext:completed.guideContext},completed.days)
}

function completeLegacyItinerary(plan: GeneratedPlan): GeneratedPlan {
  if (Object.values(plan.days).some(stops=>stops.length===0)) return plan
  const withMeals = completePendingMeals(plan)
  // Only the old generated-placeholder migration qualifies. A day deliberately
  // cleared by its owner, an active trip, or a shared decision is never refilled.
  if (withMeals === plan || Object.keys(plan.days).length < 5) return withMeals
  const days = Object.fromEntries(Object.entries(withMeals.days).map(([day, stops]) => [day, stops.map(stop => ({ ...stop }))]))
  const used = new Set(Object.values(days).flat().map(stop => stop.name))
  const candidates = buildCityKnowledgeItems(plan.intent, getCityKnowledge(plan.city), plan.guideContext)
    .filter(item => ['attraction', 'activity'].includes(item.category) && !item.tags.some(tag => /夜景|夜逛/.test(tag)))
  let changed = false
  for (const [day, stops] of Object.entries(days)) {
    if (stops.some(stop => !stop.fixed && !plannedStopIsMeal(stop) && !isHotelStop(stop) && stop.type !== '休息')) continue
    for (const item of candidates.filter(item => !used.has(item.name))) {
      let added = false
      for (let index = 1; index < stops.length; index++) {
        const before = stops[index - 1], after = stops[index]
        const incoming = mealTransfer(plan.city, before, item), outgoing = mealTransfer(plan.city, item, after)
        const start = Math.max(timeToMinutes(before.time) + before.durationMinutes + incoming, item.opening ? timeToMinutes(item.opening.from) : 9 * 60)
        if (start + item.durationMinutes + outgoing > timeToMinutes(after.time)) continue
        const stop = { ...knowledgeItemToStop(item, plan.city, addMinutes('00:00', start), incoming, 'metro', plan.intent.dietary),
          id: `${item.id}-${day}-filled`, date: before.date, transport: `转场预留${incoming}分钟，实际路线请查看地图` }
        const transfer = Math.max(after.travelFromPreviousMinutes, outgoing)
        const trial = [...stops.slice(0, index), stop, { ...after, travelFromPreviousMinutes: transfer, transport: `转场预留${transfer}分钟，实际路线请查看地图` }, ...stops.slice(index + 1)]
        const check = validatePlan({ ...plan, days: { [day]: trial } })
        if (!check.checks.filter(entry => ['时间顺序', '营业时间'].includes(entry.name)).every(entry => entry.passed)) continue
        days[day] = trial; used.add(item.name); added = true; changed = true; break
      }
      if (added) break
    }
  }
  return changed ? updateGeneratedPlan({ ...plan, knowledge: withMeals.knowledge }, days) : withMeals
}

export function undoPlanEdit(plan: GeneratedPlan): GeneratedPlan {
  if(!plan.previousVersion)return plan
  const previous=plan.previousVersion
  const completed=plan.execution?.filter(event=>event.action==='completed')??[]
  if(completed.some(event=>JSON.stringify(previous.days[event.day]?.find(stop=>stop.id===event.stopId))!==JSON.stringify(plan.days[event.day]?.find(stop=>stop.id===event.stopId))))return plan
  return {...updateGeneratedPlan({...plan,selectedHotelId:previous.selectedHotelId,intent:previous.intent??plan.intent,dates:previous.dates===undefined?plan.dates:previous.dates,nights:previous.nights??plan.nights},previous.days),previousVersion:undefined}
}

export function delayPlanStop(plan:GeneratedPlan, day:string, stopId:string, minutes:number):GeneratedPlan {
  const target=plan.days[day]?.find(stop=>stop.id===stopId)
  if(!target||target.fixed||plan.execution?.some(event=>event.stopId===stopId&&event.action==='completed')||!Number.isInteger(minutes)||minutes<=0||timeToMinutes(target.time)+minutes>=1440)return plan
  return updateGeneratedPlan(plan,{...plan.days,[day]:plan.days[day].map(stop=>stop.id===stopId?{...stop,time:addMinutes(stop.time,minutes)}:stop)})
}

export function getHotelRecommendationsForPlan(plan: GeneratedPlan) {
  return plan.hotelRecommendations?.length
    ? plan.hotelRecommendations
    : getHotelRecommendations(plan.knowledge, plan.intent, plan.guideContext)
}

function hotelOptionForPlan(plan: GeneratedPlan, name: string) {
  return getHotelRecommendationsForPlan(plan).find((option) => option.name === name)
}

export function replacePlanHotel(plan: GeneratedPlan, placeId: string, replacementName: string): GeneratedPlan {
  const target = Object.values(plan.days).flat().find((place) => place.id === placeId)
  const replacement = hotelOptionForPlan(plan, replacementName)
  if (!target || !isHotelStop(target) || !replacement) return plan
  const nightly = midpoint(replacement.nightly)
  const days = Object.fromEntries(Object.entries(cloneDays(plan.days)).map(([day, stops]) => [day, stops.map((stop) => {
    if (!isHotelStop(stop)) return stop
    const isLuggage = stop.type === '取行李'
    return {
      ...stop,
      name: isLuggage ? `${replacement.name}取行李` : replacement.name,
      area: replacement.area,
      zone: replacement.area,
      hotelOptionId: replacement.id,
      budget: stop.type === '住宿' ? nightly : 0,
      note: stop.type === '住宿'
        ? `${replacement.summary} ${plan.nights > 0 ? `连续 ${plan.nights} 晚参考价 ¥${nightly * plan.nights}，实际以酒店当天公开信息为准。` : ''}`
        : `${stop.note} 当前住宿：${replacement.name}。`,
      searchKeyword: replacement.name,
      address: undefined, coordinates: undefined, longitude: undefined, latitude: undefined, lng: undefined, lat: undefined, coordinateSystem: undefined, mapStatus:'unresolved' as const,
      verified: replacement.verified,
      factState: replacement.verified ? 'verified' : 'estimated',
      factSource: `${replacement.source.label}（价格、房态和准确位置按当天公开信息为准）`,
    }
  })])) as Record<string, PlannedStop[]>
  const budgetBreakdown = breakdown({
    lodging: nightly * plan.nights,
    meals: plan.budgetBreakdown.meals,
    transport: plan.budgetBreakdown.transport,
    tickets: plan.budgetBreakdown.tickets,
    coffee: plan.budgetBreakdown.coffee,
    buffer: plan.budgetBreakdown.buffer,
  })
  const nextPlan = {
    ...plan,
    days,
    budgetBreakdown,
    budget: budgetBreakdown.total,
    selectedHotelId: replacement.id,
  }
  return {...updateGeneratedPlan(nextPlan, days),previousVersion:{days:plan.days,selectedHotelId:plan.selectedHotelId}}
}

export function replacePlanPlace(plan: GeneratedPlan, placeId: string, replacementName: string): GeneratedPlan {
  const target = Object.values(plan.days).flat().find((place) => place.id === placeId)
  if (target && isHotelStop(target)) return replacePlanHotel(plan, placeId, replacementName)
  if (target?.fixed || plan.execution?.some(event=>event.stopId===placeId && event.action==='completed')) return plan
  if (!target || !getReplacementCandidates(plan, placeId).some(candidate => candidate.name === replacementName)) return plan
  plan = withCurrentPlaceKnowledge(plan)
  if (target && (plan.city !== '上海' || !replacementCatalog[replacementName])) {
    const item=plan.knowledge.items.find(item=>item.name===replacementName)
    if(!item || !getReplacementCandidates(plan,placeId).some(candidate=>candidate.name===replacementName))return plan
    const replacement={...knowledgeItemToStop(item,plan.city,target.time,target.travelFromPreviousMinutes,target.mode,plan.intent.dietary),id:target.id,
      ...(plannedStopIsMeal(target) ? {type:target.type,durationMinutes:target.durationMinutes,stay:target.stay} : {})}
    return updateGeneratedPlan(plan,Object.fromEntries(Object.entries(plan.days).map(([day,stops])=>[day,stops.map(stop=>stop.id===placeId?replacement:stop)])))
  }
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

export function copyCuratedTrip(route: {dayCount?:number;id:string;cityId:string;title:string;budgetMax:number;timePeriod?:string[];category?:string;pois:Array<{time?:string;day?:number;id:string;name:string;stay:string;category:string;introduction:string;transportation:string;address?:string}>}, options?: {date:string;partySize:number;copyId:string}) {
  if(options && (!/^\d{4}-\d{2}-\d{2}$/.test(options.date) || !Number.isInteger(options.partySize) || options.partySize<1 || options.partySize>100)) throw Error('请填写有效出行日期和人数')
  if(options){const existing=readSavedPlans()?.find(plan=>plan.tripId===options.copyId);if(existing)return existing}
  const dayCount=route.dayCount ?? 1
  const intent=understandTrip({text:`去${route.cityId}${dayCount}天，预算${route.budgetMax}元。`,media:[]}).intent
  const plan=generatePlans({...intent,durationDays:dayCount,nights:dayCount-1,partySize:options?.partySize??intent.partySize,dates:options?{start:options.date,end:new Date(Date.parse(options.date+'T12:00:00Z')+(dayCount-1)*86400000).toISOString().slice(0,10)}:intent.dates})[0]
  const routeStart=experienceRouteStart(route)
  let cursor=routeStart
  const stops=route.pois.map((poi,index)=>{
    const duration=Math.round(Number(poi.stay.match(/(\d+(?:\.\d+)?)h/)?.[1]??0)*60+Number(poi.stay.match(/(\d+)min/)?.[1]??0))||60
    const firstOfDay=index===0 || poi.day!==route.pois[index-1].day
    if(firstOfDay)cursor=routeStart
    const suggestedTime=poi.time??addMinutes(cursor,firstOfDay?0:25)
    const time=/夜逛|夜景|夜游|夜市/.test(poi.name)&&suggestedTime<'18:00'?'18:00':suggestedTime;cursor=addMinutes(time,duration)
    return makeStop({id:crypto.randomUUID(),name:poi.name,time,type:poi.category,stay:poi.stay,durationMinutes:duration,budget:0,priceState:'unknown',transport:!firstOfDay?'转场暂按25分钟预留，须地图核对':`建议${routeStart}开始，可按实际到达调整`,travelFromPreviousMinutes:firstOfDay?0:25,zone:route.cityId,mode:'walk',note:poi.introduction,address:poi.address,searchKeyword:poi.name,verified:false,factState:'estimated',factSource:'精选路线复制；具体费用、营业和转场待核验'})
  })
  const copied=updateGeneratedPlan({...plan,tripId:options?.copyId,label:route.title,sourceTripId:route.id,sourceVersion:'local-curated-v3',intent:{...plan.intent,missing:[...plan.intent.missing,'精选各站费用和转场时间']}},Object.fromEntries(Array.from({length:dayCount},(_,day)=>[`Day ${day+1}`,stops.filter((_,index)=>(route.pois[index].day??1)===day+1)])))
  return writeSavedPlan(copied)
}

function readSession<T>(key: string): T | null {
  return readVersioned<T>(key, 'session')
}

function normalizeStoredPlans(value: unknown) {
  if (!Array.isArray(value)) return value
  return value.map((plan) => {
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return plan
    const source = plan as Record<string, unknown>
    if (!source.days || typeof source.days !== 'object' || Array.isArray(source.days)) return plan
    const days = Object.fromEntries(Object.entries(source.days as Record<string, unknown>).map(([day, stops]) => [
      day,
      Array.isArray(stops)
        ? stops.map((stop) => stop && typeof stop === 'object' && !Array.isArray(stop)
          ? normalizePlace(stop as Partial<Place> & Record<string, unknown>)
          : stop)
        : stops,
    ]))
    return { ...source, days }
  })
}

export function readStoredUnderstanding() {
  return parseTripUnderstanding(readSession<unknown>(TRIP_UNDERSTANDING_STORAGE))
}

export function readStoredPlans() {
  const value = parseGeneratedPlans(normalizeStoredPlans(readSession<unknown>(TRIP_PLANS_STORAGE)))
  return value && value.length > 0 ? value : null
}

export function readSavedPlans() {
  const value = parseGeneratedPlans(normalizeStoredPlans(readVersioned<unknown>(TRIP_SAVED_PLANS_STORAGE, 'local')), 1000)
  return value && value.length > 0 ? value : null
}

export function writeStoredUnderstanding(value: TripUnderstanding) {
  writeVersioned(TRIP_UNDERSTANDING_STORAGE, value, 'session')
}

export function writeStoredPlans(value: GeneratedPlan[]) {
  if (!writeVersioned(TRIP_PLANS_STORAGE, value, 'session')) throw new Error('方案保存失败，原结果保留，请释放本机空间后重试。')
}

// Selecting another option from the same generation replaces only that generation's
// unstarted Trip. Existing unrelated and historical Trips remain separate.
export function selectPlanOption(option: GeneratedPlan) {
  if (option.example) throw new Error('这是体验示例，请填写自己的条件后再保存行程。')
  if (option.savedAt && option.tripId) return writeSavedPlan(option)
  const previous = option.generationId ? readSavedPlans()?.find(plan => plan.generationId === option.generationId) : undefined
  if (previous && (previous.execution?.length || !['planned', undefined].includes(previous.status))) throw new Error('这批方案的行程已开始或归档，不能用备选覆盖。请创建新的旅行草稿。')
  return writeSavedPlan({ ...option, tripId: previous?.tripId, savedAt: previous?.savedAt, revision: previous ? (previous.revision ?? 1) + 1 : 1, originOptionId: option.optionId ?? option.id, sceneType: option.sceneType ?? 'travel', status: 'planned' })
}

export function writeSavedPlan(value: GeneratedPlan) {
  const stored = readSavedPlans() ?? []
  const legacyIndex=!value.tripId&&!value.optionId ? stored.findIndex(item=>!item.tripId&&JSON.stringify(item)===JSON.stringify(value)) : -1
  if(legacyIndex>=0&&!readVersioned('zouzou-trip-id-migration-backup-v3','local')) {
    if(!writeVersioned('zouzou-trip-id-migration-backup-v3',stored,'local'))throw new Error('旧行程备份失败，原记录保留，请释放空间后重试。')
  }
  const previous = value.tripId ? stored.find(item => item.tripId === value.tripId) : value.optionId ? stored.find(item=>item.optionId===value.optionId) : undefined
  if (previous && value.savedAt && previous.savedAt !== value.savedAt) throw new Error('另一页面已更新这份行程，请重新打开后再修改。当前修改没有覆盖新版本。')
  if (previous && (previous.revision ?? 0) > (value.revision ?? 0)) throw new Error('另一页面已更新这份行程，请重新打开后再修改。当前修改没有覆盖新版本。')
  const saved = { ...value, tripId: value.tripId ?? previous?.tripId ?? crypto.randomUUID(), revision: value.revision ?? 1, savedAt: new Date().toISOString(), status: value.status ?? 'planned' as const }
  const next = [saved, ...stored.filter((item,index) => index!==legacyIndex&&item.tripId !== saved.tripId)]
  if (!writeVersioned(TRIP_SAVED_PLANS_STORAGE, next, 'local')) throw new Error('本机保存失败，可能存储空间不足。原行程仍保留，请导出或清理空间后重试。')
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('zouzou-saved-trips-updated'))
  return saved
}
