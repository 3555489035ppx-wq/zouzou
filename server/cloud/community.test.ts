import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommunityRepository } from '../community'
import { handleCloudCommunity, type CloudDatabase, type CloudStatement, type CloudResult } from './community'
import type { CloudDatabase as AppCloudDatabase } from './database'

const migration = readFileSync(new URL('../../migrations/0002_community.sql', import.meta.url), 'utf8')
class Statement implements CloudStatement {
  constructor(readonly owner: Adapter, readonly sql: string, readonly args: unknown[] = []) {}
  bind(...args: unknown[]) { return new Statement(this.owner, this.sql, args) }
  execute<T>(): CloudResult<T> {
    return { results: this.owner.sqlite.prepare(this.sql).all(...this.args as SQLInputValue[]) as T[], success: true }
  }
  async first<T>() { return this.execute<T>().results[0] ?? null }
  async all<T>() { return this.execute<T>() }
  async run() { return this.execute<Record<string, unknown>>() }
}
// Each batch runs synchronously inside a real SQLite transaction. Separate
// requests may race up to batch entry, but may never interleave its statements.
class Adapter implements CloudDatabase {
  sqlite = new DatabaseSync(':memory:')
  failAt: number | undefined
  constructor() { this.sqlite.exec(migration) }
  prepare(sql: string) { return new Statement(this, sql) }
  async batch<T>(statements: CloudStatement[]): Promise<CloudResult<T>[]> {
    this.sqlite.exec('BEGIN IMMEDIATE')
    try {
      const results = statements.map((statement, index) => {
        if (index === this.failAt) throw Error('synthetic D1 failure with private database details')
        if (!(statement instanceof Statement) || statement.owner !== this) throw Error('foreign statement')
        return statement.execute<T>()
      })
      this.sqlite.exec('COMMIT')
      return results
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error }
  }
  count(table: string) { return Number(this.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n) }
}
const databases: Adapter[] = [], legacy: CommunityRepository[] = []
const open = () => { const db = new Adapter(); databases.push(db); return db }
const content = { title: '成都公开测试', body: '只公开手工整理的文字', city: '成都', cover: '', experience: 'planned', stops: [{ name: '人民公园', day: '第1天', time: '10:00' }] }
const input = (expectedRevision = 0) => ({ requestId: randomUUID(), expectedRevision, nickname: '作者', content })
async function call(db: CloudDatabase, actor: string, path: string, method = 'GET', body?: unknown) {
  const response = await handleCloudCommunity(new Request(`https://example.test/api/community/${path}`, {
    method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }), db, actor)
  expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
  return { status: response.status, data: await response.json() }
}
async function publish(db: CloudDatabase, actor = 'a', id = randomUUID(), body = input()) {
  const result = await call(db, actor, `posts/${id}`, 'PUT', body)
  expect(result.status).toBe(200)
  return { id, body, data: result.data }
}
afterEach(() => { databases.splice(0).forEach(db => db.sqlite.close()); legacy.splice(0).forEach(db => db.close()); vi.restoreAllMocks() })

describe('D1 community HTTP compatibility', () => {
  it('starts empty and applies its schema without template data', async () => {
    const db = open(); db.sqlite.exec(migration)
    // Compile-time contract with the main agent's structural D1 wrapper.
    const appConnection: AppCloudDatabase = db
    const communityConnection: CloudDatabase = appConnection
    expect((await call(communityConnection, 'a', 'posts')).data).toEqual({ items: [], nextCursor: null })
    expect(db.count('community_profiles')).toBe(0)
  })
  it('matches the original repository allowlist, defaults, summary, detail and Unicode excerpt', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
    const db = open(), original = new CommunityRepository(':memory:'); legacy.push(original)
    const id = randomUUID(), body = { ...input(), owner: 'forged', tripId: 'private-trip', content: { ...content, body: '😀'.repeat(80), tickets: ['private-ticket'], stops: [{ ...content.stops[0], privateNote: 'private-note' }] } }
    expect((await call(db, 'a', `posts/${id}`, 'PUT', body)).data).toEqual(original.publish('a', id, body))
    expect((await call(db, 'reader', `posts/${id}`)).data).toEqual(original.get('reader', id))
    expect((await call(db, 'reader', 'posts')).data).toEqual(original.list('reader', 'all'))
    const summary = (await call(db, 'reader', 'posts')).data.items[0]
    expect(summary).not.toHaveProperty('body'); expect(summary).not.toHaveProperty('cover'); expect(summary).not.toHaveProperty('stops')
    expect(JSON.stringify((await call(db, 'a', `posts/${id}`)).data)).not.toContain('private-')
  })
  it('preserves publish retries, conflict messages, ownership, revisions and retraction retries', async () => {
    const db = open(), { id, body } = await publish(db)
    expect((await call(db, 'a', `posts/${id}`, 'PUT', body)).data.revision).toBe(1)
    expect((await call(db, 'a', `posts/${id}`, 'PUT', { ...body, nickname: 'changed' }))).toMatchObject({ status: 409, data: { message: '重试内容已改变，请重新确认发布' } })
    expect((await call(db, 'b', `posts/${id}`, 'PUT', input(1))).status).toBe(403)
    expect((await call(db, 'a', `posts/${id}`, 'PUT', input())).status).toBe(409)
    expect((await call(db, 'b', `posts/${id}/retract`, 'POST', { expectedRevision: 1 })).status).toBe(403)
    expect((await call(db, 'a', `posts/${id}`, 'PUT', input(1))).data.revision).toBe(2)
    for (let n = 0; n < 2; n++) expect((await call(db, 'a', `posts/${id}/retract`, 'POST', { expectedRevision: 2 })).data).toEqual({ retracted: true, revision: 3 })
    expect((await call(db, 'a', `posts/${id}`, 'PUT', body)).data).toMatchObject({ status: 'retracted', revision: 3 })
    expect((await call(db, 'b', `posts/${id}`)).status).toBe(404)
    expect((await call(db, 'b', 'posts')).data.items).toHaveLength(0)
    expect((await call(db, 'a', 'posts?mode=mine')).data.items[0].status).toBe('retracted')
    expect((await call(db, 'b', 'posts?mode=mine')).data.items).toHaveLength(0)
    expect((await call(db, 'a', `posts/${id}`, 'PUT', input(3))).data.revision).toBe(4)
    expect(db.count('community_revisions')).toBe(3)
  })
  it('isolates real likes, favorites and follows and supports removal', async () => {
    const db = open(), { id } = await publish(db)
    expect((await call(db, 'b', `posts/${id}`)).data).toMatchObject({ likes: 0, favorites: 0, liked: false, saved: false, following: false })
    for (let n = 0; n < 2; n++) {
      await call(db, 'b', `posts/${id}/reactions`, 'PUT', { kind: 'like', enabled: true })
      await call(db, 'b', `posts/${id}/reactions`, 'PUT', { kind: 'favorite', enabled: true })
      expect((await call(db, 'b', 'authors/a/follow', 'PUT', { enabled: true })).data).toEqual({ following: true })
    }
    expect((await call(db, 'b', `posts/${id}`)).data).toMatchObject({ likes: 1, favorites: 1, liked: true, saved: true, following: true })
    expect((await call(db, 'a', `posts/${id}`)).data).toMatchObject({ likes: 1, liked: false, saved: false, following: false })
    for (const mode of ['saved', 'following']) {
      expect((await call(db, 'b', `posts?mode=${mode}`)).data.items).toHaveLength(1)
      expect((await call(db, 'c', `posts?mode=${mode}`)).data.items).toHaveLength(0)
    }
    for (const kind of ['like', 'favorite']) await call(db, 'b', `posts/${id}/reactions`, 'PUT', { kind, enabled: false })
    await call(db, 'b', 'authors/a/follow', 'PUT', { enabled: false })
    expect((await call(db, 'b', `posts/${id}`)).data).toMatchObject({ likes: 0, favorites: 0, following: false })
    expect((await call(db, 'a', 'authors/a/follow', 'PUT', { enabled: true })).status).toBe(400)
    expect((await call(db, 'b', 'authors/missing/follow', 'PUT', { enabled: false })).status).toBe(400)
  })
  it('owns comments, keeps text literal, deduplicates retries and never resurrects deletions', async () => {
    const db = open(), { id } = await publish(db), comment = { id: randomUUID(), body: '<script>alert(1)</script>', nickname: '读者' }
    for (let n = 0; n < 2; n++) expect((await call(db, 'b', `posts/${id}/comments`, 'POST', comment)).status).toBe(200)
    expect((await call(db, 'b', `posts/${id}/comments`)).data.items).toEqual([{ id: comment.id, body: comment.body, nickname: comment.nickname, owned: true }])
    expect((await call(db, 'a', `posts/${id}/comments`)).data.items[0].owned).toBe(false)
    expect((await call(db, 'a', `posts/${id}/comments/${comment.id}/remove`, 'POST', {})).status).toBe(403)
    expect((await call(db, 'b', `posts/${id}/comments`, 'POST', { ...comment, body: 'changed' })).status).toBe(409)
    expect((await call(db, 'c', `posts/${id}/comments`, 'POST', comment)).status).toBe(409)
    for (let n = 0; n < 2; n++) expect((await call(db, 'b', `posts/${id}/comments/${comment.id}/remove`, 'POST', {})).data).toEqual({ deleted: true })
    await call(db, 'b', `posts/${id}/comments`, 'POST', comment)
    expect((await call(db, 'a', `posts/${id}`)).data.commentCount).toBe(0)
    expect((await call(db, 'b', `posts/${id}/comments`)).data.items).toHaveLength(0)
    const second = await publish(db)
    expect((await call(db, 'b', `posts/${second.id}/comments`, 'POST', comment)).status).toBe(409)
    expect((await call(db, 'b', `posts/${second.id}/comments/${comment.id}/remove`, 'POST', {})).status).toBe(403)
  })
  it('hides retracted posts and blocks every comment/reaction operation including author writes', async () => {
    const db = open(), { id } = await publish(db), comment = { id: randomUUID(), body: 'hi', nickname: '读者' }
    await call(db, 'b', `posts/${id}/comments`, 'POST', comment)
    await call(db, 'b', `posts/${id}/reactions`, 'PUT', { kind: 'favorite', enabled: true })
    await call(db, 'b', 'authors/a/follow', 'PUT', { enabled: true })
    await call(db, 'a', `posts/${id}/retract`, 'POST', { expectedRevision: 1 })
    for (const actor of ['a', 'b']) {
      expect((await call(db, actor, `posts/${id}/comments`)).status).toBe(404)
      expect((await call(db, actor, `posts/${id}/comments`, 'POST', { ...comment, id: randomUUID() })).status).toBe(404)
      expect((await call(db, actor, `posts/${id}/comments/${comment.id}/remove`, 'POST', {})).status).toBe(404)
      expect((await call(db, actor, `posts/${id}/reactions`, 'PUT', { kind: 'like', enabled: true })).status).toBe(404)
    }
    for (const mode of ['all', 'saved', 'following']) expect((await call(db, 'b', `posts?mode=${mode}`)).data.items).toHaveLength(0)
    expect(db.count('community_comments')).toBe(1)
    expect(db.count('community_reactions')).toBe(1)
  })
  it('paginates tied creation times without duplicates and filters cities and actors', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
    const db = open()
    for (let n = 0; n < 23; n++) await publish(db)
    await publish(db, 'c', randomUUID(), { ...input(), content: { ...content, city: '大理' } })
    const first = (await call(db, 'b', 'posts?city=成都')).data
    const second = (await call(db, 'b', `posts?city=成都&cursor=${first.nextCursor}`)).data
    expect(first.items).toHaveLength(20); expect(second.items).toHaveLength(3); expect(second.nextCursor).toBeNull()
    expect(new Set([...first.items, ...second.items].map(p => p.id)).size).toBe(23)
    expect((await call(db, 'b', 'posts?city=大理')).data.items).toHaveLength(1)
    expect((await call(db, 'c', 'posts?mode=mine')).data.items).toHaveLength(1)
    expect((await call(db, 'b', 'posts?city=不存在')).data.items).toHaveLength(0)
  })
  it('paginates 51 comments at the existing 50-comment boundary', async () => {
    const db = open(), { id } = await publish(db)
    for (let n = 0; n < 51; n++) await call(db, 'b', `posts/${id}/comments`, 'POST', { id: randomUUID(), body: `comment ${n}`, nickname: '读者' })
    const first = (await call(db, 'b', `posts/${id}/comments`)).data
    const second = (await call(db, 'b', `posts/${id}/comments?offset=${first.nextOffset}`)).data
    expect(first.items).toHaveLength(50); expect(first.nextOffset).toBe(50)
    expect(second.items).toHaveLength(1); expect(second.nextOffset).toBeNull()
    expect(new Set([...first.items, ...second.items].map(c => c.id)).size).toBe(51)
  })
  it('returns contract errors for invalid input, pagination, routes and methods', async () => {
    const db = open(), { id } = await publish(db)
    expect((await call(db, 'a', 'posts/not-uuid', 'PUT', input())).status).toBe(400)
    for (const bad of [{ ...input(), expectedRevision: -1 }, { ...input(), content: { ...content, cover: 'https://external/image.jpg' } }, { ...input(), nickname: ' ' }]) {
      expect((await call(db, 'a', `posts/${id}`, 'PUT', bad)).status).toBe(400)
    }
    for (const cursor of ['@bad', btoa('null'), btoa('{}'), btoa('{"created":"1","id":"a"}')]) expect((await call(db, 'a', `posts?cursor=${encodeURIComponent(cursor)}`)).status).toBe(400)
    for (const offset of ['-1', '0.5', 'NaN']) expect((await call(db, 'a', `posts/${id}/comments?offset=${offset}`)).status).toBe(400)
    expect((await call(db, 'a', `posts/${id}/retract`, 'POST', {})).status).toBe(409)
    expect((await call(db, 'a', `posts/${id}/reactions`, 'PUT', { kind: 'bad', enabled: true })).status).toBe(400)
    expect((await call(db, 'a', `posts/${id}/reactions`, 'PUT', { kind: 'like', enabled: 'true' })).status).toBe(404)
    expect((await call(db, 'a', `posts/${id}/comments`, 'POST', { id: randomUUID(), body: ' ', nickname: 'a' })).status).toBe(400)
    expect((await call(db, 'a', `posts/${id}`, 'DELETE')).status).toBe(404)
    expect((await call(db, 'a', 'missing')).status).toBe(404)
    expect((await call(db, 'a', 'posts/missing')).status).toBe(404)
    for (const body of ['{', 'null', '[]', '1']) {
      const response = await handleCloudCommunity(new Request(`https://example.test/api/community/posts/${id}`, { method: 'PUT', body }), db, 'a')
      expect(response.status).toBe(400)
    }
    const response = await handleCloudCommunity(new Request(`https://example.test/api/community/posts/${id}`, { method: 'PUT', body: '中'.repeat(266667) }), db, 'a')
    expect(response.status).toBe(413)
  })
})

describe('D1 community atomic concurrency', () => {
  it('allows only one competing creator and cannot overwrite another actor', async () => {
    const db = open(), id = randomUUID()
    const result = await Promise.all(['a', 'b'].map(actor => call(db, actor, `posts/${id}`, 'PUT', input())))
    expect(result.map(r => r.status).sort()).toEqual([200, 403])
    expect(db.count('community_posts')).toBe(1); expect(db.count('community_operations')).toBe(1)
    expect(db.count('community_revisions')).toBe(1); expect(db.count('community_profiles')).toBe(1)
  })
  it('deduplicates simultaneous exact publish retries', async () => {
    const db = open(), id = randomUUID(), body = input()
    const results = await Promise.all(Array.from({ length: 8 }, () => call(db, 'a', `posts/${id}`, 'PUT', body)))
    expect(results.every(r => r.status === 200 && r.data.revision === 1)).toBe(true)
    expect(db.count('community_operations')).toBe(1); expect(db.count('community_revisions')).toBe(1)
  })
  it('rejects competing revision edits without changing the winning nickname or recording the loser', async () => {
    const db = open(), { id } = await publish(db)
    const bodies = ['first', 'second'].map(nickname => ({ ...input(1), nickname }))
    const results = await Promise.all(bodies.map(body => call(db, 'a', `posts/${id}`, 'PUT', body)))
    expect(results.map(r => r.status).sort()).toEqual([200, 409])
    const winner = results.findIndex(r => r.status === 200)
    expect((await call(db, 'b', `posts/${id}`)).data).toMatchObject({ revision: 2, nickname: bodies[winner].nickname })
    expect(db.count('community_revisions')).toBe(2); expect(db.count('community_operations')).toBe(2)
  })
  it('rejects reuse of a requestId for another post or payload under concurrency', async () => {
    const db = open(), requestId = randomUUID(), ids = [randomUUID(), randomUUID()]
    const results = await Promise.all(ids.map(id => call(db, 'a', `posts/${id}`, 'PUT', { ...input(), requestId })))
    expect(results.map(r => r.status).sort()).toEqual([200, 409])
    expect(db.count('community_posts')).toBe(1); expect(db.count('community_revisions')).toBe(1)
  })
  it('serializes edit versus retract and concurrent retract retries', async () => {
    const db = open(), { id } = await publish(db)
    const results = await Promise.all([
      call(db, 'a', `posts/${id}`, 'PUT', input(1)),
      call(db, 'a', `posts/${id}/retract`, 'POST', { expectedRevision: 1 }),
    ])
    expect(results.map(r => r.status).sort()).toEqual([200, 409])
    expect((await call(db, 'a', `posts/${id}`)).data.revision).toBe(2)
    const retries = await Promise.all(Array.from({ length: 4 }, () => call(db, 'a', `posts/${id}/retract`, 'POST', { expectedRevision: 2 })))
    expect(retries.every(r => r.status === 200 && r.data.revision === 3)).toBe(true)
  })
  it('deduplicates concurrent comments/reactions and prevents conflicting comment identity changes', async () => {
    const db = open(), { id } = await publish(db), body = { id: randomUUID(), body: 'original', nickname: 'original' }
    const results = await Promise.all(Array.from({ length: 4 }, () => call(db, 'b', `posts/${id}/comments`, 'POST', body)))
    expect(results.every(r => r.status === 200)).toBe(true)
    expect((await call(db, 'b', `posts/${id}/comments`, 'POST', { ...body, body: 'conflict', nickname: 'changed' })).status).toBe(409)
    expect(db.sqlite.prepare('SELECT nickname FROM community_profiles WHERE id=?').get('b')!.nickname).toBe('original')
    await Promise.all(Array.from({ length: 4 }, () => call(db, 'b', `posts/${id}/reactions`, 'PUT', { kind: 'like', enabled: true })))
    expect(db.count('community_comments')).toBe(1); expect(db.count('community_reactions')).toBe(1)
  })
  it('rolls back every dependent publish write on failure and permits the same request to retry', async () => {
    const db = open(), { id } = await publish(db), body = { ...input(1), nickname: 'new name' }
    for (const failureIndex of [1, 2, 3, 4, 5]) {
      db.failAt = failureIndex
      expect(await call(db, 'a', `posts/${id}`, 'PUT', body)).toEqual({ status: 500, data: { message: '社区服务暂时不可用，请重试' } })
      db.failAt = undefined
      expect((await call(db, 'a', `posts/${id}`)).data).toMatchObject({ revision: 1, nickname: '作者' })
      expect(db.count('community_operations')).toBe(1); expect(db.count('community_revisions')).toBe(1)
    }
    expect((await call(db, 'a', `posts/${id}`, 'PUT', body)).data).toMatchObject({ revision: 2, nickname: 'new name' })
  })
  it('serializes retraction against comment/reaction writes with no partial profile creation', async () => {
    for (const retractFirst of [true, false]) {
      const db = open(), { id } = await publish(db)
      const retract = () => call(db, 'a', `posts/${id}/retract`, 'POST', { expectedRevision: 1 })
      const comment = () => call(db, 'reader', `posts/${id}/comments`, 'POST', { id: randomUUID(), body: 'hello', nickname: 'reader' })
      const actions = retractFirst ? [retract, comment] : [comment, retract]
      const results = await Promise.all(actions.map(action => action()))
      const commentResult = results[retractFirst ? 1 : 0]
      expect([200, 404]).toContain(commentResult.status)
      expect(db.count('community_comments')).toBe(commentResult.status === 200 ? 1 : 0)
      expect(db.count('community_profiles')).toBe(commentResult.status === 200 ? 2 : 1)
      expect((await call(db, 'reader', `posts/${id}/reactions`, 'PUT', { kind: 'like', enabled: true })).status).toBe(404)
      expect(db.count('community_reactions')).toBe(0)
      expect((await call(db, 'reader', `posts/${id}`)).status).toBe(404)
    }
  })
  it('rolls back comment profile changes and retractions when a later batch statement fails', async () => {
    const db = open(), { id } = await publish(db)
    db.failAt = 1
    expect((await call(db, 'reader', `posts/${id}/comments`, 'POST', { id: randomUUID(), body: 'hello', nickname: 'reader' })).status).toBe(500)
    expect(db.count('community_profiles')).toBe(1); expect(db.count('community_comments')).toBe(0)
    expect((await call(db, 'a', `posts/${id}/retract`, 'POST', { expectedRevision: 1 })).status).toBe(500)
    db.failAt = undefined
    expect((await call(db, 'reader', `posts/${id}`)).data).toMatchObject({ status: 'published', revision: 1 })
  })
})
