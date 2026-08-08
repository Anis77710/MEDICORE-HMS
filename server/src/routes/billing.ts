import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { InvoiceModel, PaymentModel } from '../models/Billing.js'
import { PatientModel } from '../models/Patient.js'
import { makeReadableId } from '../models/Counter.js'
import { requireAuth } from '../middleware/auth.js'
import { validate, queryOf } from '../middleware/validate.js'

export const billingRouter = Router()

billingRouter.use(requireAuth)

const TAX_RATE = 0.05

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

// POST /billing/invoices — server computes subtotal, tax, total
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

// POST /billing/payments — records payment and updates the invoice
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
