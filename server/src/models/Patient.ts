import { Schema, model } from 'mongoose'
import { jsonTransform } from './helpers.js'

export const PATIENT_STATUSES = ['Admitted', 'Outpatient', 'Critical', 'Recovered', 'Pending'] as const

export interface Patient {
  patientId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  dob: string
  gender: 'Male' | 'Female' | 'Other'
  bloodGroup: string
  address: string
  emergencyContact: string
  status: (typeof PATIENT_STATUSES)[number]
  department: string
  assignedDoctorId?: string
  admittedAt?: string
  lastVisit: string
  allergies: string[]
  insurance: string
  notes?: string
}

const patientSchema = new Schema<Patient>(
  {
    patientId: { type: String, required: true, unique: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    dob: { type: String, required: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
    bloodGroup: { type: String, default: '' },
    address: { type: String, default: '' },
    emergencyContact: { type: String, default: '' },
    status: { type: String, enum: PATIENT_STATUSES, default: 'Pending', index: true },
    department: { type: String, default: 'General', index: true },
    assignedDoctorId: { type: String },
    admittedAt: { type: String },
    lastVisit: { type: String, default: '' },
    allergies: { type: [String], default: [] },
    insurance: { type: String, default: '' },
    notes: { type: String },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

patientSchema.index({ firstName: 'text', lastName: 'text', patientId: 'text', email: 'text' })

export const PatientModel = model<Patient>('Patient', patientSchema)
