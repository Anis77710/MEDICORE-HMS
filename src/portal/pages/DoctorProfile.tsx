import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Stethoscope,
  Clock,
  Award,
  Users,
  Star,
  CalendarDays,
  Globe,
  MapPin,
  Video,
  CalendarPlus,
} from 'lucide-react'
import { getPortalDoctor, getDoctorAvailability } from '../../api/services/portal/doctors'
import { listDoctorReviews } from '../../api/services/portal/reviews'
import type { PortalDoctor } from '../../api/services/portal/doctors'
import type { DoctorReview, DoctorAvailability } from '../../types/portal'
import { Skeleton, ErrorState, RatingStars, DoctorAvatar, StatusPill, EmptyState } from '../components'
export default function DoctorProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [doctor, setDoctor] = useState<PortalDoctor | null>(null)
  const [reviews, setReviews] = useState<DoctorReview[]>([])
  const [availability, setAvailability] = useState<DoctorAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!id) return
    ;(async () => {
      setLoading(true)
      try {
        const [doc, revs, avail] = await Promise.all([
          getPortalDoctor(id),
          listDoctorReviews(id),
          getDoctorAvailability(id),
        ])
        if (cancelled) return
        setDoctor(doc)
        setReviews(revs)
        setAvailability(avail)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load doctor')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : doctor?.rating ?? 0
  const nextOpenDate = availability.find((a) => a.slots.some((s) => s.available))

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-6 w-40" />
        <div className="p-card p-6 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  if (error || !doctor) {
    return <ErrorState message={error || 'Doctor not found'} onRetry={() => navigate('/portal/doctors')} />
  }

  return (
    <div className="p-fade-in">
      <button
        onClick={() => navigate('/portal/doctors')}
        className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-cyan-600 dark:text-slate-400"
      >
        <ArrowLeft size={16} /> Back to doctors
      </button>

      {/* Hero card */}
      <div className="p-card overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600" />
        <div className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="-mt-16 rounded-2xl border-4 border-white shadow-lg dark:border-slate-900">
                <DoctorAvatar name={doctor.name} size="xl" />
              </div>
              <div className="pb-1">
                <h1 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                  {doctor.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span>{doctor.specialty}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><MapPin size={13} />{doctor.department}</span>
                  <span className="ml-1"><StatusPill status={doctor.status} /></span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <RatingStars value={doctor.rating} size={15} />
                  <span className="text-xs text-slate-400">
                    {doctor.ratingCount ?? reviews.length} reviews
                  </span>
                </div>
              </div>
            </div>
            <Link to={`/portal/book?doctor=${doctor.id}`} className="p-btn p-btn-primary">
              <CalendarPlus size={17} /> Book Appointment
            </Link>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="p-card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400"><Award size={19} /></div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Qualification</div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{doctor.qualification}</div>
          </div>
        </div>
        <div className="p-card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"><Clock size={19} /></div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Experience</div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{doctor.experienceYears} years</div>
          </div>
        </div>
        <div className="p-card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400"><Users size={19} /></div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Patients</div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{doctor.patientsCount}+</div>
          </div>
        </div>
        <div className="p-card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"><Star size={19} /></div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Consultation fee</div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">${doctor.consultationFee}</div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* Bio + schedule */}
        <div className="space-y-5 lg:col-span-2">
          <div className="p-card p-6">
            <h2 className="mb-3 font-display font-bold text-slate-800 dark:text-slate-100">About</h2>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {doctor.bio}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {doctor.languages?.map((l) => (
                <span key={l} className="p-badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Globe size={12} /> {l}
                </span>
              ))}
            </div>
          </div>

          <div className="p-card p-6">
            <h2 className="mb-4 font-display font-bold text-slate-800 dark:text-slate-100">
              Available days
            </h2>
            <div className="flex flex-wrap gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                const on = doctor.schedule.includes(day)
                return (
                  <span
                    key={day}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                      on
                        ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300'
                        : 'bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-600'
                    }`}
                  >
                    {day}
                  </span>
                )
              })}
            </div>
            {nextOpenDate && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                <CalendarDays size={16} />
                Next open slot: {nextOpenDate.day}, {nextOpenDate.date}
              </div>
            )}
          </div>

          {/* Reviews */}
          <div className="p-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display font-bold text-slate-800 dark:text-slate-100">
                Patient Reviews
              </h2>
              <div className="flex items-center gap-1.5 text-sm">
                <Star size={15} className="fill-amber-400 text-amber-400" />
                <span className="font-bold text-slate-700 dark:text-slate-200">{avg.toFixed(1)}</span>
                <span className="text-slate-400">({reviews.length})</span>
              </div>
            </div>
            {reviews.length === 0 ? (
              <EmptyState icon={Star} title="No reviews yet" hint="Be the first to review this doctor." />
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <DoctorAvatar name={r.patientName} size="sm" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {r.patientName}
                        </span>
                      </div>
                      <RatingStars value={r.rating} size={13} />
                    </div>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                      {r.comment}
                    </p>
                    <div className="mt-2 text-xs text-slate-400">Visited {r.visitDate}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Availability sidebar */}
        <div className="p-card h-fit p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display font-bold text-slate-800 dark:text-slate-100">
            <Video size={17} className="text-cyan-600" /> Availability
          </h2>
          {availability.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No slots available" hint="Check back soon." />
          ) : (
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {availability.slice(0, 7).map((day) => {
                const free = day.slots.filter((s) => s.available).length
                const nextFree = day.slots.find((s) => s.available)
                return (
                  <div
                    key={day.date}
                    className={`rounded-xl border p-3 ${
                      free > 0
                        ? 'border-slate-200 dark:border-slate-700'
                        : 'border-dashed border-slate-200 opacity-50 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {day.day}, {day.date.slice(5)}
                      </span>
                      {free > 0 ? (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {free} slots
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Full</span>
                      )}
                    </div>
                    {nextFree && (
                      <div className="mt-1.5 text-xs text-slate-400">
                        First at <span className="font-semibold text-cyan-600 dark:text-cyan-400">{nextFree.time}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <Link to={`/portal/book?doctor=${doctor.id}`} className="p-btn p-btn-primary mt-4 w-full">
            <Stethoscope size={16} /> Book with {doctor.name.replace('Dr. ', '')}
          </Link>
        </div>
      </div>
    </div>
  )
}
