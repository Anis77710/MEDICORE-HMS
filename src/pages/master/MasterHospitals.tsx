import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pause, Play, Eye, EyeOff, Trash2, Users, Stethoscope, CalendarDays, ChevronRight, ChevronUp, ChevronDown, Save } from 'lucide-react'
import { masterApi, type MasterHospital } from '../../api/services/master'
import {
  Card, Spinner, EmptyState, Badge, PageHeader, Button, SearchInput, ConfirmDialog,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'

const HOSPITAL_TONE: Record<string, 'green' | 'gray'> = {
  active: 'green',
  suspended: 'gray',
}

export default function MasterHospitals() {
  const { push } = useToast()
  const [items, setItems] = useState<MasterHospital[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [deleting, setDeleting] = useState<MasterHospital | null>(null)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [order, setOrder] = useState<string[]>([])
  const [orderDirty, setOrderDirty] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)

  const load = () =>
    masterApi
      .listHospitals(true)
      .then((res) => {
        setItems(res.items)
        setOrder(res.items.filter((h) => h.listed).map((h) => h.slug))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load hospitals'))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const setStatus = async (h: MasterHospital, status: 'active' | 'suspended') => {
    setBusy((b) => ({ ...b, [h.slug]: true }))
    try {
      const updated = await masterApi.setHospitalStatus(h.slug, status)
      setItems((list) => list.map((x) => (x.slug === h.slug ? { ...x, status: updated.status } : x)))
      push(`"${h.name}" ${status === 'active' ? 'activated' : 'suspended'}.`)
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setBusy((b) => ({ ...b, [h.slug]: false }))
    }
  }

  const toggleListed = async (h: MasterHospital) => {
    setBusy((b) => ({ ...b, [h.slug]: true }))
    try {
      const updated = await masterApi.setHospitalListed(h.slug, !h.listed)
      setItems((list) => list.map((x) => (x.slug === h.slug ? { ...x, listed: updated.listed } : x)))
      push(`"${h.name}" ${updated.listed ? 'is now listed in the public directory' : 'removed from the public directory'}.`)
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to update listing')
    } finally {
      setBusy((b) => ({ ...b, [h.slug]: false }))
    }
  }

  const doDelete = async () => {
    if (!deleting) return
    try {
      await masterApi.deleteHospital(deleting.slug)
      setItems((list) => list.filter((x) => x.slug !== deleting.slug))
      push(`"${deleting.name}" deleted.`)
      setDeleting(null)
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to delete hospital')
    }
  }

  const filtered = items.filter(
    (h) =>
      h.name.toLowerCase().includes(query.toLowerCase()) ||
      h.slug.toLowerCase().includes(query.toLowerCase()) ||
      h.adminEmail.toLowerCase().includes(query.toLowerCase()),
  )

  const moveOrder = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= order.length) return
    const next = [...order]
    ;[next[index], next[target]] = [next[target], next[index]]
    setOrder(next)
    setOrderDirty(true)
  }

  const saveOrder = async () => {
    setSavingOrder(true)
    try {
      await masterApi.setDirectoryOrder(order)
      setOrderDirty(false)
      push('Public directory order saved.')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to save directory order')
    } finally {
      setSavingOrder(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Hospitals"
        subtitle="Activate, suspend, list or remove every hospital on the platform."
        actions={<SearchInput value={query} onChange={setQuery} placeholder="Search hospitals…" />}
      />

      <Card padded className="mb-4">
        <div className="card-title-row">
          <h3 className="card-title">Public Directory Order</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {orderDirty && (
              <Button size="sm" variant="primary" loading={savingOrder} onClick={saveOrder}>
                <Save size={14} /> Save order
              </Button>
            )}
          </div>
        </div>
        {order.length === 0 ? (
          <p className="text-sm muted">No hospitals are listed in the public directory yet — use <b>List</b> below.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {order.map((slug, i) => {
              const h = items.find((x) => x.slug === slug)
              if (!h) return null
              return (
                <div key={slug} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="mono text-sm muted" style={{ width: 26 }}>{i + 1}.</span>
                  <span className="font-semibold" style={{ flex: 1 }}>{h.name}</span>
                  <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => moveOrder(i, -1)} aria-label="Move up">
                    <ChevronUp size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" disabled={i === order.length - 1} onClick={() => moveOrder(i, 1)} aria-label="Move down">
                    <ChevronDown size={14} />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card padded>
        {error && <div className="auth-error mb-4">{error}</div>}
        {loading ? (
          <Spinner label="Loading hospitals…" />
        ) : items.length === 0 ? (
          <EmptyState title="No hospitals yet" hint="Approved registration requests will create hospitals here." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matching hospitals" hint="Try a different search." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Status</th>
                  <th>Directory</th>
                  <th>Records</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => (
                  <tr key={h.slug}>
                    <td>
                      <Link to={`/master/hospitals/${h.slug}`} className="font-semibold">
                        {h.name}
                      </Link>
                      <div className="text-sm muted mono">/ {h.slug}</div>
                      <div className="text-sm muted">{h.adminEmail}</div>
                    </td>
                    <td>
                      <Badge tone={HOSPITAL_TONE[h.status] ?? 'gray'}>{h.status}</Badge>
                    </td>
                    <td>
                      {h.listed ? <Badge tone="blue">Listed</Badge> : <Badge tone="gray">Hidden</Badge>}
                    </td>
                    <td>
                      {h.counts ? (
                        <div className="text-sm">
                          <span className="inline-icon-wrap">
                            <Users size={13} /> {h.counts.patients}
                          </span>{' '}
                          <span className="inline-icon-wrap">
                            <Stethoscope size={13} /> {h.counts.doctors}
                          </span>{' '}
                          <span className="inline-icon-wrap">
                            <CalendarDays size={13} /> {h.counts.appointments}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm muted">—</span>
                      )}
                    </td>
                    <td className="align-right">
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Link to={`/master/hospitals/${h.slug}`} className="btn btn-ghost btn-sm" title="View details">
                          <ChevronRight size={14} />
                        </Link>
                        {h.status === 'suspended' ? (
                          <Button size="sm" variant="outline" loading={busy[h.slug]} onClick={() => setStatus(h, 'active')}>
                            <Play size={14} /> Activate
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" loading={busy[h.slug]} onClick={() => setStatus(h, 'suspended')}>
                            <Pause size={14} /> Suspend
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" loading={busy[h.slug]} onClick={() => toggleListed(h)}>
                          {h.listed ? <EyeOff size={14} /> : <Eye size={14} />} {h.listed ? 'Hide' : 'List'}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleting(h)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this hospital?"
        confirmLabel="Type DELETE"
        onCancel={() => setDeleting(null)}
        onConfirm={doDelete}
      >
        {deleting && (
          <div className="confirm-message">
            Deleting <strong>{deleting.name}</strong> ({deleting.slug}) permanently drops its entire
            database — every patient, doctor, appointment, billing and pharmacy record. This cannot be
            undone.
          </div>
        )}
      </ConfirmDialog>
    </>
  )
}
