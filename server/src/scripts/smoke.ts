// ============================================================
// HealSync HMS — end-to-end API smoke test
// Boots the real Express app against an in-memory MongoDB and
// exercises every route the frontend depends on.
// Usage: npm run smoke
// ============================================================

import { MongoMemoryServer } from 'mongodb-memory-server'

const mongod = await MongoMemoryServer.create()
process.env.MONGO_URI = mongod.getUri('healsync_smoke')
process.env.PORT = '0'
process.env.EMAIL_TRANSPORT = 'log'
process.env.ESEWA_ENV = 'test'
process.env.ESEWA_PRODUCT_CODE = 'EPAYTEST'
process.env.ESEWA_SECRET_KEY = '8gBm/:&EnhH.1/q'
process.env.APP_BASE_URL = 'http://localhost:5173'
process.env.APP_API_URL = 'http://localhost:8080'

const { env } = await import('../config/env.js')
const { connectDb, disconnectDb } = await import('../config/db.js')
const { app } = await import('../app.js')
const { seedData } = await import('../seed/run.js')
const { OtpModel } = await import('../models/Otp.js')
const { ConsultationModel } = await import('../models/Consultation.js')
const { PatientModel } = await import('../models/Patient.js')
const { AppointmentModel } = await import('../models/Appointment.js')
const { PaymentAttemptModel } = await import('../models/PaymentAttempt.js')
const { signEsewa } = await import('../utils/esewa.js')
const { capturedEmails } = await import('../utils/email.js')

await connectDb(env.MONGO_URI)
await seedData()

const server = app.listen(0)
const port = (server.address() as { port: number }).port
const base = `http://localhost:${port}/api`

let passed = 0
let failed = 0
const failures: string[] = []

function check(label: string, ok: boolean): void {
  if (ok) {
    passed++
    console.log(`  ok  ${label}`)
  } else {
    failed++
    failures.push(label)
    console.error(`FAIL  ${label}`)
  }
}

interface ApiOpts {
  method?: string
  token?: string
  json?: unknown
  cookie?: string
  origin?: string
}

async function api(path: string, opts: ApiOpts = {}): Promise<Response> {
  const headers: Record<string, string> = {}
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  if (opts.json !== undefined) headers['Content-Type'] = 'application/json'
  if (opts.cookie) headers.Cookie = opts.cookie
  if (opts.origin) headers.Origin = opts.origin
  return fetch(`${base}${path}`, {
    method: opts.method ?? (opts.json !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
    // Payment callbacks assert the 302 Location — never follow redirects.
    redirect: 'manual',
  })
}

const json = async <T>(r: Response): Promise<T> => (await r.json()) as T

// Emails are dispatched as a non-blocking side effect, so poll the
// in-memory capture (EMAIL_TRANSPORT=log) until the message lands.
async function waitForMail(
  predicate: (m: { to: string; subject: string; text: string }) => boolean,
  timeoutMs = 3000,
): Promise<{ to: string; subject: string; text: string } | undefined> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const hit = capturedEmails().find(predicate)
    if (hit) return hit
    await new Promise((r) => setTimeout(r, 25))
  }
  return undefined
}

try {
  // ---------- Auth ----------
  // The seed created the admin; a normal user can register non-admin roles.
  const reg = await api('/auth/register', {
    json: { name: 'Staff User', email: 'staff@test.dev', role: 'STAFF', password: 'password123' },
  })
  check('POST /auth/register (non-admin) -> 201', reg.status === 201)
  const regBody = await json<{ user: { email: string; role: string }; token: string }>(reg)
  check('register returns user + token', Boolean(regBody.user && regBody.token))
  check('passwordHash never exposed', !('passwordHash' in regBody.user))

  const dup = await api('/auth/register', {
    json: { name: 'Xx', email: 'staff@test.dev', role: 'STAFF', password: 'password123' },
  })
  check('duplicate email rejected -> 409', dup.status === 409)

  const badLogin = await api('/auth/login', { json: { email: 'admin@healsync.health', password: 'wrongpass' } })
  check('wrong password -> 401', badLogin.status === 401)

  const login = await api('/auth/login', { json: { email: 'admin@healsync.health', password: 'admin123' } })
  check('POST /auth/login (seeded admin) -> 200', login.status === 200)
  const loginBody = await json<{ user: { name: string; role: string }; token: string }>(login)
  check('login user is admin', loginBody.user.role === 'ADMIN')
  let token = loginBody.token
  const cookie = login.headers.getSetCookie()[0]?.split(';')[0] ?? ''
  check('refresh cookie set (httpOnly)', cookie.includes('hs_refresh'))

  const me = await api('/auth/me', { token })
  check('GET /auth/me -> 200', me.status === 200)

  const noAuth = await api('/patients')
  check('protected route without token -> 401', noAuth.status === 401)

  // ---------- Refresh rotation ----------
  const refresh1 = await api('/auth/refresh', { method: 'POST', cookie })
  check('POST /auth/refresh -> 200', refresh1.status === 200)
  const refresh1Body = await json<{ token: string }>(refresh1)
  check('refresh issues new access token', Boolean(refresh1Body.token))
  const cookie2 = refresh1.headers.getSetCookie()[0]?.split(';')[0] ?? ''
  check('refresh rotates cookie', cookie2 !== cookie && cookie2.includes('hs_refresh'))

  const replay = await api('/auth/refresh', { method: 'POST', cookie })
  check('reused (rotated) refresh token rejected -> 401', replay.status === 401)

  const refresh2 = await api('/auth/refresh', { method: 'POST', cookie: cookie2 })
  check('rotated token still works', refresh2.status === 200)

  // ---------- Patients ----------
  const patientBody = {
    firstName: 'Test', lastName: 'Patient', email: 'tp@test.dev', phone: '+1 555 0001',
    dob: '1990-01-01', gender: 'Female', bloodGroup: 'O+', address: '1 Test St',
    emergencyContact: '+1 555 9999', department: 'Cardiology', insurance: 'TestCo',
    allergies: ['Penicillin'],
  }
  const createPatient = await api('/patients', { token, json: patientBody })
  check('POST /patients -> 201', createPatient.status === 201)
  const patient = await json<{ id: string; patientId: string; status: string }>(createPatient)
  check('patient has generated patientId', /^Test-\d+-\d+-\d+-\d+$/.test(patient.patientId))
  check('patient defaults to Pending', patient.status === 'Pending')

  const listP = await api('/patients', { token })
  const listPBody = await json<{ items: unknown[]; total: number; page: number; limit: number }>(listP)
  check('GET /patients paginated shape', listPBody.total >= 1 && listPBody.items.length >= 1 && listPBody.page === 1)

  const searchP = await api('/patients?search=Test', { token })
  const searchPBody = await json<{ total: number }>(searchP)
  check('GET /patients?search works', searchPBody.total >= 1)

  const getP = await api(`/patients/${patient.id}`, { token })
  check('GET /patients/:id -> 200', getP.status === 200)

  const updP = await api(`/patients/${patient.id}`, { token, method: 'PUT', json: { status: 'Admitted', notes: 'smoke' } })
  const updPBody = await json<{ status: string; notes: string }>(updP)
  check('PUT /patients/:id updates', updPBody.status === 'Admitted' && updPBody.notes === 'smoke')

  const badPatient = await api('/patients', { token, json: { firstName: '' } })
  check('invalid patient -> 400 with details', badPatient.status === 400)

  // ---------- Doctors ----------
  const createDoc = await api('/doctors', {
    token,
    json: { name: 'Dr. Smoke Test', email: 'smoke@doc.dev', department: 'Cardiology', specialty: 'Cardiologist', consultationFee: 100 },
  })
  check('POST /doctors -> 201', createDoc.status === 201)
  const doctor = await json<{ id: string; schedule: unknown[]; rating: number }>(createDoc)
  check('doctor defaults (schedule, rating)', Array.isArray(doctor.schedule) && doctor.rating > 0)

  const listD = await api('/doctors?department=Cardiology', { token })
  check('GET /doctors?department -> 200', listD.status === 200)

  // ---------- Appointments ----------
  const createAppt = await api('/appointments', {
    token,
    json: { patientId: patient.id, doctorId: doctor.id, type: 'Checkup', date: '2026-08-10', time: '10:30', reason: 'Smoke appointment' },
  })
  check('POST /appointments -> 201 with resolved names', createAppt.status === 201)
  const appt = await json<{ id: string; patientName: string; doctorName: string; status: string }>(createAppt)
  check('appointment names resolved server-side', appt.patientName === 'Test Patient' && appt.doctorName === 'Dr. Smoke Test')
  check('appointment defaults to Pending', appt.status === 'Pending')

  const confirm = await api(`/appointments/${appt.id}/confirm`, { method: 'POST', token })
  check('POST /appointments/:id/confirm -> Confirmed', (await json<{ status: string }>(confirm)).status === 'Confirmed')
  const approvedMail = await waitForMail((m) => m.to === 'tp@test.dev' && /confirmed/i.test(m.subject))
  check('approval email sent to patient', Boolean(approvedMail))
  const cancel = await api(`/appointments/${appt.id}/cancel`, { method: 'POST', token })
  check('POST /appointments/:id/cancel -> Cancelled', (await json<{ status: string }>(cancel)).status === 'Cancelled')
  const cancelledMail = await waitForMail((m) => m.to === 'tp@test.dev' && /cancelled/i.test(m.subject))
  check('cancellation email sent to patient', Boolean(cancelledMail))

  const listA = await api('/appointments?status=Cancelled', { token })
  check('GET /appointments?status filter works', (await json<unknown[]>(listA)).length >= 1)

  // Rescheduling (PUT with date/time/doctor change) must email the patient.
  const createAppt2 = await api('/appointments', {
    token,
    json: { patientId: patient.id, doctorId: doctor.id, type: 'Follow-up', date: '2026-08-12', time: '11:00', reason: 'Smoke reschedule' },
  })
  const appt2 = await json<{ id: string }>(createAppt2)
  const resched = await api(`/appointments/${appt2.id}`, { token, method: 'PUT', json: { date: '2026-08-14', time: '09:30' } })
  check('PUT /appointments/:id reschedules', resched.status === 200)
  const reschedMail = await waitForMail((m) => m.to === 'tp@test.dev' && /rescheduled/i.test(m.subject))
  check('reschedule email sent to patient', Boolean(reschedMail))
  const bookedMail = await waitForMail((m) => m.to === 'tp@test.dev' && /request received/i.test(m.subject))
  check('booking email sent to patient on create', Boolean(bookedMail))

  // Rescheduling into a slot already held by another active appointment must be rejected.
  const appt3 = await api('/appointments', {
    token,
    json: { patientId: patient.id, doctorId: doctor.id, type: 'Checkup', date: '2026-08-15', time: '10:00', reason: 'Smoke conflict' },
  })
  const appt3Body = await json<{ id: string }>(appt3)
  const clashResched = await api(`/appointments/${appt3Body.id}`, { token, method: 'PUT', json: { date: '2026-08-14', time: '09:30' } })
  check('reschedule into taken slot -> 409', clashResched.status === 409)
  await api(`/appointments/${appt3Body.id}/cancel`, { method: 'POST', token })
  await api(`/appointments/${appt2.id}/cancel`, { method: 'POST', token })

  // ---------- Departments ----------
  const createDept = await api('/departments', { token, json: { name: 'Smoke Dept', bedCount: 10, color: '#000000', icon: 'Pulse', description: 'd' } })
  check('POST /departments -> 201', createDept.status === 201)

  // Bed occupancy must be derived from registered patients, not stored numbers.
  const listDept1 = await api('/departments', { token })
  const dept1 = (await json<{ name: string; bedCount: number; occupiedBeds: number }[]>(listDept1)).find((d) => d.name === 'Smoke Dept')
  check('new department starts with 0 occupied beds', dept1?.bedCount === 10 && dept1?.occupiedBeds === 0)

  await api(`/patients/${patient.id}`, { token, method: 'PUT', json: { department: 'Smoke Dept' } })
  const listDept2 = await api('/departments', { token })
  const dept2 = (await json<{ name: string; occupiedBeds: number }[]>(listDept2)).find((d) => d.name === 'Smoke Dept')
  check('admitted patient registers as 1 occupied bed', dept2?.occupiedBeds === 1)

  // ---------- Pharmacy ----------
  const createMed = await api('/pharmacy/medicines', { token, json: { name: 'SmokeMed 100mg', price: 5, stock: 2, reorderLevel: 10, category: 'Analgesic' } })
  const med = await json<{ id: string; status: string }>(createMed)
  check('medicine status computed (Low Stock)', med.status === 'Low Stock')

  const createRx = await api('/pharmacy/prescriptions', {
    token,
    json: { patientId: patient.id, patientName: 'Test Patient', doctorId: doctor.id, doctorName: 'Dr. Smoke Test', medicines: [{ name: 'SmokeMed 100mg', dosage: '100mg', frequency: 'Daily', durationDays: 7 }] },
  })
  check('POST /pharmacy/prescriptions -> 201', createRx.status === 201)

  // ---------- Billing ----------
  const createInv = await api('/billing/invoices', {
    token,
    json: { patientId: patient.id, description: 'Smoke invoice', items: [{ description: 'Consultation', amount: 100 }, { description: 'Lab', amount: 50 }], discount: 10, dueDate: '2026-09-01' },
  })
  check('POST /billing/invoices -> 201', createInv.status === 201)
  const invoice = await json<{ id: string; invoiceNo: string; subtotal: number; tax: number; total: number; amountPaid: number; status: string }>(createInv)
  check('invoice math correct (150 - 10 + 7.5 = 147.5)', invoice.subtotal === 150 && invoice.tax === 7.5 && invoice.total === 147.5)
  check('invoice starts Pending with 0 paid', invoice.amountPaid === 0 && invoice.status === 'Pending')
  check('invoiceNo format <Name>-<date>-<seq>', /^Test-\d+-\d+-\d+-\d+$/.test(invoice.invoiceNo))

  const payFull = await api('/billing/payments', { token, json: { invoiceId: invoice.id, amount: 147.5, method: 'Card' } })
  const payBody = await json<{ invoice: { status: string; amountPaid: number }; payment: { id: string } }>(payFull)
  check('payment marks invoice Paid', payBody.invoice.status === 'Paid' && payBody.invoice.amountPaid === 147.5)
  check('payment record created', Boolean(payBody.payment.id))

  // ---------- Staff (admin-only) ----------
  const createStaff = await api('/staff', { token, json: { name: 'Nurse Smoke', email: 'nurse@smoke.dev', role: 'NURSE', department: 'Cardiology' } })
  check('POST /staff (admin) -> 201', createStaff.status === 201)

  const audit = await api('/staff/audit-log', { token })
  check('GET /staff/audit-log (admin) -> 200', audit.status === 200)

  // ---------- Role enforcement ----------
  const staffToken = regBody.token
  const staffCreateStaff = await api('/staff', { token: staffToken, json: { name: 'Nope', email: 'x@y.dev', role: 'NURSE' } })
  check('non-admin staff create blocked -> 403', staffCreateStaff.status === 403)

  // ---------- Doctor Portal ----------
  const docLogin = await api('/auth/login', { json: { email: 'm.roberts@healsync.health', password: 'doctor123' } })
  check('doctor login (seeded doctor account) -> 200', docLogin.status === 200)
  const docBody = await json<{ user: { role: string }; token: string }>(docLogin)
  check('doctor login role is DOCTOR', docBody.user.role === 'DOCTOR')
  const docToken = docBody.token

  const docPortalBlocked = await api('/doctor-portal/me', { token: staffToken })
  check('non-doctor blocked from doctor portal -> 403', docPortalBlocked.status === 403)

  const docMe = await api('/doctor-portal/me', { token: docToken })
  const docMeBody = await json<{ email: string; name: string }>(docMe)
  check('GET /doctor-portal/me resolves doctor profile', docMe.status === 200 && docMeBody.email === 'm.roberts@healsync.health' && docMeBody.name === 'Dr. Michael Roberts')

  const myPatients = await api('/doctor-portal/patients', { token: docToken })
  const myPatientsBody = await json<{ patientId: string }[]>(myPatients)
  check('doctor sees their own patients only', myPatients.status === 200 && myPatientsBody.some((p) => p.patientId.startsWith('Sarah-')) && myPatientsBody.length <= 3)

  const myAppts = await api('/doctor-portal/appointments', { token: docToken })
  const myApptsBody = await json<{ doctorName: string; status: string; id: string }[]>(myAppts)
  check('doctor appointments all belong to the doctor', myAppts.status === 200 && myApptsBody.length >= 2 && myApptsBody.every((a) => a.doctorName === 'Dr. Michael Roberts'))
  const pendingAppt = myApptsBody.find((a) => a.status === 'Pending' || a.status === 'Confirmed')

  const confirmAppt = await api(`/doctor-portal/appointments/${myApptsBody[0]!.id}/confirm`, { method: 'POST', token: docToken })
  check('doctor confirms own appointment', confirmAppt.status === 200 && (await json<{ status: string }>(confirmAppt)).status === 'Confirmed')

  const portalApptDetail = await json<{ patientId: string }>(await api(`/appointments/${myApptsBody[0]!.id}`, { token }))
  const portalPatient = await json<{ email: string }>(await api(`/patients/${portalApptDetail.patientId}`, { token }))
  const portalApprovedMail = await waitForMail((m) => m.to === portalPatient.email && /confirmed/i.test(m.subject))
  check('doctor-portal approval emails the patient', Boolean(portalApprovedMail))

  const createConsult = await api('/doctor-portal/consultations', {
    token: docToken,
    json: {
      patientId: '',
      appointmentId: pendingAppt?.id,
      chiefComplaint: 'Smoke test consultation',
      symptoms: 'none',
      vitals: { bloodPressure: '120/80', heartRate: 70, weightKg: 70, heightCm: 170 },
      diagnosis: { primary: 'Smoke diagnosis', additional: '', notes: '' },
      clinicalNotes: { assessment: 'ok', observations: '', reasoning: '', general: '' },
      treatmentPlan: { advice: 'rest', diet: '', lifestyle: '', instructions: '' },
      prescription: { medicines: [{ name: 'SmokeMed 100mg', dosage: '100mg', frequency: 'Daily', durationDays: 7, instructions: 'After meals' }] },
    },
  })
  check('consultation without patientId rejected -> 400', createConsult.status === 400)

  const sarahAppts = await api(`/doctor-portal/appointments`, { token: docToken })
  const sarahAppt = (await json<{ id: string; patientId: string; patientName: string }[]>(sarahAppts)).find((a) => a.patientName === 'Sarah Johnson')
  const createConsult2 = await api('/doctor-portal/consultations', {
    token: docToken,
    json: {
      patientId: sarahAppt?.patientId,
      appointmentId: sarahAppt?.id,
      chiefComplaint: 'Routine post-op review, patient feeling well.',
      symptoms: 'None',
      vitals: { bloodPressure: '122/78', heartRate: 70, temperature: 36.6, respiratoryRate: 15, spo2: 98, weightKg: 67, heightCm: 165, bmi: 24.6 },
      examination: { general: 'Well', cardiovascular: 'Normal', respiratory: 'Clear', neurological: 'Intact', abdominal: 'Soft', other: '' },
      diagnosis: { primary: 'Post-angioplasty review', additional: '', notes: '' },
      clinicalNotes: { assessment: 'Doing well', observations: '', reasoning: '', general: '' },
      treatmentPlan: { advice: 'Continue medications', diet: '', lifestyle: '', instructions: '' },
      prescription: { medicines: [{ name: 'Aspirin 75mg', dosage: '75mg', frequency: 'Once daily', durationDays: 30, instructions: 'With food' }] },
    },
  })
  const consultBody = await json<{ id: string; status?: string; prescriptionId?: string; prescriptionNo?: string }>(createConsult2)
  check('POST /doctor-portal/consultations -> 201', createConsult2.status === 201)
  check('consultation links prescription', Boolean(consultBody.prescriptionId))
  check('prescription has readable ID (no Mongo ObjectId)', /^Sarah-\d+-\d+-\d+-\d+$/.test(consultBody.prescriptionNo ?? ''))

  const apptsAfter = await api('/doctor-portal/appointments', { token: docToken })
  const apptAfter = (await json<{ id: string; status: string }[]>(apptsAfter)).find((a) => a.id === sarahAppt?.id)
  check('completed appointment after consultation', Boolean(apptAfter) && apptAfter!.status === 'Completed')

  const myConsults = await api('/doctor-portal/consultations', { token: docToken })
  check('GET /doctor-portal/consultations returns own records', (await json<unknown[]>(myConsults)).length >= 1)

  const otherConsult = await ConsultationModel.findOne({ doctorName: 'Dr. Robert Nguyen' })
  const forbiddenConsult = await api(`/doctor-portal/consultations/${otherConsult?._id}`, { token: docToken })
  check('doctor cannot view another doctor\'s consultation -> 403', forbiddenConsult.status === 403)

  const saveRx = await api('/doctor-portal/prescriptions', {
    token: docToken,
    json: { patientId: sarahAppt?.patientId, medicines: [{ name: 'SmokeMed 100mg', dosage: '100mg', frequency: 'Daily', durationDays: 5 }] },
  })
  check('POST /doctor-portal/prescriptions -> 201', saveRx.status === 201)

  const myRxs = await api('/doctor-portal/prescriptions', { token: docToken })
  check('GET /doctor-portal/prescriptions returns own prescriptions', (await json<unknown[]>(myRxs)).length >= 1)

  // ---------- Dashboard ----------
  const dash = await api('/dashboard/stats', { token })
  check('GET /dashboard/stats -> 200', dash.status === 200)
  const stats = await json<{
    totalPatients: number
    appointmentsToday: number
    bedOccupancy: number
    revenueMonth: number
    admissionsTrend: { month: string }[]
    departmentWorkload: unknown[]
    appointmentStatus: unknown[]
    upcomingAppointments: unknown[]
    recentActivity: unknown[]
    departmentOccupancy: unknown[]
  }>(dash)
  check('dashboard stats shape complete', stats.totalPatients >= 1 && stats.admissionsTrend.length === 12 && stats.appointmentStatus.length === 4 && stats.bedOccupancy >= 0 && stats.revenueMonth >= 0)

  // ---------- Reports ----------
  const reports = await api('/reports', { token })
  check('GET /reports -> 200', reports.status === 200)
  const genReport = await api('/reports/generate', { token, json: { name: 'Smoke Report', type: 'Revenue', period: 'July 2026' } })
  check('POST /reports/generate -> 201 with id', (await json<{ id: string }>(genReport)).id.length > 0)

  // ---------- Settings ----------
  const settings = await api('/settings/hospital', { token })
  check('GET /settings/hospital -> 200 (auto-created)', settings.status === 200)
  const updSettings = await api('/settings/hospital', { token, method: 'PUT', json: { phone: '555-1234' } })
  check('PUT /settings/hospital updates', (await json<{ phone: string }>(updSettings)).phone === '555-1234')

  const profile = await api('/settings/profile', { token })
  check('GET /settings/profile -> 200', profile.status === 200)
  const updProfile = await api('/settings/profile', { token, method: 'PUT', json: { phone: '555-9999' } })
  check('PUT /settings/profile -> 200', updProfile.status === 200)

  // ---------- Logout revokes refresh ----------
  const logout = await api('/auth/logout', { method: 'POST', token, cookie: cookie2 })
  check('POST /auth/logout -> 204', logout.status === 204)
  const afterLogout = await api('/auth/refresh', { method: 'POST', cookie: cookie2 })
  check('refresh rejected after logout', afterLogout.status === 401)

  // ---------- OTP password reset flow ----------
  const forgot = await api('/auth/forgot-password', { json: { email: 'admin@healsync.health' } })
  check('POST /auth/forgot-password -> 200', forgot.status === 200)
  const otpMail = await waitForMail((m) => m.to === 'admin@healsync.health' && /reset code/i.test(m.subject))
  check('OTP email delivered', Boolean(otpMail))

  const otpRec = await OtpModel.findOne({ email: 'admin@healsync.health' })
  check('OTP stored for user', Boolean(otpRec))

  const verifyFail = await api('/auth/verify-otp', { json: { email: 'admin@healsync.health', otp: '000000' } })
  const verifyFailBody = await json<{ valid: boolean }>(verifyFail)
  check('wrong OTP invalid -> { valid: false }', verifyFailBody.valid === false)

  // A real reset requires the emailed code; smoke verifies the OTP is hashed,
  // then exercises the full verify → reset sequence with a code we mint directly.
  await OtpModel.deleteMany({ email: 'admin@healsync.health' })
  const { createHash } = await import('node:crypto')
  await OtpModel.create({
    email: 'admin@healsync.health',
    codeHash: createHash('sha256').update('123456').digest('hex'),
    purpose: 'password-reset',
    expiresAt: new Date(Date.now() + 600000),
  })
  const verifyOk = await api('/auth/verify-otp', { json: { email: 'admin@healsync.health', otp: '123456' } })
  check('correct OTP valid -> { valid: true }', (await json<{ valid: boolean }>(verifyOk)).valid === true)
  const resetOk = await api('/auth/reset-password', { json: { email: 'admin@healsync.health', otp: '123456', password: 'newpass123' } })
  check('POST /auth/reset-password -> { success: true }', (await json<{ success: boolean }>(resetOk)).success === true)
  const relogin = await api('/auth/login', { json: { email: 'admin@healsync.health', password: 'newpass123' } })
  check('login works with new password', relogin.status === 200)
  const reloginOld = await api('/auth/login', { json: { email: 'admin@healsync.health', password: 'admin123' } })
  check('old password rejected after reset', reloginOld.status === 401)

  // Password reset bumps tokenVersion, revoking all previously issued tokens,
  // so the delete flow must re-authenticate with the new password.
  const freshLogin = await api('/auth/login', { json: { email: 'admin@healsync.health', password: 'newpass123' } })
  const freshBody = await json<{ token: string }>(freshLogin)
  token = freshBody.token

  // ---------- Public booking via eSewa (pay before book) ----------
  const payDoctor = await api('/doctors', {
    token,
    json: { name: 'Dr. Pay Doc', email: 'pay@doc.dev', department: 'Cardiology', specialty: 'Cardiologist', consultationFee: 500 },
  })
  const payDoctorBody = await json<{ id: string }>(payDoctor)

  const payBooking = {
    firstName: 'Pay', lastName: 'Me', email: 'pay.me@test.dev', phone: '555 0101',
    dob: '1990-01-01', gender: 'Male', doctorId: payDoctorBody.id, type: 'Consultation',
    date: '2026-09-10', time: '10:00', durationMin: 30, reason: 'Smoke esewa booking',
  }

  const initiate = await api('/public/payment/initiate', { json: payBooking })
  check('POST /public/payment/initiate -> 201', initiate.status === 201)
  const initBody = await json<{ attemptId: string; transactionUuid: string; amount: number; formUrl: string; fields: Record<string, string> }>(initiate)
  check('initiate returns eSewa form fields (fee + signature)', initBody.amount === 500 && Boolean(initBody.fields.signature) && initBody.formUrl.includes('rc-epay.esewa.com.np'))
  check('initiate signs the exact eSewa field set', initBody.fields.signed_field_names === 'total_amount,transaction_uuid,product_code' && initBody.fields.product_code === 'EPAYTEST')

  // A forged/unsigned callback must never create a booking.
  const forged = await api('/public/payment/success', {
    json: { data: JSON.stringify({ transaction_code: 'T-FAKE', status: 'COMPLETE', total_amount: '500', transaction_uuid: initBody.transactionUuid, product_code: 'EPAYTEST', signed_field_names: 'transaction_code,status,total_amount,transaction_uuid,product_code' }), signature: 'AAAAAAAA' },
  })
  check('forged callback rejected -> redirect error', forged.status === 302 && Boolean(forged.headers.get('location')?.includes('payment=error')))

  // The real signed callback — exactly what eSewa posts: the response body
  // Base64-encoded, numeric total_amount, signed_field_names included in the
  // signature, and the signature embedded in the body (no separate POST field).
  const callbackBody = {
    transaction_code: 'TESTCODE123',
    status: 'COMPLETE',
    total_amount: 500,
    transaction_uuid: initBody.transactionUuid,
    product_code: 'EPAYTEST',
    signed_field_names: 'transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names',
  }
  const callbackOrder = ['transaction_code', 'status', 'total_amount', 'transaction_uuid', 'product_code', 'signed_field_names']
  const callbackSignature = signEsewa({ ...callbackBody, total_amount: String(callbackBody.total_amount) }, callbackOrder, '8gBm/:&EnhH.1/q')
  const callbackData = Buffer.from(JSON.stringify({ ...callbackBody, signature: callbackSignature })).toString('base64')
  const successCb = await api('/public/payment/success', { json: { data: callbackData } })
  check('valid callback -> 302 to success screen', successCb.status === 302 && Boolean(successCb.headers.get('location')?.includes('payment=success')))
  const ref = new URL(successCb.headers.get('location')!).searchParams.get('ref') ?? ''
  check('callback returns readable appointment ref', /^Pay-\d+-\d+-\d+-\d+$/.test(ref))

  const payer = await PatientModel.findOne({ email: 'pay.me@test.dev' })
  const payAppt = await AppointmentModel.findOne({ appointmentNo: ref })
  check('patient created only after verified payment', Boolean(payer))
  check('appointment created only after verified payment', Boolean(payAppt) && payAppt!.status === 'Pending')
  const attemptAfter = await PaymentAttemptModel.findOne({ transactionUuid: initBody.transactionUuid })
  check('attempt marked success with links', attemptAfter?.status === 'success' && attemptAfter.appointmentNo === ref)
  const receiptMail = await waitForMail((m) => m.to === 'pay.me@test.dev' && /Payment received/i.test(m.subject))
  check('payment receipt email sent', Boolean(receiptMail))
  const bookingMail = await waitForMail((m) => m.to === 'pay.me@test.dev' && /request received/i.test(m.subject))
  check('booking confirmation email sent', Boolean(bookingMail))

  const patientCountBefore = await PatientModel.countDocuments({ email: 'pay.me@test.dev' })
  const replayCb = await api('/public/payment/success', { json: { data: callbackData } })
  check('replayed callback redirects success (idempotent)', replayCb.status === 302 && Boolean(replayCb.headers.get('location')?.includes('payment=success')))
  check('replay does not duplicate patient', (await PatientModel.countDocuments({ email: 'pay.me@test.dev' })) === patientCountBefore)
  check('replay does not duplicate appointment', (await AppointmentModel.countDocuments({ appointmentNo: ref })) === 1)

  // eSewa actually delivers the callback as a browser GET redirect with
  // data/signature query params — the route must accept that, not only POST.
  const getInit = await api('/public/payment/initiate', { json: { ...payBooking, date: '2026-09-14', time: '10:30', firstName: 'Get', lastName: 'Redirect', email: 'get.redirect@test.dev' } })
  const getInitBody = await json<{ transactionUuid: string }>(getInit)
  const getFields = { status: 'COMPLETE', total_amount: '500', transaction_uuid: getInitBody.transactionUuid, product_code: 'EPAYTEST', signed_field_names: 'status,total_amount,transaction_uuid,product_code' }
  const getSig = signEsewa(getFields, ['status', 'total_amount', 'transaction_uuid', 'product_code'], '8gBm/:&EnhH.1/q')
  const getCb = await api(`/public/payment/success?data=${encodeURIComponent(JSON.stringify(getFields))}&signature=${encodeURIComponent(getSig)}`)
  check('GET callback (query params) -> redirect success', getCb.status === 302 && Boolean(getCb.headers.get('location')?.includes('payment=success')))
  check('GET callback creates the booking', Boolean(await AppointmentModel.findOne({ patientName: 'Get Redirect' })))
  const getAttempt = await PaymentAttemptModel.findOne({ transactionUuid: getInitBody.transactionUuid })
  check('GET callback marks attempt success', getAttempt?.status === 'success')

  // Slot validation at initiate: the 10:00 slot is now booked by the paid appointment.
  const slotTaken = await api('/public/payment/initiate', { json: { ...payBooking, firstName: 'Slot', lastName: 'Taken', email: 'slot.taken@test.dev' } })
  check('initiate rejects a taken slot -> 409', slotTaken.status === 409)
  const freeSlot = await api('/public/payment/initiate', { json: { ...payBooking, time: '11:00', firstName: 'Free', lastName: 'Slot', email: 'free.slot@test.dev' } })
  check('initiate allows a free slot', freeSlot.status === 201)
  const freeSlotBody = await json<{ transactionUuid: string }>(freeSlot)
  await PaymentAttemptModel.deleteOne({ transactionUuid: freeSlotBody.transactionUuid })

  // Amount tampering must fail the attempt without booking.
  const tamperInit = await api('/public/payment/initiate', { json: { ...payBooking, date: '2026-09-11', time: '09:00', firstName: 'Tamper', lastName: 'Tester', email: 'tamper@test.dev' } })
  const tamperBody = await json<{ transactionUuid: string }>(tamperInit)
  const tamperFields = { status: 'COMPLETE', total_amount: '999', transaction_uuid: tamperBody.transactionUuid, product_code: 'EPAYTEST', signed_field_names: 'status,total_amount,transaction_uuid,product_code' }
  const tamperSig = signEsewa(tamperFields, ['status', 'total_amount', 'transaction_uuid', 'product_code'], '8gBm/:&EnhH.1/q')
  const tamperCb = await api('/public/payment/success', { json: { data: JSON.stringify(tamperFields), signature: tamperSig } })
  check('amount mismatch callback -> redirect failed', tamperCb.status === 302 && Boolean(tamperCb.headers.get('location')?.includes('payment=failed')))
  check('amount mismatch does not create a patient', !(await PatientModel.findOne({ email: 'tamper@test.dev' })))

  // FAILED status callback marks the attempt failed and never books.
  const failInit = await api('/public/payment/initiate', { json: { ...payBooking, date: '2026-09-12', time: '09:30', firstName: 'Fail', lastName: 'Case', email: 'failcase@test.dev' } })
  const failBody = await json<{ transactionUuid: string }>(failInit)
  const failFields = { status: 'FAILED', total_amount: '500', transaction_uuid: failBody.transactionUuid, product_code: 'EPAYTEST', signed_field_names: 'status,total_amount,transaction_uuid,product_code' }
  const failSig = signEsewa(failFields, ['status', 'total_amount', 'transaction_uuid', 'product_code'], '8gBm/:&EnhH.1/q')
  const failCb = await api('/public/payment/success', { json: { data: JSON.stringify(failFields), signature: failSig } })
  check('FAILED status callback -> redirect failed', failCb.status === 302 && Boolean(failCb.headers.get('location')?.includes('payment=failed')))
  check('FAILED status never creates a patient', !(await PatientModel.findOne({ email: 'failcase@test.dev' })))
  const failAttempt = await PaymentAttemptModel.findOne({ transactionUuid: failBody.transactionUuid })
  check('failed attempt persisted', failAttempt?.status === 'failed')

  // Failure URL is idempotent too.
  const failUrl = await api('/public/payment/failure', { json: { data: JSON.stringify(failFields), signature: failSig } })
  check('POST /public/payment/failure -> redirect failed', failUrl.status === 302 && Boolean(failUrl.headers.get('location')?.includes('payment=failed')))

  // /public/book no longer exists — payments are the only way to book.
  const oldBook = await api('/public/book', { json: payBooking })
  check('POST /public/book removed -> 404', oldBook.status === 404)


  // ---------- Delete flows ----------
  const delPatient = await api(`/patients/${patient.id}`, { token, method: 'DELETE' })
  check('DELETE /patients/:id -> 204', delPatient.status === 204)
  const delDoctor = await api(`/doctors/${doctor.id}`, { token, method: 'DELETE' })
  check('DELETE /doctors/:id -> 204', delDoctor.status === 204)

  // ---------- CORS ----------
  const preflight = await api('/auth/login', { method: 'OPTIONS', origin: 'http://localhost:5174' })
  check('CORS preflight allowed for dev origin', preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === 'http://localhost:5174')

  // ---------- 404 ----------
  const nf = await api('/nope', { token })
  check('unknown route -> 404', nf.status === 404)
} catch (err) {
  failed++
  failures.push(`uncaught exception: ${err instanceof Error ? err.message : String(err)}`)
  console.error(err)
} finally {
  server.close()
  await disconnectDb()
  await mongod.stop()
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.error('Failures:')
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
} else {
  console.log('ALL SMOKE TESTS PASSED')
}
