/**
 * Cities explicitly removed from this project must also stay out of cached
 * and external guide results. This is an exclusion rule, not a content catalog.
 */
export const RUNTIME_EXCLUDED_CITIES: ReadonlySet<string> = new Set(['大同'])

export function isRuntimeCityAllowed(city: string) {
  return !RUNTIME_EXCLUDED_CITIES.has(city.trim())
}

export function filterRuntimeGuides<T extends { city: string }>(guides: T[]) {
  return guides.filter((guide) => isRuntimeCityAllowed(guide.city))
}
