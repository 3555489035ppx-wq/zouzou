import {describe,it,expect} from 'vitest'
import {agendaMinutes,agendaVenueKey,buildDailyAgenda,DAILY_MEALS,DAILY_VISITS,supportsMeal} from './dailyAgenda'
import {getCityKnowledge} from './cityKnowledge'
import {getRoute} from '../../demo-data/discover'
import {completePlanOptions,generatePlans,understandTrip} from './planner'

describe('shared complete city-day rhythm',()=>{
  it('reserves all three meals and all three visit periods for four Hangzhou days without reusing venues',()=>{
    const days=buildDailyAgenda({city:'杭州',days:4,items:getCityKnowledge('杭州').items})
    const entries=days.flatMap(day=>day.entries)
    expect(new Set(entries.map(entry=>agendaVenueKey(entry.item))).size).toBe(entries.length)
    for(const day of days){
      expect(day.missing).toEqual([])
      for(const period of [...DAILY_MEALS,...DAILY_VISITS])expect(day.entries.some(entry=>entry.period===period.type)).toBe(true)
      day.entries.forEach((entry,index)=>{
        if(index>0)expect(agendaMinutes(entry.time)).toBeGreaterThanOrEqual(agendaMinutes(day.entries[index-1].time)+day.entries[index-1].duration+entry.transfer)
        if(entry.item.opening){expect(agendaMinutes(entry.time)).toBeGreaterThanOrEqual(agendaMinutes(entry.item.opening.from));expect(agendaMinutes(entry.time)+entry.duration).toBeLessThanOrEqual(agendaMinutes(entry.item.opening.to))}
        expect(entry.item.source.url).toMatch(/^https?:/)
      })
    }
  })
  it('preserves missing evidence as missing instead of inventing a restaurant or sending a museum visitor out at night',()=>{
    const items=getCityKnowledge('杭州').items.filter(item=>item.name.includes('博物馆'))
    const day=buildDailyAgenda({city:'杭州',days:1,items})[0]
    expect(day.missing).toEqual(expect.arrayContaining(['早餐','午餐','晚餐','晚间']))
    expect(day.entries.every(entry=>items.includes(entry.item))).toBe(true)
  })
  it('does not upgrade snacks and breakfast-only venues to dinner',()=>{
    const breakfast=getCityKnowledge('杭州').items.find(item=>item.tags.includes('早餐专用'))!
    expect(supportsMeal(breakfast,'晚餐')).toBe(false)
  })
  it('keeps each published Hangzhou route day timed and includes meals without hotels',()=>{
    const route=getRoute('multiday-杭州-4-1')!
    expect(route).toBeDefined()
    for(let day=1;day<=4;day++){
      const stops=route.pois.filter(poi=>poi.day===day)
      expect(stops.filter(poi=>['早餐','午餐','晚餐'].includes(poi.category)).map(poi=>poi.category)).toEqual(['早餐','午餐','晚餐'])
      expect(stops.every(poi=>poi.time&&poi.sourceUrl)).toBe(true)
      expect(stops.some(poi=>poi.category==='住宿')).toBe(false)
    }
  })
  it('uses the full rhythm for user-generated city days and keeps hotel before breakfast',()=>{
    const plans=completePlanOptions(generatePlans(understandTrip({text:'杭州3天',media:[]}).intent))
    for(const plan of plans)for(const stops of Object.values(plan.days)){
      expect(stops.filter(stop=>['早餐','午餐','晚餐'].includes(stop.type)).map(stop=>stop.type)).toEqual(['早餐','午餐','晚餐'])
      expect(stops.some(stop=>/夜游/.test(stop.type))).toBe(true)
      expect(stops[0].type).toBe('住宿')
      expect(plan.validation.checks.find(check=>check.name==='时间顺序')?.passed).toBe(true)
    }
  })
})
