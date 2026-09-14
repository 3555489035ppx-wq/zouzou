import { useEffect, useMemo, useRef, useState } from 'react'
import { LocateFixed, Pause, Play, Share2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { OpenMapButton } from '../components/MapLauncher'
import { RealRouteMap } from '../components/RealRouteMap'
import { EmptyState, ZouBottomSheet, ZouButton, ZouDaySelector, ZouMotionBot, ZouNavigationBar } from '../components/ui'
import { getDemoHotel, getDemoTripPlaces } from '../demo-data/cities'
import type { Place } from '../demo-data/trips'
import { useAppStore } from '../stores/appStore'
import { TripPlaybackEngine, type TripPlaybackSnapshot } from '../services/trip/TripPlaybackEngine'
import { readStoredPlans, type GeneratedPlan } from '../services/trip/planner'
import { getRoute } from '../demo-data/discover'
import { requestCurrentLocation, LocationError, type CurrentLocation } from '../services/location'
import { getPlaceCoordinates, coordinateArray } from '../services/places'
import { JourneyPlaceSheet } from '../components/JourneyPlaceSheet'
import { track } from '../services/analytics'

const stayMinutes = (value: string) => {
  const hours = Number(value.match(/(\d+(?:\.\d+)?)\s*h/i)?.[1] ?? 0)
  const minutes = Number(value.match(/(\d+)\s*min/i)?.[1] ?? 0)
  return Math.round(hours * 60 + minutes)
}

const formatStayDuration = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ''}` : `${minutes}min`

const TripProgressCard = ({ current, next, active, total, arrived, running, city, onOpenDetails }: { current: Place; next?: Place; active: number; total: number; arrived: boolean; running: boolean; city: string; onOpenDetails: () => void }) => (
  <section className="trip-progress-card" aria-labelledby="trip-progress-title">
    <header className="trip-progress-card__header">
      <div><span>今日进度</span><strong id="trip-progress-title">{active + 1} / {total}</strong></div>
      <div className="trip-progress-card__bot"><ZouMotionBot state={arrived ? 'happy' : running ? 'focused' : 'planning'} size="sm" label="GoGoBot / Grok Bot" interactive /></div>
    </header>
    <div className={`trip-progress-card__stop ${arrived ? 'is-arrived' : ''}`}>
      <button type="button" className="trip-progress-card__place" onClick={onOpenDetails} aria-label={`查看${current.name}地点资料`}>
        <span>{arrived ? `${current.time} · 已到达` : `当前地点 · ${current.time}`}</span>
        <strong>{current.name}</strong>
        <small>{current.type} · 停留 {current.stay} · 预计 ¥{current.budget}</small>
        {next && next.id !== current.id ? <em>下一站 · {next.time} · {next.name}</em> : null}
      </button>
      <OpenMapButton place={current} city={city} />
    </div>
  </section>
)

export { SavedTripExecution as TripsPage } from './SavedTripExecution'

const LegacyTripsPage = () => {
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
  const [liveLocation, setLiveLocation] = useState<CurrentLocation | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'error'>('idle')
  const [locationError, setLocationError] = useState('')
  const routeCity = tripCity ?? city
  const journeyId = activeRouteId ?? `journey-${routeCity}`
  const [placeSheet, setPlaceSheet] = useState<Place | null>(null)
  const hotel = useMemo(() => getDemoHotel(routeCity), [routeCity])
  const generatedPlan = useMemo<GeneratedPlan | null>(() => readStoredPlans()?.find((plan) => plan.id === 'match') ?? null, [])
  const adoptedRoute = useMemo(() => {
    const route = activeRouteId ? getRoute(activeRouteId) : undefined
    return route?.cityId === routeCity ? route : undefined
  }, [activeRouteId, routeCity])
  const places = useMemo<Place[]>(() => {
    if (adoptedRoute) return adoptedRoute.pois.map((poi, index) => ({ id: poi.id, time: `${14 + index}:00`, name: poi.name, type: poi.category, stay: poi.stay, budget: Math.round(adoptedRoute.budgetMax / adoptedRoute.pois.length), transport: poi.transportation, note: poi.introduction, ...(poi.verified && getPlaceCoordinates({ latitude: poi.latitude, longitude: poi.longitude }) ? { latitude: poi.latitude, longitude: poi.longitude, lng: poi.longitude, lat: poi.latitude } : {}), ...(poi.coordinateSource ? { coordinateSource: poi.coordinateSource } : {}), verified: poi.verified }))
    if (generatedPlan && generatedPlan.city === routeCity) return generatedPlan.days[day] ?? generatedPlan.days['Day 1']
    const dayPlaces = getDemoTripPlaces(routeCity, day)
    return day === 'Day 1'
      ? [hotel, ...dayPlaces, { ...hotel, id: `${routeCity}-hotel-return`, time: '20:30', stay: '休息', note: '回到酒店结束今天。' }]
      : dayPlaces
  }, [routeCity, day, hotel, generatedPlan, adoptedRoute])
  const displayPlaces = places
  const playbackRef = useRef(new TripPlaybackEngine(displayPlaces.length, 'live'))
  const [playback, setPlayback] = useState<TripPlaybackSnapshot>(() => playbackRef.current.snapshot)
  const completionTrackedRef = useRef(false)
  const forcedArrival = params.get('arrival') === '1'
  const effectiveProgress = forcedArrival
    ? 1 / Math.max(1, displayPlaces.length - 1)
    : playback.progress
  const active = Math.min(displayPlaces.length - 1, Math.floor(effectiveProgress * (displayPlaces.length - 1) + 0.001))
  const current = displayPlaces[active]
  const next = displayPlaces[Math.min(displayPlaces.length - 1, active + 1)]
  const arrived = forcedArrival || playback.state === 'arriving' || playback.state === 'staying'
  const running = playback.state === 'moving'
  const dayBudget = useMemo(() => displayPlaces.reduce((total, place) => total + (Number.isFinite(place.budget) ? place.budget : 0), 0), [displayPlaces])
  const dayStay = useMemo(() => displayPlaces.reduce((total, place) => total + stayMinutes(place.stay), 0), [displayPlaces])
  const dayStatus = arrived ? '已抵达当前站' : running ? '正在进行' : playback.state === 'paused' ? '已暂停' : '准备出发'

  useEffect(() => {
    playbackRef.current = new TripPlaybackEngine(displayPlaces.length, 'live')
    setPlayback(playbackRef.current.snapshot)
  }, [day, displayPlaces.length])
  useEffect(() => {
    if (!running) return
    // Keep each segment in a human-scale 3–5 second window. The playback
    // engine pauses at each node, so a long route remains scannable without
    // turning the demo into a 20+ second wait.
    const segmentSeconds = displayPlaces.length <= 3 ? 3.2 : displayPlaces.length <= 5 ? 4.2 : 3.8
    const delta = (1 / Math.max(1, displayPlaces.length - 1)) * (80 / (segmentSeconds * 1000))
    const id = window.setInterval(() => setPlayback(playbackRef.current.tick(delta)), 80)
    return () => window.clearInterval(id)
  }, [running])
  useEffect(() => {
    if (playback.state !== 'completed' || completionTrackedRef.current) return
    completionTrackedRef.current = true
    setMode('completed')
    track('journey_completed', { journeyId, places: Math.max(0, displayPlaces.length - 1) })
    const visitedAt = new Date().toISOString().slice(0, 10)
    displayPlaces.slice(0, -1).forEach((place) => {
      const coordinates = coordinateArray(place)
      addFootprint({ id: `${journeyId}-footprint-${place.id}`, userId: 'local-user', journeyId, placeId: place.id, city: routeCity, country: '中国', visitedAt, ...(coordinates ? { coordinates } : {}), source: 'journey', note: place.name, createdAt: new Date().toISOString() })
    })
  }, [addFootprint, displayPlaces, journeyId, playback.state, routeCity, setMode])

  const handleLocationError = (error: unknown) => {
    const status = error instanceof LocationError ? error.status : 'error'
    setLocationStatus(status === 'denied' ? 'denied' : 'error')
    setLocationError(error instanceof Error ? error.message : '暂时无法获取当前位置，请稍后重试。')
  }

  const handleLocate = async () => {
    setLocationStatus('requesting')
    setLocationError('')
    try {
      const currentLocation = await requestCurrentLocation()
      setLiveLocation(currentLocation)
      setLocationStatus('granted')
      setLocationError('已获取当前位置。打开某一站的外部地图后，可继续使用地图导航。')
      setDeviation(true)
    } catch (error) {
      handleLocationError(error)
      setDeviation(true)
    }
  }

  const togglePlayback = () => {
    if (playback.state === 'moving') setPlayback(playbackRef.current.pause())
    else setPlayback(playback.state === 'paused' ? playbackRef.current.resume() : playbackRef.current.start())
  }

  if (mode === 'none') return <AppShell showTabBar><EmptyState title="还没有行程" body="创建一次旅行后，完整路线会直接出现在这里。" action="去创建旅行" onAction={() => navigate('/travel/new')} /></AppShell>
  if (mode === 'upcoming') return <AppShell showTabBar><div className="page-content upcoming-trip"><ZouMotionBot state="sleepy" /><span className="trip-kicker">路线已加入</span><h1>{adoptedRoute?.title ?? '你的新行程'}</h1><p>{displayPlaces.length} 个地点 · 预计 {adoptedRoute?.duration ?? '4h'}</p><ZouButton onClick={() => { track('journey_saved', { journeyId }); setMode('active') }}>开始这次走走</ZouButton></div></AppShell>
  if (mode === 'completed') return <AppShell showTabBar><div className="completion-page"><ZouMotionBot state="happy" /><span className="trip-kicker">DAY 1 · 完成</span><h1>今天走完啦</h1><p>你们把计划真正走成了一段记忆。</p><dl><div><dt>总时间</dt><dd>8h 20min</dd></div><div><dt>地点</dt><dd>{displayPlaces.length}</dd></div><div><dt>地图</dt><dd>由地图 App 计算</dd></div></dl><ZouButton onClick={() => navigate('/discover/publish')}>分享这次行程</ZouButton><ZouButton variant="secondary" onClick={() => { archiveRoute(activeRouteId ?? journeyId); navigate('/profile/trips') }}>归档这次行程</ZouButton><button className="text-button" onClick={() => navigate(`/trips/${encodeURIComponent(routeCity)}/replay`)}>回放今天的路线</button></div></AppShell>
      return (
        <AppShell showTabBar>
          <div className="trip-page-v3">
            <header className="trip-live-header">
              <div>
                <span>{routeCity} · {generatedPlan && generatedPlan.city === routeCity ? `${generatedPlan.nights + 1}天${generatedPlan.nights}晚` : '3天2晚'}</span>
                <h1>{day} · 正在进行</h1>
              </div>
              <button className="icon-button" aria-label="分享行程" onClick={() => navigate('/journey/share')}><Share2 /></button>
            </header>
            <ZouDaySelector day={day} onChange={(value) => { setDay(value); playbackRef.current.reset() }} />
            <TripProgressCard current={current} next={next} active={active} total={displayPlaces.length} arrived={arrived} running={running} city={routeCity} onOpenDetails={() => setPlaceSheet(current)} />
            <footer className="trip-controls">
              <div><span>当前状态</span><strong>{arrived ? '已到达当前站' : running ? '正在进行' : playback.state === 'paused' ? '已暂停' : '准备出发'}</strong></div>
              <button aria-label={running ? '暂停' : '继续'} onClick={togglePlayback}>{running ? <Pause /> : <Play />}{running ? '暂停' : '继续行程'}</button>
              <button aria-label="定位" disabled={locationStatus === 'requesting'} onClick={handleLocate}><LocateFixed />{locationStatus === 'requesting' ? '定位中' : ''}</button>
            </footer>
            <section className="trip-day-summary" aria-label="今日概览">
              <header><div><span>今日概览</span><strong>{dayStatus}</strong></div><span>{day.replace('Day ', 'DAY ')}</span></header>
              <dl><div><dt>进度</dt><dd>{active + 1} / {displayPlaces.length}</dd></div><div><dt>地点</dt><dd>{displayPlaces.length} 站</dd></div><div><dt>预计停留</dt><dd>{formatStayDuration(dayStay)}</dd></div><div><dt>预算</dt><dd>¥{dayBudget}</dd></div></dl>
              <p>从 {displayPlaces[0]?.time ?? '待定'} 开始 · 当前地点资料可点开查看</p>
            </section>
            <section className="trip-itinerary" aria-labelledby="trip-itinerary-title">
              <header><h2 id="trip-itinerary-title">今日行程</h2><span>{day.replace('Day ', 'DAY ')}</span></header>
              <ol>{displayPlaces.slice(0, -1).map((place, index) => <li key={place.id} role="button" tabIndex={0} aria-label={`查看${place.name}地点资料`} onClick={() => setPlaceSheet(place)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPlaceSheet(place) } }} className={index === active ? 'is-current' : index < active ? 'is-done' : ''}><span className="trip-itinerary__index">{index + 1}</span><div><strong>{place.name}</strong><small>{place.time} · {place.type} · {place.stay}</small><p>{place.note}</p></div><b>¥{place.budget}</b></li>)}</ol>
            </section>
          </div>
          <ZouBottomSheet open={deviation} onClose={() => setDeviation(false)} title="定位提示">
            <div className="deviation-content"><ZouMotionBot state="warning" label="GoGoBot / Grok Bot" /><p>{locationError || (liveLocation ? '已获取当前位置。打开某一站的外部地图后，可继续使用地图导航。' : '走走不会在页面内模拟导航路线；请选择某一站的地图 App 来导航。')}</p><ZouButton onClick={() => setDeviation(false)}>知道了</ZouButton></div>
          </ZouBottomSheet>
          <JourneyPlaceSheet open={Boolean(placeSheet)} onClose={() => setPlaceSheet(null)} place={placeSheet} city={routeCity} journeyId={journeyId} dayId={day} />
        </AppShell>
      )
}

export const TripReplayPage = () => {
  const city = useAppStore((state) => state.city)
  const tripCity = useAppStore((state) => state.tripCity)
  const routeCity = tripCity ?? city
  const generatedPlan = useMemo<GeneratedPlan | null>(() => readStoredPlans()?.find((plan) => plan.id === 'match') ?? null, [])
  const places = useMemo(() => generatedPlan && generatedPlan.city === routeCity ? generatedPlan.days['Day 1'] : getDemoTripPlaces(routeCity, 'Day 1'), [routeCity, generatedPlan])
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setProgress((value) => value >= 1 ? 0 : Math.min(1, value + .004)), 80)
    return () => window.clearInterval(id)
  }, [playing])
  const current = useMemo(() => places[Math.min(places.length - 1, Math.round(progress * (places.length - 1)))], [places, progress])
  return <AppShell><ZouNavigationBar title="今天的路线"/><div className="trip-replay-page"><div className="replay-map"><RealRouteMap city={routeCity} places={places} progress={progress} compact /></div><div className="replay-facts"><span>{current.time}</span><strong>{current.name}</strong><small>{Math.round(progress * 100)}% · 地点顺序预览</small></div><button className="replay-control" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause /> : <Play />}{playing ? '暂停回放' : '继续回放'}</button></div></AppShell>
}
