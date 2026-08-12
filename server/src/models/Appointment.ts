import { Schema } from 'mongoose'
import { jsonTransform } from './helpers.js'
import { registerSchema, proxyModel } from './registry.js'

export const APPOINTMENT_STATUSES = ['Confirmed', 'Pending', 'Completed', 'Cancelled'] as const
export const APPOINTMENT_TYPES = ['Checkup', 'Consultation', 'Follow-up', 'Emergency', 'Procedure'] as const

export interface Appointment {
  appointmentNo: string
  patientId: string
  patientName: string
  doctorId: string
  doctorName: string
  department: string
  type: (typeof APPOINTMENT_TYPES)[number]
  date: string
  time: string
  durationMin: number
  status: (typeof APPOINTMENT_STATUSES)[number]
  reason: string
  createdAt?: Date
  updatedAt?: Date
}

const appointmentSchema = new Schema<Appointment>(
  {
    appointmentNo: { type: String, required: true, index: true },
    patientId: { type: String, required: true, index: true },
    patientName: { type: String, required: true, trim: true },
    doctorId: { type: String, required: true, index: true },
    doctorName: { type: String, required: true },
    department: { type: String, default: 'General', index: true },
    type: { type: String, enum: APPOINTMENT_TYPES, required: true },
    date: { type: String, required: true, index: true },
    time: { type: String, required: true },
    durationMin: { type: Number, default: 30 },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'Pending', index: true },
    reason: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

appointmentSchema.index({ date: 1, time: 1 })

registerSchema('Appointment', appointmentSchema)
export const AppointmentModel = proxyModel<Appointment>('Appointment')
