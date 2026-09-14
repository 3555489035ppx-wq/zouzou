import reviewedMealVenues from '../../../data/travel-research/reviewed-meal-venues.json'
import groundedMealVenues from '../../../data/travel-research/grounded-meal-venues.json'
import mealWebSupplement from '../../../data/travel-research/meal-web-supplement.json'
import review from '../../../data/travel-research/destination-expansion-reviewed.json'
import threePlatformRoutes from '../../../data/travel-research/three-platform-reviewed-routes.json'
import threePlatformNamedPlaces from '../../../data/travel-research/three-platform-named-places.json'
import type { CityAdditionalSpec } from './cityKnowledge.expanded'

type ReviewedEntry = Omit<(typeof review.entries)[number], 'category'> & {
  category: CityAdditionalSpec['category']
  venueName?: string
  tags?: string[]
  durationMinutes?: number
  checkedAt?: string
}

/** Named, manually reviewed experiences only; captured search results never enter here. */
export const destinationExpansion: Record<string, CityAdditionalSpec[]> = {}
const reviewedEntries = [...review.entries, ...threePlatformRoutes.entries, ...threePlatformNamedPlaces.entries, ...reviewedMealVenues.entries, ...groundedMealVenues.entries, ...mealWebSupplement.entries] as unknown as ReviewedEntry[]
for(const entry of reviewedEntries) {
  const tags=entry.tags ?? ['早餐','早餐专用','本地餐馆','本地美食']
  const spec:CityAdditionalSpec={name:entry.name,venueName:entry.venueName ?? entry.name,category:entry.category,area:entry.area,address:entry.address,
    searchKeyword:`${entry.city} ${entry.name} ${entry.area}`,menuHighlights:entry.menu,dietaryTags:entry.dietaryTags,
    summary:entry.summary,tags,durationMinutes:entry.durationMinutes ?? 35,
    price:{state:'unknown',min:0,max:0,unit:'person',note:'未取得当前菜单价格，不能将未计金额视作免费'},
    source:{kind:'community',label:'本地体验资料',url:entry.sources[0].url,checkedAt:entry.checkedAt ?? '2026-09-08'}}
  ;(destinationExpansion[entry.city]??=[]).push(spec)
}
