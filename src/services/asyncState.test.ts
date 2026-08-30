import { describe, expect, it } from 'vitest'
import { ServiceError, classifyServiceError } from './asyncState'

describe('async service errors', () => {
  it('preserves explicit provider error codes', () => {
    const error = new ServiceError('需要授权', 'UNAUTHORIZED')
    expect(classifyServiceError(error)).toBe(error)
  })

  it('classifies aborts as cancelled', () => {
    const controller = new AbortController()
    controller.abort()
    expect(classifyServiceError(new Error('aborted'), controller.signal).code).toBe('CANCELLED')
  })
})
