// ============================================================
// Creates DOCTOR role user accounts for every existing doctor
// profile, so they can sign in to the Doctor Portal.
// Idempotent: existing accounts are left untouched.
// Usage: npm run ensure-doctors
// ============================================================

import 'dotenv/config'
import { connectDb, disconnectDb } from '../config/db.js'
import { env } from '../config/env.js'
import { UserModel } from '../models/User.js'
import { DoctorModel } from '../models/Doctor.js'

async function main(): Promise<void> {
  await connectDb(env.MONGO_URI)
  const doctors = await DoctorModel.find({})
  let created = 0
  for (const d of doctors) {
    const exists = await UserModel.findOne({ email: d.email.toLowerCase() })
    if (exists) continue
    await UserModel.create({
      name: d.name,
      email: d.email,
      phone: d.phone,
      role: 'DOCTOR',
      passwordHash: 'doctor123',
    })
    created++
    console.log(`  created account for ${d.name} (${d.email}) — password: doctor123`)
  }
  console.log(`\nDoctor accounts ensured: ${created} created, ${doctors.length - created} already existed`)
  await disconnectDb()
  process.exit(0)
}

main().catch((err) => {
  console.error('Failed to ensure doctor accounts:', err)
  process.exit(1)
})
