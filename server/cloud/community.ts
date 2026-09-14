import { z } from 'zod'

// Structural subset of the D1 binding; no Workers or Node runtime types required.
export interface CloudResult<T = Record<string, unknown>> {
  results: T[]
  success?: boolean
  meta?: { changes?: number }
}
export interface CloudStatement {
  bind(...args: unknown[]): CloudStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<CloudResult<T>>
  run(): Promise<{ meta?: { changes?: number } }>
}
export interface CloudDatabase {
  prepare(sql: string): CloudStatement
  batch(statements: CloudStatement[]): Promise<unknown[]>
}

// Keep the existing server/community.ts public allowlist and defaults.
const contentSchema = z.object({
  title: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(3000),
  season: z.string().trim().max(50).default(''), audience: z.string().trim().max(80).default(''),
  city: z.string().trim().min(1).max(60), experience: z.enum(['planned', 'experienced']),
  cover: z.string().max(600_000).refine(value => !value || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)),
  stops: z.array(z.object({ name: z.string().max(100), day: z.string().max(30), time: z.string().max(30) })).max(150),
})
const publishSchema = z.object({ requestId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), nickname: z.string().trim().min(1).max(40), content: contentSchema })
const commentSchema = z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(1000), nickname: z.string().trim().min(1).max(40) })
class CommunityError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
type Row = { id: string; owner: string; revision: number; status: string; payload: string; created: number; updated: number; nickname: string; likes: number; favorites: number; liked: number; saved: number; following: number; commentCount: number }
const visibleSql = "EXISTS (SELECT 1 FROM community_posts WHERE id=? AND status='published')"

// One query per page, including counts and actor-specific flags. The summary
// projection excludes the potentially large image/body before D1 returns rows.
function viewSql(detail = true) {
  const payload = detail ? 'p.payload' : `json_object(
    'title',json_extract(p.payload,'$.title'), 'city',json_extract(p.payload,'$.city'),
    'experience',json_extract(p.payload,'$.experience'), 'excerpt',json_extract(p.payload,'$.body'),
    'stopCount',json_array_length(p.payload,'$.stops'))`
  return `SELECT p.id,p.owner,p.revision,p.status,p.created,p.updated,${payload} AS payload,
    COALESCE((SELECT nickname FROM community_profiles WHERE id=p.owner),'设备访客') AS nickname,
    (SELECT count(*) FROM community_reactions WHERE post=p.id AND kind='like') AS likes,
    (SELECT count(*) FROM community_reactions WHERE post=p.id AND kind='favorite') AS favorites,
    EXISTS(SELECT 1 FROM community_reactions WHERE post=p.id AND actor=?1 AND kind='like') AS liked,
    EXISTS(SELECT 1 FROM community_reactions WHERE post=p.id AND actor=?1 AND kind='favorite') AS saved,
    EXISTS(SELECT 1 FROM community_follows WHERE actor=?1 AND author=p.owner) AS following,
    (SELECT count(*) FROM community_comments WHERE post=p.id AND deleted=0) AS commentCount
    FROM community_posts p`
}
function actorView(row: Row, actor: string) {
  const content = JSON.parse(row.payload)
  // JavaScript slices UTF-16 code units, as does the existing HTTP service.
  if (typeof content.excerpt === 'string') content.excerpt = content.excerpt.slice(0, 100)
  return { id: row.id, revision: row.revision, status: row.status, authorId: row.owner,
    nickname: row.nickname, owned: row.owner === actor,
    updatedAt: new Date(row.updated).toISOString(), ...content,
    likes: row.likes, favorites: row.favorites, liked: Boolean(row.liked), saved: Boolean(row.saved),
    commentCount: row.commentCount, following: Boolean(row.following) }
}
function requireVisible(row: Row | undefined) {
  if (!row || row.status !== 'published') throw new CommunityError(404, '内容已撤回或不存在')
  return row
}

class CloudCommunity {
  constructor(private db: CloudDatabase, private actor: string) {}
  private statement(sql: string, ...args: unknown[]) { return this.db.prepare(sql).bind(...args) }
  private post(id: string) { return this.statement(`${viewSql()} WHERE p.id=?2`, this.actor, id) }
  private async batch(statements: CloudStatement[]) {
    const result = await this.db.batch(statements) as CloudResult[]
    if (result.length !== statements.length || result.some(item => !item || item.success === false)) throw Error('D1 batch failed')
    return result
  }
  async get(id: string) {
    const row = await this.post(id).first<Row>()
    if (!row || (row.status !== 'published' && row.owner !== this.actor)) throw new CommunityError(404, '内容已撤回或不存在')
    return actorView(row, this.actor)
  }
  async list(mode: string, cursor: string, city: string) {
    let after: { created: number; id: string } | undefined
    if (cursor) {
      try {
        const bytes = Uint8Array.from(atob(cursor.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
        const parsed = JSON.parse(new TextDecoder().decode(bytes))
        if (!parsed || !Number.isFinite(parsed.created) || typeof parsed.id !== 'string') throw Error('cursor')
        after = parsed
      } catch { throw new CommunityError(400, '分页参数无效') }
    }
    const args: unknown[] = [this.actor]
    const condition = [mode === 'mine' ? 'p.owner=?1' : "p.status='published'"]
    if (mode === 'following') condition.push('EXISTS(SELECT 1 FROM community_follows f WHERE f.actor=?1 AND f.author=p.owner)')
    if (mode === 'saved') condition.push("EXISTS(SELECT 1 FROM community_reactions r WHERE r.actor=?1 AND r.post=p.id AND r.kind='favorite')")
    if (city) { condition.push("json_extract(p.payload,'$.city')=?"); args.push(city) }
    if (after) { condition.push('(p.created<? OR (p.created=? AND p.id<?))'); args.push(after.created, after.created, after.id) }
    const result = await this.statement(`${viewSql(false)} WHERE ${condition.join(' AND ')} ORDER BY p.created DESC,p.id DESC LIMIT 21`, ...args).all<Row>()
    if (result.success === false) throw Error('D1 read failed')
    const page = result.results.slice(0, 20), last = page.at(-1)
    const nextCursor = result.results.length > 20 && last
      ? btoa(JSON.stringify({ created: last.created, id: last.id })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : null
    return { items: page.map(row => actorView(row, this.actor)), nextCursor }
  }
  async publish(id: string, raw: unknown) {
    if (!z.string().uuid().safeParse(id).success) throw new CommunityError(400, '内容标识无效')
    const parsed = publishSchema.safeParse(raw)
    if (!parsed.success) throw new CommunityError(400, '请检查标题、正文、昵称或封面大小（不超过450KB）')
    const input = parsed.data, actor = this.actor, execution = crypto.randomUUID(), now = Date.now()
    const serialized = JSON.stringify({ id, ...input }), payload = JSON.stringify(input.content)
    // Claim the request only if ownership and revision match in the transaction.
    // An execution nonce gates EVERY dependent write: a replay or a losing CAS
    // cannot update the profile, resurrect a post, or append a revision.
    // D1 batch is atomic: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
    const claimed = 'EXISTS(SELECT 1 FROM community_operations WHERE owner=? AND id=? AND execution=?)'
    const claimArgs = [actor, input.requestId, execution]
    const results = await this.batch([
      this.statement(`INSERT INTO community_operations(owner,id,input,execution)
        SELECT ?,?,?,? WHERE
        (EXISTS(SELECT 1 FROM community_posts WHERE id=? AND owner=? AND revision=?)
         OR (?=0 AND NOT EXISTS(SELECT 1 FROM community_posts WHERE id=?)))
        ON CONFLICT(owner,id) DO NOTHING`, actor, input.requestId, serialized, execution, id, actor, input.expectedRevision, input.expectedRevision, id),
      this.statement(`INSERT INTO community_posts(id,owner,revision,status,payload,created,updated)
        SELECT ?,?,?,'published',?,?,? WHERE ${claimed}
        ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,status=excluded.status,payload=excluded.payload,updated=excluded.updated`,
      id, actor, input.expectedRevision + 1, payload, now, now, ...claimArgs),
      this.statement(`INSERT INTO community_revisions(post,revision,payload) SELECT ?,?,? WHERE ${claimed}`, id, input.expectedRevision + 1, payload, ...claimArgs),
      this.statement(`INSERT INTO community_profiles(id,nickname) SELECT ?,? WHERE ${claimed}
        ON CONFLICT(id) DO UPDATE SET nickname=excluded.nickname`, actor, input.nickname, ...claimArgs),
      this.statement('SELECT input FROM community_operations WHERE owner=? AND id=?', actor, input.requestId),
      this.post(id),
    ])
    const operation = results[4].results[0], row = results[5].results[0] as Row | undefined
    if (operation) {
      if (operation.input !== serialized) throw new CommunityError(409, '重试内容已改变，请重新确认发布')
      if (!row) throw new CommunityError(404, '内容不存在')
      return actorView(row, actor)
    }
    if (row && row.owner !== actor) throw new CommunityError(403, '只有作者可以修改内容')
    throw new CommunityError(409, '已有新版本，请重新打开内容再编辑')
  }
  async retract(id: string, revision: number) {
    const results = await this.batch([
      this.statement("UPDATE community_posts SET status='retracted',revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?", Date.now(), id, this.actor, Number.isFinite(revision) ? revision : null),
      this.post(id),
    ])
    const row = results[1].results[0] as Row | undefined
    if (!row || row.owner !== this.actor) throw new CommunityError(403, '只有作者可以撤回内容')
    if (row.status === 'retracted' && row.revision === revision + 1) return { retracted: true, revision: row.revision }
    throw new CommunityError(409, '已有新版本，请刷新后再撤回')
  }
  async react(id: string, kind: string, enabled: boolean) {
    // Preserve visibility-before-kind error precedence without a separate read.
    const valid = ['like', 'favorite'].includes(kind)
    const mutation = enabled
      ? this.statement(`INSERT INTO community_reactions(post,actor,kind) SELECT ?,?,? WHERE ${visibleSql} AND ?=1 ON CONFLICT DO NOTHING`, id, this.actor, kind, id, Number(valid))
      : this.statement(`DELETE FROM community_reactions WHERE post=? AND actor=? AND kind=? AND ${visibleSql} AND ?=1`, id, this.actor, kind, id, Number(valid))
    const results = await this.batch([mutation, this.post(id)])
    const row = requireVisible(results[1].results[0] as Row | undefined)
    if (!valid) throw new CommunityError(400, '互动类型无效')
    return actorView(row, this.actor)
  }
  async follow(author: string, enabled: boolean) {
    if (author === this.actor) throw new CommunityError(400, '请选择其他已发布内容的作者')
    const exists = 'EXISTS(SELECT 1 FROM community_profiles WHERE id=?)'
    const results = await this.batch([
      enabled ? this.statement(`INSERT INTO community_follows(actor,author) SELECT ?,? WHERE ${exists} ON CONFLICT DO NOTHING`, this.actor, author, author)
        : this.statement(`DELETE FROM community_follows WHERE actor=? AND author=? AND ${exists}`, this.actor, author, author),
      this.statement('SELECT id FROM community_profiles WHERE id=?', author),
    ])
    if (!results[1].results.length) throw new CommunityError(400, '请选择其他已发布内容的作者')
    return { following: enabled }
  }
  async comments(id: string, offset: number) {
    const results = await this.batch([
      this.post(id),
      this.statement(`SELECT c.id,c.body,c.actor,p.nickname FROM community_comments c
        LEFT JOIN community_profiles p ON p.id=c.actor WHERE c.post=? AND c.deleted=0 AND ${visibleSql}
        ORDER BY c.created,c.id LIMIT 51 OFFSET ?`, id, id, offset),
    ])
    requireVisible(results[0].results[0] as Row | undefined)
    const rows = results[1].results
    return { items: rows.slice(0, 50).map(row => ({ id: row.id, body: row.body, nickname: row.nickname, owned: row.actor === this.actor })), nextOffset: rows.length > 50 ? offset + 50 : null }
  }
  async comment(post: string, raw: unknown) {
    const parsed = commentSchema.safeParse(raw)
    if (!parsed.success) {
      requireVisible((await this.post(post).first<Row>()) ?? undefined)
      throw new CommunityError(400, '评论限1至1000字，请填写昵称')
    }
    const input = parsed.data
    const results = await this.batch([
      this.statement(`INSERT INTO community_profiles(id,nickname) SELECT ?,? WHERE ${visibleSql}
        AND NOT EXISTS(SELECT 1 FROM community_comments WHERE id=?)
        ON CONFLICT(id) DO UPDATE SET nickname=excluded.nickname`, this.actor, input.nickname, post, input.id),
      this.statement(`INSERT INTO community_comments(id,post,actor,body,created,deleted)
        SELECT ?,?,?,?,?,0 WHERE ${visibleSql} ON CONFLICT(id) DO NOTHING`, input.id, post, this.actor, input.body, Date.now(), post),
      this.post(post),
      this.statement('SELECT actor,post,body FROM community_comments WHERE id=?', input.id),
    ])
    requireVisible(results[2].results[0] as Row | undefined)
    const old = results[3].results[0]
    if (!old || old.actor !== this.actor || old.post !== post || old.body !== input.body) throw new CommunityError(409, '评论重试内容已变化')
    return { id: input.id }
  }
  async removeComment(post: string, id: string) {
    const results = await this.batch([
      this.statement(`UPDATE community_comments SET deleted=1 WHERE id=? AND actor=? AND post=? AND ${visibleSql}`, id, this.actor, post, post),
      this.post(post),
      this.statement('SELECT actor,post FROM community_comments WHERE id=?', id),
    ])
    requireVisible(results[1].results[0] as Row | undefined)
    const row = results[2].results[0]
    if (!row || row.actor !== this.actor || row.post !== post) throw new CommunityError(403, '只能删除自己的评论')
    return { deleted: true }
  }
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader(), chunks: Uint8Array[] = []
  let size = 0
  if (reader) {
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 800_000) { await reader.cancel(); throw new CommunityError(413, '封面过大，请压缩后再发布') }
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes))
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error('body')
    return body
  } catch { throw new CommunityError(400, '请求格式无效') }
}

// Caller supplies the verified session actor and applies CSRF and no-store.
export async function handleCloudCommunity(request: Request, db: CloudDatabase, actor: string): Promise<Response> {
  const send = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
  try {
    const url = new URL(request.url), repository = new CloudCommunity(db, actor)
    const allParts = url.pathname.split('/').filter(Boolean), parts = allParts.slice(2)
    if (allParts[0] !== 'api' || allParts[1] !== 'community') return send(404, { message: '社区接口不存在' })
    const body = request.method === 'POST' || request.method === 'PUT' ? await readBody(request) : {}
    const [resource, id, action, commentId] = parts
    if (resource === 'posts' && parts.length === 1 && request.method === 'GET') return send(200, await repository.list(url.searchParams.get('mode') ?? 'all', url.searchParams.get('cursor') ?? '', url.searchParams.get('city') ?? ''))
    if (resource === 'posts' && id && parts.length === 2) {
      if (request.method === 'GET') return send(200, await repository.get(id))
      if (request.method === 'PUT') return send(200, await repository.publish(id, body))
    }
    if (resource === 'posts' && id && parts.length === 3) {
      if (action === 'retract' && request.method === 'POST') return send(200, await repository.retract(id, Number(body.expectedRevision)))
      if (action === 'reactions' && request.method === 'PUT' && typeof body.enabled === 'boolean') return send(200, await repository.react(id, String(body.kind), body.enabled))
      if (action === 'comments' && request.method === 'POST') return send(200, await repository.comment(id, body))
      if (action === 'comments' && request.method === 'GET') {
        const offset = Number(url.searchParams.get('offset') ?? 0)
        if (!Number.isInteger(offset) || offset < 0) throw new CommunityError(400, '分页参数无效')
        return send(200, await repository.comments(id, offset))
      }
    }
    if (resource === 'posts' && action === 'comments' && parts.length === 5 && parts[4] === 'remove' && request.method === 'POST') return send(200, await repository.removeComment(id, commentId))
    if (resource === 'authors' && parts.length === 3 && action === 'follow' && request.method === 'PUT' && typeof body.enabled === 'boolean') return send(200, await repository.follow(id, body.enabled))
    return send(404, { message: '社区接口不存在' })
  } catch (error) {
    return send(error instanceof CommunityError ? error.status : 500, { message: error instanceof CommunityError ? error.message : '社区服务暂时不可用，请重试' })
  }
}
