// ============================================================
// HealSync HMS — Billing service
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http, USE_MOCK_API } from '../client'
import { mockDelay, mockPayments } from '../mock'
import { store, nextId } from '../store'
import type { Invoice, PaymentRecord } from '../../types'

export interface InvoiceInput {
  patientId: string
  description: string
  items: { description: string; amount: number }[]
  discount: number
  dueDate: string
}

export async function listInvoices(q: { search?: string; status?: string } = {}): Promise<Invoice[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    let list = [...store.invoices]
    if (q.search) {
      const s = q.search.toLowerCase()
      list = list.filter(
        (i) =>
          i.invoiceNo.toLowerCase().includes(s) ||
          i.patientName.toLowerCase().includes(s),
      )
    }
    if (q.status && q.status !== 'All') list = list.filter((i) => i.status === q.status)
    return list.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  }
  return http.get<Invoice[]>(ENDPOINTS.INVOICES, { params: { ...q } })
}

export async function getInvoice(id: string): Promise<Invoice> {
  if (USE_MOCK_API) {
    await mockDelay(300)
    const i = store.invoices.find((x) => x.id === id)
    if (!i) throw new Error('Invoice not found')
    return i
  }
  return http.get<Invoice>(withParams(ENDPOINTS.INVOICE_DETAIL, { id }))
}

export async function createInvoice(input: InvoiceInput): Promise<Invoice> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const subtotal = input.items.reduce((s, it) => s + it.amount, 0)
    const tax = subtotal * 0.05
    const patient = store.patients.find((p) => p.id === input.patientId)
    const invoice: Invoice = {
      id: nextId('inv'),
      invoiceNo: `INV-2026-${String(1000 + store.invoices.length + 1)}`,
      patientId: input.patientId,
      patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown',
      description: input.description,
      items: input.items,
      subtotal,
      discount: input.discount ?? 0,
      tax: Math.round(tax * 100) / 100,
      total: Math.round((subtotal - (input.discount ?? 0) + tax) * 100) / 100,
      amountPaid: 0,
      status: 'Pending',
      issuedAt: new Date().toISOString().slice(0, 10),
      dueDate: input.dueDate,
    }
    store.invoices.unshift(invoice)
    return invoice
  }
  return http.post<Invoice>(ENDPOINTS.INVOICE_CREATE, input)
}

export async function recordPayment(input: {
  invoiceId: string
  amount: number
  method: PaymentRecord['method']
}): Promise<{ invoice: Invoice; payment: PaymentRecord }> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const idx = store.invoices.findIndex((x) => x.id === input.invoiceId)
    if (idx === -1) throw new Error('Invoice not found')
    const inv = store.invoices[idx]
    const paid = Math.min(inv.amountPaid + input.amount, inv.total)
    store.invoices[idx] = {
      ...inv,
      amountPaid: paid,
      status: paid >= inv.total ? 'Paid' : inv.status === 'Overdue' ? 'Overdue' : 'Pending',
    }
    const payment: PaymentRecord = {
      id: nextId('pay'),
      invoiceId: input.invoiceId,
      amount: input.amount,
      method: input.method,
      reference: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      paidAt: new Date().toISOString().slice(0, 10),
    }
    return { invoice: store.invoices[idx], payment }
  }
  return http.post<{ invoice: Invoice; payment: PaymentRecord }>(ENDPOINTS.PAYMENT_CREATE, input)
}

export async function listPayments(invoiceId?: string): Promise<PaymentRecord[]> {
  if (USE_MOCK_API) {
    await mockDelay(300)
    const all = invoiceId ? mockPayments.filter((p) => p.invoiceId === invoiceId) : mockPayments
    return [...all]
  }
  return http.get<PaymentRecord[]>(ENDPOINTS.PAYMENTS, { params: invoiceId ? { invoiceId } : undefined })
}
