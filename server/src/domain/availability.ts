import type { Doctor } from '../models/Doctor.js'
import type { Appointment } from '../models/Appointment.js'

// ============================================================
// Centralized scheduling rules — single source of truth for
// working hours, slot generation and conflict detection.
// Used by the public booking flow, admin calendar and the
// doctor portal schedule. Work day: 09:00–17:00, 30-min slots.
// ============================================================

export const WORK_START_MIN = 9 * 60
export const WORK_END_MIN = 17 * 60
export const SLOT_MIN = 30

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export interface AppointmentLike {
  date: string
  time: string
  durationMin: number
  status?: string
}

export interface TimeRange {
  startMin: number
  endMin: number
}

export interface AvailabilitySlot {
  time: string
  end: string
  available: boolean
  conflict?: string
}

export function dayOfWeek(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  return DAY_NAMES[d.getDay()] ?? ''
}

const DAY_FULL: Record<string, string> = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
}

export function dayFullName(date: string): string {
  return DAY_FULL[dayOfWeek(date)] ?? dayOfWeek(date)
}

export function isWorkingDay(doctor: Pick<Doctor, 'schedule' | 'status'>, date: string): boolean {
  if (doctor.status !== 'Active') return false
  return doctor.schedule.includes(dayOfWeek(date))
}

/** Local-time YYYY-MM-DD for a Date. */
export function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** True when a proposed booking date/time has already passed (includes today's elapsed slots). */
export function isPastSlot(date: string, startTime: string): boolean {
  const today = toIsoDate(new Date())
  if (date < today) return true
  if (date > today) return false
  const now = new Date()
  return timeToMinutes(startTime) <= now.getHours() * 60 + now.getMinutes()
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Booked (non-cancelled) time ranges for one doctor on one date. */
export function bookedRanges(appointments: AppointmentLike[], date: string): TimeRange[] {
  return appointments
    .filter((a) => a.date === date && a.status !== 'Cancelled')
    .map((a) => ({
      startMin: timeToMinutes(a.time),
      endMin: timeToMinutes(a.time) + (a.durationMin || SLOT_MIN),
    }))
    .sort((a, b) => a.startMin - b.startMin)
}

/**
 * Builds 09:00–17:00 slots for a doctor on a date.
 * `busy` is a list of { startMin, endMin } ranges to exclude
 * (from appointments — pass `excludeId` to skip one, e.g. when
 * rescheduling). When `requireDuration` is set, a slot is only
 * marked available if a block of that length is free.
 */
export function getAvailabilitySlots(
  doctor: Doctor,
  appointments: AppointmentLike[],
  date: string,
  options: { excludeId?: string; requireDuration?: number } = {},
): AvailabilitySlot[] {
  const { excludeId, requireDuration = SLOT_MIN } = options
  const busy = bookedRanges(
    appointments.filter((a) => (a as Appointment & { id?: string }).id !== excludeId),
    date,
  )
  const slots: AvailabilitySlot[] = []
  for (let start = WORK_START_MIN; start < WORK_END_MIN; start += SLOT_MIN) {
    const end = start + requireDuration
    const conflict = busy.find((b) => start < b.endMin && end > b.startMin)
    slots.push({
      time: minutesToTime(start),
      end: minutesToTime(start + SLOT_MIN),
      available: !conflict && isWorkingDay(doctor, date),
      conflict: conflict
        ? `Conflicts with ${minutesToTime(conflict.startMin)}–${minutesToTime(conflict.endMin)}`
        : undefined,
    })
  }
  return slots
}

/** True when a proposed appointment time does not clash with existing ones. */
export function isSlotFree(
  appointments: AppointmentLike[],
  date: string,
  startTime: string,
  durationMin: number,
  excludeId?: string,
): boolean {
  const start = timeToMinutes(startTime)
  const end = start + (durationMin || SLOT_MIN)
  return !bookedRanges(
    appointments.filter((a) => (a as Appointment & { id?: string }).id !== excludeId),
    date,
  ).some((b) => start < b.endMin && end > b.startMin)
}
