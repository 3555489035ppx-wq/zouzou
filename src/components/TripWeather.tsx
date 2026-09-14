import { useEffect, useState } from 'react'
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from 'lucide-react'
import { forecastWindow, getTripForecast, type TripForecast } from '../services/tripForecast'

function weatherAppearance(code: number) {
  if (code === 0) return { Icon: Sun, label: '晴' }
  if (code <= 2) return { Icon: CloudSun, label: '多云' }
  if (code === 3) return { Icon: Cloud, label: '阴' }
  if ([45, 48].includes(code)) return { Icon: CloudFog, label: '雾' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { Icon: CloudSnow, label: '雪' }
  if (code >= 95) return { Icon: CloudLightning, label: '雷雨' }
  if (code >= 61) return { Icon: CloudRain, label: '雨' }
  return { Icon: CloudDrizzle, label: '小雨' }
}

export function TripWeather({ city }: { city: string; dates: { start: string; end: string } | null }) {
  const [forecast, setForecast] = useState<TripForecast | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let disposed = false
    setError(false); setForecast(null)
    getTripForecast(city, attempt > 0).then(value => { if (!disposed) setForecast(value) })
      .catch(() => { if (!disposed) setError(true) })
    return () => { disposed = true }
  }, [city, attempt])
  const data = forecast?.city === city ? forecastWindow(forecast.days, null) : null
  return <section className="trip-weather" aria-label={`${city}当地天气`}>
    <header><h2><a href="https://open-meteo.com/" target="_blank" rel="noreferrer" title="天气数据来源：Open-Meteo">未来七天天气</a></h2><span>{city}</span></header>
    {data ? <>
      <ol style={{gridTemplateColumns:`repeat(${data.days.length}, minmax(0, 1fr))`}}>{data.days.map(day => {
        const { Icon, label } = weatherAppearance(day.code)
        return <li key={day.date}><time dateTime={day.date}>{Number(day.date.slice(5, 7))}.{Number(day.date.slice(8))}</time><Icon aria-label={label} /><span>{label}</span><strong>{day.min}°–{day.max}°</strong></li>
      })}</ol>
    </> : error ? <div className="trip-weather__unavailable"><Cloud aria-hidden="true" /><p>暂时无法获取天气</p><button onClick={() => setAttempt(value => value + 1)}>重试</button></div>
      : <p className="trip-weather__loading" role="status">正在获取当地天气…</p>}
  </section>
}
