import { loadAmap, type AMapMapLike } from './provider'

export async function createAmapMap(container: HTMLElement, options: Record<string, unknown> = {}): Promise<AMapMapLike> {
  const AMap = await loadAmap()
  return new AMap.Map(container, options)
}

