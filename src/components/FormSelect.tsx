import { Children, isValidElement, useEffect, useRef, useState, type SelectHTMLAttributes, type ReactNode, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, X } from 'lucide-react'
import './form-picker.css'

type Option = { value: string; label: ReactNode; disabled?: boolean }
function optionsFrom(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{value?: string | number; children?: ReactNode; disabled?: boolean}>(child)) return []
    if (child.type !== 'option') return optionsFrom(child.props.children)
    return [{ value: String(child.props.value ?? child.props.children ?? ''), label: child.props.children, disabled: child.props.disabled }]
  })
}
export function FormSelect({ children, value, defaultValue, onChange, disabled, name, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = optionsFrom(children)
  const [local, setLocal] = useState(String(defaultValue ?? options[0]?.value ?? ''))
  const current = String(value ?? local)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('请选择')
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => { if(open) dialog.current?.showModal() }, [open])
  const close = () => { setOpen(false); trigger.current?.focus({preventScroll:true}) }
  return <>
    <button ref={trigger} type="button" className={`form-picker-trigger ${rest.className ?? ''}`} id={rest.id} disabled={disabled} aria-label={rest['aria-label']} aria-haspopup="dialog" aria-expanded={open} onClick={event => {
      setTitle(rest['aria-label'] ?? event.currentTarget.closest('label')?.childNodes[0]?.textContent?.trim() ?? '请选择'); setOpen(true)
    }}><span>{options.find(option => option.value === current)?.label ?? '请选择'}</span><ChevronDown aria-hidden="true" /></button>
    <input type="hidden" name={name} value={current} disabled={disabled}/>
    {open && createPortal(<dialog ref={dialog} className="form-picker-dialog" aria-label={title} onCancel={close} onClick={event=>{if(event.target===event.currentTarget)close()}}><div className="form-picker-panel">
      <header><h2>{title}</h2><button type="button" aria-label="关闭选择" onClick={close}><X/></button></header>
      <div className="form-select-options">{options.map((option,index)=><button type="button" key={`${option.value}-${index}`} disabled={option.disabled} aria-pressed={option.value===current} onClick={()=>{
        setLocal(option.value); onChange?.({target:{value:option.value,name},currentTarget:{value:option.value,name}} as ChangeEvent<HTMLSelectElement>); close()
      }}><span>{option.label}</span>{option.value===current && <Check aria-hidden="true"/>}</button>)}</div>
    </div></dialog>,document.body)}
  </>
}
