// ============================================================
// Medicore HMS — Mock data layer
// Used while VITE_USE_MOCK_API=true (default) so the frontend is
// fully functional before the backend is built. Shapes mirror the
// types in `src/types` — the backend must return the same JSON.
// ============================================================

import type {
  Appointment,
  AppointmentCreateInput,
  Consultation,
  DashboardStats,
  Department,
  Doctor,
  Invoice,
  Medicine,
  Patient,
  PatientCreateInput,
  Prescription,
  ReportSummary,
  StaffMember,
  User,
} from '../types'

export const mockDelay = (ms = 450) => new Promise((res) => setTimeout(res, ms))

// Local YYYY-MM-DD for a date offset in days from today (mock clinical data stays "current").
export function mockDateOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const MOCK_USER: User = {
  id: 'u-1',
  name: 'Dr. Sarah Chen',
  email: 'admin@medicore.health',
  username: 'sarah@medicore.hms',
  role: 'ADMIN',
  phone: '+1 (555) 010-2244',
}

// Mock login accounts. Doctors map to their Doctor profile by email —
// same rule the real backend uses when the admin creates an account.
// `username` follows the firstname@medicore.hms convention.
export interface MockAccount {
  id: string
  name: string
  email: string
  username: string
  role: User['role']
  status: 'Active' | 'Disabled'
  lastLoginAt?: string
  createdAt: string
  department?: string
  phone?: string
}

export const mockAccounts: MockAccount[] = [
  { id: 'u-1', name: 'Dr. Sarah Chen', email: 'admin@medicore.health', username: 'sarah@medicore.hms', role: 'ADMIN', status: 'Active', lastLoginAt: '2026-08-07T08:12:00Z', createdAt: '2025-01-15T09:00:00Z' },
  { id: 'u-2', name: 'Dr. Michael Roberts', email: 'm.roberts@medicore.health', username: 'michael@medicore.hms', role: 'DOCTOR', status: 'Active', lastLoginAt: '2026-08-07T07:55:00Z', createdAt: '2025-02-01T09:00:00Z' },
  { id: 'u-3', name: 'Dr. Priya Sharma', email: 'p.sharma@medicore.health', username: 'priya@medicore.hms', role: 'DOCTOR', status: 'Active', lastLoginAt: '2026-08-06T13:40:00Z', createdAt: '2025-03-10T09:00:00Z' },
  { id: 'u-4', name: 'Dr. James Osei', email: 'j.osei@medicore.health', username: 'james@medicore.hms', role: 'DOCTOR', status: 'Active', lastLoginAt: '2026-08-07T07:10:00Z', createdAt: '2025-04-05T09:00:00Z' },
  { id: 'u-5', name: 'Dr. Emily Carter', email: 'e.carter@medicore.health', username: 'emily@medicore.hms', role: 'DOCTOR', status: 'Active', lastLoginAt: '2026-07-29T16:20:00Z', createdAt: '2025-02-20T09:00:00Z' },
  { id: 'u-6', name: 'Dr. David Kim', email: 'd.kim@medicore.health', username: 'david@medicore.hms', role: 'DOCTOR', status: 'Active', lastLoginAt: '2026-08-07T08:01:00Z', createdAt: '2025-01-22T09:00:00Z' },
  { id: 'u-7', name: 'Dr. Amara Diallo', email: 'a.diallo@medicore.health', username: 'amara@medicore.hms', role: 'DOCTOR', status: 'Disabled', lastLoginAt: '2026-07-20T10:00:00Z', createdAt: '2025-05-12T09:00:00Z' },
  { id: 'u-8', name: 'Dr. Robert Nguyen', email: 'r.nguyen@medicore.health', username: 'robert@medicore.hms', role: 'DOCTOR', status: 'Active', lastLoginAt: '2026-08-07T07:30:00Z', createdAt: '2025-03-03T09:00:00Z' },
  { id: 'u-9', name: 'Dr. Grace Adeyemi', email: 'g.adeyemi@medicore.health', username: 'grace@medicore.hms', role: 'DOCTOR', status: 'Active', lastLoginAt: '2026-08-06T18:05:00Z', createdAt: '2025-06-01T09:00:00Z' },
  { id: 'u-10', name: 'Dr. Daniel Wright', email: 'd.wright@medicore.health', username: 'daniel@medicore.hms', role: 'DOCTOR', status: 'Active', lastLoginAt: '2026-08-07T07:45:00Z', createdAt: '2025-01-18T09:00:00Z' },
  { id: 'u-11', name: 'Nurse Emma Wilson', email: 'e.wilson@medicore.health', username: 'emma@medicore.hms', role: 'NURSE', status: 'Active', createdAt: '2025-02-14T09:00:00Z' },
  { id: 'u-12', name: 'Olivia Martinez', email: 'o.martinez@medicore.health', username: 'olivia@medicore.hms', role: 'STAFF', status: 'Active', createdAt: '2025-04-22T09:00:00Z' },
]

export const mockAuditLog: AuditLogEntryMock[] = [
  { id: 'al-1', actor: 'Dr. Sarah Chen', actorRole: 'ADMIN', action: 'create', resource: 'doctor', resourceId: 'd-9', details: { name: 'Dr. Daniel Wright' }, createdAt: '2026-08-07T09:12:00.000Z' },
  { id: 'al-2', actor: 'Dr. Daniel Wright', actorRole: 'DOCTOR', action: 'appointment-confirmed', resource: 'appointment', resourceId: 'ad-1', details: { date: mockDateOffset(0), time: '09:00' }, createdAt: '2026-08-07T08:30:00.000Z' },
  { id: 'al-3', actor: 'Dr. Daniel Wright', actorRole: 'DOCTOR', action: 'consultation-create', resource: 'consultation', resourceId: 'c-9', details: { patientId: 'p-1' }, createdAt: '2026-08-06T15:45:00.000Z' },
  { id: 'al-4', actor: 'Dr. Sarah Chen', actorRole: 'ADMIN', action: 'update', resource: 'doctor', resourceId: 'd-4', details: { status: 'On Leave' }, createdAt: '2026-08-06T14:00:00.000Z' },
  { id: 'al-5', actor: 'Dr. Amara Diallo', actorRole: 'DOCTOR', action: 'prescription-create', resource: 'prescription', resourceId: 'rx-7', createdAt: '2026-08-05T11:20:00.000Z' },
  { id: 'al-6', actor: 'Dr. Sarah Chen', actorRole: 'ADMIN', action: 'disable', resource: 'doctor-account', resourceId: 'u-7', details: { doctorName: 'Dr. Amara Diallo' }, createdAt: '2026-08-04T10:00:00.000Z' },
  { id: 'al-7', actor: 'Dr. Sarah Chen', actorRole: 'ADMIN', action: 'appointment-confirmed', resource: 'appointment', resourceId: 'a-1', createdAt: '2026-08-03T09:00:00.000Z' },
]

export interface AuditLogEntryMock {
  id: string
  actor: string
  actorRole?: string
  action: string
  resource: string
  resourceId?: string
  details?: Record<string, unknown>
  createdAt: string
}

export const mockDoctors: Doctor[] = [
  { id: 'd-1', name: 'Dr. Michael Roberts', email: 'm.roberts@medicore.health', phone: '+1 (555) 010-1001', department: 'Cardiology', specialty: 'Interventional Cardiologist', qualification: 'MD, DM (Cardiology)', experienceYears: 15, consultationFee: 120, schedule: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], patientsCount: 342, rating: 4.9, status: 'Active' },
  { id: 'd-2', name: 'Dr. Priya Sharma', email: 'p.sharma@medicore.health', phone: '+1 (555) 010-1002', department: 'Neurology', specialty: 'Neurologist', qualification: 'MD, DM (Neurology)', experienceYears: 11, consultationFee: 110, schedule: ['Mon', 'Wed', 'Fri'], patientsCount: 218, rating: 4.8, status: 'Active' },
  { id: 'd-3', name: 'Dr. James Osei', email: 'j.osei@medicore.health', phone: '+1 (555) 010-1003', department: 'Pediatrics', specialty: 'Pediatrician', qualification: 'MBBS, MD (Pediatrics)', experienceYears: 9, consultationFee: 90, schedule: ['Tue', 'Thu', 'Sat'], patientsCount: 296, rating: 4.7, status: 'Active' },
  { id: 'd-4', name: 'Dr. Emily Carter', email: 'e.carter@medicore.health', phone: '+1 (555) 010-1004', department: 'General Medicine', specialty: 'Internal Medicine', qualification: 'MD (Internal Medicine)', experienceYears: 13, consultationFee: 80, schedule: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], patientsCount: 412, rating: 4.6, status: 'On Leave' },
  { id: 'd-5', name: 'Dr. David Kim', email: 'd.kim@medicore.health', phone: '+1 (555) 010-1005', department: 'Orthopedics', specialty: 'Orthopedic Surgeon', qualification: 'MS (Orthopedics)', experienceYears: 17, consultationFee: 130, schedule: ['Mon', 'Tue', 'Fri'], patientsCount: 187, rating: 4.9, status: 'Active' },
  { id: 'd-6', name: 'Dr. Amara Diallo', email: 'a.diallo@medicore.health', phone: '+1 (555) 010-1006', department: 'Dermatology', specialty: 'Dermatologist', qualification: 'MD (Dermatology)', experienceYears: 8, consultationFee: 85, schedule: ['Wed', 'Thu', 'Fri'], patientsCount: 154, rating: 4.5, status: 'Active' },
  { id: 'd-7', name: 'Dr. Robert Nguyen', email: 'r.nguyen@medicore.health', phone: '+1 (555) 010-1007', department: 'Oncology', specialty: 'Medical Oncologist', qualification: 'MD, DM (Oncology)', experienceYears: 14, consultationFee: 140, schedule: ['Mon', 'Tue', 'Wed', 'Thu'], patientsCount: 129, rating: 4.8, status: 'Active' },
  { id: 'd-8', name: 'Dr. Grace Adeyemi', email: 'g.adeyemi@medicore.health', phone: '+1 (555) 010-1008', department: 'Gynecology', specialty: 'Gynecologist', qualification: 'MS (Obstetrics & Gynecology)', experienceYears: 12, consultationFee: 100, schedule: ['Mon', 'Wed', 'Fri', 'Sat'], patientsCount: 231, rating: 4.7, status: 'Active' },
  { id: 'd-9', name: 'Dr. Daniel Wright', email: 'd.wright@medicore.health', phone: '+1 (555) 010-2248', department: 'Cardiology', specialty: 'Interventional Cardiologist', qualification: 'MD, DM (Cardiology)', experienceYears: 13, consultationFee: 120, schedule: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], patientsCount: 186, rating: 4.8, status: 'Active' },
]

export const mockPatients: Patient[] = [
  { id: 'p-1', patientId: 'P-10432', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@email.com', phone: '+1 (555) 020-2101', dob: '1992-04-18', gender: 'Female', bloodGroup: 'A+', address: '241 Maple Ave, Springfield', emergencyContact: '+1 (555) 020-2199', status: 'Admitted', department: 'Cardiology', assignedDoctorId: 'd-1', admittedAt: '2026-07-28', lastVisit: '2026-07-28', allergies: ['Penicillin'], insurance: 'BlueCross HMO', notes: 'Post-surgery monitoring' },
  { id: 'p-2', patientId: 'P-10431', firstName: 'John', lastName: 'Miller', email: 'john.miller@email.com', phone: '+1 (555) 020-2102', dob: '1965-11-02', gender: 'Male', bloodGroup: 'O-', address: '88 Cedar Road, Riverton', emergencyContact: '+1 (555) 020-2198', status: 'Critical', department: 'Oncology', assignedDoctorId: 'd-7', admittedAt: '2026-07-26', lastVisit: '2026-07-30', allergies: ['Sulfa drugs'], insurance: 'Medicare' },
  { id: 'p-3', patientId: 'P-10430', firstName: 'Aisha', lastName: 'Khan', email: 'aisha.khan@email.com', phone: '+1 (555) 020-2103', dob: '1988-02-25', gender: 'Female', bloodGroup: 'B+', address: '12 Oak Street, Westlake', emergencyContact: '+1 (555) 020-2197', status: 'Outpatient', department: 'Dermatology', assignedDoctorId: 'd-6', lastVisit: '2026-07-29', allergies: [], insurance: 'Aetna PPO' },
  { id: 'p-4', patientId: 'P-10429', firstName: 'Tom', lastName: 'Brennan', email: 'tom.brennan@email.com', phone: '+1 (555) 020-2104', dob: '1978-09-14', gender: 'Male', bloodGroup: 'AB+', address: '5 Pine Court, Northfield', emergencyContact: '+1 (555) 020-2196', status: 'Recovered', department: 'Orthopedics', assignedDoctorId: 'd-5', lastVisit: '2026-07-25', allergies: ['Latex'], insurance: 'United Health' },
  { id: 'p-5', patientId: 'P-10428', firstName: 'Maria', lastName: 'Gonzalez', email: 'maria.gonzalez@email.com', phone: '+1 (555) 020-2105', dob: '2001-07-08', gender: 'Female', bloodGroup: 'O+', address: '77 Willow Lane, Eastbrook', emergencyContact: '+1 (555) 020-2195', status: 'Outpatient', department: 'Pediatrics', assignedDoctorId: 'd-3', lastVisit: '2026-07-30', allergies: [], insurance: 'CHIP' },
  { id: 'p-6', patientId: 'P-10427', firstName: 'Henry', lastName: 'Okafor', email: 'henry.okafor@email.com', phone: '+1 (555) 020-2106', dob: '1959-01-30', gender: 'Male', bloodGroup: 'A-', address: '33 Birch Drive, Sunnydale', emergencyContact: '+1 (555) 020-2194', status: 'Admitted', department: 'General Medicine', assignedDoctorId: 'd-4', admittedAt: '2026-07-31', lastVisit: '2026-07-31', allergies: ['Aspirin'], insurance: 'Medicaid' },
  { id: 'p-7', patientId: 'P-10426', firstName: 'Lily', lastName: 'Anderson', email: 'lily.anderson@email.com', phone: '+1 (555) 020-2107', dob: '2019-12-11', gender: 'Female', bloodGroup: 'B-', address: '120 Elm Street, Fairview', emergencyContact: '+1 (555) 020-2193', status: 'Recovered', department: 'Pediatrics', assignedDoctorId: 'd-3', lastVisit: '2026-07-22', allergies: ['Peanuts'], insurance: 'CHIP' },
  { id: 'p-8', patientId: 'P-10425', firstName: 'George', lastName: 'Patel', email: 'george.patel@email.com', phone: '+1 (555) 020-2108', dob: '1985-06-19', gender: 'Male', bloodGroup: 'O+', address: '9 Cypress Way, Lakeside', emergencyContact: '+1 (555) 020-2192', status: 'Pending', department: 'Neurology', assignedDoctorId: 'd-2', lastVisit: '2026-07-30', allergies: [], insurance: 'Cigna' },
  { id: 'p-9', patientId: 'P-10424', firstName: 'Nina', lastName: 'Volkov', email: 'nina.volkov@email.com', phone: '+1 (555) 020-2109', dob: '1995-03-27', gender: 'Female', bloodGroup: 'A-', address: '214 Aspen Ave, Crestview', emergencyContact: '+1 (555) 020-2191', status: 'Outpatient', department: 'Gynecology', assignedDoctorId: 'd-8', lastVisit: '2026-07-28', allergies: ['Dust mites'], insurance: 'BlueCross HMO' },
  { id: 'p-10', patientId: 'P-10423', firstName: 'Samuel', lastName: 'Wright', email: 'samuel.wright@email.com', phone: '+1 (555) 020-2110', dob: '1972-10-05', gender: 'Male', bloodGroup: 'B+', address: '56 Harbor Blvd, Bayport', emergencyContact: '+1 (555) 020-2190', status: 'Admitted', department: 'Cardiology', assignedDoctorId: 'd-1', admittedAt: '2026-07-29', lastVisit: '2026-07-29', allergies: ['Iodine'], insurance: 'United Health' },
]

export const mockAppointments: Appointment[] = [
  { id: 'a-1', patientId: 'p-3', patientName: 'Aisha Khan', doctorId: 'd-6', doctorName: 'Dr. Amara Diallo', department: 'Dermatology', type: 'Follow-up', date: '2026-08-02', time: '08:30', durationMin: 30, status: 'Confirmed', reason: 'Eczema review', createdAt: '2026-07-28T10:00:00Z' },
  { id: 'a-2', patientId: 'p-1', patientName: 'Sarah Johnson', doctorId: 'd-1', doctorName: 'Dr. Michael Roberts', department: 'Cardiology', type: 'Consultation', date: '2026-08-02', time: '09:00', durationMin: 45, status: 'Confirmed', reason: 'Chest pain follow-up', createdAt: '2026-07-27T14:30:00Z' },
  { id: 'a-3', patientId: 'p-5', patientName: 'Maria Gonzalez', doctorId: 'd-3', doctorName: 'Dr. James Osei', department: 'Pediatrics', type: 'Checkup', date: '2026-08-02', time: '09:30', durationMin: 30, status: 'Pending', reason: 'Annual wellness check', createdAt: '2026-07-31T09:15:00Z' },
  { id: 'a-4', patientId: 'p-8', patientName: 'George Patel', doctorId: 'd-2', doctorName: 'Dr. Priya Sharma', department: 'Neurology', type: 'Consultation', date: '2026-08-02', time: '10:00', durationMin: 60, status: 'Confirmed', reason: 'Migraine assessment', createdAt: '2026-07-29T11:45:00Z' },
  { id: 'a-5', patientId: 'p-9', patientName: 'Nina Volkov', doctorId: 'd-8', doctorName: 'Dr. Grace Adeyemi', department: 'Gynecology', type: 'Follow-up', date: '2026-08-02', time: '11:00', durationMin: 30, status: 'Pending', reason: 'Prenatal check', createdAt: '2026-07-30T16:20:00Z' },
  { id: 'a-6', patientId: 'p-4', patientName: 'Tom Brennan', doctorId: 'd-5', doctorName: 'Dr. David Kim', department: 'Orthopedics', type: 'Procedure', date: '2026-08-02', time: '13:00', durationMin: 90, status: 'Confirmed', reason: 'Knee arthroscopy', createdAt: '2026-07-26T08:00:00Z' },
  { id: 'a-7', patientId: 'p-2', patientName: 'John Miller', doctorId: 'd-7', doctorName: 'Dr. Robert Nguyen', department: 'Oncology', type: 'Consultation', date: '2026-08-02', time: '14:00', durationMin: 60, status: 'Confirmed', reason: 'Chemo plan review', createdAt: '2026-07-29T13:10:00Z' },
  { id: 'a-8', patientId: 'p-6', patientName: 'Henry Okafor', doctorId: 'd-4', doctorName: 'Dr. Emily Carter', department: 'General Medicine', type: 'Emergency', date: '2026-08-02', time: '15:30', durationMin: 45, status: 'Completed', reason: 'Hypertension crisis', createdAt: '2026-07-31T19:00:00Z' },
  { id: 'a-9', patientId: 'p-7', patientName: 'Lily Anderson', doctorId: 'd-3', doctorName: 'Dr. James Osei', department: 'Pediatrics', type: 'Follow-up', date: '2026-08-03', time: '09:00', durationMin: 30, status: 'Confirmed', reason: 'Vaccination booster', createdAt: '2026-07-28T15:40:00Z' },
  { id: 'a-10', patientId: 'p-10', patientName: 'Samuel Wright', doctorId: 'd-1', doctorName: 'Dr. Michael Roberts', department: 'Cardiology', type: 'Follow-up', date: '2026-08-03', time: '10:30', durationMin: 30, status: 'Pending', reason: 'Stent recovery check', createdAt: '2026-07-30T10:25:00Z' },
  { id: 'a-11', patientId: 'p-3', patientName: 'Aisha Khan', doctorId: 'd-6', doctorName: 'Dr. Amara Diallo', department: 'Dermatology', type: 'Checkup', date: '2026-08-04', time: '08:30', durationMin: 30, status: 'Confirmed', reason: 'Skin screening', createdAt: '2026-07-31T12:00:00Z' },
  { id: 'a-12', patientId: 'p-5', patientName: 'Maria Gonzalez', doctorId: 'd-3', doctorName: 'Dr. James Osei', department: 'Pediatrics', type: 'Consultation', date: '2026-08-05', time: '11:30', durationMin: 30, status: 'Pending', reason: 'Fever consultation', createdAt: '2026-08-01T09:05:00Z' },
  { id: 'a-13', patientId: 'p-2', patientName: 'John Miller', doctorId: 'd-7', doctorName: 'Dr. Robert Nguyen', department: 'Oncology', type: 'Follow-up', date: '2026-08-05', time: '14:30', durationMin: 45, status: 'Cancelled', reason: 'Biopsy results', createdAt: '2026-07-29T17:00:00Z' },
  { id: 'a-14', patientId: 'p-1', patientName: 'Sarah Johnson', doctorId: 'd-1', doctorName: 'Dr. Michael Roberts', department: 'Cardiology', type: 'Checkup', date: '2026-08-06', time: '09:30', durationMin: 30, status: 'Confirmed', reason: 'Post-op check', createdAt: '2026-07-30T14:00:00Z' },
]

// Appointments for the mock doctor user (Dr. Daniel Wright, d-9). Dates are
// generated relative to "today" so the Doctor Portal demo always has data.
export const mockDoctorAppointments: Appointment[] = [
  { id: 'ad-1', patientId: 'p-1', patientName: 'Sarah Johnson', doctorId: 'd-9', doctorName: 'Dr. Daniel Wright', department: 'Cardiology', type: 'Consultation', date: mockDateOffset(0), time: '09:00', durationMin: 45, status: 'Confirmed', reason: 'Chest pain follow-up', createdAt: '2026-07-27T10:00:00Z' },
  { id: 'ad-2', patientId: 'p-10', patientName: 'Samuel Wright', doctorId: 'd-9', doctorName: 'Dr. Daniel Wright', department: 'Cardiology', type: 'Consultation', date: mockDateOffset(0), time: '10:30', durationMin: 30, status: 'Pending', reason: 'Stent recovery check', createdAt: '2026-07-30T10:25:00Z' },
  { id: 'ad-3', patientId: 'p-4', patientName: 'Tom Brennan', doctorId: 'd-9', doctorName: 'Dr. Daniel Wright', department: 'Cardiology', type: 'Checkup', date: mockDateOffset(0), time: '11:30', durationMin: 30, status: 'Confirmed', reason: 'Pre-surgery cardiac clearance', createdAt: '2026-07-29T08:15:00Z' },
  { id: 'ad-4', patientId: 'p-6', patientName: 'Henry Okafor', doctorId: 'd-9', doctorName: 'Dr. Daniel Wright', department: 'Cardiology', type: 'Emergency', date: mockDateOffset(0), time: '15:00', durationMin: 45, status: 'Completed', reason: 'Hypertension crisis', createdAt: '2026-07-31T19:00:00Z' },
  { id: 'ad-5', patientId: 'p-3', patientName: 'Aisha Khan', doctorId: 'd-9', doctorName: 'Dr. Daniel Wright', department: 'Cardiology', type: 'Consultation', date: mockDateOffset(1), time: '09:30', durationMin: 30, status: 'Pending', reason: 'Palpitations review', createdAt: '2026-07-31T12:00:00Z' },
  { id: 'ad-6', patientId: 'p-5', patientName: 'Maria Gonzalez', doctorId: 'd-9', doctorName: 'Dr. Daniel Wright', department: 'Cardiology', type: 'Checkup', date: mockDateOffset(2), time: '14:00', durationMin: 30, status: 'Confirmed', reason: 'Heart murmur screening', createdAt: '2026-08-01T09:05:00Z' },
  { id: 'ad-7', patientId: 'p-1', patientName: 'Sarah Johnson', doctorId: 'd-9', doctorName: 'Dr. Daniel Wright', department: 'Cardiology', type: 'Consultation', date: mockDateOffset(-2), time: '09:00', durationMin: 45, status: 'Completed', reason: 'Post-angioplasty review', createdAt: '2026-07-25T11:00:00Z' },
  { id: 'ad-8', patientId: 'p-10', patientName: 'Samuel Wright', doctorId: 'd-9', doctorName: 'Dr. Daniel Wright', department: 'Cardiology', type: 'Follow-up', date: mockDateOffset(-5), time: '11:00', durationMin: 30, status: 'Completed', reason: 'Stent recovery check', createdAt: '2026-07-22T09:30:00Z' },
  { id: 'ad-9', patientId: 'p-4', patientName: 'Tom Brennan', doctorId: 'd-9', doctorName: 'Dr. Daniel Wright', department: 'Cardiology', type: 'Consultation', date: mockDateOffset(-9), time: '10:00', durationMin: 30, status: 'Cancelled', reason: 'Knee surgery cardiac clearance', createdAt: '2026-07-20T14:00:00Z' },
]

export const mockDepartments: Department[] = [
  { id: 'dep-1', name: 'Cardiology', headDoctorId: 'd-1', headDoctorName: 'Dr. Michael Roberts', bedCount: 60, occupiedBeds: 47, doctorsCount: 12, patientsCount: 342, color: '#2563eb', icon: 'heart-pulse', description: 'Heart and cardiovascular care' },
  { id: 'dep-2', name: 'Neurology', headDoctorId: 'd-2', headDoctorName: 'Dr. Priya Sharma', bedCount: 40, occupiedBeds: 31, doctorsCount: 8, patientsCount: 218, color: '#7c3aed', icon: 'brain', description: 'Brain, spine and nervous system' },
  { id: 'dep-3', name: 'Pediatrics', headDoctorId: 'd-3', headDoctorName: 'Dr. James Osei', bedCount: 45, occupiedBeds: 28, doctorsCount: 10, patientsCount: 296, color: '#ea580c', icon: 'baby', description: 'Infant, child and adolescent care' },
  { id: 'dep-4', name: 'General Medicine', headDoctorId: 'd-4', headDoctorName: 'Dr. Emily Carter', bedCount: 80, occupiedBeds: 63, doctorsCount: 15, patientsCount: 412, color: '#0e7490', icon: 'stethoscope', description: 'Primary and internal medicine' },
  { id: 'dep-5', name: 'Orthopedics', headDoctorId: 'd-5', headDoctorName: 'Dr. David Kim', bedCount: 35, occupiedBeds: 22, doctorsCount: 7, patientsCount: 187, color: '#059669', icon: 'bone', description: 'Bones, joints and muscles' },
  { id: 'dep-6', name: 'Dermatology', headDoctorId: 'd-6', headDoctorName: 'Dr. Amara Diallo', bedCount: 15, occupiedBeds: 6, doctorsCount: 5, patientsCount: 154, color: '#d97706', icon: 'sparkles', description: 'Skin, hair and nails' },
  { id: 'dep-7', name: 'Oncology', headDoctorId: 'd-7', headDoctorName: 'Dr. Robert Nguyen', bedCount: 50, occupiedBeds: 42, doctorsCount: 9, patientsCount: 129, color: '#dc2626', icon: 'ribbon', description: 'Cancer diagnosis and treatment' },
  { id: 'dep-8', name: 'Gynecology', headDoctorId: 'd-8', headDoctorName: 'Dr. Grace Adeyemi', bedCount: 30, occupiedBeds: 18, doctorsCount: 6, patientsCount: 231, color: '#db2777', icon: 'flower', description: 'Women health and maternity' },
]

export const mockMedicines: Medicine[] = [
  { id: 'm-1', name: 'Amoxicillin 500mg', genericName: 'Amoxicillin', category: 'Antibiotics', manufacturer: 'Pfizer', price: 12.5, stock: 320, reorderLevel: 80, expiryDate: '2027-05-01', status: 'In Stock', batch: 'AMX-2601' },
  { id: 'm-2', name: 'Paracetamol 500mg', genericName: 'Acetaminophen', category: 'Analgesics', manufacturer: 'GSK', price: 4.2, stock: 15, reorderLevel: 100, expiryDate: '2028-01-15', status: 'Low Stock', batch: 'PCM-2602' },
  { id: 'm-3', name: 'Insulin Glargine 100IU', genericName: 'Insulin glargine', category: 'Endocrine', manufacturer: 'Novo Nordisk', price: 85.0, stock: 240, reorderLevel: 50, expiryDate: '2026-11-20', status: 'In Stock', batch: 'INS-2603' },
  { id: 'm-4', name: 'Aspirin 81mg', genericName: 'Aspirin', category: 'Cardiovascular', manufacturer: 'Bayer', price: 6.8, stock: 0, reorderLevel: 60, expiryDate: '2027-08-10', status: 'Out of Stock', batch: 'ASP-2604' },
  { id: 'm-5', name: 'Metformin 850mg', genericName: 'Metformin', category: 'Endocrine', manufacturer: 'Merck', price: 9.5, stock: 410, reorderLevel: 90, expiryDate: '2027-03-05', status: 'In Stock', batch: 'MET-2605' },
  { id: 'm-6', name: 'Omeprazole 20mg', genericName: 'Omeprazole', category: 'Gastrointestinal', manufacturer: 'AstraZeneca', price: 11.0, stock: 75, reorderLevel: 70, expiryDate: '2026-09-30', status: 'Expiring Soon', batch: 'OME-2606' },
  { id: 'm-7', name: 'Losartan 50mg', genericName: 'Losartan', category: 'Cardiovascular', manufacturer: 'Novartis', price: 14.9, stock: 260, reorderLevel: 80, expiryDate: '2028-02-28', status: 'In Stock', batch: 'LOS-2607' },
  { id: 'm-8', name: 'Ceftriaxone 1g Inj', genericName: 'Ceftriaxone', category: 'Antibiotics', manufacturer: 'Roche', price: 34.0, stock: 120, reorderLevel: 40, expiryDate: '2026-12-15', status: 'In Stock', batch: 'CFX-2608' },
  { id: 'm-9', name: 'Salbutamol Inhaler', genericName: 'Salbutamol', category: 'Respiratory', manufacturer: 'GSK', price: 22.5, stock: 40, reorderLevel: 50, expiryDate: '2027-06-01', status: 'Low Stock', batch: 'SAL-2609' },
  { id: 'm-10', name: 'Vitamin D3 1000IU', genericName: 'Cholecalciferol', category: 'Supplements', manufacturer: 'Nature Made', price: 8.0, stock: 500, reorderLevel: 120, expiryDate: '2029-01-01', status: 'In Stock', batch: 'VIT-2610' },
]

export const mockPrescriptions: Prescription[] = [
  { id: 'rx-1', patientId: 'p-1', patientName: 'Sarah Johnson', doctorId: 'd-1', doctorName: 'Dr. Michael Roberts', medicines: [{ name: 'Metoprolol 50mg', dosage: '1 tablet', frequency: 'Twice daily', durationDays: 30 }, { name: 'Atorvastatin 20mg', dosage: '1 tablet', frequency: 'Once daily (night)', durationDays: 30 }], issuedAt: '2026-07-28', status: 'Active' },
  { id: 'rx-2', patientId: 'p-2', patientName: 'John Miller', doctorId: 'd-7', doctorName: 'Dr. Robert Nguyen', medicines: [{ name: 'Ondansetron 8mg', dosage: '1 tablet', frequency: 'Before meals', durationDays: 14 }, { name: 'Prednisolone 40mg', dosage: '1 tablet', frequency: 'Once daily', durationDays: 10 }], issuedAt: '2026-07-26', status: 'Active' },
  { id: 'rx-3', patientId: 'p-3', patientName: 'Aisha Khan', doctorId: 'd-6', doctorName: 'Dr. Amara Diallo', medicines: [{ name: 'Hydrocortisone 1% cream', dosage: 'Apply thinly', frequency: 'Twice daily', durationDays: 21 }], issuedAt: '2026-07-29', status: 'Active' },
  { id: 'rx-4', patientId: 'p-4', patientName: 'Tom Brennan', doctorId: 'd-5', doctorName: 'Dr. David Kim', medicines: [{ name: 'Ibuprofen 400mg', dosage: '1 tablet', frequency: 'Three times daily', durationDays: 7 }], issuedAt: '2026-07-25', status: 'Completed' },
  { id: 'rx-5', patientId: 'p-5', patientName: 'Maria Gonzalez', doctorId: 'd-3', doctorName: 'Dr. James Osei', medicines: [{ name: 'Amoxicillin 250mg', dosage: '1 teaspoon', frequency: 'Three times daily', durationDays: 10 }, { name: 'Ibuprofen 100mg syrup', dosage: '5ml', frequency: 'Three times daily', durationDays: 5 }], issuedAt: '2026-07-30', status: 'Active' },
  { id: 'rx-9', patientId: 'p-1', patientName: 'Sarah Johnson', doctorId: 'd-9', doctorName: 'Dr. Daniel Wright', medicines: [{ name: 'Losartan 50mg', dosage: '50mg', frequency: 'Once daily', durationDays: 90, instructions: 'Take in the morning with food.' }, { name: 'Aspirin 81mg', dosage: '81mg', frequency: 'Once daily', durationDays: 90, instructions: 'Take after breakfast.' }], issuedAt: mockDateOffset(-2), status: 'Active', appointmentId: 'ad-7' },
  { id: 'rx-10', patientId: 'p-10', patientName: 'Samuel Wright', doctorId: 'd-9', doctorName: 'Dr. Daniel Wright', medicines: [{ name: 'Aspirin 81mg', dosage: '81mg', frequency: 'Once daily', durationDays: 180, instructions: 'Take with food.' }, { name: 'Omeprazole 20mg', dosage: '20mg', frequency: 'Once daily', durationDays: 30, instructions: 'Take before breakfast.' }], issuedAt: mockDateOffset(-5), status: 'Active', appointmentId: 'ad-8' },
  { id: 'rx-11', patientId: 'p-6', patientName: 'Henry Okafor', doctorId: 'd-9', doctorName: 'Dr. Daniel Wright', medicines: [{ name: 'Losartan 50mg', dosage: '50mg', frequency: 'Twice daily', durationDays: 14, instructions: 'Monitor BP twice daily.' }], issuedAt: mockDateOffset(0), status: 'Active', appointmentId: 'ad-4' },
]

// Clinical consultations recorded by the mock doctor user (Dr. Daniel Wright).
export const mockConsultations: Consultation[] = [
  {
    id: 'c-1',
    patientId: 'p-1',
    patientName: 'Sarah Johnson',
    doctorId: 'd-9',
    doctorName: 'Dr. Daniel Wright',
    appointmentId: 'ad-7',
    chiefComplaint: 'Patient reports intermittent chest tightness two weeks after angioplasty.',
    symptoms: 'Mild exertional chest tightness, occasional palpitations, no breathlessness at rest.',
    vitals: { bloodPressure: '128/82', heartRate: 74, temperature: 36.7, respiratoryRate: 16, spo2: 98, weightKg: 68, heightCm: 165, bmi: 25 },
    examination: { general: 'Alert, comfortable at rest', cardiovascular: 'S1 S2 normal, no murmurs', respiratory: 'Clear', neurological: 'No focal deficits', abdominal: 'Soft, non-tender', other: '' },
    diagnosis: { primary: 'Stable angina', additional: 'Post-PCI status', notes: 'Recovery on track. Continue dual therapy.' },
    clinicalNotes: { assessment: 'Post-angioplasty recovery progressing well.', observations: 'Vitals stable, ECG sinus rhythm.', reasoning: 'Low-risk course; continuation of current medications.', general: '' },
    treatmentPlan: { advice: 'Gradual return to normal activity; avoid heavy lifting for 4 weeks.', diet: 'Low-salt, heart-healthy diet.', lifestyle: 'Daily 30-minute walk, smoking cessation strongly advised.', instructions: 'Report immediately if chest pain returns at rest.' },
    prescriptionId: 'rx-9',
    createdAt: `${mockDateOffset(-2)}T09:45:00.000Z`,
    updatedAt: `${mockDateOffset(-2)}T09:45:00.000Z`,
  },
  {
    id: 'c-2',
    patientId: 'p-10',
    patientName: 'Samuel Wright',
    doctorId: 'd-9',
    doctorName: 'Dr. Daniel Wright',
    appointmentId: 'ad-8',
    chiefComplaint: 'Review after coronary stent placement; patient feels well.',
    symptoms: 'No chest pain, no palpitations, good exercise tolerance.',
    vitals: { bloodPressure: '118/76', heartRate: 68, temperature: 36.5, respiratoryRate: 15, spo2: 99, weightKg: 82, heightCm: 178, bmi: 25.9 },
    examination: { general: 'Well appearing', cardiovascular: 'Regular rhythm, no murmur', respiratory: 'Clear', neurological: 'Intact', abdominal: 'Soft', other: 'Puncture site healed' },
    diagnosis: { primary: 'Coronary artery disease — post-stent', additional: '', notes: 'DAPT to continue for 6 months.' },
    clinicalNotes: { assessment: 'Doing well after stent placement.', observations: 'Stable vitals, no complications.', reasoning: 'Continue DAPT and statin therapy.', general: '' },
    treatmentPlan: { advice: 'Light activity, cardiac rehab program recommended.', diet: 'Heart-healthy diet.', lifestyle: 'Exercise as tolerated, no smoking.', instructions: 'Return in 3 months for stress test.' },
    prescriptionId: 'rx-10',
    createdAt: `${mockDateOffset(-5)}T11:20:00.000Z`,
    updatedAt: `${mockDateOffset(-5)}T11:20:00.000Z`,
  },
  {
    id: 'c-3',
    patientId: 'p-6',
    patientName: 'Henry Okafor',
    doctorId: 'd-9',
    doctorName: 'Dr. Daniel Wright',
    appointmentId: 'ad-4',
    chiefComplaint: 'Severe headache and dizziness; elevated BP recorded at triage.',
    symptoms: 'Throbbing occipital headache, blurred vision, mild nausea.',
    vitals: { bloodPressure: '190/120', heartRate: 102, temperature: 37.1, respiratoryRate: 20, spo2: 96, weightKg: 92, heightCm: 172, bmi: 31.1 },
    examination: { general: 'Anxious, in discomfort', cardiovascular: 'Tachycardia, no murmurs', respiratory: 'Clear', neurological: 'No focal deficits', abdominal: 'Soft, non-tender', other: '' },
    diagnosis: { primary: 'Hypertensive crisis', additional: 'Essential hypertension, poorly controlled', notes: 'BP controlled with IV therapy; transitioned to oral regimen.' },
    clinicalNotes: { assessment: 'Hypertensive urgency managed without end-organ damage.', observations: 'BP down-trending after treatment.', reasoning: 'Outpatient follow-up with home BP monitoring.', general: '' },
    treatmentPlan: { advice: 'Rest today; avoid exertion and stress.', diet: 'Strictly low-sodium diet.', lifestyle: 'Home BP monitoring twice daily.', instructions: 'Return if BP > 180/110 or new chest pain.' },
    prescriptionId: 'rx-11',
    createdAt: `${mockDateOffset(0)}T15:40:00.000Z`,
    updatedAt: `${mockDateOffset(0)}T15:40:00.000Z`,
  },
]

export const mockInvoices: Invoice[] = [
  { id: 'inv-1', invoiceNo: 'INV-2026-0831', patientId: 'p-1', patientName: 'Sarah Johnson', description: 'Cardiac care package', items: [{ description: 'Cardiology consultation', amount: 120 }, { description: 'ECG & echo', amount: 340 }, { description: 'Room charges (7 days)', amount: 1400 }], subtotal: 1860, discount: 100, tax: 88, total: 1848, amountPaid: 1848, status: 'Paid', issuedAt: '2026-07-28', dueDate: '2026-08-11' },
  { id: 'inv-2', invoiceNo: 'INV-2026-0830', patientId: 'p-2', patientName: 'John Miller', description: 'Oncology treatment plan', items: [{ description: 'Oncology consultation', amount: 140 }, { description: 'Biopsy & histopathology', amount: 620 }, { description: 'CT scan', amount: 480 }], subtotal: 1240, discount: 0, tax: 62, total: 1302, amountPaid: 500, status: 'Pending', issuedAt: '2026-07-26', dueDate: '2026-08-09' },
  { id: 'inv-3', invoiceNo: 'INV-2026-0829', patientId: 'p-3', patientName: 'Aisha Khan', description: 'Dermatology visit', items: [{ description: 'Dermatology consultation', amount: 85 }, { description: 'Skin allergy panel', amount: 210 }], subtotal: 295, discount: 25, tax: 13.5, total: 283.5, amountPaid: 283.5, status: 'Paid', issuedAt: '2026-07-29', dueDate: '2026-08-12' },
  { id: 'inv-4', invoiceNo: 'INV-2026-0828', patientId: 'p-4', patientName: 'Tom Brennan', description: 'Knee arthroscopy', items: [{ description: 'Orthopedic consultation', amount: 130 }, { description: 'Arthroscopy surgery', amount: 3200 }, { description: 'Anesthesia', amount: 600 }, { description: 'Physiotherapy (5 sessions)', amount: 375 }], subtotal: 4305, discount: 200, tax: 205.25, total: 4310.25, amountPaid: 2000, status: 'Overdue', issuedAt: '2026-07-25', dueDate: '2026-08-08' },
  { id: 'inv-5', invoiceNo: 'INV-2026-0827', patientId: 'p-6', patientName: 'Henry Okafor', description: 'Emergency admission', items: [{ description: 'Emergency room fee', amount: 250 }, { description: 'IV therapy & meds', amount: 180 }, { description: 'Room charges (3 days)', amount: 600 }], subtotal: 1030, discount: 0, tax: 51.5, total: 1081.5, amountPaid: 0, status: 'Pending', issuedAt: '2026-07-31', dueDate: '2026-08-14' },
  { id: 'inv-6', invoiceNo: 'INV-2026-0826', patientId: 'p-8', patientName: 'George Patel', description: 'Neurology consultation', items: [{ description: 'Neurology consultation', amount: 110 }, { description: 'MRI brain', amount: 540 }], subtotal: 650, discount: 50, tax: 30, total: 630, amountPaid: 630, status: 'Paid', issuedAt: '2026-07-30', dueDate: '2026-08-13' },
]

export const mockPayments = [
  { id: 'pay-1', invoiceId: 'inv-1', amount: 1848, method: 'Card' as const, reference: 'TXN-88412', paidAt: '2026-07-28' },
  { id: 'pay-2', invoiceId: 'inv-3', amount: 283.5, method: 'UPI' as const, reference: 'TXN-88455', paidAt: '2026-07-29' },
  { id: 'pay-3', invoiceId: 'inv-2', amount: 500, method: 'Insurance' as const, reference: 'CLM-22091', paidAt: '2026-07-27' },
  { id: 'pay-4', invoiceId: 'inv-4', amount: 2000, method: 'Bank Transfer' as const, reference: 'TXN-88490', paidAt: '2026-07-26' },
  { id: 'pay-5', invoiceId: 'inv-6', amount: 630, method: 'Card' as const, reference: 'TXN-88503', paidAt: '2026-07-30' },
]

export const mockStaff: StaffMember[] = [
  { id: 's-1', name: 'Dr. Sarah Chen', email: 'admin@medicore.health', phone: '+1 (555) 010-2244', role: 'ADMIN', department: 'Administration', shift: 'Morning', joinedAt: '2019-03-15', salary: 145000, status: 'Active' },
  { id: 's-2', name: 'Nurse Emma Wilson', email: 'e.wilson@medicore.health', phone: '+1 (555) 010-2245', role: 'NURSE', department: 'Cardiology', shift: 'Morning', joinedAt: '2021-06-01', salary: 72000, status: 'Active' },
  { id: 's-3', name: 'Nurse James Park', email: 'j.park@medicore.health', phone: '+1 (555) 010-2246', role: 'NURSE', department: 'Emergency', shift: 'Night', joinedAt: '2020-11-20', salary: 68500, status: 'Active' },
  { id: 's-4', name: 'Olivia Martinez', email: 'o.martinez@medicore.health', phone: '+1 (555) 010-2247', role: 'STAFF', department: 'Billing', shift: 'Morning', joinedAt: '2022-02-14', salary: 54000, status: 'Active' },
  { id: 's-5', name: 'Dr. Daniel Wright', email: 'd.wright@medicore.health', phone: '+1 (555) 010-2248', role: 'DOCTOR', department: 'Cardiology', shift: 'Morning', joinedAt: '2018-08-05', salary: 168000, status: 'On Leave' },
  { id: 's-6', name: 'Rachel Adams', email: 'r.adams@medicore.health', phone: '+1 (555) 010-2249', role: 'STAFF', department: 'Front Desk', shift: 'Rotating', joinedAt: '2023-04-10', salary: 42000, status: 'Active' },
  { id: 's-7', name: 'Nurse Sofia Reyes', email: 's.reyes@medicore.health', phone: '+1 (555) 010-2250', role: 'NURSE', department: 'Pediatrics', shift: 'Evening', joinedAt: '2021-09-27', salary: 70000, status: 'Active' },
  { id: 's-8', name: 'Michael Oduya', email: 'm.oduya@medicore.health', phone: '+1 (555) 010-2251', role: 'STAFF', department: 'Pharmacy', shift: 'Rotating', joinedAt: '2022-07-18', salary: 58000, status: 'Active' },
]

export const mockDashboardStats: DashboardStats = {
  totalPatients: 12480,
  patientsChange: 8.2,
  appointmentsToday: 328,
  appointmentsChange: 12.5,
  bedOccupancy: 78,
  bedOccupancyChange: 3.1,
  revenueMonth: 1200000,
  revenueChange: 15.4,
  admissionsTrend: [
    { month: 'Jan', admissions: 620, discharges: 540 },
    { month: 'Feb', admissions: 690, discharges: 610 },
    { month: 'Mar', admissions: 720, discharges: 655 },
    { month: 'Apr', admissions: 660, discharges: 640 },
    { month: 'May', admissions: 740, discharges: 700 },
    { month: 'Jun', admissions: 790, discharges: 720 },
    { month: 'Jul', admissions: 830, discharges: 760 },
    { month: 'Aug', admissions: 860, discharges: 790 },
    { month: 'Sep', admissions: 810, discharges: 770 },
    { month: 'Oct', admissions: 890, discharges: 820 },
    { month: 'Nov', admissions: 940, discharges: 860 },
    { month: 'Dec', admissions: 980, discharges: 910 },
  ],
  departmentWorkload: [
    { department: 'Cardiology', patients: 342 },
    { department: 'Neurology', patients: 218 },
    { department: 'Pediatrics', patients: 296 },
    { department: 'Orthopedics', patients: 187 },
    { department: 'General', patients: 412 },
    { department: 'Oncology', patients: 129 },
  ],
  appointmentStatus: [
    { status: 'Confirmed', count: 892 },
    { status: 'Pending', count: 214 },
    { status: 'Completed', count: 1560 },
    { status: 'Cancelled', count: 142 },
  ],
  upcomingAppointments: mockAppointments.filter((a) => a.date === '2026-08-02'),
  recentActivity: [
    { id: 'act-1', type: 'admission', message: 'Samuel Wright admitted to Cardiology Ward 3', time: '10 min ago', actor: 'Dr. Michael Roberts' },
    { id: 'act-2', type: 'lab', message: 'Lab results uploaded for John Miller (CBC, LFT)', time: '32 min ago', actor: 'Lab Dept' },
    { id: 'act-3', type: 'payment', message: 'Invoice INV-2026-0831 marked as paid', time: '1 hr ago', actor: 'Olivia Martinez' },
    { id: 'act-4', type: 'discharge', message: 'Lily Anderson discharged from Pediatrics', time: '2 hrs ago', actor: 'Dr. James Osei' },
    { id: 'act-5', type: 'prescription', message: 'New prescription issued for Maria Gonzalez', time: '3 hrs ago', actor: 'Dr. James Osei' },
    { id: 'act-6', type: 'appointment', message: 'Appointment booked: George Patel → Dr. Priya Sharma', time: '4 hrs ago', actor: 'Front Desk' },
  ],
  departmentOccupancy: [
    { department: 'Cardiology', occupied: 47, capacity: 60 },
    { department: 'General Medicine', occupied: 63, capacity: 80 },
    { department: 'Oncology', occupied: 42, capacity: 50 },
    { department: 'Neurology', occupied: 31, capacity: 40 },
    { department: 'Pediatrics', occupied: 28, capacity: 45 },
    { department: 'Orthopedics', occupied: 22, capacity: 35 },
  ],
}

export const mockReports: ReportSummary = {  period: 'July 2026',
  totalRevenue: 1154000,
  totalAppointments: 4210,
  newPatients: 386,
  avgWaitTimeMin: 18,
  reportList: [
    { id: 'r-1', name: 'Monthly Revenue Summary', type: 'Revenue', period: 'July 2026', generatedAt: '2026-08-01 09:00', format: 'PDF', size: '1.2 MB' },
    { id: 'r-2', name: 'Department Performance', type: 'Operations', period: 'July 2026', generatedAt: '2026-08-01 09:10', format: 'XLSX', size: '840 KB' },
    { id: 'r-3', name: 'Patient Admission Trends', type: 'Clinical', period: 'Q2 2026', generatedAt: '2026-07-31 16:45', format: 'CSV', size: '320 KB' },
    { id: 'r-4', name: 'Bed Occupancy Analysis', type: 'Operations', period: 'July 2026', generatedAt: '2026-07-30 11:20', format: 'PDF', size: '980 KB' },
    { id: 'r-5', name: 'Pharmacy Stock Report', type: 'Patient Care', period: 'July 2026', generatedAt: '2026-07-29 08:30', format: 'XLSX', size: '410 KB' },
    { id: 'r-6', name: 'Doctor Productivity', type: 'Clinical', period: 'July 2026', generatedAt: '2026-07-28 14:15', format: 'PDF', size: '760 KB' },
  ],
}

export const mockMedicalRecords = {
  'p-1': [
    { id: 'rec-1', date: '2026-07-28', type: 'Admission', diagnosis: 'Stable angina', doctor: 'Dr. Michael Roberts', notes: 'Angioplasty performed successfully. Patient stable under observation.', status: 'Completed' },
    { id: 'rec-2', date: '2026-07-20', type: 'Consultation', diagnosis: 'Chest pain — suspected CAD', doctor: 'Dr. Michael Roberts', notes: 'ECG abnormal, referred for angiography.', status: 'Completed' },
    { id: 'rec-3', date: '2026-06-12', type: 'Lab Test', diagnosis: 'Hyperlipidemia', doctor: 'Dr. Michael Roberts', notes: 'LDL elevated (168 mg/dL). Started Atorvastatin 20mg.', status: 'Completed' },
  ],
  'p-2': [
    { id: 'rec-4', date: '2026-07-26', type: 'Admission', diagnosis: 'Stage II colon cancer', doctor: 'Dr. Robert Nguyen', notes: 'Biopsy confirmed adenocarcinoma. Chemotherapy plan initiated.', status: 'Completed' },
  ],
  'p-3': [
    { id: 'rec-5', date: '2026-07-29', type: 'Consultation', diagnosis: 'Contact dermatitis', doctor: 'Dr. Amara Diallo', notes: 'Allergic panel positive for nickel. Prescribed hydrocortisone cream.', status: 'Completed' },
  ],
  'p-4': [
    { id: 'rec-6', date: '2026-07-25', type: 'Procedure', diagnosis: 'Meniscal tear (right knee)', doctor: 'Dr. David Kim', notes: 'Arthroscopic repair completed. 5 physiotherapy sessions advised.', status: 'Completed' },
  ],
  'p-5': [
    { id: 'rec-7', date: '2026-07-30', type: 'Consultation', diagnosis: 'Viral pharyngitis', doctor: 'Dr. James Osei', notes: 'Mild throat infection. Symptomatic treatment. Review in 5 days.', status: 'Completed' },
  ],
  'p-6': [
    { id: 'rec-8', date: '2026-07-31', type: 'Admission', diagnosis: 'Hypertensive crisis', doctor: 'Dr. Emily Carter', notes: 'BP 190/120 on arrival. IV labetalol started, responding well.', status: 'Completed' },
  ],
}

export const mockDocuments = {
  'p-1': [
    { id: 'doc-1', name: 'Discharge Summary.pdf', type: 'PDF', size: '180 KB', date: '2026-07-28', uploadedBy: 'Dr. Michael Roberts' },
    { id: 'doc-2', name: 'ECG Report.pdf', type: 'PDF', size: '92 KB', date: '2026-07-20', uploadedBy: 'Cardiology Lab' },
    { id: 'doc-3', name: 'Blood Panel.xlsx', type: 'XLSX', size: '64 KB', date: '2026-06-12', uploadedBy: 'Lab Dept' },
    { id: 'doc-4', name: 'Insurance Card.jpg', type: 'IMG', size: '210 KB', date: '2026-06-01', uploadedBy: 'Front Desk' },
  ],
  'p-2': [
    { id: 'doc-5', name: 'Biopsy Report.pdf', type: 'PDF', size: '320 KB', date: '2026-07-26', uploadedBy: 'Pathology Lab' },
  ],
}

export interface MockCreateResult {
  created: boolean
}

export function toAppointment(input: AppointmentCreateInput): Appointment {
  const patient = mockPatients.find((p) => p.id === input.patientId)
  const doctor = mockDoctors.find((d) => d.id === input.doctorId)
  return {
    id: `a-${Date.now()}`,
    patientId: input.patientId,
    patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient',
    doctorId: input.doctorId,
    doctorName: doctor?.name ?? 'Unknown Doctor',
    department: doctor?.department ?? 'General',
    type: input.type,
    date: input.date,
    time: input.time,
    durationMin: input.durationMin,
    status: 'Pending',
    reason: input.reason,
    createdAt: new Date().toISOString(),
  }
}

export function toPatient(
  input: Omit<PatientCreateInput, never> & { id?: string },
): Patient {
  const existing = input.id ? mockPatients.find((p) => p.id === input.id) : undefined
  return {
    id: input.id ?? `p-${Date.now()}`,
    patientId: existing?.patientId ?? `P-${10000 + mockPatients.length + 1}`,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    dob: input.dob,
    gender: input.gender,
    bloodGroup: input.bloodGroup,
    address: input.address,
    emergencyContact: input.emergencyContact,
    status: existing?.status ?? 'Pending',
    department: input.department,
    assignedDoctorId: input.assignedDoctorId,
    lastVisit: existing?.lastVisit ?? new Date().toISOString().slice(0, 10),
    allergies: input.allergies,
    insurance: input.insurance,
  }
}

export function toDoctor(input: Partial<Doctor> & { id?: string }): Doctor {
  const existing = input.id ? mockDoctors.find((d) => d.id === input.id) : undefined
  return {
    id: input.id ?? `d-${Date.now()}`,
    name: input.name ?? 'New Doctor',
    email: input.email ?? '',
    phone: input.phone ?? '',
    department: input.department ?? 'General Medicine',
    specialty: input.specialty ?? '',
    qualification: input.qualification ?? '',
    experienceYears: input.experienceYears ?? 0,
    consultationFee: input.consultationFee ?? 0,
    schedule: input.schedule ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    patientsCount: existing?.patientsCount ?? 0,
    rating: existing?.rating ?? 4.5,
    status: input.status ?? 'Active',
  }
}
