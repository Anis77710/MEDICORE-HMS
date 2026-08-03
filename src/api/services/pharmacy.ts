// ============================================================
// HealSync HMS — Pharmacy service
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http, USE_MOCK_API } from '../client'
import { mockDelay } from '../mock'
import { store, nextId } from '../store'
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
  if (USE_MOCK_API) {
    await mockDelay()
    let list = [...store.medicines]
    if (q.search) {
      const s = q.search.toLowerCase()
      list = list.filter(
        (m) => m.name.toLowerCase().includes(s) || m.genericName.toLowerCase().includes(s),
      )
    }
    if (q.category && q.category !== 'All') list = list.filter((m) => m.category === q.category)
    return list
  }
  return http.get<Medicine[]>(ENDPOINTS.MEDICINES, { params: { ...q } })
}

export async function createMedicine(input: MedicineInput): Promise<Medicine> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const med: Medicine = {
      ...input,
      id: nextId('m'),
      status: input.stock === 0 ? 'Out of Stock' : input.stock <= input.reorderLevel ? 'Low Stock' : 'In Stock',
    }
    store.medicines.unshift(med)
    return med
  }
  return http.post<Medicine>(ENDPOINTS.MEDICINE_CREATE, input)
}

export async function updateMedicine(id: string, input: Partial<MedicineInput>): Promise<Medicine> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const idx = store.medicines.findIndex((x) => x.id === id)
    if (idx === -1) throw new Error('Medicine not found')
    store.medicines[idx] = {
      ...store.medicines[idx],
      ...input,
      status:
        (input.stock ?? store.medicines[idx].stock) === 0
          ? 'Out of Stock'
          : (input.stock ?? store.medicines[idx].stock) <= (input.reorderLevel ?? store.medicines[idx].reorderLevel)
            ? 'Low Stock'
            : 'In Stock',
    }
    return store.medicines[idx]
  }
  return http.put<Medicine>(withParams(ENDPOINTS.MEDICINE_UPDATE, { id }), input)
}

export async function deleteMedicine(id: string): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    store.medicines = store.medicines.filter((x) => x.id !== id)
    return
  }
  await http.delete(withParams(ENDPOINTS.MEDICINE_DELETE, { id }))
}

export async function listPrescriptions(q: { search?: string } = {}): Promise<Prescription[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    let list = [...store.prescriptions]
    if (q.search) {
      const s = q.search.toLowerCase()
      list = list.filter(
        (p) => p.patientName.toLowerCase().includes(s) || p.doctorName.toLowerCase().includes(s),
      )
    }
    return list.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  }
  return http.get<Prescription[]>(ENDPOINTS.PRESCRIPTIONS, { params: { ...q } })
}

export async function createPrescription(
  input: Omit<Prescription, 'id' | 'issuedAt' | 'status'>,
): Promise<Prescription> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const rx: Prescription = {
      ...input,
      id: nextId('rx'),
      issuedAt: new Date().toISOString().slice(0, 10),
      status: 'Active',
    }
    store.prescriptions.unshift(rx)
    return rx
  }
  return http.post<Prescription>(ENDPOINTS.PRESCRIPTION_CREATE, input)
}
