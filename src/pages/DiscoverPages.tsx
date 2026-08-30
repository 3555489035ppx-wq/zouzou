import { ArrowLeft, Bookmark, Check, ChevronDown, Heart, MessageCircle, Send, Share2, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { RealRouteMap } from '../components/RealRouteMap'
import { CityPicker, ZouBottomSheet, ZouButton, ZouMotionBot, ZouNavigationBar, ZouToast } from '../components/ui'
import { getDiscoverFeed, getDiscoverItem, getRoute, type DiscoverItem, type Route } from '../demo-data/discover'
import type { Place } from '../demo-data/trips'
import { getCityProfile } from '../demo-data/cities'
import { useAppStore } from '../stores/appStore'

const sourceLabel: Record<DiscoverItem['contentSource'], string> = { official: '走走精选', knowledge: '城市精选', user: '用户分享' }

const routePlaces = (route: Route): Place[] => route.pois.map((poi, index) => ({
  id: poi.id,
  time: `${String(9 + Math.floor(index * 1.5)).padStart(2, '0')}:${index % 2 ? '00' : '30'}`,
  name: poi.name,
  type: poi.category,
  stay: poi.stay,
  budget: Math.round(route.budgetMax / route.pois.length),
  transport: poi.transportation,
  note: poi.introduction,
  x: index,
  z: index,
  lng: poi.longitude,
  lat: poi.latitude,
}))

const DiscoverCard = ({ item, basePath }: { item: DiscoverItem; basePath: '/community' | '/discover' }) => {
  const navigate = useNavigate()
  const saved = useAppStore((state) => state.savedPosts.includes(item.id))
  const toggleSaved = useAppStore((state) => state.toggleSaved)
  const route = getRoute(item.routeId)
  return <article className="discover-card">
    <button className="discover-card__open community-card__open" onClick={() => navigate(`${basePath}/${item.id}`)}>
      <img className="community-card__image" src={item.cover} alt={item.title} loading="lazy" />
      <span className={`discover-badge is-${item.contentSource}`}>{sourceLabel[item.contentSource]}</span>
      <h2>{item.title}</h2>
      <p>{item.category} · {item.duration} · {item.budget}</p>
      <small>{route?.pois.slice(0, 3).map((poi) => poi.name).join(' → ')}</small>
    </button>
    <footer>
      <button aria-label="收藏路线" aria-pressed={saved} onClick={() => toggleSaved(item.id)}><Bookmark fill={saved ? 'currentColor' : 'none'} />{item.saveCount + (saved ? 1 : 0)}</button>
      <button className="discover-follow" onClick={() => navigate(`${basePath}/${item.id}?follow=1`)}>跟着走</button>
    </footer>
  </article>
}

export const DiscoverPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const city = useAppStore((state) => state.city)
  const followedAuthors = useAppStore((state) => state.followedAuthors)
  const [cityOpen, setCityOpen] = useState(false)
  const [category, setCategory] = useState('推荐')
  const [section, setSection] = useState<'关注' | '发现'>('发现')
  const legacy = location.pathname.startsWith('/community')
  const basePath = legacy ? '/community' : '/discover'
  const feed = useMemo(() => getDiscoverFeed(city).filter((item) => {
    if (section === '关注') return item.contentSource === 'user' && followedAuthors.includes(item.authorName ?? '')
    return category === '推荐' || item.category === category
  }), [category, city, followedAuthors, section])
  const categories = ['推荐', '旅行', '周末', '约会', '聚餐', 'Citywalk']
  return <AppShell showTabBar>
    <main className={`discover-page ${legacy ? 'community-page' : ''}`}>
      <header className={`discover-header ${legacy ? 'community-header' : ''}`}>
        {legacy ? <div className="community-header__top">
          <button aria-pressed={section === '关注'} onClick={() => setSection('关注')}>关注</button>
          <button aria-pressed={section === '发现'} onClick={() => setSection('发现')}>发现</button>
          <button onClick={() => setCityOpen(true)}>{city}<ChevronDown /></button>
          <button className="icon-button" aria-label="搜索社区" onClick={() => navigate('/discover')}><span aria-hidden="true">⌕</span></button>
        </div> : <button onClick={() => setCityOpen(true)} aria-label="选择发现城市">{city}<ChevronDown /></button>}
        {!legacy ? <h1>发现适合今天的路线</h1> : null}
        <div className={legacy ? 'community-categories' : undefined}>
          {categories.map((item) => <button key={item} aria-pressed={category === item} onClick={() => { setCategory(item); setSection('发现') }}>{item}</button>)}
        </div>
      </header>
      <section className="discover-feed" aria-label={`${city}路线推荐`}>
        {feed.length ? feed.map((item) => <DiscoverCard key={item.id} item={item} basePath={basePath} />) : <div className="community-empty"><ZouMotionBot state="idle" size="sm" /><h2>关注页还没有内容</h2><p>关注一位作者后，他完成的路线会出现在这里。</p><ZouButton onClick={() => setSection('发现')}>去发现</ZouButton></div>}
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
  const item = getDiscoverItem(id ?? '') ?? getDiscoverFeed('上海')[0]
  const route = getRoute(item.routeId)
  const saved = useAppStore((state) => state.savedPosts.includes(item.id))
  const liked = useAppStore((state) => state.likedPosts.includes(item.id))
  const toggleSaved = useAppStore((state) => state.toggleSaved)
  const toggleLiked = useAppStore((state) => state.toggleLiked)
  const adoptRoute = useAppStore((state) => state.adoptRoute)
  const communityMapVisible = useAppStore((state) => state.communityMapVisible)
  const [toast, setToast] = useState('')
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [useOpen, setUseOpen] = useState(new URLSearchParams(location.search).get('follow') === '1')
  const [draft, setDraft] = useState('')
  const [comments, setComments] = useState([{ id: 'comment-1', author: '林晓', body: '下午去展览这个安排很聪明。' }])
  const places = useMemo(() => route ? routePlaces(route) : [], [route])
  if (!route) return <AppShell><div className="page-content"><h1>路线暂时不可用</h1><ZouButton onClick={() => navigate(basePath)}>返回路线</ZouButton></div></AppShell>
  const submitComment = () => {
    const body = draft.trim()
    if (!body) return
    setComments((items) => [...items, { id: `comment-${Date.now()}`, author: '小鹏', body }])
    setDraft('')
  }
  const useTrip = (withAi: boolean) => {
    adoptRoute(route.id, route.cityId)
    setUseOpen(false)
    navigate(withAi ? '/travel/new' : '/trips')
  }
  return <AppShell>
    <div className="discover-detail community-detail">
      <header className="detail-author"><button className="icon-button" aria-label="返回" onClick={() => navigate(-1)}><ArrowLeft /></button><span className={`discover-badge is-${item.contentSource}`}>{sourceLabel[item.contentSource]}</span><button className="icon-button" aria-label="分享"><Share2 /></button></header>
      <img className="discover-detail__cover" src={item.cover} alt={item.title} />
      <article>
        <h1>{item.title}</h1>
        <p>{item.subtitle}</p>
        <p className="place-source">{sourceLabel[item.contentSource]} · {item.contentSource === 'official' ? '编辑精选' : '已整理为可执行路线'}</p>
        <dl><div><dt>适合谁</dt><dd>{route.peopleType.join(' · ')}</dd></div><div><dt>时长</dt><dd>{route.duration}</dd></div><div><dt>预算</dt><dd>¥{route.budgetMin}-{route.budgetMax}/人</dd></div><div><dt>天气</dt><dd>{route.weatherType.join(' / ')}</dd></div></dl>
        {communityMapVisible ? <section className="discover-map"><RealRouteMap center={getCityProfile(route.cityId).mapCenter} places={places} compact /></section> : <div className="detail-map-note">社区地图已隐藏，可在设置中重新打开；文字行程仍可查看。</div>}
        {communityMapVisible ? <button className="detail-replay-button" onClick={() => navigate(`${basePath}/${item.id}/replay`)}><span>路线回放</span><small>可选 · 查看 Bloub 沿真实路线移动</small><span aria-hidden="true">→</span></button> : null}
        <section className="community-detail__itinerary" aria-labelledby="discover-itinerary-title"><header><h2 id="discover-itinerary-title">具体行程</h2><span>{route.cityId} · {places.length} 个地点</span></header><ol>{places.map((place, index) => <li key={place.id}><span>{index + 1}</span><div><strong>{place.name}</strong><small>{place.time} · {place.type} · {place.stay}</small><p>{place.note}</p></div><b>¥{place.budget}</b></li>)}</ol></section>
        <section><h2>推荐理由</h2><p>{route.recommendedReason}</p><h2>出发前核对</h2><p>{route.tips.join(' ')}</p></section>
      </article>
      <footer className="discover-detail__actions detail-actions"><ZouButton onClick={() => setUseOpen(true)}>使用这个行程</ZouButton><button aria-label="喜欢" aria-pressed={liked} onClick={() => toggleLiked(item.id)}><Heart fill={liked ? 'currentColor' : 'none'} /><span>{item.likeCount + (liked ? 1 : 0)}</span></button><button aria-label="收藏" aria-pressed={saved} onClick={() => { toggleSaved(item.id); setToast(saved ? '已取消收藏' : '已收藏到我的路线') }}><Bookmark fill={saved ? 'currentColor' : 'none'} /></button><button aria-label="评论" onClick={() => setCommentsOpen(true)}><MessageCircle /></button></footer>
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
  return <AppShell immersive><div className="community-replay discover-replay"><div className="replay-top"><button className="icon-button" aria-label="返回" onClick={() => navigate(-1)}><ArrowLeft /></button><button className="replay-skip" onClick={() => navigate(`${basePath}/${item.id}`)}>跳过回放</button></div><div className="community-replay__scene"><RealRouteMap center={getCityProfile(route.cityId).mapCenter} places={places} progress={progress} compact /><div className="replay-caption"><span>{current?.time}</span><strong>{current?.name}</strong><small>{Math.round(progress * 100)}% · 真实路线预览</small></div></div></div></AppShell>
}

export const DiscoverPublishPage = () => {
  const navigate = useNavigate()
  return <AppShell><ZouNavigationBar title="分享这次行程" /><div className="page-content publish-page"><header><h1>生成行程记录</h1><p>已读取真实路线、地点顺序和行程信息，补充一句感受即可分享。</p></header><label>标题<input defaultValue="第一次在上海没有赶景点" /></label><label>这次去了哪里<textarea defaultValue={'武康大楼 → 安福路 → 乌鲁木齐中路\n今天慢慢走了四个小时，比排满景点舒服很多。'} /></label><ZouButton onClick={() => { navigate('/community') }}>发布用户分享</ZouButton></div></AppShell>
}
