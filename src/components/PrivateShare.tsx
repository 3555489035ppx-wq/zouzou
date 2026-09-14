import { useEffect, useRef, useState } from 'react'
import type { GeneratedPlan } from '../services/trip/planner'
import { shareSnapshot } from '../services/trip/shareSnapshot'
import { getShareUrl } from '../services/share'
import { ensureCloudSession } from '../services/cloudTrips'

type Link = {token:string;expiresAt:number;revision?:number}
async function shareRequest(path:string,init:RequestInit={}) {
  await ensureCloudSession()
  const response=await fetch(path,{...init,cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',...init.headers}})
  const value=await response.json().catch(()=>null)
  if(!response.ok)throw Error(value?.message??'分享服务未连接，请稍后重试。')
  return value
}
export function PrivateShare({plan,heading=true}:{plan:GeneratedPlan;heading?:boolean}) {
  const [links,setLinks]=useState<Link[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const [preview,setPreview]=useState(false),[ttl,setTtl]=useState(7)
  const pending=useRef(false),snapshot=shareSnapshot(plan)
  useEffect(()=>{
    let active=true;setLinks([]);setMessage('');setPreview(false)
    if(plan.tripId)void shareRequest('/api/shares?tripId='+encodeURIComponent(plan.tripId)).then(value=>{if(active){setLinks(Array.isArray(value.shares)?value.shares:[]);if(value.storage==='local-server')setMessage('当前连接电脑上的本地服务，不是已部署云端。此处链接不能作为正式手机分享交付。')}}).catch(()=>{if(active)setMessage('暂未读取已有链接；创建或撤销时会重新验证。')})
    return()=>{active=false}
  },[plan.tripId])
  const run=async(action:()=>Promise<void>)=>{if(pending.current)return;pending.current=true;setBusy(true);try{await action()}catch(cause){setMessage(cause instanceof Error?cause.message:'分享操作未完成，请重试。')}finally{pending.current=false;setBusy(false)}}
  const create=()=>run(async()=>{
    const data=await shareRequest('/api/shares',{method:'POST',body:JSON.stringify({plan,expiresInDays:ttl})})
    if(typeof data?.token!=='string')throw Error('服务器未返回有效分享链接。')
    setLinks(current=>[{token:data.token,expiresAt:data.expiresAt,revision:plan.revision},...current.filter(link=>link.token!==data.token)])
    setPreview(false);setMessage(data.storage==='local-server'?'只读链接已保存在当前电脑的本地服务，尚未部署到云端。':'云端只读链接已创建，尚未发送给任何人。')
  })
  const summary=[snapshot.title,snapshot.city+' · '+Object.keys(snapshot.days).length+'天',...Object.entries(snapshot.days).flatMap(([day,stops])=>[day,...stops.map(stop=>stop.time+' '+stop.name+' '+stop.address)])].join('\n')
  const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);setMessage('已复制，尚未确认送达。')}catch{setMessage('复制失败，请长按下方链接或展开摘要手动复制。')}}
  return <section className="private-share">
    {heading?<><h2>分享行程</h2><h3>{snapshot.title}</h3></>:null}
    <p>持链接的人可查看并转发，这是只读快照，不会公开到发现广场。</p>
    <p>分享活动名称、时间、地址、停留及预算；排除私人备注、票据、住宿和到离信息。请先核对活动地址没有私人住址。</p>
    <label>新链接有效期<select value={ttl} disabled={busy} onChange={event=>setTtl(Number(event.target.value))}><option value={1}>1天</option><option value={7}>7天</option><option value={30}>30天</option></select></label>
    {!preview?<button className="zou-button zou-button--primary" type="button" disabled={!plan.savedAt||busy} onClick={()=>setPreview(true)}>预览并创建只读链接</button>:<div aria-label="分享内容预览">
      <h3>{snapshot.title}</h3><p>{snapshot.dates?snapshot.dates.start+'—'+snapshot.dates.end:'日期待确认'} · {snapshot.partySize}人 · {snapshot.places}个地点</p>
      <p>版本{snapshot.revision} · {ttl}天有效 · 预算{plan.budgetLimit===null?'待确认':'¥'+plan.budgetLimit}</p>
      {Object.entries(snapshot.days).map(([day,stops])=><details key={day}><summary>{day} · {stops.length}项安排</summary>{stops.map(stop=><p key={stop.id}>{stop.time} · {stop.name} · {stop.address||'地址待确认'}</p>)}</details>)}
      <button type="button" disabled={busy} onClick={()=>void create()}>{busy?'正在创建…':'确认创建'+ttl+'天只读链接'}</button><button type="button" disabled={busy} onClick={()=>setPreview(false)}>取消</button>
    </div>}
    {!plan.savedAt?<p>请先选用并保存行程。</p>:null}
    {links.map(link=>{
      const url=getShareUrl('/share/'+link.token)
      return <div key={link.token}><p>到期：{new Date(link.expiresAt).toLocaleString('zh-CN')}</p><p><a style={{overflowWrap:'anywhere'}} href={url}>{url}</a></p>
        <button type="button" onClick={async()=>{
          const data={title:snapshot.title,url}
          if(!navigator.share||(navigator.canShare&&!navigator.canShare(data))){setMessage('此浏览器不支持系统分享，请复制链接。');return}
          try{await navigator.share(data);setMessage('分享操作已交给系统，请在接收端确认。')}catch(cause){setMessage(cause instanceof Error&&cause.name==='AbortError'?'已取消分享，链接仍可使用。':'系统分享未完成，请复制链接重试。')}
        }}>发送给朋友</button><button type="button" onClick={()=>void copy(url)}>复制链接</button>
        <button type="button" disabled={busy} onClick={()=>void run(async()=>{
          await shareRequest('/api/shares/'+link.token+'/update',{method:'POST',body:JSON.stringify(plan)})
          setMessage('此链接已更新为版本'+(plan.revision??1)+'，到期时间不变。')
        })}>将此链接更新为当前行程</button>
        <button type="button" disabled={busy} onClick={()=>void run(async()=>{
          await shareRequest('/api/shares/'+link.token+'/revoke',{method:'POST'})
          setLinks(current=>current.filter(item=>item.token!==link.token));setMessage('已撤销，接收端下次读取会被拒绝。无法收回此前保存、复制或截图的内容。')
        })}>撤销分享</button>
      </div>
    })}
    <button type="button" onClick={()=>void copy(summary)}>复制行程摘要</button><details><summary>查看可手动复制的摘要</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{summary}</pre></details>
    <p role="status">{message}</p>
  </section>
}
