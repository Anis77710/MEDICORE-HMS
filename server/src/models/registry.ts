// ============================================================
// Tenant-aware model registry.
//
// Every model in this app is exported as a *proxy* (see proxyModel
// below). Proxies resolve the real Mongoose model from whichever
// connection is active for the current request (AsyncLocalStorage),
// so one server process can serve many hospitals, each backed by
// its own MongoDB database. Outside a request context (scripts,
// seed, tests) the default connection is used, preserving the
// original single-hospital behaviour.
// ============================================================

import { AsyncLocalStorage } from 'node:async_hooks'
import mongoose, { type Connection, type Model, type Schema } from 'mongoose'

export const DEFAULT_SLUG = 'medicore'

export interface TenantContext {
  conn: Connection
  slug: string
}

const context = new AsyncLocalStorage<TenantContext>()

export function runWithTenant<T>(conn: Connection, slug: string, fn: () => Promise<T> | T): Promise<T> {
  return Promise.resolve().then(() => context.run({ conn, slug }, fn))
}

export function currentContext(): TenantContext {
  return context.getStore() ?? { conn: mongoose.connection, slug: DEFAULT_SLUG }
}

/** Run `fn` inside a tenant context; resolves the return value. */
export function withTenant<T>(conn: Connection, slug: string, fn: () => Promise<T> | T): Promise<T> {
  return runWithTenant(conn, slug, fn)
}

// ------------------------------------------------------------
// Schema registry — model files call registerSchema() at module
// load so any connection can compile the schemas on demand
// (avoids circular imports between models and this module).
// ------------------------------------------------------------

const schemaMap = new Map<string, Schema>()

export function registerSchema(name: string, schema: Schema): void {
  schemaMap.set(name, schema)
}

function ensureModel(conn: Connection, name: string): Model<unknown> {
  let m: Model<unknown> | undefined
  try {
    m = conn.model(name) as Model<unknown>
  } catch {
    m = undefined
  }
  if (!m) {
    const schema = schemaMap.get(name)
    if (!schema) {
      throw new Error(`Schema "${name}" has not been registered on any model`)
    }
    m = conn.model(name, schema) as Model<unknown>
  }
  return m
}

// ------------------------------------------------------------
// Proxy model — forwards every property access to the model
// compiled on the connection that is active for this request.
// ------------------------------------------------------------

const FUNCTION_PROPS = new Set(['then', 'catch', 'finally'])

export function proxyModel<T>(name: string): Model<T> {
  return new Proxy({} as Model<T>, {
    get(_target, prop: string | symbol, _receiver) {
      if (prop === Symbol.toStringTag) return 'Model'
      if (typeof prop === 'symbol') return undefined
      if (FUNCTION_PROPS.has(prop)) return undefined
      const m = ensureModel(currentContext().conn, name)
      const value = (m as unknown as Record<string, unknown>)[prop]
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(m) : value
    },
    set() {
      return false
    },
  })
}
