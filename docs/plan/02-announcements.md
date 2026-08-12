# Phase 2 — Announcements

> **Spec:** design doc §1.2.2 (Entity: Announcement), §4 ("Announcements are created by
> Organizers"), §5 (`announcementRouter` mounted at `/api/announcements`).
> **Closes:** CHECKLIST phase 3.
> **Depends on:** phase 1 (envelope), `User` (built).

---

## Goal

Back the Home dashboard's announcements feed: organizers post, everyone reads, pinned
items stay on top.

---

## Model — `backend/src/models/Announcement.js`

Fields are §1.2.2 verbatim.

| Field | Type | Rules |
| --- | --- | --- |
| `_id` | ObjectId | auto |
| `title` | String | **optional** per the doc; trimmed; `maxlength` 200 |
| `body` | String | **required**, trimmed, non-empty (§5 names this as a validation example) |
| `authorId` | ObjectId ref `User` | required; set from `req.user._id`, never from the body |
| `authorName` | String | required; **denormalized** — see below |
| `postedAt` | Date | defaults to now; sort key |
| `pinned` | Boolean | optional, default `false` |
| `createdAt` / `updatedAt` | Date | `timestamps: true` |

**Why `authorName` is denormalized.** §1.2.2 lists it as stored, and it is right: the
feed renders "posted by …" on every row, and phase 2.6 will move users to a *separate
mongoose connection* (the read-only portal DB). A `.populate()` cannot cross two
connections — the same constraint that produced the `findUserById` seam in
`attendanceController`. Storing the name keeps the feed a single-collection query
either way. It is a snapshot: if a user later changes their name, old announcements
keep the name that was current when they posted. That is normal for a feed and is
noted in the README.

**Index:** `{ pinned: -1, postedAt: -1 }` — matches the list sort exactly.

---

## Routes — `/api/announcements`

| Method | Route | Access | Behaviour |
| --- | --- | --- | --- |
| GET | `/api/announcements` | all authenticated | list, pinned first then newest, paginated |
| POST | `/api/announcements` | organizer, admin | create → 201 |
| PATCH | `/api/announcements/:id` | organizer, admin | partial update |
| DELETE | `/api/announcements/:id` | organizer, admin | 200 + `{ deleted: true, id }` |

Access is enforced with the existing `requireAuth` + `requireRole('organizer','admin')` —
§4's "enforced at the authorization layer, not just by convention, so a hacker account
can never successfully create one even if they call the route directly."

### Sorting

`sort({ pinned: -1, postedAt: -1 })`. §1.2.2: newest first, with pinned lifted to the
top **regardless of their timestamp**. A pinned item from yesterday outranks an unpinned
one from a minute ago.

### Pagination

`?limit=10&page=1`, per §1.2.2. `limit` clamped to 1–50 (default 10), `page` ≥ 1
(default 1). Anything non-numeric or out of range is clamped rather than rejected —
consistent with how `GET /api/schedule/upcoming?limit=` already behaves.

Response `data`:

```jsonc
{ "count": 3, "announcements": [ … ], "page": 1, "limit": 10, "total": 23 }
```

`count` is the length of this page (matching the existing `{ count, items }`
convention); `total` is the collection-wide count, which is what a pager needs.

### Writable fields

`pickWritable` whitelist — create: `title`, `body`, `pinned`, `postedAt`; update:
`title`, `body`, `pinned`. `authorId`/`authorName` are **never** client-writable.

### Not implemented, on purpose

§1.2.2 explicitly says there is **no read/unread state** per user. No `readBy`, no
seen-markers. Recorded here so it isn't "added back" later as a perceived gap.

---

## Files

**New:** `models/Announcement.js`, `controllers/announcementController.js`,
`routes/announcementRoutes.js`, `tests/unit/announcement.test.js`,
`tests/integration/announcements.test.js`.
**Modified:** `app.js` (mount `/api/announcements`), `docs/README.md`,
`docs/manual-qa.md`, `docs/CHECKLIST.md`.

---

## TDD plan

### `tests/unit/announcement.test.js` (~12)

| # | Test |
| --- | --- |
| A.1 | a valid announcement saves with all fields |
| A.2 | `body` is required — blank string rejected |
| A.3 | `body` of only whitespace is rejected (trim then validate) |
| A.4 | `title` is optional — saves without one |
| A.5 | `title` over 200 chars rejected |
| A.6 | `authorId` is required |
| A.7 | `authorName` is required |
| A.8 | `postedAt` defaults to ~now when omitted |
| A.9 | `pinned` defaults to `false` |
| A.10 | `createdAt`/`updatedAt` are set by `timestamps` |
| A.11 | `updatedAt` moves on save, `createdAt` does not |
| A.12 | validators re-run on update (`runValidators`) — blank `body` on update rejected |

### `tests/integration/announcements.test.js` (~20)

| # | Test |
| --- | --- |
| I.1 | GET without a token → 401 |
| I.2 | a hacker **can** read the feed → 200 |
| I.3 | a hacker POST → 403 `FORBIDDEN` |
| I.4 | a hacker PATCH → 403 |
| I.5 | a hacker DELETE → 403 |
| I.6 | an organizer POST → 201, envelope, resource in `data` |
| I.7 | an admin POST → 201 |
| I.8 | `authorId`/`authorName` come from the token, not the body — a spoofed `authorId` is ignored |
| I.9 | POST with no `body` → 400 `VALIDATION_ERROR` with `details` |
| I.10 | POST with only a `body` (no title) → 201 |
| I.11 | list is sorted newest-first |
| I.12 | a pinned older item sorts above an unpinned newer one |
| I.13 | two pinned items sort newest-first among themselves |
| I.14 | `?limit=2` returns 2 with `total` = full count |
| I.15 | `?page=2` returns the next slice and does not overlap page 1 |
| I.16 | `?limit=999` clamps to 50; `?limit=abc` falls back to the default |
| I.17 | PATCH updates `body` and bumps `updatedAt` |
| I.18 | PATCH `{ pinned: true }` moves the item to the top of the feed |
| I.19 | PATCH a non-existent id → 404 `NOT_FOUND`; malformed id → 400 |
| I.20 | DELETE → 200 `{ deleted: true }`, and it is gone from the feed |

Written first, all failing, then the model → controller → route.

---

## Acceptance criteria

- [x] `cd tests && npm test` → **`pass 214` / `fail 0`** (175 + 39 — the phase-1 count
      landed at 175 rather than the estimated 173, and the suite grew by 39 rather than
      the estimated 32; no test was dropped)
- [x] Every response uses the phase-1 envelope
- [x] A hacker cannot create, update or delete — verified by direct route calls (I.3–I.5)
- [x] Pinned-above-newest is proven by a test, not just by the sort argument (I.12)
- [x] `docs/README.md` endpoint table + schema table updated
- [x] `docs/manual-qa.md` gains an Announcements section (§13, rows 13.1–13.21)
- [x] CHECKLIST phase 3 ticked

**Landed 2026-08-12.** One deviation from this plan: the two planned `GET
/api/announcements/:id` tests were dropped before implementation — §1.2.2 lists no such
route, so building one would have been scope creep. I.8b reads the item back through the
feed instead, and I.20c covers DELETE's 404/400 in place of the dropped I.20b.

---

## Open questions (non-blocking — sensible default chosen, flagged for Youssef)

1. **Can an organizer edit or delete *another* organizer's announcement?** The doc
   restricts by role only, never by ownership. **Default: yes**, any organizer/admin can
   edit any announcement — that matches the doc literally, and a hackathon ops team
   wants to be able to fix a colleague's typo at 3am. If ownership matters, it is a
   two-line change in the controller.
2. **Does deleting a user cascade to their announcements?** Same open cascade question
   as finding 6.F4. **Default: no cascade** — announcements survive, `authorName` still
   renders. Consistent with the denormalization choice above.
