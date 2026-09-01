import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAmapSearchKeyword, clearAmapPoiCache, pickAmapPoi, resolveAmapPlaces, type AmapPoi } from './poi'

describe('AMap POI resolution', () => {
  beforeEach(() => clearAmapPoiCache())

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
})
