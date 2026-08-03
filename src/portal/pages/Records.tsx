import { useEffect, useState } from 'react'
import {
  FileText,
  Download,
  Search,
  ClipboardList,
  FlaskConical,
  Activity,
  Stethoscope,
} from 'lucide-react'
import { getMyPatient } from '../../api/services/portal/me'
import {
  listMedicalRecords,
  listPatientDocuments,
  downloadReport,
  searchMedicalRecords,
} from '../../api/services/portal/records'
import type { MedicalRecord, PatientDocument } from '../../api/services/portal/records'
import { PageHeader, Skeleton, ErrorState, EmptyState, StatusPill, DoctorAvatar } from '../components'
import { useToast } from '../../context/ToastContext'

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Admission: Activity,
  Consultation: Stethoscope,
  'Lab Test': FlaskConical,
  Procedure: Activity,
  Diagnosis: ClipboardList,
}

const TYPE_TONES: Record<string, string> = {
  Admission: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  Consultation: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400',
  'Lab Test': 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  Procedure: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  Diagnosis: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
}

export default function MedicalRecords() {
  const { push } = useToast()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [docs, setDocs] = useState<PatientDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [downloading, setDownloading] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await getMyPatient()
        const [recs, dcs] = await Promise.all([
          listMedicalRecords(me.id),
          listPatientDocuments(me.id),
        ])
        if (cancelled) return
        setRecords(recs)
        setDocs(dcs)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load records')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const me = await getMyPatient()
        const results = await searchMedicalRecords(me.id, query)
        if (!cancelled) setRecords(results)
      } catch {
        /* keep current list */
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const doDownload = async (doc: PatientDocument) => {
    setDownloading(doc.id)
    try {
      await downloadReport(doc)
      push('Report download started', 'success')
    } catch {
      push('Failed to download report', 'error')
    } finally {
      setDownloading('')
    }
  }

  return (
    <div className="p-fade-in">
      <PageHeader
        title="Medical Records"
        subtitle="Your diagnoses, lab results and visit history."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search records by diagnosis, doctor…"
            className="p-input pl-10"
            aria-label="Search medical records"
          />
        </div>
        <span className="text-sm text-slate-400">{records.length} records</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-card p-5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-3 h-4 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : records.length === 0 && docs.length === 0 ? (
        <EmptyState icon={FileText} title="No medical records yet" hint="Your records will appear here after your first visit." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* History */}
          <div className="space-y-3 lg:col-span-2">
            {records.length === 0 && (
              <EmptyState icon={FileText} title="No matching records" hint="Try a different search term." />
            )}
            {records.map((r) => {
              const Icon = TYPE_ICONS[r.type] ?? FileText
              return (
                <div key={r.id} className="p-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TYPE_TONES[r.type] ?? 'bg-slate-100 text-slate-500'}`}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display font-bold text-slate-800 dark:text-slate-100">{r.type}</h3>
                          <span className="p-badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{r.date}</span>
                        </div>
                        <div className="mt-0.5 text-sm font-semibold text-cyan-700 dark:text-cyan-400">
                          {r.diagnosis}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                          <DoctorAvatar name={r.doctor} size="sm" />
                          {r.doctor}
                        </div>
                      </div>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="mt-3 rounded-xl bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    {r.notes}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Documents */}
          <div className="p-card h-fit p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display font-bold text-slate-800 dark:text-slate-100">
              <FileText size={17} className="text-cyan-600" /> Documents & Reports
            </h2>
            {docs.length === 0 ? (
              <EmptyState icon={FileText} title="No documents" hint="Lab reports and summaries will appear here." />
            ) : (
              <div className="space-y-2.5">
                {docs.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 dark:bg-red-950/40">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{d.name}</div>
                      <div className="text-xs text-slate-400">{d.type} · {d.size} · {d.date}</div>
                    </div>
                    <button
                      onClick={() => doDownload(d)}
                      disabled={downloading === d.id}
                      className="p-btn p-btn-outline !px-3 !py-2"
                      title="Download report"
                      aria-label={`Download ${d.name}`}
                    >
                      <Download size={15} className={downloading === d.id ? 'animate-pulse' : ''} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
