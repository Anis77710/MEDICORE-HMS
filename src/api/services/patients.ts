// ============================================================
// HealSync HMS — Patients service
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http } from '../client'
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

export async function listPatients(q: PatientQuery = {}): Promise<Paginated<Patient>> {
  return http.get<Paginated<Patient>>(ENDPOINTS.PATIENTS, { params: { ...q } })
}

export async function getPatient(id: string): Promise<Patient> {
  return http.get<Patient>(withParams(ENDPOINTS.PATIENT_DETAIL, { id }))
}

export async function createPatient(input: PatientCreateInput): Promise<Patient> {
  return http.post<Patient>(ENDPOINTS.PATIENT_CREATE, input)
}

export async function updatePatient(id: string, input: Partial<PatientCreateInput>): Promise<Patient> {
  return http.put<Patient>(withParams(ENDPOINTS.PATIENT_UPDATE, { id }), input)
}

export async function deletePatient(id: string): Promise<void> {
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

export async function getMedicalRecords(patientId: string): Promise<MedicalRecord[]> {
  return http.get<MedicalRecord[]>(withParams(ENDPOINTS.PATIENT_MEDICAL_RECORDS, { id: patientId }))
}

export async function getPatientDocuments(patientId: string): Promise<PatientDocument[]> {
  return http.get<PatientDocument[]>(withParams(ENDPOINTS.PATIENT_DOCUMENTS, { id: patientId }))
}
