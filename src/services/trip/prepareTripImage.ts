import type { TripMedia } from './planner'

/** Decode on the device before storing or sending the image; preserve readable text. */
export async function prepareTripImage(file: File): Promise<TripMedia> {
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|heic|heif)$/i.test(file.name)) throw new Error('请选择相册中的图片。')
  if (file.size > 30 * 1024 * 1024) throw new Error('这张图片过大，请裁剪后再添加。')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode().catch(() => { throw new Error('无法读取这张图片，请在相册中另存为 JPEG 或截屏后添加。') })
    const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('图片处理失败，请重新选择。')
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(img, 0, 0, canvas.width, canvas.height)
    let src = canvas.toDataURL('image/jpeg', .9)
    if (src.length > 4_000_000) src = canvas.toDataURL('image/jpeg', .72)
    if (src.length > 4_000_000) throw new Error('图片压缩后仍过大，请裁剪需要识别的部分。')
    return { id: crypto.randomUUID(), name: file.name, src }
  } finally { URL.revokeObjectURL(url) }
}
