import { MapPinned } from 'lucide-react'
import type { MapPlace } from '../services/mapLauncher'
import { OpenRouteMapButton } from './MapLauncher'

export type RouteOverviewProps = {
  city?: string
  places: Array<MapPlace & { time?: string; type?: string; stay?: string; budget?: number; transport?: string; note?: string }>
  progress?: number
  compact?: boolean
  focus?: [number, number] | null
  onNodeSelect?: (index: number) => void
  /** Kept so older screens can migrate without reintroducing an in-page map. */
  center?: [number, number]
  overview?: boolean
  botState?: string
  userLocation?: { lng: number; lat: number; accuracy?: number } | null
  followUser?: boolean
  onMapInteraction?: () => void
  onRouteMatch?: (value: null) => void
  onRouteSnapshot?: (value: null) => void
  onPlacesResolved?: (places: RouteOverviewProps['places']) => void
  onReady?: () => void
  showRouteAction?: boolean
}

export const RouteOverview = ({ city, places, progress = 0, compact = false, focus, onNodeSelect, showRouteAction = true }: RouteOverviewProps) => {
  const currentIndex = places.length > 1 ? Math.min(places.length - 1, Math.round(progress * (places.length - 1))) : 0
  const focused = (index: number) => focus ? index >= focus[0] && index <= focus[1] : false
  return <section className={`route-overview${compact ? ' route-overview--compact' : ''}`} data-map-provider="external" role="region" aria-label="行程地点概览">
    <header className="route-overview__header"><div><span>{city ?? '行程'} · {places.length} 个地点</span><strong>地点顺序概览</strong></div><div className="route-overview__header-actions"><MapPinned aria-hidden="true" />{showRouteAction ? <OpenRouteMapButton places={places} city={city} compact /> : null}</div><small>真实路线请用地图 App 打开</small></header>
    {places.length === 0 ? <p className="route-overview__empty">还没有可打开的具体地点。</p> : <ol className="route-overview__list">{places.map((place, index) => <li key={place.id} className={`${index === currentIndex ? 'is-current ' : ''}${index < currentIndex ? 'is-done ' : ''}${focused(index) ? 'is-focused' : ''}`}>
      <button type="button" className="route-overview__node" onClick={() => onNodeSelect?.(index)} aria-label={`查看第${index + 1}站${place.name}`}><span>{index + 1}</span></button>
      <div className="route-overview__copy"><strong>{place.name}</strong><small>{[place.time, place.type, place.stay].filter(Boolean).join(' · ') || '地点信息待补充'}</small>{place.transport ? <small>{index === 0 ? '起点 · 从这里开始' : '真实道路 · 地图 App 计算'}</small> : null}{place.note ? <p>{place.note}</p> : null}</div>
      <div className="route-overview__action"><b>{typeof place.budget === 'number' ? `¥${place.budget}` : ''}</b></div>
    </li>)}</ol>}
    <footer className="route-overview__footer">第 {Math.min(places.length, currentIndex + 1)} / {places.length} 站 · 走走不绘制猜测路线</footer>
  </section>
}
