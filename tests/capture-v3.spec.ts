import { test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const artifactDir=path.resolve('artifacts/v3')
test.describe.configure({mode:'serial'})
test.beforeAll(async()=>{await mkdir(artifactDir,{recursive:true})})

const capture=async(page:Page,route:string,name:string,wait=500)=>{await page.goto(route);await page.waitForTimeout(wait);await page.screenshot({path:path.join(artifactDir,name),fullPage:false})}

test('V3 402x874 screenshots',async({page})=>{
  // The visual contract intentionally waits for route playback and captures
  // several full-resolution screens; give this serial artifact test its own
  // budget without weakening the functional smoke-suite timeout.
  // This is a serial visual artifact pass over several real-map states. Tile
  // loading can legitimately take longer than the functional smoke suite.
  test.setTimeout(120_000)
  await page.setViewportSize({width:402,height:874})
  await capture(page,'/home','home.png')
  await capture(page,'/travel/new','travel-create.png')
  await page.getByRole('button',{name:'帮我看看'}).click();await page.waitForTimeout(1500);await page.screenshot({path:path.join(artifactDir,'ai-thinking.png')})
  await capture(page,'/travel/plans','plans.png')
  await capture(page,'/trips','trip-overview.png',2400)
  await capture(page,'/trips?arrival=1','trip-arrived.png',2400)
  await capture(page,'/community','community.png',900)
  await capture(page,'/community/post-1/replay','community-replay.png',2400)
  await page.waitForTimeout(6200);await page.screenshot({path:path.join(artifactDir,'community-detail.png')})
  await capture(page,'/profile','profile.png')
})

for(const size of [{width:375,height:812},{width:402,height:874},{width:430,height:932}])test(`responsive ${size.width}x${size.height}`,async({page})=>{await page.setViewportSize(size);for(const route of ['/home','/travel/new','/trips','/community','/profile']){await page.goto(route);await page.waitForTimeout(route==='/trips'?1200:150);const d=await page.evaluate(()=>({s:document.documentElement.scrollWidth,c:document.documentElement.clientWidth}));if(d.s>d.c)throw new Error(`${route} horizontal overflow ${d.s-d.c}px`)}})
