# Environment variables

All backend environment variables live in `backend/.env`. That file is **git-ignored** —
never commit it, and never paste its contents into chat or Discord.

Start from the template:

```bash
copy .env.example .env
```

(run from `C:\Users\abbar\OneDrive\Desktop\Ignition_Hack\ignition-dashboard\backend`)

| Variable | Required | Default | What it does |
| -------- | -------- | ------- | ------------ |
| `MONGO_URI` | **Yes** | — | MongoDB connection string. The server refuses to start without it. |
| `JWT_SECRET` | **Yes** | — | Signing key for login tokens. Tokens can't be issued or verified without it. |
| `JWT_EXPIRES_IN` | No | `7d` | How long a login token stays valid. Any [ms](https://github.com/vercel/ms) string, e.g. `12h`. |
| `PORT` | No | `4000` | Port the API listens on. |

The test suite needs **none** of these — it sets its own throwaway `JWT_SECRET` and runs
against an in-memory MongoDB.

---

## `MONGO_URI`

> ⚠️ **The variable is `MONGO_URI`, not `MONGODB_URI`.** This is the single most common
> mistake on this project — it's called out as a known gotcha in the team's `CLAUDE.md`.

Youssef issues each developer their own database username and password for the shared
`ignition-hacks` Atlas cluster. The URI shape is:

```
mongodb+srv://<db_username>:<db_password>@ignition-hacks.0b0zeip.mongodb.net/ignition-dashboard-dev?appName=ignition-hacks
```

**The database name must sit between the host and the `?`.** Leave it out and Mongoose
silently connects to the default `test` database, and nothing the team expects will be
there.

Development uses `ignition-dashboard-dev`. A separate database is created for production
at hosting time — never point local development at it.

> ⚠️ `ignition-dashboard-dev` is **shared by the whole team**. `npm run seed` begins with
> `deleteMany({})`, so running it wipes everyone's schedule data. It refuses to run
> without `npm run seed -- --yes` and prints the target database name first.

**If your password contains `@`, `:`, `/` or `?`**, percent-encode it or the URI won't
parse (`@` → `%40`, `:` → `%3A`, `/` → `%2F`, `?` → `%3F`).

### Troubleshooting: `querySrv ECONNREFUSED`

If `npm run dev` fails immediately with:

```
[server] Failed to start: querySrv ECONNREFUSED _mongodb._tcp.ignition-hacks.0b0zeip.mongodb.net
```

…the connection never reached Atlas. This is **not** a credentials or allowlist problem.

`mongodb+srv://` requires Node to look up a DNS **SRV** record, and Node does that through
c-ares — a resolver that sends UDP:53 queries directly, bypassing the Windows DNS Client
service. If a firewall or antivirus blocks `node.exe` from sending those, the lookup is
refused before any network call to MongoDB happens.

The confusing part: `nslookup` still works perfectly, because it's a different executable
that the rule doesn't apply to. So DNS "looks fine" while Node can't resolve anything.

Confirm it with:

```bash
node -e "require('dns').resolveSrv('_mongodb._tcp.ignition-hacks.0b0zeip.mongodb.net',(e,r)=>console.log(e?e.code:r.length+' records'))"
```

`ECONNREFUSED` confirms the diagnosis; a record count means your problem is elsewhere.

**Fix (no admin rights needed):** use the non-SRV form of the connection string, which
lists the shard hosts directly so Node only needs `dns.lookup()` — the path that isn't
blocked. In Atlas: **Connect → Drivers → Node.js → version 2.2.12 or later**. It looks
like:

```
mongodb://<user>:<pass>@<shard-00>:27017,<shard-01>:27017,<shard-02>:27017/ignition-dashboard-dev?ssl=true&replicaSet=<rs-name>&authSource=admin&retryWrites=true&w=majority
```

> ⚠️ **Trade-off:** the shard hostnames are baked in, so if the cluster is ever resized or
> migrated this URI breaks and you'll need a fresh one. The `mongodb+srv://` form survives
> that automatically. Keep the SRV version commented in your `.env` and switch back if the
> firewall rule is ever fixed.

The alternative real fix is to allow `node.exe` outbound UDP:53 in Windows Defender
Firewall / your antivirus. That's a security setting — make that call yourself.

## `JWT_SECRET`

Any long random string. Generate one with a real CSPRNG rather than typing something —
from the `backend` folder:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the output as the value. Notes:

- Each developer can have their own; it doesn't need to match anyone else's.
- Changing it invalidates every token that was already issued — everyone has to log in
  again. That's the intended way to force a logout.
- Production must use a different secret from development.

## `JWT_EXPIRES_IN`

Controls how long a hacker stays logged in. `7d` comfortably covers a weekend hackathon.
Shortening it is the only built-in way to limit a stolen token's lifetime — logout is a
client-side no-op because JWTs are stateless and there's no denylist.

## `PORT`

Only change this if something else is already on `4000`. If you do, tell Jeremy — the
frontend has to point at the new port.
