import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LngLatBounds, Map, Marker, setWorkerUrl, type Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Place } from '../demo-data/trips'
import { isAmapConfigured, loadAmap, type AMapMapLike, type AMapOverlay, type AMapPoint } from '../services/amap/provider'
import { createAmapRoute, getAmapWalkingRoute, getPublicWalkingRouteResult, wgs84ToGcj02, type WalkingRouteResult } from '../services/amap/route'
import type { BotState } from '../character/engine/motionEngine'
import { BloubBotSvg } from './BloubBotSvg'
import { useAppStore } from '../stores/appStore'
import { track } from '../services/analytics'

setWorkerUrl(maplibreWorkerUrl)

const style: StyleSpecification = {
  version: 8,
  sources: {
    esriBase: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: '© Esri, HERE, Garmin, © OpenStreetMap contributors' },
    esriReference: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 },
  },
  layers: [
    { id: 'esri-base', type: 'raster', source: 'esriBase', paint: { 'raster-saturation': -0.08, 'raster-contrast': 0.04, 'raster-brightness-max': 0.98 } },
    { id: 'esri-reference', type: 'raster', source: 'esriReference', paint: { 'raster-opacity': 0.82 } },
  ],
}

const defaultCenter: AMapPoint = [121.47, 31.225]

type RouteMapProps = {
  places: RoutePlace[]
  center?: AMapPoint
  progress?: number
  compact?: boolean
  focus?: [number, number] | null
  botState?: BotState
  onNodeSelect?: (index: number) => void
  onReady?: () => void
}

type RouteMode = 'walk' | 'metro' | 'taxi' | 'train'
type RoutePlace = Place & { mode?: RouteMode }
type WalkingGroup = { fromIndex: number; toIndex: number; places: RoutePlace[] }
type WalkingSegment = WalkingGroup & { path: AMapPoint[]; result: WalkingRouteResult }

const placeMode = (place: RoutePlace): RouteMode => {
  if (place.mode) return place.mode
  if (/地铁|公交|轮渡/.test(place.transport)) return 'metro'
  if (/打车|出租|驾车/.test(place.transport)) return 'taxi'
  if (/火车|高铁/.test(place.transport)) return 'train'
  return 'walk'
}

const hasVerifiedCoordinates = (place: RoutePlace) => place.verified !== false && !/候选|待核验|占位/.test(place.coordinateSource ?? '')

const buildWalkingGroups = (places: RoutePlace[]): WalkingGroup[] => {
  const groups: WalkingGroup[] = []
  let current: WalkingGroup | null = null
  places.slice(1).forEach((place, legIndex) => {
    const destinationIndex = legIndex + 1
    if (placeMode(place) !== 'walk' || !hasVerifiedCoordinates(places[legIndex]) || !hasVerifiedCoordinates(place)) {
      if (current) groups.push(current)
      current = null
      return
    }
    if (!current) current = { fromIndex: legIndex, toIndex: destinationIndex, places: [places[legIndex], place] }
    else {
      current.toIndex = destinationIndex
      current.places.push(place)
    }
  })
  if (current) groups.push(current)
  return groups
}

const interpolate = (places: Place[], progress: number): AMapPoint => {
  if (places.length === 0) return defaultCenter
  if (places.length === 1) return [places[0].lng, places[0].lat]
  const scaled = Math.max(0, Math.min(1, progress)) * (places.length - 1)
  const index = Math.min(places.length - 2, Math.floor(scaled))
  const ratio = scaled - index
  const from = places[index]
  const to = places[index + 1] ?? from
  return [from.lng + (to.lng - from.lng) * ratio, from.lat + (to.lat - from.lat) * ratio]
}

const interpolateRoute = (path: AMapPoint[], progress: number): AMapPoint => {
  if (path.length < 2) return path[0] ?? defaultCenter
  const lengths = path.slice(1).map((point, index) => {
    const previous = path[index]
    return Math.hypot((point[0] - previous[0]) * Math.cos(point[1] * Math.PI / 180), point[1] - previous[1])
  })
  const total = lengths.reduce((sum, length) => sum + length, 0)
  let remaining = total * Math.max(0, Math.min(1, progress))
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index]
    if (remaining > length) { remaining -= length; continue }
    const ratio = length ? remaining / length : 0
    const from = path[index]
    const to = path[index + 1]
    return [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio]
  }
  return path[path.length - 1]
}

// Orbit/thinking belongs to circular AI cards, never to a map marker in transit.
const visualBotState = (state: BotState): BotState => state === 'arriving' || state === 'paused' ? state : 'transport'

const formatDistance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
const formatDuration = (seconds: number) => seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ${Math.round(seconds % 3600 / 60)}min` : `${Math.max(1, Math.round(seconds / 60))}min`

function MapLibreRouteMap({ places, center = defaultCenter, progress = 0, compact = false, focus = null, botState = 'walking', onNodeSelect, onReady }: RouteMapProps) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const bot = useRef<Marker | null>(null)
  const routePath = useRef<AMapPoint[]>([])
  const routeSegments = useRef<WalkingSegment[]>([])
  const botRoot = useRef<ReturnType<typeof createRoot> | null>(null)
  const markers = useRef<Marker[]>([])
  const [mapReady, setMapReady] = useState(false)
  const [routeStatus, setRouteStatus] = useState<'loading' | 'ready' | 'partial' | 'unavailable'>('loading')
  const [routeSummary, setRouteSummary] = useState<WalkingRouteResult | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const reducedMotion = useAppStore((state) => state.reducedMotion)
  const placesKey = useMemo(() => `${center.join(',')}|${places.map((place) => `${place.id}:${place.lng}:${place.lat}`).join('|')}`, [center, places])
  const walkingGroups = useMemo(() => buildWalkingGroups(places), [places])
  const positionForProgress = (value: number): AMapPoint => {
    if (places.length === 0) return defaultCenter
    if (routeSegments.current.length === 0) return [places[0].lng, places[0].lat]
    const scaled = Math.max(0, Math.min(1, value)) * Math.max(1, places.length - 1)
    const legIndex = Math.min(places.length - 2, Math.floor(scaled))
    const segment = routeSegments.current.find((candidate) => legIndex >= candidate.fromIndex && legIndex < candidate.toIndex)
    if (segment) {
      const segmentProgress = (scaled - segment.fromIndex) / Math.max(1, segment.toIndex - segment.fromIndex)
      return interpolateRoute(segment.path, segmentProgress)
    }
    const stop = places[Math.min(places.length - 1, Math.round(scaled))]
    return stop ? [stop.lng, stop.lat] : defaultCenter
  }
  useEffect(() => {
    if (!host.current || map.current) return
    const controller = new AbortController()
    let cancelled = false
    const instance = new Map({ container: host.current, style, center, zoom: 11.6, attributionControl: { compact: true }, interactive: !compact })
    map.current = instance
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => instance.resize())
    if (resizeObserver && host.current) resizeObserver.observe(host.current)
    instance.on('style.load', () => {
      const bounds = new LngLatBounds()
      places.forEach((place, index) => {
        bounds.extend([place.lng, place.lat])
        const element = document.createElement('button')
        element.type = 'button'
        element.className = `route-node ${index === 0 || index === places.length - 1 ? 'route-node--edge' : ''}`
        element.dataset.index = String(index)
        element.setAttribute('aria-label', `聚焦${place.name}`)
        element.innerHTML = `<span>${index + 1}</span><b>${place.name}</b>`
        if (onNodeSelect) element.addEventListener('click', () => onNodeSelect(index))
        markers.current.push(new Marker({ element, anchor: 'center' }).setLngLat([place.lng, place.lat]).addTo(instance))
      })
      instance.fitBounds(bounds, { padding: compact ? 34 : 72, maxZoom: compact ? 13.8 : 12.8, duration: 0 })
      const botElement = document.createElement('div')
      botElement.className = 'route-bot'
      botElement.setAttribute('aria-hidden', 'true')
      botRoot.current = createRoot(botElement)
      botRoot.current.render(<BloubBotSvg state={visualBotState(botState)} reducedMotion={reducedMotion} />)
      bot.current = new Marker({ element: botElement, anchor: 'center' }).setLngLat(places[0] ? [places[0].lng, places[0].lat] : defaultCenter).addTo(instance)
      window.requestAnimationFrame(() => instance.resize())
      setMapReady(true)
      setRouteStatus('loading')
      onReady?.()

      if (walkingGroups.length === 0) {
        setRouteStatus('unavailable')
        return
      }
      Promise.allSettled(walkingGroups.map((group) => getPublicWalkingRouteResult(group.places.map((place) => [place.lng, place.lat]), controller.signal))).then((settled) => {
        if (cancelled) return
        const successful = settled.flatMap((entry, index) => entry.status === 'fulfilled' ? [{ ...walkingGroups[index], path: entry.value.path, result: entry.value }] : [])
        if (successful.length === 0) {
          routePath.current = []
          routeSegments.current = []
          setRouteSummary(null)
          setRouteStatus('unavailable')
          return
        }
        routeSegments.current = successful
        routePath.current = successful.flatMap((segment) => segment.path)
        successful.forEach((segment, index) => {
          const sourceId = `walking-route-${index}`
          instance.addSource(sourceId, {
            type: 'geojson',
            data: { type: 'Feature', properties: { mode: 'walk' }, geometry: { type: 'LineString', coordinates: segment.path } },
          })
          instance.addLayer({
            id: `${sourceId}-casing`,
            type: 'line',
            source: sourceId,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#ffffff', 'line-width': compact ? 7 : 9, 'line-opacity': 0.88 },
          })
          instance.addLayer({
            id: sourceId,
            type: 'line',
            source: sourceId,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#1f6fff', 'line-width': compact ? 3 : 4, 'line-opacity': 0.92 },
          })
        })
        const routeBounds = new LngLatBounds()
        routePath.current.forEach((point) => routeBounds.extend(point))
        instance.fitBounds(routeBounds, { padding: compact ? 34 : 72, maxZoom: compact ? 13.8 : 12.8, duration: 0 })
        const summary: WalkingRouteResult = {
          path: routePath.current,
          distanceMeters: successful.reduce((total, segment) => total + segment.result.distanceMeters, 0),
          durationSeconds: successful.reduce((total, segment) => total + segment.result.durationSeconds, 0),
          provider: 'osrm-public',
        }
        setRouteSummary(summary)
        bot.current?.setLngLat(positionForProgress(progress))
        setRouteStatus(successful.length === walkingGroups.length ? 'ready' : 'partial')
      }).catch((error: unknown) => {
        if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) {
          routePath.current = []
          routeSegments.current = []
          setRouteSummary(null)
          setRouteStatus('unavailable')
        }
      })
    })
    return () => {
      cancelled = true
      controller.abort()
      resizeObserver?.disconnect()
      setMapReady(false)
      setRouteStatus('loading')
      setRouteSummary(null)
      routePath.current = []
      routeSegments.current = []
      markers.current.forEach((marker) => marker.remove())
      markers.current = []
      bot.current?.remove()
      botRoot.current?.unmount()
      botRoot.current = null
      instance.remove()
      map.current = null
    }
  // The fallback stays stable while route progress changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesKey, retryCount])
  useEffect(() => { botRoot.current?.render(<BloubBotSvg state={visualBotState(botState)} reducedMotion={reducedMotion} />) }, [botState, reducedMotion])
  useEffect(() => {
    if (!mapReady || !map.current || !focus) return
    const [from, to] = focus
    const first = places[from] ?? places[0]
    const last = places[to] ?? first
    if (first && last) map.current.fitBounds(new LngLatBounds([first.lng, first.lat], [last.lng, last.lat]), { padding: compact ? 48 : 128, maxZoom: compact ? 14 : 13, duration: 550, essential: true })
  }, [compact, focus, mapReady, places])
  useEffect(() => { map.current?.resize() }, [compact])
  useEffect(() => {
    bot.current?.setLngLat(positionForProgress(progress))
    const active = Math.floor(progress * (places.length - 1) + 0.001)
    markers.current.forEach((marker, index) => {
      marker.getElement().classList.toggle('is-done', index < active)
      marker.getElement().classList.toggle('is-current', index === active)
    })
  }, [placesKey, progress])
  const routeLabel = routeStatus === 'ready' ? '真实步行路线地图' : routeStatus === 'partial' ? '部分真实步行路线地图，非步行段以行程文案为准' : routeStatus === 'unavailable' ? '地图地点预览，未绘制假路线' : '地图地点预览，正在计算真实步行路线'
  const summaryText = routeSummary ? ` · OpenStreetMap / OSRM · ${formatDistance(routeSummary.distanceMeters)}${routeSummary.durationSeconds > 0 ? ` · ${formatDuration(routeSummary.durationSeconds)}` : ''}` : ''
  const unavailableText = walkingGroups.length === 0 && places.some((place) => !hasVerifiedCoordinates(place))
    ? '地点坐标尚未核验：未绘制假路线'
    : '未绘制假路线：路线服务未返回'
  return <div className="real-route-map" ref={host} role="region" aria-label={routeLabel} aria-busy={!mapReady || routeStatus === 'loading'}>{!mapReady ? <span className="map-loading" role="status">正在准备地图</span> : routeStatus === 'loading' ? <span className="map-loading" role="status">正在计算真实步行路线</span> : routeStatus === 'unavailable' ? <div className="map-route-status"><span role="status">{unavailableText}</span><button type="button" className="map-route-retry" onClick={() => { track('route_retried', { stops: places.length }); setRetryCount((value) => value + 1) }}>重试路线</button></div> : <span className="map-route-status map-route-status--success" role="status">{routeStatus === 'partial' ? '部分真实步行路线已加载' : '已加载真实步行路线'}{summaryText}{routeStatus === 'partial' ? ' · 非步行段以行程文案为准' : ''}</span>}</div>
}

function AmapRouteMap({ places, center = defaultCenter, progress = 0, compact = false, focus = null, botState = 'walking', onNodeSelect, onReady }: RouteMapProps) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<AMapMapLike | null>(null)
  const bot = useRef<AMapOverlay | null>(null)
  const routePath = useRef<AMapPoint[]>([])
  const nodeElements = useRef<HTMLElement[]>([])
  const nodeMarkers = useRef<AMapOverlay[]>([])
  const botRoot = useRef<ReturnType<typeof createRoot> | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [routeError, setRouteError] = useState(false)
  const reducedMotion = useAppStore((state) => state.reducedMotion)
  const placesKey = useMemo(() => `${center.join(',')}|${places.map((place) => `${place.id}:${place.lng}:${place.lat}`).join('|')}`, [center, places])
  useEffect(() => {
    if (!host.current) return
    let cancelled = false
    const controller = new AbortController()
    let resizeObserver: ResizeObserver | null = null
    loadAmap().then(async (AMap) => {
      if (cancelled || !host.current) return
      const amapCenter = wgs84ToGcj02(center)
      const amapPlaces = places.map((place) => wgs84ToGcj02([place.lng, place.lat]))
      const instance = new AMap.Map(host.current, { zoom: 11.6, center: amapCenter, mapStyle: 'amap://styles/whitesmoke', viewMode: '2D', zoomEnable: !compact, dragEnable: !compact, doubleClickZoom: !compact, keyboardEnable: !compact })
      const overlays: AMapOverlay[] = []
      places.forEach((place, index) => {
        const element = document.createElement('button')
        element.type = 'button'
        element.className = `route-node ${index === 0 || index === places.length - 1 ? 'route-node--edge' : ''}`
        element.dataset.index = String(index)
        element.setAttribute('aria-label', `聚焦${place.name}`)
        element.innerHTML = `<span>${index + 1}</span><b>${place.name}</b>`
        if (onNodeSelect) element.addEventListener('click', () => onNodeSelect(index))
        nodeElements.current.push(element)
        const marker = new AMap.Marker({ position: amapPlaces[index], content: element, offset: [-12, -12], zIndex: 12 })
        nodeMarkers.current.push(marker)
        instance.add(marker)
        overlays.push(marker)
      })
      const botElement = document.createElement('div')
      botElement.className = 'route-bot'
      botElement.setAttribute('aria-hidden', 'true')
      botRoot.current = createRoot(botElement)
      botRoot.current.render(<BloubBotSvg state={visualBotState(botState)} reducedMotion={reducedMotion} />)
      const botMarker = new AMap.Marker({ position: amapPlaces[0] ?? amapCenter, content: botElement, offset: [-21, -21], zIndex: 18 })
      instance.add(botMarker)
      overlays.push(botMarker)
      map.current = instance
      bot.current = botMarker
      instance.setFitView(overlays, true, compact ? [34, 34, 34, 34] : [52, 52, 52, 52])
      resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => (instance as AMapMapLike & { resize?: () => void }).resize?.())
      if (resizeObserver && host.current) resizeObserver.observe(host.current)
      setMapReady(true)
      onReady?.()
      try {
        const path = await getAmapWalkingRoute(AMap, amapPlaces, controller.signal)
        if (cancelled) return
        routePath.current = path
        const route = createAmapRoute(AMap, path, { strokeWeight: compact ? 3 : 4 })
        instance.add(route)
        instance.setFitView([...overlays, route], true, compact ? [34, 34, 34, 34] : [52, 52, 52, 52])
        botMarker.setPosition?.(interpolateRoute(path, progress))
      } catch {
        if (!cancelled) setRouteError(true)
      }
    }).catch(() => setLoadFailed(true))
    return () => {
      cancelled = true
      controller.abort()
      setMapReady(false)
      resizeObserver?.disconnect()
      routePath.current = []
      nodeElements.current = []
      nodeMarkers.current = []
      bot.current = null
      botRoot.current?.unmount()
      botRoot.current = null
      map.current?.destroy()
      map.current = null
    }
  // The AMap instance is stable; only route-marker position changes during playback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesKey])
  useEffect(() => { botRoot.current?.render(<BloubBotSvg state={visualBotState(botState)} reducedMotion={reducedMotion} />) }, [botState, reducedMotion])
  useEffect(() => {
    if (!mapReady || !map.current || !focus) return
    const selected = focus.flatMap((index) => nodeMarkers.current[index] ? [nodeMarkers.current[index]] : [])
    if (selected.length) map.current.setFitView(selected, false, compact ? [48, 48, 48, 48] : [128, 128, 128, 128])
  }, [compact, focus, mapReady])
  useEffect(() => {
    if (routePath.current.length) bot.current?.setPosition?.(interpolateRoute(routePath.current, progress))
    const active = Math.floor(progress * (places.length - 1) + 0.001)
    nodeElements.current.forEach((element, index) => {
      element.classList.toggle('is-done', index < active)
      element.classList.toggle('is-current', index === active)
    })
  }, [placesKey, progress])
  if (loadFailed || routeError) return <MapLibreRouteMap places={places} center={center} progress={progress} compact={compact} focus={focus} botState={botState} onNodeSelect={onNodeSelect} onReady={onReady} />
  return <div className="real-route-map real-route-map--amap" ref={host} role="region" aria-label="高德真实步行路线地图" aria-busy={!mapReady}>{!mapReady ? <span className="map-loading" role="status">正在计算真实步行路线</span> : routeError ? <span className="map-route-status">路线服务暂不可用</span> : null}</div>
}

export function RealRouteMap(props: RouteMapProps) {
  return isAmapConfigured ? <AmapRouteMap {...props} /> : <MapLibreRouteMap {...props} />
}
