import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock4, Mail, ShieldAlert, XCircle } from 'lucide-react'
import { MedicoreLogo } from '../../components/ui/MedicoreLogo'
import '../landing/landing.css'

function statusFrom(query: URLSearchParams): 'success' | 'failed' | 'error' | 'unknown' {
  const v = query.get('payment')
  if (v === 'success') return 'success'
  if (v === 'failed') return 'failed'
  if (v === 'error') return 'error'
  return 'unknown'
}

export default function RegisterStatus() {
  const [params] = useSearchParams()
  const status = statusFrom(params)
  const regNo = params.get('reg')
  const message = params.get('message')

  const copy = {
    success: {
      icon: <CheckCircle2 size={44} />,
      tone: 'ok',
      title: 'Payment received',
      body:
        regNo
          ? `Your registration request ${regNo} is now in review. The platform team will verify your payment and approve your hospital - you'll receive your login credentials and payment receipt by email.`
          : 'Your payment was received and your registration request is now in review. You will receive your login credentials by email once approved.',
    },
    failed: {
      icon: <XCircle size={44} />,
      tone: 'bad',
      title: 'Payment did not go through',
      body:
        'No amount was charged. You can safely try again - if you were asked to pay but the transaction shows as completed with your bank, contact us before retrying.',
    },
    error: {
      icon: <ShieldAlert size={44} />,
      tone: 'bad',
      title: 'We could not confirm the payment',
      body:
        message === 'invalid_signature'
          ? 'The return link was not recognised. If your payment succeeded, quote the transaction ID from your eSewa history when you contact us.'
          : 'The return link was incomplete. If you were charged, your registration was not created - please try again or contact us.',
    },
    unknown: {
      icon: <Clock4 size={44} />,
      tone: 'warn',
      title: 'Check your registration status',
      body:
        'If you just paid the registration fee, your request is being processed. You will receive an email from us as soon as the platform team reviews it.',
    },
  }[status]

  return (
    <div className="lp-book">
      <nav className="lp-book-nav">
        <div className="lp-container lp-book-nav-inner">
          <Link to="/home" className="lp-book-brand">
            <MedicoreLogo size={30} />
            Medicore HMS
          </Link>
          <Link to="/home" className="lp-book-back">
            <ArrowLeft size={16} /> Back to home
          </Link>
        </div>
      </nav>

      <div className="lp-book-glow" aria-hidden="true" />

      <main className="lp-book-main">
        <div className="lp-container">
          <div className="lp-status">
            <div className={`lp-status-icon lp-status-${copy.tone}`}>{copy.icon}</div>
            <h1>{copy.title}</h1>
            <p>{copy.body}</p>
            {regNo && (
              <div className="lp-status-ref">
                Reference: <strong>{regNo}</strong>
              </div>
            )}
            <div className="lp-status-actions">
              {status === 'failed' || status === 'error' ? (
                <Link to="/master/register" className="lp-btn lp-btn-primary">
                  Try registering again
                </Link>
              ) : (
                <Link to="/master/register" className="lp-btn lp-btn-outline">
                  Register another hospital
                </Link>
              )}
              <span className="lp-status-note">
                <Mail size={14} /> Questions? We'll email you at the address you provided.
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
