import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type TripMode = 'none' | 'upcoming' | 'active' | 'completed'

type AppState = {
  nickname: string
  avatar: string
  cover: string
  city: string
  /** 城市选择是用户偏好；已保存行程则固化自己的目的地。 */
  tripCity: string | null
  communityCity: string
  communityMapVisible: boolean
  reducedMotion: boolean
  tripMode: TripMode
  activeRouteId: string | null
  publishedRouteIds: string[]
  friendInviteAccepted: boolean
  likedPosts: string[]
  savedPosts: string[]
  followedAuthors: string[]
  vote: string | null
  setProfile: (nickname: string, avatar: string) => void
  setCover: (cover: string) => void
  setCity: (city: string) => void
  setTripCity: (city: string | null) => void
  setCommunityCity: (city: string) => void
  setCommunityMapVisible: (value: boolean) => void
  setReducedMotion: (value: boolean) => void
  setTripMode: (mode: TripMode) => void
  adoptRoute: (routeId: string, city: string) => void
  publishRoute: (routeId: string) => void
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

const migratePersistedState = (value: unknown): Partial<AppState> => {
  const state = value && typeof value === 'object' ? value as Partial<AppState> : {}
  const modes: TripMode[] = ['none', 'upcoming', 'active', 'completed']
  return {
    nickname: typeof state.nickname === 'string' ? state.nickname.slice(0, 40) : '小鹏',
    avatar: typeof state.avatar === 'string' ? state.avatar : '/assets/date.jpg',
    cover: typeof state.cover === 'string' ? state.cover : '/assets/shanghai-skyline.jpg',
    city: typeof state.city === 'string' ? state.city : '上海',
    tripCity: typeof state.tripCity === 'string' ? state.tripCity : null,
    communityCity: typeof state.communityCity === 'string' ? state.communityCity : '上海',
    communityMapVisible: state.communityMapVisible !== false,
    reducedMotion: state.reducedMotion === true,
    tripMode: modes.includes(state.tripMode as TripMode) ? state.tripMode : 'active',
    activeRouteId: typeof state.activeRouteId === 'string' ? state.activeRouteId : null,
    publishedRouteIds: safeList(state.publishedRouteIds),
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
  city: state.city,
  tripCity: state.tripCity,
  communityCity: state.communityCity,
  communityMapVisible: state.communityMapVisible,
  reducedMotion: state.reducedMotion,
  tripMode: state.tripMode,
  activeRouteId: state.activeRouteId,
  publishedRouteIds: state.publishedRouteIds,
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
  city: '上海',
  tripCity: null,
  communityCity: '上海',
  communityMapVisible: true,
  reducedMotion: false,
  // Keep deep-linked preview routes useful; the first-user onboarding path
  // explicitly switches this to `none` before entering Home.
  tripMode: 'active',
  activeRouteId: null,
  publishedRouteIds: [],
  friendInviteAccepted: false,
  likedPosts: [],
  savedPosts: [],
  followedAuthors: [],
  vote: null,
  setProfile: (nickname, avatar) => set({ nickname, avatar }),
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
  setTripMode: (tripMode) => set({ tripMode }),
  adoptRoute: (routeId, city) => set({ activeRouteId: routeId, tripCity: city, city, communityCity: city, tripMode: 'upcoming' }),
  publishRoute: (routeId) => set((state) => ({ publishedRouteIds: state.publishedRouteIds.includes(routeId) ? state.publishedRouteIds : [...state.publishedRouteIds, routeId] })),
  setFriendInviteAccepted: (friendInviteAccepted) => set({ friendInviteAccepted }),
  toggleLiked: (id) => set((state) => ({ likedPosts: toggleInList(state.likedPosts, id) })),
  toggleSaved: (id) => set((state) => ({ savedPosts: toggleInList(state.savedPosts, id) })),
  toggleFollow: (author) => set((state) => ({ followedAuthors: toggleInList(state.followedAuthors, author) })),
  setVote: (vote) => set({ vote }),
  resetDemo: () => set({ tripMode: 'active', tripCity: null, activeRouteId: null, publishedRouteIds: [], friendInviteAccepted: false, vote: null, likedPosts: [], savedPosts: [], followedAuthors: [], reducedMotion: false, communityMapVisible: true }),
}), {
  name: 'zouzou-demo-v2',
  version: 2,
  partialize: persistedKeys,
  migrate: (value) => migratePersistedState(value),
}))
