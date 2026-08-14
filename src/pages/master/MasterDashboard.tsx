import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2, ClipboardList, IndianRupee, Activity, ArrowRight, TrendingUp, Banknote,
} from 'lucide-react'
import { masterApi, type MasterStats, type AnalyticsRange, type AnalyticsResponse } from '../../api/services/master'
import { Card, StatCard, Spinner, EmptyState, Badge, PageHeader, Button } from '../../components/ui'
import { AreaChart, BarChart, DonutChart } from '../../components/charts'

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

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '1y', label: '1y' },
  { value: 'all', label: 'All' },
]

function npr(n: number): string {
  return `NPR ${n.toLocaleString('en-US')}`
}

export default function MasterDashboard() {
  const [stats, setStats] = useState<MasterStats | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [range, setRange] = useState<AnalyticsRange>('30d')
  const [error, setError] = useState('')

  const load = () => {
    masterApi.stats().then(setStats).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }
  const loadAnalytics = (r: AnalyticsRange) => {
    masterApi.analytics(r).then(setAnalytics).catch(() => {
      /* charts are secondary — dashboard still renders with stats */
    })
  }
  useEffect(() => {
    load()
  }, [])
  useEffect(() => {
    loadAnalytics(range)
  }, [range])

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
            <Link to="/master/analytics" className="btn btn-outline">
              <TrendingUp size={16} /> Analytics
            </Link>
            <Link to="/master/receipts" className="btn btn-outline">
              <Banknote size={16} /> Receipts
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

      {analytics && (
        <>
          <div className="grid-2 mb-4">
            <Card padded>
              <div className="card-title-row">
                <h3 className="card-title">Revenue</h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  {RANGES.map((r) => (
                    <Button key={r.value} size="sm" variant={range === r.value ? 'primary' : 'ghost'} onClick={() => setRange(r.value)}>
                      {r.label}
                    </Button>
                  ))}
                </div>
              </div>
              {analytics.revenueSeries.length === 0 ? (
                <EmptyState title="No revenue yet" hint="Approved registration fees will appear here." />
              ) : (
                <AreaChart data={analytics.revenueSeries} color="#059669" width={520} height={200} />
              )}
              <div className="text-sm muted" style={{ marginTop: 8 }}>
                Collected <strong style={{ color: 'var(--text)' }}>{npr(analytics.revenue.collected)}</strong> · Pending{' '}
                <strong style={{ color: 'var(--text)' }}>{npr(analytics.revenue.pending)}</strong> · Next 30 days{' '}
                <strong style={{ color: 'var(--text)' }}>{npr(analytics.projection.next30Days)}</strong>
              </div>
            </Card>

            <Card padded>
              <div className="card-title-row">
                <h3 className="card-title">Registrations</h3>
                <Link to="/master/analytics" className="btn btn-ghost btn-sm">
                  Full analytics <ArrowRight size={14} />
                </Link>
              </div>
              {analytics.registrationSeries.length === 0 ? (
                <EmptyState title="No registrations yet" hint="New hospital registrations will appear here." />
              ) : (
                <BarChart data={analytics.registrationSeries} color="#0e7490" height={200} />
              )}
            </Card>
          </div>

          <div className="grid-2 mb-4">
            <Card padded>
              <h3 className="card-title mb-2">Registration Funnel</h3>
              <DonutChart
                data={[
                  { label: 'Initiated', value: analytics.funnel.pending_payment + analytics.funnel.paid + analytics.funnel.approved + analytics.funnel.rejected },
                  { label: 'Paid', value: analytics.funnel.paid + analytics.funnel.approved },
                  { label: 'Approved', value: analytics.funnel.approved },
                ]}
                centerLabel="requests"
                centerValue={String(analytics.funnel.pending_payment + analytics.funnel.paid + analytics.funnel.approved + analytics.funnel.rejected)}
              />
            </Card>

            <Card padded>
              <div className="card-title-row">
                <h3 className="card-title">Top Hospitals</h3>
                <Link to="/master/hospitals" className="btn btn-ghost btn-sm">
                  Manage <ArrowRight size={14} />
                </Link>
              </div>
              {analytics.top.length === 0 ? (
                <EmptyState title="No active hospitals" hint="Approved hospitals appear here by activity." />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Hospital</th>
                        <th>Patients</th>
                        <th>Doctors</th>
                        <th>Appts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.top.slice(0, 5).map((h) => (
                        <tr key={h.slug}>
                          <td>
                            <Link to={`/master/hospitals/${h.slug}`} className="font-semibold">{h.name}</Link>
                          </td>
                          <td>{h.patients}</td>
                          <td>{h.doctors}</td>
                          <td>{h.appointments}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

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
                        <Link to={`/master/hospitals/${h.slug}`} className="font-semibold">{h.name}</Link>
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
    </>
  )
}