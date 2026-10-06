import { z } from 'zod'
import { generatedPlanSchema } from './trip/schemas'
import type { GeneratedPlan } from './trip/planner'

export type AgentMessage = { role: 'user' | 'assistant'; content: string }
const responseSchema = z.object({
  requestId: z.string().uuid(),
  quality: z.literal('draft').optional(),
  followUp: z.string().max(400).optional(),
  changeScope: z.enum(['new', 'regenerated']).optional(),
  comparisons: z.array(z.object({
    subject: z.string(), status: z.enum(['supported', 'insufficient']), sourceIds: z.array(z.string()),
    evidence: z.array(z.object({ text: z.string(), sourceId: z.string(), verified: z.boolean() })),
  })).max(3).optional(),
  reasons: z.array(z.object({
    sourceId: z.string(), title: z.string(), matchedTags: z.array(z.string()), summary: z.string(),
  })).max(5).optional(),
  blocking: z.array(z.string()).max(12).optional(),
  kind: z.enum(['clarify', 'insufficient', 'recommendations', 'comparison', 'explanation', 'plans']),
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
  const payload = await readAgentJson(response, signal)
  signal.throwIfAborted()
  if (!response.ok) {
    const error = z.object({ message: z.string() }).safeParse(payload)
    const id = response.headers.get('X-Request-ID')
    throw new Error((error.success ? error.data.message : '旅行助手暂时不可用，请稍后重试。') + (id && /^[a-f0-9-]{36}$/i.test(id) ? '（请求编号：' + id + '）' : ''))
  }
  const checked = responseSchema.safeParse(payload)
  if (!checked.success) throw new Error('返回内容不完整，原来的对话和行程没有改变。')
  return checked.data as AgentResult
}


async function readAgentJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const limit = 1_600_000
  if (Number(response.headers.get('Content-Length')) > limit) {
    await response.body?.cancel()
    throw new Error('返回内容过大，请缩小行程范围。')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('服务没有返回内容。')
  const cancel = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      signal.throwIfAborted()
      const next = await reader.read()
      signal.throwIfAborted()
      if (next.done) break
      size += next.value.byteLength
      if (size > limit) throw new Error('返回内容过大，请缩小行程范围。')
      chunks.push(next.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    try { return JSON.parse(new TextDecoder().decode(bytes)) }
    catch { throw new Error('服务返回内容不完整，请重试。') }
  } finally {
    signal.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
