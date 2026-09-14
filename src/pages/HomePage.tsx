import { useEffect, useState } from 'react'
import { ArrowRight, Bell, ChevronDown, ChevronRight, CloudRain, CloudSnow, CloudSun, Sun, Wind } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { CityPicker, ZouAvatar, ZouButton, ZouMotionBot } from '../components/ui'
import { getHomeGuideRecommendations } from '../demo-data/discover'

import { useAppStore } from '../stores/appStore'
import { useSavedTrips } from '../components/TripLibrary'
import { tripSummary } from '../services/trip/summary'
import { weatherService, type Weather } from '../services/weather'
import './HomePage.css'

const WeatherIcon = ({ condition }: { condition: Weather['condition'] }) => {
  if (condition === 'sunny') return <Sun aria-hidden="true" />
  if (condition === 'rain') return <CloudRain aria-hidden="true" />
  if (condition === 'snow') return <CloudSnow aria-hidden="true" />
  if (condition === 'windy') return <Wind aria-hidden="true" />
  return <CloudSun aria-hidden="true" />
}

export const HomePage = () => {
  const navigate = useNavigate()
  const city = useAppStore((s) => s.city)
  const avatar = useAppStore((s) => s.avatar)
  const activeId = useAppStore(s=>s.activeRouteId)
  const savedTrips=useSavedTrips()
  const activeTrip=savedTrips.find(plan=>plan.tripId===activeId && ['active','paused','planned'].includes(plan.status??'planned')) ?? savedTrips.find(plan=>['active','paused'].includes(plan.status??'')) ?? savedTrips.find(plan=>(plan.status??'planned')==='planned')
  const summary=activeTrip?tripSummary(activeTrip):null
  const [citiesOpen, setCitiesOpen] = useState(false)
  const [weather, setWeather] = useState<Weather | null>(null)
  const recommendations = getHomeGuideRecommendations(city)
  useEffect(() => {
    let cancelled = false
    setWeather(null)
    weatherService.getWeather(city).then((value) => {
      if (!cancelled) setWeather(value)
    })
    return () => { cancelled = true }
  }, [city])

  const weatherText = weather ? `${weather.temperature}°C · ${weather.label}` : '正在读取天气…'
  return <AppShell showTabBar><div className="home-page">
    <header className="home-header"><button className="home-city" onClick={() => setCitiesOpen(true)}><strong>{city}</strong><ChevronDown /><span title={weather?.note ?? '正在读取实时天气'} aria-live="polite">{weather ? <WeatherIcon condition={weather.condition} /> : <CloudSun aria-hidden="true" />}{weatherText}</span></button><div className="home-header__actions"><button className="icon-button notification-button" aria-label="通知中心" onClick={() => navigate('/notifications')}><Bell /></button><button className="avatar-button" aria-label="打开我的主页" onClick={() => navigate('/profile')}><ZouAvatar src={avatar} name="小鹏" /></button></div></header>
    <section className="home-travel-card" aria-labelledby="home-travel-title">
      <div className="home-travel-card__intro">
        <div className="home-travel-card__copy"><h1 id="home-travel-title"><span>想去哪儿</span><span>走走？</span></h1></div>
        <ZouMotionBot size="lg" interactive label="和走走打个招呼" />
      </div>
      <ZouButton onClick={() => navigate('/travel/new')}>开始规划旅行<ArrowRight aria-hidden="true" /></ZouButton>
    </section>
    {activeTrip && summary ? <button className="home-resume" onClick={() => navigate(`/trips/${activeTrip.tripId}`)}>
      <span className="home-resume__header"><span>继续行程</span><span className="home-resume__status">{summary.status}</span></span>
      <span className="home-resume__body"><span className="home-resume__copy"><strong>{summary.title}</strong><small>{summary.dates}</small></span><ChevronRight aria-hidden="true" /></span>
    </button> : null}
    <section className="home-guides" aria-labelledby="home-guides-title">
      <header className="home-guides__header"><h2 id="home-guides-title">在{city}，你可能喜欢</h2><button onClick={() => navigate(`/discover/cities/${encodeURIComponent(city)}`)} aria-label={`查看${city}全部攻略`}>全部<ChevronRight aria-hidden="true" /></button></header>
      <div className="home-guide-card">{recommendations.map(item => <button className="home-guide-card__row" key={item.id} onClick={() => navigate(`/discover/${encodeURIComponent(item.id)}`)}><img src={item.cover} alt="" width={52} height={60} loading="lazy" /><span className="home-guide-card__copy"><strong>{item.title}</strong><small>{item.duration} · {item.poiCount}个地点</small></span><ChevronRight aria-hidden="true" /></button>)}</div>
    </section>
    <CityPicker open={citiesOpen} onClose={() => setCitiesOpen(false)} />
  </div></AppShell>
}
