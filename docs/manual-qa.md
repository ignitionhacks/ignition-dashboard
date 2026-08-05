# Manual QA — Hacker Dashboard Backend

Hand-testing script for things the automated suite can't prove. Tick the **Passed**
column as you go; leave it blank until you've actually seen the result.

The automated suite (`cd tests && npm test`, 161 tests) already covers all the API logic
against an in-memory database. **What it cannot cover is everything involving the real
Atlas cluster, the real server process, and Postman** — that's what sections 1, 6 and 7
are for.

> **Sections 9 (QR Code) and 10 (Attendance) are new and unrun.** They're numbered after
> §8 rather than slotted in next to the schedule sections so that every existing number in
> this file, in [CHECKLIST.md](CHECKLIST.md) and in the Postman collection still points at
> the same row it did before.

**Tools:** Postman (or curl). Base URL `http://localhost:4000`.

> ## Run log — 2026-07-27, Abdullah
>
> Sections **1 (except 1.6), 2, 3, 4, 5, 7.1, 7.2 and 7.4** passed against the live Atlas
> cluster via the Postman collection below. Totals per folder: 2✅, 3 → 10/10, 4 → all
> green, 5 → 24/24, 6 → 20/20, 7 → 5/5, cleanup → four `204`s, and
> `GET /api/schedule` afterwards returned `count: 0`, so no QA data was left in the
> shared database.
>
> Still open: **1.6**, **§6** (deliberately never run), **7.3**, **7.5**, **7.6**, **§8**.
>
> One defect found — see [CHECKLIST.md](CHECKLIST.md) item **2.6.F1** (`User.status` is
> never written by any code path).

### Shortcut: import the ready-made collection

Every request below is pre-built in
[`postman/ignition-dashboard.postman_collection.json`](postman/ignition-dashboard.postman_collection.json)
— 104 requests across 11 folders. Postman → **Import** → drag the file in.
**If you imported an earlier copy, delete that collection first and re-import** — folders
9, 10 and 11 are new, and so are eleven collection variables.

Tokens and ids are captured into collection variables automatically, so you never
copy-paste a token. **Run the folders in numbered order** — folder 5 creates the events
that folder 6 reads, and folder 4 has a manual pause where you promote a user to `admin`
in Atlas.

The collection asserts status codes for you, but it does **not** replace looking at the
responses. Rows 2.2, 4.3, 4.4 and 8.1–8.3 need your eyes on the actual body.

Folder 8 deletes the QA events again — `ignition-dashboard-dev` is shared, so run it. It
does **not** clean up `qrcodes` and `attendance`; there's no delete route for either, so
those come out by hand in Atlas.

**Folders 9, 10 and 11 work differently from 1–8, on purpose.**

Folders 1–8 are single-use. `2.1`, `4a` and `4b` assert `201` on registration, so once
those accounts exist they come back `409` and the folder goes red — and because `4a`
captures the admin id, everything downstream loses its tokens.

Folder **9 is self-contained and re-runnable**: it registers-or-reuses all five QA
accounts, promotes the organizer and mentor, and creates its own events. Nothing in 9, 10
or 11 asserts "this must not exist yet". So the whole QR/Attendance pass is:

1. Run folder **9** — QR code, scanning, permissions (and all the setup)
2. Run folder **10** — checklist, headcount, manual check-in
3. Run folder **11** — deletes the three events it created

**Order matters inside folder 10**: `10.10` proves the second Food event has nobody in it,
and `10.14` then checks someone into that same event. Run the folder top to bottom, not
request by request.

One manual step, once ever: request `9.0.3` registers the admin account, and there's no
HTTP route that creates an admin. If that account is new it comes out a `hacker` and
`9.0.4` fails with a message telling you so — promote it in Atlas → Browse Collections →
`users`, then re-run the folder. If you did this in a previous QA round it just works.

> ⚠️ **Don't write temp files into `backend/` while `npm run dev` is running.** nodemon
> restarts on every change and can lose the port (`EADDRINUSE`), leaving it stuck at
> `app crashed - waiting for file changes`. Postman then shows **"No response"**, which
> means the request never reached a server at all — always check the server terminal
> before suspecting the API.

---

## 1. Setup and startup

Run from `C:\Users\abbar\OneDrive\Desktop\Ignition_Hack\ignition-dashboard\backend`
unless stated otherwise.

| # | Step | Expected result | Passed |
| - | ---- | --------------- | ------ |
| 1.1 | `npm install` | Completes with no errors | ✅ |
| 1.2 | `cd ..\tests` then `npm install` | Completes with no errors | ✅ |
| 1.3 | From `tests`: `npm test` | Ends with `pass 161` and `fail 0` | ✅ *(was 82 when this ran; re-confirm)* |
| 1.4 | Confirm `backend\.env` exists and `JWT_SECRET` is a long hex string, not `REPLACE_ME` | Real value present | ✅ |
| 1.5 | From `backend`: `npm run dev` | Logs `[db] Connected to MongoDB (ignition-dashboard-dev)` then `[server] Schedule API listening on http://localhost:4000` | ✅ |
| 1.6 | Temporarily rename `MONGO_URI` to `MONGODB_URI` in `.env`, run `npm run dev` | Fails fast with `MONGO_URI is not set...` — **then change it back** | |
| 1.7 | `GET http://localhost:4000/health` in Postman | `200` with `{"status":"ok"}` | ✅ |

> ⚠️ 1.5 is the one step nothing else can substitute for — it's the first time the code
> talks to the real cluster. ✅ *Confirmed working 2026-07-27.*
>
> **If it fails with `querySrv ECONNREFUSED`:** that's the known DNS issue, not
> credentials. A firewall/AV rule blocks `node.exe` from direct UDP:53 lookups, so
> `mongodb+srv://` can't resolve. `backend/.env` already uses the non-SRV connection
> string to work around it — see
> [environment-variables.md](environment-variables.md#troubleshooting-querysrv-econnrefused).
>
> **If it fails some other way:** check Atlas → **Network Access** has your current IP
> allowlisted, and that the password is percent-encoded if it contains `@ : / ?`.

---

## 2. Registration and login

| # | Request | Expected result | Passed |
| - | ------- | --------------- | ------ |
| 2.1 | `POST /api/auth/register` with firstName, lastName, email, password (8+ chars) | `201`, returns `token` and `user`, `user.role` is `hacker` | ✅ |
| 2.2 | Look at the response body closely | **No `passwordHash` field anywhere** | ✅ |
| 2.3 | Repeat 2.1 with the same email | `409` | ✅ |
| 2.4 | `POST /api/auth/register` with password `abc` | `400` | ✅ |
| 2.5 | `POST /api/auth/login` with the correct password | `200` with a `token` | ✅ |
| 2.6 | `POST /api/auth/login` with a wrong password | `401` | ✅ |
| 2.7 | `POST /api/auth/login` with an email that doesn't exist | `401`, **exact same error message as 2.6** | ✅ |
| 2.8 | Decode the token's payload | Payload shows `sub` and `role` — and **no email or password** | ✅ |

> **2.8 without jwt.io.** A JWT is signed, not encrypted — anyone holding it can read the
> payload with no secret. Decode it locally instead of pasting a live credential into a
> website:
>
> ```bash
> node -e "console.log(JSON.parse(Buffer.from(process.argv[1].split('.')[1],'base64url').toString()))" <TOKEN>
> ```
>
> Confirmed 2026-07-27: payload is `{ sub, role, iat, exp }` only, and `exp - iat` is
> exactly `604800` = 7 days, matching `JWT_EXPIRES_IN=7d`.

---

## 3. Tokens and profile

Set the token under **Authorization → Bearer Token** in Postman.

| # | Request | Expected result | Passed |
| - | ------- | --------------- | ------ |
| 3.1 | `GET /api/users/me` with no Authorization header | `401` | ✅ |
| 3.2 | `GET /api/users/me` with the token but no `Bearer ` prefix | `401` | ✅ |
| 3.3 | `GET /api/users/me` with a valid token | `200`, your profile, `fullName` present, no `passwordHash` | ✅ |
| 3.4 | `PATCH /api/users/me` with `{"firstName":"Bob"}` | `200`, name updated | ✅ |
| 3.5 | `PATCH /api/users/me` with `{"role":"admin"}` | Role stays `hacker` — silently ignored, not an error | ✅ |
| 3.6 | `GET /api/users/<your own id>` as a hacker | `403` | ✅ |

---

## 4. Schedule — reading (any logged-in role)

Needs some events to exist; create them in section 5 first, or use `npm run seed -- --yes`
(**read the warning in section 6 before you do**).

| # | Request | Expected result | Passed |
| - | ------- | --------------- | ------ |
| 4.1 | `GET /api/schedule` with no token | `401` | ✅ |
| 4.2 | `GET /api/schedule` as a hacker | `200`, `{ count, events }` | ✅ |
| 4.3 | Scan the `events` array | Ordered earliest → latest by `startTime` | ✅ |
| 4.4 | Scan the `events` array again | **No blank titles, times or locations** | ✅ |
| 4.5 | `GET /api/schedule?day=2026-08-14` | Only events on that day | ✅ |
| 4.6 | `GET /api/schedule?category=Food` | Only Food events, each with `isFoodEvent: true` | ✅ |
| 4.7 | `GET /api/schedule?day=2026-08-14&category=Main` | Both filters applied together | ✅ |
| 4.8 | `GET /api/schedule?day=Aug-14` | `400` | ✅ |
| 4.9 | `GET /api/schedule/upcoming?limit=3` | At most 3 events, none in the past | ✅ |
| 4.10 | `GET /api/schedule/<valid id>` | `200`, the single event object (not wrapped in `events`) | ✅ |
| 4.11 | `GET /api/schedule/not-an-id` | `400` | ✅ |
| 4.12 | `GET /api/schedule/64b7f0000000000000000000` | `404` | ✅ |

> **4.11 vs 4.12 are different failures.** `400` means the string could never be a MongoDB
> ObjectId. `404` means it is a valid id but no such event exists. The frontend needs to
> tell those apart.

---

## 5. Schedule — writing (organizer / admin only)

You need an organizer token. There is **no HTTP route that creates an organizer** — see
section 7.1 for how to get the first one.

| # | Request | Expected result | Passed |
| - | ------- | --------------- | ------ |
| 5.1 | `POST /api/schedule` as a **hacker** | `403` | ✅ |
| 5.2 | `POST /api/schedule` as an organizer with title/startTime/location/category | `201`, returns the created event | ✅ |
| 5.3 | Check the created event | `day` matches the date part of `startTime`; `isFoodEvent` matches whether category is `Food` | ✅ |
| 5.4 | `POST` with `"title": "   "` | `400` | ✅ |
| 5.5 | `POST` with `"category": "Networking"` | `400` | ✅ |
| 5.6 | `POST` with `endTime` earlier than `startTime` | `400` | ✅ |
| 5.7 | `POST` with a title padded with spaces | Saved trimmed | ✅ |
| 5.8 | `PATCH /api/schedule/:id` as an organizer changing `location` | `200`, updated | ✅ |
| 5.9 | `PATCH` changing `startTime` to a different date (send a matching `endTime`) | `200`, and `day` changes to match | ✅ |
| 5.10 | `PATCH` changing only `startTime` to after the existing `endTime` | `400` — validators re-run on update | ✅ |
| 5.11 | `PATCH` sending `"day":"1999-01-01"` | Ignored; `day` still derived from `startTime` | ✅ |
| 5.12 | `PATCH /api/schedule/:id` as a hacker | `403` | ✅ |
| 5.13 | `DELETE /api/schedule/:id` as a hacker | `403` | ✅ |
| 5.14 | `DELETE /api/schedule/:id` as an organizer | `204`, empty body | ✅ |
| 5.15 | `GET` that same id again | `404` | ✅ |

---

## 6. Destructive operations — read before running

| # | Step | Expected result | Passed |
| - | ---- | --------------- | ------ |
| 6.1 | From `backend`: `npm run seed` (no flag) | **Refuses to run** and prints how to opt in | |
| 6.2 | Read the `--yes` warning and confirm you're pointed at the right database | You understand this wipes the shared collection | |
| 6.3 | `npm run seed -- --yes` | Prints `[seed] Target database: ignition-dashboard-dev`, then inserts sample events | |
| 6.4 | `GET /api/schedule` | The seeded events appear, time-sorted | |

> ⚠️ **`npm run seed -- --yes` runs `deleteMany({})` on the schedule collection, and
> `ignition-dashboard-dev` is shared with Youssef and Jeremy.** It deletes their events
> too. Post in the dev channel before running it, or don't run it at all — you can create
> events through `POST /api/schedule` instead.
>
> *Deliberately never run. Section 5 creates events additively instead, which is safe on a
> shared database.*

---

## 7. Only verifiable by hand

Things with no automated coverage at all.

| # | Step | Expected result | Passed |
| - | ---- | --------------- | ------ |
| 7.1 | Promote your first organizer: in Atlas → Browse Collections → `users`, edit your own document and set `role` to `admin`. Then use `PATCH /api/users/:id/role` for everyone else. | You have a working admin token | ✅ |
| 7.2 | With the server running, change a user's role via `PATCH /api/users/:id/role`, then immediately reuse that user's **existing** token on a write route | The new role applies right away — no re-login needed | ✅ |
| 7.3 | Stop the server mid-request (Ctrl+C) and restart | Restarts cleanly, no orphaned connection warnings in Atlas | |
| 7.4 | In Atlas → Browse Collections, look at the collection names | `scheduleevents` and `users`. ✅ *Confirmed 2026-07-27 — `ignition-dashboard-dev` holds exactly those two.* | ✅ |
| 7.5 | Set `JWT_EXPIRES_IN=10s` in `.env`, restart, log in, wait 15s, call `GET /api/users/me` | `401` — **then set it back to `7d`** | |
| 7.6 | Hand Jeremy the base URL and a test account | He can log in and list the schedule from the frontend | |

> **7.1 note.** Atlas shows **four** databases on this cluster: `ignition-dashboard-dev`
> (ours, 2 collections), `ignition-portal-dev` (**read only**), `ignition-portal`
> (**production — out of bounds entirely**), and `test`. Edit documents only in
> `ignition-dashboard-dev`.
>
> **7.5 is half-confirmed.** The expiry *value* is proven correct — a decoded token has
> `exp - iat == 604800` (7 days). What's untested is that the server actually rejects an
> expired token.

---

## 8. Cross-checks against the design doc

| # | Check | Expected result | Passed |
| - | ----- | --------------- | ------ |
| 8.1 | Compare the Schedule Event fields in §2.2.1 to the schema table in [README.md](README.md) | Every documented field exists with the right type | |
| 8.2 | Compare the routes table in §2.2.1 to the endpoint table in [README.md](README.md) | Every documented route exists and behaves as described | |
| 8.3 | Confirm the four categories | `Main`, `Fun`, `Food`, `Workshop` — no more, no fewer | |
| 8.4 | Read what §1.2.1 says `status` is for — display label, check-in state, or application state? | Answers the blocking question on CHECKLIST item 2.6.F1 | |
| 8.5 | Compare the QR Code fields in §3.2.1 and the Attendance fields in §3.2.2 to the schema tables in [README.md](README.md) | Every documented field exists with the right type | |
| 8.6 | Compare the six routes in §3.2.1/§3.2.2 to the endpoint tables in [README.md](README.md) | Every documented route exists and behaves as described | |

---

## 9. QR Code (§3.2.1)

**Postman folder 9 does all of this for you, including the setup** — you don't need to
have run sections 4 or 5 first. Rows `9.0.1`–`9.0.15` create the five QA accounts and
three events. The table below is the by-hand version if you'd rather click through it.

Every route needs `Authorization: Bearer <token>`.

| # | Step | Expected result | Passed |
| - | ---- | --------------- | ------ |
| 9.1 | `GET /api/qrcode/me` as a hacker, first ever call | `200`, a `code` that looks like a UUID, `userId` = your own id | ✅ |
| 9.2 | Call it **again** with the same token | `200`, the **exact same `code`** — not a new one | ✅ |
| 9.3 | In Atlas → Browse Collections, look at `qrcodes` | Exactly **one** document for that user, matching what 9.1 returned | ✅ |
| 9.4 | `GET /api/qrcode/me` with no `Authorization` header | `401` | ✅ |
| 9.5 | `GET /api/qrcode/me` as the **organizer** | `200`, an organizer gets a code too — it's per-user, not per-role | ✅ |
| 9.6 | `POST /api/qrcode/scan` as an organizer, body `{ "code": "<from 9.1>", "scheduleEventId": "<food event>" }` | **`201`**, `alreadyCheckedIn: false`, `attendance.checkedIn: true`, `checkedInAt` set | ✅ |
| 9.7 | **Send the exact same request again** | **`200`**, `alreadyCheckedIn: true`, and `checkedInAt` is **unchanged from 9.6** | ✅ |
| 9.8 | Check `attendance` in Atlas | Still exactly **one** record for that user + event pair | ✅ |
| 9.9 | `POST /api/qrcode/scan` with `"code": "not-a-real-code"` | `404`, `{ "error": ... }` — an unknown badge, not a server error | ✅ |
| 9.10 | `POST /api/qrcode/scan` with the `code` key missing entirely | `400` | ✅ |
| 9.11 | `POST /api/qrcode/scan` with a valid code but `"scheduleEventId": "abc"` | `400` — malformed id | ✅ |
| 9.12 | `POST /api/qrcode/scan` with a valid code and a well-formed but non-existent event id | `404` | ✅ |
| 9.13 | `POST /api/qrcode/scan` as a **hacker** | `403` — hackers can't check themselves in | ✅ |
| 9.14 | `POST /api/qrcode/scan` as a **mentor** | `201`/`200` — mentors run food tables, so they can scan | ✅ |
| 9.15 | `GET /api/qrcode/<code>/user` as an organizer | `200`, the owning user, and **no `passwordHash` anywhere in the body** | ✅ |
| 9.16 | `GET /api/qrcode/<code>/user` as a **hacker** | `403` | ✅ |
| 9.17 | `GET /api/qrcode/not-a-real-code/user` as an organizer | `404` | ✅ |

> **Passed column filled 2026-08-05**, from Postman folder 9 — **44 assertions, 44 green**,
> run against a freshly emptied `attendances` / `qrcodes` / `scheduleevents`.
> Rows **9.3** and **9.8** are the two that aren't HTTP calls; they were confirmed by
> counting documents directly (see the note under section 10).

> **9.7 is the one that matters.** A hacker being scanned twice in a food queue is normal,
> not an error — the second scan must return `200` with `alreadyCheckedIn: true` and must
> **not** move `checkedInAt`. Compare the two timestamps by eye; that's the whole test.

> **9.14 vs 9.16 is a known asymmetry**, not a bug in the implementation: the design doc
> gives scanning to organizer+mentor but the code lookup to organizer+admin. So a mentor
> whose scan fails can't use the manual lookup. Flagged for the team lead — see the
> Youssef list in the TEMP phase doc.

---

## 10. Attendance (§3.2.2)

**Needs first:** folder 9, which leaves behind the tokens, the two Food events, the
Workshop, and one check-in. Nothing else to set up.

| # | Step | Expected result | Passed |
| - | ---- | --------------- | ------ |
| 10.1 | `GET /api/attendance/me` as a **brand-new hacker** who has never been scanned | `200`, `count` = the number of Food events, **every row `checkedIn: false`** — not an empty list, not a `404` | ✅ |
| 10.2 | `GET /api/attendance/me` as the hacker from 9.6 | The event they were scanned into is `checkedIn: true` with a `checkedInAt`; every other row is still `false` | ✅ |
| 10.3 | Look at the row shape | Each carries `title`, `startTime`, `endTime`, `day`, `location`, `category` — the frontend needs no second call | ✅ |
| 10.4 | Confirm the `Workshop` event does **not** appear | Food events only | ✅ |
| 10.5 | Check the order of the rows | Ascending by `startTime`, regardless of the order the events were created | ✅ |
| 10.6 | In Atlas, count the `attendance` documents, then call `GET /api/attendance/me` a few times and count again | **The count does not change** — the checklist is computed on read, it never creates rows | ✅ |
| 10.7 | `GET /api/attendance/event/<food event id>` as an organizer | `200`, the scanned hacker is listed with a nested `user` object showing their name and email | ✅ |
| 10.8 | Same call as an **admin** | `200` | ✅ |
| 10.9 | Same call as a **hacker** | `403` | ✅ |
| 10.10 | `GET /api/attendance/event/<second food event id>` — nobody attended it | `200` with `count: 0` and an empty array, **not a `404`** | ✅ |
| 10.11 | `GET /api/attendance/event/abc` | `400` | ✅ |
| 10.12 | `GET /api/attendance/event/<well-formed but non-existent id>` | `404` | ✅ |
| 10.13 | Scan the body of 10.7 for `passwordHash` | Not present | ✅ |
| 10.14 | `POST /api/attendance` as an organizer, body `{ "userId": "<hacker id>", "scheduleEventId": "<second food event>" }` | `201`, `alreadyCheckedIn: false` | ✅ |
| 10.15 | Check `checkedInBy` on that record | It's the **organizer's** id, taken from the token — not anything you sent | ✅ |
| 10.16 | `GET /api/attendance/me` as that hacker again | The second event is now ticked too | ✅ |
| 10.17 | Repeat 10.14 exactly | `200`, `alreadyCheckedIn: true` | ✅ |
| 10.18 | Now `POST /api/qrcode/scan` that same hacker into that same event | `200`, `alreadyCheckedIn: true` — the manual route and the scan share one record | ✅ |
| 10.19 | `POST /api/attendance` as a **hacker** | `403`, and **no new document appears in `attendance`** | ✅ |
| 10.20 | `POST /api/attendance` as a **mentor** | `201`/`200` | ✅ |
| 10.21 | `POST /api/attendance` with `userId` missing | `400` | ✅ |
| 10.22 | `POST /api/attendance` with a well-formed but non-existent `userId` | `404` | ✅ |
| 10.23 | `POST /api/attendance` as an **admin** | ⚠️ **`403` today.** See the note below — confirm this is what you see, then raise it | ✅ `403` as documented |

> **Passed column filled 2026-08-05**, from Postman folder 10 — **43 assertions, 43 green**.
> Folder 11 cleaned up afterwards, 5 green.

> **Rows 9.3, 9.8 and 10.6 — the document counts.** These three aren't HTTP calls, so they
> were checked by counting the collections straight after the run, with every QA collection
> emptied beforehand:
>
> | Collection | After folders 9 + 10 + 11 |
> | ---------- | ------------------------- |
> | `qrcodes` | **2** |
> | `attendances` | **2** |
>
> `qrcodes` = 2 is row **9.3**: the hacker and the organizer, one document each, even though
> `GET /api/qrcode/me` was called four times across the run. The code is created lazily on
> the first call and reused after.
>
> `attendances` = 2 is rows **9.8** and **10.6**: the hacker's two check-ins, one per Food
> event. Nine requests hit a check-in or checklist route (`9.6`, `9.7`, `9.14`, `10.14`,
> `10.17`, `10.18`, `10.20`, plus the `GET /attendance/me` reads) and only two documents
> exist — repeat scans update nothing and reads create nothing.
>
> Note the collection is `attendances`, plural — Mongoose pluralizes the model name. The
> tables above say "attendance" in prose; the collection in Atlas has the `s`.

> **10.1 is the "user with no attendance yet" case** from the task list. The wrong
> behaviour to watch for is an empty array or a 404 — a new hacker must see the full menu
> with nothing ticked, or the Profile page has nothing to render.

> **10.23 is the admin gap.** §3.2.1/§3.2.2 grant both write routes to *"Organizer,
> Mentor"* only, so an admin can read the headcount but cannot fix it, and cannot scan
> either. Built to the doc as written. If the team lead confirms it's a spec slip it's a
> one-word change per route. **Record the `403` here rather than treating it as a
> failure** — it's the documented behaviour until someone decides otherwise.

### Cleanup — `ignition-dashboard-dev` is shared

**Run Postman folder 11.** It deletes the three events folders 9 and 10 created and then
lists the schedule so you can see nothing starting with `QA -` is left.

It does **not** clean up `qrcodes` and `attendance` — there's **no DELETE route for
either**, by design. Remove those documents by hand in Atlas → Browse Collections, or
leave them and tell the team; just don't leave junk without saying so.

Note that deleting an event does **not** cascade to its attendance records; those become
orphans pointing at a missing event. Worth mentioning to the team lead if events will ever
be deleted for real.

---

## Known limitations (not bugs — don't file these)

- **Times are UTC.** `day` is derived from `startTime` in UTC. An event at 8pm EDT on
  Aug 14 is `2026-08-15` UTC and will group under the next day. If the schedule should
  group by Toronto local time, that's a real change — `toDayString` in
  `backend/src/models/ScheduleEvent.js` is the only place to make it.
- **Logout doesn't invalidate the token.** JWTs are stateless and there's no denylist;
  the client just discards it. A leaked token works until it expires.
- **`register` only creates hackers.** By design — see 7.1 for the bootstrap.
  *Superseded by Phase 2.6: the route is being removed entirely once auth reads users
  from the portal database.*
- **There's no way to un-check-in someone.** No `DELETE` on attendance and no route that
  sets `checkedIn` back to `false`. §3.2.2 doesn't ask for one. If an organizer scans the
  wrong badge the record has to be removed in Atlas by hand.
- **Deleting an event doesn't delete its attendance records.** They're left pointing at an
  event id that no longer exists. Harmless for a weekend hackathon, but it means event
  ids should be treated as permanent once anyone has been scanned.
- **The checklist is Food-only.** §3.2.2 describes it as the meal checklist, so workshops
  are excluded. If the team wants workshop attendance on the Profile page that's a
  one-line filter change — pending a decision.

## Actual bugs found by this script

- **`User.status` is never written.** See [CHECKLIST.md](CHECKLIST.md) item **2.6.F1**.
  Found 2026-07-27 during section 4 — an account with `role: "admin"` still reported
  `status: "Hacker"`. The field has one default and no code path that ever changes it.
