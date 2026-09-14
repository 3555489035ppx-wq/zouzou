import guideData from '../../../data/travel-guides.json'
import reviewedGuideData from '../../../data/travel-guides-reviewed-20-cities.json'
import { emptyGuideContext, searchGuideCandidates, type GuideContext, type GuideKnowledgeBase } from './guides'
import { regionalCommunitySignals } from './regional-community-signals'
import { filterRuntimeGuides, isRuntimeCityAllowed } from './runtimeKnowledgePolicy'
import { socialResearchGuides } from './socialResearch'

const storedKnowledgeBase = guideData as GuideKnowledgeBase
const reviewedKnowledgeBase = reviewedGuideData as GuideKnowledgeBase
const knowledgeBase: GuideKnowledgeBase = {
  ...storedKnowledgeBase,
  generatedAt: reviewedKnowledgeBase.generatedAt,
  guides: filterRuntimeGuides([
    ...reviewedKnowledgeBase.guides,
    ...storedKnowledgeBase.guides,
    ...regionalCommunitySignals,
    ...socialResearchGuides,
  ]),
}

export function getLocalGuideContext(city: string, query: string): GuideContext {
  if (!isRuntimeCityAllowed(city)) return emptyGuideContext(city, knowledgeBase.generatedAt)
  return searchGuideCandidates(knowledgeBase, city, query, 8)
}

// Same surface as the browser-only alias; the server never caches user input
// or overwrites its complete knowledge base with a client-provided context.
export function primeClientGuideContext(_context: unknown, _query = ''): void {}
export function subscribeClientGuideContext(_listener: () => void): () => void { return () => undefined }
export async function loadClientGuideContext(city: string, query: string, signal?: AbortSignal): Promise<GuideContext> {
  signal?.throwIfAborted()
  return getLocalGuideContext(city, query)
}
