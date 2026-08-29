import type { AMapPoint } from './provider'

export type AmapPoi = { id: string; name: string; position: AMapPoint; category?: string }

/** Local POI contract; a real search adapter can be wired without changing UI callers. */
export interface AmapPoiAdapter {
  search(keyword: string, center?: AMapPoint): Promise<AmapPoi[]>
}

export const localPoiAdapter: AmapPoiAdapter = {
  async search() { return [] },
}

