import { cityNames, getCityProfile } from '../../demo-data/cities'
import type { Place, Plan } from '../../demo-data/trips'
import { dietarySummary, emptyDietaryProfile, extractDietaryProfile, foodCompatibilityIssues, type DietaryProfile } from './dietary'
import { type GuideContext } from './guides'
import { getCityKnowledge, isConcreteKnowledgeItem, knowledgeMatches, selectHotelOption, type CityKnowledge, type CityKnowledgeItem, type HotelOption } from './cityKnowledge'
import { getHotelRecommendations, hotelOptionMeta, hotelOptionReason } from './hotelRecommendation'
import { cityRouteSpecs, getCityRouteZone } from './cityRouteSpecs'
import { readVersioned, writeVersioned } from '../storage'
import { parseGeneratedPlans, parseTripUnderstanding } from './schemas'
import { amapPlaceSearchUrl, readRememberedAmapPlaces } from '../amap/placeRegistry'

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
  x: Math.round((input.lng - 121.47) * 100),
  z: Math.round((31.23 - input.lat) * 100),
})

const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

const unique = (items: string[]) => [...new Set(items)]

function knowledgeWithRememberedPlaces(city: string): CityKnowledge {
  const base = getCityKnowledge(city)
  const remembered = readRememberedAmapPlaces(city)
  if (remembered.length === 0) return base
  const rememberedItems: CityKnowledgeItem[] = remembered.map((place, index) => {
    const category = place.category === 'restaurant' ? 'restaurant' : 'activity'
    const source = {
      label: `高德 POI：${place.canonicalName}`,
      url: amapPlaceSearchUrl({ city, name: place.inputName, searchKeyword: place.searchKeyword }),
      kind: 'amap' as const,
      checkedAt: new Date(place.verifiedAt).toISOString().slice(0, 10),
    }
    return {
      id: `${city}-amap-memory-${place.amapPoiId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) || index}`,
      name: place.canonicalName,
      category,
      area: place.district ?? city,
      tags: category === 'restaurant' ? ['本地餐饮', '高德已定位'] : ['具体地点', '高德已定位'],
      summary: category === 'restaurant'
        ? `走走已在高德确认这家店：${place.canonicalName}。地址：${place.address || '以高德门店信息为准'}。`
        : `走走已在高德确认这个地点：${place.canonicalName}。地址：${place.address || '以高德地点信息为准'}。`,
      coordinates: [place.lng, place.lat],
      coordinateSystem: 'gcj02',
      venueName: place.canonicalName,
      amapPoiId: place.amapPoiId,
      address: place.address || undefined,
      menuHighlights: category === 'restaurant' ? [place.inputName] : undefined,
      searchKeyword: place.searchKeyword,
      durationMinutes: category === 'restaurant' ? 75 : 60,
      price: category === 'restaurant'
        ? { min: 30, max: 120, unit: 'person' as const, note: '高德未提供菜单价格，按门店当天菜单为准。' }
        : { min: 0, max: 0, unit: 'person' as const, note: '以现场规则为准。' },
      source,
      verified: true,
    }
  })
  const rememberedNames = new Set(rememberedItems.flatMap((item) => [item.name, item.venueName ?? '']))
  return {
    ...base,
    items: [...base.items.filter((item) => !rememberedNames.has(item.name) && !rememberedNames.has(item.venueName ?? '')), ...rememberedItems],
    sources: [...base.sources, ...rememberedItems.map((item) => item.source)],
  }
}

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
        if (!matchedFoodVenues.has(venue)) {
          matchedFoodVenues.add(venue)
          if (!mustVisit.includes(venue)) mustVisit.push(venue)
        }
      } else if (!mustVisit.includes(item.name)) {
        mustVisit.push(item.name)
      }
    }
    if (matchedAlias && profilePlaceTerms.has(matchedAlias)) matchedProfilePlaceAliases.add(matchedAlias)
  })
  if (/咖啡|coffee/.test(combined.toLowerCase())) preferences.push('咖啡')
  if (/city\s*walk|散步|慢走|街区/.test(combined.toLowerCase())) preferences.push('City Walk')
  if (/美食|小吃|餐厅|餐馆|湘菜|臭豆腐|糖油粑粑|口味虾|吃/.test(combined)) preferences.push('本地美食')
  if (/湘菜/.test(combined)) preferences.push('湘菜')
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
  profile: ReturnType<typeof getCityProfile>,
  time: string,
  travelFromPreviousMinutes: number,
  mode: TravelMode,
  dietary: DietaryProfile,
): PlannedStop {
  const [fallbackLng, fallbackLat] = profile.mapCenter
  const [lng, lat] = item.coordinates[0] === 0 && item.coordinates[1] === 0
    ? [fallbackLng, fallbackLat]
    : item.coordinates
  const budget = midpoint(item.price) * (item.price.unit === 'person' || item.price.unit === 'ticket' ? 2 : 1)
  const type = knowledgeItemType(item)
  const factState = item.verified ? 'verified' : 'estimated'
  const sourceText = item.verified ? '走走知识库 · 地点信息已核验' : '走走知识库 · 地点信息需出发前复核'
  const routeZone = getCityRouteZone(city, item.name, item.area)
  const visibleMenu = (item.menuHighlights ?? []).filter((dish) => foodCompatibilityIssues(dish, dietary).length === 0)
  return makeStop({
    id: `${city}-${item.id}`,
    time,
    name: item.name,
    type,
    stay: item.durationMinutes >= 60 ? `${Math.floor(item.durationMinutes / 60)}h${item.durationMinutes % 60 ? ` ${item.durationMinutes % 60}min` : ''}` : `${item.durationMinutes}min`,
    budget,
    transport: travelFromPreviousMinutes === 0 ? '从住宿点出发' : `${mode === 'walk' ? '步行' : mode === 'metro' ? '地铁' : '打车'}约 ${travelFromPreviousMinutes} 分钟`,
    note: [
      item.summary,
      item.address ? `地址：${item.address}` : '',
      visibleMenu.length > 0 ? `可点：${visibleMenu.join('、')}` : '',
    ].filter(Boolean).join(' '),
    lng,
    lat,
    area: item.area,
    ...(item.venueName ? { canonicalName: item.venueName } : {}),
    ...(item.address ? { address: item.address } : {}),
    ...(item.amapPoiId ? { poiId: item.amapPoiId, amapPoiId: item.amapPoiId } : {}),
    ...(item.coordinateSystem ? { coordinateSystem: item.coordinateSystem } : {}),
    ...(item.verified && item.coordinateSystem ? { mapStatus: 'resolved' as const } : {}),
    searchKeyword: item.searchKeyword ?? item.venueName ?? item.name,
    coordinateSource: item.verified ? '高德 POI · 已核验' : '高德 POI · 等待实时核验',
    verified: item.verified,
    durationMinutes: Math.min(item.durationMinutes, type === '景点' || type === '展览' ? 120 : 90),
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
  return /午餐|晚餐|本地小吃/.test(stop.type)
}

function mealIdentity(item: CityKnowledgeItem) {
  return (item.venueName ?? item.name).replace(/[（）()·/—\-\s]/g, '').toLowerCase()
}

function assignItemsToDays(items: CityKnowledgeItem[], city: string, dayCount: number, intent: TripIntent, itemLimit: number) {
  const buckets = Array.from({ length: dayCount }, () => [] as CityKnowledgeItem[])
  const bands = routeBands(items, city)
  if (bands.length === 0) return buckets

  bands.forEach((band, bandIndex) => {
    const dayIndex = bands.length <= dayCount
      ? Math.min(dayCount - 1, bandIndex)
      : Math.round((bandIndex * (dayCount - 1)) / (bands.length - 1))
    const ordered = [...band].sort((left, right) => tripItemPriority(right, intent) - tripItemPriority(left, intent))
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
        selectedMealKeys.add(key)
      }
      selected.push(item)
    }
    required.forEach(add)
    preferred.filter((item) => !itemIsMeal(item)).slice(0, 2).forEach(add)
    preferred.filter(itemIsMeal).slice(0, 1).forEach(add)
    meals.slice(0, 1).forEach(add)
    nonMeals.forEach(add)
    buckets[dayIndex].push(...selected.slice(0, Math.max(itemLimit, required.length)))
  })
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

function buildCityKnowledgeItems(intent: TripIntent, knowledge: CityKnowledge, guideContext: GuideContext | undefined) {
  const dietary = intent.dietary ?? emptyDietaryProfile()
  const compatibleKnowledge = knowledge.items.filter((item) => item.category !== 'food' && item.category !== 'restaurant'
    || (isConcreteKnowledgeItem(item) && foodCompatibilityIssues(`${item.name} ${item.summary}`, dietary, item.dietaryTags).length === 0))
    .filter((item) => isConcreteKnowledgeItem(item))
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
  const addItem = (item: CityKnowledgeItem) => {
    const key = item.category === 'food' || item.category === 'restaurant'
      ? mealIdentity(item)
      : item.name
    const existing = byName.get(key)
    const existingIsVenue = Boolean(existing && existing.name === existing.venueName)
    const nextIsVenue = item.name === item.venueName
    if (!existing || (!existingIsVenue && nextIsVenue)) {
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
  const profile = getCityProfile(intent.destination)
  const dietary = intent.dietary ?? emptyDietaryProfile()
  const items = buildCityKnowledgeItems(intent, knowledge, guideContext)
  const dayCount = Math.max(1, intent.durationDays)
  const itemLimit = density === 'easy' ? 4 : 6
  const buckets = assignItemsToDays(items, intent.destination, dayCount, intent, itemLimit)
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
      addStop(makeStop({
        id: `${intent.destination}-hotel-day-${dayNumber}`, time: cursor, name: selectedHotel.name, type: '住宿', stay: '15min', budget: midpoint(selectedHotel.nightly), hotelOptionId: selectedHotel.id,
        transport: '从上一片区返回约 20 分钟', note: `${selectedHotel.summary} ${intent.nights > 0 ? `连续 ${intent.nights} 晚参考价 ¥${midpoint(selectedHotel.nightly) * intent.nights}。` : ''}`,
        lng: profile.mapCenter[0], lat: profile.mapCenter[1], durationMinutes: 15, travelFromPreviousMinutes: 0, zone: selectedHotel.area, mode: 'walk', fixed: true,
        factState: selectedHotel.verified ? 'verified' : 'estimated', factSource: `${selectedHotel.source.label}（价格和房态按当天公开信息为准）`,
      }))
    }

    if (isFirst) {
      addStop(makeStop({
        id: `${intent.destination}-hotel-check-in`, time: addMinutes(cursor, 25), name: selectedHotel.name, type: '住宿', stay: '30min', budget: midpoint(selectedHotel.nightly), hotelOptionId: selectedHotel.id,
        transport: '步行 / 地铁约 20 分钟', note: `${selectedHotel.summary} ${intent.nights > 0 ? `连续 ${intent.nights} 晚参考价 ¥${midpoint(selectedHotel.nightly) * intent.nights}，实际以酒店当天公开信息为准。` : ''}`,
        lng: profile.mapCenter[0], lat: profile.mapCenter[1], durationMinutes: 30, travelFromPreviousMinutes: 25, zone: selectedHotel.area, mode: 'metro', fixed: true,
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
      return leftZone.order - rightZone.order || mealBeforeNight || rightRequired - leftRequired || scheduleItemRank(left) - scheduleItemRank(right)
    })
    orderedItems.forEach((item) => {
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
      const stop = knowledgeItemToStop(item, intent.destination, profile, time, travel, mode, dietary)
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
  const replacement = knowledgeItemToStop(meal, intent.destination, profile, slot.stop.time, slot.stop.travelFromPreviousMinutes, slot.stop.mode, dietary)
  const replacementStop = meal.category === 'restaurant'
    ? { ...replacement, type: timeToMinutes(slot.stop.time) < 16 * 60 ? '午餐' : '晚餐' }
    : replacement
  return {
    ...days,
    [slot.day]: slot.stops.map((stop, index) => index === slot.index ? replacementStop : stop),
  }
}

function knowledgeBudget(days: Record<string, PlannedStop[]>, intent: TripIntent, selectedHotel: HotelOption, density: 'easy' | 'match' | 'rich'): Omit<BudgetBreakdown, 'total'> {
  const allStops = Object.values(days).flat()
  const lodging = midpoint(selectedHotel.nightly) * intent.nights
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
  return stop.name.includes(requirement) || stop.type.includes(requirement) || Boolean(stop.searchKeyword?.includes(requirement))
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
        const foodIssues = foodCompatibilityIssues(stop.name, dietary, stop.dietaryTags)
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
  hotelRecommendations: HotelOption[],
  selectedHotel: HotelOption,
  guideContext?: GuideContext,
): GeneratedPlan {
  const budgetBreakdown = breakdown({
    ...budgetValues,
    lodging: midpoint(selectedHotel.nightly) * intent.nights,
  })
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
    hotelRecommendations,
    selectedHotelId: selectedHotel.id,
    ...(guideContext && guideContext.candidates.length > 0 ? { guideContext } : {}),
    validation: { passed: false, score: 0, checks: [], issues: [] },
    evidence: [
      `地点为${intent.destination}；最终行程只使用走走知识库中可搜索的具体地点，地图位置由高德实时 POI 核验。`,
      knowledge.intro,
      ...(guideContext && guideContext.candidates.length > 0
        ? [`参考了 ${guideContext.candidates.length} 条公开地点线索；仅用于匹配走走知识库中的具体地点。`]
        : []),
      `住宿默认选择：${selectedHotel.name}；按住宿片区、预算和路线匹配。`,
      '交通耗时、餐饮价格和门票为规划参考，不是实时库存或订单。',
      '路线是可编辑规划，时间与预算可按你的安排调整。',
    ],
  }
  return { ...plan, validation: validatePlan(plan) }
}

export function generatePlans(intent: TripIntent, guideContext?: GuideContext): GeneratedPlan[] {
  const knowledge = knowledgeWithRememberedPlaces(intent.destination)
  const hotelRecommendations = getHotelRecommendations(knowledge, intent, guideContext)
  const selectedHotel = hotelRecommendations[0] ?? selectHotelOption(knowledge, intent.budget, intent.nights)
  const variants: Array<{ id: 'match' | 'easy' | 'rich'; label: string; density: 'easy' | 'match' | 'rich'; walking: string; difference: string }> = [
    { id: 'match', label: '最匹配', density: 'match', walking: '片区优先', difference: '把必去地点、具体餐饮门店和住宿档位放进同一条不绕路的时间轴。' },
    { id: 'easy', label: '最轻松', density: 'easy', walking: '少走动', difference: '每天减少一个非必要停留，保留完整用餐和缓冲时间。' },
    { id: 'rich', label: '体验最丰富', density: 'rich', walking: '体验更多', difference: '增加一段已命名的城市体验，但仍按预算和返程锚点留缓冲。' },
  ]
  return variants.map((variant) => {
    const days = buildKnowledgeDays(intent, knowledge, guideContext, variant.density, selectedHotel)
    const budgetValues = knowledgeBudget(days, intent, selectedHotel, variant.density)
    return createPlan(variant.id, variant.label, days, intent, variant.walking, variant.difference, budgetValues, knowledge, hotelRecommendations, selectedHotel, guideContext)
  })
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
  return updateGeneratedPlan(nextPlan, days)
}

export function replacePlanPlace(plan: GeneratedPlan, placeId: string, replacementName: string): GeneratedPlan {
  const target = Object.values(plan.days).flat().find((place) => place.id === placeId)
  if (target && isHotelStop(target)) return replacePlanHotel(plan, placeId, replacementName)
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
  return parseTripUnderstanding(readSession<unknown>(TRIP_UNDERSTANDING_STORAGE))
}

export function readStoredPlans() {
  const value = parseGeneratedPlans(readSession<unknown>(TRIP_PLANS_STORAGE))
  return value && value.length > 0 ? value : null
}

export function readSavedPlans() {
  const value = parseGeneratedPlans(readVersioned<unknown>(TRIP_SAVED_PLANS_STORAGE, 'local'))
  return value && value.length > 0 ? value : null
}

export function writeStoredUnderstanding(value: TripUnderstanding) {
  writeVersioned(TRIP_UNDERSTANDING_STORAGE, value, 'session')
}

export function writeStoredPlans(value: GeneratedPlan[]) {
  writeVersioned(TRIP_PLANS_STORAGE, value, 'session')
}

export function writeSavedPlan(value: GeneratedPlan) {
  const stored = readSavedPlans() ?? []
  const next = [value, ...stored.filter((item) => item.id !== value.id || item.city !== value.city)].slice(0, 20)
  writeVersioned(TRIP_SAVED_PLANS_STORAGE, next, 'local')
}
