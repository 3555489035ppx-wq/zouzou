import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { routes } from '../src/demo-data/discover'
import { buildJourneyImageQueries, cachedWikimediaCandidates, inspectCandidate, type JourneyImageCategory } from '../src/services/journey-images'
import { getCityImageGallery } from '../src/demo-data/city-images'

const root = resolve(import.meta.dirname, '..')
const manifestPath = resolve(root, 'data', 'journey-images', 'manifest.json')
const args = process.argv.slice(2)
const requestedId = args.find((arg) => !arg.startsWith('--'))
const missingOnly = args.includes('--missing-only')

type StoredManifest = { generatedAt: string; images: Record<string, unknown> }
const readExisting = async (): Promise<StoredManifest> => {
  try { return JSON.parse(await readFile(manifestPath, 'utf8')) as StoredManifest } catch { return { generatedAt: '', images: {} } }
}

const category = (value: string): JourneyImageCategory => /约会/i.test(value) ? 'date' : /聚餐/i.test(value) ? 'dining' : /周末/i.test(value) ? 'weekend' : 'travel'

async function main() {
  const existing = await readExisting()
  const selectedRoutes = routes.filter((route) => !requestedId || route.id === requestedId).filter((route) => !missingOnly || !existing.images[route.id])
  if (requestedId && selectedRoutes.length === 0) throw new Error(`Journey not found: ${requestedId}`)
  const images = { ...existing.images }
  const report = { journeys: selectedRoutes.length, candidates: 0, accepted: 0, fallback: 0, rejected: {} as Record<string, number>, categories: {} as Record<string, number> }
  for (const route of selectedRoutes) {
    const input = { id: route.id, title: route.title, category: route.category, city: route.cityId, places: route.pois.map((poi) => poi.name), tags: route.tags }
    const candidates = cachedWikimediaCandidates(input, getCityImageGallery(route.cityId))
    const inspected = candidates.map((candidate) => inspectCandidate(candidate, input))
    report.candidates += candidates.length
    for (const result of inspected) for (const reason of result.reasons) report.rejected[reason] = (report.rejected[reason] ?? 0) + 1
    if (route.coverImageStatus === 'ready') report.accepted += 1
    else report.fallback += 1
    const kind = category(route.category); report.categories[kind] = (report.categories[kind] ?? 0) + 1
    images[route.id] = {
      journeyId: route.id,
      queries: buildJourneyImageQueries(input),
      primary: route.coverImage ?? null,
      alternatives: candidates.filter((candidate) => candidate.cachedUrl !== route.cover).slice(0, 4),
      coverImageStatus: route.coverImageStatus ?? 'fallback',
    }
  }
  await mkdir(resolve(root, 'data', 'journey-images'), { recursive: true })
  await writeFile(manifestPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), images }, null, 2)}\n`)
  console.log(JSON.stringify({ ...report, coverage: `${report.accepted}/${report.journeys || 0}`, manifestPath }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
