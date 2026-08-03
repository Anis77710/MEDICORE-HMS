import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../utils/ApiError.js'

export function requireErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ message: err.message, details: err.details })
    return
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ message: 'Malformed JSON body' })
    return
  }
  console.error('[unhandled]', err)
  res.status(500).json({ message: 'Internal server error' })
}
