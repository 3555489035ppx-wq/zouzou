import { chromium } from '@playwright/test'
const base='https://codex-mobile-cloud-release.zouzou-etq.pages.dev'
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext(),page=await context.newPage()
const workerErrors=[]
context.on('console',message=>{if(message.type()==='error')workerErrors.push(message.text())})
try {
  await page.goto(base+'/settings/install')
  await page.evaluate(async()=>navigator.serviceWorker.ready.then(()=>true))
  await page.reload()
  const before=await page.evaluate(async()=>{const cached=await caches.match('/offline.html');return {controlled:Boolean(navigator.serviceWorker.controller),keys:await caches.keys(),offlineCached:Boolean(cached),cachedResponse:cached?{url:cached.url,redirected:cached.redirected,status:cached.status,type:cached.type}:null}})
  console.log(JSON.stringify({before}))
  await context.setOffline(true)
  let navigationError
  try{await page.goto(base+'/share/invalid-offline-probe')}catch(cause){navigationError=cause.message.split('\n')[0]}
  const text=await page.locator('body').innerText().catch(()=>''),passed=text.includes('暂时没有网络')
  console.log(JSON.stringify({passed,navigationError,text:text.slice(0,180),workerErrors}))
  if(!passed)process.exitCode=1
}finally{await browser.close()}
