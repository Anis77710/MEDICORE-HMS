import { Router, type Request } from 'express'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { sendOtpEmail } from '../utils/email.js'
import { UserModel } from '../models/User.js'
import { OtpModel } from '../models/Otp.js'
import { RefreshTokenModel } from '../models/RefreshToken.js'
import { HospitalSettingsModel } from '../models/Settings.js'
import { withTenant } from '../models/registry.js'
import {
  requireAuth,
  signAccessToken,
  signRefreshToken,
  storeRefreshToken,
  rotateRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  hashRefreshToken,
  REFRESH_COOKIE,
  type AuthedRequest,
} from '../middleware/auth.js'
import { hospitalOf } from '../middleware/tenant.js'
import {
  cachedHospital,
  findHospitalByAdminEmail,
  getTenantConnection,
  hospitalRegistry,
  isValidSlug,
  type HospitalInfo,
} from '../config/tenants.js'
import { validate } from '../middleware/validate.js'

export const authRouter = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 8
const OTP_TTL_MIN = 15
const OTP_MAX_ATTEMPTS = 5

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function publicUser(u: {
  _id: unknown
  name: string
  email: string
  username?: string
  phone: string
  role: string
  avatarUrl?: string
}) {
  return { id: String(u._id), name: u.name, email: u.email, username: u.username, phone: u.phone, role: u.role, avatarUrl: u.avatarUrl }
}

/**
 * Decides which hospital database a login attempt belongs to.
 * Priority: explicit `hospital` body field -> admin-email registry ->
 * the header-resolved hospital (set by the tenant middleware) -> default.
 */
async function resolveLoginHospital(
  req: { body?: { hospital?: string }; headers: Record<string, unknown> },
  identifier: string,
): Promise<HospitalInfo> {
  const raw = req.body?.hospital
  const explicit = typeof raw === 'string' ? raw.trim() : ''
  if (explicit) {
    if (!isValidSlug(explicit)) throw new ApiError('Invalid hospital code', 400)
    const rec = cachedHospital(explicit)
    if (!rec) throw new ApiError('Hospital not found — check the hospital code', 404)
    if (rec.status === 'suspended') {
      throw new ApiError('This hospital has been suspended — contact the platform administrator', 403)
    }
    return { slug: rec.slug, name: rec.name }
  }

  const matches = await findHospitalByAdminEmail(identifier)
  if (matches.length > 1) {
    throw new ApiError(
      'This email is registered to more than one hospital — enter the hospital code to sign in',
      409,
    )
  }
  const first = matches[0]
  if (first) {
    if (first.status === 'suspended') {
      throw new ApiError('This hospital has been suspended — contact the platform administrator', 403)
    }
    return { slug: first.slug, name: first.name }
  }

  // Synthetic username (firstname@medicore.hms) — the credentials email tells
  // admins to sign in with this, but it never matches a registry admin email.
  // Find which registered hospital owns the username and sign into that
  // tenant, instead of always falling back to the default hospital (which
  // made username logins fail with "Invalid email or password" for every
  // hospital admin/doctor/staff outside the default hospital).
  if (identifier.endsWith('@medicore.hms')) {
    const hospitals = await hospitalRegistry().find({}).lean()
    const currentSlug = hospitalOf(req as Request).slug
    for (const h of hospitals) {
      if (h.slug === currentSlug) continue
      const owner = await getTenantConnection(h.slug)
        .collection('users')
        .findOne({ username: identifier }, { projection: { _id: 1 } })
      if (owner) {
        if (h.status === 'suspended') {
          throw new ApiError('This hospital has been suspended — contact the platform administrator', 403)
        }
        return { slug: h.slug, name: h.name }
      }
    }
  }

  return hospitalOf(req as Request)
}

// ---------- POST /auth/login ----------
// The `email` field accepts either the user's Gmail address or the
// synthetic username (firstname@medicore.hms). The `hospital` field
// is optional: when omitted, the hospital is resolved from the
// x-hospital-slug header, the admin email registry, or the default
// hospital (the MONGO_URI database).
authRouter.post(
  '/login',
  validate({
    body: z.object({
      email: z.string().min(1, 'username or email required'),
      password: z.string().min(1, 'password required'),
      remember: z.boolean().optional(),
      hospital: z.string().max(60).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body as {
        email: string
        password: string
        hospital?: string
      }
      const identifier = email.toLowerCase()

      const target = await resolveLoginHospital(req, identifier)
      const run = async (): Promise<void> => {
        const user = await UserModel.findOne({ $or: [{ email: identifier }, { username: identifier }] })
        if (!user || !(await user.comparePassword(password))) {
          throw new ApiError('Invalid email or password', 401)
        }
        if (user.status === 'Disabled') {
          throw new ApiError('This account has been disabled — contact an administrator', 403)
        }
        await UserModel.updateOne({ _id: user._id }, { lastLoginAt: new Date() })
        const familyId = randomUUID()
        const { token, jti } = signRefreshToken(String(user._id), familyId)
        await storeRefreshToken(String(user._id), jti, token, familyId, req)
        setRefreshCookie(res, token)
        const settings = await HospitalSettingsModel.findById('hospital')
        res.json({
          user: publicUser(user),
          token: signAccessToken({
            id: String(user._id),
            role: user.role,
            name: user.name,
            ver: user.tokenVersion,
            hospital: target.slug,
          }),
          hospital: { slug: target.slug, name: target.name || settings?.name || '' },
        })
      }
      if (target.slug === hospitalOf(req).slug) {
        await run()
      } else {
        await withTenant(getTenantConnection(target.slug), target.slug, run)
      }
    } catch (err) {
      next(err)
    }
  },
)

// ---------- POST /auth/register ----------
// Removed: hospital registration is now a PAID flow managed by the master
// admin panel (eSewa registration fee + approval). See /api/master/register.
authRouter.post(
  '/register',
  validate({
    body: z.object({
      hospitalName: z.string().min(2, 'hospital name required'),
      name: z.string().min(2, 'name required'),
      email: z.string().regex(EMAIL_RE, 'valid email required'),
      phone: z.string().default(''),
      birthYear: z.coerce.number().int().min(1900).max(2100),
    }),
  }),
  (_req, _res, next) => {
    next(
      new ApiError(
        'Hospital registration now requires a one-time eSewa payment. ' +
          'Register through the paid flow at /master/register — your request will be ' +
          'reviewed by the platform team and your login credentials will be emailed to you.',
        410,
      ),
    )
  },
)

// ---------- POST /auth/refresh ----------
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const oldToken = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE]
    if (!oldToken) throw new ApiError('No refresh token', 401)
    const rotated = await rotateRefreshToken(oldToken, req)
    if (!rotated) throw new ApiError('Session expired — please sign in again', 401)
      const user = await UserModel.findById(rotated.userId)
      if (!user) throw new ApiError('Session expired — please sign in again', 401)
      if (user.status === 'Disabled') {
        throw new ApiError('This account has been disabled — contact an administrator', 403)
      }
      setRefreshCookie(res, rotated.token)
      res.json({
        user: publicUser(user),
        token: signAccessToken({ id: String(user._id), role: user.role, name: user.name, ver: user.tokenVersion }),
        hospital: { slug: hospitalOf(req).slug, name: '' },
      })
  } catch (err) {
    next(err)
  }
})

// ---------- POST /auth/logout ----------
authRouter.post('/logout', async (req, res, next) => {
  try {
    const oldToken = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE]
    if (oldToken) {
      await RefreshTokenModel.updateOne(
        { hash: hashRefreshToken(oldToken) },
        { revokedAt: new Date() },
      )
    }
    clearRefreshCookie(res)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// ---------- GET /auth/me ----------
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest
    const user = await UserModel.findById(userId)
    if (!user) throw new ApiError('User not found', 404)
    res.json(publicUser(user))
  } catch (err) {
    next(err)
  }
})

// ---------- POST /auth/forgot-password ----------
authRouter.post(
  '/forgot-password',
  validate({
    body: z.object({ email: z.string().regex(EMAIL_RE, 'valid email required') }),
  }),
  async (req, res, next) => {
    try {
      const { email } = req.body as { email: string }
      const user = await UserModel.findOne({ email: email.toLowerCase() })
      // Always respond the same way so this endpoint cannot enumerate accounts.
      if (user) {
        await OtpModel.deleteMany({ email: user.email, purpose: 'password-reset' })
        const otp = String(randomBytes(3).readUIntBE(0, 3) % 1_000_000).padStart(6, '0')
        await OtpModel.create({
          email: user.email,
          codeHash: sha256(otp),
          purpose: 'password-reset',
          expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60000),
        })
        await sendOtpEmail(user.email, otp)
      }
      res.json({ message: 'If that email exists, a reset code has been sent' })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- POST /auth/verify-otp ----------
authRouter.post(
  '/verify-otp',
  validate({
    body: z.object({
      email: z.string().regex(EMAIL_RE, 'valid email required'),
      otp: z.string().regex(/^\d{4,8}$/, 'code must be digits'),
    }),
  }),
  async (req, res, next) => {
    try {
      const { email, otp } = req.body as { email: string; otp: string }
      const rec = await OtpModel.findOne({ email: email.toLowerCase(), purpose: 'password-reset' })
      if (!rec || rec.expiresAt < new Date() || rec.usedAt) {
        res.json({ valid: false })
        return
      }
      if (rec.attempts >= OTP_MAX_ATTEMPTS) {
        await OtpModel.deleteOne({ _id: rec._id })
        res.json({ valid: false })
        return
      }
      if (rec.codeHash !== sha256(otp)) {
        await OtpModel.updateOne({ _id: rec._id }, { $inc: { attempts: 1 } })
        res.json({ valid: false })
        return
      }
      await OtpModel.updateOne({ _id: rec._id }, { usedAt: new Date() })
      res.json({ valid: true })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- POST /auth/reset-password ----------
authRouter.post(
  '/reset-password',
  validate({
    body: z.object({
      email: z.string().regex(EMAIL_RE, 'valid email required'),
      otp: z.string().regex(/^\d{4,8}$/, 'code must be digits'),
      password: z.string().min(PASSWORD_MIN, `password must be at least ${PASSWORD_MIN} characters`),
    }),
  }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body as { email: string; otp: string; password: string }
      const rec = await OtpModel.findOne({
        email: email.toLowerCase(),
        purpose: 'password-reset',
        usedAt: { $ne: null },
      })
      if (!rec || rec.expiresAt < new Date()) {
        throw new ApiError('Code invalid or expired — please request a new one', 400)
      }
      const user = await UserModel.findOne({ email: email.toLowerCase() })
      if (!user) throw new ApiError('Account not found', 404)
      user.passwordHash = password
      user.tokenVersion += 1
      await user.save()
      await OtpModel.deleteMany({ email: user.email, purpose: 'password-reset' })
      // Password changed: revoke every active session.
      await RefreshTokenModel.updateMany({ userId: String(user._id) }, { revokedAt: new Date() })
      clearRefreshCookie(res)
      res.json({ success: true })
    } catch (err) {
      next(err)
    }
  },
)
