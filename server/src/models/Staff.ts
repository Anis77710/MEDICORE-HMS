import { Schema } from 'mongoose'
import { jsonTransform } from './helpers.js'
import { registerSchema, proxyModel } from './registry.js'

export interface StaffMember {
  name: string
  email: string
  staffId?: string
  phone: string
  role: 'ADMIN' | 'DOCTOR' | 'NURSE' | 'STAFF' | 'PATIENT'
  department: string
  shift: 'Morning' | 'Evening' | 'Night' | 'Rotating'
  joinedAt: string
  salary: number
  birthYear?: number
  status: 'Active' | 'On Leave' | 'Resigned'
}

const staffSchema = new Schema<StaffMember>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    staffId: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    phone: { type: String, default: '' },
    role: { type: String, enum: ['ADMIN', 'DOCTOR', 'NURSE', 'STAFF', 'PATIENT'], default: 'STAFF' },
    department: { type: String, default: 'General' },
    shift: { type: String, enum: ['Morning', 'Evening', 'Night', 'Rotating'], default: 'Morning' },
    joinedAt: { type: String, default: '' },
    salary: { type: Number, default: 0 },
    birthYear: { type: Number },
    status: { type: String, enum: ['Active', 'On Leave', 'Resigned'], default: 'Active' },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

registerSchema('StaffMember', staffSchema)
export const StaffModel = proxyModel<StaffMember>('StaffMember')

export interface MedicalRecord {
  patientId: string
  date: string
  type: string
  diagnosis: string
  doctor: string
  notes: string
  status: string
}

const medicalRecordSchema = new Schema<MedicalRecord>(
  {
    patientId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    type: { type: String, required: true },
    diagnosis: { type: String, required: true },
    doctor: { type: String, default: '' },
    notes: { type: String, default: '' },
    status: { type: String, default: 'Final' },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

registerSchema('MedicalRecord', medicalRecordSchema)
export const MedicalRecordModel = proxyModel<MedicalRecord>('MedicalRecord')

export interface PatientDocument {
  patientId: string
  name: string
  type: string
  size: string
  date: string
  uploadedBy: string
}

const documentSchema = new Schema<PatientDocument>(
  {
    patientId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, default: 'PDF' },
    size: { type: String, default: '' },
    date: { type: String, default: '' },
    uploadedBy: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

registerSchema('Document', documentSchema)
export const DocumentModel = proxyModel<PatientDocument>('Document')

export interface AuditLogEntry {
  actor: string
  actorId?: string
  actorRole?: string
  action: string
  resource: string
  resourceId?: string
  details?: Record<string, unknown>
}

const auditLogSchema = new Schema<AuditLogEntry>(
  {
    actor: { type: String, required: true },
    actorId: { type: String },
    actorRole: { type: String },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: { type: String },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

auditLogSchema.index({ createdAt: -1 })
auditLogSchema.index({ action: 1 })
auditLogSchema.index({ resource: 1 })
auditLogSchema.index({ actorId: 1 })

registerSchema('AuditLog', auditLogSchema)
export const AuditLogModel = proxyModel<AuditLogEntry>('AuditLog')
