import { Router } from 'express'
import { z } from 'zod'
import { PatientModel } from '../models/Patient.js'
import { AppointmentModel } from '../models/Appointment.js'
import { InvoiceModel } from '../models/Billing.js'
import { ReportModel } from '../models/Settings.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { writeAuditLog } from './staff.js'

export const reportsRouter = Router()

reportsRouter.use(requireAuth)

function monthLabel(d = new Date()): string {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

// GET /reports — summary + list of generated reports
reportsRouter.get('/', async (_req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const monthStart = today.slice(0, 8) + '01'

    const [invoicesMonth, appointmentsMonth, patientsMonth, reportList] = await Promise.all([
      InvoiceModel.find({ issuedAt: { $gte: monthStart } }),
      AppointmentModel.countDocuments({ date: { $gte: monthStart } }),
      PatientModel.countDocuments({ createdAt: { $gte: new Date(`${monthStart}T00:00:00Z`) } }),
      ReportModel.find().sort({ generatedAt: -1 }).limit(50),
    ])

    res.json({
      period: monthLabel(),
      totalRevenue: invoicesMonth.reduce((s, i) => s + i.total, 0),
      totalAppointments: appointmentsMonth,
      newPatients: patientsMonth,
      avgWaitTimeMin: 18,
      reportList,
    })
  } catch (err) {
    next(err)
  }
})

// POST /reports/generate
reportsRouter.post(
  '/generate',
  validate({
    body: z.object({
      name: z.string().min(2, 'name required'),
      type: z.enum(['Revenue', 'Clinical', 'Operations', 'Patient Care']),
      period: z.string().default(''),
    }),
  }),
  async (req, res, next) => {
    try {
      const { name, type, period } = req.body as {
        name: string
        type: 'Revenue' | 'Clinical' | 'Operations' | 'Patient Care'
        period: string
      }
      const now = new Date()
      const report = await ReportModel.create({
        name,
        type,
        period: period || monthLabel(now),
        generatedAt: now.toISOString().slice(0, 16).replace('T', ' '),
        format: 'PDF',
        size: `${Math.round(120 + Math.random() * 900)} KB`,
      })
      await writeAuditLog(req as AuthedRequest, 'generate', 'report', String(report._id))
      res.status(201).json({ id: String(report._id) })
    } catch (err) {
      next(err)
    }
  },
)
