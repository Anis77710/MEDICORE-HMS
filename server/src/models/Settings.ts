import { Schema, model } from 'mongoose'
import { jsonTransform } from './helpers.js'

export interface HospitalSettings {
  _id?: string
  name: string
  tagline: string
  email: string
  phone: string
  address: string
  license: string
  timezone: string
  currency: string
  logoUrl?: string
}

const hospitalSettingsSchema = new Schema<HospitalSettings>(
  {
    _id: { type: String },
    name: { type: String, default: 'HealSync General Hospital' },
    tagline: { type: String, default: 'Smart Hospital Management' },
    email: { type: String, default: 'info@healsync.health' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    license: { type: String, default: '' },
    timezone: { type: String, default: 'UTC-5 (Eastern)' },
    currency: { type: String, default: 'USD ($)' },
    logoUrl: { type: String },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

export const HospitalSettingsModel = model<HospitalSettings>('HospitalSettings', hospitalSettingsSchema)

export interface Report {
  name: string
  type: 'Revenue' | 'Clinical' | 'Operations' | 'Patient Care'
  period: string
  generatedAt: string
  format: 'PDF' | 'XLSX' | 'CSV'
  size: string
}

const reportSchema = new Schema<Report>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['Revenue', 'Clinical', 'Operations', 'Patient Care'], required: true },
    period: { type: String, default: '' },
    generatedAt: { type: String, default: '' },
    format: { type: String, enum: ['PDF', 'XLSX', 'CSV'], default: 'PDF' },
    size: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

export const ReportModel = model<Report>('Report', reportSchema)
