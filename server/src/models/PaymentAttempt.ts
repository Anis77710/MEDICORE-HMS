import { Schema, model } from 'mongoose'
import { jsonTransform } from './helpers.js'

// ============================================================
// Payment attempts for the public eSewa booking flow.
// An attempt holds the full booking payload plus the payment
// state machine (pending -> success | failed). The patient and
// appointment are only created on the verified success callback.
// ============================================================

export const PAYMENT_STATUSES = ['pending', 'success', 'failed'] as const

export interface PaymentBooking {
  firstName: string
  lastName: string
  email: string
  phone: string
  dob: string
  gender: 'Male' | 'Female' | 'Other'
  address: string
  doctorId: string
  type: string
  date: string
  time: string
  durationMin: number
  reason: string
}

export interface PaymentAttempt {
  transactionUuid: string
  amount: number
  status: (typeof PAYMENT_STATUSES)[number]
  transactionCode?: string
  booking: PaymentBooking
  patientId?: string
  appointmentId?: string
  appointmentNo?: string
  createdAt?: Date
  updatedAt?: Date
}

const paymentAttemptSchema = new Schema<PaymentAttempt>(
  {
    transactionUuid: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'pending', index: true },
    transactionCode: { type: String, default: '' },
    booking: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, default: '' },
      dob: { type: String, default: '' },
      gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Other' },
      address: { type: String, default: '' },
      doctorId: { type: String, required: true },
      type: { type: String, required: true },
      date: { type: String, required: true },
      time: { type: String, required: true },
      durationMin: { type: Number, default: 30 },
      reason: { type: String, default: '' },
    },
    patientId: { type: String, default: '' },
    appointmentId: { type: String, default: '' },
    appointmentNo: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

export const PaymentAttemptModel = model<PaymentAttempt>('PaymentAttempt', paymentAttemptSchema)
