import { useEffect, useRef, useState } from 'react'
import { sendAgentMessage, type AgentMessage, type AgentResult } from '../services/travelAgent'
import './TravelAgentPage.css'

const examples = ['上海哪里比较好玩？', '上海两天一晚，白天少走路，晚上喜欢吹风散步']
const sourceHref = (raw: string | null) => {
  if (!raw) return undefined
  try { const url = new URL(raw); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined }
  catch { return undefined }
}

export function TravelAgentPage() {
  const [history, setHistory] = useState<AgentMessage[]>([])
  const [results, setResults] = useState<AgentResult[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const end = useRef<HTMLDivElement>(null)
  const composing = useRef(false)
  useEffect(() => () => { generation.current += 1; active.current?.abort() }, [])
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [history, pending])
  const cancel = () => {
    generation.current += 1
    active.current?.abort()
    active.current = null
    setPending('')
    setError('已停止，可修改问题后重新发送。')
  }
  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || active.current || composing.current) return
    if (history.length >= 20 || history.reduce((n, item) => n + item.content.length, text.length) > 16000) {
      setError('这段对话已达到长度限制，请先保留需要的结果，再开始新对话。')
      return
    }
    const controller = new AbortController()
    const id = ++generation.current
    active.current = controller
    setPending(text)
    setInput(text)
    setError('')
    const timeout = window.setTimeout(() => controller.abort('timeout'), 45000)
    const next: AgentMessage[] = [...history, { role: 'user', content: text }]
    try {
      const result = await sendAgentMessage(next, controller.signal)
      if (id !== generation.current || controller.signal.aborted) return
      setHistory([...next, { role: 'assistant', content: [result.answer, result.context ? '当前方案摘要：' + result.context : ''].filter(Boolean).join('\n').slice(0, 4000) }])
      setResults(previous => [...previous, result])
      setInput('')
    } catch (cause) {
      if (id !== generation.current) return
      setError(controller.signal.aborted ? '等待超时，请重试；之前的结果仍保留。' : cause instanceof Error ? cause.message : '暂时没有完成，请重试。')
    } finally {
      window.clearTimeout(timeout)
      if (id === generation.current) { active.current = null; setPending('') }
    }
  }
  return <div className="travel-agent-demo">
    <main className="travel-agent">
      <header><span className="travel-agent__eyebrow">ZOUZOU TRAVEL AGENT · 测试版</span><h1>先聊聊，想去哪走走？</h1><p>从走走知识库找灵感，也可以直接说天数和偏好。</p></header>
      {!history.length && <div className="travel-agent__examples">{examples.map(text => <button type="button" key={text} disabled={!!pending} onClick={() => void send(text)}>{text}</button>)}</div>}
      <section aria-label="旅行对话" aria-live="polite" aria-busy={!!pending}>
        {results.map((result, index) => <div className="travel-agent__turn" key={index}>
          <p className="travel-agent__user">{history[index * 2]?.content}</p>
          <article className="travel-agent__reply">
            <p>{result.answer}</p>
            {result.recommendations?.map(item => <section className="travel-agent__card" key={item.id}>
              <h2>{item.places.length ? item.places.join(' · ') : item.title}</h2>
              <p>{item.summary}</p><small>{item.tags.join(' / ')}</small>
            </section>)}
            {result.plans.map((plan, planIndex) => <details className="travel-agent__card" key={plan.id} open={planIndex === 0}>
              <summary>{plan.label} · {plan.city} · {Object.keys(plan.days).length}天{plan.nights}晚</summary>
              <p>{plan.difference}</p>
              {Object.entries(plan.days).map(([day, stops]) => <section key={day}>
                <h3>{/^\d+$/.test(day) ? '第' + day + '天' : day}</h3>
                <ol>{stops.map((stop, stopIndex) => <li key={stop.id + '-' + stopIndex}>
                  <strong>{stop.time} {stop.name}</strong><p>{stop.note}</p><small>{stop.transport} · {stop.stay}</small>
                </li>)}</ol>
              </section>)}
            </details>)}
            {!!result.sources.length && <details className="travel-agent__sources"><summary>参考来源（{result.sources.length}）</summary>
              <ul>{result.sources.map(source => <li key={source.id}>{sourceHref(source.url) ? <a href={sourceHref(source.url)} target="_blank" rel="noreferrer">{source.title}</a> : source.title}</li>)}</ul>
            </details>}
            {result.warnings?.map(warning => <p className="travel-agent__warning" key={warning}>{warning}</p>)}
            <small className="travel-agent__trace">{result.trace.join(' → ')}</small>
          </article>
        </div>)}
        {pending && <div><p className="travel-agent__user">{pending}</p><p role="status">正在处理你的旅行需求…</p></div>}
        <div ref={end} />
      </section>
      {error && <p role="alert" className="travel-agent__error">{error}</p>}
      <form className="travel-agent__composer" onSubmit={event => { event.preventDefault(); void send(input) }}>
        <label htmlFor="agent-input">旅行想法</label>
        <textarea id="agent-input" value={input} maxLength={4000} rows={3} disabled={!!pending} placeholder="例如：上海两天一晚，喜欢晚上吹风走走"
          onChange={event => setInput(event.target.value)} onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }} />
        <div>{pending ? <button type="button" onClick={cancel}>停止</button> : <button type="submit" disabled={!input.trim()}>发送</button>}
          <button type="button" disabled={!!pending || !history.length} onClick={() => { if (window.confirm('开始新对话将清除本页对话，已有个人行程不受影响。继续吗？')) { setHistory([]); setResults([]); setError(''); setInput('') } }}>新对话</button>
        </div>
        <small>对话仅保留在当前页面；刷新或离开会清除，不自动改动已保存行程。发送内容将由已配置的模型服务处理。</small>
      </form>
    </main>
  </div>
}
