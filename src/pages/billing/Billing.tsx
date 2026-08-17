import { useEffect, useMemo, useState } from 'react'
import { Receipt, Plus, Download, CreditCard, Banknote, HandCoins, Wallet, Building2, Wand2 } from 'lucide-react'
import { listInvoices, recordPayment, createInvoice, autoDraftInvoice } from '../../api/services/billing'
import { listPatients } from '../../api/services/patients'
import type { Invoice, PaymentRecord } from '../../types'
import {
  PageHeader,
  Card,
  Button,
  SearchInput,
  StatusBadge,
  Spinner,
  EmptyState,
  Modal,
  Field,
  Input,
  FormActions,
  StatCard,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'

const FILTERS = ['All', 'Paid', 'Pending', 'Overdue', 'Refunded'] as const
const METHODS = ['Card', 'Cash', 'Bank Transfer', 'Insurance', 'UPI'] as const

export default function Billing() {
  const { push } = useToast()
  const [items, setItems] = useState<Invoice[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [paying, setPaying] = useState<Invoice | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [form, setForm] = useState({
    patientId: '',
    description: '',
    discount: 0,
    dueDate: '',
    itemsText: '',
  })
  const [payForm, setPayForm] = useState({ amount: 0, method: 'Card' as (typeof METHODS)[number] })
  const [payBusy, setPayBusy] = useState(false)
  const [autoBusy, setAutoBusy] = useState(false)
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listInvoices({ search: search || undefined, status: filter })
      .then((res) => {
        if (!cancelled) setItems(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load invoices')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [search, filter, refreshKey])

  useEffect(() => {
    listPatients({ limit: 100 })
      .then((r) =>
        setPatients(r.items.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))),
      )
      .catch(() => setPatients([]))
  }, [])

  const totals = useMemo(() => {
    const outstanding = items
      .filter((i) => i.status !== 'Paid')
      .reduce((s, i) => s + (i.total - i.amountPaid), 0)
    const collected = items.reduce((s, i) => s + i.amountPaid, 0)
    const billed = items.reduce((s, i) => s + i.total, 0)
    return { outstanding, collected, billed, count: items.length }
  }, [items])

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = form.itemsText
      .split('\n')
      .map((line) => {
        const [description, amount] = line.split(',')
        return { description: description?.trim(), amount: parseFloat(amount ?? '0') }
      })
      .filter((i) => i.description && !Number.isNaN(i.amount))
    await createInvoice({
      patientId: form.patientId,
      description: form.description,
      discount: Number(form.discount) || 0,
      dueDate: form.dueDate,
      items: parsed,
    })
    setNewOpen(false)
    setForm({ patientId: '', description: '', discount: 0, dueDate: '', itemsText: '' })
    setRefreshKey((k) => k + 1)
    push('Invoice created')
  }

  const handleAutoFill = async () => {
    if (!form.patientId) {
      push('Select a patient first', 'error')
      return
    }
    setAutoBusy(true)
    try {
      const draft = await autoDraftInvoice(form.patientId)
      if (draft.items.length === 0) {
        push('No billable activity found for this patient', 'error')
        return
      }
      const text = draft.items.map((i) => `${i.description}, ${i.amount}`).join('\n')
      setForm((f) => ({
        ...f,
        itemsText: text,
        description: f.description || `Invoice for ${draft.patientName}`,
      }))
      push(`Auto-filled ${draft.items.length} item(s) - total NPR ${draft.total.toLocaleString()}`)
    } catch (err) {
      push(err instanceof Error ? err.message : 'Auto-fill failed', 'error')
    } finally {
      setAutoBusy(false)
    }
  }

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paying) return
    setPayBusy(true)
    try {
      const { invoice } = await recordPayment({
        invoiceId: paying.id,
        amount: Number(payForm.amount),
        method: payForm.method,
      })
      setPaying(null)
      setRefreshKey((k) => k + 1)
      push(
        invoice.status === 'Paid'
          ? 'Invoice fully paid'
          : `Payment recorded (NPR ${payForm.amount.toLocaleString()})`,
      )
    } catch (err) {
      push(err instanceof Error ? err.message : 'Payment failed', 'error')
    } finally {
      setPayBusy(false)
    }
  }

  const methodIcon = (m: PaymentRecord['method']) =>
    m === 'Cash' ? <Banknote size={15} /> : m === 'Card' ? <CreditCard size={15} /> : m === 'UPI' ? <Wallet size={15} /> : m === 'Insurance' ? <HandCoins size={15} /> : <Building2 size={15} />

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle={`${totals.count} invoices`}
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus size={16} /> New Invoice
          </Button>
        }
      />

      <div className="grid-stats mb-4">
        <StatCard
          label="Total Billed"
          value={`NPR ${totals.billed.toLocaleString()}`}
          icon={<Receipt size={20} />}
          tone="teal"
        />
        <StatCard
          label="Collected"
          value={`NPR ${totals.collected.toLocaleString()}`}
          icon={<Wallet size={20} />}
          tone="green"
        />
        <StatCard
          label="Outstanding"
          value={`NPR ${totals.outstanding.toLocaleString()}`}
          icon={<CreditCard size={20} />}
          tone="amber"
        />
      </div>

      <Card>
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <SearchInput value={search} onChange={setSearch} placeholder="Search invoice or patient…" />
          </div>
          <div className="chips">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`chip ${filter === f ? 'chip-active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading invoices…" />
        ) : error ? (
          <div className="empty-state">{error}</div>
        ) : items.length === 0 ? (
          <EmptyState title="No invoices found" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Patient</th>
                  <th>Description</th>
                  <th>Issued</th>
                  <th>Due</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const balance = i.total - i.amountPaid
                  return (
                    <tr key={i.id}>
                      <td className="font-semibold">{i.invoiceNo}</td>
                      <td>
                        <strong className="text-sm">{i.patientName}</strong>
                      </td>
                      <td className="muted">{i.description}</td>
                      <td className="muted">{i.issuedAt}</td>
                      <td className="muted">{i.dueDate}</td>
                      <td className="font-semibold">NPR {i.total.toLocaleString()}</td>
                      <td>NPR {i.amountPaid.toLocaleString()}</td>
                      <td className={balance > 0 ? 'text-danger font-semibold' : 'muted'}>
                        NPR {balance.toLocaleString()}
                      </td>
                      <td>
                        <StatusBadge status={i.status} />
                      </td>
                      <td>
                        <div className="cell-actions">
                          {balance > 0 && (
                            <Button size="sm" onClick={() => {
                              setPaying(i)
                              setPayForm({ amount: balance, method: 'Card' })
                            }}>
                              Record Payment
                            </Button>
                          )}
                          <button className="icon-btn" title="Download invoice">
                            <Download size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* New invoice */}
      <Modal open={newOpen} title="Create Invoice" size="md" onClose={() => setNewOpen(false)}>
        <form onSubmit={handleCreateInvoice}>
          <Field label="Patient">
            <select
              className="select"
              value={form.patientId}
              onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
              required
            >
              <option value="">Select a patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Cardiac care package"
              required
            />
          </Field>
          <Field
            label="Line Items"
            hint="One per line: description, amount (e.g. Consultation, 120)"
            action={
              <Button type="button" size="sm" variant="outline" onClick={handleAutoFill} disabled={autoBusy || !form.patientId}>
                <Wand2 size={14} /> {autoBusy ? 'Computing…' : 'Auto-fill from patient activity'}
              </Button>
            }
          >
            <textarea
              className="textarea"
              rows={4}
              value={form.itemsText}
              onChange={(e) => setForm((f) => ({ ...f, itemsText: e.target.value }))}
              placeholder={'Consultation, 120\nECG & echo, 340\nRoom charges, 1400'}
              required
            />
          </Field>
          <div className="form-grid">
            <Field label="Discount (NPR)">
              <Input
                type="number"
                min={0}
                value={form.discount}
                onChange={(e) => setForm((f) => ({ ...f, discount: parseFloat(e.target.value) || 0 }))}
              />
            </Field>
            <Field label="Due Date">
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                required
              />
            </Field>
          </div>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Invoice</Button>
          </FormActions>
        </form>
      </Modal>

      {/* Record payment */}
      <Modal
        open={!!paying}
        title={`Record Payment - ${paying?.invoiceNo ?? ''}`}
        size="sm"
        onClose={() => setPaying(null)}
      >
        {paying && (
          <form onSubmit={submitPayment}>
            <div className="pay-summary">
              <div>
                <span className="muted text-sm">Total</span>
                <strong>NPR {paying.total.toLocaleString()}</strong>
              </div>
              <div>
                <span className="muted text-sm">Paid so far</span>
                <strong>NPR {paying.amountPaid.toLocaleString()}</strong>
              </div>
              <div>
                <span className="muted text-sm">Balance</span>
                <strong className="text-danger">
                  NPR {(paying.total - paying.amountPaid).toLocaleString()}
                </strong>
              </div>
            </div>
            <Field label="Amount (NPR)">
              <Input
                type="number"
                min={0}
                max={paying.total - paying.amountPaid}
                value={payForm.amount}
                onChange={(e) => setPayForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                required
              />
            </Field>
            <Field label="Payment Method">
              <select
                className="select"
                value={payForm.method}
                onChange={(e) =>
                  setPayForm((f) => ({ ...f, method: e.target.value as (typeof METHODS)[number] }))
                }
              >
                {METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <FormActions>
              <Button type="button" variant="outline" onClick={() => setPaying(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={payBusy}>
                {methodIcon(payForm.method)} Record Payment
              </Button>
            </FormActions>
          </form>
        )}
      </Modal>
    </>
  )
}

