import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { ConsultationModel } from '../models/Consultation.js'
import { PrescriptionModel } from '../models/Pharmacy.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validate, queryOf } from '../middleware/validate.js'

// ============================================================
// Admin clinical oversight - read-only access to every doctor's
// consultations and prescriptions. Viewing any patient's clinical
// record is restricted to ADMIN so oversight stays auditable.
// ============================================================

export const consultationsRouter = Router()

consultationsRouter.use(requireAuth, requireRole('ADMIN'))

const listQuery = z.object({
  search: z.string().optional(),
  doctorId: z.string().optional(),
  patientId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
})

// GET /consultations?search&doctorId&patientId&from&to
consultationsRouter.get('/', validate({ query: listQuery }), async (req, res, next) => {
  try {
    const { search, doctorId, patientId, from, to, limit } = queryOf<{
      search?: string
      doctorId?: string
      patientId?: string
      from?: string
      to?: string
      limit: number
    }>(req)
    const filter: Record<string, unknown> = {}
    if (doctorId) filter.doctorId = doctorId
    if (patientId) filter.patientId = patientId
    if (search) {
      const s = search.toLowerCase()
      filter.$or = [
        { patientName: { $regex: s, $options: 'i' } },
        { doctorName: { $regex: s, $options: 'i' } },
        { chiefComplaint: { $regex: s, $options: 'i' } },
        { 'diagnosis.primary': { $regex: s, $options: 'i' } },
      ]
    }
    if (from || to) {
      const range: Record<string, Date | string> = {}
      if (from) range.$gte = new Date(`${from}T00:00:00.000Z`)
      if (to) range.$lte = new Date(`${to}T23:59:59.999Z`)
      filter.createdAt = range
    }
    const consultations = await ConsultationModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
    res.json(consultations)
  } catch (err) {
    next(err)
  }
})

// GET /consultations/:id - full record, including the linked prescription
consultationsRouter.get(
  '/:id',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const consultation = await ConsultationModel.findById(req.params.id)
      if (!consultation) throw new ApiError('Consultation not found', 404)
      const prescription = consultation.prescriptionId
        ? await PrescriptionModel.findById(consultation.prescriptionId)
        : null
      res.json({
        ...consultation.toJSON(),
        prescription: prescription ? prescription.toJSON() : null,
      })
    } catch (err) {
      next(err)
    }
  },
)
