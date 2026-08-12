// ============================================================
// HealSync HMS — Doctors service
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http, USE_MOCK_API } from '../client'
import { mockDelay } from '../mock'
import { store, nextId } from '../store'
import type {
  Doctor,
  DoctorAccount,
  DoctorCalendar,
  DoctorDependencies,
  DoctorMetrics,
  DoctorStats,
  ReassignInput,
  ReassignResult,
  ResetPasswordResult,
} from '../../types'
import { getAvailabilitySlots, isWorkingDay, dayOfWeek } from '../availability'
import { mockCredentialsFor } from './misc'

export interface DoctorInput {
  name: string
  email: string
  phone: string
  department: string
  specialty: string
  qualification: string
  experienceYears: number
  birthYear: number
  consultationFee: number
  schedule: string[]
  status: Doctor['status']
}

function mockAccountFor(doctor: Doctor): Doctor['account'] {
  const account = store.accounts.find((a) => a.email === doctor.email)
  if (!account) return null
  return {
    id: account.id,
    status: account.status,
    lastLoginAt: account.lastLoginAt,
    createdAt: account.createdAt,
  }
}

function mockStatsFor(doctor: Doctor): DoctorMetrics {
  const appts = store.appointments.filter((a) => a.doctorId === doctor.id)
  const today = new Date().toISOString().slice(0, 10)
  const pending = appts.filter((a) => a.status === 'Pending').sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  const consulted = new Set(appts.map((a) => a.patientId))
  for (const c of store.consultations) if (c.doctorId === doctor.id) consulted.add(c.patientId)
  for (const p of store.patients) if (p.assignedDoctorId === doctor.id) consulted.add(p.id)
  return {
    appointmentsToday: appts.filter((a) => a.date === today).length,
    pendingAppointments: pending.length,
    pendingOldest: pending[0] ? `${pending[0].date} ${pending[0].time}` : null,
    consultationsCount: store.consultations.filter((c) => c.doctorId === doctor.id).length,
    prescriptionsCount: store.prescriptions.filter((rx) => rx.doctorId === doctor.id).length,
    patientsCount: consulted.size,
  }
}

export async function listDoctors(q: { search?: string; department?: string } = {}): Promise<Doctor[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    let list = [...store.doctors]
    if (q.search) {
      const s = q.search.toLowerCase()
      list = list.filter((d) => d.name.toLowerCase().includes(s) || d.specialty.toLowerCase().includes(s))
    }
    if (q.department && q.department !== 'All') list = list.filter((d) => d.department === q.department)
    return list.map((d) => ({ ...d, account: mockAccountFor(d) }))
  }
  return http.get<Doctor[]>(ENDPOINTS.DOCTORS, { params: { ...q } })
}

export async function getDoctor(id: string): Promise<Doctor> {
  if (USE_MOCK_API) {
    await mockDelay(300)
    const d = store.doctors.find((x) => x.id === id)
    if (!d) throw new Error('Doctor not found')
    return { ...d, account: mockAccountFor(d) }
  }
  return http.get<Doctor>(withParams(ENDPOINTS.DOCTOR_DETAIL, { id }))
}

export async function createDoctor(
  input: DoctorInput,
): Promise<Doctor & { credentials?: { username: string; password: string } | null }> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const doctor: Doctor = {
      id: nextId('d'),
      ...input,
      patientsCount: 0,
      rating: 4.5,
      account: null,
    }
    store.doctors.push(doctor)
    const account = {
      id: nextId('u'),
      name: doctor.name,
      email: doctor.email,
      username: mockCredentialsFor(doctor.name, input.birthYear).username,
      role: 'DOCTOR' as const,
      status: 'Active' as const,
      createdAt: new Date().toISOString(),
    }
    store.accounts.push(account)
    return { ...doctor, account: mockAccountFor(doctor), credentials: mockCredentialsFor(doctor.name, input.birthYear) }
  }
  return http.post<Doctor & { credentials?: { username: string; password: string } | null }>(
    ENDPOINTS.DOCTOR_CREATE,
    input,
  )
}

export async function updateDoctor(id: string, input: Partial<DoctorInput>): Promise<Doctor> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const idx = store.doctors.findIndex((x) => x.id === id)
    if (idx === -1) throw new Error('Doctor not found')
    store.doctors[idx] = { ...store.doctors[idx], ...input }
    return { ...store.doctors[idx], account: mockAccountFor(store.doctors[idx]!) }
  }
  return http.put<Doctor>(withParams(ENDPOINTS.DOCTOR_UPDATE, { id }), input)
}

export async function deleteDoctor(id: string): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    const deps = await getDoctorDependencies(id)
    if (deps.activeAppointments > 0 || deps.assignedPatients > 0) {
      throw new Error(
        `Cannot delete this doctor — ${deps.activeAppointments} active appointment(s) and ${deps.assignedPatients} assigned patient(s). Reassign them first.`,
      )
    }
    store.doctors = store.doctors.filter((x) => x.id !== id)
    return
  }
  await http.delete(withParams(ENDPOINTS.DOCTOR_DELETE, { id }))
}

// ---------- Live workload metrics (admin) ----------
export async function getDoctorMetrics(): Promise<Record<string, DoctorMetrics>> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    const out: Record<string, DoctorMetrics> = {}
    for (const d of store.doctors) out[d.id] = mockStatsFor(d)
    return out
  }
  return http.get<Record<string, DoctorMetrics>>(ENDPOINTS.DOCTOR_METRICS)
}

export async function getDoctorStats(id: string): Promise<DoctorStats> {
  if (USE_MOCK_API) {
    await mockDelay(350)
    const doctor = store.doctors.find((x) => x.id === id)
    if (!doctor) throw new Error('Doctor not found')
    const metrics = mockStatsFor(doctor)
    const appts = store.appointments.filter((a) => a.doctorId === id)
    const today = new Date().toISOString().slice(0, 10)
    const consults = store.consultations.filter((c) => c.doctorId === id)
    return {
      ...metrics,
      doctorId: id,
      appointmentsTotal: appts.length,
      completedToday: appts.filter((a) => a.date === today && a.status === 'Completed').length,
      lastConsultationAt: consults.reduce(
        (latest, c) => (c.createdAt > latest ? c.createdAt : latest),
        '',
      ),
    }
  }
  return http.get<DoctorStats>(withParams(ENDPOINTS.DOCTOR_STATS, { id }))
}

// ---------- Account governance (admin) ----------
export async function createDoctorAccount(
  id: string,
  input: { email: string; password: string },
): Promise<DoctorAccount> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const doctor = store.doctors.find((x) => x.id === id)
    if (!doctor) throw new Error('Doctor not found')
    if (store.accounts.some((a) => a.email === input.email)) {
      throw new Error('An account with this email already exists')
    }
    const account = {
      id: nextId('u'),
      name: doctor.name,
      email: input.email,
      username: mockCredentialsFor(doctor.name, doctor.birthYear ?? 1990).username,
      role: 'DOCTOR' as const,
      status: 'Active' as const,
      createdAt: new Date().toISOString(),
    }
    store.accounts.push(account)
    return { id: account.id, email: account.email, role: account.role, status: account.status }
  }
  return http.post<DoctorAccount>(withParams(ENDPOINTS.DOCTOR_ACCOUNT_CREATE, { id }), input)
}

export async function resetDoctorPassword(
  id: string,
  password?: string,
): Promise<ResetPasswordResult> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const doctor = store.doctors.find((x) => x.id === id)
    if (!doctor) throw new Error('Doctor not found')
    const account = store.accounts.find((a) => a.email === doctor.email)
    if (!account) throw new Error('No login account exists for this doctor yet')
    return { success: true, email: account.email, ...(password ? {} : { tempPassword: 'Medicore#2026xq' }) }
  }
  return http.post<ResetPasswordResult>(withParams(ENDPOINTS.DOCTOR_RESET_PASSWORD, { id }), { password })
}

export async function disableDoctorLogin(id: string): Promise<DoctorAccount> {
  if (USE_MOCK_API) {
    await mockDelay(500)
    const doctor = store.doctors.find((x) => x.id === id)
    if (!doctor) throw new Error('Doctor not found')
    const account = store.accounts.find((a) => a.email === doctor.email)
    if (!account) throw new Error('No login account exists for this doctor yet')
    account.status = 'Disabled'
    return { id: account.id, email: account.email, role: account.role, status: account.status }
  }
  return http.post<DoctorAccount>(withParams(ENDPOINTS.DOCTOR_DISABLE_LOGIN, { id }))
}

export async function enableDoctorLogin(id: string): Promise<DoctorAccount> {
  if (USE_MOCK_API) {
    await mockDelay(500)
    const doctor = store.doctors.find((x) => x.id === id)
    if (!doctor) throw new Error('Doctor not found')
    const account = store.accounts.find((a) => a.email === doctor.email)
    if (!account) throw new Error('No login account exists for this doctor yet')
    account.status = 'Active'
    return { id: account.id, email: account.email, role: account.role, status: account.status }
  }
  return http.post<DoctorAccount>(withParams(ENDPOINTS.DOCTOR_ENABLE_LOGIN, { id }))
}

// ---------- Dependencies & reassignment (admin) ----------
export async function getDoctorDependencies(id: string): Promise<DoctorDependencies> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    const active = store.appointments
      .filter((a) => a.doctorId === id && (a.status === 'Pending' || a.status === 'Confirmed'))
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    const patients = store.patients
      .filter((p) => p.assignedDoctorId === id)
      .sort((a, b) => a.lastName.localeCompare(b.lastName))
    return {
      activeAppointments: active.length,
      assignedPatients: patients.length,
      consultations: store.consultations.filter((c) => c.doctorId === id).length,
      prescriptions: store.prescriptions.filter((rx) => rx.doctorId === id).length,
      activeAppointmentIds: active.map((a) => a.id),
      assignedPatientIds: patients.map((p) => p.id),
      appointments: active,
      patients,
    }
  }
  return http.get<DoctorDependencies>(withParams(ENDPOINTS.DOCTOR_DEPENDENCIES, { id }))
}

export async function reassignDoctor(id: string, input: ReassignInput): Promise<ReassignResult> {
  if (USE_MOCK_API) {
    await mockDelay(800)
    const replacement = store.doctors.find((d) => d.id === input.doctorId)
    if (!replacement) throw new Error('Replacement doctor not found')
    if (replacement.status !== 'Active') throw new Error('The replacement doctor must be Active')
    let movedAppointments = 0
    for (const apptId of input.appointmentIds) {
      const idx = store.appointments.findIndex((a) => a.id === apptId && a.doctorId === id)
      if (idx === -1) continue
      store.appointments[idx] = {
        ...store.appointments[idx]!,
        doctorId: replacement.id,
        doctorName: replacement.name,
        department: replacement.department,
      }
      movedAppointments += 1
    }
    let movedPatients = 0
    for (const patientId of input.patientIds) {
      const idx = store.patients.findIndex((p) => p.id === patientId && p.assignedDoctorId === id)
      if (idx === -1) continue
      store.patients[idx] = {
        ...store.patients[idx]!,
        assignedDoctorId: replacement.id,
        department: replacement.department,
      }
      movedPatients += 1
    }
    return {
      movedAppointments,
      movedPatients,
      to: { id: replacement.id, name: replacement.name },
    }
  }
  return http.post<ReassignResult>(withParams(ENDPOINTS.DOCTOR_REASSIGN, { id }), input)
}

// ---------- Calendar (admin) ----------
export async function getDoctorCalendar(
  id: string,
  range: { start: string; end: string },
): Promise<DoctorCalendar> {
  if (USE_MOCK_API) {
    await mockDelay(450)
    const doctor = store.doctors.find((x) => x.id === id)
    if (!doctor) throw new Error('Doctor not found')
    const appointments = store.appointments
      .filter(
        (a) =>
          a.doctorId === id &&
          a.date >= range.start &&
          a.date <= range.end &&
          a.status !== 'Cancelled',
      )
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    const days = []
    const cursor = new Date(`${range.start}T00:00:00`)
    const endDate = new Date(`${range.end}T00:00:00`)
    while (cursor <= endDate) {
      const iso = cursor.toISOString().slice(0, 10)
      days.push({
        date: iso,
        day: cursor.toLocaleDateString('en-US', { weekday: 'short' }),
        workingDay: isWorkingDay(doctor, iso),
        status: doctor.status,
        slots: getAvailabilitySlots(doctor, appointments, iso).map((s) => ({
          time: s.time,
          end: s.end,
          available: s.available,
        })),
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    return {
      doctor: { id: doctor.id, name: doctor.name, department: doctor.department, status: doctor.status },
      appointments,
      days,
    }
  }
  return http.get<DoctorCalendar>(withParams(ENDPOINTS.DOCTOR_CALENDAR, { id }), {
    params: { ...range },
  })
}

export function doctorDayLabel(date: string): string {
  return dayOfWeek(date)
}
