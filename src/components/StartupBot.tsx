import { useEffect, useRef } from 'react'
import { DEMI_VIEWBOX } from '../private-assets/bloub/bot/repere'
import { createStartupMotion, STARTUP_DURATION_MS, STARTUP_FIRST_FRAME } from '../character/startupMotion'

export function StartupBot() {
  const svgRef = useRef<SVGSVGElement>(null)
  const bodyRef = useRef<SVGPathElement>(null)
  const eyeRefs = useRef<(SVGPathElement | null)[]>([])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const intro = svg.closest('.startup-intro')
    const timeline = intro?.getAnimations().find(animation =>
      animation instanceof CSSAnimation && animation.animationName === 'startup-reveal-home')
    const sample = createStartupMotion()
    const started = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const elapsed = typeof timeline?.currentTime === 'number' ? timeline.currentTime : now - started
      const { frame, state } = sample(elapsed)
      // Three local SVG nodes update directly; React and the page layout do not
      // rerender for every facial frame. CSS owns only the single upward move.
      bodyRef.current?.setAttribute('d', frame.bodyPath)
      frame.eyes.forEach((eye, index) => {
        const path = eyeRefs.current[index]
        if (!path) return
        if (path.getAttribute('d') !== eye.d) path.setAttribute('d', eye.d)
        path.setAttribute('transform', eye.matrix)
        path.setAttribute('opacity', String(eye.alpha))
      })
      if (svg.dataset.botState !== state) svg.dataset.botState = state
      if (elapsed < STARTUP_DURATION_MS) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <svg ref={svgRef} className="startup-bot" data-bot-state="idle" viewBox={`${-DEMI_VIEWBOX} ${-DEMI_VIEWBOX} ${DEMI_VIEWBOX * 2} ${DEMI_VIEWBOX * 2}`} role="img" aria-label="走走向你打招呼">
    <path ref={bodyRef} d={STARTUP_FIRST_FRAME.bodyPath} fill="currentColor" />
    <g fill="var(--color-paper-soft)">
      {STARTUP_FIRST_FRAME.eyes.map((eye, index) => <path key={index} ref={path => { eyeRefs.current[index] = path }} d={eye.d} transform={eye.matrix} opacity={eye.alpha} />)}
    </g>
  </svg>
}
