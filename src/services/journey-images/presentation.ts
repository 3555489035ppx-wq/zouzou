const userFacingBlockedPathPattern = /\/social-research\/|\/locations\/(?:harbin-cover-(?:01|03)|dalian-cover-(?:01|03|04)|urumqi-cover-(?:01|02|03)|xishuangbanna-cover-(?:01|02)|yanji-cover-(?:02|03))\.(?:jpe?g|png|webp)|\/cities\/dalian-xinghai-bay\.jpg|baidu-(?:5e3797c0|33193410|886f943d|50babbe8|305ae308|f7cef153|5742fc94)/i

import reviewedExclusions from '../../../data/journey-images/cover-exclusions-2026-09-14.json'
import visualIdentities from '../../../data/journey-images/cover-visual-identities.json'

export const coverVisualIdentity = (src: string) => (visualIdentities as Record<string, string>)[src] ?? src

const curatedCoverExclusions = new Set([
  ...reviewedExclusions.map(image => image.src),
  '/assets/journey-images/baidu/baidu-90f2dad9-5.png', // 苏州艺圃旧图带有豆包AI生成字样
  '/assets/journey-images/baidu/baidu-e8d69b83-8.jpg', // 呼和浩特席力图召旧图有人物入镜
  '/assets/journey-images/baidu/baidu-ff6e33e5-12.webp', // 呼和浩特老城旧图有人物沿岸入镜
  '/assets/journey-images/baidu/baidu-e43d8b4a-5.jpg', // 长春粘豆包旧图切面观感不佳
  '/assets/locations/harbin-cover-02.jpg', // 哈尔滨圣索菲亚旧图为局部门体，且与城市底图重复
  '/assets/locations/guiyang-cover-01.jpg', // 贵阳甲秀楼旧图与城市底图重复
  '/assets/locations/guiyang-cover-02.jpg', // 贵阳甲秀楼旧图有人物入镜
  '/assets/cities/chengdu-anshun-bridge.jpg',
  '/assets/cities/chongqing-hongyadong.jpg',
  '/assets/cities/daocheng-yading.jpg',
  '/assets/cities/jiuzhaigou-valley.jpg',
  '/assets/cities/lijiang-old-town.jpg',
  '/assets/cities/kashgar-market.jpg',
  '/assets/cities/lhasa-barkhor.jpg',
  '/assets/locations/beijing-cover-01.jpg',
  '/assets/locations/changsha-cover-01.jpg',
  '/assets/locations/hangzhou-cover-01.jpg',
  '/assets/locations/hangzhou-cover-02.jpg',
  '/assets/locations/hangzhou-cover-03.jpg',
  '/assets/locations/shenyang-cover-01.jpg',
  '/assets/locations/shenyang-cover-02.jpg',
  '/assets/locations/sanya-wuzhizhou.jpg',
  '/assets/locations/taizhou-cover-01.jpg',
  '/assets/locations/taizhou-cover-03.jpg',
  '/assets/locations/zhangjiajie-cover-03.png',
  '/assets/journey-images/baidu/baidu-48e024af-9.webp',
  '/assets/journey-images/baidu/baidu-bf9e8640-15.webp',
  '/assets/journey-images/baidu/baidu-33502bdc-7.jpg',
  '/assets/journey-images/baidu/baidu-9974d608-1.webp',
  '/assets/journey-images/baidu/baidu-4966c84-1.jpg',
  '/assets/journey-images/baidu/baidu-c26812eb-1.jpg',
  '/assets/journey-images/baidu/baidu-435a1331-6.jpg',
  '/assets/journey-images/baidu/baidu-6256aa7e-7.png',
  '/assets/journey-images/baidu/baidu-800abf6e-8.png',
  '/assets/journey-images/baidu/baidu-de62bb11-5.png',
  '/assets/journey-images/baidu/baidu-9884fc93-20.webp',
  '/assets/journey-images/baidu/baidu-5bea0d72-13.jpg',
  '/assets/journey-images/baidu/baidu-3ea76b06-3.jpg',
  '/assets/journey-images/baidu/baidu-d63e3d8d-12.jpg',
  '/assets/journey-images/baidu/baidu-b9531692-22.png',
  '/assets/journey-images/baidu/baidu-988b0a1f-3.png',
  '/assets/journey-images/baidu/baidu-991403ef-5.jpg',
  '/assets/journey-images/baidu/baidu-7c86482c-14.jpg',
  '/assets/journey-images/baidu/baidu-f4a7ca53-12.jpg',
  '/assets/journey-images/baidu/baidu-a89ab43e-12.png',
  '/assets/journey-images/baidu/baidu-cace0eff-38.jpg',
  '/assets/journey-images/baidu/baidu-f37d8e15-2.jpg',
  '/assets/journey-images/baidu/baidu-17d653cb-21.jpg',
  '/assets/journey-images/baidu/baidu-9fdddfdf-42.jpg',
  '/assets/journey-images/baidu/baidu-e278d47b-19.webp',
  '/assets/journey-images/baidu/baidu-d9a0f358-4.jpg',
  '/assets/journey-images/baidu/baidu-d296203a-21.webp',
  '/assets/journey-images/baidu/baidu-4cacdd24-13.png',
  '/assets/journey-images/baidu/baidu-6304e984-6.webp',
  '/assets/journey-images/baidu/baidu-85041926-7.jpg',
  '/assets/journey-images/baidu/baidu-43a1dac8-8.jpg',
  '/assets/journey-images/baidu/baidu-86f3b3ec-10.webp',
  '/assets/journey-images/baidu/baidu-9100dab6-1.jpg',
  '/assets/journey-images/baidu/baidu-6829ea0d-12.jpg',
  '/assets/journey-images/baidu/baidu-9832dd8e-15.jpg',
  '/assets/journey-images/baidu/baidu-252b9f3-13.jpg',
  '/assets/journey-images/baidu/baidu-30166ced-4.jpg',
  '/assets/journey-images/baidu/baidu-a7730705-3.jpg',
  '/assets/journey-images/baidu/baidu-5ae15d93-2.webp',
  '/assets/journey-images/baidu/baidu-16375663-6.jpg',
  '/assets/journey-images/baidu/baidu-74b55e0-3.jpg',
  '/assets/journey-images/baidu/baidu-7bf1a6e9-1.jpg',
  '/assets/journey-images/baidu/baidu-e3a42e93-9.webp',
  '/assets/journey-images/baidu/baidu-18dfacd4-2.jpg',
  '/assets/journey-images/baidu/baidu-4932af5b-3.jpg',
  '/assets/journey-images/baidu/baidu-8d6977db-8.jpg',
  '/assets/journey-images/baidu/baidu-9fd17426-1.png',
  '/assets/journey-images/baidu/baidu-73cb3f3d-12.jpg',
  '/assets/journey-images/baidu/baidu-4ed7b480-3.png',
  '/assets/journey-images/baidu/baidu-f8016455-14.jpg',
  '/assets/journey-images/baidu/baidu-e19ace0e-4.png',
  '/assets/journey-images/baidu/baidu-86309302-0.webp',
  '/assets/journey-images/baidu/baidu-5540675c-3.png',
  '/assets/journey-images/baidu/baidu-a24d60bd-12.webp',
  '/assets/journey-images/baidu/baidu-61afb9ff-2.jpg',
  '/assets/journey-images/baidu/baidu-9cc361f-2.webp',
  '/assets/journey-images/baidu/baidu-481fcf1d-3.jpg',
  '/assets/journey-images/baidu/baidu-624ca997-5.jpg',
  '/assets/journey-images/baidu/baidu-81a8bb02-3.jpg',
  '/assets/journey-images/baidu/baidu-c77bb446-5.png',
  '/assets/journey-images/baidu/baidu-e81f3e37-11.jpg',
  '/assets/journey-images/baidu/baidu-2e4a7ce2-3.jpg',
  '/assets/journey-images/baidu/baidu-1fade389-8.jpg',
  '/assets/journey-images/baidu/baidu-97a2d7e8-5.jpg',
  '/assets/journey-images/baidu/baidu-5a82003e-1.jpg',
  '/assets/journey-images/baidu/baidu-6ac3bca0-1.png',
  '/assets/journey-images/baidu/baidu-f9cc9062-0.png',
  '/assets/journey-images/baidu/baidu-8d2dbebc-7.png',
  '/assets/journey-images/baidu/baidu-4e20232b-0.webp',
  '/assets/journey-images/baidu/baidu-378e119b-8.jpg',
  '/assets/journey-images/baidu/baidu-5aaadd1-6.jpg',
  '/assets/journey-images/baidu/baidu-2e38f67c-4.jpg',
  '/assets/journey-images/baidu/baidu-1c63ba1f-2.jpg',
  '/assets/journey-images/baidu/baidu-b4285f86-4.jpg',
  '/assets/journey-images/baidu/baidu-e2203aa7-17.jpg',
  '/assets/journey-images/baidu/baidu-65f8fa6c-2.png',
  '/assets/journey-images/baidu/baidu-b2cd08d5-1.png',
  '/assets/journey-images/baidu/baidu-6ef164b9-0.png',
  '/assets/journey-images/baidu/baidu-40ef1d31-1.jpg',
  '/assets/journey-images/baidu/baidu-d8ee26ab-0.webp',
  '/assets/journey-images/baidu/baidu-60bff6e0-9.jpg',
  '/assets/journey-images/baidu/baidu-36fc35cf-3.jpg',
  '/assets/journey-images/baidu/baidu-3f6688f5-1.jpg',
  '/assets/journey-images/baidu/baidu-41cdb628-12.jpg',
  '/assets/journey-images/baidu/baidu-67e9a515-6.jpg',
  '/assets/journey-images/baidu/baidu-e327c902-1.jpg',
  '/assets/journey-images/baidu/baidu-64983aa3-1.jpg',
  '/assets/journey-images/baidu/baidu-8879d2a7-8.jpg',
  '/assets/journey-images/baidu/baidu-5f70056e-9.jpg',
  '/assets/journey-images/baidu/baidu-e8c0daac-1.jpg',
  '/assets/journey-images/baidu/baidu-b4c34c8e-6.png',
  '/assets/journey-images/baidu/baidu-c449748d-3.jpg',
  '/assets/journey-images/baidu/baidu-e6ea543f-0.png',
  '/assets/journey-images/baidu/baidu-7cefde5f-2.jpg',
  '/assets/journey-images/baidu/baidu-7dde1e01-0.jpg',
  '/assets/journey-images/baidu/baidu-72a8931a-3.jpg',
  '/assets/journey-images/baidu/baidu-c0dda1a0-2.webp',
  '/assets/journey-images/baidu/baidu-7bc02849-0.jpg',
  '/assets/journey-images/baidu/baidu-1ef2af6d-9.jpg',
  '/assets/journey-images/baidu/baidu-55e0ca9f-1.jpg',
  '/assets/journey-images/baidu/baidu-67126cc9-1.jpg',
  '/assets/journey-images/baidu/baidu-48c580b9-7.png',
  '/assets/journey-images/baidu/baidu-81c90da-1.png',
  '/assets/journey-images/baidu/baidu-dae62d27-5.jpg',
  '/assets/journey-images/baidu/baidu-bac91851-2.jpg',
  '/assets/journey-images/baidu/baidu-a793caf9-1.jpg',
  '/assets/journey-images/baidu/baidu-377d64da-2.jpg',
  '/assets/journey-images/baidu/baidu-3bf0c86a-2.webp',
  '/assets/journey-images/baidu/baidu-d9214eeb-0.jpg',
  '/assets/journey-images/baidu/baidu-b8b86111-1.jpg',
  '/assets/journey-images/baidu/baidu-a765bedb-5.png',
  '/assets/journey-images/baidu/baidu-434188eb-3.jpg',
  '/assets/journey-images/baidu/baidu-7185256c-12.webp',
  '/assets/journey-images/baidu/baidu-515068ca-10.jpg',
  '/assets/journey-images/baidu/baidu-8035df71-0.webp', // Changsha tea-shop frame with people and store signage
  '/assets/journey-images/baidu/baidu-d96731a2-3.webp', // shared market fallback; each route needs its own subject cover
  '/assets/journey-images/baidu/baidu-1493c077-5.jpg', // Kashgar sheep close-up with people in the background
  '/assets/journey-images/baidu/baidu-6d05c0d-8.jpg', // Kashgar sheep close-up with people in the background
  '/assets/journey-images/baidu/baidu-f05c1aa6-1.webp', // Kashgar cattle market with people and a visible overlay
  '/assets/journey-images/baidu/baidu-58be3dfb-7.webp', // Kashgar cattle market with people
  '/assets/journey-images/baidu/baidu-fa9d78d0-14.jpg', // Kashgar food/hands instead of the bazaar subject
  '/assets/journey-images/baidu/baidu-f0d68248-16.jpg', // Kashgar sign and person in frame
  '/assets/journey-images/baidu/baidu-31ee27ec-18.webp', // Kashgar horse scene with person and watermark
  '/assets/journey-images/baidu/baidu-2a601ff3-20.jpg', // Kashgar livestock scene with people
  '/assets/journey-images/baidu/baidu-5f2eea5f-22.jpg', // Kashgar livestock scene with people/signage
  '/assets/journey-images/baidu/baidu-4cacdd24-23.png', // Kashgar mosque, not the livestock bazaar
  '/assets/journey-images/baidu/baidu-e67e8ddf-3.jpg', // Lhasa mountain portrait
  '/assets/journey-images/baidu/baidu-2873dced-0.jpg', // Lhasa plaza with people
  '/assets/journey-images/baidu/baidu-874e9cab-1.jpg', // Lhasa temple with crowd
  '/assets/journey-images/baidu/baidu-f4d80ce2-5.jpg', // Lhasa portrait
  '/assets/journey-images/baidu/baidu-10ccdcd8-7.jpg', // Lhasa courtyard with people
  '/assets/journey-images/baidu/baidu-a36792f6-15.webp', // Lhasa street crowd and overlay
  '/assets/journey-images/baidu/baidu-e66272f6-16.jpg', // Lhasa street crowd
  '/assets/journey-images/baidu/baidu-1613b7c1-17.jpg', // Lhasa street crowd and handwriting overlay
  '/assets/journey-images/baidu/baidu-27e772ec-18.jpg', // Lhasa temple crowd and overlay
  '/assets/journey-images/baidu/baidu-5547d7c7-19.webp', // Lhasa prayer-wheel path with people
  '/assets/journey-images/baidu/baidu-5b5de63a-20.jpg', // Lhasa market street with people
  '/assets/journey-images/baidu/baidu-7f8c329d-21.jpg', // Lhasa market street with people
  '/assets/journey-images/baidu/baidu-94b95d6a-23.jpg', // Lhasa night street with people
  '/assets/journey-images/baidu/baidu-b6a2b32f-24.webp', // Lhasa street crowd and source watermark
  '/assets/journey-images/baidu/baidu-9100dab6-25.jpg', // Lhasa street/people image
  '/assets/journey-images/baidu/baidu-7e1b6f16-26.jpg', // Lhasa street crowd
  '/assets/journey-images/baidu/baidu-6304e984-27.webp', // Lhasa street crowd
  '/assets/journey-images/baidu/baidu-5d0cfded-18.webp', // Tengchong shadow-puppet stage with a visible hand and audience
  '/assets/journey-images/baidu/baidu-fcab0c24-8.jpg', // Tengchong shadow-puppet image with large promotional text
  '/assets/journey-images/baidu/baidu-10e27b2a-17.jpg', // Tengchong shadow-puppet image with a performer and watermark
  '/assets/journey-images/baidu/baidu-f6ea8495-22.webp', // Tengchong shadow-puppet workshop with hands in frame
  '/assets/journey-images/baidu/baidu-b87a105-9.webp', // Tengchong shadow-puppet stage with heavy black framing
  '/assets/journey-images/baidu/baidu-657daace-0.webp', // Tengchong shadow-puppet stage with heavy black framing
  '/assets/journey-images/baidu/baidu-4d79c09a-1.jpg', // Tengchong shadow-puppet image with dark side framing
  '/assets/journey-images/baidu/baidu-4e0522dc-19.webp', // Tengchong shadow-puppet stage with signage and framing
  '/assets/journey-images/baidu/baidu-a7b84e63-3.jpg', // Tengchong shadow-puppet workshop with several people
  '/assets/journey-images/baidu/baidu-f3e7b6a7-2.webp', // Tengchong shadow-puppet image with graphic framing and text
  '/assets/journey-images/baidu/baidu-d3fecac8-4.webp', // Tengchong shadow-puppet image with source watermark
  '/assets/journey-images/baidu/baidu-6b4fe16d-5.jpg', // Tengchong shadow-puppet image with source watermark
  '/assets/journey-images/baidu/baidu-a6a1ae9d-6.webp', // Tengchong shadow-puppet image with a decorative frame and text
  '/assets/journey-images/baidu/baidu-75a65e05-7.jpg', // Tengchong shadow-puppet image with performers in frame
  '/assets/journey-images/baidu/baidu-db1a9a22-10.jpg', // Tengchong shadow-puppet image with source watermark
  '/assets/journey-images/baidu/baidu-6963fe54-11.webp', // Tengchong shadow-puppet image with heavy black framing
  '/assets/journey-images/baidu/baidu-d8f7d5b5-12.jpg', // Tengchong shadow-puppet image with a performer in frame
  '/assets/journey-images/baidu/baidu-bf142ad5-13.jpg', // Tengchong shadow-puppet image with source watermark
  '/assets/journey-images/baidu/baidu-ed3e0f22-14.png', // Tengchong shadow-puppet image with source watermark
  '/assets/journey-images/baidu/baidu-d9da3cdf-15.jpg', // Tengchong shadow-puppet image with heavy black framing
  '/assets/journey-images/baidu/baidu-93b5b18e-16.webp', // Tengchong shadow-puppet image with source watermark
  '/assets/journey-images/baidu/baidu-d3d04877-21.jpg', // Tengchong shadow-puppet image with source watermark
  '/assets/journey-images/baidu/baidu-ce1e8ae1-24.jpg', // Tengchong shadow-puppet image with graphic text
  '/assets/journey-images/baidu/baidu-b3e59f1e-20.jpg', // Tengchong shadow-puppet image with an audience in frame
])

export const isUserFacingCover = (path: string | undefined) => {
  if (!path) return false
  const normalized = path.replace(/\\/g, '/')
  return !userFacingBlockedPathPattern.test(normalized) && !curatedCoverExclusions.has(normalized)
}

export const normalizePlaceName = (value: string) => value
  .toLowerCase()
  .replace(/[（）()\s·—-]/g, '')
  .replace(/风景名胜区|国家旅游度假区|国家地质公园|国家森林公园|景区|公园$/, '')

export const placesMatch = (left: string | undefined, right: string) => {
  if (!left) return false
  const rawLeft = left.toLowerCase().replace(/\s+/g, '')
  const rawRight = right.toLowerCase().replace(/\s+/g, '')
  if (rawLeft.length >= 2 && rawLeft === rawRight) return true
  const normalizedLeft = normalizePlaceName(left)
  const normalizedRight = normalizePlaceName(right)
  return normalizedLeft.length >= 2 && normalizedRight.length >= 2 && (
    normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)
  )
}
