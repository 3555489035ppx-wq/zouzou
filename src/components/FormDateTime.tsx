import { useState, type InputHTMLAttributes, type ChangeEvent } from 'react'
import { FormPicker } from './FormPicker'

export function FormDateTime({value,onChange,name,required,disabled,min,max,...rest}:InputHTMLAttributes<HTMLInputElement>) {
  const current=String(value ?? '')
  const [pendingDate,setPendingDate]=useState('')
  const [pendingTime,setPendingTime]=useState('')
  const [date='',time='']=current.split('T')
  const update=(part:'date'|'time',next:string)=>{
    const d=part==='date'?next:(date||pendingDate)
    const t=part==='time'?next:(time||pendingTime)
    setPendingDate(d);setPendingTime(t)
    onChange?.({target:{value:d&&t?`${d}T${t}`:'',name},currentTarget:{value:d&&t?`${d}T${t}`:'',name}} as ChangeEvent<HTMLInputElement>)
  }
  return <span className="form-datetime-fields">
    <FormPicker type="date" aria-label={`${rest['aria-label']??'截止'}日期`} value={date||pendingDate} onChange={e=>update('date',e.target.value)} disabled={disabled} required={required} min={String(min??'').split('T')[0]} max={String(max??'').split('T')[0]}/>
    <FormPicker type="time" aria-label={`${rest['aria-label']??'截止'}时间`} value={time||pendingTime} onChange={e=>update('time',e.target.value)} disabled={disabled} required={required}/>
    <input type="hidden" name={name} value={current}/>
  </span>
}
