import { extractDietaryProfile, foodCompatibilityIssues } from './dietary'

export type GuidePlatform = 'xiaohongshu' | 'bilibili' | 'douyin' | 'user-import' | 'licensed-search'

export type GuideClaimType = 'place' | 'activity' | 'tip' | 'route' | 'food'

export type GuideClaim = {
  type: GuideClaimType
  text: string
  placeName?: string
  confidence: number
  verified: boolean
}

/**
 * A short, source-preserving community signal. It is deliberately not a
 * mirror of a social post: the knowledge base stores derived hints and a
 * canonical source link, not the original post body or images.
 */
export type GuideCandidate = {
  id: string
  city: string
  platform: GuidePlatform
  sourceUrl: string
  title: string
  author: string
  publishedAt: string | null
  fetchedAt: string
  likes: number | null
  summary: string
  tags: string[]
  placeHints: string[]
  /** Short food terms extracted from titles or user-visible detail text. */
  foodHints?: string[]
  /** Local-life activities surfaced by community content. */
  localExperienceHints?: string[]
  /** Hotel experience labels derived from community content. */
  hotelHints?: string[]
  /** Named hotels surfaced by a community title or detail field. */
  hotelNames?: string[]
  /** Coarse food-risk labels used before a community hint enters a plan. */
  dietaryTags?: string[]
  claims: GuideClaim[]
  permission: 'user-provided' | 'licensed' | 'unknown'
}

export type GuideKnowledgeBase = {
  version: 1
  generatedAt: string
  guides: GuideCandidate[]
}

export type GuideContext = {
  city: string
  candidates: GuideCandidate[]
  matchedTerms: string[]
  generatedAt: string
  disclaimer: string
}

const namedFoodVenueSuffix = /(?:饭店|饭馆|餐馆|面馆|粉店|汤包店|小吃店|小吃部|小吃|烧烤店|火锅店|串串店|菜馆|小馆|食堂|大排档|小食店|老店)$/

/** Keep concrete shop names, but reject title prose such as “每天饭店”. */
export function isNamedFoodVenue(value: string) {
  const name = value.trim()
  const suffix = name.match(namedFoodVenueSuffix)?.[0]
  if (!suffix) return false
  const prefix = name.slice(0, -suffix.length)
  if (prefix.length < 2 || prefix.length > 14) return false
  return !/\d|的|里|这|那|一家|一个|附近|本地|宝藏|网红|社区|居民楼|店内|全是|欢迎|每天|都是|这样的|开了|藏在|苍蝇|著名|百年|刻意买|代加工|名菜|特色|好吃|便宜|推荐/.test(prefix)
    && !prefix.endsWith('名')
}

export function guidePlatformLabel(platform: GuidePlatform) {
  if (platform === 'xiaohongshu') return '小红书'
  if (platform === 'bilibili') return 'B站'
  if (platform === 'douyin') return '抖音'
  if (platform === 'user-import') return '用户导入'
  return '授权来源'
}

export function guidePlatformsLabel(candidates: GuideCandidate[]) {
  return [...new Set(candidates.map((candidate) => guidePlatformLabel(candidate.platform)))].join('、') || '社区'
}

export function searchGuideCandidates(
  knowledgeBase: GuideKnowledgeBase,
  city: string,
  query = '',
  limit = 5,
): GuideContext {
  const normalized = query.trim().toLowerCase()
  const terms = normalized.split(/[\s,，、。；;]+/).filter((term) => term.length >= 2)
  const wantsFood = /本地美食|小吃|逛吃|吃|餐|早市|夜市/.test(normalized)
  const wantsLocal = /本地人|土著|当地人|市井|烟火|早市|夜市|菜市场|洗浴|茶馆|采耳|骑行|赶海/.test(normalized)
  const wantsHotel = /酒店|住宿|民宿|客栈|住/.test(normalized)
  const cityGuides = knowledgeBase.guides.filter((guide) => guide.city === city)
  const dietary = extractDietaryProfile(query)
  const compatibleGuides = cityGuides.filter((guide) => {
    const foodText = [
      guide.title,
      guide.summary,
      ...(guide.foodHints ?? []),
      ...(guide.dietaryTags ?? []),
      ...guide.claims.filter((claim) => claim.type === 'food').map((claim) => claim.text),
    ].join(' ')
    const hasFoodSignal = (guide.foodHints?.length ?? 0) > 0 || guide.claims.some((claim) => claim.type === 'food') || /美食|小吃|吃|餐|火锅|海鲜/.test(foodText)
    return !hasFoodSignal || foodCompatibilityIssues(foodText, dietary, guide.dietaryTags).length === 0
  })
  const scored = compatibleGuides.map((guide) => {
    const haystack = [
      guide.title,
      guide.summary,
      ...guide.tags,
      ...guide.placeHints,
      ...(guide.foodHints ?? []),
      ...(guide.localExperienceHints ?? []),
      ...(guide.hotelHints ?? []),
      ...(guide.hotelNames ?? []),
      ...guide.claims.map((claim) => claim.text),
    ].join(' ').toLowerCase()
    const termScore = terms.reduce((score, term) => score + (haystack.includes(term) ? 2 : 0), 0)
    const communityScore = guide.likes !== null && guide.likes >= 500 ? 1 : 0
    const hintScore = (wantsFood && (guide.foodHints?.length ?? 0) > 0 ? 4 : 0)
      + (wantsLocal && (guide.localExperienceHints?.length ?? 0) > 0 ? 4 : 0)
      + (wantsHotel && ((guide.hotelHints?.length ?? 0) > 0 || (guide.hotelNames?.length ?? 0) > 0) ? 5 : 0)
    return { guide, score: termScore + communityScore + hintScore }
  }).sort((left, right) => right.score - left.score || (right.guide.likes ?? 0) - (left.guide.likes ?? 0))

  return {
    city,
    candidates: scored.slice(0, limit).map(({ guide }) => guide),
    matchedTerms: terms,
    generatedAt: knowledgeBase.generatedAt,
    disclaimer: '公开资料只用于发现地点线索；路线和预约规则会随日期变化，请在详情页确认。',
  }
}

export function emptyGuideContext(city: string, generatedAt = new Date(0).toISOString()): GuideContext {
  return {
    city,
    candidates: [],
    matchedTerms: [],
    generatedAt,
    disclaimer: '公开资料只用于发现地点线索；路线和预约规则会随日期变化，请在详情页确认。',
  }
}
