// ============================================================
// Medicore HMS — Departments service
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http, USE_MOCK_API } from '../client'
import { mockDelay } from '../mock'
import { store, nextId } from '../store'
import type { Department } from '../../types'

export async function listDepartments(): Promise<Department[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    return [...store.departments]
  }
  return http.get<Department[]>(ENDPOINTS.DEPARTMENTS)
}

export async function getDepartment(id: string): Promise<Department> {
  if (USE_MOCK_API) {
    await mockDelay(300)
    const d = store.departments.find((x) => x.id === id)
    if (!d) throw new Error('Department not found')
    return d
  }
  return http.get<Department>(withParams(ENDPOINTS.DEPARTMENT_DETAIL, { id }))
}

export async function createDepartment(
  input: Omit<Department, 'id' | 'headDoctorName' | 'doctorsCount' | 'patientsCount'>,
): Promise<Department> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const dept: Department = {
      ...input,
      id: nextId('dep'),
      headDoctorName: store.doctors.find((d) => d.id === input.headDoctorId)?.name ?? 'Unassigned',
      doctorsCount: 0,
      patientsCount: 0,
    }
    store.departments.push(dept)
    return dept
  }
  return http.post<Department>(ENDPOINTS.DEPARTMENT_CREATE, input)
}

export async function updateDepartment(
  id: string,
  input: Partial<Omit<Department, 'id'>>,
): Promise<Department> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const idx = store.departments.findIndex((x) => x.id === id)
    if (idx === -1) throw new Error('Department not found')
    store.departments[idx] = { ...store.departments[idx], ...input }
    return store.departments[idx]
  }
  return http.put<Department>(withParams(ENDPOINTS.DEPARTMENT_UPDATE, { id }), input)
}
