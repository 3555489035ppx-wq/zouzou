import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Masonry from 'react-masonry-css'
import { ArrowLeft, Check, ChevronDown, MapPin, MoreHorizontal, Search, Send, Share2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { RealRouteMap } from '../components/RealRouteMap'
import {
  CityPicker, DetailActionBar, ZouAvatar, ZouBottomSheet, ZouButton, ZouCommunityCard, ZouMotionBot,
  ZouNavigationBar, ZouPhotoCarousel, ZouSearchBar, ZouSegmentedControl, ZouToast,
} from '../components/ui'
import { communityPosts, type CommunityPost } from '../demo-data/community'
import { getCityProfile, getDemoTripPlaces } from '../demo-data/cities'
import { getCityImage } from '../demo-data/city-images'
import { aiService } from '../services/ai'
import { useAppStore } from '../stores/appStore'
import { TripPlaybackEngine, type TripPlaybackSnapshot } from '../services/trip/TripPlaybackEngine'

const CommunityHeader = ({ active, onChange }: { active: string; onChange: (value: string) => void }) => {
  const navigate = useNavigate()
  const communityCity = useAppStore((s) => s.communityCity)
  const [cityOpen, setCityOpen] = useState(false)
  return <><header className="community-header"><div className="community-header__top"><button aria-pressed={active === '关注'} onClick={() => onChange('关注')}>关注</button><button aria-pressed={active === '发现'} onClick={() => onChange('发现')}>发现</button><button onClick={() => setCityOpen(true)}>{communityCity}<ChevronDown /></button><button className="icon-button" aria-label="搜索社区" onClick={() => navigate('/community/search')}><Search /></button></div><div className="community-categories">{['推荐', '旅行', '周末', '约会', '聚餐'].map((item) => <button key={item} aria-pressed={active === item} onClick={() => onChange(item)}>{item}</button>)}</div></header><CityPicker open={cityOpen} onClose={() => setCityOpen(false)} /></>
}

const masonryBreakpoints = { default: 2, 360: 2 }
const CommunityMasonry = ({ posts, onOpen }: { posts: CommunityPost[]; onOpen: (post: CommunityPost) => void }) => (
  <Masonry breakpointCols={masonryBreakpoints} className="community-grid-v4" columnClassName="community-column">
    {posts.map((post) => <ZouCommunityCard key={post.id} post={post} onOpen={() => onOpen(post)} />)}
  </Masonry>
)

export const CommunityPage = () => {
  const navigate = useNavigate()
  const [active, setActive] = useState('发现')
  const city = useAppStore((s) => s.communityCity)
  const followed = useAppStore((s) => s.followedAuthors)
  const posts = communityPosts.filter((post) => post.city === city && (active === '关注' ? followed.includes(post.author) : ['发现', '推荐'].includes(active) || post.category === active))
  return <AppShell showTabBar><div className="community-page"><CommunityHeader active={active} onChange={setActive} />{posts.length ? <CommunityMasonry posts={posts} onOpen={(post) => navigate(`/community/${post.id}`)} /> : <div className="community-empty"><ZouMotionBot state="idle" size="sm" /><h2>关注页还没有内容</h2><p>关注一位作者后，他完成的行程会出现在这里。</p><ZouButton onClick={() => setActive('发现')}>去发现</ZouButton></div>}</div></AppShell>
}

export const CommunitySearchPage = () => {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const normalized = query.toLowerCase()
  const results = useMemo(() => communityPosts.filter((post) => !query || `${post.title}${post.city}${post.category}${post.summary}`.toLowerCase().includes(normalized) || (query.includes('不想走') && post.category !== '旅行')), [query, normalized])
  return <AppShell><ZouNavigationBar title="搜索社区" /><div className="page-content community-search-page"><ZouSearchBar value={query} onChange={setQuery} placeholder="武康路、上海周末，或一句需求" /><div className="search-suggestions"><span>试试</span>{['武康路', '上海周末', '咖啡', '两个人周末一天，预算500，不想走太多'].map((item) => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}</div><p className="result-count" aria-live="polite">{results.length} 条路线</p><CommunityMasonry posts={results} onOpen={(post) => navigate(`/community/${post.id}`)} /></div></AppShell>
}

const CommunityDetail = ({ post }: { post: CommunityPost }) => {
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [useOpen, setUseOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [draft, setDraft] = useState('')
  const [comments, setComments] = useState(() => [
    { id: 'comment-linxiao', author: '林晓', avatar: '/assets/coffee.jpg', body: '下午去美术馆这个安排很聪明。' },
    { id: 'comment-zhouzhou', author: '周周', avatar: '/assets/weekend.jpg', body: '收藏了，下周按这个路线走。' },
  ])
  const followed = useAppStore((s) => s.followedAuthors.includes(post.author))
  const toggleFollow = useAppStore((s) => s.toggleFollow)
  const communityMapVisible = useAppStore((s) => s.communityMapVisible)
  const setTripCity = useAppStore((s) => s.setTripCity)
  const setCity = useAppStore((s) => s.setCity)
  const setTripMode = useAppStore((s) => s.setTripMode)
  const navigate = useNavigate()
  const itinerary = useMemo(() => getDemoTripPlaces(post.city, 'Day 1').slice(0, 5), [post.city])
  const coverImage = getCityImage(post.city)
  const useTrip = async (mode: 'keep' | 'optimize') => {
    await aiService.personalizeTrip(post.id, mode)
    setUseOpen(false)
    // A community route becomes the user's actual trip only after this
    // explicit action. Keep city, community and trip state in sync so the
    // next screen never shows a route from another city.
    setTripCity(post.city)
    setCity(post.city)
    setTripMode('active')
    navigate('/trips')
  }
  const submitComment = () => {
    const body = draft.trim()
    if (!body) return
    setComments((items) => [...items, { id: `comment-${Date.now()}`, author: '小鹏', avatar: '/assets/date.jpg', body }])
    setDraft('')
  }
  const replyTo = (author: string) => { setDraft(`@${author} `); setCommentsOpen(true) }
  return <div className="community-detail"><header className="detail-author"><button className="icon-button detail-back" aria-label="返回" onClick={() => navigate(-1)}><ArrowLeft /></button><ZouAvatar src={post.avatar} name={post.author} /><div><strong>{post.author}</strong><small>{post.city} · ✓ 已完成</small></div><button aria-pressed={followed} onClick={() => toggleFollow(post.author)}>{followed ? '已关注' : '关注'}</button><button className="icon-button" aria-label="分享"><Share2 /></button></header><ZouPhotoCarousel images={post.images} title={post.title} /><p className="image-credit">实景图：{coverImage.landmark} · {coverImage.credit} · {coverImage.license} · <a href={coverImage.sourceUrl} target="_blank" rel="noreferrer">查看来源与授权</a></p><article className="detail-copy"><h1>{post.title}</h1><p>{post.summary}</p><dl><div><dt>时间</dt><dd>3 天 2 晚</dd></div><div><dt>花费</dt><dd>¥1860</dd></div><div><dt>步行</dt><dd>6.8 km</dd></div></dl>{communityMapVisible ? <button className="detail-replay-button" onClick={() => navigate(`/community/${post.id}/replay`)}><span>路线回放</span><small>可选 · 查看 Bloub 沿路线移动</small><span aria-hidden="true">→</span></button> : <div className="detail-map-note">社区地图已隐藏，可在设置中重新打开；文字行程仍可查看。</div>}<section className="community-detail__itinerary" aria-labelledby="community-itinerary-title"><header><h2 id="community-itinerary-title">具体行程</h2><span>{post.city} · DAY 1</span></header><ol>{itinerary.map((place, index) => <li key={place.id}><span>{index + 1}</span><div><strong>{place.name}</strong><small>{place.time} · {place.type} · {place.stay}</small><p>{place.transport}</p></div><b>¥{place.budget}</b></li>)}</ol></section><h2>这次最推荐</h2><p>把核心片区放在上午，下午转入室内展览或留给咖啡和休息。移动顺序按相邻区域组织，避免为了多看一个点来回折返。</p><h2>需要注意</h2><p>热门地点的人流、营业时间和预约规则会随日期变化；路线中的时间、价格和替代点都需要出行前再次核对。</p></article><DetailActionBar post={post} onUse={() => setUseOpen(true)} onComments={() => setCommentsOpen(true)} onFavorite={(saved) => setToast(saved ? '已收藏这条路线' : '已取消收藏')} /><ZouBottomSheet open={commentsOpen} onClose={() => setCommentsOpen(false)} title={`评论${comments.length ? ` · ${comments.length}` : ''}`}><div className="comment-list">{comments.map((comment) => <article key={comment.id}><ZouAvatar src={comment.avatar} name={comment.author} size="sm" /><p><strong>{comment.author}</strong>{comment.body}</p><button onClick={() => replyTo(comment.author)}>回复</button></article>)}</div><label className="comment-input"><span className="sr-only">写评论</span><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submitComment() } }} placeholder="写下评论" /><button aria-label="发送评论" disabled={!draft.trim()} onClick={submitComment}><Send /></button></label></ZouBottomSheet><ZouBottomSheet open={useOpen} onClose={() => setUseOpen(false)} title="使用这个行程"><button className="use-trip-option" onClick={() => void useTrip('keep')}><strong>尽量保持原路线</strong><span>保留地点顺序和节奏，只替换真正不合适的节点。</span></button><button className="use-trip-option" onClick={() => void useTrip('optimize')}><strong>按我的偏好重新优化</strong><span>保留路线骨架，只替换真正不合适的节点。</span></button><ZouButton variant="plain" onClick={() => { setUseOpen(false); navigate('/travel/new') }}>先看看输入</ZouButton></ZouBottomSheet>{toast ? <ZouToast message={toast} onClose={() => setToast('')} /> : null}</div>
}

export const CommunityReplayPage = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const post = communityPosts.find((item) => item.id === id) ?? communityPosts[0]
  const replayPlaces = useMemo(() => getDemoTripPlaces(post.city, 'Day 1'), [post.city])
  const cityProfile = useMemo(() => getCityProfile(post.city), [post.city])
  const reducedMotion = useAppStore((s) => s.reducedMotion)
  const communityMapVisible = useAppStore((s) => s.communityMapVisible)
  const playbackRef = useRef(new TripPlaybackEngine(replayPlaces.length, 'replay'))
  const [playback, setPlayback] = useState<TripPlaybackSnapshot>(() => playbackRef.current.start())
  const progress = playback.progress
  const [detail, setDetail] = useState(false)
  useEffect(() => {
    if (detail) return
    const interval = reducedMotion ? 380 : 80
    const delta = reducedMotion ? 0.2 : 0.012
    const timer = window.setInterval(() => setPlayback(playbackRef.current.tick(delta)), interval)
    return () => window.clearInterval(timer)
  }, [detail, reducedMotion])
  useEffect(() => { if (progress >= 1) { const id = window.setTimeout(() => setDetail(true), reducedMotion ? 100 : 650); return () => window.clearTimeout(id) } }, [progress, reducedMotion])
  return <AppShell immersive><div className={`community-replay ${detail ? 'is-detail' : ''}`}><div className="replay-top"><button className="icon-button" aria-label="返回" onClick={() => navigate(-1)}><span aria-hidden="true">←</span></button>{detail ? <span>真实完成的行程</span> : <button className="replay-skip" onClick={() => setDetail(true)}>跳过回放</button>}</div><motion.div className="community-replay__scene" layout transition={{ duration: reducedMotion ? 0.1 : 0.55, ease: [0.16, 1, 0.3, 1] }}>{communityMapVisible ? <RealRouteMap center={cityProfile.mapCenter} places={replayPlaces} progress={progress} compact={detail}/> : <div className="community-map-hidden"><img src={post.image} alt="" width={420} height={640} /><div><strong>社区地图已隐藏</strong><span>可在设置中重新打开</span></div></div>}{!detail ? <div className="replay-caption"><span>{replayPlaces[Math.min(replayPlaces.length - 1, Math.round(progress * (replayPlaces.length - 1)))].time}</span><strong>{replayPlaces[Math.min(replayPlaces.length - 1, Math.round(progress * (replayPlaces.length - 1)))].name}</strong></div> : null}</motion.div>{detail ? <motion.div initial={{ opacity: 0, y: reducedMotion ? 0 : 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0.1 : 0.38 }}><CommunityDetail post={post} /></motion.div> : null}</div></AppShell>
}

export const CommunityDetailPage = () => {
  const { id } = useParams()
  const post = communityPosts.find((item) => item.id === id) ?? communityPosts[0]
  return <AppShell><CommunityDetail post={post} /></AppShell>
}

export const PublishPage = () => {
  const navigate = useNavigate()
  const [cover, setCover] = useState(getCityImage('上海').src)
  const [title, setTitle] = useState('上海三天两晚：把雨留给展览')
  const [published, setPublished] = useState(false)
  const covers = [getCityImage('上海').src, '/assets/route-overview.svg']
  if (published) return <AppShell><div className="publish-success"><ZouMotionBot state="success" /><h1>已发布到社区</h1><p>这次走走已经成为一条可以被别人回放和复用的真实路线。</p><ZouButton onClick={() => navigate('/community')}>查看发布</ZouButton></div></AppShell>
  return <AppShell><ZouNavigationBar title="发布到社区" /><div className="page-content publish-page"><header><h1>分享这次走走</h1><p>内容已由 AI 整理，你可以继续编辑。</p></header><section><h2>选择封面</h2><div className="cover-options">{covers.map((item) => <button key={item} aria-pressed={cover === item} onClick={() => setCover(item)}><img src={item} alt="封面候选" />{cover === item ? <Check /> : null}</button>)}</div><small>未选择时默认使用 3D 完整行程总览。</small></section><label>标题<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>总结<textarea defaultValue="三天没有塞满景点，而是让街区、展览和吃饭各自留出完整时间。下午下雨时刚好在美术馆，整条路线没有折返。" /></label><div className="publish-facts"><span>上海</span><span>3 天 2 晚</span><span>¥1860</span><span>8 个地点</span></div><ZouButton onClick={() => setPublished(true)}>发布</ZouButton></div></AppShell>
}
