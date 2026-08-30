import { describe, expect, it } from 'vitest'
import { LocationError, requestCurrentLocation } from './location'

describe('location permission adapter', () => {
  it('returns a clear fallback when geolocation is unavailable', async () => {
    await expect(requestCurrentLocation()).rejects.toMatchObject({ status: 'unavailable' } satisfies Partial<LocationError>)
  })
})
