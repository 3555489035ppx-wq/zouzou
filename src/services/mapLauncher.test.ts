import { describe, expect, it } from 'vitest'
import { getMapOptions, getRouteMapOptions, isSupportedMapUrl } from './mapLauncher'

const place = { id: 'place-1', name: '武康路', address: '上海市徐汇区武康路', latitude: 31.2111, longitude: 121.4374, coordinateSystem: 'gcj02' as const }

describe('external map launcher', () => {
  it('creates provider-specific links for a verified place', () => {
    const options = getMapOptions(place, '上海')
    expect(options).toHaveLength(3)
    expect(new URL(options.find((item) => item.provider === 'apple')!.url).searchParams.get('q')).toBe('上海 武康路 上海市徐汇区武康路')
    expect(options.find((item) => item.provider === 'apple')?.url).not.toContain('31.2111')
    expect(options.find((item) => item.provider === 'amap')?.url).toContain('/marker?position=121.4374%2C31.2111')
    expect(options.find((item) => item.provider === 'baidu')?.url).toContain('location=31.2111%2C121.4374')
    options.forEach((item) => expect(isSupportedMapUrl(item.url)).toBe(true))
  })

  it('falls back to a named search when coordinates are not verified', () => {
    const options = getMapOptions({ id: 'place-2', name: '小店' }, '南京')
    const apple = new URL(options.find((item) => item.provider === 'apple')!.url)
    const amap = new URL(options.find((item) => item.provider === 'amap')!.url)
    const baidu = new URL(options.find((item) => item.provider === 'baidu')!.url)
    expect(apple.pathname).toBe('/')
    expect(apple.searchParams.get('q')).toBe('南京 小店')
    expect(amap.pathname).toBe('/search')
    expect(amap.searchParams.get('keyword')).toBe('南京 小店')
    expect(amap.searchParams.get('city')).toBe('南京')
    expect(baidu.pathname).toBe('/place/search')
    expect(baidu.searchParams.get('query')).toBe('南京 小店')
    expect(baidu.searchParams.get('region')).toBe('南京')
  })

  it('does not allow arbitrary URLs to be opened as a map provider', () => {
    expect(isSupportedMapUrl('http://example.com')).toBe(false)
    expect(isSupportedMapUrl('https://example.com/map')).toBe(false)
  })

  it('creates one route-level link for a verified itinerary', () => {
    const options = getRouteMapOptions({ city: '上海', places: [place, { id: 'place-2', name: '上海图书馆', latitude: 31.2102, longitude: 121.4368 }] })
    expect(options).toHaveLength(3)
    expect(new URL(options.find((item) => item.provider === 'amap')!.url).pathname).toBe('/search')
    expect(new URL(options.find((item) => item.provider === 'apple')!.url).searchParams.get('dirflg')).toBe('w')
    expect(new URL(options.find((item) => item.provider === 'baidu')!.url).searchParams.get('query')).toBe('上海 上海图书馆')
  })

  it('keeps a named route searchable when a stop is not verified', () => {
    const options = getRouteMapOptions({ city: '南京', places: [{ id: 'place-1', name: '夫子庙' }, { id: 'place-2', name: '老门东' }] })
    expect(new URL(options.find((item) => item.provider === 'amap')!.url).pathname).toBe('/search')
    expect(new URL(options.find((item) => item.provider === 'amap')!.url).searchParams.get('keyword')).toBe('南京 老门东')
    expect(new URL(options.find((item) => item.provider === 'baidu')!.url).pathname).toBe('/place/search')
  })

  it.each([undefined, 'unknown', 'GCJ02'])('never treats an unknown coordinate system (%s) as GPS', coordinateSystem => {
    const options = getMapOptions({ ...place, city: '上海', coordinateSystem: coordinateSystem as typeof place.coordinateSystem })
    for (const option of options) {
      const url = new URL(option.url)
      expect(option.url).not.toContain('31.2111')
      expect(url.searchParams.get('q') ?? url.searchParams.get('keyword') ?? url.searchParams.get('query')).toBe('上海 武康路 上海市徐汇区武康路')
    }
  })

  it('keeps Chinese names, city and addresses unambiguous in search', () => {
    const options = getMapOptions({ id: 'shop', name: '人民公园 & 茶馆', city: '成都', area: '青羊区', address: '祠堂街9号' })
    for (const option of options) {
      const params = new URL(option.url).searchParams
      expect(params.get('q') ?? params.get('keyword') ?? params.get('query')).toBe('成都 青羊区 人民公园 & 茶馆 祠堂街9号')
    }
    expect(new URL(getMapOptions({ id: 'shop', name: '人民公园', city: '成都' }, '上海')[1].url).searchParams.get('city')).toBe('上海')
  })

  it.each(['wgs84', 'gcj02', 'bd09ll'] as const)('uses only supported %s marker coordinates', coordinateSystem => {
    const options = getMapOptions({ ...place, coordinateSystem })
    const apple = new URL(options[0].url)
    const amap = new URL(options[1].url)
    const baidu = new URL(options[2].url)
    expect(apple.searchParams.has('ll')).toBe(coordinateSystem === 'wgs84')
    expect(amap.pathname).toBe(coordinateSystem === 'bd09ll' ? '/search' : '/marker')
    expect(baidu.searchParams.get('coord_type')).toBe(coordinateSystem)
    expect(baidu.searchParams.get('src')).toBe('webapp.zouzou.travel')
  })

  it.each(['wgs84', 'gcj02', 'bd09ll', undefined] as const)('does not create identical endpoints for one %s stop', coordinateSystem => {
    const options = getRouteMapOptions({ places: [{ ...place, city: '上海', coordinateSystem }] })
    for (const option of options) {
      const params = new URL(option.url).searchParams
      expect(params.has('saddr')).toBe(false)
      expect(params.has('from')).toBe(false)
      expect(params.has('origin')).toBe(false)
    }
  })

  it.each([
    ['walk', 'w', 'walk', 'walking'],
    ['drive', 'd', 'car', 'driving'],
    ['transit', 'r', 'bus', 'transit'],
  ] as const)('maps %s to official transport values', (mode, appleMode, amapMode, baiduMode) => {
    const options = getRouteMapOptions({ mode, places: [place, { ...place, id: 'next', name: '图书馆', latitude: 31.22 }] })
    expect(new URL(options[0].url).searchParams.get('dirflg')).toBe(appleMode)
    expect(new URL(options[1].url).searchParams.get('mode')).toBe(amapMode)
    expect(new URL(options[2].url).searchParams.get('mode')).toBe(baiduMode)
  })

  it('uses official cycling support or an explicit place fallback', () => {
    const options = getRouteMapOptions({ mode: 'cycle', places: [place, { ...place, id: 'next', latitude: 31.22 }] })
    expect(new URL(options[0].url).searchParams.has('dirflg')).toBe(false)
    expect(new URL(options[1].url).searchParams.get('mode')).toBe('ride')
    expect(new URL(options[2].url).pathname).toBe('/marker')
    expect(options[0].description).toContain('选择骑行')
    expect(options[2].description).toContain('选择骑行')
  })

  it('does not send WGS84 to Amap navigation without a documented coordinate parameter', () => {
    const places = [place, { ...place, id: 'next', latitude: 31.22 }].map(stop => ({ ...stop, coordinateSystem: 'wgs84' as const }))
    expect(new URL(getRouteMapOptions({ places })[1].url).pathname).toBe('/search')
  })

  it('keeps unresolved coordinates out of marker URLs and rejects empty or pending routes', () => {
    getMapOptions({ ...place, mapStatus: 'unresolved' }).forEach(option => expect(option.url).not.toContain('31.2111'))
    expect(getRouteMapOptions({ places: [] })).toEqual([])
    expect(getRouteMapOptions({ places: [{ ...place, pendingVenue: true }] })).toEqual([])
    expect(isSupportedMapUrl('https://user@maps.apple.com/')).toBe(false)
    expect(isSupportedMapUrl('https://maps.apple.com.evil.example/')).toBe(false)
  })
})
