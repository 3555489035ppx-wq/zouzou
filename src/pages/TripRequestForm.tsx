import { FormPicker } from '../components/FormPicker'
import '../task01.css'
import { ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { DestinationPicker, ZouButton, ZouNavigationBar, ZouBottomSheet } from '../components/ui'
import { TRIP_INPUT_STORAGE, TRIP_MEDIA_STORAGE, type TripMedia } from '../services/trip/planner'
import { readVersioned, writeVersioned } from '../services/storage'
import { useAppStore } from '../stores/appStore'
import { prepareTripImage } from '../services/trip/prepareTripImage'
import { loadDraftMedia, saveDraftMedia, mediaReferences } from '../services/trip/mediaStore'

const DRAFT_KEY = 'zouzou-current-draft-v2'
type Draft = { id: string; revision?: number; updatedAt?: string; sources?: Record<string,'user'|'default'|'example'|'text'>; input: string; destination: string; days: string; budget: string; goal: string; date: string; party: string; budgetMode: string; arrival: string; departure: string; arrivalTime?: string; departureTime?: string; example: boolean }
const blankDraft = (): Draft => ({ id: crypto.randomUUID(), revision:0,updatedAt:new Date().toISOString(),sources:{days:'default',party:'default',budgetMode:'default'}, input: '', destination: '', days: '3', budget: '', goal: '', date: '', party: '1', budgetMode: '全员', arrival: '', departure: '', example: false })

export function TripRequestForm() {
  const navigate = useNavigate()
  const [query]=useSearchParams()
  const [draft, setDraft] = useState<Draft>(() => readVersioned<Draft>(DRAFT_KEY, 'local') ?? blankDraft())
  const [media, setMedia] = useState<TripMedia[]>(() => readVersioned<TripMedia[]>(TRIP_MEDIA_STORAGE, 'local') ?? [])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [mediaBusy,setMediaBusy]=useState(true)
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<TripMedia | null>(null)
  const composing = useRef(false)
  const change = (key: keyof Draft, value: string) => setDraft(previous => {
    const next:Draft={...previous,[key]:value,revision:(previous.revision??0)+1,updatedAt:new Date().toISOString(),sources:{...previous.sources,[key]:'user'},example:false}
    if(key==='input')for(const [field,pattern,limit] of [['party',/(\d+)\s*人/,20],['days',/(\d+)\s*天/,14]] as const){const match=value.match(pattern);if(previous.sources?.[field]!=='user'&&match&&Number(match[1])>=1&&Number(match[1])<=limit){next[field]=match[1];next.sources![field]='text'}}
    return next
  })
  useEffect(()=>{let active=true;loadDraftMedia().then(async saved=>{if(saved){if(active)setMedia(saved)}else{const legacy=readVersioned<TripMedia[]>(TRIP_MEDIA_STORAGE,'local')??[];if(legacy.length)await saveDraftMedia(legacy)}}).catch(()=>{if(active)setError('本机截图存储暂不可用，原草稿保留。')}).finally(()=>{if(active)setMediaBusy(false)});return()=>{active=false}},[])
  useEffect(() => { if (!writeVersioned(DRAFT_KEY, draft, 'local')) setError('草稿暂时无法存到本机，请保持当前页面并复制输入。') }, [draft])
  const submit = () => {
    if (pending || mediaBusy || composing.current) return
    if (!draft.destination && !draft.input.trim() && !media.length) { setError('请填写目的地或旅行想法。'); return }
    if (!Number.isInteger(Number(draft.days)) || Number(draft.days) < 1 || Number(draft.days) > 14 || !Number.isInteger(Number(draft.party)) || Number(draft.party) < 1 || Number(draft.party) > 20) { setError('天数需为1—14，人数需为1—20的整数。'); return }
    if (draft.budget && (!Number.isFinite(Number(draft.budget)) || Number(draft.budget) < 0)) { setError('预算需为非负金额。'); return }
    setPending(true)
    const date = draft.date ? new Date(`${draft.date}T00:00:00Z`) : null
    const end = date ? new Date(date.getTime() + (Number(draft.days) - 1) * 86400000) : null
    const dateText = (value: Date) => `${value.getUTCFullYear()}年${value.getUTCMonth()+1}月${value.getUTCDate()}日`
    const text = `${date && end ? `${dateText(date)}到${dateText(end)}，` : ''}${draft.destination ? `去${draft.destination}${draft.days}天，` : ''}${draft.party}人，${draft.budget ? `全员总预算${Number(draft.budget) * (draft.budgetMode === '人均' ? Number(draft.party) : 1)}元（含住宿和市内交通，不含往返车票；原输入${draft.budgetMode}${draft.budget}元），` : ''}${draft.goal ? `想做${draft.goal}。` : ''}${draft.arrival ? `到达：${draft.arrivalTime??""}到${draft.arrival}。` : ''}${draft.departure ? `返程：${draft.departureTime??""}从${draft.departure}。` : ''}${draft.input}`
    if (!writeVersioned(TRIP_INPUT_STORAGE, text, 'session') || !writeVersioned(TRIP_MEDIA_STORAGE, mediaReferences(media), 'session')) { setPending(false); setError('无法保存生成输入，请检查浏览器存储后重试。'); return }
    if (!writeVersioned('zouzou-generation-input-meta', {draftId:draft.id,draftRevision:draft.revision??0,example:draft.example,sceneType:'travel'}, 'session')) {setPending(false);setError('草稿版本保存失败，请重试。');return}
    useAppStore.getState().transitionTripFlow('START_DRAFT')
    useAppStore.getState().transitionTripFlow('SUBMIT_DRAFT')
    navigate('/travel/understanding')
  }
  const saveMedia = async (next: TripMedia[]) => {setMediaBusy(true);try{await saveDraftMedia(next);setMedia(next);writeVersioned(TRIP_MEDIA_STORAGE,mediaReferences(next),'local');setDraft(previous=>({...previous,revision:(previous.revision??0)+1,updatedAt:new Date().toISOString(),sources:{...previous.sources,attachments:'user'}}));setError('')}catch{setError('附件保存失败，本机空间不足或存储不可用。原附件保留。')}finally{setMediaBusy(false)}}
  return <AppShell><ZouNavigationBar title="创建旅行" right={query.get("from")==="results"?<button type="button" onClick={()=>navigate("/travel/plans",{replace:true})}>关闭修改</button>:undefined} /><form className="page-content travel-new" onSubmit={event => { event.preventDefault(); submit() }} onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}>
    <header><h1>想去哪走走？</h1><p>草稿保存在此设备，未填条件稍后确认。</p></header>
    <section className="trip-constraints trip-request-group" aria-label="目的地与日期"><h2 className="trip-constraints__wide">目的地与日期</h2>
      <label className="trip-constraints__wide trip-request-destination"><span>目的地</span><DestinationPicker value={draft.destination} onChange={value => change('destination', value)} ariaLabel="目的地" /></label>
      <label>天数<input aria-label="旅行天数" type="number" min="1" max="14" value={draft.days} onChange={e => change('days', e.target.value)} /></label>
      <label>出行人数<input aria-label="出行人数" type="number" min="1" max="20" value={draft.party} onChange={e => change('party', e.target.value)} /></label>
      <label>出发日期<FormPicker aria-label="出发日期" type="date" value={draft.date} onChange={e => change('date', e.target.value)} /></label>
      {draft.date ? <label>离开日期<FormPicker aria-label="离开日期" required type="date" min={draft.date} max={new Date(Date.parse(draft.date)+13*86400000).toISOString().slice(0,10)} value={new Date(Date.parse(draft.date)+(Math.max(1,Number(draft.days)||1)-1)*86400000).toISOString().slice(0,10)} onChange={event=>{const days=Math.round((Date.parse(event.target.value)-Date.parse(draft.date))/86400000)+1;if(days>=1&&days<=14)change('days',String(days));else setError('离开日期需在出发当天至第14天之间。')}}/></label>:null}
    </section>
    <section className="trip-constraints trip-request-group" aria-label="预算与想法"><h2 className="trip-constraints__wide">预算与想法</h2>
      <label>预算（元）<input aria-label="旅行预算" type="number" min="0" value={draft.budget} onChange={e => change('budget', e.target.value)} /></label>
      <label>预算口径<span className="budget-mode-control" role="group" aria-label="预算口径">{['全员','人均'].map(mode=><button type="button" key={mode} aria-pressed={draft.budgetMode===mode} onClick={()=>change('budgetMode',mode)}>{mode}</button>)}</span></label>
      <label className="trip-constraints__wide">想做什么<input aria-label="旅行目的" value={draft.goal} onChange={e => change('goal', e.target.value)} placeholder="本地美食、看展、轻松散步" /></label>
    </section>
    <section className="trip-constraints trip-request-group" aria-label="到达与离开"><h2 className="trip-constraints__wide">到达与离开</h2><label>到达时间<FormPicker aria-label="到达时间" type="time" value={draft.arrivalTime??''} onChange={e=>change('arrivalTime',e.target.value)} /></label>
      <label>到达地点<input value={draft.arrival} onChange={e=>change('arrival',e.target.value)} placeholder="具体车站或机场" /></label>
      <label>返程时间<FormPicker aria-label="返程时间" type="time" value={draft.departureTime??''} onChange={e=>change('departureTime',e.target.value)} /></label>
      <label>返程地点<input value={draft.departure} onChange={e=>change('departure',e.target.value)} placeholder="可稍后补充" /></label>
    </section>
    <label className="trip-prompt">补充想法（可选）<textarea aria-label="旅行想法" value={draft.input} onChange={e=>change('input',e.target.value)} placeholder="例如：10月2号9:30到南京，想看展吃本地美食。" /><small>{draft.example ? '主动载入的示例' : '你的草稿'}</small></label>
    <button type="button" className="text-button" onClick={()=>setDraft({...blankDraft(),destination:'上海',days:'3',party:'2',budget:'4000',budgetMode:'全员',date:'2026-09-18',goal:'武康路、安福路、看展和外滩',arrival:'虹桥火车站',departure:'虹桥火车站',arrivalTime:'10:30',departureTime:'18:30',input:'住静安寺附近酒店，不想太赶，喜欢咖啡，最好每天留一段缓冲。',sources:Object.fromEntries(['destination','days','party','budget','budgetMode','date','goal','arrival','departure','arrivalTime','departureTime','input'].map(key=>[key,'example' as const])),example:true})}>使用上海示例体验</button>
    <section className="upload-section"><h2>添加旅行截图 <small>可选</small></h2><p>车票、酒店或收藏截图，帮你少填信息</p><button className="upload-trigger" type="button" disabled={mediaBusy} onClick={()=>fileInput.current?.click()}><ImagePlus aria-hidden="true" />{media.length ? '继续添加截图' : '从相册添加截图'}</button><p className="field-hint">最多6张，自动压缩；生成时读取截图中的日期、车站和酒店，疑问信息由你确认。</p><input ref={fileInput} hidden aria-label="添加旅行截图" type="file" multiple accept="image/*" onChange={async e=>{
      const files=Array.from(e.target.files ?? []);e.target.value=''
      if(files.length + media.length > 6) {setError('最多添加6张截图。');return}
      setMediaBusy(true)
      try { const shots=await Promise.all(files.map(prepareTripImage));await saveMedia([...media,...shots]) } catch(cause) {setError(cause instanceof Error ? cause.message : '图片读取失败，请重新选择。');setMediaBusy(false)}
    }}/><div className="trip-screenshot-grid">{media.map((shot,index)=><div className="trip-screenshot" key={shot.id}><button className="trip-screenshot-preview" type="button" aria-label={`预览截图${index+1}`} onClick={()=>setPreview(shot)}><img src={shot.src} alt={`旅行截图${index+1}`} /></button><button className="trip-screenshot-remove" type="button" aria-label={`删除截图${index+1}`} disabled={mediaBusy} onClick={()=>saveMedia(media.filter(item=>item.id!==shot.id))}><X aria-hidden="true"/></button><span>截图 {index+1}</span></div>)}</div></section>
    <ZouBottomSheet open={Boolean(preview)} onClose={()=>setPreview(null)} title="截图预览">{preview ? <img src={preview.src} alt={preview.name} /> : null}</ZouBottomSheet>{error ? <p role="alert">{error}</p> : null}<div className="trip-submit"><ZouButton aria-label="帮我看看" type="submit" disabled={pending||mediaBusy}>{mediaBusy?'正在保存截图…':pending?'正在准备…':'生成方案'}</ZouButton></div>
  </form></AppShell>
}

