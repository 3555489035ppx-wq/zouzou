import { useEffect, useId, useRef, useState } from 'react'
import { BotEngine, type BotFrame, type Look } from '../private-assets/bloub/bot/engine'
import { mixHex } from '../private-assets/bloub/bot/skins'
import type { StateId } from '../private-assets/bloub/bot/states'
import { DEMI_VIEWBOX, RAYON } from '../private-assets/bloub/bot/repere'
import type { BotState } from '../character/engine/motionEngine'

/**
 * Bloub is kept as a private local renderer. The geometry and state machine are
 * adapted from the MIT-licensed source snapshot in `_research/bloub`; xAI's
 * visual reference is not redistributed. This component only owns the React
 * bridge, while the mature morph engine remains source-compatible and pure.
 */

const stateMap: Record<BotState, StateId> = {
  idle: 'idle',
  listening: 'wide',
  reading: 'thinking',
  thinking: 'orbit',
  planning: 'orbit',
  updating: 'orbit',
  done: 'wink',
  success: 'notify',
  alert: 'alert',
  error: 'exclaim',
  walking: 'orbit',
  arriving: 'wink',
  waiting: 'idle',
  paused: 'idle',
  transport: 'orbit',
  completed: 'wink',
}

const mapState = (state: BotState): StateId => stateMap[state] ?? 'idle'

const frameFor = (engine: BotEngine, at: number) => engine.sample(at)

export const BloubBotSvg = ({ state = 'idle', reducedMotion = false, gaze = null }: { state?: BotState; reducedMotion?: boolean; gaze?: Look | null }) => {
  const rawId = useId()
  const uid = `bloub-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const timeRef = useRef(0)
  const engineRef = useRef<BotEngine | null>(null)
  if (!engineRef.current) engineRef.current = new BotEngine(RAYON, mapState(state))
  const [frame, setFrame] = useState<BotFrame>(() => frameFor(engineRef.current as BotEngine, 0))

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.setState(mapState(state), timeRef.current)
    setFrame(frameFor(engine, reducedMotion ? timeRef.current + 1 : timeRef.current))
  }, [state, reducedMotion])

  // Keep the gaze in the same deterministic engine as the state morph. This
  // makes pointer/target changes feel attentive without introducing a second
  // animation loop or jumping the eyes when the bot changes expression.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.setLook(gaze, timeRef.current)
    setFrame(frameFor(engine, reducedMotion ? timeRef.current + 1 : timeRef.current))
  }, [gaze, reducedMotion])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine || reducedMotion) {
      if (engine) setFrame(frameFor(engine, timeRef.current + 1))
      return
    }
    let raf = 0
    let previous = performance.now()
    const tick = (now: number) => {
      timeRef.current += Math.min(64, now - previous) / 1000
      previous = now
      setFrame(frameFor(engine, timeRef.current))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reducedMotion])

  const paper = 'var(--color-paper)'
  return (
    <svg className="bloub-bot-svg" viewBox={`${-DEMI_VIEWBOX} ${-DEMI_VIEWBOX} ${DEMI_VIEWBOX * 2} ${DEMI_VIEWBOX * 2}`} role="img" aria-label="走走角色">
      <defs>
        <mask id={`${uid}-mask`} maskUnits="userSpaceOnUse" x={-DEMI_VIEWBOX} y={-DEMI_VIEWBOX} width={DEMI_VIEWBOX * 2} height={DEMI_VIEWBOX * 2}>
          <path d={frame.bodyPath} fill="#fff" />
          {frame.eyes.map((eye, index) => <path key={index} d={eye.d} transform={eye.matrix} opacity={eye.alpha} fill="#000" />)}
          {frame.notch ? <circle cx={frame.notch.x} cy={frame.notch.y} r={frame.notch.r} fill="#000" /> : null}
        </mask>
        {frame.arcs.map((arc) => (
          <linearGradient key={arc.id} id={`${uid}-${arc.id}`} gradientUnits="userSpaceOnUse" x1={arc.grad.x1} y1={arc.grad.y1} x2={arc.grad.x2} y2={arc.grad.y2}>
            {arc.grad.stops.map((color, index) => <stop key={index} offset={index / Math.max(1, arc.grad.stops.length - 1)} stopColor={color} />)}
          </linearGradient>
        ))}
      </defs>

      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => arc.back ? <path key={`back-${arc.id}`} d={arc.back} stroke={`url(#${uid}-${arc.id})`} strokeWidth={arc.width} opacity={arc.opacity} /> : null)}
      </g>
      {frame.dotsBehind ? <g>{frame.dots.map((dot, index) => <BotDot key={`behind-${index}`} dot={dot} paper={paper} />)}</g> : null}
      <g opacity={frame.bodyAlpha}>
        <path d={frame.bodyPath} fill={paper} />
        <g mask={`url(#${uid}-mask)`}>
          <rect x={-DEMI_VIEWBOX} y={-DEMI_VIEWBOX} width={DEMI_VIEWBOX * 2} height={DEMI_VIEWBOX * 2} fill="currentColor" />
        </g>
      </g>
      {!frame.dotsBehind ? <g>{frame.dots.map((dot, index) => <BotDot key={`front-${index}`} dot={dot} paper={paper} />)}</g> : null}
      {frame.notif ? <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill="var(--color-bot-notification)" /> : null}
      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => arc.front ? <path key={`front-arc-${arc.id}`} d={arc.front} stroke={`url(#${uid}-${arc.id})`} strokeWidth={arc.width} opacity={arc.opacity} /> : null)}
      </g>
    </svg>
  )
}

type Dot = BotFrame['dots'][number]
const BotDot = ({ dot, paper }: { dot: Dot; paper: string }) => {
  const fill = dot.color ?? (dot.depth === undefined ? 'currentColor' : mixHex(paper.startsWith('var(') ? '#ffffff' : paper, '#0a0a0c', dot.depth))
  if (dot.d) return <path d={dot.d} transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${RAYON})`} fill={fill} opacity={dot.opacity} />
  return <circle cx={dot.x} cy={dot.y} r={dot.r} fill={fill} opacity={dot.opacity} />
}
