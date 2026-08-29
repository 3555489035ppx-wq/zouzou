import { Camera, Check, ChevronRight, Edit3, Heart, Settings } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ZouAvatar, ZouButton, ZouNavigationBar, ZouSegmentedControl } from '../components/ui'
import { communityPosts } from '../demo-data/community'
import { useAppStore } from '../stores/appStore'

const profileTabs = ['行程', '发布', '收藏', '喜欢']
const routeForTab: Record<string, string> = { 行程: '/profile/trips', 发布: '/profile/posts', 收藏: '/profile/favorites', 喜欢: '/profile/likes' }

export const ProfilePage = ({ initialTab = '行程' }: { initialTab?: string }) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nickname = useAppStore((s) => s.nickname)
  const avatar = useAppStore((s) => s.avatar)
  const cover = useAppStore((s) => s.cover)
  const setCover = useAppStore((s) => s.setCover)
  const followedAuthors = useAppStore((s) => s.followedAuthors)
  const [tab, setTab] = useState(initialTab)
  const [tripFilter, setTripFilter] = useState('全部')
  const [favoriteFilter, setFavoriteFilter] = useState(searchParams.get('folder') ?? '我的收藏夹')
  const items = tab === '喜欢' ? communityPosts.slice(3, 12) : tab === '收藏' ? communityPosts.slice(0, 9) : tab === '发布' ? communityPosts.slice(1, 10) : communityPosts.slice(0, 9)
  const changeTab = (next: string) => { setTab(next); navigate(routeForTab[next], { replace: true }) }
  const followingCount = 44 + followedAuthors.length
  return <AppShell showTabBar><div className="profile-page"><section className="profile-cover"><label className="profile-cover__change"><img src={cover} alt="个人封面，点击更换" width={1200} height={480} /><span>更换封面</span><input aria-label="更换个人封面" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setCover(URL.createObjectURL(file)) }} /></label><div className="profile-cover__actions"><button className="icon-button" aria-label="编辑资料" onClick={() => navigate('/profile/edit')}><Edit3 /></button><button className="icon-button" aria-label="设置" onClick={() => navigate('/settings')}><Settings /></button></div></section><section className="profile-intro"><ZouAvatar src={avatar} name={nickname} size="xl" /><h1>{nickname}</h1><p>喜欢慢慢走，也喜欢把走过的路整理清楚。</p><ZouButton variant="secondary" onClick={() => navigate('/profile/edit')}>编辑资料</ZouButton><dl><button onClick={() => navigate('/profile/likes')}><dt>获赞</dt><dd>1,284</dd></button><button onClick={() => navigate('/profile/following')}><dt>关注</dt><dd>{followingCount}</dd></button><button onClick={() => navigate('/profile/followers')}><dt>粉丝</dt><dd>393</dd></button></dl></section><div className="profile-tabs" role="tablist">{profileTabs.map((item) => <button role="tab" aria-selected={tab === item} key={item} onClick={() => changeTab(item)}>{item}</button>)}</div>{tab === '行程' ? <ZouSegmentedControl options={['全部', '即将开始', '进行中', '已完成']} value={tripFilter} onChange={setTripFilter} /> : null}{tab === '收藏' ? <div className="favorite-filters">{['我的收藏夹', '行程', '地点', '餐厅', '酒店'].map((item) => <button aria-pressed={favoriteFilter === item} key={item} onClick={() => setFavoriteFilter(item)}>{item}</button>)}</div> : null}{tab === '收藏' && favoriteFilter === '我的收藏夹' ? <div className="folder-grid">{['上海', '约会', '咖啡', '毕业旅行'].map((folder, index) => <button key={folder} onClick={() => { setFavoriteFilter(folder); navigate(`/profile/favorites?folder=${encodeURIComponent(folder)}`, { replace: true }) }}><img src={communityPosts[index].image} alt={`${folder}收藏夹`} /><strong>{folder}</strong><small>{8 + index * 3} 项收藏</small></button>)}</div> : <div className="profile-grid">{items.map((post, index) => <button key={`${tab}-${post.id}`} onClick={() => tab === '行程' ? navigate('/trips') : navigate(`/community/${post.id}`)}><img src={post.image} alt={post.title} loading="lazy" />{tab === '行程' ? <span className={index === 0 ? 'is-active' : ''}>{index === 0 ? '进行中' : index < 3 ? '10月' : <><Check />已完成</>}</span> : <span><Heart />{post.likes}</span>}</button>)}</div>}</div></AppShell>
}

export const ProfileEditPage = () => {
  const navigate = useNavigate()
  const nickname = useAppStore((s) => s.nickname)
  const avatar = useAppStore((s) => s.avatar)
  const setProfile = useAppStore((s) => s.setProfile)
  const [name, setName] = useState(nickname)
  const [image, setImage] = useState(avatar)
  return <AppShell><ZouNavigationBar title="编辑资料" /><div className="page-content profile-edit"><label className="avatar-upload"><img src={image} alt="当前头像" /><span><Camera />更换头像</span><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setImage(URL.createObjectURL(file)) }} /></label><label>昵称<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>简介<textarea defaultValue="喜欢慢慢走，也喜欢把走过的路整理清楚。" /></label><ZouButton onClick={() => { setProfile(name, image); navigate('/profile') }}>保存资料</ZouButton></div></AppShell>
}

export const PeopleListPage = ({ title }: { title: '关注' | '粉丝' }) => {
  const following = useAppStore((s) => s.followedAuthors)
  const toggleFollow = useAppStore((s) => s.toggleFollow)
  return <AppShell><ZouNavigationBar title={title} /><div className="page-content people-list">{['林晓', '周周', '安安', '阿柚', '野生小海'].map((name, index) => { const isFollowing = following.includes(name); return <article key={name}><ZouAvatar src={communityPosts[index].avatar} name={name} /><div><strong>{name}</strong><small>{index % 2 ? '上海 · 12 条行程' : '杭州 · 8 条行程'}</small></div><button aria-pressed={isFollowing} onClick={() => toggleFollow(name)}>{isFollowing ? '已关注' : '关注'}</button></article> })}</div></AppShell>
}
