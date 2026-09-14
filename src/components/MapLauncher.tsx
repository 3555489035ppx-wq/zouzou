import { MapPin, Route } from 'lucide-react'
import { useState } from 'react'
import { canNavigatePlace, getMapOptions, getRouteMapOptions, type MapPlace, type MapRoute, type MapTravelMode } from '../services/mapLauncher'
import { ZouBottomSheet } from './ui'

// A named place can be searched without claiming its coordinates are verified.
const canSearchPlace = (place: MapPlace, city = place.city) => Boolean(place.name?.trim()) && !place.pendingVenue && place.name.trim() !== city && !/待选|待确认|城市中心/.test(place.name)
const safeMapPlace = (place: MapPlace, city?: string): MapPlace => canNavigatePlace(place, city) ? place : { id: place.id, name: place.name, address: place.address, city: place.city, area: place.area, pendingVenue: place.pendingVenue }


export const OpenMapButton = ({ place, city = place.city, compact = false }: { place: MapPlace; city?: string; compact?: boolean }) => {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  if (!place.name?.trim()) return null
  if (place.pendingVenue) return <span className="map-pending-location">地点待选，确认餐厅或休息位置后可导航</span>
  const options = canSearchPlace(place,city) ? getMapOptions(safeMapPlace(place,city), city) : []
  return <>
    <button type="button" className={`open-map-button${compact ? ' open-map-button--compact' : ''}`} onClick={(event) => { event.stopPropagation(); setOpen(true) }} aria-label={`打开${place.name}地图`}>
      <MapPin aria-hidden="true" />{compact ? '地图' : '打开地图'}
    </button>
    <ZouBottomSheet open={open} onClose={() => setOpen(false)} title={`打开${place.name}的地图`}>
      <div className="map-launcher-options">
        <p>{options.length?'选择地图，核对实际道路后导航。':'地点尚未明确，请先补充完整地址或复制名称核对；当前不提供导航。'}</p>
        <p>{[city,place.area,place.name,place.address].filter(Boolean).join(' · ')}</p>
        <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText([city,place.area,place.name,place.address].filter(Boolean).join(' '));setMessage('地点已复制')}catch{setMessage('无法自动复制，请长按上方地点信息复制')}}}>复制已知地点信息</button><p role="status">{message}</p>
        {[...options].sort((a,b)=>['amap','baidu','apple'].indexOf(a.provider)-['amap','baidu','apple'].indexOf(b.provider)).map((option) => <a key={option.provider} href={option.url} onClick={() => setOpen(false)}><span><strong>{option.label}</strong><small>{option.description}</small></span><span aria-hidden="true">→</span></a>)}
      </div>
    </ZouBottomSheet>
  </>
}

export const OpenRouteMapButton = ({ places, city, mode = 'walk', compact = false, label = '外部地图导航' }: { places: MapPlace[]; city?: string; mode?: MapTravelMode; compact?: boolean; label?: string }) => {
  const [open, setOpen] = useState(false)
  const [selectedMode, setSelectedMode] = useState(mode)
  const route: MapRoute = { city, mode: selectedMode, places: places.map(place=>safeMapPlace(place,city)) }
  const options = places.slice(0,2).every(place=>canSearchPlace(place,city)) ? getRouteMapOptions(route) : []
  if (places.length === 0) return null
  const validPlaces = places.filter(place=>canSearchPlace(place,city))
  if (!validPlaces.length) return <span className="map-pending-location">地点待确认，补全地址后可导航</span>
  return <>
    <button type="button" className={`open-map-button open-route-map-button${compact ? ' open-map-button--compact' : ''}`} onClick={(event) => { event.stopPropagation(); setSelectedMode(mode); setOpen(true) }} aria-label={options.length ? "打开当前站到下一站地图" : "选择地点导航"}>
      <Route aria-hidden="true" />{options.length ? label : '选择地点导航'}
    </button>
    <ZouBottomSheet open={open} onClose={() => setOpen(false)} title={`打开${city ?? '这段行程'}的地图`}>
      <div className="map-launcher-options">
        <p>{options.length ? '选择地图，查看实际道路与导航。' : '部分地点尚未确定，可先导航到以下地点。'}</p>
        {options.length ? <label>交通方式 <select value={selectedMode} onChange={event => setSelectedMode(event.target.value as MapTravelMode)}><option value="walk">步行</option><option value="drive">驾车</option><option value="transit">公交</option><option value="cycle">骑行</option></select></label> : null}
        {!options.length ? validPlaces.map(place=>{const option=getMapOptions(safeMapPlace(place,city),city).find(option=>option.provider==='amap');return option?<a key={place.id} href={option.url} onClick={()=>setOpen(false)}><span><strong>{place.name}</strong><small>在高德地图打开</small></span><span aria-hidden="true">→</span></a>:null}) : null}
        {[...options].sort((a,b)=>['amap','baidu','apple'].indexOf(a.provider)-['amap','baidu','apple'].indexOf(b.provider)).map((option) => <a key={option.provider} href={option.url} onClick={() => setOpen(false)}><span><strong>{option.label}</strong><small>{option.description}</small></span><span aria-hidden="true">→</span></a>)}
      </div>
    </ZouBottomSheet>
  </>
}
