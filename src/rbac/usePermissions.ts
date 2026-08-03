import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  can,
  canAccessModule,
  modulesForRole,
  type AdminModule,
  type Permission,
} from './roles'

export function usePermissions() {
  const { user } = useAuth()
  return useMemo(() => {
    const role = user?.role ?? 'ADMIN'
    return {
      role,
      can: (module: AdminModule, perm: Permission) => can(role, module, perm),
      canView: (module: AdminModule) => canAccessModule(role, module),
      modules: () => modulesForRole(role),
    }
  }, [user])
}
