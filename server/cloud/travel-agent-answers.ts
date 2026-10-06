import type { GuideContext, GuideCandidate } from '../../src/services/trip/guides'

export type AnswerStyle = 'brief' | 'detailed'
const normalized = (value: string) => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase()
const mentions = (guide: GuideCandidate, subject: string) => {
  const needle = normalized(subject)
  return guide.placeHints.some(name => normalized(name) === needle) ||
    guide.claims.some(claim => claim.placeName && normalized(claim.placeName) === needle)
}

/** A comparison only attributes place-specific claims to that place.
 * Whole-guide summaries/tags are not misrepresented as a venue's properties.
 */
export function compareKnowledgeSubjects(context: GuideContext, subjects: string[], style: AnswerStyle) {
  const unique = [...new Set(subjects.map(item => item.trim()).filter(Boolean))].slice(0, 3)
  const comparisons = unique.map(subject => {
    const candidates = context.candidates.filter(guide => mentions(guide, subject))
    const facts = candidates.flatMap(guide => guide.claims.filter(claim =>
      claim.placeName && normalized(claim.placeName) === normalized(subject)
    ).map(claim => ({ text: claim.text, sourceId: guide.id, verified: claim.verified })))
    const deduped = facts.filter((fact, index, all) => all.findIndex(item => item.text === fact.text) === index)
    return {
      subject,
      evidence: deduped.slice(0, style === 'brief' ? 2 : 5),
      sourceIds: candidates.map(guide => guide.id),
      status: deduped.length ? 'supported' as const : 'insufficient' as const,
    }
  })
  return { comparisons, complete: unique.length >= 2 && comparisons.every(item => item.status === 'supported') }
}

export function explainKnowledgeSelection(context: GuideContext, query: string, style: AnswerStyle) {
  const matches = context.matchedTerms.filter(term => term && term !== context.city).slice(0, 5)
  return {
    answer: '这次先按' + context.city + '筛选，再参考你提到的偏好检索相关攻略。' +
      (matches.length ? '检索词包括：' + matches.join('、') + '。' : '') +
      '这些是推荐线索，不代表已经实时核实，也不代表每个地点都符合全部条件。',
    reasons: context.candidates.slice(0, style === 'brief' ? 2 : 5).map(guide => ({
      sourceId: guide.id,
      title: guide.title,
      matchedTags: guide.tags.filter(tag => query.includes(tag)),
      summary: guide.summary,
    })),
  }
}
