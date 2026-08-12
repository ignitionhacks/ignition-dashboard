# Phase 5 — Project Submission

> **Spec:** design doc §1.2.4 (Entity: Project Submission), §4 ("Each Project Submission
> belongs to a Team … only one submission exists per team"), §5 (`submissionRouter` at
> `/api/submissions`; 409 example is "attempting to submit a project twice for the same team").
> **Closes:** CHECKLIST phase 5.
> **Depends on:** phase 1 (envelope), phase 3 (deadline), phase 4 (Team).

---

## Goal

Back the Home dashboard's "Submit Project" button and its "already submitted" state.
One submission per team; every teammate sees and can edit the same one.

---

## Model — `backend/src/models/Submission.js`

Fields are §1.2.4 verbatim.

| Field | Type | Rules |
| --- | --- | --- |
| `teamId` | ObjectId ref `Team` | required, **unique** — this index *is* the "one per team" rule |
| `title` | String | required, trimmed, non-empty, `maxlength` 200 |
| `description` | String | required, trimmed, `maxlength` 5000 |
| `devpostUrl` | String | optional; must be a valid `http(s)` URL if present |
| `repoUrl` | String | optional; must be a valid `http(s)` URL if present |
| `submittedAt` | Date | set on create, **never** changed by an update |
| `updatedAt` | Date | `timestamps: true` |
| `submittedBy` | ObjectId ref `User` | *added* — audit trail, see below |

**`unique: true` on `teamId`** is the enforcement §4 asks for. A racing second POST from
a teammate loses at the database level and surfaces as the phase-1 `409 CONFLICT` — the
exact case §5 names. A controller-side `findOne` check runs first for a clean message,
but the index is what actually guarantees it.

**`submittedBy` is an addition to the doc's field list.** §1.2.4 does not list it. It is
one field, it costs nothing, and the alternative is being unable to answer "which
teammate submitted this?" during judging disputes. It mirrors `Attendance.checkedInBy`,
which the doc *does* specify "for audit purposes" — the same reasoning applies.
Called out here so it is a visible decision rather than scope creep.

**URL validation:** a `match` regex requiring `http://` or `https://`. Deliberately not
stricter — hackers paste GitHub, GitLab, Devpost and occasionally a Google Drive link,
and rejecting a valid submission at 11:58pm because of an over-tight regex is a far
worse failure than accepting an odd URL.

---

## Routes — `/api/submissions`

| Method | Route | Access | Behaviour |
| --- | --- | --- | --- |
| GET | `/api/submissions/mine` | hacker | the caller's team's submission |
| POST | `/api/submissions` | hacker | create for the caller's team → 201 |
| PATCH | `/api/submissions/:id` | hacker | update — **own team only** |
| GET | `/api/submissions` | organizer, admin | list all (judging) |

`/mine` is declared **before** `/:id` in the router, or Express 5 matches `mine` as an id.

### `teamId` is derived, never sent

The caller's team comes from `req.user.teamId` (via `teamService.getTeamForUser`). A
`teamId` in the request body is dropped by `pickWritable`. Without this, any hacker
could submit on behalf of any team — §4's whole reason for scoping to the team.

### No team → 409 `NO_TEAM`

A hacker with `teamId === null` calling POST gets `409` with code `NO_TEAM` and a message
telling them to join a team first. Not a 400 (the request is well-formed) and not a 404
(nothing is missing at the URL) — it is a state conflict, which is what 409 means.

This is the case phase 4's provisioning script exists to resolve; see
[04-team.md](04-team.md).

### `GET /mine` with nothing submitted → 200, `data: null`

**Not a 404.** This route answers "has my team submitted?", and "no" is a successful
answer — it is precisely what drives the button's two states on the Home page. A 404
would force the frontend to treat a normal state as an error. `GET /:id` for a
genuinely missing id *is* a 404; the two cases are different and are tested separately.

### Deadline enforcement

Before **both** POST and PATCH:

1. read the singleton via `HackathonConfig.getSingleton()`;
2. deadline = `submissionDeadline` if set, else `hackathonEndAt` (§1.2.4 allows either);
3. if `now > deadline` → **403 `SUBMISSION_CLOSED`** with the deadline in the message;
4. **no config at all → allow the write.** A missing config must not silently lock every
   team out of submitting. It is logged as a warning. This is the safer failure
   direction and it is deliberate.

403 rather than 400: the request is valid, the caller is authenticated, and they are
simply not permitted to do this *now* — which is what 403 means. `SUBMISSION_CLOSED` is
the explicit `ApiError` code phase 1 provisioned for.

### Organizers do not submit

POST/PATCH are hacker-only. An organizer has no team, so there is nothing for them to
submit. They get the read-only `GET /api/submissions` list. This also means an organizer
cannot fix a team's typo — flagged as an open question rather than assumed.

---

## Files

**New:** `models/Submission.js`, `controllers/submissionController.js`,
`routes/submissionRoutes.js`, `tests/unit/submission.test.js`,
`tests/integration/submissions.test.js`.
**Modified:** `app.js` (mount `/api/submissions`), README, manual-qa, CHECKLIST.

---

## TDD plan

### `tests/unit/submission.test.js` (~12)

`teamId` required · `title` required, blank rejected · `description` required ·
`title` over 200 rejected · a second submission for the same `teamId` → 11000 ·
`devpostUrl` optional · a non-URL `devpostUrl` rejected · `http://` and `https://`
accepted · `repoUrl` same · `submittedAt` defaults to now · `submittedAt` unchanged by a
later save · validators re-run on update.

### `tests/integration/submissions.test.js` (~22)

| # | Test |
| --- | --- |
| S.1 | every route requires a token → 401 |
| S.2 | POST as a hacker with a team → 201, `data.teamId` = their team |
| S.3 | a spoofed `teamId` in the body is ignored — the caller's team wins |
| S.4 | POST as a hacker with **no** team → 409 `NO_TEAM` |
| S.5 | POST twice for the same team → 409 `CONFLICT` |
| S.6 | a **teammate** POSTing after the first → 409 (team-scoped, not user-scoped) |
| S.7 | POST missing `title` → 400 `VALIDATION_ERROR` with `details` |
| S.8 | POST with an invalid `devpostUrl` → 400 |
| S.9 | POST as an organizer → 403 |
| S.10 | `GET /mine` before submitting → 200 with `data: null` |
| S.11 | `GET /mine` after submitting → 200 with the submission |
| S.12 | `GET /mine` returns the **same** submission for a teammate (§4) |
| S.13 | `GET /mine` with no team → 200 with `data: null` (not an error) |
| S.14 | PATCH updates `title`, bumps `updatedAt`, leaves `submittedAt` alone |
| S.15 | a teammate can PATCH the same submission |
| S.16 | a hacker on **another** team PATCHing → 403 `FORBIDDEN` |
| S.17 | PATCH a non-existent id → 404; a malformed id → 400 |
| S.18 | PATCH cannot change `teamId` |
| S.19 | POST after `submissionDeadline` → 403 `SUBMISSION_CLOSED` |
| S.20 | PATCH after the deadline → 403 |
| S.21 | with no `submissionDeadline`, `hackathonEndAt` is used as the deadline |
| S.22 | with **no config at all**, POST succeeds (fail-open, by design) |
| S.23 | `GET /api/submissions` as an organizer → 200, all submissions |
| S.24 | `GET /api/submissions` as a hacker → 403 |

Teams are created through `teamService` in the test setup — no HTTP route exists for it
(phase 4), which is exactly the constraint manual QA will hit too.

---

## Acceptance criteria

- [x] `cd tests && npm test` → **`pass 335` / `fail 0`** (289 + 46)
- [x] One submission per team, enforced by a unique index and proven by S.5/S.6
- [x] A hacker cannot touch another team's submission (S.16)
- [x] The deadline is read from config, never hardcoded (S.19–S.22)
- [x] `GET /mine` returns `data: null`, not 404, when nothing is submitted
- [x] README (schema + endpoints), manual-qa, CHECKLIST phase 5 updated

---

## Landed 2026-08-12

Green at **`pass 335` / `fail 0`** (289 → 335). Written tests-first: both files failed at
require time before their modules existed.

**Four things came out different from the plan above.**

1. **46 tests, not the ~34 estimated** — 18 unit (SU.1–SU.12b) and 28 integration
   (S.1–S.24 with `b` variants). The extra ones are the cases the plan's table collapsed:
   a `description` over 5000, `repoUrl` validated the same way as `devpostUrl`,
   `submittedBy` unwritable on PATCH (S.18b), a hacker with no team PATCHing (S.16b), a
   future deadline still allowing the write (S.21b), and an empty judging list (S.23b).

2. **There is no `GET /api/submissions/:id`.** The "`GET /:id` for a genuinely missing id
   *is* a 404" line under *`GET /mine` with nothing submitted* was a leftover from an
   earlier draft — §1.2.4 lists no such route and none was built. S.17 tests a `PATCH`
   against a missing id instead, which is where the 404 actually lives. The judging list
   already returns every field, so a per-id read would add a route without adding
   information.

3. **Ownership is checked before the deadline** in `updateSubmission`. The plan implied
   deadline-then-ownership. Reversed on purpose: a stranger PATCHing another team's
   submission gets a plain 403 and never learns whether the submission window is open.

4. **`submittedBy` is unwritable on update as well as create.** The plan only said
   `teamId` is derived; the same argument applies to `submittedBy`, so `UPDATE_FIELDS`
   is `CREATE_FIELDS` — neither field is ever read from a body.

Open questions 1 and 3 above are recorded in CHECKLIST as **5.Q1** and, for the fail-open
choice, **5.Q2**.

---

## Open questions for Youssef

1. **Can an organizer or admin edit/delete a submission?** Not in §1.2.4's route list.
   Default: no. Ops teams usually want a "withdraw this submission" lever.
2. **Is there a `DELETE /api/submissions/:id`?** §1.2.4 lists none, so none is built.
   A team that wants to retract currently PATCHes the content instead.
3. **Grace period after the deadline?** None implemented — `now > deadline` is a hard
   cutoff against the server clock, which is why `serverTime` is exposed by phase 3.
