// ============================================================
// HealSync HMS — Billing service
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http } from '../client'
import type { Invoice, PaymentRecord } from '../../types'

export interface InvoiceInput {
  patientId: string
  description: string
  items: { description: string; amount: number }[]
  discount: number
  dueDate: string
}

export async function listInvoices(q: { search?: string; status?: string } = {}): Promise<Invoice[]> {
  return http.get<Invoice[]>(ENDPOINTS.INVOICES, { params: { ...q } })
}

export async function getInvoice(id: string): Promise<Invoice> {
  return http.get<Invoice>(withParams(ENDPOINTS.INVOICE_DETAIL, { id }))
}

export async function createInvoice(input: InvoiceInput): Promise<Invoice> {
  return http.post<Invoice>(ENDPOINTS.INVOICE_CREATE, input)
}

export async function recordPayment(input: {
  invoiceId: string
  amount: number
  method: PaymentRecord['method']
}): Promise<{ invoice: Invoice; payment: PaymentRecord }> {
  return http.post<{ invoice: Invoice; payment: PaymentRecord }>(ENDPOINTS.PAYMENT_CREATE, input)
}

export async function listPayments(invoiceId?: string): Promise<PaymentRecord[]> {
  return http.get<PaymentRecord[]>(ENDPOINTS.PAYMENTS, { params: invoiceId ? { invoiceId } : undefined })
}
