export type GuidePlatform = 'xiaohongshu' | 'user-import' | 'licensed-search'

export type GuideClaimType = 'place' | 'activity' | 'tip' | 'route'

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

export function searchGuideCandidates(
  knowledgeBase: GuideKnowledgeBase,
  city: string,
  query = '',
  limit = 5,
): GuideContext {
  const normalized = query.trim().toLowerCase()
  const terms = normalized.split(/[\s,，、。；;]+/).filter((term) => term.length >= 2)
  const cityGuides = knowledgeBase.guides.filter((guide) => guide.city === city)
  const scored = cityGuides.map((guide) => {
    const haystack = [guide.title, guide.summary, ...guide.tags, ...guide.placeHints, ...guide.claims.map((claim) => claim.text)].join(' ').toLowerCase()
    const termScore = terms.reduce((score, term) => score + (haystack.includes(term) ? 2 : 0), 0)
    const communityScore = guide.likes !== null && guide.likes >= 500 ? 1 : 0
    return { guide, score: termScore + communityScore }
  }).sort((left, right) => right.score - left.score || (right.guide.likes ?? 0) - (left.guide.likes ?? 0))

  return {
    city,
    candidates: scored.slice(0, limit).map(({ guide }) => guide),
    matchedTerms: terms,
    generatedAt: knowledgeBase.generatedAt,
    disclaimer: '社区攻略只用于发现体验线索；价格、营业时间、路线和预约状态需要出行前复核。',
  }
}

export function emptyGuideContext(city: string, generatedAt = new Date(0).toISOString()): GuideContext {
  return {
    city,
    candidates: [],
    matchedTerms: [],
    generatedAt,
    disclaimer: '社区攻略只用于发现体验线索；价格、营业时间、路线和预约状态需要出行前复核。',
  }
}
