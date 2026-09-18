import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { generatePlans, understandTrip } from '../../src/services/trip/planner'
import { handleCloudRequest } from './handler'
import type { CloudDatabase, CloudStatement } from './database'
vi.mock('./community',()=>({handleCloudCommunity:()=>new Response('{}')}))
vi.mock('./ai',()=>({handleCloudAI:()=>new Response(JSON.stringify({message:'knowledge gate'}),{status:503})}))

let sqlite:DatabaseSync,db:CloudDatabase
const plan=()=>({...generatePlans(understandTrip({text:'上海2天2人预算3000元，喜欢历史街区',media:[]}).intent)[0],tripId:crypto.randomUUID(),savedAt:new Date().toISOString(),revision:1})
function statement(sql:string):CloudStatement {
  let values:unknown[]=[]
  return {bind(...args){values=args;return this},async first<T>(){return (sqlite.prepare(sql).get(...values as never[])??null) as T|null},async all<T>(){return {results:sqlite.prepare(sql).all(...values as never[]) as T[]}},async run(){const result=sqlite.prepare(sql).run(...values as never[]);return {meta:{changes:Number(result.changes)}}}}
}
async function call(path:string,method='GET',data?:unknown,cookie?:string,extra:Record<string,string>={}) {
  return handleCloudRequest(new Request('https://zouzou.example'+path,{method,headers:{...(cookie?{cookie}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{}),...extra},...(data!==undefined?{body:JSON.stringify(data)}:{})}),{DB:db,KNOWLEDGE_RELEASE_APPROVED:'false'})
}
const session=async()=>{const response=await call('/api/session');return response.headers.get('set-cookie')!.split(';')[0]}
beforeEach(()=>{sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../../migrations/0001_private_trips.sql',import.meta.url),'utf8'));db={prepare:statement,batch:async statements=>{sqlite.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());sqlite.exec('COMMIT');return results}catch(cause){sqlite.exec('ROLLBACK');throw cause}}}})
afterEach(()=>sqlite.close())

describe('Cloudflare private trips and guest sessions',()=>{
  it('uses secure HttpOnly server identities; stores only token hashes',async()=>{
    const response=await call('/api/session'),cookie=response.headers.get('set-cookie')!
    expect(cookie).toMatch(/zouzou_session=[a-f0-9]{64}; HttpOnly; SameSite=Lax/);expect(cookie).toContain('Secure')
    const row=sqlite.prepare('SELECT token_hash FROM cloud_sessions').get()!
    expect(cookie).not.toContain(String(row.token_hash))
  })
  it('persists trips, reads by verified owner only, and rejects stale revisions',async()=>{
    const a=await session(),b=await session(),trip=plan()
    expect((await call('/api/trips','PUT',{...trip,ownerId:'forged'},a)).status).toBe(200)
    expect((await (await call('/api/trips','GET',undefined,a)).json()).trips).toHaveLength(1)
    expect((await (await call('/api/trips','GET',undefined,b)).json()).trips).toHaveLength(0)
    expect((await call('/api/trips/'+trip.tripId,'GET',undefined,b)).status).toBe(404)
    expect((await call('/api/trips','PUT',{...trip,city:'杭州'},a)).status).toBe(409)
  })
  it('creates a public allowlisted snapshot, keeps it fixed, updates explicitly and revokes',async()=>{
    const a=await session(),b=await session(),trip=plan()
    const created=await call('/api/shares','POST',{plan:trip,expiresInDays:1},a),link=await created.json()
    expect(created.status).toBe(201);expect(link.token).toMatch(/^[a-f0-9]{64}$/)
    const first=await call('/api/shares/'+link.token)
    expect(first.headers.get('cache-control')).toBe('no-store');expect(first.headers.get('set-cookie')).toBeNull()
    const snapshot=await first.json();expect(snapshot).not.toHaveProperty('intent');expect(snapshot).not.toHaveProperty('knowledge');expect(snapshot).not.toHaveProperty('evidence')
    expect(Object.values(snapshot.days).flat().some((stop:any)=>['住宿','到达','返程','取行李','退房'].includes(stop.type))).toBe(false)
    expect((await call('/api/shares/'+link.token+'/revoke','POST',undefined,b)).status).toBe(403)
    const newer={...trip,revision:2,savedAt:new Date(Date.now()+100).toISOString()}
    expect((await call('/api/trips','PUT',newer,a)).status).toBe(200)
    expect((await (await call('/api/shares/'+link.token)).json()).revision).toBe(1)
    expect((await call('/api/shares/'+link.token+'/update','POST',newer,a)).status).toBe(200)
    expect((await (await call('/api/shares/'+link.token)).json()).revision).toBe(2)
    expect((await call('/api/shares/'+link.token+'/revoke','POST',undefined,a)).status).toBe(200)
    expect((await call('/api/shares/'+link.token)).status).toBe(404)
  })
  it('rejects expired/invalid links and isolates the owner link list',async()=>{
    const a=await session(),b=await session(),trip=plan(),link=await (await call('/api/shares','POST',trip,a)).json()
    expect((await (await call('/api/shares?tripId='+trip.tripId,'GET',undefined,b)).json()).shares).toHaveLength(0)
    sqlite.prepare('UPDATE cloud_shares SET expires_at=0 WHERE token=?').run(link.token)
    expect((await call('/api/shares/'+link.token)).status).toBe(404)
    expect((await call('/api/shares/invalid')).status).toBe(404)
  })
  it('reuses duplicate creation after a retry without changing the snapshot',async()=>{
    const a=await session(),trip=plan(),first=await(await call('/api/shares','POST',trip,a)).json()
    const second=await(await call('/api/shares','POST',trip,a)).json()
    expect(second.token).toBe(first.token)
  })
  it('rejects cross-site writes and unsupported bodies before mutation',async()=>{
    expect((await call('/api/trips','PUT',plan(),undefined,{Origin:'https://evil.example'})).status).toBe(403)
    expect((await call('/api/trips','PUT',plan(),undefined,{'Content-Type':'text/plain'})).status).toBe(415)
    expect(sqlite.prepare('SELECT count(*) AS n FROM cloud_trips').get()?.n).toBe(0)
  })
  // 微信小程序的 wx.request 由原生 WebView 发出：Origin=servicewechat.com 且 Sec-Fetch-Site=cross-site，
  // 之前会被 CSRF 校验一律挡成 403，小程序因此完全无法调用生成接口。
  it('accepts requests from the own mini program while still rejecting other cross-site callers',async()=>{
    const body={text:'上海两天',media:[]}
    const own=await call('/api/trips/understand','POST',body,undefined,{Origin:'https://servicewechat.com',Referer:'https://servicewechat.com/wx314187b9a9c98213/12/page-frame.html','Sec-Fetch-Site':'cross-site'})
    expect(own.status).not.toBe(403)
    // 别人的小程序：appid 不同，仍然拒绝
    const foreignMini=await call('/api/trips/understand','POST',body,undefined,{Origin:'https://servicewechat.com',Referer:'https://servicewechat.com/wx0000000000000000/12/page-frame.html','Sec-Fetch-Site':'cross-site'})
    expect(foreignMini.status).toBe(403)
    // 其它站点：照旧拒绝
    expect((await call('/api/trips/understand','POST',body,undefined,{Origin:'https://evil.example','Sec-Fetch-Site':'cross-site'})).status).toBe(403)
    // 有 servicewechat Origin 但没有 Referer：无法确认 appid，仍然拒绝
    expect((await call('/api/trips/understand','POST',body,undefined,{Origin:'https://servicewechat.com','Sec-Fetch-Site':'cross-site'})).status).toBe(403)
  })
  it('invalidates the guest session on logout',async()=>{
    const cookie=await session(),before=await(await call('/api/session','GET',undefined,cookie)).json()
    const logout=await call('/api/session/logout','POST',undefined,cookie)
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')
    const after=await(await call('/api/session','GET',undefined,cookie)).json();expect(after.userId).not.toBe(before.userId)
  })
  it('returns JSON 503 when the cloud binding is absent, not SPA HTML',async()=>{
    const response=await handleCloudRequest(new Request('https://zouzou.example/api/health'),{})
    expect(response.status).toBe(503);expect(response.headers.get('content-type')).toContain('application/json')
  })
})
