import { useEffect, useMemo, useRef, useState } from 'react'
import { LocateFixed, Pause, Play, Route, Share2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { RealRouteMap } from '../components/RealRouteMap'
import { EmptyState, ZouBottomSheet, ZouButton, ZouDaySelector, ZouMotionBot, ZouNavigationBar } from '../components/ui'
import { getCityProfile, getDemoHotel, getDemoTripPlaces } from '../demo-data/cities'
import { useAppStore } from '../stores/appStore'
import { TripPlaybackEngine, type TripPlaybackSnapshot } from '../services/trip/TripPlaybackEngine'
import { readStoredPlans, type GeneratedPlan } from '../services/trip/planner'

export const TripsPage = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const mode = useAppStore((state) => state.tripMode)
  const city = useAppStore((state) => state.city)
  const setMode = useAppStore((state) => state.setTripMode)
  const [day, setDay] = useState('Day 1')
  const [deviation, setDeviation] = useState(params.get('deviation') === '1')
  const cityProfile = useMemo(() => getCityProfile(city), [city])
  const hotel = useMemo(() => getDemoHotel(city), [city])
  const generatedPlan = useMemo<GeneratedPlan | null>(() => readStoredPlans()?.find((plan) => plan.id === 'match') ?? null, [])
  const places = useMemo(() => {
    if (generatedPlan && city === '上海') return generatedPlan.days[day] ?? generatedPlan.days['Day 1']
    const dayPlaces = getDemoTripPlaces(city, day)
    return day === 'Day 1'
      ? [hotel, ...dayPlaces, { ...hotel, id: `${city}-hotel-return`, time: '20:30', stay: '休息', note: '回到酒店结束今天。' }]
      : dayPlaces
  }, [city, day, hotel, generatedPlan])
  const playbackRef = useRef(new TripPlaybackEngine(places.length, 'live'))
  const [playback, setPlayback] = useState<TripPlaybackSnapshot>(() => playbackRef.current.snapshot)
  const [focus, setFocus] = useState<[number, number] | null>(null)
  const forcedArrival = params.get('arrival') === '1'
  const effectiveProgress = forcedArrival ? 1 / Math.max(1, places.length - 1) : playback.progress
  const active = Math.min(places.length - 1, Math.floor(effectiveProgress * (places.length - 1) + 0.001))
  const current = places[active]
  const next = places[Math.min(places.length - 1, active + 1)]
  const arrived = forcedArrival || playback.state === 'arriving' || playback.state === 'staying'
  const running = playback.state === 'moving'
  const tripBotGaze = useMemo(() => running ? { yaw: 26, pitch: -5, mix: 1, spin: 0, wander: 0 } : { yaw: -8, pitch: 0, mix: .72, spin: 0, wander: .28 }, [running])

  useEffect(() => {
    playbackRef.current = new TripPlaybackEngine(places.length, 'live')
    setPlayback(playbackRef.current.snapshot)
    setFocus(null)
  }, [day, places.length])
  useEffect(() => {
    if (!running) return
    // Keep motion visibly human-scale: a full route takes roughly 24 seconds,
    // with a steady 80ms sample and no camera jump when playback starts.
    const id = window.setInterval(() => setPlayback(playbackRef.current.tick(0.0035)), 80)
    return () => window.clearInterval(id)
  }, [running])
  useEffect(() => {
    if (playback.state === 'completed') setMode('completed')
  }, [playback.state, setMode])

  const togglePlayback = () => {
    if (playback.state === 'moving') setPlayback(playbackRef.current.pause())
    else setPlayback(playback.state === 'paused' ? playbackRef.current.resume() : playbackRef.current.start())
  }

  if (mode === 'none') return <AppShell showTabBar><EmptyState title="还没有行程" body="创建一次旅行后，完整路线会直接出现在这里。" action="去创建旅行" onAction={() => navigate('/travel/new')} /></AppShell>
  if (mode === 'upcoming') return <AppShell showTabBar><div className="page-content upcoming-trip"><ZouMotionBot state="waiting" /><span className="trip-kicker">即将开始</span><h1>距离上海出发还有 2 天</h1><p>3 天 2 晚 · 4 位朋友</p><ZouButton onClick={() => setMode('active')}>开始这次走走</ZouButton></div></AppShell>
  if (mode === 'completed') return <AppShell showTabBar><div className="completion-page"><ZouMotionBot state="completed" /><span className="trip-kicker">DAY 1 · 完成</span><h1>今天走完啦</h1><p>你们把计划真正走成了一段记忆。</p><dl><div><dt>总时间</dt><dd>8h 20min</dd></div><div><dt>地点</dt><dd>5</dd></div><div><dt>步行</dt><dd>6.8 km</dd></div></dl><ZouButton onClick={() => navigate('/trips/shanghai/replay')}>回放今天的路线</ZouButton><button className="text-button" onClick={() => { setMode('active'); setPlayback(playbackRef.current.reset()) }}>重新演示</button></div></AppShell>
      return <AppShell showTabBar><div className="trip-page-v3"><header className="trip-live-header"><div><span>{city} · {generatedPlan ? `${generatedPlan.nights + 1}天${generatedPlan.nights}晚` : '3天2晚'}</span><h1>{day} · 正在进行</h1></div><button className="icon-button" aria-label="分享行程"><Share2 /></button></header><ZouDaySelector day={day} onChange={(value) => { setDay(value); playbackRef.current.reset(); setFocus(null) }} /><section className="live-map"><RealRouteMap center={cityProfile.mapCenter} places={places} progress={effectiveProgress} focus={focus} botState={arrived ? 'arriving' : running ? 'walking' : 'paused'} onNodeSelect={(index) => setFocus([index, Math.min(places.length - 1, index + 1)])} /><button className="map-overview" aria-label="一览全程" onClick={() => setFocus([0, places.length - 1])}><Route />一览全程</button><div className={`map-context ${arrived ? 'is-arrived' : ''}`}><ZouMotionBot state={arrived ? 'arriving' : running ? 'walking' : 'paused'} size="sm" gaze={tripBotGaze} /><div><span>{arrived ? `${current.time} · 已到达` : '下一站 · ' + next.time}</span><strong>{arrived ? current.name : next.name}</strong><small>{arrived ? `${current.type} · ${current.stay} · 预计 ¥${current.budget}` : current.transport}</small></div></div></section><footer className="trip-controls"><div><span>今日进度</span><strong>{active + 1} / {places.length}</strong></div><button aria-label={running ? '暂停' : '继续'} onClick={togglePlayback}>{running ? <Pause /> : <Play />}{running ? '暂停' : '继续行程'}</button><button aria-label="定位" onClick={() => setDeviation(true)}><LocateFixed /></button></footer><section className="trip-itinerary" aria-labelledby="trip-itinerary-title"><header><h2 id="trip-itinerary-title">今日行程</h2><span>{day.replace('Day ', 'DAY ')}</span></header><ol>{places.slice(0, -1).map((place, index) => <li key={place.id} className={index === active ? 'is-current' : index < active ? 'is-done' : ''}><span className="trip-itinerary__index">{index + 1}</span><div><strong>{place.name}</strong><small>{place.time} · {place.type} · {place.stay}</small><p>{place.note}</p></div><b>¥{place.budget}</b></li>)}</ol></section></div><ZouBottomSheet open={deviation} onClose={() => setDeviation(false)} title="路线似乎偏离了"><div className="deviation-content"><ZouMotionBot state="alert" /><p>你离原路线约 260 米。要保持原计划，还是从当前位置局部调整？</p><ZouButton onClick={() => setDeviation(false)}>保持原路线</ZouButton><button className="secondary-action" onClick={() => setDeviation(false)}>从当前位置调整</button></div></ZouBottomSheet></AppShell>
}

export const TripReplayPage = () => {
  const city = useAppStore((state) => state.city)
  const cityProfile = useMemo(() => getCityProfile(city), [city])
  const generatedPlan = useMemo<GeneratedPlan | null>(() => readStoredPlans()?.find((plan) => plan.id === 'match') ?? null, [])
  const places = useMemo(() => generatedPlan && city === '上海' ? generatedPlan.days['Day 1'] : getDemoTripPlaces(city, 'Day 1'), [city, generatedPlan])
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setProgress((value) => value >= 1 ? 0 : Math.min(1, value + .004)), 80)
    return () => window.clearInterval(id)
  }, [playing])
  const current = useMemo(() => places[Math.min(places.length - 1, Math.round(progress * (places.length - 1)))], [places, progress])
  return <AppShell><ZouNavigationBar title="今天的路线"/><div className="trip-replay-page"><div className="replay-map"><RealRouteMap center={cityProfile.mapCenter} places={places} progress={progress} compact/></div><div className="replay-facts"><span>{current.time}</span><strong>{current.name}</strong><small>{Math.round(progress * 100)}% · 6.8 km</small></div><button className="replay-control" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause /> : <Play />}{playing ? '暂停回放' : '继续回放'}</button></div></AppShell>
}
