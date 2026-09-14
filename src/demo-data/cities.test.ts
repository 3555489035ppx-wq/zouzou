import { describe, expect, it } from 'vitest'
import { cityNames, getDemoTripPlaces } from './cities'

describe('city route candidates', () => {
  it('keeps all 60 destinations in picker order, including the final four cities', () => {
    expect(cityNames).toHaveLength(60)
    expect(cityNames.slice(-4)).toEqual(['太原', '南宁', '宜昌', '威海'])
  })

  it('does not invent city-center coordinates for an unresolved demo route', () => {
    const places = getDemoTripPlaces('杭州', 'Day 1')
    expect(places.length).toBeGreaterThanOrEqual(2)
    expect(places.every((place) => place.verified === false)).toBe(true)
    expect(places.every((place) => place.lng === undefined && place.lat === undefined && place.x === undefined && place.z === undefined)).toBe(true)
  })

  it('marks fallback city coordinates as candidates instead of verified POIs', () => {
    const places = getDemoTripPlaces('苏州', 'Day 1')
    expect(places.every((place) => place.verified === false)).toBe(true)
    expect(places.every((place) => typeof place.coordinateSource === 'string')).toBe(true)
  })
})
