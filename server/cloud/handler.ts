import { CloudError, digest, json, secretToken, type CloudDatabase } from './database'
import { handlePrivateTrips } from './private-trips'
import { handleCloudCommunity } from './community'
import { handleCloudAI } from './ai'
import { handleCloudGroupPlans } from './group-plans'

export type CloudEnv = {
  DB?: CloudDatabase
  PUBLIC_APP_ORIGIN?: string
  KNOWLEDGE_VERSION?: string
  KNOWLEDGE_RELEASE_APPROVED?: string
  AI_PROVIDER?: string; DEEPSEEK_API_KEY?: string; DEEPSEEK_MODEL?: string; OPENAI_API_KEY?: string; OPENAI_MODEL?: string
  /** 微信小程序 appid，用于识别来自本小程序的请求。 */
  MINI_PROGRAM_APP_ID?: string
}
const sessionCookie = (value:string,secure:boolean,expires=false) => `zouzou_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${expires?0:2592000}${secure?'; Secure':''}`
function cookieToken(request:Request) { return request.headers.get('cookie')?.split(';').map(value=>value.trim()).find(value=>value.startsWith('zouzou_session='))?.slice(15) }

const DEFAULT_MINI_APP_ID = 'wx314187b9a9c98213'
/**
 * 微信小程序里的 wx.request 由原生 WebView 发出，会带
 * `Origin: https://servicewechat.com` 与 `Referer: https://servicewechat.com/{appid}/{version}/page-frame.html`，
 * 既不是同源、也会被标成 Sec-Fetch-Site: cross-site，因此会被下面的 CSRF 校验挡掉（实测 403）。
 * 这里只放行「Referer 里带本站小程序 appid」的请求——appid 无法伪造，
 * 其它站点或其它小程序仍然照旧被拒。
 */
function fromOwnMiniProgram(request:Request,env:CloudEnv) {
  const referer=(request.headers.get('referer')??'').toLowerCase()
  if(!referer)return false
  const appId=(env.MINI_PROGRAM_APP_ID?.trim()||DEFAULT_MINI_APP_ID).toLowerCase()
  return referer.startsWith(`https://servicewechat.com/${appId}/`)
}

async function rateLimit(db:CloudDatabase,bucket:string,max:number,windowMs:number) {
  const expires = Math.floor(Date.now()/windowMs)*windowMs+windowMs
  const key = `${bucket}:${expires}`
  const row = await db.prepare('INSERT INTO cloud_rate_limits(bucket,used,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET used=used+1 RETURNING used').bind(key,expires).first<{used:number}>()
  if (!row || row.used>max) throw new CloudError(429,'请求过于频繁，请稍后重试。')
}
export async function handleCloudRequest(request:Request,env:CloudEnv):Promise<Response> {
  let setCookie:string|undefined,actor:string|undefined
  const url=new URL(request.url),secure=url.protocol==='https:'
  const finish=(response:Response)=>{
    const headers=new Headers(response.headers)
    headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');headers.set('X-Robots-Tag','noindex, nofollow')
    if(setCookie)headers.set('Set-Cookie',setCookie)
    if(actor)headers.set('X-Zouzou-User',actor)
    return new Response(response.body,{status:response.status,headers})
  }
  try {
    if (!url.pathname.startsWith('/api/')) throw new CloudError(404,'接口不存在。')
    if (request.method==='OPTIONS') return finish(new Response(null,{status:204}))
    if (!['GET','HEAD'].includes(request.method)) {
      const origin=request.headers.get('origin')
      const ownMini=fromOwnMiniProgram(request,env)
      if (!ownMini && (request.headers.get('sec-fetch-site')==='cross-site' || (origin && origin!==url.origin))) throw new CloudError(403,'请从走走页面发起操作。')
      if (request.body && !request.headers.get('content-type')?.startsWith('application/json')) throw new CloudError(415,'请使用JSON请求。')
    }
    if (!env.DB) throw new CloudError(503,'云端数据库尚未配置。你的本机数据未改变。')
    const db=env.DB
    const token=cookieToken(request)
    const tokenHash=token && /^[a-f0-9]{64}$/.test(token)?await digest(token):undefined
    const existing=tokenHash?await db.prepare('SELECT user_id,expires_at FROM cloud_sessions WHERE token_hash=?').bind(tokenHash).first<{user_id:string;expires_at:number}>():null
    if (url.pathname==='/api/session/logout' && request.method==='POST') {
      if(tokenHash)await db.prepare('DELETE FROM cloud_sessions WHERE token_hash=?').bind(tokenHash).run()
      setCookie=sessionCookie('',secure,true)
      return finish(json({loggedOut:true}))
    }
    if (existing && existing.expires_at>Date.now()) actor=existing.user_id
    // Public snapshot reads do not create identities or enumerate private records.
    const publicShare=request.method==='GET' && /^\/api\/shares\/[^/]+$/.test(url.pathname)
    if (!actor && !publicShare && url.pathname!=='/api/health') {
      const ip=request.headers.get('cf-connecting-ip')??'local'
      await rateLimit(db,`sessions:${await digest(ip)}`,30,3600000)
      const next=secretToken();actor=crypto.randomUUID()
      await db.prepare('INSERT INTO cloud_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(next),actor,Date.now()+30*86400000).run()
      setCookie=sessionCookie(next,secure)
    }
    if (url.pathname==='/api/health' && request.method==='GET') return finish(json({ok:true,runtime:'cloudflare-pages',storage:'d1',knowledgeVersion:env.KNOWLEDGE_VERSION??null,knowledgeApproved:env.KNOWLEDGE_RELEASE_APPROVED==='true',aiConfigured:Boolean(env.AI_PROVIDER==='deepseek'?env.DEEPSEEK_API_KEY:env.OPENAI_API_KEY)}))
    if (url.pathname==='/api/session' && request.method==='GET') return finish(json({userId:actor,kind:'guest',expiresInDays:30,message:'访客身份仅用于当前浏览器；清除Cookie、退出或换设备后不能找回，请保留独立副本。'}))
    if (url.pathname==='/api/guides' && request.method==='GET') return finish(await handleCloudAI(request,env,env.KNOWLEDGE_VERSION??''))
    if (!['GET','HEAD'].includes(request.method)) await rateLimit(db,`write:${actor}`,60,60000)
    if (/^\/api\/trips\/(understand|generate|media\/analyze)$/.test(url.pathname)) {
      await rateLimit(db,`ai:${actor}`,20,60000)
      await rateLimit(db,'ai:global',500,86400000)
      return finish(await handleCloudAI(request,env,env.KNOWLEDGE_VERSION??''))
    }
    if(url.pathname.startsWith('/api/community/'))return finish(await handleCloudCommunity(request,db,actor!))
    if(url.pathname.startsWith('/api/group-plans'))return finish(await handleCloudGroupPlans(request,db,actor!))
    return finish(await handlePrivateTrips(request,db,actor??''))
  } catch (cause) {
    return finish(json({code:cause instanceof CloudError?`HTTP_${cause.status}`:'SERVICE_UNAVAILABLE',message:cause instanceof CloudError?cause.message:'云端服务暂时不可用，请稍后重试。'},cause instanceof CloudError?cause.status:503))
  }
}
