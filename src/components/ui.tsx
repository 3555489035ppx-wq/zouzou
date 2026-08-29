import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Bookmark, Check, ChevronDown, ChevronRight, Heart, Home, Lock,
  MapPin, MessageCircle, MoreHorizontal, Orbit, Plus, Route, Search, Share2, Trash2,
  UserRound, Utensils, X,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import type { BotState } from '../character/engine/motionEngine'
import type { Look } from '../private-assets/bloub/bot/engine'
import type { Place, Plan } from '../demo-data/trips'
import type { CommunityPost } from '../demo-data/community'
import { cityNames } from '../demo-data/cities'
import { BloubBotSvg } from './BloubBotSvg'

export const ZouButton = ({ children, variant = 'primary', loading = false, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'plain'; loading?: boolean }) => (
  <button className={`zou-button zou-button--${variant} ${className}`} data-loading={loading || undefined} disabled={loading || props.disabled} {...props}>
    {loading ? <><span className="spinner" aria-hidden="true" />处理中</> : children}
  </button>
)

export const ZouCard = ({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) => onClick ? (
  <button className={`zou-card zou-card--button ${className}`} onClick={onClick}>{children}</button>
) : <section className={`zou-card ${className}`}>{children}</section>

export const ZouAvatar = ({ src, name, size = 'md', muted = false }: { src: string; name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; muted?: boolean }) => (
  <img className={`zou-avatar zou-avatar--${size} ${muted ? 'is-muted' : ''}`} src={src} alt={`${name}的头像`} width={64} height={64} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/assets/date.jpg' }} />
)

export const ZouAvatarStack = ({ friends }: { friends: { name: string; image: string; status: string }[] }) => (
  <div className="avatar-stack" aria-label={`${friends.length} 位朋友`}>
    {friends.slice(0, 4).map((friend) => <ZouAvatar key={friend.name} src={friend.image} name={friend.name} size="sm" muted={friend.status === 'pending'} />)}
    {friends.length > 4 ? <span className="avatar-stack__more">+{friends.length - 4}</span> : null}
  </div>
)

export const ZouNavigationBar = ({ title, back = true, right }: { title?: string; back?: boolean; right?: ReactNode }) => {
  const navigate = useNavigate()
  return (
    <header className="zou-nav">
      <div className="zou-nav__side">{back ? <button className="icon-button" aria-label="返回" onClick={() => navigate(-1)}><ArrowLeft /></button> : null}</div>
      <div className="zou-nav__title">{title}</div>
      <div className="zou-nav__side zou-nav__side--right">{right}</div>
    </header>
  )
}

const tabs = [
  { label: '首页', path: '/home', icon: Home },
  { label: '行程', path: '/trips', icon: Route },
  { label: '社区', path: '/community', icon: Orbit },
  { label: '我', path: '/profile', icon: UserRound },
]

export const ZouTabBar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <nav className="zou-tabbar" aria-label="主导航">
      {tabs.map((tab) => {
        const selected = location.pathname === tab.path || (tab.path !== '/home' && location.pathname.startsWith(tab.path))
        const Icon = tab.icon
        return (
          <button key={tab.path} className="zou-tab" aria-current={selected ? 'page' : undefined} onClick={() => navigate(tab.path)}>
            <motion.span animate={{ scale: selected ? [0.96, 1] : 1 }} transition={{ duration: 0.16 }}>
              <Icon className="zou-tab__icon" aria-hidden="true" />
            </motion.span>
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export const ZouBottomSheet = ({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) => {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = `sheet-title-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog ref={ref} className="zou-sheet" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === ref.current) onClose() }}>
      <div className="zou-sheet__grabber" aria-hidden="true" />
      <header><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="关闭" onClick={onClose}><X /></button></header>
      <div className="zou-sheet__content">{children}</div>
    </dialog>
  )
}

export const ZouSegmentedControl = ({ options, value, onChange, label = '视图切换' }: { options: string[]; value: string; onChange: (value: string) => void; label?: string }) => (
  <div className="zou-segmented" role="radiogroup" aria-label={label}>
    {options.map((option) => <button key={option} role="radio" aria-checked={value === option} onClick={() => onChange(option)}>{option}</button>)}
  </div>
)

export const ZouDaySelector = ({ day, onChange }: { day: string; onChange: (day: string) => void }) => (
  <div className="day-selector" role="tablist" aria-label="行程日期">
    {['Day 1', 'Day 2', 'Day 3'].map((item) => <button role="tab" aria-selected={day === item} key={item} onClick={() => onChange(item)}>{item}</button>)}
  </div>
)

export const ZouSearchBar = ({ value, onChange, placeholder = '搜索地点、路线或描述' }: { value: string; onChange: (value: string) => void; placeholder?: string }) => (
  <label className="zou-search"><Search aria-hidden="true" /><span className="sr-only">搜索</span><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />{value ? <button aria-label="清空搜索" onClick={() => onChange('')}><X /></button> : null}</label>
)

export const ZouMotionBot = ({ state = 'idle', label, size = 'lg', gaze = null }: { state?: BotState; label?: string; size?: 'sm' | 'lg'; gaze?: Look | null }) => {
  const reducedMotion = useAppStore((s) => s.reducedMotion)
  const [pointerGaze, setPointerGaze] = useState<Look | null>(null)
  const botRef = useRef<HTMLDivElement>(null)
  const pointerFrame = useRef<number | null>(null)
  useEffect(() => {
    const updateGaze = (event: PointerEvent) => {
      const clientX = event.clientX
      const clientY = event.clientY
      if (pointerFrame.current !== null) return
      pointerFrame.current = window.requestAnimationFrame(() => {
        pointerFrame.current = null
        const rect = botRef.current?.getBoundingClientRect()
        if (!rect || rect.width === 0 || rect.height === 0) return
        const yaw = Math.max(-38, Math.min(38, ((clientX - (rect.left + rect.width / 2)) / rect.width) * 46))
        const pitch = Math.max(-26, Math.min(26, ((rect.top + rect.height / 2 - clientY) / rect.height) * 30))
        setPointerGaze((previous) => previous && Math.abs(previous.yaw - yaw) < .35 && Math.abs(previous.pitch - pitch) < .35 ? previous : { yaw, pitch, mix: 1, spin: 0, wander: 0 })
      })
    }
    const resetGaze = () => setPointerGaze(null)
    const leaveWindow = (event: PointerEvent) => { if (!event.relatedTarget) resetGaze() }
    window.addEventListener('pointermove', updateGaze, { passive: true })
    window.addEventListener('pointerout', leaveWindow)
    window.addEventListener('blur', resetGaze)
    return () => {
      window.removeEventListener('pointermove', updateGaze)
      window.removeEventListener('pointerout', leaveWindow)
      window.removeEventListener('blur', resetGaze)
      if (pointerFrame.current !== null) window.cancelAnimationFrame(pointerFrame.current)
    }
  }, [])
  return (
    <div
      ref={botRef}
      className={`motion-bot motion-bot--${size}`}
      aria-label={label ?? `Bloub / Grok Bot 状态：${state}`}
    >
      <BloubBotSvg state={state} reducedMotion={reducedMotion} gaze={pointerGaze ?? gaze} />
    </div>
  )
}

export const ZouPlanCard = ({ plan, selected, onSelect, onOpen }: { plan: Plan; selected: boolean; onSelect: () => void; onOpen: () => void }) => (
  <article className={`plan-card ${selected ? 'is-selected' : ''}`}>
    <button className="plan-card__select" onClick={onSelect} aria-pressed={selected}>
      <span className="plan-card__check">{selected ? <Check /> : null}</span>
      <h2>{plan.label}</h2>
      <p>{plan.difference}</p>
      <dl><div><dt>预算</dt><dd>¥{plan.budget}</dd></div><div><dt>地点</dt><dd>{plan.places}</dd></div><div><dt>步行</dt><dd>{plan.walking}</dd></div><div><dt>节奏</dt><dd>{plan.pace}</dd></div></dl>
    </button>
    <ZouButton variant={selected ? 'primary' : 'secondary'} onClick={onOpen}>查看这套走法</ZouButton>
  </article>
)

export const ZouPlaceCard = ({ place, locked, onLock, onReplace, onDelete, onMore }: { place: Place & { factState?: 'verified' | 'estimated'; factSource?: string }; locked?: boolean; onLock: () => void; onReplace: () => void; onDelete: () => void; onMore?: () => void }) => (
  <article className="place-card">
    <div className="place-card__time">{place.time}</div>
    <div className="place-card__body"><div><h3>{place.name}</h3><p>{place.type} · 停留 {place.stay} · ¥{place.budget}</p></div><p className="place-card__note">{place.note}</p>{place.factState ? <small className="place-card__source">{place.factState === 'verified' ? '事实已核验' : '候选待核验'} · {place.factSource}</small> : null}<div className="place-card__transport">下一段 · {place.transport}</div></div>
    <div className="place-card__actions">{locked ? <button aria-label="解锁地点" aria-pressed="true" onClick={onLock}><Lock /></button> : null}<button onClick={onReplace}>替换</button><button aria-label="更多操作" aria-haspopup="menu" onClick={onMore ?? onDelete}><MoreHorizontal /></button></div>
  </article>
)

const ratioMap = { portrait: '4 / 5', square: '1 / 1', landscape: '4 / 3', tall: '3 / 4' }
export const ZouCommunityCard = ({ post, onOpen }: { post: CommunityPost; onOpen: () => void }) => (
  <CommunityCardWithLike post={post} onOpen={onOpen} />
)

const CommunityCardWithLike = ({ post, onOpen }: { post: CommunityPost; onOpen: () => void }) => {
  const liked = useAppStore((state) => state.likedPosts.includes(post.id))
  const toggleLiked = useAppStore((state) => state.toggleLiked)
  const likes = post.likes + (liked ? 1 : 0)
  return <article className="community-card">
    <button className="community-card__open" onClick={onOpen} aria-label={`打开${post.title}`}>
      <div className="community-card__image" style={{ aspectRatio: ratioMap[post.ratio] }}><img src={post.image} alt={post.title} loading="lazy" width={420} height={560} />{post.completed ? <span className="community-card__done"><Check />已完成</span> : null}</div>
      <h3>{post.title}</h3>
    </button>
    <div className="community-card__meta"><ZouAvatar src={post.avatar} name={post.author} size="sm" /><span>{post.author}</span><button className="community-card__like" aria-label={`喜欢${post.title}`} aria-pressed={liked} onClick={() => toggleLiked(post.id)}><Heart fill={liked ? 'currentColor' : 'none'} /><span>{likes}</span></button></div>
  </article>
}

export const ZouPhotoCarousel = ({ images, title }: { images: string[]; title: string }) => {
  const [index, setIndex] = useState(0)
  return (
    <section className="photo-carousel" aria-label={`${title}图片`}>
      <motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => { if (info.offset.x < -40) setIndex((v) => Math.min(images.length - 1, v + 1)); if (info.offset.x > 40) setIndex((v) => Math.max(0, v - 1)) }}>
        <img src={images[index]} alt={`${title}第${index + 1}张图片`} width={720} height={620} />
      </motion.div>
      <div className="page-dots" aria-label="图片页码">{images.map((_, dot) => <button key={dot} aria-label={`查看第${dot + 1}张`} aria-current={dot === index ? 'true' : undefined} onClick={() => setIndex(dot)} />)}</div>
    </section>
  )
}

export const ZouToast = ({ message, onClose }: { message: string; onClose: () => void }) => {
  useEffect(() => { const id = window.setTimeout(onClose, 3200); return () => window.clearTimeout(id) }, [onClose])
  return <div className="zou-toast" role="status"><Check />{message}<button aria-label="关闭提示" onClick={onClose}><X /></button></div>
}

export const InlineActionRow = ({ children }: { children: ReactNode }) => <div className="inline-actions">{children}</div>

export const CityPicker = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const city = useAppStore((s) => s.city)
  const setCity = useAppStore((s) => s.setCity)
  const [query, setQuery] = useState('')
  const cities = cityNames.filter((item) => item.includes(query))
  return <ZouBottomSheet open={open} onClose={onClose} title="选择城市"><ZouSearchBar value={query} onChange={setQuery} placeholder="搜索城市" /><button className="sheet-row"><MapPin />当前位置<span>未开启定位</span></button><h3>热门城市</h3><div className="city-grid">{cities.map((item) => <button key={item} aria-pressed={city === item} onClick={() => { setCity(item); onClose() }}>{item}</button>)}</div></ZouBottomSheet>
}

export const DetailActionBar = ({ post, onUse, onComments, onFavorite }: { post: CommunityPost; onUse: () => void; onComments: () => void; onFavorite?: (saved: boolean) => void }) => {
  const liked = useAppStore((s) => s.likedPosts.includes(post.id))
  const saved = useAppStore((s) => s.savedPosts.includes(post.id))
  const toggleLiked = useAppStore((s) => s.toggleLiked)
  const toggleSaved = useAppStore((s) => s.toggleSaved)
  const likes = post.likes + (liked ? 1 : 0)
  return <div className="detail-actions"><ZouButton onClick={onUse}>使用这个行程</ZouButton><button aria-label="喜欢" aria-pressed={liked} onClick={() => toggleLiked(post.id)}><Heart fill={liked ? 'currentColor' : 'none'} /><span className="detail-action-count">{likes}</span></button><button aria-label="收藏" aria-pressed={saved} onClick={() => { toggleSaved(post.id); onFavorite?.(!saved) }}><Bookmark fill={saved ? 'currentColor' : 'none'} /></button><button aria-label="评论" onClick={onComments}><MessageCircle /></button></div>
}

export const FriendStatus = ({ accepted }: { accepted: boolean }) => <span className={accepted ? 'status accepted' : 'status pending'}>{accepted ? <><Check />已接受</> : '等待接受'}</span>

export const SceneLegend = () => <div className="scene-legend"><span><i className="legend-dot is-active" />当前</span><span><i className="legend-dot" />下一站</span></div>

export const EmptyState = ({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) => <div className="empty-state"><ZouMotionBot state="idle" /><h2>{title}</h2><p>{body}</p><ZouButton onClick={onAction}>{action}</ZouButton></div>

export const TripEntryIcon = ({ type }: { type: 'travel' | 'weekend' | 'date' | 'dining' }) => type === 'travel' ? <span className="suitcase-icon" aria-hidden="true" /> : type === 'weekend' ? <MapPin /> : type === 'date' ? <Heart /> : <Utensils />

export { Bookmark, Check, ChevronDown, ChevronRight, Heart, MapPin, MessageCircle, Plus, Search, Share2, X }
