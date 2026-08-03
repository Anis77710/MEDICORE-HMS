import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { MedicineModel, PrescriptionModel } from '../models/Pharmacy.js'
import { requireAuth } from '../middleware/auth.js'
import { validate, queryOf } from '../middleware/validate.js'

export const pharmacyRouter = Router()

pharmacyRouter.use(requireAuth)

// ---------- Medicines ----------

const medicineBody = z.object({
  name: z.string().min(1, 'name required'),
  genericName: z.string().default(''),
  category: z.string().default('General'),
  manufacturer: z.string().default(''),
  price: z.coerce.number().min(0, 'price must be >= 0'),
  stock: z.coerce.number().int().min(0).default(0),
  reorderLevel: z.coerce.number().int().min(0).default(0),
  expiryDate: z.string().default(''),
  batch: z.string().default(''),
})

interface MedicineJson {
  stock: number
  reorderLevel: number
  status?: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Expiring Soon'
}

function withStatus(m: MedicineJson): MedicineJson {
  m.status =
    m.stock === 0 ? 'Out of Stock' : m.stock <= m.reorderLevel ? 'Low Stock' : 'In Stock'
  return m
}

const medicineListQuery = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
})

pharmacyRouter.get('/medicines', validate({ query: medicineListQuery }), async (req, res, next) => {
  try {
    const { search, category } = queryOf<{ search?: string; category?: string }>(req)
    const filter: Record<string, unknown> = {}
    if (search) {
      const s = search.toLowerCase()
      filter.$or = [
        { name: { $regex: s, $options: 'i' } },
        { genericName: { $regex: s, $options: 'i' } },
      ]
    }
    if (category && category !== 'All') filter.category = category
    const medicines = await MedicineModel.find(filter).sort({ name: 1 })
    res.json(medicines.map((m) => withStatus(m.toJSON() as unknown as MedicineJson)))
  } catch (err) {
    next(err)
  }
})

pharmacyRouter.post('/medicines', validate({ body: medicineBody }), async (req, res, next) => {
  try {
    const medicine = await MedicineModel.create(req.body)
    res.status(201).json(withStatus(medicine.toJSON() as unknown as MedicineJson))
  } catch (err) {
    next(err)
  }
})

pharmacyRouter.put(
  '/medicines/:id',
  validate({ params: z.object({ id: z.string() }), body: medicineBody.partial() }),
  async (req, res, next) => {
    try {
      const medicine = await MedicineModel.findByIdAndUpdate(req.params.id, req.body, { new: true })
      if (!medicine) throw new ApiError('Medicine not found', 404)
      res.json(withStatus(medicine.toJSON() as unknown as MedicineJson))
    } catch (err) {
      next(err)
    }
  },
)

pharmacyRouter.delete(
  '/medicines/:id',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const medicine = await MedicineModel.findByIdAndDelete(req.params.id)
      if (!medicine) throw new ApiError('Medicine not found', 404)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  },
)

// ---------- Prescriptions ----------

const prescriptionBody = z.object({
  patientId: z.string().min(1, 'patient required'),
  patientName: z.string().min(1, 'patient name required'),
  doctorId: z.string().min(1, 'doctor required'),
  doctorName: z.string().min(1, 'doctor name required'),
  medicines: z
    .array(
      z.object({
        name: z.string().min(1),
        dosage: z.string().default(''),
        frequency: z.string().default(''),
        durationDays: z.coerce.number().int().min(1).default(7),
      }),
    )
    .min(1, 'at least one medicine required'),
})

const prescriptionListQuery = z.object({ search: z.string().optional() })

pharmacyRouter.get('/prescriptions', validate({ query: prescriptionListQuery }), async (req, res, next) => {
  try {
    const { search } = queryOf<{ search?: string }>(req)
    const filter: Record<string, unknown> = {}
    if (search) {
      const s = search.toLowerCase()
      filter.$or = [
        { patientName: { $regex: s, $options: 'i' } },
        { doctorName: { $regex: s, $options: 'i' } },
      ]
    }
    const prescriptions = await PrescriptionModel.find(filter).sort({ issuedAt: -1 })
    res.json(prescriptions)
  } catch (err) {
    next(err)
  }
})

pharmacyRouter.post('/prescriptions', validate({ body: prescriptionBody }), async (req, res, next) => {
  try {
    const prescription = await PrescriptionModel.create({
      ...req.body,
      issuedAt: new Date().toISOString().slice(0, 10),
      status: 'Active',
    })
    res.status(201).json(prescription)
  } catch (err) {
    next(err)
  }
})
