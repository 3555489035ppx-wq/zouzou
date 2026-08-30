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
  toggleLiked: (id: string) => void
  toggleSaved: (id: string) => void
  toggleFollow: (author: string) => void
  setVote: (id: string | null) => void
  resetDemo: () => void
}

const toggleInList = (items: string[], id: string) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]

export const useAppStore = create<AppState>()(persist((set) => ({
  nickname: '小鹏',
  avatar: '/assets/date.jpg',
  cover: '/assets/cities/shanghai-bund.jpg',
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
  toggleLiked: (id) => set((state) => ({ likedPosts: toggleInList(state.likedPosts, id) })),
  toggleSaved: (id) => set((state) => ({ savedPosts: toggleInList(state.savedPosts, id) })),
  toggleFollow: (author) => set((state) => ({ followedAuthors: toggleInList(state.followedAuthors, author) })),
  setVote: (vote) => set({ vote }),
  resetDemo: () => set({ tripMode: 'active', tripCity: null, activeRouteId: null, publishedRouteIds: [], vote: null, likedPosts: [], savedPosts: [], followedAuthors: [], reducedMotion: false, communityMapVisible: true }),
}), { name: 'zouzou-demo-v2' }))
