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
