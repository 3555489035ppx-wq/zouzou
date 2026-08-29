import { describe, expect, it } from 'vitest'
import { getGuideStats, inferGuideCity, searchTravelGuides } from './travel-guides'

describe('travel guide knowledge base', () => {
  it('retrieves city-specific community signals without copying post bodies', () => {
    const result = searchTravelGuides('上海', 'citywalk', 3)

    expect(result.city).toBe('上海')
    expect(result.candidates.length).toBeGreaterThan(0)
    expect(result.candidates.every((candidate) => candidate.city === '上海')).toBe(true)
    expect(result.candidates.every((candidate) => !candidate.sourceUrl.includes('?'))).toBe(true)
    expect(result.candidates.every((candidate) => !('content' in candidate))).toBe(true)
  })

  it('infers the city used by a trip query and exposes ingestion stats', () => {
    expect(inferGuideCity('计划去杭州三天')).toBe('杭州')
    expect(getGuideStats().total).toBeGreaterThanOrEqual(40)
  })
})
