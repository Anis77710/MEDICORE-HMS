// ============================================================
// Medicore HMS - Pharmacy service
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http } from '../client'
import type { Medicine, Prescription } from '../../types'

export interface MedicineInput {
  name: string
  genericName: string
  category: string
  manufacturer: string
  price: number
  stock: number
  reorderLevel: number
  expiryDate: string
  batch: string
}

export async function listMedicines(q: { search?: string; category?: string } = {}): Promise<Medicine[]> {
  return http.get<Medicine[]>(ENDPOINTS.MEDICINES, { params: { ...q } })
}

export async function createMedicine(input: MedicineInput): Promise<Medicine> {
  return http.post<Medicine>(ENDPOINTS.MEDICINE_CREATE, input)
}

export async function updateMedicine(id: string, input: Partial<MedicineInput>): Promise<Medicine> {
  return http.put<Medicine>(withParams(ENDPOINTS.MEDICINE_UPDATE, { id }), input)
}

export async function deleteMedicine(id: string): Promise<void> {
  await http.delete(withParams(ENDPOINTS.MEDICINE_DELETE, { id }))
}

export async function listPrescriptions(q: { search?: string } = {}): Promise<Prescription[]> {
  return http.get<Prescription[]>(ENDPOINTS.PRESCRIPTIONS, { params: { ...q } })
}

export async function createPrescription(
  input: Omit<Prescription, 'id' | 'issuedAt' | 'status'>,
): Promise<Prescription> {
  return http.post<Prescription>(ENDPOINTS.PRESCRIPTION_CREATE, input)
}
