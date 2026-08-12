// ============================================================
// Medicore HMS — master admin API client
// A minimal fetch wrapper for the platform panel. Uses its own
// bearer token (medicore_master_token) and deliberately does NOT
// send the x-hospital-slug header — master routes are platform
// level, not tied to any single hospital.
// ============================================================

import { ENDPOINTS } from './endpoints'
import { ApiError, API_BASE_URL } from './client'

const MASTER_TOKEN_KEY = 'medicore_master_token'

export function getMasterToken(): string | null {
  return localStorage.getItem(MASTER_TOKEN_KEY)
}

export function setMasterToken(token: string | null): void {
  if (token) localStorage.setItem(MASTER_TOKEN_KEY, token)
  else localStorage.removeItem(MASTER_TOKEN_KEY)
}

export interface MasterRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
}

function buildUrl(path: string, params?: MasterRequestOptions['params']): string {
  const base = `${API_BASE_URL}${path}`
  if (!params) return base
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  return qs ? `${base}?${qs}` : base
}

export async function masterRequest<T>(
  path: string,
  options: MasterRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, params } = options
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getMasterToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Network error — cannot reach the API', 0)
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const data = await response.json()
      message = data?.message ?? data?.error ?? message
    } catch {
      /* non-JSON error body */
    }
    if (response.status === 401) setMasterToken(null)
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return (await response.json()) as T
  return (await response.text()) as unknown as T
}

export const masterHttp = {
  get: <T>(path: string, options?: MasterRequestOptions) => masterRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: MasterRequestOptions) =>
    masterRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: MasterRequestOptions) =>
    masterRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: MasterRequestOptions) =>
    masterRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown, options?: MasterRequestOptions) =>
    masterRequest<T>(path, { ...options, method: 'DELETE', body }),
}

// Re-exports the endpoints so the master pages can build URLs.
export { ENDPOINTS }
export { withParams } from './endpoints'
