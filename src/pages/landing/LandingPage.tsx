import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, CalendarDays, Building2, Pill, Receipt, BarChart3,
  Stethoscope, Shield, Zap, Clock, CheckCircle2, Mail,
  Phone, MapPin, Menu, X, ChevronRight, UserCog,
  Heart, Award, Lock,
} from 'lucide-react'
import { MedicoreLogo } from '../../components/ui/MedicoreLogo'
import './landing.css'

/* ─── Navbar ─────────────────────────────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = ['Home', 'About', 'Features', 'Contact']

  const scrollTo = (id: string) => {
    setMenuOpen(false)
    document.getElementById(id.toLowerCase())?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <nav className={`lp-nav ${scrolled ? 'lp-nav-scrolled' : ''}`}>
        <div className="lp-nav-inner">
          <div className="lp-nav-logo">
            <MedicoreLogo size={38} />
            <div className="lp-nav-logo-text">
              <span>Medicore</span> <span style={{ color: 'var(--lp-primary)' }}>HMS</span>
            </div>
          </div>

          <ul className="lp-nav-links">
            {links.map((l) => (
              <li key={l}>
                <a href={`#${l.toLowerCase()}`} onClick={(e) => { e.preventDefault(); scrollTo(l) }}>
                  {l}
                </a>
              </li>
            ))}
          </ul>

          <div className="lp-nav-cta">
            <Link to="/login" className="lp-btn lp-btn-outline lp-btn-sm">Log In</Link>
            <Link to="/master/register" className="lp-btn lp-btn-primary lp-btn-sm">Get Started</Link>
          </div>

          <button className="lp-nav-mobile-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="lp-nav-drawer">
          {links.map((l) => (
            <a key={l} href={`#${l.toLowerCase()}`} onClick={(e) => { e.preventDefault(); scrollTo(l) }}>{l}</a>
          ))}
          <Link to="/login" className="lp-btn lp-btn-outline">Log In</Link>
          <Link to="/master/register" className="lp-btn lp-btn-primary">Get Started</Link>
        </div>
      )}
    </>
  )
}

/* ─── Hero ───────────────────────────────────────────────── */
function Hero() {
  return (
    <section id="home" className="lp-hero">
      {/* LEFT — copy */}
      <div className="lp-hero-left">
        <div className="lp-hero-left-inner">
          <h1 className="lp-hero-h1">
            Better care starts with<br />
            <span>better management.</span>
          </h1>

          <p className="lp-hero-desc">
            Medicore HMS gives your entire hospital: doctors, nurses, admin, and billing
            one place to work from. Less friction. More care.
          </p>

          {/* feature pills */}
          <div className="lp-hero-pills">
            {[
              { icon: <Users size={12} />, label: 'Patient records' },
              { icon: <CalendarDays size={12} />, label: 'Appointments' },
              { icon: <Pill size={12} />, label: 'Pharmacy' },
              { icon: <Receipt size={12} />, label: 'Billing' },
              { icon: <Shield size={12} />, label: 'HIPAA aligned' },
            ].map((p) => (
              <span key={p.label} className="lp-hero-pill">
                {p.icon} {p.label}
              </span>
            ))}
          </div>

          <div className="lp-hero-btns">
            <Link to="/book-appointment" className="lp-btn lp-btn-primary">
              Book an Appointment
            </Link>
<Link to="/master/register" className="lp-btn lp-btn-outline">
        Register your hospital
      </Link>
          </div>

          <div className="lp-hero-proof">
            <div className="lp-hero-proof-avatars">
              {[['#0e7490','D'],['#7c3aed','N'],['#059669','A'],['#d97706','S']].map(([bg,l]) => (
                <div key={l} className="lp-hero-proof-av" style={{ background: bg as string }}>{l}</div>
              ))}
            </div>
            <div className="lp-hero-proof-text">
              <strong>1,200+ hospitals</strong><br />trust Medicore HMS
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — custom brand illustration */}
      <div className="lp-hero-right">
        <HeroIllustration />
      </div>
    </section>
  )
}

/* ─── Hero Illustration ──────────────────────────────────── */
function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 600 720"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'translateY(-40px)' }}
      aria-hidden="true"
    >
      {/* ── Background ── */}
      <defs>
        <linearGradient id="screenGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b2a35" />
          <stop offset="100%" stopColor="#0e4a5c" />
        </linearGradient>
        <linearGradient id="scrubDoctor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e7490" />
          <stop offset="100%" stopColor="#0b5563" />
        </linearGradient>
        <linearGradient id="scrubNurse" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e8f4f8" />
        </linearGradient>
        <filter id="softShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#0e7490" floodOpacity="0.12" />
        </filter>
        <filter id="cardShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="6" floodColor="#000" floodOpacity="0.10" />
        </filter>
      </defs>

      {/* ── Monitor / screen on desk ── */}
      <g filter="url(#cardShadow)">
        {/* Desk */}
        <rect x="60" y="370" width="260" height="16" rx="4" fill="#8bb5c0" />
        <rect x="80" y="386" width="30" height="90" rx="4" fill="#7aa8b5" />
        <rect x="210" y="386" width="30" height="90" rx="4" fill="#7aa8b5" />

        {/* Monitor stand */}
        <rect x="170" y="340" width="12" height="32" fill="#6a9aaa" />
        <rect x="155" y="370" width="42" height="6" rx="2" fill="#6a9aaa" />

        {/* Monitor */}
        <rect x="90" y="210" width="200" height="134" rx="10" fill="url(#screenGrad)" />
        <rect x="97" y="217" width="186" height="120" rx="7" fill="#0a1e28" />

        {/* Screen content — simplified EHR */}
        <rect x="104" y="224" width="80" height="7" rx="2" fill="#22d3ee" opacity="0.8" />
        <rect x="104" y="236" width="172" height="5" rx="2" fill="#1e4a5c" />
        <rect x="104" y="245" width="140" height="5" rx="2" fill="#1e4a5c" />
        {/* Patient row */}
        <rect x="104" y="258" width="172" height="22" rx="4" fill="#0e3d4d" />
        <circle cx="116" cy="269" r="7" fill="#0e7490" />
        <rect x="128" y="263" width="60" height="4" rx="2" fill="#22d3ee" opacity="0.7" />
        <rect x="128" y="271" width="40" height="3" rx="2" fill="#1e4a5c" />
        <rect x="220" y="264" width="48" height="10" rx="3" fill="#059669" opacity="0.5" />
        {/* Second row */}
        <rect x="104" y="284" width="172" height="22" rx="4" fill="#0e3d4d" />
        <circle cx="116" cy="295" r="7" fill="#7c3aed" />
        <rect x="128" y="289" width="55" height="4" rx="2" fill="#22d3ee" opacity="0.7" />
        <rect x="128" y="297" width="38" height="3" rx="2" fill="#1e4a5c" />
        <rect x="220" y="290" width="48" height="10" rx="3" fill="#d97706" opacity="0.4" />
        {/* Third row */}
        <rect x="104" y="310" width="172" height="22" rx="4" fill="#0e3d4d" />
        <circle cx="116" cy="321" r="7" fill="#059669" />
        <rect x="128" y="315" width="65" height="4" rx="2" fill="#22d3ee" opacity="0.7" />
        <rect x="128" y="323" width="42" height="3" rx="2" fill="#1e4a5c" />
        <rect x="220" y="316" width="48" height="10" rx="3" fill="#059669" opacity="0.5" />
      </g>

      {/* ── Doctor (left figure) ── */}
      <g filter="url(#softShadow)">
        {/* Shadow */}
        <ellipse cx="195" cy="478" rx="38" ry="8" fill="#0e7490" opacity="0.15" />

        {/* Legs */}
        <rect x="174" y="420" width="22" height="60" rx="8" fill="#0b5563" />
        <rect x="200" y="420" width="22" height="60" rx="8" fill="#0b5563" />
        {/* Shoes */}
        <rect x="170" y="472" width="30" height="12" rx="5" fill="#1a1a2e" />
        <rect x="196" y="472" width="30" height="12" rx="5" fill="#1a1a2e" />

        {/* Body — teal scrubs */}
        <rect x="163" y="300" width="70" height="128" rx="18" fill="url(#scrubDoctor)" />

        {/* White coat over scrubs */}
        <rect x="157" y="298" width="82" height="130" rx="18" fill="white" opacity="0.92" />
        <rect x="173" y="298" width="50" height="130" rx="0" fill="url(#scrubDoctor)" />
        {/* Coat lapels */}
        <path d="M173 298 L157 330 L157 298 Z" fill="white" opacity="0.92" />
        <path d="M223 298 L239 330 L239 298 Z" fill="white" opacity="0.92" />

        {/* Stethoscope */}
        <path d="M180 318 Q175 338 180 348 Q188 358 196 348" stroke="#0e7490" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <circle cx="196" cy="350" r="6" fill="#0e7490" stroke="white" strokeWidth="1.5" />

        {/* Pocket */}
        <rect x="165" y="332" width="22" height="16" rx="3" fill="#e8f4f8" stroke="#c8dce6" strokeWidth="1" />
        <rect x="168" y="334" width="5" height="10" rx="1" fill="#0e7490" />
        <rect x="175" y="334" width="5" height="10" rx="1" fill="#22d3ee" />

        {/* ID badge */}
        <rect x="208" y="318" width="26" height="18" rx="3" fill="#0e7490" />
        <rect x="210" y="320" width="22" height="3" rx="1" fill="white" opacity="0.9" />
        <rect x="210" y="326" width="14" height="2" rx="1" fill="white" opacity="0.5" />
        <rect x="210" y="330" width="18" height="2" rx="1" fill="white" opacity="0.5" />

        {/* Arms */}
        <rect x="140" y="300" width="26" height="70" rx="12" fill="white" opacity="0.92" />
        <rect x="230" y="300" width="26" height="70" rx="12" fill="white" opacity="0.92" />

        {/* Left hand holding clipboard */}
        <rect x="128" y="362" width="34" height="44" rx="5" fill="#f8f9fa" stroke="#e2e8f0" strokeWidth="1.5" />
        <rect x="132" y="366" width="26" height="4" rx="2" fill="#0e7490" opacity="0.6" />
        <rect x="132" y="373" width="22" height="3" rx="2" fill="#94a3b8" />
        <rect x="132" y="379" width="24" height="3" rx="2" fill="#94a3b8" />
        <rect x="132" y="385" width="18" height="3" rx="2" fill="#94a3b8" />
        <rect x="132" y="391" width="26" height="3" rx="2" fill="#0e7490" opacity="0.3" />

        {/* Right hand — pointing at screen */}
        <ellipse cx="252" cy="348" rx="10" ry="8" fill="#f5c5a3" />

        {/* Neck & head */}
        <rect x="186" y="270" width="24" height="34" rx="8" fill="#f5c5a3" />
        {/* Head */}
        <ellipse cx="198" cy="252" rx="30" ry="32" fill="#f5c5a3" />
        {/* Hair — short dark */}
        <ellipse cx="198" cy="227" rx="30" ry="14" fill="#2d1b0e" />
        <rect x="168" y="227" width="60" height="16" rx="0" fill="#2d1b0e" />
        {/* Ears */}
        <ellipse cx="168" cy="255" rx="6" ry="8" fill="#f5c5a3" />
        <ellipse cx="228" cy="255" rx="6" ry="8" fill="#f5c5a3" />
        {/* Eyes */}
        <ellipse cx="188" cy="252" rx="5" ry="5.5" fill="white" />
        <ellipse cx="208" cy="252" rx="5" ry="5.5" fill="white" />
        <circle cx="189" cy="253" r="3" fill="#2d1b0e" />
        <circle cx="209" cy="253" r="3" fill="#2d1b0e" />
        <circle cx="190" cy="252" r="1" fill="white" />
        <circle cx="210" cy="252" r="1" fill="white" />
        {/* Eyebrows */}
        <path d="M183 246 Q188 242 193 246" stroke="#2d1b0e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M203 246 Q208 242 213 246" stroke="#2d1b0e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Nose */}
        <path d="M196 258 Q198 263 200 258" stroke="#d4956a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Smile */}
        <path d="M190 268 Q198 274 206 268" stroke="#c0785a" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>

      {/* ── Nurse (right figure) ── */}
      <g filter="url(#softShadow)">
        {/* Shadow */}
        <ellipse cx="405" cy="478" rx="35" ry="8" fill="#0e7490" opacity="0.15" />

        {/* Legs */}
        <rect x="384" y="418" width="22" height="62" rx="8" fill="#334155" />
        <rect x="410" y="418" width="22" height="62" rx="8" fill="#334155" />
        {/* Shoes */}
        <rect x="378" y="472" width="32" height="12" rx="5" fill="#1a1a2e" />
        <rect x="406" y="472" width="32" height="12" rx="5" fill="#1a1a2e" />

        {/* Body — white nurse uniform */}
        <rect x="372" y="298" width="76" height="128" rx="18" fill="url(#scrubNurse)" stroke="#d0e8f0" strokeWidth="1.5" />

        {/* Nurse cross emblem */}
        <rect x="411" y="316" width="6" height="18" rx="2" fill="#dc2626" opacity="0.8" />
        <rect x="406" y="321" width="16" height="6" rx="2" fill="#dc2626" opacity="0.8" />

        {/* Stethoscope */}
        <path d="M390 316 Q384 336 390 346 Q398 356 406 346" stroke="#0e7490" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <circle cx="406" cy="348" r="6" fill="#0e7490" stroke="white" strokeWidth="1.5" />

        {/* ID badge */}
        <rect x="375" y="318" width="26" height="18" rx="3" fill="#dc2626" />
        <rect x="377" y="320" width="22" height="3" rx="1" fill="white" opacity="0.9" />
        <rect x="377" y="326" width="14" height="2" rx="1" fill="white" opacity="0.5" />

        {/* Arms */}
        <rect x="350" y="300" width="26" height="68" rx="12" fill="#e8f4f8" stroke="#d0e8f0" strokeWidth="1.5" />
        <rect x="444" y="300" width="26" height="68" rx="12" fill="#e8f4f8" stroke="#d0e8f0" strokeWidth="1.5" />

        {/* Left hand — holding tablet */}
        <rect x="334" y="356" width="38" height="52" rx="6" fill="#1e293b" />
        <rect x="337" y="359" width="32" height="44" rx="4" fill="#0a1e28" />
        {/* Tablet screen content */}
        <rect x="340" y="362" width="26" height="5" rx="2" fill="#22d3ee" opacity="0.7" />
        <rect x="340" y="371" width="22" height="3" rx="2" fill="#1e4a5c" />
        <rect x="340" y="378" width="24" height="3" rx="2" fill="#1e4a5c" />
        <rect x="340" y="385" width="18" height="3" rx="2" fill="#059669" opacity="0.6" />
        <rect x="340" y="392" width="26" height="3" rx="2" fill="#1e4a5c" />

        {/* Right hand */}
        <ellipse cx="462" cy="348" rx="10" ry="8" fill="#e8b89a" />

        {/* Neck */}
        <rect x="396" y="268" width="24" height="34" rx="8" fill="#e8b89a" />
        {/* Head */}
        <ellipse cx="408" cy="250" rx="30" ry="32" fill="#e8b89a" />
        {/* Hair — longer, pulled back */}
        <ellipse cx="408" cy="224" rx="30" ry="16" fill="#6b3a1f" />
        <rect x="378" y="224" width="60" height="20" rx="0" fill="#6b3a1f" />
        {/* Bun */}
        <circle cx="408" cy="218" r="12" fill="#6b3a1f" />
        {/* Nurse cap hint */}
        <rect x="386" y="218" width="44" height="8" rx="4" fill="white" opacity="0.7" />
        <rect x="400" y="216" width="6" height="4" rx="1" fill="#dc2626" opacity="0.7" />
        {/* Ears */}
        <ellipse cx="378" cy="253" rx="6" ry="8" fill="#e8b89a" />
        <ellipse cx="438" cy="253" rx="6" ry="8" fill="#e8b89a" />
        {/* Eyes */}
        <ellipse cx="398" cy="250" rx="5" ry="5.5" fill="white" />
        <ellipse cx="418" cy="250" rx="5" ry="5.5" fill="white" />
        <circle cx="399" cy="251" r="3" fill="#2d1b0e" />
        <circle cx="419" cy="251" r="3" fill="#2d1b0e" />
        <circle cx="400" cy="250" r="1" fill="white" />
        <circle cx="420" cy="250" r="1" fill="white" />
        {/* Eyebrows */}
        <path d="M393 244 Q398 240 403 244" stroke="#6b3a1f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M413 244 Q418 240 423 244" stroke="#6b3a1f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Nose */}
        <path d="M406 256 Q408 261 410 256" stroke="#c4856a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Smile */}
        <path d="M400 267 Q408 273 416 267" stroke="#b5694f" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>

      {/* ── Small floating status card ── */}
      <g filter="url(#cardShadow)">
        <rect x="310" y="160" width="178" height="70" rx="12" fill="white" opacity="0.95" />
        <rect x="318" y="168" width="8" height="8" rx="2" fill="#059669" />
        <rect x="332" y="168" width="80" height="6" rx="3" fill="#0f172a" opacity="0.8" />
        <rect x="332" y="178" width="55" height="5" rx="2" fill="#94a3b8" />
        <rect x="318" y="190" width="162" height="1" fill="#e2e8f0" />
        <rect x="318" y="200" width="40" height="5" rx="2" fill="#0e7490" opacity="0.7" />
        <rect x="366" y="200" width="40" height="5" rx="2" fill="#7c3aed" opacity="0.5" />
        <rect x="414" y="200" width="40" height="5" rx="2" fill="#059669" opacity="0.5" />
        <rect x="318" y="210" width="162" height="12" rx="3" fill="#e8f4f8" />
        <rect x="318" y="210" width="122" height="12" rx="3" fill="#0e7490" opacity="0.5" />
        <rect x="440" y="212" width="28" height="8" rx="2" fill="#f1f5f9" />
        <text x="448" y="219" fontSize="7" fill="#64748b" fontFamily="Inter, sans-serif" fontWeight="700">68%</text>
      </g>

      {/* ── Decorative teal cross top-right ── */}
      <g opacity="0.06">
        <rect x="530" y="80" width="12" height="40" rx="3" fill="#0e7490" />
        <rect x="516" y="94" width="40" height="12" rx="3" fill="#0e7490" />
      </g>
    </svg>
  )
}

/* ─── Stats strip ────────────────────────────────────────── */
function StatsStrip() {
  const stats = [
    { num: '1,200+', label: 'Hospitals Using Medicore' },
    { num: '5M+', label: 'Patients Managed' },
    { num: '99.9%', label: 'System Uptime' },
    { num: '24/7', label: 'Support Available' },
  ]
  return (
    <div className="lp-stats">
      <div className="lp-container">
        <div className="lp-stats-grid">
          {stats.map((s) => (
            <div key={s.label} className="lp-stat-item">
              <div className="lp-stat-num">{s.num}</div>
              <div className="lp-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Features ───────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Users, color: '#dbeafe', iconColor: '#2563eb',
    title: 'Patient Management',
    desc: 'Complete patient lifecycle: registration, admissions, medical history, allergies, and discharge.',
    items: ['Smart patient registration', 'Medical history & allergies', 'Admission & discharge tracking', 'Patient status monitoring'],
  },
  {
    icon: CalendarDays, color: '#fef3c7', iconColor: '#d97706',
    title: 'Appointment Scheduling',
    desc: 'Intelligent scheduling with conflict prevention, reminders and multi-doctor support.',
    items: ['Real-time slot availability', 'Auto conflict prevention', 'Reschedule & cancellation', 'In-person & video modes'],
  },
  {
    icon: Stethoscope, color: '#d1fae5', iconColor: '#059669',
    title: 'Doctor Management',
    desc: 'Manage doctor profiles, departments, schedules, qualifications and patient assignments.',
    items: ['Doctor profiles & qualifications', 'Department assignments', 'Schedule management', 'Performance tracking'],
  },
  {
    icon: Building2, color: '#ede9fe', iconColor: '#7c3aed',
    title: 'Department & Beds',
    desc: 'Live bed occupancy tracking per department with color-coded utilization alerts.',
    items: ['Real-time bed occupancy', 'Department utilization', 'Capacity planning', 'Occupancy history'],
  },
  {
    icon: Pill, color: '#fce7f3', iconColor: '#db2777',
    title: 'Pharmacy & Inventory',
    desc: 'Track medicines, manage stock levels, set reorder alerts and monitor expiry dates.',
    items: ['Stock level monitoring', 'Expiry date alerts', 'Reorder notifications', 'Prescription integration'],
  },
  {
    icon: Receipt, color: '#cffafe', iconColor: '#0e7490',
    title: 'Billing & Payments',
    desc: 'Generate itemized invoices, track payments, handle insurance and manage overdue accounts.',
    items: ['Itemized invoice generation', 'Multi-payment methods', 'Insurance processing', 'Financial reports'],
  },
  {
    icon: BarChart3, color: '#fef9c3', iconColor: '#ca8a04',
    title: 'Reports & Analytics',
    desc: 'Hospital-wide analytics with admissions trends, department performance, and revenue insights.',
    items: ['Revenue analytics', 'Admission trends', 'Department performance', 'Exportable reports'],
  },
  {
    icon: UserCog, color: '#fee2e2', iconColor: '#dc2626',
    title: 'Staff & RBAC',
    desc: 'Role-based access control: Admin, Doctor, Nurse, and Staff each see only what they need.',
    items: ['5 built-in roles', 'Granular permissions', 'Staff shift management', 'Audit-ready access logs'],
  },
  {
    icon: Shield, color: '#f0fdf4', iconColor: '#16a34a',
    title: 'Security & Compliance',
    desc: 'HIPAA-aligned design with JWT auth, token rotation, encrypted storage, and access audit.',
    items: ['JWT + refresh tokens', 'HIPAA-aligned design', 'Data encryption', '256-bit TLS transport'],
  },
]

function Features() {
  return (
    <section id="features" className="lp-features">
      <div className="lp-container">
        <div className="lp-section-head">
          <h2 className="lp-section-title">Everything your hospital needs</h2>
          <p className="lp-section-sub">
            A unified platform covering every department and workflow: no integrations, no silos,
            no gaps.
          </p>
        </div>
        <div className="lp-features-grid">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div key={f.title} className="lp-feature-card">
                <div className="lp-feature-icon" style={{ background: f.color }}>
                  <Icon size={24} color={f.iconColor} strokeWidth={2} />
                </div>
                <div className="lp-feature-title">{f.title}</div>
                <div className="lp-feature-desc">{f.desc}</div>
                <div className="lp-feature-list">
                  {f.items.map((item) => (
                    <div key={item} className="lp-feature-list-item">{item}</div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ─── About ──────────────────────────────────────────────── */
function About() {
  const cards = [
    { icon: Heart, color: '#fee2e2', iconColor: '#dc2626', title: 'Patient-First Design', desc: 'Every feature is built around improving patient care and staff efficiency.' },
    { icon: Zap, color: '#fef3c7', iconColor: '#d97706', title: 'Fast & Reliable', desc: '99.9% uptime SLA with sub-200ms response times across all modules.' },
    { icon: Lock, color: '#ede9fe', iconColor: '#7c3aed', title: 'Enterprise Security', desc: 'HIPAA-aligned architecture with end-to-end encryption and audit trails.' },
    { icon: Award, color: '#d1fae5', iconColor: '#059669', title: 'Proven at Scale', desc: 'Deployed in 1,200+ hospitals managing over 5 million patient records.' },
  ]
  return (
    <section id="about" className="lp-about">
      <div className="lp-container">
        <div className="lp-about-inner">
          <div className="lp-about-left">
            <h2 className="lp-about-title">Built by clinicians,<br />for clinicians</h2>
            <p className="lp-about-desc">
              Medicore HMS was designed from the ground up with input from hospital administrators,
              doctors, nurses, and billing teams. The result is software that fits real workflows,
              not the other way around.
            </p>
            <p className="lp-about-desc" style={{ marginBottom: 28 }}>
              Our platform eliminates paper trails, reduces double-bookings, prevents stock-outs,
              and gives management real-time visibility into every corner of their hospital.
            </p>
            <div className="lp-about-pills">
              {['HIPAA Aligned', 'React + TypeScript', 'MongoDB Backend', 'Real-time Analytics', 'Role-Based Access', 'Multi-Hospital'].map((p) => (
                <span key={p} className="lp-about-pill">
                  <CheckCircle2 size={13} color="var(--lp-primary)" /> {p}
                </span>
              ))}
            </div>
            <Link to="/master/register" className="lp-btn lp-btn-primary">
              See it in action <ChevronRight size={16} />
            </Link>
          </div>

          <div className="lp-about-right">
            {cards.map((c) => {
              const Icon = c.icon
              return (
                <div key={c.title} className="lp-about-card">
                  <div className="lp-about-card-icon" style={{ background: c.color }}>
                    <Icon size={20} color={c.iconColor} />
                  </div>
                  <div className="lp-about-card-title">{c.title}</div>
                  <div className="lp-about-card-desc">{c.desc}</div>
                </div>
              )
            })}
            <div className="lp-about-card lp-about-card-big">
              <div className="lp-about-card-icon" style={{ background: 'rgba(255,255,255,.1)' }}>
                <Clock size={22} color="#fff" />
              </div>
              <div>
                <div className="lp-about-card-title">Up and running in minutes</div>
                <div className="lp-about-card-desc">
                  Pre-configured demo data lets your team evaluate every module from day one.
                  No lengthy onboarding required.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Modules showcase ───────────────────────────────────── */
const MODULES = [
  {
    id: 'patients', label: 'Patients', icon: Users,
    title: 'Complete Patient Management',
    desc: 'Register, admit, track and discharge patients with full medical history, allergy records, and insurance details, all accessible in seconds.',
    checks: ['Smart search and patient ID system', 'Blood group, allergies, and notes', 'Admission history and assigned doctors', 'Status tracking: Admitted, Outpatient, Critical'],
    rows: [
      { bg: '#0e7490', init: 'SJ', name: 'Sarah Johnson', meta: 'Cardiology · Admitted', status: 'Admitted', sc: '#cffafe', st: '#0e7490' },
      { bg: '#7c3aed', init: 'JM', name: 'John Miller', meta: 'Oncology · Critical', status: 'Critical', sc: '#fee2e2', st: '#dc2626' },
      { bg: '#059669', init: 'AK', name: 'Aisha Khan', meta: 'Dermatology · Outpatient', status: 'Outpatient', sc: '#dbeafe', st: '#2563eb' },
    ],
  },
  {
    id: 'appointments', label: 'Appointments', icon: CalendarDays,
    title: 'Intelligent Scheduling',
    desc: 'Book appointments with real-time slot availability, automatic conflict prevention, and multi-doctor scheduling across all departments.',
    checks: ['Date & time slot picker', 'In-person and video modes', 'Reschedule with new slot selection', 'Cancel with one click'],
    rows: [
      { bg: '#0891b2', init: 'MR', name: 'Dr. Michael Roberts', meta: 'Aug 02 · 09:00 · Cardiology', status: 'Confirmed', sc: '#d1fae5', st: '#059669' },
      { bg: '#7c3aed', init: 'PS', name: 'Dr. Priya Sharma', meta: 'Aug 02 · 10:00 · Neurology', status: 'Pending', sc: '#fef3c7', st: '#d97706' },
      { bg: '#be185d', init: 'GA', name: 'Dr. Grace Adeyemi', meta: 'Aug 02 · 11:00 · Gynecology', status: 'Confirmed', sc: '#d1fae5', st: '#059669' },
    ],
  },
  {
    id: 'billing', label: 'Billing', icon: Receipt,
    title: 'Billing & Financial Control',
    desc: 'Generate itemised invoices, track payments, handle insurance claims and monitor outstanding balances across all patients and departments.',
    checks: ['Auto invoice generation from visit', 'Multi-method payment tracking', 'Overdue alerts and follow-ups', 'Monthly and department revenue reports'],
    rows: [
      { bg: '#0e7490', init: 'SJ', name: 'INV-2026-0831', meta: 'Sarah Johnson · Cardiac care', status: 'Paid', sc: '#d1fae5', st: '#059669' },
      { bg: '#dc2626', init: 'JM', name: 'INV-2026-0830', meta: 'John Miller · Oncology', status: 'Pending', sc: '#fef3c7', st: '#d97706' },
      { bg: '#d97706', init: 'TB', name: 'INV-2026-0828', meta: 'Tom Brennan · Arthroscopy', status: 'Overdue', sc: '#fee2e2', st: '#dc2626' },
    ],
  },
]

function Modules() {
  const [active, setActive] = useState(0)
  const mod = MODULES[active]
  return (
    <section className="lp-modules">
      <div className="lp-container">
        <div className="lp-section-head">
          <h2 className="lp-section-title">A closer look inside</h2>
          <p className="lp-section-sub">Switch between modules to see exactly what your team will work with.</p>
        </div>
        <div className="lp-modules-tabs">
          {MODULES.map((m, i) => {
            const TabIcon = m.icon
            return (
              <button key={m.id} className={`lp-module-tab ${active === i ? 'active' : ''}`} onClick={() => setActive(i)}>
                <TabIcon size={15} /> {m.label}
              </button>
            )
          })}
        </div>
        <div className="lp-module-display">
          <div className="lp-module-text">
            <h3>{mod.title}</h3>
            <p>{mod.desc}</p>
            <div className="lp-module-checks">
              {mod.checks.map((c) => (
                <div key={c} className="lp-module-check">
                  <div className="lp-check-icon"><CheckCircle2 size={13} /></div>
                  {c}
                </div>
              ))}
            </div>
          </div>
          <div className="lp-module-preview">
            <div className="lp-preview-header">
              <div className="lp-preview-title">{mod.label}</div>
              <div className="lp-preview-badge">{mod.rows.length} records</div>
            </div>
            {mod.rows.map((r) => (
              <div key={r.name} className="lp-preview-row">
                <div className="lp-preview-avatar" style={{ background: r.bg }}>{r.init}</div>
                <div className="lp-preview-info">
                  <div className="lp-preview-name">{r.name}</div>
                  <div className="lp-preview-meta">{r.meta}</div>
                </div>
                <div className="lp-preview-status" style={{ background: r.sc, color: r.st }}>{r.status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Testimonials ───────────────────────────────────────── */
function Testimonials() {
  const items = [
    { stars: 5, text: 'Medicore HMS cut our patient registration time by 60%. The role-based access means every staff member sees exactly what they need: nothing more, nothing less.', name: 'Dr. Priya Sharma', role: 'Medical Director, Neurology', bg: '#7c3aed' },
    { stars: 5, text: 'The billing module alone saved us 15 hours a week. Invoice generation is instant and the overdue alerts mean nothing slips through the cracks.', name: 'Olivia Martinez', role: 'Head of Billing, Springfield General', bg: '#0e7490' },
    { stars: 5, text: 'Bed occupancy dashboards give our nursing team real-time awareness. We can redirect patients instantly and our ward utilization jumped to 92%.', name: 'Emma Wilson', role: 'Head Nurse, Cardiology Ward', bg: '#059669' },
  ]
  return (
    <section className="lp-testimonials">
      <div className="lp-container">
        <div className="lp-section-head">
          <h2 className="lp-section-title">Trusted by healthcare teams</h2>
          <p className="lp-section-sub">Hear from the administrators, doctors, and staff who use Medicore HMS every day.</p>
        </div>
        <div className="lp-testimonials-grid">
          {items.map((t) => (
            <div key={t.name} className="lp-testimonial">
              <div className="lp-testimonial-stars">{'★★★★★'.split('').slice(0, t.stars).map((s, i) => <span key={i}>{s}</span>)}</div>
              <p className="lp-testimonial-text">"{t.text}"</p>
              <div className="lp-testimonial-author">
                <div className="lp-testimonial-avatar" style={{ background: t.bg }}>
                  {t.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div className="lp-testimonial-name">{t.name}</div>
                  <div className="lp-testimonial-role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── CTA Banner ─────────────────────────────────────────── */
function CTABanner() {
  return (
    <section className="lp-cta-section">
      <div className="lp-container">
        <div className="lp-cta-inner">
          <h2 className="lp-cta-title">Ready to modernize<br />your hospital?</h2>
          <p className="lp-cta-sub">Join 1,200+ hospitals already running on Medicore HMS.</p>
          <div className="lp-cta-actions">
<Link to="/master/register" className="lp-btn lp-btn-white">
        Register your hospital <ChevronRight size={16} />
      </Link>
            <Link to="/login" className="lp-btn-ghost-white">
              Log In to Dashboard →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Contact ────────────────────────────────────────────── */
function Contact() {
  const [form, setForm] = useState({ name: '', email: '', hospital: '', message: '' })
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    await new Promise((r) => setTimeout(r, 1000))
    setSent(true)
    setBusy(false)
  }

  return (
    <section id="contact" className="lp-contact">
      <div className="lp-container">
        <div className="lp-contact-inner">
          <div className="lp-contact-info">
            <h2>Get in touch with our team</h2>
            <p>
              Whether you're evaluating Medicore HMS, need a custom demo, or want to discuss
              enterprise pricing: we're here to help.
            </p>
            <div className="lp-contact-items">
              {[
                { icon: Mail, title: 'Email', val: 'medocorehms@gmail.com' },
                { icon: Phone, title: 'Phone', val: '9862962969' },
                { icon: MapPin, title: 'Address', val: 'Itahari, Nepal' },
                { icon: Clock, title: 'Support Hours', val: 'Mon–Fri 8am–8pm · Emergency 24/7' },
              ].map((c) => {
                const CIcon = c.icon
                return (
                  <div key={c.title} className="lp-contact-item">
                    <div className="lp-contact-icon"><CIcon size={19} /></div>
                    <div>
                      <div className="lp-contact-item-title">{c.title}</div>
                      <div className="lp-contact-item-val">{c.val}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="lp-contact-form">
            {sent ? (
              <div className="lp-form-success">
                <div className="lp-form-success-icon">
                  <CheckCircle2 size={32} color="#059669" />
                </div>
                <div className="lp-form-success-title">Message sent!</div>
                <div className="lp-form-success-sub">We'll get back to you within one business day.</div>
                <button className="lp-btn lp-btn-outline" style={{ marginTop: 8 }} onClick={() => { setSent(false); setForm({ name: '', email: '', hospital: '', message: '' }) }}>
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <div className="lp-form-title">Send us a message</div>
                <form onSubmit={submit}>
                  <div className="lp-form-row">
                    <div className="lp-field">
                      <label className="lp-label">Full Name</label>
                      <input className="lp-input" placeholder="Dr. Jane Smith" value={form.name} onChange={set('name')} required />
                    </div>
                    <div className="lp-field">
                      <label className="lp-label">Email Address</label>
                      <input type="email" className="lp-input" placeholder="you@hospital.com" value={form.email} onChange={set('email')} required />
                    </div>
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Hospital / Organization</label>
                    <input className="lp-input" placeholder="Springfield General Hospital" value={form.hospital} onChange={set('hospital')} />
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Message</label>
                    <textarea className="lp-input lp-textarea" placeholder="Tell us about your needs, number of beds, team size…" value={form.message} onChange={set('message')} required />
                  </div>
                  <button type="submit" disabled={busy} className="lp-btn lp-btn-primary" style={{ width: '100%' }}>
                    {busy ? 'Sending…' : 'Send Message'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Footer ─────────────────────────────────────────────── */
function Footer() {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer-main">
          <div>
            <div className="lp-footer-brand-name">
              <MedicoreLogo size={32} />
              Medicore HMS
            </div>
            <div className="lp-footer-brand-desc">
              The modern hospital management platform, built for healthcare excellence, trusted by 1,200+ hospitals worldwide.
            </div>
          </div>
          <div>
            <div className="lp-footer-col-title">Platform</div>
            <ul className="lp-footer-links">
              {['Home','About','Features','Contact'].map((l) => (
                <li key={l}><a href="#" onClick={(e) => { e.preventDefault(); scrollTo(l.toLowerCase()) }}>{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="lp-footer-col-title">Modules</div>
            <ul className="lp-footer-links">
              {['Patients','Doctors','Appointments','Pharmacy','Billing','Staff'].map((m) => (
                <li key={m}><a href="#">{m}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="lp-footer-col-title">Company</div>
            <ul className="lp-footer-links">
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">HIPAA Compliance</a></li>
              <li><a href="#">Security</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); scrollTo('contact') }}>Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} Medicore HMS. All rights reserved.</span>
        </div>
      </div>
    </footer>
  )
}

/* ─── Main export ────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="lp">
      <Navbar />
      <Hero />
      <StatsStrip />
      <About />
      <Features />
      <Modules />
      <Testimonials />
      <CTABanner />
      <Contact />
      <Footer />
    </div>
  )
}
