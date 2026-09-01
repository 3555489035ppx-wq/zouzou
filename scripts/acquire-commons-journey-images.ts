import { execFile } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { routes } from '../src/demo-data/discover'
import { inspectCandidate, rankJourneyImages, type ImageCandidate, type JourneyImageCategory } from '../src/services/journey-images'
import { acquiredJourneyImages as existingAcquiredJourneyImages } from '../src/demo-data/acquired-journey-images'

const execFileAsync = promisify(execFile)
const repoRoot = resolve(import.meta.dirname, '..')
const assetDir = resolve(repoRoot, 'public/assets/journey-images/wikimedia')
const sourceModulePath = resolve(repoRoot, 'src/demo-data/acquired-journey-images.ts')
const reportPath = resolve(repoRoot, 'data/journey-images/commons-batch-report.json')
const imagePython = process.env.ZOUZOU_IMAGE_PYTHON || 'C:\\Users\\ppx15\\.zouzou-image-venv\\Scripts\\python.exe'
const onlyMissing = process.env.ZOUZOU_COMMONS_ONLY_MISSING !== '0'
const routeLimit = Number(process.env.ZOUZOU_COMMONS_ROUTE_LIMIT || 1000)
const acceptedPerRoute = Number(process.env.ZOUZOU_COMMONS_ACCEPTED_PER_ROUTE || 3)
const concurrency = Number(process.env.ZOUZOU_COMMONS_CONCURRENCY || 3)

type CommonsImageInfo = { thumburl?: string; url?: string; width?: number; height?: number; descriptionurl?: string }
type CommonsPage = { title?: string; imageinfo?: CommonsImageInfo[] }
type CommonsResponse = { query?: { pages?: CommonsPage[] } }
type VisionResult = { width: number; height: number; fileSize: number; sharpnessScore: number; textAreaRatio: number; textRegionCount: number; ocrTextAreaDetector: string; hasOverlayText: boolean; hasQrCode: boolean; watermarkScore: number; hasWatermark: boolean; isScreenshot: boolean; isCollage: boolean; blackBorderRatio: number; hasBlackBorder: boolean; signageScore: number; isSignage: boolean; pHash: string; dHash: string; visionEngine: string }

const safeFilename = (value: string) => value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'image'
const hash = (value: string) => {
  let result = 2166136261
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619)
  return (result >>> 0).toString(16)
}
const routeCategory = (value: string): JourneyImageCategory => /约会|date/i.test(value) ? 'date' : /聚餐|餐饮|dining|food/i.test(value) ? 'dining' : /周末|weekend/i.test(value) ? 'weekend' : 'travel'
const inputFor = (route: (typeof routes)[number]) => ({ id: route.id, title: route.title, category: route.category, city: route.cityId, places: route.pois.slice(0, 3).map((poi) => poi.name), tags: route.tags })
const imageExtension = (title: string, url: string) => {
  const titleExtension = extname(title).toLowerCase()
  if (/^\.(jpe?g|png|webp)$/.test(titleExtension)) return titleExtension === '.jpeg' ? '.jpg' : titleExtension
  const urlExtension = extname(new URL(url).pathname).toLowerCase()
  return /^\.(jpe?g|png|webp)$/.test(urlExtension) ? (urlExtension === '.jpeg' ? '.jpg' : urlExtension) : '.jpg'
}

const searchCommons = async (city: string, place: string) => {
  const queries = [`${city} ${place}`, place]
  for (const query of queries) {
    const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1280&format=json&formatversion=2`
    const escapedEndpoint = endpoint.replaceAll("'", "''")
    try {
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$ProgressPreference="SilentlyContinue"; Invoke-RestMethod -Headers @{"User-Agent"="zouzou-trip-prototype/0.1 (open image attribution)"} -Uri '${escapedEndpoint}' | ConvertTo-Json -Depth 12`], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 })
      const payload = JSON.parse(stdout) as CommonsResponse
      const pages = payload.query?.pages ?? []
      if (pages.length > 0) return pages
    } catch { /* public API can be temporarily unavailable; try the shorter query */ }
  }
  return []
}

const download = async (url: string, targetPath: string) => {
  try { if ((await stat(targetPath)).size > 1_000) return } catch { /* first download */ }
  const escapedUrl = url.replaceAll("'", "''")
  const escapedPath = targetPath.replaceAll("'", "''")
  const command = `$ProgressPreference="SilentlyContinue"; Invoke-WebRequest -UseBasicParsing -Headers @{"User-Agent"="zouzou-trip-prototype/0.1 (open image attribution)"} -Uri '${escapedUrl}' -OutFile '${escapedPath}'`
  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true })
      if ((await stat(targetPath)).size > 1_000) return
    } catch (error) { lastError = error }
  }
  throw lastError instanceof Error ? lastError : new Error('Commons image download failed')
}

const runVision = async (filePath: string): Promise<VisionResult> => {
  const { stdout } = await execFileAsync(imagePython, [resolve(repoRoot, 'scripts/image_quality.py'), filePath], { windowsHide: true, maxBuffer: 1024 * 1024 })
  const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1) ?? '{}') as VisionResult & { error?: string }
  if (result.error) throw new Error(result.error)
  return result
}

const acquireRoute = async (route: (typeof routes)[number]) => {
  const input = inputFor(route)
  const accepted: ImageCandidate[] = []
  const seen = new Set<string>()
  for (const place of input.places) {
    if (accepted.length >= acceptedPerRoute) break
    let pages: CommonsPage[] = []
    try { pages = await searchCommons(input.city, place) } catch { continue }
    for (const page of pages) {
      if (accepted.length >= acceptedPerRoute) break
      const title = page.title?.replace(/^File:/i, '') ?? ''
      const info = page.imageinfo?.[0]
      const url = info?.thumburl ?? info?.url ?? ''
      const width = Number(info?.width ?? 0)
      const height = Number(info?.height ?? 0)
      if (!title || !url || seen.has(url) || !width || !height || Math.max(width, height) < 1000 || width / height < 1.05 || !/\.(jpe?g|png|webp)$/i.test(title)) continue
      seen.add(url)
      const filename = `${safeFilename(route.id)}-${hash(url)}${imageExtension(title, url)}`
      const absolutePath = resolve(assetDir, filename)
      try {
        await download(url, absolutePath)
        const vision = await runVision(absolutePath)
        const candidate: ImageCandidate = {
          id: `commons-${hash(`${route.id}|${url}`)}`,
          journeyId: route.id,
          source: 'wikimedia',
          sourceUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title)}`,
          originalUrl: url,
          localPath: `/assets/journey-images/wikimedia/${filename}`,
          cachedUrl: `/assets/journey-images/wikimedia/${filename}`,
          width: vision.width,
          height: vision.height,
          aspectRatio: vision.width / Math.max(vision.height, 1),
          fileSize: vision.fileSize,
          category: input.category as JourneyImageCategory,
          city: input.city,
          placeName: place,
          searchQuery: `${input.city} ${place}`,
          hasOverlayText: vision.hasOverlayText,
          hasWatermark: vision.hasWatermark,
          hasQrCode: vision.hasQrCode,
          isScreenshot: vision.isScreenshot,
          isCollage: vision.isCollage,
          blackBorderRatio: vision.blackBorderRatio,
          hasBlackBorder: vision.hasBlackBorder,
          signageScore: vision.signageScore,
          isSignage: vision.isSignage,
          imageHash: `${vision.pHash}:${vision.dHash}`,
          pHash: vision.pHash,
          dHash: vision.dHash,
          createdAt: new Date().toISOString(),
          relevanceHints: [input.city, place, title],
          sharpnessScore: vision.sharpnessScore,
          textAreaRatio: vision.textAreaRatio,
        }
        if (inspectCandidate(candidate, input).reasons.length === 0) accepted.push(candidate)
      } catch { /* public files can disappear; continue with the next candidate */ }
    }
  }
  const ranked = rankJourneyImages(input, accepted)
  return {
    route,
    candidates: ranked.accepted,
    report: { journeyId: route.id, title: route.title, city: route.cityId, searchedPlaces: input.places, downloaded: seen.size, accepted: ranked.accepted.length },
  }
}

const sourceHeader = `export type AcquiredJourneyImage = { id: string; journeyId?: string; city: string; category: 'travel' | 'weekend' | 'date' | 'dining'; placeName: string; title: string; source?: 'baidu' | 'xiaohongshu' | 'douyin' | 'wikimedia'; sourceUrl: string; originalUrl: string; localPath: string; cachedUrl?: string; width: number; height: number; fileSize: number; searchQuery: string; retrievedAt: string; qualityScore?: number; sharpnessScore?: number; textAreaRatio?: number; textRegionCount?: number; watermarkScore?: number; hasOverlayText?: boolean; hasWatermark?: boolean; hasQrCode?: boolean; isScreenshot?: boolean; isCollage?: boolean; blackBorderRatio?: number; hasBlackBorder?: boolean; signageScore?: number; isSignage?: boolean; imageHash?: string; pHash?: string; dHash?: string; visionEngine?: string; selected?: boolean; rejectedReasons?: string[]; author?: string; noteId?: string; noteUrl?: string }\n\n/** Generated from public Wikimedia Commons image results; only quality-approved local files are included. */\nexport const acquiredJourneyImages: AcquiredJourneyImage[] = `

async function main() {
  await mkdir(assetDir, { recursive: true })
  const selected = routes.filter((route) => route.id.startsWith('knowledge-route-')).filter((route) => !onlyMissing || route.coverImageStatus !== 'ready').slice(0, routeLimit)
  const results: Awaited<ReturnType<typeof acquireRoute>>[] = []
  let nextIndex = 0
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, selected.length)) }, async () => {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= selected.length) return
      const result = await acquireRoute(selected[index])
      results.push(result)
      console.log(`[commons-images] ${result.route.id}: downloaded=${result.report.downloaded} accepted=${result.candidates.length}`)
    }
  }))
  const newRecords = results.flatMap(({ route, candidates }) => candidates.map((candidate, index) => {
    const imageCandidate = candidate as ImageCandidate
    const scored = inspectCandidate(candidate, inputFor(route))
    return {
      id: candidate.id,
      journeyId: route.id,
      city: route.cityId,
      category: routeCategory(route.category),
      placeName: candidate.placeName ?? route.pois[0]?.name ?? route.cityId,
      title: route.title,
      source: 'wikimedia' as const,
      sourceUrl: candidate.sourceUrl,
      originalUrl: candidate.originalUrl,
      localPath: candidate.localPath,
      cachedUrl: candidate.cachedUrl,
      width: candidate.width,
      height: candidate.height,
      fileSize: candidate.fileSize ?? 0,
      searchQuery: candidate.searchQuery,
      retrievedAt: candidate.createdAt,
      qualityScore: scored.qualityScore,
      sharpnessScore: scored.sharpnessScore,
      textAreaRatio: imageCandidate.textAreaRatio ?? 0,
      textRegionCount: imageCandidate.textRegionCount ?? 0,
      watermarkScore: imageCandidate.watermarkScore ?? 0,
      hasOverlayText: candidate.hasOverlayText,
      hasWatermark: candidate.hasWatermark,
      hasQrCode: candidate.hasQrCode,
      isScreenshot: candidate.isScreenshot,
      isCollage: candidate.isCollage,
      blackBorderRatio: candidate.blackBorderRatio ?? 0,
      hasBlackBorder: candidate.hasBlackBorder ?? false,
      signageScore: candidate.signageScore ?? 0,
      isSignage: candidate.isSignage ?? false,
      imageHash: candidate.imageHash,
      pHash: candidate.pHash ?? '',
      dHash: candidate.dHash ?? '',
      visionEngine: imageCandidate.visionEngine ?? 'Pillow + OpenCV',
      selected: index === 0,
      rejectedReasons: [],
    }
  }))
  const replaced = new Set(newRecords.map((record) => record.journeyId))
  const merged = [...existingAcquiredJourneyImages.filter((record) => !replaced.has(record.journeyId ?? '')), ...newRecords]
  await writeFile(sourceModulePath, `${sourceHeader}${JSON.stringify(merged, null, 2)}\n`)
  await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: 'Wikimedia Commons API', onlyMissing, routes: results.map(({ report }) => report) }, null, 2)}\n`)
  const incomplete = results.filter(({ candidates }) => candidates.length === 0)
  console.log(JSON.stringify({ routes: results.length, acceptedRoutes: results.length - incomplete.length, newImages: newRecords.length, incomplete: incomplete.map(({ route }) => route.id), reportPath }, null, 2))
  if (incomplete.length > 0) process.exitCode = 2
}

main().catch((error) => { console.error(`[commons-images] acquisition failed: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1 })
