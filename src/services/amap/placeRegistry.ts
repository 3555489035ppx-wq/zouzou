import { readVersioned, writeVersioned } from '../storage'

export const AMAP_PLACE_REGISTRY_STORAGE = 'zouzou-amap-place-registry-v1'
const MAX_REMEMBERED_PLACES = 500

export type RememberedAmapPlace = {
  key: string
  city: string
  inputName: string
  aliases: string[]
  canonicalName: string
  address: string
  district?: string
  adcode?: string
  citycode?: string
  amapPoiId: string
  lng: number
  lat: number
  poiType?: string
  tel?: string
  category: 'restaurant' | 'place'
  searchKeyword: string
  verifiedAt: number
}

type AmapPlaceQueryLike = { city: string; name: string; searchKeyword?: string; address?: string }
type AmapPoiLike = { id: string; name: string; position: [number, number]; address?: string; category?: string; tel?: string; district?: string; adcode?: string; citycode?: string }

const normalize = (value: string) => value
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[（）()·•—\-_/：:，,。！？!?\s]/g, '')
  .trim()

const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))]

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object')

const isCategory = (value: unknown): value is RememberedAmapPlace['category'] => value === 'restaurant' || value === 'place'

const isRememberedPlace = (value: unknown): value is RememberedAmapPlace => {
  if (!isRecord(value)) return false
  return typeof value.key === 'string'
    && typeof value.city === 'string'
    && typeof value.inputName === 'string'
    && Array.isArray(value.aliases) && value.aliases.every((item) => typeof item === 'string')
    && typeof value.canonicalName === 'string'
    && typeof value.address === 'string'
    && typeof value.amapPoiId === 'string'
    && typeof value.lng === 'number' && Number.isFinite(value.lng)
    && typeof value.lat === 'number' && Number.isFinite(value.lat)
    && isCategory(value.category)
    && typeof value.searchKeyword === 'string'
    && typeof value.verifiedAt === 'number' && Number.isFinite(value.verifiedAt)
}

const readRegistry = () => {
  const value = readVersioned<unknown>(AMAP_PLACE_REGISTRY_STORAGE, 'local')
  return Array.isArray(value) ? value.filter(isRememberedPlace) : []
}

const registryKey = (city: string, inputName: string) => `${normalize(city)}:${normalize(inputName)}`

const looksLikeRestaurant = (query: AmapPlaceQueryLike, poi: AmapPoiLike) => /餐|饭|面|粉|米线|米饭|小吃|火锅|烧烤|甜品|咖啡|茶馆|吃|店|馆|菜|鸡|鸭|鱼|虾|蟹|肉|汤/.test(`${query.name} ${query.searchKeyword ?? ''} ${poi.name} ${poi.category ?? ''}`)

export function readRememberedAmapPlaces(city?: string) {
  const entries = readRegistry()
  if (!city) return entries
  const cityKey = normalize(city)
  return entries.filter((entry) => normalize(entry.city) === cityKey)
}

export function findRememberedAmapPlace(query: AmapPlaceQueryLike): RememberedAmapPlace | null {
  const candidates = readRememberedAmapPlaces(query.city)
  const needles = unique([query.name, query.searchKeyword ?? '', query.address ?? ''])
    .map(normalize)
    .filter((value) => value.length >= 2)
  if (needles.length === 0) return null

  let best: { entry: RememberedAmapPlace; score: number } | null = null
  for (const entry of candidates) {
    const haystack = entry.aliases.map(normalize).filter((value) => value.length >= 2)
    const score = needles.reduce((highest, needle) => Math.max(highest, ...haystack.map((alias) => {
      if (alias === needle) return 100
      if (alias.includes(needle) || needle.includes(alias)) return 60
      return 0
    })), 0)
    if (score > (best?.score ?? 0)) best = { entry, score }
  }
  return best ? best.entry : null
}

export function rememberedPlaceToAmapPoi(place: RememberedAmapPlace): AmapPoiLike {
  return {
    id: place.amapPoiId,
    name: place.canonicalName,
    position: [place.lng, place.lat],
    address: place.address,
    category: place.poiType,
    tel: place.tel,
    district: place.district,
    adcode: place.adcode,
    citycode: place.citycode,
  }
}

export function rememberAmapPlace(query: AmapPlaceQueryLike, poi: AmapPoiLike, verifiedAt = Date.now()) {
  const inputName = (query.name || query.searchKeyword || poi.name).trim()
  const searchKeyword = (query.searchKeyword || query.name || poi.name).trim()
  const aliases = unique([inputName, query.name, query.searchKeyword ?? '', poi.name, poi.address ?? ''])
  const entry: RememberedAmapPlace = {
    key: registryKey(query.city, inputName),
    city: query.city,
    inputName,
    aliases,
    canonicalName: poi.name,
    address: poi.address ?? '',
    district: poi.district,
    adcode: poi.adcode,
    citycode: poi.citycode,
    amapPoiId: poi.id,
    lng: poi.position[0],
    lat: poi.position[1],
    poiType: poi.category,
    tel: poi.tel,
    category: looksLikeRestaurant(query, poi) ? 'restaurant' : 'place',
    searchKeyword,
    verifiedAt,
  }
  const entries = readRegistry()
  const existingIndex = entries.findIndex((item) => item.amapPoiId === entry.amapPoiId || item.key === entry.key)
  const merged = existingIndex >= 0
    ? entries.map((item, index) => index === existingIndex ? { ...item, ...entry, aliases: unique([...item.aliases, ...entry.aliases]) } : item)
    : [entry, ...entries]
  writeVersioned(AMAP_PLACE_REGISTRY_STORAGE, merged.sort((left, right) => right.verifiedAt - left.verifiedAt).slice(0, MAX_REMEMBERED_PLACES), 'local')
  return entry
}

export function clearRememberedAmapPlaces() {
  writeVersioned(AMAP_PLACE_REGISTRY_STORAGE, [], 'local')
}

export function amapPlaceSearchUrl(query: Pick<AmapPlaceQueryLike, 'city' | 'name' | 'searchKeyword'>) {
  const keyword = (query.searchKeyword ?? query.name).trim()
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(keyword)}&city=${encodeURIComponent(query.city)}&view=map&callnative=0`
}
