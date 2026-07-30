# Manual QA — Hacker Dashboard Backend

Hand-testing script for things the automated suite can't prove. Tick the **Passed**
column as you go; leave it blank until you've actually seen the result.

The automated suite (`cd tests && npm test`, 82 tests) already covers all the API logic
against an in-memory database. **What it cannot cover is everything involving the real
Atlas cluster, the real server process, and Postman** — that's what sections 1, 6 and 7
are for.

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
— 51 requests across 8 folders. Postman → **Import** → drag the file in.

Tokens and ids are captured into collection variables automatically, so you never
copy-paste a token. **Run the folders in numbered order** — folder 5 creates the events
that folder 6 reads, and folder 4 has a manual pause where you promote a user to `admin`
in Atlas.

The collection asserts status codes for you, but it does **not** replace looking at the
responses. Rows 2.2, 4.3, 4.4 and 8.1–8.3 need your eyes on the actual body.

Folder 8 deletes the QA events again — `ignition-dashboard-dev` is shared, so run it.

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
| 1.3 | From `tests`: `npm test` | Ends with `pass 82` and `fail 0` | ✅ |
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

## Actual bugs found by this script

- **`User.status` is never written.** See [CHECKLIST.md](CHECKLIST.md) item **2.6.F1**.
  Found 2026-07-27 during section 4 — an account with `role: "admin"` still reported
  `status: "Hacker"`. The field has one default and no code path that ever changes it.
