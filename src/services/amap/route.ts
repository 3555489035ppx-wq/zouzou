import type { AMapNamespace, AMapOverlay, AMapPoint } from './provider'
import { ServiceError } from '../asyncState'
import { track, trackPerformance } from '../analytics'

export function createAmapRoute(AMap: AMapNamespace, path: AMapPoint[], options: Record<string, unknown> = {}): AMapOverlay {
  return new AMap.Polyline({ path, strokeColor: '#1f6fff', strokeWeight: 4, strokeOpacity: 0.92, lineJoin: 'round', lineCap: 'round', ...options })
}

type AMapRouteResult = {
  routes?: Array<{
    steps?: Array<{ path?: unknown[] }>
  }>
}

type AMapLngLat = {
  getLng?: () => number
  getLat?: () => number
  lng?: number
  lat?: number
}

const outOfChina = (lng: number, lat: number) => lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
const transformLat = (lng: number, lat: number) => -100 + 2 * lng + 3 * lat + .2 * lat * lat + .1 * lng * lat + .2 * Math.sqrt(Math.abs(lng)) + (20 * Math.sin(6 * lng * Math.PI) + 20 * Math.sin(2 * lng * Math.PI)) * 2 / 3 + (20 * Math.sin(lat * Math.PI) + 40 * Math.sin(lat / 3 * Math.PI)) * 2 / 3 + (160 * Math.sin(lat / 12 * Math.PI) + 320 * Math.sin(lat * Math.PI / 30)) * 2 / 3
const transformLng = (lng: number, lat: number) => 300 + lng + 2 * lat + .1 * lng * lng + .1 * lng * lat + .1 * Math.sqrt(Math.abs(lng)) + (20 * Math.sin(6 * lng * Math.PI) + 20 * Math.sin(2 * lng * Math.PI)) * 2 / 3 + (20 * Math.sin(lng * Math.PI) + 40 * Math.sin(lng / 3 * Math.PI)) * 2 / 3 + (150 * Math.sin(lng / 12 * Math.PI) + 300 * Math.sin(lng / 30 * Math.PI)) * 2 / 3

// Demo POIs are stored as WGS-84 for the MapLibre fallback. AMap JS uses
// GCJ-02, so both the route request and its displayed POIs use this boundary
// conversion instead of silently drawing an offset line.
export function wgs84ToGcj02([lng, lat]: AMapPoint): AMapPoint {
  if (outOfChina(lng, lat)) return [lng, lat]
  const a = 6378245
  const ee = .00669342162296594323
  let deltaLat = transformLat(lng - 105, lat - 35)
  let deltaLng = transformLng(lng - 105, lat - 35)
  const radLat = lat / 180 * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  deltaLat = deltaLat * 180 / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI)
  deltaLng = deltaLng * 180 / (a / sqrtMagic * Math.cos(radLat) * Math.PI)
  return [lng + deltaLng, lat + deltaLat]
}

const toPoint = (value: unknown): AMapPoint | null => {
  if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') return [value[0], value[1]]
  if (!value || typeof value !== 'object') return null
  const point = value as AMapLngLat
  const lng = point.getLng?.() ?? point.lng
  const lat = point.getLat?.() ?? point.lat
  return typeof lng === 'number' && typeof lat === 'number' ? [lng, lat] : null
}

const getRoutePoints = (result: unknown): AMapPoint[] => {
  const route = (result as AMapRouteResult)?.routes?.[0]
  const path = route?.steps?.flatMap((step) => step.path ?? []).map(toPoint).filter((point): point is AMapPoint => point !== null) ?? []
  return path.filter((point, index) => index === 0 || point[0] !== path[index - 1][0] || point[1] !== path[index - 1][1])
}

const AMAP_ROUTE_TIMEOUT_MS = 8_000

export async function getAmapWalkingRoute(AMap: AMapNamespace, stops: AMapPoint[], signal?: AbortSignal): Promise<AMapPoint[]> {
  const Walking = AMap.Walking
  if (!Walking) throw new Error('高德步行路线服务未加载')
  if (stops.length < 2) return stops
  if (signal?.aborted) throw new ServiceError('路线请求已取消。', 'CANCELLED')
  const legs = await Promise.all(stops.slice(1).map((destination, index) => new Promise<AMapPoint[]>((resolve, reject) => {
    let settled = false
    const timer = globalThis.setTimeout(() => finish(new ServiceError('高德路线服务响应超时，请稍后重试。', 'TIMEOUT')), AMAP_ROUTE_TIMEOUT_MS)
    const abort = () => finish(new ServiceError('路线请求已取消。', 'CANCELLED'))
    const finish = (error?: Error, points?: AMapPoint[]) => {
      if (settled) return
      settled = true
      globalThis.clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      error ? reject(error) : resolve(points ?? [])
    }
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const walking = new Walking()
      walking.search(stops[index], destination, (status, result) => {
        const points = status === 'complete' ? getRoutePoints(result) : []
        if (points.length < 2) finish(new ServiceError('高德未返回可用步行路线', 'INVALID_RESPONSE'))
        else finish(undefined, points)
      })
    } catch (error) {
      finish(new ServiceError('高德步行路线服务暂时不可用。', 'UNKNOWN', { cause: error }))
    }
  })))
  return legs.reduce<AMapPoint[]>((route, leg) => route.concat(route.length ? leg.slice(1) : leg), [])
}

type PublicWalkingRouteResponse = {
  code?: string
  routes?: Array<{ distance?: number; duration?: number; geometry?: { coordinates?: unknown[] } }>
}

export type WalkingRouteResult = {
  path: AMapPoint[]
  distanceMeters: number
  durationSeconds: number
  provider: 'osrm-public'
}

const publicWalkingRouteBase = (import.meta.env.VITE_WALKING_ROUTE_URL ?? 'https://routing.openstreetmap.de/routed-foot/route/v1/driving').replace(/\/+$/, '')
const PUBLIC_ROUTE_TIMEOUT_MS = 8_000

function pathDistanceMeters(path: AMapPoint[]) {
  return path.slice(1).reduce((total, [lng, lat], index) => {
    const [previousLng, previousLat] = path[index]
    const earthRadius = 6_371_000
    const dLat = (lat - previousLat) * Math.PI / 180
    const dLng = (lng - previousLng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(previousLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return total + 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }, 0)
}

/**
 * A keyless walking fallback for local and preview environments. The service
 * returns an OSM road geometry; it is intentionally never replaced with a
 * straight line when it fails.
 */
export async function getPublicWalkingRouteResult(stops: AMapPoint[], signal?: AbortSignal): Promise<WalkingRouteResult> {
  if (stops.length < 2) return { path: stops, distanceMeters: 0, durationSeconds: 0, provider: 'osrm-public' }
  const startedAt = typeof performance === 'undefined' ? Date.now() : performance.now()
  const coordinates = stops.map(([lng, lat]) => `${lng},${lat}`).join(';')
  const params = new URLSearchParams({ overview: 'full', geometries: 'geojson', steps: 'false' })
  const controller = new AbortController()
  const abortFromCaller = () => controller.abort()
  if (signal?.aborted) throw new ServiceError('路线请求已取消。', 'CANCELLED')
  signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = globalThis.setTimeout(() => controller.abort(), PUBLIC_ROUTE_TIMEOUT_MS)
  track('route_requested', { stops: stops.length, provider: 'osrm-public' })
  try {
    const response = await fetch(`${publicWalkingRouteBase}/${coordinates}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : response.status === 429 ? 'RATE_LIMITED' : 'UNKNOWN'
      throw new ServiceError(`公开步行路线服务 HTTP ${response.status}`, code)
    }
    const result = await response.json() as PublicWalkingRouteResponse
    const path = result.routes?.[0]?.geometry?.coordinates
      ?.filter((point): point is AMapPoint => Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number') ?? []
    if (result.code !== 'Ok' || path.length < 2) throw new ServiceError('公开步行路线服务未返回可用道路几何', 'INVALID_RESPONSE')
    const route = result.routes?.[0]
    const value = {
      path,
      distanceMeters: typeof route?.distance === 'number' && route.distance >= 0 ? route.distance : pathDistanceMeters(path),
      durationSeconds: typeof route?.duration === 'number' && route.duration >= 0 ? route.duration : 0,
      provider: 'osrm-public' as const,
    }
    track('route_succeeded', { stops: stops.length, provider: value.provider, distanceMeters: Math.round(value.distanceMeters), durationSeconds: Math.round(value.durationSeconds) })
    return value
  } catch (error) {
    if (signal?.aborted) {
      track('route_failed', { code: 'CANCELLED' })
      throw new ServiceError('路线请求已取消。', 'CANCELLED', { cause: error })
    }
    if (controller.signal.aborted) {
      track('route_failed', { code: 'TIMEOUT' })
      throw new ServiceError('路线服务响应超时，请稍后重试。', 'TIMEOUT', { cause: error })
    }
    const serviceError = error instanceof ServiceError ? error : new ServiceError('路线服务暂时不可用，请稍后重试。', 'UNKNOWN', { cause: error })
    track('route_failed', { code: serviceError.code })
    throw serviceError
  } finally {
    globalThis.clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromCaller)
    trackPerformance('walking_route', (typeof performance === 'undefined' ? Date.now() : performance.now()) - startedAt)
  }
}

export async function getPublicWalkingRoute(stops: AMapPoint[], signal?: AbortSignal): Promise<AMapPoint[]> {
  const result = await getPublicWalkingRouteResult(stops, signal)
  return result.path
}
