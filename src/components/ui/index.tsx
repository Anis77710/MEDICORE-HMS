import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react'
import { X, Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'

// ---------- Avatar ----------
const AVATAR_COLORS = ['#0e7490', '#7c3aed', '#db2777', '#059669', '#d97706', '#2563eb', '#dc2626', '#b45309']

export function Avatar({
  name,
  size = 'md',
  color,
  src,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: string
  src?: string
}) {
  const initials = name
    .replace(/^Dr\.?\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  const bg = color ?? AVATAR_COLORS[(name.charCodeAt(0) + name.length) % AVATAR_COLORS.length]
  if (src) {
    return <img src={src} alt={name} className={`avatar avatar-${size}`} />
  }
  return (
    <span className={`avatar avatar-${size}`} style={{ background: bg }} title={name}>
      {initials}
    </span>
  )
}

// ---------- Badge ----------
export type BadgeTone = 'teal' | 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray'

// eslint-disable-next-line react-refresh/only-export-components
export const STATUS_TONES: Record<string, BadgeTone> = {
  Admitted: 'teal',
  Outpatient: 'blue',
  Critical: 'red',
  Recovered: 'green',
  Pending: 'amber',
  Confirmed: 'teal',
  Completed: 'green',
  Cancelled: 'red',
  Active: 'green',
  'On Leave': 'amber',
  Unavailable: 'gray',
  Paid: 'green',
  Overdue: 'red',
  Refunded: 'purple',
  'In Stock': 'green',
  'Low Stock': 'amber',
  'Out of Stock': 'red',
  'Expiring Soon': 'purple',
  Resigned: 'gray',
}

export function Badge({ tone = 'gray', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? 'gray'}>{status}</Badge>
}

// ---------- Card ----------
export function Card({
  children,
  className = '',
  padded = false,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return <div className={`card ${padded ? 'card-pad' : ''} ${className}`}>{children}</div>
}

// ---------- Button ----------
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''} ${block ? 'btn-block' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="spinner spinner-sm" aria-hidden />}
      {children}
    </button>
  )
}

// ---------- Spinner ----------
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="spinner-wrap">
      <span className="spinner" aria-hidden />
      <span className="muted text-sm">{label}</span>
    </div>
  )
}

// ---------- EmptyState ----------
export function EmptyState({ title = 'Nothing here yet', hint }: { title?: string; hint?: string }) {
  return (
    <div className="empty-state">
      <Inbox size={36} strokeWidth={1.4} />
      <div className="font-semibold" style={{ color: 'var(--text)' }}>
        {title}
      </div>
      {hint && <div className="text-sm">{hint}</div>}
    </div>
  )
}

// ---------- PageHeader ----------
export function PageHeader({
  title,
  subtitle,
  actions,
  backTo,
}: {
  title: ReactNode
  subtitle?: string
  actions?: ReactNode
  backTo?: string
}) {
  return (
    <div className="page-header">
      <div className="flex gap-2 align-center" style={{ gap: 10 }}>
        {backTo && (
          <Link to={backTo} className="btn btn-outline btn-sm" aria-label="Go back">
            <ChevronLeft size={16} />
          </Link>
        )}
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

// ---------- SearchInput ----------
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`search-input ${className}`}>
      <Search size={17} className="search-icon" />
      <input
        type="search"
        name="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button className="search-clear" onClick={() => onChange('')} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

// ---------- Tabs ----------
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { value: T; label: string; count?: number }[]
  active: T
  onChange: (v: T) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={active === t.value}
          className={`tab ${active === t.value ? 'tab-active' : ''}`}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

// ---------- Pagination ----------
export function Pagination({
  page,
  total,
  limit,
  onChange,
}: {
  page: number
  total: number
  limit: number
  onChange: (p: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / limit))
  if (pages <= 1) return null
  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  return (
    <div className="pagination">
      <span className="pagination-info">
        Showing {from}–{to} of {total}
      </span>
      <div className="pagination-btns">
        <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft size={15} />
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}
        <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

// ---------- Modal ----------
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ---------- ConfirmDialog ----------
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  danger = true,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      open={open}
      title={title}
      size="sm"
      onClose={onCancel}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
              } finally {
                setBusy(false)
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <p className="confirm-message">{message}</p>}
      {children}
    </Modal>
  )
}

// ---------- Field ----------
export function Field({
  label,
  hint,
  error,
  action,
  children,
}: {
  label: string
  hint?: string
  error?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="field">
      <div className="field-label-row">
        <label className="field-label">{label}</label>
        {action}
      </div>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="error-text">{error}</span>}
    </div>
  )
}

// ---------- Input ----------
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}
export function Input({ invalid, className = '', ...rest }: InputProps) {
  return <input className={`input ${invalid ? 'input-error' : ''} ${className}`} {...rest} />
}

// ---------- Form actions row ----------
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="form-actions">{children}</div>
}

// ---------- KPI Stat Card ----------
export function StatCard({
  label,
  value,
  change,
  icon,
  tone = 'teal',
  footer,
}: {
  label: string
  value: string
  change?: number
  icon: ReactNode
  tone?: 'teal' | 'amber' | 'indigo' | 'green' | 'red'
  footer?: ReactNode
}) {
  const up = (change ?? 0) >= 0
  return (
    <Card className="stat-card">
      <div className="stat-top">
        <div className={`stat-icon stat-icon-${tone}`}>{icon}</div>
        {change !== undefined && (
          <span className={`stat-change ${up ? 'stat-up' : 'stat-down'}`}>
            {up ? '▲' : '▼'} {Math.abs(change)}%
          </span>
        )}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {footer}
    </Card>
  )
}
