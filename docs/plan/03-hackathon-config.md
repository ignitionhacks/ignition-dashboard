# Phase 3 — HackathonConfig + countdown

> **Spec:** design doc §1.2.3 (HackathonConfig), §4 ("A HackathonConfig is a singleton,
> referenced implicitly by everything time based"), §5 (`configRouter` at `/api/config`).
> **Closes:** CHECKLIST phase 4.
> **Depends on:** phase 1. **Blocks:** phase 5 (the submission deadline reads from here).

---

## Goal

One document holds the hackathon's start and end times. The Home countdown and every
deadline check read from it "rather than hardcoding dates" (§4).

---

## Model — `backend/src/models/HackathonConfig.js`

| Field | Type | Rules |
| --- | --- | --- |
| `hackathonStartAt` | Date | required |
| `hackathonEndAt` | Date | required; must be **strictly after** `hackathonStartAt` |
| `submissionDeadline` | Date | optional; §1.2.4 permits "a dedicated `submissionDeadline`"; when absent, phase 5 falls back to `hackathonEndAt` |
| `createdAt` / `updatedAt` | Date | `timestamps: true` |

`endTime > startTime` is validated the same way `ScheduleEvent` already does it, so the
two models behave identically.

### Enforcing the singleton

§4 says singleton, so the code must guarantee it rather than trust convention:

- A `singleton` field, `enum: ['hackathon']`, `default: 'hackathon'`, **unique index**.
  A second document is impossible at the database level — a duplicate-key attempt
  surfaces as the phase-1 `409 CONFLICT`.
- Reads go through `HackathonConfig.getSingleton()`, which returns the one document or
  `null`. No `findOne()` scattered through controllers.

**Not** a hardcoded `_id`, and **not** "whatever `findOne()` returns first" — both look
fine until two documents exist and then fail silently in different directions.

### When no config exists

`GET /api/config/hackathon` returns **404 `NOT_FOUND`** with a message saying the
hackathon config has not been set. Not an empty object, not a fabricated default: a
countdown to an invented date is worse than a visibly missing one, and phase 5 needs to
tell "no deadline configured" apart from "deadline passed".

---

## Routes

| Method | Route | Access | Notes |
| --- | --- | --- | --- |
| GET | `/api/config/hackathon` | all authenticated | the config + the computed countdown |
| PUT | `/api/config/hackathon` | admin | upsert the singleton |
| GET | `/api/schedule/upcoming?limit=5` | all authenticated | **already exists** — see below |

### `GET /api/schedule/upcoming`

§1.2.3 lists this route under HackathonConfig, but it was already built in phase 1 of
the original checklist (`scheduleController.listUpcoming`, filter `startTime >= now`,
sorted ascending, `?limit=N`). This phase **verifies** it against §1.2.3 and adds a test
that it is envelope-correct. No reimplementation, and it stays on `scheduleRouter` where
it belongs as a sub-resource of schedule.

### The countdown

§1.2.3: the countdown is `hackathonEndAt` minus now, "formatted `HH:MM:SS` server-side
or returned as a raw timestamp". **Both are returned** — it costs nothing and removes a
round of frontend guesswork:

```jsonc
{
  "hackathonStartAt": "2026-08-14T13:00:00.000Z",
  "hackathonEndAt":   "2026-08-16T13:00:00.000Z",
  "submissionDeadline": null,
  "serverTime":       "2026-08-14T20:30:00.000Z",
  "countdown": {
    "endsAt":          "2026-08-16T13:00:00.000Z",
    "msRemaining":     146000,
    "formatted":       "40:30:00",
    "hasStarted":      true,
    "hasEnded":        false
  }
}
```

- `serverTime` is included so the client can correct for clock skew instead of trusting
  the browser's clock — the difference decides whether the "Submit Project" button is
  enabled, so it is worth being exact about.
- `msRemaining` clamps at `0` once the hackathon ends; `formatted` becomes `"00:00:00"`.
  It never goes negative.
- `formatted` is `HH:MM:SS` with hours **not** wrapped at 24 — a 48-hour hackathon shows
  `47:59:59`, not `23:59:59`. Zero-padded to at least two digits.
- All times UTC, per §7.

### `PUT`, not `POST`

The resource is a singleton at a known URL, so `PUT` (idempotent upsert) is the correct
verb and repeat calls from an admin panel are safe. §5's verb table maps POST to
"creation of a new document", which is exactly what must **not** happen here.
Admin-only: this changes the deadline for every team at once.

---

## Files

**New:** `models/HackathonConfig.js`, `controllers/configController.js`,
`routes/configRoutes.js`, `utils/countdown.js` (`formatCountdown(ms)`, pure and
unit-testable), `tests/unit/hackathonConfig.test.js`, `tests/unit/countdown.test.js`,
`tests/integration/config.test.js`.
**Modified:** `app.js` (mount `/api/config`), README, manual-qa, CHECKLIST.

---

## TDD plan

### `tests/unit/countdown.test.js` (~8) — pure function, no DB

`0 → "00:00:00"` · `1000 → "00:00:01"` · `61_000 → "00:01:01"` · `3_600_000 → "01:00:00"` ·
`172_799_000 → "47:59:59"` (no 24h wrap) · negative → `"00:00:00"` · sub-second rounds
down · exactly 24h → `"24:00:00"`.

### `tests/unit/hackathonConfig.test.js` (~8)

`hackathonStartAt` required · `hackathonEndAt` required · end must be after start ·
end equal to start rejected · a second document rejected with code 11000 ·
`getSingleton()` returns null when empty · `getSingleton()` returns the document ·
`submissionDeadline` optional and nullable.

### `tests/integration/config.test.js` (~14)

GET without a token → 401 · GET with none set → 404 `NOT_FOUND` · a hacker PUT → 403 ·
an organizer PUT → 403 (**admin only**) · an admin PUT → 200 and creates it ·
a second admin PUT **updates** rather than creating a duplicate (still exactly one
document) · PUT with `end < start` → 400 with `details` · GET as a hacker → 200 with the
config and countdown · `countdown.msRemaining > 0` and `hasEnded === false` for a future
end · a past `hackathonEndAt` → `msRemaining === 0`, `formatted === "00:00:00"`,
`hasEnded === true` · a future `hackathonStartAt` → `hasStarted === false` ·
`serverTime` is within a few seconds of now · client-supplied `serverTime`/`countdown`
in the body are ignored (`pickWritable`) · `GET /api/schedule/upcoming?limit=5` returns
at most 5, ascending, enveloped.

---

## Acceptance criteria

- [x] `cd tests && npm test` → **`pass 256` / `fail 0`** (214 + 42 — more than the
      estimated 30, mostly extra countdown edge cases)
- [x] Exactly one config document can exist — proven by H.5 (duplicate key 11000) and
      CI.6 (`countDocuments() === 1` after a second PUT), not by convention
- [x] Countdown never negative; hours do not wrap at 24 (C.5, C.7, CI.11)
- [x] Only an admin can write the config — an **organizer** gets 403 too (CI.4)
- [x] `GET /api/schedule/upcoming` re-verified against §1.2.3 (CI.15, CI.15b) — not
      reimplemented, and it stays on the schedule router
- [x] README (schema + endpoints), manual-qa §14, CHECKLIST phase 4 updated

**Landed 2026-08-12.** Two things this plan didn't specify, decided during the build and
documented in the README: **`PUT` is a full replace** (omitting `submissionDeadline`
clears it — that is what PUT means, and a half-applied deadline is the kind of thing
nobody notices until submissions close early), and the internal `singleton` field is
**stripped from every response** so clients never see or send it. The controller uses
read-then-save rather than `findOneAndUpdate({upsert:true})` because the "end after start"
validator needs a real document to compare against — in an update query, `this` is the
query, not the document.

---

## Notes

- **Seeding.** `backend/src/scripts/seed.js` gains a config document so a fresh dev
  database has a working countdown. Seed still requires `--yes` and is still never run
  against the shared cluster.
- **Timezone.** Stored and compared in UTC (§7). The `day` grouping caveat in
  HANDOFF.md's "known gaps" applies here too: if the event ever needs a fixed local
  timezone, `toDayString` in `ScheduleEvent` and the formatter here are the two places
  to change.
