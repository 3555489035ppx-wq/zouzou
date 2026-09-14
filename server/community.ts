import { DatabaseSync } from 'node:sqlite'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { z } from 'zod'
import { sessionUser } from './sessions'

const contentSchema = z.object({
  title: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(3000),
  season: z.string().trim().max(50).default(''), audience: z.string().trim().max(80).default(''),
  city: z.string().trim().min(1).max(60), experience: z.enum(['planned', 'experienced']),
  cover: z.string().max(600_000).refine(value => !value || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)),
  stops: z.array(z.object({ name: z.string().max(100), day: z.string().max(30), time: z.string().max(30) })).max(150),
})
const publishSchema = z.object({ requestId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), nickname: z.string().trim().min(1).max(40), content: contentSchema })
type Row = { id: string; owner: string; revision: number; status: string; payload: string; created: number; updated: number }
export class CommunityError extends Error { constructor(public status: number, message: string) { super(message) } }

export class CommunityRepository {
  private db: DatabaseSync
  constructor(path = process.env.ZOUZOU_DB_PATH ?? resolve('data/group-plans.local.sqlite')) {
    this.db = new DatabaseSync(path)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS community_profiles (id TEXT PRIMARY KEY, nickname TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS community_posts (id TEXT PRIMARY KEY, owner TEXT NOT NULL, revision INTEGER NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS community_revisions (post TEXT NOT NULL, revision INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(post,revision));
      CREATE TABLE IF NOT EXISTS community_operations (owner TEXT NOT NULL, id TEXT NOT NULL, input TEXT NOT NULL, PRIMARY KEY(owner,id));
      CREATE TABLE IF NOT EXISTS community_reactions (post TEXT NOT NULL, actor TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY(post,actor,kind));
      CREATE TABLE IF NOT EXISTS community_follows (actor TEXT NOT NULL, author TEXT NOT NULL, PRIMARY KEY(actor,author));
      CREATE TABLE IF NOT EXISTS community_comments (id TEXT PRIMARY KEY, post TEXT NOT NULL, actor TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS community_feed ON community_posts(status,created DESC,id DESC);
      CREATE INDEX IF NOT EXISTS community_comments_post ON community_comments(post,created,id);
    `)
  }
  close() { this.db.close() }
  private row(id: string) { return this.db.prepare('SELECT * FROM community_posts WHERE id=?').get(id) as Row | undefined }
  private visible(id: string) { const row = this.row(id); if (!row || row.status !== 'published') throw new CommunityError(404, '内容已撤回或不存在'); return row }
  private profile(actor: string, nickname: string) { this.db.prepare('INSERT INTO community_profiles VALUES (?,?) ON CONFLICT(id) DO UPDATE SET nickname=excluded.nickname').run(actor, nickname) }
  private view(row: Row, actor: string, detail = true) {
    const content = JSON.parse(row.payload)
    const count = (kind: string) => Number(this.db.prepare('SELECT count(*) AS n FROM community_reactions WHERE post=? AND kind=?').get(row.id, kind)?.n ?? 0)
    const has = (kind: string) => !!this.db.prepare('SELECT 1 FROM community_reactions WHERE post=? AND actor=? AND kind=?').get(row.id, actor, kind)
    return { id: row.id, revision: row.revision, status: row.status, authorId: row.owner, nickname: this.db.prepare('SELECT nickname FROM community_profiles WHERE id=?').get(row.owner)?.nickname ?? '设备访客', owned: row.owner === actor, updatedAt: new Date(row.updated).toISOString(),
      ...(detail ? content : { title: content.title, city: content.city, experience: content.experience, excerpt: content.body.slice(0, 100), stopCount: content.stops.length }),
      likes: count('like'), favorites: count('favorite'), liked: has('like'), saved: has('favorite'),
      commentCount: Number(this.db.prepare('SELECT count(*) AS n FROM community_comments WHERE post=? AND deleted=0').get(row.id)?.n ?? 0),
      following: !!this.db.prepare('SELECT 1 FROM community_follows WHERE actor=? AND author=?').get(actor, row.owner),
    }
  }
  publish(actor: string, id: string, raw: unknown) {
    if (!z.string().uuid().safeParse(id).success) throw new CommunityError(400, '内容标识无效')
    const parsed = publishSchema.safeParse(raw)
    if (!parsed.success) throw new CommunityError(400, '请检查标题、正文、昵称或封面大小（不超过450KB）')
    const input = parsed.data, serialized = JSON.stringify({ id, ...input })
    const operation = this.db.prepare('SELECT input FROM community_operations WHERE owner=? AND id=?').get(actor, input.requestId)
    if (operation) { if (operation.input !== serialized) throw new CommunityError(409, '重试内容已改变，请重新确认发布'); const current = this.row(id); if (!current) throw new CommunityError(404, '内容不存在'); return this.view(current, actor) }
    const previous = this.row(id)
    if (previous && previous.owner !== actor) throw new CommunityError(403, '只有作者可以修改内容')
    if ((previous?.revision ?? 0) !== input.expectedRevision) throw new CommunityError(409, '已有新版本，请重新打开内容再编辑')
    const revision = (previous?.revision ?? 0) + 1, now = Date.now(), payload = JSON.stringify(input.content)
    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.profile(actor, input.nickname)
      this.db.prepare('INSERT INTO community_posts VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,status=excluded.status,payload=excluded.payload,updated=excluded.updated').run(id, actor, revision, 'published', payload, previous?.created ?? now, now)
      this.db.prepare('INSERT INTO community_revisions VALUES (?,?,?)').run(id, revision, payload)
      this.db.prepare('INSERT INTO community_operations VALUES (?,?,?)').run(actor, input.requestId, serialized)
      this.db.exec('COMMIT')
    } catch (error) { this.db.exec('ROLLBACK'); throw error }
    return this.view(this.row(id)!, actor)
  }
  retract(actor: string, id: string, revision: number) {
    const row = this.row(id)
    if (!row || row.owner !== actor) throw new CommunityError(403, '只有作者可以撤回内容')
    if (row.status === 'retracted' && row.revision === revision + 1) return { retracted: true, revision: row.revision }
    if (row.revision !== revision) throw new CommunityError(409, '已有新版本，请刷新后再撤回')
    this.db.prepare("UPDATE community_posts SET status='retracted',revision=revision+1,updated=? WHERE id=?").run(Date.now(), id)
    return { retracted: true, revision: row.revision + 1 }
  }
  get(actor: string, id: string) { const row = this.row(id); if (!row || (row.status !== 'published' && row.owner !== actor)) throw new CommunityError(404, '内容已撤回或不存在'); return this.view(row, actor) }
  list(actor: string, mode: string, cursor = '', city = '') {
    let after: { created: number; id: string } | undefined
    try { after = cursor ? JSON.parse(Buffer.from(cursor, 'base64url').toString()) : undefined } catch { throw new CommunityError(400, '分页参数无效') }
    if (after && (!Number.isFinite(after.created) || typeof after.id !== 'string')) throw new CommunityError(400, '分页参数无效')
    const rows = this.db.prepare(`SELECT p.* FROM community_posts p WHERE ${mode === 'mine' ? 'p.owner=?' : "p.status='published'"}
      ${mode === 'following' ? 'AND EXISTS (SELECT 1 FROM community_follows f WHERE f.actor=? AND f.author=p.owner)' : ''}
      ${mode === 'saved' ? "AND EXISTS (SELECT 1 FROM community_reactions r WHERE r.actor=? AND r.post=p.id AND r.kind='favorite')" : ''}
      ${city ? "AND json_extract(p.payload,'$.city')=?" : ''}
      ${after ? 'AND (p.created<? OR (p.created=? AND p.id<?))' : ''}
      ORDER BY p.created DESC,p.id DESC LIMIT 21`).all(...(mode === 'mine' || mode === 'following' || mode === 'saved' ? [actor] : []), ...(city ? [city] : []), ...(after ? [after.created, after.created, after.id] : [])) as Row[]
    const page = rows.slice(0, 20), last = page.at(-1)
    return { items: page.map(row => this.view(row, actor, false)), nextCursor: rows.length > 20 && last ? Buffer.from(JSON.stringify({ created: last.created, id: last.id })).toString('base64url') : null }
  }
  react(actor: string, id: string, kind: string, enabled: boolean) {
    this.visible(id)
    if (!['like', 'favorite'].includes(kind)) throw new CommunityError(400, '互动类型无效')
    if (enabled) this.db.prepare('INSERT OR IGNORE INTO community_reactions VALUES (?,?,?)').run(id, actor, kind)
    else this.db.prepare('DELETE FROM community_reactions WHERE post=? AND actor=? AND kind=?').run(id, actor, kind)
    return this.get(actor, id)
  }
  follow(actor: string, author: string, enabled: boolean) {
    if (actor === author || !this.db.prepare('SELECT 1 FROM community_profiles WHERE id=?').get(author)) throw new CommunityError(400, '请选择其他已发布内容的作者')
    if (enabled) this.db.prepare('INSERT OR IGNORE INTO community_follows VALUES (?,?)').run(actor, author)
    else this.db.prepare('DELETE FROM community_follows WHERE actor=? AND author=?').run(actor, author)
    return { following: enabled }
  }
  comments(actor: string, id: string, offset = 0) {
    this.visible(id)
    const rows = this.db.prepare('SELECT c.id,c.body,c.created,c.actor,p.nickname FROM community_comments c LEFT JOIN community_profiles p ON p.id=c.actor WHERE c.post=? AND c.deleted=0 ORDER BY c.created,c.id LIMIT 51 OFFSET ?').all(id, offset)
    return { items: rows.slice(0, 50).map(row => ({ id: row.id, body: row.body, nickname: row.nickname, owned: row.actor === actor })), nextOffset: rows.length > 50 ? offset + 50 : null }
  }
  comment(actor: string, post: string, raw: unknown) {
    this.visible(post)
    const parsed = z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(1000), nickname: z.string().trim().min(1).max(40) }).safeParse(raw)
    if (!parsed.success) throw new CommunityError(400, '评论限1至1000字，请填写昵称')
    const input = parsed.data, old = this.db.prepare('SELECT * FROM community_comments WHERE id=?').get(input.id)
    if (old && (old.actor !== actor || old.post !== post || old.body !== input.body)) throw new CommunityError(409, '评论重试内容已变化')
    if (!old) { this.profile(actor, input.nickname); this.db.prepare('INSERT INTO community_comments VALUES (?,?,?,?,?,0)').run(input.id, post, actor, input.body, Date.now()) }
    return { id: input.id }
  }
  removeComment(actor: string, post: string, id: string) {
    this.visible(post)
    const row = this.db.prepare('SELECT actor,post FROM community_comments WHERE id=?').get(id)
    if (!row || row.actor !== actor || row.post !== post) throw new CommunityError(403, '只能删除自己的评论')
    this.db.prepare('UPDATE community_comments SET deleted=1 WHERE id=?').run(id)
    return { deleted: true }
  }
}

let repository: CommunityRepository | undefined
export async function handleCommunityRequest(request: IncomingMessage, response: ServerResponse) {
  const send = (status: number, value: unknown) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)) }
  try {
    repository ??= new CommunityRepository()
    const actor = sessionUser(request, response), url = new URL(request.url!, 'http://localhost'), parts = url.pathname.split('/').filter(Boolean).slice(2)
    let body: Record<string, unknown> = {}
    if (request.method === 'POST' || request.method === 'PUT') {
      let size = 0; const chunks: Buffer[] = []
      for await (const chunk of request) { size += chunk.length; if (size > 800_000) throw new CommunityError(413, '封面过大，请压缩后再发布'); chunks.push(Buffer.from(chunk)) }
      try { body = JSON.parse(Buffer.concat(chunks).toString()) } catch { throw new CommunityError(400, '请求格式无效') }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CommunityError(400, '请求格式无效')
    }
    const [resource, id, action, commentId] = parts
    if (resource === 'posts' && parts.length === 1 && request.method === 'GET') return send(200, repository.list(actor, url.searchParams.get('mode') ?? 'all', url.searchParams.get('cursor') ?? '', url.searchParams.get('city') ?? ''))
    if (resource === 'posts' && id && parts.length === 2) {
      if (request.method === 'GET') return send(200, repository.get(actor, id))
      if (request.method === 'PUT') return send(200, repository.publish(actor, id, body))
    }
    if (resource === 'posts' && id && parts.length === 3) {
      if (action === 'retract' && request.method === 'POST') return send(200, repository.retract(actor, id, Number(body.expectedRevision)))
      if (action === 'reactions' && request.method === 'PUT' && typeof body.enabled === 'boolean') return send(200, repository.react(actor, id, String(body.kind), body.enabled))
      if (action === 'comments' && request.method === 'POST') return send(200, repository.comment(actor, id, body))
      if (action === 'comments' && request.method === 'GET') { const offset = Number(url.searchParams.get('offset') ?? 0); if (!Number.isInteger(offset) || offset < 0) throw new CommunityError(400, '分页参数无效'); return send(200, repository.comments(actor, id, offset)) }
    }
    if (resource === 'posts' && action === 'comments' && parts.length === 5 && parts[4] === 'remove' && request.method === 'POST') return send(200, repository.removeComment(actor, id, commentId))
    if (resource === 'authors' && parts.length === 3 && action === 'follow' && request.method === 'PUT' && typeof body.enabled === 'boolean') return send(200, repository.follow(actor, id, body.enabled))
    send(404, { message: '社区接口不存在' })
  } catch (error) { send(error instanceof CommunityError ? error.status : 500, { message: error instanceof CommunityError ? error.message : '社区服务暂时不可用，请重试' }) }
}
