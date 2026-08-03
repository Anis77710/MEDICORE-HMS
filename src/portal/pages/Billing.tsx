import { useEffect, useState } from 'react'
import {
  Receipt,
  Download,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { listMyInvoices, getPaymentSummary, downloadInvoice } from '../../api/services/portal/billing'
import { getMyPatient } from '../../api/services/portal/me'
import type { Invoice } from '../../types'
import type { PaymentSummary } from '../../types/portal'
import { PageHeader, Skeleton, ErrorState, EmptyState, StatCard } from '../components'
import { useToast } from '../../context/ToastContext'

const STATUS_COLORS: Record<string, string> = {
  Paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  Pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  Overdue: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  Partial: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400',
}

export default function Billing() {
  const { push } = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await getMyPatient()
        const [inv, sum] = await Promise.all([listMyInvoices(me.id), getPaymentSummary(me.id)])
        if (!cancelled) {
          setInvoices(inv)
          setSummary(sum)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load billing')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const doDownload = async (inv: Invoice) => {
    setDownloading(inv.id)
    try {
      await downloadInvoice(inv)
      push('Invoice download started', 'success')
    } catch {
      push('Failed to download invoice', 'error')
    } finally {
      setDownloading('')
    }
  }

  const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`

  return (
    <div className="p-fade-in">
      <PageHeader title="Billing & Payments" subtitle="Invoices, payments and outstanding balances." />

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={TrendingUp}
              label="Total billed"
              value={money(summary?.totalBilled ?? 0)}
              tone="cyan"
            />
            <StatCard
              icon={CheckCircle2}
              label="Total paid"
              value={money(summary?.totalPaid ?? 0)}
              tone="green"
            />
            <StatCard
              icon={AlertTriangle}
              label="Outstanding"
              value={money(summary?.outstanding ?? 0)}
              tone={summary?.outstanding ? 'red' : 'blue'}
            />
          </div>

          {invoices.length === 0 ? (
            <div className="mt-6">
              <EmptyState icon={Receipt} title="No invoices" hint="Bills for consultations and treatments will appear here." />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {invoices.map((inv) => (
                <div key={inv.id} className="p-card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400">
                        <Receipt size={18} />
                      </div>
                      <div>
                        <div className="font-display font-bold text-slate-800 dark:text-slate-100">{inv.invoiceNo}</div>
                        <div className="text-xs text-slate-400">{inv.issuedAt} · Due {inv.dueDate}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`p-badge ${STATUS_COLORS[inv.status] ?? 'p-badge'}`}>{inv.status}</span>
                      <div className="text-right">
                        <div className="font-display text-base font-extrabold text-slate-900 dark:text-white">{money(inv.total)}</div>
                        <div className="text-[11px] text-slate-400">{money(inv.amountPaid)} paid</div>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-3">
                    <div className="space-y-2">
                      {inv.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-300">{item.description}</span>
                          <span className="font-medium text-slate-800 dark:text-slate-100">{money(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3 text-sm dark:border-slate-700">
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        {inv.discount > 0 && <span>Discount −{money(inv.discount)}</span>}
                        {inv.tax > 0 && <span>Tax {money(inv.tax)}</span>}
                      </div>
                      <button onClick={() => doDownload(inv)} disabled={downloading === inv.id} className="p-btn p-btn-outline p-btn-sm">
                        {downloading === inv.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        Invoice
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
            <CreditCard size={18} className="mt-0.5 shrink-0 text-cyan-600 dark:text-cyan-400" />
            <p>
              Payments are currently handled offline at the front desk. You can download a copy of any invoice for your
              records, or contact billing at <span className="font-medium">billing@healsync.med</span>.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
