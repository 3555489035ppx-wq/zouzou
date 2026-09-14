import type { CoordinateSystem } from './places'
import { getPlaceCoordinates } from './places'

export type MapProvider = 'apple' | 'amap' | 'baidu'
export type MapTravelMode = 'walk' | 'drive' | 'transit' | 'cycle'

// Official URI references checked 2026-09-14:
// https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html
// https://lbs.amap.com/api/uri-api/guide/travel/route
// https://lbs.amap.com/api/uri-api/gettingstarted
// https://lbs.baidu.com/docs/webapi?title=mapadjustment%2Furi%2Fweb
// Apple legacy URLs document d/w/r only; Baidu Web documents driving/walking/transit.
// Cycling falls back to a place search on those providers. Amap navigation currently
// documents no coordinate parameter: only pass GCJ02; WGS84 remains valid for marker.
const knownCoordinates = (place: MapPlace) => {
  if (place.mapStatus === 'unresolved') return null
  const coordinates = getPlaceCoordinates(place)
  return coordinates?.coordinateSystem ? coordinates : null
}

export type MapPlace = {
  mapStatus?: 'resolved' | 'unresolved'
  pendingVenue?: boolean
  id: string
  name: string
  address?: string
  area?: string
  city?: string
  latitude?: number
  longitude?: number
  lat?: number
  lng?: number
  coordinates?: [number, number]
  coordinateSystem?: CoordinateSystem
}

export function canNavigatePlace(place:MapPlace,city = place.city) {
  if(place.pendingVenue || place.mapStatus==='unresolved' || place.name.trim()===city || /待选|待确认|城市中心/.test(place.name))return false
  return Boolean(place.address?.trim() || getPlaceCoordinates(place)?.coordinateSystem)
}

export type MapOption = {
  provider: MapProvider
  label: string
  description: string
  url: string
}

export type MapRoute = {
  city?: string
  places: MapPlace[]
  mode?: MapTravelMode
}

const mapHosts: Record<MapProvider, string> = {
  apple: 'maps.apple.com',
  amap: 'uri.amap.com',
  baidu: 'api.map.baidu.com',
}

const placeQuery = (place: MapPlace, city = place.city) => [city, place.area, place.name, place.address].filter(Boolean).join(' ')

const routePlaces = (route: MapRoute) => route.places.filter((place) => Boolean(place.name?.trim()))

const withParams = (origin: string, path: string, params: Record<string, string | undefined>) => {
  const url = new URL(path, origin)
  Object.entries(params).forEach(([key, value]) => { if (value) url.searchParams.set(key, value) })
  return url.toString()
}

export function buildAppleMapsUrl(place: MapPlace, city = place.city) {
  const coordinates = knownCoordinates(place)
  if (coordinates?.coordinateSystem === 'wgs84') return withParams('https://maps.apple.com', '/', {
    ll: `${coordinates.latitude},${coordinates.longitude}`,
    q: place.name,
    address: place.address?.trim() || placeQuery(place, city),
  })
  return withParams('https://maps.apple.com', '/', { q: placeQuery(place, city) })
}

export function buildAmapUrl(place: MapPlace, city = place.city) {
  const coordinates = knownCoordinates(place)
  if (coordinates && coordinates.coordinateSystem !== 'bd09ll') return withParams('https://uri.amap.com', '/marker', {
    position: `${coordinates.longitude},${coordinates.latitude}`,
    name: place.name,
    src: 'zouzou',
    coordinate: coordinates.coordinateSystem === 'gcj02' ? 'gaode' : 'wgs84',
    callnative: '1',
  })
  return withParams('https://uri.amap.com', '/search', {
    keyword: placeQuery(place, city),
    city,
    src: 'zouzou',
    callnative: '1',
  })
}

export function buildBaiduMapsUrl(place: MapPlace, city = place.city) {
  const coordinates = knownCoordinates(place)
  if (coordinates) return withParams('https://api.map.baidu.com', '/marker', {
    location: `${coordinates.latitude},${coordinates.longitude}`,
    title: place.name,
    content: place.address?.trim() || placeQuery(place, city),
    output: 'html',
    coord_type: coordinates.coordinateSystem,
    src: 'webapp.zouzou.travel',
  })
  return withParams('https://api.map.baidu.com', '/place/search', {
    query: placeQuery(place, city),
    region: city ?? place.area,
    output: 'html',
    src: 'webapp.zouzou.travel',
  })
}

export function buildAppleRouteUrl(route: MapRoute) {
  const places = routePlaces(route)
  const from = places[0]
  const to = places[1] ?? places[0]
  if (route.mode === 'cycle' && to) return buildAppleMapsUrl(to, route.city)
  const dirflg = { walk: 'w', drive: 'd', transit: 'r', cycle: 'w' }[route.mode ?? 'walk']
  const fromCoordinates = from && places.length > 1 ? knownCoordinates(from) : null
  const toCoordinates = to ? knownCoordinates(to) : null
  if (fromCoordinates?.coordinateSystem === 'wgs84' && toCoordinates?.coordinateSystem === 'wgs84') {
    return withParams('https://maps.apple.com', '/', {
      saddr: `${fromCoordinates.latitude},${fromCoordinates.longitude}`,
      daddr: `${toCoordinates.latitude},${toCoordinates.longitude}`,
      dirflg,
    })
  }
  return withParams('https://maps.apple.com', '/', { saddr: from && places.length > 1 ? placeQuery(from, route.city) : undefined, daddr: toCoordinates?.coordinateSystem === 'wgs84' ? `${toCoordinates.latitude},${toCoordinates.longitude}` : to ? placeQuery(to, route.city) : undefined, dirflg })
}

export function buildAmapRouteUrl(route: MapRoute) {
  const places = routePlaces(route)
  const from = places[0]
  const to = places[1] ?? places[0]
  const fromCoordinates = from && places.length > 1 ? knownCoordinates(from) : null
  const toCoordinates = to ? knownCoordinates(to) : null
  if (toCoordinates?.coordinateSystem === 'gcj02' && (places.length === 1 || fromCoordinates?.coordinateSystem === 'gcj02')) {
    return withParams('https://uri.amap.com', '/navigation', {
      from: fromCoordinates ? `${fromCoordinates.longitude},${fromCoordinates.latitude},${from?.name.replaceAll(',', '，')}` : undefined,
      to: `${toCoordinates.longitude},${toCoordinates.latitude},${to?.name.replaceAll(',', '，')}`,
      mode: { walk: 'walk', drive: 'car', transit: 'bus', cycle: 'ride' }[route.mode ?? 'walk'],
      src: 'zouzou',
      callnative: '1',
    })
  }
  return withParams('https://uri.amap.com', '/search', {
    keyword: to ? placeQuery(to, route.city) : undefined,
    city: route.city ?? to?.city,
    src: 'zouzou',
    callnative: '1',
  })
}

export function buildBaiduRouteUrl(route: MapRoute) {
  const places = routePlaces(route)
  const from = places[0]
  const to = places[1] ?? places[0]
  if (to && (places.length === 1 || route.mode === 'cycle')) return buildBaiduMapsUrl(to, route.city)
  const fromCoordinates = from ? knownCoordinates(from) : null
  const toCoordinates = to ? knownCoordinates(to) : null
  if (fromCoordinates && toCoordinates && fromCoordinates.coordinateSystem === toCoordinates.coordinateSystem) {
    return withParams('https://api.map.baidu.com', '/direction', {
      origin: `${fromCoordinates.latitude},${fromCoordinates.longitude}`,
      destination: `${toCoordinates.latitude},${toCoordinates.longitude}`,
      mode: { walk: 'walking', drive: 'driving', transit: 'transit', cycle: 'walking' }[route.mode ?? 'walk'],
      coord_type: fromCoordinates.coordinateSystem,
      region: route.city ?? to?.city,
      origin_region: route.city ?? from?.city,
      destination_region: route.city ?? to?.city,
      output: 'html',
      src: 'webapp.zouzou.travel',
    })
  }
  return withParams('https://api.map.baidu.com', '/place/search', {
    query: to ? placeQuery(to, route.city) : undefined,
    region: route.city ?? to?.city,
    output: 'html',
    src: 'webapp.zouzou.travel',
  })
}

export function isSupportedMapUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && Object.values(mapHosts).includes(url.host)
  } catch {
    return false
  }
}

export function getMapOptions(place: MapPlace, city?: string): MapOption[] {
  if (place.pendingVenue || !place.name.trim()) return []
  const options: MapOption[] = [
    { provider: 'apple', label: 'Apple 地图', description: '在浏览器或 Apple 地图中打开', url: buildAppleMapsUrl(place, city) },
    { provider: 'amap', label: '高德地图', description: '打开高德地图地点或搜索页', url: buildAmapUrl(place, city) },
    { provider: 'baidu', label: '百度地图', description: '打开百度地图地点或搜索页', url: buildBaiduMapsUrl(place, city) },
  ]
  return options.filter((option) => isSupportedMapUrl(option.url))
}

export function getRouteMapOptions(route: MapRoute): MapOption[] {
  if (!routePlaces(route).length || route.places.slice(0,2).some(place=>place.pendingVenue)) return []
  const options: MapOption[] = [
    { provider: 'apple', label: 'Apple 地图', description: route.mode === 'cycle' ? '搜索目的地，请在地图中选择骑行' : '单段路线；请在地图中确认地点', url: buildAppleRouteUrl(route) },
    { provider: 'amap', label: '高德地图', description: '单段路线；坐标不足时搜索下一站', url: buildAmapRouteUrl(route) },
    { provider: 'baidu', label: '百度地图', description: route.mode === 'cycle' ? '搜索目的地，请在地图中选择骑行' : '单地点打开地点；坐标不足时搜索下一站', url: buildBaiduRouteUrl(route) },
  ]
  return options.filter((option) => isSupportedMapUrl(option.url))
}

export function openMap(place: MapPlace, provider: MapProvider = 'apple', city?: string) {
  const option = getMapOptions(place, city).find((item) => item.provider === provider) ?? getMapOptions(place, city)[0]
  if (!option) return null
  if (typeof window !== 'undefined') {
    window.location.assign(option.url)
  }
  return option
}

export function openRouteMap(route: MapRoute, provider: MapProvider = 'apple') {
  const option = getRouteMapOptions(route).find((item) => item.provider === provider) ?? getRouteMapOptions(route)[0]
  if (!option) return null
  if (typeof window !== 'undefined') {
    window.location.assign(option.url)
  }
  return option
}
