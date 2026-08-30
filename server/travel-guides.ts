import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { cityNames } from '../src/demo-data/cities'
import { emptyGuideContext, type GuideCandidate, type GuideContext, type GuideKnowledgeBase } from '../src/services/trip/guides'
import type { TripRequest } from '../src/services/trip/planner'

const DEFAULT_KNOWLEDGE_BASE_PATH = resolve(process.cwd(), 'data/travel-guides.json')
const GUIDE_LIMIT = 8

let cachedKnowledgeBase: GuideKnowledgeBase | null = null
let cachedMtime = -1

function knowledgeBasePath() {
  return process.env.TRAVEL_GUIDE_KB_PATH?.trim() || DEFAULT_KNOWLEDGE_BASE_PATH
}

function isGuideCandidate(value: unknown): value is GuideCandidate {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<GuideCandidate>
  return typeof candidate.id === 'string'
    && typeof candidate.city === 'string'
    && typeof candidate.sourceUrl === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.summary === 'string'
    && Array.isArray(candidate.tags)
    && Array.isArray(candidate.placeHints)
    && Array.isArray(candidate.claims)
}

function readKnowledgeBase(): GuideKnowledgeBase {
  const path = knowledgeBasePath()
  try {
    const mtime = statSync(path).mtimeMs
    if (cachedKnowledgeBase && cachedMtime === mtime) return cachedKnowledgeBase
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    const root = parsed && typeof parsed === 'object' ? parsed as Partial<GuideKnowledgeBase> : {}
    const guides = Array.isArray(root.guides) ? root.guides.filter(isGuideCandidate) : []
    cachedKnowledgeBase = {
      version: 1,
      generatedAt: typeof root.generatedAt === 'string' ? root.generatedAt : new Date(0).toISOString(),
      guides,
    }
    cachedMtime = mtime
    return cachedKnowledgeBase
  } catch {
    return { version: 1, generatedAt: new Date(0).toISOString(), guides: [] }
  }
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[\s，。！？、：；（）()[\]{}“”‘’'"!?,.:;/-]+/g, '')
}

function queryTerms(query: string) {
  const terms = query
    .toLowerCase()
    .match(/[a-z0-9]{2,}|[\u4e00-\u9fff]{2,}/g) ?? []
  return [...new Set(terms.filter((term) => !cityNames.includes(term)))]
}

function parsedLikes(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function recencyScore(value: string | null) {
  if (!value) return 0
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(timestamp)) return 0
  const days = Math.max(0, (Date.now() - timestamp) / 86_400_000)
  return Math.max(0, 4 - days / 180)
}

function candidateScore(candidate: GuideCandidate, city: string, query: string) {
  const candidateText = normalizeText([
    candidate.title,
    candidate.summary,
    candidate.tags.join(' '),
    candidate.placeHints.join(' '),
    (candidate.foodHints ?? []).join(' '),
    (candidate.localExperienceHints ?? []).join(' '),
    candidate.claims.map((claim) => claim.text).join(' '),
  ].join(' '))
  const terms = queryTerms(query)
  const termScore = terms.reduce((score, term) => {
    if (!candidateText.includes(normalizeText(term))) return score
    return score + (candidate.title.includes(term) ? 8 : 3)
  }, 0)
  return (candidate.city === city ? 30 : 0)
    + termScore
    + Math.min(8, Math.log10(parsedLikes(candidate.likes) + 1) * 2)
    + recencyScore(candidate.publishedAt)
}

export function inferGuideCity(text: string) {
  return cityNames.find((city) => text.includes(city)) ?? '上海'
}

export function searchTravelGuides(city: string, query = '', limit = GUIDE_LIMIT): GuideContext {
  const root = readKnowledgeBase()
  const normalizedCity = cityNames.find((item) => item === city) ?? (city.trim() || '上海')
  const candidates = root.guides
    .filter((candidate) => candidate.city === normalizedCity)
    .map((candidate) => ({ candidate, score: candidateScore(candidate, normalizedCity, query) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Math.min(GUIDE_LIMIT, Math.round(limit))))
    .map(({ candidate }) => candidate)

  return {
    city: normalizedCity,
    candidates,
    matchedTerms: queryTerms(query),
    generatedAt: root.generatedAt,
    disclaimer: '社区攻略只用于发现体验线索；价格、营业时间、路线和预约状态需要出行前复核。',
  }
}

export function getGuideContextForTrip(request: Pick<TripRequest, 'text'>) {
  const city = inferGuideCity(request.text)
  return searchTravelGuides(city, request.text)
}

export function getGuideStats() {
  const root = readKnowledgeBase()
  const byCity = Object.fromEntries(cityNames.map((city) => [city, root.guides.filter((guide) => guide.city === city).length]))
  return { generatedAt: root.generatedAt, total: root.guides.length, byCity }
}

export function guideContextForPrompt(context: GuideContext) {
  return context.candidates.slice(0, GUIDE_LIMIT).map((candidate) => ({
    platform: candidate.platform,
    title: candidate.title,
    author: candidate.author,
    summary: candidate.summary,
    tags: candidate.tags,
    placeHints: candidate.placeHints,
    foodHints: candidate.foodHints ?? [],
    localExperienceHints: candidate.localExperienceHints ?? [],
    claims: candidate.claims,
    sourceUrl: candidate.sourceUrl,
  }))
}

export { emptyGuideContext }
