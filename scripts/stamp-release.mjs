import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
const output = process.argv[2] || 'dist'
if (!['dist','dist-mobile-audit'].includes(output)) throw new Error('Unknown output directory')
const sha = process.env.CF_PAGES_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid build commit')
const dirty = !process.env.CF_PAGES_COMMIT_SHA && Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim())
const builtAt = new Date().toISOString()
const buildId = dirty ? sha + '-local-' + Date.now() : sha
const worker = await readFile('public/sw.js', 'utf8')
await writeFile(output+'/sw.js', worker.replace('__BUILD_SHA__', buildId))
await writeFile(output+'/build.json', JSON.stringify({ sha, buildId, dirty, builtAt, auditOnly:output!=='dist', knowledgeVersion: process.env.KNOWLEDGE_VERSION || null, knowledgeApproved: process.env.KNOWLEDGE_RELEASE_APPROVED === 'true' }))
