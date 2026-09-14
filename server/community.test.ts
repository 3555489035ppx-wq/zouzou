import { afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { CommunityRepository } from './community'

const databases: CommunityRepository[] = []
const open = () => { const db = new CommunityRepository(':memory:'); databases.push(db); return db }
const content = { title: '成都公开测试', body: '只公开手工整理的文字', city: '成都', cover: '', experience: 'planned', stops: [{ name: '人民公园', day: '第1天', time: '10:00' }] }
const input = (expectedRevision = 0) => ({ requestId: randomUUID(), expectedRevision, nickname: '作者', content })
afterEach(() => databases.splice(0).forEach(db => db.close()))
describe('02 public community ownership and snapshots', () => {
  it('allowlists public fields, strips private data and keeps summary payload small', () => {
    const db = open(), id = randomUUID()
    const post = db.publish('owner', id, { ...input(), tripId: 'private-trip', owner: 'forged', content: { ...content, tickets: ['secret'], sourcePrompt: 'private', stops: [{ ...content.stops[0], privateNote: 'private' }] } })
    expect(post.authorId).toBe('owner'); expect(JSON.stringify(post)).not.toContain('private')
    const summary = db.list('reader', 'all').items[0]
    expect(summary).not.toHaveProperty('body'); expect(summary).not.toHaveProperty('cover'); expect(summary).not.toHaveProperty('stops')
    expect(db.get('reader', id).body).toBe(content.body)
  })
  it('retries once, rejects conflicting versions and blocks foreign edits and retraction', () => {
    const db = open(), id = randomUUID(), first = input()
    expect(db.publish('a', id, first).revision).toBe(1)
    expect(db.publish('a', id, first).revision).toBe(1)
    expect(db.list('b', 'all').items).toHaveLength(1)
    expect(() => db.publish('a', id, { ...first, content: { ...content, body: 'changed' } })).toThrow('重试内容')
    expect(() => db.publish('b', id, input(1))).toThrow('只有作者')
    expect(() => db.publish('a', id, input())).toThrow('新版本')
    expect(() => db.retract('b', id, 1)).toThrow('只有作者')
    expect(db.publish('a', id, input(1)).revision).toBe(2)
    expect(db.retract('a', id, 2).revision).toBe(3)
    expect(db.retract('a', id, 2).revision).toBe(3)
    expect(() => db.get('b', id)).toThrow('撤回')
    expect(db.list('b', 'all').items).toHaveLength(0)
    expect(db.get('a', id).status).toBe('retracted')
  })
  it('uses unique per-session reactions and follow relations, without fake totals', () => {
    const db = open(), id = randomUUID(); db.publish('a', id, input())
    expect(db.get('b', id).likes).toBe(0)
    db.react('b', id, 'like', true); db.react('b', id, 'like', true)
    expect(db.get('a', id).likes).toBe(1); expect(db.get('a', id).liked).toBe(false)
    db.react('b', id, 'favorite', true); expect(db.list('b', 'saved').items).toHaveLength(1)
    expect(db.list('c', 'saved').items).toHaveLength(0)
    db.follow('b', 'a', true); db.follow('b', 'a', true)
    expect(db.list('b', 'following').items).toHaveLength(1)
    db.follow('b', 'a', false); expect(db.list('b', 'following').items).toHaveLength(0)
    db.react('b', id, 'like', false); expect(db.get('a', id).likes).toBe(0)
  })
  it('owns comments by server actor, deduplicates retries and does not resurrect deleted comments', () => {
    const db = open(), id = randomUUID(), comment = { id: randomUUID(), body: '<script>alert(1)</script>', nickname: '读者' }
    db.publish('a', id, input()); db.comment('b', id, comment); db.comment('b', id, comment)
    expect(db.get('a', id).commentCount).toBe(1)
    expect(db.comments('b', id).items[0].owned).toBe(true)
    expect(db.comments('a', id).items[0].owned).toBe(false)
    expect(() => db.removeComment('a', id, comment.id)).toThrow('自己的')
    db.removeComment('b', id, comment.id); db.comment('b', id, comment)
    expect(db.get('a', id).commentCount).toBe(0)
    db.retract('a', id, 1); expect(() => db.comment('b', id, { ...comment, id: randomUUID() })).toThrow('撤回')
  })
  it('pages stable summaries and filters actual city content', () => {
    const db = open(); for (let i = 0; i < 23; i++) db.publish('a', randomUUID(), input())
    const first = db.list('b', 'all'), second = db.list('b', 'all', first.nextCursor!)
    expect(first.items).toHaveLength(20); expect(second.items).toHaveLength(3)
    expect(new Set([...first.items, ...second.items].map(post => post.id)).size).toBe(23)
    expect(db.list('b', 'all', '', '大理').items).toHaveLength(0)
  })
})
