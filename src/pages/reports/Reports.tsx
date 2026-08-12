import { useEffect, useState } from 'react'
import { generateReport, getReports } from '../../api/services/misc'
import type { ReportSummary } from '../../types'
import {
  PageHeader,
  Card,
  Button,
  StatCard,
  Spinner,
  EmptyState,
  Modal,
  Field,
  Input,
  FormActions,
  Badge,
} from '../../components/ui'
import { Download, FileText, FileSpreadsheet, FileBarChart, RefreshCw, Plus } from 'lucide-react'
import { useToast } from '../../context/ToastContext'

const FORMAT_TONE: Record<string, 'blue' | 'green' | 'purple'> = {
  PDF: 'blue',
  XLSX: 'green',
  CSV: 'purple',
}

const FORMAT_ICON: Record<string, React.ReactNode> = {
  PDF: <FileText size={16} />,
  XLSX: <FileSpreadsheet size={16} />,
  CSV: <FileBarChart size={16} />,
}

const TYPES = ['Revenue', 'Clinical', 'Operations', 'Patient Care']

export default function Reports() {
  const { push } = useToast()
  const [data, setData] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [genOpen, setGenOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'Revenue', period: 'August 2026' })

  useEffect(() => {
    let cancelled = false
    getReports()
      .then((r) => {
        if (!cancelled) setData(r)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load reports')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const generate = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await generateReport(form.name, form.type, form.period)
      setGenOpen(false)
      setForm({ name: '', type: 'Revenue', period: 'August 2026' })
      push('Report generated. It will appear in the list shortly')
      getReports().then(setData).catch(() => undefined)
    } catch (err) {
      push(err instanceof Error ? err.message : 'Generation failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner label="Loading reports…" />
  if (error || !data)
    return (
      <EmptyState title="Reports unavailable" hint={error} />
    )

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        subtitle={`Reporting period: ${data.period}`}
        actions={
          <Button onClick={() => setGenOpen(true)}>
            <Plus size={16} /> Generate Report
          </Button>
        }
      />

      <div className="grid-stats mb-4">
        <StatCard
          label="Revenue (Period)"
          value={`Rs. ${data.totalRevenue.toLocaleString()}`}
          icon={<FileBarChart size={20} />}
          tone="teal"
        />
        <StatCard
          label="Appointments"
          value={data.totalAppointments.toLocaleString()}
          icon={<FileText size={20} />}
          tone="green"
        />
        <StatCard
          label="New Patients"
          value={data.newPatients.toLocaleString()}
          icon={<FileSpreadsheet size={20} />}
          tone="indigo"
        />
        <StatCard
          label="Avg. Wait Time"
          value={`${data.avgWaitTimeMin} min`}
          icon={<RefreshCw size={20} />}
          tone="amber"
        />
      </div>

      <Card>
        <div className="card-header">
          <div>
            <h3 className="card-title">Generated Reports</h3>
            <p className="card-subtitle">{data.reportList.length} reports available</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void getReports().then(setData)}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>

        {data.reportList.length === 0 ? (
          <EmptyState title="No reports yet" hint="Generate your first report to see it here." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Type</th>
                  <th>Period</th>
                  <th>Generated</th>
                  <th>Format</th>
                  <th>Size</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.reportList.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="cell-person">
                        <span className="doc-icon">{FORMAT_ICON[r.format]}</span>
                        <strong className="text-sm">{r.name}</strong>
                      </div>
                    </td>
                    <td>
                      <Badge tone="gray">{r.type}</Badge>
                    </td>
                    <td className="muted">{r.period}</td>
                    <td className="muted">{r.generatedAt}</td>
                    <td>
                      <Badge tone={FORMAT_TONE[r.format] ?? 'blue'}>{r.format}</Badge>
                    </td>
                    <td className="muted">{r.size}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Button variant="outline" size="sm">
                        <Download size={14} /> Download
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={genOpen} title="Generate Report" size="sm" onClose={() => setGenOpen(false)}>
        <form onSubmit={generate}>
          <Field label="Report Name">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Monthly Revenue Summary"
              required
            />
          </Field>
          <Field label="Report Type">
            <select
              className="select"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Period">
            <Input
              value={form.period}
              onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
              placeholder="August 2026"
              required
            />
          </Field>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setGenOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Generate
            </Button>
          </FormActions>
        </form>
      </Modal>
    </>
  )
}
