import type { AMapNamespace, AMapOverlay, AMapPoint } from './provider'

export function createAmapRoute(AMap: AMapNamespace, path: AMapPoint[], options: Record<string, unknown> = {}): AMapOverlay {
  return new AMap.Polyline({ path, strokeColor: '#171717', strokeWeight: 4, strokeOpacity: 0.9, lineJoin: 'round', lineCap: 'round', ...options })
}

