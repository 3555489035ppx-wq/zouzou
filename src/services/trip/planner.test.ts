import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHANGHAI_PROMPT,
  generatePlans,
  replacePlanPlace,
  understandTrip,
} from './planner'

describe('Shanghai itinerary planner', () => {
  it('extracts the complete demo trip instead of returning fixed values', () => {
    const result = understandTrip({ text: DEFAULT_SHANGHAI_PROMPT, media: [] })

    expect(result.intent.destination).toBe('上海')
    expect(result.intent.dates).toEqual({ start: '2026-09-18', end: '2026-09-20' })
    expect(result.intent.arrivalTime).toBe('10:30')
    expect(result.intent.departureTime).toBe('18:30')
    expect(result.intent.budget).toBe(4000)
    expect(result.intent.partySize).toBe(2)
    expect(result.intent.pace).toBe('relaxed')
    expect(result.intent.mustVisit).toEqual(expect.arrayContaining(['武康路', '安福路', '展览', '外滩']))
    expect(result.intent.missing).toEqual([])
  })

  it('flags missing anchors before claiming a trip is executable', () => {
    const result = understandTrip({ text: '我想去上海三天，预算 2000，想看展和喝咖啡。', media: [] })

    expect(result.intent.missing).toEqual(expect.arrayContaining(['具体出行日期', '到达时间和地点', '返程时间和地点', '酒店位置']))
  })

  it('creates three variants that pass deterministic schedule checks', () => {
    const understanding = understandTrip({ text: DEFAULT_SHANGHAI_PROMPT, media: [] })
    const generated = generatePlans(understanding.intent)

    expect(generated).toHaveLength(3)
    expect(generated.every((plan) => plan.validation.passed)).toBe(true)
    expect(generated[0].days['Day 1'].map((stop) => stop.name)).toContain('武康路')
    expect(generated[0].days['Day 2'].find((stop) => stop.name === '上海博物馆东馆')?.opening?.from).toBe('10:00')
    expect(generated.every((plan) => plan.budget <= 4000)).toBe(true)
  })

  it('replaces one stop while preserving the rest of the route', () => {
    const understanding = understandTrip({ text: DEFAULT_SHANGHAI_PROMPT, media: [] })
    const original = generatePlans(understanding.intent)[0]
    const updated = replacePlanPlace(original, 'wukang-cafe', '衡山和集')

    expect(updated.days['Day 1'].find((stop) => stop.id === 'wukang-cafe')?.name).toBe('衡山和集')
    expect(updated.days['Day 1'].find((stop) => stop.id === 'wukang-road')?.name).toBe('武康路')
    expect(updated.validation.passed).toBe(true)
  })
})
