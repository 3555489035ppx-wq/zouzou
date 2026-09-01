import { describe, expect, it } from 'vitest'
import { cityNames } from './cities'
import { getCityImageGallery } from './city-images'
import { getCityTopGuides, getDiscoverFeed, getRoute, rankScore, routes } from './discover'
import { searchDiscoverItems } from '../services/discover/search'
import { cityKnowledge, isConcreteKnowledgeItem } from '../services/trip/cityKnowledge'

describe('Discover knowledge feed', () => {
  it('returns published, ranked guides without overlapping routes', () => {
    const guides = getCityTopGuides('上海')
    expect(guides.length).toBeGreaterThanOrEqual(10)
    expect(guides[0].contentSource).toBe('knowledge')
    expect(rankScore(guides[0])).toBeGreaterThan(0)
    expect(new Set(guides.map((guide) => guide.routeId)).size).toBe(guides.length)
  })

  it('exposes exactly fifteen non-duplicated knowledge-base guides for every supported city', () => {
    cityNames.forEach((city) => {
      const guides = getCityTopGuides(city)
      expect(guides).toHaveLength(15)
      const poiSets = guides.map((guide) => [...new Set(getRoute(guide.routeId)?.pois.map((poi) => poi.name) ?? [])].sort().join('|'))
      expect(new Set(poiSets)).toHaveLength(15)
    })
  })

  it('mixes available content sources for a city', () => {
    const feed = getDiscoverFeed('上海')
    expect(new Set(feed.map((item) => item.contentSource))).toEqual(new Set(['official', 'knowledge', 'user']))
    expect(feed[0].contentSource).toBe('official')
    expect(feed.slice(1, 11).every((item) => item.contentSource === 'knowledge')).toBe(true)
    expect(feed.at(-1)?.contentSource).toBe('user')
  })

  it('appends a published route to the user section without duplicating its route', () => {
    const feed = getDiscoverFeed('上海', undefined, ['route-1'])
    expect(feed.filter((item) => item.contentSource === 'user')).toHaveLength(1)
    expect(feed.at(-1)?.routeId).toBe('route-1')
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

  it('gives every supported city a distinct cover set for its first feed cards', () => {
    cityNames.forEach((city) => {
      const gallery = getCityImageGallery(city)
      const feed = getDiscoverFeed(city)
      expect(gallery.length).toBeGreaterThanOrEqual(3)
      expect(new Set(feed.slice(0, 3).map((item) => item.cover)).size).toBe(3)
    })
  })

  it('never uses a city-wide fallback as a route cover and avoids same-city cover reuse', () => {
    cityNames.forEach((city) => {
      const cityRoutes = routes.filter((route) => route.cityId === city && route.id.startsWith('knowledge-route-'))
      expect(cityRoutes).toHaveLength(15)
      expect(cityRoutes.every((route) => route.cover)).toBe(true)
      expect(new Set(cityRoutes.map((route) => route.cover)).size).toBe(cityRoutes.length)
      cityRoutes.forEach((route) => expect(route.coverImage?.relevanceScore).toBeGreaterThanOrEqual(60))
    })
  })

  it('separates Sanya walking and food routes with different stops and covers', () => {
    const feed = getDiscoverFeed('三亚')
    const slow = getRoute('route-7')
    const food = getRoute('route-8')
    expect(slow?.title).toBe('三亚慢慢走')
    expect(food?.category).toBe('聚餐')
    expect(slow?.pois[0].name).toBe('椰梦长廊')
    expect(food?.pois[0].name).toBe('阿浪海鲜')
    expect(food?.pois.map((poi) => poi.name)).toEqual(expect.arrayContaining(['沿江海南鸡饭店', '椰语堂清补凉', '嗲嗲的椰子鸡（大东海店）']))
    expect(feed.filter((item) => item.title.includes('逛吃')).every((item) => item.category === '聚餐')).toBe(true)
    expect(new Set(feed.slice(0, 3).map((item) => item.cover)).size).toBe(3)
    expect(new Set(feed.map((item) => item.cover)).size).toBeGreaterThanOrEqual(10)
  })

  it('uses named food venues across every city route without the old price-status caveat', () => {
    const oldCaveat = /价格和营业状态|营业状态|价格、时价和加工费|时价、加工费/
    cityNames.forEach((city) => {
      const cityRoutes = routes.filter((route) => route.cityId === city)
      const diningPois = cityRoutes.flatMap((route) => route.pois.filter((poi) => poi.category === '餐饮' || poi.category === 'food' || poi.category === 'restaurant'))
      expect(diningPois.length).toBeGreaterThan(0)
      expect(diningPois.every((poi) => !oldCaveat.test(`${poi.name} ${poi.introduction}`))).toBe(true)
      const concreteNames = new Set(cityKnowledge[city].items.filter(isConcreteKnowledgeItem).map((item) => item.name))
      expect(diningPois.every((poi) => concreteNames.has(poi.name))).toBe(true)
    })
  })

  it('does not repeat a cover inside any returned city feed', () => {
    cityNames.forEach((city) => {
      const feed = getDiscoverFeed(city)
      expect(new Set(feed.map((item) => item.cover)).size).toBe(feed.length)
    })
  })

  it('keeps Sanya dining cards on food imagery when a food asset exists', () => {
    const dining = getDiscoverFeed('三亚').filter((item) => item.category === '聚餐')
    expect(dining[0]?.cover).toContain('sanya-seafood-noodle')
    expect(dining.every((item) => !/sanya-(bay|dadonghai|phoenix|tianya|yalong|wuzhizhou)/.test(item.cover))).toBe(true)
  })

  it('finds a route by its title and stop names', () => {
    const feed = getDiscoverFeed('三亚')
    expect(searchDiscoverItems(feed, '三亚慢慢走', getRoute)[0].title).toBe('三亚慢慢走')
    expect(searchDiscoverItems(feed, '第一市场', getRoute).some((item) => item.title === '三亚逛吃一条线')).toBe(true)
  })
})
