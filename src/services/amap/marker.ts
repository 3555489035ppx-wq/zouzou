import type { AMapNamespace, AMapOverlay, AMapPoint } from './provider'

export function createAmapTripMarker(AMap: AMapNamespace, position: AMapPoint, content: HTMLElement | string, options: Record<string, unknown> = {}): AMapOverlay {
  return new AMap.Marker({ position, content, offset: [-19, -19], zIndex: 18, ...options })
}

