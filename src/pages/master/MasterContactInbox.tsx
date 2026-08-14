import { useEffect, useState } from 'react'
import { Mail, CheckCircle2, RotateCcw, Trash2, ExternalLink } from 'lucide-react'
import { masterApi, type ContactMessageItem } from '../../api/services/master'
import { Card, Spinner, EmptyState, Badge, PageHeader, Button, Tabs } from '../../components/ui'
import { useToast } from '../../context/ToastContext'

function fmtDate(s?: string): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function MasterContactInbox() {
  const { push } = useToast()
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all')
  const [items, setItems] = useState<ContactMessageItem[]>([])
  const [openTotal, setOpenTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setLoading(true)
    masterApi
      .contacts(filter)
      .then((res) => {
        setItems(res.items)
        setOpenTotal(res.openTotal)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load messages'))
      .finally(() => setLoading(false))
  }, [filter])

  const setDone = async (m: ContactMessageItem, done: boolean) => {
    setBusy((b) => ({ ...b, [m.id]: true }))
    try {
      await masterApi.setContactDone(m.id, done)
      push(done ? 'Marked as done.' : 'Reopened.')
      if (filter !== 'all') {
        setItems((list) => list.filter((x) => x.id !== m.id))
      } else {
        setItems((list) => list.map((x) => (x.id === m.id ? { ...x, done } : x)))
      }
      if (!done) setOpenTotal((t) => t + 1)
      else setOpenTotal((t) => Math.max(0, t - 1))
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to update message')
    } finally {
      setBusy((b) => ({ ...b, [m.id]: false }))
    }
  }

  const remove = async (m: ContactMessageItem) => {
    if (!window.confirm(`Delete the message from "${m.name}" (${m.email})?`)) return
    setBusy((b) => ({ ...b, [m.id]: true }))
    try {
      await masterApi.deleteContact(m.id)
      setItems((list) => list.filter((x) => x.id !== m.id))
      push('Message deleted.')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to delete message')
    } finally {
      setBusy((b) => ({ ...b, [m.id]: false }))
    }
  }

  return (
    <>
      <PageHeader
        title="Contact Inbox"
        subtitle="Messages submitted through the public contact form."
        actions={
          openTotal > 0 ? (
            <Badge tone="amber">{openTotal} unhandled</Badge>
          ) : (
            <Badge tone="green">All clear</Badge>
          )
        }
      />

      <Tabs<'all' | 'open' | 'done'>
        active={filter}
        onChange={setFilter}
        tabs={[
          { value: 'all', label: 'All' },
          { value: 'open', label: 'Unhandled', count: openTotal },
          { value: 'done', label: 'Done' },
        ]}
      />

      <Card padded>
        {error && <div className="auth-error mb-4">{error}</div>}
        {loading ? (
          <Spinner label="Loading messages…" />
        ) : items.length === 0 ? (
          <EmptyState title="No messages here" hint="Contact form submissions from the landing page will appear here." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((m) => (
              <div key={m.id} className="card card-pad" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div className="stat-icon stat-icon-teal" style={{ width: 40, height: 40, borderRadius: 10, opacity: m.done ? 0.55 : 1 }}>
                  <Mail size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>{m.name}</strong>
                    {m.done ? <Badge tone="gray">Done</Badge> : <Badge tone="amber">Unhandled</Badge>}
                    <span className="text-sm muted">{fmtDate(m.createdAt)}</span>
                  </div>
                  <div className="text-sm muted">
                    {m.email}
                    {m.hospital ? ` · ${m.hospital}` : ''}
                  </div>
                  <p className="text-sm mt-1" style={{ whiteSpace: 'pre-wrap' }}>{m.message}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a className="btn btn-outline btn-sm" href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message to Medicore HMS')}`}>
                    <ExternalLink size={14} /> Reply
                  </a>
                  <Button size="sm" variant="outline" loading={busy[m.id]} onClick={() => setDone(m, !m.done)}>
                    {m.done ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />} {m.done ? 'Reopen' : 'Done'}
                  </Button>
                  <Button size="sm" variant="danger" loading={busy[m.id]} onClick={() => remove(m)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}