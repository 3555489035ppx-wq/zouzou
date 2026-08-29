import { execFile } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { cityImages } from '../src/demo-data/city-images'

const execFileAsync = promisify(execFile)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const assetDir = resolve(repoRoot, 'public/assets/cities')
const manifestPath = resolve(assetDir, 'sources.json')

function commonsFileUrl(sourceUrl: string) {
  const fileTitle = decodeURIComponent(new URL(sourceUrl).pathname.split('/File:')[1] ?? '')
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileTitle)}?width=1280`
}

async function downloadWithWindowsHttp(url: string, targetPath: string) {
  // This environment can reach Commons through PowerShell's Windows HTTP
  // stack, while Node/curl occasionally reset Wikimedia's upload host.
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`
  const script = `$ProgressPreference="SilentlyContinue"; Invoke-WebRequest -UseBasicParsing -Headers @{"User-Agent"="zouzou-trip-prototype/0.1 (open image attribution)"} -Uri ${quote(url)} -OutFile ${quote(targetPath)}`
  let lastError: unknown
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true })
      return readFile(targetPath)
    } catch (error) {
      lastError = error
      if (attempt < 4) await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 15_000))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('图片下载失败。')
}

async function main() {
  await mkdir(assetDir, { recursive: true })
  const manifest: Record<string, unknown> = {}

  for (const [city, image] of Object.entries(cityImages)) {
    const filename = basename(image.src)
    const targetPath = resolve(assetDir, filename)
    let bytes: Buffer
    try {
      const existing = await stat(targetPath)
      bytes = existing.size >= 1_000 ? await readFile(targetPath) : await downloadWithWindowsHttp(commonsFileUrl(image.sourceUrl), targetPath)
    } catch {
      bytes = await downloadWithWindowsHttp(commonsFileUrl(image.sourceUrl), targetPath)
    }
    if (bytes.byteLength < 1_000) throw new Error(`${city} 下载结果过小，疑似不是有效图片。`)
    manifest[city] = {
      file: image.src,
      landmark: image.landmark,
      alt: image.alt,
      sourceUrl: image.sourceUrl,
      credit: image.credit,
      license: image.license,
      licenseUrl: image.licenseUrl,
      downloadedAt: new Date().toISOString(),
    }
    console.log(`[images] ${city}: ${filename} (${Math.round(bytes.byteLength / 1024)} KB)`)
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 3_000))
  }

  await writeFile(manifestPath, `${JSON.stringify({ version: 1, source: 'Wikimedia Commons', images: manifest }, null, 2)}\n`, 'utf8')
  console.log(`[images] source manifest: ${manifestPath}`)
}

main().catch((error) => {
  console.error(`[images] sync failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
