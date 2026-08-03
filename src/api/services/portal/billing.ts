// ============================================================
// HealSync HMS — Patient Portal: billing & payments
// ============================================================

import { ENDPOINTS, withParams } from '../../endpoints'
import { http, USE_MOCK_API } from '../../client'
import { mockDelay } from '../../mock'
import { store } from '../../store'
import type { Invoice } from '../../../types'
import type { PaymentSummary } from '../../../types/portal'

export async function listMyInvoices(patientId: string): Promise<Invoice[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    return store.invoices
      .filter((i) => i.patientId === patientId)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  }
  return http.get<Invoice[]>(ENDPOINTS.PORTAL_BILLS, { params: { patientId } })
}

export async function getPaymentSummary(patientId: string): Promise<PaymentSummary> {
  if (USE_MOCK_API) {
    await mockDelay(350)
    const invoices = store.invoices.filter((i) => i.patientId === patientId)
    const totalBilled = invoices.reduce((s, i) => s + i.total, 0)
    const totalPaid = invoices.reduce((s, i) => s + i.amountPaid, 0)
    return {
      totalBilled,
      totalPaid,
      outstanding: totalBilled - totalPaid,
      paymentHistory: store.invoices
        .flatMap((inv) =>
          inv.amountPaid > 0
            ? [
                {
                  id: `${inv.id}-pay`,
                  invoiceNo: inv.invoiceNo,
                  amount: inv.amountPaid,
                  method: 'Card',
                  paidAt: inv.issuedAt,
                  reference: `TXN-${inv.invoiceNo.slice(-5)}`,
                },
              ]
            : [],
        )
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    }
  }
  return http.get<PaymentSummary>(ENDPOINTS.PORTAL_BILLS, { params: { patientId, summary: true } })
}

export async function downloadInvoice(inv: Invoice): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay(500)
    const lines = [
      'HEALSYNC HOSPITAL',
      'INVOICE',
      '----------------------------',
      `Invoice No: ${inv.invoiceNo}`,
      `Patient: ${inv.patientName}`,
      `Issued: ${inv.issuedAt}`,
      `Due: ${inv.dueDate}`,
      `Status: ${inv.status}`,
      '',
      'Items:',
      ...inv.items.map((i) => `  - ${i.description}: $${i.amount.toFixed(2)}`),
      '',
      `Subtotal: $${inv.subtotal.toFixed(2)}`,
      `Discount: -$${inv.discount.toFixed(2)}`,
      `Tax: $${inv.tax.toFixed(2)}`,
      `TOTAL: $${inv.total.toFixed(2)}`,
      `Amount paid: $${inv.amountPaid.toFixed(2)}`,
      '',
      'Thank you for choosing HealSync.',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${inv.invoiceNo}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 500)
    return
  }
  const resp = await fetch(withParams(ENDPOINTS.PORTAL_INVOICE_DOWNLOAD, { id: inv.id }))
  const blob = await resp.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${inv.invoiceNo}.pdf`
  a.click()
}
