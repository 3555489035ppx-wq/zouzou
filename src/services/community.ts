export type CommunityContent = { season?: string; audience?: string; title: string; body: string; city: string; cover: string; experience: 'planned' | 'experienced'; stops: Array<{ name: string; day: string; time: string }> }
export type CommunityPost = CommunityContent & { id: string; revision: number; status: 'published' | 'retracted'; authorId: string; nickname: string; owned: boolean; updatedAt: string; likes: number; favorites: number; liked: boolean; saved: boolean; following: boolean; commentCount: number }
export type CommunitySummary = Omit<CommunityPost, 'body' | 'cover' | 'stops'> & { excerpt: string; stopCount: number }
export type CommunityComment = { id: string; body: string; nickname: string; owned: boolean }
async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/community/${path}`, { method, signal, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json().catch(() => ({ message: '社区服务暂时不可用' }))
  if (!response.ok) throw Error(data.message ?? '操作失败，请重试')
  return data
}
export const communityApi = {
  list: (mode: string, cursor = '', signal?: AbortSignal) => request<{ items: CommunitySummary[]; nextCursor: string | null }>(`posts?mode=${encodeURIComponent(mode)}&cursor=${encodeURIComponent(cursor)}`, 'GET', undefined, signal),
  get: (id: string, signal?: AbortSignal) => request<CommunityPost>(`posts/${id}`, 'GET', undefined, signal),
  publish: (id: string, expectedRevision: number, requestId: string, nickname: string, content: CommunityContent) => request<CommunityPost>(`posts/${id}`, 'PUT', { expectedRevision, requestId, nickname, content }),
  retract: (id: string, expectedRevision: number) => request<{ revision: number }>(`posts/${id}/retract`, 'POST', { expectedRevision }),
  react: (id: string, kind: 'like' | 'favorite', enabled: boolean) => request<CommunityPost>(`posts/${id}/reactions`, 'PUT', { kind, enabled }),
  follow: (author: string, enabled: boolean) => request(`authors/${author}/follow`, 'PUT', { enabled }),
  comments: (id: string, offset = 0, signal?: AbortSignal) => request<{ items: CommunityComment[]; nextOffset: number | null }>(`posts/${id}/comments?offset=${offset}`, 'GET', undefined, signal),
  comment: (post: string, id: string, body: string, nickname: string) => request(`posts/${post}/comments`, 'POST', { id, body, nickname }),
  removeComment: (post: string, id: string) => request(`posts/${post}/comments/${id}/remove`, 'POST', {}),
}
