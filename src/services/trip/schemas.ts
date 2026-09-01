import { z } from 'zod'
import type { GeneratedPlan, MediaFact, PlannedStop, TripIntent, TripMedia, TripRequest, TripUnderstanding } from './planner'

const finiteNumber = z.number().refine(Number.isFinite, '必须是有限数字')
const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期必须使用 YYYY-MM-DD')
const timeValue = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '时间必须使用 HH:mm')
const textArray = z.array(z.string().trim().min(1).max(240)).max(40)

export const dateRangeSchema = z.object({
  start: dateValue,
  end: dateValue,
}).passthrough()

export const dietaryProfileSchema = z.object({
  avoidSpicy: z.boolean(),
  avoidSeafood: z.boolean(),
  vegetarian: z.boolean(),
  halal: z.boolean(),
  allergies: textArray,
  dislikes: textArray,
}).passthrough()

export const mediaFactSchema = z.object({
  mediaId: z.string().min(1).max(160),
  name: z.string().max(240),
  kind: z.enum(['ticket', 'hotel', 'reservation', 'chat', 'map', 'other']),
  rawText: z.string().max(4_000),
  facts: z.object({
    dates: dateRangeSchema.nullable(),
    times: z.array(timeValue).max(12),
    locations: textArray,
    arrivalLocation: z.string().max(240).nullable(),
    departureLocation: z.string().max(240).nullable(),
    hotel: z.string().max(240).nullable(),
    placeNames: textArray,
    budget: finiteNumber.nonnegative().nullable(),
    notes: textArray,
  }).passthrough(),
  confidence: finiteNumber.min(0).max(1),
  needsConfirmation: z.boolean(),
  warnings: textArray,
  provider: z.string().min(1).max(80),
}).passthrough()

export const tripIntentSchema = z.object({
  destination: z.string().min(1).max(120),
  dates: dateRangeSchema.nullable(),
  durationDays: z.number().int().min(1).max(60),
  nights: z.number().int().min(0).max(59),
  partySize: z.number().int().min(1).max(100),
  budget: finiteNumber.nonnegative().nullable(),
  budgetScope: z.string().max(240),
  pace: z.enum(['relaxed', 'balanced', 'full']),
  mustVisit: textArray,
  preferences: textArray,
  constraints: textArray,
  dietary: dietaryProfileSchema,
  conflicts: textArray,
  arrivalTime: timeValue.nullable(),
  arrivalLocation: z.string().max(240).nullable(),
  departureTime: timeValue.nullable(),
  departureLocation: z.string().max(240).nullable(),
  hotel: z.string().max(240).nullable(),
  missing: textArray,
}).passthrough()

export const tripUnderstandingSchema = z.object({
  intent: tripIntentSchema,
  evidence: z.array(z.string().max(500)).max(60),
  summary: z.string().max(2_000),
  mediaFacts: z.array(mediaFactSchema).max(6).optional(),
  guideContext: z.unknown().optional(),
  knowledge: z.unknown().optional(),
}).passthrough()

export const tripMediaSchema = z.object({
  id: z.string().min(1).max(160),
  src: z.string().max(12_000_000),
  name: z.string().max(240),
  category: z.string().max(80).optional(),
}).passthrough()

export const tripRequestSchema = z.object({
  text: z.string().trim().min(1).max(10_000),
  media: z.array(tripMediaSchema).max(20),
  mediaFacts: z.array(mediaFactSchema).max(6).optional(),
}).passthrough()

const openingSchema = z.object({
  from: timeValue,
  to: timeValue,
  label: z.string().max(240),
  closedWeekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
}).passthrough()

const placeSchema = z.object({
  id: z.string().min(1).max(200),
  time: timeValue,
  name: z.string().min(1).max(240),
  type: z.string().max(80),
  stay: z.string().max(80),
  budget: finiteNumber.nonnegative(),
  transport: z.string().max(240),
  note: z.string().max(2_000),
  x: finiteNumber,
  z: finiteNumber,
  lng: finiteNumber.min(-180).max(180),
  lat: finiteNumber.min(-90).max(90),
  area: z.string().max(120).optional(),
  inputName: z.string().max(240).optional(),
  canonicalName: z.string().max(240).optional(),
  address: z.string().max(300).optional(),
  poiId: z.string().max(200).optional(),
  amapPoiId: z.string().max(200).optional(),
  district: z.string().max(120).optional(),
  adcode: z.string().max(40).optional(),
  citycode: z.string().max(40).optional(),
  poiType: z.string().max(120).optional(),
  tel: z.string().max(80).optional(),
  verifiedAt: finiteNumber.optional(),
  resolutionStatus: z.enum(['verified', 'ambiguous', 'not_found', 'error']).optional(),
  coordinateSystem: z.enum(['wgs84', 'gcj02']).optional(),
  mapStatus: z.enum(['resolved', 'unresolved']).optional(),
  searchKeyword: z.string().max(240).optional(),
  coordinateSource: z.string().max(240).optional(),
  verified: z.boolean().optional(),
}).passthrough()

export const plannedStopSchema = placeSchema.extend({
  durationMinutes: z.number().int().min(1).max(1_440),
  travelFromPreviousMinutes: z.number().int().min(0).max(1_440),
  zone: z.string().max(120),
  mode: z.enum(['walk', 'metro', 'taxi', 'train']),
  opening: openingSchema.optional(),
  fixed: z.boolean().optional(),
  hotelOptionId: z.string().max(200).optional(),
  dietaryTags: z.array(z.string().max(80)).max(20).optional(),
  factState: z.enum(['verified', 'estimated']),
  factSource: z.string().max(300),
}).passthrough()

const validationReportSchema = z.object({
  passed: z.boolean(),
  score: finiteNumber.min(0).max(100),
  checks: z.array(z.object({ name: z.string(), passed: z.boolean(), detail: z.string() }).passthrough()).max(40),
  issues: z.array(z.string()).max(40),
}).passthrough()

const knowledgeSchema = z.object({
  city: z.string().min(1),
  status: z.enum(['curated', 'fallback']),
  updatedAt: z.string(),
  intro: z.string(),
  items: z.array(z.unknown()),
  hotelOptions: z.array(z.unknown()),
  sources: z.array(z.unknown()),
}).passthrough()

export const generatedPlanSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  budget: finiteNumber.nonnegative(),
  places: z.number().int().min(0),
  walking: z.string(),
  pace: z.string(),
  difference: z.string(),
  city: z.string().min(1),
  dates: dateRangeSchema.nullable(),
  nights: z.number().int().min(0),
  partySize: z.number().int().min(1),
  budgetLimit: finiteNumber.nonnegative().nullable(),
  days: z.record(z.string(), z.array(plannedStopSchema)),
  budgetBreakdown: z.object({
    lodging: finiteNumber.nonnegative(),
    meals: finiteNumber.nonnegative(),
    transport: finiteNumber.nonnegative(),
    tickets: finiteNumber.nonnegative(),
    coffee: finiteNumber.nonnegative(),
    buffer: finiteNumber.nonnegative(),
    total: finiteNumber.nonnegative(),
  }).passthrough(),
  validation: validationReportSchema,
  intent: tripIntentSchema,
  evidence: z.array(z.string()).max(60),
  guideContext: z.unknown().optional(),
  knowledge: knowledgeSchema,
  hotelRecommendations: z.array(z.unknown()).optional(),
  selectedHotelId: z.string().optional(),
}).passthrough()

function withLegacyUnderstandingDefaults(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const root = value as Record<string, unknown>
  if (!root.intent || typeof root.intent !== 'object' || Array.isArray(root.intent)) return value
  const intent = root.intent as Record<string, unknown>
  return {
    ...root,
    intent: {
      ...intent,
      dietary: intent.dietary ?? { avoidSpicy: false, avoidSeafood: false, vegetarian: false, halal: false, allergies: [], dislikes: [] },
      conflicts: intent.conflicts ?? [],
    },
  }
}

export function parseTripUnderstanding(value: unknown): TripUnderstanding | null {
  const result = tripUnderstandingSchema.safeParse(withLegacyUnderstandingDefaults(value))
  return result.success ? value as TripUnderstanding : null
}

export function parseTripMediaList(value: unknown): TripMedia[] {
  const result = z.array(tripMediaSchema).max(20).safeParse(value)
  return result.success ? result.data as TripMedia[] : []
}

export function parseTripRequest(value: unknown): TripRequest | null {
  const result = tripRequestSchema.safeParse(value)
  return result.success ? result.data as TripRequest : null
}

export function parseGeneratedPlans(value: unknown): GeneratedPlan[] | null {
  const result = z.array(generatedPlanSchema).max(3).safeParse(value)
  return result.success ? result.data as GeneratedPlan[] : null
}

export function isValidMediaFact(value: unknown): value is MediaFact {
  return mediaFactSchema.safeParse(value).success
}

export function isValidPlannedStop(value: unknown): value is PlannedStop {
  return plannedStopSchema.safeParse(value).success
}
