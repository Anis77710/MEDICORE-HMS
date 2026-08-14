import { useEffect, useState } from 'react'
import { Megaphone, Trash2, Check, X } from 'lucide-react'
import { masterApi, type Announcement } from '../../api/services/master'
import { Card, Spinner, EmptyState, Badge, PageHeader, Button, Input, Field } from '../../components/ui'
import { useToast } from '../../context/ToastContext'

function fmtDate(s?: string): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function MasterAnnouncements() {
  const { push } = useToast()
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState<'all' | 'active'>('all')
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const load = () =>
    masterApi
      .listAnnouncements()
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load announcements'))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) {
      push('Title and message are required.')
      return
    }
    setCreating(true)
    try {
      await masterApi.createAnnouncement({ title: title.trim(), message: message.trim(), audience })
      push('Announcement posted — it will appear in every hospital dashboard.')
      setTitle('')
      setMessage('')
      setAudience('all')
      await load()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to post announcement')
    } finally {
      setCreating(false)
    }
  }

  const toggle = async (a: Announcement) => {
    setBusy((b) => ({ ...b, [a.id]: true }))
    try {
      await masterApi.setAnnouncementActive(a.id, !a.active)
      setItems((list) => list.map((x) => (x.id === a.id ? { ...x, active: !a.active } : x)))
      push(a.active ? 'Announcement retired.' : 'Announcement is live again.')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to update announcement')
    } finally {
      setBusy((b) => ({ ...b, [a.id]: false }))
    }
  }

  const remove = async (a: Announcement) => {
    if (!window.confirm(`Delete announcement "${a.title}"? This cannot be undone.`)) return
    setBusy((b) => ({ ...b, [a.id]: true }))
    try {
      await masterApi.deleteAnnouncement(a.id)
      setItems((list) => list.filter((x) => x.id !== a.id))
      push('Announcement deleted.')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to delete announcement')
    } finally {
      setBusy((b) => ({ ...b, [a.id]: false }))
    }
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Platform-wide banners shown inside every hospital dashboard."
      />

      <div className="grid-2 mb-4">
        <Card padded>
          <h3 className="card-title mb-2">Post a new announcement</h3>
          <form onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Scheduled maintenance" maxLength={120} />
            </Field>
            <Field label="Message">
              <textarea
                className="input"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What should every hospital know?"
                maxLength={2000}
              />
            </Field>
            <Field label="Audience">
              <select className="input" value={audience} onChange={(e) => setAudience(e.target.value as 'all' | 'active')}>
                <option value="all">All hospitals (active + suspended)</option>
                <option value="active">Active hospitals only</option>
              </select>
            </Field>
            <Button type="submit" variant="primary" loading={creating}>
              <Megaphone size={16} /> Post announcement
            </Button>
          </form>
        </Card>

        <Card padded>
          <h3 className="card-title mb-2">How it works</h3>
          <ul className="text-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <li>• Announcements appear as dismissible banners at the top of every hospital dashboard.</li>
            <li>• <b>All hospitals</b> reaches every hospital; <b>Active only</b> skips suspended ones.</li>
            <li>• Retiring an announcement instantly hides it everywhere; deleting removes it permanently.</li>
            <li>• Posting and deleting are recorded in the audit log.</li>
          </ul>
        </Card>
      </div>

      <Card padded>
        <h3 className="card-title mb-2">Posted announcements</h3>
        {error && <div className="auth-error mb-4">{error}</div>}
        {loading ? (
          <Spinner label="Loading announcements…" />
        ) : items.length === 0 ? (
          <EmptyState title="No announcements yet" hint="Post your first platform announcement above." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((a) => (
              <div key={a.id} className="card card-pad" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div className="stat-icon stat-icon-teal" style={{ width: 38, height: 38, borderRadius: 10 }}>
                  <Megaphone size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>{a.title}</strong>
                    {a.active ? <Badge tone="green">Live</Badge> : <Badge tone="gray">Retired</Badge>}
                    <Badge tone={a.audience === 'active' ? 'blue' : 'teal'}>{a.audience === 'active' ? 'Active only' : 'All hospitals'}</Badge>
                  </div>
                  <p className="text-sm mt-1">{a.message}</p>
                  <div className="text-sm muted">
                    {fmtDate(a.createdAt)} · by {a.createdBy.email}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button size="sm" variant="outline" loading={busy[a.id]} onClick={() => toggle(a)}>
                    {a.active ? <X size={14} /> : <Check size={14} />} {a.active ? 'Retire' : 'Activate'}
                  </Button>
                  <Button size="sm" variant="danger" loading={busy[a.id]} onClick={() => remove(a)}>
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