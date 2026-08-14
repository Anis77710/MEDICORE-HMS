// ============================================================
// HealSync HMS — Doctors service
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http } from '../client'
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

export async function listDoctors(q: { search?: string; department?: string } = {}): Promise<Doctor[]> {
  return http.get<Doctor[]>(ENDPOINTS.DOCTORS, { params: { ...q } })
}

export async function getDoctor(id: string): Promise<Doctor> {
  return http.get<Doctor>(withParams(ENDPOINTS.DOCTOR_DETAIL, { id }))
}

export async function createDoctor(
  input: DoctorInput,
): Promise<Doctor & { credentials?: { username: string; password: string } | null }> {
  return http.post<Doctor & { credentials?: { username: string; password: string } | null }>(
    ENDPOINTS.DOCTOR_CREATE,
    input,
  )
}

export async function updateDoctor(id: string, input: Partial<DoctorInput>): Promise<Doctor> {
  return http.put<Doctor>(withParams(ENDPOINTS.DOCTOR_UPDATE, { id }), input)
}

export async function deleteDoctor(id: string): Promise<void> {
  await http.delete(withParams(ENDPOINTS.DOCTOR_DELETE, { id }))
}

// ---------- Live workload metrics (admin) ----------
export async function getDoctorMetrics(): Promise<Record<string, DoctorMetrics>> {
  return http.get<Record<string, DoctorMetrics>>(ENDPOINTS.DOCTOR_METRICS)
}

export async function getDoctorStats(id: string): Promise<DoctorStats> {
  return http.get<DoctorStats>(withParams(ENDPOINTS.DOCTOR_STATS, { id }))
}

// ---------- Account governance (admin) ----------
export async function createDoctorAccount(
  id: string,
  input: { email: string; password: string },
): Promise<DoctorAccount> {
  return http.post<DoctorAccount>(withParams(ENDPOINTS.DOCTOR_ACCOUNT_CREATE, { id }), input)
}

export async function resetDoctorPassword(
  id: string,
  password?: string,
): Promise<ResetPasswordResult> {
  return http.post<ResetPasswordResult>(withParams(ENDPOINTS.DOCTOR_RESET_PASSWORD, { id }), { password })
}

export async function disableDoctorLogin(id: string): Promise<DoctorAccount> {
  return http.post<DoctorAccount>(withParams(ENDPOINTS.DOCTOR_DISABLE_LOGIN, { id }))
}

export async function enableDoctorLogin(id: string): Promise<DoctorAccount> {
  return http.post<DoctorAccount>(withParams(ENDPOINTS.DOCTOR_ENABLE_LOGIN, { id }))
}

// ---------- Dependencies & reassignment (admin) ----------
export async function getDoctorDependencies(id: string): Promise<DoctorDependencies> {
  return http.get<DoctorDependencies>(withParams(ENDPOINTS.DOCTOR_DEPENDENCIES, { id }))
}

export async function reassignDoctor(id: string, input: ReassignInput): Promise<ReassignResult> {
  return http.post<ReassignResult>(withParams(ENDPOINTS.DOCTOR_REASSIGN, { id }), input)
}

// ---------- Calendar (admin) ----------
export async function getDoctorCalendar(
  id: string,
  range: { start: string; end: string },
): Promise<DoctorCalendar> {
  return http.get<DoctorCalendar>(withParams(ENDPOINTS.DOCTOR_CALENDAR, { id }), {
    params: { ...range },
  })
}