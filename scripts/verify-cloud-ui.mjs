import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const base=process.argv[2],label=process.argv[3]??'preview'
if(!base||!/^https:\/\/(?:[a-z0-9-]+\.)?zouzou-etq\.pages\.dev$|^https:\/\/zouzou\.ppx\.wiki$/.test(base)||!['preview','production'].includes(label))throw Error('Expected verified release origin and environment')
const output='docs/qa/2026-09-14-mobile-release/'+label
await mkdir(output,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true})
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
const page=await context.newPage();page.setDefaultTimeout(25000)
const results={base,environment:label,testedAt:new Date().toISOString(),physicalPhone:false,checks:[],ai:[]},errors=[]
const check=(name,passed,details)=>{results.checks.push({name,passed,details});console.log(JSON.stringify({name,passed,details}));if(!passed)throw Error(name)}
page.on('pageerror',e=>errors.push(e.message))
page.on('response',async response=>{if(/\/api\/trips\/(understand|generate)$/.test(response.url())){const body=await response.json().catch(()=>({}));results.ai.push({endpoint:new URL(response.url()).pathname,status:response.status(),provider:body.provider,model:body.model,knowledgeVersion:body.knowledgeVersion,code:body.code,message:body.message})}})
let shareUrl
try {
  await page.goto(base+'/home');await page.getByRole('button',{name:'开始规划旅行'}).click()
  await page.getByRole('button',{name:'目的地',exact:true}).click();await page.getByRole('option',{name:'上海',exact:true}).click()
  await page.getByLabel('旅行天数',{exact:true}).fill('2');await page.getByLabel('出行人数',{exact:true}).fill('2')
  await page.getByLabel('旅行想法',{exact:true}).fill('2026年10月16日至17日去上海，2人玩2天，总预算4000元，想逛历史街区，节奏适中。')
  await page.getByRole('button',{name:'帮我看看'}).click()
  await expect(page).toHaveURL(/\/travel\/plans$/,{timeout:90000});await expect(page.locator('.plans-stack__item')).toHaveCount(3)
  check('UI calls real model and versioned server scheduler',results.ai.some(r=>r.endpoint.endsWith('/understand')&&r.status===200&&r.provider==='deepseek'&&r.knowledgeVersion)&&results.ai.some(r=>r.endpoint.endsWith('/generate')&&r.status===200),results.ai)
  await page.screenshot({path:output+'/generated-plans-390.png',fullPage:true})
  await page.getByRole('button',{name:'查看这套走法'}).first().click();await page.getByRole('button',{name:'选用并保存',exact:true}).click()
  await expect(page).toHaveURL(/\/trips\//);const savedUrl=page.url(),tripId=new URL(savedUrl).pathname.split('/').at(-1)
  const before=await page.evaluate(()=>localStorage.getItem('zouzou-saved-plans-v1'))
  check('UI saves chosen plan locally',Boolean(before)&&JSON.parse(before).value.some(p=>p.tripId===tripId))
  await page.reload();check('saved deep link reload preserves exact local data',await page.evaluate(()=>localStorage.getItem('zouzou-saved-plans-v1'))===before)
  await page.goto(base+'/trips');await page.getByText('本机行程与云端保存',{exact:true}).click()
  await page.getByRole('button',{name:'将本机行程保存到云端',exact:true}).click();await expect(page.getByRole('status')).toContainText('服务器已确认1份行程保存')
  check('UI confirms D1 save only after server response',true)
  await page.evaluate(()=>localStorage.removeItem('zouzou-saved-plans-v1'))
  await page.reload();await page.getByText('本机行程与云端保存',{exact:true}).click()
  await page.getByRole('button',{name:'读取当前访客的云端行程',exact:true}).click();await expect(page.getByRole('status')).toContainText('补入1份')
  const restored=await page.evaluate(()=>localStorage.getItem('zouzou-saved-plans-v1'))
  check('UI restores same trip from real D1',Boolean(restored)&&JSON.parse(restored).value.some(p=>p.tripId===tripId))
  await page.goto(base+'/home');await page.locator('.home-resume').click();await expect(page).toHaveURL(savedUrl)
  check('home resumes the same restored trip',true)
  await page.goto(base+'/journey/share?tripId='+encodeURIComponent(tripId))
  await page.getByRole('button',{name:'预览并创建只读链接'}).click();await page.getByRole('button',{name:'确认创建7天只读链接'}).click()
  const link=page.locator('.private-share a').first();await expect(link).toBeVisible();shareUrl=await link.getAttribute('href')
  check('UI creates share URL on intended public origin',new URL(shareUrl).origin===base)
  await page.getByRole('button',{name:'撤销分享',exact:true}).click()
  check('UI revoke reaches real server',(await context.request.get(base+'/api/shares/'+new URL(shareUrl).pathname.split('/').at(-1))).status()===404)
  await page.goto(base+'/trips');await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='200%')
  check('saved trip list at 200 percent has no page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.screenshot({path:output+'/saved-trips-200.png',fullPage:true})
  check('UI runtime error free',errors.length===0,errors)
}catch(cause){results.error=cause instanceof Error?cause.message:String(cause);await page.screenshot({path:output+'/ui-failure.png',fullPage:true}).catch(()=>{});process.exitCode=1}
finally{if(shareUrl)await context.request.post(base+'/api/shares/'+new URL(shareUrl).pathname.split('/').at(-1)+'/revoke',{data:{}}).catch(()=>{});await writeFile(output+'/ui-results.json',JSON.stringify(results,null,2));await browser.close();console.log(JSON.stringify({checks:results.checks.length,error:results.error??null,ai:results.ai}))}
