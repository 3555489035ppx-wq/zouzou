export type AsyncStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'empty'
  | 'timeout'
  | 'unauthorized'
  | 'rate-limited'
  | 'offline'
  | 'cancelled'
  | 'error'

export type AsyncErrorCode =
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'OFFLINE'
  | 'CANCELLED'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN'

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: AsyncErrorCode,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'ServiceError'
  }
}

export type AsyncState<T> =
  | { status: 'idle' | 'loading'; data: T | null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'empty'; data: T | null; error: null }
  | { status: Exclude<AsyncStatus, 'idle' | 'loading' | 'success' | 'empty'>; data: T | null; error: ServiceError }

export function classifyServiceError(error: unknown, signal?: AbortSignal): ServiceError {
  if (error instanceof ServiceError) return error
  if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
    return new ServiceError('请求已取消。', 'CANCELLED', { cause: error })
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new ServiceError('当前处于离线状态。', 'OFFLINE', { cause: error })
  }
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : NaN
  if (status === 401 || status === 403) return new ServiceError('服务授权已失效。', 'UNAUTHORIZED', { cause: error })
  if (status === 429) return new ServiceError('请求过于频繁，请稍后再试。', 'RATE_LIMITED', { cause: error })
  const message = error instanceof Error ? error.message : '服务暂时不可用。'
  return new ServiceError(message, 'UNKNOWN', { cause: error })
}

export function formatAsyncError(error: unknown, signal?: AbortSignal) {
  return classifyServiceError(error, signal).message
}
