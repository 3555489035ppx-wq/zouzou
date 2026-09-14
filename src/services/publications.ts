import { readVersioned, writeVersioned } from './storage'
import type { GeneratedPlan } from './trip/planner'
import { tripSummary } from './trip/summary'

export type LocalPublication = { season?: string; audience?: string; publicRevision?: number; id: string; tripId: string; tripRevision: number; revision: number; title: string; body: string; city: string; dates: string; cover: string; experience: 'planned' | 'experienced'; status: 'draft' | 'published' | 'retracted'; updatedAt: string; stops: Array<{ name: string; time: string; day: string }> }
const KEY = 'zouzou-local-publications-v1'
export const readPublications = () => readVersioned<LocalPublication[]>(KEY, 'local') ?? []
export function savePublication(value: LocalPublication) {
  const stored = readPublications(), previous = stored.find(item => item.id === value.id)
  if (previous && previous.revision > value.revision) throw Error('这条内容已有新版本，请重新打开后修改')
  const next = { ...value, revision: value.revision + 1, updatedAt: new Date().toISOString() }
  if (!writeVersioned(KEY, [next, ...stored.filter(item => item.id !== value.id)], 'local')) throw Error('本机保存失败，原发布未改变')
  window.dispatchEvent(new Event('zouzou-publications-updated'))
  return next
}
export function publicationDraft(plan: GeneratedPlan): LocalPublication {
  return { id: crypto.randomUUID(), tripId: plan.tripId!, tripRevision: plan.revision ?? 1, revision: 0, title: tripSummary(plan).title, body: '', city: plan.city, dates: tripSummary(plan).dates, cover: '', experience: plan.status === 'completed' ? 'experienced' : 'planned', status: 'draft', updatedAt: new Date().toISOString(), stops: Object.entries(plan.days).flatMap(([day, stops]) => stops.filter(stop => !['住宿', '到达', '返程', '取行李', '退房'].includes(stop.type)).map(stop => ({ day, name: stop.name, time: stop.time }))) }
}
