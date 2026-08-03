import { Router } from 'express'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { sendOtpEmail } from '../utils/email.js'
import { UserModel } from '../models/User.js'
import { OtpModel } from '../models/Otp.js'
import { RefreshTokenModel } from '../models/RefreshToken.js'
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
  phone: string
  role: string
  avatarUrl?: string
}) {
  return { id: String(u._id), name: u.name, email: u.email, phone: u.phone, role: u.role, avatarUrl: u.avatarUrl }
}

// ---------- POST /auth/login ----------
authRouter.post(
  '/login',
  validate({
    body: z.object({
      email: z.string().regex(EMAIL_RE, 'valid email required'),
      password: z.string().min(1, 'password required'),
      remember: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body as { email: string; password: string }
      const user = await UserModel.findOne({ email: email.toLowerCase() })
      if (!user || !(await user.comparePassword(password))) {
        throw new ApiError('Invalid email or password', 401)
      }
      await UserModel.updateOne({ _id: user._id }, { lastLoginAt: new Date() })
      const familyId = randomUUID()
      const { token, jti } = signRefreshToken(String(user._id), familyId)
      await storeRefreshToken(String(user._id), jti, token, familyId, req)
      setRefreshCookie(res, token)
      res.json({ user: publicUser(user), token: signAccessToken({ id: String(user._id), role: user.role, name: user.name }) })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- POST /auth/register ----------
authRouter.post(
  '/register',
  validate({
    body: z.object({
      name: z.string().min(2, 'name required'),
      email: z.string().regex(EMAIL_RE, 'valid email required'),
      phone: z.string().default(''),
      role: z.enum(['ADMIN', 'DOCTOR', 'NURSE', 'STAFF', 'PATIENT']),
      password: z.string().min(PASSWORD_MIN, `password must be at least ${PASSWORD_MIN} characters`),
    }),
  }),
  async (req, res, next) => {
    try {
      const { name, email, phone, role, password } = req.body as {
        name: string
        email: string
        phone: string
        role: 'ADMIN' | 'DOCTOR' | 'NURSE' | 'STAFF' | 'PATIENT'
        password: string
      }
      const normalized = email.toLowerCase()
      if (await UserModel.findOne({ email: normalized })) {
        throw new ApiError('An account with this email already exists', 409)
      }
      if (role === 'ADMIN' && (await UserModel.countDocuments({ role: 'ADMIN' })) > 0) {
        throw new ApiError('An administrator already exists — ask them to create your account', 403)
      }
      const user = await UserModel.create({ name, email: normalized, phone, role, passwordHash: password })
      const familyId = randomUUID()
      const { token, jti } = signRefreshToken(String(user._id), familyId)
      await storeRefreshToken(String(user._id), jti, token, familyId, req)
      setRefreshCookie(res, token)
      res.status(201).json({ user: publicUser(user), token: signAccessToken({ id: String(user._id), role: user.role, name: user.name }) })
    } catch (err) {
      next(err)
    }
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
    setRefreshCookie(res, rotated.token)
    res.json({ user: publicUser(user), token: signAccessToken({ id: String(user._id), role: user.role, name: user.name }) })
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
