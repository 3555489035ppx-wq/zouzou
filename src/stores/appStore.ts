import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type TripMode = 'none' | 'upcoming' | 'active' | 'completed'

type AppState = {
  nickname: string
  avatar: string
  cover: string
  city: string
  communityCity: string
  communityMapVisible: boolean
  reducedMotion: boolean
  tripMode: TripMode
  likedPosts: string[]
  savedPosts: string[]
  followedAuthors: string[]
  vote: string | null
  setProfile: (nickname: string, avatar: string) => void
  setCover: (cover: string) => void
  setCity: (city: string) => void
  setCommunityCity: (city: string) => void
  setCommunityMapVisible: (value: boolean) => void
  setReducedMotion: (value: boolean) => void
  setTripMode: (mode: TripMode) => void
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
  cover: '/assets/shanghai-skyline.jpg',
  city: '上海',
  communityCity: '上海',
  communityMapVisible: true,
  reducedMotion: false,
  tripMode: 'active',
  likedPosts: [],
  savedPosts: [],
  followedAuthors: [],
  vote: null,
  setProfile: (nickname, avatar) => set({ nickname, avatar }),
  setCover: (cover) => set({ cover }),
  // City is a product-wide preference. Home, community, trip copy and
  // recommendation data should never drift apart after a single selection.
  setCity: (city) => set({ city, communityCity: city }),
  setCommunityCity: (communityCity) => set({ communityCity }),
  setCommunityMapVisible: (communityMapVisible) => set({ communityMapVisible }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setTripMode: (tripMode) => set({ tripMode }),
  toggleLiked: (id) => set((state) => ({ likedPosts: toggleInList(state.likedPosts, id) })),
  toggleSaved: (id) => set((state) => ({ savedPosts: toggleInList(state.savedPosts, id) })),
  toggleFollow: (author) => set((state) => ({ followedAuthors: toggleInList(state.followedAuthors, author) })),
  setVote: (vote) => set({ vote }),
  resetDemo: () => set({ tripMode: 'active', vote: null, likedPosts: [], savedPosts: [], followedAuthors: [], reducedMotion: false, communityMapVisible: true }),
}), { name: 'zouzou-demo-v2' }))
