import { useEffect, useState } from 'react'
import { Activity, CalendarDays, FileText, Pill, Syringe, Stethoscope } from 'lucide-react'
import { getHealthTimeline } from '../../api/services/portal/timeline'
import { getMyPatient } from '../../api/services/portal/me'
import type { TimelineEvent, TimelineEventType } from '../../types/portal'
import { PageHeader, Skeleton, ErrorState, EmptyState } from '../components'

const TYPE_META: Record<TimelineEventType, { icon: React.ComponentType<{ size?: number }>; cls: string; label: string }> = {
  appointment: { icon: CalendarDays, cls: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400', label: 'Appointment' },
  diagnosis: { icon: Stethoscope, cls: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400', label: 'Diagnosis' },
  prescription: { icon: Pill, cls: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400', label: 'Prescription' },
  report: { icon: FileText, cls: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400', label: 'Report' },
  treatment: { icon: Syringe, cls: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400', label: 'Treatment' },
}

export default function Timeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await getMyPatient()
        setEvents(await getHealthTimeline(me.id))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load timeline')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="p-fade-in">
      <PageHeader title="Health Timeline" subtitle="A chronological view of your care history." />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : events.length === 0 ? (
        <EmptyState icon={Activity} title="No events yet" hint="Your care history will build up here over time." />
      ) : (
        <div className="relative ml-2 border-l-2 border-slate-200 pl-6 dark:border-slate-700">
          {events.map((ev) => {
            const meta = TYPE_META[ev.type] ?? TYPE_META.appointment
            const Icon = meta.icon
            return (
              <div key={ev.id} className="relative pb-8 last:pb-0">
                <span
                  className={`absolute -left-[31px] top-0 flex h-5 w-5 items-center justify-center rounded-full border-4 border-white dark:border-slate-900 ${meta.cls}`}
                />
                <div className="p-card p-4 transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${meta.cls}`}>
                        <Icon size={17} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{ev.title}</div>
                        <div className="text-xs text-slate-400">{meta.label} · {formatDate(ev.date)}</div>
                      </div>
                    </div>
                    {ev.meta && (
                      <span className="text-xs font-medium text-cyan-700 dark:text-cyan-400">{ev.meta}</span>
                    )}
                  </div>
                  {ev.description && (
                    <p className="mt-2.5 rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                      {ev.description}
                    </p>
                  )}
                  {ev.doctorName && (
                    <div className="mt-2 text-xs text-slate-400">Doctor: {ev.doctorName}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
