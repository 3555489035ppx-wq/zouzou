import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { communityApi, type CommunitySummary } from '../services/community'

export function CommunityFeed({ initialMode = 'all', controls = true }: { initialMode?: string; controls?: boolean }) {
  const navigate = useNavigate(), [params,setParams] = useSearchParams()
  const requestedMode = controls ? params.get('community') ?? initialMode : initialMode
  const mode = ['all','following','saved','mine'].includes(requestedMode) ? requestedMode : 'all'
  const [items, setItems] = useState<CommunitySummary[]>([]), [cursor, setCursor] = useState<string | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const controllerRef = useRef<AbortController | null>(null)
  const pageCount = useRef(1)
  const setMode = (value:string) => { const next=new URLSearchParams(params);next.set('community',value);next.delete('communityPages');setParams(next,{replace:true}) }
  useEffect(() => {
    const controller = new AbortController(); controllerRef.current=controller; setLoading(true); setItems([]); setCursor(null); setError('')
    const restorePages = controls ? Math.max(1,Math.min(20,Number(params.get('communityPages'))||1)) : 1
    void (async()=>{ try { let accumulated:CommunitySummary[]=[],nextCursor=''; pageCount.current=0
      for(let i=0;i<restorePages;i++){const result=await communityApi.list(mode,nextCursor,controller.signal);accumulated=[...accumulated,...result.items.filter(item=>!accumulated.some(old=>old.id===item.id))];nextCursor=result.nextCursor??'';pageCount.current++;if(!nextCursor)break}
      if(!controller.signal.aborted){setItems(accumulated);setCursor(nextCursor||null)}
    }catch(cause){if(!controller.signal.aborted)setError(String(cause))}finally{if(!controller.signal.aborted)setLoading(false)}})()
    return () => controller.abort()
    // Pagination is restored on mount; updating its URL after loading does not refetch earlier pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, retry])
  const more = async () => { if (!cursor || loading) return; const controller=controllerRef.current;setLoading(true);setError('');try{const result=await communityApi.list(mode,cursor,controller?.signal);if(controller?.signal.aborted)return;setItems(previous=>[...previous,...result.items.filter(item=>!previous.some(old=>old.id===item.id))]);setCursor(result.nextCursor);pageCount.current++;if(controls){const next=new URLSearchParams(params);next.set('communityPages',String(pageCount.current));setParams(next,{replace:true})}}catch(cause){if(!controller?.signal.aborted)setError(String(cause))}finally{if(!controller?.signal.aborted)setLoading(false)} }
  return <section aria-label="公开社区"><h2>{mode === 'mine' ? '我在社区发布的记录' : '旅友公开记录'}</h2><p>公开记录对所有访客可见。</p>{controls ? <div className="trip-library__filters">{[['all', '全部记录'], ['following', '我的关注'], ['saved', '社区收藏']].map(([value, label]) => <button key={value} aria-pressed={mode === value} disabled={loading} onClick={() => setMode(value)}>{label}</button>)}</div> : null}
    {items.map(item => <article className="trip-record" key={item.id}><button className="trip-record__open" onClick={() => navigate(`/publications/${item.id}?public=1`)}><strong>{item.title}</strong><p>{item.nickname} · {item.city} · {item.experience === 'experienced' ? '已体验' : '计划中'} · {item.status === 'retracted' ? '已撤回' : `版本${item.revision}`}</p><p>{item.excerpt}</p><small>{item.saved?'已收藏 · ':''}{item.liked?'已点赞 · ':''}{item.stopCount}项安排 · {item.likes}赞 · {item.commentCount}条评论</small></button></article>)}
    {!loading && !error && !items.length ? <p>{mode === 'following' ? '尚无关注作者的公开记录。可在公开记录详情中关注作者。' : mode === 'saved' ? '还没有收藏公开记录。' : '暂无公开记录。'}</p> : null}{loading ? <p role="status">正在读取社区…</p> : null}{error ? <p role="alert">{error}<button onClick={() => setRetry(value => value + 1)}>重试</button></p> : null}{cursor ? <button disabled={loading} onClick={() => void more()}>加载更多公开记录</button> : null}</section>
}
