# HANDOFF — read this first

**Purpose:** paste this file (or point at it) at the start of a new Claude chat so the
assistant picks up exactly where the last one left off, without re-asking or breaking things.

---

## 🚨 Hard rules — do not violate

1. **NEVER commit. NEVER push. NEVER merge.** Not even on a feature branch. Leave all work
   as uncommitted files in the working tree. Abdullah controls git history himself.
2. **NEVER work on `main`.** The current working branch is `backend/schedule-events`.
3. **Running commands is allowed** (`npm install`, `npm test`, `git status`, `git fetch`, …)
   — *except* anything that commits/pushes and anything that writes to a real database.
   Those two go to Abdullah. **This rule was relaxed on 2026-07-27**; earlier notes saying
   "never run any command" are out of date.
4. **Never run `npm run seed` against the shared cluster.** It does `deleteMany({})` and
   `ignition-dashboard-dev` belongs to the whole team.
4b. **`ignition-portal-dev` is STRICTLY READ ONLY.** Two databases live on the one cluster:
   `ignition-dashboard-dev` (read + write, all our work) and `ignition-portal-dev` (the
   existing Portal app's real data — 42 real users). **Never insert, update, delete, upsert,
   drop, or create an index on the portal database.** Reads only: `find`, `countDocuments`,
   `distinct`, `aggregate` without `$out`/`$merge`. Youssef's instruction, 2026-07-27.
5. **All `.md` files live in `docs/` — nowhere else.** The one exception is the root
   `CLAUDE.md`, which is tracked and owned by the team lead. `docs/` is tracked and shared.
6. **When giving Abdullah a command, always say which folder to run it in and what output
   to expect.** The repo is three separate npm packages — "run npm test" is not enough
   information on its own.

---

## 🔁 Mandated workflow — follow for EVERY feature / fix / chore

Set by team lead **Youssef**; also in the root `CLAUDE.md`.

**First: create a branch.** `git checkout main && git pull && git checkout -b <type>/<short-name>`
Never work on `main`. (Abdullah runs the branch/commit steps.)

| # | Step | Who |
| - | ---- | --- |
| 1 | Read the docs | Claude |
| 2 | **Plan the implementation fully — no code yet** | Claude |
| 3 | Write the tests in `tests/` (they verify the implementation) | Claude |
| 4 | Implement the code | Claude |
| 5 | Run new **and** old tests — full suite green | Claude |
| 6 | Update the docs, adding files if needed | Claude |
| 7 | Update `docs/manual-qa.md` | Claude |
| 8 | **Manual testing** | **Abdullah** |

After step 8, **Abdullah** pushes the branch; Youssef reviews and merges to `main`.
**Claude never commits or pushes** — that rule is unchanged.

Do not jump to implementation. Deliver the step-2 plan and get approval first.

## Who's who

- **Abdullah** — backend (this repo's work). Node.js, Express, MongoDB/Mongoose.
- **Jeremy** — frontend. Backend does **not** wait on him; everything is testable via Postman.
- **Youssef** — team lead. Owns `main`, reviews and merges. Issued the Atlas credentials.

---

## Project facts

| | |
| --- | --- |
| Repo | https://github.com/ignitionhacks/ignition-dashboard |
| Local path | `C:\Users\abbar\OneDrive\Desktop\Ignition_Hack\ignition-dashboard` |
| Branch | `backend/schedule-events` (never `main`) |
| Stack | Node.js · Express · MongoDB (Mongoose) · JWT |
| Design doc | `C:\Users\abbar\Downloads\Ignition Hacks V7 Hacker Dashboard Backend Design Document.pdf` (19 pages) |
| Git state | **Nothing committed.** Repo was empty on clone — backend built from scratch. Branch is fast-forwarded to `origin/main` as of 2026-07-27. |

**Design doc section map** (useful for finding requirements fast):
- §1.2.1 User/auth · §1.2.2 Announcements · §1.2.3 Schedule "Happening Next" + HackathonConfig
- §1.2.4 Project Submission · **§2.2.1 Schedule Event — fields + routes table** · §3 Profile/attendance/QR

---

## Repo structure

Three independent npm packages plus docs. **Install and run each in its own folder** —
this trips people up constantly.

```
ignition-dashboard/
  CLAUDE.md         <- team workflow, owned by Youssef (currently truncated - see below)
  backend/          <- the API. npm install / npm run dev / npm run seed here
    src/  .env  .env.example  package.json
  frontend/         <- Jeremy
  tests/            <- the test suite, its OWN npm package. npm install / npm test here
    helpers/  integration/  unit/
  docs/             <- every .md except the root CLAUDE.md
    HANDOFF.md      <- you are here
    CHECKLIST.md    <- THE PLANNER. every step has a test. work from this.
    README.md       <- API reference: schema table, endpoints, curl examples
    manual-qa.md    <- hand-testing script with a blank Passed column
    environment-variables.md
```

---

## Current state — what's built and verified

**Phases 0, 1, 2, 2.5 and 6 are done.** Verification: **`pass 161` / `fail 0`**
(2026-08-05, on branch `backend/qr-attendance`).

> **Two live branches.** `backend/schedule-events` holds phases 0–2.5 (82 tests) and is
> the one waiting on Youssef. `backend/qr-attendance` is **stacked on top of it** — it
> needs `ScheduleEvent`, which isn't on `main` — and holds phase 6 as well (161 tests).
> **Merge the schedule branch first**, otherwise the QR branch won't build.

- **Phase 1 — Schedule Event (§2.2.1)**, the Wednesday deliverable. Model with all
  documented fields plus server-derived `day` (`YYYY-MM-DD`, UTC) and `isFoodEvent`.
  `GET /api/schedule` (filter by `?day=` and/or `?category=`, always sorted by
  `startTime` ascending), `GET /api/schedule/:id`, `GET /api/schedule/upcoming?limit=N`,
  `POST`, `PATCH`, `DELETE`. Blank `title`/`startTime`/`location` rejected; category enum
  enforced; `endTime` must be strictly after `startTime`; validators re-run on update.
- **Phase 2 — auth/roles (§1.2.1).** `User` model with bcrypt `passwordHash`
  (`select: false`), unique lowercased `email`, `role` enum, `status`, `teamId`,
  `qrCodeId`. `POST /api/auth/register|login|logout`, `GET|PATCH /api/users/me`,
  `GET /api/users/:id` (organizer/admin), `PATCH /api/users/:id/role` (admin).
  All schedule routes require a token; writes require organizer/admin.
- **Phase 2.5 — restructure.** Backend moved under `backend/`; the old
  `src/scripts/smokeTest.js` (57 hand-rolled checks) became a real `tests/` package using
  Node's built-in `node --test`, split into `unit/` and `integration/` — 82 tests at that
  point, 161 now.
- **Phase 6 — QR Code (§3.2.1) + Attendance (§3.2.2).** `QRCode` (one per user, UUID,
  both fields unique-indexed, created lazily on first `GET /api/qrcode/me`) and
  `Attendance` (unique on `userId`+`scheduleEventId`). Six routes:
  `GET /api/qrcode/me`, `POST /api/qrcode/scan`, `GET /api/qrcode/:code/user`,
  `GET /api/attendance/me`, `GET /api/attendance/event/:id`, `POST /api/attendance`.
  Repeat scans are idempotent — `200` with `alreadyCheckedIn: true`, timestamp unmoved.
  The meal checklist is **computed on read**, never pre-created. **Scope stopped at the
  entities** — no Profile page, no aggregate profile endpoint, `status` untouched.
  **Manual QA is done** (2026-08-05): Postman folders 9/10/11 → `44/44`, `43/43`, `5/5`
  against emptied collections, and `manual-qa.md` §9/§10 Passed columns are filled in.
  Cleanup between runs is scripted — see `6.11` in [CHECKLIST.md](CHECKLIST.md).

### How to verify in one command

From `C:\Users\abbar\OneDrive\Desktop\Ignition_Hack\ignition-dashboard\tests`:

```bash
npm test
```

Ends with `pass 161` / `fail 0` → the backend is healthy. If not, fix that before anything
else. (First time only: `npm install` in **both** `backend` and `tests`.)

### ⚠️ Known gaps — don't mistake these for bugs

- **`mongodb+srv://` does not work on Abdullah's machine.** A firewall/AV rule blocks
  `node.exe` from sending direct UDP:53 DNS queries, so `dns.resolveSrv()` fails with
  `ECONNREFUSED` before anything reaches Atlas — while `nslookup` works fine, which makes
  DNS look healthy. `backend/.env` uses the **non-SRV** connection string as a workaround
  (canonical SRV form kept commented above it). Machine-specific; don't "fix" it for the
  team. Full write-up in [environment-variables.md](environment-variables.md).
- **The live connection IS verified** as of 2026-07-27 —
  `[db] Connected to MongoDB (ignition-dashboard-dev)`. The database was **empty**, so our
  collections are the first in it. `npm run seed` still has never been run.
- **The env var is `MONGO_URI`, not `MONGODB_URI`** — team convention, and the most common
  mistake on this project.
- **`npm run seed` requires an explicit `--yes`.** It does `deleteMany({})` and the whole
  team shares `ignition-dashboard-dev`.
- **`JWT_SECRET` is required** in `backend/.env` or the server won't issue/verify tokens.
  A real 96-hex-char secret is already generated there. The test suite sets its own
  throwaway secret and needs no `.env`.
- **Logout is a no-op by design** — JWTs are stateless, so the client just discards the
  token. There's no denylist. Fine for a hackathon; note it if instant revocation is needed.
- **`POST /api/auth/register` is not in the design doc.** Added because nothing else can
  create a user. It only ever creates a `hacker` — **there is no HTTP route that creates
  an organizer or admin.** Bootstrap the first admin by editing the `users` document
  directly in Atlas (manual-qa §7.1).
- **Times are stored/compared in UTC.** `day` is derived from `startTime` in UTC
  (`toDayString` in the model). If the event needs a fixed local timezone for day
  grouping, that one function is the single place to change it.
- **The root `CLAUDE.md` is truncated** — it ends at `## Gotchas worth knowing` with
  nothing under it, and is still the unmodified *Ignition Portal* file. Youssef's to fix.

---

## What to do next

**Open [CHECKLIST.md](CHECKLIST.md) — that is the master planner.** Phases 0–2.5 are done.
Next is **Phase 3 (Announcements, §1.2.2)**, and it must follow the workflow above:
**tests first, then implementation** (item T.1 — Phases 1–2 were built the other way round
and that's a gap being closed).

Also outstanding, independent of Phase 3:
- Abdullah runs manual-qa §1 to prove the live database connection (D.5).
- Phase 3 gets its **own branch** off `main` once this one is reviewed and merged (T.6).

Rules for the checklist:
- Every step has a **Test:** line. Never mark a step `[x]` until its test has actually passed.
- New entity ⇒ add `tests/unit/<entity>.test.js` and `tests/integration/<entity>.test.js` (X.2).
- Keep [README.md](README.md)'s endpoint table (X.3) and [manual-qa.md](manual-qa.md) (X.6) in sync.

---

## Conventions already established — match these

- **CommonJS** (`require`), not ESM.
- Async route handlers wrapped in `catchAsync`; throw `new ApiError(status, msg)` for
  expected failures. The central error handler turns Mongoose `ValidationError` → 400
  with a `details[]` array, `CastError` → 400, and duplicate key (11000) → 409.
- Controllers whitelist writable fields (`pickWritable`) so clients can never set derived
  or internal fields.
- **Response shapes:** lists → `{ count, events }`; single item → the object itself;
  errors → `{ error }` (validation errors also carry `details[]`).
- Derived fields (`day`, `isFoodEvent`) are computed in a `pre('validate')` hook so they
  stay correct on both create and update.
- **Tests import the backend through `tests/helpers/backend.js`.** It resolves mongoose
  out of `backend/node_modules` on purpose — a plain `require('mongoose')` from `tests/`
  would load a *second* copy, the models would register on one instance while the tests
  connected the other, and every query would hang. Don't "simplify" that away.
