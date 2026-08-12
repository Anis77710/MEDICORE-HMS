import { Schema } from 'mongoose'
import { registerSchema, proxyModel } from './registry.js'

// Sequential counters for human-friendly identifiers.
// A single per-day counter per kind keeps IDs readable and collision-free:
//   e.g. prescription "Maria-2026-8-8-1", "Maria-2026-8-8-2", ...
export interface Counter {
  _id: string
  seq: number
}

const counterSchema = new Schema<Counter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
})

registerSchema('Counter', counterSchema)
export const CounterModel = proxyModel<Counter>('Counter')

// Non-padded date tag, e.g. "2026-8-8" for August 8, 2026.
export function dateTag(d: Date = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

// Parse a YYYY-MM-DD string into a local Date (noon avoids TZ edge cases).
export function parseDay(day: string): Date {
  return new Date(`${day}T12:00:00`)
}

// Generates a readable ID like "<FirstName>-<date>-<seq>" where <seq>
// counts up from 1 within the given day, independently per kind.
// The counter key embeds the date, so each day restarts at 1.
export async function makeReadableId(
  kind: string,
  firstName: string,
  date: Date = new Date(),
): Promise<string> {
  const key = `${kind}-${dateTag(date)}`
  const doc = await CounterModel.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  )
  const name = firstName.trim().replace(/\s+/g, '')
  return `${name}-${dateTag(date)}-${doc!.seq}`
}
