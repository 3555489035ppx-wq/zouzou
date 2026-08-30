export type AnalyticsValue = string | number | boolean
export type AnalyticsEventName =
  | 'route_requested'
  | 'route_succeeded'
  | 'route_failed'
  | 'route_retried'
  | 'plan_selected'
  | 'trip_understanding_retried'
  | 'location_permission'
  | 'performance_measure'

export type AnalyticsEvent = {
  name: AnalyticsEventName
  at: number
  properties: Record<string, AnalyticsValue>
}

const MAX_EVENTS = 100
const events: AnalyticsEvent[] = []
const sensitiveKey = /(?:text|prompt|body|content|url|href|token|key|phone|email|lat|lng|lon|coord|address|location)/i

function redact(properties: Record<string, AnalyticsValue>) {
  return Object.fromEntries(Object.entries(properties).filter(([key]) => !sensitiveKey.test(key)))
}

export function track(name: AnalyticsEventName, properties: Record<string, AnalyticsValue> = {}) {
  events.push({ name, at: Date.now(), properties: redact(properties) })
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
}

export function trackPerformance(metric: string, durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return
  track('performance_measure', { metric, durationMs: Math.round(durationMs) })
}

export function getAnalyticsSnapshot() {
  return events.map((event) => ({ ...event, properties: { ...event.properties } }))
}

export function clearAnalytics() {
  events.length = 0
}
