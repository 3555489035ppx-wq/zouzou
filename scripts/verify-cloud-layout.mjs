import { chromium, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
const seed=JSON.parse(await readFile('.wrangler/mobile-release-persistence.json','utf8'))
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({storageState:seed.storageState,viewport:{width:390,height:844}}),page=await context.newPage()
try {
  await page.goto(seed.base+'/trips');await page.getByText('本机行程与云端保存',{exact:true}).click()
  await page.getByRole('button',{name:'读取当前访客的云端行程',exact:true}).click();await expect(page.getByRole('status')).toContainText('补入1份')
  await expect(page.locator('.trip-ticket')).toHaveCount(1)
  await page.getByText('本机行程与云端保存',{exact:true}).click()
  await page.evaluate(async()=>{document.documentElement.style.fontSize='200%';await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})
  const overflow=await page.locator('.trip-ticket').evaluate(ticket=>Array.from(ticket.querySelectorAll('h3,time,small,.trip-ticket__main,.trip-ticket__stub,.trip-ticket__bottom')).filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>({className:el.className,tag:el.tagName,scroll:el.scrollWidth,client:el.clientWidth})))
  await page.locator('.trip-ticket').scrollIntoViewIfNeeded()
  await page.screenshot({path:'docs/qa/2026-09-14-mobile-release/preview/saved-trips-200.png',fullPage:true})
  const result={loadedTicket:true,fontScale:2,overflow,passed:overflow.length===0}
  await writeFile('docs/qa/2026-09-14-mobile-release/preview/layout-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
  if(overflow.length)process.exitCode=1
}finally{await browser.close()}
