import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAmapSearchKeyword, clearAmapPoiCache, pickAmapPoi, resolveAmapPlaces, type AmapPoi } from './poi'
import { clearRememberedAmapPlaces } from './placeRegistry'

function createMemoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

describe('AMap POI resolution', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: createMemoryStorage(), sessionStorage: createMemoryStorage() })
    clearAmapPoiCache()
    clearRememberedAmapPlaces()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('builds a city-scoped query without placeholder wording', () => {
    expect(buildAmapSearchKeyword({ city: '昆明', area: '五华区', name: '野生菌火锅（待选）' }))
      .toBe('昆明 五华区 野生菌火锅')
  })

  it('prefers an exact name match and never returns a POI without coordinates', () => {
    const pois: AmapPoi[] = [
      { id: 'nearby', name: '昆明野生菌火锅推荐', position: [102.71, 25.04] },
      { id: 'exact', name: '野生菌火锅（南屏街店）', position: [102.72, 25.05] },
    ]

    expect(pickAmapPoi('野生菌火锅', pois)).toMatchObject({ id: 'exact' })
    expect(pickAmapPoi('昆明核心区舒适型酒店', [{ id: 'hotel', name: '昆明某舒适酒店', position: [102.72, 25.05] }])).toBeNull()
    expect(pickAmapPoi('武康大楼', [
      { id: 'same-1', name: '武康大楼', position: [121.43, 31.21] },
      { id: 'same-2', name: '武康大楼', position: [121.44, 31.22] },
    ])).toBeNull()
    expect(pickAmapPoi('完全不存在的地点', pois)).toBeNull()
  })

  it('returns the real name, address and coordinates from the AMap search result', async () => {
    class MockPlaceSearch {
      search(_keyword: string, callback: (status: string, result: { poiList: { pois: Array<{ id: string; name: string; location: [number, number]; address: string }> } }) => void) {
        callback('complete', { poiList: { pois: [{ id: 'poi-1', name: '野生菌火锅（南屏街店）', location: [102.72, 25.05], address: '昆明市五华区南屏街' }] } })
      }
    }

    const [resolved] = await resolveAmapPlaces({ PlaceSearch: MockPlaceSearch } as never, [{ id: 'mushroom', city: '昆明', area: '五华区', name: '野生菌火锅' }])

    expect(resolved.poi).toMatchObject({ id: 'poi-1', name: '野生菌火锅（南屏街店）', address: '昆明市五华区南屏街' })
    expect(resolved.poi?.position).toEqual([102.72, 25.05])
  })

  it('caches a verified result by the city-scoped query', async () => {
    const search = vi.fn((_keyword: string, callback: (status: string, result: { poiList: { pois: Array<{ id: string; name: string; location: [number, number] }> } }) => void) => {
      callback('complete', { poiList: { pois: [{ id: 'poi-cache', name: '武康大楼', location: [121.43, 31.21] }] } })
    })
    class MockPlaceSearch { search = search }
    const AMap = { PlaceSearch: MockPlaceSearch } as never
    const query = { id: 'wukang', city: '上海', name: '武康大楼' }

    await resolveAmapPlaces(AMap, [query])
    await resolveAmapPlaces(AMap, [query])

    expect(search).toHaveBeenCalledTimes(1)
  })

  it('recovers a verified POI from local memory after the runtime cache is cleared', async () => {
    const firstSearch = vi.fn((_keyword: string, callback: (status: string, result: { poiList: { pois: Array<{ id: string; name: string; location: [number, number]; address: string }> } }) => void) => {
      callback('complete', { poiList: { pois: [{ id: 'poi-memory', name: '叶新小吃店', location: [121.48, 31.23], address: '上海市黄浦区示例路 1 号' }] } })
    })
    class FirstPlaceSearch { search = firstSearch }
    const query = { id: 'memory', city: '上海', name: '叶新小吃店' }
    await resolveAmapPlaces({ PlaceSearch: FirstPlaceSearch } as never, [query])

    clearAmapPoiCache()
    const secondSearch = vi.fn()
    class SecondPlaceSearch { search = secondSearch }
    const [recovered] = await resolveAmapPlaces({ PlaceSearch: SecondPlaceSearch } as never, [query])

    expect(recovered.status).toBe('verified')
    expect(recovered.poi).toMatchObject({ id: 'poi-memory', name: '叶新小吃店', address: '上海市黄浦区示例路 1 号' })
    expect(secondSearch).not.toHaveBeenCalled()
  })
})
