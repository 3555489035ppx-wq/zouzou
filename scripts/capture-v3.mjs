import { chromium } from '@playwright/test'
import { mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'

const base='http://127.0.0.1:4173',out=path.resolve('artifacts/v3')
await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true})
async function record(name,flow){const temp=path.join(out,`temp-${name}`);await mkdir(temp,{recursive:true});const context=await browser.newContext({viewport:{width:402,height:874},recordVideo:{dir:temp,size:{width:402,height:874}}});const page=await context.newPage();await flow(page);const video=page.video();await context.close();if(video)await copyFile(await video.path(),path.join(out,`${name}.webm`))}

await record('recording-1-start-home-ai',async page=>{await page.goto(base+'/');await page.waitForTimeout(900);await page.goto(base+'/home');await page.waitForTimeout(900);await page.locator('.entry-card').first().click();await page.waitForTimeout(1100);await page.getByRole('button',{name:'帮我看看'}).click();await page.waitForTimeout(5200)})
await record('recording-2-route-arrival',async page=>{await page.goto(base+'/trips');await page.waitForTimeout(1800);await page.locator('.trip-controls > button').first().click();await page.waitForTimeout(7200)})
await record('recording-3-community-hero-use',async page=>{await page.goto(base+'/community');await page.waitForTimeout(1000);await page.locator('.community-card__open').first().click();await page.waitForTimeout(8200);const use=page.getByRole('button',{name:'使用这个行程'});if(await use.isVisible()){await use.click();await page.waitForTimeout(900);await page.getByRole('button',{name:/尽量保持原路线/}).click();await page.waitForTimeout(1000)}})
await browser.close()
