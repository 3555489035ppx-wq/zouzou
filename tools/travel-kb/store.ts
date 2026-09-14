import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { guideSchema, releaseSchema, patternSchema, type Source, type Guide, type Release, type Unit, type Entity, type Claim } from '../../src/services/travel-kb/contracts'
import { tokenize, eligibleUnit } from '../../src/services/travel-kb/retrieval'
import { RULE_VERSION } from '../../src/services/travel-kb/rules'
import { hashObject, normalizeRecord, routeSignature, conflicts, verifyEvidence, redactText, entityMatch, pointer, canonical } from './pipeline'

export function atomicJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true }); const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' }); renameSync(temp, path)
}
export class KnowledgeStore {
  db: DatabaseSync
  constructor(readonly root: string) {
    mkdirSync(join(root, 'private'), { recursive: true })
    this.db = new DatabaseSync(join(root, 'private/state.sqlite'))
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, source_id TEXT NOT NULL, record_id TEXT NOT NULL, hash TEXT NOT NULL, raw TEXT NOT NULL, guide TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, UNIQUE(source_id,record_id,hash));
      CREATE TABLE IF NOT EXISTS checkpoints(id TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS queue(id TEXT PRIMARY KEY, source_id TEXT NOT NULL, status TEXT NOT NULL, reason TEXT, attempts INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS entities(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS merges(id TEXT PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, reason TEXT NOT NULL, evidence TEXT NOT NULL, active INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, action TEXT NOT NULL, subject TEXT NOT NULL, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS units(id TEXT PRIMARY KEY, source_id TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE VIRTUAL TABLE IF NOT EXISTS unit_search USING fts5(id UNINDEXED, tokens);`)
  }
  close() { this.db.close() }
  transaction<T>(f: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try { const result = f(); this.db.exec('COMMIT'); return result } catch (e) { this.db.exec('ROLLBACK'); throw e }
  }
  checkpoint(id: string, value?: unknown): unknown {
    if (value !== undefined) this.db.prepare('INSERT INTO checkpoints VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(id, JSON.stringify(value))
    const row = this.db.prepare('SELECT value FROM checkpoints WHERE id=?').get(id) as { value: string } | undefined
    return row ? JSON.parse(row.value) : null
  }
  register(source: Source) {
    const existing = this.source(source.source_id)
    // A config reload must never silently undo a recorded withdrawal.
    this.db.prepare('INSERT INTO sources VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(source.source_id, JSON.stringify({ ...source, revoked: source.revoked || existing?.revoked === true }))
  }
  source(id: string): Source | null {
    const row = this.db.prepare('SELECT payload FROM sources WHERE id=?').get(id) as { payload: string } | undefined
    return row ? JSON.parse(row.payload) : null
  }
  pending(id: string, source: string, status: string, reason: string) {
    this.db.prepare('INSERT INTO queue VALUES(?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET status=excluded.status,reason=excluded.reason,attempts=queue.attempts+1').run(id, source, status, redactText(reason).slice(0, 500))
  }
  importBatch(raws: unknown[], sourceId: string, cursor: unknown = null, simulateCrash = false) {
    const source = this.source(sourceId)
    if (!source || source.revoked || source.usage.read !== 'approved' || source.usage.export !== 'approved') throw Error('SCOPE_DENIED')
    const stats = { accepted: 0, unchanged: 0, rejected: 0, partial: 0 }
    const dbBytes = statSync(join(this.root, 'private/state.sqlite')).size
    const incomingBytes = raws.reduce<number>((bytes, raw) => bytes + Buffer.byteLength(JSON.stringify(raw)), 0)
    if (dbBytes + incomingBytes > 1073741824) throw Error('RAW_STORAGE_BUDGET_STOP')
    return this.transaction(() => {
      for (let i = 0; i < raws.length; i++) {
        let parsed: ReturnType<typeof normalizeRecord>
        try { parsed = normalizeRecord(raws[i], source) } catch (e) {
          stats.rejected++; this.pending(`${sourceId}:rejected:${hashObject(raws[i])}`, sourceId, 'QUARANTINED', e instanceof Error ? e.message : 'PARSE_ERROR'); continue
        }
        const { raw, guide, entities } = parsed
        const h = hashObject(raw)
        const existing = this.db.prepare('SELECT id,active FROM records WHERE source_id=? AND record_id=? AND hash=?').get(sourceId, guide.record_id, h) as { id: string; active: number } | undefined
        if (existing?.active) { stats.unchanged++; continue }
        // Evidence is checked against the exact sanitized representation before commit.
        if (!guide.claims.every(c => verifyEvidence(c, () => raw))) { stats.rejected++; this.pending(guide.source_record_id, sourceId, 'QUARANTINED', 'EVIDENCE_MISMATCH'); continue }
        this.db.prepare('UPDATE records SET active=0 WHERE source_id=? AND record_id=?').run(sourceId, guide.record_id)
        if (existing) this.db.prepare('UPDATE records SET active=1 WHERE id=?').run(existing.id)
        else this.db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?,1)').run(guide.source_record_id, sourceId, guide.record_id, h, JSON.stringify(raw), JSON.stringify(guide))
        for (const e of entities) this.db.prepare('INSERT INTO entities VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(e.canonical_id, JSON.stringify(e))
        this.pending(guide.source_record_id, sourceId, 'SUCCEEDED', 'DETERMINISTIC_PARSE')
        stats.accepted++; if (guide.completeness === 'partial') stats.partial++
      }
      this.checkpoint(`source:${sourceId}`, { cursor, at: new Date().toISOString(), stats })
      if (simulateCrash) throw Error('SIMULATED_TRANSACTION_CRASH')
      return stats
    })
  }
  guides(): Guide[] {
    return (this.db.prepare('SELECT guide,source_id FROM records WHERE active=1').all() as Array<{ guide: string; source_id: string }>).filter(r => !this.source(r.source_id)?.revoked).map(r => guideSchema.parse(JSON.parse(r.guide)))
  }
  reextract() {
    const records = this.db.prepare('SELECT id,raw,guide,source_id FROM records WHERE active=1').all() as Array<{ id: string; raw: string; guide: string; source_id: string }>
    let processed = 0
    this.transaction(() => {
      for (const row of records) {
        const source = this.source(row.source_id)
        if (!source || source.revoked || source.usage.read !== 'approved') continue
        const previous = JSON.parse(row.guide) as Guide
        const next = normalizeRecord(JSON.parse(row.raw), source, previous.claims[0]?.collected_at).guide
        if (!next.claims.every(c => verifyEvidence(c, id => this.raw(id)))) throw Error('REEXTRACT_EVIDENCE_MISMATCH')
        if (canonical(next) !== canonical(previous)) { this.db.prepare('UPDATE records SET guide=? WHERE id=?').run(JSON.stringify(next), row.id); processed++ }
      }
      this.checkpoint('extractor_version', 'deterministic-1.1.0')
    })
    return { updated: processed, inspected: records.length, model_calls: 0 }
  }
  raw(id: string) { const row = this.db.prepare('SELECT raw FROM records WHERE id=?').get(id) as { raw: string } | undefined; return row ? JSON.parse(row.raw) : null }
  entities(): Entity[] { return (this.db.prepare('SELECT payload FROM entities').all() as Array<{ payload: string }>).map(r => JSON.parse(r.payload)) }
  merge(from: string, to: string, evidence: string[]) {
    const a = this.entities().find(e => e.canonical_id === from), b = this.entities().find(e => e.canonical_id === to)
    if (!a || !b || from === to || entityMatch(a, b) !== 'same' || !evidence.length) throw Error('MERGE_REQUIRES_STRONG_EVIDENCE')
    if (this.resolveEntity(to) === from) throw Error('MERGE_CYCLE')
    const id = hashObject({ from, to, evidence })
    this.db.prepare('INSERT INTO merges VALUES(?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET active=1').run(id, from, to, 'stable_id_or_confirmed_address', JSON.stringify(evidence))
    return id
  }
  undoMerge(id: string) { this.db.prepare('UPDATE merges SET active=0 WHERE id=?').run(id) }
  resolveEntity(id: string): string {
    const seen = new Set<string>(); let current = id
    while (!seen.has(current)) { seen.add(current); const row = this.db.prepare('SELECT to_id FROM merges WHERE from_id=? AND active=1 ORDER BY rowid DESC LIMIT 1').get(current) as { to_id: string } | undefined; if (!row) return current; current = row.to_id }
    throw Error('MERGE_CYCLE')
  }
  buildKnowledge() {
    const guides = this.guides().filter(g => g.city.name !== '*'), allClaims = guides.flatMap(g => g.claims)
    const conflicting = conflicts(allClaims)
    const signatures = new Map<string, Guide[]>()
    for (const g of guides) { const sig = routeSignature(g); signatures.set(sig, [...(signatures.get(sig) ?? []), g]) }
    const patterns = [...signatures].map(([sig, group]) => patternSchema.parse({ pattern_id: sig, version: '1.0.0', city_scope: [group[0].city.canonical_id],
      scenario: group[0].theme ?? 'unknown', applicable_conditions: [`${group[0].duration_days} days; source dates and user constraints must be rechecked`],
      excluded_conditions: ['unverified opening, booking or transit'], recommended_sequence: group[0].days.map(d => d.visits.map(v => v.poi_ref)),
      supporting_record_ids: group.map(g => g.source_record_id), independent_source_cluster_count: 1,
      counterexamples: [], evidence_refs: group[0].claims.flatMap(c => c.evidence_refs).slice(0, 2), status: 'candidate' }))
    const cities = [...new Set(guides.map(g => g.city.canonical_id))].map(id => ({ city_id: id, city: guides.find(g => g.city.canonical_id === id)!.city.name,
      record_ids: guides.filter(g => g.city.canonical_id === id).map(g => g.source_record_id),
      gaps: ['官方地址/营业/预约/交通需逐字段核验', '餐次与住宿区域未形成审核知识'],
      food: guides.filter(g => g.city.canonical_id === id).flatMap(g => g.claims.filter(c => c.predicate === 'food')),
      transport_evidence: guides.filter(g => g.city.canonical_id === id).flatMap(g => g.claims.filter(c => c.predicate === 'transport')),
      pitfalls: guides.filter(g => g.city.canonical_id === id).flatMap(g => g.claims.filter(c => c.predicate === 'tips')),
      stay_areas: { status: 'unknown', value: null, reason: 'No accommodation area in the registered exports' }, status: 'observed_research_only' }))
    const output = { cities, patterns, conflict_groups: conflicting, claims: allClaims.length, guides: guides.length }
    atomicJson(join(this.root, 'private/knowledge.json'), output)
    return output
  }
  setUnits(units: Unit[]) {
    this.transaction(() => {
      this.db.exec('DELETE FROM units; DELETE FROM unit_search;')
      for (const u of units) {
        this.db.prepare('INSERT INTO units VALUES(?,?,?)').run(u.unit_id, u.source_id, JSON.stringify(u))
        this.db.prepare('INSERT INTO unit_search VALUES(?,?)').run(u.unit_id, tokenize(`${u.city} ${u.subject} ${u.summary}`).join(' '))
      }
    })
  }
  queryResearch(city: string, query: string, limit = 20) {
    // The private research index returns observed claims with their status; it is not a runtime release.
    return this.guides().filter(g => g.city.name === city).flatMap(g => g.claims.filter(c => c.value !== null && `${c.predicate} ${JSON.stringify(c.value)}`.includes(query))).slice(0, limit)
  }
  currentRelease(): Release | null {
    const id = this.checkpoint('current_release') as string | null
    if (!id) return null
    const r = releaseSchema.parse(JSON.parse(readFileSync(join(this.root, 'knowledge/releases', id, 'release.json'), 'utf8')))
    if (this.checkpoint(`release_hash:${id}`) !== hashObject(r)) throw Error('RELEASE_HASH_MISMATCH')
    return { ...r, units: r.units.filter(u => { const s = this.source(u.source_id); return s && !s.revoked && s.usage.runtime === 'approved' && s.usage.export === 'approved' }) }
  }
  buildRelease(units: Unit[], scopeHash: string, now = new Date()) {
    for (const u of units) {
      const s = this.source(u.source_id)
      if (!s || s.revoked || s.usage.runtime !== 'approved' || s.usage.export !== 'approved' || !eligibleUnit(u, { city: u.city, query: u.subject, date: now.toISOString(), preferences: u.conditions }, now)) throw Error(`RELEASE_USAGE_OR_FRESHNESS_REJECTED:${u.unit_id}`)
      if (redactText(u.summary) !== u.summary) throw Error('RELEASE_PRIVACY_REJECTED')
      for (const e of u.evidence_refs) {
        const raw = this.raw(e.source_record_id)
        if (!raw || hashObject(raw) !== e.source_hash || e.kind !== 'json_pointer' || pointer(raw, e.locator) === undefined
          || canonical(pointer(raw, e.locator)) !== canonical(u.value)) throw Error('RELEASE_EVIDENCE_MISSING_OR_MISMATCHED')
      }
      if (u.kind === 'rule' && (u.source_id !== 'zouzou-authored-rules' || !['R-01', 'R-04', 'R-06', 'R-08'].includes(u.subject))) throw Error('RULE_REVIEW_REQUIRED')
      // External facts need a separate authoritative verification activity, never an import label.
      if (u.kind === 'fact' && !this.checkpoint(`verified:${u.unit_id}`)) throw Error('RELEASE_VERIFICATION_MISSING')
    }
    const previous = this.checkpoint('current_release') as string | null
    const release = releaseSchema.parse({ schema_version: '1.0.0', release_id: `kb-${hashObject({ units, scopeHash, previous }).slice(0, 20)}`,
      created_at: now.toISOString(), previous, scope_hash: scopeHash, units, source_ids: [...new Set(units.map(u => u.source_id))], rule_version: RULE_VERSION,
      quality: { schema: true, evidence: true, usage: true, privacy: true } })
    const path = join(this.root, 'knowledge/releases', release.release_id, 'release.json')
    if (!existsSync(path)) atomicJson(path, release)
    else if (hashObject(JSON.parse(readFileSync(path, 'utf8'))) !== hashObject(release)) throw Error('IMMUTABLE_RELEASE_COLLISION')
    this.transaction(() => { this.checkpoint(`release_hash:${release.release_id}`, hashObject(release)); this.checkpoint('current_release', release.release_id) })
    this.setUnits(units)
    return release
  }
  rollback(id: string) {
    if (!/^kb-[a-f0-9]{20}$/.test(id)) throw Error('INVALID_RELEASE_ID')
    const r = releaseSchema.parse(JSON.parse(readFileSync(join(this.root, 'knowledge/releases', id, 'release.json'), 'utf8')))
    if (this.checkpoint(`release_hash:${id}`) !== hashObject(r)) throw Error('RELEASE_HASH_MISMATCH')
    this.checkpoint('current_release', id)
    this.setUnits(this.currentRelease()!.units)
  }
  withdraw(sourceId: string) {
    const source = this.source(sourceId); if (!source) throw Error('UNKNOWN_SOURCE')
    this.transaction(() => {
      this.register({ ...source, revoked: true })
      this.db.prepare('UPDATE queue SET status=? WHERE source_id=?').run('BLOCKED', sourceId)
      this.db.prepare('DELETE FROM unit_search WHERE id IN (SELECT id FROM units WHERE source_id=?)').run(sourceId)
      this.db.prepare('DELETE FROM units WHERE source_id=?').run(sourceId)
      this.db.prepare('INSERT INTO audit(action,subject,at) VALUES(?,?,?)').run('withdraw', sourceId, new Date().toISOString())
      this.checkpoint('withdrawal_epoch', Date.now())
    })
    this.buildKnowledge()
  }
  metrics() {
    const guides = this.guides()
    const by_source = [...new Set(guides.map(g => g.source_id))].map(source_id => {
      const items = guides.filter(g => g.source_id === source_id)
      return { source_id, product: this.source(source_id)?.product, unique_guides: items.length, complete: items.filter(g => g.completeness === 'complete').length,
        partial: items.filter(g => g.completeness === 'partial').length, cities: [...new Set(items.map(g => g.city.name))], unique_pois: new Set(items.flatMap(g => g.days.flatMap(d => d.visits.map(v => v.poi_ref)))).size }
    })
    return { by_source, gooh_live_guides: guides.filter(g => g.data_origin !== 'synthetic_fixture' && this.source(g.source_id)?.product === 'Gooh').length,
      total_available: null, queue: this.db.prepare('SELECT status,COUNT(*) AS count FROM queue GROUP BY status').all(),
      versions: (this.db.prepare('SELECT COUNT(*) AS count FROM records').get() as { count: number }).count }
  }
}
