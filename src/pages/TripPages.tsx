import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LocateFixed, Pause, Play, Route, Share2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { RealRouteMap } from '../components/RealRouteMap'
import { EmptyState, ZouBottomSheet, ZouButton, ZouDaySelector, ZouMotionBot, ZouNavigationBar } from '../components/ui'
import { getCityProfile, getDemoHotel, getDemoTripPlaces } from '../demo-data/cities'
import type { Place } from '../demo-data/trips'
import { useAppStore } from '../stores/appStore'
import { TripPlaybackEngine, type TripPlaybackSnapshot } from '../services/trip/TripPlaybackEngine'
import { readStoredPlans, type GeneratedPlan } from '../services/trip/planner'
import { getRoute } from '../demo-data/discover'
import { AmapGeolocationError, getCurrentLocation, startLocationTracking, stopLocationTracking, type LiveLocation } from '../services/amap/geolocation'
import type { RouteMatch } from '../services/amap/matching'
import { wgs84ToGcj02, type RouteSnapshot } from '../services/amap/route'
import { JourneyPlaceSheet } from './JourneyToolsPages'
import { track } from '../services/analytics'

const formatRouteDistance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
const distanceBetween = (left: [number, number], right: [number, number]) => {
  const earthRadius = 6_371_000
  const lat = ((left[1] + right[1]) / 2) * Math.PI / 180
  const x = (right[0] - left[0]) * Math.PI / 180 * Math.cos(lat)
  const y = (right[1] - left[1]) * Math.PI / 180
  return Math.hypot(x, y) * earthRadius
}

export const TripsPage = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const mode = useAppStore((state) => state.tripMode)
  const city = useAppStore((state) => state.city)
  const tripCity = useAppStore((state) => state.tripCity)
  const setMode = useAppStore((state) => state.setTripMode)
  const addFootprint = useAppStore((state) => state.addFootprint)
  const archiveRoute = useAppStore((state) => state.archiveRoute)
  const activeRouteId = useAppStore((state) => state.activeRouteId)
  const [day, setDay] = useState('Day 1')
  const [deviation, setDeviation] = useState(params.get('deviation') === '1')
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'error'>('idle')
  const [locationError, setLocationError] = useState('')
  const [routeMatch, setRouteMatch] = useState<RouteMatch | null>(null)
  const [routeSnapshot, setRouteSnapshot] = useState<RouteSnapshot | null>(null)
  const [followUser, setFollowUser] = useState(false)
  const [deviationDistance, setDeviationDistance] = useState<number | null>(null)
  const locationStopRef = useRef<(() => void) | null>(null)
  const liveLocationRef = useRef<LiveLocation | null>(null)
  const deviationSamplesRef = useRef(0)
  const routeCity = tripCity ?? city
  const journeyId = activeRouteId ?? `journey-${routeCity}`
  const [placeSheet, setPlaceSheet] = useState<Place | null>(null)
  const cityProfile = useMemo(() => getCityProfile(routeCity), [routeCity])
  const hotel = useMemo(() => getDemoHotel(routeCity), [routeCity])
  const generatedPlan = useMemo<GeneratedPlan | null>(() => readStoredPlans()?.find((plan) => plan.id === 'match') ?? null, [])
  const adoptedRoute = useMemo(() => {
    const route = activeRouteId ? getRoute(activeRouteId) : undefined
    return route?.cityId === routeCity ? route : undefined
  }, [activeRouteId, routeCity])
  const places = useMemo<Place[]>(() => {
    if (adoptedRoute) return adoptedRoute.pois.map((poi, index) => ({ id: poi.id, time: `${14 + index}:00`, name: poi.name, type: poi.category, stay: poi.stay, budget: Math.round(adoptedRoute.budgetMax / adoptedRoute.pois.length), transport: poi.transportation, note: poi.introduction, x: index, z: index, lng: poi.longitude, lat: poi.latitude, coordinateSource: poi.coordinateSource, verified: Boolean(poi.coordinateSource) }))
    if (generatedPlan && generatedPlan.city === routeCity) return generatedPlan.days[day] ?? generatedPlan.days['Day 1']
    const dayPlaces = getDemoTripPlaces(routeCity, day)
    return day === 'Day 1'
      ? [hotel, ...dayPlaces, { ...hotel, id: `${routeCity}-hotel-return`, time: '20:30', stay: '休息', note: '回到酒店结束今天。' }]
      : dayPlaces
  }, [routeCity, day, hotel, generatedPlan, adoptedRoute])
  const placesKey = useMemo(() => places.map((place) => `${place.id}:${place.lng}:${place.lat}:${place.poiId ?? place.amapPoiId ?? ''}:${place.mapStatus ?? ''}`).join('|'), [places])
  const [resolvedPlacesById, setResolvedPlacesById] = useState<Record<string, Place>>({})
  useEffect(() => setResolvedPlacesById({}), [placesKey])
  const displayPlaces = useMemo(() => places.map((place) => resolvedPlacesById[place.id] ? { ...place, ...resolvedPlacesById[place.id] } : place), [places, resolvedPlacesById])
  useEffect(() => { liveLocationRef.current = liveLocation }, [liveLocation])
  useEffect(() => () => stopLocationTracking(locationStopRef.current), [])
  const handlePlacesResolved = (nextPlaces: Place[]) => {
    setResolvedPlacesById((current) => {
      const next = Object.fromEntries(nextPlaces.map((place) => [place.id, place]))
      const same = Object.keys(next).length === Object.keys(current).length && Object.values(next).every((place) => {
        const previous = current[place.id]
        return previous && previous.name === place.name && previous.lng === place.lng && previous.lat === place.lat && previous.poiId === place.poiId && previous.amapPoiId === place.amapPoiId && previous.mapStatus === place.mapStatus && previous.resolutionStatus === place.resolutionStatus && previous.address === place.address && previous.coordinateSource === place.coordinateSource
      })
      return same ? current : next
    })
  }
  const playbackRef = useRef(new TripPlaybackEngine(displayPlaces.length, 'live'))
  const [playback, setPlayback] = useState<TripPlaybackSnapshot>(() => playbackRef.current.snapshot)
  const completionTrackedRef = useRef(false)
  const [focus, setFocus] = useState<[number, number] | null>(null)
  const forcedArrival = params.get('arrival') === '1'
  const usingLiveLocation = locationStatus === 'granted' && liveLocation !== null
  const effectiveProgress = forcedArrival
    ? 1 / Math.max(1, displayPlaces.length - 1)
    : usingLiveLocation
      ? routeMatch?.progress ?? 0
      : playback.progress
  const active = Math.min(displayPlaces.length - 1, Math.floor(effectiveProgress * (displayPlaces.length - 1) + 0.001))
  const current = displayPlaces[active]
  const next = displayPlaces[Math.min(displayPlaces.length - 1, active + 1)]
  const currentPosition = current && current.mapStatus !== 'unresolved' && current.verified !== false
    ? current.coordinateSystem === 'gcj02' ? [current.lng, current.lat] as [number, number] : wgs84ToGcj02([current.lng, current.lat])
    : null
  const arrivedByLocation = Boolean(usingLiveLocation && liveLocation && currentPosition && distanceBetween([liveLocation.lng, liveLocation.lat], currentPosition) <= Math.max(60, (liveLocation.accuracy ?? 0) * 1.5))
  const arrived = forcedArrival || arrivedByLocation || playback.state === 'arriving' || playback.state === 'staying'
  const running = playback.state === 'moving'
  const tripBotGaze = useMemo(() => running ? { yaw: 26, pitch: -5, mix: 1, spin: 0, wander: 0 } : { yaw: -8, pitch: 0, mix: .72, spin: 0, wander: .28 }, [running])

  useEffect(() => {
    playbackRef.current = new TripPlaybackEngine(displayPlaces.length, 'live')
    setPlayback(playbackRef.current.snapshot)
    setFocus(null)
  }, [day, displayPlaces.length])
  useEffect(() => {
    if (!running || usingLiveLocation) return
    // Keep each segment in a human-scale 3–5 second window. The playback
    // engine pauses at each node, so a long route remains scannable without
    // turning the demo into a 20+ second wait.
    const segmentSeconds = displayPlaces.length <= 3 ? 3.2 : displayPlaces.length <= 5 ? 4.2 : 3.8
    const delta = (1 / Math.max(1, displayPlaces.length - 1)) * (80 / (segmentSeconds * 1000))
    const id = window.setInterval(() => setPlayback(playbackRef.current.tick(delta)), 80)
    return () => window.clearInterval(id)
  }, [running, usingLiveLocation])
  useEffect(() => {
    if (playback.state !== 'completed' || completionTrackedRef.current) return
    completionTrackedRef.current = true
    setMode('completed')
    track('journey_completed', { journeyId, places: Math.max(0, displayPlaces.length - 1) })
    const visitedAt = new Date().toISOString().slice(0, 10)
    displayPlaces.slice(0, -1).forEach((place) => addFootprint({ id: `${journeyId}-footprint-${place.id}`, userId: 'local-user', journeyId, placeId: place.id, city: routeCity, country: '中国', visitedAt, coordinates: [place.lng, place.lat], source: 'journey', note: place.name, createdAt: new Date().toISOString() }))
  }, [addFootprint, displayPlaces, journeyId, playback.state, routeCity, setMode])

  const handleLocationError = (error: AmapGeolocationError) => {
    setLocationStatus(error.code === 'GEOLOCATION_DENIED' ? 'denied' : 'error')
    setLocationError(error.message)
  }

  const handleLocate = async () => {
    stopLocationTracking(locationStopRef.current)
    locationStopRef.current = null
    setLocationStatus('requesting')
    setLocationError('')
    try {
      const currentLocation = await getCurrentLocation()
      setLiveLocation(currentLocation)
      setLocationStatus('granted')
      setFollowUser(true)
      setDeviation(false)
      setPlayback(playbackRef.current.pause())
      locationStopRef.current = startLocationTracking(undefined, (next) => {
        setLiveLocation(next)
        setLocationStatus('granted')
        setLocationError('')
      }, handleLocationError)
    } catch (error) {
      handleLocationError(error instanceof AmapGeolocationError ? error : new AmapGeolocationError('GEOLOCATION_UNAVAILABLE', '暂时无法获取当前位置，请稍后重试。'))
      setDeviation(true)
    }
  }

  const handleRouteMatch = useCallback((match: RouteMatch | null) => {
    setRouteMatch(match)
    if (!match) {
      deviationSamplesRef.current = 0
      return
    }
    const accuracy = liveLocationRef.current?.accuracy ?? 0
    const threshold = Math.max(80, accuracy * 1.5)
    if (match.distanceFromRoute > threshold) deviationSamplesRef.current += 1
    else deviationSamplesRef.current = 0
    if (deviationSamplesRef.current >= 3) {
      setDeviationDistance(Math.round(match.distanceFromRoute))
      setDeviation(true)
    }
  }, [])

  const togglePlayback = () => {
    if (playback.state === 'moving') setPlayback(playbackRef.current.pause())
    else setPlayback(playback.state === 'paused' ? playbackRef.current.resume() : playbackRef.current.start())
  }

  if (mode === 'none') return <AppShell showTabBar><EmptyState title="还没有行程" body="创建一次旅行后，完整路线会直接出现在这里。" action="去创建旅行" onAction={() => navigate('/travel/new')} /></AppShell>
  if (mode === 'upcoming') return <AppShell showTabBar><div className="page-content upcoming-trip"><ZouMotionBot state="waiting" /><span className="trip-kicker">路线已加入</span><h1>{adoptedRoute?.title ?? '你的新行程'}</h1><p>{displayPlaces.length} 个地点 · 预计 {adoptedRoute?.duration ?? '4h'}</p><ZouButton onClick={() => { track('journey_saved', { journeyId }); setMode('active') }}>开始这次走走</ZouButton></div></AppShell>
  if (mode === 'completed') return <AppShell showTabBar><div className="completion-page"><ZouMotionBot state="completed" /><span className="trip-kicker">DAY 1 · 完成</span><h1>今天走完啦</h1><p>你们把计划真正走成了一段记忆。</p><dl><div><dt>总时间</dt><dd>8h 20min</dd></div><div><dt>地点</dt><dd>{displayPlaces.length}</dd></div><div><dt>步行</dt><dd>{routeSnapshot ? formatRouteDistance(routeSnapshot.distanceMeters) : '真实距离待加载'}</dd></div></dl><ZouButton onClick={() => navigate('/discover/publish')}>分享这次行程</ZouButton><ZouButton variant="secondary" onClick={() => { archiveRoute(activeRouteId ?? journeyId); navigate('/profile/trips') }}>归档这次行程</ZouButton><button className="text-button" onClick={() => navigate('/trips/shanghai/replay')}>回放今天的路线</button></div></AppShell>
      return <AppShell showTabBar><div className="trip-page-v3"><header className="trip-live-header"><div><span>{routeCity} · {generatedPlan && generatedPlan.city === routeCity ? `${generatedPlan.nights + 1}天${generatedPlan.nights}晚` : '3天2晚'}</span><h1>{day} · 正在进行</h1></div><button className="icon-button" aria-label="分享行程" onClick={() => navigate('/journey/share')}><Share2 /></button></header><ZouDaySelector day={day} onChange={(value) => { setDay(value); playbackRef.current.reset(); setFocus(null) }} /><section className="live-map"><RealRouteMap city={routeCity} center={cityProfile.mapCenter} places={displayPlaces} progress={effectiveProgress} focus={focus} userLocation={liveLocation} followUser={followUser} onMapInteraction={() => setFollowUser(false)} onRouteMatch={handleRouteMatch} onRouteSnapshot={setRouteSnapshot} botState={arrived ? 'arriving' : running ? (Math.floor(effectiveProgress * 9) % 3 === 1 ? 'listening' : Math.floor(effectiveProgress * 9) % 3 === 2 ? 'done' : 'walking') : 'paused'} onPlacesResolved={handlePlacesResolved} onNodeSelect={(index) => { setFollowUser(false); setFocus([index, Math.min(displayPlaces.length - 1, index + 1)]) }} /><button className="map-overview" aria-label="一览全程" onClick={() => { setFollowUser(false); setFocus([0, displayPlaces.length - 1]) }}><Route />一览全程</button><div className={`map-context ${arrived ? 'is-arrived' : ''}`}><ZouMotionBot state={arrived ? 'arriving' : running ? (Math.floor(effectiveProgress * 9) % 3 === 1 ? 'listening' : Math.floor(effectiveProgress * 9) % 3 === 2 ? 'done' : 'walking') : 'paused'} size="sm" gaze={tripBotGaze} label="Bloub / Grok Bot" /><div><span>{arrived ? `${current.time} · 已到达` : '下一站 · ' + next.time}</span><strong>{arrived ? current.name : next.name}</strong><small>{arrived ? `${current.type} · ${current.stay} · 预计 ¥${current.budget}` : current.transport}</small></div></div></section><footer className="trip-controls"><div><span>今日进度</span><strong>{active + 1} / {displayPlaces.length}</strong></div><button aria-label={running ? '暂停' : '继续'} onClick={togglePlayback}>{running ? <Pause /> : <Play />}{running ? '暂停' : '继续行程'}</button><button aria-label="定位" disabled={locationStatus === 'requesting'} onClick={handleLocate}><LocateFixed />{locationStatus === 'requesting' ? '定位中' : ''}</button></footer><section className="trip-itinerary" aria-labelledby="trip-itinerary-title"><header><h2 id="trip-itinerary-title">今日行程</h2><span>{day.replace('Day ', 'DAY ')}</span></header><ol>{displayPlaces.slice(0, -1).map((place, index) => <li key={place.id} role="button" tabIndex={0} aria-label={`查看${place.name}地点资料`} onClick={() => setPlaceSheet(place)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPlaceSheet(place) } }} className={index === active ? 'is-current' : index < active ? 'is-done' : ''}><span className="trip-itinerary__index">{index + 1}</span><div><strong>{place.name}</strong><small>{place.time} · {place.type} · {place.stay}</small><p>{place.note}</p></div><b>¥{place.budget}</b></li>)}</ol></section></div><ZouBottomSheet open={deviation} onClose={() => setDeviation(false)} title="路线似乎偏离了"><div className="deviation-content"><ZouMotionBot state="alert" label="Bloub / Grok Bot" /><p>{locationError || (routeMatch ? `你偏离当前路线约 ${deviationDistance ?? Math.round(routeMatch.distanceFromRoute)} 米。` : '尚未获取真实位置，点击定位后才会计算你与路线的距离。')} 要保持原计划，还是从当前位置局部调整？</p><ZouButton onClick={() => setDeviation(false)}>保持原路线</ZouButton><button className="secondary-action" onClick={() => { setFollowUser(true); setDeviation(false) }}>从当前位置调整</button></div></ZouBottomSheet><JourneyPlaceSheet open={Boolean(placeSheet)} onClose={() => setPlaceSheet(null)} place={placeSheet} city={routeCity} journeyId={journeyId} dayId={day} /></AppShell>
}

export const TripReplayPage = () => {
  const city = useAppStore((state) => state.city)
  const tripCity = useAppStore((state) => state.tripCity)
  const routeCity = tripCity ?? city
  const cityProfile = useMemo(() => getCityProfile(routeCity), [routeCity])
  const generatedPlan = useMemo<GeneratedPlan | null>(() => readStoredPlans()?.find((plan) => plan.id === 'match') ?? null, [])
  const places = useMemo(() => generatedPlan && generatedPlan.city === routeCity ? generatedPlan.days['Day 1'] : getDemoTripPlaces(routeCity, 'Day 1'), [routeCity, generatedPlan])
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [routeSnapshot, setRouteSnapshot] = useState<RouteSnapshot | null>(null)
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setProgress((value) => value >= 1 ? 0 : Math.min(1, value + .004)), 80)
    return () => window.clearInterval(id)
  }, [playing])
  const current = useMemo(() => places[Math.min(places.length - 1, Math.round(progress * (places.length - 1)))], [places, progress])
  return <AppShell><ZouNavigationBar title="今天的路线"/><div className="trip-replay-page"><div className="replay-map"><RealRouteMap city={routeCity} center={cityProfile.mapCenter} places={places} progress={progress} compact onRouteSnapshot={setRouteSnapshot}/></div><div className="replay-facts"><span>{current.time}</span><strong>{current.name}</strong><small>{Math.round(progress * 100)}% · {routeSnapshot ? formatRouteDistance(routeSnapshot.distanceMeters) : '真实距离待加载'}</small></div><button className="replay-control" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause /> : <Play />}{playing ? '暂停回放' : '继续回放'}</button></div></AppShell>
}
