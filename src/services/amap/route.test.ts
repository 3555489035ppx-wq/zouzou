import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPublicWalkingRoute, getPublicWalkingRouteResult } from './route'

describe('public walking route adapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns provider geometry instead of connecting stops directly', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [{ geometry: { coordinates: [[121.1, 31.1], [121.11, 31.105], [121.2, 31.2]] } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(getPublicWalkingRoute([[121.1, 31.1], [121.2, 31.2]])).resolves.toEqual([[121.1, 31.1], [121.11, 31.105], [121.2, 31.2]])
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('overview=full'), expect.objectContaining({ headers: { Accept: 'application/json' } }))
  })

  it('rejects unavailable geometry so the UI can state that no route was drawn', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 'NoRoute', routes: [] }) }))

    await expect(getPublicWalkingRoute([[121.1, 31.1], [121.2, 31.2]])).rejects.toThrow('未返回可用道路几何')
  })

  it('returns provider metrics when the router includes them', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [{ distance: 1234, duration: 567, geometry: { coordinates: [[121.1, 31.1], [121.11, 31.105]] } }] }),
    }))

    await expect(getPublicWalkingRouteResult([[121.1, 31.1], [121.2, 31.2]])).resolves.toMatchObject({ distanceMeters: 1234, durationSeconds: 567, provider: 'osrm-public' })
  })

  it('times out a stalled public route request', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    })))
    const pending = getPublicWalkingRoute([[121.1, 31.1], [121.2, 31.2]])
    const assertion = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(8_001)
    await assertion
    vi.useRealTimers()
  })
})
