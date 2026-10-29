import { create } from 'zustand'
import type { NavSection, User } from '@/types'

interface AppState {
  // Auth
  isAuthenticated: boolean
  currentUser: User | null
  accessToken: string | null

  // Navigation
  activeSection: NavSection
  searchQuery: string

  // Actions
  loginSuccess: (user: User, accessToken: string) => void
  // Renovación silenciosa (services/http.ts): solo cambia el token, el usuario sigue igual.
  setAccessToken: (accessToken: string) => void
  logout: () => void
  setSection: (section: NavSection) => void
  setSearchQuery: (q: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  currentUser: null,
  accessToken: null,
  activeSection: 'dashboard',
  searchQuery: '',

  loginSuccess: (user, accessToken) =>
    set({
      isAuthenticated: true,
      currentUser: user,
      accessToken,
    }),

  setAccessToken: (accessToken) => set({ accessToken }),

  logout: () =>
    set({
      isAuthenticated: false,
      currentUser: null,
      accessToken: null,
      activeSection: 'dashboard',
    }),

  setSection: (section) => set({ activeSection: section }),
  setSearchQuery: (q) => set({ searchQuery: q }),
}))