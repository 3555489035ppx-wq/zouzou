import { Camera, Check, ImagePlus, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'

type ProfileImageInputProps = {
  label: string
  ratio: number
  value: string
  onChange: (src: string) => void
}

/** Keep avatar processing on-device and only return the compressed crop after confirmation. */
export function ProfileImageInput({ label, ratio, value, onChange }: ProfileImageInputProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState('')
  const [fileName, setFileName] = useState('')
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const clearDraft = () => {
    setSource('')
    setFileName('')
    setZoom(1)
    if (inputRef.current) inputRef.current.value = ''
  }

  const selectFile = (file?: File) => {
    if (!file) return
    setError('')
    setMessage('')
    if (!file.type.startsWith('image/')) {
      setError('请选择 JPG、PNG 或其他常见图片格式。')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('图片不能超过 10MB，请选择尺寸小一些的图片。')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setSource(String(reader.result))
      setFileName(file.name)
      setZoom(1)
    }
    reader.onerror = () => setError('图片读取失败，原头像没有改变。')
    reader.readAsDataURL(file)
  }

  const apply = async () => {
    try {
      const image = new Image()
      image.src = source
      await image.decode()
      const cropWidth = Math.min(image.width, image.height * ratio) / zoom
      const cropHeight = cropWidth / ratio
      const canvas = document.createElement('canvas')
      canvas.width = ratio === 1 ? 384 : 1200
      canvas.height = Math.round(canvas.width / ratio)
      const context = canvas.getContext('2d')
      if (!context) throw Error('图片处理不可用')
      context.fillStyle = '#f1f1f1'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, (image.width - cropWidth) / 2, (image.height - cropHeight) / 2, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height)
      onChange(canvas.toDataURL('image/jpeg', .86))
      clearDraft()
      setError('')
      setMessage('头像预览已更新，保存资料后正式生效。')
    } catch {
      setError('这张图片无法处理，请换一张 JPG 或 PNG 图片。')
    }
  }

  return (
    <section className="profile-avatar-editor" aria-labelledby={`${inputId}-title`}>
      <div className="profile-avatar-editor__heading">
        <h2 id={`${inputId}-title`}>{label}</h2>
        <p>选择一张清晰的正方形照片，方便同行人认出你。</p>
      </div>

      <div className="profile-avatar-editor__current">
        <div className="profile-avatar-editor__preview">
          <img src={value} alt="当前头像预览" />
          <span aria-hidden="true"><Camera /></span>
        </div>
        <div>
          <strong>{source ? '调整新头像' : '当前头像'}</strong>
          <small>{source ? fileName : '支持 JPG、PNG，最大 10MB'}</small>
          <button type="button" className="profile-avatar-editor__choose" onClick={() => inputRef.current?.click()}>
            <ImagePlus aria-hidden="true" />{source ? '重新选择' : '选择新头像'}
          </button>
        </div>
      </div>

      <input ref={inputRef} id={inputId} className="profile-avatar-editor__input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => selectFile(event.target.files?.[0])} />

      {source ? (
        <div className="profile-avatar-editor__crop">
          <div className="profile-avatar-editor__crop-frame">
            <img src={source} alt="新头像裁剪预览" style={{ transform: `scale(${zoom})` }} />
          </div>
          <label htmlFor={`${inputId}-zoom`}><span>缩放</span><small>{Math.round(zoom * 100)}%</small></label>
          <input id={`${inputId}-zoom`} type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
          <div className="profile-avatar-editor__actions">
            <button type="button" onClick={clearDraft}><X aria-hidden="true" />取消</button>
            <button type="button" className="is-primary" onClick={() => void apply()}><Check aria-hidden="true" />使用此头像</button>
          </div>
        </div>
      ) : null}

      {error ? <p className="profile-avatar-editor__feedback is-error" role="alert">{error}</p> : null}
      {message ? <p className="profile-avatar-editor__feedback" role="status">{message}</p> : null}
    </section>
  )
}
