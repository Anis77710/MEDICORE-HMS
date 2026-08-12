# Medicore HMS — QA Audit Report

**Audit date:** 10 August 2026
**Scope:** Full-stack audit — API (Express 5 + MongoDB), React 19 web app, 20 collections, all 5 portals (Admin, Doctor, Patient, Pharmacy, Front Desk / Public)
**Method:** Live API testing (curl/Invoke-RestMethod), browser-driven UI walkthrough, code review, security review, database integrity scan

---

## Overall Verdict

| Category | Score |
|---|---|
| Functionality | 9.5 / 10 |
| UI / UX | 9.0 / 10 |
| Security | 8.5 / 10 |
| Performance | 9.0 / 10 |
| Code Quality & Maintainability | 9.0 / 10 |
| Data Integrity | 8.5 / 10 |
| **OVERALL** | **8.9 / 10** |

**Production readiness:** ✅ **Approved with 1 Critical + 1 High fix required** (see below). The application is feature-complete, well-architected, and all core flows work end-to-end. Two configuration/domain issues must be resolved before production launch.

---

## Critical Findings (must fix)

### C1. JWT tokens signed with a public, hardcoded default secret
- `server/.env` **does not contain `JWT_SECRET`**, so the app falls back to the hardcoded default `'dev-only-secret-change-me'` (`server/src/config/env.ts:25`).
- **Impact:** Anyone with repo access can forge valid admin/doctor access tokens and impersonate any user. Full account takeover.
- **Fix:** Add `JWT_SECRET` (≥ 32 random chars) to `server/.env`; consider failing fast in production if the default is detected.

---

## High Findings (fix before launch)

### H1. Booking engine does not enforce working days or future dates
- `isSlotFree()` (`server/src/domain/availability.ts:103`) checks **only slot conflicts** — not whether the date is a working day or in the future.
- **Live-proven:** POST `/api/appointments` returned **HTTP 201** for:
  - Sunday `2026-09-13` (availability API correctly reports `workingDay: false` — the doctor's schedule is Mon–Fri)
  - `2020-01-01` (past date)
- The eSewa public flow inherits the same bug: POST `/api/public/payment/initiate` with date `2020-01-01` → **201**, creating a payable attempt for a non-existent date.
- **Impact:** Double-booked Sundays, ghost appointments in the past, paid bookings on days doctors don't work.
- **Fix:** Enforce `isWorkingDay(doctor, date)` and `date >= today` in `isSlotFree` (or the booking routes). The availability UI already gates non-working days, so only the API needs hardening.

---

## Medium Findings

| # | Finding | Evidence / Detail |
|---|---|---|
| M1 | **16 orphaned user accounts** — user records exist with no linked doctor / staffmember / patient profile | e.g. `tymidijiry@mailinator.com` (Active, NURSE), `som@son.so`, `asis@gmail.com`, `aman@ama.ca`… Some can still log in with no profile behind them. Likely from deletes that didn't cascade to users. |
| M2 | **Refresh tokens never expire/clean up** | 102 refresh tokens for 28 users (3.6/user). `REFRESH_TOKEN_TTL_DAYS=7` exists but no expiry enforcement or cleanup job observed; collection grows unbounded. |
| M3 | **Pending payment attempts accumulate forever** | `PaymentAttempt` has no TTL/expiry index; abandoned eSewa checkouts (never hitting success/failure URLs) stay `pending` permanently. 5 cleared during audit. |
| M4 | **No pagination on list tables** (patients, appointments, medicines, invoices, reports…) | All records render per request. Fine at seed scale, will degrade with real hospital volume. |
| M5 | **Doctors can't be deleted** and **doctors can't edit their own work schedule** | Admin has no delete for doctors (inconsistent with other modules); the doctor portal profile shows schedule as read-only. |
| M6 | **Inconsistent date formatting** | Mix of `2026-06-13` (tables) and `June 13, 2026` (modals/cards) across the app. |
| M7 | **Stale session UX** | On access-token expiry (15 min TTL), the app redirects to login but gives no "session expired" message; some pages render empty before the redirect fires. |

---

## Security Review

**Good:**
- Zod validation on all request bodies — every malformed/payload-validation case returned structured 400s with field-level details (verified live).
- Password policy enforced (min 8, upper + lower + digit) and rejected invalid input with 400 (live-tested).
- bcrypt password hashing; access tokens 15-min TTL, refresh rotation with family/jti tracking (`server/src/middleware/auth.ts`).
- Rate limiting present on both global and auth routes (`server/src/app.ts:64,71`).
- eSewa callbacks verify the HMAC signature server-side before creating patient + appointment atomically.
- RBAC enforced per role (admin/doctor/nurse/reception/pharmacist/patient) — cross-role endpoint calls rejected.
- SQL/NoSQL injection: all queries parameterized via Mongoose; no raw query strings. XSS payload in patient name stored but rendered escaped (no script execution).
- `.env` correctly gitignored; only `.env.example` tracked.

**Needs attention:**
- **C1 above** — JWT default secret (critical).
- No 2FA / email verification for staff accounts; password reset relies on OTP email only.
- eSewa sandbox credentials are hardcoded into `.env` comments (development-only; ensure real credentials replace them).
- Success/failure callback URLs point at `localhost:8080` — must be configured per deployment.

---

## Data Integrity

- All 20 collections verified; counts healthy and consistent (users 28, patients 22, doctors 11, staff 8, appointments 20, departments 8, medicines 13, invoices 9, payments 7…).
- No orphaned patients/appointments/doctors found — all cross-references resolve (verified via linked-profile checks).
- 16 orphaned user accounts (M1) — see medium findings.
- Test data created during this audit (appointments, patients, departments, payment attempts) was **removed** after testing; DB is back to its pre-audit state.

---

## Performance

- API latency (dev machine, local MongoDB): p95 **14–60 ms** across all CRUD endpoints; slowest observed were seed-heavy list calls (~160 ms).
- Frontend: page navigations 30–200 ms, JS bundle parse 0.5–1.7 s on cold load.
- No long-tail N+1 patterns found in code review.
- Main risk: M4 (unpaginated tables) at production volume; dashboard loads full appointment/patient sets.

---

## UI / UX Audit Summary (33 findings)

**Notable strengths**
- Polished, consistent design system (sidebars, cards, modals, toasts); excellent empty states, skeletons, and subtle micro-animations.
- Fully responsive (desktop/tablet/mobile verified); keyboard navigable; focus states present.
- Calendar pickers, availability display, and booking stepper are well-built.
- Print, export (CSV/JSON/PDF), and dark mode all work; charts render correctly.

**Key issues (representative sample)**
- Booking stepper loses all entered data on browser back/refresh; leaving the flow mid-way is destructive.
- Past-time slots on the current day are still clickable in the booking wizard (server now rejects conflicts but UX allows selecting an invalid slot).
- Dashboard: no previous-period comparison, empty-state label says "Registered" where the metric is "Added today", and "System overview" uses a Stethoscope/Heart icon set for departments/medicines (misleading).
- Reports: past-date ranges render empty charts with **no "no data" message**.
- Analytics: bar chart lacks tooltips; "Avg rating" shows `0.0` when no reviews exist (misleading).
- Print queue: "Print" icon in the toolbar is inactive; the modal's print button becomes disabled after the first print (reprint requires a different row).
- Login: input auto-fill background overrides dark theme; role icons absent in light mode.
- Success-message counter animation overlaps the value on short counts; horizontal scrollbars appear on some tables.

---

## Verification & Test Coverage

- **101 live API calls** across all roles and modules (auth, RBAC rejection, patients, appointments incl. conflict/rebooking edge cases, doctors, departments, pharmacy stock, invoices, payments, billing, prescriptions, reports, profile, settings, public booking, availability, eSewa initiate/success paths, exports).
- **Browser walkthrough** of all 5 portals including registration, OTP login, complete booking, payment simulation, prescription, billing, and print flows.
- **TypeScript build**: both `client` and `server` compile cleanly (`npm run build` green).
- Audit artifacts (test scripts) run outside the repo and removed after use.

---

## Recommended Fix Order

1. **C1** — set `JWT_SECRET` in `.env` (5 minutes)
2. **H1** — enforce working-day + future-date in `isSlotFree` / booking routes (15 minutes)
3. **M1/M2/M3** — cleanup job: cascade-delete orphaned users, expire refresh tokens, TTL on pending payment attempts
4. **M4–M7** — pagination, doctor deletion/schedule edit, date format consistency, session-expiry messaging
5. UI polish items — booking stepper persistence, dashboard empty-state labels, report no-data message, print toolbar fix
