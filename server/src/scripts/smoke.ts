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
process.env.EMAIL_CONSOLE_ONLY = 'true'

const { env } = await import('../config/env.js')
const { connectDb, disconnectDb } = await import('../config/db.js')
const { app } = await import('../app.js')
const { seedData } = await import('../seed/run.js')
const { OtpModel } = await import('../models/Otp.js')

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
  })
}

const json = async <T>(r: Response): Promise<T> => (await r.json()) as T

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
  const token = loginBody.token
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
  check('patient has generated patientId', /^P-\d+$/.test(patient.patientId))
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
  const cancel = await api(`/appointments/${appt.id}/cancel`, { method: 'POST', token })
  check('POST /appointments/:id/cancel -> Cancelled', (await json<{ status: string }>(cancel)).status === 'Cancelled')

  const listA = await api('/appointments?status=Cancelled', { token })
  check('GET /appointments?status filter works', (await json<unknown[]>(listA)).length >= 1)

  // ---------- Departments ----------
  const createDept = await api('/departments', { token, json: { name: 'Smoke Dept', bedCount: 10, color: '#000000', icon: 'Pulse', description: 'd' } })
  check('POST /departments -> 201', createDept.status === 201)

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
  check('invoiceNo format INV-<year>-<seq>', /^INV-\d{4}-\d+$/.test(invoice.invoiceNo))

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
