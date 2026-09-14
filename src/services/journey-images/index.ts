import { isUserFacingCover, placesMatch, normalizePlaceName } from './presentation'
export { isUserFacingCover, placesMatch } from './presentation'
import type { CityImage } from '../../demo-data/city-images'
import { acquiredJourneyImages } from '../../demo-data/acquired-journey-images.release'

const acquiredByCity = new Map<string, typeof acquiredJourneyImages>()
for (const image of acquiredJourneyImages) {
  const items = acquiredByCity.get(image.city)
  if (items) items.push(image)
  else acquiredByCity.set(image.city, [image])
}

export type JourneyImageCategory = 'travel' | 'weekend' | 'date' | 'dining'
export type ImageSource = 'baidu' | 'xiaohongshu' | 'douyin' | 'wikimedia' | 'fallback'
export type CoverStatus = 'pending' | 'searching' | 'ready' | 'fallback' | 'failed'
export type RejectReason = 'broken_file' | 'too_small' | 'blur' | 'overlay_text' | 'watermark' | 'people' | 'qr_code' | 'screenshot' | 'collage' | 'black_border' | 'decorative_border' | 'signage' | 'portrait' | 'duplicate'

export type JourneyImage = {
  id: string
  journeyId: string
  sourceJourneyId?: string
  source: ImageSource
  sourceUrl: string
  originalUrl: string
  localPath: string
  cachedUrl: string
  width: number
  height: number
  aspectRatio: number
  fileSize?: number
  category: JourneyImageCategory
  city: string
  placeName?: string
  kind?: 'landmark' | 'food'
  searchQuery: string
  qualityScore: number
  relevanceScore: number
  textScore: number
  sharpnessScore: number
  hasOverlayText: boolean
  hasWatermark: boolean
  hasPeople?: boolean
  peopleHint?: boolean
  hasQrCode: boolean
  isScreenshot: boolean
  isCollage: boolean
  blackBorderRatio?: number
  hasBlackBorder?: boolean
  decorativeBorderScore?: number
  hasDecorativeBorder?: boolean
  signageScore?: number
  isSignage?: boolean
  imageHash: string
  pHash?: string
  dHash?: string
  selected: boolean
  manualOverride?: boolean
  createdAt: string
}

export type JourneyImageInput = {
  id: string
  title: string
  category: string
  city: string
  district?: string
  places: string[]
  activities?: string[]
  timePeriods?: string[]
  tags?: string[]
  manualOverride?: JourneyImage
}

export type ImageCandidate = Omit<JourneyImage, 'qualityScore' | 'relevanceScore' | 'textScore' | 'sharpnessScore' | 'selected'> & {
  sharpnessScore?: number
  textAreaRatio?: number
  textRegionCount?: number
  watermarkScore?: number
  visionEngine?: string
  downloaded?: boolean
  blackBorderRatio?: number
  hasBlackBorder?: boolean
  decorativeBorderScore?: number
  hasDecorativeBorder?: boolean
  signageScore?: number
  isSignage?: boolean
  author?: string
  noteId?: string
  noteUrl?: string
  relevanceHints?: string[]
}

export type ProviderResult = { provider: ImageSource; candidates: ImageCandidate[]; blocked?: boolean; reason?: string }
export type ImageProvider = { source: ImageSource; search: (queries: string[], signal?: AbortSignal) => Promise<ProviderResult> }

const normalizeCategory = (category: string): JourneyImageCategory => {
  if (/约会|date/i.test(category)) return 'date'
  if (/聚餐|餐饮|dining|food/i.test(category)) return 'dining'
  if (/周末|weekend/i.test(category)) return 'weekend'
  return 'travel'
}

const diningAssetPattern = /鸡饭|海鲜|海鲜粉|清补凉|抱罗粉|文昌鸡|小吃|餐|夜市|市场|椰子|甜品|奶茶|茶饮/i
const foodImageQueryPattern = /菜品|食物|美食|小吃|甜品|红肠|米线|面|粉|点心|糕|饼|饭|鱼|肝|鸡|鸭|虾|蟹|肉|汤|包子|烧卖|汤圆|年糕|饺|醪糟|水席|肠粉|焙子|羊杂|老友粉|拌粉|萝卜饺|喜饼|酸奶|奶茶|茶饮|茶颜悦色/i
const peopleHintPattern = /人物|人像|游客|路人|人群|模特|主播|探店|博主|自拍|摄影师|小哥|小姐姐|美女|帅哥|合影|肖像|试吃|采访|厨师|店员|服务员|出镜|口播|two[- ]?chinese|water[- ]?splashing|dragon boat|festival|crowd|people|person|tourist|traveler|pedestrian|portrait|selfie|model|photographer|guardians/i

const textWithoutNoPeopleInstruction = (value: string) => value.replace(/无人物|无人出镜|无人像|不含人物|空景/g, '')
const hasPeopleHint = (candidate: ImageCandidate) => candidate.peopleHint === true
  || candidate.hasPeople === true
  || peopleHintPattern.test(textWithoutNoPeopleInstruction([candidate.searchQuery, ...(candidate.relevanceHints ?? [])].join(' ')))


// These files were visually reviewed as unsuitable user-facing covers. Keep
// the source files and their attribution metadata, but never expose a cover
// with a decorative frame, visible overlay/watermark, people or hands, a
// collage, a weak food presentation, or a route-topic mismatch.

const obviousWatermarkPath = /baidu-(5e3797c0|33193410|886f943d)/i
const curatedCleanCoverPaths = new Set([
  '/assets/journey-images/baidu/baidu-b98c8f46-23.jpg', // manually reviewed shadow-puppet prop close-up; no visible watermark
  '/assets/journey-images/baidu/baidu-3b17b7bd-1.jpg', // manually reviewed Sanya rice-noodle bowls; no visible watermark
  '/assets/journey-images/baidu/baidu-8fe9d2d8-5.webp', // manually reviewed Suzhou squirrel-shaped mandarin fish; no visible watermark
  '/assets/journey-images/baidu/baidu-e1a638f8-0.png', // manually reviewed Beijing fried-liver bowl; no visible watermark
  '/assets/journey-images/baidu/baidu-51daa605-0.png', // manually reviewed Sanya Wenchang chicken platter; no visible watermark
  '/assets/journey-images/baidu/baidu-2a0d9c2d-8.webp', // manually reviewed Hefei Sanhe rice dumplings; no visible watermark
  '/assets/journey-images/baidu/baidu-e2549bfc-11.jpg', // manually reviewed Hefei Sanhe rice dumplings; no visible watermark
])
const likelyWatermark = (candidate: ImageCandidate) => !curatedCleanCoverPaths.has(candidate.localPath) && (
  obviousWatermarkPath.test(candidate.localPath)
  || candidate.hasWatermark === true
  || ((candidate.watermarkScore ?? 0) >= .02 && (candidate.textAreaRatio ?? 0) <= .04)
)


const unique = (values: string[]) => [...new Set(values.filter(Boolean))]
const searchablePlace = (value: string) => value.replace(/[｜|]/g, ' ').replace(/\s+/g, ' ').trim()
const foodRouteTitlePattern = /逛吃|特色美食|本地美食|本地餐馆|早餐|早市|菜场|小吃|正餐|面食|点心|餐馆|餐饮|美食/
const isFoodRouteTitle = (title: string) => foodRouteTitlePattern.test(title)
// Keep this list phrase-based. A single character such as “面” or “鸡” can
// be part of a landmark name (沙面岛、金马碧鸡坊) and must not turn a scenic
// route into a food-only route.
const foodPlaceNamePattern = /菜品|食物|美食|小吃|甜品|红肠|米线|米饺|米粉|面食|面条|苏式面|小面|粉丝汤|鱼蛋粉|海鲜|点心|糕点|海棠糕|油面筋|醋鱼|松鼠桂鱼|鱼饭|鸡饭|文昌鸡|椰子鸡|热干面|鸭血粉丝汤|包子|烧卖|汤圆|年糕|饺子|醪糟|水席|肠粉|焙子|羊杂|老友粉|拌粉|萝卜饺|喜饼|酸奶|奶茶|茶饮|茶颜悦色|抓饭|肉夹馍|锅包肉|叫化鸡|口味虾|火锅|烤鸭|烧烤|清补凉|抱罗粉|粘豆包|锅贴|酸汤鱼|丝娃娃|牛肉粉|烤鱼|石锅鸡|酥油茶|牦牛肉|青稞饼|稻城米线|傣味手抓饭|大救驾|稀豆粉|吊炉饼|酱肉|打糕|冷面|馄饨|麦饼|炒米面|麦虾|烤薯|烧饼|酸奶疙瘩|架子肉|烤包子|石锅鸡/i
const foodSubjectTerms = (journey: JourneyImageInput) => unique([
  ...journey.places.slice(0, 1).flatMap((place) => place.split(/[｜|/]/).slice(1).map(searchablePlace)),
  ...(journey.title.split('·').at(-1) ?? '').split(/[｜|/]/).slice(1).map(searchablePlace),
].filter((term) => term.length >= 2 && !/小吃店|饭店|餐厅|老字号|本地|特色|美食/.test(term)))
const foodNameTokens = (value: string) => searchablePlace(value)
  .split(/[^\p{Script=Han}a-z0-9]+/iu)
  .flatMap((part) => part.match(/[\p{Script=Han}]{2,}|[a-z0-9]{3,}/giu) ?? [])
  .map(normalizePlaceName)
const foodPlaceMatches = (left: string | undefined, right: string) => {
  if (!left) return false
  if (placesMatch(left, right)) return true
  const leftTokens = foodNameTokens(left)
  const rightTokens = foodNameTokens(right)
  return leftTokens.some((token) => rightTokens.some((other) => {
    if (other.includes(token) || token.includes(other)) return true
    const shorter = token.length <= other.length ? token : other
    const longer = token.length <= other.length ? other : token
    return shorter.length >= 2 && [...shorter].some((_, index) => {
      for (let length = Math.min(4, shorter.length - index); length >= 2; length -= 1) {
        if (longer.includes(shorter.slice(index, index + length))) return true
      }
      return false
    })
  }))
}

/** Produces concrete place-led queries; callers never search only for a city. */
export function buildJourneyImageQueries(journey: JourneyImageInput): string[] {
  const category = normalizeCategory(journey.category)
  const place = journey.places[0] ?? journey.district ?? journey.city
  const terms = category === 'date'
    ? ['夜景空景实拍', '江边日落空景', '餐厅环境空景', '暖光街景空景']
    : category === 'dining'
      ? ['菜品实物特写 无人物', '食物本体摄影 无人物', '餐桌空景实拍', '店内空景实拍']
      : category === 'weekend'
        ? ['街景空景实拍', '公园空景实景', '咖啡街区空景', '周末散步空景']
        : ['城市风景空景 高清', '街景空景摄影', '建筑空景实景', '旅行风光空景实拍']
  const placeQuerySuffixes = category === 'dining'
    ? ['菜品实物横图 无人物', '食物特写 无人物', '店内空景实拍']
    : ['空景高清横图 无人物', '空景实景摄影 无人物']
  const subjectSuffixes = /牛羊巴扎|牛羊|羊群/.test(`${journey.title} ${place}`)
    ? ['绵羊特写 纯动物 无人物', '羊群纯动物摄影 无人物', '牲畜空景摄影 无人物']
    : /八廓街转经|转经/.test(`${journey.title} ${place}`)
      ? ['寺院金顶空景 无人物', '转经道建筑空景 无人物']
      : /皮影戏/.test(`${journey.title} ${place}`)
        ? ['皮影戏舞台空景 无人物', '皮影道具特写 无人物']
        : /早市|菜场|菜市场|东巴扎|巴扎|市场/.test(`${journey.title} ${place}`)
          ? ['市场环境空景 无人物', '摊位空景摄影 无人物']
      : []
  const subjectSearchPlaces = /牛羊巴扎|牛羊|羊群/.test(`${journey.title} ${place}`)
    ? ['牛羊大巴扎', '牛羊市场']
    : /八廓街转经|转经/.test(`${journey.title} ${place}`)
      ? ['大昭寺', '八廓街']
      : /皮影戏/.test(`${journey.title} ${place}`)
        ? ['皮影戏', '皮影博物馆']
        : /早市|菜场|菜市场|东巴扎|巴扎|市场/.test(`${journey.title} ${place}`)
          ? [place.replace(/逛早市|早市|菜场|菜市场/g, '').trim() || place, '早市', '东巴扎']
      : []
  const routePlaceQuerySuffixes = [...subjectSuffixes, ...placeQuerySuffixes]
  const searchablePlaceName = searchablePlace(place)
  const subjectQueries = subjectSearchPlaces.flatMap((name) => subjectSuffixes.map((suffix) => `${journey.city} ${searchablePlace(name)} ${suffix}`))
  const placeQueries = journey.places.slice(0, 4).flatMap((name) => routePlaceQuerySuffixes.map((suffix) => `${journey.city} ${searchablePlace(name)} ${suffix}`))
  const dishQueries = category === 'dining'
    ? journey.places.slice(0, 4).flatMap((name) => {
        const parts = name.split(/[｜|]/).map(searchablePlace).filter(Boolean)
        const dishNames = parts.length > 1 ? parts.slice(1) : parts
        return dishNames.flatMap((dish) => [`${journey.city} ${dish} 菜品实物横图 无人物`, `${journey.city} ${dish} 美食实拍 无人物`])
      })
    : []
  const orderedPlaceQueries = category === 'dining'
    ? [...placeQueries.slice(0, 2), ...dishQueries, ...placeQueries.slice(2)]
    : [...subjectQueries, ...placeQueries]
  const timeQueries = (journey.timePeriods ?? []).slice(0, 2).map((period) => `${journey.city} ${searchablePlaceName} ${period} 实拍`)
  return unique([...orderedPlaceQueries, ...terms.map((term) => `${journey.city} ${searchablePlaceName} ${term}`), ...timeQueries, `${journey.city} ${searchablePlace(journey.title)} 实拍`]).slice(0, 10)
}

const hash = (value: string) => {
  let result = 2166136261
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619)
  return (result >>> 0).toString(16)
}





const placeSearchTerms = (place: string) => place.split(/[｜|]/).map(normalizePlaceName).filter((term) => term.length >= 2)
const placeMatchScore = (place: string, searchText: string) => placeSearchTerms(place)
  .filter((term) => searchText.includes(term))
  .reduce((score, term) => score + term.length, 0)
const bestPlaceIndex = (places: string[], searchText: string) => places
  .map((place, index) => ({ index, score: placeMatchScore(place, searchText) }))
  .filter(({ score }) => score > 0)
  .sort((left, right) => right.score - left.score)[0]?.index ?? -1
const matchedAcquiredPlace = (journey: JourneyImageInput, image: typeof acquiredJourneyImages[number]) => {
  const anchor = journey.places[0]
  if (!anchor) return undefined
  // The card subject is its first stop. A search query can mention later
  // stops, so it must never make a secondary-stop photo the card cover.
  if (image.placeName && placesMatch(image.placeName, anchor)) return anchor
  if (!image.placeName && bestPlaceIndex(journey.places, normalizePlaceName(image.searchQuery ?? '')) === 0) return anchor
  return undefined
}

const relevance = (candidate: ImageCandidate, journey: JourneyImageInput) => {
  const haystack = normalizePlaceName(`${candidate.placeName ?? ''} ${(candidate.relevanceHints ?? []).join(' ')}`)
  const routeSubjectText = normalizePlaceName(`${journey.title} ${(journey.tags ?? []).join(' ')}`)
  const exactPlaceIndex = journey.places.findIndex((place) => normalizePlaceName(candidate.placeName ?? '') === normalizePlaceName(place))
  const matchedPlaceIndex = exactPlaceIndex >= 0 ? exactPlaceIndex : bestPlaceIndex(journey.places, haystack)
  // The first stop is the route's cover subject. Secondary stops may still
  // qualify, but they should rank below the route anchor.
  const matchedPlace = matchedPlaceIndex === 0 ? 100 : matchedPlaceIndex > 0 ? Math.max(60, 70 - matchedPlaceIndex * 5) : 0
  const city = matchedPlaceIndex < 0 && haystack.includes(journey.city.toLowerCase()) ? 10 : 0
  const matchedActivity = (journey.activities ?? []).some((activity) => activity.length >= 2 && haystack.includes(activity.toLowerCase())) ? 10 : 0
  const matchedCategory = normalizeCategory(journey.category) === 'dining' && diningAssetPattern.test(haystack) ? 65 : 0
  const matchedRouteSubject = candidate.placeName && normalizePlaceName(candidate.placeName).length >= 2 && routeSubjectText.includes(normalizePlaceName(candidate.placeName)) ? 78 : 0
  return Math.min(100, Math.max(matchedCategory, matchedRouteSubject, city + matchedPlace + matchedActivity))
}

export function inspectCandidate(candidate: ImageCandidate, journey: JourneyImageInput, usedHashes = new Set<string>()) {
  const reasons: RejectReason[] = []
  const longEdge = Math.max(candidate.width, candidate.height)
  if (!candidate.localPath || !candidate.width || !candidate.height) reasons.push('broken_file')
  if (longEdge < 1000) reasons.push('too_small')
  if ((candidate.sharpnessScore ?? 100) < 40) reasons.push('blur')
  if (candidate.hasOverlayText || (candidate.textAreaRatio ?? 0) > .65) reasons.push('overlay_text')
  // User-facing covers must be clean source photos. A food cover is the dish
  // itself, and a travel cover is an empty scene rather than a person-led
  // social frame.
  if (likelyWatermark(candidate)) reasons.push('watermark')
  if (hasPeopleHint(candidate)) reasons.push('people')
  if (candidate.hasQrCode) reasons.push('qr_code')
  if (candidate.isScreenshot) reasons.push('screenshot')
  if (candidate.isCollage) reasons.push('collage')
  if (candidate.hasBlackBorder || (candidate.blackBorderRatio ?? 0) >= .012) reasons.push('black_border')
  if (candidate.hasDecorativeBorder || (candidate.decorativeBorderScore ?? 0) >= .7) reasons.push('decorative_border')
  // A landmark's own sign, museum facade or shop frontage is part of the
  // scene and can make a route more recognisable. Reject signage only when it
  // appears together with overlay-like text or a screen/collage signal.
  if ((candidate.isSignage || (candidate.signageScore ?? 0) >= .08) && (candidate.hasOverlayText || candidate.isScreenshot || candidate.isCollage)) reasons.push('signage')
  if (candidate.aspectRatio < 1.05) reasons.push('portrait')
  if (usedHashes.has(candidate.imageHash)) reasons.push('duplicate')
  const relevanceScore = relevance(candidate, journey)
  const resolutionScore = Math.min(100, Math.round(longEdge / 19.2 * 100))
  const sharpnessScore = candidate.sharpnessScore ?? 80
  const textScore = candidate.hasOverlayText ? 0 : Math.max(0, 100 - Math.round((candidate.textAreaRatio ?? 0) * 300))
  const aspectScore = candidate.aspectRatio >= 1.15 && candidate.aspectRatio <= 2.2
    ? Math.max(0, 100 - Math.abs(candidate.aspectRatio - 1.55) * 55)
    : candidate.aspectRatio >= .85 && candidate.aspectRatio <= 2.6 ? 48 : 20
  const qualityScore = Math.round(relevanceScore * .42 + resolutionScore * .18 + sharpnessScore * .12 + textScore * .12 + aspectScore * .1 + 6)
  return { reasons, qualityScore, relevanceScore, sharpnessScore, textScore }
}

export function rankJourneyImages(journey: JourneyImageInput, candidates: ImageCandidate[], usedHashes = new Set<string>()) {
  const inspected = candidates.map((candidate) => ({ candidate, result: inspectCandidate(candidate, journey, usedHashes) }))
  const accepted = inspected.filter(({ result }) => result.reasons.length === 0)
    .sort((a, b) => b.result.qualityScore - a.result.qualityScore)
    .slice(0, 5)
    .map(({ candidate, result }, index): JourneyImage => {
      const { reasons: _reasons, ...scores } = result
      return { ...candidate, ...scores, sharpnessScore: result.sharpnessScore, textScore: result.textScore, selected: index === 0 }
    })
  return { accepted, rejected: inspected.filter(({ result }) => result.reasons.length > 0) }
}

/** Provider boundary: public-only providers report blocked instead of retrying around access controls. */
export const blockedProvider = (source: Extract<ImageSource, 'baidu' | 'xiaohongshu' | 'douyin'>): ImageProvider => ({
  source,
  search: async () => ({ provider: source, candidates: [], blocked: true, reason: 'PROVIDER_BLOCKED' }),
})

type BaiduSearchRecord = {
  title?: string
  fromPageTitle?: string
  fromURL?: string
  middleURL?: string
  thumbURL?: string
  width?: number | string
  height?: number | string
  replaceUrl?: Array<{ ObjURL?: string; ObjUrl?: string; FromURL?: string; FromUrl?: string; URL?: string; Url?: string }>
}

const baiduNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const baiduDirectUrl = (record: BaiduSearchRecord) => {
  const replacement = record.replaceUrl?.find((entry) => entry.ObjURL || entry.ObjUrl || entry.URL || entry.Url)
  return replacement?.ObjURL || replacement?.ObjUrl || replacement?.URL || replacement?.Url || record.middleURL || record.thumbURL || ''
}

const safeUrl = (value: string) => {
  try { return new URL(value).toString() } catch { return '' }
}

/** Public Baidu image JSON endpoint. It returns remote candidates only; downloading remains a caller responsibility. */
export async function searchBaiduImages(query: string, limit = 30, signal?: AbortSignal): Promise<ImageCandidate[]> {
  const encoded = encodeURIComponent(query)
  const endpoint = `https://image.baidu.com/search/acjson?tn=resultjson_com&logid=1&ipn=rj&ct=201326592&fp=result&queryWord=${encoded}&word=${encoded}&ie=utf-8&oe=utf-8&pn=0&rn=${Math.min(60, Math.max(1, limit))}&face=0&istype=2`
  const response = await fetch(endpoint, {
    signal,
    headers: {
      accept: 'application/json,text/plain,*/*',
      referer: 'https://image.baidu.com/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
    },
  })
  if (!response.ok) throw new Error(`Baidu image search failed (${response.status})`)
  const payload = await response.json() as { data?: BaiduSearchRecord[] }
  return (payload.data ?? []).filter((record) => record && typeof record === 'object').map((record, index) => {
    const originalUrl = safeUrl(baiduDirectUrl(record))
    const sourceUrl = safeUrl(record.fromURL ?? '') || `https://image.baidu.com/search/index?word=${encoded}`
    const width = baiduNumber(record.width)
    const height = baiduNumber(record.height)
    return {
      id: `baidu-${hash(`${query}|${originalUrl}|${index}`)}`,
      journeyId: '',
      source: 'baidu',
      sourceUrl,
      originalUrl,
      localPath: originalUrl ? `remote:${originalUrl}` : '',
      cachedUrl: '',
      width,
      height,
      aspectRatio: width && height ? width / height : 0,
      category: 'travel',
      city: query.split(/\s+/)[0] ?? '',
      placeName: undefined,
      searchQuery: query,
      fileSize: undefined,
      hasOverlayText: false,
      hasWatermark: false,
      hasQrCode: false,
      isScreenshot: false,
      isCollage: false,
      imageHash: hash(originalUrl || `${query}|${index}`),
      pHash: undefined,
      dHash: undefined,
      createdAt: new Date().toISOString(),
      relevanceHints: [query, record.title ?? record.fromPageTitle ?? ''],
      downloaded: false,
      author: undefined,
      noteId: undefined,
      noteUrl: undefined,
    } satisfies ImageCandidate
  }).filter((candidate) => candidate.originalUrl)
}

export const BaiduImageProvider: ImageProvider = {
  source: 'baidu',
  search: async (queries, signal) => {
    const candidates: ImageCandidate[] = []
    const seen = new Set<string>()
    let lastError = ''
    for (const query of queries) {
      try {
        const results = await searchBaiduImages(query, 30, signal)
        for (const result of results) {
          if (seen.has(result.originalUrl)) continue
          seen.add(result.originalUrl)
          candidates.push(result)
        }
      } catch (error) {
        // One malformed public response should not discard the other query
        // variants; keep collecting without retrying the failed endpoint.
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
    return { provider: 'baidu', candidates, ...(lastError && candidates.length === 0 ? { blocked: false, reason: lastError } : {}) }
  },
}
export const XiaohongshuProvider = blockedProvider('xiaohongshu')
export const DouyinProvider = blockedProvider('douyin')

export function cachedWikimediaCandidates(journey: JourneyImageInput, gallery: CityImage[]): ImageCandidate[] {
  const category = normalizeCategory(journey.category)
  // Only dining routes should force a food-only cover. Scenic place names can
  // contain a food character (for example, 沙面岛 contains “面”) without
  // describing a dish.
  const foodOnlyRoute = category === 'dining' && (
    isFoodRouteTitle(journey.title) || foodPlaceNamePattern.test(journey.places[0] ?? '')
  )
  const query = buildJourneyImageQueries(journey)[0] ?? journey.city
  const routeSubjectText = normalizePlaceName(`${journey.title} ${(journey.tags ?? []).join(' ')}`)
  const cached: ImageCandidate[] = gallery
    // A city-wide skyline is not a valid cover for a route about a specific
    // museum, food or attraction. Keep only gallery photos tied to one of the
    // route's actual stops; acquired images are filtered by the same rule below.
    .filter((image) => image.routeEligible !== false && isUserFacingCover(image.src)
      && !peopleHintPattern.test(textWithoutNoPeopleInstruction(image.alt))
      && (!foodOnlyRoute || image.kind === 'food')
      && (journey.places.some((place) => placesMatch(image.landmark, place) || image.alt.includes(place)
        || (foodOnlyRoute && image.kind === 'food' && foodPlaceMatches(image.landmark, place)))
      || (image.landmark.length >= 2 && routeSubjectText.includes(normalizePlaceName(image.landmark)))
      // Xinghai Bay Bridge is a clean, place-matched view along the Binhai
      // Road route, even though the Commons title uses the bridge name.
      || (journey.city === '大连' && journey.places[0] === '滨海路' && image.landmark === '星海湾大桥')
      || (category === 'dining' && (image.kind === 'food' || diningAssetPattern.test(`${image.landmark} ${image.alt}`)))) )
    .map((image, index): ImageCandidate => ({
    id: `${journey.id}-cached-${index + 1}`,
    journeyId: journey.id,
    source: 'wikimedia',
    sourceUrl: image.sourceUrl,
    originalUrl: image.downloadUrl,
    localPath: image.src,
    cachedUrl: image.src,
    width: 1280,
    height: 853,
    aspectRatio: 1280 / 853,
    category,
    city: journey.city,
    kind: image.kind,
    placeName: journey.city === '大连' && journey.places[0] === '滨海路' && image.landmark === '星海湾大桥' ? '滨海路' : image.landmark,
    searchQuery: image.kind === 'food' ? `${journey.city} ${image.landmark} 菜品实物 无人物` : query,
    hasOverlayText: false,
    hasWatermark: false,
    hasQrCode: false,
    isScreenshot: false,
    isCollage: false,
    imageHash: hash(image.src),
    createdAt: new Date(0).toISOString(),
    relevanceHints: [journey.city, image.landmark, image.alt],
    sharpnessScore: 80,
    textAreaRatio: 0,
    }))
  type AcquiredImageWithDecorativeBorder = typeof acquiredJourneyImages[number] & {
    kind?: 'landmark' | 'food'
    decorativeBorderScore?: number
    hasDecorativeBorder?: boolean
  }
  const acquired = ((acquiredByCity.get(journey.city) ?? []) as AcquiredImageWithDecorativeBorder[])
    // A downloaded image belongs to the place it was searched for. Do not
    // reuse it as a city-wide fallback for an unrelated route.
    // A clean photo of the same real place remains valid when another route
    // uses it under a different theme (travel, weekend or dining). The city
    // and place match stay mandatory; the route category only affects ranking.
    .flatMap((image) => {
      if (image.city !== journey.city) return []
      const placeName = matchedAcquiredPlace(journey, image)
      return placeName ? [{ image, placeName }] : []
    })
    .map(({ image, placeName }): ImageCandidate => ({
      id: image.id,
      journeyId: journey.id,
      sourceJourneyId: image.journeyId,
      source: (image.source ?? 'wikimedia') as ImageSource,
      sourceUrl: image.sourceUrl,
      originalUrl: image.originalUrl,
      localPath: image.localPath,
      cachedUrl: image.localPath,
      width: image.width,
      height: image.height,
      aspectRatio: image.width / image.height,
      fileSize: image.fileSize,
      category,
      city: image.city,
      kind: image.kind ?? (foodOnlyRoute && foodImageQueryPattern.test(image.searchQuery ?? '') ? 'food' : undefined),
      placeName,
      searchQuery: image.searchQuery || query,
      hasOverlayText: image.hasOverlayText ?? false,
      // The visual review list overrides automated false positives for the
      // two clean, manually checked covers that carry a noisy detector score.
      hasWatermark: curatedCleanCoverPaths.has(image.localPath) ? false : image.hasWatermark ?? false,
      hasPeople: image.hasPeople,
      peopleHint: image.peopleHint,
      hasQrCode: image.hasQrCode ?? false,
      isScreenshot: image.isScreenshot ?? false,
      isCollage: image.isCollage ?? false,
      blackBorderRatio: image.blackBorderRatio,
      hasBlackBorder: image.hasBlackBorder,
      decorativeBorderScore: image.decorativeBorderScore,
      hasDecorativeBorder: image.hasDecorativeBorder,
      signageScore: image.signageScore,
      isSignage: image.isSignage,
      imageHash: image.imageHash ?? hash(image.localPath),
      createdAt: image.retrievedAt,
      relevanceHints: [image.city, image.placeName, image.searchQuery],
      sharpnessScore: image.sharpnessScore ?? 80,
      textAreaRatio: image.textAreaRatio ?? 0,
      textRegionCount: image.textRegionCount,
      watermarkScore: image.watermarkScore,
      visionEngine: image.visionEngine,
      author: image.author,
      noteId: image.noteId,
      noteUrl: image.noteUrl,
    }))
  return [...acquired, ...cached]
}

export function selectJourneyCover(journey: JourneyImageInput, gallery: CityImage[], usedHashes = new Set<string>()) {
  if (journey.manualOverride && isUserFacingCover(journey.manualOverride.cachedUrl)) return { image: { ...journey.manualOverride, selected: true, manualOverride: true }, status: 'ready' as const, rejected: [] }
  const isDining = normalizeCategory(journey.category) === 'dining'
  const foodOnlyRoute = isDining && (
    isFoodRouteTitle(journey.title) || foodPlaceNamePattern.test(journey.places[0] ?? '')
  )
  const isFoodCandidate = (candidate: ImageCandidate) => candidate.kind === 'food' || foodImageQueryPattern.test(candidate.searchQuery)
  const anchor = journey.places[0] ?? ''
  const subjectTerms = foodOnlyRoute ? foodSubjectTerms(journey) : []
  const candidates = cachedWikimediaCandidates(journey, gallery)
    .filter((candidate) => isUserFacingCover(candidate.cachedUrl))
    .filter((candidate) => !foodOnlyRoute || isFoodCandidate(candidate))
  const ownCandidates = candidates.filter((candidate) => candidate.sourceJourneyId === journey.id)
  const normalizedAnchor = normalizePlaceName(anchor)
  const anchorCandidates = candidates.filter((candidate) => placesMatch(candidate.placeName, anchor)
    || (foodOnlyRoute && candidate.kind === 'food' && foodPlaceMatches(candidate.placeName, anchor)))
  const exactAnchorCandidates = anchorCandidates.filter((candidate) => normalizePlaceName(candidate.placeName ?? '') === normalizedAnchor)
  const exactAnchorRanked = rankJourneyImages(journey, exactAnchorCandidates, usedHashes)
  const ranked = rankJourneyImages(journey, candidates, usedHashes)
  const ownRanked = ownCandidates.length ? rankJourneyImages(journey, ownCandidates, usedHashes) : undefined
  // The first stop is the card's subject. An acquired photo from the same
  // route must not outrank a clean, unused photo of that first stop.
  const preferred = exactAnchorRanked.accepted.length
    ? exactAnchorRanked
    : ownRanked?.accepted.length ? ownRanked : ranked
  const allDiningCandidates = candidates.filter((candidate) => isFoodCandidate(candidate) && !/店内|环境/.test(candidate.searchQuery))
  const diningCandidates = (ownRanked?.accepted.length ? ownCandidates : candidates).filter((candidate) => isFoodCandidate(candidate) && !/店内|环境/.test(candidate.searchQuery))
  const subjectDining = subjectTerms.length
    ? rankJourneyImages(journey, allDiningCandidates.filter((candidate) => subjectTerms.some((term) => searchablePlace(candidate.searchQuery).includes(term))), usedHashes).accepted[0]
    : undefined
  const curatedDining = foodOnlyRoute
    ? subjectDining ?? rankJourneyImages(journey, diningCandidates.length ? diningCandidates : allDiningCandidates, usedHashes).accepted[0]
    : undefined
  const image = foodOnlyRoute
    ? curatedDining ?? preferred.accepted.find((candidate) => candidate.relevanceScore >= 60 && !/店内|环境/.test(candidate.searchQuery))
    : preferred.accepted.find((candidate) => candidate.relevanceScore >= 60)
  return image ? { image, status: image.relevanceScore >= 60 ? 'ready' as const : 'fallback' as const, rejected: ranked.rejected } : { image: undefined, status: 'fallback' as const, rejected: ranked.rejected }
}
