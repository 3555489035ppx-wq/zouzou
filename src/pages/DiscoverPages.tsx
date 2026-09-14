import { DiscoverItinerary } from '../components/DiscoverItinerary'
import './DiscoverDetail.css'
import { FormPicker } from '../components/FormPicker'
import { formatTravelDuration } from '../design-system/format'
import { Masonry } from '../components/Masonry'
import { CommunityFeed } from '../components/CommunityFeed'
import { PublicationEditor, PublicationList } from './PublicationPages'
import { MediaAsset } from '../components/MediaAsset'
import { ArrowLeft, Bookmark, Check, ChevronDown, Heart, MessageCircle, Search, Send, Share2, Sparkles } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useNavigationType, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { OpenRouteMapButton } from '../components/MapLauncher'
import { CityPicker, ZouBottomSheet, ZouButton, ZouMotionBot, ZouNavigationBar, ZouSearchBar, ZouToast } from '../components/ui'
import { createUserDiscoverItem, getDiscoverFeed, getDiscoverItem, getExploreCityCards, getItineraryPlazaItems, getRoute, normalizeCityQuery, type DiscoverItem, type Route } from '../demo-data/discover'
import { cityNames } from '../demo-data/cities'
import type { Place } from '../demo-data/trips'
import { searchDiscoverItems } from '../services/discover/search'
import { discoveryScenes, experienceTags } from '../services/discover/presentation'
import { isUserFacingCover } from '../services/journey-images/presentation'
import { useAppStore, type PostComment } from '../stores/appStore'
import { track } from '../services/analytics'
import { copyCuratedTrip } from '../services/trip/planner'
import { writeVersioned } from '../services/storage'
import { getPlaceCoordinates } from '../services/places'
import { JourneyPlaceSheet } from '../components/JourneyPlaceSheet'
import { experienceRouteStart } from '../services/trip/experiencePolicy'

const sourceLabel: Record<DiscoverItem['contentSource'], string> = { official: '走走精选', knowledge: '知识库候选', user: '用户发布' }
const EMPTY_COMMENTS: PostComment[] = []

const durationMinutes = (value: string) => {
  const hours = Number(value.match(/(\d+(?:\.\d+)?)\s*h/)?.[1] ?? 0)
  const minutes = Number(value.match(/(\d+)\s*min/)?.[1] ?? 0)
  return Math.round(hours * 60 + minutes)
}

const travelMinutes = (value: string) => Number(value.match(/(\d+)\s*分钟/)?.[1] ?? 25)

const routeStartMinutes = (route: Route) => {
  if(route.timePeriod?.length){const [hours,minutes]=experienceRouteStart(route).split(':').map(Number);return hours*60+minutes}
  if (route.category === '聚餐') return 11 * 60 + 30
  if (route.cityId === '三亚' && route.title === '三亚慢慢走') return 15 * 60
  if (route.cityId === '三亚' && route.title.includes('看海')) return 13 * 60
  return 9 * 60 + 30
}

const clockLabel = (totalMinutes: number) => `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`

const stopBudget = (route: Route, poi: Route['pois'][number], index: number) => {
  if(poi.priceState==='unknown')return 0
  if(poi.estimatedBudget!==undefined)return poi.estimatedBudget
  const average = route.budgetMax / Math.max(1, route.pois.length)
  const diningMultipliers = [1.2, .8, .35, 1.35, .6]
  const multiplier = poi.category === '餐饮'
    ? diningMultipliers[index] ?? .75
    : route.category === '旅行' && index === 2
      ? 1.25
      : index === 0
        ? .25
        : index % 2 === 0 ? .95 : .65
  return Math.max(0, Math.round(average * multiplier / 5) * 5)
}

const routePlaces = (route: Route): Place[] => {
  let cursor = routeStartMinutes(route)
  return route.pois.map((poi, index) => {
    if (index === 0 || poi.day !== route.pois[index - 1].day) cursor = routeStartMinutes(route)
    else cursor += travelMinutes(poi.transportation)
    if (/夜逛|夜景|夜游|夜市/.test(poi.name)) cursor = Math.max(cursor, 18 * 60)
    const coordinates = poi.verified ? getPlaceCoordinates({ latitude: poi.latitude, longitude: poi.longitude }) : null
    const place = {
      id: poi.id,
      time: poi.time ?? clockLabel(cursor),
      name: poi.name,
      type: ({ attraction: '景点', food: '本地小吃', restaurant: '餐饮', activity: '体验活动' } as Record<string,string>)[poi.category] ?? poi.category,
      stay: poi.stay,
      budget: stopBudget(route, poi, index),
      priceState: poi.priceState,
      transport: poi.transportation,
      note: poi.introduction,
       ...(coordinates ? { longitude: coordinates.longitude, latitude: coordinates.latitude, lng: coordinates.longitude, lat: coordinates.latitude, ...(coordinates.coordinateSystem ? { coordinateSystem: coordinates.coordinateSystem } : {}) } : {}),
      searchKeyword: poi.name,
      ...(poi.coordinateSource ? { coordinateSource: poi.coordinateSource } : {}),
      verified: poi.verified,
    }
    cursor = (poi.time ? Number(poi.time.split(':')[0])*60+Number(poi.time.split(':')[1]) : cursor) + durationMinutes(poi.stay)
    return place
  })
}

const sectionTitle: Record<DiscoverItem['contentSource'], string> = {
  official: '走走精选',
  knowledge: '城市精选',
  user: '走走精选',
}

const DiscoverCard = ({ item, basePath, showCity = false }: { item: DiscoverItem; basePath: '/community' | '/discover'; showCity?: boolean }) => {
  const navigate = useNavigate()
  const days = Number(item.duration.match(/(\d+)\s*(?:天|日)/)?.[1] ?? 1)
  const theme = item.title.split(/[·｜|]/)[0].replace(new RegExp('^' + item.cityId), '').trim().replace(/慢慢走$/, '漫步') || item.category
  const title = showCity ? item.title.replace(/慢慢走$/, '漫步') : item.contentSource === 'user' ? item.title : (getRoute(item.routeId)?.dayCount ? item.title : item.cityId + days + '日 · ' + theme)
  const tags = showCity ? experienceTags(item, getRoute(item.routeId)).slice(0, 2) : []
  return <article className="discover-card discover-card--concise"><button className="discover-card__open" onClick={() => navigate(basePath + '/' + item.id, {state:{discoverEntry:{id:item.id,cover:item.cover}}})} aria-label={'查看' + title}>
    <MediaAsset className="community-card__image" city={item.cityId} src={item.cover} alt={item.title} adaptiveRatio={showCity} />
    <div className="discover-card__copy">{showCity ? <h2>{title}</h2> : null}<p className="discover-card__facts">{days}天 · {item.poiCount}个地点{item.featured ? <strong className="discover-featured-label"> · 走走精选</strong> : null}</p>{!showCity ? <h2>{title}</h2> : null}{showCity ? <div className="discover-card__tags">{tags.map(tag => <span key={tag}>{tag}</span>)}<span className="discover-card__location">{item.cityId}</span></div> : <span className="discover-card__location">{item.cityId}</span>}</div>
  </button></article>
}

const LegacyDiscoverPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const city = useAppStore((state) => state.city)
  const followedAuthors = useAppStore((state) => state.followedAuthors)
  const [cityOpen, setCityOpen] = useState(false)
  const [category, setCategory] = useState('推荐')
  const [section, setSection] = useState<'关注' | '探索'>('探索')
  const legacy = location.pathname.startsWith('/community')
  const basePath = legacy ? '/community' : '/discover'
  const query = searchParams.get('q') ?? ''
  const searchOpen = searchParams.get('search') === '1' || location.pathname.endsWith('/search')
  const feed = useMemo(() => {
    const filtered = getDiscoverFeed(city, undefined, []).filter((item) => item.contentSource !== 'user').filter((item) => {
      if (section === '关注') return false
      return category === '推荐' || item.category === category
    })
    return searchDiscoverItems(filtered, query, getRoute)
  }, [category, city, query, section])
  const feedSections = useMemo(() => {
    const sections: { source: DiscoverItem['contentSource']; items: DiscoverItem[] }[] = []
    feed.forEach((item) => {
      const current = sections.at(-1)
      if (current?.source === item.contentSource) current.items.push(item)
      else sections.push({ source: item.contentSource, items: [item] })
    })
    return sections
  }, [feed])
  const categories = ['推荐', '旅行', '周末', '约会', '聚餐', 'Citywalk']
  const openSearch = () => {
    const next = new URLSearchParams(searchParams)
    next.set('search', '1')
    setSearchParams(next)
  }
  const updateQuery = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('search', '1')
    if (value.trim()) next.set('q', value)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }
  const closeSearch = () => navigate(basePath)
  return <AppShell showTabBar>
    <main className={`discover-page ${legacy ? 'community-page' : ''}`}>
      <header className={`discover-header ${legacy ? 'community-header' : ''}`}>
        {legacy ? <div className="community-header__top">
          <button aria-pressed={section === '关注'} onClick={() => setSection('关注')}>关注</button>
          <button aria-pressed={section === '探索'} onClick={() => setSection('探索')}>探索</button>
          <button onClick={() => setCityOpen(true)}>{city}<ChevronDown /></button>
          <button className="icon-button" aria-label="搜索探索" onClick={openSearch}><Search /></button>
        </div> : <div className="discover-header__top"><button onClick={() => setCityOpen(true)} aria-label="选择探索城市">{city}<ChevronDown /></button><button className="icon-button" aria-label="搜索探索" onClick={openSearch}><Search /></button></div>}
        {!legacy ? <h1>探索适合今天的路线</h1> : null}
        {searchOpen ? <div className="discover-search"><ZouSearchBar value={query} onChange={updateQuery} placeholder="搜索地点、路线或场景" /><button type="button" onClick={closeSearch}>取消</button></div> : null}
        <div className={legacy ? 'community-categories' : undefined}>
          {categories.map((item) => <button key={item} aria-pressed={category === item} onClick={() => { setCategory(item); setSection('探索') }}>{item}</button>)}
        </div>
       </header>
       <section className="discover-feed" aria-label={`${city}路线推荐`}>
         {section === '关注' ? <CommunityFeed initialMode="following" controls={false}/> : feedSections.length ? feedSections.map(({ source, items }) => <section className="discover-feed__section" key={source} aria-labelledby={`discover-section-${source}`}>
          <header><div><span>{sectionTitle[source]}</span><h2 id={`discover-section-${source}`}>{source === 'knowledge' ? `${city}的城市攻略` : source === 'official' ? '今天就从一条路线出发' : '走过的人，也留下了一条路'}</h2></div><small>{items.length}{source === 'knowledge' ? ' 条精选' : ' 条'}</small></header>
          <Masonry className="discover-feed__items">{items.map((item) => <DiscoverCard key={item.id} item={item} basePath={basePath} />)}</Masonry>
         </section>) : <div className="community-empty"><ZouMotionBot state="sad" size="sm" /><h2>{query ? `没有找到“${query}”` : '这类路线还在整理中'}</h2><p>{query ? '试试地点名、路线名或“吃饭 / 看海 / 慢慢走”等关键词。' : '换一个标签，先从城市精选里找到可执行的路线。'}</p><ZouButton onClick={() => { if (query) updateQuery(''); else setSection('探索') }}>{query ? '清空搜索' : '去探索'}</ZouButton></div>}
      </section>
      <CityPicker open={cityOpen} onClose={() => setCityOpen(false)} />
    </main>
  </AppShell>
}

const ExplorePage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const systemReducedMotion = useReducedMotion()
  const reducedMotion = useAppStore(state => state.reducedMotion) || systemReducedMotion
  const exploreTab = searchParams.get('tab') === 'cities' ? 'cities' : 'plaza'
  const setExploreTab = (tab: string) => { const next=new URLSearchParams(searchParams);next.set('tab',tab);next.delete('page');setSearchParams(next) }
  const plazaFilter = searchParams.get('filter') === 'featured' ? 'featured' : 'all'
  const setPlazaFilter = (filter: string) => { const next=new URLSearchParams(searchParams);next.set('filter',filter);next.delete('page');setSearchParams(next) }
  const visibleCount = Math.min(1200, Math.max(20, (Number(searchParams.get('page')) || 1)*20))
  const query = searchParams.get('q') ?? ''
  const location = useLocation()
  const searchOpen = searchParams.get('search') === '1' || location.pathname.endsWith('/search')
  const filterCity = searchParams.get('city') ?? ''
  const filterScene = searchParams.get('scene') ?? ''
  const [filterSheet, setFilterSheet] = useState<'city' | 'scene' | null>(null)
  const plazaItems = useMemo(() => {
    const allItems = searchDiscoverItems(getItineraryPlazaItems(filterCity || undefined, 1200, plazaFilter === 'featured'), normalizeCityQuery(query), getRoute)
      .filter(item => !filterScene || experienceTags(item, getRoute(item.routeId)).includes(filterScene))
    return allItems
  }, [plazaFilter, query, filterCity, filterScene])
  const setFacet = (key: 'city' | 'scene', value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value); else next.delete(key)
    next.delete('page'); setSearchParams(next); setFilterSheet(null)
  }
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams)
    for (const key of ['city', 'scene', 'filter', 'q', 'page']) next.delete(key)
    setSearchParams(next)
  }
  const cityCards = useMemo(() => getExploreCityCards(query), [query])
  const loadSentinel = useRef<HTMLDivElement>(null)
  const searchPanel = useRef<HTMLDivElement>(null)
  const [publicOpen, setPublicOpen] = useState(false)
  useEffect(() => {
    if (!searchOpen) return
    const frame = requestAnimationFrame(() => searchPanel.current?.querySelector('input')?.focus())
    return () => cancelAnimationFrame(frame)
  }, [searchOpen])
  useEffect(() => {
    const node = loadSentinel.current
    if (!node || exploreTab !== 'plaza' || visibleCount >= plazaItems.length) return
    let frame = 0
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || frame) return
      frame = requestAnimationFrame(() => {
        const next = new URLSearchParams(searchParams)
        next.set('page', String(Math.floor(visibleCount / 20) + 1))
        setSearchParams(next, { replace: true })
      })
    }, { root: node.closest('.app-shell'), rootMargin: '280px' })
    observer.observe(node)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [exploreTab, visibleCount, plazaItems.length, searchParams, setSearchParams])
  const openSearch = () => {
    const next = new URLSearchParams(searchParams)
    next.set('search', '1')
    setSearchParams(next)
  }
  const updateQuery = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('search', '1')
    next.delete('page')
    if (value.trim()) next.set('q', value)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }
  const closeSearch = () => { const next = new URLSearchParams(searchParams); next.delete('search'); next.delete('q'); next.delete('page'); navigate(`/discover?${next}`) }
  return <AppShell showTabBar>
    <main className="discover-page explore-page">
      <header className="discover-header explore-header">
        <h1 className="sr-only">行程广场与探索</h1>
        <div className="explore-topline"><nav className="explore-section-tabs" aria-label="内容分区">
          <button aria-pressed={exploreTab === 'plaza'} onClick={() => setExploreTab('plaza')}>行程广场</button>
          <button aria-pressed={exploreTab === 'cities'} onClick={() => setExploreTab('cities')}>发现</button>
        </nav><button className="icon-button explore-search-trigger" aria-label="搜索行程和城市" aria-expanded={searchOpen} onClick={openSearch}><Search /></button></div>
        <AnimatePresence initial={false}>{searchOpen ? <motion.div ref={searchPanel} className="discover-search discover-search-motion" initial={reducedMotion ? false : { opacity: 0, height: 0, y: -4, clipPath: 'inset(0 0 100% 78% round 12px)' }} animate={{ opacity: 1, height: 44, y: 0, clipPath: 'inset(0 0 0% 0% round 12px)', transition: { duration: reducedMotion ? 0 : .26, ease: [.2, 0, 0, 1] } }} exit={{ opacity: 0, height: 0, y: -3, clipPath: 'inset(0 0 100% 78% round 12px)', transition: { duration: reducedMotion ? 0 : .18, ease: [.3, 0, 1, 1] } }}><ZouSearchBar value={query} onChange={updateQuery} placeholder="搜索城市、地点或路线" /><button type="button" onClick={closeSearch}>取消</button></motion.div> : null}</AnimatePresence>
        {exploreTab === 'plaza' ? <div className="explore-filter-strip" aria-label="行程广场筛选"><button aria-pressed={plazaFilter === 'all'} onClick={() => setPlazaFilter('all')}>全部</button><button aria-pressed={plazaFilter === 'featured'} onClick={() => setPlazaFilter('featured')}>精选</button><button className="explore-facet" aria-label={`筛选城市：${filterCity || '全部城市'}`} aria-haspopup="dialog" aria-expanded={filterSheet === 'city'} data-active={Boolean(filterCity)} onClick={() => setFilterSheet('city')}>{filterCity || '城市'}<ChevronDown size={14} /></button><button className="explore-facet" aria-label={`筛选场景：${filterScene || '全部场景'}`} aria-haspopup="dialog" aria-expanded={filterSheet === 'scene'} data-active={Boolean(filterScene)} onClick={() => setFilterSheet('scene')}>{filterScene || '场景'}<ChevronDown size={14} /></button></div> : null}
      </header>
      <ZouBottomSheet open={filterSheet !== null} onClose={() => setFilterSheet(null)} title={filterSheet === 'city' ? '选择城市' : '选择场景'}>
        <div className="explore-facet-options" aria-label={filterSheet === 'city' ? '城市选项' : '场景选项'}>
          <button aria-pressed={filterSheet === 'city' ? !filterCity : !filterScene} onClick={() => setFacet(filterSheet === 'city' ? 'city' : 'scene', '')}>{filterSheet === 'city' ? '全部城市' : '全部场景'}</button>
          {(filterSheet === 'city' ? cityNames : discoveryScenes).map(value => <button key={value} aria-pressed={(filterSheet === 'city' ? filterCity : filterScene) === value} onClick={() => setFacet(filterSheet === 'city' ? 'city' : 'scene', value)}>{value}</button>)}
        </div>
      </ZouBottomSheet>
      {exploreTab === 'plaza' ? <section className="discover-feed explore-plaza" aria-label="全部行程广场">
        {plazaItems.length ? <Masonry className="discover-feed__items">{plazaItems.slice(0,visibleCount).map((item) => <DiscoverCard key={item.id} item={item} basePath="/discover" showCity />)}</Masonry> : <div className="community-empty"><ZouMotionBot state="sad" size="sm" /><h2>{query ? `没有找到“${query}”` : '这类路线还在整理中'}</h2><p>换一个关键词，继续找一条顺路的行程。</p><ZouButton onClick={clearFilters}>查看全部</ZouButton></div>}
        {plazaItems.length ? <div ref={loadSentinel} className="discover-load-sentinel" role="status"><ZouMotionBot dots={visibleCount < plazaItems.length} state={visibleCount < plazaItems.length ? 'thinking' : 'idle'} size="sm" interactive={false} label={visibleCount < plazaItems.length ? '正在展开更多路线' : '路线已全部展开'} /><span>{visibleCount < plazaItems.length ? '继续往下，更多路线在这里' : `已展示全部 ${plazaItems.length} 条攻略`}</span></div> : null}
        <details className="discover-public-records" onToggle={event=>setPublicOpen(event.currentTarget.open)}><summary>旅友公开记录</summary>{publicOpen?<PublicationList feed />:null}</details>
      </section> : <section className="explore-city-index" aria-label="全国城市攻略">
        <header className="explore-section-heading"><div><span>探索</span><h2>按城市找一条完整路线</h2></div><small>{cityCards.length} 个城市</small></header>
        <Masonry className="explore-city-grid">{cityCards.map((card) => <button className="explore-city-card" key={card.cityId} onClick={() => navigate(`/discover/cities/${encodeURIComponent(card.cityId)}`)}><MediaAsset city={card.cityId} src={card.cover} alt={`${card.name}${card.landmark}`} /><div><span>{card.landmark}</span><h2>{card.name}</h2><p>{card.publishedRouteCount} 条广场展示 · {card.guideCount} 条知识库候选</p><small>{card.tags.join(' · ')}</small></div></button>)}</Masonry>
      </section>}
    </main>
  </AppShell>
}

export const DiscoverPage = () => {
  const location = useLocation()
  return location.pathname.startsWith('/community') ? <LegacyDiscoverPage /> : <ExplorePage />
}

const decodeCityParam = (value: string | undefined) => {
  if (!value) return '上海'
  try { return decodeURIComponent(value) } catch { return value }
}

export const DiscoverCityPage = () => {
  const { city: cityParam } = useParams()
  const navigate = useNavigate()
  const requestedCity = decodeCityParam(cityParam)
  const city = normalizeCityQuery(requestedCity)
  const cityCard = getExploreCityCards().find((card) => card.cityId === city)
  const guides = getItineraryPlazaItems(city)
  if(!cityCard)return <AppShell showTabBar><ZouNavigationBar title={`${city}攻略`}/><main className="page-content"><h1>这座城市暂无已发布攻略</h1><p>当前没有可展示的路线，私人行程不会受到影响。</p><button onClick={()=>navigate('/discover?tab=cities')}>返回城市列表</button></main></AppShell>
  return <AppShell showTabBar>
    <main className="discover-city-page">
      <ZouNavigationBar title={`${city}攻略`} />
      <MediaAsset className="discover-city-hero" city={city} src={cityCard?.cover} />
      <header className="discover-city-intro"><span>{cityCard?.landmark ?? city}</span><h1>{city}，按片区慢慢玩</h1><p>{cityCard?.intro ?? '把代表性景点、城市街区和本地吃法放进同一套行程。'}</p><div><strong>{guides.length} 条知识库候选</strong><small>景点 · 街区 · 本地吃法</small></div></header>
      <section className="discover-city-guides" aria-label={`${city}旅行攻略`}>
        <header className="explore-section-heading"><div><span>城市攻略</span><h2>从一条顺路的行程开始</h2></div><button onClick={() => navigate('/discover')}>返回探索</button></header>
        <Masonry className="discover-feed__items">{guides.map((item) => <DiscoverCard key={item.id} item={item} basePath="/discover" />)}</Masonry>
      </section>
    </main>
  </AppShell>
}

export const DiscoverDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const navigationType = useNavigationType()
  const basePath = location.pathname.startsWith('/community') ? '/community' : '/discover'
  const storedPost = useAppStore((state) => state.publishedPosts.find((post) => `post-${post.routeId}-shared` === id))
  const baseItem = getDiscoverItem(id ?? '')
  const item = storedPost ? (() => { const storedRoute = getRoute(storedPost.routeId); return storedRoute ? createUserDiscoverItem(storedRoute, { title: storedPost.title, subtitle: storedPost.description, cover: storedPost.cover, publishedAt: storedPost.publishedAt }) : baseItem })() : baseItem
  const content = item
  const safeItem = item ?? {id:id??'',routeId:'',cityId:'',title:'',cover:'',subtitle:''} as DiscoverItem
  const route = getRoute(safeItem.routeId)
  const liked = useAppStore((state) => state.likedPosts.includes(safeItem.id))
  const toggleLiked = useAppStore((state) => state.toggleLiked)
  const saved = useAppStore((state) => state.savedPosts.includes(safeItem.id))
  const toggleSaved = useAppStore((state) => state.toggleSaved)
  const adoptRoute = useAppStore((state) => state.adoptRoute)
  const storedComments = useAppStore((state) => state.commentsByPost[safeItem.id] ?? EMPTY_COMMENTS)
  const addComment = useAppStore((state) => state.addComment)
  const [toast, setToast] = useState('')
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [useOpen, setUseOpen] = useState(new URLSearchParams(location.search).get('follow') === '1')
  const [placeSheet, setPlaceSheet] = useState<Place | null>(null)
  const [coverOpen, setCoverOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [copyDate,setCopyDate]=useState(''), [copyParty,setCopyParty]=useState('1')
  const [copyId] = useState(()=>crypto.randomUUID())
  const removeComment=useAppStore(state=>state.deleteComment)
  const comments = storedComments
  const places = useMemo(() => route ? routePlaces(route) : [], [route])
  if (!route) return <AppShell><div className="page-content"><h1>路线暂时不可用</h1><ZouButton onClick={() => navigate(basePath)}>返回路线</ZouButton></div></AppShell>
  const submitComment = () => {
    const body = draft.trim()
    if (!body) return
    try{addComment(safeItem.id, body)}catch(cause){setToast(String(cause));return}
    track('comment_added', { postId: safeItem.id })
    setDraft('')
  }
  const useTrip = (withAi: boolean) => {
    try {
      if(!copyDate || !Number.isInteger(Number(copyParty)) || Number(copyParty)<1 || Number(copyParty)>100){setToast('请填写出行日期和1—100位出行人数');return}
      const copied=copyCuratedTrip(route, {date:copyDate,partySize:Number(copyParty),copyId})
      useAppStore.setState({activeRouteId:copied.tripId,tripCity:copied.city,tripMode:'upcoming'})
      if(withAi)writeVersioned('zouzou-current-draft-v2',{id:crypto.randomUUID(),input:`参考已复制的${route.title}：${route.pois.map(place=>place.name).join('、')}。请按我接下来填写的条件调整。`,destination:route.cityId,days:String(route.dayCount ?? 1),budget:String(route.budgetMax),goal:'',date:'',party:'1',budgetMode:'全员',arrival:'',departure:'',example:false},'local')
      track('journey_saved', { journeyId: copied.tripId ?? '', source: 'discover', optimized: withAi })
      setUseOpen(false);navigate(withAi ? '/travel/new' : `/trips/${copied.tripId}`)
    }catch(error){setToast(error instanceof Error?error.message:'未能复制，原路线仍保留')}
  }
  const entry = location.state?.discoverEntry
  const cover = entry?.id === safeItem.id && typeof entry.cover === 'string' && isUserFacingCover(entry.cover) ? entry.cover : safeItem.cover
  return <AppShell restoreScroll={navigationType !== 'PUSH'}>
    <div className="discovery-guide">
      <header className="discovery-guide__nav"><button className="icon-button" aria-label="返回" onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate(basePath)}><ArrowLeft /></button><span>{route.cityId} · 旅行攻略</span><button className="icon-button" aria-label="分享" onClick={async()=>{try{await navigator.clipboard.writeText(window.location.origin+location.pathname);setToast('攻略链接已复制')}catch{setToast('无法复制，请从地址栏复制路线地址')}}}><Share2 /></button></header>
      <button className="discovery-guide__cover-button" onClick={() => setCoverOpen(true)} aria-label="查看封面大图">
        <MediaAsset eager className="discovery-guide__cover" city={safeItem.cityId} src={cover} alt={safeItem.title} />
        <span>查看大图</span>
      </button>
      <article className="discovery-guide__body">
        <header className="discovery-guide__intro">
          <h1>{safeItem.title}</h1>
          <p className="discovery-guide__metadata">{route.duration} · {places.length}个地点</p>
          <p className="discovery-guide__description">{safeItem.contentSource === 'user' || !route.dayCount ? safeItem.subtitle : route.recommendedReason}</p>
          <dl className="discovery-guide__facts"><div><dt>适合</dt><dd>{route.peopleType.join(' · ')}</dd></div><div><dt>适宜天气</dt><dd>{route.weatherType.join(' / ')}</dd></div><div className="discovery-guide__budget"><dt>地点花费参考</dt><dd>{route.pois.some(poi=>poi.priceState==='unknown') ? '部分费用待确认' : `约 ¥${route.budgetMin === route.budgetMax ? route.budgetMin : `${route.budgetMin}—${route.budgetMax}`}/人`}</dd></div></dl>
          {route.dayCount ? <p className="discovery-guide__scope">住宿与往返交通另行安排，费用按出行日期确认。</p> : null}
        </header>
        <DiscoverItinerary key={route.id} route={route} places={places} onPlace={setPlaceSheet} />
        <section className="discovery-guide__preparation"><h2>出发前看看</h2><ul>{route.tips.map(tip => <li key={tip}>{tip}</li>)}</ul></section>
        <p className="discovery-guide__provenance">{sourceLabel[safeItem.contentSource]} · 收藏与喜欢保存在此设备</p>
      </article>
      <footer className="discovery-guide__actions"><ZouButton onClick={() => setUseOpen(true)}>存为我的行程</ZouButton><button aria-label="喜欢" aria-pressed={liked} onClick={() => toggleLiked(safeItem.id)}><Heart fill={liked ? 'currentColor' : 'none'} /><span>喜欢</span></button><button aria-label="收藏" aria-pressed={saved} onClick={() => { toggleSaved(safeItem.id); setToast(saved ? '已取消收藏' : '已收藏到我的路线') }}><Bookmark fill={saved ? 'currentColor' : 'none'} /><span>收藏</span></button><button aria-label="评论" onClick={() => setCommentsOpen(true)}><MessageCircle /><span>评论</span></button></footer>
      <ZouBottomSheet open={coverOpen} onClose={() => setCoverOpen(false)} title="攻略封面"><MediaAsset className="discovery-guide__full-cover" city={safeItem.cityId} src={cover} alt={safeItem.title} /></ZouBottomSheet>
      <ZouBottomSheet open={commentsOpen} onClose={() => setCommentsOpen(false)} title={`评论 · ${comments.length}`}><p>以下评论仅保存于此设备，尚未提交到公共社区。</p><div className="comment-list">{comments.map((comment) => <article key={comment.id}><p><strong>{comment.author}</strong>{comment.body}</p><button onClick={()=>{try{removeComment(safeItem.id,comment.id)}catch(cause){setToast(String(cause))}}}>删除评论</button></article>)}</div><label className="comment-input"><span className="sr-only">写评论</span><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submitComment() } }} placeholder="写下评论" /><button aria-label="发送评论" disabled={!draft.trim()} onClick={submitComment}><Send /></button></label></ZouBottomSheet>
       <ZouBottomSheet open={useOpen} onClose={() => setUseOpen(false)} title="存为我的行程"><label>出行日期<FormPicker aria-label="出行日期" type="date" value={copyDate} onChange={e=>setCopyDate(e.target.value)} required /></label><label>出行人数<input aria-label="出行人数" type="number" min="1" max="100" value={copyParty} onChange={e=>setCopyParty(e.target.value)} required /></label><p>保存后得到独立行程；营业、费用和转场需要按新日期确认。</p><p>{route.pois.length} 个地点 · 预计 {route.duration} · {safeItem.budget}</p><ZouButton onClick={() => useTrip(false)}><Check />尽量保持原路线</ZouButton><ZouButton variant="secondary" onClick={() => useTrip(true)}><Sparkles />按我的偏好重新优化</ZouButton></ZouBottomSheet>
       <JourneyPlaceSheet open={Boolean(placeSheet)} onClose={() => setPlaceSheet(null)} place={placeSheet} sourceUrl={route.pois.find(poi => poi.id === placeSheet?.id)?.sourceUrl} city={route.cityId} journeyId={route.id} dayId={`Day ${route.pois.find(poi => poi.id === placeSheet?.id)?.day ?? 1}`} />
       {toast ? <ZouToast message={toast} onClose={() => setToast('')} /> : null}
    </div>
  </AppShell>
}

export const DiscoverReplayPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const basePath = location.pathname.startsWith('/community') ? '/community' : '/discover'
  const item = getDiscoverItem(id ?? '')
  const route = item ? getRoute(item.routeId) : undefined
  const [progress, setProgress] = useState(0)
  const places = useMemo(() => route ? routePlaces(route) : [], [route])
  useEffect(() => {
    const timer = window.setInterval(() => setProgress((value) => value >= 1 ? 1 : value + .012), 80)
    return () => window.clearInterval(timer)
  }, [])
  if (!route || !item) return <AppShell><p>路线不存在或已撤回。</p></AppShell>
  const current = places[Math.min(places.length - 1, Math.round(progress * Math.max(0, places.length - 1)))]
  return <AppShell immersive><div className="community-replay discover-replay"><div className="replay-top"><button className="icon-button" aria-label="返回" onClick={() => navigate(-1)}><ArrowLeft /></button><button className="replay-skip" onClick={() => navigate(`${basePath}/${item.id}`)}>返回行程</button></div><section className="discover-replay__timeline"><header><span>{Math.round(progress * 100)}%</span><strong>{current?.name}</strong><small>{current?.time} · 路线进度预览</small></header><ol>{places.map((place, index) => <li className={place.id === current?.id ? 'is-current' : ''} key={place.id}><span>{index + 1}</span><div><strong>{route.dayCount ? `第${route.pois[index].day}天 · ` : ''}{place.name}</strong><small>{place.time} · 停留 {formatTravelDuration(place.stay)}</small></div></li>)}</ol><OpenRouteMapButton places={places} city={route.cityId} /></section></div></AppShell>
}

export const DiscoverPublishPage = PublicationEditor
