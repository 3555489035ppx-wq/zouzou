import { describe, expect, it } from 'vitest'
import { cityNames } from './cities'
import { getItineraryPlazaItems, getRoute } from './discover'
import { getCityKnowledge, isConcreteKnowledgeItem } from '../services/trip/cityKnowledge'
import { discoverCoverIndex } from './discover-cover-index'

describe('the complete Discover corpus', () => {
  it('does not ship temporary URL credentials in the public cover index', () => {
    const sensitive = /^(?:.*token.*|auth(?:orization)?(?:[-_].*)?|signature|sign|sig|credentials?|expires?|expiry|exp|secret|api[-_]?key|access[-_]?key(?:id)?|policy|key-pair-id|wstime|wssecret|ossaccesskeyid|x-(?:amz|oss|goog)-(?:signature|credential|date|expires|security-token|algorithm|signedheaders))$/i
    for (const { image } of Object.values(discoverCoverIndex)) {
      if (!image) continue
      for (const value of Object.values(image)) {
        if (typeof value !== 'string' || !/^https?:\/\//.test(value)) continue
        for (const key of new URL(value).searchParams.keys()) expect(sensitive.test(key), `forbidden parameter: ${key}`).toBe(false)
      }
      expect(image.cachedUrl).toMatch(/^\/assets\//)
      expect(image.sourceUrl).toMatch(/^https?:\/\//)
    }
  })
  it('exposes all 1200 routes and exactly 20 for every city', () => {
    const all = getItineraryPlazaItems()
    expect(all).toHaveLength(1200)
    expect(new Set(all.map(item => item.routeId)).size).toBe(1200)
    for (const city of cityNames) {
      expect(all.filter(item => item.cityId === city)).toHaveLength(20)
      const entries = getItineraryPlazaItems(city)
      expect(entries).toHaveLength(20)
      for (const [days, count] of [[1,1],[2,3],[3,8],[4,8]]) expect(entries.filter(item => getRoute(item.routeId)?.dayCount === days)).toHaveLength(count)
      expect(getItineraryPlazaItems(city,20,true).slice(0,3).every(item => /[\u4e00-\u9fff]/.test(item.title) && getRoute(item.routeId)?.pois.length)).toBe(true)
    }
  })
  it('selects five from every city, with multiple durations, and preserves their original ids', () => {
    const all = getItineraryPlazaItems()
    const featured = getItineraryPlazaItems(undefined, 1200, true)
    expect(featured).toHaveLength(300)
    for (const city of cityNames) {
      const entries = featured.filter(item => item.cityId === city)
      expect(entries).toHaveLength(5)
      expect(new Set(entries.map(item => getRoute(item.routeId)?.dayCount)).size).toBe(4)
      expect(entries.every(item => item.featured && all.some(other => other.routeId === item.routeId && other.featured))).toBe(true)
    }
    expect(new Set(all.slice(0,60).map(item => item.cityId)).size).toBe(60)
  })

  it('retains different daily schedules for the same sourced places without inventing replacement stops', () => {
    const all = getItineraryPlazaItems()
    const first = getRoute('multiday-太原-4-1')!
    const second = getRoute('multiday-太原-4-2')!
    expect(first.pois.map(poi => poi.name).sort()).toEqual(second.pois.map(poi => poi.name).sort())
    expect(first.pois.map(poi => [poi.day, poi.name, poi.time])).not.toEqual(second.pois.map(poi => [poi.day, poi.name, poi.time]))
    expect(all.map(item => item.routeId)).toEqual(expect.arrayContaining([first.id, second.id, 'multiday-康定-3-6']))
    const schedules = new Set<string>()
    for (const entry of all) {
      const route = getRoute(entry.routeId)!
      const key = JSON.stringify([route.cityId, route.dayCount, route.pois.map(poi => [poi.day, poi.name, poi.time])])
      expect(schedules.has(key), route.id).toBe(false)
      schedules.add(key)
      const sources = new Map(getCityKnowledge(route.cityId).items.filter(isConcreteKnowledgeItem).map(item => [item.name, item.source.url]))
      for (const poi of route.pois) {
        expect(sources.has(poi.name), `${route.id}: ${poi.name}`).toBe(true)
        expect(poi.sourceUrl, `${route.id}: ${poi.name}`).toBe(sources.get(poi.name))
      }
    }
  })
})
