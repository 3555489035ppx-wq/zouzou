import { describe, it, expect } from 'vitest'
import { completePlanOptions, generatePlans, understandTrip, getReplacementCandidates, replacePlanPlace } from './planner'

const plansFor = (city: string) => generatePlans(understandTrip({text:`${city}3天`,media:[]}).intent)
const visits = (p: ReturnType<typeof plansFor>[number]) => Object.values(p.days).flat().filter(s=>!s.fixed&&!/餐|小吃|休息/.test(s.type))
describe('city and duration are enough to plan',()=>{
  it('does not publish missing restaurants as successful options',()=>{
    const [complete]=plansFor('呼和浩特')
    const unfinished={...complete,days:Object.fromEntries(Object.entries(complete.days).map(([day,stops])=>[day,stops.map(s=>s.type==='午餐'?{...s,pendingVenue:true}:s)]))}
    expect(completePlanOptions([unfinished,complete])).toEqual([complete])
    expect(()=>completePlanOptions([unfinished])).toThrow('攻略未生成完成')
    const missing={...complete,days:Object.fromEntries(Object.entries(complete.days).map(([day,stops])=>[day,stops.filter(s=>s.type!=='午餐')]))}
    expect(()=>completePlanOptions([missing])).toThrow('攻略未生成完成')
  })
  it('offers newly reviewed restaurants when a saved knowledge snapshot is old',()=>{
    const [plan]=plansFor('呼和浩特')
    const target=Object.values(plan.days).flat().find(s=>s.type==='午餐')!
    const old={...plan,knowledge:{...plan.knowledge,items:plan.knowledge.items.filter(s=>!['restaurant','food'].includes(s.category))}}
    const candidates=getReplacementCandidates(old,target.id)
    expect(candidates.length).toBeGreaterThan(0)
    const next=replacePlanPlace(old,target.id,candidates[0].name)
    expect(Object.values(next.days).flat().find(s=>s.id===target.id)?.name).toBe(candidates[0].name)
    expect(Object.values(next.days).flat().find(s=>s.id===target.id)?.pendingVenue).not.toBe(true)
  })
  it('completes meals on the first generation with food preferences and return time',()=>{
    for(const text of ['呼和浩特3天2晚，2人，预算6000元，09:00到达，20:00返程，喜欢当地美食和城市游览。','上海3天']) {
      for(const p of generatePlans(understandTrip({text,media:[]}).intent)) {
        const meals=Object.values(p.days).flat().filter(s=>/早餐|午餐|晚餐/.test(s.type))
        expect(meals.filter(s=>s.pendingVenue).map(s=>s.name),text+' '+p.label).toEqual([])
      }
    }
  })
  it('does not schedule the same museum again as a slow-view activity',()=>{
    for(const p of plansFor('呼和浩特')) {
      expect(visits(p).some(s=>s.name==='大召寺')).toBe(true)
      expect(visits(p).some(s=>s.name==='至五台山')).toBe(false)
      const names=visits(p).map(s=>s.name.replace(/慢看|看展|早走|逛吃|散步|夜逛|慢走$/g,''))
      expect(new Set(names).size).toBe(names.length)
    }
  })
  it('uses named, source-backed Hohhot restaurants for all nine meals',()=>{
    for(const p of plansFor('呼和浩特')) {
      const meals=Object.values(p.days).flat().filter(s=>/早餐|午餐|晚餐/.test(s.type))
      expect(meals).toHaveLength(9)
      expect(meals.filter(s=>s.pendingVenue).map(s=>s.name)).toEqual([])
      expect(new Set(meals.map(s=>s.canonicalName??s.name)).size).toBe(9)
    }
  })
  it('makes three meaningfully different sightseeing choices with a full last day',()=>{
    for(const city of ['呼和浩特','武汉','成都','厦门','杭州']) {
      const plans=plansFor(city)
      expect(new Set(plans.map(p=>visits(p).map(s=>s.name).sort().join('|'))).size,city).toBe(3)
      // Three full day periods are mandatory in every option. Richness can use
      // longer, distinct visits when another stop would not fit its time window.
      expect(visits(plans[2]).length,city).toBeGreaterThanOrEqual(visits(plans[1]).length)
      const finalDay=plans[0].days['Day 3']
      expect(finalDay.some(s=>s.type==='晚餐'),city).toBe(true)
      // No supplied train/flight means a full city day, not an invented 19:00 return.
      expect(finalDay.some(s=>s.type==='返程'),city).toBe(false)
      expect(finalDay.at(-1)!.time<'22:00',city).toBe(true)
    }
  })
  it('changes every hotel anchor without rewriting non-hotel stops',()=>{
    const p=plansFor('呼和浩特')[0], hotel=Object.values(p.days).flat().find(s=>s.type==='住宿')!
    const candidate=getReplacementCandidates(p,hotel.id).find(c=>c.name!==hotel.name)!
    expect(candidate).toBeDefined()
    const next=replacePlanPlace(p,hotel.id,candidate.name)
    expect(Object.values(next.days).flat().filter(s=>s.type==='住宿').every(s=>s.name===candidate.name)).toBe(true)
    expect(Object.values(next.days).flat().filter(s=>s.type!=='住宿')).toEqual(Object.values(p.days).flat().filter(s=>s.type!=='住宿'))
  })
})
