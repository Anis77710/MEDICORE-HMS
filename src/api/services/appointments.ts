// ============================================================
// Medicore HMS - Appointments service
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http } from '../client'
import type { Appointment, AppointmentCreateInput, AppointmentStatus } from '../../types'

export interface AppointmentQuery {
  status?: AppointmentStatus | 'All'
  date?: string
  search?: string
}

export async function listAppointments(q: AppointmentQuery = {}): Promise<Appointment[]> {
  return http.get<Appointment[]>(ENDPOINTS.APPOINTMENTS, { params: { ...q } })
}

export async function getAppointment(id: string): Promise<Appointment> {
  return http.get<Appointment>(withParams(ENDPOINTS.APPOINTMENT_DETAIL, { id }))
}

export async function createAppointment(input: AppointmentCreateInput): Promise<Appointment> {
  return http.post<Appointment>(ENDPOINTS.APPOINTMENT_CREATE, input)
}

export async function updateAppointment(
  id: string,
  input: Partial<AppointmentCreateInput>,
): Promise<Appointment> {
  return http.put<Appointment>(withParams(ENDPOINTS.APPOINTMENT_UPDATE, { id }), input)
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<Appointment> {
  switch (status) {
    case 'Cancelled':
      return http.post<Appointment>(withParams(ENDPOINTS.APPOINTMENT_CANCEL, { id }))
    case 'Confirmed':
      return http.post<Appointment>(withParams(ENDPOINTS.APPOINTMENT_CONFIRM, { id }))
    case 'Completed':
      return http.post<Appointment>(withParams(ENDPOINTS.APPOINTMENT_COMPLETE, { id }))
    default:
      return http.put<Appointment>(withParams(ENDPOINTS.APPOINTMENT_UPDATE, { id }), { status })
  }
}

export async function deleteAppointment(id: string): Promise<void> {
  await http.delete(withParams(ENDPOINTS.APPOINTMENT_DELETE, { id }))
}