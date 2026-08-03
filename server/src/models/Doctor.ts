import { Schema, model } from 'mongoose'
import { jsonTransform } from './helpers.js'

export interface Doctor {
  name: string
  email: string
  phone: string
  department: string
  specialty: string
  qualification: string
  experienceYears: number
  consultationFee: number
  schedule: string[]
  patientsCount: number
  rating: number
  status: 'Active' | 'On Leave' | 'Unavailable'
}

const doctorSchema = new Schema<Doctor>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    department: { type: String, required: true, index: true },
    specialty: { type: String, required: true },
    qualification: { type: String, default: '' },
    experienceYears: { type: Number, default: 0 },
    consultationFee: { type: Number, default: 0 },
    schedule: { type: [String], default: [] },
    patientsCount: { type: Number, default: 0 },
    rating: { type: Number, default: 4.5 },
    status: { type: String, enum: ['Active', 'On Leave', 'Unavailable'], default: 'Active' },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

export const DoctorModel = model<Doctor>('Doctor', doctorSchema)
