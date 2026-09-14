import { useEffect, useRef, useState } from 'react'
import { cityNames } from '../demo-data/cities'
import { getCityImageGallery } from '../demo-data/city-images'
import { authorizedSocialPhotos } from '../demo-data/authorized-social-photos'

export function resolveMediaAsset(city: string, preferred?: string) {
  const reviewed = authorizedSocialPhotos.find(photo => photo.localPath === preferred && photo.city === city)
  if (reviewed) return {src:reviewed.localPath, sourceUrl:reviewed.sourceUrl, license:'作者授权（用户声明）', alt:`${city} · ${reviewed.placeName}`}
  const gallery = cityNames.includes(city) ? getCityImageGallery(city) : []
  const image = gallery.find(asset => asset.src === preferred) ?? gallery[0]
  if (preferred?.startsWith('data:image/') || preferred?.startsWith('blob:')) return { src: preferred, sourceUrl: '', license: '用户提供', alt: `${city}行程封面` }
  return image
}
/** Decode/network/permission errors and a stalled request terminate in a neutral placeholder once. */
export function MediaAsset({ city, src, alt, className = '', adaptiveRatio = false, eager = false }: { city: string; src?: string; alt?: string; className?: string; adaptiveRatio?: boolean; eager?: boolean }) {
  const asset = resolveMediaAsset(city, src)
  // An explicitly selected route/place image must not be silently replaced by a city image.
  const cityReference = !src && Boolean(asset?.src)
  const url = src || asset?.src
  const galleryPosition = asset && 'objectPosition' in asset ? asset.objectPosition : undefined
  const objectPosition = authorizedSocialPhotos.find(photo => photo.localPath === url)?.objectPosition
    ?? (typeof galleryPosition === 'string' ? galleryPosition : undefined)
  const ref=useRef<HTMLImageElement>(null),[visible,setVisible]=useState(false)
  const [failed, setFailed] = useState(false), [loaded, setLoaded] = useState(false)
  useEffect(() => { setFailed(false); setLoaded(false) }, [url])
  useEffect(()=>{if(!ref.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:'200px'});observer.observe(ref.current);return()=>observer.disconnect()},[url])
  useEffect(() => { if (!visible || loaded || failed) return; const timer = setTimeout(() => setFailed(true), 6000); return () => clearTimeout(timer) }, [url, visible, loaded, failed])
  return failed || !url ? <div className={`${className} media-neutral`} role="img" aria-label={`${city}，暂无可用图片`}><span>{city || '旅行'} · 暂无图片</span></div> : <img ref={ref} className={className} src={url} alt={cityReference?`${city}城市参考图：${asset?.alt??''}`:alt ?? asset?.alt ?? city} title={cityReference?'同城参考图，非路线各站实拍':undefined} loading={eager ? 'eager' : 'lazy'} decoding="async" data-source={url===asset?.src?asset?.sourceUrl:undefined} data-license={url===asset?.src?asset?.license:undefined} style={{ ...(adaptiveRatio ? { aspectRatio: '4 / 5', objectFit: 'cover' as const } : {}), ...(objectPosition ? {objectPosition} : {}) }} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
}
