// ============================================================
// HealSync HMS — Doctors service
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http, USE_MOCK_API } from '../client'
import { mockDelay } from '../mock'
import { store, nextId } from '../store'
import type { Doctor } from '../../types'

export interface DoctorInput {
  name: string
  email: string
  phone: string
  department: string
  specialty: string
  qualification: string
  experienceYears: number
  consultationFee: number
  schedule: string[]
  status: Doctor['status']
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
    return list
  }
  return http.get<Doctor[]>(ENDPOINTS.DOCTORS, { params: { ...q } })
}

export async function getDoctor(id: string): Promise<Doctor> {
  if (USE_MOCK_API) {
    await mockDelay(300)
    const d = store.doctors.find((x) => x.id === id)
    if (!d) throw new Error('Doctor not found')
    return d
  }
  return http.get<Doctor>(withParams(ENDPOINTS.DOCTOR_DETAIL, { id }))
}

export async function createDoctor(input: DoctorInput): Promise<Doctor> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const doctor: Doctor = {
      id: nextId('d'),
      ...input,
      patientsCount: 0,
      rating: 4.5,
    }
    store.doctors.push(doctor)
    return doctor
  }
  return http.post<Doctor>(ENDPOINTS.DOCTOR_CREATE, input)
}

export async function updateDoctor(id: string, input: Partial<DoctorInput>): Promise<Doctor> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const idx = store.doctors.findIndex((x) => x.id === id)
    if (idx === -1) throw new Error('Doctor not found')
    store.doctors[idx] = { ...store.doctors[idx], ...input }
    return store.doctors[idx]
  }
  return http.put<Doctor>(withParams(ENDPOINTS.DOCTOR_UPDATE, { id }), input)
}

export async function deleteDoctor(id: string): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    store.doctors = store.doctors.filter((x) => x.id !== id)
    return
  }
  await http.delete(withParams(ENDPOINTS.DOCTOR_DELETE, { id }))
}
