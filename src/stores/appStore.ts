import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { EXPENSE_CATEGORIES, PACKING_CATEGORIES, type Footprint, type PackingItem, type TripExpense } from '../services/trip/journeyTools'
import { transitionTripFlow, tripFlowStates, type TripFlowEvent, type TripFlowState } from '../services/trip/tripMachine'

type TripMode = 'none' | 'upcoming' | 'active' | 'completed'

export type PersonalTrip = { id: string; routeId: string; city: string; status: Exclude<TripMode, 'none'>; createdAt: string }
export type PublishedPost = { id: string; routeId: string; title: string; description: string; cover: string; publishedAt: string }
export type PostComment = { id: string; author: string; body: string; createdAt: string }

type AppState = {
  nickname: string
  avatar: string
  cover: string
  bio: string
  city: string
  /** 城市选择是用户偏好；已保存行程则固化自己的目的地。 */
  tripCity: string | null
  communityCity: string
  communityMapVisible: boolean
  reducedMotion: boolean
  tripMode: TripMode
  tripFlowState: TripFlowState
  activeRouteId: string | null
  publishedRouteIds: string[]
  personalTrips: PersonalTrip[]
  publishedPosts: PublishedPost[]
  commentsByPost: Record<string, PostComment[]>
  expenses: TripExpense[]
  packingItems: PackingItem[]
  footprints: Footprint[]
  onboardingCompleted: boolean
  archivedRouteIds: string[]
  friendInviteAccepted: boolean
  likedPosts: string[]
  savedPosts: string[]
  followedAuthors: string[]
  vote: string | null
  setProfile: (nickname: string, avatar: string, bio?: string) => void
  setCover: (cover: string) => void
  setCity: (city: string) => void
  setTripCity: (city: string | null) => void
  setCommunityCity: (city: string) => void
  setCommunityMapVisible: (value: boolean) => void
  setReducedMotion: (value: boolean) => void
  setTripMode: (mode: TripMode) => void
  transitionTripFlow: (event: TripFlowEvent) => void
  setOnboardingCompleted: (value: boolean) => void
  adoptRoute: (routeId: string, city: string) => void
  archiveRoute: (routeId: string) => void
  restoreRoute: (routeId: string) => void
  publishRoute: (post: Omit<PublishedPost, 'id' | 'publishedAt'>) => void
  deletePublishedPost: (id: string) => void
  addComment: (postId: string, body: string) => void
  addExpense: (expense: TripExpense) => void
  updateExpense: (id: string, patch: Partial<Omit<TripExpense, 'id' | 'journeyId'>>) => void
  deleteExpense: (id: string) => void
  seedPackingItems: (journeyId: string, items: PackingItem[]) => void
  addPackingItem: (item: PackingItem) => void
  togglePackingItem: (id: string) => void
  deletePackingItem: (id: string) => void
  addFootprint: (footprint: Footprint) => void
  updateFootprint: (id: string, patch: Partial<Omit<Footprint, 'id'>>) => void
  deleteFootprint: (id: string) => void
  setFriendInviteAccepted: (value: boolean) => void
  toggleLiked: (id: string) => void
  toggleSaved: (id: string) => void
  toggleFollow: (author: string) => void
  setVote: (id: string | null) => void
  resetDemo: () => void
}

const toggleInList = (items: string[], id: string) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]

const safeList = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string').slice(0, 200)
  : []

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object')
const safeExpenses = (value: unknown): TripExpense[] => Array.isArray(value)
  ? value.filter((item): item is TripExpense => isRecord(item) && typeof item.id === 'string' && typeof item.journeyId === 'string' && typeof item.amount === 'number' && Number.isFinite(item.amount) && typeof item.currency === 'string' && typeof item.category === 'string' && EXPENSE_CATEGORIES.includes(item.category as TripExpense['category']) && Array.isArray(item.participantIds) && typeof item.occurredAt === 'string' && typeof item.createdAt === 'string').slice(0, 200)
  : []
const safePackingItems = (value: unknown): PackingItem[] => Array.isArray(value)
  ? value.filter((item): item is PackingItem => isRecord(item) && typeof item.id === 'string' && typeof item.journeyId === 'string' && typeof item.label === 'string' && typeof item.category === 'string' && PACKING_CATEGORIES.includes(item.category as PackingItem['category']) && typeof item.checked === 'boolean' && typeof item.recommended === 'boolean' && typeof item.createdAt === 'string').slice(0, 300)
  : []
const safeFootprints = (value: unknown): Footprint[] => Array.isArray(value)
  ? value.filter((item): item is Footprint => isRecord(item) && typeof item.id === 'string' && typeof item.userId === 'string' && typeof item.city === 'string' && typeof item.country === 'string' && typeof item.visitedAt === 'string' && typeof item.createdAt === 'string' && (item.source === 'journey' || item.source === 'manual')).slice(0, 300)
  : []
const safeComments = (value: unknown): Record<string, PostComment[]> => {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).slice(0, 200).map(([postId, comments]) => [postId, Array.isArray(comments)
    ? comments.filter((item): item is PostComment => isRecord(item) && typeof item.id === 'string' && typeof item.author === 'string' && typeof item.body === 'string' && typeof item.createdAt === 'string').map((item) => ({ ...item, author: item.author.slice(0, 40), body: item.body.slice(0, 500) })).slice(0, 100)
    : []]))
}

const migratePersistedState = (value: unknown): Partial<AppState> => {
  const state = value && typeof value === 'object' ? value as Partial<AppState> : {}
  const modes: TripMode[] = ['none', 'upcoming', 'active', 'completed']
  return {
    nickname: typeof state.nickname === 'string' ? state.nickname.slice(0, 40) : '小鹏',
    avatar: typeof state.avatar === 'string' ? state.avatar : '/assets/date.jpg',
    cover: typeof state.cover === 'string' && state.cover.trim() ? state.cover : '/assets/shanghai-skyline.jpg',
    bio: typeof state.bio === 'string' ? state.bio.slice(0, 120) : '喜欢慢慢走，也喜欢把走过的路整理清楚。',
    city: typeof state.city === 'string' ? state.city : '上海',
    tripCity: typeof state.tripCity === 'string' ? state.tripCity : null,
    communityCity: typeof state.communityCity === 'string' ? state.communityCity : '上海',
    communityMapVisible: state.communityMapVisible !== false,
    reducedMotion: state.reducedMotion === true,
    tripMode: modes.includes(state.tripMode as TripMode) ? state.tripMode : 'active',
    tripFlowState: tripFlowStates.includes(state.tripFlowState as TripFlowState) ? state.tripFlowState as TripFlowState : 'idle',
    activeRouteId: typeof state.activeRouteId === 'string' ? state.activeRouteId : null,
    publishedRouteIds: safeList(state.publishedRouteIds),
    personalTrips: Array.isArray(state.personalTrips) ? state.personalTrips.filter((item): item is PersonalTrip => Boolean(item && typeof item.id === 'string' && typeof item.routeId === 'string' && typeof item.city === 'string' && modes.includes(item.status))).slice(0, 100) : [],
    publishedPosts: Array.isArray(state.publishedPosts) ? state.publishedPosts.filter((item): item is PublishedPost => Boolean(item && typeof item.id === 'string' && typeof item.routeId === 'string' && typeof item.title === 'string' && typeof item.description === 'string' && typeof item.cover === 'string' && typeof item.publishedAt === 'string')).slice(0, 100) : [],
    commentsByPost: safeComments(state.commentsByPost),
    expenses: safeExpenses(state.expenses),
    packingItems: safePackingItems(state.packingItems),
    footprints: safeFootprints(state.footprints),
    onboardingCompleted: state.onboardingCompleted === true,
    archivedRouteIds: safeList(state.archivedRouteIds),
    friendInviteAccepted: state.friendInviteAccepted === true,
    likedPosts: safeList(state.likedPosts),
    savedPosts: safeList(state.savedPosts),
    followedAuthors: safeList(state.followedAuthors),
    vote: typeof state.vote === 'string' ? state.vote : null,
  }
}

const persistedKeys = (state: AppState): Partial<AppState> => ({
  nickname: state.nickname,
  avatar: state.avatar,
  cover: state.cover,
  bio: state.bio,
  city: state.city,
  tripCity: state.tripCity,
  communityCity: state.communityCity,
  communityMapVisible: state.communityMapVisible,
  reducedMotion: state.reducedMotion,
  tripMode: state.tripMode,
  tripFlowState: state.tripFlowState,
  activeRouteId: state.activeRouteId,
  publishedRouteIds: state.publishedRouteIds,
  personalTrips: state.personalTrips,
  publishedPosts: state.publishedPosts,
  commentsByPost: state.commentsByPost,
  expenses: state.expenses,
  packingItems: state.packingItems,
  footprints: state.footprints,
  onboardingCompleted: state.onboardingCompleted,
  archivedRouteIds: state.archivedRouteIds,
  friendInviteAccepted: state.friendInviteAccepted,
  likedPosts: state.likedPosts,
  savedPosts: state.savedPosts,
  followedAuthors: state.followedAuthors,
  vote: state.vote,
})

export const useAppStore = create<AppState>()(persist((set) => ({
  nickname: '小鹏',
  avatar: '/assets/date.jpg',
  cover: '/assets/shanghai-skyline.jpg',
  bio: '喜欢慢慢走，也喜欢把走过的路整理清楚。',
  city: '上海',
  tripCity: null,
  communityCity: '上海',
  communityMapVisible: true,
  reducedMotion: false,
  // Keep deep-linked preview routes useful; the first-user onboarding path
  // explicitly switches this to `none` before entering Home.
  tripMode: 'active',
  tripFlowState: 'idle',
  activeRouteId: null,
  publishedRouteIds: [],
  personalTrips: [],
  publishedPosts: [],
  commentsByPost: {},
  expenses: [],
  packingItems: [],
  footprints: [],
  onboardingCompleted: false,
  archivedRouteIds: [],
  friendInviteAccepted: false,
  likedPosts: [],
  savedPosts: [],
  followedAuthors: [],
  vote: null,
  setProfile: (nickname, avatar, bio) => set((state) => ({ nickname: nickname.slice(0, 40), avatar, bio: bio === undefined ? state.bio : bio.slice(0, 120) })),
  setCover: (cover) => set({ cover }),
  // City is a product-wide preference. Home, community, trip copy and
  // recommendation data should never drift apart after a single selection.
  // City is a single product context. When a saved trip already exists, a
  // deliberate city switch also retargets that demo route so Home, Community
  // and Trips cannot drift into different destinations.
  setCity: (city) => set((state) => ({ city, communityCity: city, tripCity: state.tripCity ? city : state.tripCity })),
  setTripCity: (tripCity) => set({ tripCity }),
  setCommunityCity: (communityCity) => set({ communityCity }),
  setCommunityMapVisible: (communityMapVisible) => set({ communityMapVisible }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setTripMode: (tripMode) => set((state) => ({ tripMode, tripFlowState: tripMode === 'active' ? 'active' : tripMode === 'completed' ? 'completed' : state.tripFlowState, personalTrips: state.activeRouteId && tripMode !== 'none' ? state.personalTrips.map((trip) => trip.routeId === state.activeRouteId && trip.status !== 'completed' ? { ...trip, status: tripMode } : trip) : state.personalTrips })),
  transitionTripFlow: (event) => set((state) => {
    const next = transitionTripFlow(state.tripFlowState, event)
    return next === state.tripFlowState ? state : { tripFlowState: next, tripMode: next === 'active' ? 'active' : next === 'completed' ? 'completed' : state.tripMode }
  }),
  setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
  adoptRoute: (routeId, city) => set((state) => ({ activeRouteId: routeId, tripCity: city, city, communityCity: city, tripMode: 'upcoming', tripFlowState: 'confirmed', archivedRouteIds: state.archivedRouteIds.filter((id) => id !== routeId), personalTrips: state.personalTrips.some((trip) => trip.routeId === routeId && trip.status !== 'completed') ? state.personalTrips : [{ id: `trip-${Date.now()}`, routeId, city, status: 'upcoming', createdAt: new Date().toISOString() }, ...state.personalTrips] })),
  archiveRoute: (routeId) => set((state) => ({ archivedRouteIds: state.archivedRouteIds.includes(routeId) ? state.archivedRouteIds : [...state.archivedRouteIds, routeId] })),
  restoreRoute: (routeId) => set((state) => ({ archivedRouteIds: state.archivedRouteIds.filter((id) => id !== routeId) })),
  publishRoute: (post) => set((state) => {
    const existing = state.publishedPosts.find((item) => item.routeId === post.routeId)
    const nextPost = { ...post, id: existing?.id ?? `published-${Date.now()}`, publishedAt: existing?.publishedAt ?? new Date().toISOString() }
    return { publishedRouteIds: state.publishedRouteIds.includes(post.routeId) ? state.publishedRouteIds : [...state.publishedRouteIds, post.routeId], publishedPosts: existing ? state.publishedPosts.map((item) => item.id === existing.id ? nextPost : item) : [nextPost, ...state.publishedPosts] }
  }),
  deletePublishedPost: (id) => set((state) => { const post = state.publishedPosts.find((item) => item.id === id); return { publishedPosts: state.publishedPosts.filter((item) => item.id !== id), publishedRouteIds: post ? state.publishedRouteIds.filter((routeId) => routeId !== post.routeId) : state.publishedRouteIds } }),
  addComment: (postId, body) => set((state) => {
    const cleanBody = body.trim().slice(0, 500)
    if (!cleanBody || !postId) return state
    const comment: PostComment = { id: `comment-${Date.now()}`, author: state.nickname || '小鹏', body: cleanBody, createdAt: new Date().toISOString() }
    return { commentsByPost: { ...state.commentsByPost, [postId]: [comment, ...(state.commentsByPost[postId] ?? [])].slice(0, 100) } }
  }),
  addExpense: (expense) => set((state) => ({ expenses: [expense, ...state.expenses.filter((item) => item.id !== expense.id)].slice(0, 200) })),
  updateExpense: (id, patch) => set((state) => ({ expenses: state.expenses.map((item) => item.id === id ? { ...item, ...patch } : item) })),
  deleteExpense: (id) => set((state) => ({ expenses: state.expenses.filter((item) => item.id !== id) })),
  seedPackingItems: (journeyId, items) => set((state) => state.packingItems.some((item) => item.journeyId === journeyId) ? state : { packingItems: [...items, ...state.packingItems].slice(0, 300) }),
  addPackingItem: (item) => set((state) => ({ packingItems: [item, ...state.packingItems.filter((current) => current.id !== item.id)].slice(0, 300) })),
  togglePackingItem: (id) => set((state) => ({ packingItems: state.packingItems.map((item) => item.id === id ? { ...item, checked: !item.checked } : item) })),
  deletePackingItem: (id) => set((state) => ({ packingItems: state.packingItems.filter((item) => item.id !== id) })),
  addFootprint: (footprint) => set((state) => state.footprints.some((item) => item.journeyId === footprint.journeyId && item.placeId === footprint.placeId && item.city === footprint.city) ? state : { footprints: [footprint, ...state.footprints].slice(0, 300) }),
  updateFootprint: (id, patch) => set((state) => ({ footprints: state.footprints.map((item) => item.id === id ? { ...item, ...patch } : item) })),
  deleteFootprint: (id) => set((state) => ({ footprints: state.footprints.filter((item) => item.id !== id) })),
  setFriendInviteAccepted: (friendInviteAccepted) => set({ friendInviteAccepted }),
  toggleLiked: (id) => set((state) => ({ likedPosts: toggleInList(state.likedPosts, id) })),
  toggleSaved: (id) => set((state) => ({ savedPosts: toggleInList(state.savedPosts, id) })),
  toggleFollow: (author) => set((state) => ({ followedAuthors: toggleInList(state.followedAuthors, author) })),
  setVote: (vote) => set({ vote }),
  resetDemo: () => set({ tripMode: 'active', tripFlowState: 'idle', tripCity: null, activeRouteId: null, publishedRouteIds: [], personalTrips: [], publishedPosts: [], commentsByPost: {}, expenses: [], packingItems: [], footprints: [], onboardingCompleted: false, archivedRouteIds: [], friendInviteAccepted: false, vote: null, likedPosts: [], savedPosts: [], followedAuthors: [], reducedMotion: false, communityMapVisible: true }),
}), {
  name: 'zouzou-demo-v2',
  version: 3,
  partialize: persistedKeys,
  migrate: (value) => migratePersistedState(value),
}))
