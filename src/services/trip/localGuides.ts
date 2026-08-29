import guideData from '../../../data/travel-guides.json'
import { searchGuideCandidates, type GuideContext, type GuideKnowledgeBase } from './guides'

const knowledgeBase = guideData as GuideKnowledgeBase

export function getLocalGuideContext(city: string, query: string): GuideContext {
  return searchGuideCandidates(knowledgeBase, city, query)
}
