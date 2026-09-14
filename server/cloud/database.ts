export interface CloudStatement {
  bind(...values: unknown[]): CloudStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ meta?: { changes?: number } }>
}
export interface CloudDatabase {
  prepare(sql: string): CloudStatement
  batch(statements: CloudStatement[]): Promise<unknown[]>
}
export const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' },
})
export class CloudError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export async function body(request: Request, limit = 1_000_000): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > limit) throw new CloudError(413, '内容过大，请减少附件后重试。')
  const reader = request.body?.getReader()
  if (!reader) throw new CloudError(400, '请求内容为空。')
  const chunks: Uint8Array[] = []; let size = 0
  while (true) {
    const next = await reader.read(); if (next.done) break
    size += next.value.byteLength
    if (size > limit) { await reader.cancel(); throw new CloudError(413, '内容过大，请减少附件后重试。') }
    chunks.push(next.value)
  }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { return JSON.parse(new TextDecoder().decode(bytes)) } catch { throw new CloudError(400, '请求格式不正确。') }
}
export function secretToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('') }
export async function digest(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('') }
