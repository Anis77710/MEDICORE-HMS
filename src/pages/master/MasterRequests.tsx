import { useEffect, useMemo, useState } from 'react'
import { Check, X, Mail, Phone, Hash, CalendarDays, IndianRupee } from 'lucide-react'
import { masterApi, type RegistrationRequestItem, type RegistrationStatus } from '../../api/services/master'
import {
  Card, Spinner, EmptyState, Badge, PageHeader, Tabs, Button, ConfirmDialog, Modal, Field, Input,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'

const REQUEST_TONE: Record<string, 'amber' | 'green' | 'blue' | 'red' | 'gray'> = {
  pending_payment: 'amber',
  paid: 'green',
  approved: 'blue',
  rejected: 'red',
}

const TABS: { value: 'all' | RegistrationStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending_payment', label: 'Awaiting payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

type Filter = 'all' | RegistrationStatus

function fmtDate(v?: string): string {
  if (!v) return '—'
  return new Date(v).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function npr(n: number): string {
  return `NPR ${n.toLocaleString('en-US')}`
}

export default function MasterRequests() {
  const { push } = useToast()
  const [items, setItems] = useState<RegistrationRequestItem[]>([])
  const [counts, setCounts] = useState<Record<RegistrationStatus, number>>({
    pending_payment: 0,
    paid: 0,
    approved: 0,
    rejected: 0,
  })
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [approving, setApproving] = useState<RegistrationRequestItem | null>(null)
  const [credentials, setCredentials] = useState<{ username: string } | null>(null)
  const [rejecting, setRejecting] = useState<RegistrationRequestItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = (f: Filter = filter) => {
    setLoading(true)
    setError('')
    masterApi
      .listRequests(f === 'all' ? undefined : f)
      .then((res) => {
        setItems(res.items)
        setCounts((prev) => ({ ...prev, ...res.counts }))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load requests'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(filter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((r) => r.status === filter)),
    [items, filter],
  )

  const approve = async (r: RegistrationRequestItem) => {
    try {
      const res = await masterApi.approveRequest(r._id)
      setApproving(null)
      setCredentials(res.credentials)
      push(`"${r.hospitalName}" approved — hospital is live.`)
      load('paid')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Approval failed')
    }
  }

  const reject = async (r: RegistrationRequestItem) => {
    try {
      await masterApi.rejectRequest(r._id, rejectReason.trim() || undefined)
      setRejecting(null)
      setRejectReason('')
      push(`"${r.hospitalName}" rejected.`)
      load('paid')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Rejection failed')
    }
  }

  return (
    <>
      <PageHeader
        title="Registration Requests"
        subtitle="Review paid registration requests and approve them to provision the hospital."
      />

      <Card className="mb-4" padded>
        <Tabs<Filter>
          tabs={TABS.map((t) =>
            t.value === 'all'
              ? { ...t, count: Object.values(counts).reduce((a, b) => a + b, 0) }
              : { ...t, count: counts[t.value] },
          )}
          active={filter}
          onChange={setFilter}
        />
      </Card>

      <Card padded>
        {error && <div className="auth-error mb-4">{error}</div>}
        {loading ? (
          <Spinner label="Loading requests…" />
        ) : visible.length === 0 ? (
          <EmptyState title="No requests here" hint="New hospital registrations will show up in this list." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Hospital</th>
                  <th>Contact</th>
                  <th>Fee</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r._id}>
                    <td className="mono">{r.regNo}</td>
                    <td>
                      <div className="font-semibold">{r.hospitalName}</div>
                      <div className="text-sm muted mono">/ {r.slug}</div>
                    </td>
                    <td>
                      <div>
                        <Mail size={13} className="inline-icon" /> {r.admin.email}
                      </div>
                      <div className="text-sm muted">
                        {r.admin.name}
                        {r.admin.phone ? (
                          <>
                            {' '}
                            <span className="muted">·</span> <Phone size={12} className="inline-icon" /> {r.admin.phone}
                          </>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <IndianRupee size={13} className="inline-icon" /> {npr(r.payment.amount)}
                    </td>
                    <td>
                      {r.status === 'pending_payment' ? (
                        <span className="text-sm muted">—</span>
                      ) : (
                        <span className="text-sm">{fmtDate(r.payment.paidAt)}</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={REQUEST_TONE[r.status] ?? 'gray'}>{r.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="align-right">
                      {r.status === 'paid' ? (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <Button size="sm" variant="primary" onClick={() => setApproving(r)} data-testid={`approve-${r._id}`}>
                            <Check size={14} /> Approve
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setRejecting(r)}>
                            <X size={14} /> Reject
                          </Button>
                        </div>
                      ) : r.status === 'pending_payment' ? (
                        <span className="text-sm muted">
                          <Hash size={12} className="inline-icon" /> Awaiting eSewa payment
                        </span>
                      ) : (
                        <span className="text-sm muted">
                          <CalendarDays size={12} className="inline-icon" /> {fmtDate(r.approvedAt ?? r.rejectedAt)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!approving}
        title="Approve this registration?"
        confirmLabel="Approve & provision"
        danger={false}
        onCancel={() => setApproving(null)}
        onConfirm={() => approving && approve(approving)}
      >
        {approving && (
          <div className="confirm-message">
            Approving <strong>{approving.hospitalName}</strong> ({approving.regNo}) creates its database
            and admin account, and emails the login credentials plus the payment receipt to{' '}
            <strong>{approving.admin.email}</strong>. This cannot be undone.
          </div>
        )}
      </ConfirmDialog>

      <Modal
        open={!!credentials}
        title="Hospital approved"
        size="sm"
        onClose={() => setCredentials(null)}
        footer={<Button onClick={() => setCredentials(null)}>Done</Button>}
      >
        {credentials && (
          <div className="form-stack">
            <span className="badge badge-green">Hospital is live</span>
            <p className="text-sm">
              Credentials were emailed to the registered address. The login username is:
            </p>
            <div className="cred-box mono">{credentials.username}</div>
            <p className="text-sm muted">The password was generated for the clinic admin and included in the email.</p>
          </div>
        )}
      </Modal>

      <Modal
        open={!!rejecting}
        title={`Reject ${rejecting?.regNo ?? ''}`}
        size="sm"
        onClose={() => setRejecting(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => rejecting && reject(rejecting)}>
              Reject request
            </Button>
          </>
        }
      >
        <div className="form-stack">
          <p className="text-sm">
            The applicant will be emailed that their request was not approved. The fee was already
            paid and cannot be refunded through this panel.
          </p>
          <Field label="Reason (visible to the applicant)">
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Unable to verify your details"
            />
          </Field>
        </div>
      </Modal>
    </>
  )
}
