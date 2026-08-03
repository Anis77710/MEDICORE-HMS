import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { HospitalSettingsModel } from '../models/Settings.js'
import { AuditLogModel, StaffModel } from '../models/Staff.js'
import { MedicineModel } from '../models/Pharmacy.js'
import { UserModel } from '../models/User.js'
import { PatientModel } from '../models/Patient.js'
import { DoctorModel } from '../models/Doctor.js'
import { DepartmentModel } from '../models/Department.js'
import { AppointmentModel } from '../models/Appointment.js'
import { InvoiceModel } from '../models/Billing.js'
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { writeAuditLog } from './staff.js'

export const settingsRouter = Router()

settingsRouter.use(requireAuth)

// GET /settings/hospital — auto-creates the singleton settings doc on first access
settingsRouter.get('/hospital', async (_req, res, next) => {
  try {
    let settings = await HospitalSettingsModel.findById('hospital')
    if (!settings) settings = await HospitalSettingsModel.create({ _id: 'hospital' })
    res.json(settings)
  } catch (err) {
    next(err)
  }
})

// PUT /settings/hospital (admin)
settingsRouter.put(
  '/hospital',
  requireRole('ADMIN'),
  validate({
    body: z.object({
      name: z.string().optional(),
      tagline: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      license: z.string().optional(),
      timezone: z.string().optional(),
      currency: z.string().optional(),
      logoUrl: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const settings = await HospitalSettingsModel.findByIdAndUpdate(
        'hospital',
        { $set: req.body },
        { new: true, upsert: true },
      )
      await writeAuditLog(req as AuthedRequest, 'update', 'settings', 'hospital', req.body as Record<string, unknown>)
      res.json(settings)
    } catch (err) {
      next(err)
    }
  },
)

// GET /settings/profile — the signed-in user's own profile
settingsRouter.get('/profile', async (req, res, next) => {
  try {
    const { userId } = req as AuthedRequest
    const user = await UserModel.findById(userId)
    if (!user) throw new ApiError('User not found', 404)
    res.json({ name: user.name, email: user.email, phone: user.phone, role: user.role })
  } catch (err) {
    next(err)
  }
})

// PUT /settings/profile — update own name/phone
settingsRouter.put(
  '/profile',
  validate({
    body: z.object({
      name: z.string().min(2).optional(),
      phone: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const { userId } = req as AuthedRequest
      const user = await UserModel.findByIdAndUpdate(userId, { $set: req.body }, { new: true })
      if (!user) throw new ApiError('User not found', 404)
      res.json({ name: user.name, email: user.email, phone: user.phone, role: user.role })
    } catch (err) {
      next(err)
    }
  },
)

// GET /settings/users (admin) — accounts in the system
settingsRouter.get('/users', requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const users = await UserModel.find().sort({ createdAt: -1 }).limit(200)
    res.json(
      users.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })),
    )
  } catch (err) {
    next(err)
  }
})

// GET /settings/audit-log (admin)
settingsRouter.get('/audit-log', requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const entries = await AuditLogModel.find().sort({ createdAt: -1 }).limit(200)
    res.json(entries)
  } catch (err) {
    next(err)
  }
})

// GET /settings/backup (admin) — JSON snapshot of the whole database
settingsRouter.get('/backup', requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const [users, patients, doctors, departments, appointments, invoices, medicines, staff] =
      await Promise.all([
        UserModel.find(),
        PatientModel.find(),
        DoctorModel.find(),
        DepartmentModel.find(),
        AppointmentModel.find(),
        InvoiceModel.find(),
        MedicineModel.find(),
        StaffModel.find(),
      ])
    res.json({
      generatedAt: new Date().toISOString(),
      users,
      patients,
      doctors,
      departments,
      appointments,
      invoices,
      medicines,
      staff,
    })
  } catch (err) {
    next(err)
  }
})
