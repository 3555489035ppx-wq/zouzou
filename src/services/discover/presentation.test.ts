import { describe, it, expect } from 'vitest'
import { experienceTags } from './presentation'
describe('discovery experience labels', () => {
  it('keeps morning routes out of the night scene despite inherited labels', () => {
    expect(experienceTags({title:'武汉老城早走', category:'约会', tags:['夜景路线','夜景','早餐','城市漫步']})).toEqual(['早餐','City Walk','约会'])
  })
  it('deduplicates equivalent labels and keeps meaningful content before broad categories', () => {
    expect(experienceTags({title:'街区行程', category:'周末', tags:['城市精选','周末','逛吃','本地美食','慢慢走']})).toEqual(['美食','松弛','周末'])
  })
  it('retains supplied place themes without inventing experiences', () => {
    expect(experienceTags({title:'园林散步',category:'旅行',tags:['园林','人文']})).toEqual(['园林','人文'])
  })
})
