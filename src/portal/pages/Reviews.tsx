import { useEffect, useState } from 'react'
import { Star, MessageSquarePlus, Pencil, Trash2, Loader2 } from 'lucide-react'
import {
  listMyReviews,
  createReview,
  updateReview,
  deleteReview,
} from '../../api/services/portal/reviews'
import { listPortalDoctors } from '../../api/services/portal/doctors'
import { getMyPatient } from '../../api/services/portal/me'
import type { DoctorReview } from '../../types/portal'
import { PageHeader, Skeleton, ErrorState, EmptyState, RatingStars, DoctorAvatar, ConfirmDialog, Modal, Field } from '../components'
import { useToast } from '../../context/ToastContext'

export default function Reviews() {
  const { push } = useToast()
  const [reviews, setReviews] = useState<DoctorReview[]>([])
  const [doctorNames, setDoctorNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<DoctorReview | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<DoctorReview | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const me = await getMyPatient()
      const [list, doctors] = await Promise.all([listMyReviews(me.id), listPortalDoctors()])
      const map: Record<string, string> = {}
      doctors.forEach((d) => {
        map[d.id] = d.name
      })
      setDoctorNames(map)
      setReviews(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const [draft, setDraft] = useState({ doctorId: '', rating: 5, comment: '' })

  const openCreate = () => {
    setDraft({ doctorId: '', rating: 5, comment: '' })
    setCreating(true)
  }

  const openEdit = (r: DoctorReview) => {
    setDraft({ doctorId: r.doctorId, rating: r.rating, comment: r.comment })
    setEditing(r)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.doctorId || draft.comment.trim().length < 3) {
      push('Select a doctor and write a short comment', 'error')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateReview(editing.id, {
          doctorId: editing.doctorId,
          rating: draft.rating,
          comment: draft.comment,
          visitDate: editing.visitDate,
        })
        push('Review updated', 'success')
      } else {
        const me = await getMyPatient()
        await createReview(me.id, `${me.firstName} ${me.lastName}`, {
          doctorId: draft.doctorId,
          rating: draft.rating,
          comment: draft.comment,
          visitDate: new Date().toISOString().slice(0, 10),
        })
        push('Review submitted, thank you!', 'success')
      }
      setCreating(false)
      setEditing(null)
      await load()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to save review', 'error')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await deleteReview(deleting.id)
      push('Review deleted', 'success')
      setDeleting(null)
      await load()
    } catch {
      push('Failed to delete review', 'error')
    }
  }

  const nameOf = (r: DoctorReview) => doctorNames[r.doctorId] ?? 'Doctor'

  return (
    <div className="p-fade-in">
      <PageHeader
        title="My Reviews"
        subtitle="Rate and review the doctors you have visited."
        actions={
          <button onClick={openCreate} className="p-btn p-btn-primary">
            <MessageSquarePlus size={16} /> Write a review
          </button>
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No reviews yet"
          hint="Share your experience with a doctor so other patients can benefit."
          action={
            <button onClick={openCreate} className="p-btn p-btn-primary">
              <MessageSquarePlus size={16} /> Write your first review
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((r) => (
            <div key={r.id} className="p-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <DoctorAvatar name={nameOf(r)} size="md" />
                  <div>
                    <h3 className="font-display font-bold text-slate-800 dark:text-slate-100">{nameOf(r)}</h3>
                    <p className="text-xs text-slate-400">Visited {r.visitDate} · {r.createdAt}</p>
                  </div>
                </div>
                <RatingStars value={r.rating} />
              </div>
              <p className="mt-3 rounded-xl bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                "{r.comment}"
              </p>
              <div className="mt-3.5 flex justify-end gap-2">
                <button onClick={() => openEdit(r)} className="p-btn p-btn-ghost">
                  <Pencil size={14} /> Edit
                </button>
                <button onClick={() => setDeleting(r)} className="p-btn p-btn-ghost p-btn-danger-ghost">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={creating || !!editing}
        title={editing ? 'Edit review' : 'Write a review'}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label="Doctor">
            <select
              className="p-input"
              value={draft.doctorId}
              disabled={!!editing}
              onChange={(e) => setDraft((d) => ({ ...d, doctorId: e.target.value }))}
              required
            >
              <option value="">Select a doctor…</option>
              {Object.entries(doctorNames).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label="Rating">
            <div className="flex gap-1">
              <RatingStars value={draft.rating} size={22} onChange={(v) => setDraft((d) => ({ ...d, rating: v }))} />
            </div>
          </Field>
          <Field label="Comment">
            <textarea
              className="p-input min-h-24 resize-y"
              value={draft.comment}
              onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))}
              placeholder="Share details about your visit…"
              required
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setCreating(false)
                setEditing(null)
              }}
              className="p-btn p-btn-ghost"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="p-btn p-btn-primary">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Star size={15} />}
              {editing ? 'Save changes' : 'Submit review'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete review?"
        message={`This will permanently remove your review of ${deleting ? nameOf(deleting) : 'this doctor'}.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
