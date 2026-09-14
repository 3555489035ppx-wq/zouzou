import { describe, expect, it } from 'vitest'
import { coordinateArray, getPlaceCoordinates, normalizePlace } from './places'

describe('place normalization', () => {
  it('reads the supported legacy coordinate shapes', () => {
    expect(getPlaceCoordinates({ lng: 121.47, lat: 31.23 })).toMatchObject({ longitude: 121.47, latitude: 31.23 })
    expect(coordinateArray({ coordinates: [121.48, 31.24] })).toEqual([121.48, 31.24])
  })

  it('rejects placeholder coordinates and keeps the place searchable', () => {
    const place = normalizePlace({ id: 'legacy', title: '一家小店', location: '南京市秦淮区' })
    expect(place.name).toBe('一家小店')
    expect(place.address).toBe('南京市秦淮区')
    expect(getPlaceCoordinates({ lng: 0, lat: 0 })).toBeNull()
    expect(coordinateArray(place)).toBeNull()
    expect(place.lng).toBeUndefined()
    expect(place.lat).toBeUndefined()
  })
})
