import { Router } from 'express'
import { z } from 'zod'
import type { HydratedDocument } from 'mongoose'
import { ApiError } from '../utils/ApiError.js'
import { DepartmentModel, type Department } from '../models/Department.js'
import { PatientModel } from '../models/Patient.js'
import { DoctorModel } from '../models/Doctor.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

export const departmentsRouter = Router()

departmentsRouter.use(requireAuth)

// A patient occupies a bed only while admitted or critical (inpatient).
const OCCUPYING_STATUSES = ['Admitted', 'Critical']

// Live occupancy derived from registered patients — the stored occupiedBeds
// field is never treated as the source of truth.
async function occupancyByDepartment(): Promise<Map<string, number>> {
  const patients = await PatientModel.find({}, { status: 1, department: 1 })
  const map = new Map<string, number>()
  for (const p of patients) {
    if (OCCUPYING_STATUSES.includes(p.status)) {
      map.set(p.department, (map.get(p.department) ?? 0) + 1)
    }
  }
  return map
}

async function listWithLiveOccupancy(departments: HydratedDocument<Department>[]) {
  const occ = await occupancyByDepartment()
  return departments.map((d) => {
    const obj = d.toObject()
    return { ...obj, occupiedBeds: occ.get(d.name) ?? 0 }
  })
}

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
    res.json(await listWithLiveOccupancy(departments))
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
      const occ = await occupancyByDepartment()
      res.json({ ...department.toObject(), occupiedBeds: occ.get(department.name) ?? 0 })
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
    const occ = await occupancyByDepartment()
    res.status(201).json({
      ...department.toObject(),
      occupiedBeds: occ.get(department.name) ?? 0,
    })
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
      const occ = await occupancyByDepartment()
      res.json({ ...department.toObject(), occupiedBeds: occ.get(department.name) ?? 0 })
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
