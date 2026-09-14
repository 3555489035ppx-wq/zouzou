import { BotEngine, type Look } from '../private-assets/bloub/bot/engine'
import { RAYON } from '../private-assets/bloub/bot/repere'
import type { StateId } from '../private-assets/bloub/bot/states'
import { EXPRESSION_BY_ID, type ExpressionId } from '../private-assets/bloub/bot/expressions'

export const STARTUP_DURATION_MS = 3400
export const STARTUP_HOME_PREPARE_MS = 2350

const centeredLook: Look = { yaw: 0, pitch: 0, mix: 1, spin: 0, wander: 0 }
const cues: readonly { at: number; state: StateId; expression: ExpressionId; look: Look }[] = [
  { at: .65, state: 'idle', expression: 'attentif', look: { ...centeredLook, yaw: -4 } },
  { at: 1.65, state: 'wink', expression: 'neutre', look: centeredLook },
  { at: 2.1, state: 'idle', expression: 'neutre', look: centeredLook },
]

// Reuse the original measured faces and morphs. Cue timestamps belong to the
// same clock as the CSS entrance, so a late frame never delays the next gesture.
export function createStartupMotion() {
  const engine = new BotEngine(RAYON, 'idle')
  engine.setExpression(EXPRESSION_BY_ID.get('neutre')!, 0)
  engine.setLook({ ...centeredLook, pitch: -3 }, 0)
  let cueIndex = 0
  let state: StateId = 'idle'
  return (elapsedMs: number) => {
    const now = Math.max(0, elapsedMs) / 1000
    while (cueIndex < cues.length && now >= cues[cueIndex]!.at) {
      const cue = cues[cueIndex++]!
      engine.setState(cue.state, cue.at)
      engine.setExpression(EXPRESSION_BY_ID.get(cue.expression)!, cue.at)
      engine.setLook(cue.look, cue.at)
      state = cue.state
    }
    // The authored wink is the greeting; don't layer a second automatic blink.
    return { frame: engine.sample(now, { blink: false }), state }
  }
}

export const STARTUP_FIRST_FRAME = createStartupMotion()(0).frame
