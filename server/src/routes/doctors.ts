import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { DoctorModel } from '../models/Doctor.js'
import { requireAuth } from '../middleware/auth.js'
import { validate, queryOf } from '../middleware/validate.js'

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
  consultationFee: z.coerce.number().min(0).default(0),
  schedule: z.array(z.string()).default([]),
  status: z.enum(['Active', 'On Leave', 'Unavailable']).default('Active'),
})

const listQuery = z.object({
  search: z.string().optional(),
  department: z.string().optional(),
})

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

doctorsRouter.get(
  '/:id',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const doctor = await DoctorModel.findById(req.params.id)
      if (!doctor) throw new ApiError('Doctor not found', 404)
      res.json(doctor)
    } catch (err) {
      next(err)
    }
  },
)

doctorsRouter.post('/', validate({ body: doctorBody }), async (req, res, next) => {
  try {
    const doctor = await DoctorModel.create(req.body)
    res.status(201).json(doctor)
  } catch (err) {
    next(err)
  }
})

doctorsRouter.put(
  '/:id',
  validate({ params: z.object({ id: z.string() }), body: doctorBody.partial() }),
  async (req, res, next) => {
    try {
      const doctor = await DoctorModel.findByIdAndUpdate(req.params.id, req.body, { new: true })
      if (!doctor) throw new ApiError('Doctor not found', 404)
      res.json(doctor)
    } catch (err) {
      next(err)
    }
  },
)

doctorsRouter.delete(
  '/:id',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const doctor = await DoctorModel.findByIdAndDelete(req.params.id)
      if (!doctor) throw new ApiError('Doctor not found', 404)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  },
)
