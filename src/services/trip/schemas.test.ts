import { describe, expect, it } from 'vitest'
import { DEFAULT_SHANGHAI_PROMPT, generatePlans, understandTrip } from './planner'
import { parseGeneratedPlans, parseTripUnderstanding } from './schemas'

describe('trip runtime schemas', () => {
  it('accepts the deterministic understanding contract', () => {
    const understanding = understandTrip({ text: DEFAULT_SHANGHAI_PROMPT, media: [] })

    expect(parseTripUnderstanding(understanding)?.intent.destination).toBe('上海')
  })

  it('rejects malformed external understanding data', () => {
    expect(parseTripUnderstanding({ intent: { destination: '上海' } })).toBeNull()
  })

  it('accepts generated plans and rejects a corrupted stored plan', () => {
    const understanding = understandTrip({ text: DEFAULT_SHANGHAI_PROMPT, media: [] })
    const plans = generatePlans(understanding.intent)

    expect(parseGeneratedPlans(plans)?.length).toBe(3)
    expect(parseGeneratedPlans([{ ...plans[0], days: { 'Day 1': [{ ...plans[0].days['Day 1'][0], lng: 'bad' }] } }])).toBeNull()
  })
})
