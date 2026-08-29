import { getCityProfile } from '../demo-data/cities'

export type WeatherCondition = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'windy'

export type Weather = {
  condition: WeatherCondition
  label: string
  temperature: number
  note: string
  updatedAt: string
  source: 'open-meteo' | 'fallback'
}

export interface WeatherService {
  getWeather(city: string, day?: string): Promise<Weather>
}

type WeatherResponse = {
  current?: {
    temperature_2m?: unknown
    weather_code?: unknown
    wind_speed_10m?: unknown
    time?: unknown
  }
}

const CACHE_TTL = 10 * 60 * 1000
const weatherCache = new Map<string, { expiresAt: number; value: Weather }>()
const pendingRequests = new Map<string, Promise<Weather>>()
// Keep the private prototype visually deterministic. Opt into live network
// weather only when the operator explicitly sets VITE_LIVE_WEATHER=1.
const liveWeatherEnabled = import.meta.env.VITE_LIVE_WEATHER === '1'

const weatherLabels: Record<WeatherCondition, string> = {
  sunny: '晴',
  cloudy: '多云',
  rain: '有雨',
  snow: '降雪',
  windy: '有风',
}

function conditionFromWmoCode(code: number): WeatherCondition {
  if (code === 0) return 'sunny'
  if ([1, 2, 3, 45, 48].includes(code)) return 'cloudy'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return 'rain'
  return 'windy'
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error('天气响应格式错误')
  return value as Record<string, unknown>
}

function fallbackWeather(city: string): Weather {
  return {
    condition: 'cloudy',
    label: weatherLabels.cloudy,
    temperature: 26,
    note: `${city}实时天气暂时不可用，当前显示演示数据。`,
    updatedAt: new Date().toISOString(),
    source: 'fallback',
  }
}

async function fetchCurrentWeather(city: string): Promise<Weather> {
  const { latitude, longitude } = getCityProfile(city).weather
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 7000)
  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'temperature_2m,weather_code,wind_speed_10m',
      timezone: 'auto',
    })
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`天气请求失败：${response.status}`)

    const payload = asRecord(await response.json()) as WeatherResponse
    const current = asRecord(payload.current)
    const temperature = Number(current.temperature_2m)
    const code = Number(current.weather_code)
    const windSpeed = Number(current.wind_speed_10m)
    if (!Number.isFinite(temperature) || !Number.isFinite(code)) throw new Error('天气数据缺少必要字段')

    const condition = conditionFromWmoCode(code)
    return {
      condition,
      label: weatherLabels[condition],
      temperature: Math.round(temperature),
      note: Number.isFinite(windSpeed) && windSpeed >= 28 ? '风力偏大，步行时留意体感。' : '实时天气已更新，适合按当前节奏安排路线。',
      updatedAt: typeof current.time === 'string' ? current.time : new Date().toISOString(),
      source: 'open-meteo',
    }
  } finally {
    window.clearTimeout(timeout)
  }
}

class OpenMeteoWeatherAdapter implements WeatherService {
  async getWeather(city: string, _day?: string): Promise<Weather> {
    const cached = weatherCache.get(city)
    if (cached && cached.expiresAt > Date.now()) return cached.value

    if (!liveWeatherEnabled) {
      const value = fallbackWeather(city)
      weatherCache.set(city, { expiresAt: Date.now() + CACHE_TTL, value })
      return value
    }

    const existing = pendingRequests.get(city)
    if (existing) return existing

    const request = fetchCurrentWeather(city)
      .catch(() => fallbackWeather(city))
      .then((value) => {
        weatherCache.set(city, { expiresAt: Date.now() + CACHE_TTL, value })
        return value
      })
      .finally(() => pendingRequests.delete(city))

    pendingRequests.set(city, request)
    return request
  }
}

export const weatherService: WeatherService = new OpenMeteoWeatherAdapter()
