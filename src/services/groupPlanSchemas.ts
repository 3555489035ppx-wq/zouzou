import { z } from 'zod'
import type { GroupPlan, GroupPlanEvent } from './groupPlans'

const text = z.string().max(500)
const id = z.string().min(1).max(200)

const participantSchema = z.object({
  id,
  planId: id,
  userId: z.string().max(160).optional(),
  displayName: z.string().min(1).max(80),
  avatar: z.string().max(2_000).optional(),
  role: z.enum(['owner', 'member']),
  inviteStatus: z.enum(['pending', 'accepted', 'declined', 'expired', 'left']),
  joinedAt: z.string().optional(),
}).passthrough()

const candidateSchema = z.object({
  id,
  type: z.enum(['restaurant', 'place', 'activity', 'time', 'custom']),
  title: z.string().min(1).max(160),
  subtitle: z.string().max(300).optional(),
  image: z.string().max(2_000).optional(),
  metadata: z.object({
    area: z.string().max(160).optional(),
    price: z.number().finite().nonnegative().optional(),
    opening: z.string().max(300).optional(),
    capacity: z.number().int().positive().optional(),
    tags: z.array(z.string().max(80)).max(30).optional(),
    lng: z.number().finite().min(-180).max(180).optional(),
    lat: z.number().finite().min(-90).max(90).optional(),
    durationMinutes: z.number().int().positive().max(1_440).optional(),
    verified: z.boolean().optional(),
    reason: z.string().max(1_000).optional(),
  }).passthrough(),
  order: z.number().int().min(0),
  createdAt: z.string(),
}).passthrough()

const pollSchema = z.object({
  id,
  planId: id,
  title: z.string().min(1).max(160),
  type: z.enum(['single', 'multiple', 'time']),
  status: z.enum(['draft', 'open', 'closed', 'resolved', 'cancelled']),
  allowChangeVote: z.boolean(),
  maxSelections: z.number().int().positive().max(8),
  deadline: z.string().optional(),
  createdBy: id,
  createdAt: z.string(),
  updatedAt: z.string(),
  winningOptionId: id.optional(),
  options: z.array(candidateSchema).min(2).max(8),
  votes: z.record(z.string(), z.array(id).max(8)),
}).passthrough()

const journeyStopSchema = z.object({
  id,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  name: z.string().min(1).max(160),
  type: z.string().max(80),
  stay: z.string().max(80),
  budget: z.number().finite().nonnegative(),
  transport: z.string().max(240),
  note: z.string().max(1_000),
  lng: z.number().finite().min(-180).max(180),
  lat: z.number().finite().min(-90).max(90),
  x: z.number().finite(),
  z: z.number().finite(),
}).passthrough()

const journeySchema = z.object({
  id,
  title: z.string().min(1).max(240),
  estimatedCost: z.number().finite().nonnegative(),
  estimatedDistance: z.string().max(120),
  stops: z.array(journeyStopSchema).min(1).max(20),
}).passthrough()

export const groupPlanSchema = z.object({
  id,
  type: z.enum(['weekend', 'date', 'dining']),
  ownerId: id,
  title: z.string().min(1).max(240),
  city: z.string().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  budget: z.number().finite().nonnegative(),
  partySize: z.number().int().min(1).max(100),
  interests: z.array(text).max(20),
  avoidTags: z.array(text).max(20),
  transportMode: z.string().min(1).max(40),
  dateStage: z.string().max(80).optional(),
  indoorOutdoor: z.string().max(80).optional(),
  status: z.enum(['draft', 'collecting_preferences', 'voting', 'decided', 'planned', 'ongoing', 'completed', 'cancelled']),
  selectedOptionId: id.optional(),
  inviteCode: z.string().min(6).max(40),
  participants: z.array(participantSchema).min(1).max(100),
  polls: z.array(pollSchema).max(20),
  journey: journeySchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough()

export const groupPlanEventSchema = z.object({
  type: z.literal('plan.updated'),
  plan: groupPlanSchema,
}).passthrough()

export function parseGroupPlan(value: unknown): GroupPlan | null {
  const result = groupPlanSchema.safeParse(value)
  return result.success ? result.data as GroupPlan : null
}

export function parseGroupPlanEvent(value: unknown): GroupPlanEvent | null {
  const result = groupPlanEventSchema.safeParse(value)
  return result.success ? result.data as GroupPlanEvent : null
}
