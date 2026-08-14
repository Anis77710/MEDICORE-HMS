import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { DoctorModel } from '../models/Doctor.js'
import { UserModel } from '../models/User.js'
import { AppointmentModel } from '../models/Appointment.js'
import { PatientModel } from '../models/Patient.js'
import { ConsultationModel } from '../models/Consultation.js'
import { PrescriptionModel } from '../models/Pharmacy.js'
import { RefreshTokenModel } from '../models/RefreshToken.js'
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js'
import { validate, queryOf } from '../middleware/validate.js'
import { writeAuditLog } from './staff.js'
import { getAvailabilitySlots, isWorkingDay } from '../domain/availability.js'
import { loginUsername, defaultPassword, sendCredentialsEmail } from '../utils/credentials.js'

export const doctorsRouter = Router()

doctorsRouter.use(requireAuth)

const doctorBody = z.object({
  name: z.string().min(2, 'name required'),
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'valid email required'),
  phone: z.string().default(''),
  department: z.string().min(1, 'department required'),
  specialty: z.string().default(''),
  qualification: z.string().default(''),
  experienceYears: z.coerce.number().min(0).default(0),
  birthYear: z.coerce.number().int().min(1900).max(2100),
  consultationFee: z.coerce.number().min(0).default(0),
  schedule: z.array(z.string()).default([]),
  status: z.enum(['Active', 'On Leave', 'Unavailable']).default('Active'),
})

const listQuery = z.object({
  search: z.string().optional(),
  department: z.string().optional(),
})

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// ---------- GET /doctors?search&department ----------
doctorsRouter.get('/', validate({ query: listQuery }), async (req, res, next) => {
  try {
    const { search, department } = queryOf<{ search?: string; department?: string }>(req)
    const filter: Record<string, unknown> = {}
    if (search) {
      const s = search.toLowerCase()
      filter.$or = [
        { name: { $regex: s, $options: 'i' } },
        { specialty: { $regex: s, $options: 'i' } },
      ]
    }
    if (department && department !== 'All') filter.department = department
    const doctors = await DoctorModel.find(filter).sort({ name: 1 })
    res.json(doctors)
  } catch (err) {
    next(err)
  }
})

// ---------- GET /doctors/metrics (admin) ----------
// Live workload per doctor: real counts, not the static patientsCount field.
doctorsRouter.get('/metrics', requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const [doctors, appointments, consultations, prescriptions, patients] = await Promise.all([
      DoctorModel.find().select('_id name'),
      AppointmentModel.find().select('doctorId date status'),
      ConsultationModel.find().select('doctorId'),
      PrescriptionModel.find().select('doctorId'),
      PatientModel.find().select('assignedDoctorId'),
    ])
    const today = todayStr()
    const metrics: Record<string, {
      appointmentsToday: number
      pendingAppointments: number
      pendingOldest: string | null
      consultationsCount: number
      prescriptionsCount: number
      patientsCount: number
    }> = {}
    for (const d of doctors) {
      metrics[String(d._id)] = {
        appointmentsToday: 0,
        pendingAppointments: 0,
        pendingOldest: null,
        consultationsCount: 0,
        prescriptionsCount: 0,
        patientsCount: 0,
      }
    }
    for (const a of appointments) {
      const m = metrics[a.doctorId]
      if (!m) continue
      if (a.date === today) m.appointmentsToday += 1
      if (a.status === 'Pending') {
        m.pendingAppointments += 1
        if (!m.pendingOldest || a.date < m.pendingOldest) m.pendingOldest = a.date
      }
    }
    for (const c of consultations) {
      const m = metrics[c.doctorId]
      if (m) m.consultationsCount += 1
    }
    for (const rx of prescriptions) {
      const m = metrics[rx.doctorId]
      if (m) m.prescriptionsCount += 1
    }
    for (const p of patients) {
      if (!p.assignedDoctorId) continue
      const m = metrics[p.assignedDoctorId]
      if (m) m.patientsCount += 1
    }
    res.json(metrics)
  } catch (err) {
    next(err)
  }
})

// ---------- GET /doctors/:id ----------
doctorsRouter.get(
  '/:id',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const doctor = await DoctorModel.findById(req.params.id)
      if (!doctor) throw new ApiError('Doctor not found', 404)
      const account = await UserModel.findOne({ email: doctor.email.toLowerCase() }).select(
        'status lastLoginAt role createdAt',
      )
      res.json({
        ...doctor.toJSON(),
        account: account
          ? { id: String(account._id), status: account.status, lastLoginAt: account.lastLoginAt, createdAt: account.createdAt }
          : null,
      })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- POST /doctors (admin) ----------
// Adding a doctor also creates their login account automatically:
// username = firstname@medicore.hms, password = firstname@birthYear.
// The credentials are emailed to the doctor's Gmail address.
doctorsRouter.post(
  '/',
  requireRole('ADMIN'),
  validate({ body: doctorBody }),
  async (req, res, next) => {
    try {
      const email = String(req.body.email).toLowerCase()
      const username = loginUsername(String(req.body.name))
      if (await UserModel.findOne({ username })) {
        throw new ApiError(`The login username ${username} is already taken — the first name may need to differ`, 409)
      }
      if (await DoctorModel.findOne({ email })) {
        throw new ApiError('A doctor with this email already exists — use a different email address', 409)
      }
      const doctor = await DoctorModel.create(req.body)
      let credentials: { username: string; password: string } | null = null
      if (!(await UserModel.findOne({ email }))) {
        const password = defaultPassword(doctor.name, (req.body as { birthYear: number }).birthYear)
        await UserModel.create({
          name: doctor.name,
          email,
          username,
          phone: doctor.phone,
          role: 'DOCTOR',
          passwordHash: password,
        })
        await sendCredentialsEmail(email, { name: doctor.name, username, password })
        credentials = { username, password }
      }
      await writeAuditLog(req as AuthedRequest, 'create', 'doctor', String(doctor._id), {
        name: doctor.name,
        department: doctor.department,
        accountCreated: credentials !== null,
      })
      res.status(201).json({ ...doctor.toJSON(), credentials })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- PUT /doctors/:id (admin) ----------
doctorsRouter.put(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: z.object({ id: z.string() }), body: doctorBody.partial() }),
  async (req, res, next) => {
    try {
      const before = await DoctorModel.findById(req.params.id)
      if (!before) throw new ApiError('Doctor not found', 404)
      const body = req.body as { email?: string; name?: string }
      if (body.email) {
        const email = body.email.toLowerCase()
        const clash = await DoctorModel.findOne({ email, _id: { $ne: req.params.id } })
        if (clash) {
          throw new ApiError('Another doctor already uses this email — use a different email address', 409)
        }
      }
      const doctor = await DoctorModel.findByIdAndUpdate(req.params.id, req.body, { new: true })
      if (!doctor) throw new ApiError('Doctor not found', 404)
      const changed: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(req.body)) {
        if (String((before as unknown as Record<string, unknown>)[key]) !== String(value)) {
          changed[key] = value
        }
      }
      await writeAuditLog(req as AuthedRequest, 'update', 'doctor', String(doctor._id), changed)
      res.json(doctor)
    } catch (err) {
      next(err)
    }
  },
)

// ---------- DELETE /doctors/:id (admin, dependency-guarded) ----------
doctorsRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const doctor = await DoctorModel.findById(req.params.id)
      if (!doctor) throw new ApiError('Doctor not found', 404)
      const deps = await dependencyCounts(doctor._id.toString())
      if (deps.activeAppointments > 0 || deps.assignedPatients > 0) {
        throw new ApiError(
          `Cannot delete ${doctor.name} — ${deps.activeAppointments} active appointment(s) and ${deps.assignedPatients} assigned patient(s). Reassign them first.`,
          409,
        )
      }
      await DoctorModel.findByIdAndDelete(req.params.id)
      await writeAuditLog(req as AuthedRequest, 'delete', 'doctor', String(req.params.id), {
        name: doctor.name,
      })
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  },
)

// ============================================================
// Account governance (admin)
// ============================================================

// ---------- POST /doctors/:id/account — create the login account ----------
// Username is always firstname@medicore.hms; password is
// firstname@birthYear unless an explicit password is provided.
doctorsRouter.post(
  '/:id/account',
  requireRole('ADMIN'),
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({
      email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'valid email required'),
      password: z.string().min(8, 'password must be at least 8 characters').optional(),
      birthYear: z.coerce.number().int().min(1900).max(2100).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const doctor = await DoctorModel.findById(req.params.id)
      if (!doctor) throw new ApiError('Doctor not found', 404)
      const email = (req.body as { email: string }).email.toLowerCase()
      if (await UserModel.findOne({ email })) {
        throw new ApiError('An account with this email already exists', 409)
      }
      const username = loginUsername(doctor.name)
      if (await UserModel.findOne({ username })) {
        throw new ApiError(`The login username ${username} is already taken`, 409)
      }
      const body = req.body as { email: string; password?: string; birthYear?: number }
      const password = body.password ?? defaultPassword(doctor.name, body.birthYear ?? doctor.birthYear)
      const user = await UserModel.create({
        name: doctor.name,
        email,
        username,
        phone: doctor.phone,
        role: 'DOCTOR',
        passwordHash: password,
      })
      await sendCredentialsEmail(email, { name: doctor.name, username, password })
      await writeAuditLog(req as AuthedRequest, 'create', 'doctor-account', String(user._id), {
        doctorId: String(doctor._id),
        doctorName: doctor.name,
        generated: !body.password,
      })
      res.status(201).json({
        id: String(user._id),
        email: user.email,
        username,
        role: user.role,
        status: user.status,
      })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- POST /doctors/:id/reset-password ----------
// Generates a strong temporary password when none is provided. Bumping
// tokenVersion invalidates every existing session immediately.
doctorsRouter.post(
  '/:id/reset-password',
  requireRole('ADMIN'),
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({
      password: z.string().min(8, 'password must be at least 8 characters').optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const doctor = await DoctorModel.findById(req.params.id)
      if (!doctor) throw new ApiError('Doctor not found', 404)
      const user = await UserModel.findOne({ email: doctor.email.toLowerCase() })
      if (!user) throw new ApiError('No login account exists for this doctor yet', 404)
      const tempPassword =
        (req.body as { password?: string }).password ??
        generateTempPassword()
      user.passwordHash = tempPassword
      user.tokenVersion += 1
      await user.save()
      await RefreshTokenModel.updateMany({ userId: String(user._id) }, { revokedAt: new Date() })
      await writeAuditLog(req as AuthedRequest, 'reset-password', 'doctor-account', String(user._id), {
        doctorId: String(doctor._id),
        doctorName: doctor.name,
        generated: !(req.body as { password?: string }).password,
      })
      res.json({
        success: true,
        email: user.email,
        ...((req.body as { password?: string }).password ? {} : { tempPassword }),
      })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- POST /doctors/:id/disable-login ----------
doctorsRouter.post(
  '/:id/disable-login',
  requireRole('ADMIN'),
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const doctor = await DoctorModel.findById(req.params.id)
      if (!doctor) throw new ApiError('Doctor not found', 404)
      const user = await UserModel.findOne({ email: doctor.email.toLowerCase() })
      if (!user) throw new ApiError('No login account exists for this doctor yet', 404)
      if (user.status === 'Disabled') {
        return res.json({ id: String(user._id), status: user.status })
      }
      user.status = 'Disabled'
      user.tokenVersion += 1
      await user.save()
      await RefreshTokenModel.updateMany({ userId: String(user._id) }, { revokedAt: new Date() })
      await writeAuditLog(req as AuthedRequest, 'disable', 'doctor-account', String(user._id), {
        doctorId: String(doctor._id),
        doctorName: doctor.name,
      })
      res.json({ id: String(user._id), status: user.status })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- POST /doctors/:id/enable-login ----------
doctorsRouter.post(
  '/:id/enable-login',
  requireRole('ADMIN'),
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const doctor = await DoctorModel.findById(req.params.id)
      if (!doctor) throw new ApiError('Doctor not found', 404)
      const user = await UserModel.findOne({ email: doctor.email.toLowerCase() })
      if (!user) throw new ApiError('No login account exists for this doctor yet', 404)
      if (user.status === 'Active') {
        return res.json({ id: String(user._id), status: user.status })
      }
      user.status = 'Active'
      user.tokenVersion += 1
      await user.save()
      await writeAuditLog(req as AuthedRequest, 'enable', 'doctor-account', String(user._id), {
        doctorId: String(doctor._id),
        doctorName: doctor.name,
      })
      res.json({ id: String(user._id), status: user.status })
    } catch (err) {
      next(err)
    }
  },
)

// ============================================================
// Performance analytics (admin)
// ============================================================

// ---------- GET /doctors/:id/stats ----------
doctorsRouter.get(
  '/:id/stats',
  requireRole('ADMIN'),
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const doctor = await DoctorModel.findById(req.params.id)
      if (!doctor) throw new ApiError('Doctor not found', 404)
      const id = String(doctor._id)
      const today = todayStr()
      const [appointments, consultations, prescriptions, assignedPatients] = await Promise.all([
        AppointmentModel.find({ doctorId: id }).select('date time status patientId'),
        ConsultationModel.find({ doctorId: id }).select('createdAt'),
        PrescriptionModel.find({ doctorId: id }).select('issuedAt'),
        PatientModel.find({ assignedDoctorId: id }).select('patientId'),
      ])
      const consulted = new Set(appointments.map((a) => a.patientId))
      const pending = appointments
        .filter((a) => a.status === 'Pending')
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
      const lastConsultationAt = consultations.reduce(
        (latest, c) => {
          const ts = (c as unknown as { createdAt?: string }).createdAt
          return ts && ts > latest ? ts : latest
        },
        '',
      )
      res.json({
        doctorId: id,
        patientsCount: new Set([
          ...assignedPatients.map((p) => String(p._id)),
          ...consulted,
          ...consultations.map((c) => c.patientId ?? ''),
        ].filter(Boolean)).size,
        consultationsCount: consultations.length,
        prescriptionsCount: prescriptions.length,
        appointmentsTotal: appointments.length,
        appointmentsToday: appointments.filter((a) => a.date === today).length,
        completedToday: appointments.filter((a) => a.date === today && a.status === 'Completed').length,
        pendingAppointments: pending.length,
        pendingOldest: pending[0] ? `${pending[0].date} ${pending[0].time}` : null,
        lastConsultationAt,
      })
    } catch (err) {
      next(err)
    }
  },
)

// ============================================================
// Reassignment (admin)
// ============================================================

async function dependencyCounts(doctorId: string): Promise<{
  activeAppointments: number
  assignedPatients: number
  consultations: number
  prescriptions: number
  activeAppointmentIds: string[]
  assignedPatientIds: string[]
}> {
  const [activeAppointments, assignedPatients, consultations, prescriptions] = await Promise.all([
    AppointmentModel.find({ doctorId, status: { $in: ['Pending', 'Confirmed'] } }).select(
      '_id date time patientName status',
    ),
    PatientModel.find({ assignedDoctorId: doctorId }).select('_id firstName lastName patientId'),
    ConsultationModel.countDocuments({ doctorId }),
    PrescriptionModel.countDocuments({ doctorId }),
  ])
  return {
    activeAppointments: activeAppointments.length,
    assignedPatients: assignedPatients.length,
    consultations,
    prescriptions,
    activeAppointmentIds: activeAppointments.map((a) => String(a._id)),
    assignedPatientIds: assignedPatients.map((p) => String(p._id)),
  }
}

// ---------- GET /doctors/:id/dependencies ----------
doctorsRouter.get(
  '/:id/dependencies',
  requireRole('ADMIN'),
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const doctor = await DoctorModel.findById(req.params.id)
      if (!doctor) throw new ApiError('Doctor not found', 404)
      const [counts, appointments, patients] = await Promise.all([
        dependencyCounts(String(doctor._id)),
        AppointmentModel.find({ doctorId: String(doctor._id), status: { $in: ['Pending', 'Confirmed'] } })
          .sort({ date: 1, time: 1 })
          .select('date time patientName type status'),
        PatientModel.find({ assignedDoctorId: String(doctor._id) })
          .sort({ lastName: 1 })
          .select('firstName lastName patientId status'),
      ])
      res.json({ ...counts, appointments, patients })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- POST /doctors/:id/reassign ----------
// Moves selected active appointments and/or assigned patients to a
// replacement doctor. Every move is written to the audit log.
doctorsRouter.post(
  '/:id/reassign',
  requireRole('ADMIN'),
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({
      doctorId: z.string().min(1, 'replacement doctor required'),
      appointmentIds: z.array(z.string()).default([]),
      patientIds: z.array(z.string()).default([]),
      reason: z.string().default(''),
    }),
  }),
  async (req, res, next) => {
    try {
      const sourceId = String(req.params.id)
      const { doctorId, appointmentIds, patientIds, reason } = req.body as {
        doctorId: string
        appointmentIds: string[]
        patientIds: string[]
        reason: string
      }
      if (appointmentIds.length === 0 && patientIds.length === 0) {
        throw new ApiError('Select at least one appointment or patient to reassign', 400)
      }
      const [source, replacement] = await Promise.all([
        DoctorModel.findById(sourceId),
        DoctorModel.findById(doctorId),
      ])
      if (!source) throw new ApiError('Source doctor not found', 404)
      if (!replacement) throw new ApiError('Replacement doctor not found', 404)
      if (String(replacement._id) === sourceId) {
        throw new ApiError('Choose a different doctor to reassign to', 400)
      }
      if (replacement.status !== 'Active') {
        throw new ApiError('The replacement doctor is not available (status must be Active)', 400)
      }

      const [apptResult, patientResult] = await Promise.all([
        appointmentIds.length > 0
          ? AppointmentModel.updateMany(
              { _id: { $in: appointmentIds }, doctorId: sourceId },
              { doctorId, doctorName: replacement.name, department: replacement.department },
            )
          : { modifiedCount: 0 },
        patientIds.length > 0
          ? PatientModel.updateMany(
              { _id: { $in: patientIds }, assignedDoctorId: sourceId },
              { assignedDoctorId: doctorId, department: replacement.department },
            )
          : { modifiedCount: 0 },
      ])

      if (apptResult.modifiedCount > 0) {
        await writeAuditLog(req as AuthedRequest, 'reassign', 'appointment', sourceId, {
          from: source.name,
          to: replacement.name,
          doctorId,
          count: apptResult.modifiedCount,
          reason,
        })
      }
      if (patientResult.modifiedCount > 0) {
        await writeAuditLog(req as AuthedRequest, 'reassign', 'patient', sourceId, {
          from: source.name,
          to: replacement.name,
          doctorId,
          count: patientResult.modifiedCount,
          reason,
        })
      }

      res.json({
        movedAppointments: apptResult.modifiedCount,
        movedPatients: patientResult.modifiedCount,
        to: { id: String(replacement._id), name: replacement.name },
      })
    } catch (err) {
      next(err)
    }
  },
)

// ============================================================
// Scheduling (admin calendar)
// ============================================================

// ---------- GET /doctors/:id/calendar?start&end ----------
doctorsRouter.get(
  '/:id/calendar',
  requireRole('ADMIN'),
  validate({
    params: z.object({ id: z.string() }),
    query: z.object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  }),
  async (req, res, next) => {
    try {
      const doctor = await DoctorModel.findById(req.params.id)
      if (!doctor) throw new ApiError('Doctor not found', 404)
      const { start, end } = queryOf<{ start: string; end: string }>(req)
      const appointments = await AppointmentModel.find({
        doctorId: String(doctor._id),
        date: { $gte: start, $lte: end },
        status: { $ne: 'Cancelled' },
      }).sort({ date: 1, time: 1 })
      const days: {
        date: string
        day: string
        workingDay: boolean
        status: string
        slots: { time: string; end: string; available: boolean }[]
      }[] = []
      const cursor = new Date(`${start}T00:00:00`)
      const endDate = new Date(`${end}T00:00:00`)
      while (cursor <= endDate) {
        const iso = cursor.toISOString().slice(0, 10)
        days.push({
          date: iso,
          day: cursor.toLocaleDateString('en-US', { weekday: 'short' }),
          workingDay: isWorkingDay(doctor, iso),
          status: doctor.status,
          slots: getAvailabilitySlots(doctor, appointments, iso).map((s) => ({
            time: s.time,
            end: s.end,
            available: s.available,
          })),
        })
        cursor.setDate(cursor.getDate() + 1)
      }
      res.json({
        doctor: { id: String(doctor._id), name: doctor.name, department: doctor.department, status: doctor.status },
        appointments,
        days,
      })
    } catch (err) {
      next(err)
    }
  },
)

function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 12; i += 1) {
    password += alphabet[randomBytes(1)[0]! % alphabet.length]
  }
  return password
}
