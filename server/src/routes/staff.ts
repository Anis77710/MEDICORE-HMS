import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { StaffModel, AuditLogModel } from '../models/Staff.js'
import { UserModel } from '../models/User.js'
import { RefreshTokenModel } from '../models/RefreshToken.js'
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js'
import { validate, queryOf } from '../middleware/validate.js'
import {
  firstNameOf,
  generateTempPassword,
  hospitalCredentialContext,
  loginUsername,
  nextStaffId,
  PASSWORD_MIN,
  sendCredentialsEmail,
  sendPasswordResetEmail,
} from '../utils/credentials.js'

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
    actorRole: req.userRole,
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
  birthYear: z.coerce.number().int().min(1900).max(2100),
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
// Adding a staff member also creates their login account automatically
// with the hospital's credential scheme:
//   staff ID  NUR-0043            (primary identifier)
//   username  MHrani.0043@medicore.hms
//   password  random temporary password (must change on first login)
// Credentials are emailed to the member's address.
staffRouter.post('/', requireRole('ADMIN'), validate({ body: staffBody }), async (req, res, next) => {
  try {
    const email = String(req.body.email).toLowerCase()
    const hospital = await hospitalCredentialContext()
    const staffId = await nextStaffId((req.body as { role: string }).role)
    const username = loginUsername({
      hospitalCode: hospital.code,
      firstName: firstNameOf(String(req.body.name)),
      staffId,
      loginDomain: hospital.loginDomain,
    })
    if ((req.body as { role: string }).role !== 'PATIENT' && (await UserModel.findOne({ username }))) {
      throw new ApiError(`The login username ${username} is already taken`, 409)
    }
    const member = await StaffModel.create({ ...req.body, staffId })
    let credentials: { username: string; password: string } | null = null
    if (member.role !== 'PATIENT') {
      if (!(await UserModel.findOne({ email }))) {
        const password = generateTempPassword()
        await UserModel.create({
          name: member.name,
          email,
          username,
          staffId,
          phone: member.phone,
          role: member.role,
          department: member.department,
          passwordHash: password,
          mustChangePassword: true,
        })
        await sendCredentialsEmail(email, {
          name: member.name,
          role: roleLabel(member.role),
          username,
          password,
          hospitalName: hospital.name,
        })
        credentials = { username, password }
      }
    }
    await writeAuditLog(req as AuthedRequest, 'create', 'staff', String(member._id), {
      name: member.name,
      role: member.role,
      staffId,
      accountCreated: credentials !== null,
    })
    res.status(201).json({ ...member.toJSON(), credentials })
  } catch (err) {
    next(err)
  }
})

function roleLabel(role: string): string {
  const labels: Record<string, string> = { ADMIN: 'Hospital Administrator', NURSE: 'Nurse', DOCTOR: 'Doctor', STAFF: 'Staff' }
  return labels[role] ?? role
}

staffRouter.put(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: z.object({ id: z.string() }), body: staffBody.partial() }),
  async (req, res, next) => {
    try {
      const prev = await StaffModel.findById(req.params.id)
      const member = await StaffModel.findByIdAndUpdate(req.params.id, req.body, { new: true })
      if (!member) throw new ApiError('Staff member not found', 404)
      if (prev) {
        const prevEmail = prev.email.toLowerCase()
        const user = await UserModel.findOne({ email: prevEmail })
        if (user) {
          const patch: Record<string, unknown> = {
            name: member.name,
            role: member.role,
            department: member.department,
          }
          const newEmail = member.email.toLowerCase()
          if (newEmail !== prevEmail) {
            const taken = await UserModel.findOne({ email: newEmail, _id: { $ne: user._id } })
            if (!taken) patch.email = newEmail
          }
          await UserModel.updateOne({ _id: user._id }, patch)
        }
      }
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

// ---------- POST /staff/:id/reset-password (admin) ----------
// Generates a cryptographically-random temporary password and forces a
// change on the member's next login (unless an explicit password is
// supplied, which clears the forced change). Temporary password is
// emailed; every existing session is invalidated.
staffRouter.post(
  '/:id/reset-password',
  requireRole('ADMIN'),
  validate({
    params: z.object({ id: z.string() }),
    body: z.object({
      password: z.string().min(PASSWORD_MIN, `password must be at least ${PASSWORD_MIN} characters`).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const member = await StaffModel.findById(req.params.id)
      if (!member) throw new ApiError('Staff member not found', 404)
      const user = await UserModel.findOne({ email: member.email.toLowerCase() })
      if (!user) throw new ApiError('No login account exists for this member yet', 404)
      const explicit = (req.body as { password?: string }).password
      const tempPassword = explicit ?? generateTempPassword()
      user.passwordHash = tempPassword
      user.mustChangePassword = !explicit
      user.tokenVersion += 1
      await user.save()
      await RefreshTokenModel.updateMany({ userId: String(user._id) }, { revokedAt: new Date() })
      if (!explicit) {
        const hospital = await hospitalCredentialContext()
        await sendPasswordResetEmail(user.email, {
          name: member.name,
          role: roleLabel(member.role),
          username: user.username ?? loginUsername({
            hospitalCode: hospital.code,
            firstName: firstNameOf(member.name),
            staffId: member.staffId ?? user.staffId ?? '0000',
            loginDomain: hospital.loginDomain,
          }),
          password: tempPassword,
          hospitalName: hospital.name,
        })
      }
      await writeAuditLog(req as AuthedRequest, 'reset-password', 'staff-account', String(user._id), {
        memberId: String(member._id),
        memberName: member.name,
        generated: !explicit,
      })
      res.json({ success: true, email: user.email, ...(explicit ? {} : { tempPassword }) })
    } catch (err) {
      next(err)
    }
  },
)

// ---------- POST /staff/:id/disable-login / enable-login (admin) ----------
staffRouter.post(
  '/:id/disable-login',
  requireRole('ADMIN'),
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const member = await StaffModel.findById(req.params.id)
      if (!member) throw new ApiError('Staff member not found', 404)
      const user = await UserModel.findOne({ email: member.email.toLowerCase() })
      if (!user) throw new ApiError('No login account exists for this member yet', 404)
      if (user.status === 'Disabled') {
        return res.json({ id: String(user._id), status: user.status })
      }
      user.status = 'Disabled'
      user.tokenVersion += 1
      await user.save()
      await RefreshTokenModel.updateMany({ userId: String(user._id) }, { revokedAt: new Date() })
      await writeAuditLog(req as AuthedRequest, 'disable', 'staff-account', String(user._id), {
        memberId: String(member._id),
        memberName: member.name,
      })
      res.json({ id: String(user._id), status: user.status })
    } catch (err) {
      next(err)
    }
  },
)

staffRouter.post(
  '/:id/enable-login',
  requireRole('ADMIN'),
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const member = await StaffModel.findById(req.params.id)
      if (!member) throw new ApiError('Staff member not found', 404)
      const user = await UserModel.findOne({ email: member.email.toLowerCase() })
      if (!user) throw new ApiError('No login account exists for this member yet', 404)
      if (user.status === 'Active') {
        return res.json({ id: String(user._id), status: user.status })
      }
      user.status = 'Active'
      await user.save()
      await writeAuditLog(req as AuthedRequest, 'enable', 'staff-account', String(user._id), {
        memberId: String(member._id),
        memberName: member.name,
      })
      res.json({ id: String(user._id), status: user.status })
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
