// ============================================================
// Master admin API service — platform-level operations.
// Hospital registration is paid (eSewa, one-time fee); the master
// admin approves paid requests which provisions the hospital and
// emails the admin credentials + receipt.
// ============================================================

import { masterHttp, withParams } from '../masterClient'
import { ENDPOINTS } from '../endpoints'

export interface MasterAdminInfo {
  id: string
  email: string
  name: string
}

export interface MasterLoginResult {
  admin: { name: string; email: string }
  token: string
}

export type HospitalStatus = 'active' | 'suspended'
export type RegistrationStatus = 'pending_payment' | 'paid' | 'approved' | 'rejected'

export interface MasterHospital {
  slug: string
  name: string
  adminEmail: string
  status: HospitalStatus
  listed: boolean
  dbName: string
  createdAt?: string
  counts?: { patients: number; doctors: number; appointments: number }
}

export interface RegistrationRequestItem {
  _id: string
  regNo: string
  hospitalName: string
  slug: string
  admin: { name: string; email: string; phone: string; birthYear: number }
  status: RegistrationStatus
  payment: { transactionUuid: string; transactionCode?: string; amount: number; paidAt?: string }
  reason?: string
  approvedAt?: string
  rejectedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface RequestsResponse {
  items: RegistrationRequestItem[]
  counts: Record<RegistrationStatus, number>
}

export interface PlatformSettings {
  siteName: string
  tagline: string
  contactEmail: string
  contactPhone: string
  registrationFee: number
  hospitalDirectoryEnabled: boolean
}

export interface MasterStats {
  hospitals: { total: number; active: number; suspended: number }
  requests: Record<RegistrationStatus, number>
  revenue: number
  registrationFee: number
  siteName: string
  recentRequests: { regNo: string; hospitalName: string; status: RegistrationStatus; createdAt?: string }[]
  recentHospitals: { slug: string; name: string; status: HospitalStatus; listed: boolean; createdAt?: string }[]
}

export interface PublicPlatformInfo {
  siteName: string
  tagline: string
  contactEmail: string
  contactPhone: string
  registrationFee: number
  hospitalDirectoryEnabled: boolean
}

export interface PublicHospital {
  slug: string
  name: string
  createdAt?: string
}

export interface PaymentInitiation {
  amount: number
  formUrl: string
  fields: Record<string, string>
}

export interface HospitalRegistrationInput {
  hospitalName: string
  name: string
  email: string
  phone?: string
  birthYear: number
}

// ---------- Analytics ----------

export type AnalyticsRange = '30d' | '90d' | '1y' | 'all'

export interface AnalyticsPoint {
  label: string
  value: number
}

export interface AnalyticsConversionPoint extends AnalyticsPoint {
  total: number
  approved: number
}

export interface AnalyticsTopHospital {
  slug: string
  name: string
  patients: number
  doctors: number
  appointments: number
  requests: number
}

export interface AnalyticsResponse {
  range: AnalyticsRange
  from: string
  to: string
  months: string[]
  revenueSeries: AnalyticsPoint[]
  registrationSeries: AnalyticsPoint[]
  funnel: Record<RegistrationStatus, number>
  top: AnalyticsTopHospital[]
  conversion: AnalyticsConversionPoint[]
  projection: { next30Days: number; avgDaily: number; note: string }
  revenue: { collected: number; pending: number }
}

// ---------- Receipts ----------

export interface ReceiptItem {
  id: string
  regNo: string
  hospitalName: string
  payer: string
  payerEmail: string
  amount: number
  transactionCode: string
  paidAt?: string
  status: RegistrationStatus
}

export interface ReceiptsResponse {
  items: ReceiptItem[]
  total: number
  summary: { approved: number; paid: number; rejected: number }
}

// ---------- Announcements ----------

export interface Announcement {
  id: string
  title: string
  message: string
  audience: 'all' | 'active'
  active: boolean
  createdBy: { id: string; email: string }
  createdAt?: string
  updatedAt?: string
}

// ---------- Audit log ----------

export type AuditAction =
  | 'login'
  | 'approve_request'
  | 'reject_request'
  | 'hospital_status'
  | 'hospital_listed'
  | 'hospital_delete'
  | 'settings_update'
  | 'announcement_create'
  | 'announcement_delete'
  | 'contact_done'
  | 'contact_delete'

export interface AuditEntryItem {
  id: string
  actor: { id: string; email: string; name: string }
  action: AuditAction
  targetType: string | null
  targetId: string | null
  summary: string
  createdAt?: string
}

export interface AuditResponse {
  items: AuditEntryItem[]
  total: number
  page: number
  limit: number
}

// ---------- Contact inbox ----------

export interface ContactMessageItem {
  id: string
  name: string
  email: string
  hospital: string
  message: string
  done: boolean
  doneAt?: string
  createdAt?: string
}

export interface ContactsResponse {
  items: ContactMessageItem[]
  total: number
  openTotal: number
}

export const masterApi = {
  login: (email: string, password: string) =>
    masterHttp.post<MasterLoginResult>(ENDPOINTS.MASTER_LOGIN, { email, password }),

  me: () => masterHttp.get<MasterAdminInfo>(ENDPOINTS.MASTER_ME),

  initiateHospitalRegistration: (input: HospitalRegistrationInput) =>
    masterHttp.post<PaymentInitiation>(ENDPOINTS.MASTER_REGISTER_INITIATE, input),

  stats: () => masterHttp.get<MasterStats>(ENDPOINTS.MASTER_STATS),

  listRequests: (status?: RegistrationStatus) =>
    masterHttp.get<RequestsResponse>(ENDPOINTS.MASTER_REQUESTS, { params: { status } }),

  approveRequest: (id: string) =>
    masterHttp.post<{ request: RegistrationRequestItem; credentials: { username: string } }>(
      withParams(ENDPOINTS.MASTER_REQUEST_APPROVE, { id }),
    ),

  rejectRequest: (id: string, reason?: string) =>
    masterHttp.post<RegistrationRequestItem>(withParams(ENDPOINTS.MASTER_REQUEST_REJECT, { id }), {
      reason,
    }),

  listHospitals: (stats = true) =>
    masterHttp.get<{ items: MasterHospital[]; total: number }>(ENDPOINTS.MASTER_HOSPITALS, {
      params: { stats: stats ? 'true' : 'false' },
    }),

  hospitalDetail: (slug: string) =>
    masterHttp.get<MasterHospital>(withParams(ENDPOINTS.MASTER_HOSPITAL_DETAIL, { slug })),

  setHospitalStatus: (slug: string, status: HospitalStatus) =>
    masterHttp.patch<MasterHospital>(withParams(ENDPOINTS.MASTER_HOSPITAL_STATUS, { slug }), {
      status,
    }),

  setHospitalListed: (slug: string, listed: boolean) =>
    masterHttp.patch<MasterHospital>(withParams(ENDPOINTS.MASTER_HOSPITAL_LISTED, { slug }), {
      listed,
    }),

  deleteHospital: (slug: string) =>
    masterHttp.delete<{ message: string }>(withParams(ENDPOINTS.MASTER_HOSPITAL_DELETE, { slug }), {
      confirm: 'DELETE',
    }),

  getSettings: () => masterHttp.get<PlatformSettings>(ENDPOINTS.MASTER_SETTINGS),

  updateSettings: (patch: Partial<PlatformSettings>) =>
    masterHttp.put<PlatformSettings>(ENDPOINTS.MASTER_SETTINGS, patch),

  publicPlatform: () => masterHttp.get<PublicPlatformInfo>(ENDPOINTS.PUBLIC_PLATFORM),
  publicHospitals: () => masterHttp.get<PublicHospital[]>(ENDPOINTS.PUBLIC_HOSPITALS),

  // ---------- Analytics ----------
  analytics: (range: AnalyticsRange = '30d') =>
    masterHttp.get<AnalyticsResponse>(ENDPOINTS.MASTER_ANALYTICS, { params: { range } }),

  // ---------- Receipts ----------
  receipts: (opts: { status?: 'approved' | 'paid' | 'rejected'; from?: string; to?: string } = {}) =>
    masterHttp.get<ReceiptsResponse>(ENDPOINTS.MASTER_RECEIPTS, { params: opts }),

  // ---------- Announcements ----------
  listAnnouncements: () => masterHttp.get<{ items: Announcement[] }>(ENDPOINTS.MASTER_ANNOUNCEMENTS),

  createAnnouncement: (input: { title: string; message: string; audience: 'all' | 'active' }) =>
    masterHttp.post<Announcement>(ENDPOINTS.MASTER_ANNOUNCEMENTS, input),

  setAnnouncementActive: (id: string, active: boolean) =>
    masterHttp.patch<{ id: string; active: boolean }>(withParams(ENDPOINTS.MASTER_ANNOUNCEMENT_DETAIL, { id }), { active }),

  deleteAnnouncement: (id: string) =>
    masterHttp.delete<{ message: string }>(withParams(ENDPOINTS.MASTER_ANNOUNCEMENT_DETAIL, { id })),

  // ---------- Audit log ----------
  audit: (opts: { action?: string; q?: string; page?: number; limit?: number } = {}) =>
    masterHttp.get<AuditResponse>(ENDPOINTS.MASTER_AUDIT, { params: opts }),

  // ---------- Contact inbox ----------
  contacts: (filter: 'all' | 'open' | 'done' = 'all') =>
    masterHttp.get<ContactsResponse>(ENDPOINTS.MASTER_CONTACTS, { params: { filter } }),

  setContactDone: (id: string, done: boolean) =>
    masterHttp.patch<{ id: string; done: boolean }>(withParams(ENDPOINTS.MASTER_CONTACT_DETAIL, { id }), { done }),

  deleteContact: (id: string) =>
    masterHttp.delete<{ message: string }>(withParams(ENDPOINTS.MASTER_CONTACT_DETAIL, { id })),

  // ---------- Directory ----------
  setDirectoryOrder: (slugs: string[]) =>
    masterHttp.put<{ items: MasterHospital[] }>(ENDPOINTS.MASTER_DIRECTORY_ORDER, { slugs }),

  // ---------- Public contact form ----------
  submitContact: (input: { name: string; email: string; hospital?: string; message: string }) =>
    masterHttp.post<{ message: string }>(ENDPOINTS.PUBLIC_CONTACT, input),
}
