# Backend Build Checklist — Ignition Hacks V7 Hacker Dashboard

**Owner:** Abdullah (Backend) · **Frontend:** Jeremy · **Stack:** Node.js · Express · MongoDB (Mongoose)
**Branch:** `backend/api-design-and-remaining-entities`, stacked on `backend/qr-attendance`,
which is stacked on `backend/schedule-events` — never work on `main`.
**Merge order:** `schedule-events` → `qr-attendance` → this one.
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

Expect it to end with `pass 335` / `fail 0`. ✅ *(confirmed 2026-08-12, on
`backend/api-design-and-remaining-entities` — 175 after the §5 envelope, 214 after
Announcements, 256 after HackathonConfig, 289 after Team, 335 after Project Submission;
it was 161 on `backend/qr-attendance` and 82 on `backend/schedule-events`)*
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

## Phase 3 — Announcements (design doc §1.2.2) ✅

Built **tests-first** (T.1), against the §5 envelope from Phase 7. Plan:
[plan/02-announcements.md](plan/02-announcements.md).

- [x] **3.1** `Announcement` model: `title?`, `body`, `authorId` (organizer/admin),
      `authorName` (denormalized), `postedAt`, `pinned`, timestamps
  - **Test:** `unit/announcement.test.js` A.1–A.13 — blank/whitespace `body` rejected;
    `postedAt` defaults to now; `pinned` defaults to false; `title` optional and capped at
    200 chars; `__v` stripped in `toJSON`. ✅
  - `authorName` is denormalized rather than populated: the feed shows it on every row,
    and Phase 2.6 moves users to a second mongoose connection that a `.populate()` cannot
    cross. It's a **snapshot** — renaming the author doesn't rewrite old items (I.8b).
  - No `readBy` field: §1.2.2 says there is no read/unread state.
- [x] **3.2** `GET /api/announcements` — pinned first, then `postedAt` descending;
      pagination via `?limit=&page=`
  - **Test:** `integration/announcements.test.js` I.11–I.16 — a **pinned older** item
    sorts above an unpinned newer one; two pinned items stay newest-first among
    themselves; `?limit=2&page=2` doesn't overlap page 1; a page past the end is an empty
    `200`, not a `404`. ✅
  - `limit`/`page` are **clamped, not rejected** (`999`→50, `abc`→10, `page=0`→1) —
    matching `GET /api/schedule/upcoming`. Response carries `{ count, announcements, page,
    limit, total }`, where `count` is this page and `total` is the collection.
- [x] **3.3** `POST` / `PATCH /:id` / `DELETE /:id` — organizer/admin only
  - **Test:** I.1–I.10, I.17–I.20c — organizer and admin create → 201; hacker
    create/update/delete → 403 (§4's "authorization layer, not convention");
    unauthenticated read → 401; `authorId`/`authorName` come from the token and a body
    that tries to set them is ignored; toggling `pinned` reorders the feed; `PATCH` does
    **not** move `postedAt`; missing id → 404, malformed id → 400. ✅
  - `DELETE` returns **200 + `{ deleted, id }`** per Phase 7's envelope rule.
  - No `GET /:id` — §1.2.2 lists none, and the feed already carries every body.
- [x] **3.4** Update [README.md](README.md), [manual-qa.md](manual-qa.md) and this checklist
  - **Test:** README has an Announcement schema table and an endpoint table with all four
    routes; manual-qa has §13 (rows 13.1–13.21, **Passed** column blank). ✅

**Result: `pass 214` / `fail 0`** (175 → 214, +39 announcement tests). No test deleted.

---

## Phase 4 — Hackathon config + countdown (design doc §1.2.3) ✅

Built tests-first. Plan: [plan/03-hackathon-config.md](plan/03-hackathon-config.md).

- [x] **4.1** `HackathonConfig` singleton: `hackathonStartAt`, `hackathonEndAt`,
      optional `submissionDeadline`
  - **Test:** `unit/hackathonConfig.test.js` H.1–H.10 + `integration/config.test.js`
    CI.1–CI.9 — both times required, end must be **strictly** after start (equal is
    rejected), `submissionDeadline` optional/nullable. ✅
  - **The singleton is enforced by the database**, not by convention: an internal
    `singleton` field pinned to one enum value with a **unique index**, so a second
    document is a duplicate-key error (H.5), and reads go through `getSingleton()`.
    Rejected: a hardcoded `_id`, and "whatever `findOne()` returns first" — both fail
    silently once two documents exist. The field is stripped from every response (H.10).
  - `GET` with nothing set is **404 `NOT_FOUND`** (CI.2) — not an empty object and not a
    fabricated default. Phase 5 needs "no deadline configured" ≠ "deadline passed".
- [x] **4.2** Countdown computed server-side (`hackathonEndAt - now`), never stored
  - **Test:** CI.10–CI.14 — two calls a second apart show `msRemaining` decreasing, and
    nothing about the countdown is persisted. `unit/countdown.test.js` C.1–C.10 covers the
    formatter as a pure function. ✅
  - Returns **both** formats §1.2.3 offers: `formatted` (`HH:MM:SS`) and `msRemaining`,
    plus `hasStarted`/`hasEnded`/`endsAt` and a `serverTime` so the client can correct for
    clock skew rather than trusting the browser clock.
  - **Clamps at zero** (never negative) and **hours do not wrap at 24** — a 48-hour
    hackathon shows `47:59:59` (C.5, C.7, CI.11).
- [x] **4.3** `PUT /api/config/hackathon` is **admin-only**; `GET` is any authenticated role
  - **Test:** CI.3/CI.4 — a hacker *and* an organizer both get `403`. Deliberately
    narrower than the organizer/admin pair used elsewhere: it moves the deadline for every
    team at once. ✅
  - `PUT` not `POST` (§5 maps POST to "creation of a new document", which must never
    happen for a singleton), and it is a **full replace** — omitting `submissionDeadline`
    clears it (CI.8b), and unknown fields are ignored (CI.9).
- [x] **4.4** `GET /api/schedule/upcoming` re-verified against §1.2.3 — not reimplemented
  - **Test:** CI.15/CI.15b — at most `limit`, ascending, past events excluded, enveloped.
    It stays on the schedule router as a sub-resource of schedule. ✅
- [x] **4.5** `seed.js` writes the config so a fresh dev database has a working countdown
  - **Test:** read the script — it still refuses to run without `--yes`, and now says the
    config is wiped too. **Not run against the shared cluster.** ✅
- [x] **4.6** Docs: [README.md](README.md) schema + endpoints, [manual-qa.md](manual-qa.md)
      §14, this checklist
  - **Test:** manual-qa §14 has rows 14.1–14.17 with a blank **Passed** column. ✅

**Result: `pass 256` / `fail 0`** (214 → 256, +42).

---

## Phase 5 — Project Submission (design doc §1.2.4) ✅

Depends on Phase 8 (Team): a submission belongs to a team, so it could not be built until
`Team` and `teamService` existed. Plan: [plan/05-submissions.md](plan/05-submissions.md).

- [x] **5.1** `models/Submission.js`: `teamId`, `title`, `description`, `devpostUrl`,
      `repoUrl`, `submittedAt`, `submittedBy`, timestamps — tied to a **Team**, not a User
  - **Test:** `unit/submission.test.js` SU.1–SU.12b (18 tests) — required fields
    (SU.1–SU.3), the 200/5000 length caps (SU.4, SU.4b), the `http(s)://` URL guard
    (SU.7–SU.8), and `toJSON` dropping `__v` (SU.12b). ✅
- [x] **5.2** **One submission per team**, enforced by a unique index rather than a
      controller check alone — two teammates can press Submit in the same instant
  - **Test:** SU.5 (duplicate `teamId` → an `11000` duplicate-key error at the driver
    level), SU.5b (a different team is fine), integration S.5 (409 for the submitter) and
    S.6 (409 for the **teammate** — it is the *team's* submission). ✅
- [x] **5.3** `submittedAt` is **immutable**; `updatedAt` records edits separately
  - **Test:** SU.10 (survives a later save), SU.10b (`updatedAt` moves), integration S.14
    (a `PATCH` bumps `updatedAt` and leaves `submittedAt` alone). ✅
- [x] **5.4** `GET /api/submissions/mine`, `POST /api/submissions`,
      `PATCH /api/submissions/:id` (own team only), hacker-only
  - **Test:** S.10/S.11 (`/mine` → `200` + `data: null` before submitting, the object
    after), S.12 (the **teammate** gets the same document), S.15 (a teammate may edit),
    S.16 (another team's submission → 403), S.9 (an organizer cannot `POST` — no team). ✅
- [x] **5.5** `teamId` and `submittedBy` come from the **token**, never the body — on
      create *and* update
  - **Test:** S.3 (a spoofed `teamId` in the `POST` body is ignored), S.18/S.18b (`PATCH`
    cannot move a submission to another team or rewrite who submitted it). ✅
- [x] **5.6** No team → `409` with the distinct code **`NO_TEAM`**, so the frontend can
      tell it apart from "already submitted"
  - **Test:** S.4 (`POST` → `NO_TEAM`, not a 400 or a 404), S.13 (`GET /mine` is still
    `200` + `null` — "no team" is not an error to read), S.16b (`PATCH` → 403). ✅
- [x] **5.7** Deadline enforcement: `submissionDeadline` when set, otherwise
      `hackathonEndAt`; **fails open** when no config exists at all
  - **Test:** S.19/S.20 (past deadline → `403 SUBMISSION_CLOSED` on `POST` and `PATCH`),
    S.21 (`hackathonEndAt` fallback), S.21b (future deadline → allowed), S.22 (**no
    config → 201**, because locking every team out is the worse failure). ✅
- [x] **5.8** Ownership is checked **before** the deadline, so a stranger never learns
      whether submissions are open
  - **Test:** S.16 returns a plain 403, not `SUBMISSION_CLOSED`. ✅
- [x] **5.9** `GET /api/submissions` (organizer/admin) for judging, newest first
  - **Test:** S.24 (hacker → 403), S.23 (an organizer sees every submission, with `count`
    matching), S.23b (an empty list is `count: 0`, not a 404). ✅
- [x] **5.10** Docs: [README.md](README.md) gains the schema section, the endpoint table
      and curl examples; [manual-qa.md](manual-qa.md) gains §16 (rows 16.1–16.26) and four
      known limitations
  - **Test:** §16 opens by pointing at §15 — the QA script says out loud that teams come
    from the CLI first. ✅

**Result: `pass 335` / `fail 0`** (289 → 335, +46). No test deleted.

**Open question 5.Q1 — should an organizer be able to edit a submission?** Today the write
routes are hacker-only, so a typo an organizer spots goes back to the team or gets fixed in
Atlas. §1.2.4 doesn't say. Adding `organizer` to `requireRole` on `PATCH` would need the
ownership check relaxed for them — a deliberate hole, not a one-word change. For Youssef.

**Open question 5.Q2 — is failing open on a missing config right?** A missing
`HackathonConfig` currently means *no* deadline, and the server logs a warning. The
alternative (fail closed) turns one forgotten `PUT` into "nobody can submit". Recorded so
the choice is visible rather than implied.

---

## Phase 6 — QR Code + Attendance (design doc §3.2.1, §3.2.2) ✅

Built on branch `backend/qr-attendance`, stacked on `backend/schedule-events` because it
needs `ScheduleEvent`, which isn't on `main` yet. **Merge the schedule branch first.**

**Scope:** the two entities and their six routes only. **Not** the Profile page — no
aggregate profile endpoint, no touching `status`, no change to `GET /api/users/me`.

- [x] **6.1** `QRCode` model — `userId` (unique, `ref: User`), `code` (unique, immutable,
      UUID default), `createdAt` only
  - **Test:** `unit/qrCode.test.js` — 11 passing. Opens a **real** in-memory DB and calls
    `syncIndexes()`, because the guarantees here are unique indexes and `validate()`
    cannot see an index. Covers: a second code for the same user is rejected; a duplicate
    `code` string is rejected; `code` can't be changed after creation; two users get
    different codes. ✅
- [x] **6.2** `Attendance` model — `userId` + `scheduleEventId` (unique **compound**
      index), `checkedIn`, `checkedInAt`, `checkedInBy`
  - **Test:** `unit/attendance.test.js` — 17 passing. Duplicate pair rejected; the same
    user in two events is fine; `checkedInAt` auto-stamps via `pre('validate')`;
    `recordCheckIn` is idempotent and survives a simulated E11000 race. ✅
  - A **separate** `{ scheduleEventId: 1 }` index exists on purpose — the compound index
    can only be read left-to-right, so it's no use to the headcount query.
- [x] **6.3** `GET /api/qrcode/me` — own code, **created lazily on first call**
  - **Test:** `integration/qrcode.test.js` — the same token twice returns the identical
    code; three concurrent requests still produce exactly one document. Lazy rather than
    hooked to registration because Phase 2.6 deletes `POST /api/auth/register`. ✅
- [x] **6.4** `POST /api/qrcode/scan` — organizer/mentor, `{ code, scheduleEventId }`
  - **Test:** first scan `201` `alreadyCheckedIn: false`; **second scan `200`
    `alreadyCheckedIn: true` with `checkedInAt` unmoved** — a repeat scan in a food queue
    is normal, not an error. Unknown code `404`, missing code `400`, bad event id `400`,
    unknown event `404`, hacker `403`. ✅
- [x] **6.5** `GET /api/qrcode/:code/user` — organizer/admin lookup when a scan fails
  - **Test:** returns the owner with no `passwordHash`; unknown code `404`; hacker `403`. ✅
- [x] **6.6** `GET /api/attendance/me` — the meal checklist, **computed on read**
  - **Test:** a hacker with zero records still gets every Food event with
    `checkedIn: false`; non-Food events never appear; sorted by `startTime`; one hacker's
    check-in never leaks onto another's list; **reading the checklist writes no
    documents**. ✅
- [x] **6.7** `GET /api/attendance/event/:scheduleEventId` — headcount, organizer/admin
  - **Test:** rows carry a nested `user`; an unattended event returns an empty list, not a
    `404`; malformed id `400`, unknown `404`; hacker `403`. ✅
- [x] **6.8** `POST /api/attendance` — manual check-in, organizer/mentor
  - **Test:** `checkedInBy` comes from the token, never the body; shares
    `Attendance.recordCheckIn` with the scan, and a test proves the manual path and the
    scanned path produce an identical checklist. No hacker-facing self-report route
    exists, by design. ✅
- [x] **6.9** Full suite green — `integration/attendance.test.js` 28, `qrcode` 23,
      units 28. **161 / 161 passing**, up from 82. ✅
- [x] **6.10** Docs — [README.md](README.md) schema + endpoint tables, manual-qa §9/§10,
      Postman folders 9/10/11, this phase ✅
- [x] **6.11** Run manual-qa **§9 and §10** in Postman against the live database, then
      clean up `qrcodes` / `attendances` by hand (there's no DELETE route for either)
  - **Test:** the Passed column in §9/§10 is filled in. ✅ 2026-08-05 — folder 9 **44/44**,
    folder 10 **43/43**, folder 11 **5/5**, against freshly emptied collections. Rows 9.3,
    9.8 and 10.6 aren't HTTP calls and were closed by counting documents afterwards:
    **`qrcodes` 2, `attendances` 2** — two users, two Food events, despite nine requests
    hitting a check-in or checklist route. Repeat scans write nothing; reads create nothing.
  - Cleanup is now scripted rather than clicked: **`npm run clean:qa`** in `backend/`
    (`src/scripts/cleanQaData.js`) empties `attendances` and `qrcodes` and deletes
    `scheduleevents` titled `QA*`. Dry run by default; `npm run clean:qa -- --yes` to
    delete. It refuses to run unless the database name contains `dashboard`, so it can
    never reach `ignition-portal-dev`. Needed because folder 9 creates fresh events every
    run while folder 11 only deletes the newest set.
- [x] **6.12** The QA collection is re-runnable — five assertion bugs found and fixed
      during 6.11, **none of them in the API**
  - `9.0.7` / `9.0.10` read `json().user.role`; `PATCH /users/:id/role` returns the user
    object itself, only `login` wraps it.
  - `10.2` / `10.6` / `10.16` hardcoded absolute tick counts, valid only on an empty
    database; now measured against a baseline captured in `10.2`.
  - **`10.20` was the real one.** It checked in `freshId` — the account `10.1` asserts has
    *no* attendance. It passed on the first run and broke `10.1` on every run after, so
    the collection destroyed its own preconditions. Now targets the already-checked-in
    hacker so it writes nothing.
  - **Test:** folders 9 → 10 → 11 all green on a clean database. ✅ 2026-08-05
  - ⚠️ **Not yet proven:** that they're green *twice in a row* without a wipe in between.
    The fixes are designed for it — folder 11 removes the events each run and `10.20` no
    longer dirties the fresh hacker — but the only run so far started from an empty
    database. Re-run 9 → 10 → 11 a second time before relying on it.

### Open findings from Phase 6

- [ ] **6.F1** **Admins can't check anyone in.** §3.2.1/§3.2.2 grant both write routes to
      *"Organizer, Mentor"*, so an admin gets `403` from `POST /api/qrcode/scan` and
      `POST /api/attendance` — they can see the headcount but not fix it. Separately a
      **mentor can scan but can't look up a code** (`GET /api/qrcode/:code/user` is
      organizer/admin), which is backwards: the person holding the scanner is exactly who
      needs the manual lookup when a scan fails. Built to the doc as written and tested
      both ways. **Blocked:** needs the team lead to say whether it's a spec slip. If so
      it's one word per route in `qrCodeRoutes.js` / `attendanceRoutes.js`.
  - **Test:** an admin token gets `201` from both write routes.
- [ ] **6.F2** **`User.qrCodeId` is dead**, same shape of defect as `2.6.F1`. The field
      exists on the User model; nothing writes it. Deliberately left unset — QR Code holds
      the `userId` and that's the single source of truth for a 1:1 link, so populating
      both would let them disagree. Belongs in the 2.6 User rewrite: either drop the field
      or make it the only direction.
  - **Test:** whichever way it goes, there's exactly one place that says who owns a code.
- [ ] **6.F3** **Workshops aren't on the checklist.** §3.2.2 reads as the *meal*
      checklist, so `GET /api/attendance/me` filters `isFoodEvent: true`. Confirm that's
      what's wanted — workshop attendance is a one-line change if it isn't.
- [ ] **6.F4** **No un-check-in, and no cascade.** Nothing sets `checkedIn` back to
      `false` and there's no DELETE route, so a mis-scan has to be fixed in Atlas by hand.
      Deleting a Schedule Event also leaves its attendance records orphaned. Neither is
      asked for in §3.2.2; both are worth a decision before the event.

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

## Phase 7 — API design: response envelope + error contract (design doc §5) ✅

Done **before** phases 3/4/5 on purpose: it changes the response shape of every existing
route, so doing it first means the remaining entities are written against the final
contract once instead of twice. Plan: [plan/01-response-envelope.md](plan/01-response-envelope.md).

- [x] **7.1** `utils/apiResponse.js` — `ok()` / `created()` / `fail()` and the
      `ERROR_CODES` map, with `codeForStatus()` so controllers don't name a code every throw
  - **Test:** `integration/envelope.test.js` E.1–E.3 — success responses carry
    `success: true` and a `data` object and never an `error` key. ✅
- [x] **7.2** `ApiError` takes an optional explicit `code` (used by phase 5's
      `SUBMISSION_CLOSED`), defaulting to the standard code for the status
  - **Test:** E.5c — a controller-thrown 400 is `BAD_REQUEST`, not `VALIDATION_ERROR`. ✅
- [x] **7.3** `errorHandler` + `notFound` emit the failure envelope for all five branches
      (validation, cast, duplicate key, `ApiError`, unhandled)
  - **Test:** E.4–E.9 — one test per status code: 400 ×2, 401, 403, 404 ×2, 409. ✅
- [x] **7.4** All 21 response sites across the five existing controllers migrated
  - **Test:** `grep -rn "res.json" backend/src/controllers` returns nothing. ✅
- [x] **7.5** No failure response leaks a stack trace, an `err.name`, or any key other
      than `code` / `message` / `details`
  - **Test:** E.10. ✅
- [x] **7.6** `GET /health` stays un-enveloped — ops endpoint outside `/api`, uptime
      probes match its literal body
  - **Test:** E.11, and `integration/health.test.js`. ✅
- [x] **7.7** `DELETE /api/schedule/:id` returns **200 + `{ deleted, id }`, not 204**.
      §5 lists 200 for a successful DELETE and lists no 204, and a 204 has no body to
      carry the envelope in
  - **Test:** E.12, and the rewritten schedule delete test. ✅
  - ⚠️ **Behaviour change to something already manually QA'd** — manual-qa row 5.14 was
    re-blanked. Postman 5.14 was fixed in **9.1/9.9**, along with folder 11's three
    deletes, which asserted `[204, 404]` and had been missed here.
- [x] **7.8** All 105 integration tests migrated to read `data.*`, including the single
      line in `tests/helpers/factories.js` that ~100 authenticated tests depend on
  - **Test:** `pass 175` / `fail 0`, up from 161. No test deleted. ✅
- [x] **7.9** Docs updated: [README.md](README.md) gains a "Response envelope" section,
      [manual-qa.md](manual-qa.md) gains §12 and the corrected 5.14
  - **Test:** README documents all seven error codes and both exceptions. ✅

**Open finding 7.F1 — `/health` is the only un-enveloped route.** If the team ever adds
more ops endpoints (`/metrics`, `/ready`), they should follow `/health`, not §5. Worth a
one-line rule in the README if that happens.

---

## Phase 8 — Team (design doc §7's assumption, §4) ✅

§7 lists Team as an assumption rather than a specified entity, and §5's router list
contains no team router. Abdullah's instruction was **follow the doc**, so this phase
ships the entity and its membership rules with **no HTTP surface at all** — teams are
provisioned by a CLI script, the way §7 provisions elevated roles. Phase 5 (Project
Submission) cannot start without it. Plan: [plan/04-team.md](plan/04-team.md).

- [x] **8.1** `models/Team.js` — `name` (required, trimmed, **unique case-insensitively**
      via a collated index), `memberIds` capped at `MAX_TEAM_SIZE` (4), optional
      `createdBy`, timestamps, `toJSON` drops `__v`
  - **Test:** `unit/team.test.js` T.1–T.10 (11 tests) — including T.7, which proves
    `team rocket` collides with `Team Rocket` at the **index** level, not by convention. ✅
- [x] **8.2** `services/teamService.js` — the only sanctioned writer of `memberIds` and
      `User.teamId`, so a future router reuses the invariants instead of re-implementing them
  - **Test:** `unit/teamService.test.js` TS.1–TS.14 (21 tests). ✅
- [x] **8.3** A user belongs to **at most one team** — enforced, not assumed
  - **Test:** TS.5 — adding a user who already has a `teamId` throws `409 CONFLICT` and
    leaves their existing membership untouched. ✅
- [x] **8.4** Both sides of the membership are written, and re-running is safe
  - **Test:** TS.3 (both sides written), TS.4 (adding twice is idempotent), TS.8 (remove
    clears both), TS.9 (removing a non-member is a no-op, not an error). ✅
- [x] **8.5** `reconcile()` repairs drift — there are no transactions on the free Atlas
      tier, so the two writes can be interrupted
  - **Test:** TS.12 (stray `User.teamId` cleared), TS.13 (missing `teamId` linked),
    TS.13b (member pointing at a deleted user dropped), TS.14 (a healthy DB is untouched). ✅
- [x] **8.6** `PATCH /api/users/me { teamId }` still cannot change membership — with no
      team router, the profile route is the only plausible back door
  - **Test:** `integration/users.test.js` — "cannot be used to join a team". ✅
- [x] **8.7** `scripts/manageTeams.js` — `list` / `create` / `add` / `remove` /
      `reconcile`. Non-destructive (no `deleteMany`, hence no `--yes` guard) and refuses
      any URI or database name that isn't the dashboard DB
  - **Test:** driven end-to-end against an in-memory MongoDB — every command, both
    refusal guards, and the drift-repair path. Hand-testing: manual-qa §15. ✅
- [x] **8.8** **No route is mounted.** That absence is the decision, not an omission
  - **Test:** `grep -rn "team" backend/src/app.js` returns nothing. ✅
- [x] **8.9** Docs: [README.md](README.md) gains "Team (§7) — provisioned by script, not
      by API" (schema, service contract, the CLI, and the cost stated plainly),
      [manual-qa.md](manual-qa.md) gains §15 and three known limitations
  - **Test:** README explains *why* there are no endpoints, not just that there aren't. ✅

**Result: `pass 289` / `fail 0`** (256 → 289, +33). No test deleted.

**Open question 8.Q1 — should a `teamRouter` be added after all?** §5's list says no;
testability says it would help (teams can't be created from Postman, so submission QA
needs a CLI command first). Additive if the answer changes — roughly 40 lines, because
every rule already lives in the service. For Youssef.

**Open question 8.Q2 — is max team size 4?** Assumed from Ignition Hacks' published rules;
the design doc is silent. One constant (`Team.MAX_TEAM_SIZE`).

---

## Phase 9 — Postman collection rebuild (plan phase 6) ✅

The deliverable Abdullah asked for by name. No backend code changed — this phase is
`docs/postman/ignition-dashboard.postman_collection.json` and the docs that describe it.
Full write-up in [plan/06-postman-and-docs.md](plan/06-postman-and-docs.md).

- [x] **9.1** Every pre-envelope body read migrated under `data` / `error.message` — 58
      script lines across folders 1–11
  - **Test:** every `pm.response.json().X` in the file reads `.data` or `.error`, with the
    single documented exception of `/health`'s `.status` in row 1.7. ✅
- [x] **9.2** A collection-level post-response script asserts the §5 envelope on **every**
      request: `success` matches the status code, a 4xx/5xx carries `error.code` and
      `error.message`, and no error body leaks a stack trace. `/health` excluded by URL
  - **Test:** an envelope regression fails all 216 requests at once, not just the ones
    someone remembered to assert on. ✅
- [x] **9.3** Folder 12 — response envelope + error contract (manual-qa §12), 17 requests.
      One request per §5 status code, and 12.7 vs 12.5 proves `BAD_REQUEST` and
      `VALIDATION_ERROR` are distinguishable by the presence of `details`
- [x] **9.4** Folder 13 — Announcements (manual-qa §13), 29 requests. Spoofed author
      ignored, pinned outranks newer, `postedAt` unwritable on edit, pagination clamped
      not rejected, and four cleanup rows
  - **Test:** 13.10/13.12 compare *relative* order, not `[0]` — `ignition-dashboard-dev`
    is shared and may already hold pinned announcements. ✅
- [x] **9.5** Folder 14 — HackathonConfig + countdown (manual-qa §14), 21 requests. 14.0.4
      saves the team's real dates and 14.16 restores them; 14.5/14.10/14.13b/14.16 compute
      times relative to *now* in a pre-request script, so the folder does not rot
  - **Test:** 14.15b asserts `formatted`'s hours exceed 24, which a wrapping formatter
    would fail. ✅
- [x] **9.6** Folder 16 — Project submissions (manual-qa §16), 42 requests, with the five
      `manageTeams.js` commands in its description and row 16.0.11 failing loudly if they
      were skipped. Its own four accounts and two teams, so it stays re-runnable
- [x] **9.7** Folder 17 — cleanup for 12–16. Prints the `mongosh` commands for
      `submissions` and `teams`, neither of which has a delete route by design
- [x] **9.8** Folder 8's four cleanup deletes gained assertions — they had **no test
      script at all**, so four requests in the collection could not fail
- [x] **9.9** Folder 11's three deletes moved from `[204, 404]` to `[200, 404]`, the same
      204→200 change Phase 7 made to 5.14
- [x] **9.10** Docs: [manual-qa.md](manual-qa.md)'s import section rewritten (216/16, the
      envelope guard, the cleanup folders, folder 16's own accounts), §16's preamble split
      into a Postman path and a by-hand path, [HANDOFF.md](HANDOFF.md)'s "What to do next"
      rewritten around step 8, [plan/README.md](plan/README.md) and
      [plan/06-postman-and-docs.md](plan/06-postman-and-docs.md) updated

**Result: 216 requests, 16 folders, 224 test scripts, 0 syntax errors, 0 requests without
assertions** (was 104 / 11 / 291 script lines). Backend tests unchanged at `pass 335` /
`fail 0` — no source file was touched.

**Not verified, and can't be by me: the collection has never been run.** Every assertion
was written against the controller source and cross-checked with `manual-qa.md`, but a
Postman run needs the live Atlas cluster. That is Abdullah's step 8, and closes
**X.3** / **X.6** for this run of work.

---

## Cross-cutting — revisit at every phase

- [ ] **X.1** Every new collection rejects blank/invalid required fields (**test each one**)
- [ ] **X.2** Add `tests/unit/<entity>.test.js` and `tests/integration/<entity>.test.js`
      for each new entity as it lands
  - **Test:** `cd tests && npm test` stays green after every phase, with a higher test count.
- [ ] **X.3** Keep the endpoint table in [README.md](README.md) in sync with new routes
- [x] **X.4** Keep response shapes consistent — **superseded by Phase 7's §5 envelope**:
      every `/api` response is `{ success, data }` or `{ success, error: { code, message } }`.
      Inside `data` the old convention still holds: lists → `{ count, <plural> }`, single →
      the object. `GET /health` is the one documented exception.
  - **Test:** `integration/envelope.test.js` — 14 tests covering the contract itself.
- [ ] **X.5** Keep [HANDOFF.md](HANDOFF.md) current so a fresh Claude chat can pick up cleanly
- [ ] **X.6** Keep [manual-qa.md](manual-qa.md) current — a section per feature, **Passed**
      column left blank

---

## 📋 Team CLAUDE.md compliance

- [~] **T.1** **TDD** — write tests *first*, then implement. Phases 1–2 were built
      implementation-first (tests written alongside, then ported). **Phase 3 onward:
      write `tests/` cases before the controller.** Phases 7 (envelope), 3 (Announcements),
      4 (HackathonConfig) and 8 (Team) all followed it — the tests were written
      and run **red** first.
      Keep it up for the remaining phases.
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
