# Manual QA — Hacker Dashboard Backend

Hand-testing script for things the automated suite can't prove. Tick the **Passed**
column as you go; leave it blank until you've actually seen the result.

The automated suite (`cd tests && npm test`, 335 tests) already covers all the API logic
against an in-memory database. **What it cannot cover is everything involving the real
Atlas cluster, the real server process, and Postman** — that's what sections 1, 6 and 7
are for.

> **Sections 9 (QR Code) and 10 (Attendance) are new and unrun.** They're numbered after
> §8 rather than slotted in next to the schedule sections so that every existing number in
> this file, in [CHECKLIST.md](CHECKLIST.md) and in the Postman collection still points at
> the same row it did before.

**Tools:** Postman (or curl). Base URL `http://localhost:4000`.

> ## ⚠️ Every response shape changed — 2026-08-12
>
> The API now wraps **every** `/api` response in the §5 envelope:
> `{ "success": true, "data": { ... } }` or
> `{ "success": false, "error": { "code", "message" } }`.
>
> **What that means for this script:** wherever a row below says a response contains
> `token`, `count`, `events`, `checklist`, `role`, … that field is now one level deeper,
> under **`data`**. `{ count, events }` is now `data.count` / `data.events`; `token` is
> now `data.token`. Error rows that used to show `{ "error": "..." }` now show
> `{ "error": { "code": "...", "message": "..." } }`.
>
> The **✅ marks below are from the pre-envelope run** and still stand for status codes
> and behaviour — but the body shapes were re-verified by the automated suite, not by
> hand. Re-run §12 (new) to confirm the contract itself.
>
> Two behaviour changes, not just re-shaping:
> - **`DELETE /api/schedule/:id` now returns `200` with a body, not `204` empty** (row
>   5.14, re-blanked below).
> - **`GET /health` is deliberately exempt** and still returns a bare `{ "status": "ok" }`.

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
— **216 requests across 16 folders**. Postman → **Import** → drag the file in.
**If you imported an earlier copy, delete that collection first and re-import** — the whole
collection was rewritten for the response envelope on 2026-08-12, folders 12, 13, 14, 16
and 17 are new, and so are 33 collection variables.

**Folder numbers match the section numbers in this file**, so you can run the two side by
side. There is no folder 15, because §15 is Teams and teams have no HTTP surface at all.

Tokens and ids are captured into collection variables automatically, so you never
copy-paste a token. **Run the folders in numbered order** — folder 5 creates the events
that folder 6 reads, and folder 4 has a manual pause where you promote a user to `admin`
in Atlas.

The collection asserts status codes for you, but it does **not** replace looking at the
responses. Rows 2.2, 4.3, 4.4 and 8.1–8.3 need your eyes on the actual body.

> **Every request also carries a collection-level envelope check** (Collection → Scripts →
> Post-response): `success` must match the status code, a 4xx/5xx must carry
> `error.code` and `error.message`, and no error body may leak a stack trace. It runs on
> all 216 requests, so an envelope regression fails everywhere at once instead of only
> where someone remembered to assert it. `GET /health` is excluded — see 12.13.

**Cleanup folders — please run them.** `ignition-dashboard-dev` is shared. Folder 8 deletes
the QA events, folder 11 the QR/attendance events, folder 13's last four rows the QA
announcements, and folder 17 sweeps up after 12–16. None of them can clean `qrcodes`,
`attendance`, `submissions` or `teams` — no delete route exists for any of those — so
folder 17 prints the `mongosh` commands for the ones it finds and you finish in Atlas.

> **Folder 16 uses four accounts of its own** (`qa-alpha-1`, `qa-alpha-2`, `qa-noteam`,
> `qa-beta-1`) and its own teams, "QA Team Alpha" and "QA Team Beta" — *not* §15's "QA
> Team". A submission is per **team**, so pointing the folder at a team you also submitted
> for by hand would mean sharing that team's one submission slot, and the folder would stop
> being re-runnable. The folder description maps its accounts onto §16's hacker1/2/3.

> **Folder 14 rewrites the shared hackathon config.** 14.0.4 saves whatever is there and
> 14.16 puts it back. If you stop that folder half way, restore the dates by hand.

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
| 5.14 | `DELETE /api/schedule/:id` as an organizer | `200`, `data.deleted: true`, `data.id` = the id — **not** an empty `204` (changed 2026-08-12) | |
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

## 12. Response envelope and error contract (§5)

New 2026-08-12. Postman folder 12 runs all of this. Nothing here needs a fresh database —
it reuses whatever is already there.

| # | Request | Expected result | Passed |
| - | ------- | --------------- | ------ |
| 12.1 | `GET /api/users/me` with a valid token | `200`, body has `success: true` and a `data` object, and **no** `error` key | |
| 12.2 | `GET /api/schedule` | `200`, `data.count` equals `data.events.length` | |
| 12.3 | `POST /api/schedule` as an organizer | `201`, the new event is in `data`, `data._id` present | |
| 12.4 | `GET /api/schedule/64b7f0000000000000000000` | `404`, `error.code` is `NOT_FOUND`, `error.message` non-empty | |
| 12.5 | `POST /api/schedule` with `"title": "   "` | `400`, `error.code` is `VALIDATION_ERROR`, `error.details` is a non-empty array | |
| 12.6 | `GET /api/schedule/not-an-id` | `400`, `error.code` is `VALIDATION_ERROR` | |
| 12.7 | `GET /api/schedule?day=Aug-14` | `400`, `error.code` is `BAD_REQUEST`, and **no** `details` key | |
| 12.8 | `GET /api/schedule` with no token | `401`, `error.code` is `UNAUTHORIZED` | |
| 12.9 | `POST /api/schedule` as a hacker | `403`, `error.code` is `FORBIDDEN` | |
| 12.10 | `POST /api/auth/register` with an email that already exists | `409`, `error.code` is `CONFLICT` | |
| 12.11 | `GET /api/nope` | `404` in the failure envelope — JSON, not an HTML error page | |
| 12.12 | Look at any error body from 12.4–12.11 | Only `code`, `message` and (on 12.5) `details`. **No stack trace, no `name`** | |
| 12.13 | `GET /health` | `200`, bare `{ "status": "ok" }` — **no** `success` key. This exemption is intentional | |
| 12.14 | `DELETE /api/schedule/<id>` as an organizer | `200` with `data.deleted: true` and `data.id`. Then `GET` that id → `404` | |

> **12.7 vs 12.5 are different on purpose.** `VALIDATION_ERROR` means a field failed a
> schema validator and `details` says which. `BAD_REQUEST` means the request itself was
> malformed before any document was involved. A client can rely on
> "`details` present ⇒ it was field validation".

---

## 13. Announcements (§1.2.2)

New 2026-08-12. Postman folder 13 (added in Phase 6) runs all of this. You need **three**
tokens: a hacker, an organizer and an admin. Sections 2–3 already show how to get them.

Every response here is enveloped — read the values out of `data`, not off the top level.

| # | Request | Expected result | Passed |
| - | ------- | --------------- | ------ |
| 13.1 | `GET /api/announcements` with **no** token | `401`, `error.code` is `UNAUTHORIZED` | |
| 13.2 | `GET /api/announcements` as a **hacker** | `200`. Any role may read the feed | |
| 13.3 | `POST /api/announcements` as a **hacker**, body `{"body":"I am not an organizer."}` | `403`, `error.code` is `FORBIDDEN`. This is §4's "enforced at the authorization layer" | |
| 13.4 | `POST /api/announcements` as an **organizer**, `{"title":"QA - Lunch","body":"Lunch is in the cafeteria."}` | `201`. `data.pinned` is `false`, `data.postedAt` is set. **Save `data._id` as `ANN_ID`** | |
| 13.5 | Look at 13.4's `data.authorName` | It is the **organizer's** full name, not anything you sent | |
| 13.6 | `POST /api/announcements` as an organizer with `{"body":"QA - spoofed","authorId":"<hacker id>","authorName":"Somebody Else"}` | `201`, but `data.authorId` / `data.authorName` are still **yours**. The body cannot set the author | |
| 13.7 | `POST /api/announcements` as an organizer with `{"title":"QA - no body"}` | `400`, `error.code` is `VALIDATION_ERROR`, `error.details` non-empty | |
| 13.8 | `POST /api/announcements` as an organizer with `{"body":"QA - untitled"}` | `201`, `data.title` is `""`. Title is optional (§1.2.2) | |
| 13.9 | `POST /api/announcements` as an **admin** | `201`. Admins post too | |
| 13.10 | `GET /api/announcements` again | Newest first. The most recent thing you posted is `data.announcements[0]` | |
| 13.11 | `PATCH /api/announcements/{{ANN_ID}}` as an organizer, `{"pinned":true}` | `200`, `data.pinned` is `true` | |
| 13.12 | `GET /api/announcements` after 13.11 | `ANN_ID` is now **first**, above the newer ones. Pinned outranks recent | |
| 13.13 | `PATCH /api/announcements/{{ANN_ID}}`, `{"body":"QA - lunch moved to the atrium."}` | `200`, body changed and `data.postedAt` is **unchanged** — an edit must not re-order the feed | |
| 13.14 | `GET /api/announcements?limit=2&page=1`, then `page=2` | Two rows then the rest, **no overlap**. `data.total` is the same on both and counts the whole collection; `data.count` is that page's length | |
| 13.15 | `GET /api/announcements?limit=999`, then `?limit=abc`, then `?page=0` | All `200`. `data.limit` is `50`, then `10`; `data.page` is `1`. Clamped, never rejected | |
| 13.16 | `GET /api/announcements?page=99` | `200` with `data.count: 0` — an empty page, **not** a `404` | |
| 13.17 | `PATCH /api/announcements/{{ANN_ID}}` as a **hacker** | `403` | |
| 13.18 | `DELETE /api/announcements/{{ANN_ID}}` as a **hacker** | `403`, and the announcement is still in the feed | |
| 13.19 | `DELETE /api/announcements/{{ANN_ID}}` as an organizer | `200` with `data.deleted: true` and `data.id`. Re-run `GET` — it's gone | |
| 13.20 | `DELETE /api/announcements/000000000000000000000000` | `404`. And `DELETE /api/announcements/not-an-id` → `400` | |
| 13.21 | **Cleanup:** delete every announcement titled `QA - …` you created above | Feed has no `QA -` rows left. `ignition-dashboard-dev` is shared | |

> **13.5/13.6 are the point of the whole section.** The author is read off the token, so
> nobody can post under someone else's name even by hand-crafting the request.

> **`authorName` is a snapshot.** If you rename that organizer via
> `PATCH /api/users/me` afterwards, the old announcements keep the old name. That's
> deliberate (a feed shows who posted it *then*), not a stale-data bug.

> **There is no `GET /api/announcements/:id`.** §1.2.2 lists no such route — read items
> back through the feed. A request to it returns `404` from the catch-all, which is
> correct, not a missing feature.

---

## 14. Hackathon config + countdown (§1.2.3)

New 2026-08-12. Postman folder 14 (added in Phase 6) runs all of this. You need a
**hacker**, an **organizer** and an **admin** token.

⚠️ **This section writes the shared config.** `ignition-dashboard-dev` is the whole team's
database, and there is only ever **one** config document — if the team has already set
real hackathon dates, **write them down before you start** and restore them in 14.16.

| # | Request | Expected result | Passed |
| - | ------- | --------------- | ------ |
| 14.1 | `GET /api/config/hackathon` with **no** token | `401`, `error.code` is `UNAUTHORIZED` | |
| 14.2 | `GET /api/config/hackathon` **before** anything is configured | `404`, `error.code` is `NOT_FOUND`. Not an empty object, not invented dates. *(Skip if the team already set one — record that instead.)* | |
| 14.3 | `PUT /api/config/hackathon` as a **hacker** | `403`, `error.code` is `FORBIDDEN` | |
| 14.4 | `PUT /api/config/hackathon` as an **organizer** | `403`. This route is **admin-only**, unlike schedule/announcement writes | |
| 14.5 | `PUT` as an **admin** with `{"hackathonStartAt":"<1h ago>","hackathonEndAt":"<2h from now>"}` | `200`, `data` echoes both times. **Save `data._id`** | |
| 14.6 | `GET /api/config/hackathon` as a **hacker** | `200` — every role can read the countdown | |
| 14.7 | Look at `data.countdown` from 14.6 | `hasStarted: true`, `hasEnded: false`, `msRemaining` > 0, `formatted` looks like `01:59:58` | |
| 14.8 | `GET` again ~5 seconds later | `msRemaining` is **smaller**. It's computed per request, never stored | |
| 14.9 | Compare `data.serverTime` to your own clock | Within a second or two. This is what the frontend uses to correct for clock skew | |
| 14.10 | `PUT` again as admin with a **different** `hackathonEndAt` | `200`, and `data._id` is the **same as 14.5** — it updated, it didn't create a second config | |
| 14.11 | `PUT` as admin with `hackathonEndAt` **before** `hackathonStartAt` | `400`, `error.code` is `VALIDATION_ERROR`, `error.details` non-empty | |
| 14.12 | `PUT` as admin sending **only** `hackathonEndAt` | `400`. `PUT` is a full replace — always send both times | |
| 14.13 | `PUT` as admin with a `submissionDeadline`, then `PUT` again **without** it | First response has the deadline, second has `submissionDeadline: null`. Omitting it **clears** it — that's what `PUT` means | |
| 14.14 | `PUT` as admin with both times **in the past** | `200`. Then `GET`: `msRemaining` is exactly `0`, `formatted` is `"00:00:00"`, `hasEnded: true`. It never goes negative | |
| 14.15 | `PUT` as admin with both times **in the future** | `GET` shows `hasStarted: false` and a countdown to the end | |
| 14.16 | **Restore:** `PUT` the team's real dates back (or the ones you noted at the top) | `GET` shows the right dates again | |
| 14.17 | `GET /api/schedule/upcoming?limit=5` | `200`, at most 5 events, soonest first, all with `startTime` in the future. §1.2.3 lists this next to the countdown | |

> **14.7's `formatted` does not wrap at 24 hours.** A 48-hour hackathon shows `47:59:59`,
> not `23:59:59`. If you ever see a value under 24h when more than a day remains, that's a
> real bug.

> **There is no `DELETE` for the config.** Nothing in §1.2.3 asks for one, and an
> unsettable countdown is a worse failure mode than a wrong one. Overwrite it with `PUT`,
> or remove the `hackathonconfigs` document in Atlas by hand.

---

## 15. Teams (§7) — command line, not Postman

New 2026-08-12. **There is no Postman folder for this and there never will be**: §5's
router list has no team router, so teams have no HTTP surface at all. Everything here is
`backend/src/scripts/manageTeams.js`. See
[README.md](README.md#team-7--provisioned-by-script-not-by-api) for why.

Run every command from `backend/`, with `MONGO_URI` in `backend/.env` pointing at
`ignition-dashboard-dev`. **This section writes to the shared database**, but only ever
*adds* — the script has no delete path, so the worst case is a leftover "QA Team" row you
can drop in Atlas afterwards.

You need two hacker accounts. `bobby@example.com` and a second one from section 2 are
fine — substitute your real emails below.

| # | Command | Expected result | Passed |
| - | ------- | --------------- | ------ |
| 15.1 | `node src/scripts/manageTeams.js` (no arguments) | Prints usage, exits `0`, connects to nothing | |
| 15.2 | `node src/scripts/manageTeams.js list` | Connects, prints the teams that exist (or "No teams yet") | |
| 15.3 | `node src/scripts/manageTeams.js create "QA Team"` | `Created "QA Team" (<id>). No members yet.` | |
| 15.4 | `create "qa team"` again | `FAILED: A team named "qa team" already exists`, exit `1`. The unique index ignores case | |
| 15.5 | `add "qa team" <hacker1 email>` | `Added …`, roster shows `[1/4]`. Note the team name lookup is also case-insensitive | |
| 15.6 | `add "QA Team" <hacker1 email>` again | Succeeds again, roster still `[1/4]`. Re-running is safe, not a duplicate | |
| 15.7 | `add "QA Team" nobody@example.com` | `FAILED: No user with email …`, exit `1` | |
| 15.8 | `add "No Such Team" <hacker1 email>` | `FAILED: No team named …`, exit `1` | |
| 15.9 | `create "QA Team Two"` then `add "QA Team Two" <hacker1 email>` | `FAILED: … is already on another team`. **This is the important one** — one user, one team | |
| 15.10 | `add "QA Team" <hacker2 email>` | Roster shows `[2/4]` | |
| 15.11 | `GET /api/users/me` in Postman as **hacker1** | `data.teamId` is the QA Team's `_id`. The script and the API agree | |
| 15.12 | `PATCH /api/users/me` as hacker1 with `{"teamId":"000000000000000000000001"}` | `200`, and `data.teamId` is **unchanged**. A hacker cannot join a team through their profile | |
| 15.13 | `remove "QA Team" <hacker1 email>` | Roster drops to `[1/4]`; `GET /api/users/me` now shows `teamId: null` | |
| 15.14 | `remove "QA Team" <hacker1 email>` again | Succeeds, roster still `[1/4]`. Removing a non-member is a no-op | |
| 15.15 | `reconcile` | `0 user(s) linked, 0 cleared, 0 stale member(s) dropped` on a healthy database | |
| 15.16 | Point `MONGO_URI` at a portal database and run `list` | `FAILED: MONGO_URI points at a portal database. Refusing …`, exit `1`, **no connection opened**. Put your real URI back afterwards | |
| 15.17 | `add "QA Team" <hacker1 email>` once more, so both hackers are on it | Roster shows `[2/4]`. Section 16 starts from here | |

> **15.9 is the invariant everything else rests on.** A user on two teams makes "the
> team's submission" ambiguous. If this ever succeeds, stop and file it.

> **15.15's `reconcile` is a repair tool, not routine maintenance.** It only has work to do
> if a script died between its two writes (the team write and the user write — there are no
> transactions on the free Atlas tier). Non-zero counts on a database nobody interrupted
> are worth investigating.

---

## 16. Project Submission (§1.2.4)

New 2026-08-12. Postman folder 16 (added in Phase 6) runs all of this.

⚠️ **Something has to create a team first.** A submission belongs to a *team*, and teams
only exist once `manageTeams.js` has made one — there is no HTTP way to create one.

**Running it in Postman?** Folder 16 brings its own accounts and its own teams. Run rows
16.0.1–16.0.4 to create the accounts, then the five `manageTeams.js` commands in the
folder's description, then the rest of the folder. You can skip the by-hand list below —
16.0.11 fails with a message naming the commands if you missed them.

**Doing it by hand?** Run section 15 first; nothing below works until 15.17 leaves two
hackers on "QA Team". Then you need five things:

- **hacker1** and **hacker2**, both on "QA Team" (section 15)
- **hacker3**, on **no** team at all — a fresh account from section 2 is fine
- an **organizer** token and an **admin** token
- "QA Team Two" from 15.9, with **hacker3** *not* on it — 16.18 needs a hacker on a
  *different* team, so `add "QA Team Two" <hacker4 email>` if you have a fourth account,
  otherwise skip 16.18 and note it

⚠️ **16.23–16.26 write the shared hackathon config.** Same warning as section 14 — note the
team's real dates down first and restore them in 16.26.

| # | Request | Expected result | Passed |
| - | ------- | --------------- | ------ |
| 16.1 | `GET /api/submissions/mine` with **no** token | `401`, `error.code` is `UNAUTHORIZED` | |
| 16.2 | `GET /api/submissions/mine` as **hacker3** (no team) | `200` with `"data": null`. **Not a `404`, not a `409`** — "no team, nothing submitted" is a normal state the Home page renders | |
| 16.3 | `GET /api/submissions/mine` as **hacker1**, before submitting | `200` with `"data": null`. Same reason | |
| 16.4 | `GET /api/submissions` (no `/mine`) as **hacker1** | `403`, `error.code` is `FORBIDDEN`. The judging list is not for hackers | |
| 16.5 | `POST /api/submissions` as an **organizer** | `403`. An organizer has no team, so there is nothing for them to submit | |
| 16.6 | `POST /api/submissions` as **hacker3** with a valid body | `409`, `error.code` is **`NO_TEAM`** — a distinct code from the "already submitted" 409 below, so the frontend can tell them apart | |
| 16.7 | `POST` as **hacker1** with `{"description":"no title"}` | `400`, `error.code` is `VALIDATION_ERROR`, `error.details` names `title` | |
| 16.8 | `POST` as hacker1 with a `title` longer than **200** characters | `400`, `error.details` names `title`. `description` has the same guard at **5000** | |
| 16.9 | `POST` as hacker1 with `{"title":"x","description":"y","repoUrl":"github.com/example/x"}` | `400` — a URL must start with `http://` or `https://`. Add the scheme and it passes | |
| 16.10 | `POST /api/submissions` as **hacker1** with `{"title":"Study Buddy","description":"Pairs students by course.","teamId":"<QA Team Two's id>","submittedBy":"<organizer id>"}` | `201` — and `data.teamId` is **QA Team's** id, `data.submittedBy` is **hacker1's** id. Both spoofed values are ignored; they come from the token. `data.submittedAt` is now, `devpostUrl` and `repoUrl` are `null`. **Save `data._id`** | |
| 16.11 | The exact same `POST` again | `409` — one submission per team. The message tells you to edit it instead | |
| 16.12 | The same `POST` as **hacker2** | `409` as well. It is the *team's* submission, not hacker1's | |
| 16.13 | `GET /api/submissions/mine` as **hacker1** | `200`, `data._id` matches 16.10 | |
| 16.14 | `GET /api/submissions/mine` as **hacker2** | `200`, **the same `_id`**. This is §4's "every teammate sees the same submission state" — the one behaviour worth testing by hand | |
| 16.15 | `PATCH /api/submissions/<id>` as **hacker2** with `{"title":"Study Buddy v2","devpostUrl":"https://devpost.com/software/study-buddy"}` | `200`, both fields changed. A teammate may edit — nobody appointed hacker1 the owner | |
| 16.16 | `PATCH` as hacker1 with `{"teamId":"000000000000000000000001","submittedBy":"000000000000000000000001","submittedAt":"2000-01-01T00:00:00Z"}` | `200`, and all three are **unchanged**. `updatedAt` moves, `submittedAt` does not — an edit must not move the timestamp on a judging sheet | |
| 16.17 | `PATCH` as **hacker3** (no team) | `403` | |
| 16.18 | `PATCH` as a hacker on **QA Team Two** | `403`. The check runs *before* the deadline check, so an outsider can't even learn whether submissions are open | |
| 16.19 | `PATCH /api/submissions/not-an-id` | `400`, `error.code` is `VALIDATION_ERROR` (a `CastError`, mapped by the central handler) | |
| 16.20 | `PATCH /api/submissions/000000000000000000000001` as hacker1 | `404` | |
| 16.21 | `GET /api/submissions` as an **organizer** | `200`, `data.count` matches `data.submissions.length`, newest `submittedAt` first | |
| 16.22 | `GET /api/submissions/<id>` as an organizer | `404` from the catch-all. **There is no `GET /:id`** — §1.2.4 lists none, and the judging list already carries every field | |
| 16.23 | As **admin**, `PUT /api/config/hackathon` with `submissionDeadline` **in the past** (keep the start/end times valid), then `PATCH` as hacker1 | `403`, `error.code` is **`SUBMISSION_CLOSED`**, message names the deadline | |
| 16.24 | With that deadline still in the past, `POST` as the **QA Team Two** hacker from 16.18 (their team hasn't submitted) | `403` `SUBMISSION_CLOSED` as well — the window closes for new submissions and edits alike. *(Skip with 16.18 if you only have three accounts.)* | |
| 16.25 | `PUT` the config again **without** `submissionDeadline`, and with `hackathonEndAt` in the past | `PATCH` is still `403` `SUBMISSION_CLOSED`. With no explicit deadline the hackathon's end **is** the deadline | |
| 16.26 | **Restore:** `PUT` the team's real dates back, then `PATCH` as hacker1 | `200`. Submissions are open again | |

> **16.2/16.3 are the ones people file as bugs.** "Not submitted yet" is `200` + `null`, on
> purpose: the Home page's Submit button reads that response to choose between its two
> faces, and a `404` would force the frontend to treat a normal state as an error.

> **16.16 is the whole security model in one row.** `teamId` and `submittedBy` come from
> the token and are never read from the body — on create *or* update. If either ever
> echoes back what you sent, stop and file it: it means a hacker can submit for any team,
> under anyone's name.

> **If a deadline is set and nothing is rejected, check the config first.** With **no**
> config document at all the API deliberately **fails open** — it allows the write and logs
> a warning to the server console. Look for `[submissions] No hackathon config is set` in
> the terminal running the backend before assuming the deadline check is broken.

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
- **`GET /health` is not enveloped.** Deliberate: it is an ops/liveness endpoint mounted
  outside `/api` and uptime probes match its literal `{ "status": "ok" }` body.
- **There's no way to delete the hackathon config.** `PUT` overwrites it; there is no
  `DELETE`. §1.2.3 doesn't ask for one, and the only way back to "unset" is removing the
  document in Atlas.
- **The submission deadline is a hard cutoff with no grace period.** One millisecond past
  it, `POST` and `PATCH` are `403`. There is no "submitted late" flag and no way to reopen
  the window for one team — an organizer moves `submissionDeadline` for everybody or for
  nobody. Deliberate: a per-team exception is a policy decision, not a backend feature.
- **No hackathon config means no deadline at all.** The check **fails open**: with no
  config document, every submission is allowed and the server logs
  `[submissions] No hackathon config is set`. Locking every team out because an admin
  forgot to run one `PUT` is the worse failure, so this is on purpose — but it does mean
  "the deadline isn't working" is usually "the config was never set".
- **Announcements have no read/unread state.** §1.2.2 says so explicitly, so there's no
  "new" badge and no way to mark one read. Every user sees the same feed.
- **Deleting a user doesn't touch their announcements.** `authorId` is left pointing at a
  missing user, and `authorName` keeps rendering, so the feed still reads correctly. Same
  trade-off as attendance records pointing at deleted events.
- **The checklist is Food-only.** §3.2.2 describes it as the meal checklist, so workshops
  are excluded. If the team wants workshop attendance on the Profile page that's a
  one-line filter change — pending a decision.
- **Teams cannot be created or joined over HTTP.** §5's router list has no team router, so
  the only way in is `manageTeams.js` (section 15). That is the deliberate cost of
  following the doc, not an oversight — and it means testing the submission routes needs
  one CLI command first. Adding a `teamRouter` later is additive; the service already
  holds every rule.
- **A team can't be renamed or deleted.** `manageTeams.js` only creates and links, on
  purpose — it is run against the shared database. Renaming or removing a team means
  editing the `teams` collection in Atlas.
- **Max team size 4 is an assumption.** The design doc never states a limit; this is
  Ignition Hacks' published rule. It's one constant (`Team.MAX_TEAM_SIZE`) if the answer
  turns out to be different.
- **A submission can't be deleted, and an organizer can't edit one.** §1.2.4 lists neither,
  so there is no `DELETE` and the write routes are hacker-only. A team that submits the
  wrong project edits it; a typo an organizer spots has to go back to the team, or be
  fixed in the `submissions` collection in Atlas.
- **There is no `GET /api/submissions/:id`.** The judging list returns every field of every
  submission already, so a per-id read would add a route without adding information.
  Hackers read theirs through `/mine`.

## Actual bugs found by this script

- **`User.status` is never written.** See [CHECKLIST.md](CHECKLIST.md) item **2.6.F1**.
  Found 2026-07-27 during section 4 — an account with `role: "admin"` still reported
  `status: "Hacker"`. The field has one default and no code path that ever changes it.
