import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Mail, Users, Stethoscope, CalendarDays, Pause, Play, Eye, EyeOff, Trash2, Globe } from 'lucide-react'
import { masterApi, type MasterHospital } from '../../api/services/master'
import { Card, Spinner, Badge, PageHeader, Button, ConfirmDialog, StatCard } from '../../components/ui'
import { useToast } from '../../context/ToastContext'

const HOSPITAL_TONE: Record<string, 'green' | 'gray'> = {
  active: 'green',
  suspended: 'gray',
}

function fmtDate(s?: string): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MasterHospitalDetail() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { push } = useToast()
  const [hospital, setHospital] = useState<MasterHospital | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    masterApi
      .hospitalDetail(slug)
      .then(setHospital)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load hospital'))
      .finally(() => setLoading(false))
  }, [slug])

  const setStatus = async (status: 'active' | 'suspended') => {
    if (!hospital) return
    setBusy(true)
    try {
      const updated = await masterApi.setHospitalStatus(hospital.slug, status)
      setHospital((h) => (h ? { ...h, status: updated.status } : h))
      push(`"${hospital.name}" ${status === 'active' ? 'activated' : 'suspended'}.`)
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setBusy(false)
    }
  }

  const toggleListed = async () => {
    if (!hospital) return
    setBusy(true)
    try {
      const updated = await masterApi.setHospitalListed(hospital.slug, !hospital.listed)
      setHospital((h) => (h ? { ...h, listed: updated.listed } : h))
      push(`"${hospital.name}" ${updated.listed ? 'listed in the public directory' : 'hidden from the public directory'}.`)
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to update listing')
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    if (!hospital) return
    try {
      await masterApi.deleteHospital(hospital.slug)
      push(`"${hospital.name}" deleted.`)
      setConfirmDelete(false)
      navigate('/master/hospitals')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to delete hospital')
    }
  }

  if (error) return <div className="auth-error">{error}</div>
  if (loading || !hospital) return <Spinner label="Loading hospital…" />

  return (
    <>
      <PageHeader
        title={hospital.name}
        subtitle={`/ ${hospital.slug} · ${hospital.adminEmail}`}
        actions={
          <Link to="/master/hospitals" className="btn btn-outline btn-sm">
            <ArrowLeft size={15} /> Back to Hospitals
          </Link>
        }
      />

      <div className="grid-stats mb-4">
        <StatCard label="Patients" value={String(hospital.counts?.patients ?? 0)} icon={<Users size={20} />} tone="teal" />
        <StatCard label="Doctors" value={String(hospital.counts?.doctors ?? 0)} icon={<Stethoscope size={20} />} tone="indigo" />
        <StatCard label="Appointments" value={String(hospital.counts?.appointments ?? 0)} icon={<CalendarDays size={20} />} tone="amber" />
      </div>

      <div className="grid-2">
        <Card padded>
          <h3 className="card-title mb-2">Overview</h3>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                <tr>
                  <td className="muted">Hospital code</td>
                  <td className="mono">{hospital.slug}</td>
                </tr>
                <tr>
                  <td className="muted">Status</td>
                  <td>
                    <Badge tone={HOSPITAL_TONE[hospital.status] ?? 'gray'}>{hospital.status}</Badge>
                  </td>
                </tr>
                <tr>
                  <td className="muted">Public directory</td>
                  <td>{hospital.listed ? <Badge tone="blue">Listed</Badge> : <Badge tone="gray">Hidden</Badge>}</td>
                </tr>
                <tr>
                  <td className="muted">Admin contact</td>
                  <td>
                    <a href={`mailto:${hospital.adminEmail}`} className="inline-icon-wrap">
                      <Mail size={14} /> {hospital.adminEmail}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="muted">Database</td>
                  <td className="mono">{hospital.dbName}</td>
                </tr>
                <tr>
                  <td className="muted">Registered</td>
                  <td>{fmtDate(hospital.createdAt)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card padded>
          <h3 className="card-title mb-2">Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hospital.status === 'suspended' ? (
              <Button variant="outline" loading={busy} onClick={() => setStatus('active')}>
                <Play size={16} /> Activate hospital
              </Button>
            ) : (
              <Button variant="outline" loading={busy} onClick={() => setStatus('suspended')}>
                <Pause size={16} /> Suspend hospital
              </Button>
            )}
            <Button variant="outline" loading={busy} onClick={toggleListed}>
              {hospital.listed ? <EyeOff size={16} /> : <Eye size={16} />}
              {hospital.listed ? 'Hide from public directory' : 'List in public directory'}
            </Button>
            <Link to={`/master/hospitals`} className="btn btn-outline">
              <Globe size={16} /> View public page
            </Link>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} /> Delete hospital
            </Button>
          </div>
          <div className="muted text-sm mt-4" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={15} />
            Deleting permanently drops this hospital's entire database.
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this hospital?"
        confirmLabel="Type DELETE"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={doDelete}
      >
        <div className="confirm-message">
          Deleting <strong>{hospital.name}</strong> ({hospital.slug}) permanently drops its entire database — every
          patient, doctor, appointment, billing and pharmacy record. This cannot be undone.
        </div>
      </ConfirmDialog>
    </>
  )
}