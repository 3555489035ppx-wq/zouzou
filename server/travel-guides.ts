import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { cityNames } from '../src/demo-data/cities'
import { searchGuideCandidates, emptyGuideContext, type GuideCandidate, type GuideContext, type GuideKnowledgeBase } from '../src/services/trip/guides'
import type { TripRequest } from '../src/services/trip/planner'
import { regionalCommunitySignals } from '../src/services/trip/regional-community-signals'
import { filterRuntimeGuides, isRuntimeCityAllowed } from '../src/services/trip/runtimeKnowledgePolicy'
import { socialResearchGuides } from '../src/services/trip/socialResearch'

const DEFAULT_KNOWLEDGE_BASE_PATH = resolve(process.cwd(), 'data/travel-guides.json')
const REVIEWED_KNOWLEDGE_BASE_PATH = resolve(process.cwd(), 'data/travel-guides-reviewed-20-cities.json')
const GUIDE_LIMIT = 8

let cachedKnowledgeBase: GuideKnowledgeBase | null = null
let cachedMtime = -1
let cachedReviewedMtime = -1

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
    const reviewedMtime = statSync(REVIEWED_KNOWLEDGE_BASE_PATH).mtimeMs
    if (cachedKnowledgeBase && cachedMtime === mtime && cachedReviewedMtime === reviewedMtime) return cachedKnowledgeBase
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    const reviewedParsed: unknown = JSON.parse(readFileSync(REVIEWED_KNOWLEDGE_BASE_PATH, 'utf8'))
    const root = parsed && typeof parsed === 'object' ? parsed as Partial<GuideKnowledgeBase> : {}
    const reviewedRoot = reviewedParsed && typeof reviewedParsed === 'object' ? reviewedParsed as Partial<GuideKnowledgeBase> : {}
    const guides = Array.isArray(root.guides) ? root.guides.filter(isGuideCandidate) : []
    const reviewedGuides = Array.isArray(reviewedRoot.guides) ? reviewedRoot.guides.filter(isGuideCandidate) : []
    cachedKnowledgeBase = {
      version: 1,
      generatedAt: typeof reviewedRoot.generatedAt === 'string' ? reviewedRoot.generatedAt : typeof root.generatedAt === 'string' ? root.generatedAt : new Date(0).toISOString(),
      guides: filterRuntimeGuides([
        ...reviewedGuides,
        ...guides,
        ...regionalCommunitySignals,
        ...socialResearchGuides,
      ]),
    }
    cachedMtime = mtime
    cachedReviewedMtime = reviewedMtime
    return cachedKnowledgeBase
  } catch {
    return { version: 1, generatedAt: new Date(0).toISOString(), guides: [] }
  }
}

export function inferGuideCity(text: string) {
  return cityNames.find((city) => text.includes(city)) ?? '上海'
}

export function searchTravelGuides(city: string, query = '', limit = GUIDE_LIMIT): GuideContext {
  const root = readKnowledgeBase()
  const normalizedCity = cityNames.find((item) => item === city) ?? (city.trim() || '上海')
  if (!isRuntimeCityAllowed(normalizedCity)) return emptyGuideContext(normalizedCity, root.generatedAt)
  return searchGuideCandidates(root, normalizedCity, query, Math.max(1, Math.min(GUIDE_LIMIT, Math.round(limit))))
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
    hotelHints: candidate.hotelHints ?? [],
    hotelNames: candidate.hotelNames ?? [],
    sourceReadLevel: candidate.research?.readLevel ?? 'unspecified',
    experienceCandidates: candidate.experiences ?? [],
    dietaryTags: candidate.dietaryTags ?? [],
    claims: candidate.claims,
    sourceUrl: candidate.sourceUrl,
  }))
}

export { emptyGuideContext }
