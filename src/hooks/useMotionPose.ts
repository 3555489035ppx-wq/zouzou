import { useEffect, useRef, useState } from 'react'
import { MotionEngine, type BotPose, type BotState } from '../character/engine/motionEngine'

export const useMotionPose = (state: BotState, reducedMotion: boolean) => {
  const engineRef = useRef(new MotionEngine(state))
  const timeRef = useRef(0)
  const [pose, setPose] = useState<BotPose>(() => engineRef.current.sample(0))

  useEffect(() => {
    engineRef.current.setState(state, timeRef.current)
  }, [state])

  useEffect(() => {
    if (reducedMotion) {
      setPose(engineRef.current.sample(timeRef.current + 1))
      return
    }
    let raf = 0
    let previous = performance.now()
    const tick = (now: number) => {
      const delta = Math.min(64, now - previous) / 1000
      previous = now
      timeRef.current += delta
      setPose(engineRef.current.sample(timeRef.current))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reducedMotion])

  return pose
}
