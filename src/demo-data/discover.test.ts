import { describe, expect, it } from 'vitest'
import { getCityTopGuides, getDiscoverFeed, getRoute, rankScore } from './discover'

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

  it('keeps seeded route stops tied to sourced coordinates', () => {
    const route = getRoute('route-1')
    expect(route?.pois.map(({ longitude, latitude }) => [longitude, latitude])).toEqual([
      [121.4396546, 31.2100122],
      [121.4337292, 31.2062561],
      [121.4344178, 31.2083571],
      [121.442273, 31.2166493],
      [121.4395171, 31.2181135],
    ])
    expect(route?.pois.every((poi) => poi.coordinateSource?.includes('OpenStreetMap Nominatim'))).toBe(true)
  })

  it('uses distinct real place photos for the Shanghai route and feed covers', () => {
    const route = getRoute('route-1')
    expect(new Set(route?.pois.map((poi) => poi.image)).size).toBeGreaterThanOrEqual(5)
    expect(new Set(getDiscoverFeed('上海').slice(0, 3).map((item) => item.cover)).size).toBe(3)
  })
})
