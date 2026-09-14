import { useMemo } from 'react'
import { buildTravelGuide, guideMarkdown } from '../services/trip/guide'
import type { GeneratedPlan } from '../services/trip/planner'

export function TravelGuide({plan}:{plan:GeneratedPlan}) {
  const guide=useMemo(()=>buildTravelGuide(plan),[plan])
  const download=()=>{const url=URL.createObjectURL(new Blob([guideMarkdown(plan)],{type:'text/markdown;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`${plan.city}-完整路书.md`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  return <section className="travel-guide" aria-label="20维完整旅行攻略"><h2>完整旅行攻略</h2><p>{guide.executable?'算术检查通过':'待确认方案'} · {guide.knownSources}站有资料链接 / {guide.unknownStops}站缺来源。资料链接不等于实时核验。</p><button type="button" onClick={download}>导出完整Markdown路书</button>{guide.sections.map(section=><details key={section.id}><summary>{section.id} · {section.title}{section.state==='not_applicable'?'（不适用）':section.state==='unknown'?'（待确认）':''}</summary><ul>{section.lines.map((line,index)=><li key={index}>{line}</li>)}</ul>{section.sources.map(url=><p key={url}><a href={url} target="_blank" rel="noreferrer">原始资料：{new URL(url).hostname}</a></p>)}</details>)}</section>
}
