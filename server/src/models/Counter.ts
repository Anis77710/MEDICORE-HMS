import { Schema, model } from 'mongoose'

// Sequential counters for human-friendly identifiers (P-10433, INV-2026-1004, …).
export interface Counter {
  _id: string
  seq: number
}

const counterSchema = new Schema<Counter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
})

export const CounterModel = model<Counter>('Counter', counterSchema)

export async function nextSequence(name: string): Promise<number> {
  const doc = await CounterModel.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  )
  return doc!.seq
}
