import { Schema, model } from 'mongoose'
import { jsonTransform } from './helpers.js'

// Clinical consultation record. Immutable once created: clinical data is
// never silently overwritten, so there is intentionally no update route.

export interface Vitals {
  bloodPressure?: string
  heartRate?: number
  temperature?: number
  respiratoryRate?: number
  spo2?: number
  weightKg?: number
  heightCm?: number
  bmi?: number
}

export interface Examination {
  general?: string
  cardiovascular?: string
  respiratory?: string
  neurological?: string
  abdominal?: string
  other?: string
}

export interface Diagnosis {
  primary: string
  additional: string
  notes: string
}

export interface ClinicalNotes {
  assessment: string
  observations: string
  reasoning: string
  general: string
}

export interface TreatmentPlan {
  advice: string
  diet: string
  lifestyle: string
  instructions: string
}

export interface Consultation {
  consultationNo: string
  patientId: string
  patientName: string
  doctorId: string
  doctorName: string
  appointmentId?: string
  chiefComplaint: string
  symptoms: string
  vitals: Vitals
  examination: Examination
  diagnosis: Diagnosis
  clinicalNotes: ClinicalNotes
  treatmentPlan: TreatmentPlan
  prescriptionId?: string
  prescriptionNo?: string
}

const consultationSchema = new Schema<Consultation>(
  {
    patientId: { type: String, required: true, index: true },
    patientName: { type: String, required: true, trim: true },
    doctorId: { type: String, required: true, index: true },
    doctorName: { type: String, required: true },
    appointmentId: { type: String, index: true },
    chiefComplaint: { type: String, required: true, trim: true },
    symptoms: { type: String, default: '' },
    vitals: {
      bloodPressure: { type: String, default: '' },
      heartRate: { type: Number },
      temperature: { type: Number },
      respiratoryRate: { type: Number },
      spo2: { type: Number },
      weightKg: { type: Number },
      heightCm: { type: Number },
      bmi: { type: Number },
    },
    examination: {
      general: { type: String, default: '' },
      cardiovascular: { type: String, default: '' },
      respiratory: { type: String, default: '' },
      neurological: { type: String, default: '' },
      abdominal: { type: String, default: '' },
      other: { type: String, default: '' },
    },
    diagnosis: {
      primary: { type: String, required: true, trim: true },
      additional: { type: String, default: '' },
      notes: { type: String, default: '' },
    },
    clinicalNotes: {
      assessment: { type: String, default: '' },
      observations: { type: String, default: '' },
      reasoning: { type: String, default: '' },
      general: { type: String, default: '' },
    },
    treatmentPlan: {
      advice: { type: String, default: '' },
      diet: { type: String, default: '' },
      lifestyle: { type: String, default: '' },
      instructions: { type: String, default: '' },
    },
    prescriptionId: { type: String },
    consultationNo: { type: String, required: true, index: true },
    prescriptionNo: { type: String },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

consultationSchema.index({ patientId: 1, createdAt: -1 })
consultationSchema.index({ doctorId: 1, createdAt: -1 })

export const ConsultationModel = model<Consultation>('Consultation', consultationSchema)
