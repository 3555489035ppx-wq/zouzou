import { afterEach, describe, expect, it, vi } from 'vitest'
import { AmapGeolocationError, getCurrentLocation } from './geolocation'

describe('browser geolocation adapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns a real browser position without inventing a fallback location', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({
      coords: { longitude: 121.4737, latitude: 31.2304, accuracy: 25, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
      timestamp: 1_700_000_000_000,
    } as GeolocationPosition))
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    await expect(getCurrentLocation()).resolves.toMatchObject({ source: 'gps', accuracy: 25, timestamp: 1_700_000_000_000 })
    expect(getCurrentPosition).toHaveBeenCalledOnce()
  })

  it('surfaces a denied permission instead of returning a city center', async () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_success: PositionCallback, failure: PositionErrorCallback) => failure({ code: 1, message: 'denied' } as GeolocationPositionError) } })

    await expect(getCurrentLocation()).rejects.toMatchObject({ code: 'GEOLOCATION_DENIED' })
    await expect(getCurrentLocation()).rejects.toBeInstanceOf(AmapGeolocationError)
  })
})
