// ============================================================
// Medicore HMS - Auth service
// Real API: POST {base}/auth/* (see ENDPOINTS)
// ============================================================

import { ENDPOINTS } from '../endpoints'
import { http, setToken, setHospital } from '../client'
import type { AuthResponse, User } from '../../types'

export interface LoginInput {
  email: string
  password: string
  remember?: boolean
}

// Registration is for NEW HOSPITALS only - it creates the hospital
// profile plus the first ADMIN account with generated credentials.
export interface HospitalRegisterInput {
  hospitalName: string
  name: string
  email: string
  phone: string
  birthYear: number
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const res = await http.post<AuthResponse>(ENDPOINTS.AUTH_LOGIN, input, { auth: false })
  if (res.hospital?.slug) setHospital(res.hospital.slug)
  return res
}

export async function register(input: HospitalRegisterInput): Promise<AuthResponse> {
  const res = await http.post<AuthResponse>(ENDPOINTS.AUTH_REGISTER, input, { auth: false })
  if (res.hospital?.slug) setHospital(res.hospital.slug)
  return res
}

export async function logout(): Promise<void> {
  try {
    await http.post(ENDPOINTS.AUTH_LOGOUT)
  } finally {
    setToken(null)
  }
}

export async function getCurrentUser(): Promise<User> {
  return http.get<User>(ENDPOINTS.AUTH_ME)
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return http.post<{ message: string }>(ENDPOINTS.AUTH_FORGOT_PASSWORD, { email }, { auth: false })
}

export async function verifyOtp(email: string, otp: string): Promise<{ valid: boolean }> {
  return http.post<{ valid: boolean }>(ENDPOINTS.AUTH_VERIFY_OTP, { email, otp }, { auth: false })
}

export async function resetPassword(
  email: string,
  otp: string,
  password: string,
): Promise<{ success: boolean }> {
  return http.post<{ success: boolean }>(
    ENDPOINTS.AUTH_RESET_PASSWORD,
    { email, otp, password },
    { auth: false },
  )
}

// Forced first-login password change (and self-service change). Returns
// the updated user so the app can drop the mustChangePassword gate.
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; user: User }> {
  return http.post<{ success: boolean; user: User }>(ENDPOINTS.AUTH_CHANGE_PASSWORD, {
    currentPassword,
    newPassword,
  })
}
