// ============================================================
// HealSync HMS — Patient Portal: profile & password
// ============================================================

import { ENDPOINTS } from '../../endpoints'
import { http, USE_MOCK_API } from '../../client'
import { mockDelay, mockPatients } from '../../mock'
import type { Patient } from '../../../types'
import type { PasswordChangeInput, PatientProfileInput } from '../../../types/portal'

export async function updateMyProfile(input: PatientProfileInput): Promise<Patient> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const idx = mockPatients.findIndex((p) => p.id === (input as unknown as { id: string }).id)
    if (idx === -1) throw new Error('Patient not found')
    const updated: Patient = {
      ...mockPatients[idx],
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      dob: input.dob,
      gender: input.gender,
      bloodGroup: input.bloodGroup,
      address: input.address,
      emergencyContact: input.emergencyContact,
      insurance: input.insurance,
      allergies: input.allergies,
    }
    mockPatients[idx] = updated
    return updated
  }
  return http.put<Patient>(ENDPOINTS.PORTAL_PROFILE, input)
}

export async function changeMyPassword(input: PasswordChangeInput): Promise<{ success: boolean }> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    if (input.currentPassword !== 'password123') {
      throw new Error('Current password is incorrect')
    }
    if (input.newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters')
    }
    return { success: true }
  }
  return http.post<{ success: boolean }>(ENDPOINTS.PORTAL_PASSWORD, input)
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  if (USE_MOCK_API) {
    await mockDelay(800)
    return { avatarUrl: URL.createObjectURL(file) }
  }
  const form = new FormData()
  form.append('avatar', file)
  return http.post<{ avatarUrl: string }>(ENDPOINTS.PORTAL_PROFILE, form, {
    headers: undefined,
  } as never)
}
