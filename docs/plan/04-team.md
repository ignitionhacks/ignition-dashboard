# Phase 4 — Team

> **Spec:** design doc §7 (Assumptions), §4 ("Each Project Submission belongs to a Team,
> and a Team has many Users"), §1.2.1 (`User.teamId`).
> **Closes:** new CHECKLIST phase 8.
> **Depends on:** phase 1. **Blocks:** phase 5 — a submission has nowhere to belong without this.

---

## The decision, and why this phase looks unusual

§7 lists Team as an **assumption**, not a specified entity:

> "Project submissions are scoped to Teams, and a Team entity (with membership) exists
> even though it is not directly visible in the three provided screens. It is required
> to make the 'Submit Project' button and its 'already submitted' state meaningful."

Abdullah's instruction was **follow the doc**. Followed literally that means:

- ✅ **Build the entity and its membership.** §7 says it exists; §4 and §1.2.4 both
  depend on it; `User.teamId` already references it.
- ❌ **Add no `teamRouter`.** §5's router list is explicit and complete, and there is no
  team router in it:
  `userRouter` · `announcementRouter` · `scheduleRouter` · `attendanceRouter` ·
  `qrCodeRouter` · `submissionRouter` · `configRouter`.
- ➡️ **Provision teams out-of-band**, the same way §7 handles the equivalent gap for
  elevated roles: "provisioned by an existing admin process (for example, a seed script
  or an internal admin panel)."

So this phase ships a model, a service, and a script — no HTTP surface.

### The cost, stated plainly

**Teams cannot be created or joined from Postman.** To test phase 5's submission routes,
Abdullah has to run a CLI script to put a hacker on a team first. In the collection as
shipped that is five commands, run part-way through **folder 16** (not 13 — the folder
numbers follow `manual-qa.md`'s sections): they are in the folder's description, and row
16.0.11 fails with a message naming them if they were skipped. It is a real ergonomic cost
and it is the direct consequence of following §5's router list.

If that turns out to be unacceptable in practice, the fix is small and additive: a
`teamRouter` with `POST /api/teams` and `POST /api/teams/:id/members`, roughly 40 lines
on top of the service written here, since **all the logic lives in the service, not in
the script**. It is deliberately built that way. Raising it with Youssef is listed as an
open question below rather than decided unilaterally.

---

## Model — `backend/src/models/Team.js`

| Field | Type | Rules |
| --- | --- | --- |
| `name` | String | required, trimmed, **unique** (case-insensitive collation) |
| `memberIds` | [ObjectId ref `User`] | default `[]`; max 4 (see below) |
| `createdBy` | ObjectId ref `User` | optional — null for script-created teams |
| `createdAt` / `updatedAt` | Date | `timestamps: true` |

**Membership is stored on the Team as `memberIds`, and mirrored onto `User.teamId`.**
`User.teamId` already exists (§1.2.1: "nullable until the hacker joins/creates a team")
and the Profile page reads the user, not the team — so both directions are needed. The
duplication is the reason every write goes through one service (below) instead of being
open-coded.

**Max team size 4.** The design doc never states one. Ignition Hacks' published rule is
teams of up to 4, so 4 is the default — it lives in one exported constant
(`MAX_TEAM_SIZE`) so changing it is a one-line edit. Flagged as an open question.

**Indexes:** unique on `name`; `memberIds` indexed for the "which team is this user on"
lookup.

---

## Service — `backend/src/services/teamService.js`

This is where the real work goes, so that a future `teamRouter` (or an admin panel, or
a different script) reuses it rather than re-implementing the invariants.

| Function | Guarantees |
| --- | --- |
| `createTeam({ name, createdBy })` | unique name → else 409 `CONFLICT` |
| `addMember(teamId, userId)` | user exists; **user is not already on another team** → 409; team not full → 409; idempotent if already a member; sets `User.teamId` |
| `removeMember(teamId, userId)` | clears `User.teamId`; no-op if not a member |
| `getTeamForUser(userId)` | resolves via `User.teamId`, returns `null` if unassigned |

**A user belongs to at most one team.** The doc's data model (a single `User.teamId`,
not an array) says so implicitly; the service enforces it explicitly, because the
alternative — a user on two teams — makes "the team's submission" ambiguous and would
surface as a confusing bug in phase 5 rather than an error here.

`memberIds` and `User.teamId` are written in the same operation. There are no
transactions on a standalone `mongodb-memory-server` and none on the free Atlas tier, so
this is not atomic; `addMember` writes the Team first, then the User, and the service
exposes `reconcile()` (used by the script and testable) to repair a drift if a process
dies between the two writes. For a hackathon-scale app that is the honest trade — noted
here rather than papered over.

---

## Script — `backend/src/scripts/manageTeams.js`

The §7 "existing admin process". Deliberately explicit and non-destructive: it only ever
creates and links, it never deletes, and unlike `seed.js` it does **no** `deleteMany`.

```bash
node src/scripts/manageTeams.js create "Team Rocket"
node src/scripts/manageTeams.js add "Team Rocket" bobby@example.com
node src/scripts/manageTeams.js remove "Team Rocket" bobby@example.com
node src/scripts/manageTeams.js list
```

Run from `backend/`. It connects with `MONGO_URI` (**not** `MONGODB_URI`) and prints
what it did. It writes only to `ignition-dashboard-dev`; it has no code path that can
touch `ignition-portal-dev`.

---

## Files

**New:** `models/Team.js`, `services/teamService.js`, `scripts/manageTeams.js`,
`tests/unit/team.test.js`, `tests/unit/teamService.test.js`.
**Modified:** `models/User.js` — `teamId` already exists; add the reverse-lookup index
and confirm `SELF_WRITABLE_FIELDS` still excludes `teamId` (a hacker must not be able to
join a team by PATCHing their own profile). README, manual-qa, CHECKLIST.

`app.js` is **not** modified — nothing is mounted. That absence is the whole point of
the decision above.

---

## TDD plan

No integration tests: there are no routes. All coverage is at the model and service
level, which is where every invariant actually lives.

### `tests/unit/team.test.js` (~8)

`name` required · blank `name` rejected · duplicate `name` → 11000 · duplicate differing
only in case → rejected (collation) · `memberIds` defaults to `[]` · more than
`MAX_TEAM_SIZE` members rejected · timestamps set · `createdBy` optional.

### `tests/unit/teamService.test.js` (~14)

`createTeam` returns a team with no members · a duplicate name throws 409 ·
`addMember` sets `User.teamId` **and** pushes to `memberIds` · adding the same user
twice is idempotent (no duplicate in `memberIds`) · adding a user already on **another**
team throws 409 · adding to a full team throws 409 · adding a non-existent user throws
404 · `removeMember` clears `User.teamId` and splices `memberIds` · removing a
non-member is a no-op · `getTeamForUser` returns the team · returns `null` for a user
with no team · a hacker cannot set `teamId` via `PATCH /api/users/me` (guards the
whitelist) · `reconcile()` repairs a `User.teamId` that points at a team not listing them ·
`reconcile()` repairs a `memberIds` entry whose user has a null `teamId`.

---

## Acceptance criteria

- [x] `cd tests && npm test` → **`pass 289` / `fail 0`** (256 + 33)
- [x] No new route is mounted — `grep -rn "team" backend/src/app.js` finds nothing
- [x] A user can never be on two teams (proven by test — TS.5)
- [x] `PATCH /api/users/me { teamId }` still cannot change team membership
- [x] `manageTeams.js` runs end-to-end against a local/in-memory DB
- [x] README documents Team as script-provisioned with **no HTTP routes**, and says why
- [x] `manual-qa.md` gains the "provision a team before testing submissions" step
- [x] CHECKLIST phase 8 added and ticked

### Landed 2026-08-12

`pass 289` / `fail 0`, up from 256: 11 in `unit/team.test.js`, 21 in
`unit/teamService.test.js`, 1 added to `integration/users.test.js`. The test plan above
estimated ~22; the extra 11 are edge cases that turned up while writing them (an unknown
*team* is a 404 as well as an unknown user; removing one member must leave the others
alone; a healthy database must come out of `reconcile()` completely untouched).

Four things were decided while implementing that the plan left open:

1. **The "hacker cannot set `teamId` via `PATCH /api/users/me`" test lives in
   `integration/users.test.js`, not `unit/teamService.test.js`.** The plan listed it under
   the service's unit tests, but it exercises an HTTP route and a controller whitelist —
   nothing in `teamService` is involved. It is the same assertion either way; it is just
   filed where a reader would look for it.

2. **The unique name index is declared explicitly rather than as `unique: true` on the
   field.** A field-level `unique` builds a second, case-sensitive index and the collation
   has nowhere to attach; declaring `teamSchema.index({ name: 1 }, { unique: true,
   collation: … })` gives exactly one index that enforces the rule the doc means.

3. **`reconcile()` treats `Team.memberIds` as the source of truth** and returns
   `{ usersLinked, usersCleared, membersDropped }` rather than nothing. A repair tool that
   reports zero work is how you tell a healthy database from a broken one, and the script
   prints the counts.

4. **`manageTeams.js` gained a fifth command, `reconcile`,** which the plan implied
   (`reconcile()` is "used by the script") without listing. It also inherited
   `cleanQaData.js`'s two refusal guards — a portal URI and a non-dashboard database name
   are both rejected, the portal one before any connection is opened.

The three open questions below stand unchanged; 8.Q1 (should there be a `teamRouter`
after all?) is the one worth Youssef's answer before phase 5's Postman folder is written,
since it is the folder that pays the cost.

---

## Open questions for Youssef

1. **Should a `teamRouter` be added after all?** §5's list says no; testability says it
   would help. Additive if the answer changes — the service already holds the logic.
2. **Is max team size 4?** Assumed from the public rules; the doc is silent. One constant.
3. **Can a hacker create/join their own team?** Every real hackathon says yes, but that
   is a *product* decision the doc does not make, and it needs a router (see 1).
