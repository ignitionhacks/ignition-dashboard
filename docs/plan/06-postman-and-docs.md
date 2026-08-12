# Phase 6 — Postman collection rebuild + docs sweep

> **The deliverable Abdullah asked for:** *"at the end when everything is done, create /
> update the Postman collection so I can test it and make sure everything is working good
> and as expected."*
> **Closes:** CHECKLIST X.3 / X.6.
> **Depends on:** phases 1–5, all green.

---

## Why the whole collection has to be rewritten, not extended

Phase 1 changes the response shape of **every** route. The existing collection has ~150
test scripts and essentially all of them read the old shape:

```js
pm.expect(pm.response.json().role).to.eql('hacker');      // now .data.role
pm.collectionVariables.set('hackerId', b.user._id);        // now b.data.user._id
pm.expect(b.count).to.eql(b.events.length);                // now b.data.count / b.data.events
```

Every assertion and every `pm.collectionVariables.set` that reads a body has to move
under `data`. Folders 9/10/11 alone hold 92 assertions. This is mechanical but it is not
optional — a stale collection that "passes" because `undefined === undefined` is worse
than no collection.

---

## Structure of the new collection

Existing folders 1–11 are kept (renumbered where the envelope changed their expectations)
and four new folders are added. Keeping the numbering aligned with `manual-qa.md` matters —
Abdullah tests with both open side by side.

| Folder | Content | Status |
| --- | --- | --- |
| 1 | Setup + `/health` | kept — `/health` is the documented envelope exception |
| 2 | Registration and login | migrated to `data.*` |
| 3 | Tokens and profile | migrated |
| 4 | Get an organizer (manual-qa 7.1) | migrated |
| 5 | Schedule writing | migrated; **5.14 now expects 200 + body, not 204 empty** |
| 6 | Schedule reading | migrated (`data.count` / `data.events`) |
| 7 | Role change takes effect immediately | migrated |
| 8 | Cleanup | migrated |
| 9 | QR Code | migrated (44 assertions) |
| 10 | Attendance | migrated (43 assertions) |
| 11 | Cleanup for 9 and 10 | migrated |
| **12** | **Response envelope + error contract** | **new** |
| **13** | **Announcements** | **new** |
| **14** | **Hackathon config + countdown** | **new** |
| ~~15~~ | ~~Project submissions~~ | **shipped as folder 16** — see deviation 1 below |
| ~~16~~ | ~~Cleanup for 12–15~~ | **shipped as folder 17** |

### Folder 12 — envelope and error contract

The contract itself, tested once rather than re-asserted in every request: `success`
present on every response · a 401/403/404/409/400 each carrying the right `error.code` ·
`details[]` on a validation failure · no stack trace in any error body · `/health`
proven **exempt** · `DELETE /api/schedule/:id` proven to return 200 with a body.

### Folder 13 — Announcements

Hacker reads / cannot write (403 on POST, PATCH, DELETE) · organizer and admin create ·
blank `body` → 400 with `details` · spoofed `authorId` ignored · pinned sorts above a
newer unpinned item · `?limit=` / `?page=` paginate and `total` is collection-wide ·
PATCH flips `pinned` and the feed order changes · DELETE removes it.

### Folder 14 — Config and countdown

GET before any config → 404 · hacker and organizer PUT → 403 · admin PUT → 200 · a second
PUT updates rather than duplicating · `end < start` → 400 · GET returns `countdown` with
`msRemaining`, `formatted`, `hasStarted`, `hasEnded` · a past `hackathonEndAt` gives
`00:00:00` and never a negative · `serverTime` within seconds of the runner's clock ·
`GET /api/schedule/upcoming?limit=5` honours the limit and the ordering.

### Folder 15 — Project submissions

**⚠️ This folder needs one CLI step before it will run.** Teams have no HTTP routes
(phase 4, following §5's router list), so the team has to be provisioned first. The
folder's description carries the exact commands, and the first request fails with a clear
`NO_TEAM` message if they were skipped:

```bash
node src/scripts/manageTeams.js create "QA Team Alpha"
```
```bash
node src/scripts/manageTeams.js add "QA Team Alpha" qa-hacker@example.com
```

Run from `backend/`. Expect `created team QA Team Alpha` and `added qa-hacker@example.com`.

Then: POST with no team → 409 `NO_TEAM` · POST with a team → 201 · a spoofed `teamId`
ignored · a second POST → 409 · a **teammate's** POST → 409 · `GET /mine` before → 200
with `data: null` · after → the submission · a teammate sees the **same** one · PATCH by
a teammate → 200 · PATCH by an outsider → 403 · invalid `devpostUrl` → 400 ·
organizer `GET /api/submissions` → 200 · hacker → 403 · after moving
`submissionDeadline` into the past via the admin config route, POST → 403
`SUBMISSION_CLOSED` (this is why folder 14 runs first).

### Folder 16 — Cleanup

Same pattern as folders 8 and 11: `ignition-dashboard-dev` is shared, so QA data is
removed at the end. Deletes the QA announcements and, because no `DELETE` route exists
for submissions or teams (neither is in the doc), prints the `mongosh`/script commands
for the two collections that cannot be cleaned over HTTP. Explicit is better than leaving
orphans in a shared database.

---

## Collection-wide conventions

- **Every** request keeps a test script. A request with no assertion is not a test.
- Naming stays `<folder>.<n>  METHOD /route  -> expected`, which is what makes the runner
  output readable and matches `manual-qa.md` row-for-row.
- New collection variables: `announcementId`, `pinnedAnnouncementId`, `teamName`,
  `submissionId`, `qaTeamHackerToken`, `qaTeammateToken`, `hackathonEndAt`.
- Runnable top to bottom in one Runner pass against an empty database, and re-runnable —
  the property folders 9/10/11 already have and the new ones must match.
- A shared pre-request snippet asserts `pm.response.json().success === true` on every 2xx,
  so an envelope regression fails loudly everywhere at once.

---

## Docs sweep

| File | Change |
| --- | --- |
| `docs/README.md` | new "Response envelope" section; schema table gains Announcement, HackathonConfig, Team, Submission; endpoint table gains 11 routes; curl examples re-cut against the envelope |
| `docs/manual-qa.md` | new sections for folders 12–15 with blank **Passed** columns; the 204→200 DELETE row corrected |
| `docs/CHECKLIST.md` | phases 3, 4, 5 ticked; new phases 7 (envelope) and 8 (Team) added and ticked; findings list updated with anything new; test count updated |
| `docs/HANDOFF.md` | current state, branch name, new test total, the Team-has-no-routes decision, the 204→200 change, the "provision a team before folder 15" step |
| `docs/plan/README.md` | status table filled in |
| `docs/environment-variables.md` | untouched — no new env vars |

`HANDOFF.md` also needs one correction unrelated to this work: it states "Nothing
committed", which is stale — `git log` shows 6 commits.

---

## Acceptance criteria

- [x] `cd tests && npm test` → `fail 0`, **335** tests (the estimate of ~291 predated
      phases 4 and 5 landing)
- [ ] Postman Runner, whole collection → **0 failed assertions** — *Abdullah, step 8*
- [ ] A second consecutive Runner pass also passes (re-runnability) — *Abdullah, step 8*
- [x] No request in the collection reads a pre-envelope path — verified mechanically:
      every `pm.response.json().X` in the file now reads `.data` or `.error`, with the one
      documented exception of `/health`'s `.status` in row 1.7
- [x] The submissions folder's description carries the `manageTeams.js` commands and the
      folder to run them in
- [x] Every doc in the table above updated
- [x] Nothing committed or pushed — Abdullah does that

---

## Landed 2026-08-12

**216 requests across 16 folders, 224 test scripts, 0 syntax errors, 0 requests without
assertions.** Five deviations from the plan above, all deliberate:

**1. Folder numbers are 12, 13, 14, 16, 17 — there is no folder 15.** The table above says
15 = Submissions and 16 = Cleanup, but `manual-qa.md` §15 is *Teams* and §16 is
*Submissions*. This doc's own stated principle — "keeping the numbering aligned with
`manual-qa.md` matters, Abdullah tests with both open side by side" — decides it: the
folder numbers follow the manual-qa sections, and the gap at 15 is the point. Teams have no
HTTP surface, so there is nothing for a folder 15 to contain.

**2. The envelope guard is a collection-level post-response script, not "a shared
pre-request snippet".** A pre-request script runs *before* the response exists, so it could
never have asserted on it. It now runs after every one of the 216 requests and checks three
things: `success` matches the status code, a 4xx/5xx carries `error.code` and
`error.message`, and no error body leaks a stack trace. `/health` is excluded by URL.

**3. Folder 16 brings its own accounts and its own teams** — `qa-alpha-1`, `qa-alpha-2`,
`qa-noteam`, `qa-beta-1` on "QA Team Alpha" and "QA Team Beta", rather than §15's "QA Team"
and the existing accounts. A submission is per team, so a folder pointed at a team that was
also submitted for by hand would find its one submission slot already taken and stop being
re-runnable. The folder description maps the four accounts onto §16's hacker1/2/3.

**4. Folder 8's four cleanup deletes gained assertions.** They had no test script at all,
which meant four requests in the collection could not fail. They now assert `200` or `404`,
the same shape folder 11 already used.

**5. Two fixes the plan did not anticipate.** Folder 11's three deletes asserted
`[204, 404]` and were changed to `[200, 404]` — the same 204→200 change as 5.14, which the
plan caught only for folder 5. And several manual-qa rows became two requests each (12.14's
"then GET that id", 13.14's two pages, 14.13/14.14/14.15's PUT-then-GET pairs), because one
Postman request cannot make two calls; they are named `12.14`/`12.15`, `13.14a`/`13.14b`
and so on.

### Collection variables

The plan guessed at `pinnedAnnouncementId`, `teamName`, `qaTeamHackerToken`,
`qaTeammateToken` and `hackathonEndAt`. The 33 that actually landed are named for what the
folders capture: `envEventId` · `announcementId` · `spoofAnnouncementId` ·
`untitledAnnouncementId` · `adminAnnouncementId` · `pinnedPostedAt` · `page1Ids` ·
`feedTotal` · `configId` · `savedStartAt` · `savedEndAt` · `savedDeadline` ·
`startedAnHourAgo` · `endsInTwoHours` · `msRemainingFirst` · `windowStart` · `windowEnd` ·
`qaAlpha1Email` · `qaAlpha2Email` · `qaNoTeamEmail` · `qaBeta1Email` · `alpha1Token` ·
`alpha2Token` · `noTeamToken` · `beta1Token` · `alpha1Id` · `alpha2Id` · `noTeamId` ·
`beta1Id` · `alphaTeamId` · `betaTeamId` · `submissionId` · `submittedAt` · `longTitle`.

### Still not re-runnable

Folders 1–8 are the original schedule/auth QA and assert `201` on registration in rows 2.1,
4a and 4b, so a second pass returns `409` there. Left alone rather than loosened: those
rows are *about* first-time registration, and the collection description says which folders
are safe to re-run. Folders 9–14, 16 and 17 all log in (or register-or-reuse) their own
accounts and are re-runnable.

---

## Handover to Abdullah (workflow step 8)

1. `cd tests && npm test` → expect `fail 0`.
2. `cd backend && npm run dev` → expect `[db] Connected to MongoDB (ignition-dashboard-dev)`.
3. Provision the QA team with the two `manageTeams.js` commands above.
4. Import `docs/postman/ignition-dashboard.postman_collection.json`, set `baseUrl`, and
   run folders 1 → 16 in order.
5. Fill in the **Passed** columns in `manual-qa.md`.
6. Push the branch; Youssef reviews and merges — **`backend/schedule-events` first, then
   `backend/qr-attendance`, then this branch.**
