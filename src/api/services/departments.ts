// ============================================================
// Medicore HMS — Departments service
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http } from '../client'
import type { Department } from '../../types'

export async function listDepartments(): Promise<Department[]> {
  return http.get<Department[]>(ENDPOINTS.DEPARTMENTS)
}

export async function getDepartment(id: string): Promise<Department> {
  return http.get<Department>(withParams(ENDPOINTS.DEPARTMENT_DETAIL, { id }))
}

export async function createDepartment(
  input: Omit<Department, 'id' | 'headDoctorName' | 'doctorsCount' | 'patientsCount'>,
): Promise<Department> {
  return http.post<Department>(ENDPOINTS.DEPARTMENT_CREATE, input)
}

export async function updateDepartment(
  id: string,
  input: Partial<Omit<Department, 'id'>>,
): Promise<Department> {
  return http.put<Department>(withParams(ENDPOINTS.DEPARTMENT_UPDATE, { id }), input)
}
