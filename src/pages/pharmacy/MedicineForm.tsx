import { useEffect, useState } from 'react'
import { createMedicine, updateMedicine } from '../../api/services/pharmacy'
import type { Medicine } from '../../types'
import { Field, Input, Button, FormActions } from '../../components/ui'
import { useToast } from '../../context/ToastContext'

const CATEGORIES = [
  'Antibiotics',
  'Analgesics',
  'Endocrine',
  'Cardiovascular',
  'Gastrointestinal',
  'Respiratory',
  'Supplements',
]

export function MedicineForm({
  medicine,
  onDone,
}: {
  medicine: Medicine | null
  onDone: (saved: boolean) => void
}) {
  const { push } = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    genericName: '',
    category: 'Antibiotics',
    manufacturer: '',
    price: 0,
    stock: 0,
    reorderLevel: 50,
    expiryDate: '',
    batch: '',
  })

  useEffect(() => {
    if (medicine) {
      setForm({
        name: medicine.name,
        genericName: medicine.genericName,
        category: medicine.category,
        manufacturer: medicine.manufacturer,
        price: medicine.price,
        stock: medicine.stock,
        reorderLevel: medicine.reorderLevel,
        expiryDate: medicine.expiryDate,
        batch: medicine.batch,
      })
    }
  }, [medicine])

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (medicine) {
        await updateMedicine(medicine.id, { ...form })
        push('Medicine updated')
      } else {
        await createMedicine({ ...form })
        push('Medicine added')
      }
      onDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save medicine')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Medicine Name">
          <Input value={form.name} onChange={set('name')} required placeholder="Amoxicillin 500mg" />
        </Field>
        <Field label="Generic Name">
          <Input value={form.genericName} onChange={set('genericName')} required placeholder="Amoxicillin" />
        </Field>
        <Field label="Category">
          <select className="select" value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Manufacturer">
          <Input value={form.manufacturer} onChange={set('manufacturer')} required placeholder="Pfizer" />
        </Field>
        <Field label="Price (USD)">
          <Input type="number" min={0} step="0.01" value={form.price} onChange={set('price')} required />
        </Field>
        <Field label="Stock Quantity">
          <Input type="number" min={0} value={form.stock} onChange={set('stock')} required />
        </Field>
        <Field label="Reorder Level">
          <Input type="number" min={0} value={form.reorderLevel} onChange={set('reorderLevel')} required />
        </Field>
        <Field label="Batch Number">
          <Input value={form.batch} onChange={set('batch')} placeholder="AMX-2601" />
        </Field>
        <Field label="Expiry Date">
          <Input type="date" value={form.expiryDate} onChange={set('expiryDate')} required />
        </Field>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <FormActions>
        <Button type="button" variant="outline" onClick={() => onDone(false)}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {medicine ? 'Save Changes' : 'Add Medicine'}
        </Button>
      </FormActions>
    </form>
  )
}
