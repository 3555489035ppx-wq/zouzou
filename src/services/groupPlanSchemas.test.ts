import { describe, expect, it } from 'vitest'
import { parseGroupPlan, parseGroupPlanEvent } from './groupPlanSchemas'

describe('group plan runtime boundary', () => {
  it('does not accept a partial or malformed server response', () => {
    expect(parseGroupPlan({ id: 'plan-1', status: 'planned' })).toBeNull()
    expect(parseGroupPlanEvent({ type: 'plan.updated', plan: { id: 'plan-1' } })).toBeNull()
  })
})
