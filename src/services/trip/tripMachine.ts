import { createActor, createMachine } from 'xstate'

export const tripFlowStates = [
  'idle',
  'drafting',
  'understanding',
  'review',
  'planning',
  'plans',
  'deciding',
  'confirmed',
  'active',
  'completed',
  'error',
] as const

export type TripFlowState = typeof tripFlowStates[number]

export type TripFlowEvent =
  | 'START_DRAFT'
  | 'SUBMIT_DRAFT'
  | 'UNDERSTANDING_READY'
  | 'START_PLANNING'
  | 'PLANS_READY'
  | 'OPEN_DECISION'
  | 'CONFIRM_PLAN'
  | 'START_TRIP'
  | 'COMPLETE_TRIP'
  | 'ERROR'
  | 'RETRY'
  | 'RESET'

export const tripFlowMachine = createMachine({
  id: 'trip-flow',
  initial: 'idle',
  states: {
    idle: { on: { START_DRAFT: 'drafting' } },
    drafting: { on: { SUBMIT_DRAFT: 'understanding' } },
    understanding: { on: { UNDERSTANDING_READY: 'review' } },
    review: { on: { START_PLANNING: 'planning' } },
    planning: { on: { PLANS_READY: 'plans' } },
    plans: { on: { OPEN_DECISION: 'deciding', CONFIRM_PLAN: 'confirmed' } },
    deciding: { on: { CONFIRM_PLAN: 'confirmed' } },
    confirmed: { on: { START_TRIP: 'active' } },
    active: { on: { COMPLETE_TRIP: 'completed' } },
    completed: {},
    error: { on: { RETRY: 'understanding' } },
  },
  on: {
    START_DRAFT: '.drafting',
    UNDERSTANDING_READY: '.review',
    START_PLANNING: '.planning',
    PLANS_READY: '.plans',
    OPEN_DECISION: '.deciding',
    CONFIRM_PLAN: '.confirmed',
    START_TRIP: '.active',
    COMPLETE_TRIP: '.completed',
    ERROR: '.error',
    RETRY: '.understanding',
    RESET: '.idle',
  },
})

export function transitionTripFlow(state: TripFlowState, event: TripFlowEvent): TripFlowState {
  const actor = createActor(tripFlowMachine, {
    snapshot: tripFlowMachine.resolveState({ value: state }),
  }).start()
  actor.send({ type: event })
  const value = actor.getSnapshot().value
  actor.stop()
  return typeof value === 'string' && tripFlowStates.includes(value as TripFlowState)
    ? value as TripFlowState
    : state
}
