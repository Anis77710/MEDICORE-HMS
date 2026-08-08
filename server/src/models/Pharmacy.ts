import { Schema, model } from 'mongoose'
import { jsonTransform } from './helpers.js'

export interface Medicine {
  name: string
  genericName: string
  category: string
  manufacturer: string
  price: number
  stock: number
  reorderLevel: number
  expiryDate: string
  batch: string
}

const medicineSchema = new Schema<Medicine>(
  {
    name: { type: String, required: true, trim: true, index: true },
    genericName: { type: String, default: '' },
    category: { type: String, default: 'General', index: true },
    manufacturer: { type: String, default: '' },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0 },
    expiryDate: { type: String, default: '' },
    batch: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

export const MedicineModel = model<Medicine>('Medicine', medicineSchema)

export interface PrescriptionMedicine {
  name: string
  dosage: string
  frequency: string
  durationDays: number
  instructions?: string
}

export interface Prescription {
  prescriptionNo: string
  patientId: string
  patientName: string
  doctorId: string
  doctorName: string
  medicines: PrescriptionMedicine[]
  issuedAt: string
  status: 'Active' | 'Completed'
  appointmentId?: string
}

const prescriptionSchema = new Schema<Prescription>(
  {
    prescriptionNo: { type: String, required: true, index: true },
    patientId: { type: String, required: true, index: true },
    patientName: { type: String, required: true },
    doctorId: { type: String, required: true },
    doctorName: { type: String, required: true },
    medicines: {
      type: [
        {
          name: { type: String, required: true },
          dosage: { type: String, default: '' },
          frequency: { type: String, default: '' },
          durationDays: { type: Number, default: 7 },
          instructions: { type: String, default: '' },
        },
      ],
      default: [],
    },
    issuedAt: { type: String, default: '' },
    status: { type: String, enum: ['Active', 'Completed'], default: 'Active' },
    appointmentId: { type: String },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

export const PrescriptionModel = model<Prescription>('Prescription', prescriptionSchema)
