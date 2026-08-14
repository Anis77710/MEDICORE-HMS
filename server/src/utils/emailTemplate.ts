// ============================================================
// Medicore HMS — shared branded email templates
// ------------------------------------------------------------
// One visual shell for every transactional email so the inbox
// looks consistent and professional:
//   - brand header: the Medicore logo chip + wordmark on the
//     brand gradient (web-app blues #1565A8 → #0e7490),
//   - "Dear <name>," greeting, structured body,
//   - neutral footer.
// Receipts reuse the printable eSewa receipt design from the
// master panel — Georgia serif, teal rules, dashed separators,
// light-blue total row — so the emailed receipt and the
// printable receipt are the same receipt.
// ============================================================

export function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatNpr(amount: number): string {
  return `NPR ${amount.toLocaleString('en-US')}`
}

/** Paid-on timestamp — same shape as the printable receipt. */
export function formatPaidAt(paidAt?: Date): string {
  if (!paidAt) return '—'
  return new Date(paidAt).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const BRAND = {
  teal: '#0e7490',
  blue: '#1565A8',
  sky: '#29ABE2',
  ink: '#1e293b',
  muted: '#64748b',
  line: '#e2e8f0',
  totalBg: '#f0f9ff',
  bodyBg: '#f1f5f9',
  white: '#ffffff',
} as const

// The official Medicore HMS brand mark (blue cross + stethoscope),
// matching src/components/ui/MedicoreLogo.tsx. Embedded as a data
// URI so no external asset hosting is needed.
const LOGO_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 100 100" fill="none">',
  '<rect x="10" y="35" width="37" height="30" rx="7" fill="#1565A8"/>',
  '<rect x="35" y="10" width="30" height="37" rx="7" fill="#1565A8"/>',
  '<rect x="47" y="35" width="43" height="30" rx="7" fill="#29ABE2"/>',
  '<rect x="47" y="10" width="18" height="80" rx="7" fill="#29ABE2"/>',
  '<rect x="35" y="47" width="12" height="43" rx="7" fill="#1565A8"/>',
  '<path d="M41 33 Q34 25 30 33 Q26 43 33 49" stroke="#ffffff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  '<circle cx="33" cy="50" r="3" fill="#ffffff"/>',
  '<path d="M50 33 Q57 25 61 33 Q65 43 58 49" stroke="#ffffff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  '</svg>',
].join('')
const LOGO_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString('base64')}`

/** "Dear <name>," — the standard greeting that opens every email. */
export function greeting(name: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.ink};">Dear <strong>${escHtml(name)}</strong>,</p>`
}

/** A body paragraph (text is HTML-escaped). */
export function paragraph(text: string, opts: { muted?: boolean; center?: boolean } = {}): string {
  return paragraphHtml(escHtml(text), opts)
}

/** A body paragraph with raw HTML (for inline emphasis); escape dynamic values with escHtml(). */
export function paragraphHtml(html: string, opts: { muted?: boolean; center?: boolean } = {}): string {
  const color = opts.muted ? BRAND.muted : BRAND.ink
  const align = opts.center ? 'center' : 'left'
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:${color};text-align:${align};">${html}</p>`
}

/** Inline emphasised text for use inside a paragraph. */
export function emphasis(text: string): string {
  return `<strong>${escHtml(text)}</strong>`
}

/**
 * A key/value info card (credentials, appointment details…): blue
 * header band, dashed separators, right-aligned bold values.
 */
export function kvCard(title: string, rows: { label: string; value: string; mono?: boolean }[]): string {
  const rowsHtml = rows
    .map(
      (r) =>
        `<tr>` +
        `<td style="padding:9px 8px;border-bottom:1px dashed ${BRAND.line};font-size:13px;color:${BRAND.muted};width:44%;">${escHtml(r.label)}</td>` +
        `<td align="right" style="padding:9px 8px;border-bottom:1px dashed ${BRAND.line};font-size:14px;font-weight:600;color:${BRAND.ink};${r.mono ? `font-family:'Courier New',monospace;` : ''}">${escHtml(r.value)}</td>` +
        `</tr>`,
    )
    .join('')
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;border:1px solid #cbd5e1;border-radius:10px;border-collapse:separate;overflow:hidden;">` +
    `<tr><td style="background:${BRAND.blue};color:${BRAND.white};padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;">${escHtml(title).toUpperCase()}</td></tr>` +
    `<tr><td style="padding:4px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table></td></tr>` +
    `</table>`
  )
}

export interface ReceiptRow {
  label: string
  value: string
  total?: boolean
}

/**
 * The official eSewa receipt card — identical in format and colour
 * to the printable receipt in the master panel (Georgia serif,
 * teal rule under the brand header, dashed separators, light-blue
 * total row, serif footer).
 */
export function receiptCard(
  rows: ReceiptRow[],
  opts: {
    subtitle?: string
    date?: string
    footer?: string
  } = {},
): string {
  const subtitle = opts.subtitle ?? 'Hospital Registration Fee — Official Receipt'
  const footer =
    opts.footer ??
    'This is a computer-generated receipt for the Medicore HMS hospital registration fee.<br/>Thank you for choosing Medicore HMS.'
  const rowsHtml = rows
    .map((r) => {
      const cell = r.total
        ? `padding:10px 8px;background:${BRAND.totalBg};font-size:15px;font-weight:700;color:${BRAND.ink};`
        : `padding:8px 8px;border-bottom:1px dashed ${BRAND.line};font-size:13px;color:${BRAND.ink};`
      const label = r.total
        ? `padding:10px 8px;background:${BRAND.totalBg};font-size:15px;font-weight:700;color:${BRAND.ink};`
        : `padding:8px 8px;border-bottom:1px dashed ${BRAND.line};font-size:13px;color:${BRAND.muted};`
      return (
        `<tr><td style="${label}">${escHtml(r.label)}</td>` +
        `<td align="right" style="${cell}">${escHtml(r.value)}</td></tr>`
      )
    })
    .join('')
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;border:1px solid #cbd5e1;border-radius:10px;border-collapse:separate;overflow:hidden;font-family:Georgia,serif;color:${BRAND.ink};">` +
    `<tr><td style="padding:14px 16px;border-bottom:2px solid ${BRAND.teal};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>` +
    `<td><div style="font-size:18px;font-weight:700;color:${BRAND.ink};font-family:Georgia,serif;">Medicore HMS</div>` +
    `<div style="font-size:11px;color:${BRAND.muted};margin-top:2px;font-family:Georgia,serif;">${escHtml(subtitle)}</div></td>` +
    `<td align="right" style="font-size:11px;color:${BRAND.muted};white-space:nowrap;font-family:Georgia,serif;">${escHtml(opts.date ?? '')}</td>` +
    `</tr></table></td></tr>` +
    `<tr><td style="padding:4px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table></td></tr>` +
    `<tr><td style="padding:12px 16px 14px;text-align:center;font-size:11px;color:${BRAND.muted};line-height:1.7;font-family:Georgia,serif;">${footer}</td></tr>` +
    `</table>`
  )
}

/**
 * The full branded email shell: logo header on the brand gradient,
 * title + body card, neutral footer. Every transactional email
 * uses this layout so the whole outbox looks like one family.
 */
export function emailLayout(opts: { title: string; body: string }): string {
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escHtml(opts.title)}</title></head>` +
    `<body style="margin:0;padding:0;background:${BRAND.bodyBg};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bodyBg};padding:24px 12px;">` +
    `<tr><td align="center">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">` +
    `<tr><td style="background:linear-gradient(135deg,${BRAND.blue} 0%,${BRAND.teal} 100%);border-radius:14px 14px 0 0;padding:20px 28px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0"><tr>` +
    `<td style="padding-right:14px;"><img src="${LOGO_DATA_URI}" width="52" height="52" alt="Medicore HMS logo" style="display:block;border-radius:10px;background:${BRAND.white};padding:4px;"/></td>` +
    `<td><div style="color:${BRAND.white};font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;letter-spacing:0.4px;">Medicore HMS</div>` +
    `<div style="color:#cffafe;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;margin-top:2px;">Hospital Management Platform</div></td>` +
    `</tr></table></td></tr>` +
    `<tr><td style="background:${BRAND.white};border:1px solid ${BRAND.line};border-top:none;border-radius:0 0 14px 14px;padding:26px 30px;font-family:Arial,Helvetica,sans-serif;">` +
    `<div style="font-size:17px;font-weight:700;color:${BRAND.ink};margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;">${escHtml(opts.title)}</div>` +
    `${opts.body}` +
    `</td></tr>` +
    `<tr><td style="padding:16px 10px 4px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${BRAND.muted};line-height:1.7;">` +
    `This is an automated message from Medicore HMS. Please do not reply to this email.<br/>` +
    `&copy; ${new Date().getFullYear()} Medicore HMS — Hospital Management Platform` +
    `</td></tr>` +
    `</table></td></tr></table>` +
    `</body></html>`
  )
}
