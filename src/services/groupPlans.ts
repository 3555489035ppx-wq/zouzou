export type GroupPlanType = 'travel' | 'weekend' | 'date' | 'dining'
export type GroupPlanStatus = 'draft' | 'collecting_preferences' | 'voting' | 'decided' | 'planned' | 'ongoing' | 'completed' | 'cancelled'
export type PollStatus = 'draft' | 'open' | 'closed' | 'resolved' | 'cancelled'
export type PollType = 'single' | 'multiple' | 'time'
export type ParticipantRole = 'owner' | 'member'
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'left'

export type UserPlanOrigin = {
  latitude: number
  longitude: number
  accuracy?: number
}

export type PlanParticipant = {
  id: string
  planId: string
  userId?: string
  displayName: string
  avatar?: string
  activityPreferences?: string[]
  foodPreferences?: string[]
  note?: string
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
    longitude?: number
    latitude?: number
    coordinateSystem?: 'wgs84' | 'gcj02' | 'bd09ll'
    durationMinutes?: number
    distanceKm?: number
    verified?: boolean
    reason?: string
    blockedReason?: string
  }
  order: number
  createdAt: string
}

export type Poll = {
  resolvedRevision?: number
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
  lng?: number
  lat?: number
  longitude?: number
  latitude?: number
  coordinates?: [number, number]
  coordinateSystem?: 'wgs84' | 'gcj02' | 'bd09ll'
  mapStatus?: 'resolved' | 'unresolved'
  searchKeyword?: string
  coordinateSource?: string
  verified?: boolean
  x?: number
  z?: number
}

export type GroupJourney = {
  planId?: string
  revision?: number
  id: string
  title: string
  estimatedCost: number
  estimatedDistance: string
  stops: GroupJourneyStop[]
}

export type GroupPlan = {
  candidates?: PlanCandidate[]
  baseDietary?: import('./trip/dietary').DietaryProfile
  tripOptions?: import('./trip/planner').GeneratedPlan[]
  trip?: import('./trip/planner').GeneratedPlan
  revision?: number
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
  direct?: boolean
  trip?: import('./trip/planner').GeneratedPlan
  tripOptions?: import('./trip/planner').GeneratedPlan[]
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
  origin?: UserPlanOrigin
  owner: { userId?: string; displayName: string; avatar?: string }
}

export type GroupPlanJoinInput = {
  userId?: string
  displayName: string
  avatar?: string
  activityPreferences?: string[]
  foodPreferences?: string[]
  note?: string
}

export type GroupPlanEvent = { type: 'plan.updated'; plan: GroupPlan }
