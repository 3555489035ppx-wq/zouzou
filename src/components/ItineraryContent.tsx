import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BedDouble, Camera, ChevronRight, Coffee, MapPin, Pencil, TrainFront, Utensils } from 'lucide-react'
import { formatTravelDuration } from '../design-system/format'
import { tripSummary } from '../services/trip/summary'
import type { GeneratedPlan, PlannedStop } from '../services/trip/planner'
import { useAppStore } from '../stores/appStore'
import { JourneyPlaceSheet } from './JourneyPlaceSheet'
import { TripWeather } from './TripWeather'

function stopIcon(type: string) {
  if (/餐|小吃|美食/.test(type)) return Utensils
  if (/咖啡|休息/.test(type)) return Coffee
  if (/住宿|退房|行李/.test(type)) return BedDouble
  if (/到达|返程|交通/.test(type)) return TrainFront
  if (/景|展/.test(type)) return Camera
  return MapPin
}
function dateLabel(start: string | undefined, index: number) {
  if (!start) return '日期待确认'
  const date = new Date(`${start}T12:00:00+08:00`)
  date.setUTCDate(date.getUTCDate() + index)
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Shanghai' }).format(date)
}
function stopNote(stop: PlannedStop) {
  if (!stop.note) return ''
  const menu = stop.note.match(/可点：([^\s。]+)/)?.[1]?.split('、').filter(item => !/社区小吃|苍蝇小馆|体验|家常菜/.test(item)).join('、')
  return menu ? `可以尝尝 ${menu}` : stop.note.split(/核心看点：|地址：|推荐门店：|可点：/)[0].trim()
}

/** One itinerary presentation for generated options and saved trips; never persists data. */
export function ItineraryContent({ plan, onEdit, onReplace, statusMessage = '', children }: { plan: GeneratedPlan; onEdit: () => void; onReplace?: (stop: PlannedStop) => void; statusMessage?: string; children?: ReactNode }) {
  const id = plan.tripId ?? plan.optionId ?? plan.id
  const summary = tripSummary(plan)
  const dayEntries = Object.entries(plan.days)
  const [selectedDay, setSelectedDay] = useState('overview')
  const [placeSheet, setPlaceSheet] = useState<{ place: PlannedStop; day: string } | null>(null)
  const content = useRef<HTMLElement>(null)
  const dayNav = useRef<HTMLElement>(null)
  const scrollRoot = useRef<HTMLElement | null>(null)
  const scrollTarget = useRef<{ day: string; until: number } | null>(null)
  const reducedMotion = useAppStore(state => state.reducedMotion)
  useEffect(() => {
    setSelectedDay('overview'); scrollTarget.current = null
    const frame = requestAnimationFrame(() => scrollRoot.current?.scrollTo({ top: 0, behavior: 'instant' }))
    return () => cancelAnimationFrame(frame)
  }, [id])
  // Embedded phones scroll .app-page; normal browser views scroll .app-shell.
  // Read positions once per frame and render only when the active day changes.
  useEffect(() => {
    const main = content.current, nav = dayNav.current
    if (!main || !nav) return
    const shell = main.closest<HTMLElement>('.app-shell')!
    const root = shell.classList.contains('is-embedded') ? main.closest<HTMLElement>('.app-page')! : shell
    scrollRoot.current = root
    let frame = 0
    const update = () => {
      frame = 0
      const boundary = nav.getBoundingClientRect().bottom + 24
      let current = 'overview'
      for (const section of main.querySelectorAll<HTMLElement>('[data-itinerary-day]')) {
        if (section.getBoundingClientRect().top <= boundary) current = section.dataset.itineraryDay!
      }
      if (scrollTarget.current) {
        if (scrollTarget.current.day === current || performance.now() > scrollTarget.current.until) scrollTarget.current = null
        else return
      }
      setSelectedDay(value => value === current ? value : current)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    const cancelTarget = () => { scrollTarget.current = null }
    root.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('touchstart', cancelTarget, { passive: true })
    root.addEventListener('wheel', cancelTarget, { passive: true })
    const initial = requestAnimationFrame(update)
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(initial); root.removeEventListener('scroll', onScroll); root.removeEventListener('touchstart', cancelTarget); root.removeEventListener('wheel', cancelTarget) }
  }, [id, plan?.days])
  useEffect(() => {
    const nav = dayNav.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!nav || !active) return
    const left = active.offsetLeft - nav.offsetLeft
    if (left < nav.scrollLeft || left + active.offsetWidth > nav.scrollLeft + nav.clientWidth) {
      nav.scrollTo({ left: Math.max(0, left - (nav.clientWidth - active.offsetWidth) / 2), behavior: 'instant' })
    }
  }, [selectedDay])
  const jumpToDay = (day: string) => {
    const root = scrollRoot.current, nav = dayNav.current
    if (!root || !nav) return
    const section = [...(content.current?.querySelectorAll<HTMLElement>('[data-itinerary-day]') ?? [])].find(node => node.dataset.itineraryDay === day)
    const inset = parseFloat(getComputedStyle(nav).top) + nav.offsetHeight + 12
    const top = day === 'overview' ? 0 : section ? root.scrollTop + section.getBoundingClientRect().top - root.getBoundingClientRect().top - inset : root.scrollTop
    scrollTarget.current = { day, until: performance.now() + 1200 }
    setSelectedDay(day)
    root.scrollTo({ top, behavior: reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  return <><main className="itinerary-page" ref={content}>
        <header className="itinerary-intro"><div><h1>{summary.title}</h1><p>{plan.dates ? `${plan.dates.start.replaceAll('-', '.')} — ${plan.dates.end.slice(5).replace('-', '.')}` : '日期待确认'}<span>·</span>{plan.partySize}人</p></div><button className="itinerary-edit icon-button" aria-label="调整日程" onClick={onEdit}><Pencil /></button></header>
        <nav className="itinerary-days" aria-label="行程日期" ref={dayNav}>
          <button aria-current={selectedDay === 'overview' ? 'true' : undefined} onClick={() => jumpToDay('overview')}>总览</button>
          {dayEntries.map(([day], index) => <button key={day} aria-current={selectedDay === day ? 'true' : undefined} onClick={() => jumpToDay(day)}>Day {index + 1}</button>)}
        </nav>
        <div className="itinerary-overview">
          <TripWeather city={plan.city} dates={plan.dates} />{statusMessage ? <p className="itinerary-update" role="status">{statusMessage}</p> : null}</div>
        {dayEntries.map(([day, stops], index) => <section className="itinerary-day" key={day} data-itinerary-day={day} aria-label={`${day}全部安排`}>
          <header><h2>Day {index + 1}</h2><p>{dateLabel(plan.dates?.start, index)}</p></header>
          <ol className="itinerary-timeline">{stops.map((stop, stopIndex) => {
            const Icon = stopIcon(stop.type)
            const meal = /早餐|午餐|晚餐|本地小吃/.test(stop.type)
            return <li key={stop.id}>
              {stopIndex > 0 ? <div className="itinerary-transfer"><span aria-hidden="true" /><p>{stop.transport || `转场预留 ${stop.travelFromPreviousMinutes} 分钟`}</p></div> : null}
              <div className="itinerary-stop"><span className="itinerary-stop__icon"><Icon aria-hidden="true" /></span>
                <button className="itinerary-stop__card" onClick={() => setPlaceSheet({ place: stop, day })} aria-label={`查看${stop.name}`}>
                  <span className="itinerary-stop__meta"><span>{/-hotel-day-\d+$/.test(stop.id) ? '酒店出发准备' : stop.type}{meal && !stop.pendingVenue && !stop.fixed ? ' · 走走安排' : ''}</span><time>{stop.time}</time></span>
                  <span className="itinerary-stop__title">{stop.name}<ChevronRight aria-hidden="true" /></span>
                  {stopNote(stop) ? <span className="itinerary-stop__note">{stopNote(stop)}</span> : null}
                  <span className="itinerary-stop__footer"><span>{formatTravelDuration(stop.stay)}</span>{meal ? <span>{stop.priceState === 'unknown' ? '费用待确认' : `参考 ¥${stop.budget}/人`}</span> : null}</span>
                </button>
              </div>
            </li>
          })}</ol>
          {!stops.length ? <p className="itinerary-empty">这一天还没有安排，可在“调整日程”中添加。</p> : null}
        </section>)}
        {children}
        <p className="itinerary-ending">这一程，慢慢走。</p>
    </main>
    <JourneyPlaceSheet open={Boolean(placeSheet)} onClose={() => setPlaceSheet(null)} place={placeSheet?.place ?? null} city={plan.city} journeyId={id} dayId={placeSheet?.day}
      sourceUrl={plan.knowledge.items.find(item=>item.name===placeSheet?.place.name)?.source.url}
      onReplace={onReplace && placeSheet && (!placeSheet.place.fixed || /住宿|退房|取行李/.test(placeSheet.place.type)) ? () => {onReplace(placeSheet.place);setPlaceSheet(null)} : undefined} />
  </>
}
