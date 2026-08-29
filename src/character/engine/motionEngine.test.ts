import { describe, expect, it } from 'vitest'
import { MotionEngine } from './motionEngine'

describe('MotionEngine', () => {
  it('samples the same state and time deterministically', () => {
    const engine = new MotionEngine('walking')
    expect(engine.sample(0.48)).toEqual(engine.sample(0.48))
  })

  it('continues from the visible pose when interrupted', () => {
    const engine = new MotionEngine('idle')
    engine.setState('planning', 0)
    const before = engine.sample(0.12)
    engine.setState('error', 0.12)
    const after = engine.sample(0.12)
    expect(after.rotate).toBeCloseTo(before.rotate, 6)
    expect(after.orbit).toBeCloseTo(before.orbit, 6)
  })
})
