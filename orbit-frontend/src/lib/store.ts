import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from './api'

type AuthState = {
  token: string | null
  user: User | null
  isLoggedIn: boolean
  login: (token: string, user: User) => void
  logout: () => void
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isLoggedIn: false,

      login: (token, user) => {
        localStorage.setItem('orbit_token', token)
        set({ token, user, isLoggedIn: true })
      },

      logout: () => {
        localStorage.removeItem('orbit_token')
        set({ token: null, user: null, isLoggedIn: false })
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'orbit-auth',
      // tokenとuserだけ永続化（セキュリティのためisLoggedInは含めない）
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) state.isLoggedIn = true
      },
    }
  )
)