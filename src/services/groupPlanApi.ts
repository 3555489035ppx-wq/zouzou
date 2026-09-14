import type { GroupPlan, GroupPlanEvent, GroupPlanInput, GroupPlanJoinInput } from './groupPlans'
import { parseGroupPlan, parseGroupPlanEvent } from './groupPlanSchemas'
import type {GeneratedPlan} from './trip/planner'
import {collaborationSnapshot} from './trip/collaborationSnapshot'

export class GroupPlanApiError extends Error {
  constructor(public readonly code: string, message: string) { super(message) }
}

async function request<T>(path: string, parse: (value: unknown) => T | null, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  } catch {
    throw new GroupPlanApiError('NETWORK_ERROR', '计划服务暂时没有连接，请稍后重试。')
  }
  const userId = response.headers.get('X-Zouzou-User')
  if (userId) localStorage.setItem('zouzou-group-plan-user-id', userId)
  const payload = await response.json().catch(() => null) as T & { error?: string; message?: string }
  if (!response.ok) throw new GroupPlanApiError(payload?.error ?? 'REQUEST_FAILED', payload?.message ?? (response.status >= 500 ? '计划服务暂时没有连接，请稍后重试。' : '这份计划暂时无法处理，请稍后重试。'))
  const parsed = parse(payload)
  if (parsed === null) throw new GroupPlanApiError('INVALID_RESPONSE', '计划服务返回的数据不完整，请稍后重试。')
  return parsed
}

export const groupPlanApi = {
  updateTrip: (plan:GeneratedPlan) => request<GroupPlan>(`/api/group-plans/${encodeURIComponent(plan.sourceGroup!.planId)}/trip`,parseGroupPlan,{method:'PUT',body:JSON.stringify({trip:collaborationSnapshot(plan),expectedRevision:plan.sourceGroup!.tripRevision??1})}),
  revokeInvite: (planId: string) => request<GroupPlan>(`/api/group-plans/${encodeURIComponent(planId)}/revoke-invite`, parseGroupPlan, { method: 'POST', body: '{}' }),
  create: (input: GroupPlanInput) => request<GroupPlan>('/api/group-plans', parseGroupPlan, { method: 'POST', body: JSON.stringify(input) }),
  get: (planId: string) => request<GroupPlan>(`/api/group-plans/${encodeURIComponent(planId)}`, parseGroupPlan),
  getInvite: (code: string) => request<GroupPlan>(`/api/group-plans/invite/${encodeURIComponent(code)}`, parseGroupPlan),
  join: (code: string, user: GroupPlanJoinInput) => request<GroupPlan>(`/api/group-plans/invite/${encodeURIComponent(code)}/join`, parseGroupPlan, { method: 'POST', body: JSON.stringify(user) }),
  createPoll: (planId: string, actorId: string, input: { title: string; type: 'single' | 'multiple' | 'time'; options: string[]; maxSelections?: number }) => request<GroupPlan>(`/api/group-plans/${encodeURIComponent(planId)}/polls`, parseGroupPlan, { method: 'POST', body: JSON.stringify({ actorId, ...input }) }),
  vote: (planId: string, pollId: string, participantId: string, optionIds: string[]) => request<GroupPlan>(`/api/group-plans/${encodeURIComponent(planId)}/polls/${encodeURIComponent(pollId)}/vote`, parseGroupPlan, { method: 'PUT', body: JSON.stringify({ participantId, optionIds }) }),
  close: (planId: string, pollId: string, actorId: string) => request<GroupPlan>(`/api/group-plans/${encodeURIComponent(planId)}/polls/${encodeURIComponent(pollId)}/close`, parseGroupPlan, { method: 'POST', body: JSON.stringify({ actorId }) }),
  resolve: (planId: string, pollId: string, actorId: string, winningOptionId: string, expectedRevision: number) => request<GroupPlan>(`/api/group-plans/${encodeURIComponent(planId)}/polls/${encodeURIComponent(pollId)}/resolve`, parseGroupPlan, { method: 'POST', body: JSON.stringify({ actorId, winningOptionId, expectedRevision }) }),
  reopen: (planId: string, pollId: string, actorId: string) => request<GroupPlan>(`/api/group-plans/${encodeURIComponent(planId)}/polls/${encodeURIComponent(pollId)}/reopen`, parseGroupPlan, { method: 'POST', body: JSON.stringify({ actorId }) }),
  leave: (planId: string, participantId: string) => request<GroupPlan>(`/api/group-plans/${encodeURIComponent(planId)}/leave`, parseGroupPlan, { method: 'POST', body: JSON.stringify({ participantId }) }),
  subscribe(planId: string, onEvent: (event: GroupPlanEvent) => void, onError?: () => void) {
    const source = new EventSource(`/api/group-plans/${encodeURIComponent(planId)}/events`)
    source.onmessage = (message) => { try { const event = parseGroupPlanEvent(JSON.parse(message.data)); if (event) onEvent(event) } catch { /* ignore malformed realtime event */ } }
    source.onerror = () => onError?.()
    return () => source.close()
  },
}

const USER_KEY = 'zouzou-group-plan-user-id'

function createGroupPlanUserId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint32Array(4)
    crypto.getRandomValues(values)
    return `user-${Array.from(values).map((value) => value.toString(16).padStart(8, '0')).join('')}`
  }
  return `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function getGroupPlanUserId() {
  let userId = localStorage.getItem(USER_KEY)
  if (!userId) { userId = createGroupPlanUserId(); localStorage.setItem(USER_KEY, userId) }
  return userId
}
