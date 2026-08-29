export type AMapPoint = [number, number]

export type AMapOverlay = {
  setMap?: (map: AMapMapLike | null) => void
  setPosition?: (point: AMapPoint) => void
  setPath?: (path: AMapPoint[]) => void
  setContent?: (content: string | HTMLElement) => void
  getContent?: () => string | HTMLElement
}

export type AMapMapLike = {
  add: (overlay: AMapOverlay | AMapOverlay[]) => void
  remove: (overlay: AMapOverlay | AMapOverlay[]) => void
  setFitView: (overlays?: AMapOverlay[], immediately?: boolean, padding?: [number, number, number, number]) => void
  destroy: () => void
}

export type AMapNamespace = {
  Map: new (container: HTMLElement, options?: Record<string, unknown>) => AMapMapLike
  Polyline: new (options: Record<string, unknown>) => AMapOverlay
  Marker: new (options: Record<string, unknown>) => AMapOverlay
  Walking?: new (options?: Record<string, unknown>) => {
    search: (origin: AMapPoint, destination: AMapPoint, callback: (status: string, result: unknown) => void) => void
  }
}

const key = (import.meta.env.VITE_AMAP_KEY ?? '').trim()
const securityKey = (import.meta.env.VITE_AMAP_SECURITY_KEY ?? '').trim()

export const amapConfig = { key, securityKey }
export const isAmapConfigured = Boolean(key && securityKey)

let pending: Promise<AMapNamespace> | null = null

export function loadAmap(): Promise<AMapNamespace> {
  if (!isAmapConfigured) return Promise.reject(new Error('VITE_AMAP_KEY and VITE_AMAP_SECURITY_KEY are required'))
  if (window.AMap) return Promise.resolve(window.AMap as unknown as AMapNamespace)
  if (pending) return pending
  pending = new Promise<AMapNamespace>((resolve, reject) => {
    window._AMapSecurityConfig = { securityJsCode: securityKey }
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&plugin=AMap.Walking&key=${encodeURIComponent(key)}`
    script.async = true
    script.onload = () => window.AMap ? resolve(window.AMap as unknown as AMapNamespace) : reject(new Error('高德地图脚本未暴露 AMap'))
    script.onerror = () => reject(new Error('高德地图脚本加载失败'))
    document.head.appendChild(script)
  }).catch((error) => {
    pending = null
    throw error
  })
  return pending
}
