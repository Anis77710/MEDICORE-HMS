// ============================================================
// HealSync HMS — Appointments service
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http, USE_MOCK_API } from '../client'
import { mockDelay, toAppointment } from '../mock'
import { store } from '../store'
import type { Appointment, AppointmentCreateInput, AppointmentStatus } from '../../types'

export interface AppointmentQuery {
  status?: AppointmentStatus | 'All'
  date?: string
  search?: string
}

export async function listAppointments(q: AppointmentQuery = {}): Promise<Appointment[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    let list = [...store.appointments]
    if (q.status && q.status !== 'All') list = list.filter((a) => a.status === q.status)
    if (q.date) list = list.filter((a) => a.date === q.date)
    if (q.search) {
      const s = q.search.toLowerCase()
      list = list.filter(
        (a) =>
          a.patientName.toLowerCase().includes(s) ||
          a.doctorName.toLowerCase().includes(s) ||
          a.department.toLowerCase().includes(s),
      )
    }
    return list.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  }
  return http.get<Appointment[]>(ENDPOINTS.APPOINTMENTS, { params: { ...q } })
}

export async function getAppointment(id: string): Promise<Appointment> {
  if (USE_MOCK_API) {
    await mockDelay(300)
    const a = store.appointments.find((x) => x.id === id)
    if (!a) throw new Error('Appointment not found')
    return a
  }
  return http.get<Appointment>(withParams(ENDPOINTS.APPOINTMENT_DETAIL, { id }))
}

export async function createAppointment(input: AppointmentCreateInput): Promise<Appointment> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const appt = toAppointment(input)
    store.appointments.push(appt)
    return appt
  }
  return http.post<Appointment>(ENDPOINTS.APPOINTMENT_CREATE, input)
}

export async function updateAppointment(
  id: string,
  input: Partial<AppointmentCreateInput>,
): Promise<Appointment> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const idx = store.appointments.findIndex((x) => x.id === id)
    if (idx === -1) throw new Error('Appointment not found')
    store.appointments[idx] = { ...store.appointments[idx], ...input }
    return store.appointments[idx]
  }
  return http.put<Appointment>(withParams(ENDPOINTS.APPOINTMENT_UPDATE, { id }), input)
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<Appointment> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    const idx = store.appointments.findIndex((x) => x.id === id)
    if (idx === -1) throw new Error('Appointment not found')
    store.appointments[idx] = { ...store.appointments[idx], status }
    return store.appointments[idx]
  }
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
  if (USE_MOCK_API) {
    await mockDelay(400)
    store.appointments = store.appointments.filter((x) => x.id !== id)
    return
  }
  await http.delete(withParams(ENDPOINTS.APPOINTMENT_UPDATE, { id }))
}
