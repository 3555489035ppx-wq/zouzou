import { describe, expect, it } from 'vitest'
import { refreshRepeatedMeals, completePendingMeals, completeSavedItinerary, generatePlans, understandTrip, getReplacementCandidates, replacePlanPlace } from './planner'
import { getCityKnowledge } from './cityKnowledge'

describe('daily concrete meal scheduling', () => {
  it('keeps a sightseeing stop on every full day of a four day Dali trip when inserting breakfast', () => {
    const { intent } = understandTrip({ text: '2026年9月8日到9月11日去大理4天3晚，2个人，总预算6000元，9月8日09:00到大理站，9月11日20:00从大理站返程，想去大理古城、洱海、双廊，吃本地小吃。', media: [] })
    for (const plan of generatePlans(intent)) {
      for (const day of ['Day 2', 'Day 3']) {
        expect(plan.days[day].some(stop => !stop.fixed && !/餐|小吃|住宿|休息/.test(stop.type)), `${plan.label} ${day}`).toBe(true)
      }
      expect(plan.validation.checks.filter(check => ['时间顺序', '餐期', '营业时间'].includes(check.name)).every(check => check.passed)).toBe(true)
    }
  })
  it('does not interpret a snack warning mentioning breakfast as breakfast eligibility', () => {
    const {intent}=understandTrip({text:'成都3天2晚，喜欢吃，预算5000',media:[]})
    const snacks=new Set(getCityKnowledge('成都').items.filter(item=>item.tags.includes('加餐')).map(item=>item.name))
    for(const plan of generatePlans(intent)) {
      const breakfasts=Object.values(plan.days).flat().filter(stop=>stop.type==='早餐')
      expect(breakfasts).toHaveLength(3)
      expect(breakfasts.some(stop=>snacks.has(stop.name))).toBe(false)
    }
  })
  it('includes breakfast as a real meal in every available morning', () => {
    const {intent}=understandTrip({text:'杭州3天2晚，早上08:00到杭州东站，晚上20:00返程，预算6000，喜欢本地小吃',media:[]})
    for(const plan of generatePlans(intent))for(const stops of Object.values(plan.days)) {
      const breakfast=stops.filter(stop=>stop.type==='早餐')
      expect(breakfast).toHaveLength(1)
      expect(breakfast[0].time<='11:00').toBe(true)
      expect(breakfast[0].note).not.toContain('可跳过')
      expect(breakfast[0].pendingVenue).not.toBe(true)
      const breakfastOnly = new Set(plan.knowledge.items.filter(item=>item.tags.includes('早餐专用')).map(item=>item.name))
      expect(stops.filter(stop=>/午餐|晚餐/.test(stop.type)).some(stop=>breakfastOnly.has(stop.name))).toBe(false)
    }
  })
  it('preserves the breakfast meal and duration when changing its venue', () => {
    const {intent}=understandTrip({text:'杭州3天2晚，08:00到杭州东站，20:00返程，预算6000',media:[]})
    const plan=generatePlans(intent)[0]
    const breakfast=Object.values(plan.days).flat().find(stop=>stop.type==='早餐')!
    const candidate=getReplacementCandidates(plan,breakfast.id)[0]
    expect(candidate).toBeDefined()
    const next=replacePlanPlace(plan,breakfast.id,candidate.name)
    const updated=Object.values(next.days).flat().find(stop=>stop.id===breakfast.id)!
    expect(updated.type).toBe('早餐')
    expect(updated.durationMinutes).toBe(35)
  })
  it('does not invent a restaurant menu when attaching an unmatched local dish', () => {
    const items = getCityKnowledge('杭州').items
    expect(items.some(item => item.name === '马儿私房菜｜龙井虾仁')).toBe(false)
    expect(items.find(item => item.name === '马儿私房菜')?.menuHighlights).not.toContain('龙井虾仁')
  })
  it('preserves meal slots without repeating restaurants when nine days exhaust the venue pool', () => {
    const { intent } = understandTrip({ text: '2026年9月24日到10月2日去杭州9天8晚，2个人，总预算10000元，9月24日09:00到杭州东站，10月2日20:30从杭州东站返程，住湖滨附近，想去西湖和吃本地小吃。', media: [] })
    const plans = generatePlans(intent)
    for (const plan of plans) {
      const meals = Object.values(plan.days).flat().filter(stop => /午餐|晚餐/.test(stop.type))
      const named=Object.values(plan.days).flat().filter(stop=>/餐|小吃/.test(stop.type)&&!stop.pendingVenue).map(stop=>stop.canonicalName??stop.name)
      expect(new Set(named).size).toBe(named.length)
      expect(meals.filter(stop=>stop.pendingVenue).every(stop=>stop.priceState==='unknown' && stop.budget===0)).toBe(true)
      expect(meals.length).toBeGreaterThanOrEqual(17)
      for (const stops of Object.values(plan.days)) {
        expect(stops.some(stop => !stop.fixed && !/餐|小吃|住宿|休息/.test(stop.type))).toBe(true)
      }
      expect(plan.validation.checks.filter(check => ['时间顺序', '餐期', '营业时间', '饮食匹配'].includes(check.name)).every(check => check.passed)).toBe(true)
    }
  })
  it('fills old placeholders once, preserving saved IDs, custom stops, times and bookings', () => {
    const { intent } = understandTrip({ text: '2026年9月24日到10月2日去杭州9天8晚，2个人，总预算10000元，09:00到杭州东站，20:30从杭州东站返程，住湖滨附近，想去西湖和吃本地小吃。', media: [] })
    const generated = generatePlans(intent)[0]
    const meal = generated.days['Day 2'].find(stop => stop.type === '午餐')!
    const plan = { ...generated, tripId: 'saved-legacy', revision: 3, days: { ...generated.days, 'Day 2': generated.days['Day 2'].map(stop => stop.id === meal.id ? { ...stop, name: 'Day 2 午餐餐厅待选', pendingVenue: true, budget: 0, priceState: 'unknown' as const } : stop) } }
    const before = JSON.stringify(plan)
    const completed = completePendingMeals(plan)
    const filled = completed.days['Day 2'].find(stop => stop.id === meal.id)!
    expect(filled.pendingVenue).not.toBe(true)
    expect(filled.time).toBe(meal.time)
    expect(completed.tripId).toBe(plan.tripId)
    expect(completed.revision).toBe(4)
    expect(completed.previousVersion?.days).toEqual(plan.days)
    expect(completePendingMeals(completed)).toBe(completed)
    expect(JSON.stringify(plan)).toBe(before)
    expect(completePendingMeals({ ...plan, status: 'completed' })).toEqual({ ...plan, status: 'completed' })
    for (const [day, stops] of Object.entries(plan.days)) {
      for (const stop of stops.filter(stop => stop.id !== meal.id)) {
        const next = completed.days[day].find(item => item.id === stop.id)!
        expect([next.id, next.name, next.time, next.fixed]).toEqual([stop.id, stop.name, stop.time, stop.fixed])
      }
    }
  })
  it('fills empty later days in an old generated trip without moving its existing stops', () => {
    const { intent } = understandTrip({ text: '杭州9天8晚，2个人，总预算10000元，09:00到杭州东站，20:30从杭州东站返程，住湖滨附近，想去西湖和吃本地小吃。', media: [] })
    const generated = generatePlans(intent)[0]
    const days = Object.fromEntries(Object.entries(generated.days).map(([day, stops], index) => [day, (index < 4 ? stops : stops.filter(stop => stop.fixed || /餐|小吃/.test(stop.type))).map(stop => /午餐|晚餐/.test(stop.type) ? { ...stop, name: `${day} ${stop.type}餐厅待选`, pendingVenue: true, budget: 0, priceState: 'unknown' as const } : stop)]))
    const plan = { ...generated, tripId: 'legacy-empty-days', revision: 1, days }
    const next = completeSavedItinerary(plan)
    for (const [day, stops] of Object.entries(days)) {
      if (Number(day.replace(/\D/g, '')) > 4) expect(next.days[day].some(stop => !stop.fixed && !/餐|小吃|住宿|休息/.test(stop.type))).toBe(true)
      for (const stop of stops) expect(next.days[day].find(item => item.id === stop.id)?.time).toBe(stop.time)
    }
    expect(next.previousVersion?.days).toEqual(plan.days)
    expect(completeSavedItinerary(next)).toBe(next)
    const clearedByOwner = { ...generated, days: { ...generated.days, 'Day 5': [] } }
    expect(completeSavedItinerary(clearedByOwner)).toBe(clearedByOwner)
  })
})


describe('whole-trip meal diversity',()=>{
  it.each(['武汉','上海','杭州','成都','大理'])('never repeats a venue across three days in %s',city=>{
    const {intent}=understandTrip({text:`${city}3天2晚，2人，预算6000，09:30到达，20:00返程，喜欢当地美食`,media:[]})
    for(const plan of generatePlans(intent)){
      const meals=Object.values(plan.days).flat().filter(stop=>/早餐|午餐|晚餐|本地小吃/.test(stop.type)&&!stop.pendingVenue)
      const keys=meals.map(stop=>(stop.canonicalName??stop.name).replace(/[（(][^）)]*(?:片区|附近)[）)]/g,'').replace(/[（）()·/—\-\s]/g,''))
      expect(new Set(keys).size).toBe(keys.length)
      expect(plan.guideContext?.candidates.length).toBeGreaterThan(0)
    }
  })
  it('refreshes duplicate meals without moving fixed or non-meal stops, and preserves undo',()=>{
    const {intent}=understandTrip({text:'武汉3天2晚，预算6000',media:[]})
    const generated=generatePlans(intent)[0]
    const days=structuredClone(generated.days)
    const meals=Object.values(days).flat().filter(stop=>/午餐|晚餐/.test(stop.type)&&!stop.pendingVenue)
    Object.assign(meals[1],{name:meals[0].name,canonicalName:meals[0].canonicalName})
    const legacy={...generated,days,revision:3}
    const next=refreshRepeatedMeals(legacy)
    expect(next.revision).toBe(4);expect(next.previousVersion?.days).toEqual(days)
    for(const [day,stops] of Object.entries(days))for(const stop of stops){const updated=next.days[day].find(s=>s.id===stop.id)!;expect(updated.time).toBe(stop.time);if(stop.fixed||!/餐|小吃/.test(stop.type))expect(updated.name).toBe(stop.name)}
    expect(refreshRepeatedMeals({...legacy,status:'active'})).toEqual({...legacy,status:'active'})
    expect(refreshRepeatedMeals(next)).toBe(next)
  })
})


describe('hotel departure precedes breakfast',()=>{
  it.each(['武汉','厦门','杭州'])('%s starts later mornings at the hotel before breakfast',city=>{
    const {intent}=understandTrip({text:`2026年9月18日到9月20日去${city}3天2晚，2人，预算6000元，09:30到${city}站，20:00从${city}站返程`,media:[]})
    for(const plan of generatePlans(intent))for(const [day,stops] of Object.entries(plan.days).slice(1)){
      const hotel=stops.findIndex(s=>/-hotel-day-/.test(s.id));const breakfast=stops.findIndex(s=>s.type==='早餐')
      expect(hotel,day).toBe(0);expect(breakfast,day).toBeGreaterThan(hotel)
      expect(stops[hotel].note).toContain('出发')
    }
  })
})


it('repairs a saved breakfast-before-hotel plan once without moving breakfast or visits',()=>{
  const {intent}=understandTrip({text:'2026年9月18日到9月20日去武汉3天2晚，预算6000元，09:30到武汉站，20:00从武汉站返程',media:[]})
  const fresh=generatePlans(intent)[0];const days=structuredClone(fresh.days)
  const stops=days['Day 2'];const hotel=stops.shift()!;hotel.time='09:30';stops.splice(1,0,hotel)
  const old={...fresh,days,revision:2};const next=completeSavedItinerary(old)
  expect(next.days['Day 2'][0].id).toBe(hotel.id)
  expect(next.days['Day 2'][0].time<'08:15').toBe(true)
  expect(next.previousVersion?.days).toEqual(old.days)
  for(const stop of stops.filter(s=>s.id!==hotel.id))expect(next.days['Day 2'].find(s=>s.id===stop.id)?.time).toBe(stop.time)
  expect(completeSavedItinerary(next)).toBe(next)
  expect(completeSavedItinerary({...old,status:'active'})).toEqual({...old,status:'active'})
})
