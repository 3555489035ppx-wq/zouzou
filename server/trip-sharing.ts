import { DatabaseSync } from 'node:sqlite'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { parseGeneratedPlans } from '../src/services/trip/schemas'
import { shareSnapshot } from '../src/services/trip/shareSnapshot'

export class ShareError extends Error { constructor(public status:number,message:string){super(message)} }
export class TripSharingRepository {
  private db:DatabaseSync
  constructor(path=process.env.ZOUZOU_DB_PATH ?? resolve('data/group-plans.local.sqlite')) {
    this.db=new DatabaseSync(path)
    this.db.exec('CREATE TABLE IF NOT EXISTS private_shares (token TEXT PRIMARY KEY, owner_id TEXT NOT NULL, trip_id TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)')
  }
  create(ownerId:string, raw:unknown) {
    const input=raw as {plan?:unknown;expiresInDays?:number}
    const plan=parseGeneratedPlans([input?.plan??raw])?.[0]
    if(!plan?.tripId)throw new ShareError(400,'请先保存这份行程。')
    const ttl=input?.expiresInDays??7
    if(![1,7,30].includes(ttl))throw new ShareError(400,'请选择1天、7天或30天有效期。')
    // Allowlisted snapshot: no source prompts, ticket images, hotel details, identity or private notes.
    const token=randomBytes(32).toString('hex'),expiresAt=Date.now()+ttl*86400000
    const payload={...shareSnapshot(plan),budget:{limit:plan.budgetLimit,total:plan.budgetBreakdown.total,label:'估算，非实时报价'},updatedAt:plan.savedAt??new Date().toISOString(),scope:`持链接的人可查看并转发；固定此版本，${ttl}天有效，可撤销。原截图、私人备注、住宿和到离信息均已排除。`}
    const existing=this.db.prepare('SELECT token,expires_at FROM private_shares WHERE owner_id=? AND trip_id=? AND revision=? AND payload=? AND revoked=0 AND expires_at>? LIMIT 1').get(ownerId,plan.tripId,plan.revision??1,JSON.stringify(payload),Date.now()) as {token:string;expires_at:number}|undefined
    if(existing&&Math.abs(existing.expires_at-expiresAt)<60000)return {token:existing.token,expiresAt:existing.expires_at,snapshot:payload,storage:'local-server'}
    this.db.prepare('INSERT INTO private_shares (token,owner_id,trip_id,revision,payload,expires_at) VALUES (?,?,?,?,?,?)').run(token,ownerId,plan.tripId,plan.revision??1,JSON.stringify(payload),expiresAt)
    return {token,expiresAt,snapshot:payload,storage:'local-server'}
  }
  read(token:string) {
    const row=this.db.prepare('SELECT payload,expires_at,revoked FROM private_shares WHERE token=?').get(token) as {payload:string;expires_at:number;revoked:number}|undefined
    if(!row || row.revoked || row.expires_at<=Date.now())throw new ShareError(404,'分享已失效、撤销或不存在。')
    return {...JSON.parse(row.payload),expiresAt:row.expires_at}
  }
  list(ownerId:string,tripId:string) {
    const rows=this.db.prepare('SELECT token,expires_at,revision FROM private_shares WHERE owner_id=? AND trip_id=? AND revoked=0 AND expires_at>? ORDER BY expires_at DESC LIMIT 20').all(ownerId,tripId,Date.now()) as Array<{token:string;expires_at:number;revision:number}>
    return {storage:'local-server',shares:rows.map(row=>({token:row.token,expiresAt:row.expires_at,revision:row.revision}))}
  }
  update(token:string,ownerId:string,raw:unknown) {
    const row=this.db.prepare('SELECT owner_id,trip_id,expires_at,revoked FROM private_shares WHERE token=?').get(token) as {owner_id:string;trip_id:string;expires_at:number;revoked:number}|undefined
    if(!row||row.revoked||row.expires_at<=Date.now())throw new ShareError(404,'分享已失效、撤销或不存在。')
    if(row.owner_id!==ownerId)throw new ShareError(403,'只有分享创建者可以更新。')
    const plan=parseGeneratedPlans([raw])?.[0]
    if(!plan||plan.tripId!==row.trip_id)throw new ShareError(400,'不能把链接更新为另一份行程。')
    const snapshot={...shareSnapshot(plan),budget:{limit:plan.budgetLimit,total:plan.budgetBreakdown.total,label:'估算，非实时报价'},updatedAt:new Date().toISOString(),scope:'此链接已显式更新，到期时间不变；私人信息已排除。'}
    this.db.prepare('UPDATE private_shares SET payload=?,revision=? WHERE token=? AND owner_id=?').run(JSON.stringify(snapshot),plan.revision??1,token,ownerId)
    return {token,expiresAt:row.expires_at,snapshot}
  }
  revoke(token:string,ownerId:string) {
    const row=this.db.prepare('SELECT owner_id FROM private_shares WHERE token=?').get(token) as {owner_id:string}|undefined
    if(!row || row.owner_id!==ownerId)throw new ShareError(403,'只有分享创建者可以撤销。')
    this.db.prepare('UPDATE private_shares SET revoked=1 WHERE token=?').run(token)
  }
}
