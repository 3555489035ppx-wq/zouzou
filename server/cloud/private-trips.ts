import { parseGeneratedPlans } from '../../src/services/trip/schemas'
import { shareSnapshot } from '../../src/services/trip/shareSnapshot'
import { body, CloudError, json, secretToken, type CloudDatabase } from './database'

function validatedPlan(raw: unknown) {
  const plan = parseGeneratedPlans([raw])?.[0]
  if (!plan?.tripId || !plan.savedAt || plan.example) throw new CloudError(400, '请先保存有效的非示例行程。')
  return plan
}
export async function saveCloudTrip(db: CloudDatabase, actor: string, raw: unknown) {
  const plan = validatedPlan(raw), revision = plan.revision ?? 1, payload = JSON.stringify(plan)
  // Client ownerId is never consulted. A stale revision must not overwrite another tab.
  const previous = await db.prepare('SELECT revision,payload FROM cloud_trips WHERE owner_id=? AND trip_id=?').bind(actor, plan.tripId).first<{revision:number;payload:string}>()
  if (previous?.payload === payload) return { plan, updatedAt: plan.savedAt }
  if (previous && previous.revision >= revision) throw new CloudError(409, '云端已有更新版本，原记录未覆盖。请重新读取后再修改。')
  const now = new Date().toISOString()
  const result = await db.prepare('INSERT INTO cloud_trips(owner_id,trip_id,revision,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner_id,trip_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at WHERE excluded.revision>cloud_trips.revision').bind(actor,plan.tripId,revision,payload,now).run()
  if (!result.meta?.changes) throw new CloudError(409, '另一页面已更新云端行程，请重新读取。')
  return {plan,updatedAt:now}
}
export async function handlePrivateTrips(request: Request, db: CloudDatabase, actor: string) {
  const path = new URL(request.url).pathname, method = request.method
  if (path === '/api/shares' && method === 'GET') {
    const tripId=new URL(request.url).searchParams.get('tripId')
    if(!tripId)throw new CloudError(400,'请指定自己的行程。')
    const rows=await db.prepare('SELECT token,expires_at,updated_at,revision FROM cloud_shares WHERE owner_id=? AND trip_id=? AND revoked=0 AND expires_at>? ORDER BY created_at DESC LIMIT 20').bind(actor,tripId,Date.now()).all<{token:string;expires_at:number;updated_at:string;revision:number}>()
    return json({shares:rows.results.map(row=>({token:row.token,expiresAt:row.expires_at,updatedAt:row.updated_at,revision:row.revision}))})
  }
  if (path === '/api/trips' && method === 'GET') {
    const rows = await db.prepare('SELECT payload FROM cloud_trips WHERE owner_id=? ORDER BY updated_at DESC LIMIT 200').bind(actor).all<{payload:string}>()
    return json({trips: rows.results.map(row => JSON.parse(row.payload))})
  }
  if (path === '/api/trips' && method === 'PUT') return json(await saveCloudTrip(db,actor,await body(request)))
  const privateMatch = path.match(/^\/api\/trips\/([^/]+)$/)
  if (privateMatch && method === 'GET') {
    const row = await db.prepare('SELECT payload FROM cloud_trips WHERE owner_id=? AND trip_id=?').bind(actor, decodeURIComponent(privateMatch[1])).first<{payload:string}>()
    if (!row) throw new CloudError(404,'该行程不存在或不属于当前访客。')
    return json(JSON.parse(row.payload))
  }
  if (path === '/api/shares' && method === 'POST') {
    const raw = await body(request), input = raw as {plan?:unknown;expiresInDays?:number}
    const plan = validatedPlan(input.plan ?? raw)
    const ttl = input.expiresInDays ?? 7
    if (![1,7,30].includes(ttl)) throw new CloudError(400, '分享期限请选择1天、7天或30天。')
    await saveCloudTrip(db,actor,plan)
    const now = new Date().toISOString(), revision = plan.revision ?? 1
    const snapshot = {...shareSnapshot(plan), budget:{limit:plan.budgetLimit,total:plan.budgetBreakdown.total,label:'估算，非实时报价'}, updatedAt:now, scope:`持链接的人可查看并转发；固定此版本，${ttl}天有效，可撤销。原截图、私人备注、住宿和到离信息均已排除。`}
    const old = await db.prepare('SELECT token,expires_at,payload FROM cloud_shares WHERE owner_id=? AND trip_id=? AND revision=? AND revoked=0 AND expires_at>? ORDER BY created_at DESC LIMIT 1').bind(actor,plan.tripId,revision,Date.now()).first<{token:string;expires_at:number;payload:string}>()
    if (old && JSON.stringify({...JSON.parse(old.payload),updatedAt:null}) === JSON.stringify({...snapshot,updatedAt:null}) && Math.abs(old.expires_at-Date.now()-ttl*86400000)<60000) return json({token:old.token,expiresAt:old.expires_at,snapshot:JSON.parse(old.payload)})
    const token = secretToken(), expiresAt = Date.now()+ttl*86400000
    await db.prepare('INSERT INTO cloud_shares(token,owner_id,trip_id,revision,payload,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(token,actor,plan.tripId,revision,JSON.stringify(snapshot),expiresAt,now,now).run()
    return json({token,expiresAt,snapshot},201)
  }
  const shareMatch = path.match(/^\/api\/shares\/([a-f0-9]{64})(?:\/(revoke|update))?$/)
  if (shareMatch) {
    const [, token, action] = shareMatch
    const row = await db.prepare('SELECT * FROM cloud_shares WHERE token=?').bind(token).first<{owner_id:string;trip_id:string;payload:string;expires_at:number;revoked:number}>()
    if (!row || row.revoked || row.expires_at<=Date.now()) throw new CloudError(404,'分享已失效、撤销或不存在。')
    if (!action && method === 'GET') return json({...JSON.parse(row.payload),expiresAt:row.expires_at})
    if (row.owner_id !== actor) throw new CloudError(403,'只有分享创建者可以修改或撤销。')
    if (action === 'revoke' && method === 'POST') { await db.prepare('UPDATE cloud_shares SET revoked=1 WHERE token=? AND owner_id=?').bind(token,actor).run(); return json({revoked:true}) }
    if (action === 'update' && method === 'POST') {
      const plan = validatedPlan(await body(request))
      if (plan.tripId !== row.trip_id) throw new CloudError(400,'不能把链接更新为另一份行程。')
      await saveCloudTrip(db,actor,plan)
      const updatedAt = new Date().toISOString(), snapshot = {...shareSnapshot(plan),budget:{limit:plan.budgetLimit,total:plan.budgetBreakdown.total,label:'估算，非实时报价'},updatedAt,scope:'持链接的人可查看并转发；已显式更新为当前版本，原到期时间不变。原截图、私人备注、住宿和到离信息均已排除。'}
      await db.prepare('UPDATE cloud_shares SET revision=?,payload=?,updated_at=? WHERE token=? AND owner_id=? AND revoked=0 AND expires_at>?').bind(plan.revision??1,JSON.stringify(snapshot),updatedAt,token,actor,Date.now()).run()
      return json({token,expiresAt:row.expires_at,snapshot})
    }
  }
  throw new CloudError(404,'接口不存在，或分享链接已失效。')
}
