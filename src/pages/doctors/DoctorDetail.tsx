import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  Hourglass,
  KeyRound,
  Pill,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  Users,
  Stethoscope,
  AlertTriangle,
} from 'lucide-react'
import {
  getDoctor,
  getDoctorStats,
  getDoctorCalendar,
  getDoctorDependencies,
  reassignDoctor,
  createDoctorAccount,
  resetDoctorPassword,
  disableDoctorLogin,
  enableDoctorLogin,
  listDoctors,
} from '../../api/services/doctors'
import type {
  Doctor,
  DoctorStats,
  DoctorCalendar,
  DoctorDependencies,
} from '../../types'
import {
  Card,
  Button,
  StatCard,
  Spinner,
  Avatar,
  StatusBadge,
  Badge,
  Field,
  Input,
  FormActions,
  Modal,
  ConfirmDialog,
  Tabs,
  EmptyState,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { fmtTime } from '../doctor/utils'

function dateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtDateShort(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

type TabKey = 'overview' | 'account' | 'schedule' | 'reassign'

export default function DoctorDetail() {
  const { id = '' } = useParams()
  const { push } = useToast()

  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [stats, setStats] = useState<DoctorStats | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Account tab state
  const [busy, setBusy] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [accountEmail, setAccountEmail] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [confirmDisable, setConfirmDisable] = useState(false)

  // Schedule tab state
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    const day = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - day)
    return dateOnly(d)
  })
  const [calendar, setCalendar] = useState<DoctorCalendar | null>(null)

  // Reassign tab state
  const [deps, setDeps] = useState<DoctorDependencies | null>(null)
  const [selectedAppts, setSelectedAppts] = useState<string[]>([])
  const [selectedPatients, setSelectedPatients] = useState<string[]>([])
  const [replacementId, setReplacementId] = useState('')
  const [reassignReason, setReassignReason] = useState('')
  const [reassignOpen, setReassignOpen] = useState(false)
  const [otherDoctors, setOtherDoctors] = useState<Doctor[]>([])
  const [reassigning, setReassigning] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([getDoctor(id), getDoctorStats(id)])
      .then(([d, s]) => {
        if (cancelled) return
        setDoctor(d)
        setStats(s)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load doctor')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    if (tab !== 'schedule') return
    const end = dateOnly(new Date(new Date(`${weekStart}T00:00:00`).getTime() + 6 * 86400000))
    getDoctorCalendar(id, { start: weekStart, end })
      .then((c) => {
        if (!cancelled) setCalendar(c)
      })
      .catch(() => {
        if (!cancelled) setCalendar(null)
      })
    return () => {
      cancelled = true
    }
  }, [id, tab, weekStart])

  useEffect(() => {
    let cancelled = false
    if (tab !== 'reassign') return
    Promise.all([getDoctorDependencies(id), listDoctors()])
      .then(([d, docs]) => {
        if (cancelled) return
        setDeps(d)
        setOtherDoctors(docs.filter((x) => x.id !== id && x.status === 'Active'))
        setSelectedAppts(d.activeAppointmentIds)
      })
      .catch(() => {
        if (!cancelled) setDeps(null)
      })
    return () => {
      cancelled = true
    }
  }, [id, tab])

  const refreshDoctor = useCallback(async () => {
    const [d, s] = await Promise.all([getDoctor(id), getDoctorStats(id)])
    setDoctor(d)
    setStats(s)
  }, [id])

  if (loading) return <Spinner label="Loading doctor profile…" />
  if (error || !doctor || !stats) return <div className="auth-error">{error || 'Doctor not found'}</div>

  const account = doctor.account ?? null
  const weekDays = calendar ? calendar.days : []

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    if (list.includes(value)) setList(list.filter((x) => x !== value))
    else setList([...list, value])
  }

  const openReassign = () => {
    if (selectedAppts.length === 0 && selectedPatients.length === 0) {
      push('Select at least one appointment or patient to reassign', 'error')
      return
    }
    setReassignOpen(true)
  }

  const confirmReassign = async () => {
    if (!replacementId) {
      push('Choose a replacement doctor', 'error')
      return
    }
    setReassigning(true)
    try {
      const result = await reassignDoctor(id, {
        doctorId: replacementId,
        appointmentIds: selectedAppts,
        patientIds: selectedPatients,
        reason: reassignReason,
      })
      push(
        `Reassigned ${result.movedAppointments} appointment(s) and ${result.movedPatients} patient(s) to ${result.to.name}`,
      )
      setReassignOpen(false)
      setDeps(await getDoctorDependencies(id))
      setSelectedAppts([])
      setSelectedPatients([])
    } catch (err) {
      push(err instanceof Error ? err.message : 'Reassignment failed', 'error')
    } finally {
      setReassigning(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-title-row">
          <Link to="/doctors" className="btn btn-ghost btn-sm" aria-label="Back to doctors">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="page-title">{doctor.name}</h1>
            <p className="page-subtitle">
              {doctor.specialty} · {doctor.department}
            </p>
          </div>
        </div>
        <div className="page-actions">
          <StatusBadge status={doctor.status} />
          {account && (
            <Badge tone={account.status === 'Disabled' ? 'red' : 'green'}>
              {account.status === 'Disabled' ? 'Login disabled' : 'Login enabled'}
            </Badge>
          )}
        </div>
      </div>

      <Tabs
        tabs={[
          { value: 'overview', label: 'Overview & Activity' },
          { value: 'account', label: 'Account' },
          { value: 'schedule', label: 'Schedule' },
          { value: 'reassign', label: 'Reassign', count: deps ? deps.activeAppointments + deps.assignedPatients : undefined },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' && (
        <>
          <div className="grid-stats mb-4">
            <StatCard label="Patients" value={String(stats.patientsCount)} icon={<Users size={20} />} tone="teal" />
            <StatCard label="Consultations" value={String(stats.consultationsCount)} icon={<ClipboardCheck size={20} />} tone="indigo" />
            <StatCard label="Prescriptions" value={String(stats.prescriptionsCount)} icon={<Pill size={20} />} tone="green" />
            <StatCard label="Today's Appointments" value={String(stats.appointmentsToday)} icon={<CalendarDays size={20} />} tone="amber" />
          </div>

          <div className="grid-2 mb-4">
            <Card padded>
              <div className="card-header" style={{ padding: 0, marginBottom: 12, border: 'none' }}>
                <div>
                  <h3 className="card-title">Profile</h3>
                  <p className="card-subtitle">Directory information</p>
                </div>
              </div>
              <div className="info-rows">
                <div className="info-row"><span className="muted">Email</span><strong>{doctor.email}</strong></div>
                <div className="info-row"><span className="muted">Phone</span><strong>{doctor.phone || '—'}</strong></div>
                <div className="info-row"><span className="muted">Qualification</span><strong>{doctor.qualification || '—'}</strong></div>
                <div className="info-row"><span className="muted">Experience</span><strong>{doctor.experienceYears} years</strong></div>
                <div className="info-row"><span className="muted">Consultation fee</span><strong>${doctor.consultationFee}</strong></div>
                <div className="info-row"><span className="muted">Working days</span><strong>{doctor.schedule.join(', ') || '—'}</strong></div>
              </div>
            </Card>

            <Card padded>
              <div className="card-header" style={{ padding: 0, marginBottom: 12, border: 'none' }}>
                <div>
                  <h3 className="card-title">Pending Confirmations</h3>
                  <p className="card-subtitle">Appointments awaiting this doctor's decision</p>
                </div>
                <Link to={`/appointments?doctor=${doctor.id}&status=Pending`} className="text-sm font-semibold">
                  Open in Appointments
                </Link>
              </div>
              {stats.pendingAppointments === 0 ? (
                <EmptyState title="Nothing pending" hint="All requests have been actioned." />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Patient</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deps?.appointments.slice(0, 8).map((a) => (
                        <tr key={a.id}>
                          <td className="muted">{fmtDateShort(a.date)}</td>
                          <td className="muted">{fmtTime(a.time)}</td>
                          <td className="cell-person">
                            <Avatar name={a.patientName} size="sm" />
                            <strong>{a.patientName}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {stats.pendingOldest && (
                <div className="mt-2 flex gap-2 items-center text-sm">
                  <Hourglass size={15} style={{ color: 'var(--warning)' }} />
                  <span className="muted">
                    Oldest pending since <strong>{fmtDateShort(stats.pendingOldest)}</strong>
                  </span>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {tab === 'account' && (
        <>
          <div className="grid-2 mb-4">
            <Card padded>
              <div className="card-header" style={{ padding: 0, marginBottom: 12, border: 'none' }}>
                <div>
                  <h3 className="card-title">Login Account</h3>
                  <p className="card-subtitle">
                    {account
                      ? `Account ${account.status === 'Disabled' ? 'disabled' : 'active'} · last login ${account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : 'never'}`
                      : 'No login account linked to this doctor yet.'}
                  </p>
                </div>
              </div>
              {!account ? (
                <div className="empty-state">
                  <Stethoscope size={28} className="mb-2" />
                  <p>This doctor cannot sign in until an account is created.</p>
                </div>
              ) : (
                <div className="info-rows">
                  <div className="info-row"><span className="muted">Email</span><strong>{doctor.email}</strong></div>
                  <div className="info-row"><span className="muted">Status</span><Badge tone={account.status === 'Disabled' ? 'red' : 'green'}>{account.status}</Badge></div>
                  <div className="info-row"><span className="muted">Created</span><strong>{account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}</strong></div>
                </div>
              )}
              <div className="flex gap-2 mt-3 flex-wrap">
                {!account ? (
                  <Button onClick={() => setCreateOpen(true)}>
                    <UserPlus size={15} /> Create Login Account
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" loading={busy} onClick={async () => {
                      setBusy(true)
                      try {
                        const res = await resetDoctorPassword(id)
                        setTempPassword(res.tempPassword ?? '')
                        push(res.tempPassword ? 'Password reset — temporary password generated' : 'Password reset')
                        await refreshDoctor()
                      } catch (err) {
                        push(err instanceof Error ? err.message : 'Reset failed', 'error')
                      } finally {
                        setBusy(false)
                      }
                    }}>
                      <KeyRound size={15} /> Reset Password
                    </Button>
                    {account.status === 'Active' ? (
                      <Button variant="ghost" className="text-danger" onClick={() => setConfirmDisable(true)}>
                        <ShieldOff size={15} /> Disable Login
                      </Button>
                    ) : (
                      <Button onClick={async () => {
                        setBusy(true)
                        try {
                          await enableDoctorLogin(id)
                          push('Login re-enabled')
                          await refreshDoctor()
                        } catch (err) {
                          push(err instanceof Error ? err.message : 'Enable failed', 'error')
                        } finally {
                          setBusy(false)
                        }
                      }}>
                        <ShieldCheck size={15} /> Re-enable Login
                      </Button>
                    )}
                  </>
                )}
              </div>
            </Card>

            <Card padded>
              <div className="card-header" style={{ padding: 0, marginBottom: 12, border: 'none' }}>
                <div>
                  <h3 className="card-title">Governance notes</h3>
                  <p className="card-subtitle">How account control works</p>
                </div>
              </div>
              <ul className="settings-list">
                <li>Disabling login revokes every active session immediately.</li>
                <li>Resetting the password signs the doctor out everywhere.</li>
                <li>Changing the doctor's status to On Leave / Unavailable keeps them signed in but blocks clinical actions.</li>
                <li>All account actions are written to the audit log.</li>
              </ul>
            </Card>
          </div>

          {tempPassword && (
            <Modal open onClose={() => setTempPassword('')} title="Temporary Password" size="sm">
              <p className="mb-2">Share this temporary password with the doctor. They will be asked to use it at next sign-in:</p>
              <div className="temp-password-box">{tempPassword}</div>
              <FormActions>
                <Button onClick={() => setTempPassword('')}>Done</Button>
              </FormActions>
            </Modal>
          )}

          <Modal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            title="Create Login Account"
          >
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setBusy(true)
                try {
                  await createDoctorAccount(id, { email: accountEmail, password: accountPassword })
                  push('Login account created')
                  setCreateOpen(false)
                  setAccountEmail('')
                  setAccountPassword('')
                  await refreshDoctor()
                } catch (err) {
                  push(err instanceof Error ? err.message : 'Create failed', 'error')
                } finally {
                  setBusy(false)
                }
              }}
            >
              <div className="form-grid">
                <Field label="Email">
                  <Input type="email" required value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} placeholder="doctor@medicore.health" />
                </Field>
                <Field label="Temporary Password (min 8 chars)">
                  <Input type="text" required minLength={8} value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="Set a temporary password" />
                </Field>
              </div>
              <FormActions>
                <Button type="submit" loading={busy}>Create Account</Button>
              </FormActions>
            </form>
          </Modal>

          <ConfirmDialog
            open={confirmDisable}
            title="Disable login?"
            message={`${doctor.name} will be signed out of every session immediately and will not be able to log in until an administrator re-enables the account.`}
            onCancel={() => setConfirmDisable(false)}
            onConfirm={async () => {
              setBusy(true)
              try {
                await disableDoctorLogin(id)
                push('Login disabled')
                await refreshDoctor()
              } catch (err) {
                push(err instanceof Error ? err.message : 'Disable failed', 'error')
              } finally {
                setBusy(false)
                setConfirmDisable(false)
              }
            }}
          />
        </>
      )}

      {tab === 'schedule' && (
        <>
          <Card padded className="mb-4">
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
              <div>
                <h3 className="card-title">Weekly Schedule</h3>
                <p className="card-subtitle">
                  {fmtDateShort(weekStart)} – {fmtDateShort(dateOnly(new Date(new Date(`${weekStart}T00:00:00`).getTime() + 6 * 86400000)))} · working hours 09:00–17:00
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setWeekStart(dateOnly(new Date(new Date(`${weekStart}T00:00:00`).getTime() - 7 * 86400000)))}>‹ Prev</Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const d = new Date()
                  const day = (d.getDay() + 6) % 7
                  d.setDate(d.getDate() - day)
                  setWeekStart(dateOnly(d))
                }}>This week</Button>
                <Button variant="outline" size="sm" onClick={() => setWeekStart(dateOnly(new Date(new Date(`${weekStart}T00:00:00`).getTime() + 7 * 86400000)))}>Next ›</Button>
              </div>
            </div>
            {!calendar ? (
              <Spinner label="Loading schedule…" />
            ) : (
              <div className="calendar-week">
                {weekDays.map((day) => (
                  <div key={day.date} className={`calendar-day ${!day.workingDay ? 'calendar-day-off' : ''}`}>
                    <div className="calendar-day-head">
                      <strong>{day.day}</strong>
                      <span className="muted text-xs">{new Date(`${day.date}T00:00:00`).getDate()}</span>
                      {!day.workingDay && <Badge tone="gray">Closed</Badge>}
                    </div>
                    <div className="calendar-slots">
                      {day.slots.slice(0, 12).map((slot) => {
                        const appt = calendar.appointments.find((a) => a.time === slot.time)
                        return (
                          <div
                            key={slot.time}
                            className={`calendar-slot ${appt ? 'calendar-slot-booked' : slot.available ? 'calendar-slot-free' : 'calendar-slot-off'}`}
                            title={appt ? `${appt.patientName} · ${fmtTime(appt.time)}` : slot.available ? 'Available' : 'Unavailable'}
                          >
                            <span className="text-xs">{slot.time}</span>
                            {appt && <strong className="text-xs">{appt.patientName.split(' ').slice(-1)[0]}</strong>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {calendar && calendar.appointments.length > 0 && (
              <div className="mt-3">
                <h4 className="card-title" style={{ fontSize: 14 }}>Appointments this week</h4>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Patient</th>
                        <th>Type</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calendar.appointments.map((a) => (
                        <tr key={a.id}>
                          <td className="muted">{fmtDateShort(a.date)}</td>
                          <td className="muted">{fmtTime(a.time)}</td>
                          <td className="cell-person">
                            <Avatar name={a.patientName} size="sm" />
                            <strong>{a.patientName}</strong>
                          </td>
                          <td>{a.type}</td>
                          <td><StatusBadge status={a.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'reassign' && (
        <>
          {!deps ? (
            <Spinner label="Loading dependencies…" />
          ) : (
            <Card padded className="mb-4">
              <div className="grid-stats mb-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <StatCard label="Active Appointments" value={String(deps.activeAppointments)} icon={<CalendarDays size={20} />} tone="amber" />
                <StatCard label="Assigned Patients" value={String(deps.assignedPatients)} icon={<Users size={20} />} tone="teal" />
                <StatCard label="Consultations" value={String(deps.consultations)} icon={<ClipboardCheck size={20} />} tone="indigo" />
                <StatCard label="Prescriptions" value={String(deps.prescriptions)} icon={<Pill size={20} />} tone="indigo" />
              </div>
              <div className="flex gap-2 items-center mb-3">
                <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
                <span className="text-sm muted">
                  Historical consultations and prescriptions stay linked to this doctor; only active appointments and patient assignments are moved.
                </span>
              </div>

              <div className="grid-2">
                <div>
                  <h4 className="card-title mb-2" style={{ fontSize: 14 }}>
                    Appointments to move
                    <span className="tab-count" style={{ marginLeft: 8 }}>{selectedAppts.length}</span>
                  </h4>
                  {deps.appointments.length === 0 ? (
                    <EmptyState title="No active appointments" />
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th></th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Patient</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deps.appointments.map((a) => (
                            <tr key={a.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  className="checkbox"
                                  checked={selectedAppts.includes(a.id)}
                                  onChange={() => toggle(selectedAppts, setSelectedAppts, a.id)}
                                />
                              </td>
                              <td className="muted">{fmtDateShort(a.date)}</td>
                              <td className="muted">{fmtTime(a.time)}</td>
                              <td className="font-semibold">{a.patientName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="card-title mb-2" style={{ fontSize: 14 }}>
                    Patients to reassign
                    <span className="tab-count" style={{ marginLeft: 8 }}>{selectedPatients.length}</span>
                  </h4>
                  {deps.patients.length === 0 ? (
                    <EmptyState title="No assigned patients" />
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th></th>
                            <th>Patient</th>
                            <th>ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deps.patients.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  className="checkbox"
                                  checked={selectedPatients.includes(p.id)}
                                  onChange={() => toggle(selectedPatients, setSelectedPatients, p.id)}
                                />
                              </td>
                              <td className="cell-person">
                                <Avatar name={`${p.firstName} ${p.lastName}`} size="sm" />
                                <strong>{p.firstName} {p.lastName}</strong>
                              </td>
                              <td className="muted">{p.patientId}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-grid mt-3">
                <Field label="Replacement Doctor (must be Active)">
                  <select
                    className="input"
                    value={replacementId}
                    onChange={(e) => setReplacementId(e.target.value)}
                  >
                    <option value="">Select a doctor…</option>
                    {otherDoctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · {d.department}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Reason (audited)">
                  <Input value={reassignReason} onChange={(e) => setReassignReason(e.target.value)} placeholder="e.g. Doctor going on extended leave" />
                </Field>
              </div>
              <FormActions>
                <Button onClick={openReassign} disabled={otherDoctors.length === 0}>
                  Reassign Selected ({selectedAppts.length + selectedPatients.length})
                </Button>
              </FormActions>
            </Card>
          )}

          <Modal
            open={reassignOpen}
            onClose={() => setReassignOpen(false)}
            title="Confirm Reassignment"
          >
            <p className="mb-2">
              Move <strong>{selectedAppts.length} appointment(s)</strong> and <strong>{selectedPatients.length} patient(s)</strong> from{' '}
              <strong>{doctor.name}</strong> to{' '}
              <strong>{otherDoctors.find((d) => d.id === replacementId)?.name ?? '…'}</strong>?
            </p>
            <p className="muted text-sm">
              This is written to the audit log with the stated reason. The change is immediate.
            </p>
            <FormActions>
              <Button variant="outline" onClick={() => setReassignOpen(false)}>Cancel</Button>
              <Button loading={reassigning} onClick={() => void confirmReassign()}>Confirm Reassignment</Button>
            </FormActions>
          </Modal>
        </>
      )}
    </>
  )
}
