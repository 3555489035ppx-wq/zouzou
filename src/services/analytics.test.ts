import { afterEach, describe, expect, it } from 'vitest'
import { clearAnalytics, getAnalyticsSnapshot, track, trackPerformance } from './analytics'

describe('anonymous analytics buffer', () => {
  afterEach(() => clearAnalytics())

  it('drops text, location and URL fields before buffering', () => {
    track('route_requested', { stops: 3, prompt: '私人旅行文本', lat: 31.2, url: 'https://example.com/private' })
    expect(getAnalyticsSnapshot()[0]?.properties).toEqual({ stops: 3 })
  })

  it('stores rounded performance timings without sensitive fields', () => {
    trackPerformance('walking_route', 12.7)
    expect(getAnalyticsSnapshot()[0]?.properties).toEqual({ metric: 'walking_route', durationMs: 13 })
  })

  it('keeps lifecycle events anonymous', () => {
    track('journey_shared', { method: 'copy', journeyId: 'route-1', content: '不应进入事件' })
    expect(getAnalyticsSnapshot()[0]).toMatchObject({ name: 'journey_shared', properties: { method: 'copy', journeyId: 'route-1' } })
  })
})
