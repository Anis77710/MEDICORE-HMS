// ============================================================
// HealSync HMS — Staff, Dashboard & Reports services
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http, USE_MOCK_API } from '../client'
import { mockDelay, mockDashboardStats, mockReports } from '../mock'
import { store, nextId } from '../store'
import type { DashboardStats, ReportSummary, StaffMember } from '../../types'

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
export async function getDashboardStats(): Promise<DashboardStats> {
  if (USE_MOCK_API) {
    await mockDelay(650)
    return mockDashboardStats
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
      name: 'HealSync General Hospital',
      tagline: 'Smart Hospital Management',
      email: 'info@healsync.health',
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
