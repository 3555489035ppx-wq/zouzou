import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPublicWalkingRoute } from './route'

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
})
