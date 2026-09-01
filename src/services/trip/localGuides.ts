import guideData from '../../../data/travel-guides.json'
import { searchGuideCandidates, type GuideContext, type GuideKnowledgeBase } from './guides'
import { regionalCommunitySignals } from './regional-community-signals'
import { socialResearchGuides } from './socialResearch'

const storedKnowledgeBase = guideData as GuideKnowledgeBase
const knowledgeBase: GuideKnowledgeBase = {
  ...storedKnowledgeBase,
  guides: [...storedKnowledgeBase.guides, ...regionalCommunitySignals, ...socialResearchGuides],
}

export function getLocalGuideContext(city: string, query: string): GuideContext {
  return searchGuideCandidates(knowledgeBase, city, query, 8)
}
