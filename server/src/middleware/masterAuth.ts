// ============================================================
// Master admin authentication.
// The master admin signs in at /api/master/login and receives a
// JWT with role "MASTER_ADMIN" and no hospital claim — it is a
// platform-level identity, valid across every hospital. Hospital
// tokens (requireAuth) never satisfy this middleware, and master
// tokens never satisfy requireAuth (they carry no hospital and
// role MASTER_ADMIN, which hospital routes reject by status/role).
// ============================================================

import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { masterAdminModel, type MasterAdmin } from '../config/platform.js'

export const MASTER_ROLE = 'MASTER_ADMIN'

export interface MasterJwtPayload {
  sub: string
  role: string
  name?: string
}

export interface MasterRequest extends Request {
  masterAdmin: { id: string; email: string; name: string }
}

export function signMasterAccessToken(id: string, name: string): string {
  return jwt.sign({ sub: id, role: MASTER_ROLE, name }, env.JWT_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`,
  })
}

export function requireMasterAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    next(new ApiError('Authentication required', 401))
    return
  }
  let payload: MasterJwtPayload
  try {
    payload = jwt.verify(header.slice(7), env.JWT_SECRET) as MasterJwtPayload
  } catch {
    next(new ApiError('Session expired — please sign in again', 401))
    return
  }
  if (payload.role !== MASTER_ROLE) {
    next(new ApiError('Session expired — please sign in again', 401))
    return
  }
  masterAdminModel()
    .findById(payload.sub)
    .then((admin: MasterAdmin | null) => {
      if (!admin) {
        next(new ApiError('This account no longer exists', 403))
        return
      }
      const authed = req as MasterRequest
      authed.masterAdmin = { id: String(admin._id), email: admin.email, name: admin.name }
      next()
    })
    .catch(() => next(new ApiError('Authentication failed', 500)))
}
