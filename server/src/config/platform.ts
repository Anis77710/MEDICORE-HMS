// ============================================================
// Platform-level data — master admin, hospital registration
// requests and platform settings. These live in the registry
// database (healsync_registry), i.e. they are shared across all
// hospitals and are managed by the master admin panel, not by
// any single hospital tenant.
// ============================================================

import { Schema, type Model } from 'mongoose'
import bcrypt from 'bcryptjs'
import { jsonTransform } from '../models/helpers.js'
import { env } from './env.js'
import { registryConnection } from './tenants.js'

// ------------------------------------------------------------
// Master admin
// ------------------------------------------------------------

export interface MasterAdmin {
  _id?: unknown
  email: string
  name: string
  passwordHash: string
  lastLoginAt?: Date
  comparePassword: (plain: string) => Promise<boolean>
}

const masterAdminSchema = new Schema<MasterAdmin>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

masterAdminSchema.methods.comparePassword = function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.passwordHash)
}

masterAdminSchema.pre('save', async function (next) {
  const doc = this as unknown as { passwordHash: string; isModified(p: string): boolean }
  if (!doc.isModified('passwordHash')) return next()
  doc.passwordHash = await bcrypt.hash(doc.passwordHash, 10)
  next()
})

let masterModel: Model<MasterAdmin> | null = null

export function masterAdminModel(): Model<MasterAdmin> {
  if (!masterModel) masterModel = registryConnection().model('MasterAdmin', masterAdminSchema)
  return masterModel
}

export const MASTER_ADMIN_DEFAULT_PASSWORD = 'master@2026'

/**
 * Boot-time provisioning: creates the master admin from env vars when the
 * registry has none. Logs the credentials once so the panel owner can sign
 * in (and should change the password afterwards).
 */
export async function ensureMasterAdmin(): Promise<void> {
  try {
    const existing = await masterAdminModel().findOne({})
    if (existing) return
    const password = env.MASTER_ADMIN_PASSWORD || MASTER_ADMIN_DEFAULT_PASSWORD
    await masterAdminModel().create({
      email: env.MASTER_ADMIN_EMAIL,
      name: 'Platform Administrator',
      passwordHash: password,
    })
    console.log(
      `[platform] Master admin created — email: ${env.MASTER_ADMIN_EMAIL}  password: ${password}\n` +
        `[platform] Sign in at ${env.APP_BASE_URL}/master/login`,
    )
  } catch {
    // Registry unavailable at boot — non-fatal, retried next boot.
  }
}

// ------------------------------------------------------------
// Registration requests — hospitals queue up here after paying
// the registration fee; the master admin approves or rejects.
// ------------------------------------------------------------

export type RegistrationStatus = 'pending_payment' | 'paid' | 'approved' | 'rejected'

export interface RegistrationRequest {
  regNo: string
  hospitalName: string
  slug: string
  admin: { name: string; email: string; phone: string; birthYear: number }
  status: RegistrationStatus
  payment: {
    transactionUuid: string
    transactionCode?: string
    amount: number
    paidAt?: Date
  }
  reason?: string
  approvedAt?: Date
  rejectedAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

const registrationRequestSchema = new Schema<RegistrationRequest>(
  {
    regNo: { type: String, required: true, unique: true, index: true },
    hospitalName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, index: true },
    admin: {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, default: '' },
      birthYear: { type: Number, required: true },
    },
    status: {
      type: String,
      enum: ['pending_payment', 'paid', 'approved', 'rejected'],
      default: 'pending_payment',
      index: true,
    },
    payment: {
      transactionUuid: { type: String, required: true },
      transactionCode: { type: String, default: '' },
      amount: { type: Number, required: true },
      paidAt: { type: Date },
    },
    reason: { type: String, default: '' },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

let requestModel: Model<RegistrationRequest> | null = null

export function registrationRequestModel(): Model<RegistrationRequest> {
  if (!requestModel) {
    requestModel = registryConnection().model('RegistrationRequest', registrationRequestSchema)
  }
  return requestModel
}

// ------------------------------------------------------------
// Registration attempts — pending hospital applications created at
// initiate time and carried through the eSewa payment. The attempt
// holds the applicant's details under the payment's transaction_uuid
// (which eSewa returns inside the signed callback), so the callback
// URL stays short — eSewa rejects success_urls longer than a few
// hundred characters with a generic "Service is currently
// unavailable" error. Nothing is provisioned until the signed
// callback verifies the payment; abandoned attempts expire via TTL.
// ------------------------------------------------------------

export interface RegistrationAttempt {
  _id?: unknown
  transactionUuid: string
  hospitalName: string
  slug: string
  name: string
  email: string
  phone: string
  birthYear: number
  fee: number
  status: 'pending' | 'claimed'
  createdAt?: Date
  updatedAt?: Date
}

const registrationAttemptSchema = new Schema<RegistrationAttempt>(
  {
    transactionUuid: { type: String, required: true, unique: true, index: true },
    hospitalName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    birthYear: { type: Number, required: true },
    fee: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'claimed'], default: 'pending', index: true },
  },
  {
    timestamps: true,
    // Abandoned attempts expire 24h after creation — no manual cleanup.
    expireAfterSeconds: 24 * 60 * 60,
    toJSON: { transform: jsonTransform },
    toObject: { transform: jsonTransform },
  },
)

let attemptModel: Model<RegistrationAttempt> | null = null

export function registrationAttemptModel(): Model<RegistrationAttempt> {
  if (!attemptModel) {
    attemptModel = registryConnection().model('RegistrationAttempt', registrationAttemptSchema)
  }
  return attemptModel
}

// ------------------------------------------------------------
// Platform settings — single document, _id "platform"
// ------------------------------------------------------------

export interface PlatformSettings {
  _id: string
  siteName: string
  tagline: string
  contactEmail: string
  contactPhone: string
  registrationFee: number
  hospitalDirectoryEnabled: boolean
}

const platformSettingsSchema = new Schema<PlatformSettings>(
  {
    _id: { type: String, default: 'platform' },
    siteName: { type: String, default: 'Medicore HMS' },
    tagline: { type: String, default: 'Hospital management platform' },
    contactEmail: { type: String, default: env.MASTER_ADMIN_EMAIL },
    contactPhone: { type: String, default: '' },
    registrationFee: { type: Number, default: env.HOSPITAL_REGISTRATION_FEE },
    hospitalDirectoryEnabled: { type: Boolean, default: true },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

let settingsModel: Model<PlatformSettings> | null = null

export function platformSettingsModel(): Model<PlatformSettings> {
  if (!settingsModel) {
    settingsModel = registryConnection().model('PlatformSettings', platformSettingsSchema)
  }
  return settingsModel
}

export async function getPlatformSettings(): Promise<import('mongoose').HydratedDocument<PlatformSettings>> {
  let doc = await platformSettingsModel().findById('platform')
  if (!doc) doc = await platformSettingsModel().create({ _id: 'platform' })
  return doc
}

// ------------------------------------------------------------
// Platform counters — readable registration numbers
// ("HREG-2026-8-11-1") shared across the platform.
// ------------------------------------------------------------

interface PlatformCounter {
  _id: string
  seq: number
}

const platformCounterSchema = new Schema<PlatformCounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
})

let counterModel: Model<PlatformCounter> | null = null

function platformCounterModel(): Model<PlatformCounter> {
  if (!counterModel) {
    counterModel = registryConnection().model('PlatformCounter', platformCounterSchema)
  }
  return counterModel
}

function platformDateTag(d: Date = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export async function nextPlatformId(kind: string): Promise<string> {
  const key = `${kind}-${platformDateTag()}`
  const doc = await platformCounterModel().findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  )
  return `${kind.toUpperCase()}-${platformDateTag()}-${doc!.seq}`
}

// ------------------------------------------------------------
// Audit log — every master admin action (approve, reject, suspend,
// delete, settings change, announcement, contact handling …).
// ------------------------------------------------------------

export type AuditAction =
  | 'login'
  | 'approve_request'
  | 'reject_request'
  | 'hospital_status'
  | 'hospital_listed'
  | 'hospital_delete'
  | 'settings_update'
  | 'announcement_create'
  | 'announcement_delete'
  | 'contact_done'
  | 'contact_delete'

export interface AuditEntry {
  _id?: unknown
  actor: { id: string; email: string; name: string }
  action: AuditAction
  targetType?: 'request' | 'hospital' | 'settings' | 'announcement' | 'contact'
  targetId?: string
  summary: string
  createdAt?: Date
}

const auditSchema = new Schema<AuditEntry>(
  {
    actor: {
      id: { type: String, required: true },
      email: { type: String, required: true },
      name: { type: String, required: true },
    },
    action: {
      type: String,
      enum: [
        'login',
        'approve_request',
        'reject_request',
        'hospital_status',
        'hospital_listed',
        'hospital_delete',
        'settings_update',
        'announcement_create',
        'announcement_delete',
        'contact_done',
        'contact_delete',
      ],
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['request', 'hospital', 'settings', 'announcement', 'contact'],
    },
    targetId: { type: String },
    summary: { type: String, required: true },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

let auditModel: Model<AuditEntry> | null = null

export function auditLogModel(): Model<AuditEntry> {
  if (!auditModel) auditModel = registryConnection().model('AuditLog', auditSchema)
  return auditModel
}

/** Writes an audit entry; never throws (audit must not break an action). */
export async function logAudit(entry: {
  actor: AuditEntry['actor']
  action: AuditAction
  targetType?: AuditEntry['targetType']
  targetId?: string
  summary: string
}): Promise<void> {
  try {
    await auditLogModel().create(entry)
  } catch {
    /* non-fatal */
  }
}

// ------------------------------------------------------------
// Announcements — platform-wide banners shown inside every
// hospital dashboard; created by the master admin.
// ------------------------------------------------------------

export type AnnouncementAudience = 'all' | 'active'

export interface PlatformAnnouncement {
  _id?: unknown
  title: string
  message: string
  audience: AnnouncementAudience
  active: boolean
  createdBy: { id: string; email: string }
  createdAt?: Date
  updatedAt?: Date
}

const announcementSchema = new Schema<PlatformAnnouncement>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    audience: { type: String, enum: ['all', 'active'], default: 'all' },
    active: { type: Boolean, default: true },
    createdBy: {
      id: { type: String, required: true },
      email: { type: String, required: true },
    },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

let announcementModel: Model<PlatformAnnouncement> | null = null

export function platformAnnouncementModel(): Model<PlatformAnnouncement> {
  if (!announcementModel) {
    announcementModel = registryConnection().model('PlatformAnnouncement', announcementSchema)
  }
  return announcementModel
}

// ------------------------------------------------------------
// Contact messages — inquiries submitted from the public landing
// page contact form, received by the master admin.
// ------------------------------------------------------------

export interface ContactMessage {
  _id?: unknown
  name: string
  email: string
  hospital: string
  message: string
  done: boolean
  doneAt?: Date
  createdAt?: Date
}

const contactMessageSchema = new Schema<ContactMessage>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true },
    hospital: { type: String, default: '', maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    done: { type: Boolean, default: false },
    doneAt: { type: Date },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

let contactModel: Model<ContactMessage> | null = null

export function contactMessageModel(): Model<ContactMessage> {
  if (!contactModel) contactModel = registryConnection().model('ContactMessage', contactMessageSchema)
  return contactModel
}
