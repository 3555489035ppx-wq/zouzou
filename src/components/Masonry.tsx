import { Children, useLayoutEffect, useRef, type ReactNode } from 'react'

/** DOM stays in source order; each measured card joins the shorter column. */
export function Masonry({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    let frame = 0
    const layout = () => {
      const gap = 12, width = root.clientWidth
      const columns = width < parseFloat(getComputedStyle(document.documentElement).fontSize) * 18 ? 1 : 2
      const cardWidth = (width - gap * (columns - 1)) / columns
      const heights = Array(columns).fill(0) as number[]
      for (const card of Array.from(root.children) as HTMLElement[]) {
        card.style.width = `${cardWidth}px`
        const column = heights.indexOf(Math.min(...heights))
        card.style.position = 'absolute'
        card.style.left = `${column * (cardWidth + gap)}px`
        card.style.top = `${heights[column]}px`
        heights[column] += card.getBoundingClientRect().height + gap
      }
      root.style.height = `${Math.max(0, ...heights) - (root.children.length ? gap : 0)}px`
      root.dataset.columns = String(columns)
    }
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(layout) })
    observer.observe(root)
    for (const child of root.children) observer.observe(child)
    layout()
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [children])
  return <div ref={ref} className={`masonry ${className}`}>{Children.map(children, child => <div className="masonry__item">{child}</div>)}</div>
}
