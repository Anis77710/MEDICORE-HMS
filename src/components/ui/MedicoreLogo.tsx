// Medicore HMS - Brand logo SVG component
// Matches the official Medicore HMS brand mark (blue cross + stethoscope)

interface MedicoreLogoProps {
  size?: number
  className?: string
}

export function MedicoreLogo({ size = 32, className }: MedicoreLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Medicore HMS logo"
      role="img"
    >
      {/* Cross left/dark half */}
      <rect x="10" y="35" width="37" height="30" rx="7" fill="#1565A8" />
      <rect x="35" y="10" width="30" height="37" rx="7" fill="#1565A8" />
      {/* Cross right/light half */}
      <rect x="47" y="35" width="43" height="30" rx="7" fill="#29ABE2" />
      <rect x="47" y="10" width="18" height="80" rx="7" fill="#29ABE2" />
      {/* Dark half bottom fill */}
      <rect x="35" y="47" width="12" height="43" rx="7" fill="#1565A8" />
      {/* Stethoscope - left arc */}
      <path
        d="M41 33 Q34 25 30 33 Q26 43 33 49"
        stroke="white"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="33" cy="50" r="3" fill="white" />
      {/* Stethoscope - right arc */}
      <path
        d="M50 33 Q57 25 61 33 Q65 43 58 49"
        stroke="white"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
