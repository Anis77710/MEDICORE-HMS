import { Schema, model } from 'mongoose'
import bcrypt from 'bcryptjs'
import { jsonTransform } from './helpers.js'

export const USER_ROLES = ['ADMIN', 'DOCTOR', 'NURSE', 'STAFF', 'PATIENT'] as const
export type UserRole = (typeof USER_ROLES)[number]

export interface User {
  name: string
  email: string
  phone: string
  role: UserRole
  passwordHash: string
  status: 'Active' | 'Disabled'
  tokenVersion: number
  avatarUrl?: string
  lastLoginAt?: Date
  createdAt?: Date
  comparePassword: (plain: string) => Promise<boolean>
}

const userSchema = new Schema<User>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, default: '' },
    role: { type: String, enum: USER_ROLES, default: 'STAFF', index: true },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Disabled'], default: 'Active', index: true },
    tokenVersion: { type: Number, default: 0 },
    avatarUrl: { type: String },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

userSchema.methods.comparePassword = function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.passwordHash)
}

userSchema.pre('save', async function (next) {
  const doc = this as unknown as { passwordHash: string; isModified(p: string): boolean }
  if (!doc.isModified('passwordHash')) return next()
  doc.passwordHash = await bcrypt.hash(doc.passwordHash, 10)
  next()
})

export const UserModel = model<User>('User', userSchema)
