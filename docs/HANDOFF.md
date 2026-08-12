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

**Phases 0, 1, 2, 2.5, 3, 4, 5, 6, 7 and 8 are done.** Verification: **`pass 335` /
`fail 0`** (2026-08-12, on branch `backend/api-design-and-remaining-entities`).

> **Three live branches, stacked.** `backend/schedule-events` holds phases 0–2.5
> (82 tests) and is the one waiting on Youssef. `backend/qr-attendance` is stacked on it
> — it needs `ScheduleEvent`, which isn't on `main` — and adds phase 6 (161 tests).
> `backend/api-design-and-remaining-entities` is stacked on **that**, and adds phases 7,
> 3, 4, 8 and 5 (335 tests). **Merge in that order** or none of them build.

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
- **Phase 7 — API design (§5).** Every `/api` response is now
  `{ success: true, data }` or `{ success: false, error: { code, message, details? } }`.
  `utils/apiResponse.js` (`ok`/`created`/`fail`), a seven-code `ERROR_CODES` map, and a
  rewritten `errorHandler`. All 21 existing response sites and all the tests were
  migrated. **Two deliberate exceptions:** `GET /health` stays bare, and `DELETE` returns
  `200` + `{ deleted, id }` rather than `204` (a `204` has no body to carry the envelope).
  Done before phases 3–5 so the new entities were written against the final contract once.
- **Phase 3 — Announcements (§1.2.2).** `Announcement` model (optional `title`, required
  `body`, `authorId` + denormalized `authorName` taken from the token, `postedAt`,
  `pinned`), indexed `{ pinned: -1, postedAt: -1 }`. Four routes on `/api/announcements`:
  `GET` for any authenticated role, `POST`/`PATCH /:id`/`DELETE /:id` behind
  `requireRole('organizer', 'admin')`. Pinned sorts above newer unpinned; `?limit`/`?page`
  are clamped (max 50), never rejected; `PATCH` can't move `postedAt` or rewrite the
  author. **No `GET /:id`** and **no read/unread state** — §1.2.2 asks for neither.
  Built tests-first.
  **Manual QA is done** (2026-08-05): Postman folders 9/10/11 → `44/44`, `43/43`, `5/5`
  against emptied collections, and `manual-qa.md` §9/§10 Passed columns are filled in.
  Cleanup between runs is scripted — see `6.11` in [CHECKLIST.md](CHECKLIST.md).
- **Phase 4 — HackathonConfig + countdown (§1.2.3).** A **singleton** document holding
  `hackathonStartAt` / `hackathonEndAt` / optional `submissionDeadline`. The singleton is
  enforced by a unique index on a pinned internal field, not by convention — a second
  document is impossible. `GET /api/config/hackathon` (any role) returns the config plus
  `serverTime` and a `countdown` computed per request (`msRemaining`, `HH:MM:SS`
  `formatted` that does **not** wrap at 24h, `hasStarted`, `hasEnded`, clamped at zero).
  `PUT /api/config/hackathon` is **admin-only** — unlike schedule and announcement writes,
  an organizer gets a `403` — and is a full replace, so omitting `submissionDeadline`
  clears it. Built tests-first.
- **Phase 8 — Team (§7's assumption).** `Team` model (`name` unique **case-insensitively**
  via a collated index, `memberIds` capped at 4, optional `createdBy`) plus
  `services/teamService.js`, which is the only sanctioned writer of `memberIds` and
  `User.teamId` — a user belongs to at most one team, adding twice is idempotent, and
  `reconcile()` repairs drift between the two sides. **No router is mounted, deliberately:**
  §5's router list has no team router, so teams are provisioned by
  `backend/src/scripts/manageTeams.js` (`list` / `create` / `add` / `remove` / `reconcile`),
  the way §7 provisions elevated roles. The cost — teams can't be created from Postman — is
  written up in [README.md](README.md) and [plan/04-team.md](plan/04-team.md); adding a
  `teamRouter` later is ~40 lines because every rule already lives in the service. Built
  tests-first.
- **Phase 5 — Project Submission (§1.2.4).** `Submission` model scoped to a **team**, not
  a user: `teamId` (unique-indexed — that index *is* §4's "one submission per team"),
  `title`/`description` with 200/5000 caps, optional `devpostUrl`/`repoUrl` validated only
  for an `http(s)` scheme, immutable `submittedAt`, and an added `submittedBy` for audit.
  Four routes on `/api/submissions`: `GET /mine`, `POST`, `PATCH /:id` (hacker, own team
  only) and `GET /` for judging (organizer/admin). **`teamId` and `submittedBy` always
  come from the token, never the body**, on create and update alike. A hacker with no team
  gets `409 NO_TEAM` — a distinct code from the "already submitted" `409`. `GET /mine`
  with nothing submitted is **`200` with `data: null`, not a `404`**: it drives the Home
  button's two states. Deadline = `submissionDeadline` if set, else `hackathonEndAt`; past
  it, `POST` and `PATCH` are `403 SUBMISSION_CLOSED`. **No config at all fails open** (the
  write is allowed and a warning is logged) — see CHECKLIST **5.Q2**. Ownership is checked
  *before* the deadline so an outsider can't probe the window. No `DELETE`, no `GET /:id`.
  Built tests-first.

### How to verify in one command

From `C:\Users\abbar\OneDrive\Desktop\Ignition_Hack\ignition-dashboard\tests`:

```bash
npm test
```

Ends with `pass 335` / `fail 0` → the backend is healthy. If not, fix that before anything
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
- **Teams have no HTTP routes and that is on purpose.** Don't "fix" it by adding a
  `teamRouter` — §5's router list doesn't have one, and Abdullah's instruction was to
  follow the doc. Use `node src/scripts/manageTeams.js` from `backend/`. See CHECKLIST
  open question **8.Q1** if the team wants that revisited.
- **Testing submissions needs that CLI script first.** No team, no submission — Postman
  alone is not enough for this one entity. Folder 16 handles it as gracefully as it can:
  rows 16.0.1–16.0.4 create the accounts over HTTP, its description carries the five
  `manageTeams.js` commands to run next, and 16.0.11 fails with a message naming them if
  they were skipped. By hand, manual-qa §16 still needs §15 run first.
- **A missing hackathon config means no submission deadline at all.** The check fails open
  and logs `[submissions] No hackathon config is set`. "The deadline isn't working" is
  almost always "nobody ran `PUT /api/config/hackathon`".
- **An organizer cannot edit or delete a submission.** Write routes are hacker-only and
  there is no `DELETE` — §1.2.4 lists neither. Fixes go back to the team or into Atlas.
  CHECKLIST open question **5.Q1**.
- **Times are stored/compared in UTC.** `day` is derived from `startTime` in UTC
  (`toDayString` in the model). If the event needs a fixed local timezone for day
  grouping, that one function is the single place to change it.
- **The root `CLAUDE.md` is truncated** — it ends at `## Gotchas worth knowing` with
  nothing under it, and is still the unmodified *Ignition Portal* file. Youssef's to fix.

---

## What to do next

**Open [CHECKLIST.md](CHECKLIST.md) — that is the master planner**, and
[plan/README.md](plan/README.md) for the current run of work (§3–§5 of the design doc,
split into six phases with one `.md` each). **All six plan phases are done.** Nothing in
`plan/` is waiting on another agent.

What's left is **Abdullah's step 8: run the Postman collection against Atlas.** The
collection was rewritten in plan phase 6 —
[`docs/postman/ignition-dashboard.postman_collection.json`](postman/ignition-dashboard.postman_collection.json),
now **216 requests across 16 folders** (104 across 11 before), every assertion moved under
the §5 envelope, plus a collection-level post-response script that checks the envelope on
every single request. It has never been run against a real database; the **Passed** columns
in [manual-qa.md](manual-qa.md) §12, §13, §14, §16 are all blank, and so are §15's.

Three things to know before running it:

1. **Delete any older import first.** The whole collection changed shape — a stale copy
   will "pass" on `undefined === undefined`.
2. **Folder 16 needs five `manageTeams.js` commands** run between rows 16.0.4 and 16.0.5.
   They are in the folder's description. Row 16.0.11 fails with a message naming them if
   they were skipped.
3. **Folders 14 and 16 write the shared hackathon config.** 14.0.4 saves the existing dates
   and 14.16 restores them; folder 16 leaves a live 48-hour window in place. Stopping
   either folder half way leaves the config wrong for everyone.

Then fill in the **Passed** columns and push. See
[plan/06-postman-and-docs.md](plan/06-postman-and-docs.md) for what landed and the five
places it deviates from its own plan.

> **Two numbering schemes, unfortunately.** CHECKLIST phase numbers follow the design
> doc's sections; `plan/` phases are numbered 1–6 in execution order. CHECKLIST "phase 7"
> = plan "phase 1" (the envelope); CHECKLIST "phase 3" = plan "phase 2" (Announcements);
> CHECKLIST "phase 4" = plan "phase 3" (HackathonConfig); CHECKLIST "phase 8" = plan
> "phase 4" (Team). CHECKLIST "phase 5" and plan "phase 5" happen to be the same thing
> (Project Submission) — that is a coincidence, not a rule.

Also outstanding, independent of that:
- Abdullah runs manual-qa §1 to prove the live database connection (D.5).
- Each remaining phase gets its **own branch** off `main` once this one is reviewed and
  merged (T.6).

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
