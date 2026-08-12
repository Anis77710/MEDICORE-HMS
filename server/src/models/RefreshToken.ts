import { Schema } from 'mongoose'
import { registerSchema, proxyModel } from './registry.js'

// Refresh tokens are stored hashed (SHA-256) so a leaked DB never exposes
// usable tokens. Rotation replaces each token on every refresh; reusing a
// rotated token is a sign of theft and revokes the whole session family.
export interface RefreshToken {
  jti: string
  hash: string
  userId: string
  familyId: string
  expiresAt: Date
  revokedAt?: Date
  replacedBy?: string
  userAgent?: string
  ip?: string
}

const refreshTokenSchema = new Schema<RefreshToken>(
  {
    jti: { type: String, required: true, unique: true },
    hash: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date },
    replacedBy: { type: String },
    userAgent: { type: String },
    ip: { type: String },
  },
  { timestamps: true },
)

registerSchema('RefreshToken', refreshTokenSchema)
export const RefreshTokenModel = proxyModel<RefreshToken>('RefreshToken')
