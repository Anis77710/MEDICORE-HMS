// ============================================================
// Medicore HMS — Staff, Dashboard, Reports & Settings services
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http, USE_MOCK_API } from '../client'
import { mockDelay, mockDashboardStats, mockReports } from '../mock'
import { store, nextId } from '../store'
import type { AuditLogEntry, DashboardStats, ReportSummary, StaffMember } from '../../types'

// ---------- Staff ----------
export interface StaffInput {
  name: string
  email: string
  phone: string
  role: StaffMember['role']
  department: string
  shift: StaffMember['shift']
  salary: number
  status: StaffMember['status']
}

export async function listStaff(q: { search?: string; role?: string } = {}): Promise<StaffMember[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    let list = [...store.staff]
    if (q.search) {
      const s = q.search.toLowerCase()
      list = list.filter((m) => m.name.toLowerCase().includes(s) || m.email.toLowerCase().includes(s))
    }
    if (q.role && q.role !== 'All') list = list.filter((m) => m.role === q.role)
    return list
  }
  return http.get<StaffMember[]>(ENDPOINTS.STAFF, { params: { ...q } })
}

export async function createStaff(input: StaffInput): Promise<StaffMember> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const member: StaffMember = {
      ...input,
      id: nextId('s'),
      joinedAt: new Date().toISOString().slice(0, 10),
    }
    store.staff.push(member)
    return member
  }
  return http.post<StaffMember>(ENDPOINTS.STAFF_CREATE, input)
}

export async function updateStaff(id: string, input: Partial<StaffInput>): Promise<StaffMember> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const idx = store.staff.findIndex((x) => x.id === id)
    if (idx === -1) throw new Error('Staff member not found')
    store.staff[idx] = { ...store.staff[idx], ...input }
    return store.staff[idx]
  }
  return http.put<StaffMember>(withParams(ENDPOINTS.STAFF_UPDATE, { id }), input)
}

export async function deleteStaff(id: string): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    store.staff = store.staff.filter((x) => x.id !== id)
    return
  }
  await http.delete(withParams(ENDPOINTS.STAFF_DELETE, { id }))
}

// ---------- Dashboard ----------
const OCCUPYING_STATUSES = ['Admitted', 'Critical']

export function occupancyByDepartment(): Map<string, number> {
  const map = new Map<string, number>()
  for (const p of store.patients) {
    if (OCCUPYING_STATUSES.includes(p.status)) {
      map.set(p.department, (map.get(p.department) ?? 0) + 1)
    }
  }
  return map
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (USE_MOCK_API) {
    await mockDelay(650)
    // Bed occupancy is always derived from registered patients in a bed,
    // never from stored/mock numbers.
    const occupiedByDept = occupancyByDepartment()
    const departmentOccupancy = store.departments.map((d) => ({
      department: d.name,
      occupied: occupiedByDept.get(d.name) ?? 0,
      capacity: d.bedCount,
    }))
    const capacity = departmentOccupancy.reduce((s, d) => s + d.capacity, 0)
    const occupied = departmentOccupancy.reduce((s, d) => s + d.occupied, 0)
    return {
      ...mockDashboardStats,
      bedOccupancy: capacity > 0 ? Math.round((occupied / capacity) * 100) : 0,
      bedOccupancyChange: 0,
      departmentOccupancy,
    }
  }
  return http.get<DashboardStats>(ENDPOINTS.DASHBOARD_STATS)
}

// ---------- Reports ----------
export async function getReports(): Promise<ReportSummary> {
  if (USE_MOCK_API) {
    await mockDelay(500)
    return mockReports
  }
  return http.get<ReportSummary>(ENDPOINTS.REPORTS)
}

export async function generateReport(name: string, type: string, period: string): Promise<{ id: string }> {
  if (USE_MOCK_API) {
    await mockDelay(1200)
    return { id: nextId('r') }
  }
  return http.post<{ id: string }>(ENDPOINTS.REPORT_GENERATE, { name, type, period })
}

// ---------- Settings (hospital profile) ----------
export interface HospitalSettings {
  name: string
  tagline: string
  email: string
  phone: string
  address: string
  license: string
  timezone: string
  currency: string
  logoUrl?: string
}

export async function getHospitalSettings(): Promise<HospitalSettings> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    return {
      name: 'Medicore General Hospital',
      tagline: 'Smart Hospital Management',
      email: 'info@medicore.health',
      phone: '+1 (555) 010-0000',
      address: '120 Wellness Boulevard, Springfield, IL 62701',
      license: 'HS-2026-04821',
      timezone: 'UTC-5 (Eastern)',
      currency: 'USD ($)',
    }
  }
  return http.get<HospitalSettings>(ENDPOINTS.SETTINGS_HOSPITAL)
}

export async function updateHospitalSettings(input: HospitalSettings): Promise<HospitalSettings> {
  if (USE_MOCK_API) {
    await mockDelay(500)
    return input
  }
  return http.put<HospitalSettings>(ENDPOINTS.SETTINGS_HOSPITAL, input)
}

export interface OwnProfile {
  name: string
  email: string
  phone: string
  role: string
}

export async function getOwnProfile(): Promise<OwnProfile> {
  if (USE_MOCK_API) {
    await mockDelay(300)
    const mockUser = localStorage.getItem('medicore_mock_user')
    const parsed = mockUser ? (JSON.parse(mockUser) as { name?: string; email?: string; role?: string }) : null
    return {
      name: parsed?.name ?? 'Dr. Daniel Wright',
      email: parsed?.email ?? 'd.wright@medicore.health',
      phone: '+1 (555) 010-2030',
      role: parsed?.role ?? 'DOCTOR',
    }
  }
  return http.get<OwnProfile>(ENDPOINTS.SETTINGS_PROFILE)
}

export async function updateOwnProfile(input: {
  name?: string
  phone?: string
}): Promise<OwnProfile> {
  if (USE_MOCK_API) {
    await mockDelay(500)
    return getOwnProfile()
  }
  return http.put<OwnProfile>(ENDPOINTS.SETTINGS_PROFILE, input)
}

// ---------- Audit log (admin) ----------
export interface AuditLogQuery {
  action?: string
  resource?: string
  search?: string
  from?: string
  to?: string
}

export async function getAuditLog(q: AuditLogQuery = {}): Promise<AuditLogEntry[]> {
  if (USE_MOCK_API) {
    await mockDelay(450)
    let list = [...store.auditLog]
    if (q.action && q.action !== 'All') list = list.filter((e) => e.action === q.action)
    if (q.resource && q.resource !== 'All') list = list.filter((e) => e.resource === q.resource)
    if (q.search) {
      const s = q.search.toLowerCase()
      list = list.filter((e) => e.actor.toLowerCase().includes(s))
    }
    if (q.from || q.to) {
      list = list.filter((e) => {
        const ts = e.createdAt.slice(0, 10)
        return (!q.from || ts >= q.from) && (!q.to || ts <= q.to)
      })
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return http.get<AuditLogEntry[]>(ENDPOINTS.SETTINGS_AUDIT_LOG, { params: { ...q } })
}
