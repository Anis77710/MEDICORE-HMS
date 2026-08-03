import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search as SearchIcon, Stethoscope, CalendarDays, Pill, FileText, Loader2, X } from 'lucide-react'
import { getMyPatient } from '../../api/services/portal/me'
import { portalSearch } from '../../api/services/portal/timeline'
import type { PortalSearchResults } from '../../types/portal'
import { PageHeader, ErrorState } from '../components'

const empty: PortalSearchResults = { doctors: [], appointments: [], prescriptions: [], reports: [] }

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PortalSearchResults>(empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setResults(empty)
      setSearched(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    const t = setTimeout(async () => {
      try {
        const me = await getMyPatient()
        const res = await portalSearch(me.id, query)
        if (!cancelled) {
          setResults(res)
          setSearched(true)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Search failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const total = results.doctors.length + results.appointments.length + results.prescriptions.length + results.reports.length

  return (
    <div className="p-fade-in">
      <PageHeader title="Search" subtitle="Find doctors, appointments, prescriptions and reports." />

      <div className="relative mx-auto max-w-2xl">
        <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          name="portal-search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by doctor, department, medicine, diagnosis…"
          className="p-input !pl-11 !py-3.5 text-base shadow-sm"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-8 flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-cyan-600 dark:text-cyan-400" />
        </div>
      )}

      {error && !loading && <div className="mt-8"><ErrorState message={error} onRetry={() => setQuery((q) => q)} /></div>}

      {!loading && !error && searched && total === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <SearchIcon size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="mt-3 font-display font-bold text-slate-700 dark:text-slate-200">No results for "{query}"</p>
          <p className="mt-1 text-sm text-slate-400">Try a different keyword, e.g. a doctor name or department.</p>
        </div>
      )}

      {!loading && !error && total > 0 && (
        <div className="mx-auto mt-8 max-w-2xl space-y-6">
          <p className="text-sm text-slate-400">{total} result{total > 1 ? 's' : ''} for "{query}"</p>

          {results.doctors.length > 0 && (
            <Group title="Doctors" icon={Stethoscope} color="text-cyan-600">
              {results.doctors.map((d) => (
                <Link key={d.id} to={`/portal/doctors/${d.id}`} className="search-result">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-100">{d.name}</div>
                    <div className="text-xs text-slate-400">{d.department} · {d.specialty}</div>
                  </div>
                  <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">View →</span>
                </Link>
              ))}
            </Group>
          )}

          {results.appointments.length > 0 && (
            <Group title="Appointments" icon={CalendarDays} color="text-violet-600">
              {results.appointments.map((a) => (
                <Link key={a.id} to="/portal/appointments" className="search-result">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-100">{a.title}</div>
                    <div className="text-xs text-slate-400">{a.date} · {a.time} · {a.status}</div>
                  </div>
                  <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">View →</span>
                </Link>
              ))}
            </Group>
          )}

          {results.prescriptions.length > 0 && (
            <Group title="Prescriptions" icon={Pill} color="text-blue-600">
              {results.prescriptions.map((p) => (
                <Link key={p.id} to="/portal/prescriptions" className="search-result">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-100">From {p.title}</div>
                    <div className="text-xs text-slate-400">{p.issuedAt} · {p.status}</div>
                  </div>
                  <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">View →</span>
                </Link>
              ))}
            </Group>
          )}

          {results.reports.length > 0 && (
            <Group title="Reports & Records" icon={FileText} color="text-emerald-600">
              {results.reports.map((r) => (
                <Link key={r.id} to="/portal/records" className="search-result">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-100">{r.title}</div>
                    <div className="text-xs text-slate-400">{r.date}</div>
                  </div>
                  <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">View →</span>
                </Link>
              ))}
            </Group>
          )}
        </div>
      )}

      {!loading && !error && !searched && (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <SearchIcon size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="mt-3 font-display font-bold text-slate-700 dark:text-slate-200">Search across your care history</p>
          <p className="mt-1 text-sm text-slate-400">Results update as you type.</p>
        </div>
      )}
    </div>
  )
}

function Group({ title, icon: Icon, color, children }: { title: string; icon: React.ComponentType<{ size?: number }>; color: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className={`mb-2.5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide ${color}`}>
        <Icon size={15} /> {title}
      </h2>
      <div className="space-y-2">
        {children}
      </div>
    </section>
  )
}
