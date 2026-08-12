import { Schema } from 'mongoose'
import { jsonTransform } from './helpers.js'
import { registerSchema, proxyModel } from './registry.js'

export interface OtpRecord {
  email: string
  codeHash: string
  purpose: string
  expiresAt: Date
  attempts: number
  usedAt?: Date
}

const otpSchema = new Schema<OtpRecord>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    codeHash: { type: String, required: true },
    purpose: { type: String, default: 'password-reset' },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
    usedAt: { type: Date },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

registerSchema('Otp', otpSchema)
export const OtpModel = proxyModel<OtpRecord>('Otp')
