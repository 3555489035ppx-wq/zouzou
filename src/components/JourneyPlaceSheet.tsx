import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Backpack, ChevronRight, CircleDollarSign, MapPin } from 'lucide-react'
import type { Place } from '../demo-data/trips'
import { factsFor } from '../services/trip/verifiedFacts'
import { getPlaceKnowledge } from '../services/trip/goohKnowledge'
import { track } from '../services/analytics'
import { OpenMapButton } from './MapLauncher'
import { ZouBottomSheet, ZouButton } from './ui'
export const PlaceKnowledgeContent = ({ place, city }: { place: Place; city: string }) => {
  const knowledge = getPlaceKnowledge(place.name, city)
  const facts=factsFor(city,place.name,(place as Place & {date?:string}).date)
  return <>
    {place.address ? <p>{place.address}</p> : null}{facts.map(fact=><p key={fact.field+fact.sourceUrl}>{fact.value}</p>)}<p className="journey-place__summary">{knowledge?.summary ?? place.note}</p>
    <div className="journey-fact-grid">
      <span><small>建议停留</small><strong>{knowledge?.recommendedDuration ?? place.stay}</strong></span>
      <span><small>开放时间</small><strong>{facts.find(fact=>fact.field==='opening')?.value ?? knowledge?.openingHours ?? '开放时间待确认'}</strong></span>
      <span><small>门票 / 消费</small><strong>{facts.find(fact=>fact.field==='price')?.value ?? (place.priceState==='unknown'?'费用待确认':knowledge?.ticket ?? `估算 ¥${place.budget}`)}</strong></span>
      <span><small>适合时段</small><strong>{knowledge?.bestTime ?? '按当天状态调整'}</strong></span>
    </div>
    {knowledge?.highlights.length ? <section className="journey-place__section"><h3>可以怎么走</h3><div className="journey-chip-list">{knowledge.highlights.map((item) => <span key={item}>{item}</span>)}</div></section> : null}
    {knowledge?.recommendedActivities.length ? <section className="journey-place__section"><h3>适合做什么</h3><p>{knowledge.recommendedActivities.join(' · ')}</p></section> : null}
    {knowledge?.tips.length ? <section className="journey-place__section"><h3>出发前提醒</h3><ul>{knowledge.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></section> : null}
    {knowledge?.timeSensitive ? <p className="journey-note">路线与停留时长可按当天节奏灵活调整。</p> : null}
  </>
}

export const JourneyPlaceSheet = ({ open, onClose, place, city, journeyId, dayId = 'Day 1', onReplace }: { open: boolean; onClose: () => void; place: Place | null; city: string; journeyId: string; dayId?: string; onReplace?: () => void; sourceUrl?: string }) => {
  const navigate = useNavigate()

  useEffect(() => {
    if (open && place) track('place_open', { placeType: place.type })
  }, [open, place])

  return <ZouBottomSheet open={open} onClose={onClose} title={place?.name ?? '地点详情'}>
    {place ? <>
      <div className="journey-place__eyebrow"><MapPin />{city} · {place.type}</div>
      <PlaceKnowledgeContent place={place} city={city} />
      <div className="journey-action-stack">
        {onReplace ? <ZouButton onClick={onReplace}><ArrowLeftRight aria-hidden="true" /><span>{/住宿|退房|取行李/.test(place.type) ? '更换酒店' : /餐|小吃/.test(place.type) ? '换一家餐厅' : '替换这个地点'}</span></ZouButton> : null}
        <OpenMapButton place={place} city={city} />
        <ZouButton variant="secondary" onClick={() => navigate(`/journey/expense?tripId=${encodeURIComponent(journeyId)}&place=${encodeURIComponent(place.id)}&day=${encodeURIComponent(dayId)}`)}><CircleDollarSign />记一笔费用</ZouButton>
        <ZouButton variant="secondary" onClick={() => navigate(`/journey/packing?tripId=${encodeURIComponent(journeyId)}`)}><Backpack />查看出发清单</ZouButton>
        <button className="journey-text-action" onClick={() => navigate(`/journey/place/${encodeURIComponent(place.id)}?city=${encodeURIComponent(city)}&name=${encodeURIComponent(place.name)}&tripId=${encodeURIComponent(journeyId)}`)}>查看完整地点资料<ChevronRight /></button>
      </div>
    </> : null}
  </ZouBottomSheet>
}

