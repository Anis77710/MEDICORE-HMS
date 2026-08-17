// Medicore HMS - database seeder
// Usage: npm run seed   (connect to MONGO_URI, default mongodb://127.0.0.1:27017/medicore)
// Wipes all collections (tenant + registry) and any medicore_* tenant
// databases, then creates the admin account and hospital settings. No demo
// data - everything starts from zero.

import { connectDb, disconnectDb } from '../config/db.js'
import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { REGISTRY_DB, hospitalRegistry, syncDefaultTenantToRegistry } from '../config/tenants.js'
import { UserModel } from '../models/User.js'
import { PatientModel } from '../models/Patient.js'
import { DoctorModel } from '../models/Doctor.js'
import { DepartmentModel } from '../models/Department.js'
import { AppointmentModel } from '../models/Appointment.js'
import { MedicineModel, PrescriptionModel } from '../models/Pharmacy.js'
import { InvoiceModel, PaymentModel } from '../models/Billing.js'
import { StaffModel, MedicalRecordModel, DocumentModel, AuditLogModel } from '../models/Staff.js'
import { HospitalSettingsModel, ReportModel } from '../models/Settings.js'
import { CounterModel } from '../models/Counter.js'
import { ConsultationModel } from '../models/Consultation.js'
import { RefreshTokenModel } from '../models/RefreshToken.js'
import { OtpModel } from '../models/Otp.js'
import { PaymentAttemptModel } from '../models/PaymentAttempt.js'
import {
  masterAdminModel,
  registrationRequestModel,
  registrationAttemptModel,
  platformSettingsModel,
  auditLogModel,
  platformAnnouncementModel,
  contactMessageModel,
} from '../config/platform.js'

// Seeds the connected database. Wipes first, so it is only safe on
// demo/dev databases (or intentionally when re-seeding).
export async function seedData(): Promise<void> {
  // ----- Wipe everything -----
  await Promise.all([
    UserModel.deleteMany({}),
    PatientModel.deleteMany({}),
    DoctorModel.deleteMany({}),
    DepartmentModel.deleteMany({}),
    AppointmentModel.deleteMany({}),
    MedicineModel.deleteMany({}),
    PrescriptionModel.deleteMany({}),
    InvoiceModel.deleteMany({}),
    PaymentModel.deleteMany({}),
    StaffModel.deleteMany({}),
    MedicalRecordModel.deleteMany({}),
    DocumentModel.deleteMany({}),
    HospitalSettingsModel.deleteMany({}),
    ConsultationModel.deleteMany({}),
    RefreshTokenModel.deleteMany({}),
    OtpModel.deleteMany({}),
    CounterModel.deleteMany({}),
    PaymentAttemptModel.deleteMany({}),
    ReportModel.deleteMany({}),
    AuditLogModel.deleteMany({}),
  ])

  // ----- Registry (platform-wide) data -----
  await Promise.all([
    hospitalRegistry().deleteMany({}),
    masterAdminModel().deleteMany({}),
    registrationRequestModel().deleteMany({}),
    registrationAttemptModel().deleteMany({}),
    platformSettingsModel().deleteMany({}),
    auditLogModel().deleteMany({}),
    platformAnnouncementModel().deleteMany({}),
    contactMessageModel().deleteMany({}),
  ])

  // ----- Admin (the only account; no demo data) -----
  await UserModel.create({
    name: 'Dr. Sarah Chen',
    email: 'admin@medicore.health',
    username: 'MHsarah.0001@medicore.hms',
    staffId: 'ADM-0001',
    phone: '+1 (555) 010-2244',
    role: 'ADMIN',
    passwordHash: 'admin123',
    lastLoginAt: new Date(),
  })
  console.log('Admin created: MHsarah.0001@medicore.hms / admin123 (or admin@medicore.health / admin123)')

  await HospitalSettingsModel.create({ _id: 'hospital' })

  // Register the default hospital in the registry with its credential
  // code/domain so doctors & staff created here get MH-* usernames.
  await syncDefaultTenantToRegistry()

  console.log('\nSeed complete - clean slate, no demo data.')
  console.log('Login: MHsarah.0001@medicore.hms / admin123')
}

async function run(): Promise<void> {
  await connectDb(env.MONGO_URI)
  console.log(`Seeding ${env.MONGO_URI} ...`)

  // Drop per-hospital tenant databases (medicore_<slug>) so every hospital
  // starts from zero too - the registry is wiped below, so none of them are
  // referenced anymore. The registry database itself is reset by seedData().
  const dbs = await mongoose.connection.getClient().db().admin().listDatabases()
  for (const { name } of dbs.databases ?? []) {
    if (name.startsWith('medicore_') && name !== REGISTRY_DB) {
      console.log(`Dropping tenant database: ${name}`)
      await mongoose.connection.getClient().db(name).dropDatabase()
    }
  }

  await seedData()
  await disconnectDb()
  process.exit(0)
}

// Only run the CLI seeder when executed directly (not when imported by dev-memory.ts).
const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isMain) {
  run().catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
}