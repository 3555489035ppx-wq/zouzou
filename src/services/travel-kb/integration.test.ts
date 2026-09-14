import { afterEach, describe, expect, it, vi } from 'vitest'
import approved from '../../../data/travel-kb-release.json'
import { generatePlans, understandTrip, selectPlanOption, readSavedPlans, updateGeneratedPlan, type GeneratedPlan } from '../trip/planner'
import { parseRelease, retrieveKnowledge } from './retrieval'
import { planningKnowledge } from './integration'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return { get length() { return values.size }, clear: () => values.clear(), getItem: k => values.get(k) ?? null,
    key: n => [...values.keys()][n] ?? null, removeItem: k => { values.delete(k) }, setItem: (k, v) => { values.set(k, v) } }
}
const intent = () => understandTrip({ text: '2026年9月18日去上海2天1晚，两人预算4000元，喜欢看展和本地菜，09:00到虹桥，19:00从虹桥返程。', media: [] }).intent
const release = () => parseRelease(approved)
function browserStore() { vi.stubGlobal('window', { localStorage: memoryStorage(), sessionStorage: memoryStorage(), dispatchEvent: vi.fn() }) }
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('knowledge on the original ZouZou generation path', () => {
  it('QA-51 original generatePlans retrieves actual authored knowledge with source and release provenance', () => {
    const plans = generatePlans(intent(), undefined, { enabled: true, release: release() })
    expect(plans).toHaveLength(3)
    for (const p of plans) {
      expect(p.knowledgeTrace?.bundle.release).toBe(release().release_id)
      expect(p.knowledgeTrace?.bundle.units).toHaveLength(4)
      expect(p.knowledgeTrace?.bundle.provenance.every(e => e.source_id === 'zouzou-authored-rules')).toBe(true)
      expect(p.knowledgeTrace?.validation.results).toHaveLength(24)
      expect(p.knowledgeTrace?.bundle.gaps.join('')).toContain('城市事实')
    }
  })
  it('QA-52 disabling the flag keeps baseline scheduling and old saved Trip reads', () => {
    browserStore()
    const i = intent(), off = generatePlans(i, undefined, { enabled: false })
    const on = generatePlans(i, undefined, { enabled: true, release: release() })
    expect(off[0].knowledgeTrace).toBeUndefined(); expect(on[0].days).toEqual(off[0].days)
    const saved = selectPlanOption(off[0]); expect(readSavedPlans()?.[0].tripId).toBe(saved.tripId); expect(readSavedPlans()?.[0].knowledgeTrace).toBeUndefined()
  })
  it('QA-53 saved Trip and local tools retain the same identity and knowledge release during edits', () => {
    browserStore()
    const selected = selectPlanOption(generatePlans(intent(), undefined, { enabled: true, release: release() })[0])
    expect(readSavedPlans()?.[0].knowledgeTrace?.bundle.release).toBe(release().release_id)
    const days = structuredClone(selected.days), firstDay = Object.keys(days)[0]
    days[firstDay][1].durationMinutes += 15
    const edited = updateGeneratedPlan(selected, days)
    expect(edited.tripId).toBe(selected.tripId); expect(edited.knowledgeTrace?.bundle.release).toBe(selected.knowledgeTrace?.bundle.release)
    expect(Object.values(edited.days).flat()).toHaveLength(Object.values(selected.days).flat().length)
    const otherDay = Object.keys(days)[1]; if (otherDay) expect(edited.days[otherDay]).toEqual(selected.days[otherDay])
  })
  it('QA-54 empty and unreadable knowledge fall back without losing a prior plan', () => {
    const i = intent(), old = generatePlans(i, undefined, { enabled: false })[0], before = JSON.stringify(old)
    const fallback = generatePlans(i, undefined, { enabled: true, release: null })[0]
    expect(fallback.days).toEqual(old.days); expect(fallback.knowledgeTrace?.bundle.status).toBe('unavailable')
    expect(planningKnowledge(i, { enabled: true, release: { units: null } as never })?.status).toBe('unavailable')
    expect(JSON.stringify(old)).toBe(before)
  })
  it('QA-55 knowledge uses existing evidence/risk fields and does not create a 20-section UI document', () => {
    const p = generatePlans(intent(), undefined, { enabled: true, release: release() })[0]
    expect(p.evidence.some(e => e.includes('规划依据'))).toBe(true)
    expect(p.validation.issues.some(e => e.includes('城市事实'))).toBe(true)
    expect(p.evidence.every(e => !/^G\d\d/.test(e))).toBe(true)
  })
  it('QA-56 runtime release has no third-party guide prose, fixture objects or unapproved media', () => {
    const r = release(); expect(r.units.every(u => u.kind === 'rule' && u.source_id === 'zouzou-authored-rules')).toBe(true)
    expect(r.units.every(u => u.data_origin !== 'synthetic_fixture' && u.usage.runtime === 'approved')).toBe(true)
    expect(JSON.stringify(r)).not.toMatch(/https?:\/\/|"image"|"cover"|"raw"/)
  })

  it('does not retrieve temporarily held Datong units into the local browser', () => {
    const bundle = retrieveKnowledge({ city: '大同', query: '大同 云冈石窟' }, release())
    expect(bundle.status).toBe('disabled')
    expect(bundle.units).toEqual([])
    expect(bundle.gaps).toContain('大同知识暂未发布到走走本地浏览')
  })
})
