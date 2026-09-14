import photos from '../../data/journey-images/authorized-social-photos.json'
import { isUserFacingCover, placesMatch } from '../services/journey-images/presentation'

export const authorizedSocialPhotos = photos.filter(photo => isUserFacingCover(photo.localPath))
export const reviewedPhotoForPlace = (city: string, place: string) => authorizedSocialPhotos.find(photo => photo.city === city && placesMatch(photo.placeName, place))

/** Assign distinct captures only to routes containing the photographed place. */
export function assignReviewedRoutePhotos<T extends { id: string; cityId: string; dayCount?: number; pois: {name: string}[] }>(routes: T[]) {
  const used = new Set<string>()
  return Object.fromEntries([...routes].filter(route => route.dayCount).sort((a,b) => a.pois.length-b.pois.length).flatMap(route => {
    const candidates = authorizedSocialPhotos.filter(photo => !used.has(photo.sha256) && photo.city === route.cityId && (!photo.routeIds.length || photo.routeIds.includes(route.id)) && route.pois.some(poi => placesMatch(photo.placeName, poi.name)))
    const photo = candidates.find(photo => photo.routeIds.includes(route.id)) ?? candidates[0]
    if (!photo) return []
    used.add(photo.sha256)
    return [[route.id, photo]]
  }))
}
