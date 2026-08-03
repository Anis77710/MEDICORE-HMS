import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { DepartmentModel } from '../models/Department.js'
import { DoctorModel } from '../models/Doctor.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

export const departmentsRouter = Router()

departmentsRouter.use(requireAuth)

const departmentBody = z.object({
  name: z.string().min(2, 'name required'),
  headDoctorId: z.string().default(''),
  bedCount: z.coerce.number().min(0).default(0),
  occupiedBeds: z.coerce.number().min(0).default(0),
  doctorsCount: z.coerce.number().min(0).default(0),
  patientsCount: z.coerce.number().min(0).default(0),
  color: z.string().default('#0e7490'),
  icon: z.string().default('Stethoscope'),
  description: z.string().default(''),
})

departmentsRouter.get('/', async (_req, res, next) => {
  try {
    const departments = await DepartmentModel.find().sort({ name: 1 })
    res.json(departments)
  } catch (err) {
    next(err)
  }
})

departmentsRouter.get(
  '/:id',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const department = await DepartmentModel.findById(req.params.id)
      if (!department) throw new ApiError('Department not found', 404)
      res.json(department)
    } catch (err) {
      next(err)
    }
  },
)

departmentsRouter.post('/', validate({ body: departmentBody }), async (req, res, next) => {
  try {
    const { headDoctorId, ...rest } = req.body as { headDoctorId: string } & Record<string, unknown>
    let headDoctorName = 'Unassigned'
    if (headDoctorId) {
      const head = await DoctorModel.findById(headDoctorId)
      if (head) headDoctorName = head.name
    }
    const department = await DepartmentModel.create({ ...rest, headDoctorId, headDoctorName })
    res.status(201).json(department)
  } catch (err) {
    next(err)
  }
})

departmentsRouter.put(
  '/:id',
  validate({ params: z.object({ id: z.string() }), body: departmentBody.partial() }),
  async (req, res, next) => {
    try {
      const { headDoctorId, ...rest } = req.body as { headDoctorId?: string } & Record<string, unknown>
      let headDoctorName: string | undefined
      if (headDoctorId) {
        const head = await DoctorModel.findById(headDoctorId)
        headDoctorName = head?.name ?? 'Unassigned'
      }
      const department = await DepartmentModel.findByIdAndUpdate(
        req.params.id,
        { ...rest, ...(headDoctorId !== undefined ? { headDoctorId, headDoctorName } : {}) },
        { new: true },
      )
      if (!department) throw new ApiError('Department not found', 404)
      res.json(department)
    } catch (err) {
      next(err)
    }
  },
)

departmentsRouter.delete(
  '/:id',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const department = await DepartmentModel.findByIdAndDelete(req.params.id)
      if (!department) throw new ApiError('Department not found', 404)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  },
)
