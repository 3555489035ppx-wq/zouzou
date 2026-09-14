// Live release acceptance. Uses only newly created QA guest identities/data.
// No credentials, share tokens, full trip payloads or guest IDs enter the report.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const base=process.argv[2],label=process.argv[3]??'preview'
if(!base||!/^https:\/\/(?:[a-z0-9-]+\.)?zouzou-etq\.pages\.dev$|^https:\/\/zouzou\.ppx\.wiki$/.test(base))throw Error('Expected verified zouzou deployment HTTPS origin')
if(!['preview','production'].includes(label))throw Error('Unexpected environment')
const output='docs/qa/2026-09-14-mobile-release/'+label
await mkdir(output,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true})
const a=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),b=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
const results={base,environment:label,testedAt:new Date().toISOString(),physicalPhone:false,checks:[]}
const check=(name,passed,details)=>{results.checks.push({name,passed,...(details===undefined?{}:{details})});console.log(JSON.stringify({name,passed,details}));if(!passed)throw Error(name)}
let shareToken
try {
  const health=await a.request.get(base+'/api/health'),h=await health.json()
  check('real Pages D1 health',health.ok()&&h.runtime==='cloudflare-pages'&&h.storage==='d1'&&h.knowledgeApproved&&h.aiConfigured,h)
  const build=await(await a.request.get(base+'/build.json')).json()
  check('release commit and knowledge version',/^[a-f0-9]{40}$/.test(build.sha)&&!build.dirty&&!build.auditOnly&&build.knowledgeVersion===h.knowledgeVersion,build)
  await a.request.get(base+'/api/session')
  const cookies=await a.cookies();check('server guest Secure HttpOnly cookie',cookies.some(c=>c.name==='zouzou_session'&&c.secure&&c.httpOnly&&c.sameSite==='Lax'))
  const guides=await a.request.get(base+'/api/guides?city='+encodeURIComponent('上海')+'&q='+encodeURIComponent('历史街区'))
  const guide=await guides.json();check('live versioned knowledge retrieval',guides.ok()&&guide.knowledgeVersion===h.knowledgeVersion&&guide.candidates.length>0,{count:guide.candidates?.length,version:guide.knowledgeVersion})
  const generated=await a.request.post(base+'/api/trips/generate',{data:{text:'2026年10月16日到17日去上海玩2天，2个人，总预算4000元，喜欢历史街区，节奏适中。不要填写住宿订单。',media:[]},timeout:60000})
  const data=await generated.json()
  check('actual model plus server knowledge generates plans',generated.ok()&&data.provider==='deepseek'&&data.model&&data.generationMethod==='model-intent+knowledge-constrained-scheduler'&&data.plans?.length===3,{status:generated.status(),code:data.code,message:data.message,provider:data.provider,model:data.model,method:data.generationMethod,count:data.plans?.length,version:data.knowledgeVersion})
  const trip={...data.plans[0],tripId:crypto.randomUUID(),savedAt:new Date().toISOString(),revision:1,status:'planned'}
  check('generation retains destination and dates',trip.city==='上海'&&trip.dates?.start==='2026-10-16'&&Object.keys(trip.days).length===2,{city:trip.city,dates:trip.dates,validation:trip.validation})
  const saved=await a.request.put(base+'/api/trips',{data:trip});check('A saves actual generated trip to D1',saved.ok(),{status:saved.status()})
  const read=await(await a.request.get(base+'/api/trips/'+trip.tripId)).json();check('A re-reads persisted trip',read.tripId===trip.tripId&&read.revision===1)
  const privateList=await(await b.request.get(base+'/api/trips')).json();check('B cannot enumerate A private trips',privateList.trips.length===0)
  check('B cannot read A private trip',(await b.request.get(base+'/api/trips/'+trip.tripId)).status()===404)
  const created=await a.request.post(base+'/api/shares',{data:{plan:trip,expiresInDays:1}}),link=await created.json()
  check('A creates private-trip share',created.status()===201&&/^[a-f0-9]{64}$/.test(link.token),{status:created.status()});shareToken=link.token
  const snapshot=await b.request.get(base+'/api/shares/'+shareToken),snapshotData=await snapshot.json()
  check('B reads allowlisted shared snapshot',snapshot.ok()&&!('intent'in snapshotData)&&!('evidence'in snapshotData)&&snapshot.headers()['cache-control']==='no-store')
  check('B cannot revoke A share',(await b.request.post(base+'/api/shares/'+shareToken+'/revoke')).status()===403)
  const page=await b.newPage(),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message))
  await page.goto(base+'/share/'+shareToken);await page.getByRole('heading',{level:1}).waitFor()
  check('B loads shared trip deep link',(await page.locator('.page-content').innerText()).includes('上海'))
  await page.getByRole('button',{name:/打开.+地图/}).first().click();await page.getByRole('dialog').waitFor()
  check('official external map choices available',await page.getByRole('dialog').isVisible())
  await page.screenshot({path:output+'/share-map.png',fullPage:true})
  await page.reload();await page.getByRole('heading',{level:1}).waitFor();check('shared route refresh survives',true)
  const newer={...trip,revision:2,savedAt:new Date().toISOString()}
  check('A explicitly updates snapshot',(await a.request.post(base+'/api/shares/'+shareToken+'/update',{data:newer})).ok())
  check('B sees updated snapshot',(await(await b.request.get(base+'/api/shares/'+shareToken)).json()).revision===2)
  check('A revokes share',(await a.request.post(base+'/api/shares/'+shareToken+'/revoke')).ok())
  await page.reload();await page.getByRole('alert').waitFor();check('B sees revoked link failure',(await b.request.get(base+'/api/shares/'+shareToken)).status()===404)
  await page.screenshot({path:output+'/share-revoked.png',fullPage:true})
  if(label==='preview') {
    const collaboration={...trip,previousVersion:undefined,guideContext:undefined,evidence:[],days:Object.fromEntries(Object.entries(trip.days).map(([d,stops])=>[d,stops.map(s=>({...s,note:''}))]))}
    const groupResponse=await a.request.post(base+'/api/group-plans',{data:{type:'travel',trip:collaboration,city:trip.city,date:trip.dates.start,partySize:trip.partySize,budget:trip.budget,interests:[],avoidTags:[],owner:{displayName:'发布验证A'}}}),group=await groupResponse.json()
    check('cloud travel collaboration create',groupResponse.status()===201,{status:groupResponse.status(),message:group.message})
    const joined=await b.request.post(base+'/api/group-plans/invite/'+group.inviteCode+'/join',{data:{displayName:'发布验证B'}})
    check('independent guest joins invitation',joined.ok(),{status:joined.status()})
    const updatedGroup=await(await a.request.get(base+'/api/group-plans/'+group.id)).json();check('D1 persists both collaborators',updatedGroup.participants.filter(p=>p.inviteStatus==='accepted').length===2)
    check('owner revokes invitation',(await a.request.post(base+'/api/group-plans/'+group.id+'/revoke-invite',{data:{}})).ok())
    check('old invite becomes invalid',(await b.request.get(base+'/api/group-plans/invite/'+group.inviteCode)).status()===404)
  }
  await page.goto(base+'/settings/install');await page.getByRole('heading',{name:'从手机桌面打开走走'}).waitFor()
  await page.screenshot({path:output+'/install-390.png',fullPage:true})
  await page.evaluate(async()=>{await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Service worker activation timeout')),15000))])})
  check('HTTPS service worker active',await page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.active)))
  const manifest=await(await b.request.get(base+'/manifest.webmanifest')).json();check('PWA manifest and icons',manifest.name==='走走'&&manifest.icons.some(i=>i.sizes==='512x512'))
  for(const width of [320,390,430]) {
    await page.setViewportSize({width,height:844})
    for(const route of ['/home','/trips','/travel/new','/discover','/profile','/settings/install']) {
      await page.goto(base+route);await page.locator('main,.page-content').first().waitFor()
      check('no horizontal overflow '+width+' '+route,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    }
  }
  const cacheUrls=await page.evaluate(async()=>{const urls=[];for(const name of await caches.keys())for(const r of await(await caches.open(name)).keys())urls.push(r.url);return urls})
  check('no private API/share HTML caching',!cacheUrls.some(url=>url.includes('/api/')||url.includes('/share/')))
  await b.setOffline(true);await page.goto(base+'/share/'+shareToken)
  check('offline never resurrects private snapshot',(await page.locator('body').innerText()).includes('暂时没有网络'))
  await page.screenshot({path:output+'/offline.png',fullPage:true});await b.setOffline(false)
  check('browser runtime error free',errors.length===0,errors)
} catch(cause) {results.error=cause instanceof Error?cause.message:String(cause);process.exitCode=1}
finally {if(shareToken)await a.request.post(base+'/api/shares/'+shareToken+'/revoke').catch(()=>{});await writeFile(output+'/results.json',JSON.stringify(results,null,2));await browser.close();console.log(JSON.stringify({environment:label,checks:results.checks.length,error:results.error??null}))}
