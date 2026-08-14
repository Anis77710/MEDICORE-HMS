// ============================================================
// Medicore HMS — API client
// Thin fetch wrapper with Bearer auth, single-flight refresh
// (httpOnly cookie rotation) and auth-expiry signalling.
// ============================================================

import { ENDPOINTS } from './endpoints'

const TOKEN_KEY = 'medicore_token'
const HOSPITAL_KEY = 'medicore_hospital'

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status = 500, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

// The hospital slug routes every API call to that hospital's database
// (x-hospital-slug header). Set on login/registration; switching
// hospitals replaces this value.
export function setHospital(slug: string | null): void {
  if (slug) localStorage.setItem(HOSPITAL_KEY, slug)
  else localStorage.removeItem(HOSPITAL_KEY)
}

export function getHospital(): string | null {
  return localStorage.getItem(HOSPITAL_KEY)
}

let authExpiredHandler: (() => void) | null = null

export function setAuthExpiredHandler(handler: (() => void) | null): void {
  authExpiredHandler = handler
}

let refreshPromise: Promise<boolean> | null = null

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const hospital = getHospital()
        const res = await fetch(`${API_BASE_URL}${ENDPOINTS.AUTH_REFRESH}`, {
          method: 'POST',
          credentials: 'include',
          headers: hospital ? { 'x-hospital-slug': hospital } : {},
        })
        if (!res.ok) return false
        const body = (await res.json()) as { token?: string }
        if (!body.token) return false
        setToken(body.token)
        return true
      } catch {
        return false
      } finally {
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
  auth?: boolean
  signal?: AbortSignal
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const base = `${API_BASE_URL}${path}`
  if (!params) return base
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  return qs ? `${base}?${qs}` : base
}

async function doFetch(
  path: string,
  options: RequestOptions,
  headers: Record<string, string>,
): Promise<Response> {
  const { method = 'GET', body, params, signal } = options
  try {
    return await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      credentials: 'include',
    })
  } catch {
    throw new ApiError('Network error — cannot reach the API', 0)
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true } = options
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`
  const hospital = getHospital()
  if (hospital) headers['x-hospital-slug'] = hospital

  let response = await doFetch(path, options, headers)

  if (response.status === 401 && auth && token && (await refreshSession())) {
    headers.Authorization = `Bearer ${getToken()}`
    response = await doFetch(path, options, headers)
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const data = await response.json()
      message = data?.message ?? data?.error ?? message
    } catch {
      /* non-JSON error body */
    }
    if (response.status === 401 && auth) {
      setToken(null)
      authExpiredHandler?.()
    }
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return (await response.json()) as T
  return (await response.text()) as unknown as T
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
}
