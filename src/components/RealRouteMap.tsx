import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LngLatBounds, Map, Marker, setWorkerUrl, type Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Place } from '../demo-data/trips'
import { isAmapConfigured, loadAmap, type AMapMapLike, type AMapNamespace, type AMapOverlay, type AMapPoint } from '../services/amap/provider'
import { resolveAmapPlaces, type AmapPlaceQuery } from '../services/amap/poi'
import { createAmapRoute, getAmapWalkingRouteSnapshot, getPublicWalkingRouteResult, wgs84ToGcj02, type RouteLeg, type RouteSnapshot, type WalkingRouteResult } from '../services/amap/route'
import type { BotState } from '../character/engine/motionEngine'
import { BloubBotSvg } from './BloubBotSvg'
import { useAppStore } from '../stores/appStore'
import { track } from '../services/analytics'
import { classifyServiceError, type AsyncErrorCode } from '../services/asyncState'
import type { LiveLocation } from '../services/amap/geolocation'
import { matchLocationToRoute, type RouteMatch } from '../services/amap/matching'

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
  city?: string
  center?: AMapPoint
  progress?: number
  compact?: boolean
  focus?: [number, number] | null
  botState?: BotState
  onNodeSelect?: (index: number) => void
  onPlacesResolved?: (places: RoutePlace[]) => void
  userLocation?: LiveLocation | null
  followUser?: boolean
  onMapInteraction?: () => void
  onRouteMatch?: (match: RouteMatch | null) => void
  onRouteSnapshot?: (snapshot: RouteSnapshot | null) => void
  onReady?: () => void
}

type RouteMode = 'walk' | 'metro' | 'taxi' | 'train'
type RoutePlace = Place & { mode?: RouteMode }
type WalkingGroup = { fromIndex: number; toIndex: number; places: RoutePlace[] }
type WalkingSegment = WalkingGroup & { path: AMapPoint[]; result: WalkingRouteResult }
type AmapWalkingSegment = WalkingGroup & { snapshot: RouteSnapshot }

const placeMode = (place: RoutePlace): RouteMode => {
  if (place.mode) return place.mode
  if (/地铁|公交|轮渡/.test(place.transport)) return 'metro'
  if (/打车|出租|驾车/.test(place.transport)) return 'taxi'
  if (/火车|高铁/.test(place.transport)) return 'train'
  return 'walk'
}

const hasVerifiedCoordinates = (place: RoutePlace) => place.verified !== false && !/候选|待核验|占位/.test(place.coordinateSource ?? '')

const placeMapPosition = (place: RoutePlace): AMapPoint => place.coordinateSystem === 'gcj02'
  ? [place.lng, place.lat]
  : wgs84ToGcj02([place.lng, place.lat])

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

const positionAlongAmapSegments = (places: RoutePlace[], segments: AmapWalkingSegment[], center: AMapPoint, value: number): AMapPoint => {
  const fallback = wgs84ToGcj02(center)
  if (segments.length === 0) {
    const firstResolved = places.find(hasVerifiedCoordinates)
    return firstResolved ? placeMapPosition(firstResolved) : fallback
  }
  const scaled = Math.max(0, Math.min(1, value)) * Math.max(1, places.length - 1)
  const legIndex = Math.min(places.length - 2, Math.floor(scaled))
  const segment = segments.find((candidate) => legIndex >= candidate.fromIndex && legIndex < candidate.toIndex)
  if (segment) return interpolateRoute(segment.snapshot.path, (scaled - segment.fromIndex) / Math.max(1, segment.toIndex - segment.fromIndex))
  const previous = [...segments].reverse().find((candidate) => candidate.toIndex <= legIndex)
  if (previous) return previous.snapshot.path[previous.snapshot.path.length - 1]
  const next = segments.find((candidate) => candidate.fromIndex >= legIndex)
  return next?.snapshot.path[0] ?? fallback
}

// Orbit/thinking belongs to circular AI cards, never to a map marker in transit.
const visualBotState = (state: BotState): BotState => state === 'arriving' || state === 'paused' ? state : 'transport'

const formatDistance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
const formatDuration = (seconds: number) => seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ${Math.round(seconds % 3600 / 60)}min` : `${Math.max(1, Math.round(seconds / 60))}min`
const routeErrorCopy: Record<AsyncErrorCode, string> = {
  TIMEOUT: '路线服务响应超时，请稍后重试。',
  UNAUTHORIZED: '路线服务未授权，请检查地图配置。',
  RATE_LIMITED: '路线请求过于频繁，请稍后重试。',
  OFFLINE: '当前处于离线状态，暂未绘制路线。',
  CANCELLED: '路线请求已取消。',
  INVALID_RESPONSE: '路线服务未返回可用道路几何。',
  UNKNOWN: '路线服务暂时不可用，请稍后重试。',
}

const AMAP_POI_RESOLUTION_DEADLINE_MS = 3_500

function deferRootUnmount(root: ReturnType<typeof createRoot>) {
  queueMicrotask(() => root.unmount())
}

function MapLibreRouteMap({ places, center = defaultCenter, progress = 0, compact = false, focus = null, botState = 'walking', onNodeSelect, userLocation = null, followUser = false, onMapInteraction, onRouteMatch, onRouteSnapshot, onReady }: RouteMapProps) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const bot = useRef<Marker | null>(null)
  const routePath = useRef<AMapPoint[]>([])
  const routeSegments = useRef<WalkingSegment[]>([])
  const botRoot = useRef<ReturnType<typeof createRoot> | null>(null)
  const markers = useRef<Array<Marker | undefined>>([])
  const [mapReady, setMapReady] = useState(false)
  const [routeStatus, setRouteStatus] = useState<'loading' | 'ready' | 'partial' | 'unavailable'>('loading')
  const [routeSummary, setRouteSummary] = useState<WalkingRouteResult | null>(null)
  const [routeErrorCode, setRouteErrorCode] = useState<AsyncErrorCode | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const reducedMotion = useAppStore((state) => state.reducedMotion)
  const placesKey = useMemo(() => `${center.join(',')}|${places.map((place) => `${place.id}:${place.name}:${place.lng}:${place.lat}:${place.poiId ?? place.amapPoiId ?? ''}:${place.mapStatus ?? ''}`).join('|')}`, [center, places])
  const onMapInteractionRef = useRef(onMapInteraction)
  useEffect(() => { onMapInteractionRef.current = onMapInteraction }, [onMapInteraction])
  const walkingGroups = useMemo(() => buildWalkingGroups(places), [places])
  const positionForProgress = (value: number): AMapPoint => {
    if (places.length === 0) return defaultCenter
    if (routeSegments.current.length === 0) {
      const firstVerified = places.find(hasVerifiedCoordinates)
      return firstVerified ? [firstVerified.lng, firstVerified.lat] : center
    }
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
    onRouteSnapshot?.(null)
    const handleMapInteraction = () => onMapInteractionRef.current?.()
    instance.on('dragstart', handleMapInteraction)
    instance.on('zoomstart', handleMapInteraction)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => instance.resize())
    if (resizeObserver && host.current) resizeObserver.observe(host.current)
    instance.on('style.load', () => {
      const verifiedPlaces = places.filter(hasVerifiedCoordinates)
      places.forEach((place, index) => {
        if (!hasVerifiedCoordinates(place)) return
        const element = document.createElement('button')
        element.type = 'button'
        element.className = `route-node ${index === 0 || index === places.length - 1 ? 'route-node--edge' : ''}`
        element.dataset.index = String(index)
        element.setAttribute('aria-label', `聚焦${place.name}`)
        element.innerHTML = `<span>${index + 1}</span><b>${place.name}</b>`
        if (onNodeSelect) element.addEventListener('click', () => onNodeSelect(index))
        markers.current[index] = new Marker({ element, anchor: 'center' }).setLngLat([place.lng, place.lat]).addTo(instance)
      })
      if (verifiedPlaces.length > 0) {
        const bounds = new LngLatBounds()
        verifiedPlaces.forEach((place) => bounds.extend([place.lng, place.lat]))
        instance.fitBounds(bounds, { padding: compact ? 34 : 72, maxZoom: compact ? 13.8 : 12.8, duration: 0 })
      }
      const botElement = document.createElement('div')
      botElement.className = 'route-bot'
      botElement.setAttribute('aria-hidden', 'true')
      botRoot.current = createRoot(botElement)
      botRoot.current.render(<BloubBotSvg state={visualBotState(botState)} reducedMotion={reducedMotion} />)
      const firstVerified = verifiedPlaces[0]
      bot.current = new Marker({ element: botElement, anchor: 'center' }).setLngLat(firstVerified ? [firstVerified.lng, firstVerified.lat] : center).addTo(instance)
      window.requestAnimationFrame(() => instance.resize())
      setMapReady(true)
      setRouteStatus('loading')
      setRouteErrorCode(null)
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
          const failed = settled.find((entry): entry is PromiseRejectedResult => entry.status === 'rejected')
          setRouteErrorCode(failed ? classifyServiceError(failed.reason, controller.signal).code : null)
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
        const legs: RouteLeg[] = successful.map((segment) => ({
          id: `osrm-${segment.fromIndex}-${segment.toIndex}`,
          fromPoiId: segment.places[0]?.amapPoiId ?? segment.places[0]?.poiId,
          toPoiId: segment.places[segment.places.length - 1]?.amapPoiId ?? segment.places[segment.places.length - 1]?.poiId,
          mode: 'walking',
          distanceMeters: segment.result.distanceMeters,
          durationSeconds: segment.result.durationSeconds,
          path: segment.path,
          provider: 'osrm-public',
        }))
        onRouteSnapshot?.({ mode: 'walking', legs, path: routePath.current, distanceMeters: summary.distanceMeters, durationSeconds: summary.durationSeconds, provider: 'osrm-public', createdAt: Date.now() })
        bot.current?.setLngLat(positionForProgress(progress))
        setRouteStatus(successful.length === walkingGroups.length ? 'ready' : 'partial')
      }).catch((error: unknown) => {
        if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) {
          routePath.current = []
          routeSegments.current = []
          setRouteSummary(null)
          setRouteErrorCode(classifyServiceError(error, controller.signal).code)
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
      setRouteErrorCode(null)
      routePath.current = []
      routeSegments.current = []
      onRouteSnapshot?.(null)
      markers.current.forEach((marker) => marker?.remove())
      markers.current = []
      bot.current?.remove()
      const root = botRoot.current
      botRoot.current = null
      if (root) deferRootUnmount(root)
      instance.off('dragstart', handleMapInteraction)
      instance.off('zoomstart', handleMapInteraction)
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
    const selected = places.filter((place, index) => index >= from && index <= to && hasVerifiedCoordinates(place))
    if (selected.length) {
      const bounds = new LngLatBounds()
      selected.forEach((place) => bounds.extend([place.lng, place.lat]))
      map.current.fitBounds(bounds, { padding: compact ? 48 : 128, maxZoom: compact ? 14 : 13, duration: 550, essential: true })
    }
  }, [compact, focus, mapReady, places])
  useEffect(() => { map.current?.resize() }, [compact])
  useEffect(() => {
    if (!userLocation || !map.current) {
      onRouteMatch?.(null)
      return
    }
    if (followUser) map.current.easeTo({ center: [userLocation.lng, userLocation.lat], duration: reducedMotion ? 0 : 350 })
    onRouteMatch?.(routePath.current.length ? matchLocationToRoute([userLocation.lng, userLocation.lat], routePath.current) : null)
  }, [followUser, onRouteMatch, reducedMotion, routeStatus, userLocation])
  useEffect(() => {
    bot.current?.setLngLat(positionForProgress(progress))
    const active = Math.floor(progress * (places.length - 1) + 0.001)
    markers.current.forEach((marker, index) => {
      if (!marker) return
      marker.getElement().classList.toggle('is-done', index < active)
      marker.getElement().classList.toggle('is-current', index === active)
    })
  }, [placesKey, progress])
  const routeLabel = routeStatus === 'ready' ? '真实步行路线地图' : routeStatus === 'partial' ? '部分真实步行路线地图，非步行段以行程文案为准' : routeStatus === 'unavailable' ? '地图地点预览，未绘制假路线' : '地图地点预览，正在计算真实步行路线'
  const summaryText = routeSummary ? ` · OpenStreetMap / OSRM · ${formatDistance(routeSummary.distanceMeters)}${routeSummary.durationSeconds > 0 ? ` · ${formatDuration(routeSummary.durationSeconds)}` : ''}` : ''
  const provenanceText = walkingGroups.length === 0 && places.some((place) => !hasVerifiedCoordinates(place)) ? '地点坐标尚未核验：未绘制假路线' : null
  const unavailableText = provenanceText ?? (routeErrorCode ? routeErrorCopy[routeErrorCode] : '未绘制假路线：路线服务未返回')
  const canRetryRoute = walkingGroups.length > 0 && routeErrorCode !== 'CANCELLED'
  return <div className="real-route-map" ref={host} data-map-provider="maplibre" role="region" aria-label={routeLabel} aria-busy={!mapReady || routeStatus === 'loading'}>{!mapReady ? <span className="map-loading" role="status">正在准备地图</span> : routeStatus === 'loading' ? <span className="map-loading" role="status">正在计算真实步行路线</span> : routeStatus === 'unavailable' ? <div className="map-route-status"><span role="status">{unavailableText}</span>{canRetryRoute ? <button type="button" className="map-route-retry" onClick={() => { track('route_retried', { stops: places.length }); setRetryCount((value) => value + 1) }}>重试路线</button> : null}</div> : <span className="map-route-status map-route-status--success" role="status">{routeStatus === 'partial' ? '部分真实步行路线已加载' : '已加载真实步行路线'}{summaryText}{routeStatus === 'partial' ? ' · 非步行段以行程文案为准' : ''}</span>}</div>
}

function AmapRouteMap({ places, city = '', center = defaultCenter, progress = 0, compact = false, focus = null, botState = 'walking', onNodeSelect, onPlacesResolved, userLocation = null, followUser = false, onMapInteraction, onRouteMatch, onRouteSnapshot, onReady }: RouteMapProps) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<AMapMapLike | null>(null)
  const amap = useRef<AMapNamespace | null>(null)
  const bot = useRef<AMapOverlay | null>(null)
  const userMarker = useRef<AMapOverlay | null>(null)
  const userAccuracyCircle = useRef<AMapOverlay | null>(null)
  const routePath = useRef<AMapPoint[]>([])
  const routeSegments = useRef<AmapWalkingSegment[]>([])
  const routeOverlays = useRef<AMapOverlay[]>([])
  const nodeElements = useRef<Array<HTMLElement | undefined>>([])
  const nodeMarkers = useRef<Array<AMapOverlay | undefined>>([])
  const botRoot = useRef<ReturnType<typeof createRoot> | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [routeError, setRouteError] = useState(false)
  const [unresolvedCount, setUnresolvedCount] = useState(0)
  const [routeSummary, setRouteSummary] = useState<WalkingRouteResult | null>(null)
  const reducedMotion = useAppStore((state) => state.reducedMotion)
  const placesKey = useMemo(() => `${center.join(',')}|${places.map((place) => `${place.id}:${place.name}:${place.lng}:${place.lat}:${place.poiId ?? place.amapPoiId ?? ''}:${place.mapStatus ?? ''}`).join('|')}`, [center, places])
  const onMapInteractionRef = useRef(onMapInteraction)
  useEffect(() => { onMapInteractionRef.current = onMapInteraction }, [onMapInteraction])
  useEffect(() => {
    if (!host.current) return
    let cancelled = false
    const controller = new AbortController()
    let resizeObserver: ResizeObserver | null = null
    setLoadFailed(false)
    setRouteError(false)
    setUnresolvedCount(0)
    setRouteSummary(null)
    onRouteSnapshot?.(null)
    let mapInstance: AMapMapLike | null = null
    const handleMapInteraction = () => onMapInteractionRef.current?.()
    loadAmap().then(async (AMap) => {
      if (cancelled || !host.current) return
      amap.current = AMap
      const queries: AmapPlaceQuery[] = places.map((place) => ({
        id: place.id,
        city,
        area: place.area ?? (place as RoutePlace & { zone?: string }).zone,
        name: place.name,
        searchKeyword: place.searchKeyword,
        poiId: place.coordinateSystem === 'gcj02' ? place.amapPoiId ?? place.poiId : undefined,
        position: place.coordinateSystem === 'gcj02' ? [place.lng, place.lat] : undefined,
        address: place.address,
      }))
      let resolved = [] as Awaited<ReturnType<typeof resolveAmapPlaces>>
      let resolutionTimedOut = false
      let resolutionDeadlineId: number | null = null
      try {
        const resolution = resolveAmapPlaces(AMap, queries, controller.signal)
        const deadline = new Promise<Awaited<ReturnType<typeof resolveAmapPlaces>>>((resolve) => {
          resolutionDeadlineId = window.setTimeout(() => {
            resolutionTimedOut = true
            controller.abort()
            resolve([])
          }, AMAP_POI_RESOLUTION_DEADLINE_MS)
        })
        resolved = await Promise.race([resolution, deadline])
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      } finally {
        if (resolutionDeadlineId !== null) window.clearTimeout(resolutionDeadlineId)
      }
      if (cancelled || !host.current) return
      const resolvedPlaces = places.map((place) => {
        const result = resolved.find((item) => item.query.id === place.id)
        if (!result?.poi) return {
          ...place,
          mapStatus: 'unresolved' as const,
          resolutionStatus: result?.status === 'ambiguous' ? 'ambiguous' as const : result?.status === 'error' ? 'error' as const : 'not_found' as const,
          verified: false,
          coordinateSource: resolutionTimedOut
            ? `高德地点服务响应超时 · ${result?.keyword ?? [city, place.area, place.name].filter(Boolean).join(' ')}`
            : result?.status === 'ambiguous'
            ? `高德匹配到多个候选地点 · ${result.keyword}`
            : result?.status === 'error'
              ? `高德地点服务暂不可用 · ${result.keyword}`
              : `高德未找到匹配地点 · ${result?.keyword ?? [city, place.area, place.name].filter(Boolean).join(' ')}`,
        }
        return {
          ...place,
          inputName: place.inputName ?? place.searchKeyword ?? place.name,
          name: result.poi.name,
          canonicalName: result.poi.name,
          lng: result.poi.position[0],
          lat: result.poi.position[1],
          address: result.poi.address,
          poiId: result.poi.id,
          amapPoiId: result.poi.id,
          district: result.poi.district,
          adcode: result.poi.adcode,
          citycode: result.poi.citycode,
          poiType: result.poi.category,
          tel: result.poi.tel,
          verifiedAt: Date.now(),
          resolutionStatus: 'verified' as const,
          coordinateSystem: 'gcj02' as const,
          mapStatus: 'resolved' as const,
          verified: true,
          coordinateSource: `高德实时 POI${result.poi.address ? ` · ${result.poi.address}` : ''}`,
        }
      })
      const nextUnresolvedCount = resolvedPlaces.filter((place) => place.mapStatus === 'unresolved').length
      setUnresolvedCount(nextUnresolvedCount)
      onPlacesResolved?.(resolvedPlaces)
      const amapCenter = wgs84ToGcj02(center)
      const amapPlaces = resolvedPlaces.map(placeMapPosition)
      const instance = new AMap.Map(host.current, { zoom: 11.6, center: amapCenter, mapStyle: 'amap://styles/whitesmoke', viewMode: '2D', resizeEnable: true, animateEnable: true, jogEnable: true, zoomEnable: true, dragEnable: true, doubleClickZoom: true, scrollWheel: true, keyboardEnable: true })
      mapInstance = instance
      instance.on?.('dragstart', handleMapInteraction)
      instance.on?.('zoomstart', handleMapInteraction)
      const overlays: AMapOverlay[] = []
      resolvedPlaces.forEach((place, index) => {
        if (place.mapStatus !== 'resolved') return
        const element = document.createElement('button')
        element.type = 'button'
        element.className = `route-node ${index === 0 || index === resolvedPlaces.length - 1 ? 'route-node--edge' : ''}`
        element.dataset.index = String(index)
        element.setAttribute('aria-label', `聚焦${place.name}`)
        element.innerHTML = `<span>${index + 1}</span><b>${place.name}</b>`
        if (onNodeSelect) element.addEventListener('click', () => onNodeSelect(index))
        nodeElements.current[index] = element
        const marker = new AMap.Marker({ position: amapPlaces[index], content: element, offset: [-12, -12], zIndex: 12 })
        nodeMarkers.current[index] = marker
        instance.add(marker)
        overlays.push(marker)
      })
      const botElement = document.createElement('div')
      botElement.className = 'route-bot'
      botElement.setAttribute('aria-hidden', 'true')
      botRoot.current = createRoot(botElement)
      botRoot.current.render(<BloubBotSvg state={visualBotState(botState)} reducedMotion={reducedMotion} />)
      const firstResolvedIndex = resolvedPlaces.findIndex((place) => place.mapStatus === 'resolved')
      const botMarker = new AMap.Marker({ position: firstResolvedIndex >= 0 ? amapPlaces[firstResolvedIndex] : amapCenter, content: botElement, offset: [-21, -21], zIndex: 18 })
      instance.add(botMarker)
      overlays.push(botMarker)
      map.current = instance
      bot.current = botMarker
      if (overlays.length > 0) instance.setFitView(overlays, true, compact ? [34, 34, 34, 34] : [52, 52, 52, 52])
      resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => (instance as AMapMapLike & { resize?: () => void }).resize?.())
      if (resizeObserver && host.current) resizeObserver.observe(host.current)
      setMapReady(true)
      onReady?.()
      const walkingGroups = buildWalkingGroups(resolvedPlaces)
      if (walkingGroups.length === 0) return
      const settled = await Promise.allSettled(walkingGroups.map((group) => getAmapWalkingRouteSnapshot(AMap, group.places.map((place) => ({ position: [place.lng, place.lat] as AMapPoint, poiId: place.amapPoiId ?? place.poiId })), controller.signal)))
      if (cancelled) return
      const successful = settled.flatMap((entry, index) => entry.status === 'fulfilled' ? [{ group: walkingGroups[index], snapshot: entry.value }] : [])
      if (successful.length === 0) {
        setRouteError(true)
        return
      }
      routeSegments.current = successful.map(({ group, snapshot }) => ({ ...group, snapshot }))
      const nextRouteOverlays = successful.map(({ snapshot }) => createAmapRoute(AMap, snapshot.path, { strokeWeight: compact ? 3 : 4 }))
      routeOverlays.current = nextRouteOverlays
      routePath.current = successful.flatMap(({ snapshot }) => snapshot.path)
      instance.add(nextRouteOverlays)
      const routeSummary: WalkingRouteResult = {
        path: routePath.current,
        distanceMeters: successful.reduce((total, segment) => total + segment.snapshot.distanceMeters, 0),
        durationSeconds: successful.reduce((total, segment) => total + segment.snapshot.durationSeconds, 0),
        provider: 'amap',
      }
      setRouteSummary(routeSummary)
      onRouteSnapshot?.({
        mode: 'walking',
        legs: successful.flatMap(({ snapshot }) => snapshot.legs),
        path: routePath.current,
        distanceMeters: routeSummary.distanceMeters,
        durationSeconds: routeSummary.durationSeconds,
        provider: 'amap',
        createdAt: Date.now(),
      })
      instance.setFitView([...overlays, ...nextRouteOverlays], true, compact ? [34, 34, 34, 34] : [52, 52, 52, 52])
      botMarker.setPosition?.(positionAlongAmapSegments(places, routeSegments.current, center, progress))
      if (userLocation) onRouteMatch?.(matchLocationToRoute([userLocation.lng, userLocation.lat], routePath.current))
    }).catch(() => setLoadFailed(true))
    return () => {
      cancelled = true
      controller.abort()
      setMapReady(false)
      resizeObserver?.disconnect()
      routePath.current = []
      routeSegments.current = []
      routeOverlays.current = []
      nodeElements.current = []
      nodeMarkers.current = []
      userMarker.current = null
      userAccuracyCircle.current = null
      amap.current = null
      onRouteSnapshot?.(null)
      mapInstance?.off?.('dragstart', handleMapInteraction)
      mapInstance?.off?.('zoomstart', handleMapInteraction)
      bot.current = null
      const root = botRoot.current
      botRoot.current = null
      if (root) deferRootUnmount(root)
      map.current?.destroy()
      map.current = null
      mapInstance = null
    }
  // The AMap instance is stable; only route-marker position changes during playback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, placesKey])
  useEffect(() => { botRoot.current?.render(<BloubBotSvg state={visualBotState(botState)} reducedMotion={reducedMotion} />) }, [botState, reducedMotion])
  useEffect(() => {
    if (!mapReady || !map.current || !amap.current) return
    const instance = map.current
    if (!userLocation) {
      if (userMarker.current) instance.remove(userMarker.current)
      if (userAccuracyCircle.current) instance.remove(userAccuracyCircle.current)
      userMarker.current = null
      userAccuracyCircle.current = null
      onRouteMatch?.(null)
      return
    }
    const position: AMapPoint = [userLocation.lng, userLocation.lat]
    if (!userMarker.current) {
      const element = document.createElement('div')
      element.className = 'map-user-location'
      element.setAttribute('aria-hidden', 'true')
      userMarker.current = new amap.current.Marker({ position, content: element, offset: [-9, -9], zIndex: 24 })
      instance.add(userMarker.current)
    } else userMarker.current.setPosition?.(position)
    if (amap.current.Circle && userLocation.accuracy && userLocation.accuracy > 0) {
      if (!userAccuracyCircle.current) {
        userAccuracyCircle.current = new amap.current.Circle({ center: position, radius: userLocation.accuracy, strokeColor: '#1f6fff', strokeOpacity: .45, strokeWeight: 1, fillColor: '#1f6fff', fillOpacity: .12, zIndex: 22 })
        instance.add(userAccuracyCircle.current)
      } else {
        userAccuracyCircle.current.setPosition?.(position)
        userAccuracyCircle.current.setRadius?.(userLocation.accuracy)
      }
    } else if (userAccuracyCircle.current) {
      instance.remove(userAccuracyCircle.current)
      userAccuracyCircle.current = null
    }
    if (followUser) instance.panTo?.(position, reducedMotion ? 0 : 350)
    onRouteMatch?.(matchLocationToRoute(position, routePath.current))
  }, [followUser, mapReady, onRouteMatch, reducedMotion, routeSummary, userLocation])
  useEffect(() => {
    if (!mapReady || !map.current || !focus) return
    const selected = focus.flatMap((index) => nodeMarkers.current[index] ? [nodeMarkers.current[index]] : [])
    const fitOverlays = focus[0] === 0 && focus[1] === places.length - 1 ? [...routeOverlays.current, ...selected] : selected
    if (fitOverlays.length) map.current.setFitView(fitOverlays, false, compact ? [48, 48, 48, 48] : [128, 128, 128, 128])
  }, [compact, focus, mapReady, places.length])
  useEffect(() => {
    if (routePath.current.length) bot.current?.setPosition?.(positionAlongAmapSegments(places, routeSegments.current, center, progress))
    const active = Math.floor(progress * (places.length - 1) + 0.001)
    nodeElements.current.forEach((element, index) => {
      if (!element) return
      element.classList.toggle('is-done', index < active)
      element.classList.toggle('is-current', index === active)
    })
  }, [center, places, placesKey, progress])
  if (loadFailed) return <MapLibreRouteMap places={places} center={center} progress={progress} compact={compact} focus={focus} botState={botState} onNodeSelect={onNodeSelect} userLocation={userLocation} followUser={followUser} onMapInteraction={onMapInteraction} onRouteMatch={onRouteMatch} onRouteSnapshot={onRouteSnapshot} onReady={onReady} />
  return <div className="real-route-map real-route-map--amap" data-map-provider="amap" role="region" aria-label={`高德真实地图${unresolvedCount ? `，${unresolvedCount} 个地点待确认` : '和步行路线'}`} aria-busy={!mapReady}><div className="real-route-map__canvas" ref={host} aria-hidden="true" />{!mapReady ? <span className="map-loading" role="status">正在加载高德地图和真实地点</span> : routeError ? <span className="map-route-status">路线服务暂不可用，地点仍来自高德地图</span> : unresolvedCount ? <span className="map-route-status">{unresolvedCount} 个地点未匹配到高德 POI，未绘制假路线</span> : routeSummary ? <span className="map-route-status map-route-status--success">已加载高德真实步行路线 · {formatDistance(routeSummary.distanceMeters)}{routeSummary.durationSeconds > 0 ? ` · ${formatDuration(routeSummary.durationSeconds)}` : ''}</span> : null}</div>
}

export function RealRouteMap(props: RouteMapProps) {
  return isAmapConfigured ? <AmapRouteMap {...props} /> : <MapLibreRouteMap {...props} />
}
