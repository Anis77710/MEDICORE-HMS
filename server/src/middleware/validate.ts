import type { Request, Response, NextFunction } from 'express'
import type { ZodType, ZodTypeDef } from 'zod'
import { ApiError } from '../utils/ApiError.js'

export interface ValidationSchemas {
  body?: ZodType<unknown, ZodTypeDef, unknown>
  query?: ZodType<unknown, ZodTypeDef, unknown>
  params?: ZodType<unknown, ZodTypeDef, unknown>
}

// Express 5 exposes `req.query` as a read-only getter on the request prototype,
// so it cannot be assigned. Parsed queries are cached here instead.
const parsedQuery = new WeakMap<Request, Record<string, unknown>>()

export function queryOf<T>(req: Request): T {
  return (parsedQuery.get(req) ?? {}) as T
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {})
      if (schemas.query) parsedQuery.set(req, schemas.query.parse(req.query) as Record<string, unknown>)
      if (schemas.params) req.params = schemas.params.parse(req.params) as Request['params']
      next()
    } catch (err) {
      if (err instanceof Error && 'issues' in err) {
        const issues = (err as { issues: { path: string[]; message: string }[] }).issues
        const message = issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
        next(new ApiError(`Invalid input — ${message}`, 400, issues))
        return
      }
      next(new ApiError('Invalid input', 400))
    }
  }
}
