import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  FileCheck2,
  Pill,
  Receipt,
  Megaphone,
  CheckCheck,
  Loader2,
} from 'lucide-react'
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../api/services/portal/notifications'
import type { PortalNotification, PortalNotificationType } from '../../types/portal'
import { PageHeader, Skeleton, ErrorState, EmptyState } from '../components'
import { useOutletContext } from 'react-router-dom'

const TYPE_META: Record<PortalNotificationType, { icon: React.ComponentType<{ size?: number }>; cls: string }> = {
  appointment_confirmation: { icon: CalendarCheck2, cls: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
  appointment_reminder: { icon: CalendarClock, cls: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400' },
  schedule_change: { icon: CalendarX2, cls: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' },
  report_available: { icon: FileCheck2, cls: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400' },
  prescription_update: { icon: Pill, cls: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400' },
  billing: { icon: Receipt, cls: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400' },
  announcement: { icon: Megaphone, cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
}

export default function Notifications() {
  const ctx = useOutletContext<{ refreshUnread?: () => void } | undefined>()
  const [items, setItems] = useState<PortalNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [markingAll, setMarkingAll] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await listNotifications())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const unread = items.filter((n) => !n.read).length

  const openOne = async (n: PortalNotification) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      await markNotificationRead(n.id).catch(() => {})
      ctx?.refreshUnread?.()
    }
  }

  const markAll = async () => {
    setMarkingAll(true)
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((x) => ({ ...x, read: true })))
      ctx?.refreshUnread?.()
    } finally {
      setMarkingAll(false)
    }
  }

  const relativeTime = (iso: string) => {
    const diff = new Date().getTime() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div className="p-fade-in">
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread notification${unread > 1 ? 's' : ''}` : `You're all caught up`}
        actions={
          unread > 0 ? (
            <button onClick={markAll} disabled={markingAll} className="p-btn p-btn-outline">
              {markingAll ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />}
              Mark all as read
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" hint="Appointment updates and announcements will appear here." />
      ) : (
        <div className="space-y-2.5">
          {items.map((n) => {
            const meta = TYPE_META[n.type] ?? TYPE_META.announcement
            const Icon = meta.icon
            return (
              <Link
                key={n.id}
                to={n.link ?? '/portal/notifications'}
                onClick={() => openOne(n)}
                className={`flex items-start gap-3.5 rounded-2xl border p-4 transition-all duration-150 ${
                  n.read
                    ? 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                    : 'border-cyan-200 bg-cyan-50/70 shadow-sm hover:shadow-md dark:border-cyan-800 dark:bg-cyan-500/10'
                }`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${meta.cls}`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-sm font-bold ${n.read ? 'text-slate-600 dark:text-slate-300' : 'text-slate-800 dark:text-white'}`}>
                      {n.title}
                    </h3>
                    <span className="shrink-0 text-[11px] text-slate-400">{relativeTime(n.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{n.message}</p>
                </div>
                {!n.read && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-500" />}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
