// Shared helpers for the Doctor Portal pages.

export function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fmtTime(hhmm: string): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  if (h === undefined || Number.isNaN(h)) return hhmm
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m ?? 0).padStart(2, '0')} ${period}`
}

export function fmtDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ageFromDob(dob: string): number | null {
  if (!dob) return null
  const t = Date.now() - new Date(dob).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor(t / (365.25 * 24 * 3600 * 1000))
}

export function calcBmi(weightKg?: number | null, heightCm?: number | null): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10
}
