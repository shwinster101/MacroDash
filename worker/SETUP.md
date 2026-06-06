# Deploying the MacroDash Cron Worker to Cloudflare

Setup guide for the **`macrodash-cron`** Worker (`worker/`). Commands verified against
**Wrangler v4 / Cloudflare (June 2026)**. The Worker is **separate from Cloudflare Pages** —
pushing to `main` deploys the *site*, but the Worker only updates when you run `wrangler deploy`.

## What this Worker does

A scheduled (Cron) Worker with three triggers (`worker/wrangler.toml`):

| Cron (UTC) | Local time | Job |
|---|---|---|
| `30 12 * * 1-5` | 5:30 AM PDT | *legacy* — FRED macro pull → KV `pulse:macro:latest` |
| `0 21 * * 1-5` | 2:00 PM PDT | *legacy* — same |
| `0 14 * * 1-5` | **10:00 AM ET** | **active** — warms `/api/snapshot` so the day's first visitor gets instant fresh data |

> The two *legacy* crons feed `/api/fred`, which the dashboard no longer reads (slated for
> removal in v2.5 cleanup). They still need `FRED_KEY` until removed. The 10 AM warm only makes
> an HTTP call to `/api/snapshot` and needs **no secret**.

---

## Prerequisites

- **Node ≥ 18** (Wrangler v4 requires it). This repo pins Node 22 (`.nvmrc`).
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

## 3. Set the secret

`FRED_KEY` is needed by the legacy FRED crons. Use the interactive prompt — **never** pass a
secret value as a command argument:

```bash
npx wrangler secret put FRED_KEY        # paste the St. Louis FRED API key when prompted
# optional, only if you use the manual POST /refresh warm:
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

**Deploy output** — confirm all three crons are listed (`30 12…`, `0 21…`, `0 14…`).

**Dashboard:** Cloudflare → **Workers & Pages → Overview → `macrodash-cron` → Settings →
Triggers → Cron Triggers**. (The "Cron Events" view keeps the 100 most recent invocations.)

**Live logs:**
```bash
npx wrangler tail macrodash-cron        # stream invocations; Ctrl-C to stop
```

**Test the 10 AM warm locally** (no secret needed for this branch):
```bash
npx wrangler dev
# in another terminal — simulate the 10 AM ET trigger:
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+14+*+*+1-5"
```
It should fetch `https://macrodash.pages.dev/api/snapshot` (warming the per-day cache).
`?format=json` returns a JSON result; omit `?cron=` to run all handlers.

---

## Twice-a-year DST edit

Cloudflare crons are UTC with no timezone support. The schedules are anchored to **Pacific
Daylight / Eastern Daylight** time. When the US switches to standard time (~November), bump the
UTC hour by +1 so local times hold, then redeploy:

```toml
crons = [
  "30 13 * * 1-5",   # 5:30 AM PST
  "0 22 * * 1-5",    # 2:00 PM PST
  "0 15 * * 1-5"     # 10:00 AM EST   ← the snapshot warm
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
