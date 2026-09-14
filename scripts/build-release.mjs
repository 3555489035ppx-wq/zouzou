import { build } from 'vite'
import { readFile, copyFile, mkdir, writeFile, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
const assets=JSON.parse(await readFile('data/release/assets.json','utf8'))
const knowledge=JSON.parse(await readFile('data/release/knowledge.json','utf8'))
if(knowledge.approvalBasis!=='owner-confirmed'||!knowledge.knowledgeVersion)throw Error('Missing release approval/version')
process.env.KNOWLEDGE_VERSION=knowledge.knowledgeVersion
process.env.KNOWLEDGE_RELEASE_APPROVED='true'
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'))
for(const target of [config,config.env.preview,config.env.production]){target.vars.KNOWLEDGE_VERSION=knowledge.knowledgeVersion;target.vars.DEEPSEEK_MODEL='deepseek-flash'}
await writeFile('wrangler.jsonc',JSON.stringify(config,null,2)+'\n')
// Force the authoritative TS config; the old generated vite.config.js is not used.
await build({configFile:'vite.config.ts',publicDir:false,build:{outDir:'dist',emptyOutDir:true}})
for(const asset of assets.files) {
  const source='public'+asset.path,destination='dist'+asset.path
  if((await stat(source)).size>25*1024*1024)throw Error('Oversize asset '+asset.path)
  await mkdir(dirname(destination),{recursive:true});await copyFile(source,destination)
}
for(const name of ['manifest.webmanifest','offline.html','_headers'])await copyFile('public/'+name,'dist/'+name)
await writeFile('dist/_routes.json',JSON.stringify({version:1,include:['/api/*'],exclude:[]}))
execFileSync(process.execPath,['scripts/stamp-release.mjs'],{stdio:'inherit'})
console.log(JSON.stringify({knowledgeVersion:knowledge.knowledgeVersion,assets:assets.files.length,bytes:assets.totalBytes}))
