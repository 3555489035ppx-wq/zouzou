import { describe, expect, it } from 'vitest'
import { createStartupMotion, STARTUP_DURATION_MS, STARTUP_FIRST_FRAME } from './startupMotion'

describe('Original Bot startup timeline', () => {
  it('reaches the same face after delayed frames as after continuous playback', () => {
    const regular = createStartupMotion()
    for (let time = 0; time < 3000; time += 16) regular(time)
    const delayed = createStartupMotion()
    expect(delayed(3000)).toEqual(regular(3000))
  })

  it('shares the HTML first frame and keeps the original two-eye renderer valid', () => {
    const sample = createStartupMotion()
    expect(sample(0).frame).toEqual(STARTUP_FIRST_FRAME)
    const states = new Set<string>()
    for (let time = 0; time <= STARTUP_DURATION_MS; time += 16) {
      const { state, frame } = sample(time)
      states.add(state)
      expect(frame.eyes).toHaveLength(2)
      expect(frame.arcs).toHaveLength(0)
      expect(frame.dots).toHaveLength(0)
      expect(frame.bodyAlpha).toBe(1)
      expect(JSON.stringify(frame)).not.toMatch(/NaN|Infinity/)
    }
    expect([...states]).toEqual(['idle', 'wink'])
  })
})
