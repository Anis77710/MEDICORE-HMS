import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { InvoiceModel, PaymentModel } from '../models/Billing.js'
import { PatientModel } from '../models/Patient.js'
import { ConsultationModel } from '../models/Consultation.js'
import { DoctorModel } from '../models/Doctor.js'
import { StaffModel } from '../models/Staff.js'
import { PrescriptionModel, MedicineModel } from '../models/Pharmacy.js'
import { makeReadableId } from '../models/Counter.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { validate, queryOf } from '../middleware/validate.js'
import { UserModel } from '../models/User.js'

export const billingRouter = Router()

// Only billing-assigned staff may handle billing: ADMIN is always allowed,
// STAFF only when assigned to the Billing department. Nurses, doctors and
// staff from other departments are blocked at the API level.
async function requireBillingAccess(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const { userRole, userEmail, userDepartment } = req as AuthedRequest
    if (userRole === 'ADMIN') {
      next()
      return
    }
    if (userRole === 'STAFF') {
      if (userDepartment === 'Billing') {
        next()
        return
      }
      const staff = await StaffModel.findOne({ email: userEmail.toLowerCase() }).lean()
      if (staff?.department === 'Billing') {
        if (!userDepartment) {
          await UserModel.updateOne({ email: userEmail.toLowerCase() }, { department: 'Billing' })
        }
        next()
        return
      }
    }
    next(new ApiError('Only billing staff can manage billing', 403))
  } catch (err) {
    next(err)
  }
}

billingRouter.use(requireAuth, requireBillingAccess)

const TAX_RATE = 0.05

// Daily ward charge in NPR for admitted (inpatient) patients.
const BED_RATE_PER_DAY = 1500

const invoiceBody = z.object({
  patientId: z.string().min(1, 'patient required'),
  description: z.string().default(''),
  items: z
    .array(
      z.object({
        description: z.string().min(1, 'item description required'),
        amount: z.coerce.number().min(0),
      }),
    )
    .min(1, 'at least one line item required'),
  discount: z.coerce.number().min(0).default(0),
  dueDate: z.string().default(''),
})

const invoiceListQuery = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
})

// GET /billing/invoices?search&status
billingRouter.get('/invoices', validate({ query: invoiceListQuery }), async (req, res, next) => {
  try {
    const { search, status } = queryOf<{ search?: string; status?: string }>(req)
    const filter: Record<string, unknown> = {}
    if (search) {
      const s = search.toLowerCase()
      filter.$or = [
        { invoiceNo: { $regex: s, $options: 'i' } },
        { patientName: { $regex: s, $options: 'i' } },
      ]
    }
    if (status && status !== 'All') filter.status = status
    const invoices = await InvoiceModel.find(filter).sort({ issuedAt: -1 })
    res.json(invoices)
  } catch (err) {
    next(err)
  }
})

// GET /billing/auto-draft?patientId - builds line items automatically from
// the patient's activity: consultations (attending doctor's fee), prescribed
// medicines (catalog price) and bed charges (daily ward rate while admitted).
billingRouter.get(
  '/auto-draft',
  validate({ query: z.object({ patientId: z.string().min(1, 'patient required') }) }),
  async (req, res, next) => {
    try {
      const { patientId } = queryOf<{ patientId: string }>(req)
      const patient = await PatientModel.findById(patientId)
      if (!patient) throw new ApiError('Patient not found', 404)

      const items: { description: string; amount: number }[] = []

      const consultations = await ConsultationModel.find({ patientId })
      const doctorIds = [...new Set(consultations.map((c) => c.doctorId))]
      const feeByDoctor = new Map(
        (await DoctorModel.find({ _id: { $in: doctorIds } })).map((d) => [
          String(d._id),
          d.consultationFee ?? 0,
        ]),
      )
      for (const c of consultations) {
        const fee = feeByDoctor.get(String(c.doctorId)) ?? 0
        if (fee > 0) items.push({ description: `Consultation - ${c.doctorName}`, amount: fee })
      }

      const prescriptions = await PrescriptionModel.find({ patientId })
      const medicineNames = [
        ...new Set(prescriptions.flatMap((p) => p.medicines.map((m) => m.name.trim()))),
      ].filter(Boolean)
      const priceByName = new Map(
        (await MedicineModel.find({ name: { $in: medicineNames } })).map((m) => [
          m.name.toLowerCase(),
          m.price ?? 0,
        ]),
      )
      for (const name of medicineNames) {
        const price = priceByName.get(name.toLowerCase()) ?? 0
        if (price > 0) items.push({ description: `Medicine - ${name}`, amount: price })
      }

      if (
        (patient.status === 'Admitted' || patient.status === 'Critical') &&
        patient.admittedAt
      ) {
        const start = new Date(`${patient.admittedAt}T00:00:00`)
        const days = Math.max(1, Math.ceil((Date.now() - start.getTime()) / 86400000))
        items.push({
          description: `Bed charges - ${days} day(s) @ NPR ${BED_RATE_PER_DAY}/day`,
          amount: days * BED_RATE_PER_DAY,
        })
      }

      const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
      const tax = Math.round(subtotal * TAX_RATE * 100) / 100
      res.json({
        patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        items,
        subtotal,
        tax,
        total: Math.round((subtotal + tax) * 100) / 100,
      })
    } catch (err) {
      next(err)
    }
  },
)

billingRouter.get(
  '/invoices/:id',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const invoice = await InvoiceModel.findById(req.params.id)
      if (!invoice) throw new ApiError('Invoice not found', 404)
      res.json(invoice)
    } catch (err) {
      next(err)
    }
  },
)

// POST /billing/invoices - server computes subtotal, tax, total
billingRouter.post('/invoices', validate({ body: invoiceBody }), async (req, res, next) => {
  try {
    const { patientId, items, discount, ...rest } = req.body as {
      patientId: string
      description: string
      items: { description: string; amount: number }[]
      discount: number
      dueDate: string
    }
    const patient = await PatientModel.findById(patientId)
    if (!patient) throw new ApiError('Patient not found', 404)

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100
    const total = Math.round((subtotal - discount + tax) * 100) / 100

    const invoice = await InvoiceModel.create({
      ...rest,
      invoiceNo: await makeReadableId('invoice', patient.firstName),
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      items,
      subtotal,
      discount,
      tax,
      total,
      amountPaid: 0,
      status: 'Pending',
      issuedAt: new Date().toISOString().slice(0, 10),
    })
    res.status(201).json(invoice)
  } catch (err) {
    next(err)
  }
})

// POST /billing/payments - records payment and updates the invoice
billingRouter.post(
  '/payments',
  validate({
    body: z.object({
      invoiceId: z.string().min(1, 'invoice required'),
      amount: z.coerce.number().min(0.01, 'amount must be positive'),
      method: z.enum(['Card', 'Cash', 'Bank Transfer', 'Insurance', 'UPI']),
    }),
  }),
  async (req, res, next) => {
    try {
      const { invoiceId, amount, method } = req.body as {
        invoiceId: string
        amount: number
        method: 'Card' | 'Cash' | 'Bank Transfer' | 'Insurance' | 'UPI'
      }
      const invoice = await InvoiceModel.findById(invoiceId)
      if (!invoice) throw new ApiError('Invoice not found', 404)

      const amountPaid = Math.min(invoice.amountPaid + amount, invoice.total)
      const status =
        amountPaid >= invoice.total ? 'Paid' : invoice.status === 'Overdue' ? 'Overdue' : 'Pending'

      const [payment] = await Promise.all([
        PaymentModel.create({
          invoiceId,
          amount,
          method,
          reference: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
          paidAt: new Date().toISOString().slice(0, 10),
        }),
        InvoiceModel.updateOne({ _id: invoice._id }, { amountPaid, status }),
      ])
      const updated = await InvoiceModel.findById(invoiceId)
      res.status(201).json({ invoice: updated, payment })
    } catch (err) {
      next(err)
    }
  },
)

// GET /billing/payments?invoiceId
billingRouter.get(
  '/payments',
  validate({ query: z.object({ invoiceId: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const { invoiceId } = queryOf<{ invoiceId?: string }>(req)
      const payments = invoiceId
        ? await PaymentModel.find({ invoiceId }).sort({ paidAt: -1 })
        : await PaymentModel.find().sort({ paidAt: -1 })
      res.json(payments)
    } catch (err) {
      next(err)
    }
  },
)
