import { Schema } from 'mongoose'
import { jsonTransform } from './helpers.js'
import { registerSchema, proxyModel } from './registry.js'

export interface Department {
  name: string
  headDoctorId: string
  headDoctorName: string
  bedCount: number
  occupiedBeds: number
  doctorsCount: number
  patientsCount: number
  color: string
  icon: string
  description: string
}

const departmentSchema = new Schema<Department>(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    headDoctorId: { type: String, default: '' },
    headDoctorName: { type: String, default: 'Unassigned' },
    bedCount: { type: Number, default: 0 },
    occupiedBeds: { type: Number, default: 0 },
    doctorsCount: { type: Number, default: 0 },
    patientsCount: { type: Number, default: 0 },
    color: { type: String, default: '#0e7490' },
    icon: { type: String, default: 'Stethoscope' },
    description: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

registerSchema('Department', departmentSchema)
export const DepartmentModel = proxyModel<Department>('Department')
