import { Schema, model } from 'mongoose'
import { jsonTransform } from './helpers.js'

export const INVOICE_STATUSES = ['Paid', 'Pending', 'Overdue', 'Refunded'] as const
export const PAYMENT_METHODS = ['Card', 'Cash', 'Bank Transfer', 'Insurance', 'UPI'] as const

export interface InvoiceItem {
  description: string
  amount: number
}

export interface Invoice {
  invoiceNo: string
  patientId: string
  patientName: string
  description: string
  items: InvoiceItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  amountPaid: number
  status: (typeof INVOICE_STATUSES)[number]
  issuedAt: string
  dueDate: string
}

const invoiceSchema = new Schema<Invoice>(
  {
    invoiceNo: { type: String, required: true, unique: true, index: true },
    patientId: { type: String, required: true, index: true },
    patientName: { type: String, required: true },
    description: { type: String, default: '' },
    items: {
      type: [
        {
          description: { type: String, required: true },
          amount: { type: Number, required: true },
        },
      ],
      default: [],
    },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    status: { type: String, enum: INVOICE_STATUSES, default: 'Pending', index: true },
    issuedAt: { type: String, default: '' },
    dueDate: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

export const InvoiceModel = model<Invoice>('Invoice', invoiceSchema)

export interface Payment {
  invoiceId: string
  amount: number
  method: (typeof PAYMENT_METHODS)[number]
  reference: string
  paidAt: string
}

const paymentSchema = new Schema<Payment>(
  {
    invoiceId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    reference: { type: String, default: '' },
    paidAt: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

export const PaymentModel = model<Payment>('Payment', paymentSchema)
