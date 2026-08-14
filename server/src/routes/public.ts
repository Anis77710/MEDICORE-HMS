import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { DoctorModel } from '../models/Doctor.js'
import { AppointmentModel } from '../models/Appointment.js'
import { validate } from '../middleware/validate.js'
import { getAvailabilitySlots, isWorkingDay } from '../domain/availability.js'
import { hospitalRegistry } from '../config/tenants.js'
import { contactMessageModel, getPlatformSettings } from '../config/platform.js'
import { getTenantConnection, isValidSlug } from '../config/tenants.js'
import { withTenant, DEFAULT_SLUG } from '../models/registry.js'

// ------------------------------------------------------------
// Public tenant resolution — the public booking page is not
// logged in, so the visitor picks a listed hospital and we
// route the request into that hospital's database. No hospital
// given -> the default (first) hospital, as before.
// ------------------------------------------------------------
function publicSlug(query: Record<string, unknown>): string {
  const raw = typeof query.hospital === 'string' ? query.hospital.trim() : ''
  if (!raw) return DEFAULT_SLUG
  if (!isValidSlug(raw)) throw new ApiError('Invalid hospital code', 400)
  return raw
}

async function withPublicTenant<T>(
  slug: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withTenant(getTenantConnection(slug), slug, fn)
}

// ============================================================
// Public endpoints — no auth. Used by the public booking page:
// GET /public/doctors, GET /public/doctors/:id/availability.
// Creating a booking goes through the eSewa payment flow
// (POST /public/payment/initiate → callback) in routes/esewa.ts —
// an appointment is never created without a verified payment.
// ============================================================

export const publicRouter = Router()

// GET /public/doctors — doctors currently available for booking.
// ?hospital=slug scopes the listing to that hospital's database
// (the public visitor picks the hospital they want to book at).
publicRouter.get('/doctors', async (req, res, next) => {
  try {
    const slug = publicSlug(req.query)
    const doctors = await withPublicTenant(slug, () =>
      DoctorModel.find({ status: 'Active' }).sort({ name: 1 }),
    )
    res.json(
      doctors.map((d) => ({
        id: String(d._id),
        name: d.name,
        department: d.department,
        specialty: d.specialty,
        consultationFee: d.consultationFee,
        schedule: d.schedule,
      })),
    )
  } catch (err) {
    next(err)
  }
})

// GET /public/doctors/:id/availability?date=YYYY-MM-DD
// Centralized slot generation — same rules as the admin calendar.
publicRouter.get(
  '/doctors/:id/availability',
  validate({
    params: z.object({ id: z.string() }),
    query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  }),
  async (req, res, next) => {
    try {
      const slug = publicSlug(req.query)
      const result = await withPublicTenant(slug, async () => {
        const doctor = await DoctorModel.findById(req.params.id)
        if (!doctor) throw new ApiError('Doctor not found', 404)
        const { date } = req.query as { date: string }
        const appointments = await AppointmentModel.find({
          doctorId: String(doctor._id),
          date,
          status: { $ne: 'Cancelled' },
        }).select('date time durationMin status')
        return {
          date,
          workingDay: isWorkingDay(doctor, date),
          doctorStatus: doctor.status,
          slots: getAvailabilitySlots(doctor, appointments, date),
        }
      })
      res.json(result)
    } catch (err) {
      next(err)
    }
  },
)

// GET /public/doctors/:id/availability-month?month=YYYY-MM
// One call for the whole month, so the public booking calendar can mark
// every day as off / available / booked (no free slots left) at once.
publicRouter.get(
  '/doctors/:id/availability-month',
  validate({
    params: z.object({ id: z.string() }),
    query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }),
  }),
  async (req, res, next) => {
    try {
      const slug = publicSlug(req.query)
      const result = await withPublicTenant(slug, async () => {
        const doctor = await DoctorModel.findById(req.params.id)
        if (!doctor) throw new ApiError('Doctor not found', 404)
        const { month } = req.query as { month: string }
        const [y, m] = month.split('-').map(Number)
        const dayCount = new Date(y ?? new Date().getFullYear(), (m ?? 1), 0).getDate()
        const first = `${month}-01`
        const last = `${month}-${String(dayCount).padStart(2, '0')}`
        const appointments = await AppointmentModel.find({
          doctorId: String(doctor._id),
          date: { $gte: first, $lte: last },
          status: { $ne: 'Cancelled' },
        }).select('date time durationMin status')
        const byDate = new Map<string, { date: string; time: string; durationMin: number; status: string }[]>()
        for (const a of appointments) {
          const list = byDate.get(a.date) ?? []
          list.push(a)
          byDate.set(a.date, list)
        }
        const now = new Date()
        const todayIso =
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-` +
          `${String(now.getDate()).padStart(2, '0')}`
        const days: Record<string, 'off' | 'available' | 'booked'> = {}
        for (let d = 1; d <= dayCount; d++) {
          const iso = `${month}-${String(d).padStart(2, '0')}`
          if (iso < todayIso) continue
          if (!isWorkingDay(doctor, iso)) {
            days[iso] = 'off'
            continue
          }
          const bucket = byDate.get(iso)
          const appts = bucket ?? []
          const slots = getAvailabilitySlots(doctor, appts, iso)
          days[iso] = slots.some((s) => s.available) ? 'available' : 'booked'
        }
        return { month, days }
      })
      res.json(result)
    } catch (err) {
      next(err)
    }
  },
)

// GET /public/hospitals — the public hospital directory: every approved
// hospital that is active and has been listed by the master admin,
// ordered by the master-set display order (then name).
publicRouter.get('/hospitals', async (_req, res, next) => {
  try {
    // Registry docs created before the `listed` flag existed have no field
    // stored; the schema default (true) applies, so missing === listed.
    const hospitals = await hospitalRegistry()
      .find({ status: 'active', $or: [{ listed: true }, { listed: { $exists: false } }] })
      .sort({ displayOrder: 1, name: 1 })
      .select('slug name displayOrder createdAt')
      .lean()
    res.json(
      hospitals.map((h) => ({
        slug: h.slug,
        name: h.name,
        createdAt: h.createdAt,
      })),
    )
  } catch (err) {
    next(err)
  }
})

// POST /public/contact — contact form submissions from the landing page.
// Messages land in the master admin's contact inbox.
publicRouter.post(
  '/contact',
  validate({
    body: z.object({
      name: z.string().min(1, 'name required').max(120),
      email: z.string().email('valid email required'),
      hospital: z.string().max(120).optional().default(''),
      message: z.string().min(1, 'message required').max(3000),
    }),
  }),
  async (req, res, next) => {
    try {
      const { name, email, hospital, message } = req.body as {
        name: string
        email: string
        hospital?: string
        message: string
      }
      await contactMessageModel().create({ name, email, hospital: hospital ?? '', message })
      res.status(201).json({ message: 'Message received — we will get back to you shortly.' })
    } catch (err) {
      next(err)
    }
  },
)

// GET /public/platform — platform-level info shown to the public
// (site name, tagline, contact details, registration fee).
publicRouter.get('/platform', async (_req, res, next) => {
  try {
    const settings = await getPlatformSettings()
    res.json({
      siteName: settings.siteName,
      tagline: settings.tagline,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      registrationFee: settings.registrationFee,
      hospitalDirectoryEnabled: settings.hospitalDirectoryEnabled,
    })
  } catch (err) {
    next(err)
  }
})

