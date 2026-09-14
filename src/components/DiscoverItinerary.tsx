import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ChevronRight, MapPin, Utensils } from 'lucide-react'
import type { Route } from '../demo-data/discover'
import type { Place } from '../demo-data/trips'
import { cityKnowledge } from '../services/trip/cityKnowledge'
import { cityPlaceDetails } from '../services/trip/cityPlaceDetails'
import { formatTravelDuration } from '../design-system/format'
import { OpenRouteMapButton } from './MapLauncher'
import { getLocalGuideContext, loadClientGuideContext, subscribeClientGuideContext } from '../services/trip/localGuides'
import { placesMatch } from '../services/journey-images/presentation'

export function DiscoverItinerary({ route, places, onPlace }: { route: Route; places: Place[]; onPlace: (place: Place) => void }) {
  const [selectedDay, setSelectedDay] = useState(0)
  const rootRef = useRef<HTMLElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const communityQuery = route.pois.map(poi => poi.name).join(' ')
  const [communityRevision, setCommunityRevision] = useState(0)
  const community = useMemo(() => getLocalGuideContext(route.cityId, communityQuery), [route.cityId, communityQuery, communityRevision])
  const communityStatus = 'status' in community ? community.status : 'ready'
  useEffect(() => {
    const controller = new AbortController()
    const refresh = () => {
      if (!controller.signal.aborted) setCommunityRevision(revision => revision + 1)
    }
    const unsubscribe = subscribeClientGuideContext(refresh)
    // Re-read after subscribing in case the cache changed between render and effect.
    refresh()
    void loadClientGuideContext(route.cityId, communityQuery, controller.signal).then(refresh, refresh)
    return () => {
      unsubscribe()
      controller.abort()
    }
  }, [route.cityId, communityQuery])
  const days = Array.from({ length: route.dayCount ?? 1 }, (_, index) => ({
    number: index + 1,
    stops: places.filter((_, i) => (route.pois[i].day ?? 1) === index + 1),
  }))
  useEffect(() => {
    const root = rootRef.current
    const shell = root?.closest<HTMLElement>('.app-shell')
    if (!root || !shell) return
    let frame = 0
    const update = () => {
      frame = 0
      const top = shell.getBoundingClientRect().top
      const headerHeight = shell.querySelector('.discovery-guide__nav')?.getBoundingClientRect().height ?? 55
      const threshold = top + headerHeight + (navRef.current?.getBoundingClientRect().height ?? 64) + 32
      let day = 0
      for (const section of root.querySelectorAll<HTMLElement>('[data-guide-day]')) {
        if (section.getBoundingClientRect().top <= threshold) day = Number(section.dataset.guideDay)
      }
      setSelectedDay(day)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    shell.addEventListener('scroll', onScroll, {passive:true})
    const observer = new ResizeObserver(onScroll)
    observer.observe(root)
    onScroll()
    return () => { shell.removeEventListener('scroll', onScroll); observer.disconnect(); cancelAnimationFrame(frame) }
  }, [route.id])
  const jumpTo = (day: number) => {
    const shell = rootRef.current?.closest<HTMLElement>('.app-shell')
    const target = day === 0 ? shell?.querySelector('.discovery-guide__intro') : rootRef.current?.querySelector(`[data-guide-day="${day}"]`)
    if (!shell || !target) return
    const headerHeight = shell.querySelector('.discovery-guide__nav')?.getBoundingClientRect().height ?? 55
    const offset = headerHeight + (day ? navRef.current?.getBoundingClientRect().height ?? 64 : 0) + 12
    shell.scrollTo({top:shell.scrollTop + target.getBoundingClientRect().top - shell.getBoundingClientRect().top - offset, behavior:'auto'})
    setSelectedDay(day)
  }
  return <section ref={rootRef} className="discover-itinerary" aria-label="具体行程">
    <div className="discover-itinerary__heading"><h2>每天怎么走</h2><span>{days.length}天 · {places.length}站</span></div>
    {communityStatus === 'loading' && <p role="status">正在加载相关社区攻略…</p>}
    {communityStatus === 'unavailable' && <p role="status">社区攻略暂不可用，当前行程仍可查看。</p>}
    <nav ref={navRef} className="discover-itinerary__days" aria-label="攻略天数">
      <button aria-current={selectedDay === 0 ? 'true' : undefined} onClick={() => jumpTo(0)}>总览</button>
      {days.map(day => <button key={day.number} aria-current={selectedDay === day.number ? 'true' : undefined} onClick={() => jumpTo(day.number)}>第{day.number}天</button>)}
    </nav>
    {days.map(day => {
      const areas = [...new Set(day.stops.map(stop => route.pois.find(poi => poi.id === stop.id)?.area).filter(Boolean))]
      const dining = day.stops.filter(stop => /餐|小吃/.test(stop.type))
      const references = community.candidates.filter(guide => guide.city === route.cityId && guide.research && guide.research.readLevel !== 'search-metadata' && guide.placeHints.some(name => day.stops.some(stop => placesMatch(name, stop.name)))).slice(0, 2)
      const foods = [...new Set(references.flatMap(guide => guide.foodHints ?? []))].slice(0, 6)
      const experiences = [...new Set(references.flatMap(guide => guide.localExperienceHints ?? []))].slice(0, 4)
      return <section className="discover-day" data-guide-day={day.number} key={day.number} aria-label={`第${day.number}天全部安排`}>
        <header className="discover-day__header"><div><h3>第{day.number}天</h3><p>{areas.join(' · ') || route.cityId} · {day.stops.length}站</p></div><OpenRouteMapButton places={day.stops} city={route.cityId} label="看路线" /></header>
        <ol className="discover-day__timeline">{day.stops.map((stop, index) => {
          const poi = route.pois.find(poi => poi.id === stop.id)!
          const knowledge = cityKnowledge[route.cityId]?.items.find(item => item.name === stop.name)
          const detail = cityPlaceDetails[stop.name]
          const meal = /餐|小吃/.test(stop.type)
          const Icon = meal ? Utensils : /景/.test(stop.type) ? Camera : MapPin
          const summary = detail?.highlights || (knowledge?.menuHighlights?.length ? `可以尝尝：${knowledge.menuHighlights.join('、')}` : stop.note?.split(/核心看点：|建议逛法：/)[0])
          return <li className="discover-stop" key={stop.id}>
            <span className="discover-stop__number" aria-hidden="true">{index + 1}</span><div className="discover-stop__content">
              <button className="discover-stop__card" onClick={() => onPlace(stop)} aria-label={`查看${stop.name}`}>
                <span className="discover-stop__meta"><span><Icon aria-hidden="true" />{poi.period && !meal ? `${poi.period} · ` : ''}{stop.type}</span><time>{stop.time}</time></span>
                <span className="discover-stop__title">{stop.name}<ChevronRight /></span>
                <span className="discover-stop__note">{summary}</span>
                <span className="discover-stop__footer"><span>停留{formatTravelDuration(stop.stay)}</span><span>{stop.priceState === 'unknown' ? '费用待确认' : `约 ¥${stop.budget}/人`}</span></span>
              </button>
              <details className="discover-stop__guide"><summary>游玩小贴士</summary>
                <p>{stop.note}</p>{detail?.routeTip && <p>游览建议：{detail.routeTip}</p>}
                {knowledge?.address && <p>地址：{knowledge.address}</p>}
                {knowledge?.opening && <p>开放参考：{knowledge.opening.label}；出发前核对当日公告。</p>}
                {knowledge?.price.note && <p>费用说明：{knowledge.price.note}</p>}
                {knowledge?.menuHighlights?.length ? <p>用餐参考：{knowledge.menuHighlights.join('、')}</p> : null}
              </details>
            </div>
          </li>
        })}</ol>
        <details className="discover-day__notes"><summary>用餐与沿途建议</summary><p>{dining.length ? `已安排${dining.map(stop => stop.name).join('、')}；其余正餐可在当天游览片区选择，预留用餐与排队时间。` : `本日暂未指定餐厅，可在${areas[0] || route.cityId}游览前后就近用餐；午间预留约一小时休息。`}</p>
          {foods.length > 0 && <p>相关社区攻略提到的吃食：{foods.join('、')}。可作为点餐灵感，具体门店、配料与价格现场确认。</p>}
          {experiences.length > 0 && <p>沿途体验参考：{experiences.join('、')}；按天气和体力选择。</p>}
          {references.length > 0 && <details><summary>相关攻略参考</summary>{references.map(guide => <p key={guide.id}><a href={guide.sourceUrl} target="_blank" rel="noreferrer">{guide.title}</a> · {guide.author}</p>)}</details>}
          <p>出发前按住宿位置确认首站交通；预约项目优先，步行过多时减少补充停留。转场时间以手机地图为准。</p></details>
      </section>
    })}
  </section>
}
