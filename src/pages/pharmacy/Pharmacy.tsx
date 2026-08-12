import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2, Pill, Plus, AlertTriangle, PackageX } from 'lucide-react'
import { listMedicines, deleteMedicine, listPrescriptions } from '../../api/services/pharmacy'
import type { Medicine, Prescription } from '../../types'
import {
  PageHeader,
  Card,
  Button,
  SearchInput,
  StatusBadge,
  Spinner,
  EmptyState,
  ConfirmDialog,
  Modal,
  Badge,
  StatCard,
} from '../../components/ui'
import { MedicineForm } from './MedicineForm'
import { useToast } from '../../context/ToastContext'
import { usePermissions } from '../../rbac/usePermissions'

const CATEGORIES = [
  'All',
  'Antibiotics',
  'Analgesics',
  'Endocrine',
  'Cardiovascular',
  'Gastrointestinal',
  'Respiratory',
  'Supplements',
]

export default function Pharmacy() {
  const { push } = useToast()
  const { can } = usePermissions()
  const [items, setItems] = useState<Medicine[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Medicine | null>(null)
  const [deleting, setDeleting] = useState<Medicine | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [tab, setTab] = useState<'inventory' | 'prescriptions'>('inventory')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([listMedicines({ search: search || undefined, category }), listPrescriptions({})])
      .then(([meds, rxs]) => {
        if (cancelled) return
        setItems(meds)
        setPrescriptions(rxs)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load pharmacy')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [search, category, refreshKey])

  const stats = useMemo(() => {
    const stockValue = items.reduce((s, m) => s + m.price * m.stock, 0)
    const low = items.filter((m) => m.status === 'Low Stock' || m.status === 'Out of Stock')
    return {
      stockValue,
      lowCount: low.length,
      outOfStock: items.filter((m) => m.status === 'Out of Stock').length,
      activeRx: prescriptions.filter((p) => p.status === 'Active').length,
    }
  }, [items, prescriptions])

  return (
    <>
      <PageHeader
        title="Pharmacy"
        subtitle={`${items.length} medicines in inventory`}
        actions={
          tab === 'inventory' && can('pharmacy', 'create') ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={16} /> Add Medicine
            </Button>
          ) : undefined
        }
      />

      <div className="grid-stats mb-4">
        <StatCard
          label="Inventory Value"
          value={`Rs. ${stats.stockValue.toLocaleString()}`}
          icon={<Pill size={20} />}
          tone="teal"
        />
        <StatCard
          label="Low / Out of Stock"
          value={`${stats.lowCount}`}
          icon={<AlertTriangle size={20} />}
          tone="amber"
        />
        <StatCard
          label="Out of Stock Items"
          value={`${stats.outOfStock}`}
          icon={<PackageX size={20} />}
          tone="red"
        />
        <StatCard
          label="Active Prescriptions"
          value={`${stats.activeRx}`}
          icon={<Pill size={20} />}
          tone="green"
        />
      </div>

      <Card>
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search medicine or generic name…"
            />
          </div>
          <div className="chips">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={`chip ${category === c ? 'chip-active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="tab-switch">
          <button
            className={`tab-switch-btn ${tab === 'inventory' ? 'tab-switch-active' : ''}`}
            onClick={() => setTab('inventory')}
          >
            Inventory
          </button>
          <button
            className={`tab-switch-btn ${tab === 'prescriptions' ? 'tab-switch-active' : ''}`}
            onClick={() => setTab('prescriptions')}
          >
            Prescriptions
          </button>
        </div>

        {loading ? (
          <Spinner label="Loading pharmacy…" />
        ) : error ? (
          <div className="empty-state">{error}</div>
        ) : tab === 'inventory' ? (
          items.length === 0 ? (
            <EmptyState title="No medicines found" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Category</th>
                    <th>Manufacturer</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Batch</th>
                    <th>Expiry</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="cell-person">
                          <span className="doc-icon">
                            <Pill size={16} />
                          </span>
                          <div>
                            <strong className="text-sm">{m.name}</strong>
                            <div className="muted text-xs">{m.genericName}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone="gray">{m.category}</Badge>
                      </td>
                      <td className="muted">{m.manufacturer}</td>
                      <td>रू {m.price.toFixed(2)}</td>
                      <td>
                        <strong
                          className={
                            m.stock === 0
                              ? 'text-danger'
                              : m.stock <= m.reorderLevel
                                ? 'text-warning'
                                : ''
                          }
                        >
                          {m.stock}
                        </strong>
                        <div className="muted text-xs">reorder @ {m.reorderLevel}</div>
                      </td>
                      <td className="muted">{m.batch}</td>
                      <td className="muted">{m.expiryDate}</td>
                      <td>
                        <StatusBadge status={m.status} />
                      </td>
                      <td>
                        <div className="cell-actions">
                          {can('pharmacy', 'edit') && (
                            <button
                              className="icon-btn"
                              title="Edit"
                              onClick={() => {
                                setEditing(m)
                                setFormOpen(true)
                              }}
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {can('pharmacy', 'delete') && (
                            <button
                              className="icon-btn icon-btn-danger"
                              title="Delete"
                              onClick={() => setDeleting(m)}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : prescriptions.length === 0 ? (
          <EmptyState title="No prescriptions" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Medicines</th>
                  <th>Issued</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="cell-person">
                        <strong>{r.patientName}</strong>
                      </div>
                    </td>
                    <td>{r.doctorName}</td>
                    <td>
                      <div className="text-sm">
                        {r.medicines.map((m) => (
                          <div key={m.name}>
                            <strong>{m.name}</strong> · {m.dosage} · {m.frequency}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="muted">{r.issuedAt}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={formOpen}
        title={editing ? 'Edit Medicine' : 'Add Medicine'}
        size="md"
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
      >
        <MedicineForm
          medicine={editing}
          onDone={(saved) => {
            setFormOpen(false)
            setEditing(null)
            setRefreshKey((k) => k + 1)
            if (saved) push(editing ? 'Medicine updated' : 'Medicine added')
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete Medicine"
        message={`Delete ${deleting?.name} from inventory? This cannot be undone.`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await deleteMedicine(deleting.id)
          setDeleting(null)
          setRefreshKey((k) => k + 1)
          push('Medicine deleted')
        }}
      />
    </>
  )
}
