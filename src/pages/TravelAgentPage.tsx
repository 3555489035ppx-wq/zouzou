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
    setError('已经停下啦，改好想法再发给我就行。')
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
      setHistory([...next, { role: 'assistant', content: [result.answer, result.followUp ?? '', result.context ? '当前方案摘要：' + result.context : ''].filter(Boolean).join('\n') }])
      setResults(previous => [...previous, result])
      setInput('')
    } catch (cause) {
      if (id !== generation.current) return
      setError(controller.signal.aborted ? '这次等得有点久，没能完成。可以再试一次，前面的内容还在。' : cause instanceof Error ? cause.message : '暂时没有完成，请重试。')
    } finally {
      window.clearTimeout(timeout)
      if (id === generation.current) { active.current = null; setPending('') }
    }
  }
  return <div className="travel-agent-demo">
    <main className="travel-agent">
      <header><span className="travel-agent__eyebrow">ZOUZOU TRAVEL AGENT · 测试版</span><h1>先聊聊，想去哪走走？</h1><p>不知道去哪玩，可以先聊聊；想好了，就告诉我天数和喜好。</p></header>
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
            {result.comparisons?.map(item => <section className="travel-agent__card" key={item.subject}>
              <h2>{item.subject}</h2>
              {item.status === 'insufficient' ? <p>这个地方的具体资料还不够，暂时不好直接比较。</p> :
                <ul>{item.evidence.map((fact, factIndex) => <li key={fact.sourceId + '-' + factIndex}>
                  {fact.text}
                  <small> · {result.sources.find(source => source.id === fact.sourceId)?.title ?? '知识库来源'}</small>
                </li>)}</ul>}
            </section>)}
            {result.reasons?.map(reason => <section className="travel-agent__card" key={reason.sourceId}>
              <h2>{reason.title}</h2><p>{reason.summary}</p>
              <small>{reason.matchedTags.length ? '和你喜好相近的内容：' + reason.matchedTags.join('、') : '这是相关城市的资料，还需要看看合不合你的喜好'}</small>
            </section>)}
            {result.changeScope === 'regenerated' && <p className="travel-agent__warning">这次重新排了一版，其他天也可能有变化，记得一起看看。</p>}
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
            {!!result.sources.length && <details className="travel-agent__sources"><summary>资料来自这里（{result.sources.length}）</summary>
              <ul>{result.sources.map(source => <li key={source.id}>{sourceHref(source.url) ? <a href={sourceHref(source.url)} target="_blank" rel="noreferrer">{source.title}</a> : source.title}</li>)}</ul>
            </details>}
            {result.warnings?.map(warning => <p className="travel-agent__warning" key={warning}>{warning}</p>)}
            {!!result.blocking?.length && <ul className="travel-agent__warning">{result.blocking.map(item => <li key={item}>{item}</li>)}</ul>}
            {result.followUp && <p className="travel-agent__followup">{result.followUp}</p>}
            <details className="travel-agent__sources"><summary>这次是怎么安排的</summary><small className="travel-agent__trace">{result.trace.join(' → ')}</small></details>
            {index === results.length - 1 && <div className="travel-agent__examples">
              {result.kind === 'recommendations' && <button type="button" disabled={!!pending} onClick={() => void send('按前面这个城市，帮我安排两天一晚')}>安排两天一晚</button>}
              {result.kind === 'plans' && <button type="button" disabled={!!pending} onClick={() => void send('保留前面的偏好，把整套行程安排得再轻松一点')}>整套再轻松一点</button>}
              {['recommendations', 'comparison'].includes(result.kind) && <button type="button" disabled={!!pending} onClick={() => void send('详细说说你按哪些条件检索推荐的')}>看看推荐依据</button>}
            </div>}
          </article>
        </div>)}
        {pending && <div><p className="travel-agent__user">{pending}</p><p role="status">正在帮你看看怎么安排…</p></div>}
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
