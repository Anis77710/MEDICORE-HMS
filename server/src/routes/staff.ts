import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { StaffModel, AuditLogModel } from '../models/Staff.js'
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js'
import { validate, queryOf } from '../middleware/validate.js'

export const staffRouter = Router()

staffRouter.use(requireAuth)

export async function writeAuditLog(
  req: AuthedRequest,
  action: string,
  resource: string,
  resourceId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await AuditLogModel.create({
    actor: req.userName ?? req.userId,
    actorId: req.userId,
    action,
    resource,
    resourceId,
    details,
  })
}

const staffBody = z.object({
  name: z.string().min(2, 'name required'),
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'valid email required'),
  phone: z.string().default(''),
  role: z.enum(['ADMIN', 'DOCTOR', 'NURSE', 'STAFF', 'PATIENT']).default('STAFF'),
  department: z.string().default('General'),
  shift: z.enum(['Morning', 'Evening', 'Night', 'Rotating']).default('Morning'),
  joinedAt: z.string().default(''),
  salary: z.coerce.number().min(0).default(0),
  status: z.enum(['Active', 'On Leave', 'Resigned']).default('Active'),
})

const staffListQuery = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
})

// GET /staff?search&role
staffRouter.get('/', validate({ query: staffListQuery }), async (req, res, next) => {
  try {
    const { search, role } = queryOf<{ search?: string; role?: string }>(req)
    const filter: Record<string, unknown> = {}
    if (search) {
      const s = search.toLowerCase()
      filter.$or = [
        { name: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
      ]
    }
    if (role && role !== 'All') filter.role = role
    const members = await StaffModel.find(filter).sort({ name: 1 })
    res.json(members)
  } catch (err) {
    next(err)
  }
})

// Mutations are admin-only.
staffRouter.post('/', requireRole('ADMIN'), validate({ body: staffBody }), async (req, res, next) => {
  try {
    const member = await StaffModel.create(req.body)
    await writeAuditLog(req as AuthedRequest, 'create', 'staff', String(member._id))
    res.status(201).json(member)
  } catch (err) {
    next(err)
  }
})

staffRouter.put(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: z.object({ id: z.string() }), body: staffBody.partial() }),
  async (req, res, next) => {
    try {
      const member = await StaffModel.findByIdAndUpdate(req.params.id, req.body, { new: true })
      if (!member) throw new ApiError('Staff member not found', 404)
      await writeAuditLog(req as AuthedRequest, 'update', 'staff', String(member._id))
      res.json(member)
    } catch (err) {
      next(err)
    }
  },
)

staffRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const member = await StaffModel.findByIdAndDelete(req.params.id)
      if (!member) throw new ApiError('Staff member not found', 404)
      await writeAuditLog(req as AuthedRequest, 'delete', 'staff', String(req.params.id))
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  },
)

// GET /staff/audit-log (admin)
staffRouter.get('/audit-log', requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const entries = await AuditLogModel.find().sort({ createdAt: -1 }).limit(200)
    res.json(entries)
  } catch (err) {
    next(err)
  }
})
