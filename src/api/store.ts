// ============================================================
// Medicore HMS — In-memory mock store
// Mutations (create/update/delete) apply here while the mock
// API is active, so the whole frontend is fully usable before
// the backend joins.
// ============================================================

import type {
  Appointment,
  Department,
  Doctor,
  Invoice,
  Medicine,
  Patient,
  Prescription,
  StaffMember,
} from '../types'
import {
  mockAppointments,
  mockDepartments,
  mockDoctors,
  mockInvoices,
  mockMedicines,
  mockPatients,
  mockPrescriptions,
  mockStaff,
} from './mock'

export const store = {
  patients: [...mockPatients] as Patient[],
  doctors: [...mockDoctors] as Doctor[],
  appointments: [...mockAppointments] as Appointment[],
  departments: [...mockDepartments] as Department[],
  medicines: [...mockMedicines] as Medicine[],
  prescriptions: [...mockPrescriptions] as Prescription[],
  invoices: [...mockInvoices] as Invoice[],
  staff: [...mockStaff] as StaffMember[],
}

export function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}`
}
