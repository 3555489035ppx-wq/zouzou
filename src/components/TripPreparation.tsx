import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { getReplacementCandidates, type GeneratedPlan } from '../services/trip/planner'
import { buildTravelGuide, guideMarkdown } from '../services/trip/guide'

const sourceName = (url: string) => {
  try {
    const host = new URL(url).hostname
    if (host.endsWith('amap.com')) return '高德地图地点资料'
    if (host.endsWith('bilibili.com')) return '视频参考'
    return host
  } catch { return '查看参考资料' }
}
export function TripPreparation({plan,day,onChooseReplacement}:{plan:GeneratedPlan;day:string;onChooseReplacement:(stopId:string)=>void}) {
  const [open,setOpen]=useState<'prepare'|'backup'|null>(null)
  const guide=open?buildTravelGuide(plan):null
  const sections=guide?.sections.filter((_,index)=>(open==='prepare'?[9,11,12,13,15]:[14]).includes(index))??[]
  const sources=[...new Set(sections.flatMap(section=>section.sources))].filter(url=>/^https?:\/\//.test(url))
  const alternatives=open==='backup'?(plan.days[day]??[]).filter(stop=>!stop.fixed&&!plan.execution?.some(event=>event.stopId===stop.id&&event.action==='completed')).map(stop=>({stop,candidates:getReplacementCandidates(plan,stop.id)})).filter(item=>item.candidates.length):[]
  return <section className="trip-preparation" aria-label="出发准备与当天备选">
    <div className="trip-preparation__tabs"><button type="button" aria-expanded={open==='prepare'} onClick={()=>setOpen(open==='prepare'?null:'prepare')}>出发准备</button><button type="button" aria-expanded={open==='backup'} onClick={()=>setOpen(open==='backup'?null:'backup')}>{day} 备选</button></div>
    {open==='backup'?<div className="trip-preparation__alternatives"><h3>当天备选地点</h3><p>预订和已完成的站点保留。选择替代前，请核对营业时间和余票。</p>{alternatives.length?alternatives.map(({stop,candidates})=><article key={stop.id}><span>{stop.time}</span><h4>{stop.name}</h4><p>备选：{candidates.map(candidate=>candidate.name).join('、')}</p><button type="button" onClick={()=>onChooseReplacement(stop.id)} aria-label={`为${stop.name}选择替代`}>选择替代</button></article>):<p>当天暂无符合条件的备选地点，可在日程中调整未锁定安排。</p>}</div>:null}
    {sections.map(section=><section className="trip-preparation__section" key={section.id}><h3>{section.title}</h3><ul>{section.lines.map((line,index)=><li key={index}>{line}</li>)}</ul></section>)}
    {sources.length?<details className="trip-preparation__sources"><summary>参考资料 · {sources.length}</summary><ul>{sources.map((url,index)=><li key={url}><a href={url} target="_blank" rel="noreferrer"><span>{index+1}. {sourceName(url)}</span><ExternalLink size={16} aria-hidden="true" /></a></li>)}</ul></details>:null}
  </section>
}
export function TripExport({plan}:{plan:GeneratedPlan}) {
  const download=()=>{const url=URL.createObjectURL(new Blob([guideMarkdown(plan)],{type:'text/markdown;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`${plan.city}-行程-v${plan.revision??1}.md`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  return <button type="button" onClick={download}>导出当前版本行程</button>
}
