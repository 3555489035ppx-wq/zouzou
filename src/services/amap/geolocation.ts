import type { AMapNamespace, AMapPoiLocation, AMapPoint } from './provider'
import { wgs84ToGcj02 } from './route'

export type LiveLocation = {
  lng: number
  lat: number
  accuracy?: number
  heading?: number
  speed?: number
  timestamp: number
  source: 'gps' | 'amap' | 'network'
}

export type GeolocationFailureCode = 'GEOLOCATION_DENIED' | 'GEOLOCATION_TIMEOUT' | 'GEOLOCATION_UNAVAILABLE' | 'COORDINATE_CONVERSION_FAILED'

export class AmapGeolocationError extends Error {
  constructor(public readonly code: GeolocationFailureCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AmapGeolocationError'
  }
}

const toPoint = (value: AMapPoint | AMapPoiLocation | undefined): AMapPoint | null => {
  if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') return [value[0], value[1]]
  if (!value) return null
  const point = value as AMapPoiLocation
  const lng = point.getLng?.() ?? point.lng
  const lat = point.getLat?.() ?? point.lat
  return typeof lng === 'number' && typeof lat === 'number' ? [lng, lat] : null
}

async function convertGpsToGcj02(AMap: AMapNamespace | undefined, point: AMapPoint): Promise<AMapPoint> {
  if (!AMap?.convertFrom) return wgs84ToGcj02(point)
  return new Promise((resolve, reject) => {
    try {
      AMap.convertFrom?.(point, 'gps', (status, result) => {
        const converted = status === 'complete' ? toPoint(result.locations?.[0]) : null
        converted ? resolve(converted) : reject(new AmapGeolocationError('COORDINATE_CONVERSION_FAILED', '当前位置坐标转换失败。'))
      })
    } catch (error) {
      reject(new AmapGeolocationError('COORDINATE_CONVERSION_FAILED', '当前位置坐标转换失败。', { cause: error }))
    }
  })
}

const toLocation = async (AMap: AMapNamespace | undefined, position: GeolocationPosition): Promise<LiveLocation> => {
  const gpsPoint: AMapPoint = [position.coords.longitude, position.coords.latitude]
  const [lng, lat] = await convertGpsToGcj02(AMap, gpsPoint)
  return {
    lng,
    lat,
    accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : undefined,
    heading: Number.isFinite(position.coords.heading ?? NaN) ? position.coords.heading ?? undefined : undefined,
    speed: Number.isFinite(position.coords.speed ?? NaN) ? position.coords.speed ?? undefined : undefined,
    timestamp: Number.isFinite(position.timestamp) ? position.timestamp : Date.now(),
    source: 'gps',
  }
}

const toError = (error: GeolocationPositionError) => {
  if (error.code === 1) return new AmapGeolocationError('GEOLOCATION_DENIED', '你拒绝了定位权限，地图仍可继续浏览。')
  if (error.code === 3) return new AmapGeolocationError('GEOLOCATION_TIMEOUT', '定位超时，请检查系统定位设置后重试。')
  return new AmapGeolocationError('GEOLOCATION_UNAVAILABLE', '暂时无法获取当前位置，请检查系统定位设置。')
}

const ensureGeolocation = () => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) throw new AmapGeolocationError('GEOLOCATION_UNAVAILABLE', '当前浏览器不支持定位，地图仍可继续浏览。')
  return navigator.geolocation
}

export async function getCurrentLocation(AMap?: AMapNamespace, options: PositionOptions = {}): Promise<LiveLocation> {
  const geolocation = ensureGeolocation()
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => { void toLocation(AMap, position).then(resolve, reject) },
      (error) => reject(toError(error)),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000, ...options },
    )
  })
}

export function startLocationTracking(
  AMap: AMapNamespace | undefined,
  onLocation: (location: LiveLocation) => void,
  onError: (error: AmapGeolocationError) => void,
  options: PositionOptions = {},
) {
  const geolocation = ensureGeolocation()
  const watchId = geolocation.watchPosition(
    (position) => { void toLocation(AMap, position).then(onLocation, (error) => onError(error instanceof AmapGeolocationError ? error : new AmapGeolocationError('COORDINATE_CONVERSION_FAILED', '当前位置坐标转换失败。'))) },
    (error) => onError(toError(error)),
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000, ...options },
  )
  return () => geolocation.clearWatch(watchId)
}

export function stopLocationTracking(stop: (() => void) | null | undefined) {
  stop?.()
}
