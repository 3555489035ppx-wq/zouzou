import { describe, expect, it } from 'vitest'
import { emptyDietaryProfile, extractDietaryProfile, foodCompatibilityIssues } from './dietary'

describe('dietary profile matching', () => {
  it('extracts explicit spicy, seafood, allergy and dislike constraints', () => {
    const profile = extractDietaryProfile('不吃辣，不能吃海鲜，花生过敏，也不喜欢香菜。')

    expect(profile).toMatchObject({ avoidSpicy: true, avoidSeafood: true, vegetarian: false, halal: false })
    expect(profile.allergies).toContain('花生')
    expect(profile.dislikes).toContain('香菜')
  })

  it('flags coarse food risks while leaving compatible food available', () => {
    const profile = extractDietaryProfile('不吃辣，不能吃海鲜。')

    expect(foodCompatibilityIssues('口味虾', profile, ['spicy', 'seafood'])).toEqual(expect.arrayContaining(['含辣或重口味线索', '含海鲜或水产线索']))
    expect(foodCompatibilityIssues('葱包桧', profile)).toEqual([])
    expect(foodCompatibilityIssues('本帮菜午餐', { ...emptyDietaryProfile(), vegetarian: true }, ['meat'])).toContain('含肉类线索')
  })
})
