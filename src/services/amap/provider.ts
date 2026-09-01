export type AMapPoint = [number, number]

export type AMapPoiLocation = {
  getLng?: () => number
  getLat?: () => number
  lng?: number
  lat?: number
}

export type AMapPoiResult = {
  id?: string
  name?: string
  address?: string
  type?: string
  tel?: string
  district?: string
  adcode?: string
  citycode?: string
  location?: AMapPoiLocation | AMapPoint
}

export type AMapPlaceSearchResult = {
  poiList?: { pois?: AMapPoiResult[] }
}

export type AMapPlaceSearchLike = {
  search: (keyword: string, callback: (status: string, result: AMapPlaceSearchResult) => void) => void
  getDetails?: (poiId: string, callback: (status: string, result: AMapPlaceSearchResult) => void) => void
}

export type AMapOverlay = {
  setMap?: (map: AMapMapLike | null) => void
  setPosition?: (point: AMapPoint) => void
  setRadius?: (radius: number) => void
  setPath?: (path: AMapPoint[]) => void
  setContent?: (content: string | HTMLElement) => void
  getContent?: () => string | HTMLElement
}

export type AMapMapLike = {
  add: (overlay: AMapOverlay | AMapOverlay[]) => void
  remove: (overlay: AMapOverlay | AMapOverlay[]) => void
  setFitView: (overlays?: AMapOverlay[], immediately?: boolean, padding?: [number, number, number, number]) => void
  setCenter?: (point: AMapPoint, immediately?: boolean) => void
  panTo?: (point: AMapPoint, duration?: number) => void
  on?: (event: string, handler: () => void) => void
  off?: (event: string, handler: () => void) => void
  destroy: () => void
}

export type AMapNamespace = {
  Map: new (container: HTMLElement, options?: Record<string, unknown>) => AMapMapLike
  Polyline: new (options: Record<string, unknown>) => AMapOverlay
  Marker: new (options: Record<string, unknown>) => AMapOverlay
  Circle?: new (options: Record<string, unknown>) => AMapOverlay
  convertFrom?: (point: AMapPoint, type: 'gps', callback: (status: string, result: { locations?: Array<AMapPoint | AMapPoiLocation> }) => void) => void
  PlaceSearch?: new (options?: Record<string, unknown>) => AMapPlaceSearchLike
  Walking?: new (options?: Record<string, unknown>) => {
    search: (origin: AMapPoint, destination: AMapPoint, callback: (status: string, result: unknown) => void) => void
  }
}

const key = (import.meta.env.VITE_AMAP_KEY ?? '').trim()
const securityKey = (import.meta.env.VITE_AMAP_SECURITY_KEY ?? '').trim()
const mapProvider = (import.meta.env.VITE_MAP_PROVIDER ?? 'amap').trim().toLowerCase()

export const amapConfig = { key, securityKey }
// MapLibre is the deterministic local/preview default. AMap is opt-in so a
// stale key or an unlisted preview domain cannot emit third-party auth errors
// before the route fallback has a chance to render.
export const isAmapConfigured = mapProvider === 'amap' && Boolean(key && securityKey)

let pending: Promise<AMapNamespace> | null = null

export function loadAmap(): Promise<AMapNamespace> {
  if (!isAmapConfigured) return Promise.reject(new Error('VITE_AMAP_KEY and VITE_AMAP_SECURITY_KEY are required'))
  if (window.AMap) return Promise.resolve(window.AMap as unknown as AMapNamespace)
  if (pending) return pending
  pending = new Promise<AMapNamespace>((resolve, reject) => {
    window._AMapSecurityConfig = { securityJsCode: securityKey }
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&plugin=AMap.Walking,AMap.PlaceSearch&key=${encodeURIComponent(key)}`
    script.async = true
    const timeout = window.setTimeout(() => reject(new Error('高德地图脚本加载超时')), 8000)
    const settle = (callback: () => void) => { window.clearTimeout(timeout); callback() }
    script.onload = () => settle(() => window.AMap ? resolve(window.AMap as unknown as AMapNamespace) : reject(new Error('高德地图脚本未暴露 AMap')))
    script.onerror = () => settle(() => reject(new Error('高德地图脚本加载失败')))
    document.head.appendChild(script)
  }).catch((error) => {
    pending = null
    throw error
  })
  return pending
}
