export type GroupPlanType = 'weekend' | 'date' | 'dining'
export type GroupPlanStatus = 'draft' | 'collecting_preferences' | 'voting' | 'decided' | 'planned' | 'ongoing' | 'completed' | 'cancelled'
export type PollStatus = 'draft' | 'open' | 'closed' | 'resolved' | 'cancelled'
export type PollType = 'single' | 'multiple' | 'time'
export type ParticipantRole = 'owner' | 'member'
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'left'

export type PlanParticipant = {
  id: string
  planId: string
  userId?: string
  displayName: string
  avatar?: string
  role: ParticipantRole
  inviteStatus: InviteStatus
  joinedAt?: string
}

export type PlanCandidate = {
  id: string
  type: 'restaurant' | 'place' | 'activity' | 'time' | 'custom'
  title: string
  subtitle?: string
  image?: string
  metadata: {
    area?: string
    price?: number
    opening?: string
    capacity?: number
    tags?: string[]
    lng?: number
    lat?: number
    durationMinutes?: number
    verified?: boolean
    reason?: string
  }
  order: number
  createdAt: string
}

export type Poll = {
  id: string
  planId: string
  title: string
  type: PollType
  status: PollStatus
  allowChangeVote: boolean
  maxSelections: number
  deadline?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  winningOptionId?: string
  options: PlanCandidate[]
  votes: Record<string, string[]>
}

export type GroupJourneyStop = {
  id: string
  time: string
  name: string
  type: string
  stay: string
  budget: number
  transport: string
  note: string
  lng: number
  lat: number
  x: number
  z: number
}

export type GroupJourney = {
  id: string
  title: string
  estimatedCost: number
  estimatedDistance: string
  stops: GroupJourneyStop[]
}

export type GroupPlan = {
  id: string
  type: GroupPlanType
  ownerId: string
  title: string
  city: string
  date: string
  startTime: string
  endTime: string
  budget: number
  partySize: number
  interests: string[]
  avoidTags: string[]
  transportMode: string
  dateStage?: string
  indoorOutdoor?: string
  status: GroupPlanStatus
  selectedOptionId?: string
  inviteCode: string
  participants: PlanParticipant[]
  polls: Poll[]
  journey?: GroupJourney
  createdAt: string
  updatedAt: string
}

export type GroupPlanInput = {
  type: GroupPlanType
  city: string
  date: string
  startTime: string
  endTime: string
  budget: number
  partySize: number
  interests: string[]
  avoidTags: string[]
  transportMode: string
  dateStage?: string
  indoorOutdoor?: string
  deadline?: string
  owner: { userId?: string; displayName: string; avatar?: string }
}

export type GroupPlanEvent = { type: 'plan.updated'; plan: GroupPlan }
