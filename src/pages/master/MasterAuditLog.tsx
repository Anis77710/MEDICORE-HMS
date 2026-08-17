import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { masterApi, type AuditEntryItem, type AuditAction } from '../../api/services/master'
import { Card, Spinner, EmptyState, Badge, PageHeader, Pagination } from '../../components/ui'

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  approve_request: 'Approve request',
  reject_request: 'Reject request',
  hospital_status: 'Hospital status',
  hospital_listed: 'Directory listing',
  hospital_delete: 'Delete hospital',
  settings_update: 'Settings update',
  announcement_create: 'Post announcement',
  announcement_delete: 'Delete announcement',
  contact_done: 'Contact done',
  contact_delete: 'Contact deleted',
}

const ACTION_TONES: Record<AuditAction, 'green' | 'red' | 'blue' | 'amber' | 'teal' | 'gray'> = {
  login: 'blue',
  approve_request: 'green',
  reject_request: 'red',
  hospital_status: 'amber',
  hospital_listed: 'teal',
  hospital_delete: 'red',
  settings_update: 'gray',
  announcement_create: 'green',
  announcement_delete: 'red',
  contact_done: 'gray',
  contact_delete: 'gray',
}

const PAGE_SIZE = 25

function fmtDate(s?: string): string {
  if (!s) return '-'
  return new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function MasterAuditLog() {
  const [items, setItems] = useState<AuditEntryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [action, setAction] = useState('')
  const [query, setQuery] = useState('')

  const load = (p: number, act: string, q: string) => {
    setLoading(true)
    masterApi
      .audit({ action: act || undefined, q: q || undefined, page: p, limit: PAGE_SIZE })
      .then((res) => {
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load audit log'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      load(1, action, query)
    }, 300)
    return () => clearTimeout(t)
  }, [action, query])

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Every master admin action on the platform, newest first."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">
              <option value="">All actions</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                className="input"
                style={{ paddingLeft: 32, width: 220 }}
                placeholder="Search summaries…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        }
      />

      <Card padded>
        {error && <div className="auth-error mb-4">{error}</div>}
        {loading ? (
          <Spinner label="Loading audit entries…" />
        ) : items.length === 0 ? (
          <EmptyState title="No audit entries" hint="Master admin actions will be recorded here." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Admin</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr key={e.id}>
                      <td className="text-sm whitespace-nowrap">{fmtDate(e.createdAt)}</td>
                      <td>
                        <div className="text-sm font-semibold">{e.actor.name}</div>
                        <div className="text-sm muted">{e.actor.email}</div>
                      </td>
                      <td>
                        <Badge tone={ACTION_TONES[e.action] ?? 'gray'}>{ACTION_LABELS[e.action] ?? e.action}</Badge>
                      </td>
                      <td className="text-sm">{e.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={total} limit={PAGE_SIZE} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  )
}