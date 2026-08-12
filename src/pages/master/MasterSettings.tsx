import { useEffect, useState } from 'react'
import { Building, Tag, Mail, Phone, Banknote, Globe } from 'lucide-react'
import { masterApi, type PlatformSettings } from '../../api/services/master'
import { Card, Spinner, PageHeader, Field, Input, Button, FormActions } from '../../components/ui'
import { useToast } from '../../context/ToastContext'

export default function MasterSettings() {
  const { push } = useToast()
  const [form, setForm] = useState<PlatformSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    masterApi
      .getSettings()
      .then((s) => setForm({ ...s }))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings'))
  }, [])

  if (error) return <div className="auth-error">{error}</div>
  if (!form) return <Spinner label="Loading settings…" />

  const set =
    <K extends keyof PlatformSettings>(k: K) =>
    (v: PlatformSettings[K]) =>
      setForm((f) => (f ? { ...f, [k]: v } : f))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const updated = await masterApi.updateSettings({
        siteName: form.siteName,
        tagline: form.tagline,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        registrationFee: form.registrationFee,
        hospitalDirectoryEnabled: form.hospitalDirectoryEnabled,
      })
      setForm({ ...updated })
      push('Platform settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Platform Settings" subtitle="Site-wide branding, contacts and the registration fee." />

      <Card padded>
        <form onSubmit={save} className="form-stack" style={{ maxWidth: 560 }}>
          <Field label="Site name">
            <div className="auth-input-wrap">
              <Building size={18} className="auth-input-icon" />
              <Input value={form.siteName} onChange={(e) => set('siteName')(e.target.value)} required className="auth-input" />
            </div>
          </Field>

          <Field label="Tagline">
            <div className="auth-input-wrap">
              <Tag size={18} className="auth-input-icon" />
              <Input value={form.tagline} onChange={(e) => set('tagline')(e.target.value)} className="auth-input" />
            </div>
          </Field>

          <Field label="Contact email">
            <div className="auth-input-wrap">
              <Mail size={18} className="auth-input-icon" />
              <Input type="email" value={form.contactEmail} onChange={(e) => set('contactEmail')(e.target.value)} required className="auth-input" />
            </div>
          </Field>

          <Field label="Contact phone">
            <div className="auth-input-wrap">
              <Phone size={18} className="auth-input-icon" />
              <Input value={form.contactPhone} onChange={(e) => set('contactPhone')(e.target.value)} className="auth-input" />
            </div>
          </Field>

          <Field label="Registration fee (NPR)">
            <div className="auth-input-wrap">
              <Banknote size={18} className="auth-input-icon" />
              <Input
                type="number"
                min={0}
                max={1000000}
                value={form.registrationFee}
                onChange={(e) => set('registrationFee')(Number(e.target.value))}
                required
                className="auth-input"
              />
            </div>
          </Field>

          <label className="auth-check" style={{ margin: '4px 0' }}>
            <input
              type="checkbox"
              className="checkbox"
              checked={form.hospitalDirectoryEnabled}
              onChange={(e) => set('hospitalDirectoryEnabled')(e.target.checked)}
            />
            <span>
              <Globe size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              Show the public hospital directory on the landing page
            </span>
          </label>

          {error && <div className="auth-error">{error}</div>}

          <FormActions>
            <Button type="submit" loading={busy}>
              Save settings
            </Button>
          </FormActions>
        </form>
      </Card>
    </>
  )
}