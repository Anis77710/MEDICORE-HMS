// ============================================================
// Migrates existing hospitals to the new credential scheme:
//   - backfills staffId (DOC-0042 / NUR-0043 / ADM-0001 / ...)
//     onto doctors, staff and their login users
//   - rewrites old synthetic usernames (ram@medicore.hms) to the
//     hospital-code form (MHram.0042@medicore.hms)
//   - rewrites hyphenated usernames created by an earlier draft of the
//     scheme (MH-ram.0042@medicore.hms) to the current no-hyphen form
// It never changes or resets existing password hashes and never
// forces a password change - existing users keep working with the
// same password, only their login ID changes.
//
// Idempotent: safe to run repeatedly - already-migrated accounts
// and usernames are skipped. Run with the master MONGO_URI; it
// processes the default hospital plus every registered tenant.
//
// Usage: npm run migrate-credentials
// ============================================================

import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDb, disconnectDb } from '../config/db.js'
import { env } from '../config/env.js'
import {
  hospitalRegistry,
  getTenantConnection,
  syncDefaultTenantToRegistry,
  hospitalCode,
  hospitalLoginDomain,
} from '../config/tenants.js'
import { withTenant } from '../models/registry.js'
import { UserModel } from '../models/User.js'
import { DoctorModel } from '../models/Doctor.js'
import { StaffModel } from '../models/Staff.js'
import {
  firstNameOf,
  loginUsername,
  nextStaffId,
} from '../utils/credentials.js'

const OLD_USERNAME_RE = /^[a-z0-9]+@[a-z0-9.-]+$/
const HYPHENATED_RE = /^[a-z0-9]+-[a-z0-9.]+@[a-z0-9.-]+$/

interface MigrateStats {
  slug: string
  doctorsBackfilled: number
  staffBackfilled: number
  usernamesMigrated: number
  collisions: number
}

async function migrateTenant(slug: string, conn: mongoose.Connection): Promise<MigrateStats> {
  const stats: MigrateStats = {
    slug,
    doctorsBackfilled: 0,
    staffBackfilled: 0,
    usernamesMigrated: 0,
    collisions: 0,
  }
  const code = hospitalCode(slug)
  const loginDomain = hospitalLoginDomain(slug)

  await withTenant(conn, slug, async () => {
    // 1. Backfill doctor staffIds
    const doctors = await DoctorModel.find({ staffId: { $in: [null, ''] } }).lean()
    for (const d of doctors) {
      const staffId = await nextStaffId('DOCTOR')
      await DoctorModel.updateOne({ _id: d._id }, { $set: { staffId } })
      stats.doctorsBackfilled++
      console.log(`  [${slug}] doctor ${d.name} -> ${staffId}`)
    }

    // 2. Backfill staff staffIds (patient members have no accounts)
    const staffList = await StaffModel.find({
      role: { $ne: 'PATIENT' },
      staffId: { $in: [null, ''] },
    }).lean()
    for (const s of staffList) {
      const staffId = await nextStaffId(s.role)
      await StaffModel.updateOne({ _id: s._id }, { $set: { staffId } })
      stats.staffBackfilled++
      console.log(`  [${slug}] staff ${s.name} (${s.role}) -> ${staffId}`)
    }

    // 3. Rewrite old synthetic usernames to the new hospital-code form
    const users = await UserModel.find({
      role: { $ne: 'PATIENT' },
      username: { $exists: true, $ne: '' },
    }).lean()
    for (const u of users) {
      const username = u.username as string
      if (!OLD_USERNAME_RE.test(username) && !HYPHENATED_RE.test(username)) continue

      const member = await StaffModel.findOne({ email: u.email.toLowerCase() }).lean()
      const doctor = member ? null : await DoctorModel.findOne({ email: u.email.toLowerCase() }).lean()
      let staffId = u.staffId ?? member?.staffId ?? doctor?.staffId
      if (!staffId) {
        staffId = await nextStaffId(u.role)
        if (doctor) await DoctorModel.updateOne({ _id: doctor._id }, { $set: { staffId } })
        if (member) await StaffModel.updateOne({ _id: member._id }, { $set: { staffId } })
      }
      const next = loginUsername({
        hospitalCode: code,
        firstName: firstNameOf(u.name),
        staffId,
        loginDomain,
      })
      if (next === username) continue
      const taken = await UserModel.findOne({ username: next, _id: { $ne: u._id } }).lean()
      if (taken) {
        stats.collisions++
        console.warn(`  [${slug}] SKIP ${username}: new username ${next} already in use`)
        continue
      }
      await UserModel.updateOne({ _id: u._id }, { $set: { username: next, staffId } })
      stats.usernamesMigrated++
      console.log(`  [${slug}] ${username} -> ${next}`)
    }
  })

  return stats
}

async function main(): Promise<void> {
  await connectDb(env.MONGO_URI)
  await syncDefaultTenantToRegistry()

  const records = await hospitalRegistry().find({}).lean()
  console.log(`Migrating ${records.length} hospital(s) ...\n`)

  const totals: MigrateStats = {
    slug: 'TOTAL',
    doctorsBackfilled: 0,
    staffBackfilled: 0,
    usernamesMigrated: 0,
    collisions: 0,
  }

  for (const rec of records) {
    const conn = getTenantConnection(rec.slug)
    const stats = await migrateTenant(rec.slug, conn)
    console.log(
      `  [${rec.slug}] done - doctors: ${stats.doctorsBackfilled}, ` +
        `staff: ${stats.staffBackfilled}, usernames: ${stats.usernamesMigrated}, ` +
        `collisions: ${stats.collisions}`,
    )
    totals.doctorsBackfilled += stats.doctorsBackfilled
    totals.staffBackfilled += stats.staffBackfilled
    totals.usernamesMigrated += stats.usernamesMigrated
    totals.collisions += stats.collisions
    if (conn.readyState === 1 && conn.name !== mongoose.connection.name) {
      await conn.close()
    }
  }

  console.log(
    `\nMigration complete - total doctors backfilled: ${totals.doctorsBackfilled}, ` +
      `staff backfilled: ${totals.staffBackfilled}, usernames migrated: ${totals.usernamesMigrated}, ` +
      `collisions: ${totals.collisions}`,
  )
  await disconnectDb()
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})