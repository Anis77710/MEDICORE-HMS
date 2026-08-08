import 'dotenv/config'
import mongoose from 'mongoose'
import { env } from '../config/env.js'

async function main() {
  await mongoose.connect(env.MONGO_URI)
  const attempts = await mongoose.connection
    .collection('paymentattempts')
    .find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray()
  console.log('=== PaymentAttempts (latest 5) ===')
  for (const a of attempts) {
    console.log(
      JSON.stringify(
        {
          transactionUuid: a.transactionUuid,
          status: a.status,
          amount: a.amount,
          transactionCode: a.transactionCode ?? null,
          appointmentNo: a.appointmentNo ?? null,
          bookingEmail: a.booking?.email ?? null,
          booking: a.booking ? { doctorId: a.booking.doctorId, date: a.booking.date, time: a.booking.time, firstName: a.booking.firstName, lastName: a.booking.lastName, phone: a.booking.phone } : null,
          createdAt: a.createdAt,
        },
        null,
        2,
      ),
    )
  }
  const patients = await mongoose.connection
    .collection('patients')
    .find({})
    .sort({ createdAt: -1 })
    .limit(3)
    .toArray()
  console.log('=== Patients (latest 3) ===')
  for (const p of patients) {
    console.log(JSON.stringify({ patientId: p.patientId, name: `${p.firstName} ${p.lastName}`, email: p.email, createdAt: p.createdAt }, null, 2))
  }
  const appts = await mongoose.connection
    .collection('appointments')
    .find({})
    .sort({ createdAt: -1 })
    .limit(3)
    .toArray()
  console.log('=== Appointments (latest 3) ===')
  for (const a of appts) {
    console.log(JSON.stringify({ appointmentNo: a.appointmentNo, patientName: a.patientName, doctorId: a.doctorId, date: a.date, time: a.time, status: a.status, createdAt: a.createdAt }, null, 2))
  }
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
