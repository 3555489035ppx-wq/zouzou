import { z } from 'zod'
import { generatedPlanSchema } from './trip/schemas'
import type { GeneratedPlan } from './trip/planner'

export type AgentMessage = { role: 'user' | 'assistant'; content: string }
const responseSchema = z.object({
  kind: z.enum(['clarify', 'insufficient', 'recommendations', 'plans']),
  answer: z.string().min(1).max(6000),
  provider: z.string(),
  model: z.string(),
  knowledgeVersion: z.string(),
  trace: z.array(z.string()).max(12),
  sources: z.array(z.object({ id: z.string(), title: z.string(), url: z.string().nullable(), updatedAt: z.string() })).max(8),
  plans: z.array(generatedPlanSchema).max(3),
  recommendations: z.array(z.object({
    id: z.string(), title: z.string(), summary: z.string(),
    places: z.array(z.string()), tags: z.array(z.string()),
  })).max(5).optional(),
  warnings: z.array(z.string()).optional(),
  context: z.string().max(3500).optional(),
})
export type AgentResult = Omit<z.infer<typeof responseSchema>, 'plans'> & { plans: GeneratedPlan[] }

export async function sendAgentMessage(messages: AgentMessage[], signal: AbortSignal): Promise<AgentResult> {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '')
  const response = await fetch(base + '/api/agent/chat', {
    method: 'POST', credentials: 'include', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  const payload: unknown = await response.json().catch(() => null)
  signal.throwIfAborted()
  if (!response.ok) {
    const error = z.object({ message: z.string() }).safeParse(payload)
    throw new Error(error.success ? error.data.message : '旅行助手暂时不可用，请稍后重试。')
  }
  const checked = responseSchema.safeParse(payload)
  if (!checked.success) throw new Error('返回内容不完整，原来的对话和行程没有改变。')
  return checked.data as AgentResult
}
