# Plan — API Design (§5) + the remaining entities

This folder is the plan for the work described in **`TAKS_CLAUDE2.pdf`** (design doc
§3, §4, §5) and the entity sections it depends on (§1.2.2, §1.2.3, §1.2.4, §7).

It sits *under* [CHECKLIST.md](../CHECKLIST.md), which remains the master planner —
each phase below names the CHECKLIST phase it closes.

**Branch:** `backend/api-design-and-remaining-entities`, stacked on
`backend/qr-attendance` (which is itself stacked on `backend/schedule-events`).
The new work needs `User`, `ScheduleEvent` and `Attendance`, none of which are on
`main` yet. **Merge order: `schedule-events` → `qr-attendance` → this one.**

---

## What the PDF actually asked for

| Design doc | Subject | State before this plan |
| --- | --- | --- |
| §3.2.1 | QR Code entity + 3 routes | ✅ built (CHECKLIST phase 6) |
| §3.2.2 | Attendance entity + 3 routes | ✅ built (CHECKLIST phase 6) |
| §4 | Relationships between entities | ⚠️ half — the QR/Attendance half exists; the Announcement, Submission, Team and HackathonConfig halves have no entities behind them |
| §5 | API design: routers, envelope, error handling, validation, status codes | ❌ not done — the API returns bare objects and `{ error }` |

§3 is therefore **already delivered**. What is left is §5 (a cross-cutting change to
every route) plus the four entities §4 refers to but that were never built.

---

## Execution order

Run top to bottom. Each phase is a separate document, and each one ends with the
full suite green before the next one starts.

| # | Phase | Design doc | Closes CHECKLIST | Doc |
| - | ----- | ---------- | ---------------- | --- |
| 1 | Response envelope + error contract | §5 | *new* — phase 7 | [01-response-envelope.md](01-response-envelope.md) |
| 2 | Announcements | §1.2.2 | phase 3 | [02-announcements.md](02-announcements.md) |
| 3 | HackathonConfig + countdown | §1.2.3 | phase 4 | [03-hackathon-config.md](03-hackathon-config.md) |
| 4 | Team | §7 assumption, §4 | *new* — phase 8 | [04-team.md](04-team.md) |
| 5 | Project Submission | §1.2.4 | phase 5 | [05-submissions.md](05-submissions.md) |
| 6 | Postman rebuild + docs sweep | — | X.3 / X.6 | [06-postman-and-docs.md](06-postman-and-docs.md) |

**Why the envelope goes first.** It rewrites the response shape of every existing
route and every existing test. Doing it before the new entities means phases 2–5 are
written against the final contract once, instead of being written twice.

**Why Team comes before Submission.** §1.2.4 scopes a submission to a `teamId`, and
§4 requires that "every teammate sees the same submission state". Without a Team
there is nothing for a submission to belong to.

---

## Ground rules for every phase

Inherited from the root `CLAUDE.md` and [HANDOFF.md](../HANDOFF.md) — they are not
optional:

1. **Tests first.** Write `tests/unit/<entity>.test.js` and
   `tests/integration/<entity>.test.js` *before* the controller (CHECKLIST item T.1).
2. **Full suite green before moving on.** `cd tests && npm test`, `fail 0`. The count
   only ever goes up.
3. **Nothing is committed or pushed.** Work is left in the tree for Abdullah.
4. **No writes to `ignition-portal-dev`.** Nothing in this plan touches it.
5. **Docs updated in the same phase**, not at the end: [README.md](../README.md)
   endpoint table, [manual-qa.md](../manual-qa.md), [CHECKLIST.md](../CHECKLIST.md).
6. **Every `.md` lives under `docs/`** — including this folder.

---

## Status

Updated as phases land. A phase is only ticked when its test gate passed.

| # | Phase | Status | Tests after |
| - | ----- | ------ | ----------- |
| — | baseline (phases 0–6) | ✅ | 161 |
| 1 | Response envelope | ✅ done 2026-08-12 | **175** |
| 2 | Announcements | ✅ done 2026-08-12 | **214** |
| 3 | HackathonConfig | ✅ done 2026-08-12 | **256** |
| 4 | Team | ✅ done 2026-08-12 | **289** |
| 5 | Project Submission | ✅ done 2026-08-12 | **335** |
| 6 | Postman + docs | ✅ done 2026-08-12 | 335 (no code changed) |

Phase 6 rewrote `docs/postman/ignition-dashboard.postman_collection.json`: **216 requests
across 16 folders** (104/11 before), every assertion moved under the envelope, and a
collection-level post-response script that checks the envelope on every request. What is
left is Abdullah's step 8 — run it against Atlas and fill in the **Passed** columns.

---

## Decisions taken before any code was written

Both were put to Abdullah rather than guessed at, because each one changes the shape
of the work.

### 1. The §5 envelope is applied to **every** route, not just the new ones

§5 specifies `{ "success": true, "data": { … } }` and
`{ "success": false, "error": { "code", "message" } }`. The API today returns bare
objects, `{ count, events }` and `{ error }`.

**Decision: migrate everything.** The stated purpose of the envelope is that the
frontend "write one generic response handler instead of custom parsing per endpoint",
which a half-migrated API defeats entirely. It is also as cheap as it will ever be
right now — `frontend/` is still an empty placeholder, so **nothing consumes the
current shapes**. The cost is confined to the test suite and the Postman collection,
both of which are ours.

### 2. Team follows the doc — an entity, but no router

§7 lists Team as an *assumption*: "a Team entity (with membership) exists even though
it is not directly visible in the three provided screens. It is required to make the
'Submit Project' button and its 'already submitted' state meaningful."

**Decision: follow the doc.** That means the entity and its membership get built —
`Submission` cannot work otherwise — but **no `teamRouter` is added**, because §5's
router list is explicit and does not contain one:

> `userRouter` · `announcementRouter` · `scheduleRouter` · `attendanceRouter` ·
> `qrCodeRouter` · `submissionRouter` · `configRouter`

Teams are therefore provisioned out-of-band, exactly as §7 says elevated roles are
("an existing admin process, for example a seed script or an internal admin panel").
See [04-team.md](04-team.md) for the consequence this has on Postman testing — it is
the one real cost of this decision and it is called out there, not buried.
