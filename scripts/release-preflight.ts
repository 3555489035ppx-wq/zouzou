import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const requiredFiles = [
  'package.json',
  '.env.example',
  'src/components/RealRouteMap.tsx',
  'src/services/amap/route.ts',
  'src/services/storage.ts',
  'server/index.ts',
]
const warnings: string[] = []
const failures: string[] = []

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) failures.push(`缺少发布必需文件：${file}`)
}

const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }
for (const script of ['typecheck', 'test', 'build', 'release:preflight']) {
  if (!packageJson.scripts?.[script]) failures.push(`package.json 缺少脚本：${script}`)
}

const envExample = readFileSync(resolve(root, '.env.example'), 'utf8')
for (const key of ['VITE_MAP_PROVIDER', 'VITE_WALKING_ROUTE_URL', 'CORS_ORIGIN']) {
  if (!envExample.includes(key)) failures.push(`.env.example 缺少配置说明：${key}`)
}

const mapProvider = (process.env.VITE_MAP_PROVIDER ?? 'maplibre').trim().toLowerCase()
if (mapProvider === 'amap' && !(process.env.VITE_AMAP_KEY && process.env.VITE_AMAP_SECURITY_KEY)) {
  failures.push('VITE_MAP_PROVIDER=amap 时必须同时提供 VITE_AMAP_KEY 和 VITE_AMAP_SECURITY_KEY')
} else if (mapProvider !== 'amap') {
  warnings.push('当前使用 MapLibre + 公共步行路线服务；生产需确认地图瓦片、OSRM 配额、归属和 SLA。')
}

if (!process.env.CORS_ORIGIN) warnings.push('未设置 CORS_ORIGIN；开发模式允许 *，生产必须配置明确的前端来源。')
if (process.env.RELEASE_PREFLIGHT_STRICT === '1' && warnings.length > 0) failures.push(...warnings.map((warning) => `严格发布门禁：${warning}`))

for (const message of failures) console.error(`FAIL  ${message}`)
for (const message of warnings) console.warn(`WARN  ${message}`)
if (failures.length > 0) process.exitCode = 1
else console.log('PASS  静态发布门禁通过；请继续执行 typecheck、test 和 build。')
