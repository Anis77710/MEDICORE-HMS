import { useEffect, useMemo, useState } from 'react'
import { Printer, Receipt as ReceiptIcon } from 'lucide-react'
import { masterApi, type RegistrationRequestItem } from '../../api/services/master'
import { Card, Spinner, EmptyState, PageHeader, Button, Tabs } from '../../components/ui'

function npr(n: number): string {
  return `NPR ${n.toLocaleString('en-US')}`
}

function fmtDate(v?: string): string {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-US', { dateStyle: 'long' })
}

type Filter = 'approved' | 'paid' | 'rejected'

function openReceiptWindow(r: RegistrationRequestItem): void {
  const w = window.open('', '_blank', 'width=640,height=780')
  if (!w) return
  w.document.write(`<!doctype html><html><head><title>Receipt ${r.regNo}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;margin:48px auto;max-width:520px;color:#0f172a;padding:0 24px}
  .head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0e7490;padding-bottom:14px;margin-bottom:22px}
  .brand h1{margin:0;font-size:20px;color:#0e7490}.brand p{margin:2px 0 0;color:#64748b;font-size:12px}
  .receipt-tag{background:#0e7490;color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  .title{font-size:24px;font-weight:800;margin-bottom:4px}
  .ref{color:#64748b;font-size:13px;margin-bottom:26px}
  table{width:100%;border-collapse:collapse;margin-bottom:26px}
  td{padding:10px 0;border-bottom:1px dashed #e2e8f0;font-size:14px;vertical-align:top}
  td:first-child{color:#64748b;width:42%}
  .total td{border-bottom:none;font-size:16px;font-weight:800}
  .total td:last-child{color:#059669;text-align:right}
  .status{display:inline-block;margin-top:4px;background:#dcfce7;color:#15803d;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700}
  .foot{margin-top:34px;border-top:1px solid #e2e8f0;padding-top:16px;color:#94a3b8;font-size:12px;line-height:1.7}
  @media print{.no-print{display:none}}
</style></head><body>
<div class="no-print" style="text-align:right;margin-bottom:18px"><button onclick="window.print()" style="padding:10px 18px;background:#0e7490;color:#fff;border:0;border-radius:8px;font-size:14px;cursor:pointer;font-weight:700">Print / Save as PDF</button></div>
<div class="head"><div class="brand"><h1>MEDICORE HMS</h1><p>Payment receipt · Hospital registration</p></div><span class="receipt-tag">Receipt</span></div>
<div class="title">${r.hospitalName}</div>
<div class="ref">Registration reference: ${r.regNo}</div>
<table>
  <tr><td>Registered to</td><td>${r.admin.name}</td></tr>
  <tr><td>Email</td><td>${r.admin.email}</td></tr>
  <tr><td>Phone</td><td>${r.admin.phone || '—'}</td></tr>
  <tr><td>Payment method</td><td>eSewa</td></tr>
  <tr><td>Transaction UUID</td><td>${r.payment.transactionUuid}</td></tr>
  <tr><td>Transaction code</td><td>${r.payment.transactionCode || '—'}</td></tr>
  <tr><td>Paid on</td><td>${fmtDate(r.payment.paidAt)}</td></tr>
  <tr><td>Status</td><td><span class="status">PAID</span></td></tr>
</table>
<table class="total">
  <tr class="total"><td>Registration fee</td><td>${npr(r.payment.amount)}</td></tr>
</table>
<div class="foot">This receipt confirms payment for the one-time hospital registration fee. The hospital is provisioned only after platform approval. For support contact the address on the Medicore website.</div>
</body></html>`)
  w.document.close()
}

export default function MasterReceipts() {
  const [items, setItems] = useState<RegistrationRequestItem[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<Filter>('approved')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    masterApi
      .listRequests()
      .then((res) => {
        setItems(res.items)
        setCounts(res.counts)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load receipts'))
      .finally(() => setLoading(false))
  }, [])

  const money = useMemo(() => {
    const approved = items.filter((r) => r.status === 'approved').reduce((a, r) => a + r.payment.amount, 0)
    const paid = items.filter((r) => r.status === 'paid').reduce((a, r) => a + r.payment.amount, 0)
    return { approved, paid }
  }, [items])

  const visible = items.filter((r) => r.status === filter)

  return (
    <>
      <PageHeader
        title="Payment Receipts"
        subtitle="eSewa receipts for every paid hospital registration."
        actions={
          <div className="flex" style={{ gap: 8 }}>
            <span className="badge badge-green">Collected: {npr(money.approved + money.paid)}</span>
            <span className="badge badge-blue">Approved: {npr(money.approved)}</span>
          </div>
        }
      />

      <Card className="mb-4" padded>
        <Tabs<Filter>
          tabs={[
            { value: 'approved', label: 'Approved', count: counts.approved ?? 0 },
            { value: 'paid', label: 'Paid (awaiting approval)', count: counts.paid ?? 0 },
            { value: 'rejected', label: 'Rejected', count: counts.rejected ?? 0 },
          ]}
          active={filter}
          onChange={setFilter}
        />
      </Card>

      <Card padded>
        {error && <div className="auth-error mb-4">{error}</div>}
        {loading ? (
          <Spinner label="Loading receipts…" />
        ) : visible.length === 0 ? (
          <EmptyState title="No receipts" hint="Paid registrations appear here once payment is confirmed." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Hospital</th>
                  <th>Payer</th>
                  <th>Amount</th>
                  <th>Transaction</th>
                  <th>Paid</th>
                  <th className="align-right">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r._id}>
                    <td className="mono">{r.regNo}</td>
                    <td>
                      <div className="font-semibold">{r.hospitalName}</div>
                      <div className="text-sm muted mono">/ {r.slug}</div>
                    </td>
                    <td>{r.admin.name}</td>
                    <td>{npr(r.payment.amount)}</td>
                    <td>
                      <div className="text-sm mono">{r.payment.transactionCode || '—'}</div>
                      <div className="text-sm muted mono">{r.payment.transactionUuid.slice(0, 8)}…</div>
                    </td>
                    <td className="text-sm">{fmtDate(r.payment.paidAt)}</td>
                    <td className="align-right">
                      <Button size="sm" variant="outline" onClick={() => openReceiptWindow(r)}>
                        <Printer size={14} /> View / Print
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padded className="mt-4">
        <h3 className="card-title">
          <ReceiptIcon size={18} /> Summary
        </h3>
        <div className="grid-stats">
          <div className="stat-mini">
            <span>Approved fees</span>
            <strong>{npr(money.approved)}</strong>
          </div>
          <div className="stat-mini">
            <span>Pending approval</span>
            <strong>{npr(money.paid)}</strong>
          </div>
          <div className="stat-mini">
            <span>Total collected</span>
            <strong>{npr(money.approved + money.paid)}</strong>
          </div>
          <div className="stat-mini">
            <span>Receipts</span>
            <strong>{visible.length}</strong>
          </div>
        </div>
      </Card>
    </>
  )
}
