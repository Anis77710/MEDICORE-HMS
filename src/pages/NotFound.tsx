import { Link } from 'react-router-dom'
import { Activity } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="empty-state" style={{ minHeight: '60vh' }}>
      <div className="auth-logo-box">
        <Activity size={30} strokeWidth={2.4} />
      </div>
      <h2 style={{ fontSize: 64, lineHeight: 1 }}>404</h2>
      <p className="muted">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary">
        Back to Dashboard
      </Link>
    </div>
  )
}
