// ============================================================
// Creates DOCTOR role user accounts for every existing doctor
// profile that has no account yet, so they can sign in to the
// Doctor Portal with the hospital's credential scheme:
//   username  MHram.0042@medicore.hms
//   password  random temporary password (must change on first login)
// Idempotent: existing accounts are left untouched.
// Usage: npm run ensure-doctors
// ============================================================

import 'dotenv/config'
import { connectDb, disconnectDb } from '../config/db.js'
import { env } from '../config/env.js'
import { UserModel } from '../models/User.js'
import { DoctorModel } from '../models/Doctor.js'
import { syncDefaultTenantToRegistry, hospitalCode, hospitalLoginDomain } from '../config/tenants.js'
import {
  firstNameOf,
  generateTempPassword,
  loginUsername,
  nextStaffId,
} from '../utils/credentials.js'

async function main(): Promise<void> {
  await connectDb(env.MONGO_URI)
  await syncDefaultTenantToRegistry()
  const code = hospitalCode('medicore')
  const loginDomain = hospitalLoginDomain('medicore')
  const doctors = await DoctorModel.find({})
  let created = 0
  for (const d of doctors) {
    const email = d.email.toLowerCase()
    const exists = await UserModel.findOne({ email })
    if (exists) continue
    const staffId = d.staffId ?? (await nextStaffId('DOCTOR'))
    const username = loginUsername({ hospitalCode: code, firstName: firstNameOf(d.name), staffId, loginDomain })
    if (await UserModel.findOne({ username })) {
      console.log(`  skipped ${d.name} - username ${username} already taken`)
      continue
    }
    const password = generateTempPassword()
    await UserModel.create({
      name: d.name,
      email,
      username,
      staffId,
      phone: d.phone,
      role: 'DOCTOR',
      passwordHash: password,
      mustChangePassword: true,
    })
    if (d.staffId !== staffId) {
      d.staffId = staffId
      await d.save()
    }
    created++
    console.log(`  created account for ${d.name} - ${username} / ${password}`)
  }
  console.log(`\nDoctor accounts ensured: ${created} created, ${doctors.length - created} already existed`)
  await disconnectDb()
  process.exit(0)
}

main().catch((err) => {
  console.error('Failed to ensure doctor accounts:', err)
  process.exit(1)
})