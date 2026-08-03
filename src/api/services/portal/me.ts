// ============================================================
// HealSync HMS — Patient Portal: current patient resolution
// ============================================================

import { ENDPOINTS } from '../../endpoints'
import { http, USE_MOCK_API } from '../../client'
import { mockDelay, mockPatients } from '../../mock'
import type { Patient, User } from '../../../types'

const MOCK_USER_KEY = 'healsync_mock_user'

function readMockUser(): User | null {
  try {
    const raw = localStorage.getItem(MOCK_USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export async function getMyPatient(): Promise<Patient> {
  if (USE_MOCK_API) {
    await mockDelay(350)
    const user = readMockUser()
    if (user) {
      const byId = mockPatients.find((p) => p.id === user.id)
      if (byId) return byId
      const byEmail = mockPatients.find((p) => p.email.toLowerCase() === user.email.toLowerCase())
      if (byEmail) return byEmail
    }
    return mockPatients[0]
  }
  return http.get<Patient>(ENDPOINTS.PORTAL_ME)
}

export async function getPatientById(id: string): Promise<Patient> {
  if (USE_MOCK_API) {
    await mockDelay(250)
    const p = mockPatients.find((x) => x.id === id)
    if (!p) throw new Error('Patient not found')
    return p
  }
  return http.get<Patient>(`/patients/${id}`)
}
