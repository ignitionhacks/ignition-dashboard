# Backend Build Checklist — Ignition Hacks V7 Hacker Dashboard

**Owner:** Abdullah (Backend) · **Frontend:** Jeremy · **Stack:** Node.js · Express · MongoDB (Mongoose)
**Branch:** `backend/schedule-events` — never work on `main`.
**Rule:** Nothing is ever committed automatically. Every step below has a **Test** you run yourself.

This is the single planner for the whole backend. Work top to bottom. Do not mark a
step `[x]` until its **Test** passes.

### Status legend
- `[ ]` not started
- `[~]` in progress
- `[x]` done **and its test passed**

### How to run any test

The repo is three independent npm packages. Almost every step below is proven by the
test suite, which runs from the **`tests`** folder:

```
C:\Users\abbar\OneDrive\Desktop\Ignition_Hack\ignition-dashboard\tests
```

```bash
npm test
```

Expect it to end with `pass 82` / `fail 0`. ✅ *(confirmed passing 2026-07-27)*
It spins up its own in-memory MongoDB — no `.env`, no Atlas access, and it can never
touch the shared `ignition-dashboard-dev` data.

Server commands run from the **`backend`** folder instead: `npm install` (once),
`npm run dev` (start the API on :4000), `npm run seed -- --yes`
(⚠️ sample data — needs a real DB and **wipes the shared collection first**).

Hand-testing script: [manual-qa.md](manual-qa.md).

---

## Phase 0 — Project setup ✅

- [x] **0.1** Clone repo and create feature branch (`backend/schedule-events`, off `main`)
  - **Test:** `git branch --show-current` prints `backend/schedule-events`.
- [x] **0.2** Scaffold Express app (`backend/src/app.js`, `server.js`) + config, middleware, utils
  - **Test:** `npm test` — `GET /health returns ok` passes.
- [x] **0.3** MongoDB connection via Mongoose (`backend/src/config/db.js`, `.env` driven)
  - **Test:** ⚠️ *not yet verified against the real cluster* — `npm run dev` from `backend`
    should log `[db] Connected to MongoDB (ignition-dashboard-dev)`. See manual-qa §1.5.
- [x] **0.4** Central error handling + 404 handler (`backend/src/middleware/errorHandler.js`)
  - **Test:** `npm test` — `returns 400 for a malformed id`, `returns 404 for a well-formed
    id that does not exist`, and `unknown route returns a 404 JSON error` all pass.

---

## Phase 1 — Schedule Event (design doc §2.2.1) ✅ — Wednesday deliverable

- [x] **1.1** Schema with all §2.2.1 fields: `title`, `description`, `startTime`,
      `endTime`, `location`, `category` enum (`Main`/`Fun`/`Food`/`Workshop`),
      derived `day` + `isFoodEvent`, timestamps
  - **Test:** `unit/scheduleEvent.test.js` — the whole `derived fields` suite.
- [x] **1.2** Data cleanliness: reject blank `title`/`startTime`/`location`; validate
      category enum; `endTime` must be after `startTime`
  - **Test:** `unit/scheduleEvent.test.js` + `integration/schedule.test.js` — the
    `validation` suites in both.
- [x] **1.3** `GET /api/schedule` returns all events, **time-sorted**, filterable by
      `?day=YYYY-MM-DD` and/or `?category=`
  - **Test:** `integration/schedule.test.js` → `GET /api/schedule` suite (sorting +
    all three filter cases + malformed day). Manual: manual-qa §4.
- [x] **1.4** `GET /api/schedule/:id` single event; 404 unknown id; 400 malformed id
  - **Test:** `integration/schedule.test.js` → `GET /api/schedule/:id and /upcoming`.
- [x] **1.5** `POST /api/schedule` create (whitelisted fields, derived fields set server-side)
  - **Test:** `integration/schedule.test.js` → `POST /api/schedule` suite.
- [x] **1.6** `PATCH /api/schedule/:id` update — validators + derived fields re-run
  - **Test:** `integration/schedule.test.js` → `re-derives day when startTime changes`,
    `re-runs validators on update`.
- [x] **1.7** `DELETE /api/schedule/:id` — 204 on success, 404 if missing
  - **Test:** `an organizer can delete an event, after which it is gone`.
- [x] **1.8** Bonus: `GET /api/schedule/upcoming?limit=N` for Home "Happening Next" (§1.2.3)
  - **Test:** `caps /upcoming at the requested limit`.
- [x] **1.9** Seed script with two days of sample events (`npm run seed -- --yes`)
  - **Test:** ⚠️ *not yet verified* — needs a database. See manual-qa §6.

> **Phase 1 gate:** ✅ **PASSED**

---

## Phase 2 — Real auth / roles (design doc §1.2.1) ✅

> The pass-through role stubs are **gone**. Write routes require a real
> Organizer/Admin token, and all schedule routes require authentication.

- [x] **2.1** `User` model: `firstName`, `lastName`, `email` (unique, lowercased),
      `passwordHash` (bcrypt, `select: false`), `authProviderId`, `role` enum
      (`hacker`/`organizer`/`mentor`/`admin`), `status`, `teamId`, `qrCodeId`, timestamps
  - **Test:** `unit/user.test.js` (hashing, virtuals, serialization) +
    `integration/auth.test.js` → `POST /api/auth/register` suite.
- [x] **2.2** `POST /api/auth/register` (creates a hacker), `POST /api/auth/login` → JWT,
      `POST /api/auth/logout`
  - **Test:** `integration/auth.test.js` — including
    `gives an identical error for wrong password and unknown email`.
- [x] **2.3** `requireAuth` middleware populates `req.user` from the Bearer token;
      `GET /api/users/me`
  - **Test:** `integration/users.test.js` → `token handling on GET /api/users/me`.
- [x] **2.4** Real `requireRole` check wired onto the schedule write routes
  - **Test:** `integration/schedule.test.js` → `access control` suite.
- [x] **2.5** `GET /api/users/:id` (organizer/admin), `PATCH /api/users/me`,
      `PATCH /api/users/:id/role` (admin)
  - **Test:** `integration/users.test.js` → the `PATCH /api/users/me`,
    `GET /api/users/:id` and `PATCH /api/users/:id/role` suites, including
    `a promotion takes effect on an already-issued token`.

> **Phase 2 gate:** ✅ **PASSED** (2026-07-27)

---

## Phase 2.5 — Repo restructure to the team layout ✅

`origin/main` now defines the agreed structure (`backend` / `frontend` / `tests` / `docs`).

- [x] **2.5.1** Fast-forward the branch onto `origin/main`
  - **Test:** `git log --oneline HEAD..origin/main` prints nothing.
- [x] **2.5.2** Move the API under `backend/` (`src/`, `package.json`, `.env`, `.env.example`)
  - **Test:** `npm run dev` from `backend` resolves its modules. ⚠️ *pending manual-qa §1.5.*
- [x] **2.5.3** Convert `src/scripts/smokeTest.js` into a standalone `tests/` npm package
      using Node's built-in `node --test` runner, split into `unit/` and `integration/`
  - **Test:** `cd tests && npm test` → `pass 82` / `fail 0`. ✅
- [x] **2.5.4** Drop `mongodb-memory-server` / `supertest` from the backend package
  - **Test:** `npm prune` in `backend` removes them and `npm test` still passes.

> **Why 82 tests where the old smoke script had 57 checks:** the port added model-level
> unit tests (which the script had none of) and split a few compound assertions.

---

## Phase 2.6 — Auth against the Portal database ⚠️ NOT STARTED — plan pending approval

Youssef, 2026-07-27: the dashboard must **not** own its user list. Real users already exist
in `ignition-portal-dev`, which is **READ ONLY** (see [HANDOFF.md](HANDOFF.md) rule 4b).
This invalidates part of Phase 2.

**Decided by Abdullah 2026-07-27:** role map `applicant`→`hacker`, `reviewer`→`organizer`,
`admin`→`admin`; **only `accepted` applicants get dashboard access** (5 hackers,
4 organizers, 3 admins = 12 users today).

- [ ] **2.6.1** Second mongoose connection (`createConnection`) to `ignition-portal-dev`
      with a schema plugin that **throws on every write hook**
  - **Test:** calling `.save()` / `.updateOne()` / `.deleteOne()` on a portal model throws;
    portal doc count is unchanged before and after the suite.
- [ ] **2.6.2** Login verifies `bcrypt.compare` against the portal's `password` field
      (confirmed `$2b$10$`, so no password reset needed)
  - **Test:** login succeeds for a seeded portal-shaped user, fails on a wrong password.
- [ ] **2.6.3** Deny login unless the user's application status is `accepted`
  - **Test:** `waitlisted` / `rejected` / `submitted` / `under_review` / `draft` all `403`.
- [ ] **2.6.4** `DashboardProfile` in **our** DB keyed by `portalUserId`, holding
      `teamId` / `qrCodeId` / attendance; created lazily on first login
  - **Test:** first login creates exactly one profile; second login reuses it.
- [ ] **2.6.5** Delete `POST /api/auth/register` — the dashboard cannot create users
  - **Test:** the route returns 404; no test still depends on it.
- [ ] **2.6.6** Map the portal's single `name` string; do not fabricate a `lastName`
  - **Test:** a portal user with a one-word name still returns a usable display name.

### Open findings from manual QA

- [ ] **2.6.F1** `User.status` is **dead code**. Declared at `backend/src/models/User.js:54`
      with `default: 'Hacker'` and **never written by any code path** — not registration,
      not `PATCH /users/me` (excluded from `SELF_WRITABLE_FIELDS`), not
      `PATCH /users/:id/role`. Every user reads `"status": "Hacker"` forever, including
      admins and organizers. Found during manual-qa §4 on 2026-07-27 (evidence: the 4c/4e
      responses show `role: "admin"` / `role: "organizer"` alongside `status: "Hacker"`).
      **Blocked:** need design doc §1.2.1 checked — is `status` a display label (redundant
      with `role`, should be derived), check-in state (needs an enum, written by the §3 QR
      flow), or application state (comes from the portal, never stored)?
  - **Test:** whatever it becomes, it must change observably when the thing it describes changes.
- [ ] **2.6.F2** 2 portal users are `authProvider: "google"` with no password — they cannot
      log in at all until Google OAuth exists. Confirm with Youssef whether that's acceptable.
- [ ] **2.6.F3** A **production** `ignition-portal` database exists on the same cluster,
      alongside `ignition-portal-dev`. It was never mentioned and is **out of bounds** —
      no reads, no writes. Confirm with Youssef.

---

## Phase 3 — Announcements (design doc §1.2.2)

**Follow the workflow: tests first, then implementation.**

- [ ] **3.1** `Announcement` model: `title?`, `body`, `authorId` (organizer/admin),
      `authorName` (denormalized), `postedAt`, `pinned`, timestamps
  - **Test:** `unit/announcement.test.js` — blank `body` rejected; `postedAt` defaults
    to now; `pinned` defaults to false.
- [ ] **3.2** `GET /api/announcements` — pinned first, then `postedAt` descending;
      pagination via `?limit=&page=`
  - **Test:** `integration/announcements.test.js` — seed 3 (one pinned) → pinned first,
    rest newest-first; `?limit=1&page=2` returns the second one; `limit` capped at 50.
- [ ] **3.3** `POST` / `PATCH /:id` / `DELETE /:id` — organizer/admin only
  - **Test:** organizer create → 201; hacker create → 403; unauthenticated read → 401;
    `authorId` from the token, never the request body; toggling `pinned` reorders the list;
    editing does **not** bump `postedAt`.
- [ ] **3.4** Update [README.md](README.md), [manual-qa.md](manual-qa.md) and this checklist
  - **Test:** the endpoint table lists all four routes; manual-qa has an Announcements section.

---

## Phase 4 — Hackathon config + countdown (design doc §1.2.3)

- [ ] **4.1** `HackathonConfig` singleton: `hackathonStartAt`, `hackathonEndAt`,
      optional `submissionDeadline`
  - **Test:** `GET /api/config/hackathon` returns both timestamps.
- [ ] **4.2** Countdown computed server-side (`hackathonEndAt - now`), never stored
  - **Test:** two calls a few seconds apart show the remaining time decreasing.

---

## Phase 5 — Project Submission (design doc §1.2.4)

- [ ] **5.1** `ProjectSubmission` model: `teamId`, `title`, `description`, `devpostUrl`,
      `repoUrl`, `submittedAt`, timestamps — tied to a **Team**, not a User
  - **Test:** create for a team; a second member of that team sees the same submission via `/mine`.
- [ ] **5.2** `GET /api/submissions/mine`, `POST /api/submissions`,
      `PATCH /api/submissions/:id` (own team only)
  - **Test:** `/mine` → `null` before submitting, the object after; PATCH on another
    team's submission → 403.
- [ ] **5.3** Deadline enforcement: reject POST/PATCH after `hackathonEndAt` /
      `submissionDeadline`
  - **Test:** set deadline in the past → 403/400; set it in the future → 200.
- [ ] **5.4** `GET /api/submissions` (organizer/admin) for judging
  - **Test:** organizer sees all submissions; hacker → 403.

---

## Phase 6 — Profile: Attendance / QR check-in (design doc §3)

- [ ] **6.1** `QRCode` (one-to-one with User) + `Attendance` records for `Food` events
  - **Test:** an attendance record correctly ties user ↔ event. (`isFoodEvent` already
    works — verified in Phase 1.)
- [ ] **6.2** Check-in endpoint marks attendance for a food event via QR
  - **Test:** first check-in → recorded; duplicate check-in → idempotent or 409, not a double record.

> ⚠️ Confirm Phase 6 details against §3 of the design doc before building — those fields
> weren't fully extracted yet.

---

## 🔌 MongoDB Atlas — live connection

The credentials are in place; what's left needs a hand.

- [x] **D.1** Invited to the shared `ignition-hacks` cluster with a database user
- [x] **D.2** `MONGO_URI` filled into `backend/.env`, pointing at `ignition-dashboard-dev`
- [x] **D.4** `JWT_SECRET` generated into `backend/.env` (96 hex chars)
- [x] **D.3** Checked for existing collections — `ignition-dashboard-dev` is **completely
      empty**. Nothing for our `scheduleevents`/`users` to collide with; we're the first
      to write to it.
- [x] **D.5** Live connection verified (2026-07-27) — `[db] Connected to MongoDB
      (ignition-dashboard-dev)`. ⚠️ Required a workaround, see below.
- [ ] **D.7** Verify a few routes in Postman against the live database — manual-qa §1.7, §4, §5
- [ ] **D.6** `npm run seed -- --yes` — ⚠️ wipes the **shared** collection; see manual-qa §6

> **⚠️ `mongodb+srv://` does not work on Abdullah's machine.** A firewall/antivirus rule
> blocks `node.exe` from sending direct UDP:53 DNS queries, so Node's `dns.resolveSrv()`
> fails with `ECONNREFUSED` before any request reaches Atlas. `nslookup` is unaffected
> (different executable), which makes DNS look healthy while Node can't resolve anything.
>
> `backend/.env` now uses the **non-SRV** connection string, which needs only
> `dns.lookup()` — the path that works. The canonical SRV form is kept commented above it.
> Full explanation and the trade-off: [environment-variables.md](environment-variables.md).
>
> This is machine-specific. Jeremy and Youssef should keep using the SRV URI.

---

## Cross-cutting — revisit at every phase

- [ ] **X.1** Every new collection rejects blank/invalid required fields (**test each one**)
- [ ] **X.2** Add `tests/unit/<entity>.test.js` and `tests/integration/<entity>.test.js`
      for each new entity as it lands
  - **Test:** `cd tests && npm test` stays green after every phase, with a higher test count.
- [ ] **X.3** Keep the endpoint table in [README.md](README.md) in sync with new routes
- [ ] **X.4** Keep response shapes consistent: lists → `{ count, items }`; single → the
      object; failures → `{ error }`
- [ ] **X.5** Keep [HANDOFF.md](HANDOFF.md) current so a fresh Claude chat can pick up cleanly
- [ ] **X.6** Keep [manual-qa.md](manual-qa.md) current — a section per feature, **Passed**
      column left blank

---

## 📋 Team CLAUDE.md compliance

- [ ] **T.1** **TDD** — write tests *first*, then implement. Phases 1–2 were built
      implementation-first (tests written alongside, then ported). **Phase 3 onward:
      write `tests/` cases before the controller.**
- [x] **T.2** **Test location** — separate top-level `tests/` npm package, run via
      `cd tests && npm test`. ✅
- [x] **T.3** **Repo structure** — backend now lives under `backend/`. ✅
- [x] **T.4** **`docs/manual-qa.md`** — created. **Executed 2026-07-27** via the Postman
      collection in `docs/postman/`: sections 1 (bar 1.6), 2, 3, 4, 5, 7.1, 7.2 and 7.4 all
      pass; the shared database was left at `count: 0`. Still open: 1.6, §6 (deliberately
      never run), 7.3, 7.5, 7.6, §8. ✅
- [x] **T.5** **`docs/environment-variables.md`** — created; documents `MONGO_URI`,
      `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`. ✅
- [ ] **T.6** **Branch per task** — Phases 0–2.5 all sit uncommitted on
      `backend/schedule-events`. That's one branch for the first PR; **Phase 3 gets its
      own branch** off `main` once this one is merged.

---

## ✉️ For Youssef

Ordered most-blocking first. Items 1–3 came out of the portal-database survey and the
2026-07-27 manual QA run.

### 1. 🔴 Blocking — what is `status` supposed to mean? (finding 2.6.F1)

`User.status` defaults to `"Hacker"` and **no code anywhere ever writes it** — verified by
grepping all of `backend/src`. During QA an account with `role: "admin"` still reported
`status: "Hacker"`, because the default is the only value it can ever hold.

Design doc §1.2.1 lists the field but doesn't say what it's for. It reads three different
ways and each implies different code:

| If it means… | Then it should be… |
| --- | --- |
| a display label for the role | **deleted**, and derived from `role` on read |
| check-in state at the event | `checked-in` / `not-checked-in`, written by the QR scan flow (§3) |
| application state from the portal | read from portal `applications.status`, never stored by us |

**Nothing gets built on this field until you say which.** Deliberately left broken rather
than guessed at.

### 2. 🟠 Two real users cannot log in at all

`ignition-portal-dev` has 2 users with `authProvider: "google"` and **no password**. The
dashboard has no Google OAuth. Once auth reads from the portal (Phase 2.6), those two are
locked out with no workaround. Options: add Google OAuth, issue them a password, or accept
it. Your call.

Related and worth confirming: only **12 of 42** portal users can log in under the rule
Abdullah picked — `accepted` applicants only (5 hackers + 4 organizers + 3 admins).
Waitlisted, submitted, under-review, rejected and draft are all denied.

### 3. 🟠 Please issue a read-only Atlas credential

You told us `ignition-portal-dev` is read-only, and that rule is now written into
`docs/HANDOFF.md` rule 4b and enforced in code by a write-throwing mongoose plugin. But
we're still connecting with the **same read/write user** as the dashboard database — a bug
or a stray script could still write. A dedicated Atlas user with the `read` role on that
database enforces it at the server, which no amount of application code can.

### 4. 🟡 There's a **production** `ignition-portal` database on the same cluster

Alongside `ignition-dashboard-dev` and `ignition-portal-dev`, Atlas shows an
`ignition-portal` database you didn't mention. Treated as entirely out of bounds — not
even read. Flagging it because the same credentials appear to reach it.

### 5. 🟡 The root `CLAUDE.md` is truncated

It ends at the `## Gotchas worth knowing` heading with nothing under it, so the
`MONGO_URI` (not `MONGODB_URI`) warning is missing. It's also still the *Ignition Portal*
file (React 19 / Vite / Brevo email), not adapted to this project.

### 6. ⚪ Housekeeping

- The `temp.md` placeholders in `backend/`, `frontend/`, `tests/` and `docs/` are still
  there — left alone on purpose, they're yours to remove.
- **Phase 2.6 needs your approval before any code is written.** It deletes
  `POST /api/auth/register` and moves the source of truth for users to the portal
  database. The full plan is in the Phase 2.6 section above.
