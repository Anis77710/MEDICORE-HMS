import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Stethoscope, MapPin, Clock, Star, Filter, X, ChevronDown } from 'lucide-react'
import { listPortalDoctors } from '../../api/services/portal/doctors'
import type { PortalDoctor } from '../../api/services/portal/doctors'
import { PageHeader, Skeleton, EmptyState, ErrorState, RatingStars, DoctorAvatar, StatusPill } from '../components'

const DEPARTMENTS = [
  'Cardiology',
  'Neurology',
  'Pediatrics',
  'General Medicine',
  'Orthopedics',
  'Dermatology',
  'Oncology',
  'Gynecology',
]

export default function PortalDoctors() {
  const [doctors, setDoctors] = useState<PortalDoctor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('All')
  const [minRating, setMinRating] = useState(0)
  const [minExp, setMinExp] = useState(0)
  const [availableOnly, setAvailableOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const list = await listPortalDoctors({
        search: search || undefined,
        department: dept === 'All' ? undefined : dept,
        minRating: minRating || undefined,
        minExperience: minExp || undefined,
        availableOnly: availableOnly || undefined,
      })
      setDoctors(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load doctors')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, dept, minRating, minExp, availableOnly])

  const activeFilterCount =
    (dept !== 'All' ? 1 : 0) + (minRating ? 1 : 0) + (minExp ? 1 : 0) + (availableOnly ? 1 : 0)

  const clearFilters = () => {
    setDept('All')
    setMinRating(0)
    setMinExp(0)
    setAvailableOnly(false)
  }

  const filtered = useMemo(() => doctors, [doctors])

  return (
    <div className="p-fade-in">
      <PageHeader
        title="Find Doctors"
        subtitle={`${filtered.length} specialists available across HealSync departments`}
        actions={
          <button
            className={`p-btn ${filtersOpen ? 'p-btn-primary' : 'p-btn-outline'}`}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <Filter size={16} /> Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        }
      />

      {/* Search + filters */}
      <div className="mb-5 space-y-3">
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, department, specialization or qualification…"
            className="p-input pl-10"
            aria-label="Search doctors"
          />
        </div>

        {filtersOpen && (
          <div className="p-modal-in rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="p-label">Department</label>
                <select value={dept} onChange={(e) => setDept(e.target.value)} className="p-input">
                  <option value="All">All departments</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="p-label">Minimum rating</label>
                <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} className="p-input">
                  <option value={0}>Any rating</option>
                  <option value={4.5}>4.5+ ★</option>
                  <option value={4.0}>4.0+ ★</option>
                  <option value={3.5}>3.5+ ★</option>
                </select>
              </div>
              <div>
                <label className="p-label">Experience</label>
                <select value={minExp} onChange={(e) => setMinExp(Number(e.target.value))} className="p-input">
                  <option value={0}>Any experience</option>
                  <option value={5}>5+ years</option>
                  <option value={10}>10+ years</option>
                  <option value={15}>15+ years</option>
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={availableOnly}
                    onChange={(e) => setAvailableOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-cyan-600"
                  />
                  Available now
                </label>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={clearFilters} className="p-btn p-btn-ghost text-sm">
                <X size={15} /> Clear all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-14 w-14 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="No doctors found"
          hint="Try adjusting your search or clearing the filters."
          action={
            <button onClick={clearFilters} className="p-btn p-btn-outline">
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => (
            <Link
              key={d.id}
              to={`/portal/doctors/${d.id}`}
              className="p-card p-card-hover group p-5"
            >
              <div className="flex items-start gap-3.5">
                <DoctorAvatar name={d.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display font-bold text-slate-800 group-hover:text-cyan-700 dark:text-slate-100 dark:group-hover:text-cyan-400">
                    {d.name}
                  </h3>
                  <p className="truncate text-sm text-slate-400">{d.specialty}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <RatingStars value={d.rating} size={13} />
                    <span className="text-[11px] text-slate-400">
                      ({d.ratingCount ?? 40} reviews)
                    </span>
                  </div>
                </div>
                <StatusPill status={d.status} />
              </div>

              <div className="mt-4 space-y-1.5 text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-slate-400" />
                  {d.department}
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-slate-400" />
                  {d.experienceYears} years experience
                </div>
                <div className="flex items-center gap-2">
                  <Star size={14} className="text-slate-400" />
                  {d.qualification}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3.5 dark:border-slate-800">
                <div>
                  <span className="font-display text-lg font-extrabold text-slate-800 dark:text-white">
                    ${d.consultationFee}
                  </span>
                  <span className="text-xs text-slate-400"> / visit</span>
                </div>
                <span className="flex items-center gap-1 text-sm font-semibold text-cyan-600 dark:text-cyan-400">
                  Book now <ChevronDown className="rotate-[-90deg]" size={15} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
