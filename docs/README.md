# Ignition Hacks V7 — Hacker Dashboard Backend

Node.js + Express + MongoDB (Mongoose) API for the Hacker Dashboard.

Implemented so far:

- **auth + roles** — design doc §1.2.1
- **Announcements** — §1.2.2, the announcements feed on the Home Dashboard: organizers
  post, every role reads, pinned items stay on top
- **Hackathon Config + countdown** — §1.2.3, the singleton that holds the start/end
  times every countdown and deadline reads from
- **Schedule Event** — §2.2.1, the data behind the Schedule page and the "Happening Next"
  panel on the Home Dashboard
- **QR Code** — §3.2.1, one permanent code per hacker, and the scan that checks them in
- **Attendance** — §3.2.2, check-in records plus the meal checklist computed from them
- **API design** — §5, the response envelope and centralized error contract every route
  below now follows
- **Team** — §7's assumption, the entity project submissions belong to. Model + service +
  admin script, and deliberately **no HTTP routes** — see
  [Team (§7) — provisioned by script, not by API](#team-7--provisioned-by-script-not-by-api)
- **Project Submission** — §1.2.4, the "Submit Project" button and its "already submitted"
  state: one submission per team, every teammate sees and edits the same one

Not built yet: the Profile page itself (no aggregate profile endpoint, and `status` is
still undefined) and Mentorship.

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
      models/QRCode.js         One code per user, UUID, immutable, both fields unique
      models/Attendance.js     Check-in records + the recordCheckIn statics helper
      models/Announcement.js   Feed items; denormalized authorName, pinned+postedAt index
      models/HackathonConfig.js  Singleton start/end times; unique index enforces the one row
      models/Team.js           Name unique case-insensitively, memberIds capped at 4
      models/Submission.js     One per team (unique teamId index); immutable submittedAt
      services/teamService.js  The only sanctioned writer of memberIds + User.teamId
      controllers/             scheduleController · authController · userController
                               qrCodeController · attendanceController
                               announcementController · configController
                               submissionController
      routes/                  scheduleRoutes · authRoutes · userRoutes
                               qrCodeRoutes · attendanceRoutes · announcementRoutes
                               configRoutes · submissionRoutes
      middleware/auth.js       requireAuth (re-reads req.user from the DB) + requireRole
      middleware/errorHandler.js  404 + validation/cast/duplicate-key -> the SS5 failure envelope
      utils/                   catchAsync · ApiError · apiResponse (the envelope)
                               token (JWT sign/verify) · countdown (HH:MM:SS formatter)
      scripts/seed.js          Sample events + the hackathon config
                               (requires --yes; see the warning below)
      scripts/manageTeams.js   Create teams / add / remove members (no HTTP route exists)
    .env                       Local secrets, git-ignored
    .env.example               Template
  frontend/                    <- Jeremy
  tests/                       <- backend test suite (its own npm package)
    helpers/                   backend bridge · in-memory DB · fixtures
    integration/               health · envelope · auth · users · schedule · qrcode
                               attendance · announcements · config · submissions
    unit/                      scheduleEvent · user · qrCode · attendance · announcement
                               hackathonConfig · countdown · team · teamService
                               submission
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

Expect it to end with `pass 335` / `fail 0`.

### Running the server

Copy `.env.example` to `.env` in `backend/` and fill it in (see
[environment-variables.md](environment-variables.md)), then from `backend/`:

```bash
npm run dev
```

Expect `[db] Connected to MongoDB (ignition-dashboard-dev)` followed by
`[server] Schedule API listening on http://localhost:4000`.

> ⚠️ **`npm run seed` wipes the schedule collection and the hackathon config**
> (`deleteMany({})`), and the whole team shares `ignition-dashboard-dev`.
> It refuses to run without an explicit opt-in:
> `npm run seed -- --yes`. It prints the target database name before touching anything —
> read that line.

## Announcement schema (§1.2.2)

| Field        | Type     | Notes                                                          |
| ------------ | -------- | -------------------------------------------------------------- |
| `_id`        | ObjectId | Auto                                                           |
| `title`      | String   | **Optional**, trimmed, max 200 chars, defaults to `''`         |
| `body`       | String   | Required, non-blank, trimmed                                   |
| `authorId`   | ObjectId | Required, ref `User` — taken from the token, never from the body |
| `authorName` | String   | Required, denormalized — also taken from the token             |
| `postedAt`   | Date     | Defaults to now; the feed's sort key                           |
| `pinned`     | Boolean  | Defaults to `false`; pinned items sort above everything else   |
| `createdAt` / `updatedAt` | Date | Auto (timestamps)                                 |

Index: `{ pinned: -1, postedAt: -1 }` — exactly the feed's sort.

**Three things worth knowing:**

- **`authorName` is denormalized, not populated.** The feed shows the author on every
  row, so this keeps it a single-collection query; and Phase 2.6 moves users onto a
  separate mongoose connection (the read-only portal database), which a `.populate()`
  cannot cross. It is a **snapshot** — renaming a user later does not rewrite their old
  announcements. That's normal for a feed, and it's tested.
- **`postedAt` is not updatable.** `PATCH` accepts `title`, `body` and `pinned` only, so
  fixing a typo doesn't jump the announcement back to the top of the feed.
- **There is no read/unread state.** §1.2.2 is explicit about this, so there is
  deliberately no `readBy` array and no "mark as read" route.

## HackathonConfig schema (§1.2.3)

One document, ever. §4: *"a singleton, referenced implicitly by everything time based"* —
the countdown and (later) the submission deadline read from here rather than hardcoding
dates.

| Field | Type | Notes |
| ----- | ---- | ----- |
| `_id` | ObjectId | Auto |
| `hackathonStartAt` | Date | Required |
| `hackathonEndAt` | Date | Required; must be **strictly after** `hackathonStartAt` |
| `submissionDeadline` | Date | Optional, defaults to `null`; when absent the submission routes fall back to `hackathonEndAt` |
| `createdAt` / `updatedAt` | Date | Auto (timestamps) |

**The singleton is enforced by the database, not by convention.** There's an internal
`singleton` field pinned to one value with a **unique index**, so a second document is
impossible — an attempt surfaces as a `409 CONFLICT`. The field is stripped from every
response; clients never see or send it. All reads go through
`HackathonConfig.getSingleton()`, which returns the document or `null`.

The rejected alternatives — a hardcoded `_id`, or "whatever `findOne()` returns first" —
both look fine until two documents exist and then fail silently in different directions.

## Team (§7) — provisioned by script, not by API

Read this before looking for team endpoints: **there aren't any, on purpose.**

§7 lists Team as an *assumption* rather than a specified entity — "a Team entity (with
membership) exists even though it is not directly visible in the three provided screens.
It is required to make the 'Submit Project' button and its 'already submitted' state
meaningful." §5's router list, by contrast, is explicit and complete, and contains no
team router:

> `userRouter` · `announcementRouter` · `scheduleRouter` · `attendanceRouter` ·
> `qrCodeRouter` · `submissionRouter` · `configRouter`

So the entity is built (Project Submission cannot work without it) and no `teamRouter` is
mounted. Teams are provisioned out-of-band, which is how §7 handles the same gap for
elevated roles: "provisioned by an existing admin process, for example a seed script or
an internal admin panel."

**The cost, stated plainly: teams cannot be created or joined from Postman.** Before
testing the submission routes you have to run the CLI below. If that proves unworkable in
practice the fix is additive and small — a `teamRouter` with `POST /api/teams` and
`POST /api/teams/:id/members` is roughly 40 lines on top of the existing service, because
every invariant already lives there rather than in the script.

### Schema

| Field | Type | Notes |
| ----- | ---- | ----- |
| `_id` | ObjectId | Auto |
| `name` | String | Required, trimmed, **unique case-insensitively** |
| `memberIds` | [ObjectId → `User`] | Defaults to `[]`; at most `MAX_TEAM_SIZE` (4) |
| `createdBy` | ObjectId → `User` | Optional; `null` for script-created teams, which is all of them today |
| `createdAt` / `updatedAt` | Date | Auto (timestamps) |

**Membership is stored twice** — `Team.memberIds` and `User.teamId` — because the Profile
page reads the user, not the team, and Phase 2.6 moves users onto a separate mongoose
connection that a `.populate()` could not cross.

**The name index is case-insensitive** (collation `{ locale: 'en', strength: 2 }`), so
"Team Rocket" and "team rocket" collide. A human reading a leaderboard treats them as one
team; the database now agrees.

**Max team size 4** is an assumption — the design doc never states one, but Ignition
Hacks' published rule is teams of up to four. It's a single exported constant
(`Team.MAX_TEAM_SIZE`), so changing it is a one-line edit.

### `services/teamService.js` — the only sanctioned writer

Never write `memberIds` or `User.teamId` directly. Every invariant that spans the two
lives here, so a future router, admin panel or script reuses it:

| Function | Guarantees |
| -------- | ---------- |
| `createTeam({ name, createdBy })` | Duplicate name (any case) → `409 CONFLICT`; blank name → `400` |
| `addMember(teamId, userId)` | Team and user must exist (`404`); a user already on **another** team → `409`; a full team → `409`; already a member is a no-op; sets `User.teamId` |
| `removeMember(teamId, userId)` | Splices `memberIds`, clears `User.teamId`; removing a non-member is a no-op, not an error |
| `getTeamForUser(userId)` | Resolves through `User.teamId`; `null` when unassigned |
| `reconcile()` | Repairs drift between the two sides; returns `{ usersLinked, usersCleared, membersDropped }` |

**A user belongs to at most one team.** The design doc's data model implies it (a single
`User.teamId`, not an array); the service enforces it, because a user on two teams makes
"the team's submission" ambiguous in §1.2.4 and would surface there as a baffling bug
instead of as an error here.

**The two writes are not atomic.** There are no transactions on a standalone mongod or on
the free Atlas tier, so `addMember` writes the Team first and the User second — the worst
case is a team listing a member whose `teamId` is still null, which is both the easier
drift to spot and the one `reconcile()` repairs. For a hackathon-scale app that is the
honest trade rather than a hidden one.

**`PATCH /api/users/me` cannot set `teamId`.** It is not in `SELF_WRITABLE_FIELDS`, and a
test guards that — otherwise the profile route would be a back door into the membership
rules above.

### The CLI

Run from `backend/`. It reads `MONGO_URI` from `backend/.env`, refuses to run against a
database whose name doesn't contain "dashboard", and **never deletes anything** — no
`deleteMany`, so unlike `seed.js` it needs no `--yes` guard.

```bash
node src/scripts/manageTeams.js list
```

```bash
node src/scripts/manageTeams.js create "Team Rocket"
```

```bash
node src/scripts/manageTeams.js add "Team Rocket" bobby@example.com
```

```bash
node src/scripts/manageTeams.js remove "Team Rocket" bobby@example.com
```

```bash
node src/scripts/manageTeams.js reconcile
```

Team lookup by name is case-insensitive, so `add "team rocket" …` finds `Team Rocket`.
Failures print `FAILED: <reason>` and exit `1`.

## Project Submission schema (§1.2.4)

| Field | Type | Notes |
| ----- | ---- | ----- |
| `_id` | ObjectId | Auto |
| `teamId` | ObjectId → `Team` | Required, **unique** — this index *is* §4's "one per team" rule |
| `title` | String | Required, trimmed, non-empty, max 200 |
| `description` | String | Required, trimmed, non-empty, max 5000 |
| `devpostUrl` | String | Optional, defaults to `null`; must start with `http://` or `https://` |
| `repoUrl` | String | Optional, defaults to `null`; same rule |
| `submittedAt` | Date | Set on create and **immutable** |
| `submittedBy` | ObjectId → `User` | Which teammate pressed submit — *added*, see below |
| `createdAt` / `updatedAt` | Date | Auto (timestamps) |

**One per team, enforced by the database.** The controller does a `findOne` first so the
common case gets a clean message, but two teammates can press Submit in the same instant
and a controller-side "check then insert" loses that race. The unique index doesn't — the
loser surfaces as the `409 CONFLICT` §5 names as its own example.

**`submittedAt` is immutable, `updatedAt` is not.** "Submitted at 11:47pm" on a judging
sheet must not move because someone fixed a typo at 11:58. The two dates answer different
questions and both are returned.

**`submittedBy` is an addition to §1.2.4's field list.** One field, no cost, and it is the
difference between being able and unable to answer "which teammate submitted this?" in a
judging dispute. It mirrors `Attendance.checkedInBy`, which the doc *does* specify "for
audit purposes".

**URL validation is deliberately loose** — `http(s)://` followed by something, and no
more. Hackers paste GitHub, GitLab, Devpost and the occasional Drive link; rejecting a
valid submission at 11:58pm over an over-tight regex is a far worse failure than accepting
an odd URL.

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

## QR Code schema (§3.2.1)

| Field       | Type     | Notes                                                       |
| ----------- | -------- | ----------------------------------------------------------- |
| `_id`       | ObjectId | Auto                                                        |
| `userId`    | ObjectId | Required, `ref: 'User'`, **unique** — one code per user      |
| `code`      | String   | Required, **unique**, `immutable`, defaults to a UUID v4    |
| `createdAt` | Date     | Auto (`updatedAt` is off — nothing here is ever updated)     |

Both guarantees are **unique indexes**, not validators. That matters: a validator only
sees one document, so it can't stop two concurrent requests from both creating a code for
the same user. The index can. The unit tests for this model open a real in-memory database
and call `syncIndexes()` for exactly that reason — testing them against a plain
`validate()` would pass while proving nothing.

`code` is `immutable`, so mongoose silently drops any attempt to change it after creation.
A hacker's badge is printed once and has to keep working all weekend.

> **`User.qrCodeId` is deliberately left unset.** The `User` model has the field, but the
> QR Code document holds the `userId` and that is the single source of truth for a 1:1
> link. Writing both directions would let them disagree. See the Youssef list in the TEMP
> phase doc.

**Codes are created lazily**, on the first `GET /api/qrcode/me`, not at registration.
`POST /api/auth/register` is a stopgap that goes away when auth moves to the portal
database, so hanging code creation off it would create hackers with no badge.

## Attendance schema (§3.2.2)

| Field             | Type     | Notes                                                  |
| ----------------- | -------- | ------------------------------------------------------ |
| `_id`             | ObjectId | Auto                                                   |
| `userId`          | ObjectId | Required, `ref: 'User'`                                |
| `scheduleEventId` | ObjectId | Required, `ref: 'ScheduleEvent'`                       |
| `checkedIn`       | Boolean  | Default `false`                                        |
| `checkedInAt`     | Date     | Stamped automatically when `checkedIn` first goes true |
| `checkedInBy`     | ObjectId | The organizer/mentor who did it, `ref: 'User'`         |
| `createdAt` / `updatedAt` | Date | Auto (timestamps)                              |

Indexes:

- `{ userId: 1, scheduleEventId: 1 }` **unique** — one hacker can't be checked into the
  same event twice, no matter how many times the scanner fires.
- `{ scheduleEventId: 1 }` — a separate index on purpose. The compound one above is
  useless for the headcount query, which knows the event but not the user; a compound
  index can only be read left-to-right.

`checkedInAt` is stamped by a `pre('validate')` hook, the same pattern `ScheduleEvent`
uses for `day` and `isFoodEvent` — clients never send it.

### `Attendance.recordCheckIn({ userId, scheduleEventId, checkedInBy })`

Both write paths — the QR scan and the manual entry — go through this one static, so they
can't drift apart. It returns `{ attendance, created }` and is safe to call repeatedly:
a second call for the same pair returns the existing record with `created: false` rather
than erroring. If two requests race past the existence check, the duplicate-key error is
caught, the winning document is read back, and the caller still gets a clean `200`.

## Response envelope (§5)

**Every `/api` response** is wrapped in the same envelope, so the frontend writes one
generic response handler instead of parsing a different shape per endpoint:

```jsonc
// success
{ "success": true, "data": { ... } }

// failure
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Event not found" } }
```

`data` holds what the route is about:

| Kind | `data` | Example |
| ---- | ------ | ------- |
| Single resource | the object | `GET /api/schedule/:id` -> `data._id`, `data.title` |
| Collection | `{ count, <plural> }` | `GET /api/schedule` -> `data.count`, `data.events` |
| Paged collection | `{ count, <plural>, page, limit, total }` | `GET /api/announcements` — `count` is this page, `total` is the collection |
| Action result | the action's own object | `POST /api/qrcode/scan` -> `data.alreadyCheckedIn`, `data.attendance` |

`error.code` is stable and machine-readable; `error.message` is for humans and may change.

| Status | `code` | When |
| ------ | ------ | ---- |
| 400 | `VALIDATION_ERROR` | a field failed validation, or a malformed ObjectId. **Only this code carries `error.details[]`** |
| 400 | `BAD_REQUEST` | malformed request that isn't field validation (e.g. `?day=Aug-14`) |
| 401 | `UNAUTHORIZED` | missing, malformed or expired token |
| 403 | `FORBIDDEN` | authenticated but the wrong role |
| 404 | `NOT_FOUND` | resource doesn't exist, or no such route |
| 409 | `CONFLICT` | duplicate key (e.g. an email that already exists) |
| 500 | `INTERNAL_ERROR` | unexpected server failure. The real error is logged server-side and never sent to the client |

**Two things worth knowing:**

- **`DELETE` returns `200` with a body, not `204`.** §5 lists `200` for a successful
  DELETE and lists no `204` at all, and a `204` has no body to carry the envelope in.
  `DELETE /api/schedule/:id` -> `{ "success": true, "data": { "deleted": true, "id": "..." } }`.
- **`GET /health` is exempt.** It still returns a bare `{ "status": "ok" }`. It is an
  ops/liveness endpoint mounted outside `/api` and uptime probes match that literal body.

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

## Endpoints — Announcements (§1.2.2)

Base path: `/api/announcements` — **all routes require a valid token.**

| Method | Route                       | Access\*          | Description                                     |
| ------ | --------------------------- | ----------------- | ----------------------------------------------- |
| GET    | `/api/announcements`        | Any role          | The feed: pinned first, then newest by `postedAt` (`?limit`, `?page`) |
| POST   | `/api/announcements`        | Organizer / Admin | Post an announcement                            |
| PATCH  | `/api/announcements/:id`    | Organizer / Admin | Edit `title` / `body` / `pinned`                 |
| DELETE | `/api/announcements/:id`    | Organizer / Admin | Delete one → `200` + `{ deleted, id }`           |

\* §4 requires the organizer-only rule to be "enforced at the authorization layer, not
just by convention" — it is `requireRole('organizer', 'admin')` on the route, so a hacker
calling `POST` directly gets a `403`, not a silent success.

There is deliberately **no `GET /api/announcements/:id`** — §1.2.2 lists no such route,
and the feed already carries the full body of every item.

### Sorting and pagination

Sort is `{ pinned: -1, postedAt: -1 }`: **a pinned older item outranks an unpinned newer
one**, and pinned items are newest-first among themselves.

- `limit` — default `10`, max `50`
- `page` — 1-based, default `1`

Both are **clamped, never rejected** — `?limit=999` gives 50, `?limit=abc` gives 10,
`?page=0` gives 1. A bad query string is a UI bug, not something worth failing a page
load over, and it matches how `GET /api/schedule/upcoming` already treats its limit. A
page past the end is an empty list with `200`, not a `404`.

The list response carries pager state alongside the usual `count`:

```jsonc
{ "success": true,
  "data": { "count": 2,      // rows on THIS page
            "announcements": [ /* … */ ],
            "page": 1, "limit": 2,
            "total": 3 } }   // rows in the whole collection
```

Any role may read the feed; only organizers/admins may write. Editing is restricted by
**role, not ownership** — any organizer can fix any other organizer's typo mid-event.

## Endpoints — Hackathon config + countdown (§1.2.3)

Base path: `/api/config` — **all routes require a valid token.**

| Method | Route | Access | Description |
| ------ | ----- | ------ | ----------- |
| GET | `/api/config/hackathon` | Any role | The config plus the countdown, computed now |
| PUT | `/api/config/hackathon` | **Admin only** | Create or replace the singleton |

`GET` with nothing configured is **`404 NOT_FOUND`**, not an empty object and not a
fabricated default — a countdown to an invented date is worse than a visibly missing one,
and the submission routes need to tell "no deadline configured" apart from "deadline
passed".

```jsonc
{ "success": true,
  "data": {
    "_id": "…",
    "hackathonStartAt":   "2026-08-14T13:00:00.000Z",
    "hackathonEndAt":     "2026-08-16T13:00:00.000Z",
    "submissionDeadline": null,
    "serverTime":         "2026-08-14T20:30:00.000Z",
    "countdown": {
      "endsAt":      "2026-08-16T13:00:00.000Z",
      "msRemaining": 145800000,
      "formatted":   "40:30:00",
      "hasStarted":  true,
      "hasEnded":    false
    } } }
```

- **The countdown is computed per request, never stored.** Only the two timestamps live in
  the database.
- **`serverTime`** is there so the client can correct for clock skew instead of trusting
  the browser's clock — that difference decides whether the "Submit Project" button is
  enabled.
- **`msRemaining` clamps at `0`** once the hackathon ends and `formatted` becomes
  `"00:00:00"`. It never goes negative.
- **`formatted` hours do not wrap at 24** — a 48-hour hackathon shows `47:59:59`, and
  hours are padded to *at least* two digits (`100:00:00` is possible).
- `hasStarted` / `hasEnded` are the two booleans the UI actually branches on.
- All times are UTC.

### `PUT` is admin-only and is a full replace

`PUT`, not `POST`: the resource is a singleton at a known URL, so the verb has to be the
idempotent one — §5 maps `POST` to "creation of a new document", which is exactly what
must never happen here. Repeat calls from an admin panel update the same document; its
`_id` doesn't change.

It replaces rather than patches: **send `hackathonStartAt` and `hackathonEndAt` every
time.** A request that omits `submissionDeadline` *clears* it. Anything else in the body
(`_id`, `singleton`, `serverTime`, `countdown`, timestamps) is ignored.

Admin-only, and deliberately narrower than the organizer/admin pair used elsewhere: this
one moves the deadline for every team at once.

`GET /api/schedule/upcoming?limit=5` — §1.2.3 lists this alongside the countdown, but it
lives on the schedule router where it belongs as a sub-resource. See below.

## Endpoints — Project Submission (§1.2.4)

Base path: `/api/submissions` — **all routes require a valid token.**

| Method | Route | Access | Description |
| ------ | ----- | ------ | ----------- |
| GET | `/api/submissions/mine` | Hacker | The caller's **team's** submission, or `null` |
| POST | `/api/submissions` | Hacker | Create one for the caller's team → `201` |
| PATCH | `/api/submissions/:id` | Hacker, **own team only** | Edit `title` / `description` / `devpostUrl` / `repoUrl` |
| GET | `/api/submissions` | Organizer / Admin | The judging list, newest first |

There is no `DELETE` and no `GET /:id` — §1.2.4 lists neither. A team that wants to
retract edits the content instead.

### `teamId` is derived from the token, never sent

The team comes from `req.user.teamId`. A `teamId` in the request body is dropped, on both
`POST` and `PATCH`. Without that, any hacker could submit on behalf of any team — which is
the entire point of §4 scoping submissions to a team. `submittedBy` is taken from the
token for the same reason.

### No team → `409 NO_TEAM`

A hacker whose `teamId` is `null` gets `409` with the explicit code `NO_TEAM`. Not a `400`
(the request is well-formed) and not a `404` (nothing is missing at that URL) — it is a
state conflict, which is what `409` means. Resolve it with
`manageTeams.js add "<team>" <email>`; see the Team section above.

### `GET /mine` with nothing submitted is `200` and `data: null`

**Not a `404`.** This route answers "has my team submitted?", and *no* is a successful
answer — it is exactly what drives the Home page button's two states. A `404` would force
the frontend to treat a normal state as an error. A hacker with no team gets the same
`null`, for the same reason.

```jsonc
{ "success": true, "data": null }                    // nothing submitted yet
{ "success": true, "data": { "_id": "…", "title": "…", /* … */ } }
```

### The deadline is read from config, never hardcoded

Before both `POST` and `PATCH`:

1. read the singleton via `HackathonConfig.getSingleton()`;
2. the deadline is `submissionDeadline` when set, otherwise `hackathonEndAt` (§1.2.4
   allows either);
3. past it → **`403 SUBMISSION_CLOSED`**, with the deadline in the message;
4. **no config at all → the write is allowed**, and a warning is logged.

Step 4 is deliberate: a missing config must not silently lock every team out of
submitting. Failing open and warning is the safer direction than failing closed and ruining
the event.

`403` rather than `400`: the request is valid and the caller is authenticated, they are
simply not permitted to do this *now*. There is no grace period — `now > deadline` is a
hard cutoff against the server clock, which is why `GET /api/config/hackathon` exposes
`serverTime`.

### Who can do what

Writes are **hacker-only**. An organizer has no team, so there is nothing for them to
submit; they get the read-only judging list. This also means an organizer cannot fix a
team's typo — see CHECKLIST open question **5.Q1**. Any *teammate* may edit the
submission (§4: "every teammate sees the same submission state"); a hacker on another team
gets a `403`, checked before the deadline so a stranger never learns whether submissions
are still open.

## Endpoints — Schedule

Base path: `/api/schedule` — **all routes require a valid token.**

| Method | Route                        | Access\*          | Description                                   |
| ------ | ---------------------------- | ----------------- | --------------------------------------------- |
| GET    | `/api/schedule`              | Any role          | List events, filter by `?day` and/or `?category`; always time-sorted |
| GET    | `/api/schedule/upcoming`     | Any role          | Next N events with `startTime >= now` (`?limit`, default 5, max 50) |
| GET    | `/api/schedule/:id`          | Any role          | Single event detail                           |
| POST   | `/api/schedule`              | Organizer / Admin | Create an event                               |
| PATCH  | `/api/schedule/:id`          | Organizer / Admin | Update an event                               |
| DELETE | `/api/schedule/:id`          | Organizer / Admin | Delete an event → `200` + `{ deleted, id }`   |

\* "Any role" = any authenticated user (`hacker`/`mentor`/`organizer`/`admin`). No token
→ `401`; wrong role on a write route → `403`. Enforced by `requireAuth` + `requireRole`
in `backend/src/middleware/auth.js`.

### Query parameters for `GET /api/schedule`

- `day` — `YYYY-MM-DD` (e.g. `2026-08-14`). Invalid format → `400`.
- `category` — one of `Main`, `Fun`, `Food`, `Workshop`. Invalid → `400`.

Both are optional and can be combined. Results are always sorted by `startTime` ascending,
and blank titles/times/locations are guaranteed never to appear.

## Endpoints — QR Code (§3.2.1)

Base path: `/api/qrcode` — **all routes require a valid token.**

| Method | Route                       | Access\*           | Description                                    |
| ------ | --------------------------- | ------------------ | ---------------------------------------------- |
| GET    | `/api/qrcode/me`            | Any role           | Own QR code; creates it on first call          |
| POST   | `/api/qrcode/scan`          | Organizer / Mentor | Scan a code at an event → check the hacker in  |
| GET    | `/api/qrcode/:code/user`    | Organizer / Admin  | Who does this code belong to?                  |

`POST /api/qrcode/scan` takes `{ code, scheduleEventId }` and returns
`data: { alreadyCheckedIn, attendance }` — **`201`** on the first scan, **`200`** on a repeat.
Scanning the same badge twice is a normal thing that happens in a queue, so it is not an
error; the response just says `alreadyCheckedIn: true` and the record is untouched.

An unknown `code` → `404`, a missing or non-string `code` → `400`, an unknown
`scheduleEventId` → `404`, a malformed one → `400`.

## Endpoints — Attendance (§3.2.2)

Base path: `/api/attendance` — **all routes require a valid token.**

| Method | Route                                      | Access\*           | Description                        |
| ------ | ------------------------------------------ | ------------------ | ---------------------------------- |
| GET    | `/api/attendance/me`                       | Any role           | Own meal checklist                 |
| GET    | `/api/attendance/event/:scheduleEventId`   | Organizer / Admin  | Headcount for one event            |
| POST   | `/api/attendance`                          | Organizer / Mentor | Manual check-in when a scan fails  |

There is deliberately **no hacker-facing way to self-report attendance** — that would
undermine the catering numbers. Every Attendance record is created by an organizer or
mentor, either by scanning or by hand.

### `GET /api/attendance/me` is computed, not stored

Returns `data: { count, checklist: [ ... ] }`, one row per **Food** event, each with
`checkedIn` / `checkedInAt` plus the event's `title`, `startTime`, `endTime`, `day`,
`location` and `category` — everything the Profile checklist needs in one call.

Nothing is pre-created. The route fetches every `isFoodEvent: true` event, left-joins the
caller's Attendance records, and reports `checkedIn: false` where there's no match. So a
hacker who has attended nothing still gets the full list, adding an event to the schedule
costs zero writes, and no storage goes to rows that only say "hasn't happened yet". A test
asserts that reading the checklist writes no documents, so this can't quietly regress.

Rows are sorted by `startTime`, matching `GET /api/schedule`.

### `GET /api/attendance/event/:scheduleEventId`

Returns `data: { count, scheduleEventId, attendance: [ ... ] }`, each row being the Attendance
record plus a nested `user` object. An event nobody attended returns an **empty list, not
a `404`** — the event exists, the attendance is simply zero. Sorted by `checkedInAt`, so
it reads as the order people arrived.

### `POST /api/attendance`

Takes `{ userId, scheduleEventId }`. Same `201`/`200` + `alreadyCheckedIn` contract as the
scan, because it calls the same `Attendance.recordCheckIn` static. Unknown user or event →
`404`; missing or malformed ids → `400`. `checkedInBy` is taken from the token, never from
the body — an organizer can't record a check-in under someone else's name.

> ⚠️ **Known permission gap.** §3.2.1/§3.2.2 grant the two write routes to *"Organizer,
> Mentor"*, which excludes **admin** — so an admin currently gets a `403` from
> `POST /api/qrcode/scan` and `POST /api/attendance`. A mentor, conversely, can scan a
> badge but can't call `GET /api/qrcode/:code/user` to look one up when the scan fails.
> Implemented as the design doc is written; both look like spec slips and are pending a
> decision from the team lead.

## Postman / curl examples

Every example needs a token. Get one first:

```bash
curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"you@example.com\",\"password\":\"yourpassword\"}"
```

Copy the token from `data.token` in the response and use it as `<TOKEN>` below.

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

That returns `200` with `{"success":true,"data":{"deleted":true,"id":"..."}}` — **not** an
empty `204`. See [Response envelope](#response-envelope-5) for why.

**Announcements.** Any role can read the feed:

```bash
curl "http://localhost:4000/api/announcements?limit=10&page=1" -H "Authorization: Bearer <TOKEN>"
```

Posting and pinning need an **organizer or admin** token:

```bash
curl -X POST http://localhost:4000/api/announcements -H "Content-Type: application/json" -H "Authorization: Bearer <ORGANIZER_TOKEN>" -d "{\"title\":\"Lunch\",\"body\":\"Lunch is served in the cafeteria.\"}"
```

```bash
curl -X PATCH http://localhost:4000/api/announcements/PASTE_ID_HERE -H "Content-Type: application/json" -H "Authorization: Bearer <ORGANIZER_TOKEN>" -d "{\"pinned\":true}"
```

Re-run the `GET` after that and the pinned item is first even if it's the oldest.

**Hackathon config and countdown.** Any role can read it; only an **admin** can write it:

```bash
curl http://localhost:4000/api/config/hackathon -H "Authorization: Bearer <TOKEN>"
```

```bash
curl -X PUT http://localhost:4000/api/config/hackathon -H "Content-Type: application/json" -H "Authorization: Bearer <ADMIN_TOKEN>" -d "{\"hackathonStartAt\":\"2026-08-14T13:00:00Z\",\"hackathonEndAt\":\"2026-08-16T13:00:00Z\"}"
```

Call the `GET` twice a few seconds apart — `data.countdown.msRemaining` goes down. If it
returns `404`, the config simply hasn't been set yet.

**Project submission.** These need a **hacker** token, and that hacker has to be on a
team — teams are created from the command line, not over HTTP (see
[Team](#team-7--provisioned-by-script-not-by-api)):

```bash
cd backend && node src/scripts/manageTeams.js create "Team Rocket"
```

```bash
cd backend && node src/scripts/manageTeams.js add "Team Rocket" hacker@example.com
```

Log in again after that — the token itself carries no team, but `requireAuth` re-reads the
user, so an existing token works too. Check whether your team has submitted:

```bash
curl http://localhost:4000/api/submissions/mine -H "Authorization: Bearer <HACKER_TOKEN>"
```

Before you submit, that is `200` with `"data":null` — **not** a `404`. Now submit:

```bash
curl -X POST http://localhost:4000/api/submissions -H "Content-Type: application/json" -H "Authorization: Bearer <HACKER_TOKEN>" -d "{\"title\":\"Study Buddy\",\"description\":\"An app that pairs students by course.\",\"repoUrl\":\"https://github.com/example/study-buddy\"}"
```

Run that exact command twice — the second is a `409`, because a team gets one submission.
Edit it instead, using the `data._id` from the `201`:

```bash
curl -X PATCH http://localhost:4000/api/submissions/PASTE_ID_HERE -H "Content-Type: application/json" -H "Authorization: Bearer <HACKER_TOKEN>" -d "{\"devpostUrl\":\"https://devpost.com/software/study-buddy\"}"
```

Log in as the **teammate** and repeat the `GET /mine` and the `PATCH` — both work, on the
same document. That is §4's "every teammate sees the same submission state", and it is the
one behaviour worth testing by hand.

The judging list is **organizer or admin** only:

```bash
curl http://localhost:4000/api/submissions -H "Authorization: Bearer <ORGANIZER_TOKEN>"
```

To see the deadline enforced, set one in the past and try the `POST` again — it becomes a
`403` with `"code":"SUBMISSION_CLOSED"`:

```bash
curl -X PUT http://localhost:4000/api/config/hackathon -H "Content-Type: application/json" -H "Authorization: Bearer <ADMIN_TOKEN>" -d "{\"hackathonStartAt\":\"2026-08-14T13:00:00Z\",\"hackathonEndAt\":\"2026-08-16T13:00:00Z\",\"submissionDeadline\":\"2020-01-01T00:00:00Z\"}"
```

**QR code and attendance.** Your own code and your own checklist need nothing special:

```bash
curl http://localhost:4000/api/qrcode/me -H "Authorization: Bearer <TOKEN>"
```

```bash
curl http://localhost:4000/api/attendance/me -H "Authorization: Bearer <TOKEN>"
```

Scanning needs an **organizer or mentor** token, plus a `code` from the call above and the
id of a `Food` event:

```bash
curl -X POST http://localhost:4000/api/qrcode/scan -H "Content-Type: application/json" -H "Authorization: Bearer <ORGANIZER_TOKEN>" -d "{\"code\":\"PASTE_CODE_HERE\",\"scheduleEventId\":\"PASTE_EVENT_ID_HERE\"}"
```

Run that exact command twice — the first returns `201` with `data.alreadyCheckedIn: false`,
the second `200` with `data.alreadyCheckedIn: true`. That is the duplicate-scan case working, not a
failure.

```bash
curl -X POST http://localhost:4000/api/attendance -H "Content-Type: application/json" -H "Authorization: Bearer <ORGANIZER_TOKEN>" -d "{\"userId\":\"PASTE_USER_ID_HERE\",\"scheduleEventId\":\"PASTE_EVENT_ID_HERE\"}"
```

```bash
curl http://localhost:4000/api/attendance/event/PASTE_EVENT_ID_HERE -H "Authorization: Bearer <ORGANIZER_TOKEN>"
```

> The escaped-quote style above is for Windows. Postman is easier for day-to-day testing —
> point it at `http://localhost:4000`, use **Body → raw → JSON**, and set the token once
> under **Authorization → Bearer Token**. See [manual-qa.md](manual-qa.md) for a full
> hand-testing script.
