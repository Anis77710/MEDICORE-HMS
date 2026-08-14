import { createHmac, randomUUID } from 'node:crypto'
import { env } from '../config/env.js'

// ============================================================
// eSewa payment integration — v2 form API.
// The browser posts the hidden form to the eSewa payment page;
// after the payment eSewa redirects the browser (GET) back to
// our success/failure URL with `data` and `signature` query
// params — `data` is a JSON string (Base64-encoded) signed with
// base64 HMAC-SHA256 over the fields listed in
// data.signed_field_names (in that exact order, as "key=value"
// pairs joined by commas). A form POST with the same fields is
// also accepted.
// Docs: https://developer.esewa.com.np
// ============================================================

export const ESEWA_FORM_URL = {
  test: 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
  live: 'https://epay.esewa.com.np/api/epay/main/v2/form',
} as const

export const ESEWA_STATUS_URL = {
  test: 'https://rc.esewa.com.np/api/epay/transaction/status',
  live: 'https://esewa.com.np/api/epay/transaction/status',
} as const

export function esewaConfigured(): boolean {
  return Boolean(env.ESEWA_PRODUCT_CODE && env.ESEWA_SECRET_KEY)
}

export function newTransactionUuid(): string {
  return randomUUID()
}

/** Base64 HMAC-SHA256 over "k=v,k=v" for the given fields, in `order`. */
export function signEsewa(
  fields: Record<string, string>,
  order: readonly string[],
  secret: string,
): string {
  const message = order.map((key) => `${key}=${fields[key] ?? ''}`).join(',')
  return createHmac('sha256', secret).update(message).digest('base64')
}

/** Hidden-form fields posted to the eSewa payment page (v2 form API). */
export function buildPaymentFields(opts: {
  totalAmount: number
  transactionUuid: string
  successUrl: string
  failureUrl: string
}): { fields: Record<string, string>; signature: string; formUrl: string } {
  const signedFields = {
    total_amount: String(opts.totalAmount),
    transaction_uuid: opts.transactionUuid,
    product_code: env.ESEWA_PRODUCT_CODE,
  }
  const fields: Record<string, string> = {
    ...signedFields,
    amount: String(opts.totalAmount),
    tax_amount: '0',
    product_service_charge: '0',
    product_delivery_charge: '0',
    success_url: opts.successUrl,
    failure_url: opts.failureUrl,
    signed_field_names: 'total_amount,transaction_uuid,product_code',
  }
  return {
    fields,
    signature: signEsewa(signedFields, ['total_amount', 'transaction_uuid', 'product_code'], env.ESEWA_SECRET_KEY),
    formUrl: ESEWA_FORM_URL[env.ESEWA_ENV],
  }
}

export interface EsewaCallbackData {
  transaction_code?: string
  status?: string
  total_amount?: string
  transaction_uuid?: string
  product_code?: string
  signed_field_names?: string
  signature?: string
  [key: string]: string | undefined
}

// eSewa redirects back to the success/failure URL with `data` (the callback
// body Base64-encoded per the docs "response parameters encoded in Base64")
// and `signature` as query params. Accept the raw JSON form as well.
function decodeCallbackData(payload: string): unknown {
  try {
    return JSON.parse(payload)
  } catch {
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
  }
}

/**
 * Verifies the callback from eSewa and returns the parsed fields, or null
 * when the signature does not match (or the payload is malformed). The
 * `signature` POSTed alongside `data` is preferred; when eSewa embeds it
 * inside the data body instead, that one is used. Numeric field values
 * (e.g. total_amount: 1000.0) are coerced to strings, matching how eSewa
 * signs them. Never trust the callback otherwise.
 */
export function verifyEsewaCallback(
  dataPayload: string,
  signature?: string,
): EsewaCallbackData | null {
  let data: Record<string, string>
  try {
    const parsed = decodeCallbackData(dataPayload)
    if (!parsed || typeof parsed !== 'object') return null
    data = Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(
          ([, v]) =>
            v !== null && v !== undefined && (typeof v === 'string' || typeof v === 'number'),
        )
        .map(([k, v]) => [k, String(v)]),
    )
  } catch {
    return null
  }
  const order = (data.signed_field_names ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (order.length === 0) return null
  const posted = signature || data.signature
  if (!posted) return null
  if (signEsewa(data, order, env.ESEWA_SECRET_KEY) !== posted) return null
  return data
}

/**
 * Extracts the transaction_uuid from a callback payload WITHOUT verifying the
 * signature — used only to reconcile against eSewa's transaction status API,
 * which is the authoritative record of whether the money actually moved.
 */
export function extractCallbackUuid(dataPayload: string): string | undefined {
  try {
    const parsed = decodeCallbackData(dataPayload)
    if (!parsed || typeof parsed !== 'object') return undefined
    const uuid = (parsed as Record<string, unknown>).transaction_uuid
    return typeof uuid === 'string' && uuid.length > 0 ? uuid : undefined
  } catch {
    return undefined
  }
}

/** Queries eSewa for the final status of a transaction (not signature-signed). */
export async function checkEsewaStatus(
  transactionUuid: string,
  totalAmount: number,
): Promise<{ status?: string; ref_id?: string | null; transaction_code?: string }> {
  const url = new URL(ESEWA_STATUS_URL[env.ESEWA_ENV])
  url.searchParams.set('product_code', env.ESEWA_PRODUCT_CODE)
  url.searchParams.set('total_amount', String(totalAmount))
  url.searchParams.set('transaction_uuid', transactionUuid)
  const res = await fetch(url)
  if (!res.ok) return {}
  return (await res.json()) as { status?: string; ref_id?: string | null; transaction_code?: string }
}
