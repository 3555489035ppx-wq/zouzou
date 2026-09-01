import { execFile } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { routes } from '../src/demo-data/discover'
import { buildShanghaiImageBatch, type ShanghaiJourneyImageBatch } from '../src/services/journey-images/shanghai-batch'
import { BaiduImageProvider, buildJourneyImageQueries, inspectCandidate, rankJourneyImages, type ImageCandidate, type JourneyImageCategory } from '../src/services/journey-images'
import { acquiredJourneyImages as existingAcquiredJourneyImages } from '../src/demo-data/acquired-journey-images'

const execFileAsync = promisify(execFile)
const repoRoot = resolve(import.meta.dirname, '..')
const assetDir = resolve(repoRoot, 'public/assets/journey-images/baidu')
const manifestPath = resolve(repoRoot, 'data/journey-images/manifest.json')
const reportPath = resolve(repoRoot, 'data/journey-images/real-batch-report.json')
const sourceModulePath = resolve(repoRoot, 'src/demo-data/acquired-journey-images.ts')
const imagePython = process.env.ZOUZOU_IMAGE_PYTHON || 'C:\\Users\\ppx15\\.zouzou-image-venv\\Scripts\\python.exe'
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'
const entryLimit = Number(process.env.ZOUZOU_IMAGE_BATCH_LIMIT || 20)
const entryOffset = Number(process.env.ZOUZOU_IMAGE_BATCH_OFFSET || 0)
const candidateDownloadLimit = Number(process.env.ZOUZOU_IMAGE_CANDIDATE_LIMIT || 20)
const queryLimit = Number(process.env.ZOUZOU_IMAGE_QUERY_LIMIT || 5)
const minimumDownloaded = Number(process.env.ZOUZOU_IMAGE_MIN_DOWNLOADED || Math.min(8, candidateDownloadLimit))
const onlyMissing = process.env.ZOUZOU_IMAGE_ONLY_MISSING === '1'
const requestedJourneyIds = new Set((process.env.ZOUZOU_IMAGE_JOURNEY_IDS || '').split(',').map((value) => value.trim()).filter(Boolean))

type VisionResult = {
  width: number
  height: number
  fileSize: number
  sharpnessScore: number
  textAreaRatio: number
  textRegionCount: number
  ocrTextAreaDetector: string
  hasOverlayText: boolean
  hasQrCode: boolean
  watermarkScore: number
  hasWatermark: boolean
  isScreenshot: boolean
  isCollage: boolean
  blackBorderRatio: number
  hasBlackBorder: boolean
  signageScore: number
  isSignage: boolean
  hasPeople?: boolean
  peopleHint?: boolean
  pHash: string
  dHash: string
  visionEngine: string
}

type AcquiredRecord = {
  id: string
  journeyId: string
  city: string
  category: JourneyImageCategory
  placeName: string
  title: string
  source: 'baidu'
  sourceUrl: string
  originalUrl: string
  localPath: string
  cachedUrl: string
  width: number
  height: number
  fileSize: number
  searchQuery: string
  retrievedAt: string
  qualityScore: number
  sharpnessScore: number
  textAreaRatio: number
  textRegionCount: number
  watermarkScore: number
  hasOverlayText: boolean
  hasWatermark: boolean
  hasQrCode: boolean
  isScreenshot: boolean
  isCollage: boolean
  blackBorderRatio: number
  hasBlackBorder: boolean
  signageScore: number
  isSignage: boolean
  hasPeople?: boolean
  peopleHint?: boolean
  imageHash: string
  pHash: string
  dHash: string
  visionEngine: string
  selected: boolean
  rejectedReasons: string[]
  author?: string
}

type BatchReport = {
  journeyId: string
  journeyTitle: string
  category: JourneyImageCategory
  city: string
  queries: string[]
  source: string
  foundCandidateCount: number
  downloadedCount: number
  rejectedCount: number
  rejectedByReason: Record<string, number>
  top5: Array<{ id: string; cachedUrl: string; qualityScore: number; width: number; height: number; searchQuery: string; sourceUrl: string }>
  finalCover: string | null
  status: 'ready' | 'insufficient_candidates' | 'blocked'
  note: string
}

type RouteImageBatchEntry = {
  id: string
  title: string
  batchCategory: JourneyImageCategory
  city: string
  district?: string
  places: string[]
  activities: string[]
  timePeriods: string[]
  tags: string[]
}

type ImageBatchEntry = ShanghaiJourneyImageBatch | RouteImageBatchEntry

const downloadedCache = new Map<string, { absolutePath: string; filename: string; bytes: Buffer }>()
const visionCache = new Map<string, VisionResult>()
const searchCache = new Map<string, ImageCandidate[]>()

const safeFilename = (value: string) => value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'image'
const extensionFor = (contentType: string, url: string) => {
  const fromType = contentType.match(/image\/(jpeg|jpg|png|webp|gif|avif)/i)?.[1]?.toLowerCase()
  if (fromType) return fromType === 'jpeg' ? 'jpg' : fromType
  const fromUrl = extname(new URL(url).pathname).replace('.', '').toLowerCase()
  return /^(jpe?g|png|webp|gif|avif)$/.test(fromUrl) ? (fromUrl === 'jpeg' ? 'jpg' : fromUrl) : 'jpg'
}

const imageBytes = (bytes: Buffer) => bytes.length > 512 && (
  bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
  bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
  bytes.subarray(0, 4).toString('ascii') === 'RIFF' ||
  bytes.subarray(0, 4).toString('ascii') === 'GIF8'
)

const runVision = async (filePath: string): Promise<VisionResult> => {
  const cached = visionCache.get(filePath)
  if (cached) return cached
  const { stdout } = await execFileAsync(imagePython, [resolve(repoRoot, 'scripts/image_quality.py'), filePath], { windowsHide: true, maxBuffer: 1024 * 1024 })
  const line = stdout.trim().split(/\r?\n/).at(-1) ?? '{}'
  const result = JSON.parse(line) as VisionResult & { error?: string }
  if (result.error) throw new Error(result.error)
  visionCache.set(filePath, result)
  return result
}

const download = async (candidate: ImageCandidate, index: number) => {
  const cached = downloadedCache.get(candidate.originalUrl)
  if (cached) return cached
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(candidate.originalUrl, {
      signal: controller.signal,
      headers: { accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8', referer: 'https://image.baidu.com/', 'user-agent': userAgent },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') ?? ''
    if (!imageBytes(bytes) || (!contentType.includes('image') && !/\.(jpe?g|png|webp|gif|avif)(?:\?|$)/i.test(candidate.originalUrl))) throw new Error('response is not an image')
    const filename = `${safeFilename(candidate.id)}-${index}.${extensionFor(contentType, candidate.originalUrl)}`
    const absolutePath = resolve(assetDir, filename)
    try {
      if ((await stat(absolutePath)).size === bytes.length) {
        const result = { absolutePath, filename, bytes }
        downloadedCache.set(candidate.originalUrl, result)
        return result
      }
    } catch { /* first download */ }
    await writeFile(absolutePath, bytes)
    const result = { absolutePath, filename, bytes }
    downloadedCache.set(candidate.originalUrl, result)
    return result
  } finally {
    clearTimeout(timer)
  }
}

const publicPath = (filename: string) => `/assets/journey-images/baidu/${filename}`
const titleHint = (candidate: ImageCandidate) => (candidate.relevanceHints ?? []).join(' ')
const obviousNonPhoto = /截图|海报|拼图|九宫格|头像|二维码|菜单|水印|版权图片|站酷海洛|搜狐号|视觉中国|壁纸|表情包|logo|screen ?shot|poster|collage|watermark|menu|stock photo|getty|shutterstock/i
const peopleHintPattern = /人物|人像|游客|路人|人群|模特|主播|探店|博主|情侣|亲子|自拍|摄影师|小哥|小姐姐|美女|帅哥|合影|肖像|试吃|采访|厨师|店员|服务员|出镜|口播|two[- ]?chinese|water[- ]?splashing|dragon boat|festival|crowd|people|person|tourist|traveler|pedestrian|portrait|selfie|model|photographer|guardians/i
const peopleHintText = (value: string) => value.replace(/无人物|无人出镜|无人像|不含人物|空景/g, '')
const hasPeopleHint = (candidate: ImageCandidate) => candidate.hasPeople === true
  || candidate.peopleHint === true
  || peopleHintPattern.test(peopleHintText(titleHint(candidate)))
const likelyCoverShape = (candidate: ImageCandidate) => {
  const longEdge = Math.max(candidate.width, candidate.height)
  return (!longEdge || longEdge >= 1000) && (!candidate.aspectRatio || (candidate.aspectRatio >= 1.05 && candidate.aspectRatio <= 2.8))
}

const makeInput = (entry: ImageBatchEntry) => ({
  id: entry.id,
  title: entry.title,
  category: entry.batchCategory,
  city: entry.city,
  district: entry.district,
  places: entry.places,
  activities: entry.activities,
  timePeriods: entry.timePeriods,
  tags: entry.tags,
})

const routeCategory = (value: string): JourneyImageCategory => /约会|date/i.test(value)
  ? 'date'
  : /聚餐|餐饮|dining|food/i.test(value)
    ? 'dining'
    : /周末|weekend/i.test(value)
      ? 'weekend'
      : 'travel'

const buildKnowledgeImageBatch = (): RouteImageBatchEntry[] => routes
  .filter((route) => !onlyMissing || route.coverImageStatus !== 'ready')
  .map((route) => ({
    id: route.id,
    title: route.title,
    batchCategory: routeCategory(route.category),
    city: route.cityId,
    places: route.pois.slice(0, 3).map((poi) => poi.name),
    activities: route.tags,
    timePeriods: route.timePeriod,
    tags: route.tags,
  }))

const readExistingManifest = async () => {
  try { return JSON.parse(await readFile(manifestPath, 'utf8')) as { images?: Record<string, unknown> } } catch { return { images: {} } }
}

const searchQueries = async (queries: string[]) => {
  const candidates: ImageCandidate[] = []
  const seen = new Set<string>()
  for (const query of queries) {
    const cached = searchCache.get(query)
    const results = cached ?? (await BaiduImageProvider.search([query])).candidates
    searchCache.set(query, results)
    for (const result of results) {
      if (seen.has(result.originalUrl)) continue
      seen.add(result.originalUrl)
      candidates.push(result)
    }
  }
  return candidates
}

async function acquireEntry(entry: ImageBatchEntry): Promise<{ records: AcquiredRecord[]; report: BatchReport }> {
  const input = makeInput(entry)
  const queries = buildJourneyImageQueries(input).slice(0, queryLimit)
  const candidates = (await searchQueries(queries)).filter((candidate) => likelyCoverShape(candidate)
    && !obviousNonPhoto.test(titleHint(candidate))
    && !hasPeopleHint(candidate)
    && (entry.batchCategory !== 'dining' || !/店内|环境/.test(candidate.searchQuery)))
  const downloaded: Array<{ candidate: ImageCandidate; vision: VisionResult; filename: string; absolutePath: string }> = []
  for (let index = 0; index < candidates.length && downloaded.length < candidateDownloadLimit; index += 1) {
    const candidate = candidates[index]
    try {
      const file = await download(candidate, index)
      const vision = await runVision(file.absolutePath)
      downloaded.push({ candidate, vision, filename: file.filename, absolutePath: file.absolutePath })
    } catch {
      // A public search result can disappear or deny hotlinking. It is counted
      // as a failed download; no retry is allowed to evade a platform control.
    }
  }
  const enriched: ImageCandidate[] = downloaded.map(({ candidate, vision, filename }) => ({
    ...candidate,
    journeyId: entry.id,
    category: entry.batchCategory,
    city: entry.city,
    placeName: entry.places.find((place) => candidate.searchQuery.includes(place)) ?? entry.places.find((place) => titleHint(candidate).includes(place)) ?? entry.places[0],
    localPath: publicPath(filename),
    cachedUrl: publicPath(filename),
    width: vision.width,
    height: vision.height,
    aspectRatio: vision.width / Math.max(vision.height, 1),
    fileSize: vision.fileSize,
    sharpnessScore: vision.sharpnessScore,
    textAreaRatio: vision.textAreaRatio,
    textRegionCount: vision.textRegionCount,
    watermarkScore: vision.watermarkScore,
    visionEngine: `${vision.visionEngine}; ${vision.ocrTextAreaDetector}`,
    hasOverlayText: vision.hasOverlayText,
    hasWatermark: vision.hasWatermark,
    hasQrCode: vision.hasQrCode,
    isScreenshot: vision.isScreenshot,
    isCollage: vision.isCollage,
    blackBorderRatio: vision.blackBorderRatio,
    hasBlackBorder: vision.hasBlackBorder,
    signageScore: vision.signageScore,
    isSignage: vision.isSignage,
    hasPeople: hasPeopleHint(candidate),
    peopleHint: hasPeopleHint(candidate),
    imageHash: `${vision.pHash}:${vision.dHash}`,
    pHash: vision.pHash,
    dHash: vision.dHash,
    downloaded: true,
  }))
  const ranked = rankJourneyImages(input, enriched)
  const acceptedIds = new Set(ranked.accepted.map((candidate) => candidate.id))
  const rejectedByReason: Record<string, number> = {}
  const inspected = enriched.map((candidate) => ({ candidate, result: inspectCandidate(candidate, input) }))
  const records = inspected.map(({ candidate, result }) => {
    for (const reason of result.reasons) rejectedByReason[reason] = (rejectedByReason[reason] ?? 0) + 1
    return {
      id: candidate.id,
      journeyId: entry.id,
      city: entry.city,
      category: entry.batchCategory,
      placeName: candidate.placeName ?? entry.places[0] ?? entry.city,
      title: entry.title,
      source: 'baidu' as const,
      sourceUrl: candidate.sourceUrl,
      originalUrl: candidate.originalUrl,
      localPath: candidate.localPath,
      cachedUrl: candidate.cachedUrl,
      width: candidate.width,
      height: candidate.height,
      fileSize: candidate.fileSize ?? 0,
      searchQuery: candidate.searchQuery,
      retrievedAt: candidate.createdAt,
      qualityScore: result.qualityScore,
      sharpnessScore: result.sharpnessScore,
      textAreaRatio: candidate.textAreaRatio ?? 0,
      textRegionCount: candidate.textRegionCount ?? 0,
      watermarkScore: candidate.watermarkScore ?? 0,
      hasOverlayText: candidate.hasOverlayText,
      hasWatermark: candidate.hasWatermark,
      hasQrCode: candidate.hasQrCode,
      isScreenshot: candidate.isScreenshot,
      isCollage: candidate.isCollage,
      blackBorderRatio: candidate.blackBorderRatio ?? 0,
      hasBlackBorder: candidate.hasBlackBorder ?? false,
      signageScore: candidate.signageScore ?? 0,
      isSignage: candidate.isSignage ?? false,
      hasPeople: candidate.hasPeople,
      peopleHint: candidate.peopleHint,
      imageHash: candidate.imageHash,
      pHash: candidate.pHash ?? '',
      dHash: candidate.dHash ?? '',
      visionEngine: candidate.visionEngine ?? 'unknown',
      selected: acceptedIds.has(candidate.id) && ranked.accepted[0]?.id === candidate.id,
      rejectedReasons: result.reasons,
    }
  })
  const top5 = ranked.accepted.map((candidate) => ({ id: candidate.id, cachedUrl: candidate.cachedUrl, qualityScore: candidate.qualityScore, width: candidate.width, height: candidate.height, searchQuery: candidate.searchQuery, sourceUrl: candidate.sourceUrl }))
  const enough = downloaded.length >= minimumDownloaded
  return {
    records,
    report: {
      journeyId: entry.id,
      journeyTitle: entry.title,
      category: entry.batchCategory,
      city: entry.city,
      queries,
      source: 'Baidu public image JSON endpoint (BaiduImageProvider)',
      foundCandidateCount: candidates.length,
      downloadedCount: downloaded.length,
      rejectedCount: inspected.filter(({ result }) => result.reasons.length > 0).length,
      rejectedByReason,
      top5,
      finalCover: top5[0]?.cachedUrl ?? null,
      status: enough && top5.length > 0 ? 'ready' : 'insufficient_candidates',
      note: enough ? `At least ${minimumDownloaded} files downloaded; Top 5 selected by the shared ImageCandidate pipeline.` : `Fewer than ${minimumDownloaded} image files were downloaded from public results; this Journey remains incomplete.`,
    },
  }
}

async function main() {
  const fullBatch: ImageBatchEntry[] = [...(onlyMissing ? [] : buildShanghaiImageBatch()), ...buildKnowledgeImageBatch()]
  const requestedCity = process.env.ZOUZOU_IMAGE_CITY
  const scopedBatch = requestedJourneyIds.size
    ? fullBatch.filter((entry) => requestedJourneyIds.has(entry.id))
    : requestedCity ? fullBatch.filter((entry) => entry.city === requestedCity) : fullBatch
  const batch = scopedBatch.slice(Math.max(0, entryOffset), Math.max(0, entryOffset) + Math.max(1, Math.min(scopedBatch.length, entryLimit)))
  if (batch.length === 0) throw new Error(`No image batch entries selected (city=${requestedCity ?? 'all'}, offset=${entryOffset})`)
  await mkdir(assetDir, { recursive: true })
  const allRecords: AcquiredRecord[] = []
  const reports: BatchReport[] = []
  for (const entry of batch) {
    try {
      const result = await acquireEntry(entry)
      allRecords.push(...result.records)
      reports.push(result.report)
      console.log(`[journey-images] ${entry.id}: found=${result.report.foundCandidateCount} downloaded=${result.report.downloadedCount} accepted=${result.report.top5.length}`)
    } catch (error) {
      reports.push({ journeyId: entry.id, journeyTitle: entry.title, category: entry.batchCategory, city: entry.city, queries: buildJourneyImageQueries(makeInput(entry)).slice(0, 5), source: 'Baidu public image JSON endpoint (BaiduImageProvider)', foundCandidateCount: 0, downloadedCount: 0, rejectedCount: 0, rejectedByReason: {}, top5: [], finalCover: null, status: 'blocked', note: error instanceof Error ? error.message : String(error) })
    }
  }
  const existing = await readExistingManifest()
  const replacedJourneyIds = new Set(batch.map((entry) => entry.id))
  const mergedRecords = [
    ...existingAcquiredJourneyImages.filter((record) => !replacedJourneyIds.has(record.journeyId ?? '')),
    ...allRecords,
  ]
  await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: 'Baidu public image JSON endpoint', batch: reports }, null, 2)}\n`)
  const source = `export type AcquiredJourneyImage = { id: string; journeyId?: string; city: string; category: 'travel' | 'weekend' | 'date' | 'dining'; placeName: string; title: string; source?: 'baidu' | 'xiaohongshu' | 'douyin' | 'wikimedia'; sourceUrl: string; originalUrl: string; localPath: string; cachedUrl?: string; width: number; height: number; fileSize: number; searchQuery: string; retrievedAt: string; qualityScore?: number; sharpnessScore?: number; textAreaRatio?: number; textRegionCount?: number; watermarkScore?: number; hasOverlayText?: boolean; hasWatermark?: boolean; hasPeople?: boolean; peopleHint?: boolean; hasQrCode?: boolean; isScreenshot?: boolean; isCollage?: boolean; blackBorderRatio?: number; hasBlackBorder?: boolean; signageScore?: number; isSignage?: boolean; imageHash?: string; pHash?: string; dHash?: string; visionEngine?: string; selected?: boolean; rejectedReasons?: string[]; author?: string; noteId?: string; noteUrl?: string }\n\n/** Generated by scripts/acquire-journey-images.ts from public Baidu image results; no watermark removal is performed. */\nexport const acquiredJourneyImages = JSON.parse(String.raw\`[\n${JSON.stringify(mergedRecords, null, 2)}\n\`) as AcquiredJourneyImage[]\n`
  await writeFile(sourceModulePath, source)
  await writeFile(manifestPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: 'Baidu public image JSON endpoint via BaiduImageProvider; Wikimedia remains fallback only', batch: reports, images: existing.images ?? {} }, null, 2)}\n`)
  const incomplete = reports.filter((report) => report.status !== 'ready')
  console.log(JSON.stringify({ journeys: reports.length, offset: entryOffset, downloaded: allRecords.length, totalStored: mergedRecords.length, ready: reports.length - incomplete.length, incomplete: incomplete.map((report) => report.journeyId), reportPath, manifestPath }, null, 2))
  if (incomplete.length > 0) process.exitCode = 2
}

main().catch((error) => { console.error(`[journey-images] acquisition failed: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1 })
