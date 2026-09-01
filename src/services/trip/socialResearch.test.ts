import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { routes } from '../../demo-data/discover'
import { socialResearchGuides } from './socialResearch'

type ResearchStore = {
  assets: Array<{ routeIds: string[]; localPath: string; visibility: string; coverEligible: boolean; preserveOriginal: boolean }>
}

const storePath = resolve(process.cwd(), 'data/journey-images/social-research.json')
const store = JSON.parse(readFileSync(storePath, 'utf8')) as ResearchStore

describe('social research assets', () => {
  it('keeps captures as backend-only evidence and never as covers', () => {
    expect(store.assets.length).toBeGreaterThan(0)
    for (const asset of store.assets) {
      expect(asset.visibility).toBe('backend-only')
      expect(asset.coverEligible).toBe(false)
      expect(asset.preserveOriginal).toBe(true)
      expect(existsSync(resolve(process.cwd(), 'public', asset.localPath.replace(/^\/assets\//, 'assets/')))).toBe(true)
      for (const routeId of asset.routeIds) expect(routes.some((route) => route.id === routeId)).toBe(true)
    }
  })

  it('exposes concise platform-derived signals to route matching', () => {
    expect(socialResearchGuides.length).toBeGreaterThanOrEqual(8)
    expect(socialResearchGuides.some((guide) => guide.city === '哈尔滨' && guide.foodHints?.includes('哈尔滨红肠'))).toBe(true)
    expect(socialResearchGuides.every((guide) => guide.permission === 'user-provided')).toBe(true)
  })
})
