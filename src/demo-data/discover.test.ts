import { describe, expect, it } from 'vitest'
import { getCityTopGuides, getDiscoverFeed, rankScore } from './discover'

describe('Discover knowledge feed', () => {
  it('returns published, ranked guides without overlapping routes', () => {
    const guides = getCityTopGuides('上海')
    expect(guides).toHaveLength(1)
    expect(guides[0].contentSource).toBe('knowledge')
    expect(rankScore(guides[0])).toBeGreaterThan(0)
  })
  it('mixes available content sources for a city', () => {
    expect(new Set(getDiscoverFeed('上海').map((item) => item.contentSource))).toEqual(new Set(['official', 'knowledge', 'user']))
  })

  it('keeps the feed populated after switching to a city without a curated seed', () => {
    expect(getDiscoverFeed('重庆').length).toBeGreaterThan(0)
    expect(getDiscoverFeed('重庆')[0].cityId).toBe('重庆')
  })
})
