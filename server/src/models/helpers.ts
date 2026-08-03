// Shared toJSON transform: exposes `id` instead of `_id` and removes internals,
// producing exactly the JSON contract the frontend consumes (see src/types).
export function jsonTransform<T extends Record<string, unknown>>(
  _doc: unknown,
  ret: T,
): Record<string, unknown> {
  const id = String(ret._id)
  delete ret._id
  delete ret.__v
  delete ret.passwordHash
  return { id, ...ret }
}

// Timestamped document helper for typed schemas.
export interface TimestampedDoc {
  createdAt: Date
  updatedAt: Date
}
