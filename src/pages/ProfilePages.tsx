import { ProfileImageInput } from '../components/ProfileImageInput'
import { CommunityFeed } from '../components/CommunityFeed'
import { PublicationList } from './PublicationPages'
import { useSavedTrips } from '../components/TripLibrary'
import { Mail, Pencil, Bell, FileText, Settings, WalletCards, Backpack, Bookmark, ChevronRight, Footprints } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { ZouAvatar, ZouButton, ZouNavigationBar, ZouToast } from '../components/ui'
import { discoverItems } from '../demo-data/discover'
import { useAppStore } from '../stores/appStore'

const tabs = ['行程', '发布', '收藏'] as const
type Tab = typeof tabs[number]

export const ProfilePage = ({ initialTab = '行程' }: { initialTab?: Tab }) => {
  const navigate=useNavigate()
  const nickname=useAppStore(s=>s.nickname),avatar=useAppStore(s=>s.avatar)
  const footprintCount=useAppStore(s=>s.footprints.length),savedPosts=useAppStore(s=>s.savedPosts)
  const plans=useSavedTrips()
  const savedItems=discoverItems.filter(item=>savedPosts.includes(item.id))
  const [toast,setToast]=useState('')
  const [favoriteType,setFavoriteType]=useState<'routes'|'community'>('routes')
  const openTripTool=(path:string)=>navigate(plans.length===1 ? path+'?tripId='+encodeURIComponent(plans[0].tripId??'') : path)
  if(initialTab==='发布') return <AppShell showTabBar><ZouNavigationBar title="发布管理"/><main className="page-content"><PublicationList/></main></AppShell>
  if(initialTab==='收藏') return <AppShell showTabBar><ZouNavigationBar title="我的收藏"/><main className="page-content favorites-page"><nav className="favorites-tabs" aria-label="收藏类型"><button aria-pressed={favoriteType==='routes'} onClick={()=>setFavoriteType('routes')}>路线</button><button aria-pressed={favoriteType==='community'} onClick={()=>setFavoriteType('community')}>旅友记录</button></nav>{favoriteType==='community'?<CommunityFeed initialMode="saved" controls={false}/>:<>{savedItems.length?<div className="collection-list">{savedItems.map(item=><article className="collection-card" key={item.id}><button onClick={()=>navigate('/discover/'+item.id)}><span><strong>{item.title}</strong><small>{item.cityId} · {item.poiCount}个地点</small></span><ChevronRight/></button><footer><button onClick={()=>{try{useAppStore.getState().toggleSaved(item.id);setToast('已取消收藏')}catch(cause){setToast(String(cause))}}}>取消收藏</button></footer></article>)}</div>:<ProfileEmpty title="还没有收藏路线" body="把想去的路线先收在这里。" action="去发现" onClick={()=>navigate('/discover')}/ >}</>}{toast?<ZouToast message={toast} onClose={()=>setToast('')}/>:null}</main></AppShell>
  return <AppShell showTabBar><main className="personal-hub">
    <header className="personal-hub__header"><button className="icon-button personal-hub__messages" aria-label="消息与提醒" onClick={()=>navigate('/notifications')}><Mail/></button><button className="personal-hub__identity" aria-label="编辑资料" onClick={()=>navigate('/profile/edit')}><ZouAvatar src={avatar} name={nickname} size="xl"/><h1>{nickname}<Pencil size={16}/></h1></button></header>
    <section className="personal-hub__stats" aria-label="我的旅行统计"><div><span>行程</span><strong>{plans.length}</strong></div><div><span>足迹</span><strong>{footprintCount}</strong></div><div><span>收藏</span><strong>{savedPosts.length}</strong></div><div><span>已完成</span><strong>{plans.filter(plan=>['completed','archived'].includes(plan.status??'')).length}</strong></div></section>
    <nav className="personal-hub__shortcuts" aria-label="我的快捷入口"><button onClick={()=>navigate('/profile/favorites')}><Bookmark/><span>我的收藏</span></button><button onClick={()=>openTripTool('/journey/packing')}><Backpack/><span>行李清单</span></button><button onClick={()=>openTripTool('/journey/expense')}><WalletCards/><span>旅行账单</span></button></nav>
    <nav className="personal-hub__menu" aria-label="旅行管理"><button onClick={()=>navigate('/journey/footprint')}><Footprints/><span>旅行足迹</span><ChevronRight/></button><button onClick={()=>navigate('/notifications')}><Bell/><span>行程提醒</span><ChevronRight/></button><button onClick={()=>navigate('/profile/posts')}><FileText/><span>发布管理</span><ChevronRight/></button></nav>
    <nav className="personal-hub__menu" aria-label="个人设置"><button onClick={()=>navigate('/profile/edit')}><Pencil/><span>编辑资料</span><ChevronRight/></button><button onClick={()=>navigate('/settings/install')}><Bookmark/><span>添加到手机桌面</span><ChevronRight/></button><button onClick={()=>navigate('/settings')}><Settings/><span>设置</span><ChevronRight/></button></nav>
  </main></AppShell>
}

const ProfileEmpty = ({ title, body, action, onClick }: { title: string; body: string; action: string; onClick: () => void }) => <div className="profile-empty"><h2>{title}</h2><p>{body}</p><ZouButton onClick={onClick}>{action}</ZouButton></div>

export const ProfileEditPage = () => {
  const navigate = useNavigate(); const nickname = useAppStore((s) => s.nickname); const avatar = useAppStore((s) => s.avatar); const cover = useAppStore((s) => s.cover); const bio = useAppStore((s) => s.bio)
  const [name, setName] = useState(nickname); const [image, setImage] = useState(avatar); const background = cover; const [description, setDescription] = useState(bio); const [saving, setSaving] = useState(false)
  const [error,setError]=useState('')
  const save = () => { setSaving(true); try { useAppStore.getState().saveProfile({nickname:name.trim()||'设备访客',avatar:image,bio:description,cover:background}); navigate('/profile') }catch(cause){setError(String(cause))}finally{setSaving(false)} }
  return <AppShell><ZouNavigationBar title="编辑资料" /><main className="profile-edit"><header className="profile-edit__intro"><span>个人资料</span><h1>让同行的人认出你</h1><p>头像、昵称和简介会显示在你的行程与共同计划中。</p></header><form className="profile-edit__form" onSubmit={(event)=>{event.preventDefault();save()}}><ProfileImageInput label="头像" ratio={1} value={image} onChange={setImage}/><section className="profile-edit__fields"><label><span>昵称</span><input maxLength={40} autoComplete="nickname" value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>个人简介</span><textarea maxLength={120} value={description} onChange={(event) => setDescription(event.target.value)} /><small>{description.length}/120</small></label></section>{error?<p className="profile-edit__error" role="alert">{error}</p>:null}<ZouButton type="submit" loading={saving}>保存资料</ZouButton></form></main></AppShell>
}
