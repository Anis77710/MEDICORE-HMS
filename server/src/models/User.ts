import { Schema } from 'mongoose'
import bcrypt from 'bcryptjs'
import { jsonTransform } from './helpers.js'
import { registerSchema, proxyModel } from './registry.js'

export const USER_ROLES = ['ADMIN', 'DOCTOR', 'NURSE', 'STAFF', 'PATIENT'] as const
export type UserRole = (typeof USER_ROLES)[number]

export interface User {
  name: string
  email: string
  username?: string
  staffId?: string
  phone: string
  role: UserRole
  department?: string
  passwordHash: string
  mustChangePassword: boolean
  passwordChangedAt?: Date
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
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true, index: true },
    staffId: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    phone: { type: String, default: '' },
    role: { type: String, enum: USER_ROLES, default: 'STAFF', index: true },
    department: { type: String, default: '' },
    passwordHash: { type: String, required: true },
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: { type: Date },
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

registerSchema('User', userSchema)
export const UserModel = proxyModel<User>('User')
