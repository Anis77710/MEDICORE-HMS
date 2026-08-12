// ============================================================
// Master admin API service — platform-level operations.
// Hospital registration is paid (eSewa, NPR 2,000); the master
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
  regNo: string
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
}
