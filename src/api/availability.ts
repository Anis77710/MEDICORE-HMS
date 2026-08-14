import type { Doctor } from '../types'

// ============================================================
// Shared working-day helpers (UI mirror of the server's rules
// in server/src/domain/availability.ts).
// ============================================================

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function dayOfWeek(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  return DAY_NAMES[d.getDay()] ?? ''
}

export function isWorkingDay(doctor: Pick<Doctor, 'status' | 'schedule'>, date: string): boolean {
  if (doctor.status !== 'Active') return false
  return doctor.schedule.includes(dayOfWeek(date))
}