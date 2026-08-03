import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { PatientModel } from '../models/Patient.js'
import { MedicalRecordModel, DocumentModel } from '../models/Staff.js'
import { PrescriptionModel } from '../models/Pharmacy.js'
import { InvoiceModel } from '../models/Billing.js'
import { nextSequence } from '../models/Counter.js'
import { requireAuth } from '../middleware/auth.js'
import { validate, queryOf } from '../middleware/validate.js'

export const patientsRouter = Router()

patientsRouter.use(requireAuth)

const GENDERS = ['Male', 'Female', 'Other'] as const
const STATUSES = ['Admitted', 'Outpatient', 'Critical', 'Recovered', 'Pending'] as const

const patientBody = z.object({
  firstName: z.string().min(1, 'first name required'),
  lastName: z.string().min(1, 'last name required'),
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'valid email required').default(''),
  phone: z.string().default(''),
  dob: z.string().default(''),
  gender: z.enum(GENDERS).default('Other'),
  bloodGroup: z.string().default(''),
  address: z.string().default(''),
  emergencyContact: z.string().default(''),
  status: z.enum(STATUSES).default('Pending'),
  department: z.string().default('General'),
  assignedDoctorId: z.string().optional(),
  admittedAt: z.string().optional(),
  lastVisit: z.string().default(''),
  allergies: z.array(z.string()).default([]),
  insurance: z.string().default(''),
  notes: z.string().optional(),
})

const listQuery = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  department: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

// GET /patients?search&status&department&page&limit
patientsRouter.get(
  '/',
  validate({ query: listQuery }),
  async (req, res, next) => {
    try {
      const { search, status, department, page = 1, limit = 10 } = queryOf<{
        search?: string
        status?: string
        department?: string
        page?: number
        limit?: number
      }>(req)
      const filter: Record<string, unknown> = {}
      if (search) {
        const s = search.toLowerCase()
        filter.$or = [
          { firstName: { $regex: s, $options: 'i' } },
          { lastName: { $regex: s, $options: 'i' } },
          { patientId: { $regex: s, $options: 'i' } },
          { email: { $regex: s, $options: 'i' } },
        ]
      }
      if (status && status !== 'All') filter.status = status
      if (department && department !== 'All') filter.department = department

      const [items, total] = await Promise.all([
        PatientModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        PatientModel.countDocuments(filter),
      ])
      res.json({ items, total, page, limit })
    } catch (err) {
      next(err)
    }
  },
)

// GET /patients/:id
patientsRouter.get(
  '/:id',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const patient = await PatientModel.findById(req.params.id)
      if (!patient) throw new ApiError('Patient not found', 404)
      res.json(patient)
    } catch (err) {
      next(err)
    }
  },
)

// POST /patients
patientsRouter.post('/', validate({ body: patientBody }), async (req, res, next) => {
  try {
    const seq = await nextSequence('patient')
    const patient = await PatientModel.create({
      ...req.body,
      patientId: `P-${10400 + seq}`,
      lastVisit: req.body.lastVisit || new Date().toISOString().slice(0, 10),
    })
    res.status(201).json(patient)
  } catch (err) {
    next(err)
  }
})

// PUT /patients/:id
patientsRouter.put(
  '/:id',
  validate({ params: z.object({ id: z.string() }), body: patientBody.partial() }),
  async (req, res, next) => {
    try {
      const patient = await PatientModel.findByIdAndUpdate(req.params.id, req.body, { new: true })
      if (!patient) throw new ApiError('Patient not found', 404)
      res.json(patient)
    } catch (err) {
      next(err)
    }
  },
)

// DELETE /patients/:id
patientsRouter.delete(
  '/:id',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const patient = await PatientModel.findByIdAndDelete(req.params.id)
      if (!patient) throw new ApiError('Patient not found', 404)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  },
)

// GET /patients/:id/records
patientsRouter.get(
  '/:id/records',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const records = await MedicalRecordModel.find({ patientId: req.params.id }).sort({ date: -1 })
      res.json(records)
    } catch (err) {
      next(err)
    }
  },
)

// GET /patients/:id/documents
patientsRouter.get(
  '/:id/documents',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const docs = await DocumentModel.find({ patientId: req.params.id }).sort({ date: -1 })
      res.json(docs)
    } catch (err) {
      next(err)
    }
  },
)

// GET /patients/:id/prescriptions
patientsRouter.get(
  '/:id/prescriptions',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const rxs = await PrescriptionModel.find({ patientId: req.params.id }).sort({ issuedAt: -1 })
      res.json(rxs)
    } catch (err) {
      next(err)
    }
  },
)

// GET /patients/:id/bills
patientsRouter.get(
  '/:id/bills',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const bills = await InvoiceModel.find({ patientId: req.params.id }).sort({ issuedAt: -1 })
      res.json(bills)
    } catch (err) {
      next(err)
    }
  },
)
