import { describe, expect, it } from 'vitest'
import { emptyDietaryProfile, foodCompatibilityIssues } from './dietary'

describe('allergy terms are literal data', () => {
  it('does not compile malformed regex-like allergy terms', () => {
    const profile = { ...emptyDietaryProfile(), allergies: ['[', '(a+)+$', ''] }
    expect(() => foodCompatibilityIssues('普通米饭', profile)).not.toThrow()
    expect(foodCompatibilityIssues('普通米饭', profile)).toEqual([])
  })
  it('matches a literal term containing regex punctuation', () => {
    const profile = { ...emptyDietaryProfile(), allergies: ['花生(碎)'] }
    expect(foodCompatibilityIssues('含花生(碎)', profile)).toContain('命中过敏原：花生(碎)')
  })
  it('preserves common seafood aliases', () => {
    const profile = { ...emptyDietaryProfile(), allergies: ['海鲜'] }
    expect(foodCompatibilityIssues('虾仁面', profile)).toContain('命中过敏原：海鲜')
  })
})
