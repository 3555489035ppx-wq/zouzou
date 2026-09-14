import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cityNames } from './cities'
import { getHomeGuideRecommendations, getItineraryPlazaItems, getRoute } from './discover'
import { getCityImageGallery } from './city-images'
import { authorizedSocialPhotos } from './authorized-social-photos'
import { discoverCoverIndex } from './discover-cover-index'
import { reviewedCoverPhotos } from './reviewed-cover-images'
import { coverVisualIdentity, isUserFacingCover, placesMatch } from '../services/journey-images/presentation'
import excluded from '../../data/journey-images/cover-exclusions-2026-09-14.json'

describe('reviewed itinerary covers', () => {
  it('provides three distinct real covers for every home city', () => {
    for (const city of cityNames) {
      const entries = getHomeGuideRecommendations(city)
      expect(entries, city).toHaveLength(3)
      expect(new Set(entries.map(entry => coverVisualIdentity(entry.cover))).size, city).toBe(3)
      for (const entry of entries) expect(getRoute(entry.routeId)?.cover).toBe(entry.cover)
    }
  })

  it('keeps all public multiday covers local, reviewed and tied to a place in that route', () => {
    const entries = getItineraryPlazaItems()
    expect(entries.length).toBeGreaterThan(1000)
    expect(new Set(entries.map(entry => entry.cityId))).toEqual(new Set(cityNames))
    for (const entry of entries) {
      expect(isUserFacingCover(entry.cover), entry.id).toBe(true)
      expect(fs.existsSync(`public${entry.cover}`), entry.cover).toBe(true)
      const route = getRoute(entry.routeId)!
      const names = [
        ...getCityImageGallery(entry.cityId).filter(photo => photo.src === entry.cover).map(photo => photo.landmark),
        ...authorizedSocialPhotos.filter(photo => photo.city === entry.cityId && photo.localPath === entry.cover).map(photo => photo.placeName),
        ...Object.values(discoverCoverIndex).flatMap(selection => selection.image?.city === entry.cityId && selection.image.cachedUrl === entry.cover ? [selection.image.placeName ?? ''] : []),
      ]
      expect(names.some(name => route.pois.some(poi => placesMatch(name, poi.name))), `${entry.id}: ${entry.cover}`).toBe(true)
    }
  })

  it('rejects every visually excluded image at the common image gate', () => {
    for (const photo of excluded) expect(isUserFacingCover(photo.src), photo.src).toBe(false)
    const rejected = new Set(excluded.map(photo => photo.src))
    expect(getItineraryPlazaItems().some(entry => rejected.has(entry.cover))).toBe(false)
  })

  it('retains source and reuse metadata for new web photos', () => {
    expect(reviewedCoverPhotos.length).toBeGreaterThanOrEqual(12)
    for (const photo of reviewedCoverPhotos) {
      expect(photo.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
      expect(photo.credit).not.toBe('')
      expect(photo.license).toMatch(/^CC/)
      expect(fs.existsSync(`public${photo.src}`)).toBe(true)
    }
  })
})
