// ============================================================
// Medicore HMS — Auth service
// Real API: POST {base}/auth/* (see ENDPOINTS)
// Mock:     simulates the same contract
// ============================================================

import { ENDPOINTS } from '../endpoints'
import { http, setToken, setHospital, USE_MOCK_API, ApiError } from '../client'
import { MOCK_USER, mockAccounts, mockDelay, mockPatients, mockStaff } from '../mock'
import type { AuthResponse, User } from '../../types'

const MOCK_USER_KEY = 'medicore_mock_user'

// Mirrors the server-side rule: ramesh@medicore.hms / ramesh@1985
function mockUsername(name: string): string {
  const cleaned = name.replace(/^(dr|mr|mrs|ms|prof|er)\.?\s+/i, '').trim()
  const first = (cleaned.split(/\s+/)[0] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${first || 'user'}@medicore.hms`
}

function mockPassword(name: string, birthYear: number): string {
  const cleaned = name.replace(/^(dr|mr|mrs|ms|prof|er)\.?\s+/i, '').trim()
  const first = (cleaned.split(/\s+/)[0] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${first || 'user'}@${birthYear}`
}

function saveMockUser(user: User): void {
  localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user))
}

function readMockUser(): User | null {
  try {
    const raw = localStorage.getItem(MOCK_USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function resolveMockUser(identifier: string): User {
  const account = mockAccounts.find(
    (a) => a.email.toLowerCase() === identifier.toLowerCase() || a.username === identifier.toLowerCase(),
  )
  if (account) {
    return {
      id: account.id,
      name: account.name,
      email: account.email,
      username: account.username,
      role: account.role,
      phone: account.phone,
      department: account.department,
    }
  }
  const patient = mockPatients.find((p) => p.email.toLowerCase() === identifier.toLowerCase())
  if (patient) {
    return {
      id: patient.id,
      name: `${patient.firstName} ${patient.lastName}`,
      email: patient.email,
      role: 'PATIENT',
      phone: patient.phone,
    }
  }
  const staff = mockStaff.find((s) => s.email.toLowerCase() === identifier.toLowerCase())
  if (staff) {
    return {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      phone: staff.phone,
      department: staff.department,
    }
  }
  return { ...MOCK_USER, email: identifier }
}

export interface LoginInput {
  email: string
  password: string
  remember?: boolean
}

// Registration is for NEW HOSPITALS only — it creates the hospital
// profile plus the first ADMIN account with generated credentials.
export interface HospitalRegisterInput {
  hospitalName: string
  name: string
  email: string
  phone: string
  birthYear: number
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  if (USE_MOCK_API) {
    await mockDelay(700)
    if (!input.email || !input.password) {
      throw new ApiError('Please enter your username and password', 400)
    }
    const user = resolveMockUser(input.email)
    const token = `mock-token-${btoa(JSON.stringify(user)).slice(0, 24)}`
    saveMockUser(user)
    return { user, token, hospital: { slug: 'medicore', name: 'Medicore Demo Hospital' } }
  }
  const res = await http.post<AuthResponse>(ENDPOINTS.AUTH_LOGIN, input, { auth: false })
  if (res.hospital?.slug) setHospital(res.hospital.slug)
  return res
}

export async function register(input: HospitalRegisterInput): Promise<AuthResponse> {
  if (USE_MOCK_API) {
    await mockDelay(800)
    const username = mockUsername(input.name)
    const password = mockPassword(input.name, input.birthYear)
    const user: User = {
      id: `u-${Date.now()}`,
      name: input.name,
      email: input.email,
      username,
      phone: input.phone,
      role: 'ADMIN',
    }
    const token = `mock-token-${btoa(JSON.stringify(user)).slice(0, 24)}`
    saveMockUser(user)
    return { user, token, username, password, hospital: { slug: 'medicore', name: input.hospitalName } }
  }
  const res = await http.post<AuthResponse>(ENDPOINTS.AUTH_REGISTER, input, { auth: false })
  if (res.hospital?.slug) setHospital(res.hospital.slug)
  return res
}

export async function logout(): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay(200)
    localStorage.removeItem(MOCK_USER_KEY)
    setToken(null)
    return
  }
  try {
    await http.post(ENDPOINTS.AUTH_LOGOUT)
  } finally {
    setToken(null)
  }
}

export async function getCurrentUser(): Promise<User> {
  if (USE_MOCK_API) {
    await mockDelay(300)
    return readMockUser() ?? MOCK_USER
  }
  return http.get<User>(ENDPOINTS.AUTH_ME)
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  if (USE_MOCK_API) {
    await mockDelay(700)
    return { message: `Reset link sent to ${email}` }
  }
  return http.post<{ message: string }>(ENDPOINTS.AUTH_FORGOT_PASSWORD, { email }, { auth: false })
}

export async function verifyOtp(email: string, otp: string): Promise<{ valid: boolean }> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    return { valid: otp.length >= 4 }
  }
  return http.post<{ valid: boolean }>(ENDPOINTS.AUTH_VERIFY_OTP, { email, otp }, { auth: false })
}

export async function resetPassword(
  email: string,
  otp: string,
  password: string,
): Promise<{ success: boolean }> {
  if (USE_MOCK_API) {
    await mockDelay(700)
    if (password.length < 6) throw new ApiError('Password must be at least 6 characters', 400)
    return { success: true }
  }
  return http.post<{ success: boolean }>(
    ENDPOINTS.AUTH_RESET_PASSWORD,
    { email, otp, password },
    { auth: false },
  )
}
