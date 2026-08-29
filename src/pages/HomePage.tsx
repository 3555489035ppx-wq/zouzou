import { useEffect, useState } from 'react'
import { Bell, ChevronDown, CloudRain, CloudSnow, CloudSun, Sun, Wind } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { CityPicker, TripEntryIcon, ZouAvatar, ZouCard } from '../components/ui'
import { getDemoTripPlaces } from '../demo-data/cities'
import { useAppStore } from '../stores/appStore'
import { weatherService, type Weather } from '../services/weather'

const entries = [
  { type: 'travel' as const, title: '旅行', body: '定制你的完美行程', path: '/travel/new' },
  { type: 'weekend' as const, title: '周末', body: '探索附近的精彩', path: '/weekend' },
  { type: 'date' as const, title: '约会', body: '浪漫灵感与好去处', path: '/date' },
  { type: 'dining' as const, title: '聚餐', body: '发现美食与餐厅', path: '/dining' },
]

const localRecommendations: Record<string, { name: string; type: string; image: string }[]> = {
  上海: [
    { name: '武康路', type: '上午 City Walk', image: '/assets/wukang-road.jpg' },
    { name: '浦东美术馆', type: '雨天室内展览', image: '/assets/museum.jpg' },
    { name: '安福路咖啡', type: '四小时刚刚好', image: '/assets/coffee.jpg' },
  ],
  杭州: [
    { name: '西湖边', type: '慢慢走一圈', image: '/assets/weekend.jpg' },
    { name: '天目里', type: '展览与咖啡', image: '/assets/gallery.jpg' },
    { name: '良渚古城', type: '周末松弛半日', image: '/assets/garden.jpg' },
  ],
  苏州: [
    { name: '平江路', type: '园林与小店', image: '/assets/garden.jpg' },
    { name: '苏州博物馆', type: '雨天室内', image: '/assets/museum.jpg' },
    { name: '山塘街', type: '傍晚散步', image: '/assets/bund.jpg' },
  ],
}

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
  const tripMode = useAppStore((s) => s.tripMode)
  const tripCity = useAppStore((s) => s.tripCity)
  const [citiesOpen, setCitiesOpen] = useState(false)
  const [weather, setWeather] = useState<Weather | null>(null)
  const recommendations = localRecommendations[city] ?? localRecommendations['上海']
  const activeCity = tripCity ?? city
  const activePlaces = getDemoTripPlaces(activeCity, 'Day 1')
  const activeNext = activePlaces[1] ?? activePlaces[0]
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
    <header className="home-header"><button className="home-city" onClick={() => setCitiesOpen(true)}><strong>{city}</strong><ChevronDown /><span title={weather?.note ?? '正在读取实时天气'} aria-live="polite">{weather ? <WeatherIcon condition={weather.condition} /> : <CloudSun aria-hidden="true" />}{weatherText}</span></button><div className="home-header__actions"><button className="icon-button notification-button" aria-label="通知中心" onClick={() => navigate('/notifications')}><Bell /><span>3</span></button><button className="avatar-button" aria-label="打开我的主页" onClick={() => navigate('/profile')}><ZouAvatar src={avatar} name="小鹏" /></button></div></header>
    <section className="home-recommend" aria-labelledby="home-recommend-title"><h2 id="home-recommend-title">为你推荐</h2><span>从一次想走的路开始</span></section>
    <section className="entry-list" aria-label="创建场景">{entries.map((entry) => <ZouCard key={entry.title} className="entry-card" onClick={() => navigate(entry.path)}><span className="entry-card__icon"><TripEntryIcon type={entry.type} /></span><span><strong>{entry.title}</strong><small>{entry.body}</small></span><span className="entry-card__arrow">→</span></ZouCard>)}</section>
    <section className={`home-dynamic home-dynamic--${tripMode}`}><div><span className="soft-label">{tripMode === 'active' ? '正在进行' : tripMode === 'upcoming' ? '即将开始' : '准备开始'}</span><h2>{tripMode === 'active' ? `${activeCity} · Day 1` : tripMode === 'upcoming' ? `${activeCity} · 3天2晚` : '开始一次走走'}</h2><p>{tripMode === 'active' ? `下一站 · ${activeNext?.name ?? '下一站'} · ${activeNext?.time ?? '09:30'}` : tripMode === 'upcoming' ? '明天 09:00 出发' : '从一个想法开始，走出一条自己的路线'}</p></div><button onClick={() => navigate(tripMode === 'active' ? '/trips' : '/travel/new')}>{tripMode === 'active' ? '继续行程' : tripMode === 'upcoming' ? '查看行程' : '开始规划'}<span>→</span></button></section>
    <section className="home-local-recommendations" aria-labelledby="home-local-title"><header><h2 id="home-local-title">在{city}，你可能喜欢</h2><span>和你所在的城市一起更新</span></header><div className="home-local-list">{recommendations.map((item) => <button key={item.name} onClick={() => navigate('/community')}><img src={item.image} alt="" width={52} height={50} /><span><strong>{item.name}</strong><small>{item.type}</small></span><span aria-hidden="true">→</span></button>)}</div></section>
    <CityPicker open={citiesOpen} onClose={() => setCitiesOpen(false)} />
  </div></AppShell>
}
