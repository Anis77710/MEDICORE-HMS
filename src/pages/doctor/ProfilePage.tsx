import { useEffect, useState } from 'react'
import {
  Award,
  Briefcase,
  Building2,
  GraduationCap,
  Mail,
  Phone,
  Stethoscope,
} from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { getDoctorProfile } from '../../api/services/doctorPortal'
import { getOwnProfile, updateOwnProfile } from '../../api/services/misc'
import type { Doctor } from '../../types'
import { Card, Spinner, Button, PageHeader, Avatar, StatusBadge } from '../../components/ui'

export default function ProfilePage() {
  const { push } = useToast()
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getDoctorProfile(), getOwnProfile()])
      .then(([d, profile]) => {
        if (cancelled) return
        setDoctor(d)
        setName(profile.name)
        setPhone(profile.phone)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load profile')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onSave() {
    if (!name.trim()) {
      push('Name is required', 'error')
      return
    }
    setSaving(true)
    setSaved(false)
    try {
      await updateOwnProfile({ name: name.trim(), phone: phone.trim() })
      setSaved(true)
      push('Profile updated')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner label="Loading profile…" />
  if (error) return <div className="auth-error">{error}</div>
  if (!doctor) return <div className="auth-error">Doctor profile not found.</div>

  return (
    <>
      <PageHeader title="My Profile" subtitle="Your professional details at Medicore Hospital." />

      <div className="grid-2">
        <Card padded className="dp-profile-card">
          <div className="flex gap-3 align-center" style={{ gap: 16 }}>
            <Avatar name={doctor.name} size="xl" />
            <div>
              <h3 style={{ margin: 0 }}>{doctor.name}</h3>
              <div className="muted text-sm">{doctor.specialty || doctor.department}</div>
              <div className="mt-2">
                <StatusBadge status={doctor.status} />
              </div>
            </div>
          </div>
          <div className="dp-kv mt-4">
            <div>
              <span>
                <Mail size={14} /> Email
              </span>
              <strong>{doctor.email || '—'}</strong>
            </div>
            <div>
              <span>
                <Phone size={14} /> Phone
              </span>
              <strong>{doctor.phone || '—'}</strong>
            </div>
            <div>
              <span>
                <Building2 size={14} /> Department
              </span>
              <strong>{doctor.department}</strong>
            </div>
            <div>
              <span>
                <Stethoscope size={14} /> Specialty
              </span>
              <strong>{doctor.specialty || '—'}</strong>
            </div>
            <div>
              <span>
                <GraduationCap size={14} /> Qualification
              </span>
              <strong>{doctor.qualification || '—'}</strong>
            </div>
            <div>
              <span>
                <Briefcase size={14} /> Experience
              </span>
              <strong>{doctor.experienceYears ? `${doctor.experienceYears} years` : '—'}</strong>
            </div>
            <div>
              <span>
                <Award size={14} /> Rating
              </span>
              <strong>{doctor.rating ? `${doctor.rating} / 5` : '—'}</strong>
            </div>
            <div>
              <span>Consultation Fee</span>
              <strong>{doctor.consultationFee ? `Rs. ${doctor.consultationFee}` : '—'}</strong>
            </div>
          </div>
        </Card>

        <Card padded>
          <h3 className="card-title" style={{ marginTop: 0 }}>
            Edit Profile
          </h3>
          <p className="card-subtitle mb-2" style={{ marginBottom: 14 }}>
            Only your name and phone number can be updated. Other details are managed by hospital
            administration.
          </p>
          <div className="field">
            <label htmlFor="profileName">Full name</label>
            <input
              id="profileName"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="profilePhone">Phone</label>
            <input
              id="profilePhone"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <Button loading={saving} onClick={() => void onSave()}>
            Save Changes
          </Button>
          {saved && <p className="dp-saved-note">Profile saved successfully.</p>}
        </Card>
      </div>
    </>
  )
}
