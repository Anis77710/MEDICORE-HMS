import { useEffect, useRef, useState } from 'react'
import {
  UserCircle,
  Lock,
  Camera,
  Phone,
  Users,
  MapPin,
  HeartPulse,
  Loader2,
  Save,
} from 'lucide-react'
import { getMyPatient } from '../../api/services/portal/me'
import { updateMyProfile, changeMyPassword, uploadAvatar } from '../../api/services/portal/profile'
import type { Patient } from '../../types'
import { PageHeader, Skeleton, ErrorState, Field } from '../components'
import { useToast } from '../../context/ToastContext'

type Tab = 'personal' | 'security' | 'emergency'

export default function PortalProfile() {
  const { push } = useToast()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [tab, setTab] = useState<Tab>('personal')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    gender: 'Female' as 'Male' | 'Female' | 'Other',
    bloodGroup: 'O+',
    address: '',
    insurance: '',
  })
  const [emergency, setEmergency] = useState({ emergencyContact: '', allergies: '' })
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await getMyPatient()
        if (cancelled) return
        setPatient(me)
        setForm({
          firstName: me.firstName,
          lastName: me.lastName,
          email: me.email,
          phone: me.phone,
          dob: me.dob,
          gender: me.gender,
          bloodGroup: me.bloodGroup,
          address: me.address,
          insurance: me.insurance,
        })
        setEmergency({ emergencyContact: me.emergencyContact, allergies: me.allergies.join(', ') })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const savePersonal = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateMyProfile({
        ...form,
        emergencyContact: emergency.emergencyContact,
        allergies: emergency.allergies.split(',').map((a) => a.trim()).filter(Boolean),
        avatarUrl: avatarUrl || undefined,
      })
      setPatient(updated)
      push('Profile updated successfully', 'success')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadAvatar(file)
      setAvatarUrl(res.avatarUrl)
      push('Profile photo updated', 'success')
    } catch {
      push('Failed to upload photo', 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.newPassword !== pw.confirm) {
      push('New passwords do not match', 'error')
      return
    }
    setSaving(true)
    try {
      await changeMyPassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword })
      push('Password changed successfully', 'success')
      setPw({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to change password', 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveEmergency = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateMyProfile({
        ...form,
        emergencyContact: emergency.emergencyContact,
        allergies: emergency.allergies.split(',').map((a) => a.trim()).filter(Boolean),
        avatarUrl: avatarUrl || undefined,
      })
      setPatient(updated)
      push('Emergency contact updated', 'success')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'personal', label: 'Personal Info', icon: UserCircle },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'emergency', label: 'Emergency Contact', icon: Phone },
  ]

  if (loading) return <PageSkeletonWrap />
  if (error || !patient) return <ErrorState message={error || 'Profile not found'} onRetry={() => window.location.reload()} />

  const initials = `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`.toUpperCase()

  return (
    <div className="p-fade-in">
      <PageHeader title="My Profile" subtitle="Manage your personal information and account security." />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Side card */}
        <div className="space-y-5">
          <div className="p-card p-6 text-center">
            <div className="relative mx-auto h-24 w-24">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-24 w-24 rounded-2xl object-cover shadow-md" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 font-display text-3xl font-extrabold text-white shadow-md">
                  {initials}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-md ring-2 ring-white transition-colors hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-700"
                aria-label="Upload photo"
                title="Upload profile photo"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            </div>
            <h2 className="mt-4 font-display text-lg font-extrabold text-slate-900 dark:text-white">
              {patient.firstName} {patient.lastName}
            </h2>
            <p className="text-sm text-slate-400">{patient.patientId}</p>
            <div className="mt-3 flex justify-center">
              <span className="p-badge bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                {patient.status}
              </span>
            </div>
            <div className="mt-5 space-y-2 text-left text-sm">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <HeartPulse size={15} className="text-rose-500" /> {patient.bloodGroup}
              </div>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Users size={15} className="text-cyan-600" /> {patient.insurance}
              </div>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <MapPin size={15} className="text-amber-600" /> {patient.department}
              </div>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`p-chip ${tab === t.id ? 'p-chip-active' : 'p-chip-idle'}`}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>

          {tab === 'personal' && (
            <form onSubmit={savePersonal} className="p-card p-6">
              <h3 className="mb-5 font-display font-bold text-slate-800 dark:text-slate-100">Personal Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name"><input className="p-input" value={form.firstName} onChange={set('firstName')} required /></Field>
                <Field label="Last name"><input className="p-input" value={form.lastName} onChange={set('lastName')} required /></Field>
                <Field label="Email"><input type="email" className="p-input" value={form.email} onChange={set('email')} required /></Field>
                <Field label="Phone"><input className="p-input" value={form.phone} onChange={set('phone')} required /></Field>
                <Field label="Date of birth"><input type="date" className="p-input" value={form.dob} onChange={set('dob')} required /></Field>
                <Field label="Gender">
                  <select className="p-input" value={form.gender} onChange={set('gender')}>
                    <option>Female</option><option>Male</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Blood group">
                  <select className="p-input" value={form.bloodGroup} onChange={set('bloodGroup')}>
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => <option key={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="Insurance"><input className="p-input" value={form.insurance} onChange={set('insurance')} /></Field>
                <div className="sm:col-span-2">
                  <Field label="Address"><input className="p-input" value={form.address} onChange={set('address')} /></Field>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button type="submit" disabled={saving} className="p-btn p-btn-primary">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save changes
                </button>
              </div>
            </form>
          )}

          {tab === 'security' && (
            <form onSubmit={changePw} className="p-card p-6">
              <h3 className="mb-1 font-display font-bold text-slate-800 dark:text-slate-100">Change Password</h3>
              <p className="mb-5 text-sm text-slate-400">Use at least 6 characters with a mix of letters and numbers.</p>
              <div className="max-w-md space-y-4">
                <Field label="Current password"><input type="password" className="p-input" value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} required /></Field>
                <Field label="New password"><input type="password" className="p-input" value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} required minLength={6} /></Field>
                <Field label="Confirm new password"><input type="password" className="p-input" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} required /></Field>
              </div>
              <div className="mt-5 flex justify-end">
                <button type="submit" disabled={saving} className="p-btn p-btn-primary">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                  Update password
                </button>
              </div>
            </form>
          )}

          {tab === 'emergency' && (
            <form onSubmit={saveEmergency} className="p-card p-6">
              <h3 className="mb-1 font-display font-bold text-slate-800 dark:text-slate-100">Emergency Contact</h3>
              <p className="mb-5 text-sm text-slate-400">Who should we reach in case of an emergency?</p>
              <div className="max-w-md space-y-4">
                <Field label="Emergency contact number"><input className="p-input" value={emergency.emergencyContact} onChange={(e) => setEmergency((p) => ({ ...p, emergencyContact: e.target.value }))} required placeholder="+1 (555) 000-0000" /></Field>
                <Field label="Allergies (comma separated)"><input className="p-input" value={emergency.allergies} onChange={(e) => setEmergency((p) => ({ ...p, allergies: e.target.value }))} placeholder="Penicillin, Latex" /></Field>
              </div>
              <div className="mt-5 flex justify-end">
                <button type="submit" disabled={saving} className="p-btn p-btn-primary">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save emergency contact
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function PageSkeletonWrap() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-80" />
        <div className="lg:col-span-2 space-y-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-72" />
        </div>
      </div>
    </div>
  )
}
