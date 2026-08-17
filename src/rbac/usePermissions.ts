import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  can,
  canAccessModule,
  canAccessBilling,
  modulesForRole,
  type AdminModule,
  type Permission,
} from './roles'

export function usePermissions() {
  const { user } = useAuth()
  return useMemo(() => {
    const role = user?.role ?? 'ADMIN'
    const department = user?.department
    return {
      role,
      can: (module: AdminModule, perm: Permission) => {
        if (module === 'billing' && !canAccessBilling(role, department)) return false
        return can(role, module, perm)
      },
      canView: (module: AdminModule) =>
        module === 'billing' ? canAccessBilling(role, department) : canAccessModule(role, module),
      modules: () => modulesForRole(role),
    }
  }, [user])
}
