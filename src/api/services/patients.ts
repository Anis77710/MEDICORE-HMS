// ============================================================
// HealSync HMS — Patients service
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http, USE_MOCK_API } from '../client'
import { mockDelay } from '../mock'
import { store, nextId } from '../store'
import type { Patient, PatientCreateInput } from '../../types'

export interface PatientQuery {
  search?: string
  status?: string
  department?: string
  page?: number
  limit?: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

function filterPatients(q: PatientQuery = {}): Patient[] {
  let list = [...store.patients]
  if (q.search) {
    const s = q.search.toLowerCase()
    list = list.filter(
      (p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(s) ||
        p.patientId.toLowerCase().includes(s) ||
        p.email.toLowerCase().includes(s),
    )
  }
  if (q.status && q.status !== 'All') list = list.filter((p) => p.status === q.status)
  if (q.department && q.department !== 'All') list = list.filter((p) => p.department === q.department)
  return list
}

export async function listPatients(q: PatientQuery = {}): Promise<Paginated<Patient>> {
  if (USE_MOCK_API) {
    await mockDelay()
    const filtered = filterPatients(q)
    const limit = q.limit ?? 10
    const page = q.page ?? 1
    return {
      items: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      limit,
    }
  }
  return http.get<Paginated<Patient>>(ENDPOINTS.PATIENTS, { params: { ...q } })
}

export async function getPatient(id: string): Promise<Patient> {
  if (USE_MOCK_API) {
    await mockDelay(300)
    const p = store.patients.find((x) => x.id === id)
    if (!p) throw new Error('Patient not found')
    return p
  }
  return http.get<Patient>(withParams(ENDPOINTS.PATIENT_DETAIL, { id }))
}

export async function createPatient(input: PatientCreateInput): Promise<Patient> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const patient: Patient = {
      id: nextId('p'),
      patientId: `P-${10000 + store.patients.length + 1}`,
      ...input,
      status: 'Pending',
      lastVisit: new Date().toISOString().slice(0, 10),
    }
    store.patients.unshift(patient)
    return patient
  }
  return http.post<Patient>(ENDPOINTS.PATIENT_CREATE, input)
}

export async function updatePatient(id: string, input: Partial<PatientCreateInput>): Promise<Patient> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const idx = store.patients.findIndex((x) => x.id === id)
    if (idx === -1) throw new Error('Patient not found')
    store.patients[idx] = { ...store.patients[idx], ...input }
    return store.patients[idx]
  }
  return http.put<Patient>(withParams(ENDPOINTS.PATIENT_UPDATE, { id }), input)
}

export async function deletePatient(id: string): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    store.patients = store.patients.filter((x) => x.id !== id)
    return
  }
  await http.delete(withParams(ENDPOINTS.PATIENT_DELETE, { id }))
}

export interface MedicalRecord {
  id: string
  date: string
  type: string
  diagnosis: string
  doctor: string
  notes: string
  status: string
}

export interface PatientDocument {
  id: string
  name: string
  type: string
  size: string
  date: string
  uploadedBy: string
}

import { mockMedicalRecords, mockDocuments } from '../mock'

export async function getMedicalRecords(patientId: string): Promise<MedicalRecord[]> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    return mockMedicalRecords[patientId as keyof typeof mockMedicalRecords] ?? []
  }
  return http.get<MedicalRecord[]>(withParams(ENDPOINTS.PATIENT_MEDICAL_RECORDS, { id: patientId }))
}

export async function getPatientDocuments(patientId: string): Promise<PatientDocument[]> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    return mockDocuments[patientId as keyof typeof mockDocuments] ?? []
  }
  return http.get<PatientDocument[]>(withParams(ENDPOINTS.PATIENT_DOCUMENTS, { id: patientId }))
}
