// ============================================================
// Hospital tenant middleware.
// Resolves which hospital a request belongs to (header, subdomain
// or the default hospital) and runs the rest of the request inside
// that hospital's database context (see models/registry.ts).
// ============================================================

import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../utils/ApiError.js'
import {
  resolveHospitalSlug,
  getTenantConnection,
  cachedHospital,
  type HospitalInfo,
} from '../config/tenants.js'
import { runWithTenant } from '../models/registry.js'

export interface HospitalRequest extends Request {
  hospital: HospitalInfo
}

export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  resolveHospitalSlug(req)
    .then((hospital) => {
      const rec = cachedHospital(hospital.slug)
      if (rec && rec.status === 'suspended') {
        throw new ApiError(
          'This hospital has been suspended — contact the platform administrator',
          403,
        )
      }
      const authed = req as HospitalRequest
      authed.hospital = hospital
      const conn = getTenantConnection(hospital.slug)
      runWithTenant(conn, hospital.slug, () => next())
    })
    .catch((err: unknown) => {
      if (err instanceof ApiError) {
        next(err)
        return
      }
      next(new ApiError(err instanceof Error ? err.message : 'Hospital resolution failed', 404))
    })
}

export function hospitalOf(req: Request): HospitalInfo {
  return (req as HospitalRequest).hospital ?? { slug: 'medicore', name: '' }
}
