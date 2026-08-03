// ============================================================
// HealSync HMS — Auth service
// Real API: POST {base}/auth/* (see ENDPOINTS)
// Mock:     simulates the same contract
// ============================================================

import { ENDPOINTS } from '../endpoints'
import { http, setToken, USE_MOCK_API, ApiError } from '../client'
import { MOCK_USER, mockDelay, mockPatients, mockStaff } from '../mock'
import type { AuthResponse, User } from '../../types'

const MOCK_USER_KEY = 'healsync_mock_user'

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

function resolveMockUser(email: string): User {
  const patient = mockPatients.find((p) => p.email.toLowerCase() === email.toLowerCase())
  if (patient) {
    return {
      id: patient.id,
      name: `${patient.firstName} ${patient.lastName}`,
      email: patient.email,
      role: 'PATIENT',
      phone: patient.phone,
    }
  }
  const staff = mockStaff.find((s) => s.email.toLowerCase() === email.toLowerCase())
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
  return { ...MOCK_USER, email }
}

export interface LoginInput {
  email: string
  password: string
  remember?: boolean
}

export interface RegisterInput {
  name: string
  email: string
  phone: string
  role: 'ADMIN' | 'DOCTOR' | 'NURSE' | 'STAFF' | 'PATIENT'
  password: string
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  if (USE_MOCK_API) {
    await mockDelay(700)
    if (!input.email || !input.password) {
      throw new ApiError('Please enter your email and password', 400)
    }
    const user = resolveMockUser(input.email)
    const token = `mock-token-${btoa(JSON.stringify(user)).slice(0, 24)}`
    saveMockUser(user)
    return { user, token }
  }
  return http.post<AuthResponse>(ENDPOINTS.AUTH_LOGIN, input, { auth: false })
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  if (USE_MOCK_API) {
    await mockDelay(800)
    if (input.password.length < 6) {
      throw new ApiError('Password must be at least 6 characters', 400)
    }
    let user: User
    if (input.role === 'PATIENT') {
      user = {
        id: `p-${Date.now()}`,
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: 'PATIENT',
      }
    } else {
      user = {
        id: `u-${Date.now()}`,
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
      }
    }
    const token = `mock-token-${btoa(JSON.stringify(user)).slice(0, 24)}`
    saveMockUser(user)
    return { user, token }
  }
  return http.post<AuthResponse>(ENDPOINTS.AUTH_REGISTER, input, { auth: false })
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
