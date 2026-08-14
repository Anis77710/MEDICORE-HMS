// ============================================================
// Medicore HMS — Doctor Portal service
// Doctor-scoped clinical data. Real API: /doctor-portal/*
// Mock:     simulates the same contract against the in-memory store.
// The logged-in doctor is always resolved server-side (by email for
// the real API, by the mock staff record for mock mode), so a doctor
// can never address another doctor's records through this service.
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http, USE_MOCK_API } from '../client'
import { mockDelay } from '../mock'
import { store, nextId } from '../store'
import { dayOfWeek } from '../availability'
import type {
  Appointment,
  Consultation,
  ConsultationCreateInput,
  Doctor,
  DoctorPrescriptionCreateInput,
  Patient,
  Prescription,
  User,
} from '../../types'

const MOCK_USER_KEY = 'medicore_mock_user'

function readMockUser(): User | null {
  try {
    const raw = localStorage.getItem(MOCK_USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function mockDoctorFor(user: User): Doctor {
  const staff = store.staff.find((s) => s.role === 'DOCTOR' && s.name === user.name)
  const doctor = store.doctors.find((d) => d.name === (staff?.name || user.name))
  if (!doctor) throw new Error('Doctor profile not found. Contact an administrator.')
  return doctor
}

async function mockDoctor(): Promise<Doctor> {
  await mockDelay(200)
  const user = readMockUser()
  if (!user) throw new Error('Not signed in')
  return mockDoctorFor(user)
}

export async function getDoctorProfile(): Promise<Doctor> {
  if (USE_MOCK_API) return mockDoctor()
  return http.get<Doctor>(ENDPOINTS.DOCTOR_ME)
}

export interface DoctorPatientQuery {
  search?: string
  status?: string
}

export async function getMyPatients(q: DoctorPatientQuery = {}): Promise<Patient[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    const doctor = await mockDoctor()
    const ids = new Set<string>()
    for (const a of store.appointments) if (a.doctorId === doctor.id) ids.add(a.patientId)
    for (const c of store.consultations) if (c.doctorId === doctor.id) ids.add(c.patientId)
    let list = store.patients.filter(
      (p) => p.assignedDoctorId === doctor.id || ids.has(p.id),
    )
    if (q.search) {
      const s = q.search.toLowerCase()
      list = list.filter(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(s) ||
          p.patientId.toLowerCase().includes(s),
      )
    }
    if (q.status && q.status !== 'All') list = list.filter((p) => p.status === q.status)
    return list.sort((a, b) => b.lastVisit.localeCompare(a.lastVisit))
  }
  return http.get<Patient[]>(ENDPOINTS.DOCTOR_PATIENTS, { params: { ...q } })
}

export interface DoctorAppointmentQuery {
  date?: string
  status?: string
  search?: string
}

export async function getMyAppointments(q: DoctorAppointmentQuery = {}): Promise<Appointment[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    const doctor = await mockDoctor()
    let list = store.appointments.filter((a) => a.doctorId === doctor.id)
    if (q.status && q.status !== 'All') list = list.filter((a) => a.status === q.status)
    if (q.date) list = list.filter((a) => a.date === q.date)
    if (q.search) {
      const s = q.search.toLowerCase()
      list = list.filter(
        (a) =>
          a.patientName.toLowerCase().includes(s) ||
          a.reason.toLowerCase().includes(s) ||
          a.type.toLowerCase().includes(s),
      )
    }
    return list.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  }
  return http.get<Appointment[]>(ENDPOINTS.DOCTOR_APPOINTMENTS, { params: { ...q } })
}

export async function confirmAppointment(id: string): Promise<Appointment> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    const idx = store.appointments.findIndex((a) => a.id === id)
    if (idx === -1) throw new Error('Appointment not found')
    store.appointments[idx] = { ...store.appointments[idx], status: 'Confirmed' }
    return store.appointments[idx]
  }
  return http.post<Appointment>(withParams(ENDPOINTS.DOCTOR_APPOINTMENT_CONFIRM, { id }))
}

export async function cancelAppointment(id: string): Promise<Appointment> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    const idx = store.appointments.findIndex((a) => a.id === id)
    if (idx === -1) throw new Error('Appointment not found')
    store.appointments[idx] = { ...store.appointments[idx], status: 'Cancelled' }
    return store.appointments[idx]
  }
  return http.post<Appointment>(withParams(ENDPOINTS.DOCTOR_APPOINTMENT_CANCEL, { id }))
}

export interface RescheduleAppointmentInput {
  date: string
  time: string
  durationMin?: number
  reason: string
  note?: string
}

export async function rescheduleAppointment(
  id: string,
  input: RescheduleAppointmentInput,
): Promise<Appointment> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const idx = store.appointments.findIndex((a) => a.id === id)
    if (idx === -1) throw new Error('Appointment not found')
    const existing = store.appointments[idx]!
    const doctor = store.doctors.find((d) => d.id === existing.doctorId)
    const day = dayOfWeek(input.date)
    if (doctor && doctor.schedule.length > 0 && !doctor.schedule.includes(day)) {
      throw new Error(`${doctor.name} does not work on ${day} — choose a working day`)
    }
    const clash = store.appointments.some(
      (a) =>
        a.id !== id &&
        a.doctorId === existing.doctorId &&
        a.date === input.date &&
        a.time === input.time &&
        a.status !== 'Cancelled',
    )
    if (clash) throw new Error('This time slot is already booked — choose a different time')
    store.appointments[idx] = {
      ...existing,
      date: input.date,
      time: input.time,
      durationMin: input.durationMin ?? existing.durationMin,
    }
    return store.appointments[idx]
  }
  return http.post<Appointment>(withParams(ENDPOINTS.DOCTOR_APPOINTMENT_RESCHEDULE, { id }), input)
}

export async function listConsultations(q: { patientId?: string } = {}): Promise<Consultation[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    const doctor = await mockDoctor()
    let list = store.consultations.filter((c) => c.doctorId === doctor.id)
    if (q.patientId) list = list.filter((c) => c.patientId === q.patientId)
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return http.get<Consultation[]>(ENDPOINTS.DOCTOR_CONSULTATIONS, { params: { ...q } })
}

export async function getConsultation(id: string): Promise<Consultation> {
  if (USE_MOCK_API) {
    await mockDelay(300)
    const doctor = await mockDoctor()
    const c = store.consultations.find((x) => x.id === id && x.doctorId === doctor.id)
    if (!c) throw new Error('Consultation not found')
    return c
  }
  return http.get<Consultation>(withParams(ENDPOINTS.DOCTOR_CONSULTATION, { id }))
}

export async function createConsultation(input: ConsultationCreateInput): Promise<Consultation> {
  if (USE_MOCK_API) {
    await mockDelay(700)
    const doctor = await mockDoctor()
    const patient = store.patients.find((p) => p.id === input.patientId)
    if (!patient) throw new Error('Patient not found')

    let prescriptionId = input.prescriptionId
    if (!prescriptionId && input.prescription && input.prescription.medicines.length > 0) {
      const rx = savePrescriptionMock(
        doctor,
        { patientId: patient.id, medicines: input.prescription.medicines },
        patient,
      )
      prescriptionId = rx.id
    }

    if (input.appointmentId) {
      const idx = store.appointments.findIndex((a) => a.id === input.appointmentId)
      if (idx !== -1 && store.appointments[idx]!.doctorId === doctor.id) {
        store.appointments[idx] = { ...store.appointments[idx]!, status: 'Completed' }
      }
    }

    const now = new Date().toISOString()
    const consultation: Consultation = {
      id: nextId('c'),
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      doctorId: doctor.id,
      doctorName: doctor.name,
      appointmentId: input.appointmentId,
      chiefComplaint: input.chiefComplaint,
      symptoms: input.symptoms,
      vitals: input.vitals,
      examination: input.examination,
      diagnosis: input.diagnosis,
      clinicalNotes: input.clinicalNotes,
      treatmentPlan: input.treatmentPlan,
      prescriptionId,
      createdAt: now,
      updatedAt: now,
    }
    store.consultations.unshift(consultation)
    const pIdx = store.patients.findIndex((p) => p.id === patient.id)
    if (pIdx !== -1) {
      store.patients[pIdx] = {
        ...store.patients[pIdx]!,
        lastVisit: now.slice(0, 10),
        status: patient.status === 'Pending' ? 'Outpatient' : patient.status,
      }
    }
    return consultation
  }
  return http.post<Consultation>(ENDPOINTS.DOCTOR_CONSULTATIONS, input)
}

function savePrescriptionMock(
  doctor: Doctor,
  input: DoctorPrescriptionCreateInput,
  patient: Patient,
): Prescription {
  const rx: Prescription = {
    id: nextId('rx'),
    patientId: patient.id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    doctorId: doctor.id,
    doctorName: doctor.name,
    medicines: input.medicines,
    issuedAt: new Date().toISOString().slice(0, 10),
    status: 'Active',
    appointmentId: input.appointmentId,
  }
  store.prescriptions.unshift(rx)
  return rx
}

export async function savePrescription(input: DoctorPrescriptionCreateInput): Promise<Prescription> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const doctor = await mockDoctor()
    const patient = store.patients.find((p) => p.id === input.patientId)
    if (!patient) throw new Error('Patient not found')
    return savePrescriptionMock(doctor, input, patient)
  }
  return http.post<Prescription>(ENDPOINTS.DOCTOR_PRESCRIPTIONS, input)
}

export async function listMyPrescriptions(): Promise<Prescription[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    const doctor = await mockDoctor()
    return store.prescriptions
      .filter((p) => p.doctorId === doctor.id)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  }
  return http.get<Prescription[]>(ENDPOINTS.DOCTOR_PRESCRIPTIONS)
}
