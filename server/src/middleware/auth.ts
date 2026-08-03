import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { createHash } from 'node:crypto'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { RefreshTokenModel } from '../models/RefreshToken.js'
import type { UserRole } from '../models/User.js'

export const REFRESH_COOKIE = 'hs_refresh'

export interface JwtPayload {
  sub: string
  role: UserRole
  name?: string
}

export interface AuthedRequest extends Request {
  userId: string
  userRole: UserRole
  userName: string
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

// ---------- Access tokens ----------
export function signAccessToken(user: { id: string; role: UserRole; name?: string }): string {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name }, env.JWT_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`,
  })
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    next(new ApiError('Authentication required', 401))
    return
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as JwtPayload
    ;(req as AuthedRequest).userId = payload.sub
    ;(req as AuthedRequest).userRole = payload.role
    ;(req as AuthedRequest).userName = payload.name ?? ''
    next()
  } catch {
    next(new ApiError('Session expired — please sign in again', 401))
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { userRole } = req as AuthedRequest
    if (!roles.includes(userRole)) {
      next(new ApiError('You do not have permission to perform this action', 403))
      return
    }
    next()
  }
}

// ---------- Refresh tokens ----------
export interface RefreshTokenPayload {
  jti: string
  sub: string
  fam: string
  ua?: string
  ip?: string
}

export function signRefreshToken(userId: string, familyId: string): {
  token: string
  jti: string
} {
  const jti = randomUUID()
  const token = jwt.sign({ jti, sub: userId, fam: familyId }, env.JWT_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
  })
  return { token, jti }
}

export async function storeRefreshToken(
  userId: string,
  jti: string,
  token: string,
  familyId: string,
  req: Request,
): Promise<void> {
  await RefreshTokenModel.create({
    jti,
    hash: sha256(token),
    userId,
    familyId,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000),
    userAgent: req.headers['user-agent']?.slice(0, 200),
    ip: req.ip,
  })
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86400000,
  })
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' })
}

export function hashRefreshToken(token: string): string {
  return sha256(token)
}

export async function rotateRefreshToken(
  oldToken: string,
  req: Request,
): Promise<{ token: string; userId: string } | null> {
  let payload: RefreshTokenPayload
  try {
    payload = jwt.verify(oldToken, env.JWT_SECRET) as RefreshTokenPayload
  } catch {
    return null
  }
  const hash = hashRefreshToken(oldToken)
  const record = await RefreshTokenModel.findOne({ hash })
  if (!record || record.revokedAt || record.expiresAt < new Date()) return null

  // Reuse of an already-rotated token: revoke the whole family (theft signal).
  if (record.replacedBy) {
    await RefreshTokenModel.updateMany({ familyId: record.familyId }, { revokedAt: new Date() })
    return null
  }

  const { token, jti } = signRefreshToken(payload.sub, record.familyId)
  await RefreshTokenModel.updateOne(
    { _id: record._id },
    { replacedBy: jti, revokedAt: new Date() },
  )
  await storeRefreshToken(payload.sub, jti, token, record.familyId, req)
  return { token, userId: payload.sub }
}
