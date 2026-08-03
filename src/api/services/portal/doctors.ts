// ============================================================
// HealSync HMS — Patient Portal: doctor directory + availability
// ============================================================

import { ENDPOINTS, withParams } from '../../endpoints'
import { http, USE_MOCK_API } from '../../client'
import { mockDelay } from '../../mock'
import { store } from '../../store'
import { mockDoctorExtras } from '../../mockPortal'
import type { Doctor } from '../../../types'
import type { DoctorAvailability, DoctorPortalFields, TimeSlot } from '../../../types/portal'

export interface PortalDoctorQuery {
  search?: string
  department?: string
  minRating?: number
  minExperience?: number
  availableOnly?: boolean
}

export interface PortalDoctor extends Doctor, DoctorPortalFields {}

function decorate(d: Doctor): PortalDoctor {
  const extra = mockDoctorExtras[d.id]
  return {
    ...d,
    bio: extra?.bio ?? `${d.name} specializes in ${d.specialty} with ${d.experienceYears} years of experience.`,
    languages: extra?.languages ?? ['English'],
    ratingCount: extra?.ratingCount ?? 40,
  }
}

export async function listPortalDoctors(q: PortalDoctorQuery = {}): Promise<PortalDoctor[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    let list = [...store.doctors]
    if (q.search) {
      const s = q.search.toLowerCase()
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(s) ||
          d.specialty.toLowerCase().includes(s) ||
          d.department.toLowerCase().includes(s) ||
          d.qualification.toLowerCase().includes(s),
      )
    }
    if (q.department) list = list.filter((d) => d.department === q.department)
    if (q.minRating) list = list.filter((d) => d.rating >= (q.minRating ?? 0))
    if (q.minExperience) list = list.filter((d) => d.experienceYears >= (q.minExperience ?? 0))
    if (q.availableOnly) list = list.filter((d) => d.status === 'Active')
    return list.map(decorate).sort((a, b) => b.rating - a.rating)
  }
  return http.get<PortalDoctor[]>(ENDPOINTS.PORTAL_DOCTORS, { params: { ...q } })
}

export async function getPortalDoctor(id: string): Promise<PortalDoctor> {
  if (USE_MOCK_API) {
    await mockDelay(300)
    const d = store.doctors.find((x) => x.id === id)
    if (!d) throw new Error('Doctor not found')
    return decorate(d)
  }
  return http.get<PortalDoctor>(withParams(ENDPOINTS.PORTAL_DOCTOR_DETAIL, { id }))
}

const WEEKDAY_MAP: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 0,
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

export async function getDoctorAvailability(
  doctorId: string,
  days = 14,
): Promise<DoctorAvailability[]> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    const doctor = store.doctors.find((d) => d.id === doctorId)
    if (!doctor) throw new Error('Doctor not found')
    const workingDays = new Set(doctor.schedule.map((d) => WEEKDAY_MAP[d]))
    const booked = store.appointments.filter(
      (a) => a.doctorId === doctorId && a.status !== 'Cancelled',
    )
    const result: DoctorAvailability[] = []
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    for (let i = 0; i < days; i++) {
      const day = addDays(start, i)
      if (!workingDays.has(day.getDay())) continue
      const slots: TimeSlot[] = []
      for (let h = 9; h < 17; h++) {
        for (const m of [0, 30]) {
          const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
          const taken = booked.some((b) => b.date === fmtDate(day) && b.time === time)
          const past = day.getTime() < Date.now()
          slots.push({ time, available: !taken && !past })
        }
      }
      result.push({ date: fmtDate(day), day: fmtDay(day), slots })
    }
    return result
  }
  return http.get<DoctorAvailability[]>(
    withParams(ENDPOINTS.PORTAL_DOCTOR_AVAILABILITY, { id: doctorId }),
    { params: { days } },
  )
}
