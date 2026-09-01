import type { AMapNamespace, AMapPoiLocation, AMapPoiResult, AMapPoint } from './provider'
import { findRememberedAmapPlace, rememberAmapPlace, rememberedPlaceToAmapPoi } from './placeRegistry'

export type AmapPoi = {
  id: string
  name: string
  position: AMapPoint
  category?: string
  address?: string
  tel?: string
  district?: string
  adcode?: string
  citycode?: string
}

export type VerifiedPlace = {
  id: string
  inputName: string
  amapPoiId: string
  canonicalName: string
  address: string
  city: string
  district?: string
  adcode?: string
  citycode?: string
  lng: number
  lat: number
  poiType?: string
  tel?: string
  source: 'amap'
  verified: true
  verifiedAt: number
}

export type AmapPlaceQuery = {
  id: string
  city: string
  area?: string
  name: string
  searchKeyword?: string
  poiId?: string
  position?: AMapPoint
  address?: string
}

export type AmapPlaceResolutionStatus = 'verified' | 'ambiguous' | 'not_found' | 'error'

export type AmapPlaceResolution = {
  query: AmapPlaceQuery
  keyword: string
  poi: AmapPoi | null
  status: AmapPlaceResolutionStatus
  candidates?: AmapPoi[]
  verifiedPlace?: VerifiedPlace
}

const removePlaceholders = (value: string) => value
  .replace(/（[^）]*(?:待选|待核验|候选|社区线索|占位)[^）]*）/g, '')
  .replace(/\([^)]*(?:待选|待核验|候选|社区线索|占位)[^)]*\)/g, '')
  .replace(/\s+/g, ' ')
  .trim()

export function buildAmapSearchKeyword(query: Pick<AmapPlaceQuery, 'city' | 'area' | 'name' | 'searchKeyword'>) {
  return [query.city, query.area, removePlaceholders(query.searchKeyword ?? query.name)]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ')
}

const comparableName = (value: string) => removePlaceholders(value)
  .replace(/[（）()·•—\-_/：:]/g, '')
  .replace(/\s+/g, '')

const pointDistanceMeters = (left: AMapPoint, right: AMapPoint) => {
  const earthRadius = 6_371_000
  const lat = ((left[1] + right[1]) / 2) * Math.PI / 180
  const x = (right[0] - left[0]) * Math.PI / 180 * Math.cos(lat)
  const y = (right[1] - left[1]) * Math.PI / 180
  return Math.hypot(x, y) * earthRadius
}

type PoiMatchContext = { area?: string; position?: AMapPoint; category?: string }

export function rankAmapPois(query: string, pois: AmapPoi[], context: PoiMatchContext = {}) {
  const expected = comparableName(query)
  const expectedTerms = removePlaceholders(query).split(/[\s·•—\-_/：:]+/).map(comparableName).filter((term) => term.length >= 2)
  return pois.map((poi) => {
    const actual = comparableName(poi.name)
    const actualBase = comparableName(poi.name.replace(/（.*$|\(.*$/, ''))
    const searchable = comparableName(`${poi.name} ${poi.address ?? ''}`)
    let score = 0
    if (actual === expected || actualBase === expected) score += 100
    else if (actual.includes(expected) || expected.includes(actual)) score += 60
    else if (expectedTerms.some((term) => searchable.includes(term))) score += 20
    if (context.area && `${poi.address ?? ''}${poi.district ?? ''}`.includes(context.area)) score += 20
    if (context.category && poi.category?.includes(context.category)) score += 8
    if (context.position) score += Math.max(0, 8 - pointDistanceMeters(context.position, poi.position) / 1000)
    return { poi, score }
  }).sort((left, right) => right.score - left.score)
}

export function pickAmapPoi(query: string, pois: AmapPoi[], context: PoiMatchContext = {}) {
  const ranked = rankAmapPois(query, pois, context)
  const best = ranked[0]
  if (!best || best.score <= 0) return null
  const tied = ranked.filter((candidate) => candidate.score === best.score)
  return tied.length === 1 ? best.poi : null
}

const toPoint = (value: AMapPoiResult['location']): AMapPoint | null => {
  if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') return [value[0], value[1]]
  if (!value) return null
  const point = value as AMapPoiLocation
  const lng = point.getLng?.() ?? point.lng
  const lat = point.getLat?.() ?? point.lat
  return typeof lng === 'number' && typeof lat === 'number' ? [lng, lat] : null
}

const toAmapPoi = (item: AMapPoiResult, fallbackId: string): AmapPoi | null => {
  const position = toPoint(item.location)
  const name = item.name?.trim()
  if (!position || !name) return null
  return {
    id: item.id ?? fallbackId,
    name,
    position,
    address: item.address?.trim(),
    category: item.type,
    tel: item.tel?.trim(),
    district: item.district?.trim(),
    adcode: item.adcode,
    citycode: item.citycode,
  }
}

const POI_SEARCH_TIMEOUT_MS = 6_000

function searchAmapPois(AMap: AMapNamespace, query: AmapPlaceQuery, signal?: AbortSignal): Promise<AmapPoi[]> {
  const PlaceSearch = AMap.PlaceSearch
  if (!PlaceSearch) return Promise.reject(new Error('高德地点搜索服务未加载'))
  if (signal?.aborted) return Promise.reject(new DOMException('地点搜索已取消', 'AbortError'))
  const keyword = buildAmapSearchKeyword(query)
  return new Promise<AmapPoi[]>((resolve, reject) => {
    let settled = false
    const timer = globalThis.setTimeout(() => finish(new Error('高德地点搜索超时')), POI_SEARCH_TIMEOUT_MS)
    const abort = () => finish(new DOMException('地点搜索已取消', 'AbortError'))
    const finish = (error?: Error, value: AmapPoi[] = []) => {
      if (settled) return
      settled = true
      globalThis.clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      error ? reject(error) : resolve(value)
    }
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const search = new PlaceSearch({ city: query.city, citylimit: true, pageSize: 10, extensions: 'all' })
      search.search(keyword, (status, result) => {
        if (status === 'no_data') {
          finish(undefined, [])
          return
        }
        if (status !== 'complete') {
          finish(new Error(`高德地点搜索失败：${status}`))
          return
        }
        const pois = (result.poiList?.pois ?? []).flatMap((item, index) => {
          const poi = toAmapPoi(item, `${query.id}-${index}`)
          return poi ? [poi] : []
        })
        finish(undefined, pois)
      })
    } catch (error) {
      finish(error instanceof Error ? error : new Error('高德地点搜索失败'))
    }
  })
}

const poiCache = new Map<string, Pick<AmapPlaceResolution, 'keyword' | 'poi' | 'status' | 'candidates'>>()

const poiCacheKey = (query: AmapPlaceQuery) => buildAmapSearchKeyword(query).toLocaleLowerCase()

export function clearAmapPoiCache() {
  poiCache.clear()
}

export function toVerifiedPlace(query: AmapPlaceQuery, poi: AmapPoi, verifiedAt = Date.now()): VerifiedPlace {
  return {
    id: query.id,
    inputName: query.searchKeyword ?? query.name,
    amapPoiId: poi.id,
    canonicalName: poi.name,
    address: poi.address ?? '',
    city: query.city,
    district: poi.district ?? query.area,
    adcode: poi.adcode,
    citycode: poi.citycode,
    lng: poi.position[0],
    lat: poi.position[1],
    poiType: poi.category,
    tel: poi.tel,
    source: 'amap',
    verified: true,
    verifiedAt,
  }
}

export async function getPlaceDetails(AMap: AMapNamespace, query: Pick<AmapPlaceQuery, 'city'>, poiId: string, signal?: AbortSignal) {
  const PlaceSearch = AMap.PlaceSearch
  if (!PlaceSearch) return null
  const search = new PlaceSearch({ city: query.city, citylimit: true, extensions: 'all' })
  if (!search.getDetails) return null
  if (signal?.aborted) throw new DOMException('地点详情已取消', 'AbortError')
  return new Promise<AmapPoi | null>((resolve, reject) => {
    const abort = () => reject(new DOMException('地点详情已取消', 'AbortError'))
    signal?.addEventListener('abort', abort, { once: true })
    search.getDetails?.(poiId, (status, result) => {
      signal?.removeEventListener('abort', abort)
      if (status !== 'complete') return resolve(null)
      const item = result.poiList?.pois?.[0]
      resolve(item ? toAmapPoi(item, poiId) : null)
    })
  })
}

export async function resolveAmapPlaces(AMap: AMapNamespace, queries: AmapPlaceQuery[], signal?: AbortSignal): Promise<AmapPlaceResolution[]> {
  const settled = await Promise.all(queries.map(async (query): Promise<AmapPlaceResolution> => {
    const keyword = buildAmapSearchKeyword(query)
    if (query.poiId && query.position) {
      const poi = { id: query.poiId, name: query.name, position: query.position, address: query.address }
      rememberAmapPlace(query, poi)
      return { query, keyword, poi, status: 'verified', verifiedPlace: toVerifiedPlace(query, poi) }
    }
    const remembered = findRememberedAmapPlace(query)
    if (remembered) {
      const poi = rememberedPlaceToAmapPoi(remembered)
      return { query, keyword: remembered.searchKeyword, poi, status: 'verified', verifiedPlace: toVerifiedPlace(query, poi, remembered.verifiedAt) }
    }
    const cached = poiCache.get(poiCacheKey(query))
    if (cached) {
      return { query, ...cached, verifiedPlace: cached.poi ? toVerifiedPlace(query, cached.poi) : undefined }
    }
    try {
      const pois = await searchAmapPois(AMap, query, signal)
      const cleanedName = removePlaceholders(query.searchKeyword ?? query.name)
      const ranked = rankAmapPois(cleanedName, pois, { area: query.area, position: query.position })
      const poi = pickAmapPoi(cleanedName, pois, { area: query.area, position: query.position })
      const bestScore = ranked[0]?.score ?? 0
      const tied = bestScore > 0 && ranked.filter((candidate) => candidate.score === bestScore).length > 1
      const status: AmapPlaceResolutionStatus = poi ? 'verified' : tied ? 'ambiguous' : 'not_found'
      const result = { keyword, poi, status, candidates: ranked.slice(0, 5).map((candidate) => candidate.poi) }
      if (poi) rememberAmapPlace(query, poi)
      poiCache.set(poiCacheKey(query), result)
      return { query, ...result, verifiedPlace: poi ? toVerifiedPlace(query, poi) : undefined }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      return { query, keyword, poi: null, status: 'error' }
    }
  }))
  return settled
}

export const resolvePlanPlaces = resolveAmapPlaces

/** Local POI contract; a real search adapter can be wired without changing UI callers. */
export interface AmapPoiAdapter {
  search(keyword: string, center?: AMapPoint): Promise<AmapPoi[]>
}

export const localPoiAdapter: AmapPoiAdapter = {
  async search() { return [] },
}
