// ============================================================
// Medicore HMS — Staff, Dashboard, Reports & Settings services
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http } from '../client'
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
  birthYear: number
}

export async function listStaff(q: { search?: string; role?: string } = {}): Promise<StaffMember[]> {
  return http.get<StaffMember[]>(ENDPOINTS.STAFF, { params: { ...q } })
}

export async function createStaff(
  input: StaffInput,
): Promise<StaffMember & { credentials?: { username: string; password: string } }> {
  return http.post<StaffMember & { credentials?: { username: string; password: string } }>(
    ENDPOINTS.STAFF_CREATE,
    input,
  )
}

export async function updateStaff(id: string, input: Partial<StaffInput>): Promise<StaffMember> {
  return http.put<StaffMember>(withParams(ENDPOINTS.STAFF_UPDATE, { id }), input)
}

export async function deleteStaff(id: string): Promise<void> {
  await http.delete(withParams(ENDPOINTS.STAFF_DELETE, { id }))
}

// ---------- Dashboard ----------
export async function getDashboardStats(): Promise<DashboardStats> {
  return http.get<DashboardStats>(ENDPOINTS.DASHBOARD_STATS)
}

// ---------- Platform announcements banner ----------
export interface DashboardAnnouncement {
  id: string
  title: string
  message: string
  createdAt?: string
}

export async function getDashboardAnnouncements(): Promise<DashboardAnnouncement[]> {
  const res = await http.get<{ items: DashboardAnnouncement[] }>(ENDPOINTS.DASHBOARD_ANNOUNCEMENTS)
  return res.items
}

// ---------- Reports ----------
export async function getReports(): Promise<ReportSummary> {
  return http.get<ReportSummary>(ENDPOINTS.REPORTS)
}

export async function generateReport(name: string, type: string, period: string): Promise<{ id: string }> {
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
  return http.get<HospitalSettings>(ENDPOINTS.SETTINGS_HOSPITAL)
}

export async function updateHospitalSettings(input: HospitalSettings): Promise<HospitalSettings> {
  return http.put<HospitalSettings>(ENDPOINTS.SETTINGS_HOSPITAL, input)
}

export interface OwnProfile {
  name: string
  email: string
  phone: string
  role: string
}

export async function getOwnProfile(): Promise<OwnProfile> {
  return http.get<OwnProfile>(ENDPOINTS.SETTINGS_PROFILE)
}

export async function updateOwnProfile(input: {
  name?: string
  phone?: string
}): Promise<OwnProfile> {
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
  return http.get<AuditLogEntry[]>(ENDPOINTS.SETTINGS_AUDIT_LOG, { params: { ...q } })
}
