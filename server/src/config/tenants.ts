// ============================================================
// Hospital tenants - one MongoDB database per hospital.
//
// The server keeps its default connection (the MONGO_URI database,
// which acts as the first/default hospital) plus one lazily-created
// mongoose connection per registered hospital database. A small
// registry collection ("medicore_registry" on the same cluster)
// maps a hospital slug -> database name so any API call can resolve
// which database it belongs to (via the x-hospital-slug header,
// a subdomain, or the registration/login flows).
// ============================================================

import mongoose, { Schema, type Connection, type Model } from 'mongoose'
import { jsonTransform } from '../models/helpers.js'
import { DEFAULT_SLUG } from '../models/registry.js'
import { env } from './env.js'

export const REGISTRY_DB = 'medicore_registry'
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,49}$/

// ------------------------------------------------------------
// Database naming / URI helpers
// ------------------------------------------------------------

/** Replaces the database name in a Mongo URI with the given one. */
export function tenantUri(dbName: string): string {
  const uri = env.MONGO_URI
  const qIndex = uri.indexOf('?')
  const query = qIndex === -1 ? '' : uri.slice(qIndex)
  const base = qIndex === -1 ? uri : uri.slice(0, qIndex)
  const slash = base.lastIndexOf('/')
  return `${base.slice(0, slash + 1)}${dbName}${query}`
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

export function dbNameFor(slug: string): string {
  return `medicore_${slug}`
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug)
}

// ------------------------------------------------------------
// Hospital code + login domain
//
// Every hospital has a short login code (e.g. "MH") that prefixes
// staff login usernames, and a login email domain (e.g.
// "medicore.hms") used for the synthetic usernames. Both live on
// the registry record - never hardcoded per-request.
// ------------------------------------------------------------

export const DEFAULT_HOSPITAL_CODE = 'MH'
export const DEFAULT_LOGIN_DOMAIN = 'medicore.hms'

/** Username domain for a hospital whose record predates loginDomain. */
export function defaultLoginDomain(slug: string): string {
  return `${slug.replace(/[^a-z0-9]/g, '')}.hms`
}

/** Short login code derived from a hospital name (e.g. "Medicore Hospital" -> "MH"). */
export function deriveHospitalCode(name: string): string {
  const words = name
    .replace(/[^a-z0-9 ]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return 'H'
  const significant = words.filter(
    (w) => !['hospital', 'the', 'and', 'of', 'general', 'city', 'national'].includes(w.toLowerCase()),
  )
  const src = significant.length > 0 ? significant : words
  let code = src.map((w) => w[0]).join('').toUpperCase()
  if (code.length < 2) code = (src[0] ?? 'H').slice(0, 2).toUpperCase()
  return code.slice(0, 4)
}

// ------------------------------------------------------------
// Registry collection - which hospitals exist
// ------------------------------------------------------------

export interface HospitalRecord {
  slug: string
  dbName: string
  name: string
  code?: string
  loginDomain?: string
  adminEmail: string
  status: 'active' | 'suspended'
  listed?: boolean
  displayOrder?: number
  createdAt?: Date
  updatedAt?: Date
}

const hospitalSchema = new Schema<HospitalRecord>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    dbName: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    loginDomain: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    adminEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    listed: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { transform: jsonTransform }, toObject: { transform: jsonTransform } },
)

let registryConn: Connection | null = null
let registryModel: Model<HospitalRecord> | null = null

export function registryConnection(): Connection {
  if (!registryConn) {
    registryConn = mongoose.createConnection(tenantUri(REGISTRY_DB))
    registryModel = registryConn.model('Hospital', hospitalSchema)
  }
  return registryConn
}

export function hospitalRegistry(): Model<HospitalRecord> {
  if (!registryModel) registryConnection()
  return registryModel!
}

// In-memory cache of registered slugs (avoids a registry query per request).
// Every hospital is cached - including suspended ones, so those requests can
// be rejected with a clear 403 instead of a confusing "not found".
const slugCache = new Map<string, HospitalRecord>()

export async function loadRegistry(): Promise<void> {
  const docs = await hospitalRegistry().find({}).lean()
  slugCache.clear()
  for (const d of docs) slugCache.set(d.slug, d)
}

export async function ensureRegistryLoaded(): Promise<void> {
  if (slugCache.size === 0) await loadRegistry()
}

export function cachedHospital(slug: string): HospitalRecord | undefined {
  return slugCache.get(slug)
}

export async function updateHospitalRegistry(
  slug: string,
  patch: Partial<Pick<HospitalRecord, 'name' | 'adminEmail' | 'status' | 'listed' | 'code' | 'loginDomain'>>,
): Promise<HospitalRecord | null> {
  const doc = await hospitalRegistry().findOneAndUpdate(
    { slug },
    { $set: patch },
    { new: true },
  )
  if (doc) slugCache.set(slug, doc.toObject())
  return doc ? doc.toObject() : null
}

export async function findHospitalByAdminEmail(email: string): Promise<HospitalRecord[]> {
  await ensureRegistryLoaded()
  const lower = email.toLowerCase()
  const docs = await hospitalRegistry().find({ adminEmail: lower }).lean()
  if (docs.length > 0) {
    for (const d of docs) slugCache.set(d.slug, d)
  }
  return docs
}

/** The login code (e.g. "MH") for a hospital, from its registry record. */
export function hospitalCode(slug: string): string {
  const rec = cachedHospital(slug)
  return (rec?.code || (slug === DEFAULT_SLUG ? DEFAULT_HOSPITAL_CODE : '')).toUpperCase()
}

/** The login email domain (e.g. "medicore.hms") for a hospital. */
export function hospitalLoginDomain(slug: string): string {
  const rec = cachedHospital(slug)
  return rec?.loginDomain || (slug === DEFAULT_SLUG ? DEFAULT_LOGIN_DOMAIN : defaultLoginDomain(slug))
}

export async function registerTenant(
  slug: string,
  name: string,
  adminEmail: string,
  opts: { code?: string; loginDomain?: string } = {},
): Promise<HospitalRecord> {
  const dbName = dbNameFor(slug)
  const doc = await hospitalRegistry().create({
    slug,
    dbName,
    name,
    adminEmail,
    code: opts.code,
    loginDomain: opts.loginDomain,
    listed: true,
  })
  slugCache.set(slug, doc.toObject())
  return doc.toObject()
}

/**
 * One-time migration: registers the pre-existing default hospital
 * (the MONGO_URI database) in the registry so its admin can be found
 * by email from any hospital context. New registrations always create
 * their own registry entry, so this only runs for legacy databases.
 */
export async function syncDefaultTenantToRegistry(): Promise<void> {
  try {
    if (await hospitalRegistry().findOne({ slug: DEFAULT_SLUG })) return
    const uri = env.MONGO_URI
    const base = uri.includes('?') ? uri.slice(0, uri.indexOf('?')) : uri
    const dbName = decodeURIComponent(base.slice(base.lastIndexOf('/') + 1)) || 'test'
    const [settings, admin] = await Promise.all([
      mongoose.connection
        .collection('hospitalsettings')
        .findOne({ _id: 'hospital' } as never),
      mongoose.connection.collection('users').findOne({ role: 'ADMIN' }),
    ])
    if (!admin) return
    await hospitalRegistry().create({
      slug: DEFAULT_SLUG,
      dbName,
      name: (settings?.name as string | undefined) ?? 'Medicore Hospital',
      code: DEFAULT_HOSPITAL_CODE,
      loginDomain: DEFAULT_LOGIN_DOMAIN,
      adminEmail: String(admin.email ?? '').toLowerCase(),
      status: 'active',
    })
  } catch {
    // Registry unavailable (e.g. fresh cluster) - non-fatal at boot.
  }
  await loadRegistry()
}

export async function unregisterTenant(slug: string): Promise<void> {
  await hospitalRegistry().deleteOne({ slug })
  slugCache.delete(slug)
}

// ------------------------------------------------------------
// Per-tenant connections
// ------------------------------------------------------------

const tenantConnections = new Map<string, Connection>()

/** Returns the mongoose connection for a hospital slug (cached). */
export function getTenantConnection(slug: string): Connection {
  if (slug === DEFAULT_SLUG) return mongoose.connection
  let conn = tenantConnections.get(slug)
  if (!conn) {
    const dbName = cachedHospital(slug)?.dbName ?? dbNameFor(slug)
    conn = mongoose.createConnection(tenantUri(dbName))
    tenantConnections.set(slug, conn)
  }
  return conn
}

// ------------------------------------------------------------
// Request resolution
// ------------------------------------------------------------

export interface HospitalInfo {
  slug: string
  name: string
}

const HOSPITAL_HEADER = 'x-hospital-slug'

/**
 * Resolves the hospital for an incoming request.
 * Priority: explicit `hospital` body field (login/register) ->
 * x-hospital-slug header -> subdomain (when HOSPITAL_DOMAIN is set) ->
 * default hospital (the MONGO_URI database).
 */
export async function resolveHospitalSlug(
  req: { headers: Record<string, unknown>; body?: { hospital?: unknown } },
): Promise<HospitalInfo> {
  await ensureRegistryLoaded()

  const explicit = typeof req.body?.hospital === 'string' ? req.body.hospital.trim() : ''
  if (explicit) {
    if (!isValidSlug(explicit)) throw new Error('Invalid hospital code')
    const rec = cachedHospital(explicit)
    if (!rec) throw new Error('Hospital not found - check the hospital code')
    return { slug: explicit, name: rec.name }
  }

  const header = (req.headers[HOSPITAL_HEADER] ?? req.headers[HOSPITAL_HEADER.toUpperCase()]) as
    | string
    | undefined
  if (header && header.trim()) {
    const slug = header.trim().toLowerCase()
    if (!isValidSlug(slug)) throw new Error('Invalid hospital code')
    if (slug !== DEFAULT_SLUG) {
      const rec = cachedHospital(slug)
      if (!rec) throw new Error('Hospital not found - check the hospital code')
      return { slug, name: rec.name }
    }
  }

  const host = (req.headers.host ?? '') as string
  const domain = env.HOSPITAL_DOMAIN
  if (domain && host.endsWith(domain)) {
    const sub = host.slice(0, -domain.length).replace(/\.$/, '').split('.')[0]
    if (sub && isValidSlug(sub)) {
      const rec = cachedHospital(sub)
      if (rec) return { slug: sub, name: rec.name }
    }
  }

  return { slug: DEFAULT_SLUG, name: '' }
}
