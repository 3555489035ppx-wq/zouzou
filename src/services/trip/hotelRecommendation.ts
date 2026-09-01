import type { GuideCandidate, GuideContext, GuidePlatform } from './guides'
import type { CityKnowledge, HotelOption, KnowledgeSource } from './cityKnowledge'
import type { TripIntent } from './planner'

const hotelHintRules: Array<[string, RegExp]> = [
  ['性价比', /性价比|平价|便宜|省钱|低价|预算/i],
  ['交通方便', /地铁|公交|车站|交通方便|出门就是|直达|换乘/i],
  ['近景点/片区', /步行可达|靠近|附近|离.{0,12}(景区|景点|博物馆|古镇|步行街)|就在.{0,12}(景区|景点|博物馆|古镇|步行街)/i],
  ['周边吃饭方便', /楼下.*(市场|吃)|周边.*(美食|吃)|附近.*(美食|吃)|逛吃/i],
  ['景观', /海景|江景|湖景|景观|看日出|看日落/i],
  ['安静舒适', /安静|舒适|隔音|睡得好/i],
  ['避坑提醒', /避坑|避雷|踩坑|不踩坑/i],
  ['早餐', /早餐|早饭/i],
  ['本地人提及', /本地人|当地人|土著/i],
]

const genericHotelName = /攻略|指南|排行榜|推荐|测评|大测评|必住|哪里住|住哪里|住宿|附近|酒店餐厅|民宿酒店|酒店民宿|酒店攻略|住酒店|普通人|高奢|豪华|奢华|价格|活动|一次|这家|这间|性价比|五星级|旅游酒店|景区酒店|高品质酒店|超便宜|便宜|三家|机场酒店|提及酒店|一晚|位数|四位|三位|高端酒店|高档酒店|平价酒店|经济型酒店|品质酒店|酒店名|酒店选择|酒店推荐|粉丝找到|住一家酒店|最好的酒店|连锁酒店|不能住民宿|千万不能住民宿|分享一家.*酒店|来住.*酒店|来.+酒店$|暑假.*酒店|五一.*酒店|赶紧.*酒店|把酒店$|喷水池酒店|塔景酒店|全季酒店|感受非常好.*酒店|非常好的酒店|很好的酒店/i

const unique = (items: string[]) => [...new Set(items.filter(Boolean))]

export function extractHotelExperienceHints(text: string) {
  return hotelHintRules.filter(([, pattern]) => pattern.test(text)).map(([hint]) => hint)
}

/**
 * Extract only explicit hotel-like names. Generic phrases such as “酒店攻略”
 * are intentionally discarded so a search title cannot become a fake hotel.
 */
export function extractHotelNames(text: string, city?: string) {
  const segments = text.split(/[\n，。！？；;#|丨]+/).map((segment) => segment.trim()).filter(Boolean)
  const names = segments.flatMap((segment) => {
    const matches = segment.match(/[\u4e00-\u9fa5A-Za-z0-9·&（）()]{2,24}(?:酒店|民宿|客栈)/g) ?? []
    return matches
      .map((name) => name
        .replace(/^.*(?:的是|为|叫|推荐|入住|住在|喜欢住|住过|住了|选了|选择了|去住)/, '')
        .replace(city && name.startsWith(city) ? new RegExp(`^${city}`) : /^$/, '')
        .replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, '')
        .trim())
      .filter((name) => name.length >= 3 && name !== '酒店' && !genericHotelName.test(name))
  })
  return unique(names).slice(0, 6)
}

function normalizeHotelName(name: string, city: string) {
  const normalized = name.startsWith(city) ? name.slice(city.length) : name
  return normalized.trim()
}

function guideText(guide: GuideCandidate) {
  return [
    guide.title,
    guide.summary,
    ...guide.tags,
    ...(guide.hotelHints ?? []),
    ...(guide.hotelNames ?? []),
  ].join(' ')
}

function sourceFromGuide(guide: GuideCandidate, hotelName?: string): KnowledgeSource {
  return {
    label: `走走知识库公开住宿线索${hotelName ? `：${hotelName}` : ''}`,
    url: guide.sourceUrl,
    kind: 'community',
    checkedAt: guide.fetchedAt.slice(0, 10) || '公开资料日期未标注',
  }
}

function platformLabel(platform: GuidePlatform) {
  if (platform === 'xiaohongshu') return '小红书'
  if (platform === 'bilibili') return 'B站'
  if (platform === 'douyin') return '抖音'
  if (platform === 'user-import') return '用户导入'
  return '授权来源'
}

export type HotelCommunitySignal = {
  label: string
  evidenceCount: number
  platforms: string[]
  sourceUrls: string[]
  anchorTerms: string[]
}

export function getHotelCommunitySignals(guideContext?: GuideContext): HotelCommunitySignal[] {
  const signals = new Map<string, HotelCommunitySignal>()
  const contextCity = guideContext?.city ?? ''
  for (const guide of guideContext?.candidates ?? []) {
    if (contextCity && !guide.title.includes(contextCity)) continue
    const text = guideText(guide)
    const hints = unique([
      ...(guide.hotelHints ?? []),
      ...extractHotelExperienceHints(text),
    ])
    for (const label of hints) {
      const current = signals.get(label) ?? { label, evidenceCount: 0, platforms: [], sourceUrls: [], anchorTerms: [] }
      current.evidenceCount += 1
      current.platforms = unique([...current.platforms, platformLabel(guide.platform)])
      current.sourceUrls = unique([...current.sourceUrls, guide.sourceUrl])
      current.anchorTerms = unique([...current.anchorTerms, ...guide.placeHints]).slice(0, 6)
      signals.set(label, current)
    }
  }
  return [...signals.values()].sort((left, right) => right.evidenceCount - left.evidenceCount || left.label.localeCompare(right.label))
}

function inferTier(text: string): HotelOption['tier'] {
  if (/经济|平价|便宜|低价|青旅|青年旅舍|客栈/i.test(text)) return 'budget'
  if (/五星|豪华|高端|奢华|度假|洲际|希尔顿|万豪|香格里拉|丽思卡尔顿/i.test(text)) return 'premium'
  return 'comfort'
}

function defaultNightly(tier: HotelOption['tier']) {
  if (tier === 'budget') return { min: 180, max: 320 }
  if (tier === 'premium') return { min: 700, max: 1300 }
  return { min: 360, max: 620 }
}

function communityHotelOptions(city: string, guides: GuideCandidate[]): HotelOption[] {
  const byName = new Map<string, GuideCandidate[]>()
  for (const guide of guides.filter((item) => item.title.includes(city))) {
    const names = unique([...(guide.hotelNames ?? []), ...extractHotelNames(guideText(guide), city)])
      .map((name) => normalizeHotelName(name, city))
      .filter((name) => name.length >= 3 && name !== '酒店' && !genericHotelName.test(name))
      .filter((name, index, allNames) => allNames.indexOf(name) === index)
    for (const name of names) byName.set(name, [...(byName.get(name) ?? []), guide])
  }
  return [...byName.entries()].map(([name, matches]) => {
    const first = matches[0]
    const text = matches.map(guideText).join(' ')
    const tags = unique(matches.flatMap((guide) => [
      ...(guide.hotelHints ?? []),
      ...extractHotelExperienceHints(guideText(guide)),
    ])).slice(0, 5)
    const anchorTerms = unique(matches.flatMap((guide) => guide.placeHints)).slice(0, 4)
    const source = sourceFromGuide(first, name)
    const sources = unique(matches.map((guide) => guide.sourceUrl)).map((url) => {
      const guide = matches.find((item) => item.sourceUrl === url) ?? first
      return sourceFromGuide(guide, name)
    })
    const tier = inferTier(text)
    const nightly = defaultNightly(tier)
    return {
      id: `${city}-community-hotel-${name}`,
      name,
      area: anchorTerms.length > 0 ? `${anchorTerms[0]}附近` : '公开资料标注片区',
      tier,
      nightly,
      summary: `走走推荐的住宿候选；${tags.length > 0 ? `匹配条件：${tags.join('、')}。` : ''}价格、房型、房态和具体距离按当天公开信息为准。`,
      source,
      verified: false,
      communityTags: tags,
      communityEvidence: matches.length,
      communitySources: sources,
      anchorTerms,
      mapUrl: `https://ditu.amap.com/search?query=${encodeURIComponent(`${city} ${name}`)}`,
      bookingUrl: `https://hotels.ctrip.com/hotels/list?keyword=${encodeURIComponent(`${city} ${name}`)}`,
    }
  })
}

function enrichBaseOption(city: string, option: HotelOption, signals: HotelCommunitySignal[]): HotelOption {
  const tags = signals.slice(0, 5).map((signal) => signal.label)
  const sourceUrls = unique(signals.flatMap((signal) => signal.sourceUrls))
  const communitySources = sourceUrls.map((url) => {
    const signal = signals.find((item) => item.sourceUrls.includes(url))
    return {
      label: '走走知识库公开住宿线索',
      url,
      kind: 'community' as const,
      checkedAt: '公开资料日期未标注',
    }
  })
  return {
    ...option,
    communityTags: tags.length > 0 ? tags : option.communityTags,
    communityEvidence: signals.reduce((total, signal) => total + signal.evidenceCount, 0) || option.communityEvidence,
    communitySources: communitySources.length > 0 ? communitySources : option.communitySources,
    anchorTerms: unique([...(option.anchorTerms ?? []), ...signals.flatMap((signal) => signal.anchorTerms)]).slice(0, 6),
    mapUrl: option.mapUrl ?? `https://ditu.amap.com/search?query=${encodeURIComponent(`${city} ${option.name}`)}`,
    bookingUrl: option.bookingUrl ?? `https://hotels.ctrip.com/hotels/list?keyword=${encodeURIComponent(`${city} ${option.name}`)}`,
  }
}

function queryTokens(intent: TripIntent) {
  return unique(`${intent.hotel ?? ''} ${intent.mustVisit.join(' ')}`
    .split(/[\s，,、。；;：:]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !/酒店|住宿|附近|性价比|预算/.test(term)))
}

function scoreHotel(option: HotelOption, intent: TripIntent, signals: HotelCommunitySignal[], isNamed: boolean) {
  const tokens = queryTokens(intent)
  const searchable = [option.name, option.area, ...(option.anchorTerms ?? [])].join(' ')
  const areaScore = tokens.reduce((score, token) => score + (searchable.includes(token) ? 8 : 0), 0)
  const nightlyTarget = intent.budget !== null && intent.nights > 0 ? intent.budget / intent.nights * 0.34 : null
  const midpoint = (option.nightly.min + option.nightly.max) / 2
  const budgetScore = nightlyTarget === null
    ? 0
    : option.nightly.min <= nightlyTarget
      ? Math.max(0, 6 - Math.round(Math.abs(midpoint - nightlyTarget) / 120))
      : -Math.min(6, Math.ceil((option.nightly.min - nightlyTarget) / 100))
  const tagScore = (option.communityTags ?? []).reduce((score, tag) => score + (signals.some((signal) => signal.label === tag) ? 1 : 0), 0)
  const evidenceScore = Math.min(5, option.communityEvidence ?? 0)
  return areaScore + budgetScore + tagScore + evidenceScore + (isNamed ? 3 : 0)
}

export function getHotelRecommendations(knowledge: CityKnowledge, intent: TripIntent, guideContext?: GuideContext) {
  const signals = getHotelCommunitySignals(guideContext)
  const baseOptions = knowledge.hotelOptions.map((option) => enrichBaseOption(knowledge.city, option, signals))
  const namedOptions = communityHotelOptions(knowledge.city, guideContext?.candidates ?? [])
  const options = [...namedOptions, ...baseOptions]
  const uniqueOptions = [...new Map(options.map((option) => [option.name, option])).values()]
  const ranked = uniqueOptions
    .map((option) => ({ option, score: scoreHotel(option, intent, signals, namedOptions.some((item) => item.id === option.id)) }))
    .sort((left, right) => right.score - left.score || (right.option.communityEvidence ?? 0) - (left.option.communityEvidence ?? 0) || left.option.name.localeCompare(right.option.name))
  const chosen: HotelOption[] = []
  for (const tier of ['budget', 'comfort', 'premium'] as const) {
    const match = ranked.find((entry) => entry.option.tier === tier)
    if (match) chosen.push(match.option)
  }
  ranked.forEach(({ option }) => {
    if (chosen.length < 3 && !chosen.some((item) => item.name === option.name)) chosen.push(option)
  })
  return chosen.slice(0, 3)
}

export function hotelOptionReason(option: HotelOption) {
  const tags = option.communityTags?.slice(0, 3) ?? []
  if (tags.length > 0) return `走走推荐：${tags.join('、')}；价格和房态按当天公开信息为准`
  return '走走推荐：按预算档位和住宿片区匹配，价格和房态按当天公开信息为准'
}

export function hotelOptionMeta(option: HotelOption) {
  const tier = option.tier === 'budget' ? '经济' : option.tier === 'comfort' ? '舒适' : '高星'
  return `${option.area} · ${tier} · ¥${option.nightly.min}–${option.nightly.max}/晚`
}
