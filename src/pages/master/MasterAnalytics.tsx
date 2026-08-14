import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, TrendingUp, Activity, Banknote } from 'lucide-react'
import { masterApi, type AnalyticsRange, type AnalyticsResponse } from '../../api/services/master'
import { Card, StatCard, Spinner, EmptyState, Badge, PageHeader, Button } from '../../components/ui'
import { AreaChart, BarChart, DonutChart, Sparkline } from '../../components/charts'
import { toCsv, downloadCsv } from '../../utils/csv'

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
  { value: 'all', label: 'All time' },
]

function npr(n: number): string {
  return `NPR ${Math.round(n).toLocaleString('en-US')}`
}

function exportSeries(filename: string, rows: { label: string; value: number }[]): void {
  downloadCsv(filename, toCsv(rows.map((r) => ({ Period: r.label, Value: r.value }))))
}

export default function MasterAnalytics() {
  const [range, setRange] = useState<AnalyticsRange>('30d')
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = (r: AnalyticsRange) => {
    setLoading(true)
    masterApi
      .analytics(r)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(range)
  }, [range])

  const funnelDonut = data
    ? [
        { label: 'Initiated', value: data.funnel.pending_payment + data.funnel.paid + data.funnel.approved + data.funnel.rejected },
        { label: 'Paid', value: data.funnel.paid + data.funnel.approved },
        { label: 'Approved', value: data.funnel.approved },
      ]
    : []

  const exportHospitalRevenue = () => {
    if (!data) return
    downloadCsv(
      `hospitals-${range}.csv`,
      toCsv(
        data.top.map((h) => ({
          Hospital: h.name,
          Patients: h.patients,
          Doctors: h.doctors,
          Appointments: h.appointments,
          Registrations: h.requests,
        })),
      ),
    )
  }

  const exportConversion = () => {
    if (!data) return
    downloadCsv(
      `conversion-${range}.csv`,
      toCsv(
        data.conversion.map((c) => ({
          Month: c.label,
          Initiated: c.total,
          Approved: c.approved,
          'Conversion (%)': c.value,
        })),
      ),
    )
  }

  if (error) return <div className="auth-error">{error}</div>

  return (
    <>
      <PageHeader
        title="Platform Analytics"
        subtitle="Registrations, revenue and hospital activity across the entire platform."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {RANGES.map((r) => (
              <Button
                key={r.value}
                size="sm"
                variant={range === r.value ? 'primary' : 'outline'}
                onClick={() => setRange(r.value)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        }
      />

      {loading || !data ? (
        <Spinner label="Crunching platform numbers…" />
      ) : (
        <>
          {/* Summary block */}
          <div className="grid-stats mb-4">
            <StatCard
              label="Revenue Collected"
              value={npr(data.revenue.collected)}
              icon={<Banknote size={20} />}
              tone="green"
              footer={<span>approved registrations in range</span>}
            />
            <StatCard
              label="Pending Revenue"
              value={npr(data.revenue.pending)}
              icon={<Banknote size={20} />}
              tone="amber"
              footer={<span>paid, awaiting approval</span>}
            />
            <StatCard
              label="Avg Daily Revenue"
              value={npr(data.projection.avgDaily)}
              icon={<Activity size={20} />}
              tone="teal"
              footer={<span>linear over the window</span>}
            />
            <StatCard
              label="30-Day Projection"
              value={npr(data.projection.next30Days)}
              icon={<TrendingUp size={20} />}
              tone="indigo"
              footer={<span>{data.projection.note}</span>}
            />
          </div>

          {/* Revenue + registrations */}
          <div className="grid-2 mb-4">
            <Card padded>
              <div className="card-title-row">
                <h3 className="card-title">Revenue per Month</h3>
                <Button size="sm" variant="ghost" onClick={() => exportSeries(`revenue-${range}.csv`, data.revenueSeries)}>
                  <Download size={14} /> CSV
                </Button>
              </div>
              {data.revenueSeries.length === 0 ? (
                <EmptyState title="No revenue in this period" hint="Approved registration fees will appear here." />
              ) : (
                <AreaChart data={data.revenueSeries} color="#059669" width={560} height={220} />
              )}
            </Card>
            <Card padded>
              <div className="card-title-row">
                <h3 className="card-title">Registrations per Month</h3>
                <Button size="sm" variant="ghost" onClick={() => exportSeries(`registrations-${range}.csv`, data.registrationSeries)}>
                  <Download size={14} /> CSV
                </Button>
              </div>
              {data.registrationSeries.length === 0 ? (
                <EmptyState title="No registrations in this period" hint="New hospital registrations will appear here." />
              ) : (
                <BarChart data={data.registrationSeries} color="#0e7490" height={220} />
              )}
            </Card>
          </div>

          {/* Funnel + conversion */}
          <div className="grid-2 mb-4">
            <Card padded>
              <h3 className="card-title mb-2">Registration Funnel</h3>
              <DonutChart
                data={funnelDonut}
                centerLabel="total"
                centerValue={String(data.funnel.pending_payment + data.funnel.paid + data.funnel.approved + data.funnel.rejected)}
              />
            </Card>
            <Card padded>
              <div className="card-title-row">
                <h3 className="card-title">Monthly Conversion Rate</h3>
                <Button size="sm" variant="ghost" onClick={exportConversion}>
                  <Download size={14} /> CSV
                </Button>
              </div>
              {data.conversion.length === 0 ? (
                <EmptyState title="No data yet" hint="Conversion is % of requests that reached approval each month." />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Initiated</th>
                        <th>Approved</th>
                        <th>Trend</th>
                        <th className="align-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.conversion.map((c) => (
                        <tr key={c.label}>
                          <td>{c.label}</td>
                          <td>{c.total}</td>
                          <td>{c.approved}</td>
                          <td>
                            {data.conversion.length > 2 && (
                              <Sparkline
                                values={data.conversion.map((x) => x.value)}
                                color={c.value >= 50 ? '#059669' : '#d97706'}
                              />
                            )}
                          </td>
                          <td className="align-right">
                            <Badge tone={c.value >= 50 ? 'green' : c.value >= 25 ? 'amber' : 'red'}>{c.value}%</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Top hospitals */}
          <Card padded>
            <div className="card-title-row">
              <h3 className="card-title">Top Hospitals by Activity</h3>
              <Button size="sm" variant="ghost" onClick={exportHospitalRevenue}>
                <Download size={14} /> CSV
              </Button>
            </div>
            {data.top.length === 0 ? (
              <EmptyState title="No active hospitals yet" hint="Approved hospitals will appear here by activity." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Hospital</th>
                      <th>Patients</th>
                      <th>Doctors</th>
                      <th>Appointments</th>
                      <th>Registrations</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.top.map((h) => (
                      <tr key={h.slug}>
                        <td>
                          <Link to={`/master/hospitals/${h.slug}`} className="font-semibold">
                            {h.name}
                          </Link>
                        </td>
                        <td>{h.patients}</td>
                        <td>{h.doctors}</td>
                        <td>{h.appointments}</td>
                        <td>{h.requests}</td>
                        <td className="align-right">
                          <Link to={`/master/hospitals/${h.slug}`} className="btn btn-ghost btn-sm">
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  )
}