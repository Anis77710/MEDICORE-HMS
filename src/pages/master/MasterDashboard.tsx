import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2, ClipboardList, IndianRupee, Activity, ArrowRight,
} from 'lucide-react'
import { masterApi, type MasterStats } from '../../api/services/master'
import { Card, StatCard, Spinner, EmptyState, Badge, PageHeader } from '../../components/ui'

const REQUEST_TONE: Record<string, 'amber' | 'green' | 'blue' | 'red' | 'gray'> = {
  pending_payment: 'amber',
  paid: 'green',
  approved: 'blue',
  rejected: 'red',
}

const HOSPITAL_TONE: Record<string, 'green' | 'gray'> = {
  active: 'green',
  suspended: 'gray',
}

function npr(n: number): string {
  return `NPR ${n.toLocaleString('en-US')}`
}

export default function MasterDashboard() {
  const [stats, setStats] = useState<MasterStats | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    masterApi.stats().then(setStats).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }
  useEffect(() => {
    load()
  }, [])

  if (error) return <div className="auth-error">{error}</div>
  if (!stats) return <Spinner label="Loading platform overview…" />

  const paidAwaiting = stats.requests.paid
  const pendingPay = stats.requests.pending_payment

  return (
    <>
      <PageHeader
        title={`${stats.siteName} — Platform Overview`}
        subtitle="Every hospital on the Medicore platform, at a glance."
        actions={
          <>
            <Link to="/master/requests" className="btn btn-outline">
              <ClipboardList size={16} /> Requests
            </Link>
            <Link to="/master/hospitals" className="btn btn-primary">
              <Building2 size={16} /> Manage Hospitals
            </Link>
          </>
        }
      />

      {paidAwaiting > 0 && (
        <div className="alert alert-warning mb-4" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ClipboardList size={17} />
          <span>
            <strong>{paidAwaiting} paid registration{paidAwaiting === 1 ? '' : 's'}</strong> awaiting your approval.{' '}
            <Link to="/master/requests">Review requests</Link>
          </span>
        </div>
      )}

      <div className="grid-stats mb-4">
        <StatCard
          label="Total Hospitals"
          value={String(stats.hospitals.total)}
          icon={<Building2 size={20} />}
          tone="teal"
          footer={
            <span>
              {stats.hospitals.active} active · {stats.hospitals.suspended} suspended
            </span>
          }
        />
        <StatCard
          label="Total Revenue"
          value={npr(stats.revenue)}
          icon={<IndianRupee size={20} />}
          tone="green"
          footer={<span>{npr(stats.registrationFee).replace('NPR ', '')} / registration</span>}
        />
        <StatCard
          label="Registrations"
          value={String(stats.requests.pending_payment + stats.requests.paid + stats.requests.approved)}
          icon={<ClipboardList size={20} />}
          tone="amber"
          footer={
            <span>
              {pendingPay} awaiting payment · {paidAwaiting} to approve
            </span>
          }
        />
        <StatCard
          label="Approved Requests"
          value={String(stats.requests.approved)}
          icon={<Activity size={20} />}
          tone="indigo"
          footer={<span>{stats.requests.rejected} rejected</span>}
        />
      </div>

      <div className="grid-2">
        <Card padded>
          <div className="card-title-row">
            <h3 className="card-title">Recent Registration Requests</h3>
            <Link to="/master/requests" className="btn btn-ghost btn-sm">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {stats.recentRequests.length === 0 ? (
            <EmptyState title="No registration requests yet" hint="New hospital registrations will appear here." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Hospital</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentRequests.map((r) => (
                    <tr key={r.regNo}>
                      <td className="mono">{r.regNo}</td>
                      <td>{r.hospitalName}</td>
                      <td>
                        <Badge tone={REQUEST_TONE[r.status] ?? 'gray'}>{r.status.replace('_', ' ')}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card padded>
          <div className="card-title-row">
            <h3 className="card-title">Recent Hospitals</h3>
            <Link to="/master/hospitals" className="btn btn-ghost btn-sm">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {stats.recentHospitals.length === 0 ? (
            <EmptyState title="No hospitals yet" hint="Approved registrations go live here." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Hospital</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {stats.recentHospitals.map((h) => (
                    <tr key={h.slug}>
                      <td>
                        <span className="font-semibold">{h.name}</span>
                      </td>
                      <td>
                        <Badge tone={HOSPITAL_TONE[h.status] ?? 'gray'}>{h.status}</Badge>
                      </td>
                      <td>{h.listed ? <Badge tone="blue">Listed</Badge> : <Badge tone="gray">Hidden</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {stats.requests.paid > 0 && (
        <Card padded className="mt-4">
          <h3 className="card-title">Approvals to process</h3>
          <div className="flex" style={{ gap: 12 }}>
            {stats.recentRequests
              .filter((r) => r.status === 'paid')
              .slice(0, 6)
              .map((r) => (
                <span key={r.regNo} className="chip">
                  {r.regNo} — {r.hospitalName}
                </span>
              ))}
          </div>
        </Card>
      )}
    </>
  )
}
