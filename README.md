# Medicore HMS

**Smart Hospital Management System** — a complete hospital administration platform with a modern marketing site, an admin dashboard, and a full Express + MongoDB backend.

![Stack](https://img.shields.io/badge/React%2019-61DAFB?logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite%208-646CFF?logo=vite&logoColor=white) ![Express](https://img.shields.io/badge/Express%205-000000?logo=express) ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Run the backend](#1-run-the-backend)
  - [2. Run the frontend](#2-run-the-frontend)
- [Demo Mode vs Real API](#demo-mode-vs-real-api)
- [Seeded Accounts](#seeded-accounts)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [API / Endpoint Contract](#api--endpoint-contract)
- [Authentication & Security](#authentication--security)
- [Production Build](#production-build)

---

## Features

**Public website (`/`)**

- Marketing landing page (hero, features, module showcase, testimonials, contact)
- Public **Book an Appointment** page (`/book-appointment`) — visitors pick a doctor, date and time; the booking creates a patient record + pending appointment
- Registration, login, password reset with OTP verification

**Admin dashboard (role-based access control)**

- Dashboard with KPIs and charts (custom SVG, no chart library)
- **Patients** — CRUD, detail view (medical records, prescriptions, billing history, documents)
- **Doctors** — manage schedules, fees, specialities
- **Appointments** — calendar + list view, booking, status workflow (Pending → Confirmed → Completed / Cancelled)
- **Departments, Pharmacy, Billing, Staff, Reports, Settings**
- Role-based UI: Admin, Doctor, Nurse, Staff each see only their allowed modules

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, react-router-dom 7, lucide-react, Tailwind 4 |
| Backend | `server/` — Express 5, TypeScript (ESM), Mongoose (MongoDB), Zod validation |
| Auth | JWT access tokens + httpOnly refresh-token rotation, bcrypt password hashing |
| Other | helmet, cors, express-rate-limit, morgan, nodemailer (OTP email), mongodb-memory-server (tests) |

---

## Project Structure

```
MedicoreHMS/
├── src/                        # Frontend
│   ├── api/                    # HTTP client, endpoints registry, mock API, services
│   │   ├── services/           # One service module per domain (auth, patients, ...)
│   │   ├── client.ts           # fetch wrapper: Bearer token + refresh rotation
│   │   ├── mock.ts             # in-memory demo API (exact same JSON shapes)
│   │   └── store.ts            # mock data store
│   ├── components/             # Shared UI (layout, ui primitives, logo)
│   ├── context/                # AuthProvider, ToastProvider
│   ├── pages/                  # Dashboard, patients, doctors, appointments,
│   │   │                       # departments, pharmacy, billing, staff, reports,
│   │   │                       # settings, auth (login/register/otp), landing
│   ├── rbac/roles.ts           # Role → module access matrix
│   ├── types/                  # Shared TypeScript types
│   ├── App.tsx                 # Routes + route guards
│   └── main.tsx
└── server/                     # Backend (Express + MongoDB)
    ├── src/
    │   ├── index.ts            # Server entrypoint
    │   ├── models/             # Mongoose models
    │   ├── routes/             # API routes
    │   ├── seed/               # Database seeder
    │   └── scripts/            # smoke tests, in-memory dev server
    ├── .env.example            # Server configuration template
    └── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js 18+**
- **MongoDB** (local `mongod` or [MongoDB Atlas](https://www.mongodb.com/atlas)) — only required for real-backend mode

### 1. Run the backend

```bash
cd server
npm install
cp .env.example .env          # then edit .env — at minimum set MONGO_URI
npm run dev                   # API on http://localhost:8080/api
```

Key settings in `server/.env`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | API port |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/healsync` | MongoDB connection string |
| `CORS_ORIGIN` | `http://localhost:5173,http://localhost:5174` | Allowed frontend origins |
| `JWT_SECRET` | dev-only value | **Change in production** |
| `EMAIL_TRANSPORT` | `smtp` | Email transport. `smtp` = real delivery (mandatory); `log` = test-only print/capture, never in production |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | empty / `587` | SMTP server credentials for authentic email delivery (OTP + appointment notifications) |
| `EMAIL_FROM` | `Medicore HMS <no-reply@medicore.health>` | From-address used on all outbound email |

> **Email policy:** all outbound email (password-reset OTPs and patient
> appointment notifications for bookings, approvals, cancellations and
> reschedules) is sent through real SMTP. There is no demo/console delivery
> in normal operation, and production refuses to start without SMTP configured.

### 2. Run the frontend

```bash
npm install
npm run dev                   # app on http://localhost:5173
```

---

## Demo Mode vs Real API

`VITE_USE_MOCK_API` (see `.env.example`) controls the data source:

| Setting | Behavior |
| --- | --- |
| unset or `true` | **Demo mode** — in-memory mock API, no backend needed |
| `false` | Calls the real backend at `VITE_API_BASE_URL` |

```bash
# Use the real backend:
cp .env.example .env
# .env: VITE_USE_MOCK_API=false
```

The mock implementation returns the exact same JSON shapes as the real API, so switching between the two is purely a `.env` change.

---

## Seeded Accounts

After seeding the backend (`npm run seed`), log in with:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@healsync.health` | `admin123` |

The seed also populates demo doctors, patients, appointments, staff, and billing data.

---

## Available Scripts

### Frontend (repo root)

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start Vite dev server (`http://localhost:5173`) |
| `npm run build` | Typecheck (`tsc -b`) + production build |
| `npm run lint` | ESLint |
| `npm run preview` | Preview the production build |

### Backend (`server/`)

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server with hot reload (`tsx watch`) |
| `npm run dev:memory` | Dev server on an **in-memory** MongoDB (no local DB needed) |
| `npm run seed` | Wipe + reseed the database (`MONGO_URI` from `.env`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run the compiled production server |
| `npm run typecheck` | TypeScript typecheck (`--noEmit`) |
| `npm run smoke` | Boot in-memory MongoDB, seed, run integration tests |

---

## Testing

```bash
cd server
npm run smoke   # boots an in-memory MongoDB, seeds data, runs integration tests
```

---

## API / Endpoint Contract

All frontend endpoints are registered in `src/api/endpoints.ts` (`ENDPOINTS`). Services in `src/api/services/*.ts` call them through the `http` client in `src/api/client.ts`, which attaches the `Bearer` token from `localStorage` and rotates refresh tokens via the httpOnly cookie.

| Method | Endpoint | Service |
| --- | --- | --- |
| POST | `/auth/login` | `services/auth.ts` — `login()` |
| POST | `/auth/register` | `services/auth.ts` — `register()` |
| POST | `/auth/logout` | `services/auth.ts` — `logout()` |
| ... | ... | full registry in `src/api/endpoints.ts` |

---

## Authentication & Security

- Passwords hashed with **bcrypt**
- Short-lived **JWT access tokens** stored client-side
- **httpOnly refresh tokens** with rotation for long-lived sessions
- **Zod** request validation on the backend
- **helmet** + **CORS** origin allowlist + **rate limiting** on the API

---

## Production Build

```bash
# Backend
cd server && npm run build && npm run start

# Frontend (static bundle in dist/)
npm run build
```

Deploy `dist/` to any static host (Vercel, Netlify, Nginx, ...) and point `VITE_API_BASE_URL` at the deployed API. **Never** use the default `JWT_SECRET` from `.env.example` in production.
