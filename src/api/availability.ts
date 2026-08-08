import type { Appointment, Doctor, AvailabilitySlot } from '../types'

// ============================================================
// Client-side mirror of the server's centralized slot rules
// (server/src/domain/availability.ts). Used only by the mock API
// so the demo behaves identically to the real backend.
// Work day: 09:00–17:00, 30-minute slots.
// ============================================================

export const WORK_START_MIN = 9 * 60
export const WORK_END_MIN = 17 * 60
export const SLOT_MIN = 30

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function dayOfWeek(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  return DAY_NAMES[d.getDay()] ?? ''
}

export function isWorkingDay(doctor: Pick<Doctor, 'status' | 'schedule'>, date: string): boolean {
  if (doctor.status !== 'Active') return false
  return doctor.schedule.includes(dayOfWeek(date))
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function bookedRanges(
  appointments: Pick<Appointment, 'id' | 'date' | 'time' | 'durationMin' | 'status'>[],
  date: string,
  excludeId?: string,
): { startMin: number; endMin: number }[] {
  return appointments
    .filter((a) => a.id !== excludeId && a.date === date && a.status !== 'Cancelled')
    .map((a) => ({
      startMin: timeToMinutes(a.time),
      endMin: timeToMinutes(a.time) + (a.durationMin || SLOT_MIN),
    }))
    .sort((a, b) => a.startMin - b.startMin)
}

export function getAvailabilitySlots(
  doctor: Pick<Doctor, 'status' | 'schedule'>,
  appointments: Appointment[],
  date: string,
  options: { excludeId?: string; requireDuration?: number } = {},
): AvailabilitySlot[] {
  const { excludeId, requireDuration = SLOT_MIN } = options
  const busy = bookedRanges(appointments, date, excludeId)
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
