import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { resolve, join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpus, totalmem, platform } from 'node:os'
import { performance } from 'node:perf_hooks'
import { z } from 'zod'
import { sourceSchema, evidenceSchema, claimSchema, guideSchema, entitySchema, patternSchema, ruleSchema, releaseSchema, type Source, type Unit } from '../../src/services/travel-kb/contracts'
import { retrieveKnowledge } from '../../src/services/travel-kb/retrieval'
import { RULE_VERSION } from '../../src/services/travel-kb/rules'
import { KnowledgeStore, atomicJson } from './store'
import { allowedFile, decode, discoverFiles, hash, hashObject, modelBatches, verifyEvidence } from './pipeline'

export const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const root = join(workspace, 'tools/travel-kb')
export const docs = join(workspace, 'docs/travel-kb')
const configPath = join(root, 'config/source-registry.json')
export function loadSources(): Source[] {
  const sources = z.array(sourceSchema).parse(JSON.parse(readFileSync(configPath, 'utf8')))
  return sources.map(s => ({ ...s, local_paths: s.local_paths.map(p => resolve(workspace, p)) }))
}
export function doctor() {
  const configKeys: string[] = []
  for (const name of ['.env', '.env.local']) {
    const path = join(workspace, name)
    if (existsSync(path)) for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/)
      if (m && /MODEL|PROVIDER|API_KEY|REMOTE_AI/.test(m[1])) configKeys.push(`${m[1]}:${m[2].trim() ? 'configured' : 'empty'}`)
    }
  }
  const probe = (name: string) => {
    try { const output = execFileSync('where.exe', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim(); return { status: 'AVAILABLE', path: output.split(/\r?\n/)[0] } }
    catch { return { status: 'UNAVAILABLE', reason: 'not on PATH; no install or security setting changes' } }
  }
  const result = {
    checked_at: new Date().toISOString(), workspace, node: process.version, platform: platform(), cpu: cpus()[0]?.model,
    logical_cpus: cpus().length, memory_bytes: totalmem(), tools: { node: probe('node'), adb: probe('adb'), mcporter: probe('mcporter'), opencli: probe('opencli') },
    model: { configuration_keys: configKeys, batch_api_status: 'UNTESTED', use: 'BLOCKED', reason: 'No explicit existing budget and external-content transfer scope; deterministic mode only' },
    sqlite: { status: 'AVAILABLE', evidence: 'KnowledgeStore opens SQLite and FTS5 successfully' },
    gooh: { status: 'BLOCKED', reason: 'No registered content URL or export; existing staging has 0 records. Native CUA disabled; observed Chrome tab could not be read (Debugger unattached). See gooh/access-checks.json.' },
    route: 'R0 existing ZouZou research + R6 Gooh fallback',
  }
  atomicJson(join(docs, 'capability-matrix.json'), result)
  return result
}
export function discover() {
  const paths = [join(workspace, 'research/gooh'), join(workspace, 'data/gooh-knowledge.json'), join(workspace, 'data/gooh-capture-staging.json')]
  const files = discoverFiles(paths)
  atomicJson(join(root, 'runs/latest/asset-manifest.json'), files)
  return { files: files.length, distinct_hashes: new Set(files.map(f => f.hash)).size, relevant_paths: paths, manifest: 'tools/travel-kb/runs/latest/asset-manifest.json' }
}
export function importSources(store: KnowledgeStore, sourceId?: string, limit = 1000) {
  const results: Array<Record<string, unknown>> = []
  let remaining = limit
  for (const source of loadSources().filter(s => !sourceId || s.source_id === sourceId)) {
    store.register(source)
    const current = store.source(source.source_id)!
    if (current.revoked) { results.push({ source: source.source_id, status: 'BLOCKED', reason: 'REVOKED' }); continue }
    if (!current.local_paths.length) { results.push({ source: source.source_id, status: 'BLOCKED', reason: 'NO_OBSERVED_CONTENT_ENTRY' }); continue }
    for (const path of current.local_paths) {
      try {
        const checked = allowedFile(path, current)
        if (statSync(checked).isDirectory()) throw Error('REGISTER_CONCRETE_EXPORT_FILES')
        const bytes = readFileSync(checked), fileHash = hash(bytes)
        const prior = store.checkpoint(`file:${current.source_id}:${checked}`) as { hash: string; offset: number } | null
        const data = decode(bytes, extname(checked))
        if (data.status !== 'READY') {
          store.pending(`${current.source_id}:${fileHash}`, current.source_id, data.status, 'SEMANTIC_EXTRACTION_CAPABILITY_UNAVAILABLE')
          results.push({ source: current.source_id, status: data.status }); continue
        }
        const offset = prior?.hash === fileHash ? prior.offset : 0
        if (offset === data.records.length) { results.push({ source: current.source_id, status: 'SKIPPED_UNCHANGED', records: offset }); continue }
        if (remaining <= 0) { results.push({ source: current.source_id, status: 'BUDGET_STOP' }); continue }
        const batch = data.records.slice(offset, offset + remaining)
        const consumed = offset + batch.length
        // Source checkpoint commits with records. File checkpoint is advanced afterward; a crash here replays idempotently.
        const result = store.importBatch(batch, current.source_id, { file_hash: fileHash, offset: consumed })
        store.checkpoint(`file:${current.source_id}:${checked}`, { hash: fileHash, offset: consumed })
        remaining -= batch.length
        results.push({ source: current.source_id, format: data.format, status: result.rejected ? 'FAIL' : consumed < data.records.length ? 'BUDGET_STOP' : 'PASS', ...result })
      } catch (e) { results.push({ source: current.source_id, status: 'FAIL', reason: e instanceof Error ? e.message.split('\n')[0] : 'IMPORT_ERROR' }) }
    }
  }
  if (sourceId && !loadSources().some(s => s.source_id === sourceId)) throw Error('UNKNOWN_SOURCE')
  atomicJson(join(root, 'runs/latest/import.json'), results)
  return results
}
export function authoredUnits(store: KnowledgeStore): Unit[] {
  return store.guides().filter(g => g.source_id === 'zouzou-authored-rules').map(g => ({
    unit_id: `rule:${g.record_id}`, source_id: g.source_id, record_id: g.source_record_id,
    city: '*', city_id: '*', kind: 'rule', subject: g.record_id.split(':').at(-1)!, predicate: 'planning_rule',
    value: g.title, summary: g.title, status: 'reviewed', data_origin: 'user_provided', runtime_allowed: true,
    usage: g.usage, evidence_refs: g.claims.find(c => c.predicate === 'title')!.evidence_refs,
    valid_from: null, valid_to: null, last_verified_at: null, revoked: false, conditions: [], excluded_conditions: [],
  }))
}
export function buildRelease(store: KnowledgeStore) {
  const units = authoredUnits(store)
  if (!units.length) throw Error('NO_ELIGIBLE_KNOWLEDGE_UNITS')
  const current = store.currentRelease()
  const scopeHash = hashObject(loadSources())
  const release = current && hashObject(current.units) === hashObject(units) && current.scope_hash === scopeHash
    ? current : store.buildRelease(units, scopeHash)
  // Only this sanitized, reviewed projection is eligible for the frontend bundle. Raw remains private.
  atomicJson(join(workspace, 'data/travel-kb-release.json'), release)
  return { release: release.release_id, units: release.units.length, city_facts: release.units.filter(u => u.kind === 'fact').length, feature_default: false }
}
export function exportSchemas() {
  const schemas = { source: sourceSchema, evidence: evidenceSchema, claim: claimSchema, guide: guideSchema, entity: entitySchema, pattern: patternSchema, rule: ruleSchema, release: releaseSchema }
  for (const [name, schema] of Object.entries(schemas)) atomicJson(join(root, 'schemas', `${name}.schema.json`), z.toJSONSchema(schema, { unrepresentable: 'any' }))
  return Object.keys(schemas)
}
export function performanceReport(store: KnowledgeStore) {
  const release = store.currentRelease(), timings: number[] = []
  for (let i = 0; i < 200; i++) { const t = performance.now(); retrieveKnowledge({ city: i % 2 ? '南京' : '上海', query: '预算 预约 返程' }, release); timings.push(performance.now() - t) }
  const cold = timings[0]; timings.sort((a, b) => a - b)
  const result = { cpu: cpus()[0]?.model, memory_bytes: totalmem(), node: process.version, units: release?.units.length ?? 0, queries: 200,
    first_query_ms: cold, warm_p95_ms: timings[Math.floor(timings.length * .95)], model_calls: 0, billed_tokens: 0,
    sequential_read_baseline: null, speedup: null, scope: 'local in-memory runtime release; small real rule index, no Gooh guides; not a thousand-guide benchmark' }
  atomicJson(join(root, 'runs/latest/metrics.json'), result)
  return result
}
export function report(store: KnowledgeStore) {
  const metrics = store.metrics(), knowledge = store.buildKnowledge()
  const claims = store.guides().flatMap(g => g.claims).filter(c => c.value !== null)
  const matched = claims.filter(c => verifyEvidence(c, id => store.raw(id))).length
  const result = { at: new Date().toISOString(), metrics, knowledge: { cities: knowledge.cities.length, patterns: knowledge.patterns.length, all_patterns_candidate: true },
    evidence_audit: { key_fields: claims.length, matched, automatic_source_value_match_rate: claims.length ? matched / claims.length : null, independent_accuracy: null },
    states: { engineering: store.checkpoint('verified_code_hash') === codeHash() ? 'PASS' : 'IN_PROGRESS', gooh_source: 'BLOCKED', gooh_collection: 'BLOCKED', knowledge_quality: 'BLOCKED', zouzou_integration: store.checkpoint('verified_code_hash') === codeHash() ? 'PASS' : 'IN_PROGRESS', overall: 'BLOCKED' },
    checkpoint: store.checkpoint('run'), external_blockers: ['GOOH_LIVE_ACCESS', 'GOOH_CLIENT_STATIC_RESOURCES', 'NO_APPROVED_EXTERNAL_MODEL_BUDGET', 'NO_GOOH_GOLD_EVALUATION'],
    note: 'Fixture tests and authored rules do not prove Gooh access or quality improvement. See docs/travel-kb/results/final-report.md for reviewed task states.' }
  atomicJson(join(root, 'runs/latest/report.json'), result)
  return result
}
export function codeHash() {
  const paths = execFileSync('rg', ['--files', 'tools/travel-kb', 'src/services/travel-kb'], { cwd: workspace, encoding: 'utf8' }).trim().split(/\r?\n/)
    .filter(p => /\.(ts|json)$/.test(p) && !p.includes('schemas'))
  paths.push('src/services/trip/planner.ts', 'server/travel-kb.test.ts', 'tsconfig.node.json')
  return hashObject(paths.sort().map(p => ({ path: p.replaceAll('\\', '/'), hash: hash(readFileSync(join(workspace, p))) })))
}
export async function main(args = process.argv.slice(2)): Promise<number> {
  const [command = 'doctor'] = args
  const option = (key: string) => { const i = args.indexOf(key); return i >= 0 ? args[i + 1] : undefined }
  const store = new KnowledgeStore(root)
  loadSources().forEach(s => store.register(s))
  const print = (value: unknown) => console.log(JSON.stringify(value, null, 2))
  try {
    if (command === 'doctor') { print(doctor()); return 0 }
    if (command === 'discover') { print(discover()); return 0 }
    if (['import', 'sample', 'extract', 'normalize'].includes(command)) {
      if (command === 'extract' || command === 'normalize') { print(store.reextract()); return 0 }
      const limit = Number(option('--limit') ?? (command === 'sample' ? 30 : 1000)); if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw Error('INVALID_LIMIT')
      const result = importSources(store, option('--source'), limit); print(result)
      return result.some(r => r.status === 'FAIL') ? 20 : result.some(r => r.status === 'BLOCKED') ? 10 : 0
    }
    if (command === 'build-knowledge') { print(store.buildKnowledge()); return 0 }
    if (command === 'build-release') { print(buildRelease(store)); return 0 }
    if (command === 'query') {
      const city = option('--city') ?? '上海', query = option('--query') ?? ''
      print(option('--mode') === 'research' ? store.queryResearch(city, query) : retrieveKnowledge({ city, query, date: option('--date') }, store.currentRelease())); return 0
    }
    if (command === 'withdraw') {
      const source = option('--source'); if (!source) throw Error('SOURCE_REQUIRED')
      store.withdraw(source); atomicJson(join(workspace, 'data/travel-kb-release.json'), store.currentRelease()); print({ withdrawn: source, active: store.currentRelease()?.units.length ?? 0 }); return 0
    }
    if (command === 'rollback') {
      const release = option('--release'); if (!release) throw Error('RELEASE_REQUIRED')
      store.rollback(release); atomicJson(join(workspace, 'data/travel-kb-release.json'), store.currentRelease()); print({ release }); return 0
    }
    if (command === 'validate') {
      exportSchemas()
      const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'server/travel-kb.test.ts', 'src/services/travel-kb/integration.test.ts', '--reporter=json', '--outputFile=tools/travel-kb/runs/latest/tests.json'], { cwd: workspace, stdio: 'inherit' })
      return result.status === 0 ? 0 : 20
    }
    if (command === 'evaluate') { const { evaluate } = await import('./evaluation'); print(await evaluate(store)); return 10 }
    if (command === 'report') { print(report(store)); return store.metrics().gooh_live_guides ? 0 : 10 }
    if (['run', 'update', 'resume'].includes(command)) {
      const started = new Date().toISOString()
      doctor(); discover(); exportSchemas()
      const result = importSources(store); store.reextract(); store.buildKnowledge(); buildRelease(store); performanceReport(store)
      const batches = modelBatches([])
      store.checkpoint('run', { started, ended: new Date().toISOString(), command, state: 'LOCAL_PIPELINE_COMPLETE_GOOH_BLOCKED', queued_model_batches: batches.length, revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim(), schema: '1.0.0', rule_version: RULE_VERSION })
      if (command === 'run') {
        const testResult = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'server/travel-kb.test.ts', 'src/services/travel-kb/integration.test.ts', '--reporter=json', '--outputFile=tools/travel-kb/runs/latest/tests.json'], { cwd: workspace, stdio: 'inherit' })
        if (testResult.status !== 0) { print(report(store)); return 20 }
        store.checkpoint('verified_code_hash', codeHash())
        const { evaluate } = await import('./evaluation'); await evaluate(store)
      }
      print(report(store)); return result.some(r => r.status === 'FAIL') ? 20 : 10
    }
    throw Error(`UNKNOWN_COMMAND:${command}`)
  } finally { store.close() }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code }).catch(error => { console.error(error instanceof Error ? error.message : 'INTERNAL_ERROR'); process.exitCode = 40 })
}
