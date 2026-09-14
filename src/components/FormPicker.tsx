import { useEffect, useRef, useState, type InputHTMLAttributes, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Clock3, ChevronLeft, ChevronRight, X } from 'lucide-react'
import './form-picker.css'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { type: 'date' | 'time' }
const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

function TimeWheel({ title, count, value, onChange }: { title: string; count: number; value: string; onChange: (value: string) => void }) {
  const list = useRef<HTMLDivElement>(null)
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (list.current) list.current.scrollTop = Number(value) * 44
    return () => clearTimeout(settle.current)
  }, [])
  return <section><h3>{title}</h3><div className="time-wheel" ref={list} aria-label={title} onScroll={event => {
    const offset = event.currentTarget.scrollTop
    clearTimeout(settle.current)
    settle.current = setTimeout(() => onChange(pad(Math.max(0, Math.min(count-1, Math.round(offset / 44))))), 100)
  }}>{Array.from({length:count}, (_,i)=><button type="button" key={i} aria-label={`${pad(i)}${title}`} aria-pressed={value===pad(i)} onClick={()=>{if(list.current)list.current.scrollTop=i*44;onChange(pad(i))}}>{pad(i)}</button>)}</div></section>
}

export function FormPicker({ type, value, onChange, min, max, required, disabled, name, ...rest }: Props) {
  const current = String(value || '')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [month, setMonth] = useState(new Date())
  const dialog = useRef<HTMLDialogElement>(null)
  const label = rest['aria-label'] || (type === 'date' ? '选择日期' : '选择时间')
  useEffect(() => { if (open) dialog.current?.showModal() }, [open])
  const commit = (next: string) => {
    onChange?.({ target: { value: next }, currentTarget: { value: next } } as ChangeEvent<HTMLInputElement>)
    setOpen(false)
  }
  const start = () => {
    setDraft(current || (type === 'time' ? '09:00' : ''))
    setMonth(new Date(`${type === 'date' && current ? current : dateKey(new Date())}T12:00:00`))
    setOpen(true)
  }
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay()+6)%7
  const count = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate()
  const [hour='09', minute='00'] = draft.split(':')
  return <>
    <button type="button" className="form-picker-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={start}>
      <span className={!current ? 'is-placeholder' : ''}>{current ? type === 'date' ? current.replaceAll('-', '.') : current : type === 'date' ? '选择日期' : '选择时间'}</span>
      {type === 'date' ? <CalendarDays aria-hidden="true"/> : <Clock3 aria-hidden="true"/>}
    </button>
    <input className="form-picker-validation" tabIndex={-1} aria-hidden="true" name={name} value={current} required={required} onChange={()=>{}} onInvalid={event=>{event.preventDefault();start()}}/>
    {open && createPortal(<dialog ref={dialog} className="form-picker-dialog" onCancel={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget)setOpen(false)}}>
      <div className="form-picker-panel">
        <header><h2>{label}</h2><button type="button" aria-label="关闭选择" onClick={()=>setOpen(false)}><X/></button></header>
        {type === 'date' ? <>
          <div className="form-picker-month"><button type="button" aria-label="上个月" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft/></button><strong>{month.getFullYear()}年{month.getMonth()+1}月</strong><button type="button" aria-label="下个月" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight/></button></div>
          <div className="form-picker-calendar">{['一','二','三','四','五','六','日'].map(day=><span key={day}>{day}</span>)}{Array.from({length:offset},(_,i)=><i key={`gap-${i}`}/>)}{Array.from({length:count},(_,i)=>{const key=dateKey(new Date(month.getFullYear(),month.getMonth(),i+1));return <button type="button" key={key} aria-label={key} aria-pressed={draft===key} disabled={Boolean(min && key<String(min) || max && key>String(max))} onClick={()=>setDraft(key)}>{i+1}</button>})}</div>
        </> : <>
          <p className="form-picker-time-preview">{hour}<span>:</span>{minute}</p>
          <p className="time-wheel-hint">上下滑动，选择小时和分钟</p>
          <div className="form-picker-time-columns"><TimeWheel title="小时" count={24} value={hour} onChange={value=>setDraft(previous=>`${value}:${previous.split(':')[1]}`)}/><span className="time-wheel-colon" aria-hidden="true">:</span><TimeWheel title="分钟" count={60} value={minute} onChange={value=>setDraft(previous=>`${previous.split(':')[0]}:${value}`)}/></div>
        </>}
        <footer>{!required && <button type="button" onClick={()=>commit('')}>暂不填写</button>}<button type="button" className="is-primary" disabled={!draft} onClick={()=>commit(draft)}>确定</button></footer>
      </div>
    </dialog>, document.body)}
  </>
}
