// Keep an isolated old-version browser open across the next Git deployment.
import { chromium, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
const seed=JSON.parse(await readFile('.wrangler/mobile-release-persistence.json','utf8'))
const base=seed.base,output='docs/qa/2026-09-14-mobile-release'
const browser=await chromium.launch({channel:'chrome',headless:true})
const context=await browser.newContext({storageState:seed.storageState,viewport:{width:390,height:844},reducedMotion:'reduce'})
const page=await context.newPage();page.setDefaultTimeout(25000)
const result={base,oldSha:seed.sha,checks:[],testedAt:new Date().toISOString()}
const check=(name,passed)=>{result.checks.push({name,passed});console.log(JSON.stringify({name,passed}));if(!passed)throw Error(name)}
try {
  await page.goto(base+'/trips');await page.getByText('本机行程与云端保存',{exact:true}).click()
  await page.getByRole('button',{name:'读取当前访客的云端行程',exact:true}).click();await expect(page.getByRole('status')).toContainText('补入1份')
  await page.goto(base+'/travel/new');await page.getByLabel('旅行想法',{exact:true}).fill('升级验收草稿：上海2天2人，稍后继续编辑。')
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;window.__qaDocumentMarker='same-document'})
  const before=await page.evaluate(()=>({draft:localStorage.getItem('zouzou-current-draft-v2'),trips:localStorage.getItem('zouzou-saved-plans-v1')}))
  check('old deployment has saved trip and editable draft',Boolean(before.draft&&before.trips))
  console.log('UPDATE_PROBE_READY')
  const deadline=Date.now()+7*60000
  let next
  while(Date.now()<deadline) {
    const response=await context.request.get(base+'/build.json')
    if(response.ok()){const build=await response.json();if(build.sha!==seed.sha){next=build;break}}
    await new Promise(resolve=>setTimeout(resolve,10000))
  }
  if(!next)throw Error('Next deployment did not arrive within seven minutes')
  result.newSha=next.sha
  await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration())?.update()})
  await page.getByRole('button',{name:'准备更新',exact:true}).waitFor()
  check('update availability does not reload current document',await page.evaluate(()=>window.__qaDocumentMarker==='same-document'))
  await page.getByRole('button',{name:'准备更新',exact:true}).click()
  await page.waitForFunction(async sha=>(await caches.keys()).includes('zouzou-static-'+sha),next.sha)
  check('activating new worker preserves current document',await page.evaluate(()=>window.__qaDocumentMarker==='same-document'))
  const after=await page.evaluate(()=>({draft:localStorage.getItem('zouzou-current-draft-v2'),trips:localStorage.getItem('zouzou-saved-plans-v1')}))
  check('update preserves exact draft and saved trip values',before.draft===after.draft&&before.trips===after.trips)
  await page.screenshot({path:output+'/update-preserves-draft.png',fullPage:true})
  await page.reload();await expect(page.getByLabel('旅行想法',{exact:true})).toHaveValue('升级验收草稿：上海2天2人，稍后继续编辑。')
  check('manual reopen retains draft and same trip',await page.evaluate(()=>localStorage.getItem('zouzou-saved-plans-v1'))===before.trips)
}catch(cause){result.error=cause instanceof Error?cause.message:String(cause);process.exitCode=1}
finally{await writeFile(output+'/update-results.json',JSON.stringify(result,null,2));await browser.close();console.log(JSON.stringify(result))}
