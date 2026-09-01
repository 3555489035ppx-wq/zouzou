import { ArrowLeft, Bookmark, Check, ChevronDown, Heart, MessageCircle, Search, Send, Share2, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { RealRouteMap } from '../components/RealRouteMap'
import { CityPicker, ZouBottomSheet, ZouButton, ZouMotionBot, ZouNavigationBar, ZouSearchBar, ZouToast } from '../components/ui'
import { createUserDiscoverItem, getDiscoverFeed, getDiscoverItem, getRoute, type DiscoverItem, type Route } from '../demo-data/discover'
import type { Place } from '../demo-data/trips'
import { getCityProfile } from '../demo-data/cities'
import { searchDiscoverItems } from '../services/discover/search'
import { useAppStore, type PostComment } from '../stores/appStore'
import { track } from '../services/analytics'

const sourceLabel: Record<DiscoverItem['contentSource'], string> = { official: '走走精选', knowledge: '城市精选', user: '用户分享' }
const EMPTY_COMMENTS: PostComment[] = []

const durationMinutes = (value: string) => {
  const hours = Number(value.match(/(\d+(?:\.\d+)?)\s*h/)?.[1] ?? 0)
  const minutes = Number(value.match(/(\d+)\s*min/)?.[1] ?? 0)
  return Math.round(hours * 60 + minutes)
}

const travelMinutes = (value: string) => Number(value.match(/(\d+)\s*分钟/)?.[1] ?? 15)

const routeStartMinutes = (route: Route) => {
  if (route.category === '聚餐') return 11 * 60 + 30
  if (route.cityId === '三亚' && route.title === '三亚慢慢走') return 15 * 60
  if (route.cityId === '三亚' && route.title.includes('看海')) return 13 * 60
  return 9 * 60 + 30
}

const clockLabel = (totalMinutes: number) => `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`

const stopBudget = (route: Route, poi: Route['pois'][number], index: number) => {
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
    if (index > 0) cursor += travelMinutes(poi.transportation)
    const place = {
      id: poi.id,
      time: clockLabel(cursor),
      name: poi.name,
      type: poi.category,
      stay: poi.stay,
      budget: stopBudget(route, poi, index),
      transport: poi.transportation,
      note: poi.introduction,
      x: index,
      z: index,
      lng: poi.longitude,
      lat: poi.latitude,
      searchKeyword: poi.name,
      coordinateSource: poi.coordinateSource,
      verified: poi.verified,
    }
    cursor += durationMinutes(poi.stay)
    return place
  })
}

const sectionTitle: Record<DiscoverItem['contentSource'], string> = {
  official: '走走精选',
  knowledge: '城市精选',
  user: '用户分享',
}

const DiscoverCard = ({ item, basePath }: { item: DiscoverItem; basePath: '/community' | '/discover' }) => {
  const navigate = useNavigate()
  const liked = useAppStore((state) => state.likedPosts.includes(item.id))
  const toggleLiked = useAppStore((state) => state.toggleLiked)
  const saved = useAppStore((state) => state.savedPosts.includes(item.id))
  const toggleSaved = useAppStore((state) => state.toggleSaved)
  const route = getRoute(item.routeId)
  const start = route?.pois[0]?.name
  const end = route?.pois.at(-1)?.name
  const distance = route?.distanceKm ?? (route ? Math.max(2, Math.round(route.pois.length * 1.1 * 10) / 10) : null)
  return <article className="discover-card">
    <button className="discover-card__open community-card__open" onClick={() => navigate(`${basePath}/${item.id}`)}>
      <img className="community-card__image" src={item.cover} alt={item.title} loading="lazy" />
      <span className={`discover-badge is-${item.contentSource}`}>{sourceLabel[item.contentSource]}</span>
      <h2>{item.title}</h2>
      <p>{item.category} · {item.duration} · {item.budget}</p>
      <strong className="discover-card__route">{start} → {end}</strong>
      <small className="discover-card__stats">{item.poiCount} 个地点 · {distance ? `路线约 ${distance} km` : '路线长度待核验'}{route?.distanceKm ? '' : ' · 估算'}</small>
      <small>{route?.pois.slice(0, 3).map((poi) => poi.name).join(' · ')}</small>
    </button>
    <footer>
      <button className="discover-card__reaction" aria-label="点赞路线" aria-pressed={liked} onClick={() => toggleLiked(item.id)}><Heart fill={liked ? 'currentColor' : 'none'} /> {item.likeCount + (liked ? 1 : 0)}</button>
      <button className="discover-card__reaction" aria-label="收藏路线" aria-pressed={saved} onClick={() => toggleSaved(item.id)}><Bookmark fill={saved ? 'currentColor' : 'none'} /> {item.saveCount + (saved ? 1 : 0)}</button>
      <button className="discover-follow" onClick={() => navigate(`${basePath}/${item.id}?follow=1`)}>跟着走</button>
    </footer>
  </article>
}

export const DiscoverPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const city = useAppStore((state) => state.city)
  const publishedRouteIds = useAppStore((state) => state.publishedRouteIds)
  const publishedPosts = useAppStore((state) => state.publishedPosts)
  const followedAuthors = useAppStore((state) => state.followedAuthors)
  const [cityOpen, setCityOpen] = useState(false)
  const [category, setCategory] = useState('推荐')
  const [section, setSection] = useState<'关注' | '发现'>('发现')
  const legacy = location.pathname.startsWith('/community')
  const basePath = legacy ? '/community' : '/discover'
  const query = searchParams.get('q') ?? ''
  const searchOpen = searchParams.get('search') === '1' || location.pathname.endsWith('/search')
  const feed = useMemo(() => {
    const published = publishedRouteIds.map((routeId) => {
      const route = getRoute(routeId); const post = publishedPosts.find((entry) => entry.routeId === routeId)
      return route ? createUserDiscoverItem(route, post ? { title: post.title, subtitle: post.description, cover: post.cover, publishedAt: post.publishedAt } : undefined) : null
    }).filter((item): item is DiscoverItem => Boolean(item))
    const filtered = [...published, ...getDiscoverFeed(city, undefined, [])].filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index).filter((item) => {
      if (section === '关注') return item.contentSource === 'user' && followedAuthors.includes(item.authorName ?? '')
      return category === '推荐' || item.category === category
    })
    return searchDiscoverItems(filtered, query, getRoute)
  }, [category, city, followedAuthors, publishedPosts, publishedRouteIds, query, section])
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
          <button aria-pressed={section === '发现'} onClick={() => setSection('发现')}>发现</button>
          <button onClick={() => setCityOpen(true)}>{city}<ChevronDown /></button>
          <button className="icon-button" aria-label="搜索发现" onClick={openSearch}><Search /></button>
        </div> : <div className="discover-header__top"><button onClick={() => setCityOpen(true)} aria-label="选择发现城市">{city}<ChevronDown /></button><button className="icon-button" aria-label="搜索发现" onClick={openSearch}><Search /></button></div>}
        {!legacy ? <h1>发现适合今天的路线</h1> : null}
        {searchOpen ? <div className="discover-search"><ZouSearchBar value={query} onChange={updateQuery} placeholder="搜索地点、路线或场景" /><button type="button" onClick={closeSearch}>取消</button></div> : null}
        <div className={legacy ? 'community-categories' : undefined}>
          {categories.map((item) => <button key={item} aria-pressed={category === item} onClick={() => { setCategory(item); setSection('发现') }}>{item}</button>)}
        </div>
      </header>
      <section className="discover-feed" aria-label={`${city}路线推荐`}>
        {feedSections.length ? feedSections.map(({ source, items }) => <section className="discover-feed__section" key={source} aria-labelledby={`discover-section-${source}`}>
          <header><div><span>{sectionTitle[source]}</span><h2 id={`discover-section-${source}`}>{source === 'knowledge' ? `${city}的城市攻略` : source === 'official' ? '今天就从一条路线出发' : '走过的人，也留下了一条路'}</h2></div><small>{items.length}{source === 'knowledge' ? ' 条精选' : ' 条'}</small></header>
          <div className="discover-feed__items">{items.map((item) => <DiscoverCard key={item.id} item={item} basePath={basePath} />)}</div>
        </section>) : <div className="community-empty"><ZouMotionBot state="idle" size="sm" /><h2>{query ? `没有找到“${query}”` : section === '关注' ? '关注页还没有内容' : '这类路线还在整理中'}</h2><p>{query ? '试试地点名、路线名或“吃饭 / 看海 / 慢慢走”等关键词。' : section === '关注' ? '关注一位作者后，他完成的路线会出现在这里。' : '换一个标签，先从城市精选里找到可执行的路线。'}</p><ZouButton onClick={() => { if (query) updateQuery(''); else setSection('发现') }}>{query ? '清空搜索' : '去发现'}</ZouButton></div>}
      </section>
      <CityPicker open={cityOpen} onClose={() => setCityOpen(false)} />
    </main>
  </AppShell>
}

export const DiscoverDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const basePath = location.pathname.startsWith('/community') ? '/community' : '/discover'
  const storedPost = useAppStore((state) => state.publishedPosts.find((post) => `post-${post.routeId}-shared` === id))
  const baseItem = getDiscoverItem(id ?? '') ?? getDiscoverFeed('上海')[0]
  const item = storedPost ? (() => { const storedRoute = getRoute(storedPost.routeId); return storedRoute ? createUserDiscoverItem(storedRoute, { title: storedPost.title, subtitle: storedPost.description, cover: storedPost.cover, publishedAt: storedPost.publishedAt }) : baseItem })() : baseItem
  const route = getRoute(item.routeId)
  const liked = useAppStore((state) => state.likedPosts.includes(item.id))
  const toggleLiked = useAppStore((state) => state.toggleLiked)
  const saved = useAppStore((state) => state.savedPosts.includes(item.id))
  const toggleSaved = useAppStore((state) => state.toggleSaved)
  const adoptRoute = useAppStore((state) => state.adoptRoute)
  const storedComments = useAppStore((state) => state.commentsByPost[item.id] ?? EMPTY_COMMENTS)
  const addComment = useAppStore((state) => state.addComment)
  const communityMapVisible = useAppStore((state) => state.communityMapVisible)
  const [toast, setToast] = useState('')
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [useOpen, setUseOpen] = useState(new URLSearchParams(location.search).get('follow') === '1')
  const [draft, setDraft] = useState('')
  const comments = [{ id: 'comment-1', author: '林晓', body: '下午去展览这个安排很聪明。' }, ...storedComments]
  const places = useMemo(() => route ? routePlaces(route) : [], [route])
  if (!route) return <AppShell><div className="page-content"><h1>路线暂时不可用</h1><ZouButton onClick={() => navigate(basePath)}>返回路线</ZouButton></div></AppShell>
  const submitComment = () => {
    const body = draft.trim()
    if (!body) return
    addComment(item.id, body)
    track('comment_added', { postId: item.id })
    setDraft('')
  }
  const useTrip = (withAi: boolean) => {
    adoptRoute(route.id, route.cityId)
    track('journey_saved', { journeyId: route.id, source: 'discover', optimized: withAi })
    setUseOpen(false)
    navigate(withAi ? '/travel/new' : '/trips')
  }
  return <AppShell>
    <div className="discover-detail community-detail">
        <header className="detail-author"><button className="icon-button" aria-label="返回" onClick={() => navigate(-1)}><ArrowLeft /></button><button className="icon-button" aria-label="分享"><Share2 /></button></header>
      <img className="discover-detail__cover" src={item.cover} alt={item.title} />
      <article>
        <h1>{item.title}</h1>
        <p>{item.subtitle}</p>
        <p className="place-source"><strong>{sourceLabel[item.contentSource]}</strong>{item.contentSource === 'official' ? null : <> · 已整理为可执行路线</>}{item.sourceUrl ? <> · <a href={item.sourceUrl} target="_blank" rel="noreferrer">查看来源</a></> : null}</p>
        <section className="route-summary" aria-label="路线概览"><div><span>起点</span><strong>{route.pois[0].name}</strong></div><div><span>终点</span><strong>{route.pois.at(-1)?.name}</strong></div><div><span>{route.category === '聚餐' ? '路线' : '步行'}</span><strong>约 {route.distanceKm ?? Math.max(2, route.pois.length * 1.1)} km{route.distanceKm ? '' : '（估算）'}</strong></div></section>
        <dl><div><dt>适合谁</dt><dd>{route.peopleType.join(' · ')}</dd></div><div><dt>时长</dt><dd>{route.duration}</dd></div><div><dt>预算</dt><dd>¥{route.budgetMin}-{route.budgetMax}/人</dd></div><div><dt>天气</dt><dd>{route.weatherType.join(' / ')}</dd></div></dl>
        {communityMapVisible ? <section className="discover-map"><RealRouteMap city={route.cityId} center={getCityProfile(route.cityId).mapCenter} places={places} compact /></section> : <div className="detail-map-note">社区地图已隐藏，可在设置中重新打开；文字行程仍可查看。</div>}
        {communityMapVisible ? <button className="detail-replay-button" onClick={() => navigate(`${basePath}/${item.id}/replay`)}><span>路线回放</span><small>可选 · 查看 Bloub 沿真实路线移动</small><span aria-hidden="true">→</span></button> : null}
        <section className="community-detail__itinerary" aria-labelledby="discover-itinerary-title"><header><h2 id="discover-itinerary-title">具体行程</h2><span>{route.cityId} · {places.length} 个地点</span></header><ol>{places.map((place, index) => <li key={place.id}><span>{index + 1}</span><div><strong>{place.name}</strong><small>{place.time} · {place.type} · 停留 {place.stay}</small><small className="route-stop-transport">{index === 0 ? '起点 · ' : '前往方式 · '}{place.transport}</small><p>{place.note}</p></div><b>约 ¥{place.budget}</b></li>)}</ol></section>
      <section><h2>推荐理由</h2><p>{route.recommendedReason}</p><h2>路线提示</h2><p>{route.tips.join(' ')}</p></section>
      </article>
      <footer className="discover-detail__actions detail-actions"><ZouButton onClick={() => setUseOpen(true)}>使用这个行程</ZouButton><button aria-label="喜欢" aria-pressed={liked} onClick={() => toggleLiked(item.id)}><Heart fill={liked ? 'currentColor' : 'none'} /></button><button aria-label="收藏" aria-pressed={saved} onClick={() => { toggleSaved(item.id); setToast(saved ? '已取消收藏' : '已收藏到我的路线') }}><Bookmark fill={saved ? 'currentColor' : 'none'} /></button><button aria-label="评论" onClick={() => setCommentsOpen(true)}><MessageCircle /></button></footer>
      <ZouBottomSheet open={commentsOpen} onClose={() => setCommentsOpen(false)} title={`评论 · ${comments.length}`}><div className="comment-list">{comments.map((comment) => <article key={comment.id}><p><strong>{comment.author}</strong>{comment.body}</p></article>)}</div><label className="comment-input"><span className="sr-only">写评论</span><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submitComment() } }} placeholder="写下评论" /><button aria-label="发送评论" disabled={!draft.trim()} onClick={submitComment}><Send /></button></label></ZouBottomSheet>
      <ZouBottomSheet open={useOpen} onClose={() => setUseOpen(false)} title="使用这个行程"><p>{route.pois.length} 个地点 · 预计 {route.duration} · {item.budget}</p><ZouButton onClick={() => useTrip(false)}><Check />尽量保持原路线</ZouButton><ZouButton variant="secondary" onClick={() => useTrip(true)}><Sparkles />按我的偏好重新优化</ZouButton></ZouBottomSheet>
      {toast ? <ZouToast message={toast} onClose={() => setToast('')} /> : null}
    </div>
  </AppShell>
}

export const DiscoverReplayPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const basePath = location.pathname.startsWith('/community') ? '/community' : '/discover'
  const item = getDiscoverItem(id ?? '') ?? getDiscoverFeed('上海')[0]
  const route = getRoute(item.routeId)
  const [progress, setProgress] = useState(0)
  const places = useMemo(() => route ? routePlaces(route) : [], [route])
  useEffect(() => {
    const timer = window.setInterval(() => setProgress((value) => value >= 1 ? 1 : value + .012), 80)
    return () => window.clearInterval(timer)
  }, [])
  if (!route) return null
  const current = places[Math.min(places.length - 1, Math.round(progress * Math.max(0, places.length - 1)))]
  return <AppShell immersive><div className="community-replay discover-replay"><div className="replay-top"><button className="icon-button" aria-label="返回" onClick={() => navigate(-1)}><ArrowLeft /></button><button className="replay-skip" onClick={() => navigate(`${basePath}/${item.id}`)}>跳过回放</button></div><div className="community-replay__scene"><RealRouteMap city={route.cityId} center={getCityProfile(route.cityId).mapCenter} places={places} progress={progress} compact /><div className="replay-caption"><span>{current?.time}</span><strong>{current?.name}</strong><small>{Math.round(progress * 100)}% · 真实路线预览</small></div></div></div></AppShell>
}

export const DiscoverPublishPage = () => {
  const navigate = useNavigate()
  const activeRouteId = useAppStore((state) => state.activeRouteId)
  const tripCity = useAppStore((state) => state.tripCity)
  const publishRoute = useAppStore((state) => state.publishRoute)
  const route = getRoute(activeRouteId ?? 'route-1') ?? getRoute('route-1')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [cover, setCover] = useState('')
  useEffect(() => {
    if (route && !title) setTitle(`第一次在${route.cityId}${route.category === '聚餐' ? '认真吃一顿' : '没有赶景点'}`)
    if (route && !body) setBody(`${route.pois.map((poi) => poi.name).join(' → ')}\n${route.category === '聚餐' ? '今天边走边吃，把本地味道一站一站吃下来。' : '今天慢慢走了四个小时，比排满景点舒服很多。'}`)
  }, [body, route, title])
  if (!route) return <AppShell><div className="page-content"><h1>还没有可分享的行程</h1><ZouButton onClick={() => navigate('/discover')}>去发现路线</ZouButton></div></AppShell>
  const handlePublish = () => {
    publishRoute({ routeId: route.id, title, description: body, cover: cover || route.cover || route.pois[0]?.image || '' })
    navigate('/profile/posts')
  }
  return <AppShell><ZouNavigationBar title="分享这次行程" /><div className="page-content publish-page"><header><h1>生成行程记录</h1><p>{tripCity ?? route.cityId} · 已读取地点顺序，补充一句感受即可分享。</p></header><label>标题<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>一句话描述<textarea value={body} onChange={(event) => setBody(event.target.value)} /></label><label>封面图片<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setCover(String(reader.result)); reader.readAsDataURL(file) }} /></label>{cover ? <img className="publish-cover-preview" src={cover} alt="发布封面预览" /> : null}<section className="publish-facts"><span>{route.cityId}</span><span>{route.duration}</span><span>{route.pois.length} 个地点</span></section><ZouButton disabled={!title.trim() || !body.trim()} onClick={handlePublish}>发布用户分享</ZouButton></div></AppShell>
}
