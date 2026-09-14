// Two-deployment D1 probe. Local fixture, not an AI-generation acceptance.
// The disposable guest token lives only in the ignored .wrangler QA state file.
import { request } from '@playwright/test'
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { generatePlans, understandTrip } from '../src/services/trip/planner'
const mode=process.argv[2],base=process.argv[3]
if(!['seed','check'].includes(mode)||!/^https:\/\/(?:[a-z0-9-]+\.)?zouzou-etq\.pages\.dev$|^https:\/\/zouzou\.ppx\.wiki$/.test(base??''))throw Error('Expected seed/check and verified HTTPS origin')
const stateFile='.wrangler/mobile-release-persistence.json'
const evidenceFile='docs/qa/2026-09-14-mobile-release/persistence-results.json'
if(mode==='seed') {
  const api=await request.newContext({baseURL:base})
  try {
    const build=await(await api.get('/build.json')).json()
    if(build.dirty||!build.knowledgeVersion)throw Error('Not an actual versioned deployment')
    await api.get('/api/session')
    const trip={...generatePlans(understandTrip({text:'2026年10月16日上海2天2人预算4000元历史街区',media:[]}).intent)[0],tripId:crypto.randomUUID(),savedAt:new Date().toISOString(),revision:1}
    const response=await api.post('/api/shares',{data:{plan:trip,expiresInDays:1}}),share=await response.json()
    if(response.status()!==201||!share.token)throw Error('Persistence seed creation failed: '+response.status())
    await mkdir('.wrangler',{recursive:true})
    await writeFile(stateFile,JSON.stringify({base,sha:build.sha,knowledgeVersion:build.knowledgeVersion,tripId:trip.tripId,token:share.token,storageState:await api.storageState()}))
    const evidence={phase:'seed',base,sha:build.sha,knowledgeVersion:build.knowledgeVersion,seededAt:new Date().toISOString(),fixtureOnly:true,secretStateGitIgnored:true}
    await writeFile(evidenceFile,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence))
  } finally {await api.dispose()}
} else {
  const seed=JSON.parse(await readFile(stateFile,'utf8'))
  if(seed.base!==base)throw Error('Use the same verified branch alias or production origin')
  const api=await request.newContext({baseURL:base,storageState:seed.storageState})
  try {
    const build=await(await api.get('/build.json')).json()
    if(build.sha===seed.sha)throw Error('Wait for the next deployment before verifying persistence')
    const privateTrip=await api.get('/api/trips/'+seed.tripId),shared=await api.get('/api/shares/'+seed.token)
    const trip=await privateTrip.json(),snapshot=await shared.json()
    if(!privateTrip.ok()||!shared.ok()||trip.tripId!==seed.tripId||snapshot.city!=='上海')throw Error('Persisted trip/share unavailable after deployment')
    const revoked=await api.post('/api/shares/'+seed.token+'/revoke',{data:{}})
    if(!revoked.ok())throw Error('Probe share cleanup failed')
    const result={phase:'verified',base,oldSha:seed.sha,newSha:build.sha,knowledgeVersion:build.knowledgeVersion,verifiedAt:new Date().toISOString(),privateTripSurvives:true,shareSurvives:true,revokedAfterProbe:true,fixtureOnly:true}
    await writeFile(evidenceFile,JSON.stringify(result,null,2));await unlink(stateFile);console.log(JSON.stringify(result))
  } finally {await api.dispose()}
}
