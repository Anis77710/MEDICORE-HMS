import { FlaskConical, CalendarClock, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/ui'

export default function LabPage() {
  return (
    <>
      <PageHeader title="Lab & Investigations" subtitle="Request and review lab results." />
      <div className="dp-coming-soon">
        <div className="dp-coming-soon-icon">
          <FlaskConical size={44} />
        </div>
        <h2>Lab &amp; Investigations - Coming Soon</h2>
        <p className="muted">
          Order lab tests, track sample status and review investigation reports. This module is
          currently under development.
        </p>
        <div className="flex gap-2 mt-4" style={{ gap: 10 }}>
          <Link to="/doctor/consultations/new" className="btn btn-primary">
            Start a Consultation <ArrowRight size={16} />
          </Link>
          <Link to="/doctor/prescriptions" className="btn btn-outline">
            <CalendarClock size={16} /> View Prescriptions
          </Link>
        </div>
      </div>
    </>
  )
}
