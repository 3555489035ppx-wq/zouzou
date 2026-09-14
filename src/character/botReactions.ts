import type { BotEngine } from '../private-assets/bloub/bot/engine'
import { EXPRESSION_BY_ID, type ExpressionId } from '../private-assets/bloub/bot/expressions'
import { STATE_BY_ID, type StateId } from '../private-assets/bloub/bot/states'

export type BloubTapVariant = { state: StateId; expression?: ExpressionId }

// Keep the original open-eye expressions and body transformations. Omit the
// slit-eye, squinting, wink and sleepy poses from touch interactions only.
export const BLOUB_TAP_VARIANTS: readonly BloubTapVariant[] = [
  { state: 'quatrefoil' },
  { state: 'idle', expression: 'attentif' },
  { state: 'idle', expression: 'surpris' },
  { state: 'idle', expression: 'excite' },
  { state: 'idle', expression: 'triste' },
  { state: 'idle', expression: 'effraye' },
  { state: 'idle', expression: 'curieux' },
  { state: 'thinking' },
  { state: 'wide' },
  { state: 'alert' },
  { state: 'notify' },
  { state: 'exclaim' },
  { state: 'egg' },
  { state: 'hexagon' },
  { state: 'play' },
  { state: 'swirl' },
  { state: 'orbit' },
  { state: 'burst' },
  { state: 'comet' },
]

// Shuffle a fresh deck after every round, including its first reaction. Avoid
// repeats at the round boundary as well as within a round.
export function createReactionDeck(random: () => number = Math.random) {
  let remaining: number[] = []
  let previous: number | undefined
  return () => {
    if (!remaining.length) {
      remaining = BLOUB_TAP_VARIANTS.map((_, index) => index)
      for (let index = remaining.length - 1; index > 0; index--) {
        const swap = Math.floor(random() * (index + 1))
        ;[remaining[index], remaining[swap]] = [remaining[swap]!, remaining[index]!]
      }
      if (remaining[0] === previous) [remaining[0], remaining[1]] = [remaining[1]!, remaining[0]!]
    }
    previous = remaining.shift()!
    return previous
  }
}

// Let orbit / burst / comet reassemble before returning to the resting face.
export const reactionDuration = (variant: number) =>
  Math.max(1200, (STATE_BY_ID.get(BLOUB_TAP_VARIANTS[variant]!.state)!.minDuration ?? 0) * 1000 + 100)

// An explicit neutral expression lets the original engine blend back from a
// reaction instead of abruptly dropping its expression override to null.
export const reactionExpression = (variant?: BloubTapVariant) =>
  EXPRESSION_BY_ID.get(variant?.expression ?? 'neutre')!

export const sampleReactionFrame = (engine: BotEngine, at: number, variant?: number) =>
  engine.sample(at, { blink: variant === undefined })
