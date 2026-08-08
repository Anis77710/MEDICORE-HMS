<<<<<<< HEAD
# Medicore HMS
=======
# MEDICORE-HMS
>>>>>>> 764dc1ca539691970980275d6cdbc85b05974265

Smart Hospital Management System — complete React frontend (Google Stitch design: Manrope + Inter, teal `#0E7490`) with a full Express + MongoDB backend.

## Stack

- Frontend: React 19 + TypeScript + Vite 8, react-router-dom, lucide-react, custom SVG charts (no chart library)
- Backend: `server/` — Express 5 + TypeScript (ESM) + Mongoose + Zod + JWT refresh-token rotation

## Run

### 1. Backend

```bash
cd server
npm install
# put your MongoDB connection string in server/.env (see server/.env.example):
#   MONGO_URI=mongodb+srv://...
cp .env.example .env
npm run dev      # http://localhost:8080/api
```

### 2. Frontend

```bash
npm install
npm run dev      # http://localhost:5174
```

Log in with the seeded admin: `admin@Medicore HMS.health` / `admin123`.

### Tests

```bash
cd server
npm run smoke    # boots an in-memory MongoDB, seeds, and runs 65 integration tests
```

### Optional scripts

| Script | Purpose |
| --- | --- |
| `npm run seed` | wipe + reseed the database (`MONGO_URI` from `.env`) |
| `npm run dev:memory` | dev server on an in-memory MongoDB (no local DB needed) |
| `npm run build` / `typecheck` | production build / typecheck |
| `npm run lint` | lint from repo root |

## Demo mode vs real API

`VITE_USE_MOCK_API` controls the data source (see `.env.example`):

| Setting | Behavior |
| --- | --- |
| unset or `true` | demo mode on the in-memory mock API (default) |
| `false` | calls the backend at `VITE_API_BASE_URL` (default `http://localhost:8080/api`) |

## Endpoint contract

All frontend endpoints live in `src/api/endpoints.ts` (`ENDPOINTS` registry). Services in `src/api/services/*.ts` call them through the `http` client in `src/api/client.ts`, which attaches a `Bearer` token from `localStorage` (`Medicore HMS_token`) and rotates refresh tokens via the httpOnly cookie (`mc_refresh`). The mock implementations return the exact same JSON shapes, so switching between mock and real backend only requires `.env` changes.

| Method | Endpoint | Service |
| --- | --- | --- |
| POST | `/auth/login` | `services/auth.ts` — `login()` |
| POST | `/auth/register` | `services/auth.ts` — `register()` |
| POST | `/auth/logout` | `services/auth.ts` — `logout()` |
