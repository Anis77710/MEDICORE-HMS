// ============================================================
// Medicore HMS — Role-Based Access Control (RBAC)
// Every user belongs to exactly one role. Each role has a fixed
// set of modules it can open and, per module, the actions it can
// perform. ADMIN has full access; all other roles are granted
// capabilities according to their position ("post").
// ============================================================

import type { Role } from '../types'

export type AdminModule =
  | 'dashboard'
  | 'patients'
  | 'doctors'
  | 'appointments'
  | 'departments'
  | 'pharmacy'
  | 'billing'
  | 'staff'
  | 'reports'
  | 'consultations'
  | 'settings'

export type Permission = 'view' | 'create' | 'edit' | 'delete'

export const ADMIN_MODULES: AdminModule[] = [
  'dashboard',
  'patients',
  'doctors',
  'appointments',
  'departments',
  'pharmacy',
  'billing',
  'staff',
  'reports',
  'consultations',
  'settings',
]

export const ALL_PERMS: Permission[] = ['view', 'create', 'edit', 'delete']

// ---------- Capabilities: module -> permissions per role ----------

export const ROLE_CAPS: Record<Role, Partial<Record<AdminModule, Permission[]>>> = {
  ADMIN: {
    dashboard: ALL_PERMS,
    patients: ALL_PERMS,
    doctors: ALL_PERMS,
    appointments: ALL_PERMS,
    departments: ALL_PERMS,
    pharmacy: ALL_PERMS,
    billing: ALL_PERMS,
    staff: ALL_PERMS,
    reports: ALL_PERMS,
    consultations: ['view'],
    settings: ALL_PERMS,
  },
  DOCTOR: {
    dashboard: ['view'],
    patients: ['view', 'edit'],
    doctors: ['view'],
    appointments: ['view', 'edit'],
    pharmacy: ['view'],
  },
  NURSE: {
    dashboard: ['view'],
    patients: ['view', 'edit'],
    appointments: ['view', 'edit'],
    departments: ['view'],
    pharmacy: ['view'],
  },
  STAFF: {
    dashboard: ['view'],
    patients: ['view', 'create'],
    appointments: ['view', 'create', 'edit'],
    billing: ['view', 'create', 'edit'],
    pharmacy: ['view'],
  },
  PATIENT: {},
}

// ---------- Helpers ----------

export function canAccessModule(role: Role, module: AdminModule): boolean {
  return (ROLE_CAPS[role][module]?.length ?? 0) > 0
}

export function can(role: Role, module: AdminModule, perm: Permission): boolean {
  return ROLE_CAPS[role][module]?.includes(perm) ?? false
}

export function allowedModules(role: Role): AdminModule[] {
  return ADMIN_MODULES.filter((m) => canAccessModule(role, m))
}

export function modulesForRole(role: Role): { module: AdminModule; perms: Permission[] }[] {
  return ADMIN_MODULES.filter((m) => canAccessModule(role, m)).map((m) => ({
    module: m,
    perms: ROLE_CAPS[role][m] ?? [],
  }))
}

// ---------- Labels ----------

export const MODULE_LABELS: Record<AdminModule, string> = {
  dashboard: 'Dashboard',
  patients: 'Patients',
  doctors: 'Doctors',
  appointments: 'Appointments',
  departments: 'Departments',
  pharmacy: 'Pharmacy',
  billing: 'Billing & Payments',
  staff: 'Staff',
  reports: 'Reports',
  consultations: 'Consultations',
  settings: 'Settings',
}

export const MODULE_ROUTE: Record<AdminModule, string> = {
  dashboard: '/dashboard',
  patients: '/patients',
  doctors: '/doctors',
  appointments: '/appointments',
  departments: '/departments',
  pharmacy: '/pharmacy',
  billing: '/billing',
  staff: '/staff',
  reports: '/reports',
  consultations: '/consultations',
  settings: '/settings',
}

export const PERM_LABELS: Record<Permission, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
}

// ---------- Role metadata: title, duties, responsibilities ----------

export interface RoleMeta {
  title: string
  short: string
  description: string
  duties: string[]
  controls: string[]
}

export const ROLE_META: Record<Role, RoleMeta> = {
  ADMIN: {
    title: 'System Administrator',
    short: 'Administrator',
    description:
      'Full operational control of Medicore HMS. Administrators oversee every department, manage staff and accounts, and own financial, clinical and system-level decisions.',
    duties: [
      'Manage patients, doctors, departments and staff accounts',
      'Oversee hospital operations, admissions and bed allocation',
      'Approve and audit all billing, payments and refunds',
      'Generate hospital-wide reports and performance analytics',
      'Configure system settings, shifts and access policies',
      'Resolve escalated issues across all departments',
    ],
    controls: [
      'All modules: full create, view, edit and delete rights',
      'Manage users, roles and department hierarchy',
      'Financial approvals and report generation',
    ],
  },
  DOCTOR: {
    title: 'Medical Doctor',
    short: 'Doctor',
    description:
      'Clinical responsibility for patient care. Doctors consult patients, review medical history, issue prescriptions and keep records up to date.',
    duties: [
      'Consult and examine assigned patients',
      'Review patient history, allergies and prior records',
      'Issue and update prescriptions for patients',
      'Confirm, reschedule and complete appointments',
      'Update diagnosis notes and treatment details',
      'Coordinate with nursing and pharmacy staff',
    ],
    controls: [
      'View & edit patient clinical records (no deletion)',
      'Manage own appointments and visit outcomes',
      'View doctor directory and pharmacy inventory',
    ],
  },
  NURSE: {
    title: 'Nursing Staff',
    short: 'Nurse',
    description:
      'Front-line patient care. Nurses track admissions and vitals, coordinate appointments and support pharmacy dispensing.',
    duties: [
      'Track admissions, discharges and patient status',
      'Record patient vitals, allergies and observations',
      'Coordinate appointment flow and patient intake',
      'Prepare and dispense medicines from pharmacy',
      'Monitor bed occupancy in departments',
      'Escalate critical conditions to doctors',
    ],
    controls: [
      'View & edit patient care data (no deletion)',
      'Update appointment status and department beds',
      'Pharmacy inventory view for dispensing',
    ],
  },
  STAFF: {
    title: 'Administrative Staff',
    short: 'Staff',
    description:
      'Hospital administration and front desk. Staff handle patient intake, appointment scheduling and billing operations.',
    duties: [
      'Register and admit new patients',
      'Schedule, reschedule and cancel appointments',
      'Generate invoices and process payments',
      'Maintain patient contact and insurance details',
      'Support pharmacy stock visibility',
      'Handle front-desk enquiries and walk-ins',
    ],
    controls: [
      'Create & edit patient records (no delete)',
      'Manage appointment scheduling end-to-end',
      'Create and settle billing invoices',
      'View pharmacy availability',
    ],
  },
  PATIENT: {
    title: 'Patient',
    short: 'Patient',
    description:
      'Registered patient with view-only access to their own records within the hospital system.',
    duties: [
      'View personal appointments and visit history',
      'Access medical records and prescriptions',
      'Review invoices and payment status',
    ],
    controls: [
      'Read-only access to own data',
      'No access to hospital administration modules',
    ],
  },
}

// ---------- Login helpers (demo credentials per role) ----------

export const ROLE_DEMO_LOGINS: { role: Role; email: string; password: string; label: string }[] = [
  { role: 'ADMIN', email: 'admin@medicore.health', password: 'admin123', label: 'Administrator' },
  { role: 'DOCTOR', email: 'd.wright@medicore.health', password: 'doctor123', label: 'Doctor' },
  { role: 'NURSE', email: 'e.wilson@medicore.health', password: 'nurse123', label: 'Nurse' },
  { role: 'STAFF', email: 'o.martinez@medicore.health', password: 'staff123', label: 'Front Desk' },
  { role: 'PATIENT', email: 'sarah.johnson@email.com', password: 'patient123', label: 'Patient' },
]
