// ============================================================
// HealSync HMS — Patient Portal: appointment booking
// Booking, rescheduling, cancellation, history. Prevents
// double booking for the same doctor/date/time slot.
// ============================================================

import { ENDPOINTS, withParams } from '../../endpoints'
import { http, USE_MOCK_API } from '../../client'
import { mockDelay, toAppointment } from '../../mock'
import { store } from '../../store'
import type { Appointment, AppointmentType } from '../../../types'
import type { AppointmentPortalFields } from '../../../types/portal'

export interface BookAppointmentInput {
  doctorId: string
  type: AppointmentType
  date: string
  time: string
  durationMin: number
  reason: string
  mode?: 'In-person' | 'Video'
}

export interface RescheduleInput {
  date: string
  time: string
}

function assertNoConflict(doctorId: string, date: string, time: string, ignoreId?: string): void {
  const conflict = store.appointments.find(
    (a) =>
      a.doctorId === doctorId &&
      a.date === date &&
      a.time === time &&
      a.status !== 'Cancelled' &&
      a.id !== ignoreId,
  )
  if (conflict) {
    throw new Error('This time slot is already booked. Please choose another time.')
  }
}

export async function bookAppointment(
  patientId: string,
  input: BookAppointmentInput,
): Promise<Appointment & AppointmentPortalFields> {
  if (USE_MOCK_API) {
    await mockDelay(700)
    assertNoConflict(input.doctorId, input.date, input.time)
    const appt = toAppointment({
      patientId,
      doctorId: input.doctorId,
      type: input.type,
      date: input.date,
      time: input.time,
      durationMin: input.durationMin,
      reason: input.reason,
    })
    const video: Appointment & AppointmentPortalFields = {
      ...appt,
      mode: input.mode,
      meetingUrl: input.mode === 'Video' ? `https://meet.healsync.health/${appt.id}` : undefined,
    }
    store.appointments.push(video)
    return video
  }
  return http.post<Appointment & AppointmentPortalFields>(ENDPOINTS.PORTAL_APPOINTMENT_BOOK, {
    ...input,
    patientId,
  })
}

export async function rescheduleAppointment(
  id: string,
  input: RescheduleInput,
): Promise<Appointment & AppointmentPortalFields> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const idx = store.appointments.findIndex((a) => a.id === id)
    if (idx === -1) throw new Error('Appointment not found')
    const existing = store.appointments[idx]
    assertNoConflict(existing.doctorId, input.date, input.time, id)
    store.appointments[idx] = { ...existing, ...input, status: 'Pending' }
    return store.appointments[idx]
  }
  return http.post<Appointment & AppointmentPortalFields>(
    withParams(ENDPOINTS.PORTAL_APPOINTMENT_RESCHEDULE, { id }),
    input,
  )
}

export async function cancelAppointment(id: string): Promise<Appointment> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    const idx = store.appointments.findIndex((a) => a.id === id)
    if (idx === -1) throw new Error('Appointment not found')
    store.appointments[idx] = { ...store.appointments[idx], status: 'Cancelled' }
    return store.appointments[idx]
  }
  return http.post<Appointment>(withParams(ENDPOINTS.PORTAL_APPOINTMENT_CANCEL, { id }))
}

export interface MyAppointmentQuery {
  status?: 'All' | 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled'
}

export async function listMyAppointments(
  patientId: string,
  q: MyAppointmentQuery = {},
): Promise<(Appointment & AppointmentPortalFields)[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    let list = store.appointments.filter((a) => a.patientId === patientId)
    if (q.status && q.status !== 'All') list = list.filter((a) => a.status === q.status)
    return list.sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
  }
  return http.get<(Appointment & AppointmentPortalFields)[]>(ENDPOINTS.PORTAL_APPOINTMENTS, {
    params: { ...q },
  })
}

export async function getMyAppointment(id: string): Promise<Appointment & AppointmentPortalFields> {
  if (USE_MOCK_API) {
    await mockDelay(250)
    const a = store.appointments.find((x) => x.id === id)
    if (!a) throw new Error('Appointment not found')
    return a
  }
  return http.get<Appointment & AppointmentPortalFields>(
    withParams(ENDPOINTS.PORTAL_APPOINTMENT_DETAIL, { id }),
  )
}
