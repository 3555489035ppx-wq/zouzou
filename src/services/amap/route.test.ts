import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAmapRouteCache, getAmapWalkingRouteLeg, getAmapWalkingRouteSnapshot, getPublicWalkingRoute, getPublicWalkingRouteResult } from './route'
import type { AMapNamespace } from './provider'

describe('public walking route adapter', () => {
  beforeEach(() => clearAmapRouteCache())
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

describe('amap walking route adapter', () => {
  beforeEach(() => clearAmapRouteCache())

  it('normalizes road geometry and metrics into cached route legs', async () => {
    const search = vi.fn((_from, _to, callback) => callback('complete', {
      routes: [{ distance: 420, time: 300, steps: [{ road: '安福路', instruction: '沿安福路向前', distance: 420, time: 300, path: [[121.44, 31.21], [121.441, 31.211], [121.442, 31.212]] }] }],
    }))
    class Walking { search = search }
    const AMap = { Walking } as unknown as AMapNamespace
    const from = { position: [121.44, 31.21] as [number, number], poiId: 'from' }
    const to = { position: [121.442, 31.212] as [number, number], poiId: 'to' }

    const first = await getAmapWalkingRouteLeg(AMap, from, to)
    const second = await getAmapWalkingRouteLeg(AMap, from, to)

    expect(first).toMatchObject({ fromPoiId: 'from', toPoiId: 'to', distanceMeters: 420, durationSeconds: 300, provider: 'amap' })
    expect(first.path).toEqual([[121.44, 31.21], [121.441, 31.211], [121.442, 31.212]])
    expect(first.steps?.[0]).toMatchObject({ road: '安福路', instruction: '沿安福路向前', distanceMeters: 420, durationSeconds: 300 })
    expect(second).toBe(first)
    expect(search).toHaveBeenCalledTimes(1)
  })

  it('combines consecutive real legs without drawing a straight connector', async () => {
    const search = vi.fn((from: [number, number], to: [number, number], callback: (status: string, result: unknown) => void) => callback('complete', {
      routes: [{ distance: 100, time: 60, steps: [{ path: [from, [from[0] + .001, from[1] + .001], to] }] }],
    }))
    class Walking { search = search }
    const AMap = { Walking } as unknown as AMapNamespace
    const snapshot = await getAmapWalkingRouteSnapshot(AMap, [
      { position: [121.44, 31.21], poiId: 'a' },
      { position: [121.45, 31.22], poiId: 'b' },
      { position: [121.46, 31.23], poiId: 'c' },
    ])

    expect(snapshot.legs).toHaveLength(2)
    expect(snapshot.distanceMeters).toBe(200)
    expect(snapshot.path).toHaveLength(5)
    expect(snapshot.path[0]).toEqual([121.44, 31.21])
    expect(snapshot.path[1][0]).toBeCloseTo(121.441)
    expect(snapshot.path[1][1]).toBeCloseTo(31.211)
    expect(snapshot.path[2]).toEqual([121.45, 31.22])
    expect(snapshot.path[3][0]).toBeCloseTo(121.451)
    expect(snapshot.path[3][1]).toBeCloseTo(31.221)
    expect(snapshot.path[4]).toEqual([121.46, 31.23])
    expect(snapshot.provider).toBe('amap')
  })
})
