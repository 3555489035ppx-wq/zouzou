import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

let database: DatabaseSync | undefined
function db() {
  if (!database) {
    database = new DatabaseSync(process.env.ZOUZOU_DB_PATH ?? resolve('data/group-plans.local.sqlite'))
    database.exec('CREATE TABLE IF NOT EXISTS device_sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)')
  }
  return database
}
export function sessionUser(request: IncomingMessage, response: ServerResponse) {
  const token = request.headers.cookie?.split(';').map(value=>value.trim()).find(value=>value.startsWith('zouzou_session='))?.slice('zouzou_session='.length)
  const existing = token ? db().prepare('SELECT user_id, expires_at FROM device_sessions WHERE token=?').get(token) as {user_id:string;expires_at:number}|undefined : undefined
  if(existing && existing.expires_at>Date.now()) { response.setHeader('X-Zouzou-User',existing.user_id); return existing.user_id }
  const userId=randomUUID(), nextToken=randomUUID()
  db().prepare('INSERT INTO device_sessions VALUES (?,?,?)').run(nextToken,userId,Date.now()+30*86400000)
  response.setHeader('Set-Cookie',`zouzou_session=${nextToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`)
  response.setHeader('X-Zouzou-User',userId)
  return userId
}

export function endSession(request:IncomingMessage,response:ServerResponse) {
  const token=request.headers.cookie?.split(';').map(value=>value.trim()).find(value=>value.startsWith('zouzou_session='))?.slice('zouzou_session='.length)
  if(token)db().prepare('DELETE FROM device_sessions WHERE token=?').run(token)
  response.setHeader('Set-Cookie','zouzou_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
}
