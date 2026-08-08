// ============================================================
// Medicore HMS — In-memory mock store
// Mutations (create/update/delete) apply here while the mock
// API is active, so the whole frontend is fully usable before
// the backend joins.
// ============================================================

import type {
  Appointment,
  AuditLogEntry,
  Consultation,
  Department,
  Doctor,
  Invoice,
  Medicine,
  Patient,
  Prescription,
  StaffMember,
} from '../types'
import {
  mockAccounts,
  mockAppointments,
  mockAuditLog,
  mockConsultations,
  mockDepartments,
  mockDoctorAppointments,
  mockDoctors,
  mockInvoices,
  mockMedicines,
  mockPatients,
  mockPrescriptions,
  mockStaff,
  type MockAccount,
} from './mock'

export const store = {
  patients: [...mockPatients] as Patient[],
  doctors: [...mockDoctors] as Doctor[],
  appointments: [...mockAppointments, ...mockDoctorAppointments] as Appointment[],
  departments: [...mockDepartments] as Department[],
  medicines: [...mockMedicines] as Medicine[],
  prescriptions: [...mockPrescriptions] as Prescription[],
  consultations: [...mockConsultations] as Consultation[],
  invoices: [...mockInvoices] as Invoice[],
  staff: [...mockStaff] as StaffMember[],
  accounts: [...mockAccounts] as MockAccount[],
  auditLog: [...mockAuditLog] as AuditLogEntry[],
}

export function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}`
}
