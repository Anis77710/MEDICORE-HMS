// Lightweight dependency-free SVG charts matching the Stitch design.

function useId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

// ---------- Area / Line chart ----------
export function AreaChart({
  data,
  width = 560,
  height = 240,
  color = '#0e7490',
}: {
  data: { label: string; value: number }[]
  width?: number
  height?: number
  color?: string
}) {
  const id = useId('grad')
  const pad = { top: 16, right: 12, bottom: 30, left: 40 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const max = Math.max(...data.map((d) => d.value)) * 1.15
  const x = (i: number) => pad.left + (i / (data.length - 1)) * innerW
  const y = (v: number) => pad.top + innerH - (v / max) * innerH

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(data.length - 1).toFixed(1)},${(pad.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`

  const yTicks = [0, 0.5, 1].map((f) => Math.round(max * f))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Area chart">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray="4 4" />
          <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="chart-axis-text">
            {t >= 1000 ? `${Math.round(t / 1000)}k` : t}
          </text>
        </g>
      ))}
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={d.label}>
          <circle cx={x(i)} cy={y(d.value)} r="3.2" fill="#fff" stroke={color} strokeWidth="2" />
          <text x={x(i)} y={height - 8} textAnchor="middle" className="chart-axis-text">
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ---------- Bar chart ----------
export function BarChart({
  data,
  height = 240,
  color = '#0e7490',
}: {
  data: { label: string; value: number }[]
  height?: number
  color?: string
}) {
  const width = Math.max(400, data.length * 74)
  const pad = { top: 20, right: 12, bottom: 32, left: 44 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const max = Math.max(...data.map((d) => d.value)) * 1.15
  const barW = Math.min(44, (innerW / data.length) * 0.55)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Bar chart">
      {[0, 0.5, 1].map((f) => {
        const t = Math.round(max * f)
        const y = pad.top + innerH - (t / max) * innerH
        return (
          <g key={f}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" className="chart-axis-text">
              {t >= 1000 ? `${Math.round(t / 1000)}k` : t}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * innerH
        const x = pad.left + (i / data.length) * innerW + (innerW / data.length - barW) / 2
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={pad.top + innerH - h}
              width={barW}
              height={h}
              rx="7"
              fill={color}
              opacity="0.85"
              className="chart-bar"
            />
            <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="chart-axis-text">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ---------- Donut chart ----------
const DONUT_COLORS = ['#0e7490', '#f59e0b', '#10b981', '#ef4444']

export function DonutChart({
  data,
  size = 200,
  thickness = 30,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number }[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const offsets = data.reduce<number[]>((acc, _, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + (data[i - 1].value / total) * c)
    return acc
  }, [])

  return (
    <div className="donut-wrap">
      <div className="donut-figure">
        <svg viewBox={`0 0 ${size} ${size}`} className="chart-svg donut" role="img" aria-label="Donut chart">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
          {data.map((d, i) => {
            const frac = d.value / total
            const dash = frac * c
            return (
              <circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offsets[i]}
                strokeLinecap="butt"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            )
          })}
        </svg>
        {(centerLabel || centerValue) && (
          <div className="donut-center">
            {centerValue && <strong>{centerValue}</strong>}
            {centerLabel && <span>{centerLabel}</span>}
          </div>
        )}
      </div>
      <div className="donut-legend">
        {data.map((d, i) => (
          <div key={d.label} className="donut-legend-item">
            <span className="donut-legend-dot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span>{d.label}</span>
            <span className="donut-legend-value">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- Sparkline ----------
export function Sparkline({
  values,
  width = 120,
  height = 44,
  color = '#0e7490',
}: {
  values: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (values.length < 2) return null
  const max = Math.max(...values) * 1.2 || 1
  const x = (i: number) => (i / (values.length - 1)) * width
  const y = (v: number) => height - (v / max) * height
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden>
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={width} cy={y(values[values.length - 1])} r="2.6" fill={color} />
    </svg>
  )
}
