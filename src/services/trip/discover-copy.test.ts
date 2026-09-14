import { afterEach, expect, it, vi } from 'vitest'
import { getRoute } from '../../demo-data/discover'
import { copyCuratedTrip, readSavedPlans } from './planner'

afterEach(() => vi.unstubAllGlobals())

it('keeps the Nanchang night walk in the evening when copied', () => {
  const values = new Map<string,string>()
  vi.stubGlobal('window', { dispatchEvent: vi.fn(), localStorage: {
    getItem: (key:string) => values.get(key) ?? null,
    setItem: (key:string,value:string) => values.set(key,value),
  } })
  const saved = copyCuratedTrip(getRoute('multiday-南昌-2-1')!, { date:'2026-09-30',partySize:1,copyId:'test-night-walk' })
  const nightNames=getRoute('multiday-南昌-2-1')!.pois.filter(poi=>poi.period==='晚间').map(poi=>poi.name)
  expect(nightNames.length).toBeGreaterThan(0)
  expect(Object.values(saved.days).flat().filter(stop=>nightNames.includes(stop.name)).every(stop=>stop.time>='18:00')).toBe(true)
  expect(saved.days['Day 1'][0].time).toBe(getRoute('multiday-南昌-2-1')!.pois[0].time)
})

it.each([1, 2, 3, 4])('preserves %i days, stop order, daily start and dates when saving a Discover guide', days => {
  const values = new Map<string, string>()
  vi.stubGlobal('window', { dispatchEvent: vi.fn(), localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } })
  const route = getRoute(`multiday-上海-${days}-1`)!
  const saved = copyCuratedTrip(route, { date: '2026-09-30', partySize: 2, copyId: `test-${days}` })
  expect(saved.intent.durationDays).toBe(days)
  expect(saved.nights).toBe(days - 1)
  expect(saved.intent.dates).toEqual({ start: '2026-09-30', end: days === 1 ? '2026-09-30' : `2026-10-0${days - 1}` })
  expect(Object.keys(saved.days)).toHaveLength(days)
  for (let day = 1; day <= days; day++) {
    const stops = saved.days[`Day ${day}`]
    expect(stops.map(stop => stop.name)).toEqual(route.pois.filter(poi => poi.day === day).map(poi => poi.name))
    expect(stops.map(stop=>stop.time)).toEqual(route.pois.filter(poi=>poi.day===day).map(poi=>poi.time))
    expect(stops[0].travelFromPreviousMinutes).toBe(0)
  }
  expect(readSavedPlans()?.[0].days).toEqual(saved.days)
})
