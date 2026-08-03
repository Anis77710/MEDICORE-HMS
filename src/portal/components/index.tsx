// ============================================================
// HealSync — Patient Portal shared components
// ============================================================

import { useEffect } from 'react'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`p-skeleton ${className}`} />
}

export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Icon size={26} />
      </div>
      <h3 className="mt-1 text-base font-bold text-slate-700 dark:text-slate-200">{title}</h3>
      {hint && <p className="max-w-sm text-sm text-slate-400 dark:text-slate-500">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center dark:border-red-900 dark:bg-red-950/30">
      <div className="text-3xl">⚠️</div>
      <h3 className="text-base font-bold text-red-700 dark:text-red-400">Something went wrong</h3>
      <p className="max-w-md text-sm text-red-600/80 dark:text-red-400/70">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="p-btn p-btn-outline mt-2">
          Try again
        </button>
      )}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="p-fade-in mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = 'cyan',
  sub,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: string | number
  tone?: 'cyan' | 'green' | 'amber' | 'purple' | 'red' | 'blue'
  sub?: string
}) {
  const tones: Record<string, string> = {
    cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    purple: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
    red: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  }
  return (
    <div className="p-card p-card-hover flex items-center gap-4 p-5">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {label}
        </div>
        <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
          {value}
        </div>
        {sub && <div className="truncate text-xs text-slate-400 dark:text-slate-500">{sub}</div>}
      </div>
    </div>
  )
}

export function RatingStars({
  value,
  size = 15,
  onChange,
}: {
  value: number
  size?: number
  onChange?: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-0.5" role={onChange ? 'radiogroup' : undefined} aria-label={`Rating ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(i)}
          className={`${onChange ? 'cursor-pointer transition-transform hover:scale-125' : 'cursor-default'} focus:outline-none`}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          role={onChange ? 'radio' : undefined}
          aria-checked={onChange ? i === Math.round(value) : undefined}
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={i <= Math.round(value) ? '#f59e0b' : 'none'}
            stroke={i <= Math.round(value) ? '#f59e0b' : '#cbd5e1'}
            strokeWidth="1.8"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
      <span className="ml-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
        {value.toFixed(1)}
      </span>
    </div>
  )
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    Pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    Completed: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
    Cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    Active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    Paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    Overdue: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    'On Leave': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    Unavailable: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  }
  const cls = map[status] ?? map.Pending
  return <span className={`p-badge ${cls}`}>{status}</span>
}

export function DoctorAvatar({
  name,
  size = 'md',
}: {
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const clean = name.replace(/^Dr\.?\s*/i, '')
  const initials = clean
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
  const colors = ['from-cyan-500 to-teal-600', 'from-violet-500 to-purple-600', 'from-rose-500 to-pink-600', 'from-amber-500 to-orange-600', 'from-blue-500 to-indigo-600', 'from-emerald-500 to-green-600']
  const color = colors[(name.length + name.charCodeAt(0)) % colors.length]
  const sizeCls =
    size === 'sm' ? 'h-9 w-9 text-xs' : size === 'md' ? 'h-11 w-11 text-sm' : size === 'lg' ? 'h-16 w-16 text-lg' : 'h-24 w-24 text-2xl'
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${color} font-bold text-white shadow-sm ${sizeCls}`}
    >
      {initials}
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = true,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="p-modal-in relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-700">
        <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="p-btn p-btn-outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className={`p-btn ${danger ? 'bg-red-600 text-white hover:bg-red-700' : 'p-btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  useEffectEscape(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`p-modal-in relative max-h-[90vh] w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-700`}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Close dialog"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function useEffectEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])
}

export function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <span className="text-sm text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-700 dark:text-slate-200">
        {value}
      </span>
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}
