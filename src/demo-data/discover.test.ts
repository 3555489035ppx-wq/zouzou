import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { cityNames } from './cities'
import { getCityImageGallery } from './city-images'
import { getCityTopGuides, getDiscoverFeed, getRoute, rankScore, routes } from './discover'
import { searchDiscoverItems } from '../services/discover/search'
import { cityKnowledge, isConcreteKnowledgeItem } from '../services/trip/cityKnowledge'
import { isRuntimeCityAllowed } from '../services/trip/runtimeKnowledgePolicy'
import { experienceRouteStart } from '../services/trip/experiencePolicy'
import { authorizedSocialPhotos } from './authorized-social-photos'
import { discoverCoverIndex } from './discover-cover-index'
import { coverVisualIdentity, isUserFacingCover, placesMatch } from '../services/journey-images/presentation'
import type { Route } from './discover'

const photosByCity = new Map(cityNames.map(city => [city, [
  ...getCityImageGallery(city).map(photo => ({ src: photo.src, place: photo.landmark })),
  ...authorizedSocialPhotos.filter(photo => photo.city === city).map(photo => ({ src: photo.localPath, place: photo.placeName })),
  ...Object.values(discoverCoverIndex).flatMap(({ image }) => image?.city === city ? [{ src: image.cachedUrl, place: image.placeName ?? '' }] : []),
]]))
function expectUsableCoverOrDeclaredGap(route: Route) {
  if (!route.cover) {
    expect(route.coverImageStatus, route.id).toBe('fallback')
    expect(route.coverImage, route.id).toBeUndefined()
    return
  }
  expect(route.coverImageStatus, route.id).toBe('ready')
  expect(isUserFacingCover(route.cover), route.id).toBe(true)
  expect(existsSync(`public${route.cover}`), route.id).toBe(true)
  expect(photosByCity.get(route.cityId)?.some(photo => photo.src === route.cover
    && route.pois.some(poi => placesMatch(photo.place, poi.name))), route.id).toBe(true)
}

describe('Discover knowledge feed', () => {
  it('integrates the new city breakfasts without delaying breakfast behind a long attraction', () => {
    for(const [city,venue] of [['上海','复8邻里汇'],['哈尔滨','六姐蛋堡（红专街早市）'],['昆明','臭小子臭豆腐过桥米线'],['丽水','阿三生煎（大众路店）']]) {
      const route=routes.find(route=>route.cityId===city && route.pois.some(poi=>poi.name===venue))!
      expect(route).toBeDefined()
      expect(experienceRouteStart(route)).toBe('07:30')
      expect(route.pois[0].stay).toBe('20min')
      expect(route.pois[1].name).toBe(venue)
      expect(route.pois[1].priceState).toBe('unknown')
      expect(getCityTopGuides(city).some(item=>item.routeId===route.id)).toBe(true)
    }
  })
  it('keeps new snacks out of breakfast-only records and publishes coherent meal routes', () => {
    const snack=cityKnowledge['杭州'].items.find(item=>item.name==='祁姐葱包烩')!
    expect(snack.category).toBe('food')
    expect(snack.tags).not.toContain('早餐专用')
    const dinner=routes.find(route=>route.id==='knowledge-route-成都-6')!
    expect(dinner.pois.map(poi=>poi.name)).toEqual(['春熙路—太古里','叶婆婆钵钵鸡（春熙路片区）'])
    expect(dinner.timePeriod).toEqual(['下午','晚上'])
    expect(dinner.pois[1].priceState).toBe('unknown')
    expect(dinner.pois[1].estimatedBudget).toBeUndefined()
    expect(dinner.pois[0].name).toBe('春熙路—太古里')
    expect(dinner.cover).toBeTruthy()
    expect(routes.find(route=>route.id==='knowledge-route-杭州-8')?.pois.some(poi=>poi.name==='祁姐葱包烩')).toBe(true)
  })
  it('publishes reviewed breakfast sequences through the existing city feed', () => {
    for(const [city,venue] of [['杭州','泮芳春煎饺'],['大连','朱哥早餐（七一早市）'],['厦门','浮屿大同鸭肉粥'],['广州','幸运楼（北京路）'],['武汉','汪记鲜鱼糊汤粉（山海关路片区）'],['南京','奇芳阁']]) {
      const route=routes.find(route=>route.cityId===city && route.title.includes('老城早走'))!
      expect(route).toBeDefined()
      expect(getCityTopGuides(city).some(item=>item.routeId===route.id)).toBe(true)
      expect(route.timePeriod).toEqual(['早上','上午'])
      expect(experienceRouteStart(route)).toBe('07:30')
      expect(route.pois[0].stay).toBe('20min')
      expect(route.pois.find(poi=>poi.name===venue)?.introduction).toContain('可点：')
      expect(route.tips.some(tip=>tip.includes('不代表免费'))).toBe(true)
      expectUsableCoverOrDeclaredGap(route)
    }
  })
  it('returns published, ranked guides without overlapping routes', () => {
    const guides = getCityTopGuides('上海')
    expect(guides.length).toBeGreaterThanOrEqual(10)
    expect(guides[0].contentSource).toBe('knowledge')
    expect(rankScore(guides[0])).toBeGreaterThan(0)
    expect(new Set(guides.map((guide) => guide.routeId)).size).toBe(guides.length)
  })

  it('keeps the removed Datong knowledge out of the catalog and Discover', () => {
    expect(isRuntimeCityAllowed('大同')).toBe(false)
    expect(cityKnowledge['大同']).toBeUndefined()
    expect(cityNames).not.toContain('大同')
    expect(getDiscoverFeed('大同')).toEqual([])
    expect(getCityTopGuides('大同', 100)).toEqual([])
    expect(routes.some((route) => route.cityId === '大同')).toBe(false)
  })

  it('exposes at least twenty distinct guides with all four trip durations for every city', () => {
    cityNames.forEach((city) => {
      if (!isRuntimeCityAllowed(city)) return
      const guides = getCityTopGuides(city, 100)
      expect(guides.length).toBeGreaterThanOrEqual(20)
      const schedules = guides.map((guide) => {
        const route = getRoute(guide.routeId)!
        return JSON.stringify([route.dayCount, route.pois.map(poi => [poi.day, poi.name, poi.time])])
      })
      expect(new Set(schedules).size).toBe(guides.length)
      const multi = guides.map(guide => getRoute(guide.routeId)!).filter(route => route.dayCount)
      expect(multi).toHaveLength(26)
      for (const days of [1, 2, 3, 4]) expect(multi.filter(route => route.dayCount === days)).toHaveLength(days >= 3 ? 8 : 5)
      for (const route of multi) {
        expect(new Set(route.pois.map(poi => poi.name)).size).toBe(route.pois.length)
        expect(new Set(route.pois.map(poi => poi.day)).size).toBe(route.dayCount)
        expect(route.pois.every(poi => poi.sourceUrl && poi.introduction)).toBe(true)
      }
    })
  })

  it('mixes available content sources for a city', () => {
    const feed = getDiscoverFeed('上海')
    expect(new Set(feed.map((item) => item.contentSource))).toEqual(new Set(['official', 'knowledge']))
    expect(feed[0].contentSource).toBe('official')
    expect(feed.slice(1, 11).every((item) => item.contentSource === 'knowledge')).toBe(true)
    expect(feed.some(item=>item.contentSource==='user')).toBe(false)
  })

  it('appends a published route to the user section without duplicating its route', () => {
    const feed = getDiscoverFeed('上海', undefined, ['route-1'])
    expect(feed.filter((item) => item.contentSource === 'user')).toHaveLength(1)
    expect(feed.at(-1)?.routeId).toBe('route-1')
    expect(feed.filter(item => item.routeId === 'route-1')).toHaveLength(1)
  })

  it('retains sourced breakfast routes when a matching reviewed cover is not yet available', () => {
    for (const id of ['knowledge-route-杭州-6', 'knowledge-route-厦门-9']) {
      const route = getRoute(id)!
      expect(route.pois.every(poi => poi.sourceUrl)).toBe(true)
      expect(getDiscoverFeed(route.cityId).some(entry => entry.routeId === id)).toBe(true)
      expectUsableCoverOrDeclaredGap(route)
    }
  })

  it('keeps the feed populated after switching to a city without a curated seed', () => {
    expect(getDiscoverFeed('重庆').length).toBeGreaterThan(0)
    expect(getDiscoverFeed('重庆')[0].cityId).toBe('重庆')
  })

  it('keeps seeded route stops tied to their verified coordinates', () => {
    const route = getRoute('route-1')
    expect(route?.pois.map(({ longitude, latitude }) => [longitude, latitude])).toEqual([
      [121.4396546, 31.2100122],
      [121.4337292, 31.2062561],
      [121.4344178, 31.2083571],
      [121.442273, 31.2166493],
      [121.4395171, 31.2181135],
    ])
    expect(route?.pois.every((poi) => poi.coordinateSource?.includes('坐标已核验') && poi.verified === true)).toBe(true)
  })

  it('uses distinct real place photos for the Shanghai route and feed covers', () => {
    const route = getRoute('route-1')
    expect(new Set(route?.pois.map((poi) => poi.image)).size).toBeGreaterThanOrEqual(5)
    expect(new Set(getDiscoverFeed('上海').slice(0, 3).map((item) => item.cover)).size).toBe(3)
  })

  it('gives every supported city a distinct cover set for its first feed cards', () => {
    cityNames.forEach((city) => {
      if (!isRuntimeCityAllowed(city)) return
      const gallery = getCityImageGallery(city)
      const feed = getDiscoverFeed(city)
      expect(gallery.length).toBeGreaterThanOrEqual(3)
      expect(new Set(feed.slice(0, 3).map((item) => item.cover)).size).toBe(3)
    })
  })

  it('uses matching local place covers for short routes or explicitly declares the missing photo', () => {
    cityNames.forEach((city) => {
      if (!isRuntimeCityAllowed(city)) return
      const cityRoutes = routes.filter((route) => route.cityId === city && route.id.startsWith('knowledge-route-'))
      expect(cityRoutes).toHaveLength(15)
      cityRoutes.forEach(expectUsableCoverOrDeclaredGap)
    })
  })

  it('keeps reused knowledge covers tied to a sourced place in each route', () => {
    const knowledgeRoutes = routes.filter((route) => route.id.startsWith('knowledge-route-'))
    const photographed = knowledgeRoutes.filter(route => route.cover)
    expect(new Set(photographed.map(route => coverVisualIdentity(route.cover!))).size).toBeLessThan(photographed.length)
    photographed.forEach(expectUsableCoverOrDeclaredGap)
  })

  it('keeps selected image metadata consistent with the actual cover, including reused photos', () => {
    for (const route of routes) {
      expectUsableCoverOrDeclaredGap(route)
      if (route.coverImage) {
        expect(route.coverImage.cachedUrl, route.id).toBe(route.cover)
        expect(route.coverImage.city, route.id).toBe(route.cityId)
        expect(route.coverImage.sourceUrl, route.id).toBeTruthy()
      }
    }
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
    expect(feed.some(item => item.routeId === slow?.id)).toBe(true)
    expect(feed.some(item => item.routeId === food?.id)).toBe(true)
    expectUsableCoverOrDeclaredGap(slow!)
    expectUsableCoverOrDeclaredGap(food!)
  })

  it('uses actual venue candidates for dining and never turns dish hints into restaurants', () => {
    const oldCaveat = /价格和营业状态|营业状态|价格、时价和加工费|时价、加工费/
    cityNames.forEach((city) => {
      if (!isRuntimeCityAllowed(city)) return
      const cityRoutes = routes.filter((route) => route.cityId === city)
      const diningPois = cityRoutes.flatMap((route) => route.pois.filter((poi) => poi.category === '餐饮' || poi.category === 'food' || poi.category === 'restaurant'))
      const hasVenue = cityKnowledge[city].items.some(item => (item.category === 'food' || item.category === 'restaurant') && isConcreteKnowledgeItem(item))
      if (hasVenue) expect(diningPois.length).toBeGreaterThan(0)
      else {
        expect(diningPois).toHaveLength(0)
        expect(cityRoutes.some(route => route.category === '聚餐')).toBe(false)
      }
      const dishNames = new Set(cityKnowledge[city].items.filter(item => item.tags.includes('菜品线索')).map(item => item.name))
      expect(diningPois.some(poi => dishNames.has(poi.name))).toBe(false)
      expect(diningPois.every((poi) => !oldCaveat.test(`${poi.name} ${poi.introduction}`))).toBe(true)
      const concreteNames = new Set(cityKnowledge[city].items.filter(isConcreteKnowledgeItem).map((item) => item.name))
      expect(diningPois.every((poi) => concreteNames.has(poi.name))).toBe(true)
    })
  })

  it('retains full multiday coverage even when different routes visit the same cover location', () => {
    cityNames.forEach((city) => {
      if (!isRuntimeCityAllowed(city)) return
      const feed = getDiscoverFeed(city)
      expect(feed.filter(item => getRoute(item.routeId)?.dayCount).length).toBeGreaterThanOrEqual(20)
      for (const entry of feed) {
        const route = getRoute(entry.routeId)!
        expect(entry.cover).toBe(route.cover ?? '')
        expectUsableCoverOrDeclaredGap(route)
      }
    })
  })

  it('keeps Sanya dining cards on their actual sourced meal venues, not a fixed dish filename', () => {
    const dining = getDiscoverFeed('三亚').filter((item) => item.category === '聚餐')
    expect(dining.length).toBeGreaterThan(0)
    expect(dining.some(item => item.routeId === 'route-8')).toBe(true)
    for (const entry of dining) {
      const route = getRoute(entry.routeId)!
      expectUsableCoverOrDeclaredGap(route)
      if (!entry.cover) continue
      expect(photosByCity.get('三亚')?.some(photo => photo.src === entry.cover && route.pois.some(poi =>
        /餐饮|restaurant|food/.test(poi.category) && placesMatch(photo.place, poi.name))), route.id).toBe(true)
    }
  })

  it('finds a route by its title and stop names', () => {
    const feed = getDiscoverFeed('三亚')
    expect(searchDiscoverItems(feed, '三亚慢慢走', getRoute)[0].title).toBe('三亚慢慢走')
    expect(searchDiscoverItems(feed, '第一市场', getRoute).some((item) => item.title === '三亚逛吃一条线')).toBe(true)
  })
})
