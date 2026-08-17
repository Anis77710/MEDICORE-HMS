import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthResponse, User } from '../types'
import * as authApi from '../api/services/auth'
import { getToken, setToken, setAuthExpiredHandler } from '../api/client'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string, remember?: boolean) => Promise<User>
  register: (input: authApi.HospitalRegisterInput) => Promise<AuthResponse>
  logout: () => Promise<void>
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    authApi
      .getCurrentUser()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch(() => {
        setToken(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setAuthExpiredHandler(() => {
      setToken(null)
      setUser(null)
    })
    return () => setAuthExpiredHandler(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login: async (email, password, remember) => {
        const res = await authApi.login({ email, password, remember })
        setToken(res.token)
        setUser(res.user)
        return res.user
      },
      register: async (input) => {
        const res = await authApi.register(input)
        setToken(res.token)
        setUser(res.user)
        return res
      },
      logout: async () => {
        await authApi.logout()
        setUser(null)
      },
      updateUser: (next) => setUser(next),
    }),
    [user, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
