# Stock Spotlight — activation guide (v6.5.0)

Status: merged to `main` on 2026-09-14 (PR #34, commit `330fcfe`) and deployed **switched off**.
This page explains what the feature is, why it is off, and exactly how to turn it on.

## 1. Context — what shipped, and why it is invisible

**What it is.** A small educational widget on the MacroDash homepage, directly under the row
of macro numbers, in both Simple and Degen modes. It shows Nebius (NBIS) next to one large
"Established growth" company that changes every week (Microsoft first, then Apple, Amazon,
Alphabet, Meta, NVIDIA, Tesla, and around again). For each company it shows what the business
does, its market cap, its year-to-date total return, its latest reported revenue growth,
operating margin and free cash flow, a two-sentence plain-English read, and one shared
"learning moment". A chart plots both stocks' year-to-date return from the same starting line.

**Why it is off.** It ships behind a feature flag, so the live site is unchanged today. Two
things have to happen before it shows:

1. **Data rights.** The plan requires approval to publicly display market caps, prices and
   derived total returns before activation. That is your call, not a code change.
2. **Secrets.** The widget needs a Tiingo API key (for dividend-adjusted price history) and the
   on-switch itself. Neither is set on the Cloudflare Pages project yet.

**How the data flows once it is on.** Every weekday at 6pm ET the existing cron Worker asks the
site to refresh the spotlight. The site pulls market caps from Finnhub, financial statements from
the SEC, and adjusted price history from Tiingo, stores a finished model in KV, and the homepage
reads that stored model. The public page never calls a provider itself. If any input is missing,
that field reads "Unavailable" with the reason; nothing is invented. If the whole refresh fails,
the previous week's pair stays on screen and the rotation does not advance.

**What it never touches.** It reads none of the Ticker Terminal's private data (book, positions,
scores, targets). It only ever writes and reads its own `spotlight:*` keys in KV.

## 2. ELI5 — what a "secret" is here

Cloudflare Pages runs the site. Some values (API keys, on/off switches) must not be written
into the code, so they are stored on the Cloudflare side as "secrets" and handed to the site at
runtime. Adding a secret is like putting a key on the site's keyring; the code already knows
which key to look for. Two important rules:

- Secrets only take effect after the **next deploy**. Adding one does not change the running
  site until you redeploy.
- Never paste a secret value into a command line or a chat. The tool prompts you and you paste
  it there, where it is not recorded.

## 3. Step by step

### Step 1 — get a Tiingo key (free)

1. Go to tiingo.com and create a free account.
2. Open your account page and copy the **API Token**.
3. Keep it somewhere private for step 2. The spotlight makes three requests per night, which is
   far below the free tier's daily limit.

Why Tiingo specifically: it is the only free source whose price history is documented as adjusted
for both splits and dividends, and the code checks that claim on every pull. Without it the
year-to-date chart cannot be drawn honestly, so it stays blank.

### Step 2 — add the two new secrets

Do this either in the Cloudflare dashboard or from the terminal. Both do the same thing.

**Dashboard:** Workers & Pages → **macrodash** → Settings → Variables and Secrets →
Production → Add variable. Mark each as a Secret.

| Name | Value |
|---|---|
| `TIINGO_KEY` | the token from step 1 |
| `SPOTLIGHT_ENABLED` | exactly `1` |

**Terminal** (run from the repo folder; each command prompts for the value, paste it then):

```bash
npx wrangler pages secret put TIINGO_KEY --project-name macrodash
```

```bash
npx wrangler pages secret put SPOTLIGHT_ENABLED --project-name macrodash
```

The switch is deliberately strict: only the exact value `1` turns it on. `true`, `yes` or `on`
leave it off, so a typo can never accidentally publish the widget.

### Step 3 — check the two secrets it also relies on

```bash
npx wrangler pages secret list --project-name macrodash
```

The list must contain:

- `REFRESH_TOKEN` — already used by the 10am and 6pm cron jobs; the nightly spotlight refresh
  uses the same one. It should already be there.
- `SEC_USER_AGENT` — required by the SEC's servers for the financial statements. The planning
  inspection found it **missing**. If it is not in the list, add it as a short description of
  the app plus a contact email, for example `MacroDash/6.5 (you@example.com)`:

```bash
npx wrangler pages secret put SEC_USER_AGENT --project-name macrodash
```

Without `SEC_USER_AGENT` the widget still appears, but every revenue, margin and cash-flow
field reads "Unavailable — SEC_USER_AGENT is not configured".

### Step 4 — redeploy so the secrets take effect

In the dashboard: Workers & Pages → macrodash → Deployments → open the latest → **Retry
deployment**. (Pushing any commit to `main` does the same.) Wait for it to finish.

### Step 5 — warm it once

The nightly cron will fill the widget at 6pm ET, but you can fill it now. Replace the
placeholder with your `REFRESH_TOKEN` value:

```bash
curl -s -X POST https://macrodash.pages.dev/api/stock-spotlight/refresh -H "x-refresh-token: PASTE_TOKEN_HERE" -H "content-type: application/json" -d '{"reason":"activation"}'
```

What a good response looks like:

- `"ok": true`
- `"pair": { "comparison": "MSFT", ... }`
- `"failures": []`

If `ok` is `false`, read `dataReasons`. It names the exact missing input, for example
`MSFT: total-return series not refreshed this run` (a Tiingo problem) or a reason mentioning
`SEC_USER_AGENT` (step 3). Fix that one thing and run the command again; it can be repeated
safely (there is a one-minute cooldown between runs).

### Step 6 — verify on the site

```bash
curl -s https://macrodash.pages.dev/api/stock-spotlight | head -c 400
```

You should see `"enabled":true` followed by a model. Then open macrodash.pages.dev on your
phone in Simple mode: the widget sits directly under the macro-number strip, showing NBIS and
Microsoft with market caps, year-to-date total returns, the chart and the learning moment.

## 4. What happens after that

- **Nightly:** the 6pm ET weekday cron refreshes market data and financials. A failed night
  keeps the previous good data on screen, marked stale where relevant.
- **Weekly:** the comparison company advances on the first successful refresh of each new
  week, Monday-based, in the fixed order above. Everyone sees the same pair.
- **Quarterly:** revenue, margins and cash flow update when the SEC receives the new filing.
  Nebius files interim results as press releases that the SEC cannot read automatically; if a
  quarter fails to appear, the operator can enter the reported figures with the filing's
  sec.gov link through the PIN-gated issuer-record route (see the plan document).
- **January:** the chart resets to 0% at the prior-year close and reads "awaiting first trading
  close" until the first session of the new year is in.

## 4b. Nebius quarterly figures (the issuer record)

Nebius files its quarterly results as 6-K press releases that the SEC's structured data does
not carry, so its revenue, margin and cash-flow rows read "Unavailable — annual filing only"
until an **issuer record** is filed. That is a one-time PUT (repeat each quarter with the new
6-K): the reported figures with the sec.gov URL of the filing they came from. The v6.5.1 record
for the Q2-2026 6-K + FY2025 20-F is in the session's `nbis-issuer-record.json`; to file it,
with your Terminal PIN:

```bash
curl -s -X PUT https://macrodash.pages.dev/api/stock-spotlight/issuer -H "x-tt-pin: PASTE_PIN_HERE" -H "content-type: application/json" --data @nbis-issuer-record.json
```

Then run the refresh POST from step 5 (or wait for 6pm ET). The record is validated on write
(sec.gov source required, USD only, period lengths checked, negative capex rejected); a 400
names the offending field.

## 5. Turning it off again

Delete `SPOTLIGHT_ENABLED` (or set it to `0`) and redeploy. The stored model stays in KV, so
switching it back on later needs no new warm-up.

## 6. If something looks wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Widget absent entirely | flag not exactly `1`, or no redeploy since adding it | step 2, then step 4 |
| Both YTD fields "Unavailable — no verified total-return series" | `TIINGO_KEY` missing or invalid | step 1–2, redeploy, step 5 |
| Financial rows "Unavailable — SEC_USER_AGENT…" | SEC identity not set | step 3, redeploy, step 5 |
| "no spotlight model stored yet" | never refreshed | step 5 |
| Market data marked STALE | the last refresh is more than one session old | wait for 6pm ET, or run step 5 |

Operational diagnostics: `/api/snapshot?debug=<DEBUG_TOKEN>` now lists a `spotlight-6pmET`
heartbeat beside the other cron jobs, and the last refresh's outcome is stored under
`spotlight:diag:v1` in KV.
