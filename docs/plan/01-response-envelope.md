# Phase 1 — Response envelope + error contract

> **Spec:** design doc §5 — "Consistent JSON Responses", "Error Handling",
> "Validation", "HTTP Status Codes".
> **Closes:** new CHECKLIST phase 7.
> **Depends on:** nothing. **Blocks:** phases 2–6 (they are written against this contract).

---

## Goal

Every response from every `/api` route is wrapped in the §5 envelope:

```jsonc
// success
{ "success": true, "data": { … } }

// failure
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Schedule event not found" } }
```

so the frontend can "write one generic response handler instead of custom parsing per
endpoint". Today the API returns bare objects, `{ count, events }`, and `{ error }` —
three different shapes a client has to special-case.

This is the one genuinely cross-cutting phase. It is done first and alone, so the four
entity phases after it are written against the final contract exactly once.

---

## The contract

### Success

`data` carries what the route used to return at the top level. Nothing is renamed —
existing shapes are nested, not redesigned, which keeps the test diff mechanical.

| Kind | `data` | Example route |
| --- | --- | --- |
| Single resource | the resource object | `GET /api/schedule/:id` → `data` is the event |
| Collection | `{ count, <plural> }` | `GET /api/schedule` → `data.count`, `data.events` |
| Action result | the action's own object | `POST /api/qrcode/scan` → `data.alreadyCheckedIn`, `data.attendance` |

Collection key names stay as they are (`events`, `checklist`, `attendance`). Renaming
them to a generic `items` would be a second breaking change for no gain — §5 says
nothing about the inside of `data`.

### Failure

```jsonc
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Validation failed",
                               "details": ["title is required"] } }
```

`details` appears **only** on validation errors, exactly as it does today.

### Error codes

`code` is a stable machine-readable string; `message` is for humans and may change.

| Status | `code` | Raised by |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Mongoose `ValidationError`, Mongoose `CastError` |
| 400 | `BAD_REQUEST` | `ApiError(400, …)` thrown by a controller |
| 401 | `UNAUTHORIZED` | `requireAuth` — missing/invalid/expired token |
| 403 | `FORBIDDEN` | `requireRole` — authenticated, wrong role |
| 404 | `NOT_FOUND` | `ApiError(404, …)`, and the `notFound` catch-all |
| 409 | `CONFLICT` | duplicate key (11000), `ApiError(409, …)` |
| 500 | `INTERNAL_ERROR` | anything unhandled |

Defaults are derived from the status code, so no controller has to pass a code. Any
controller that wants a more specific one may pass it explicitly — phase 5 uses this
for `SUBMISSION_CLOSED` (deadline passed) rather than a bare `BAD_REQUEST`.

---

## Two deliberate deviations — read these

### 1. `DELETE /api/schedule/:id` changes `204 No Content` → `200 OK` + envelope

§5's status-code list reads "**200**: successful GET/PATCH/**DELETE**" and does not
list 204 at all. A 204 response has no body by definition, so it physically cannot
carry the envelope. The two rules are incompatible; §5 resolves it in favour of 200.

New response: `200` with `{ "success": true, "data": { "deleted": true, "id": "<id>" } }`.

**This breaks existing test `5.14` and the `manual-qa.md` DELETE row.** Both are updated
in this phase. Flagging it because it is the only change in the whole plan that alters
an already-manually-QA'd behaviour.

### 2. `GET /health` keeps returning `{ "status": "ok" }`

It is an ops/liveness endpoint, deliberately mounted outside `/api`, and §5 scopes
itself to the API routers. Uptime probes match on the literal body. Left alone on
purpose, and documented as an exception so it doesn't read as an oversight later.

---

## Files changed

### New

| File | Purpose |
| --- | --- |
| `backend/src/utils/apiResponse.js` | `ok(res, data, status)` and the `ERROR_CODES` map / `codeForStatus(status)` |

### Modified

| File | Change |
| --- | --- |
| `backend/src/utils/ApiError.js` | third optional arg `code`; falls back to `codeForStatus` |
| `backend/src/middleware/errorHandler.js` | both `notFound` and `errorHandler` emit the failure envelope (5 branches) |
| `backend/src/controllers/scheduleController.js` | 6 response sites, incl. the 204→200 change |
| `backend/src/controllers/authController.js` | 3 response sites |
| `backend/src/controllers/userController.js` | 4 response sites |
| `backend/src/controllers/qrCodeController.js` | 5 response sites |
| `backend/src/controllers/attendanceController.js` | 3 response sites |
| `backend/src/app.js` | unchanged apart from a comment noting `/health` is exempt |

21 controller response sites + 5 error-handler branches. Verified by
`grep -rn "res\.\(json\|status\|end\)" backend/src`.

### Tests touched

The 56 **unit** tests assert on Mongoose models and never see an HTTP body — **untouched**.
Only the 105 integration tests move:

| File | Tests | Lines referencing `res.body` |
| --- | --- | --- |
| `integration/attendance.test.js` | 28 | 24 |
| `integration/qrcode.test.js` | 23 | 21 |
| `integration/schedule.test.js` | 27 | 14 |
| `integration/auth.test.js` | 12 | 9 |
| `integration/users.test.js` | 13 | 7 |
| `integration/health.test.js` | 2 | 2 → **unchanged** (documents the exemption) |

`tests/helpers/factories.js` also changes in one place: `makeUserAndToken` reads
`res.body.token`, which becomes `res.body.data.token`. That single line is what every
authenticated test in the suite depends on.

---

## TDD plan — tests before implementation

New file **`tests/integration/envelope.test.js`**, written and failing first. It tests
the contract itself rather than any one route, so a future route that forgets the
envelope gets caught here:

| # | Test |
| --- | --- |
| E.1 | a successful GET has `success: true` and an object `data`, and no top-level `error` |
| E.2 | a successful list has `data.count` and `data.events`, and `count === events.length` |
| E.3 | a successful POST returns 201 with `success: true` and the created resource in `data` |
| E.4 | a 404 returns `success: false`, `error.code === 'NOT_FOUND'`, and a non-empty `message` |
| E.5 | a validation failure returns 400, `error.code === 'VALIDATION_ERROR'`, and a non-empty `error.details` array |
| E.6 | a missing token returns 401 with `error.code === 'UNAUTHORIZED'` |
| E.7 | a wrong-role request returns 403 with `error.code === 'FORBIDDEN'` |
| E.8 | a duplicate key returns 409 with `error.code === 'CONFLICT'` |
| E.9 | an unknown route (`GET /api/nope`) returns 404 in the failure envelope |
| E.10 | no failure response ever leaks a stack trace or an `err.name` into the body |
| E.11 | `GET /health` is **exempt** — still `{ status: 'ok' }`, no envelope |
| E.12 | `DELETE /api/schedule/:id` returns **200** (not 204) with `data.deleted === true` |

Then the 91 existing body assertions are migrated file by file, running the suite after
each file so a break is always attributable to the file just touched.

**Expected suite total after this phase: 161 + 12 = 173, fail 0.** No existing test is
deleted; `5.14`'s expectation changes from 204 to 200.

---

## Acceptance criteria

- [ ] `cd tests && npm test` → `pass 173` / `fail 0`
- [ ] `grep -rn "res.json" backend/src/controllers` returns **no** un-enveloped call
- [ ] Every one of the 7 error codes is produced by at least one test
- [ ] `GET /health` still returns `{ "status": "ok" }`
- [ ] `docs/README.md` gains an "Response envelope" section; the endpoint table's
      response column is updated
- [ ] `docs/manual-qa.md`'s DELETE row expects 200
- [ ] `docs/CHECKLIST.md` phase 7 added and ticked
- [ ] Postman is **not** touched yet — it is rewritten wholesale in phase 6

---

## Risks

| Risk | Mitigation |
| --- | --- |
| A missed assertion silently passes because `res.body.foo` is now `undefined` and the test only checked truthiness | Migrate one file at a time and re-run; E.1–E.12 assert the envelope's *presence*, which a loose test cannot fake |
| `makeUserAndToken` breaks and ~100 tests fail at once with a confusing 401 | Change it first, deliberately, and confirm the mass failure appears and then clears |
| The 204→200 change surprises Abdullah during manual QA | Called out above, in `manual-qa.md`, and in the phase-6 Postman notes |
| Some future route forgets the envelope | `envelope.test.js` E.9/E.10 cover the shared middleware; per-route coverage is each phase's own job |
