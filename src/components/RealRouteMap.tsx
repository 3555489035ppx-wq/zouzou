import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LngLatBounds, Map, Marker, setWorkerUrl, type Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Place } from '../demo-data/trips'
import { isAmapConfigured, loadAmap, type AMapMapLike, type AMapOverlay } from '../services/amap/provider'
import type { BotState } from '../character/engine/motionEngine'
import { BloubBotSvg } from './BloubBotSvg'
import { useAppStore } from '../stores/appStore'

// Vite's optimized dependency directory does not always copy MapLibre's
// sibling worker file. Resolve the worker as an explicit asset so dev and
// production use the same URL instead of a missing `.vite/deps` path.
setWorkerUrl(maplibreWorkerUrl)

// AMap is preferred whenever its keys are configured. The keyless Esri canvas
// fallback keeps the private demo usable without a provider key and retains
// visible attribution.
// Esri's Canvas light-gray base + reference labels is a quiet, modern and
// keyless fallback for this private prototype. CARTO's public endpoint began
// returning an API-key watermark, so it must not be used for the demo.
const style: StyleSpecification = {
  version: 8,
  sources: {
    esriBase: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: '© Esri, HERE, Garmin, © OpenStreetMap contributors',
    },
    esriReference: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
    },
  },
  layers: [
    { id: 'esri-base', type: 'raster', source: 'esriBase', paint: { 'raster-saturation': -0.08, 'raster-contrast': 0.04, 'raster-brightness-max': 0.98 } },
    { id: 'esri-reference', type: 'raster', source: 'esriReference', paint: { 'raster-opacity': 0.82 } },
  ],
}
const defaultCenter: [number, number] = [121.47, 31.225]

type RouteMapProps = {
  places: Place[]
  center?: [number, number]
  progress?: number
  compact?: boolean
  focus?: [number, number] | null
  botState?: BotState
  onNodeSelect?: (index: number) => void
  onReady?: () => void
}

const interpolate = (places: Place[], progress: number) => {
  if (places.length === 0) return defaultCenter
  if (places.length === 1) return [places[0].lng, places[0].lat] as [number, number]
  const scaled = Math.max(0, Math.min(1, progress)) * (places.length - 1)
  const i = Math.min(places.length - 2, Math.floor(scaled))
  const t = scaled - i
  const a = places[i]
  const b = places[i + 1] ?? a
  return [a.lng + (b.lng - a.lng) * t, a.lat + (b.lat - a.lat) * t] as [number, number]
}

// The route marker uses the same Bloub/Grok body as the rest of the product,
// but a walking segment should feel alive rather than stuck in one thinking
// pose. Cycling only between expressive, non-thinking states keeps the marker
// legible at 44px while the engine still performs smooth morphs.
const visualBotState = (state: BotState, progress: number): BotState => {
  if (state !== 'walking') return state
  const variant = Math.floor(Math.max(0, Math.min(1, progress)) * 9) % 3
  return variant === 1 ? 'listening' : variant === 2 ? 'done' : 'walking'
}

function MapLibreRouteMap({ places, center = defaultCenter, progress=0, compact=false, focus=null, botState='walking', onNodeSelect, onReady }: RouteMapProps) {
  const host=useRef<HTMLDivElement>(null), map=useRef<MapLibreMap|null>(null), bot=useRef<Marker|null>(null), botRoot=useRef<ReturnType<typeof createRoot>|null>(null), markers=useRef<Marker[]>([])
  const [mapReady, setMapReady] = useState(false)
  const reducedMotion = useAppStore((state) => state.reducedMotion)
  const placesKey = useMemo(() => `${center.join(',')}|${places.map((place) => `${place.id}:${place.lng}:${place.lat}`).join('|')}`, [center, places])
  useEffect(()=>{ if(!host.current||map.current)return; const instance=new Map({container:host.current,style,center,zoom:11.6,attributionControl:{compact:true},interactive:!compact}); map.current=instance
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => instance.resize())
    if (resizeObserver && host.current) resizeObserver.observe(host.current)
    // `style.load` fires as soon as the style graph is ready, before remote
    // raster tiles finish streaming. Draw the route and reveal the controls at
    // that point so a slow tile provider never leaves an empty map surface.
    instance.on('style.load',()=>{const coords=places.map(p=>[p.lng,p.lat]);instance.addSource('route',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}}});instance.addLayer({id:'route-casing',type:'line',source:'route',paint:{'line-color':'#fff','line-width':7,'line-opacity':.95}});instance.addLayer({id:'route',type:'line',source:'route',paint:{'line-color':'#171717','line-width':3.5,'line-opacity':.9}})
      const bounds=new LngLatBounds();places.forEach((p,index)=>{bounds.extend([p.lng,p.lat]);const el=document.createElement('button');el.type='button';el.className=`route-node ${index === 0 || index === places.length - 1 ? 'route-node--edge' : ''}`;el.dataset.index=String(index);el.setAttribute('aria-label',`聚焦${p.name}`);el.innerHTML=`<span>${index+1}</span><b>${p.name}</b>`;if(onNodeSelect){el.addEventListener('click',()=>onNodeSelect(index));el.addEventListener('keydown',(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onNodeSelect(index)}})}markers.current.push(new Marker({element:el,anchor:'center'}).setLngLat([p.lng,p.lat]).addTo(instance))});instance.fitBounds(bounds,{padding:compact?34:72,maxZoom:compact?13.8:12.8,duration:0});const botEl=document.createElement('div');botEl.className='route-bot';botEl.setAttribute('aria-hidden','true');botRoot.current=createRoot(botEl);botRoot.current.render(<BloubBotSvg state={visualBotState(botState,progress)} reducedMotion={reducedMotion} />);bot.current=new Marker({element:botEl,anchor:'center'}).setLngLat(interpolate(places,progress)).addTo(instance);window.requestAnimationFrame(() => instance.resize());setMapReady(true);onReady?.() })
    return()=>{resizeObserver?.disconnect();setMapReady(false);markers.current.forEach(m=>m.remove());markers.current=[];bot.current?.remove();botRoot.current?.unmount();botRoot.current=null;instance.remove();map.current=null}
  // The map instance is intentionally stable while markers and camera update independently.
  // `placesKey` changes only when the actual route changes, not on every progress tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[placesKey])
  useEffect(()=>{botRoot.current?.render(<BloubBotSvg state={visualBotState(botState, progress)} reducedMotion={reducedMotion} />)},[botState, reducedMotion, progress])
  useEffect(()=>{if(!mapReady||!map.current||!focus)return;const [from,to]=focus;const a=places[from]??places[0];const b=places[to]??a;const bounds=new LngLatBounds([a.lng,a.lat],[b.lng,b.lat]);map.current.fitBounds(bounds,{padding:compact?48:128,maxZoom:compact?14:13,duration:550,essential:true})},[compact,focus,mapReady,places])
  useEffect(()=>{if(map.current)map.current.resize()},[compact])
  useEffect(()=>{bot.current?.setLngLat(interpolate(places,progress));const active=Math.floor(progress*(places.length-1)+.001);markers.current.forEach((m,i)=>{const el=m.getElement();el.classList.toggle('is-done',i<active);el.classList.toggle('is-current',i===active)})},[placesKey,progress])
  return <div className="real-route-map" ref={host} role="region" aria-label="真实路线地图" aria-busy={!mapReady}>{!mapReady ? <span className="map-loading" role="status">正在准备地图</span> : null}</div>
}

function AmapRouteMap({ places, center = defaultCenter, progress=0, compact=false, focus=null, botState='walking', onNodeSelect, onReady }: RouteMapProps) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<AMapMapLike | null>(null)
  const bot = useRef<AMapOverlay | null>(null)
  const nodeElements = useRef<HTMLElement[]>([])
  const nodeMarkers = useRef<AMapOverlay[]>([])
  const botRoot = useRef<ReturnType<typeof createRoot>|null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const reducedMotion = useAppStore((state) => state.reducedMotion)
  const placesKey = useMemo(() => `${center.join(',')}|${places.map((place) => `${place.id}:${place.lng}:${place.lat}`).join('|')}`, [center, places])
  useEffect(() => {
    if (!host.current) return
    let cancelled = false
    let resizeObserver: ResizeObserver | null = null
    loadAmap().then((AMap) => {
      if (cancelled || !host.current) return
      const instance = new AMap.Map(host.current, { zoom: 11.6, center, mapStyle: 'amap://styles/whitesmoke', viewMode: '2D', zoomEnable: !compact, dragEnable: !compact, doubleClickZoom: !compact, keyboardEnable: !compact })
      const path = places.map((place) => [place.lng, place.lat] as [number, number])
      const polyline = new AMap.Polyline({ path, strokeColor: '#171717', strokeWeight: compact ? 3 : 4, strokeOpacity: 0.9, lineJoin: 'round', lineCap: 'round' })
      instance.add(polyline)
      const overlays: AMapOverlay[] = [polyline]
      const nodes = places.map((place, index) => {
        const element = document.createElement('button')
        element.type = 'button'
        element.className = `route-node ${index === 0 || index === places.length - 1 ? 'route-node--edge' : ''}`
        element.dataset.index = String(index)
        element.setAttribute('aria-label', `聚焦${place.name}`)
        element.innerHTML = `<span>${index + 1}</span><b>${place.name}</b>`
        if (onNodeSelect) element.addEventListener('click', () => onNodeSelect(index))
        nodeElements.current.push(element)
        const marker = new AMap.Marker({ position: [place.lng, place.lat], content: element, offset: [-12, -12], zIndex: 12 })
        nodeMarkers.current.push(marker)
        instance.add(marker)
        overlays.push(marker)
        return marker
      })
      const botElement = document.createElement('div')
      botElement.className = 'route-bot'
      botElement.setAttribute('aria-hidden','true')
      botRoot.current = createRoot(botElement)
      botRoot.current.render(<BloubBotSvg state={visualBotState(botState, progress)} reducedMotion={reducedMotion} />)
      const botMarker = new AMap.Marker({ position: interpolate(places, progress), content: botElement, offset: [-21, -21], zIndex: 18 })
      instance.add(botMarker)
      overlays.push(botMarker)
      map.current = instance
      bot.current = botMarker
      instance.setFitView(overlays, true, compact ? [34, 34, 34, 34] : [52, 52, 52, 52])
      resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => (instance as AMapMapLike & { resize?: () => void }).resize?.())
      if (resizeObserver && host.current) resizeObserver.observe(host.current)
      setMapReady(true)
      const active = Math.floor(progress * (places.length - 1) + 0.001)
      nodeElements.current.forEach((element, index) => { element.classList.toggle('is-done', index < active); element.classList.toggle('is-current', index === active) })
      onReady?.()
    }).catch(() => {
      // Configuration is checked before this component is mounted. If a remote
      // script is blocked, the regular MapLibre branch remains the safe local
      // fallback on the next render.
      setLoadFailed(true)
    })
    return () => {
      cancelled = true
      setMapReady(false)
      resizeObserver?.disconnect()
      nodeElements.current = []
      nodeMarkers.current = []
      bot.current = null
      botRoot.current?.unmount()
      botRoot.current = null
      map.current?.destroy()
      map.current = null
    }
  // The AMap instance is intentionally stable while only the bot marker moves.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesKey])
  useEffect(() => { botRoot.current?.render(<BloubBotSvg state={visualBotState(botState, progress)} reducedMotion={reducedMotion} />) }, [botState, reducedMotion, progress])
  useEffect(() => {
    if (!mapReady || !map.current || !focus) return
    const selected = focus.flatMap((index) => nodeMarkers.current[index] ? [nodeMarkers.current[index]] : [])
    if (selected.length) map.current.setFitView(selected, false, compact ? [48, 48, 48, 48] : [128, 128, 128, 128])
  }, [compact, focus, mapReady])
  // The provider keeps its map instance during progress and layout changes.
  useEffect(() => {
    bot.current?.setPosition?.(interpolate(places, progress))
    const active = Math.floor(progress * (places.length - 1) + 0.001)
    nodeElements.current.forEach((element, index) => { element.classList.toggle('is-done', index < active); element.classList.toggle('is-current', index === active) })
  }, [placesKey, progress])
  if (loadFailed) return <MapLibreRouteMap places={places} center={center} progress={progress} compact={compact} focus={focus} botState={botState} onNodeSelect={onNodeSelect} onReady={onReady} />
  return <div className="real-route-map real-route-map--amap" ref={host} role="region" aria-label="高德真实路线地图" aria-busy={!mapReady}>{!mapReady ? <span className="map-loading" role="status">正在准备地图</span> : null}</div>
}

export function RealRouteMap(props: RouteMapProps) {
  return isAmapConfigured ? <AmapRouteMap {...props} /> : <MapLibreRouteMap {...props} />
}
