// ============================================================
// Master admin panel API.
//
// The master admin runs the platform, not a hospital:
//   - reviews and approves/rejects hospital registration
//     requests (each hospital pays the one-time registration
//     fee via eSewa before a request can be approved),
//   - manages every registered hospital (suspend / activate /
//     list in the public directory / delete),
//   - manages platform settings (fee, site name, contacts).
//
// Hospital registration is now a PAID flow: POST /register/initiate stores a
// short-lived attempt keyed by the payment transaction_uuid and returns the
// eSewa form. The signed eSewa callback claims the attempt and creates the
// registration request as "paid"; only then is any data kept. The master
// admin approves it, which provisions the hospital database +
// admin account and emails the login credentials with the payment receipt.
// The old free /auth/register endpoint is gone (410).
// ============================================================

import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { env } from '../config/env.js'
import { validate } from '../middleware/validate.js'
import {
  getTenantConnection,
  cachedHospital,
  findHospitalByAdminEmail,
  isValidSlug,
  registerTenant,
  unregisterTenant,
  updateHospitalRegistry,
  hospitalRegistry,
  defaultLoginDomain,
  deriveHospitalCode,
} from '../config/tenants.js'
import {
  masterAdminModel,
  registrationRequestModel,
  registrationAttemptModel,
  getPlatformSettings,
  nextPlatformId,
  auditLogModel,
  platformAnnouncementModel,
  contactMessageModel,
  logAudit,
  type RegistrationRequest,
  type AuditAction,
} from '../config/platform.js'
import { requireMasterAuth, signMasterAccessToken, type MasterRequest } from '../middleware/masterAuth.js'
import { withTenant } from '../models/registry.js'
import { UserModel } from '../models/User.js'
import { HospitalSettingsModel } from '../models/Settings.js'
import { DoctorModel } from '../models/Doctor.js'
import { PatientModel } from '../models/Patient.js'
import { AppointmentModel } from '../models/Appointment.js'
import {
  loginUsername,
  firstNameOf,
  nextStaffId,
  generateTempPassword,
  sendHospitalCredentialsEmail,
  sendRegistrationRejectedEmail,
} from '../utils/credentials.js'
import { buildPaymentFields, esewaConfigured, newTransactionUuid, verifyEsewaCallback } from '../utils/esewa.js'

export const masterRouter = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function redirectToFrontend(res: { redirect(status: number, url: string): void }, params: string): void {
  res.redirect(302, `${env.APP_BASE_URL}/master/register/status?${params}`)
}

// ---------- Registration flow ----------
// Hospital registration is a PAID flow: POST /register/initiate validates
// the details and stores a short-lived RegistrationAttempt keyed by the
// payment's transaction_uuid (the callback URL stays short - eSewa rejects
// long success_urls). The signed eSewa callback claims that attempt and
// creates the registration request as "paid"; only then does any data
// persist beyond the attempt. The master admin approves it, which
// provisions the hospital database + admin account and emails the login
// credentials with the payment receipt. The old free /auth/register
// endpoint is gone (410).

/** Actor info of the signed-in master admin, for the audit log. */
function auditActor(req: Request): { id: string; email: string; name: string } {
  const { masterAdmin } = req as unknown as MasterRequest
  return { id: String(masterAdmin.id), email: masterAdmin.email, name: masterAdmin.name }
}

/** Attaches an audit entry in the background; never blocks the request. */
function audit(req: Request, action: AuditAction, summary: string, opts?: { targetType?: 'request' | 'hospital' | 'settings' | 'announcement' | 'contact'; targetId?: string }): void {
  void logAudit({ actor: auditActor(req), action, summary, ...opts })
}

// ---------- POST /master/login ----------
// Master admin sign-in (platform level). Issues a MASTER_ADMIN token.
masterRouter.post(
  '/login',
  validate({
    body: z.object({
      email: z.string().min(1, 'email required'),
      password: z.string().min(1, 'password required'),
    }),
  }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body as { email: string; password: string }
      const admin = await masterAdminModel().findOne({ email: email.toLowerCase() })
      if (!admin || !(await admin.comparePassword(password))) {
        throw new ApiError('Invalid email or password', 401)
      }
      await masterAdminModel().updateOne({ _id: admin._id }, { lastLoginAt: new Date() })
      void logAudit({
        actor: { id: String(admin._id), email: admin.email, name: admin.name },
        action: 'login',
        summary: 'Signed in to the master panel',
      })
      res.json({
        admin: { name: admin.name, email: admin.email },
        token: signMasterAccessToken(String(admin._id), admin.name),
      })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- GET /master/me ----------
masterRouter.get('/me', requireMasterAuth, (req, res) => {
  const { masterAdmin } = req as import('../middleware/masterAuth.js').MasterRequest
  res.json(masterAdmin)
})

// ---------- POST /master/register/initiate ----------
// Public - starts the paid hospital registration. Validates the details,
// reserves the hospital slug and returns the eSewa form for the
// registration fee. Nothing is provisioned here: the applicant's details
// are stored in a short-lived RegistrationAttempt keyed by the payment's
// transaction_uuid (which eSewa returns inside its signed callback), so an
// applicant who abandons the payment leaves nothing behind but an expiring
// attempt and can simply try again. The request is only created once the
// payment is verified (see /master/register/success).
masterRouter.post(
  '/register/initiate',
  validate({
    body: z.object({
      hospitalName: z.string().min(2, 'hospital name required'),
      name: z.string().min(2, 'name required'),
      email: z.string().regex(EMAIL_RE, 'valid email required'),
      phone: z.string().default(''),
      birthYear: z.coerce.number().int().min(1900).max(2100),
    }),
  }),
  async (req, res, next) => {
    try {
      if (!esewaConfigured()) {
        throw new ApiError('Online payments are not configured yet. Please try again later.', 503)
      }
      const { hospitalName, name, email, phone, birthYear } = req.body as {
        hospitalName: string
        name: string
        email: string
        phone: string
        birthYear: number
      }
      const slug = hospitalName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50)
      if (!isValidSlug(slug)) {
        throw new ApiError('Could not derive a valid hospital code from the hospital name', 400)
      }
      const normalized = email.toLowerCase()

      // Read-only duplicate checks - these never write to the database.
      if (cachedHospital(slug)) {
        throw new ApiError('This hospital is already registered - please log in instead', 409)
      }
      if ((await findHospitalByAdminEmail(normalized)).length > 0) {
        throw new ApiError('An account with this email is already registered to another hospital', 409)
      }
      const open = await registrationRequestModel().findOne({
        $or: [{ slug }, { 'admin.email': normalized }],
        status: { $in: ['paid', 'approved'] },
      })
      if (open) {
        throw new ApiError(
          'This hospital already submitted a registration and is awaiting approval',
          409,
        )
      }
      // A payment may already be in flight for this hospital or this email.
      // A different applicant on the same hospital name (or a different
      // hospital on the same email) is blocked; the same applicant retrying
      // is allowed - their stale attempts are replaced with a fresh one.
      const pending = await registrationAttemptModel().findOne({
        $or: [{ slug }, { 'admin.email': normalized }],
        status: 'pending',
      })
      if (pending && pending.slug === slug && pending.email !== normalized) {
        throw new ApiError('A registration for this hospital is already in progress from another applicant', 409)
      }
      if (pending) {
        await registrationAttemptModel().deleteMany({ email: normalized, status: 'pending' })
      }

      const settings = await getPlatformSettings()
      const fee = settings.registrationFee

      // Store the applicant under the payment's uuid so the success callback
      // URL never needs to carry the details (long callback URLs are rejected
      // by eSewa). The attempt expires automatically if never paid.
      const transactionUuid = newTransactionUuid()
      await registrationAttemptModel().create({
        transactionUuid,
        hospitalName,
        slug,
        name,
        email: normalized,
        phone,
        birthYear,
        fee,
      })

      const { fields, signature, formUrl } = buildPaymentFields({
        totalAmount: fee,
        transactionUuid,
        successUrl: `${env.APP_API_URL}/api/master/register/success`,
        failureUrl: `${env.APP_API_URL}/api/master/register/failure`,
      })

      res.status(201).json({
        amount: fee,
        formUrl,
        fields: { ...fields, signature },
      })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- /master/register/success ----------
// eSewa's signed callback. Verifies the payment, then - and only then -
// claims the RegistrationAttempt stored at initiate time under the payment's
// transaction_uuid and creates the registration request as "paid", then
// redirects the browser to the status page. The hospital is only created
// when the master admin approves the request.
masterRouter.all('/register/success', async (req: Request, res: Response, next) => {
  try {
    const { data, signature } = {
      ...(req.query as { data?: string; signature?: string }),
      ...(req.body as { data?: string; signature?: string }),
    }
    if (typeof data !== 'string') {
      redirectToFrontend(res, 'payment=error&message=invalid_callback')
      return
    }
    const verified = verifyEsewaCallback(data, signature)
    if (!verified || !verified.transaction_uuid) {
      redirectToFrontend(res, 'payment=error&message=invalid_signature')
      return
    }
    const uuid = verified.transaction_uuid
    // Atomically claim the attempt (details stored at initiate time under
    // this uuid) so a replayed or racing callback can never create two
    // requests.
    const attempt = await registrationAttemptModel().findOneAndUpdate(
      { transactionUuid: uuid, status: 'pending' },
      { $set: { status: 'claimed' } },
      { new: true },
    )
    if (!attempt) {
      const existing = await registrationRequestModel().findOne({
        'payment.transactionUuid': uuid,
      })
      redirectToFrontend(
        res,
        existing ? `payment=success&reg=${encodeURIComponent(existing.regNo)}` : 'payment=failed',
      )
      return
    }
    if (verified.status !== 'COMPLETE' || Number(verified.total_amount) !== attempt.fee) {
      await registrationAttemptModel().findByIdAndDelete(attempt._id)
      redirectToFrontend(res, 'payment=failed')
      return
    }
    // Two completed payments for the same applicant (e.g. two tabs) must not
    // create two requests - surface the existing one.
    const dup = await registrationRequestModel().findOne({
      $or: [{ slug: attempt.slug }, { 'admin.email': attempt.email }],
      status: { $in: ['paid', 'approved'] },
    })
    if (dup) {
      await registrationAttemptModel().findByIdAndDelete(attempt._id)
      redirectToFrontend(res, `payment=success&reg=${encodeURIComponent(dup.regNo)}`)
      return
    }

    const request = await registrationRequestModel().create({
      regNo: await nextPlatformId('hreg'),
      hospitalName: attempt.hospitalName,
      slug: attempt.slug,
      admin: {
        name: attempt.name,
        email: attempt.email,
        phone: attempt.phone,
        birthYear: attempt.birthYear,
      },
      status: 'paid',
      payment: {
        transactionUuid: uuid,
        transactionCode: verified.transaction_code ?? '',
        amount: attempt.fee,
        paidAt: new Date(),
      },
    })
    await registrationAttemptModel().findByIdAndDelete(attempt._id)
    redirectToFrontend(res, `payment=success&reg=${encodeURIComponent(request.regNo)}`)
  } catch (err) {
    next(err)
  }
})

// ---------- /master/register/failure ----------
// eSewa's callback when the payer aborts or fails. Nothing was provisioned
// at initiate time and no charge was made - the applicant can simply retry.
// The abandoned RegistrationAttempt is left for the TTL to expire.
masterRouter.all('/register/failure', async (_req: Request, res: Response, next) => {
  try {
    redirectToFrontend(res, 'payment=failed')
  } catch (err) {
    next(err)
  }
})

// ---------- GET /master/requests ----------
masterRouter.get(
  '/requests',
  requireMasterAuth,
  validate({
    query: z.object({
      status: z.enum(['pending_payment', 'paid', 'approved', 'rejected']).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { status } = req.query as { status?: RegistrationRequest['status'] }
      const filter = status ? { status } : {}
      const [items, counts] = await Promise.all([
        registrationRequestModel().find(filter).sort({ createdAt: -1 }).limit(200).lean(),
        registrationRequestModel().aggregate<{ _id: string; count: number }>([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
      ])
      const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]))
      res.json({
        items,
        counts: {
          pending_payment: countMap.pending_payment ?? 0,
          paid: countMap.paid ?? 0,
          approved: countMap.approved ?? 0,
          rejected: countMap.rejected ?? 0,
        },
      })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- GET /master/requests/:id ----------
masterRouter.get('/requests/:id', requireMasterAuth, async (req, res, next) => {
  try {
    const request = await registrationRequestModel().findById(req.params.id).lean()
    if (!request) throw new ApiError('Registration request not found', 404)
    res.json(request)
  } catch (err) {
    next(err)
  }
})

// ---------- POST /master/requests/:id/approve ----------
// Creates the hospital database + admin account and emails the login
// credentials together with the payment receipt.
masterRouter.post('/requests/:id/approve', requireMasterAuth, async (req, res, next) => {
  try {
    const request = await registrationRequestModel().findById(req.params.id)
    if (!request) throw new ApiError('Registration request not found', 404)
    if (request.status !== 'paid') {
      throw new ApiError('Only paid registration requests can be approved', 409)
    }
    const { slug, hospitalName, admin } = request
    if (cachedHospital(slug)) {
      throw new ApiError('This hospital code is already registered', 409)
    }
    if ((await findHospitalByAdminEmail(admin.email)).length > 0) {
      throw new ApiError('An account with this email is already registered to another hospital', 409)
    }

    const conn = getTenantConnection(slug)
    const hospitalCode = deriveHospitalCode(hospitalName)
    const loginDomain = defaultLoginDomain(slug)
    const staffId = await nextStaffId('ADMIN')
    const username = loginUsername({ hospitalCode, firstName: firstNameOf(admin.name), staffId, loginDomain })
    const password = generateTempPassword()
    try {
      await withTenant(conn, slug, async () => {
        if (await UserModel.findOne({ username })) {
          throw new ApiError(`The login username ${username} is already taken`, 409)
        }
        await registerTenant(slug, hospitalName, admin.email, { code: hospitalCode, loginDomain })
        await HospitalSettingsModel.findOneAndUpdate(
          { _id: 'hospital' },
          { $set: { name: hospitalName, email: admin.email, phone: admin.phone } },
          { upsert: true },
        )
        await UserModel.create({
          name: admin.name,
          email: admin.email,
          username,
          staffId,
          phone: admin.phone,
          role: 'ADMIN',
          passwordHash: password,
          mustChangePassword: true,
        })
        request.status = 'approved'
        request.approvedAt = new Date()
        await request.save()
      })
    } catch (err) {
      await unregisterTenant(slug).catch(() => {})
      if (conn.readyState === 1) {
        await conn.dropDatabase().catch(() => {})
      }
      throw err
    }

    void sendHospitalCredentialsEmail(admin.email, {
      name: admin.name,
      hospitalName,
      username,
      password,
      regNo: request.regNo,
      amount: request.payment.amount,
      transactionCode: request.payment.transactionCode ?? '',
      paidAt: request.payment.paidAt,
    })

    audit(
      req,
      'approve_request',
      `Approved registration ${request.regNo} for "${hospitalName}" (fee ${request.payment.amount})`,
      { targetType: 'request', targetId: String(request._id) },
    )

    res.json({
      request,
      credentials: { username, password },
    })
  } catch (err) {
    next(err)
  }
})

// ---------- POST /master/requests/:id/reject ----------
masterRouter.post(
  '/requests/:id/reject',
  requireMasterAuth,
  validate({ body: z.object({ reason: z.string().max(500).optional() }) }),
  async (req, res, next) => {
    try {
      const request = await registrationRequestModel().findById(req.params.id)
      if (!request) throw new ApiError('Registration request not found', 404)
      if (request.status !== 'paid') {
        throw new ApiError('Only paid registration requests can be rejected', 409)
      }
      const { reason } = req.body as { reason?: string }
      request.status = 'rejected'
      request.rejectedAt = new Date()
      request.reason = reason ?? ''
      await request.save()
      void sendRegistrationRejectedEmail(request.admin.email, {
        name: request.admin.name,
        hospitalName: request.hospitalName,
        regNo: request.regNo,
        reason,
      })
      audit(req, 'reject_request', `Rejected registration ${request.regNo} for "${request.hospitalName}"`, {
        targetType: 'request',
        targetId: String(request._id),
      })
      res.json(request)
    } catch (err) {
      next(err)
    }
  },
)

// ---------- Hospital management ----------

function publicHospital(h: { slug: string; name: string; adminEmail: string; status: string; listed?: boolean; dbName: string; createdAt?: Date }) {
  return {
    slug: h.slug,
    name: h.name,
    adminEmail: h.adminEmail,
    status: h.status,
    listed: h.listed ?? true,
    dbName: h.dbName,
    createdAt: h.createdAt,
  }
}

async function hospitalCounts(slug: string): Promise<{ patients: number; doctors: number; appointments: number }> {
  try {
    return await withTenant(getTenantConnection(slug), slug, async () => ({
      patients: await PatientModel.countDocuments(),
      doctors: await DoctorModel.countDocuments(),
      appointments: await AppointmentModel.countDocuments(),
    }))
  } catch {
    return { patients: 0, doctors: 0, appointments: 0 }
  }
}

// GET /master/hospitals?stats=true - every registered hospital.
masterRouter.get(
  '/hospitals',
  requireMasterAuth,
  validate({ query: z.object({ stats: z.enum(['true', 'false']).optional() }) }),
  async (req, res, next) => {
    try {
      const { stats } = req.query as { stats?: string }
      const records = await hospitalRegistry().find({}).sort({ createdAt: -1 }).limit(200).lean()
      const items = records.map((h) => publicHospital(h))
      if (stats === 'true') {
        const withCounts = await Promise.all(
          items.map(async (h) => ({ ...h, counts: await hospitalCounts(h.slug) })),
        )
        res.json({ items: withCounts, total: items.length })
        return
      }
      res.json({ items, total: items.length })
    } catch (err) {
      next(err)
    }
  },
)

// GET /master/hospitals/:slug - detail + record counts.
masterRouter.get('/hospitals/:slug', requireMasterAuth, async (req, res, next) => {
  try {
    const record = await hospitalRegistry().findOne({ slug: req.params.slug }).lean()
    if (!record) throw new ApiError('Hospital not found', 404)
    res.json({ ...publicHospital(record), counts: await hospitalCounts(record.slug) })
  } catch (err) {
    next(err)
  }
})

// PATCH /master/hospitals/:slug/status - suspend or activate.
masterRouter.patch(
  '/hospitals/:slug/status',
  requireMasterAuth,
  validate({ body: z.object({ status: z.enum(['active', 'suspended']) }) }),
  async (req, res, next) => {
    try {
      const { status } = req.body as { status: 'active' | 'suspended' }
      const updated = await updateHospitalRegistry(String(req.params.slug), { status })
      if (!updated) throw new ApiError('Hospital not found', 404)
      audit(req, 'hospital_status', `${status === 'active' ? 'Activated' : 'Suspended'} hospital "${updated.name}"`, {
        targetType: 'hospital',
        targetId: updated.slug,
      })
      res.json(updated)
    } catch (err) {
      next(err)
    }
  },
)

// PATCH /master/hospitals/:slug/listed - show/hide in the public directory.
masterRouter.patch(
  '/hospitals/:slug/listed',
  requireMasterAuth,
  validate({ body: z.object({ listed: z.boolean() }) }),
  async (req, res, next) => {
    try {
      const { listed } = req.body as { listed: boolean }
      const updated = await updateHospitalRegistry(String(req.params.slug), { listed })
      if (!updated) throw new ApiError('Hospital not found', 404)
      audit(req, 'hospital_listed', `${listed ? 'Listed' : 'Unlisted'} hospital "${updated.name}" in the public directory`, {
        targetType: 'hospital',
        targetId: updated.slug,
      })
      res.json(updated)
    } catch (err) {
      next(err)
    }
  },
)

// DELETE /master/hospitals/:slug - permanently removes the hospital
// (drops its database). The request must confirm with "DELETE".
masterRouter.delete(
  '/hospitals/:slug',
  requireMasterAuth,
  validate({
    body: z.object({ confirm: z.literal('DELETE', { errorMap: () => ({ message: 'Type DELETE to confirm' }) }) }),
  }),
  async (req, res, next) => {
    try {
      const slug = String(req.params.slug)
      const record = await hospitalRegistry().findOne({ slug }).lean()
      if (!record) throw new ApiError('Hospital not found', 404)
      const conn = getTenantConnection(slug)
      if (conn.readyState === 1) {
        await conn.dropDatabase().catch(() => {})
      }
      await unregisterTenant(slug)
      audit(req, 'hospital_delete', `Deleted hospital "${record.name}" (${slug})`, {
        targetType: 'hospital',
        targetId: slug,
      })
      res.json({ message: `Hospital "${record.name}" deleted` })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- Platform settings ----------
masterRouter.get('/settings', requireMasterAuth, async (_req, res, next) => {
  try {
    res.json(await getPlatformSettings())
  } catch (err) {
    next(err)
  }
})

masterRouter.put(
  '/settings',
  requireMasterAuth,
  validate({
    body: z.object({
      siteName: z.string().min(1).max(100).optional(),
      tagline: z.string().max(200).optional(),
      contactEmail: z.string().regex(EMAIL_RE, 'valid email required').optional(),
      contactPhone: z.string().max(50).optional(),
      registrationFee: z.coerce.number().int().min(0).max(1_000_000).optional(),
      hospitalDirectoryEnabled: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const body = req.body as Partial<Record<string, unknown>>
      const allowed: Record<string, unknown> = {}
      for (const key of [
        'siteName',
        'tagline',
        'contactEmail',
        'contactPhone',
        'registrationFee',
        'hospitalDirectoryEnabled',
      ] as const) {
        if (body[key] !== undefined) allowed[key] = body[key]
      }
      const updated = await getPlatformSettings()
      Object.assign(updated, allowed)
      await updated.save()
      const changed = Object.keys(allowed)
        .map((k) => `${k}=${allowed[k]}`)
        .join(', ')
      audit(req, 'settings_update', `Updated platform settings: ${changed || 'nothing'}`, {
        targetType: 'settings',
        targetId: 'platform',
      })
      res.json(updated)
    } catch (err) {
      next(err)
    }
  },
)

// ---------- GET /master/stats - dashboard ----------
masterRouter.get('/stats', requireMasterAuth, async (_req, res, next) => {
  try {
    const [hospitals, requests, settings, recentRequests, recentHospitals] = await Promise.all([
      hospitalRegistry().find({}).lean(),
      registrationRequestModel().find({}).lean(),
      getPlatformSettings(),
      registrationRequestModel().find({}).sort({ createdAt: -1 }).limit(5).lean(),
      hospitalRegistry().find({}).sort({ createdAt: -1 }).limit(5).lean(),
    ])
    const statusCounts = {
      pending_payment: 0,
      paid: 0,
      approved: 0,
      rejected: 0,
    }
    let revenue = 0
    for (const r of requests) {
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1
      if (r.status === 'paid' || r.status === 'approved') revenue += r.payment.amount
    }
    res.json({
      hospitals: {
        total: hospitals.length,
        active: hospitals.filter((h) => h.status === 'active').length,
        suspended: hospitals.filter((h) => h.status === 'suspended').length,
      },
      requests: statusCounts,
      revenue,
      registrationFee: settings.registrationFee,
      siteName: settings.siteName,
      recentRequests: recentRequests.map((r) => ({
        regNo: r.regNo,
        hospitalName: r.hospitalName,
        status: r.status,
        createdAt: r.createdAt,
      })),
      recentHospitals: recentHospitals.map((h) => ({
        slug: h.slug,
        name: h.name,
        status: h.status,
        listed: h.listed ?? true,
        createdAt: h.createdAt,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// ---------- GET /master/analytics?range=30d|90d|1y|all ----------
// Platform analytics: revenue & registration series per month, the
// registration funnel, top hospitals by activity, monthly conversion
// rates (approved ÷ initiated), and a linear 30-day revenue projection.
masterRouter.get(
  '/analytics',
  requireMasterAuth,
  validate({ query: z.object({ range: z.enum(['30d', '90d', '1y', 'all']).optional() }) }),
  async (req, res, next) => {
    try {
      const { range = '30d' } = req.query as { range?: string }
      const ranges: Record<string, number> = { '30d': 30, '90d': 90, '1y': 365, all: 0 }
      const days = ranges[range] ?? 30
      const from = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : new Date(0)

      const [requests, hospitals] = await Promise.all([
        registrationRequestModel().find({ createdAt: { $gte: from } }).sort({ createdAt: 1 }).lean(),
        hospitalRegistry().find({}).sort({ createdAt: 1 }).limit(100).lean(),
      ])

      const keyOf = (d?: Date) => (d ? new Date(d).toISOString().slice(0, 7) : '')
      const byMonth = new Map<string, { revenue: number; registrations: number }>()
      for (const r of requests) {
        const key = keyOf(r.createdAt)
        if (!key) continue
        const bucket = byMonth.get(key) ?? { revenue: 0, registrations: 0 }
        bucket.registrations += 1
        if (r.status === 'approved') bucket.revenue += r.payment.amount
        byMonth.set(key, bucket)
      }
      const months = [...byMonth.keys()].sort()
      const revenueSeries = months.map((m) => ({ label: m, value: byMonth.get(m)!.revenue }))
      const registrationSeries = months.map((m) => ({ label: m, value: byMonth.get(m)!.registrations }))

      const funnel = {
        pending_payment: requests.filter((r) => r.status === 'pending_payment').length,
        paid: requests.filter((r) => r.status === 'paid').length,
        approved: requests.filter((r) => r.status === 'approved').length,
        rejected: requests.filter((r) => r.status === 'rejected').length,
      }

      const top = await Promise.all(
        hospitals
          .filter((h) => h.status === 'active')
          .slice(0, 8)
          .map(async (h) => {
            const counts = await hospitalCounts(h.slug)
            const requestsCount = requests.filter((r) => r.slug === h.slug).length
            return {
              slug: h.slug,
              name: h.name,
              patients: counts.patients,
              doctors: counts.doctors,
              appointments: counts.appointments,
              requests: requestsCount,
              score: counts.patients + counts.doctors + counts.appointments + requestsCount,
            }
          }),
      )
      top.sort((a, b) => b.score - a.score)

      const conversion = months.map((m) => {
        const bucket = requests.filter((r) => keyOf(r.createdAt) === m)
        const approved = bucket.filter((r) => r.status === 'approved').length
        return {
          label: m,
          rate: bucket.length ? Math.round((approved / bucket.length) * 100) : 0,
          total: bucket.length,
          approved,
        }
      })

      const approved = requests.filter((r) => r.status === 'approved')
      const collected = approved.reduce((s, r) => s + r.payment.amount, 0)
      const pending = requests
        .filter((r) => r.status === 'paid')
        .reduce((s, r) => s + r.payment.amount, 0)
      const windowDays =
        days ||
        Math.max(1, Math.round((Date.now() - (requests[0]?.createdAt ? new Date(requests[0].createdAt).getTime() : Date.now())) / 86400000))
      const avgDaily = Math.round(collected / windowDays)

      res.json({
        range,
        from,
        to: new Date(),
        months,
        revenueSeries,
        registrationSeries,
        funnel,
        top: top.map(({ score: _score, ...rest }) => rest),
        conversion,
        projection: {
          next30Days: avgDaily * 30,
          avgDaily,
          note: 'Linear projection from the selected window’s approved revenue',
        },
        revenue: { collected, pending },
      })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- GET /master/receipts ----------
// Paid registrations (revenue): all requests that moved money -
// approved (collected), paid awaiting approval (pending), rejected (refunded).
masterRouter.get(
  '/receipts',
  requireMasterAuth,
  validate({
    query: z.object({
      status: z.enum(['approved', 'paid', 'rejected']).optional(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { status, from, to } = req.query as { status?: string; from?: string; to?: string }
      const filter: Record<string, unknown> = { status: { $in: ['paid', 'approved', 'rejected'] } }
      if (status) filter.status = status
      const paidAt: Record<string, Date> = {}
      if (from) paidAt.$gte = new Date(`${from}T00:00:00.000Z`)
      if (to) paidAt.$lte = new Date(`${to}T23:59:59.999Z`)
      if (from || to) filter['payment.paidAt'] = paidAt

      const [items, summaryRows] = await Promise.all([
        registrationRequestModel().find(filter).sort({ 'payment.paidAt': -1 }).limit(500).lean(),
        registrationRequestModel().find({ status: { $in: ['paid', 'approved', 'rejected'] } }).lean(),
      ])
      const summary = {
        approved: summaryRows.filter((r) => r.status === 'approved').reduce((s, r) => s + r.payment.amount, 0),
        paid: summaryRows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.payment.amount, 0),
        rejected: summaryRows.filter((r) => r.status === 'rejected').reduce((s, r) => s + r.payment.amount, 0),
      }

      res.json({
        items: items.map((r) => ({
          id: String(r._id),
          regNo: r.regNo,
          hospitalName: r.hospitalName,
          payer: r.admin.name,
          payerEmail: r.admin.email,
          amount: r.payment.amount,
          transactionCode: r.payment.transactionCode ?? '',
          paidAt: r.payment.paidAt,
          status: r.status,
        })),
        total: items.length,
        summary,
      })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- Announcements ----------
// Platform-wide banners shown inside every hospital dashboard.

// GET /master/announcements - all banners, newest first.
masterRouter.get('/announcements', requireMasterAuth, async (_req, res, next) => {
  try {
    const items = await platformAnnouncementModel().find({}).sort({ createdAt: -1 }).limit(100).lean()
    res.json({
      items: items.map((a) => ({
        id: String(a._id),
        title: a.title,
        message: a.message,
        audience: a.audience,
        active: a.active,
        createdBy: a.createdBy,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// POST /master/announcements - create a banner.
masterRouter.post(
  '/announcements',
  requireMasterAuth,
  validate({
    body: z.object({
      title: z.string().min(1, 'title required').max(120),
      message: z.string().min(1, 'message required').max(2000),
      audience: z.enum(['all', 'active']).default('all'),
    }),
  }),
  async (req, res, next) => {
    try {
      const { title, message, audience } = req.body as { title: string; message: string; audience: 'all' | 'active' }
      const actor = auditActor(req)
      const doc = await platformAnnouncementModel().create({
        title,
        message,
        audience,
        active: true,
        createdBy: { id: actor.id, email: actor.email },
      })
      audit(req, 'announcement_create', `Posted announcement "${title}" (${audience})`, {
        targetType: 'announcement',
        targetId: String(doc._id),
      })
      res.status(201).json({
        id: String(doc._id),
        title: doc.title,
        message: doc.message,
        audience: doc.audience,
        active: doc.active,
        createdBy: doc.createdBy,
        createdAt: doc.createdAt,
      })
    } catch (err) {
      next(err)
    }
  },
)

// PATCH /master/announcements/:id - activate / retire a banner.
masterRouter.patch(
  '/announcements/:id',
  requireMasterAuth,
  validate({ body: z.object({ active: z.boolean() }) }),
  async (req, res, next) => {
    try {
      const { active } = req.body as { active: boolean }
      const doc = await platformAnnouncementModel().findByIdAndUpdate(req.params.id, { $set: { active } }, { new: true })
      if (!doc) throw new ApiError('Announcement not found', 404)
      res.json({ id: String(doc._id), active: doc.active })
    } catch (err) {
      next(err)
    }
  },
)

// DELETE /master/announcements/:id - permanently remove a banner.
masterRouter.delete('/announcements/:id', requireMasterAuth, async (req, res, next) => {
  try {
    const doc = await platformAnnouncementModel().findByIdAndDelete(req.params.id)
    if (!doc) throw new ApiError('Announcement not found', 404)
    audit(req, 'announcement_delete', `Deleted announcement "${doc.title}"`, {
      targetType: 'announcement',
      targetId: String(doc._id),
    })
    res.json({ message: 'Announcement deleted' })
  } catch (err) {
    next(err)
  }
})

// ---------- GET /master/audit ----------
// Chronological log of every master admin action. Filterable by action
// type and searchable by summary/target.
masterRouter.get(
  '/audit',
  requireMasterAuth,
  validate({
    query: z.object({
      action: z.string().max(40).optional(),
      q: z.string().max(120).optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { action, q, page = 1, limit = 50 } = req.query as { action?: string; q?: string; page?: number; limit?: number }
      const filter: Record<string, unknown> = {}
      if (action) filter.action = action
      if (q) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        filter.$or = [{ summary: rx }, { targetId: rx }]
      }
      const [items, total] = await Promise.all([
        auditLogModel()
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        auditLogModel().countDocuments(filter),
      ])
      res.json({
        items: items.map((e) => ({
          id: String(e._id),
          actor: e.actor,
          action: e.action,
          targetType: e.targetType ?? null,
          targetId: e.targetId ?? null,
          summary: e.summary,
          createdAt: e.createdAt,
        })),
        total,
        page,
        limit,
      })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- Contact inbox ----------

// GET /master/contacts?filter=all|open|done
masterRouter.get(
  '/contacts',
  requireMasterAuth,
  validate({ query: z.object({ filter: z.enum(['all', 'open', 'done']).optional() }) }),
  async (req, res, next) => {
    try {
      const { filter = 'all' } = req.query as { filter?: string }
      const query = filter === 'open' ? { done: false } : filter === 'done' ? { done: true } : {}
      const [items, openTotal] = await Promise.all([
        contactMessageModel().find(query).sort({ createdAt: -1 }).limit(200).lean(),
        contactMessageModel().countDocuments({ done: false }),
      ])
      res.json({
        items: items.map((c) => ({
          id: String(c._id),
          name: c.name,
          email: c.email,
          hospital: c.hospital,
          message: c.message,
          done: c.done,
          doneAt: c.doneAt,
          createdAt: c.createdAt,
        })),
        total: items.length,
        openTotal,
      })
    } catch (err) {
      next(err)
    }
  },
)

// PATCH /master/contacts/:id - mark done / reopen.
masterRouter.patch(
  '/contacts/:id',
  requireMasterAuth,
  validate({ body: z.object({ done: z.boolean() }) }),
  async (req, res, next) => {
    try {
      const { done } = req.body as { done: boolean }
      const doc = await contactMessageModel().findByIdAndUpdate(
        req.params.id,
        { $set: { done, doneAt: done ? new Date() : null } },
        { new: true },
      )
      if (!doc) throw new ApiError('Contact message not found', 404)
      if (done) {
        audit(req, 'contact_done', `Marked contact message from "${doc.name}" (${doc.email}) as done`, {
          targetType: 'contact',
          targetId: String(doc._id),
        })
      }
      res.json({ id: String(doc._id), done: doc.done })
    } catch (err) {
      next(err)
    }
  },
)

// DELETE /master/contacts/:id - remove a contact message.
masterRouter.delete('/contacts/:id', requireMasterAuth, async (req, res, next) => {
  try {
    const doc = await contactMessageModel().findByIdAndDelete(req.params.id)
    if (!doc) throw new ApiError('Contact message not found', 404)
    audit(req, 'contact_delete', `Deleted contact message from "${doc.name}" (${doc.email})`, {
      targetType: 'contact',
      targetId: String(doc._id),
    })
    res.json({ message: 'Contact message deleted' })
  } catch (err) {
    next(err)
  }
})

// ---------- PUT /master/directory/order ----------
// Reorders the public directory. Body: { slugs: string[] } - the final
// display order of listed hospitals; hidden hospitals keep their score.
masterRouter.put(
  '/directory/order',
  requireMasterAuth,
  validate({
    body: z.object({ slugs: z.array(z.string().min(1).max(60)).max(200) }),
  }),
  async (req, res, next) => {
    try {
      const { slugs } = req.body as { slugs: string[] }
      await Promise.all(
        slugs.map((slug, index) =>
          hospitalRegistry().updateOne({ slug }, { $set: { displayOrder: index + 1 } }),
        ),
      )
      const records = await hospitalRegistry().find({}).sort({ displayOrder: 1, name: 1 }).limit(200).lean()
      res.json({ items: records.map((h) => publicHospital(h)) })
    } catch (err) {
      next(err)
    }
  },
)
