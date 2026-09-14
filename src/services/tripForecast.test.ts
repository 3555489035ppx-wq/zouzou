import { describe, expect, it } from 'vitest'
import { forecastWindow, parseForecastDays } from './tripForecast'

describe('trip forecast authenticity', () => {
  it('does not turn null temperatures or missing weather codes into a sunny forecast', () => {
    const result = parseForecastDays({ daily: { time: ['2026-09-07', '2026-09-08', '2026-09-09'], weather_code: [null, 0, 61], temperature_2m_min: [20, null, 21.3], temperature_2m_max: [28, 29, 27.6] } })
    expect(result).toEqual([{ date: '2026-09-09', code: 61, min: 21, max: 28 }])
    expect(() => parseForecastDays({ daily: { time: ['2026-09-07'], weather_code: [null], temperature_2m_min: [null], temperature_2m_max: [null] } })).toThrow()
  })
  it('labels recent weather separately when the trip lies outside the forecast window', () => {
    const days = [{ date: '2026-09-07', code: 0, min: 20, max: 27 }, { date: '2026-09-08', code: 3, min: 21, max: 28 }]
    expect(forecastWindow(days, { start: '2026-09-24', end: '2026-10-02' })).toEqual({ days, isTripWeather: false })
    expect(forecastWindow(days, { start: '2026-09-08', end: '2026-09-10' })).toEqual({ days: [days[1]], isTripWeather: true })
  })
})
