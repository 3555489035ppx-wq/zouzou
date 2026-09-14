import { cityProfiles } from '../demo-data/cities'

export type ForecastDay = { date: string; code: number; min: number; max: number }
export type TripForecast = { city: string; days: ForecastDay[]; updatedAt: string }
const cache = new Map<string, { until: number; value: TripForecast }>()
const requests = new Map<string, Promise<TripForecast>>()

// Missing values must remain unavailable, never become 0 degrees or sunny days.
export function parseForecastDays(payload: unknown): ForecastDay[] {
  const daily = (payload as { daily?: Record<string, unknown> } | null)?.daily
  if (!daily || !Array.isArray(daily.time)) throw Error('天气数据暂不完整')
  const codes = daily.weather_code, mins = daily.temperature_2m_min, maxs = daily.temperature_2m_max
  if (!Array.isArray(codes) || !Array.isArray(mins) || !Array.isArray(maxs)) throw Error('天气数据暂不完整')
  const days = daily.time.flatMap((date, i) => {
    const code = codes[i], min = mins[i], max = maxs[i]
    return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      && typeof code === 'number' && Number.isFinite(code)
      && typeof min === 'number' && Number.isFinite(min) && typeof max === 'number' && Number.isFinite(max) && min <= max
      ? [{ date, code, min: Math.round(min), max: Math.round(max) }] : []
  })
  if (!days.length) throw Error('天气数据暂不完整')
  return days
}

export function forecastWindow(days: ForecastDay[], dates: { start: string; end: string } | null) {
  const tripDays = dates ? days.filter(day => day.date >= dates.start && day.date <= dates.end) : []
  return { days: (tripDays.length ? tripDays : days).slice(0, 7), isTripWeather: tripDays.length > 0 }
}

export async function getTripForecast(city: string, refresh = false): Promise<TripForecast> {
  const profile = cityProfiles[city]
  if (!profile) throw Error('该城市暂未接入天气')
  if (!refresh && (cache.get(city)?.until ?? 0) > Date.now()) return cache.get(city)!.value
  const pending = requests.get(city)
  if (pending) return pending
  const request = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const params = new URLSearchParams({
        latitude: String(profile.weather.latitude), longitude: String(profile.weather.longitude),
        daily: 'weather_code,temperature_2m_max,temperature_2m_min', forecast_days: '16', timezone: 'Asia/Shanghai',
      })
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal })
      if (!response.ok) throw Error('暂时无法获取天气')
      const value = { city, days: parseForecastDays(await response.json()), updatedAt: new Date().toISOString() }
      cache.set(city, { until: Date.now() + 10 * 60 * 1000, value })
      return value
    } finally { clearTimeout(timer) }
  })().finally(() => requests.delete(city))
  requests.set(city, request)
  return request
}
