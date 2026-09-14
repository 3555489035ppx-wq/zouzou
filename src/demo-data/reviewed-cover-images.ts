import photos from '../../data/journey-images/reviewed-cover-photos.json'
import type { CityImage } from './city-images'

export type ReviewedCoverPhoto = CityImage & { city: string; aliases?: string[]; reviewedAt: string }
export const reviewedCoverPhotos = photos as ReviewedCoverPhoto[]
export function getReviewedCoverImages(city: string): CityImage[] {
  return reviewedCoverPhotos.filter(photo => photo.city === city).flatMap(photo =>
    [photo.landmark, ...(photo.aliases ?? [])].map(landmark => ({ ...photo, landmark })),
  )
}
