# Deploying the MacroDash Cron Worker to Cloudflare

Setup guide for the **`macrodash-cron`** Worker (`worker/`). Commands verified against
**Wrangler v4 / Cloudflare (June 2026)**. The Worker is **separate from Cloudflare Pages** —
pushing to `main` deploys the *site*, but the Worker only updates when you run `wrangler deploy`.

## What this Worker does

A scheduled (Cron) Worker with **four** triggers (`worker/wrangler.toml`). ⚠️ This table, the
TOML `crons` array, and the dispatch constants in `cron.js` must all agree — `scheduled()`
routes by **exact string comparison** on `controller.cron`, and any unmatched string falls
through to the *legacy* FRED path (a silently misrouted job, not a visible failure). Smoke
reconciles the TOML against the `cron.js` constants, so an edit to one without the other
fails the build; this table is documentation of the same contract.

| Cron (UTC) | Local time | Job |
|---|---|---|
| `30 12 * * 1-5` | 5:30 AM PDT | *legacy* — FRED macro pull → KV `pulse:macro:latest` |
| `0 21 * * 1-5` | 2:00 PM PDT | *legacy* — same |
| `0 12 * * 1-5` | **8:00 AM ET** | **active** — PRE-OPEN warm of `/api/snapshot` (no-op if the day is already cached) |
| `0 14 * * 1-5` | **10:00 AM ET** | **active** — FORCE-REFRESH of the day's snapshot via `POST /api/snapshot/refresh` (needs `REFRESH_TOKEN` — see Step 3; without it, falls back to a non-destructive GET, which is a **cache hit, not a refresh**, whenever the 8 AM warm already populated the day) |

> The two *legacy* crons feed `/api/fred`, which the dashboard no longer reads (slated for
> removal in v2.5 cleanup). They still need `FRED_KEY` until removed. The 8 AM warm only makes
> an HTTP call to `/api/snapshot` and needs **no secret**.

---

## Prerequisites

- **Node ≥ 20** (the repo baseline — `package.json` engines; Wrangler v4 itself needs ≥18). This repo pins Node 22 (`.nvmrc`); CI runs 20.
- A **Cloudflare account** that owns the Pages project + the `PULSE_CACHE` KV namespace.
- Run everything from the **`worker/`** directory.

```bash
cd worker
npx wrangler --version    # expect 4.x  (npx fetches the latest if not installed)
```

> Cloudflare now recommends **`wrangler.jsonc`** over `wrangler.toml` (newer features are
> JSON-only). This Worker's `wrangler.toml` is fully supported — migration is optional.

---

## 1. Authenticate

```bash
npx wrangler login      # opens a browser for OAuth
npx wrangler whoami     # confirm the correct account/email
```

## 2. Confirm the shared KV namespace  ⚠️ do **not** create a new one

The Worker and the Pages site **must bind the same** `PULSE_CACHE` namespace, or the Worker's
cache writes won't be visible to the dashboard. The id is already set in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "PULSE_CACHE"
id = "78ad3346a8fe4757a906283c4bc81a5e"
```

Verify that id still matches the namespace bound to the Pages project:

```bash
npx wrangler kv namespace list      # find "PULSE_CACHE" → confirm its id matches wrangler.toml
```

> **Brand-new account?** Create it once and bind the **same id** to both Pages and this Worker:
> `npx wrangler kv namespace create PULSE_CACHE` → paste the returned `id` into `wrangler.toml`
> *and* into Pages → Settings → Variables & Bindings → KV.
> (Note the modern syntax is `kv namespace` with a space — the old `kv:namespace` colon form is removed.)

## 3. Set the secrets

⚠️ **Two different refresh credentials exist and they are not interchangeable** (this guide
previously named only `REFRESH_SECRET`, which left the active refresh path unconfigured while
every command "succeeded" — the exact trap this section now exists to prevent):

- **`REFRESH_TOKEN`** — the ACTIVE credential. Authenticates the 10 AM cron (and the manual
  `POST /refresh` pass-through) against `POST /api/snapshot/refresh` via the
  `x-refresh-token` header. **The same value must be set in BOTH deployments**: here
  (`npx wrangler secret put REFRESH_TOKEN` in `worker/`) AND on the Pages project
  (`npx wrangler pages secret put REFRESH_TOKEN`), because the Worker sends it and the Pages
  Function checks it. Without it the 10 AM job degrades to a plain GET — and a GET after the
  8 AM warm is a cache **hit**, so nothing refreshes. A manual `POST /refresh` response
  saying `active_refresh: "skipped (no REFRESH_TOKEN)"` means exactly this state, even
  though the response's `ok` is `true` (the `ok` describes the legacy write only).
- **Deployment gate:** `npm test` checks that the Worker returns the refresh response's
  canonical call directly into history capture. Before a production deploy, also run
  `npx wrangler secret list` and `npx wrangler pages secret list --project-name macrodash`;
  `REFRESH_TOKEN` must appear in both lists. Secret values are never printed.
- **`REFRESH_SECRET`** — LEGACY only. Guards the Worker's own `POST /refresh` endpoint
  (`x-refresh-secret` header). It never touches `/api/snapshot/refresh`.

Use the interactive prompt — **never** pass a secret value as a command argument:

```bash
npx wrangler secret put FRED_KEY        # paste the St. Louis FRED API key when prompted
npx wrangler secret put REFRESH_TOKEN   # active snapshot refresh (ALSO set on Pages — see above)
# optional, only if you use the legacy manual POST /refresh endpoint:
npx wrangler secret put REFRESH_SECRET
npx wrangler secret list                # verify
```

## 4. Deploy

```bash
npx wrangler deploy --dry-run    # optional: validate config + bundle without deploying
npx wrangler deploy              # deploy for real
```

The deploy output lists the registered cron schedules. (`wrangler deploy` replaced the old
`wrangler publish`.) Cron changes can take **up to ~15 minutes** to propagate globally.

---

## 5. Verify

**Deploy output** — confirm all **four** crons are listed (`30 12…`, `0 21…`, `0 12…`, `0 14…`).

**Dashboard:** Cloudflare → **Workers & Pages → Overview → `macrodash-cron` → Settings →
Triggers → Cron Triggers**. (The "Cron Events" view keeps the 100 most recent invocations.)

**Live logs:**
```bash
npx wrangler tail macrodash-cron        # stream invocations; Ctrl-C to stop
```

**Test the snapshot jobs locally**:
```bash
npx wrangler dev
# in another terminal — simulate the 8 AM ET pre-open warm (no secret needed):
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+12+*+*+1-5"
# simulate the 10 AM ET force-refresh (needs REFRESH_TOKEN, or it falls back to a GET):
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+14+*+*+1-5"
```
The warm fetches `https://macrodash.pages.dev/api/snapshot` (populating the per-day cache);
the refresh POSTs `/api/snapshot/refresh` with `x-refresh-token`. `?format=json` returns a
JSON result; omit `?cron=` to run all handlers.

---

## Twice-a-year DST edit

Cloudflare crons are UTC with no timezone support. The schedules are anchored to **Pacific
Daylight / Eastern Daylight** time. When the US switches to standard time (~November), bump the
UTC hour by +1 so local times hold, then redeploy:

⚠️ The DST edit is **two files, together**: the TOML schedules below AND the matching
constants in `cron.js` (`SNAPSHOT_PREWARM_CRON`, `SNAPSHOT_WARM_CRON`) — dispatch is by
exact string match, so editing only the TOML silently reroutes both snapshot jobs onto the
legacy FRED path. (An earlier version of this block listed only three crons; following it
would also have deleted the 8 AM prewarm.) Smoke's contract check goes red if the two files
disagree.

```toml
crons = [
  "30 13 * * 1-5",   # 5:30 AM PST
  "0 22 * * 1-5",    # 2:00 PM PST
  "0 13 * * 1-5",    # 8:00 AM EST    ← the pre-open warm  (cron.js: SNAPSHOT_PREWARM_CRON)
  "0 15 * * 1-5"     # 10:00 AM EST   ← the snapshot force-refresh (cron.js: SNAPSHOT_WARM_CRON)
]
```

## Updating the Worker

Edit `worker/cron.js` or `worker/wrangler.toml`, then re-run `npx wrangler deploy`. Roll back a
bad deploy with `npx wrangler rollback`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `command not found: wrangler` | use `npx wrangler …`, or `npm install -D wrangler@latest` |
| Auth / 10000 errors | `npx wrangler login`; check `npx wrangler whoami` is the right account |
| Dashboard shows MOCK / stale cache | the Worker's `PULSE_CACHE` id ≠ the Pages-bound id — re-check Step 2 |
| Cron didn't fire | wait up to 15 min after deploy; confirm weekday + the DST-correct UTC hour |
| `FRED_KEY missing` in logs | `npx wrangler secret put FRED_KEY` (Step 3) |

> Always re-check the current docs for syntax: <https://developers.cloudflare.com/workers/wrangler/>
> and <https://developers.cloudflare.com/workers/configuration/cron-triggers/>.
