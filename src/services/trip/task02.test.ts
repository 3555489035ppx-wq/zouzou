import { describe, expect, it } from 'vitest'
import { allocateExpense, splitExpenseBalances, summarizeExpenses, type TripExpense } from './journeyTools'
import { tripCounts } from './summary'
import type { PlannedStop } from './planner'
import { getDiscoverItem, getExploreCityCards, getItineraryPlazaItems, getRoute, normalizeCityQuery } from '../../demo-data/discover'

const expense: TripExpense = {id:'e',journeyId:'a',amount:100,amountMinor:10000,currency:'CNY',category:'交通',payerId:'a',participantIds:['c','a','b'],occurredAt:'2026-01-01',createdAt:'2026-01-01'}
describe('Task 02 shared semantics',()=>{
  it('conserves 100 yuan for 2 and 3 people including deterministic remainder',()=>{
    expect(allocateExpense({...expense,participantIds:['b','a']})).toEqual({a:5000,b:5000})
    expect(allocateExpense(expense)).toEqual({a:3334,b:3333,c:3333})
    expect(splitExpenseBalances([expense])[0].people.reduce((sum,p)=>sum+p.cents,0)).toBe(0)
  })
  it('refund reverses liability and leaves payment date independent of the trip day',()=>{
    const refund={...expense,id:'refund',kind:'refund' as const}
    expect(splitExpenseBalances([expense,refund])[0].people.every(person=>person.cents===0)).toBe(true)
    expect(summarizeExpenses([expense,refund],'a').total).toBe(0)
    expect(expense.dayId).toBeUndefined()
  })
  it('rejects custom amount mismatch and supports weighted shares',()=>{
    expect(()=>allocateExpense({...expense,splitMode:'amount',allocations:{a:1}})).toThrow('之和')
    expect(allocateExpense({...expense,participantIds:['a','b'],splitMode:'shares',allocations:{a:1,b:3}})).toEqual({a:2500,b:7500})
  })
  it('counts repeated hotels and visits separately from anchors and pending venues',()=>{
    const stop=(name:string,type='地点',pendingVenue=false)=>({id:name,name,type,pendingVenue} as PlannedStop)
    expect(tripCounts({'Day 1':[stop('酒店','住宿'),stop('公园'),stop('到站','到达')],'Day 2':[stop('酒店','住宿'),stop('公园'),stop('待定餐厅','餐饮',true)]})).toEqual({places:2,visits:4,arrangements:6})
  })
  it('does not manufacture a missing publication or change an unknown city to Shanghai',()=>{
    expect(getDiscoverItem('post-route-1-shared')).toBeUndefined()
    expect(getExploreCityCards('空城')).toEqual([])
    expect(normalizeCityQuery('成都市')).toBe('成都')
    expect(getExploreCityCards('dali')[0]?.cityId).toBe('大理')
  })
  it('each city advertises exactly the routes its detail can open',()=>{
    const cards = getExploreCityCards()
    const plaza = getItineraryPlazaItems()
    expect(cards.length).toBeGreaterThan(0)
    for (const city of cards) {
      // DiscoverCityPage renders this public catalog, not the legacy top-15 feed.
      const entries = getItineraryPlazaItems(city.cityId)
      const plazaEntries = plaza.filter(entry => entry.cityId === city.cityId)
      expect(entries.length, city.cityId).toBeGreaterThan(0)
      expect(city.guideCount, city.cityId).toBe(entries.length)
      expect(city.publishedRouteCount, city.cityId).toBe(plazaEntries.length)
      expect(new Set(entries.map(entry => entry.id)).size, city.cityId).toBe(entries.length)
      expect(new Set(entries.map(entry => entry.routeId)).size, city.cityId).toBe(entries.length)
      expect(entries.map(entry => entry.id), city.cityId).toEqual(plazaEntries.map(entry => entry.id))
      for (const entry of entries) {
        // Follow the same item -> route lookup as DiscoverDetailPage.
        const detail = getDiscoverItem(entry.id)
        expect(detail, entry.id).toBeDefined()
        expect(detail?.status, entry.id).toBe('published')
        expect(detail?.cityId, entry.id).toBe(city.cityId)
        expect(detail?.routeId, entry.id).toBe(entry.routeId)
        const route = getRoute(detail!.routeId)
        expect(route, entry.routeId).toBeDefined()
        expect(route?.cityId, entry.routeId).toBe(city.cityId)
        expect(route!.pois.length, entry.routeId).toBeGreaterThan(0)
      }
    }
    expect(cards.reduce((total, city) => total + city.guideCount, 0)).toBe(plaza.length)
    expect(cards.reduce((total, city) => total + city.publishedRouteCount, 0)).toBe(plaza.length)
  })
})
