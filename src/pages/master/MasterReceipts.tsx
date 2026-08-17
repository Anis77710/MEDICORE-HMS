import { useEffect, useState } from 'react'
import { Printer, Banknote, Clock, RotateCcw } from 'lucide-react'
import { masterApi, type ReceiptItem } from '../../api/services/master'
import { Card, Spinner, EmptyState, Badge, PageHeader, Button, Tabs, StatCard } from '../../components/ui'
const RECEIPT_TONE: Record<string, 'green' | 'amber' | 'red'> = {
  approved: 'green',
  paid: 'amber',
  rejected: 'red',
}

const STATUS_LABEL: Record<string, string> = {
  approved: 'Approved',
  paid: 'Awaiting approval',
  rejected: 'Rejected',
}

function npr(n: number): string {
  return `NPR ${n.toLocaleString('en-US')}`
}

function fmtDate(s?: string): string {
  if (!s) return '-'
  return new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Opens the print dialog for a single receipt. */
function printReceipt(r: ReceiptItem): void {
  const w = window.open('', '_blank', 'width=640,height=860')
  if (!w) return
  w.document.write(`<!doctype html><html><head><title>Receipt ${r.regNo}</title><style>
    body{font-family:Georgia,serif;color:#1e293b;max-width:520px;margin:40px auto;padding:0 24px}
    h1{font-size:22px;margin:0} .muted{color:#64748b;font-size:12px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0e7490;padding-bottom:16px}
    .meta{width:100%;border-collapse:collapse;margin:20px 0}
    .meta td{padding:8px 6px;border-bottom:1px dashed #e2e8f0;font-size:14px}
    .meta td:last-child{text-align:right;font-weight:600}
    .total{background:#f0f9ff;font-size:18px;font-weight:700}
    .foot{margin-top:32px;text-align:center;color:#64748b;font-size:12px}
  </style></head><body>
    <div class="head">
      <div><h1>Medicore HMS</h1><div class="muted">Hospital Registration Fee - Official Receipt</div></div>
      <div class="muted">${fmtDate(r.paidAt)}</div>
    </div>
    <table class="meta">
      <tr><td>Reference</td><td>${r.regNo}</td></tr>
      <tr><td>Hospital</td><td>${r.hospitalName}</td></tr>
      <tr><td>Payer</td><td>${r.payer} (${r.payerEmail})</td></tr>
      <tr><td>eSewa Transaction</td><td>${r.transactionCode || '-'}</td></tr>
      <tr><td>Status</td><td>${STATUS_LABEL[r.status] ?? r.status}</td></tr>
      <tr class="total"><td>Amount Paid</td><td>${npr(r.amount)}</td></tr>
    </table>
    <div class="foot">This is a computer-generated receipt for the Medicore HMS hospital registration fee.<br/>Thank you for choosing Medicore HMS.</div>
    <script>window.print()</script>
  </body></html>`)
  w.document.close()
}

export default function MasterReceipts() {
  const [tab, setTab] = useState<'all' | 'approved' | 'paid' | 'rejected'>('all')
  const [items, setItems] = useState<ReceiptItem[]>([])
  const [summary, setSummary] = useState({ approved: 0, paid: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    setLoading(true)
    masterApi
      .receipts({ status: tab === 'all' ? undefined : tab, from: from || undefined, to: to || undefined })
      .then((res) => {
        setItems(res.items)
        setSummary(res.summary)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load receipts'))
      .finally(() => setLoading(false))
  }, [tab, from, to])

  return (
    <>
      <PageHeader
        title="Revenue & Receipts"
        subtitle="Every registration fee paid through eSewa, with printable receipts."
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <span className="muted">→</span>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          </div>
        }
      />

      <div className="grid-stats mb-4">
        <StatCard label="Collected" value={npr(summary.approved)} icon={<Banknote size={20} />} tone="green" footer={<span>approved registrations</span>} />
        <StatCard label="Pending" value={npr(summary.paid)} icon={<Clock size={20} />} tone="amber" footer={<span>paid, awaiting approval</span>} />
        <StatCard label="To Refund" value={npr(summary.rejected)} icon={<RotateCcw size={20} />} tone="red" footer={<span>rejected - refund owed</span>} />
      </div>

      <Tabs<'all' | 'approved' | 'paid' | 'rejected'>
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'approved', label: 'Approved' },
          { value: 'paid', label: 'Awaiting approval' },
          { value: 'rejected', label: 'Rejected' },
        ]}
      />

      <Card padded>
        {error && <div className="auth-error mb-4">{error}</div>}
        {loading ? (
          <Spinner label="Loading receipts…" />
        ) : items.length === 0 ? (
          <EmptyState title="No receipts in this view" hint="Paid registration fees will appear here." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Hospital</th>
                  <th>Payer</th>
                  <th>Transaction</th>
                  <th>Paid</th>
                  <th className="align-right">Amount</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.regNo}</td>
                    <td>
                      <div className="font-semibold">{r.hospitalName}</div>
                      <div className="text-sm muted">{r.payer}</div>
                    </td>
                    <td className="text-sm muted">{r.payerEmail}</td>
                    <td className="mono text-sm">{r.transactionCode || '-'}</td>
                    <td className="text-sm">{fmtDate(r.paidAt)}</td>
                    <td className="align-right font-semibold">{npr(r.amount)}</td>
                    <td>
                      <Badge tone={RECEIPT_TONE[r.status] ?? 'gray'}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                    </td>
                    <td className="align-right">
                      <Button size="sm" variant="outline" onClick={() => printReceipt(r)}>
                        <Printer size={14} /> Receipt
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}