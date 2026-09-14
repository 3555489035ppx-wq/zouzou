import { expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MediaAsset } from './MediaAsset'

it('renders the requested route photo instead of substituting the first city photo', () => {
  const src = '/assets/journey-images/baidu/a-selected-route-photo.jpg'
  const html = renderToStaticMarkup(createElement(MediaAsset, {city:'西安',src,alt:'大明宫'}))
  expect(html).toContain(`src="${src}"`)
  expect(html).toContain('alt="大明宫"')
  expect(html).not.toContain('同城参考图')
})

it('keeps reviewed social attribution on the actual image element', () => {
  const html = renderToStaticMarkup(createElement(MediaAsset, {city:'济南',src:'/assets/authorized-social/69d1269f0000000023007533_1.jpg'}))
  expect(html).toContain('data-source="https://www.xiaohongshu.com/explore/69d1269f0000000023007533"')
  expect(html).toContain('大明湖')
})
