import { describe, expect, it } from 'vitest'
import { getDemoTripPlaces } from './cities'

describe('city route candidates', () => {
  it('uses sourced city coordinates instead of translating Shanghai skeletons', () => {
    const places = getDemoTripPlaces('杭州', 'Day 1')
    expect(places.length).toBeGreaterThanOrEqual(2)
    expect(places.every((place) => place.coordinateSource?.includes('高德 POI'))).toBe(true)
    expect(new Set(places.map((place) => `${place.lng},${place.lat}`)).size).toBeGreaterThan(2)
  })

  it('marks fallback city coordinates as candidates instead of verified POIs', () => {
    const places = getDemoTripPlaces('苏州', 'Day 1')
    expect(places.every((place) => place.verified === false)).toBe(true)
    expect(places.every((place) => typeof place.coordinateSource === 'string')).toBe(true)
  })
})
