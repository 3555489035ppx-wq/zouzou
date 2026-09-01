import { describe, expect, it } from 'vitest'
import { transitionTripFlow } from './tripMachine'

describe('trip flow machine', () => {
  it('keeps the core create-to-complete journey explicit', () => {
    let state = transitionTripFlow('idle', 'START_DRAFT')
    state = transitionTripFlow(state, 'SUBMIT_DRAFT')
    state = transitionTripFlow(state, 'UNDERSTANDING_READY')
    state = transitionTripFlow(state, 'START_PLANNING')
    state = transitionTripFlow(state, 'PLANS_READY')
    state = transitionTripFlow(state, 'OPEN_DECISION')
    state = transitionTripFlow(state, 'CONFIRM_PLAN')
    state = transitionTripFlow(state, 'START_TRIP')
    state = transitionTripFlow(state, 'COMPLETE_TRIP')

    expect(state).toBe('completed')
  })

  it('routes failed async work through retry without losing the main state contract', () => {
    expect(transitionTripFlow('understanding', 'ERROR')).toBe('error')
    expect(transitionTripFlow('error', 'RETRY')).toBe('understanding')
    expect(transitionTripFlow('error', 'RESET')).toBe('idle')
  })

  it('supports an intentional new draft from an existing trip', () => {
    expect(transitionTripFlow('active', 'START_DRAFT')).toBe('drafting')
    expect(transitionTripFlow('completed', 'START_DRAFT')).toBe('drafting')
  })
})
