import { useEffect, useState } from 'react'
import { Pill, Download, CalendarDays, Clock } from 'lucide-react'
import { getMyPatient } from '../../api/services/portal/me'
import { listMyPrescriptions, downloadPrescriptionPdf } from '../../api/services/portal/prescriptions'
import type { Prescription } from '../../types'
import { PageHeader, Skeleton, ErrorState, EmptyState, StatusPill, DoctorAvatar } from '../components'
import { useToast } from '../../context/ToastContext'

export default function Prescriptions() {
  const { push } = useToast()
  const [rxs, setRxs] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await getMyPatient()
        const list = await listMyPrescriptions(me.id)
        if (!cancelled) setRxs(list)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load prescriptions')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const doDownload = async (rx: Prescription) => {
    setDownloading(rx.id)
    try {
      await downloadPrescriptionPdf(rx)
      push('Prescription download started', 'success')
    } catch {
      push('Failed to download prescription', 'error')
    } finally {
      setDownloading('')
    }
  }

  return (
    <div className="p-fade-in">
      <PageHeader
        title="Prescriptions"
        subtitle="Your medicines, dosages and doctor instructions."
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-card p-5"><Skeleton className="h-24 w-full" /></div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : rxs.length === 0 ? (
        <EmptyState icon={Pill} title="No prescriptions yet" hint="Prescriptions issued by your doctors will appear here." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rxs.map((rx) => (
            <div key={rx.id} className="p-card overflow-hidden">
              <div className="flex items-center justify-between bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                    <Pill size={19} />
                  </div>
                  <div>
                    <div className="font-display font-bold">Prescription</div>
                    <div className="text-xs text-white/75">{rx.id} · {rx.issuedAt}</div>
                  </div>
                </div>
                <StatusPill status={rx.status} />
              </div>

              <div className="p-5">
                <div className="mb-3 flex items-center gap-2.5">
                  <DoctorAvatar name={rx.doctorName} size="sm" />
                  <div>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{rx.doctorName}</div>
                    <div className="text-xs text-slate-400">Prescribing doctor</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {rx.medicines.map((m, i) => (
                    <div key={i} className="rounded-xl border border-slate-100 p-3.5 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{m.name}</span>
                        <span className="p-badge bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400">{m.dosage}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Clock size={12} />{m.frequency}</span>
                        <span className="flex items-center gap-1"><CalendarDays size={12} />{m.durationDays} days</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={() => doDownload(rx)} disabled={downloading === rx.id} className="p-btn p-btn-outline mt-4 w-full">
                  <Download size={15} className={downloading === rx.id ? 'animate-pulse' : ''} />
                  {downloading === rx.id ? 'Downloading…' : 'Download PDF'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
