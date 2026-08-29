import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'
import type { GuideCandidate, GuideClaim, GuideKnowledgeBase } from '../src/services/trip/guides'

const execFileAsync = promisify(execFile)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(repoRoot, 'data/travel-guides.json')
const openCliBin = process.env.OPENCLI_BIN?.trim() || (process.platform === 'win32' ? 'opencli.cmd' : 'opencli')
const windowsOpenCliEntry = process.env.OPENCLI_ENTRY?.trim()
  || (process.env.APPDATA ? resolve(process.env.APPDATA, 'npm', 'node_modules', '@jackwener', 'opencli', 'dist', 'src', 'main.js') : '')

const DEFAULT_CITIES = ['上海', '杭州', '苏州', '南京', '成都', '厦门', '北京', '广州', '重庆', '西安', '深圳', '长沙', '青岛', '武汉', '昆明', '三亚', '桂林', '哈尔滨', '贵阳', '张家界']
const DEFAULT_SEARCH_LIMIT = 5
const DEFAULT_DETAIL_LIMIT = 2
const DEFAULT_DELAY_MS = 2_500

const cityPlaceHints: Record<string, string[]> = {
  上海: ['外滩', '武康路', '安福路', '豫园', '南京路步行街', '陆家嘴', '东方明珠', '静安寺', '朱家角', '上海博物馆', '浦东美术馆'],
  杭州: ['西湖', '灵隐寺', '西溪湿地', '河坊街', '天目里', '龙井村', '南宋御街', '良渚', '中国美术学院', '湖滨'],
  苏州: ['拙政园', '平江路', '苏州博物馆', '狮子林', '山塘街', '留园', '金鸡湖', '诚品书店', '虎丘'],
  南京: ['夫子庙', '秦淮河', '老门东', '南京博物院', '中山陵', '玄武湖', '颐和路', '先锋书店', '明孝陵'],
  成都: ['宽窄巷子', '人民公园', '春熙路', '太古里', '武侯祠', '锦里', '玉林路', '东郊记忆', '成都博物馆'],
  厦门: ['鼓浪屿', '沙坡尾', '曾厝垵', '环岛路', '中山路', '植物园', '集美学村', '白城沙滩', '厦门大学'],
  北京: ['故宫', '天安门', '景山公园', '颐和园', '圆明园', '798艺术区', '南锣鼓巷', '什刹海', '中国美术馆', '环球影城'],
  广州: ['广州塔', '沙面', '永庆坊', '陈家祠', '北京路', '上下九', '珠江新城', '白云山', '广东省博物馆', '东山口'],
  重庆: ['洪崖洞', '解放碑', '山城步道', '磁器口', '长江索道', '鹅岭二厂', '南山', '重庆美术馆', '南滨路'],
  西安: ['钟楼', '回民街', '西安城墙', '大雁塔', '陕西历史博物馆', '大唐不夜城', '永兴坊', '兵马俑', '大明宫'],
  深圳: ['南头古城', '华侨城', '人才公园', '深圳湾公园', '世界之窗', '莲花山公园', '深圳博物馆', '海上世界', '东门老街'],
  长沙: ['岳麓山', '橘子洲', '太平街', '坡子街', '湖南博物院', 'IFS国金中心', '杜甫江阁', '五一广场', '湘江'],
  青岛: ['栈桥', '八大关', '小麦岛', '五四广场', '青岛啤酒博物馆', '大学路', '台东', '崂山'],
  武汉: ['东湖', '黄鹤楼', '昙华林', '湖北省博物馆', '江汉路', '户部巷', '武汉大学', '汉口江滩'],
  昆明: ['翠湖', '滇池', '斗南花市', '云南省博物馆', '昆明老街', '文林街', '官渡古镇', '西山'],
  三亚: ['亚龙湾', '椰梦长廊', '鹿回头', '天涯海角', '大东海', '三亚湾', '蜈支洲岛', '免税城'],
  桂林: ['漓江', '象鼻山', '阳朔', '两江四湖', '东西巷', '遇龙河', '西街', '龙脊梯田'],
  哈尔滨: ['中央大街', '圣索菲亚教堂', '松花江', '太阳岛', '冰雪大世界', '黑龙江省博物馆', '老道外', '红专街早市'],
  贵阳: ['青云市集', '黔灵山公园', '甲秀楼', '贵州省博物馆', '花溪', '青岩古镇', '文昌阁', '天河潭'],
  张家界: ['天门山', '武陵源', '张家界国家森林公园', '十里画廊', '宝峰湖', '大庸古城', '溪布街', '黄石寨'],
}

const tagRules: Array<[string, RegExp]> = [
  ['City Walk', /city\s*walk|citywalk|散步|漫步|街区/i],
  ['逛吃', /逛吃|美食|吃喝|餐厅|小吃|早茶/i],
  ['拍照', /拍照|出片|机位|摄影|打卡/i],
  ['夜景', /夜景|夜游|灯光|日落|蓝调/i],
  ['亲子', /亲子|带娃|儿童/i],
  ['低预算', /免费|低预算|穷游|省钱|人均\s*[一二三四五六七八九十\d]+/i],
  ['住宿', /住宿|酒店|住在|民宿/i],
  ['交通', /交通|地铁|公交|轮渡|打车|不绕路/i],
  ['展览', /展览|博物馆|美术馆|艺术区/i],
]

type SearchResult = {
  rank?: number
  author?: string
  title?: string
  url?: string
  published_at?: string
  likes?: string | number
}

type NoteField = { field?: string; value?: unknown }

function sleep(ms: number) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

async function runOpenCli(args: string[]) {
  const command = process.platform === 'win32' && !process.env.OPENCLI_BIN && windowsOpenCliEntry ? 'node.exe' : openCliBin
  const commandArgs = process.platform === 'win32' && !process.env.OPENCLI_BIN && windowsOpenCliEntry
    ? [windowsOpenCliEntry, ...args]
    : args
  const result = await execFileAsync(command, commandArgs, {
    cwd: repoRoot,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  })
  return result.stdout.trim()
}

function parseJson<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`${label} 没有返回有效 JSON。`)
  }
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value)
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return value
  }
}

function parseLikes(value: string | number | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value !== 'string') return null
  const normalized = value.trim().replaceAll(',', '').replaceAll('，', '')
  const match = normalized.match(/^(\d+(?:\.\d+)?)(万|千)?$/i)
  if (!match) return null
  const amount = Number(match[1]) * (match[2] === '万' ? 10_000 : match[2] === '千' ? 1_000 : 1)
  return Number.isFinite(amount) ? Math.round(amount) : null
}

function readNoteFields(fields: NoteField[]) {
  return Object.fromEntries(fields
    .filter((item) => typeof item.field === 'string')
    .map((item) => [item.field as string, typeof item.value === 'string' ? item.value : String(item.value ?? '')]))
}

function extractTags(text: string) {
  return tagRules.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag)
}

function extractDays(text: string) {
  const match = text.match(/(?:^|[^\d])([1-9]\d?)\s*(?:天|日)(?:[一二三四五六七八九十夜晚游]|\s|$)/)
  return match ? `${match[1]}天` : null
}

function extractPlaces(city: string, text: string) {
  return (cityPlaceHints[city] ?? []).filter((place) => text.includes(place))
}

function createClaims(city: string, text: string, tags: string[], places: string[]): GuideClaim[] {
  const claims: GuideClaim[] = []
  if (places.length > 0) {
    claims.push({
      type: 'place',
      text: `社区攻略提到：${places.join('、')}`,
      placeName: places[0],
      confidence: 0.62,
      verified: false,
    })
  }
  if (places.length > 1 && /➡️|→|->|—|至|到/.test(text)) {
    claims.push({
      type: 'route',
      text: `社区攻略把${places.slice(0, 6).join('、')}作为候选串联路线`,
      confidence: 0.55,
      verified: false,
    })
  }
  if (tags.length > 0) {
    claims.push({
      type: 'activity',
      text: `社区内容呈现的体验主题：${tags.join('、')}`,
      confidence: 0.5,
      verified: false,
    })
  }
  return claims
}

function makeSummary(city: string, title: string, content: string, tags: string[], places: string[]) {
  const days = extractDays(`${title} ${content}`)
  const parts = [`${city}旅行攻略线索`]
  if (days) parts.push(days)
  if (tags.length > 0) parts.push(`主题：${tags.slice(0, 4).join('、')}`)
  if (places.length > 0) parts.push(`地点：${places.slice(0, 8).join('、')}`)
  parts.push('仅作社区体验参考，价格、营业时间和路线需出行前复核。')
  return parts.join('；')
}

function buildCandidate(city: string, result: SearchResult, detail?: Record<string, string>): GuideCandidate | null {
  const sourceUrl = typeof result.url === 'string' ? canonicalUrl(result.url) : ''
  const title = (detail?.title || result.title || '').trim()
  if (!sourceUrl || !title) return null
  const content = detail?.content || ''
  const searchable = `${title}\n${content}`
  const tags = extractTags(searchable)
  const placeHints = extractPlaces(city, searchable)
  const id = `xhs-${createHash('sha256').update(sourceUrl).digest('hex').slice(0, 16)}`
  return {
    id,
    city,
    platform: 'xiaohongshu',
    sourceUrl,
    title,
    author: (detail?.author || result.author || '未知作者').trim(),
    publishedAt: detail?.published_at || result.published_at || null,
    fetchedAt: new Date().toISOString(),
    likes: parseLikes(detail?.likes || result.likes),
    summary: makeSummary(city, title, content, tags, placeHints),
    tags,
    placeHints,
    claims: createClaims(city, searchable, tags, placeHints),
    permission: 'unknown',
  }
}

function parseArgs() {
  const raw = process.argv.slice(2)
  const valueAfter = (name: string) => {
    const index = raw.indexOf(name)
    return index >= 0 ? raw[index + 1] : undefined
  }
  const cities = (valueAfter('--cities') || DEFAULT_CITIES.join(','))
    .split(',')
    .map((city) => city.trim())
    .filter((city) => DEFAULT_CITIES.includes(city))
  const numberValue = (name: string, fallback: number) => {
    const value = Number(valueAfter(name))
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback
  }
  return {
    cities: cities.length > 0 ? cities : DEFAULT_CITIES,
    searchLimit: Math.max(1, Math.min(10, numberValue('--limit', DEFAULT_SEARCH_LIMIT))),
    detailLimit: Math.max(0, Math.min(4, numberValue('--details', DEFAULT_DETAIL_LIMIT))),
    delayMs: Math.max(2_000, Math.min(15_000, numberValue('--delay', DEFAULT_DELAY_MS))),
  }
}

async function readExisting(): Promise<GuideKnowledgeBase> {
  try {
    const parsed = JSON.parse(await readFile(outputPath, 'utf8')) as Partial<GuideKnowledgeBase>
    return {
      version: 1,
      generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : new Date(0).toISOString(),
      guides: Array.isArray(parsed.guides) ? parsed.guides as GuideCandidate[] : [],
    }
  } catch {
    return { version: 1, generatedAt: new Date(0).toISOString(), guides: [] }
  }
}

async function main() {
  const options = parseArgs()
  const existing = await readExisting()
  const collected = new Map(existing.guides
    .filter((guide) => guide.platform !== 'xiaohongshu' || !options.cities.includes(guide.city))
    .map((guide) => [guide.id, guide]))
  let searchCount = 0
  let detailCount = 0

  for (const city of options.cities) {
    let results: SearchResult[] = []
    try {
      const searchText = await runOpenCli(['xiaohongshu', 'search', `${city} 旅行攻略`, '--limit', String(options.searchLimit), '-f', 'json'])
      searchCount += 1
      results = parseJson<SearchResult[]>(searchText, `${city} 搜索`)
    } catch (error) {
      console.warn(`[xhs] ${city} 搜索失败，跳过本城市：${error instanceof Error ? error.message : '未知错误'}`)
    }
    const selected = Array.isArray(results) ? results.filter((item) => item && typeof item.url === 'string') : []
    for (let index = 0; index < selected.length; index += 1) {
      const result = selected[index]
      let detail: Record<string, string> | undefined
      if (index < options.detailLimit && result.url) {
        await sleep(options.delayMs)
        try {
          const noteText = await runOpenCli(['xiaohongshu', 'note', result.url, '-f', 'json'])
          detail = readNoteFields(parseJson<NoteField[]>(noteText, `${city} 笔记`))
          detailCount += 1
        } catch (error) {
          console.warn(`[xhs] ${city} 笔记读取失败，保留搜索摘要：${error instanceof Error ? error.message : '未知错误'}`)
        }
      }
      const candidate = buildCandidate(city, result, detail)
      if (candidate) collected.set(candidate.id, candidate)
    }
    console.log(`[xhs] ${city}: ${selected.length} search results, ${Math.min(selected.length, options.detailLimit)} detail slots`)
    if (city !== options.cities.at(-1)) await sleep(options.delayMs)
  }

  const guides = [...collected.values()]
    .sort((left, right) => (right.fetchedAt || '').localeCompare(left.fetchedAt || ''))
  await mkdir(resolve(repoRoot, 'data'), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), guides }, null, 2)}\n`, 'utf8')
  console.log(`[xhs] knowledge base updated: ${guides.length} summaries, ${searchCount} searches, ${detailCount} note reads`)
  console.log(`[xhs] output: ${outputPath}`)
}

main().catch((error) => {
  console.error(`[xhs] collection failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
