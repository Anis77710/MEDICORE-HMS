// ============================================================
// Master admin panel API.
//
// The master admin runs the platform, not a hospital:
//   - reviews and approves/rejects hospital registration
//     requests (each hospital pays the NPR 2,000 registration
//     fee via eSewa before a request can be approved),
//   - manages every registered hospital (suspend / activate /
//     list in the public directory / delete),
//   - manages platform settings (fee, site name, contacts).
//
// Hospital registration is now a PAID flow: POST /register/initiate
// creates a registration request and returns the eSewa form; the
// signed callback marks it paid; the master admin approves it,
// which provisions the hospital database + admin account and
// emails the login credentials together with the payment receipt.
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
} from '../config/tenants.js'
import {
  masterAdminModel,
  registrationRequestModel,
  getPlatformSettings,
  nextPlatformId,
  type RegistrationRequest,
} from '../config/platform.js'
import { requireMasterAuth, signMasterAccessToken } from '../middleware/masterAuth.js'
import { withTenant } from '../models/registry.js'
import { UserModel } from '../models/User.js'
import { HospitalSettingsModel } from '../models/Settings.js'
import { DoctorModel } from '../models/Doctor.js'
import { PatientModel } from '../models/Patient.js'
import { AppointmentModel } from '../models/Appointment.js'
import { loginUsername, defaultPassword, sendHospitalCredentialsEmail, sendRegistrationRejectedEmail } from '../utils/credentials.js'
import { buildPaymentFields, esewaConfigured, newTransactionUuid, verifyEsewaCallback } from '../utils/esewa.js'

export const masterRouter = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function redirectToFrontend(res: { redirect(status: number, url: string): void }, params: string): void {
  res.redirect(302, `${env.APP_BASE_URL}/master/register/status?${params}`)
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
// Public — starts the paid hospital registration. Validates the details,
// reserves the hospital slug and returns the eSewa form for the
// registration fee. Nothing is provisioned until the master approves.
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

      if (cachedHospital(slug)) {
        throw new ApiError('This hospital is already registered — please log in instead', 409)
      }
      if ((await findHospitalByAdminEmail(normalized)).length > 0) {
        throw new ApiError('An account with this email is already registered to another hospital', 409)
      }
      const open = await registrationRequestModel().findOne({
        $or: [{ slug }, { 'admin.email': normalized }],
        status: { $in: ['pending_payment', 'paid'] },
      })
      if (open) {
        throw new ApiError(
          open.slug === slug && open.status === 'paid'
            ? 'This hospital already submitted a registration and is awaiting approval'
            : 'A registration with these details is already in progress',
          409,
        )
      }

      const settings = await getPlatformSettings()
      const fee = settings.registrationFee

      // Retry after a failed payment reuses the same request (new transaction).
      let request = await registrationRequestModel().findOne({ slug, status: 'pending_payment' })
      if (request) {
        request.payment.transactionUuid = newTransactionUuid()
        await request.save()
      } else {
        request = await registrationRequestModel().create({
          regNo: await nextPlatformId('hreg'),
          hospitalName,
          slug,
          admin: { name, email: normalized, phone, birthYear },
          status: 'pending_payment',
          payment: { transactionUuid: newTransactionUuid(), amount: fee },
        })
      }

      const { fields, signature, formUrl } = buildPaymentFields({
        totalAmount: fee,
        transactionUuid: request.payment.transactionUuid,
        successUrl: `${env.APP_API_URL}/api/master/register/success?reg=${encodeURIComponent(request.regNo)}`,
        failureUrl: `${env.APP_API_URL}/api/master/register/failure?reg=${encodeURIComponent(request.regNo)}`,
      })

      res.status(201).json({
        regNo: request.regNo,
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
// eSewa's signed callback. Marks the registration request as paid and
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
    const found = await registrationRequestModel().findOne({ 'payment.transactionUuid': uuid })
    if (!found) {
      redirectToFrontend(res, 'payment=failed')
      return
    }
    if (found.status === 'approved' || found.status === 'paid') {
      redirectToFrontend(res, `payment=success&reg=${encodeURIComponent(found.regNo)}`)
      return
    }
    if (found.status !== 'pending_payment') {
      redirectToFrontend(res, 'payment=failed')
      return
    }

    // Atomically claim the request so a racing/replayed callback can only
    // transition it once.
    const claim = await registrationRequestModel().findOneAndUpdate(
      { _id: found._id, status: 'pending_payment' },
      { $set: { 'payment.transactionCode': verified.transaction_code ?? '' } },
      { new: true },
    )
    if (!claim) {
      redirectToFrontend(res, 'payment=failed')
      return
    }

    if (verified.status !== 'COMPLETE' || Number(verified.total_amount) !== claim.payment.amount) {
      await registrationRequestModel().updateOne(
        { _id: claim._id },
        { $set: { 'payment.transactionCode': verified.transaction_code ?? '' } },
      )
      redirectToFrontend(res, 'payment=failed')
      return
    }

    await registrationRequestModel().updateOne(
      { _id: claim._id },
      {
        $set: {
          status: 'paid',
          'payment.paidAt': new Date(),
          'payment.transactionCode': verified.transaction_code ?? '',
        },
      },
    )
    redirectToFrontend(res, `payment=success&reg=${encodeURIComponent(claim.regNo)}`)
  } catch (err) {
    next(err)
  }
})

// ---------- /master/register/failure ----------
masterRouter.all('/register/failure', async (req, res, next) => {
  try {
    const { data, signature } = {
      ...(req.query as { data?: string; signature?: string }),
      ...(req.body as { data?: string; signature?: string }),
    }
    if (typeof data === 'string') {
      const verified = verifyEsewaCallback(data, signature)
      if (verified?.transaction_uuid) {
        await registrationRequestModel().updateOne(
          { 'payment.transactionUuid': verified.transaction_uuid, status: 'pending_payment' },
          { $set: { 'payment.transactionCode': verified.transaction_code ?? '' } },
        )
      }
    }
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
    const username = loginUsername(admin.name)
    const password = defaultPassword(admin.name, admin.birthYear)
    try {
      await withTenant(conn, slug, async () => {
        if (await UserModel.findOne({ username })) {
          throw new ApiError(`The login username ${username} is already taken`, 409)
        }
        await registerTenant(slug, hospitalName, admin.email)
        await HospitalSettingsModel.findOneAndUpdate(
          { _id: 'hospital' },
          { $set: { name: hospitalName, email: admin.email, phone: admin.phone } },
          { upsert: true },
        )
        await UserModel.create({
          name: admin.name,
          email: admin.email,
          username,
          phone: admin.phone,
          role: 'ADMIN',
          passwordHash: password,
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

    res.json({
      request,
      credentials: { username },
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

// GET /master/hospitals?stats=true — every registered hospital.
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

// GET /master/hospitals/:slug — detail + record counts.
masterRouter.get('/hospitals/:slug', requireMasterAuth, async (req, res, next) => {
  try {
    const record = await hospitalRegistry().findOne({ slug: req.params.slug }).lean()
    if (!record) throw new ApiError('Hospital not found', 404)
    res.json({ ...publicHospital(record), counts: await hospitalCounts(record.slug) })
  } catch (err) {
    next(err)
  }
})

// PATCH /master/hospitals/:slug/status — suspend or activate.
masterRouter.patch(
  '/hospitals/:slug/status',
  requireMasterAuth,
  validate({ body: z.object({ status: z.enum(['active', 'suspended']) }) }),
  async (req, res, next) => {
    try {
      const { status } = req.body as { status: 'active' | 'suspended' }
      const updated = await updateHospitalRegistry(String(req.params.slug), { status })
      if (!updated) throw new ApiError('Hospital not found', 404)
      res.json(updated)
    } catch (err) {
      next(err)
    }
  },
)

// PATCH /master/hospitals/:slug/listed — show/hide in the public directory.
masterRouter.patch(
  '/hospitals/:slug/listed',
  requireMasterAuth,
  validate({ body: z.object({ listed: z.boolean() }) }),
  async (req, res, next) => {
    try {
      const { listed } = req.body as { listed: boolean }
      const updated = await updateHospitalRegistry(String(req.params.slug), { listed })
      if (!updated) throw new ApiError('Hospital not found', 404)
      res.json(updated)
    } catch (err) {
      next(err)
    }
  },
)

// DELETE /master/hospitals/:slug — permanently removes the hospital
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
      res.json(updated)
    } catch (err) {
      next(err)
    }
  },
)

// ---------- GET /master/stats — dashboard ----------
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
