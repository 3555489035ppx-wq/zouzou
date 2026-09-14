import { describe, expect, it } from 'vitest'
import { BotEngine } from '../private-assets/bloub/bot/engine'
import { STATE_BY_ID } from '../private-assets/bloub/bot/states'
import { BLOUB_TAP_VARIANTS, createReactionDeck, reactionDuration, reactionExpression, sampleReactionFrame } from './botReactions'

describe('Bot greeting reactions', () => {
  it('keeps visible eyes open through the blink schedule and state transition', () => {
    for (const [index, variant] of BLOUB_TAP_VARIANTS.entries()) {
      const engine = new BotEngine(100, 'idle', null, reactionExpression())
      engine.setState(variant.state, .7)
      engine.setExpression(reactionExpression(variant), .7)
      for (const at of [.8, 1.481, 1.6]) {
        const frame = sampleReactionFrame(engine, at, index)
        for (const eye of frame.eyes) {
          const matrix = eye.matrix.match(/-?\d+\.?\d*/g)!.map(Number)
          expect(Math.hypot(matrix[1]!, matrix[3]!)).toBeGreaterThan(.65)
        }
      }
      const def = STATE_BY_ID.get(variant.state)!
      for (const at of [0, .5, 1, 2, 2.6]) {
        const pose = def.pose(at)
        if (pose.eyeAlpha < .01) continue // Original faceless body transformations.
        const eyes = def.baseFace ? reactionExpression(variant).eyes : pose.eyes
        for (const eye of eyes) {
          expect(eye.h * eye.open).toBeGreaterThanOrEqual(.32)
          expect(eye.open).toBe(1)
        }
      }
    }
  })

  it('blends into and out of a greeting without an expression jump', () => {
    const engine = new BotEngine(100, 'idle', null, reactionExpression())
    const before = engine.sample(.4).eyes
    engine.setExpression(reactionExpression(BLOUB_TAP_VARIANTS[1]), .4)
    expect(engine.sample(.4).eyes).toEqual(before)
    const greeting = engine.sample(1.2).eyes
    engine.setExpression(reactionExpression(), 1.2)
    expect(engine.sample(1.2).eyes).toEqual(greeting)
    expect(engine.sample(2).eyes).not.toEqual(greeting)
  })

  it('preserves normal autonomous blinking outside a tap reaction', () => {
    const engine = new BotEngine()
    expect(sampleReactionFrame(engine, 1.481)).toEqual(engine.sample(1.481))
  })

  it('continues from the visible face when a second tap interrupts its morph', () => {
    const engine = new BotEngine(100, 'idle', null, reactionExpression())
    engine.setExpression(reactionExpression(BLOUB_TAP_VARIANTS[3]), .4)
    const interrupted = engine.sample(.48).eyes
    engine.setExpression(reactionExpression(BLOUB_TAP_VARIANTS[6]), .48)
    expect(engine.sample(.48).eyes).toEqual(interrupted)
  })

  it('reshuffles every round without repeats, including the round boundary', () => {
    let seed = 7
    const next = createReactionDeck(() => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646)
    const size = BLOUB_TAP_VARIANTS.length
    const rounds = Array.from({ length: 4 }, () => Array.from({ length: size }, () => next()))
    for (const round of rounds) expect(new Set(round).size).toBe(size)
    for (let index = 1; index < rounds.length; index++) {
      expect(rounds[index]).not.toEqual(rounds[index - 1])
      expect(rounds[index]![0]).not.toBe(rounds[index - 1]!.at(-1))
    }
    const anotherSession = createReactionDeck(() => .8)
    expect(Array.from({ length: size }, () => anotherSession())).not.toEqual(rounds[0])
  })

  it('lets authored transformations finish before the tap timer restores idle', () => {
    for (const [index, variant] of BLOUB_TAP_VARIANTS.entries()) {
      const minimum = STATE_BY_ID.get(variant.state)!.minDuration
      if (minimum) expect(reactionDuration(index)).toBeGreaterThan(minimum * 1000)
    }
  })
})
