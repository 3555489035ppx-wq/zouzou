// Local code verification only. Deliberately NOT a deployable release:
// public contains 11.4 GB of unreviewed-for-publication assets.
import { build } from 'vite'
import { mkdir, copyFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
await build({ publicDir: false, build: { outDir: 'dist-mobile-audit', emptyOutDir: true } })
await mkdir('dist-mobile-audit/assets/pwa', { recursive: true })
for (const name of ['manifest.webmanifest','offline.html','_headers']) await copyFile('public/'+name,'dist-mobile-audit/'+name)
for (const name of ['icon-192.png','icon-512.png','maskable-512.png','apple-touch-icon.png','favicon-32.png']) await copyFile('public/assets/pwa/'+name,'dist-mobile-audit/assets/pwa/'+name)
execFileSync(process.execPath,['scripts/stamp-release.mjs','dist-mobile-audit'],{stdio:'inherit'})
