import { describe, expect, it } from 'vitest'
import type { GuideCandidate, GuideContext } from '../../src/services/trip/guides'
import { compareKnowledgeSubjects, explainKnowledgeSelection } from './travel-agent-answers'

const guide = (id: string, name: string) => ({
  id, title: name + '攻略', summary: '整份攻略介绍', placeHints: [name], tags: ['夜游'],
  claims: [{ placeName: name, text: name + '的资料线索', verified: false, confidence: 0.8, type: 'place' }],
}) as GuideCandidate
const context = (candidates: GuideCandidate[]): GuideContext => ({
  city: '上海', candidates, matchedTerms: ['上海', '夜游'], generatedAt: '2026-10-01', disclaimer: '仅供参考',
})
describe('grounded answer modes', () => {
  it('compares only claims attached to each named place', () => {
    const result = compareKnowledgeSubjects(context([guide('a', '外滩'), guide('b', '公园')]), ['外滩', '公园'], 'brief')
    expect(result.complete).toBe(true)
    expect(result.comparisons[0].evidence[0].text).toBe('外滩的资料线索')
    expect(result.comparisons[0].evidence.some(item => item.text.includes('公园'))).toBe(false)
  })
  it('does not turn a whole-guide summary into a place-specific claim', () => {
    const item = guide('a', '外滩'); item.claims = []
    const result = compareKnowledgeSubjects(context([item]), ['外滩', '公园'], 'brief')
    expect(result.complete).toBe(false)
    expect(result.comparisons[0].evidence).toEqual([])
  })
  it('does not fabricate evidence for an absent place', () => {
    const result = compareKnowledgeSubjects(context([guide('a', '外滩')]), ['外滩', '不存在的地点'], 'detailed')
    expect(result.comparisons[1].status).toBe('insufficient')
    expect(result.comparisons[1].sourceIds).toEqual([])
  })
  it('deduplicates subjects and limits comparison size', () => {
    const result = compareKnowledgeSubjects(context([]), ['外滩', '外滩', '公园', '街区', '博物馆'], 'brief')
    expect(result.comparisons).toHaveLength(3)
  })
  it('explains matching tags without asserting every condition is satisfied', () => {
    const result = explainKnowledgeSelection(context([guide('a', '外滩')]), '上海夜游', 'brief')
    expect(result.reasons[0].matchedTags).toEqual(['夜游'])
    expect(result.answer).toContain('不代表')
  })
})
