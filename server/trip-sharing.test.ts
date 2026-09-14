import { describe, expect, it } from 'vitest'
import { TripSharingRepository } from './trip-sharing'
import { generatePlans, understandTrip } from '../src/services/trip/planner'
const plan=()=>({...generatePlans(understandTrip({text:'上海2天，2人3000元',media:[]}).intent)[0],tripId:crypto.randomUUID(),revision:1,savedAt:new Date().toISOString()})
describe('local share compatibility with the mobile UI',()=>{
  it('accepts both legacy plan bodies and new expiry options',()=>{
    const repo=new TripSharingRepository(':memory:'),trip=plan()
    const legacy=repo.create('a',trip),current=repo.create('a',{plan:trip,expiresInDays:1})
    expect(legacy.token).toMatch(/^[a-f0-9]{64}$/);expect(current.expiresAt-Date.now()).toBeLessThanOrEqual(86400000)
    expect(repo.read(current.token).city).toBe('上海')
  })
  it('reuses retries and only lists the creator links',()=>{
    const repo=new TripSharingRepository(':memory:'),trip=plan(),first=repo.create('a',trip)
    expect(repo.create('a',trip).token).toBe(first.token)
    expect(repo.list('b',trip.tripId).shares).toEqual([])
    expect(repo.list('a',trip.tripId).shares).toHaveLength(1)
  })
  it('allows explicit owner updates while keeping the expiry fixed',()=>{
    const repo=new TripSharingRepository(':memory:'),trip=plan(),first=repo.create('a',trip)
    expect(()=>repo.update(first.token,'b',{...trip,revision:2})).toThrow('只有分享创建者')
    const updated=repo.update(first.token,'a',{...trip,revision:2})
    expect(updated.expiresAt).toBe(first.expiresAt);expect(repo.read(first.token).revision).toBe(2)
    expect(repo.read(first.token)).not.toHaveProperty('intent')
  })
  it('revokes and rejects invalid expiry values',()=>{
    const repo=new TripSharingRepository(':memory:'),trip=plan(),first=repo.create('a',trip)
    expect(()=>repo.create('a',{plan:trip,expiresInDays:-1})).toThrow('有效期')
    repo.revoke(first.token,'a');expect(()=>repo.read(first.token)).toThrow('失效')
    expect(()=>repo.update(first.token,'a',trip)).toThrow('失效')
  })
})
