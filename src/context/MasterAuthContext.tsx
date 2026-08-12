import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useReticleStore } from '@reticlehq/react/store'
import { getMasterToken, setMasterToken } from '../api/masterClient'
import { masterApi, type MasterAdminInfo } from '../api/services/master'
import { signal } from '../reticle'

interface MasterAuthContextValue {
  admin: MasterAdminInfo | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const MasterAuthContext = createContext<MasterAuthContextValue | null>(null)

export function MasterAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<MasterAdminInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  useReticleStore('masterAuth', { admin, isAuthenticated: !!admin, isLoading })

  useEffect(() => {
    const token = getMasterToken()
    if (!token) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    masterApi
      .me()
      .then((a) => {
        if (!cancelled) setAdmin(a)
      })
      .catch(() => {
        setMasterToken(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<MasterAuthContextValue>(
    () => ({
      admin,
      isAuthenticated: !!admin,
      isLoading,
      login: async (email, password) => {
        const res = await masterApi.login(email, password)
        setMasterToken(res.token)
        try {
          setAdmin(await masterApi.me())
        } catch {
          setAdmin({ id: '', email: res.admin.email, name: res.admin.name })
        }
        signal('master:login', { email })
      },
      logout: () => {
        setMasterToken(null)
        setAdmin(null)
        signal('master:logout')
      },
    }),
    [admin, isLoading],
  )

  return <MasterAuthContext.Provider value={value}>{children}</MasterAuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMasterAuth(): MasterAuthContextValue {
  const ctx = useContext(MasterAuthContext)
  if (!ctx) throw new Error('useMasterAuth must be used within MasterAuthProvider')
  return ctx
}
