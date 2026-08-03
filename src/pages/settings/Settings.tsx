import { useEffect, useState } from 'react'
import { Activity, Building2, Bell, Database, KeyRound, HardDriveDownload, ListChecks } from 'lucide-react'
import { getHospitalSettings, updateHospitalSettings } from '../../api/services/misc'
import type { HospitalSettings } from '../../api/services/misc'
import { PageHeader, Card, Button, Field, Input, FormActions, Spinner, Badge } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

type TabKey = 'hospital' | 'profile' | 'notifications' | 'security' | 'backup' | 'audit'

export default function Settings() {
  const { user } = useAuth()
  const { push } = useToast()
  const [tab, setTab] = useState<TabKey>('hospital')
  const [settings, setSettings] = useState<HospitalSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getHospitalSettings()
      .then((s) => {
        if (!cancelled) setSettings(s)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const saveHospital = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings) return
    setBusy(true)
    try {
      await updateHospitalSettings(settings)
      push('Hospital settings saved')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Save failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner label="Loading settings…" />

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your hospital workspace" />

      <div className="settings-layout">
        <div className="settings-nav">
          {[
            { key: 'hospital', label: 'Hospital Profile', icon: Building2 },
            { key: 'profile', label: 'My Profile', icon: Activity },
            { key: 'notifications', label: 'Notifications', icon: Bell },
            { key: 'security', label: 'Security', icon: KeyRound },
            { key: 'backup', label: 'Backup & Data', icon: HardDriveDownload },
            { key: 'audit', label: 'Audit Log', icon: ListChecks },
          ].map((item) => (
            <button
              key={item.key}
              className={`settings-nav-btn ${tab === item.key ? 'settings-nav-active' : ''}`}
              onClick={() => setTab(item.key as TabKey)}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <Card padded className="settings-panel">
          {tab === 'hospital' && settings && (
            <>
              <h3 className="card-title mb-2">Hospital Profile</h3>
              <p className="card-subtitle mb-4">Shown on invoices, reports and patient records.</p>
              <form onSubmit={saveHospital}>
                <div className="form-grid">
                  <Field label="Hospital Name">
                    <Input
                      value={settings.name}
                      onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Tagline">
                    <Input
                      value={settings.tagline}
                      onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                    />
                  </Field>
                  <Field label="Contact Email">
                    <Input
                      type="email"
                      value={settings.email}
                      onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Contact Phone">
                    <Input
                      value={settings.phone}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    />
                  </Field>
                  <Field label="Address">
                    <Input
                      value={settings.address}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    />
                  </Field>
                  <Field label="License Number">
                    <Input
                      value={settings.license}
                      onChange={(e) => setSettings({ ...settings, license: e.target.value })}
                    />
                  </Field>
                  <Field label="Timezone">
                    <Input
                      value={settings.timezone}
                      onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    />
                  </Field>
                  <Field label="Currency">
                    <Input
                      value={settings.currency}
                      onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    />
                  </Field>
                </div>
                <FormActions>
                  <Button type="submit" loading={busy}>
                    Save Changes
                  </Button>
                </FormActions>
              </form>
            </>
          )}

          {tab === 'profile' && (
            <>
              <h3 className="card-title mb-2">My Profile</h3>
              <p className="card-subtitle mb-4">Your account information.</p>
              <div className="form-grid">
                <Field label="Full Name">
                  <Input defaultValue={user?.name} />
                </Field>
                <Field label="Email">
                  <Input defaultValue={user?.email} disabled />
                </Field>
                <Field label="Phone">
                  <Input defaultValue={user?.phone} />
                </Field>
              </div>
              <FormActions>
                <Button onClick={() => push('Profile updated')}>Save Changes</Button>
              </FormActions>
            </>
          )}

          {tab === 'notifications' && (
            <>
              <h3 className="card-title mb-2">Notifications</h3>
              <p className="card-subtitle mb-4">Choose what alerts you receive.</p>
              {[
                'New patient registrations',
                'Appointment reminders (email)',
                'Appointment reminders (SMS)',
                'Critical lab results',
                'Low stock pharmacy alerts',
                'New invoice created',
                'Daily summary report',
              ].map((n, i) => (
                <label key={n} className="toggle-row">
                  <span>{n}</span>
                  <input type="checkbox" className="checkbox" defaultChecked={i < 5} />
                </label>
              ))}
              <FormActions>
                <Button onClick={() => push('Notification preferences saved')}>Save Preferences</Button>
              </FormActions>
            </>
          )}

          {tab === 'security' && (
            <>
              <h3 className="card-title mb-2">Security</h3>
              <p className="card-subtitle mb-4">Protect your account.</p>
              <div className="form-grid">
                <Field label="Current Password">
                  <Input type="password" placeholder="••••••••" />
                </Field>
                <Field label="New Password">
                  <Input type="password" placeholder="Min. 6 characters" />
                </Field>
              </div>
              <div className="toggle-row">
                <span>Two-factor authentication (2FA)</span>
                <input type="checkbox" className="checkbox" defaultChecked />
              </div>
              <FormActions>
                <Button onClick={() => push('Security settings updated')}>Update Security</Button>
              </FormActions>
            </>
          )}

          {tab === 'backup' && (
            <>
              <h3 className="card-title mb-2">Backup & Data</h3>
              <p className="card-subtitle mb-4">
                Automated nightly backups. Manual backups are stored for 30 days.
              </p>
              <div className="settings-info-row">
                <div className="settings-info-icon">
                  <Database size={20} />
                </div>
                <div className="flex-1">
                  <strong>Last automated backup</strong>
                  <div className="muted text-sm">Yesterday, 02:00 AM · 148 MB</div>
                </div>
                <Button variant="outline" size="sm">
                  <HardDriveDownload size={14} /> Backup Now
                </Button>
              </div>
              <div className="settings-info-row">
                <div className="settings-info-icon">
                  <Database size={20} />
                </div>
                <div className="flex-1">
                  <strong>Backup schedule</strong>
                  <div className="muted text-sm">Daily at 02:00 AM · keep 30 backups</div>
                </div>
              </div>
            </>
          )}

          {tab === 'audit' && (
            <>
              <h3 className="card-title mb-2">Audit Log</h3>
              <p className="card-subtitle mb-4">Recent administrative actions.</p>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['2026-08-02 08:12', 'Dr. Sarah Chen', 'LOGIN', 'Web console'],
                      ['2026-08-02 07:45', 'Olivia Martinez', 'INVOICE_CREATE', 'INV-2026-0831'],
                      ['2026-08-01 22:00', 'system', 'BACKUP', 'Database snapshot'],
                      ['2026-08-01 14:30', 'Dr. Sarah Chen', 'USER_UPDATE', 'Nurse Emma Wilson'],
                      ['2026-08-01 11:05', 'Rachel Adams', 'APPOINTMENT_CREATE', 'P-10429'],
                      ['2026-07-31 18:22', 'Dr. Sarah Chen', 'SETTINGS_UPDATE', 'Hospital profile'],
                    ].map((row) => (
                      <tr key={row[0]}>
                        <td className="muted">{row[0]}</td>
                        <td>{row[1]}</td>
                        <td>
                          <Badge tone="gray">{row[2]}</Badge>
                        </td>
                        <td className="muted">{row[3]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  )
}
