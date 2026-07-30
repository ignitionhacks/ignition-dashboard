# Ignition Hacks V7 — Hacker Dashboard Backend

Node.js + Express + MongoDB (Mongoose) API for the Hacker Dashboard.

Implemented so far: **auth + roles** (design doc §1.2.1) and the **Schedule Event** entity
and its endpoints (§2.2.1) — the data behind the Schedule page and the "Happening Next"
panel on the Home Dashboard.

## Docs in this folder

| File | What it's for |
| ---- | ------------- |
| [HANDOFF.md](HANDOFF.md) | **Start a new Claude chat with this.** Rules, current state, known gaps. |
| [CHECKLIST.md](CHECKLIST.md) | **The master planner.** Every step + its test. Work from this. |
| [manual-qa.md](manual-qa.md) | Hand-testing script. Every table has a blank **Passed** column for the tester. |
| [environment-variables.md](environment-variables.md) | Every env var, what it does, how to get a value. |
| README.md | This file — API reference (schema + endpoints + examples). |

The root `CLAUDE.md` holds the team's mandated workflow and is owned by the team lead.

## Repo layout

The repo follows the team's agreed structure — `backend/`, `frontend/`, `tests/` and
`docs/` are **three independent npm packages plus docs**. Install and run each in its
own folder.

```
ignition-dashboard/
  CLAUDE.md                    Team workflow (owned by the team lead)
  backend/                     <- this API
    src/
      app.js                   Express app (exported separately so tests can import it)
      server.js                Entry point: connect DB, then listen
      config/db.js             Mongoose connection (reads MONGO_URI)
      models/ScheduleEvent.js  Schema + derived fields + validation
      models/User.js           bcrypt hashing, roles, passwordHash select:false
      controllers/             scheduleController · authController · userController
      routes/                  scheduleRoutes · authRoutes · userRoutes
      middleware/auth.js       requireAuth (re-reads req.user from the DB) + requireRole
      middleware/errorHandler.js  404 + validation/cast/duplicate-key -> clean JSON
      utils/                   catchAsync · ApiError · token (JWT sign/verify)
      scripts/seed.js          Sample events (requires --yes; see the warning below)
    .env                       Local secrets, git-ignored
    .env.example               Template
  frontend/                    <- Jeremy
  tests/                       <- backend test suite (its own npm package)
    helpers/                   backend bridge · in-memory DB · fixtures
    integration/               health · auth · users · schedule
    unit/                      scheduleEvent · user
  docs/                        You are here
```

## Stack

- Node.js / Express / Mongoose
- JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`)
- Tests: Node's built-in `node --test` runner + `supertest` + `mongodb-memory-server`

## Getting started

**Install the backend** — from `C:\Users\abbar\OneDrive\Desktop\Ignition_Hack\ignition-dashboard\backend`:

```bash
npm install
```

**Install the tests** — from `...\ignition-dashboard\tests`:

```bash
npm install
```

### Running the tests

From the `tests` folder. No database, `.env` or Atlas access needed — the suite spins up
its own in-memory MongoDB, so it can never touch the shared `ignition-dashboard-dev` data:

```bash
npm test
```

Expect it to end with `pass 82` / `fail 0`.

### Running the server

Copy `.env.example` to `.env` in `backend/` and fill it in (see
[environment-variables.md](environment-variables.md)), then from `backend/`:

```bash
npm run dev
```

Expect `[db] Connected to MongoDB (ignition-dashboard-dev)` followed by
`[server] Schedule API listening on http://localhost:4000`.

> ⚠️ **`npm run seed` wipes the schedule collection** (`deleteMany({})`) and the whole team
> shares `ignition-dashboard-dev`. It refuses to run without an explicit opt-in:
> `npm run seed -- --yes`. It prints the target database name before touching anything —
> read that line.

## Schedule Event schema (§2.2.1)

| Field         | Type    | Notes                                                        |
| ------------- | ------- | ------------------------------------------------------------ |
| `_id`         | ObjectId| Auto                                                         |
| `title`       | String  | Required, non-blank, trimmed                                 |
| `description` | String  | Optional                                                     |
| `startTime`   | Date    | Required (full date + time, stored UTC)                      |
| `endTime`     | Date    | Optional; must be **strictly after** `startTime`             |
| `location`    | String  | Required, non-blank, trimmed                                 |
| `category`    | String  | Required enum: `Main` \| `Fun` \| `Food` \| `Workshop`       |
| `day`         | String  | Derived from `startTime` as `YYYY-MM-DD` (UTC), indexed      |
| `isFoodEvent` | Boolean | Derived (`category === 'Food'`)                              |
| `createdAt` / `updatedAt` | Date | Auto (timestamps)                                |

`day` and `isFoodEvent` are derived server-side on every create **and** update — clients
don't send them, and any value they do send is ignored.

> **Timezone note:** times are stored and compared in UTC, and `day` is derived in UTC.
> If the event needs a fixed local timezone for day grouping, change `toDayString` in
> `backend/src/models/ScheduleEvent.js` — it's the only place that decides this.

## Authentication

All `/api/schedule` and `/api/users` routes require a JWT. Get one from
`/api/auth/register` or `/api/auth/login`, then send it on every request:

```
Authorization: Bearer <token>
```

| Method | Route | Access | Description |
| ------ | ----- | ------ | ----------- |
| POST | `/api/auth/register` | Public | Create an account (always role `hacker`) → user + token |
| POST | `/api/auth/login` | Public | Authenticate → user + token |
| POST | `/api/auth/logout` | Authenticated | Client discards the token (JWTs are stateless) |
| GET | `/api/users/me` | Authenticated | Own profile — feeds "Welcome, {firstName}!" |
| PATCH | `/api/users/me` | Authenticated | Update own `firstName`/`lastName` only |
| GET | `/api/users/:id` | Organizer / Admin | Look up any user (check-in desk) |
| PATCH | `/api/users/:id/role` | Admin | Change a user's role |

Roles: `hacker`, `organizer`, `mentor`, `admin`.

**Security notes:**
- Passwords are bcrypt-hashed; `passwordHash` has `select: false` and is stripped in
  `toJSON`, so it can never appear in a response.
- `PATCH /api/users/me` only accepts `firstName`/`lastName` — a hacker cannot promote
  themselves. Role changes are admin-only.
- `requireAuth` re-reads the user from the database each request, so a role change or
  deleted account takes effect immediately rather than when the token expires.
- Login returns the same error for an unknown email and a wrong password, so the endpoint
  can't be used to discover which emails are registered.
- `POST /api/auth/register` is **not** in the design doc's routes table — it was added
  because otherwise there's no way to create the first user. It can only ever create a
  `hacker`. **There is no HTTP route that creates an organizer or admin** — promote an
  existing user with `PATCH /api/users/:id/role` (admin only), or set the role directly
  in the database for the very first admin.
- Logout is a deliberate no-op: JWTs are stateless and there's no denylist, so a stolen
  token stays valid until it expires. Fine for a hackathon; flag it if instant revocation
  is ever needed.

## Endpoints

Base path: `/api/schedule` — **all routes require a valid token.**

| Method | Route                        | Access\*          | Description                                   |
| ------ | ---------------------------- | ----------------- | --------------------------------------------- |
| GET    | `/api/schedule`              | Any role          | List events, filter by `?day` and/or `?category`; always time-sorted |
| GET    | `/api/schedule/upcoming`     | Any role          | Next N events with `startTime >= now` (`?limit`, default 5, max 50) |
| GET    | `/api/schedule/:id`          | Any role          | Single event detail                           |
| POST   | `/api/schedule`              | Organizer / Admin | Create an event                               |
| PATCH  | `/api/schedule/:id`          | Organizer / Admin | Update an event                               |
| DELETE | `/api/schedule/:id`          | Organizer / Admin | Delete an event                               |

\* "Any role" = any authenticated user (`hacker`/`mentor`/`organizer`/`admin`). No token
→ `401`; wrong role on a write route → `403`. Enforced by `requireAuth` + `requireRole`
in `backend/src/middleware/auth.js`.

### Query parameters for `GET /api/schedule`

- `day` — `YYYY-MM-DD` (e.g. `2026-08-14`). Invalid format → `400`.
- `category` — one of `Main`, `Fun`, `Food`, `Workshop`. Invalid → `400`.

Both are optional and can be combined. Results are always sorted by `startTime` ascending,
and blank titles/times/locations are guaranteed never to appear.

### Response shapes

List endpoints return `{ "count": <n>, "events": [ ... ] }`. Single-event endpoints return
the event object directly. Errors return `{ "error": "..." }` (validation errors also
include a `details` array).

## Postman / curl examples

Every example needs a token. Get one first:

```bash
curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"you@example.com\",\"password\":\"yourpassword\"}"
```

Copy the `token` from the response and use it as `<TOKEN>` below.

```bash
curl "http://localhost:4000/api/schedule?day=2026-08-15&category=Food" -H "Authorization: Bearer <TOKEN>"
```

```bash
curl "http://localhost:4000/api/schedule/upcoming?limit=5" -H "Authorization: Bearer <TOKEN>"
```

Writes additionally need an **organizer or admin** token:

```bash
curl -X POST http://localhost:4000/api/schedule -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" -d "{\"title\":\"Opening Ceremony\",\"startTime\":\"2026-08-14T09:00:00Z\",\"endTime\":\"2026-08-14T10:00:00Z\",\"location\":\"Main Auditorium\",\"category\":\"Main\"}"
```

```bash
curl -X PATCH http://localhost:4000/api/schedule/PASTE_ID_HERE -H "Content-Type: application/json" -H "Authorization: Bearer <TOKEN>" -d "{\"location\":\"Grand Hall\"}"
```

```bash
curl -X DELETE http://localhost:4000/api/schedule/PASTE_ID_HERE -H "Authorization: Bearer <TOKEN>"
```

> The escaped-quote style above is for Windows. Postman is easier for day-to-day testing —
> point it at `http://localhost:4000`, use **Body → raw → JSON**, and set the token once
> under **Authorization → Bearer Token**. See [manual-qa.md](manual-qa.md) for a full
> hand-testing script.
