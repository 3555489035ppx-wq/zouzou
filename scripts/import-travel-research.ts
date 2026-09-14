import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { cityKnowledge } from '../src/services/trip/cityKnowledge'
import { inferFoodTags } from '../src/services/trip/dietary'
import type { GuideCandidate, GuideKnowledgeBase, GuidePlatform } from '../src/services/trip/guides'

type Row = Record<string, unknown>
type Capture = { status: string; at: string; sourceUrl?: string; data?: Row[] }
type Review = { city: string; places: string[]; foods: string[]; local: string[]; stay: string[]; days: string[][]; review: string }
type Segment = { text: string; field: string; locator: string }
const batch = '2026-09-06'
const unique = (values: string[]) => [...new Set(values.filter(Boolean))]
const str = (value: unknown) => typeof value === 'string' ? value : ''
const fields = (capture: Capture | null) => Object.fromEntries((capture?.data ?? []).map(row => [str(row.field), str(row.value)]))
const canonical = (url: string) => { const result = new URL(url); result.search = ''; result.hash = ''; return result.href }

export function extractResearchTerms(terms: string[], segments: Segment[]) {
  return unique(terms).flatMap(term => {
    const segment = segments.find(value => value.text.includes(term))
    return segment ? [{ term, field: segment.field, locator: segment.locator }] : []
  })
}

export async function importTravelResearch(captures: string, root = process.cwd()) {
  const review = JSON.parse(await readFile(resolve(root, `data/travel-research/${batch}-review.json`), 'utf8')) as { cities: Review[] }
  const official = JSON.parse(await readFile(resolve(root, `data/travel-research/${batch}-official.json`), 'utf8')) as { hotels: Array<{city: string} & Row>; connections: Array<{city: string} & Row> }
  const kbPath = resolve(root, 'data/travel-guides.json')
  const existing = JSON.parse(await readFile(kbPath, 'utf8')) as GuideKnowledgeBase
  const before = existing.guides.length
  const guides = new Map(existing.guides.map(guide => [guide.id, guide]))
  const imported: GuideCandidate[] = []
  const coverage: Record<string, unknown>[] = []
  const readCapture = async (city: string, platform: string, kind: string): Promise<Capture | null> => {
    try { return JSON.parse(await readFile(resolve(captures, `${city}-${platform}-${kind}.json`), 'utf8')) as Capture }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
  }
  for (const city of review.cities) {
    const knowledge = cityKnowledge[city.city]
    const placeTerms = unique([...city.places, ...(knowledge?.items.filter(item => item.category === 'attraction' || item.category === 'activity').map(item => item.name) ?? [])])
    const foodTerms = unique([...city.foods, ...(knowledge?.items.filter(item => item.category === 'food' || item.category === 'restaurant').flatMap(item => [item.name, ...(item.menuHighlights ?? [])]) ?? [])])
    const hotelTerms = knowledge?.hotelOptions.map(hotel => hotel.name) ?? []
    for (const platform of ['xiaohongshu', 'bilibili', 'douyin'] as const) {
      const search = await readCapture(city.city, platform, 'search')
      const detail = await readCapture(city.city, platform, 'detail')
      const detail2 = platform === 'xiaohongshu' ? await readCapture(city.city, platform, 'detail2') : null
      const subtitle = platform === 'bilibili' ? await readCapture(city.city, platform, 'subtitle') : null
      const subtitle2 = platform === 'bilibili' ? await readCapture(city.city, platform, 'subtitle2') : null
      const accepted = search?.status === 'PASS' ? search.data ?? [] : []
      const platformGuides: GuideCandidate[] = []
      for (const [index, row] of accepted.entries()) {
        const sourceUrl = canonical(str(row.url))
        const title = str(row.title) || str(row.desc)
        const segments: Segment[] = [{ text: title, field: 'search', locator: `result:${index + 1}` }]
        let readLevel: NonNullable<GuideCandidate['research']>['readLevel'] = 'search-metadata'
        let bodyCharacters = 0
        let fetchedAt = search!.at
        const selected = index === 0 ? detail : index === 1 ? detail2 : null
        const values = fields(selected)
        // A detail is attached only when its observed title equals the search title.
        if (selected?.status === 'PASS' && values.title === title) {
          const body = values.content || values.description || values.desc || ''
          if (body) {
            segments.push({ text: body, field: platform === 'xiaohongshu' ? 'note' : 'description', locator: 'text' })
            bodyCharacters = body.length
            readLevel = platform === 'xiaohongshu' ? 'note-text' : 'video-description'
            fetchedAt = selected.at
          }
        }
        const selectedSubtitle = index === 0 ? subtitle : index === 1 && subtitle2?.sourceUrl && canonical(subtitle2.sourceUrl) === sourceUrl ? subtitle2 : null
        if (platform === 'bilibili' && selectedSubtitle?.status === 'PASS') {
          const rows = (selectedSubtitle.data ?? []).filter(line => str(line.content))
          segments.push(...rows.map(line => ({ text: str(line.content), field: 'subtitle', locator: `${str(line.from)}-${str(line.to)}` })))
          if (rows.length) {
            readLevel = 'video-subtitle'
            bodyCharacters += rows.reduce((sum, line) => sum + str(line.content).length, 0)
            fetchedAt = selectedSubtitle.at
          }
        }
        const places = extractResearchTerms(placeTerms, segments)
        const food = extractResearchTerms(foodTerms, segments)
        const local = extractResearchTerms(city.local, segments)
        const hotels = extractResearchTerms(hotelTerms, segments)
        const stay = extractResearchTerms(city.stay, segments)
        const evidence = [...places, ...food, ...local, ...hotels, ...stay]
        // Search hits without concrete destination signals remain in private captures only.
        if (!evidence.length) continue
        const hint = (items: typeof evidence) => items.map(item => item.term)
        const summary = [places.length ? `地点线索：${hint(places).slice(0, 6).join('、')}` : '', food.length ? `餐饮线索：${hint(food).slice(0, 5).join('、')}` : '', stay.length ? `住宿片区线索：${hint(stay).join('、')}` : '', '提及不代表推荐；营业、费用、路线和入住条件需复核。'].filter(Boolean).join('；')
        const id = `research-${batch}-${createHash('sha256').update(`${city.city}|${platform}|${sourceUrl}`).digest('hex').slice(0, 16)}`
        const candidate: GuideCandidate = {
          id, city: city.city, platform: platform as GuidePlatform, sourceUrl,
          title: title.slice(0, 100), author: str(row.author), publishedAt: null, fetchedAt,
          likes: typeof row.likes === 'number' ? row.likes : null,
          summary, tags: unique(['城市攻略', ...hint(local), ...(food.length ? ['本地美食'] : []), ...(stay.length ? ['住宿'] : [])]),
          placeHints: hint(places), foodHints: hint(food), localExperienceHints: hint(local),
          hotelHints: hint(stay), hotelNames: hint(hotels), dietaryTags: inferFoodTags(hint(food).join(' ')),
          claims: [...places.map(item => ({ type: 'place' as const, text: `来源提及${item.term}，仅作为地点候选。`, placeName: item.term, confidence: 0.6, verified: false })), ...food.map(item => ({ type: 'food' as const, text: `来源提及${item.term}，口味与配料需现场确认。`, placeName: item.term, confidence: 0.6, verified: false }))],
          permission: 'unknown', research: { batch, readLevel, bodyCharacters, evidence },
        }
        guides.set(id, candidate)
        imported.push(candidate)
        platformGuides.push(candidate)
      }
      coverage.push({ city: city.city, platform, searchStatus: search?.status ?? 'MISSING', searchHits: accepted.length, imported: platformGuides.length, readLevels: platformGuides.map(guide => guide.research!.readLevel), subtitleStatus: platform === 'bilibili' ? subtitle?.status ?? 'MISSING' : undefined, alternateSubtitleStatus: subtitle2?.status })
    }
  }
  const dossiers = review.cities.map(city => {
    const cityGuides = imported.filter(guide => guide.city === city.city)
    const termSources = (term: string) => cityGuides.filter(guide => guide.research!.evidence.some(item => item.term === term)).map(guide => ({ platform: guide.platform, author: guide.author, url: guide.sourceUrl, readLevel: guide.research!.readLevel }))
    const terms = unique(cityGuides.flatMap(guide => guide.research!.evidence.map(item => item.term)))
    return {
      ...city, status: 'reviewed-candidate',
      crossPlatformTerms: terms.map(term => ({ term, sources: termSources(term) })).filter(item => new Set(item.sources.map(source => source.platform)).size >= 2),
      foodEvidence: city.foods.map(term => ({ term, sources: termSources(term) })),
      hotelCandidates: cityKnowledge[city.city]?.hotelOptions ?? [],
      checkedHotelFacts: official.hotels.filter(hotel => hotel.city === city.city),
      publishedConnections: official.connections.filter(connection => connection.city === city.city),
      routes: city.days.map((stops, index) => ({ day: index + 1, editorialProposal: true, stops: stops.map(name => ({ name, sources: termSources(name) })), legs: stops.slice(1).map((to, i) => ({ from: stops[i], to, distanceKm: null, durationMinutes: null, status: 'needs-map-verification' })) })),
    }
  })
  const generatedAt = imported.map(guide => guide.fetchedAt).sort().at(-1) ?? existing.generatedAt
  await mkdir(resolve(root, 'docs/research'), { recursive: true })
  await writeFile(kbPath, `${JSON.stringify({ ...existing, generatedAt, guides: [...guides.values()] }, null, 2)}\n`)
  const result = { batch, before, after: guides.size, imported: imported.length, destinations: dossiers.length, coverage, dossiers }
  await writeFile(resolve(root, `data/travel-research/${batch}-coverage.json`), `${JSON.stringify(result, null, 2)}\n`)
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const captures = process.argv[2]
  if (!captures) throw new Error('Usage: tsx scripts/import-travel-research.ts <private capture directory>')
  const result = await importTravelResearch(captures)
  console.log(JSON.stringify({ before: result.before, after: result.after, imported: result.imported, destinations: result.destinations }))
}
