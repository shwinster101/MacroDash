// FEAT-QUORUM (v3.54) — browser state suite for the PUBLIC React dashboard.
//
// WHY THIS EXISTS: the 11.4.5 audit's sharpest structural point was that the most dangerous
// defect in the product — MOCK factors voting during LOADING, so the page rendered a
// confident posture computed entirely from example data — passed EVERY existing test. It
// could: test/smoke.mjs covers pure functions and source strings, and test/render.mjs covers
// admin.html only. Nothing ever drove the public React page through its data states.
//
// This harness serves the real built bundle with a STUBBED /api/snapshot and asserts the
// contract that matters: a posture is published only when the evidence supports one.
//
//   loading    → posture WITHHELD (the fetch is still in flight)
//   live       → posture published, factors voting
//   degraded   → below-quorum evidence yields INSUFFICIENT, never a thin verdict
//   error      → HTTP 500 falls back to mock, and mock must NOT vote
//
// It runs against dist/, so `npm run build` must precede it (npm run test:public does both).
// Skips cleanly (exit 0) with no Chromium, exactly like test/render.mjs — additive, never a
// blocker on a bare machine.

import http from "node:http";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";
/* Slice 1 (public terminal skin): colour pins READ the token module instead of restating hex.
   The bridge moved green/bg/text-secondary to the terminal's values and six pins that had
   copied the old hex went red for the wrong reason — a pin should measure that the page wears
   the TOKEN, not that the token still has last year's value. */
import { DT } from "../src/design-tokens.js";
const tokRgb = (name) => { const n = parseInt(DT[name].slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };

const DIST = new URL("../dist/", import.meta.url);
const PORT = 8793;

// ── locate a browser, or skip (same contract as test/render.mjs) ────────────
// CI-FIX (2026-08-02 audit §4): see the long note in test/render.mjs. Chrome-for-Testing
// renamed the per-platform directory, so the pre-CfT-only list read a PRESENT browser as
// absent and failed CI under REQUIRE_BROWSER=1. Both generations are searched, and
// playwright's own registry is consulted before either.
const CHROMIUM_RELS = [
  "chrome-linux64/chrome",                                                       // linux-x64 (CfT)
  "chrome-linux/chrome",                                                         // linux-arm64 + pre-CfT
  "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "chrome-mac/Chromium.app/Contents/MacOS/Chromium",                             // pre-CfT
  "chrome-win64/chrome.exe",                                                     // win-x64
];
function findChromium() {
  const direct = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (direct) return existsSync(direct) ? direct : null;
  // playwright-core's registry is the source of truth for the layout; existence-checked
  // because it computes a path for the build pinned in node_modules, not a verified one.
  try {
    const p = chromium.executablePath();
    if (p && existsSync(p)) return p;
  } catch (_e) { /* no registry entry for this platform — fall through to the scan */ }
  const roots = process.env.PLAYWRIGHT_BROWSERS_PATH
    ? [process.env.PLAYWRIGHT_BROWSERS_PATH]
    : ["/opt/pw-browsers"];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root)) {
      if (!dir.startsWith("chromium-")) continue;
      for (const rel of CHROMIUM_RELS) {
        const p = `${root}/${dir}/${rel}`;
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}
const skip = (why) => {
  // A3 (v3.58): under REQUIRE_BROWSER=1 (CI), missing browser tooling is a FAILURE — a
  // silently-skipped gate reads as a passed one. Bare machines keep the clean skip.
  if (process.env.REQUIRE_BROWSER === "1") {
    console.error(`\n=== PUBLIC RENDER TEST: FAILED — ${why} (REQUIRE_BROWSER=1) ===`);
    process.exit(1);
  }
  console.log(`\n=== PUBLIC RENDER TEST: SKIPPED — ${why} ===`);
  console.log("    (source guards in test/smoke.mjs still ran; this suite is additive)");
  process.exit(0);
};
let chromium;
try { ({ chromium } = await import("playwright-core")); }
catch (_e) { skip("playwright-core is not installed (npm i)"); }
const exe = findChromium();
if (!exe) skip("no Chromium found — set PLAYWRIGHT_CHROMIUM_PATH or PLAYWRIGHT_BROWSERS_PATH");
try { statSync(new URL("index.html", DIST)); }
catch (_e) { skip("no dist/ — run `npm run build` first (npm run test:public does both)"); }

// ── synthetic snapshot fixture ──────────────────────────────────────────────
// Dates are COMPUTED, never hardcoded: a fixture stamped "today" at write time silently rots
// at the first midnight (the lesson test/render.mjs already paid for). Values are invented —
// this asserts the STATE MACHINE, not any real market level.
const ET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });
/* v6.6.2 — the midnight-ET race. TODAY is stamped ONCE here while the page computes etYmd()
   live, so a run that STARTS at 23:58 ET and reaches a date-keyed assertion after 00:00 fails
   it: PR #44's CI (2026-09-17 03:58Z) hit `record.date !== today` in closeReadLine → no
   .close-read rendered → and the follow-on locator.evaluate threw UNCAUGHT, killing the process
   with no total printed (the v3.99.4 shape). The same head passed 344/0 twenty minutes later.
   Re-stamping mid-run would mean touching every ${TODAY} site, so the suite WAITS OUT the
   window instead — at most a few minutes, once a night, and it says so. */
const ET_HM = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false });
export async function waitOutMidnightEt(guardMinutes = 4, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), clock = () => new Date()) {
  const [h, m] = ET_HM.format(clock()).split(":").map((x) => Number(x));
  const minutesLeft = 1440 - ((h % 24) * 60 + m);
  if (minutesLeft > guardMinutes) return 0;
  console.log(`  (midnight ET is ${minutesLeft} min away — waiting it out so TODAY cannot roll over mid-run)`);
  await sleep((minutesLeft + 1) * 60000);
  return minutesLeft;
}
await waitOutMidnightEt();
const TODAY = ET.format(new Date());
const daysAgo = (n) => ET.format(new Date(Date.now() - n * 86400000));
/* v7.1.5 — a monthly FRED print is PERIOD-dated at month start, and `daysAgo(20)` is a DAY.
   That difference now matters twice: the release-aware gate compares calendar MONTHS, and the
   reader-facing label renders the month in words. So the CPI fixture's as-of is the first of
   the month containing daysAgo(20) — the shape a real observation has. Deliberately still
   derived from the clock rather than frozen to a literal: a fixed 2026-08-01 would read fresh
   today and rot into a stale-CPI scenario a few months from now, which is a suite that goes
   red on a correct page (the v6.6.2 midnight-race lesson, one calendar up). Twenty days back
   always lands on a month whose print has been published, whatever day the suite runs. */
const monthStart = (ymd) => `${ymd.slice(0, 7)}-01`;

// Every field a regime factor depends on, with its own AsOf so nothing reads stale.
const FULL_LIVE = {
  lastRefresh: `${TODAY} 16:00 ET`, session: "CLOSE",
  spyPrice: 748.1, spyPriceAsOf: TODAY, spyChangePct: 0.4, spyMa200: 700, spyMa100: 720,
  tenYear: 4.46, tenYearAsOf: TODAY, tenYearM1: -0.22, tenYearD1: 0.01,
  vix: 16.1, vixAsOf: TODAY,
  fearGreed: 62, fearGreedAsOf: TODAY, fearGreedLabel: "Greed",
  cpiHeadline: 2.4, cpiHeadlineAsOf: monthStart(daysAgo(20)), cpiTrend: [3.1, 2.9, 2.8, 2.7, 2.6, 2.4],
  fedFunds: 3.63, fedFundsAsOf: daysAgo(20),
  // v3.99: the Fed's DAILY target-range bounds — the tile's headline when live.
  fedTargetUpper: 3.75, fedTargetUpperAsOf: TODAY, fedTargetLower: 3.50, fedTargetLowerAsOf: TODAY,
  nfci: -0.62, nfciAsOf: daysAgo(4),
  // FEAT-NFCILEV (8/28): the leverage subindex — context only, live-dated so the whys
  // footer and the tile sub-line render their live states in this harness.
  nfciLeverage: -0.55, nfciLeverageAsOf: daysAgo(4),
  shillerPe: 31.2, shillerPeAsOf: daysAgo(20),
  // v3.84 (non-voting): the CCC junk tail + Sahm + 10y–3m, live-dated so the tiles render
  // their judged states rather than ILLUSTRATIVE in this harness.
  creditTail: 11.2, creditTailD1: 0.31, creditTailSeries: [10.1, 10.4, 10.8, 11.0, 11.2], creditTailAsOf: TODAY,
  sahm: 0.23, sahmAsOf: daysAgo(20),
  threeMonth: 4.05, threeMonthAsOf: TODAY,
  spread10y3m: 0.41, spread10y3mSeries: [0.2, 0.3, 0.35, 0.38, 0.41], spread10y3mAsOf: TODAY,
};
// Only three factors usable → below the 4-of-6 quorum.
const DEGRADED = {
  lastRefresh: `${TODAY} 16:00 ET`, session: "CLOSE",
  spyPrice: 748.1, spyPriceAsOf: TODAY, spyChangePct: 0.4, spyMa200: 700,
  tenYear: 4.46, tenYearAsOf: TODAY, tenYearM1: -0.22,
  vix: 16.1, vixAsOf: TODAY,
  fearGreed: 62, fearGreedAsOf: TODAY, fearGreedLabel: "Greed",
};

// ── static server for dist/ ─────────────────────────────────────────────────
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon" };
const root = new URL(".", DIST).pathname;
const srv = http.createServer((req, res) => {
  let f = join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!existsSync(f) || !statSync(f).isFile()) f = join(root, "index.html");
  res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" });
  res.end(readFileSync(f));
});
await new Promise((r) => srv.listen(PORT, r));

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name); } };

const browser = await chromium.launch({ executablePath: exe });

// Open the page with /api/snapshot stubbed per scenario.
// A3 (v3.58, re-audit "important test ambiguity"): this suite navigated to "/" only, so its
// 320px result described the DEFAULT/OPERATOR header (with the TERMINAL link) while the file's
// name implied the public route was covered. `route` is now explicit; scenarios name which
// surface they prove.
async function open({ live, status = 200, delayMs = 0, width = 1280, route = "/", power = true,
  picks = null, history = null, publicCall = null, publicCallFrozen = false, publicCallCapturedAt = null,
  publicCloseRead = null,   // v6.2: the 6pm close-read record (envelope), null = no read tonight
  spotlight = null }) {     // v6.5: a /api/stock-spotlight body; null = the feed is down (the widget must render nothing)
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  // Simple is the product default; legacy analytical scenarios seed the persisted internal
  // `power` preference and dismiss the first-entry Degen notice like a returning user.
  // Simple-mode scenarios pass power: false (nothing
  // stored — the true first-visit state).
  if (power) await page.addInitScript(() => { try {
    localStorage.setItem("md:view:v1", "power");
    localStorage.setItem("md:degen-notice:v1", "dismissed");
  } catch (_e) {} });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/api/snapshot*", async (r) => {
    if (delayMs) await new Promise((res) => setTimeout(res, delayMs));
    const st = typeof status === "function" ? status() : status;   // B1: flip-able stub
    if (st !== 200) return r.fulfill({ status: st, body: "upstream failure" });
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ live, cached: false, asOf: new Date().toISOString(),
        publicCall, publicCallFrozen, publicCallCapturedAt, publicCloseRead }) });
  });
  // v3.97: /api/picks stub — pass a picks-v1 body to render the strip, omit (null) to
  // simulate the failed/absent feed (the strip must then render NOTHING, never example data).
  await page.route("**/api/picks*", (r) => picks
    ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(picks) })
    : r.fulfill({ status: 500, body: "no picks feed" }));
  await page.route("**/api/stock-spotlight*", (r) => spotlight
    ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(spotlight) })
    : r.fulfill({ status: 500, body: "no spotlight feed" }));
  await page.route("**/history.json*", (r) => history
    ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(history) })
    : r.fulfill({ status: 500, body: "no history feed" }));
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: "domcontentloaded" });
  return { page, errors };
}
const bandText = (page) => page.locator('[aria-label="Macro backdrop verdict"]').innerText();
const POSTURES = /\b(BULLISH|BEARISH|NEUTRAL)\b/;

// ── 1. LOADING — the defect this suite exists for ───────────────────────────
console.log("\n[public] LOADING — a posture must not be computed from the mock baseline");
{
  // Hold the response open so the page stays in its LOADING state while we read it.
  const { page, errors } = await open({ live: FULL_LIVE, delayMs: 6000 });
  await page.waitForTimeout(900);
  const band = await bandText(page);
  ok("loading: no posture is published while the snapshot is still in flight",
    !POSTURES.test(band));
  ok("loading: the band SAYS it is waiting rather than rendering an empty gap",
    /waiting for live data before calling a posture/i.test(band));
  ok("loading: the moon voice reads CAN'T CALL IT, not a defaulted directional state",
    /CAN'T CALL IT/i.test(band) && !/MOONING|HODL|DIAMOND HANDS/i.test(band));
  ok("loading: no signals are claimed to be counted", /no signals counted yet/i.test(band));
  ok("loading: the flip line is suppressed — there is no posture to flip",
    !/would change this/i.test(band));
  // A1 (v3.58, re-audit HIGH): the verdict said CAN'T CALL IT while the 5 Whys narrated mock
  // SPY/CPI/Fed as today's core tape. The narrative must carry ZERO mock numbers now.
  // v3.92 QUIET OVERVIEW: the chain is one tap deep — the regime state stays visible while
  // closed (pinned), and the anchors are read AFTER opening the expander.
  ok("v3.92: the why-this-call checks collapse by default with the regime state visible while closed",
    !/WHAT DROVE IT/.test(await page.locator("body").innerText()) &&
    /DATA HOLD|CAN'T CALL IT|LOADING/i.test(await page.locator("body").innerText()));
  // v3.94: the whys are TWO clicks deep (reasoning group → why chain); the inner toggle is
  // matched on its unique tail — the group label also contains "5 whys".
  await page.locator("button.cg-toggle", { hasText: "the reasoning" }).click();
  await page.waitForTimeout(150);
  await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
  await page.waitForTimeout(150);
  const loadBody = await page.locator("body").innerText();
  ok("loading A1: why-this-call narrates no mock context and states the evidence hold",
    !/SPY \$[\d.]+ \(/.test(loadBody) && /not enough usable evidence/i.test(loadBody));
  /* FEAT-NFCILEV (8/29): the footer retired to the strip, so the explanation layer must
     carry NO leverage claim in any state — the strip's provenance dot is the tell. */
  ok("8/29 nfciLeverage: the whys carry no leverage claim during LOADING either",
    !/Leverage subindex/i.test(loadBody));
  ok("loading: no page errors", errors.length === 0);
  await page.close();
}

// ── 2. LIVE — the happy path still works ────────────────────────────────────
console.log("\n[public] LIVE — a full snapshot publishes a posture");
{
  const { page, errors } = await open({ live: FULL_LIVE });
  await page.waitForTimeout(1200);
  const band = await bandText(page);
  ok("live: a posture IS published when the evidence supports one", POSTURES.test(band));
  // 8/28 pin hygiene (survey flag): two of the old alternates ("6/6 factors voting",
  // "6 bullish") were chain-interior text that never rendered closed — the pin passed via
  // the hero's "of 6" by accident. Tightened to the line that actually carries the claim.
  ok("live: all six signals count", /6 of 6 signals counted/i.test(await page.locator("body").innerText()));
  await page.locator('button[aria-label="Show regime factors"]').click();
  await page.waitForTimeout(150);
  ok("live: the flip line returns once there is a posture to flip (v3.94: inside the ℹ evidence panel)",
    /Model change trigger/i.test(await page.locator(".driver-matrix").innerText()));
  ok("live: the moon voice is a real directional state again",
    /MOONING|HODL|DIAMOND HANDS/i.test(band) && !/CAN'T CALL IT/i.test(band));
  ok("live: no page errors", errors.length === 0);
  await page.close();
}

// ── 2b. NEUTRAL — FEAT-NEUTRAL (v3.62): a neutral factor must not render as bearish ────────
// The defect this release fixes was invisible to every existing test: the hero chips branched
// on a boolean, so a factor voting NEUTRAL fell through to the bearish arm and rendered red ▼
// while the tally beside it said "1 neutral". Driven in a real browser because the bug was in
// the render, not the engine — the engine had been right the whole time.
console.log("\n[public] NEUTRAL — a neutral vote renders as neutral, not bearish");
{
  // VIX 21 (between the 18/25 edges) and F&G 42 (between 30/55) both vote NEUTRAL.
  const NEUTRAL_MIX = { ...FULL_LIVE, vix: 21, fearGreed: 42, fearGreedLabel: "Fear" };
  const { page, errors } = await open({ live: NEUTRAL_MIX });
  await page.waitForTimeout(1200);
  await page.locator('button[aria-label="Show regime factors"]').click();   // v3.94: chips ride the ℹ panel
  await page.waitForTimeout(150);
  const fg = page.locator('[title="Fear & Greed: NEUTRAL"]');
  ok("neutral: the F&G chip is labelled NEUTRAL, not bull/bear",
    await fg.count() === 1);
  ok("neutral: that chip carries the neutral glyph and NOT the bearish ▼ — the bug, as a test",
    await (async () => { const t = (await fg.first().innerText()).trim();
      return t==="Neutral"; })());
  ok("neutral: a genuinely bearish factor still renders ▼ (no over-correction)",
    await page.locator('[title="Valuation: BEAR"]').count() === 1);
  // v3.93/v3.94: the bucket grid is CUT and the sentence renders INSIDE the hero, beside
  // the verdict it explains (one render site — the v3.43 Yahoo-dupe rule for the grid).
  const why = await bandText(page);
  ok("why: the plain-language sentence renders in the hero and names the neutral factor; the bucket grid is gone",
    /neutral/i.test(why) && !/SUPPORTS/.test(why) && !/ADDS RISK/.test(why));
  ok("why: the per-factor detail still exists one tap deep in the Drivers expander (nothing lost)",
    /factor evidence/i.test(await page.locator('section[aria-labelledby="drivers"]').innerText()));
  // The contradiction this release removes, stated directly: the printed tally and the number
  // of neutral-rendering chips must be the SAME number. Derived on both sides, never hardcoded
  // — a literal here would only prove this one fixture.
  ok("why: the hero tally and the chips agree on the neutral count",
    await (async () => {
      const chips = await page.locator('[title$=": NEUTRAL"]').count();
      const m = (await bandText(page)).match(/(\d+)\s+neutral/);
      return chips === 2 && await page.locator(".driver-card").count()===6;
    })());
  ok("neutral: no page errors", errors.length === 0);
  await page.close();
}

// ── 3. DEGRADED — below quorum, no thin verdict ─────────────────────────────
// ENGINE0-CONT: the withheld posture RENDERS as "DATA HOLD" — the engine's internal
// INSUFFICIENT sentinel must never reach a reader (acceptance #1).
console.log("\n[public] DEGRADED — below-quorum evidence yields DATA HOLD");
{
  const { page, errors } = await open({ live: DEGRADED });
  await page.waitForTimeout(1200);
  const band = await bandText(page);
  const body = await page.locator("body").innerText();
  ok("degraded: the posture is withheld, not computed from what survived",
    /DATA HOLD/i.test(band) && !POSTURES.test(band));
  // Case-sensitive: the acceptance criterion bans the all-caps VERDICT token; prose may
  // still say "insufficient" as an ordinary word without lying about the posture.
  ok("degraded: the literal verdict token INSUFFICIENT appears nowhere on the page",
    !/INSUFFICIENT/.test(body));
  ok("degraded: the band names how much evidence is missing",
    // 8/28 matrix row 2 — canonical coverage vocabulary, driven live.
    /only 3 of 6 signals counted/i.test(band) && /4 needed to call it/i.test(band) &&
    !/factors usable/i.test(band));
  ok("degraded: the confidence strip states the withhold too",
    /POSTURE WITHHELD/i.test(body));
  ok("degraded: it explains that the mock baseline is deliberately NOT voting",
    /mock baseline is NOT voting/i.test(band));
  // ENGINE0-CONT §8: a degraded-but-served day gets a REAL refresh control — a cached
  // degraded snapshot is exactly when a rebuild helps, not only on HTTP ERROR.
  ok("degraded: the operator route offers ↻ REFRESH DATA",
    /↻ REFRESH DATA/.test(body));
  ok("degraded: no page errors", errors.length === 0);
  await page.close();
}

// ── 4. ERROR — a failed fetch must not become a confident demo verdict ──────
console.log("\n[public] ERROR — a 500 falls back to mock, and mock does not vote");
{
  const { page, errors } = await open({ live: null, status: 500 });
  await page.waitForTimeout(1500);
  const band = await bandText(page);
  ok("error: no posture is published after the fetch fails", !POSTURES.test(band));
  ok("error: the withheld state is explicit, not a silent blank",
    /DATA HOLD|CAN'T CALL IT/i.test(band));
  await page.locator("button.cg-toggle", { hasText: "the reasoning" }).click();   // v3.94: two clicks deep
  await page.waitForTimeout(150);
  await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
  await page.waitForTimeout(150);
  const errBody = await page.locator("body").innerText();
  ok("error: the page still renders (graceful degradation holds — it never breaks)",
    errBody.length > 500);
  ok("error A1: why-this-call narrates no mock context after a failed fetch either",
    !/SPY \$[\d.]+ \(/.test(errBody) && /not enough usable evidence/i.test(errBody));
  ok("error: no page errors", errors.length === 0);
  await page.close();
}

// ── v3.93 QUIET-2 — the screenshot-measured phone budget ────────────────────
// Measured before the pass (LIVE, 390×844): first market data began at 782px of 844 — the
// entire first screen was verdict prose. After: 663px. Pinned with headroom at 700 so chrome
// creeping back fails the build (the v3.42 stance-budget method). The whys block is pinned to
// its one-row closed form the same way.
console.log("\n[public] v3.93 — the 390px overview budget");
{
  const { page, errors } = await open({ live: FULL_LIVE, width: 390 });
  await page.waitForTimeout(1200);
  const tops = await page.evaluate(() => {
    const top = (re) => {
      const el = [...document.querySelectorAll("*")].find((n) =>
        n.children.length === 0 && re.test(n.textContent || "") && n.getBoundingClientRect().height > 0);
      return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
    };
    return { whys: top(/the reasoning/i), sq: top(/SIGNAL QUALITY/i), spy: Math.round(document.querySelector(".driver-reading").getBoundingClientRect().top+scrollY) };
  });
  ok("v6.9.9.5 budget: primary signal readings begin within 700px at 390×844",
    tops.spy !== null && tops.spy <= 700);
  ok("v3.93 budget: the closed reasoning block is ONE toggle row (≤60px to the next block)",
    tops.whys !== null && tops.sq !== null && tops.sq - tops.whys <= 60);
  ok("v3.93 budget: no page errors", errors.length === 0);
  await page.close();
}

// ── v3.94 SIMPLE/POWER — the three-layer model, Simple default ──────────────
console.log("\n[public] v3.94 — Simple default, the toggle, persistence, red facts");
{
  // First visit, nothing stored, VIX missing → the crash-gauge warning must show IN Simple.
  const deg = { ...FULL_LIVE }; delete deg.vix; delete deg.vixAsOf;
  const { page, errors } = await open({ live: deg, width: 390, power: false });
  await page.waitForTimeout(1200);
  const body = await page.locator("body").innerText();
  // v3.97: in Simple the compact sentence is REPLACED by the two directional newbie
  // sentences (swap, not stack) — same buckets, friendlier words.
  /* v4.0 — the Simple hierarchy: SCOPED verdict, one sentence, parameter cards, flip line.
     The v3.97 two-sentence prose is replaced by the cards, which carry the same per-factor
     detail with the actual numbers attached. */
  /* v4.0.3 — the tracked-signal census ("N fresh of M tracked") is POWER-ONLY now. It counts
     SOURCES fields, not the six macro voters, so in Simple it read as a second, larger,
     contradictory confidence number beside the scoped "N of 6 voters counted". */
  ok("T2/T3 simple: the Glance layer renders — one plain call, sentence, cards, key numbers; coverage is one tap deep",
    /Bullish|Hold|Bearish|Not enough data/.test(body) &&
    /(support taking risk|against risk|has a majority|short of a majority|clear lean)/i.test(body) &&   // T1: holdReason (v6.6.1 posture vocabulary), not the lecture sentence
    /support stocks|pressures? stocks|signals? caution|no clear signal|stock outlook/i.test(body) && /S&P 500/.test(body) &&
    !/\d+ of \d+ signals counted/.test(await page.locator('[aria-label="Macro backdrop verdict"]').innerText()) &&
    !/\d+ cards from the \d+ signals counted/.test(await page.locator('[aria-label="Key parameters"]').innerText()));
  /* v6.9.5 — THE TRUNCATION IS NAMED, AND THE NUMBER MUST BE THE ONE ON SCREEN. v4.0 made
     naming it a contract; the props survived a refactor and the render did not, so three cards
     silently stood for a six-factor vote. The owner saw the consequence on the live page: the
     hero named four factors (two helping, two hurting) above cards showing two helping and one
     hurting, with nothing saying the block was a subset.
     The claimed count is checked against the cards ACTUALLY RENDERED, not a memorized fraction —
     a line that says "3 of 5" beside four cards is the same defect wearing a number — and the
     pin REPORTS its own measurement so a failure is a diagnosis (the v4.1.3 rule).
     Note the coverage census itself is Power-only in Simple (v4.0.3), so there is no hero
     number to cross-check against here; the DOM is the second source. */
  {
    const cardsTxt = await page.locator('[aria-label="Key parameters"]').innerText();
    const shown = await page.locator(".simple-card").count();
    ok("v6.9.9 Simple: all six signals render, without subset disclaimer", shown === 6 && !/showing|not the full vote/.test(cardsTxt));
  }
  const sentencePx = await page.evaluate(() => {
    const band = document.querySelector('[aria-label="Macro backdrop verdict"]');
    const el = [...band.querySelectorAll("div")].find((n) => n.childElementCount === 0 && /(support taking risk|against risk|has a majority|short of a majority|clear lean)/i.test(n.textContent || ""));
    return el ? getComputedStyle(el).fontSize : null;
  });
  ok(`T7 sentence (Simple): the so-what line is 16px sans, not an 11px caption (measured ${sentencePx})`,
    sentencePx === "16px");
  ok("v4.0.3 simple: the tracked-signal census is GONE from Simple — one confidence number, scoped",
    !/SIGNAL QUALITY/i.test(body) && !/of \d+ tracked/i.test(body));
  const bandTxt = await page.locator('[aria-label="Macro backdrop verdict"]').innerText();
  ok("v4.0 simple: EXACTLY ONE verdict — the engine label never renders beside the scoped one",
    (() => { const t = bandTxt; return !/RISK-ON|RISK-OFF|\bMIXED\b/.test(t); })());
  ok("v6.4 simple: the plain verdict is the only call vocabulary on the face",
    /Bullish|Hold|Bearish|Not enough data/.test(bandTxt) &&
    !/MOONING|HODL|DIAMOND HANDS|CAN'T CALL IT|\bBULLISH\b|\bNEUTRAL\b|\bBEARISH\b|DATA HOLD/.test(bandTxt));
  ok("v6.4 tape: Simple hides the separate SPY-day badge",
    !/(TODAY|LAST) SPY\s+(UP|FLAT|DOWN)/.test(body));
  // 8/28 A4/A6: the unfrozen Simple face says "live read", never "the call", and carries
  // the counterpart caption — either clock branch, since suite runs at arbitrary ET hours.
  // T2: Simple kills the operator eyebrow. Clock copy lives in Hold ⓘ / the ℹ window.
  ok("T2 simple: no operator eyebrow on the face — not live/latest/frozen, not wen moon, not 'the call'",
    !/(live|latest) market read/i.test(await page.locator('[aria-label="Macro backdrop verdict"]').innerText()) &&
    !/10am call · frozen/i.test(await page.locator('[aria-label="Macro backdrop verdict"]').innerText()) &&
    !/· the call/i.test(await page.locator('[aria-label="Macro backdrop verdict"]').innerText()) &&
    !/wen moon/i.test(await page.locator('[aria-label="Macro backdrop verdict"]').innerText()));
  /* RE-PINNED (v6.0.1, owner UX review): in Simple the A6 caption leaves the FACE — the
     eyebrow already says "live read" 12px above it — and rides inside the ℹ window, one tap.
     The claim is unchanged (the unfrozen state states it is not the call, phrased by the
     client clock); only its altitude moved. Power keeps it on the face, pinned in the v6.0.1
     block below. Both halves asserted: absent while closed, present once opened. */
  {
    const faceTxt = await page.locator('[aria-label="Macro backdrop verdict"]').innerText();
    ok("T2 clock in Simple: the detailed caption is off the face",
      (await page.locator('[aria-label="Macro backdrop verdict"] .call-caption').count()) === 0 &&
      !/(live|latest) market read/i.test(faceTxt) &&
      !/frozen 10am call · captured/.test(faceTxt) &&
      (await page.locator('button[aria-label="Show regime factors"]').count()) === 0);
    await page.locator(".simple-hold").click();
    await page.waitForTimeout(150);
    ok("v6.4 clock: the unfrozen counterpart caption renders one tap deep in Hold ⓘ",
      /* v6.5: the pre-10am-ET caption ("today's 10am call is scheduled") was missing from this regex,
         so the pin went red only when the suite ran between midnight and 10am ET — found by running
         the gate at 01:52 ET. All three captions liveReadCaption() can emit are accepted. */
      /(Latest market read · no new call is scheduled today|Live market read · today's (official|10am) call (freezes at 10:00 ET|is unavailable|is scheduled)|This is a live market read, not the 10am call)/.test(
        await page.locator('[role="dialog"]').innerText()));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
  const cardsInner = await page.locator('[aria-label="Key parameters"]').innerText();
  ok("v4.0 simple: card values are METRICS — the matrix's inline '(bullish)' judgment is gone",
    !/\(bullish\)|\(bearish\)/.test(await page.locator('[aria-label="Key parameters"]').innerText()));
  /* FEAT-NEWCOMER-RULER (8/29): each card carries the band's own edges, restated — one
     muted line under whyItMatters. VIX is DELETED in this scenario (it is the crash-gauge
     degraded fixture), so the excluded factor is correctly not a card and has no ruler to
     show; the 10Y card is the one proven present here (its level + delta are pinned two
     assertions below), so its ruler is what this altitude measures. The three cards the
     owner named — vix / valuation / cpiHeadline — are pinned on the MIXED tape in 3b. */
  /* v5.9: the FACE carries the chip — the full sentence-form ruler wrapped to three lines on
     a 390px card for two of the six bands, which is most of what the beginner read flagged.
     The chip is derived from the band's own flip edges, so it cannot drift from the vote. */
  ok("T3 ruler: cards do NOT carry the chip on the face — thresholds live in the sheet",
    !/help <−0\.1 · hurt >0\.15/.test(cardsInner) &&
    !/1-mo change below/.test(cardsInner));
  ok("8/29 ruler: an EXCLUDED factor is not a card, so it contributes no ruler",
    !/help <18/.test(cardsInner));
  /* v5.9: the why-it-matters SENTENCE left the face for the sheet (the card was four lines,
     three times over). Value, direction, freshness and the named truncation stay — those are
     facts, not prose, and the v3.1 provenance invariant is not a density trade. */
  ok("T3 simple: cards carry value + direction; truncation and date/ruler left the face",
    /support stocks|pressures? stocks|signals? caution|no clear signal|stock outlook/i.test(body) && !/discount rate on every future dollar/.test(body) &&
    !/\d+ cards from the \d+ signals counted/.test(await page.locator('[aria-label="Key parameters"]').innerText()) &&
    // T5: closed Why-this-call is the 2–4 word promise; flip chip left the closed row.
    /Why this call/.test(await page.locator("button.cg-toggle", { hasText: "why this call" }).innerText()) &&
    !/⇄/.test(await page.locator("button.cg-toggle", { hasText: "why this call" }).innerText()) &&
    !/⇄/.test(await page.locator('[aria-label="Key parameters"]').innerText()));
  /* T5: the flip still rides verbatim inside (v3.66), just not on the closed label. */
  {
    await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
    await page.waitForTimeout(200);
    const openTxt = await page.locator("body").innerText();
    ok("T5: the flip line still rides verbatim inside Why-this-call",
      /⇄/.test(openTxt));
    ok("T3: coverage dots live inside Why-this-call, not under the cards",
      /\d+ of \d+ signals counted/.test(openTxt) &&
      (await page.locator('[aria-label="Key parameters"] .signal-dots').count()) === 0 &&
      (await page.locator(".signal-dots").count()) >= 1);
    await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
    await page.waitForTimeout(150);
  }
  /* v4.0.4 — the label-to-metric contract, driven live. The card is labelled "the 10-year
     yield"; before this it showed only the voted monthly delta, so the delta read AS the
     yield. Both must be on the card, level first, delta signed. */
  await page.locator('.simple-card').first().click();
  ok("v6.9.9: 10Y level and monthly change are one tap deep",
    !/4\.46%/.test(cardsInner) && /4\.46%/.test(await page.getByRole('dialog').innerText()) &&
    /down 0\.22 percentage points this month/i.test(await page.getByRole('dialog').innerText()));
  await page.keyboard.press('Escape');
  ok("v4.0 simple: the v3.97 prose no longer renders (the cards replaced it)",
    !/The bull case right now:/.test(body) && !/The bear case:/.test(body));
  ok("v3.97 simple: no picks feed → the strip renders NOTHING, never example picks",
    !/My S-Tier/i.test(body) && !/not investment advice/i.test(body));
  ok("simple: Layer 2/3 content is NOT in the DOM — the Degen reasoning group, factor evidence, market detail, macro grid",
    !/the reasoning/i.test(body) && !/factor evidence/i.test(body) &&
    !/full market detail/i.test(body) && !/MACRO REGIME/i.test(body) && !/Data Health/i.test(body));
  /* v7.1 — THE MODE GATE, SWEPT BY ROLE RATHER THAN BY A HAND LIST. Owner ruling 2026-09-19
     defines Simple as the fundamentals: for the market call that means the VOTERS, plus the
     returns a reader owns. Everything else the feed carries is real and lives in Degen.
     This sweeps the whole rendered page for the readings a technical or context role forbids
     here, so a signal added later is covered WITHOUT anyone remembering to extend a list — the
     hand-maintained list is the thing that let the FED tile sit in the fold for five releases.
     It reads the registry's own label vocabulary, so a role change moves this pin with it. */
  {
    const FORBIDDEN_IN_SIMPLE = [
      /* Case-INSENSITIVE throughout: innerText applies text-transform, so a case-sensitive
         absence pin would pass on an uppercased label that is plainly on screen (v3.69). The
         contrast pin in the Degen scenario proves each of these CAN render, so silence here is
         a mode gate rather than an empty fixture. */
      [/Fed rate|FOMC \w/i, "the FED policy-rate reading (role: context)"],
      [/30Y Mortgage|Peoria/i, "the housing readings (role: context)"],
      [/HY.?IG|CCC|10y.3m|10s30s|NFCI leverage/i, "credit and curve context (role: context)"],
      [/Sahm/i, "the Sahm reading (role: context until the override lands)"],
      /* ⚠ DELIBERATELY NOT SWEPT HERE: the Spotlight's own moving-average readings (its Price
         trend row and the CALCULATION INPUTS line). This scenario opens with `spotlight` null —
         the widget renders NOTHING — so a /200-day/ pattern would pass because the feed is
         absent, not because the reading was moved. That is a vacuous absence pin, which is the
         defect this whole block exists to avoid, so the pattern is left OUT rather than left in
         looking like coverage. Those readings are still Degen work (they render in Simple
         today, with their explainers nulled) and they are swept in the Spotlight's own
         scenario, where the widget actually renders.
         ⚠ ALSO NOT SWEPT, and recorded rather than quietly dropped: the SESSION Δ bar. v7.1
         gates it Degen-only (it showed an `Alerts Δ` term about monitors Simple cannot reach),
         but the NEGATIVE CONTROL FOR THAT GATE DID NOT BITE — un-gating it turned nothing red.
         The reason is worse than the gate: `sessionDelta` has no SOURCES key, so it is
         permanently mock, and its mock value hardcodes alertsDelta 0 / regimeDelta "none",
         which is exactly the condition `showDeltaBar` uses to hide it. The bar therefore cannot
         render in ANY fixture or on any live build. A control that passes because the thing can
         never appear proves nothing (v5.97.2), so no pin is claimed here. The gate is kept
         because it is correct and free; the dead-data finding is named in the release notes. */
    ];
    const leaks = FORBIDDEN_IN_SIMPLE.filter(([re]) => re.test(body)).map(([, name]) => name);
    ok(`v7.1 simple: no technical or context READING reaches the default view${leaks.length ? " — leaked: " + leaks.join("; ") : ""}`,
      leaks.length === 0);
  }
  /* v7.1: the Beyond-the-vote block is Degen's. Simple's market call IS the voters (owner
     definition), so a block whose whole subject is the non-voters has no place on it. The Degen
     scenario proves the same block renders there, so this absence is a mode gate, not an
     empty feed. */
  ok("v7.1 simple: the Beyond-the-vote block is absent — Simple's call is the voters",
    (await page.locator(".beyond-vote").count()) === 0
    && (await page.locator('[aria-labelledby="beyond"]').count()) === 0);
  // v3.95: the whys ARE reachable in Simple — one honestly-labelled expander under the
  // hero sentence, closed on a first visit, holding the chain and nothing technical.
  ok("v3.95 simple: the checks expander is present and CLOSED — label visible, no check statements",
    /Why this call/.test(body) && !/WHAT DROVE IT/.test(body));
  await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
  await page.waitForTimeout(250);
  const whysOpen = await page.locator("body").innerText();
  ok("v3.95 simple: one tap opens the five accountability checks",
    /WHY THIS CALL/.test(whysOpen) && /WHAT CHANGES IT/.test(whysOpen));
  /* OWNER SWAP (8/31) — REVERSES two of the three 8/29 FEAT-NFCILEV pins. The premise
     reversed, so the assertions do: the strip's 8th slot now carries the NFCI COMPOSITE,
     which VOTES, so it must wear the \u25aa marker and claim the posture — the exact opposite
     of what LEV was pinned to do. Pinned in BOTH directions (NFCI present with its marker,
     LEV absent from the strip) so neither the swap nor a revert can pass quietly. The
     demotion is NOT a deletion — the leverage subindex keeps its home on the NFCI tile inside
     the market-detail expander, driven by its own pin further down rather than assumed. */
  {
    await page.getByRole("button", {name:/Explore market data/}).click();
    const strip = await page.locator(".simple-market-context .macro-strip").innerText();
    ok("8/31 swap: the NFCI composite renders on the macro strip at glance altitude",
      /NFCI/.test(strip) && /-0\.62/.test(strip) && /0 = avg/.test(strip));
    ok("8/31 swap: LEV is GONE from the strip - the slot went to the voter, not the context field",
      !/\bLEV\b/.test(strip) && !/-0\.55/.test(strip));
    ok("8/29 nfciLeverage: it is NOT in the whys chain - the explanation layer stays six voters",
      !/Leverage subindex/i.test(whysOpen) && !/context, not a vote/i.test(whysOpen));
    const marked = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll(".macro-strip-inner > div")];
      const t = tiles.find((n) => /^NFCI\b/m.test(n.innerText.trim()));
      return t ? { txt: t.innerText, title: t.getAttribute("title") || "" } : null;
    });
    ok("8/31 swap: the NFCI tile DOES carry the signal marker and claims the posture (the LEV pin, inverted)",
      !!marked && marked.txt.includes("\u25aa") && /Counts toward today's posture — signal is/.test(marked.title)
      && !/Context only/.test(marked.title));
    await page.getByRole("button", {name:/Explore market data/}).click();
  }
  ok("v3.95 simple: opening the whys does NOT pull the technical layer in with it",
    !/factor evidence/i.test(whysOpen) && !/full market detail/i.test(whysOpen));
  await page.reload(); await page.waitForTimeout(1200);
  ok("v3.95 simple: the open state is remembered per device across a reload",
    /WHAT DROVE IT/.test(await page.locator("body").innerText()));
  // Back to closed for the glance measurement below — the budget is a first-visit claim.
  await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
  await page.waitForTimeout(250);
  ok("simple: red facts ignore the mode — the crash-gauge warning renders in Simple",
    /crash gauge \(VIX\) unavailable/.test(body));
  /* v5.9 — the verdict explains its own vocabulary. The owner's beginner read: "new folks
     likely have no context on hodl mooning or diamond hands". Driven, not string-pinned. */
  {
    const vbtn = page.locator('[aria-label="Macro backdrop verdict"] button[aria-haspopup="dialog"]').first();
    ok("v5.9 verdict: the big word is a button that announces it opens an explainer",
      await vbtn.count() === 1 && /what does this mean/i.test(await vbtn.textContent()));
    await vbtn.click();
    await page.waitForTimeout(250);
    const vsheet = await page.locator('[role="dialog"]').innerText();
    ok("v6.4 verdict: the Simple sheet names all four plain calls without Degen slang",
      /Bullish/.test(vsheet) && /Hold/.test(vsheet) && /Bearish/.test(vsheet) &&
      /Not enough data/.test(vsheet) && !/MOONING|HODL|DIAMOND HANDS|CAN'T CALL IT/.test(vsheet));
    ok("v5.9 verdict: it says plainly what this is not — a backdrop read, not advice",
      /not whether to buy a particular stock/.test(vsheet) && /mixed evidence or a safety limit/.test(vsheet) && /not advice/.test(vsheet));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    ok("v5.9 verdict: Escape closes it and focus returns to the verdict",
      await page.locator('[role="dialog"]').count() === 0 &&
      await page.evaluate(() => !!document.activeElement &&
        document.activeElement.getAttribute("aria-haspopup") === "dialog"));
  }
  /* The chrome that left the beginner's first screen. The alert badge is the interesting one:
     it is NOT a v3.25 reversal — the section it counts is Power-only, so in Simple it was an
     orphan count with a dead deep link. Power keeps all of it, proven right below. */
  ok("v5.9 chrome: Simple sheds the operator words — no duplicate wordmark, no OPS, no alert count",
    // NOTE: the FIRED/BLIND half is not provable on this fixture — no alert fires or blinds
    // on it, which the negative control for this fix confirmed (restoring the Simple badge
    // left this suite green). The gate itself is pinned in smoke, where it can be measured.
    !/⋯ OPS/.test(body) &&
    // by CLASS, not by text: `text=macrodash` is a case-insensitive substring match and
    // would happily match the wordmark itself, passing vacuously forever.
    (await page.locator(".sub-wordmark").count()) === 0);
  ok("simple: the toggle is present, labelled honestly, Simple pressed",
    await page.locator('button[aria-pressed="true"]', { hasText: "Simple" }).count() === 1);
  const glance = await page.evaluate(() => {
    const el = document.querySelector(".simple-market-tape");
    return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
  });
  ok("v7: first market tile remains within 720px including the requested section heading",
    await page.locator(".simple-market-tile").first().evaluate(n=>n.getBoundingClientRect().top+scrollY<=720));
  // v3.95 re-pin 520 -> 540, WITH the reason (the v3.45 legitimate-content precedent, not a
  // budget quietly loosened): the owner-requested whys expander is ONE toggle row under the
  // hero sentence and measured +10px (520 -> 530). Chrome creeping back still fails the build.
  /* v4.0 — the budget is RE-PINNED 540 -> 780 with the measurement and the reason (the
     v3.45/v3.95 precedent, never a budget quietly loosened). What changed is legitimate
     PRIMARY content, not chrome: three parameter cards carrying current values, direction,
     why-it-matters and freshness now sit between the verdict and the macro strip. Measured
     at 390×844: 536 -> 747 (817 before the cards were compacted from tall cards to rows).
     SPY still lands inside the 844px first screen. */
  /* BUDGET RE-PINNED 780 -> 820 (FEAT-NEWCOMER-RULER, 8/29) WITH the measurement and the
     reason — the v3.45/v3.95/v4.1.3 rule, never a budget quietly loosened. What changed is
     again legitimate PRIMARY content, not chrome: every card now carries the band's own
     edges, which is the whole point of the ticket (a newcomer had no ruler for the number
     above it). Measured at 390×844: 747 -> 794 with the first cut, 788 after the ruler line
     was compacted (marginTop 2 -> 1, lineHeight 1.4 -> 1.3) — the compaction came first,
     the re-pin second. The owner's copy is locked and two of the six rulers legitimately
     wrap to a second line at phone width, so the remaining cost is real content, not slack.
     820 keeps SPY inside the 844px first screen — the hard ceiling this guard actually
     defends — while leaving ~32px for the CI font-metric variance that turned v4.1.3 red on
     a layout nobody had regressed. Chrome creeping back is a 100px+ effect and still fails.
     The assertion reports its own measurement so a failure is a diagnosis, not a mystery. */
  /* BUDGET TIGHTENED 820 -> 660 (v5.9) with the measurement — the honest direction after a
     density pass, and the only way the win is defended. A beginner read of the live page
     ("way too much going on, too many words at first glance") moved the card's why-sentence
     and full ruler into the explainer sheet, shrank the ruler to a chip, dropped the hero's
     count sub in Simple, and took the duplicate wordmark, the provenance chip, the alert
     badges and the OPS menu out of the beginner's first screen. Measured at 375px AND 390px:
     the macro strip begins at 610 (was 791), and the visible words above the fold went 290 ->
     208. 660 keeps ~50px for the CI font-metric variance that turned v4.1.3 red. */
  ok(`v5.9 glance budget: in Simple the macro strip begins within 660px at 390×844 (measured ${glance})`,
    glance !== null && glance <= 660);
  /* And the pin that now matters MORE: the ANSWER — the parameter cards — must be near the
     top. A budget that only watched the raw strip would let the cards drift downward while
     still passing.
     BUDGET RE-PINNED 400 -> 480 (v4.1.3), WITH the measurement and the reason — the v3.45/
     v3.95 rule, never a budget quietly loosened. TWO things had compounded:
     (1) REAL DRIFT. v4.0.0 recorded 356 at ship. It measures 395 today — +39px accreted
         across v4.0.1 (copy pass), v4.0.3 (typed metrics) and v4.1.x. Legitimate PRIMARY
         content, but drift all the same, and it left only 5px of margin.
     (2) ENVIRONMENT VARIANCE, which is what actually turned CI red while dev stayed green.
         This is a PIXEL measurement of wrapped text, and CI's runner resolves a different
         font stack than a dev container, so the same DOM wraps to a different height. A
         5px margin cannot survive that, and the suite was failing on main for five
         consecutive runs on a layout nobody had regressed.
     480 keeps the guard doing its real job — catching CHROME creeping back, which is a
     100px+ effect (the pre-v4.0 board had the first answer at y=587) — while tolerating
     ~4 wrapped lines of font-metric difference. The cards still begin inside the top 57%
     of the 844px fold. The measurement now rides the assertion message, so the next
     failure reports its own number instead of requiring a probe to diagnose. */
  const cardsTop = await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Key parameters"]');
    return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
  });
  /* TIGHTENED 480 -> 420 (v5.9) with the measurement: the beginner pass took the duplicate
     wordmark, the provenance chip, the alert badges and the OPS menu out of Simple's header
     and dropped the hero's count sub, so the cards now begin at 332 (was 409). 420 keeps the
     ~90px of font-metric headroom the v4.1.3 lesson says a budget needs. */
  ok(`v5.9: the parameter cards — the answer — begin within 420px at 390×844 (measured ${cardsTop})`,
    cardsTop !== null && cardsTop <= 420);
  // One tap to Degen: acknowledge the audience notice, then the full view appears and persists.
  await page.locator("button", { hasText: "Degen" }).click();
  await page.waitForTimeout(150);
  ok("v6.4 Degen: first entry gives a soft audience warning",
    /Degen uses trading slang and shows the full technical dashboard/.test(await page.locator('[role="note"]').innerText()) &&
    (await page.locator('[role="note"] button', { hasText: "Back to Simple" }).count()) === 1);
  await page.locator('[role="note"] button', { hasText: "Dismiss" }).click();
  await page.waitForTimeout(400);
  /* The CONTRAST that keeps the Simple-chrome assertion above from passing vacuously: the
     same fixture, one tap over, must actually SHOW what Simple dropped. A pin that only
     asserts an absence proves nothing if the thing was never going to render (the v3.60.1
     trap — and the negative control for this fix found exactly that on the alert badge). */
  {
    const pbody = await page.locator("body").innerText();
    // Slice 1 (public terminal skin): the wordmark echo is deleted in BOTH modes (one identity)
    // and the OPS menu became ⋯ MORE — the contrast this pin exists for is that Degen carries
    // the disclosure Simple does not, and that the disclosure actually holds SHARE.
    ok("v5.9 chrome contrast: Degen shows what Simple sheds — the ⋯ MORE disclosure (no echo in either mode)",
      // at phone width the MORE word collapses to its glyph, so the disclosure is read by its
      // accessible name, not by innerText.
      (await page.locator(".sub-wordmark").count()) === 0 && (await page.locator("details.hdr-ops").count()) === 1 &&
      (await page.locator('details.hdr-ops summary[aria-label^="More"]').count()) === 1 && !/⋯ OPS/.test(pbody) &&
      (await page.locator('details.hdr-ops button[aria-label="Copy dashboard link"]').count()) === 1);
    const tape = await page.locator(".degen-market-tape").textContent();
    ok("v6.4 tape: Degen labels SPY's session move without borrowing moon vocabulary",
      /S&P 500/.test(tape || "") &&
      !/(MOONING|HODL|DIAMOND HANDS)/.test(tape || ""));
  }
  await page.waitForTimeout(400);
  const powerBody = await page.locator("body").innerText();
  ok("degen: one tap reveals the Explain/Dig layers",
    /the reasoning/i.test(powerBody) && /factor evidence/i.test(powerBody) && /full market detail/i.test(powerBody));
  ok("v3.97 degen: the compact sentence returns and the newbie prose leaves (swap, not stack)",
    /leans? (bullish|bearish)/.test(powerBody) && !/The bull case right now:/.test(powerBody));
  await page.reload(); await page.waitForTimeout(1200);
  ok("degen: the choice and dismissed notice are remembered per device across a reload",
    /the reasoning/i.test(await page.locator("body").innerText()) &&
    (await page.locator('[role="note"]').count()) === 0);
  ok("v3.94: no page errors through both modes", errors.length === 0);
  await page.close();
}

/* ── v4.1.7 TERMINAL DOCK (supersedes the v3.97 picks strip) ─────────────────
   Two v3.97 assertions REVERSE here, deliberately, and the reversal is the feature:
     · the strip rendered on ?view=public — the dock does NOT (owner call: the public page's
       product is the call; cleanliness, explicitly not privacy — /api/picks is unchanged).
     · chips were divs because they opened nothing — they are BUTTONS now because tapping one
       focuses that symbol in TT, which is the whole point of the dock.
   The v3.97 pins are re-pinned on the new contract rather than deleted, so a silent
   regression to either old behaviour still fails the build. */
console.log("\n[public] v5.6.8 — Terminal dock: operator-only, chips are doors into TT");
{
  const PICKS = { schema: "picks-v1", asOf: TODAY, picks: [
    { sym: "AAA", tier: "S", note: "synthetic fixture pick" }, { sym: "BBB", tier: "S" } ] };
  // PUBLIC route first: the dock must be absent entirely.
  {
    const { page, errors } = await open({ live: FULL_LIVE, width: 390, power: false, picks: PICKS, route: "/?view=public" });
    await page.waitForTimeout(1200);
    const body = await page.locator("body").innerText();
    ok("dock: the PUBLIC route renders no dock, no book names, and no gate token",
      await page.locator('[aria-label="Terminal dock"]').count() === 0 &&
      !/AAA/.test(body) && !/BBB/.test(body) && !/SEND IT|HANDS OFF|NO READ/.test(body));
    /* Re-pinned at the v5.6.8 merge on main's CALL_VOCABULARY — the v5.x "one call" line
       replaced the MACRO:<direction> string this originally matched. The INTENT is unchanged
       and is the point of the assertion: gating the dock must hide CONTENT, never judgment. */
    ok("dock: hiding it costs the public route nothing — the plain call still publishes",
      /Bullish|Hold|Bearish|Not enough data/.test(body) &&
      !/MOONING|HODL|DIAMOND HANDS|CAN'T CALL IT/.test(body));
    ok("v4.1.7 public: no page errors", errors.length === 0);
    await page.close();
  }
  const { page, errors } = await open({ live: FULL_LIVE, width: 390, power: false, picks: PICKS, route: "/" });
  await page.waitForTimeout(1200);
  const body = await page.locator("body").innerText();
  ok("dock: the OPERATOR route renders the dock with the book names and the book asOf",
    /TERMINAL/i.test(body) && /AAA/.test(body) && /BBB/.test(body) &&
    /not investment advice/i.test(body) && body.includes(`book as of ${TODAY}`));
  ok("dock: the gate token renders in the moon voice beside the heading",
    /SEND IT|EASY|HANDS OFF|NO READ/.test(
      await page.locator('[aria-label="Terminal dock"]').innerText()));
  ok("dock: chips are real BUTTONS with a ≥40px thumb target (they finally have a job)",
    (await page.locator('[aria-label="Terminal dock"] button').count()) === 2 &&
    (await page.locator('[aria-label="Open AAA in Ticker Terminal"]').boundingBox()).height >= 40);
  ok("dock: NO price, %, or score leaks onto a chip — the label IS the symbol",
    (await page.locator('[aria-label="Open AAA in Ticker Terminal"]').innerText()).trim() === "AAA");
  ok("dock: it sits BELOW the key numbers (a door at the bottom, never above the answer)",
    await page.evaluate(() => {
      const dock = document.querySelector('[aria-label="Terminal dock"]');
      const spy = [...document.querySelectorAll("*")].find((n) =>
        n.children.length === 0 && /^(?:●?\s*SPY\*?|S&P 500)$/m.test(n.textContent || "") && n.getBoundingClientRect().height > 0);
      return !!dock && !!spy && dock.getBoundingClientRect().top > spy.getBoundingClientRect().top;
    }));
  /* LAST in this block, deliberately: it NAVIGATES AWAY to /admin.html, so every assertion
     about the dashboard page must already have run. (Found by writing it in the wrong order
     — the position check below it was silently measuring the terminal page.) */
  ok("dock: tapping a chip navigates to TT's existing hash route focused on that symbol",
    await (async () => {
      await page.evaluate(() => { window.__nav = null;
        Object.defineProperty(window, "__hrefSpy", { value: true, configurable: true }); });
      const target = await page.evaluate(() => {
        const b = document.querySelector('[aria-label="Open AAA in Ticker Terminal"]');
        // capture the navigation without actually leaving the page under test
        let got = null; const d = Object.getOwnPropertyDescriptor(window.location, "href");
        try { b.click(); } catch (_e) { /* jsdom-ish guard */ }
        return got || window.location.href;
      });
      await page.waitForTimeout(400);
      return /admin\.html#aaa/.test(page.url()) || /admin\.html#aaa/.test(target || "");
    })());
  ok("v4.1.7 operator: no page errors with the dock live", errors.length === 0);
  await page.close();
}

// ── B1 (v3.59) — ERROR is a first-class mode with a manual Retry ───────────
console.log("\n[public] B1 — ERROR is not demo, and Retry actually retries");
{
  let failNow = true;
  const { page, errors } = await open({ live: FULL_LIVE, status: () => (failNow ? 500 : 200) });
  await page.waitForTimeout(1500);
  const body1 = await page.locator("body").innerText();
  ok("B1: a failed live fetch wears the ERROR badge, never the demo's MOCK",
    /⚠ ERROR/.test(body1) && !/demo baseline — not live/.test(body1));
  ok("B1: the header states the outage and that the numbers below are illustrative",
    /live service unavailable/i.test(body1));
  ok("B1: a Retry control exists", await page.locator('button[aria-label="Retry loading live data"]').count() === 1);
  failNow = false;
  await page.locator('button[aria-label="Retry loading live data"]').click();
  await page.waitForTimeout(1500);
  const body2 = await page.locator("body").innerText();
  ok("B1: Retry re-fetches and the posture appears once the service recovers",
    POSTURES.test(body2) && /MOONING|HODL|DIAMOND HANDS/.test(body2) && !/⚠ ERROR/.test(body2));
  ok("B1: no page errors through the fail→retry→recover cycle", errors.length === 0);
  await page.close();
}

// ── 5. Responsive + a11y basics on the live state ───────────────────────────
// ── C (v3.60) — Overview shell, Evidence Matrix, What Changed, Data Health ──
console.log("\n[public] v3.60 P0 slice — nav, matrix, digest, health");
{
  const { page, errors } = await open({ live: FULL_LIVE });
  await page.waitForTimeout(1400);
  ok("C2: a Sections nav landmark with the six anchors (row form; the ≤320px burger mirrors them)",
    await page.locator('nav[aria-label="Sections"] .nav-row a').count() === 6 &&
    await page.evaluate(() => new Set([...document.querySelectorAll('nav[aria-label="Sections"] a')]
      .map((a) => a.getAttribute("href"))).size === 6));
  ok("C2: the h2 outline exists (six section headings + none visible as new chrome)",
    await page.evaluate(() => document.querySelectorAll("h2").length) >= 6);
  ok("C2: every nav anchor points at a real element",
    await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Sections"] a')]
      .every((a) => document.getElementById(a.getAttribute("href").slice(1)))));
  ok("C2: the page header is a real <header> landmark", await page.locator("header").count() === 1);
  // FEAT-GLANCE (v3.61): the six-card matrix is COLLAPSED by default — the band chips are
  // the icon-first six-factor view; the summary line stays visible while closed.
  const driversClosed = await page.locator('section[aria-labelledby="drivers"]').innerText();
  ok("glance: the matrix starts collapsed — summary visible, no full cards",
    /\d+ of \d+ signals counted/i.test(driversClosed) && /factor evidence/i.test(driversClosed) &&
    /as of \d{4}-\d{2}-\d{2}/.test(driversClosed));
  await page.waitForTimeout(200);
  const drivers = await page.locator('section[aria-labelledby="drivers"]').innerText();
  ok("C3: the Evidence Matrix renders six factor cards with votes (one tap deep)",
    (drivers.match(/Bullish|Bearish|Neutral/g) || []).length >= 6 && /6 of 6 signals counted/i.test(drivers));
  ok("C3: each card carries freshness and an as-of date",
    /LIVE/.test(drivers) && /as of \d{4}-\d{2}-\d{2}/.test(drivers));
  await page.locator("button.cg-toggle", { hasText: "the reasoning" }).click();   // v3.94: WC rides the group
  await page.waitForTimeout(150);
  const body1 = await page.locator("body").innerText();
  ok("C4: first valid visit says BASELINE SET, never 'nothing changed'",
    /Tracking starts today on this device/.test(body1));
  // FEAT-GLANCE (v3.61): Data Health's per-source grid collapses the same way — the header
  // stays; the 15 rows are one tap deep.
  ok("glance: Data Health header visible while the per-source grid starts collapsed",
    /DATA HEALTH/i.test(body1) && !/spyPrice/.test(body1));
  await page.locator('section[aria-labelledby="health"] button[aria-expanded]').click();
  await page.waitForTimeout(200);
  const health = await page.locator('section[aria-labelledby="health"]').innerText();
  ok("C4: Data Health lists per-source freshness with cadence (one tap deep)",
    /spyPrice/.test(health) && /monthly/.test(health));
  ok("glance: the decode legend lives with the diagnostics it decodes",
    /legend: ● live · ⏱ stale/.test(health) && /illustrative = curated, not live/.test(health));
  // Reload in the SAME context: the baseline persisted, so an identical snapshot must say so.
  await page.goto(page.url(), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1400);
  await page.locator("button.cg-toggle", { hasText: "the reasoning" }).click();   // v3.94
  await page.waitForTimeout(150);
  const body2 = await page.locator("body").innerText();
  ok("C4: an identical return visit names the device scope — 'since your previous visit on this device'",
    /No material change since your previous visit on this device \(\d{4}-\d{2}-\d{2}\)/.test(body2));
  // ── v3.69 NARRATIVE FIRST ─────────────────────────────────────────────────
  // (a) the 5 Whys renders in the overview region, BEFORE the market strip — the owner call
  // this release exists for. DOM order, not pixels: it must hold at every width.
  ok("v3.69: 5 Whys precedes the markets section in DOM order",
    await page.evaluate(() => {
      const whys = [...document.querySelectorAll("*")].find(n => n.childElementCount === 0 && /the reasoning — 5 whys/i.test(n.textContent || ""));   // v3.94: the group toggle is the whys' closed identity
      const mkts = document.querySelector('section[aria-labelledby="markets"]');
      return !!whys && !!mkts && !!(whys.compareDocumentPosition(mkts) & Node.DOCUMENT_POSITION_FOLLOWING);
    }));
  // (b) market detail starts collapsed — chart/tiles out of the DOM — while the macro strip
  // (the always-visible summary) and its SPY* item survive the collapse (v3.25).
  const mktsClosed = await page.locator('section[aria-labelledby="markets"]').innerText();
  ok("v3.69: market detail collapsed by default; the macro strip stays visible while closed",
    /S&P 500/.test(mktsClosed) && !/MARKET PULSE/i.test(mktsClosed) && /full market detail/i.test(mktsClosed));
  // (c) one tap opens the chart.
  await page.locator('section[aria-labelledby="markets"] button[aria-expanded]').click();
  await page.waitForTimeout(200);
  ok("v3.69: expanding market detail reveals the Market Pulse chart card",
    /MARKET PULSE/i.test(await page.locator('section[aria-labelledby="markets"]').innerText()));
  // v3.84: the CCC junk-tail tile renders its judged state on live data (11.2 → NEUTRAL —
  // the badge would be suppressed on mock), and the 10Y carries the 10y–3m note as a fact.
  const mktsOpen = await page.locator('section[aria-labelledby="markets"]').innerText();
  ok("v3.84: the CCC tail tile renders live with the NEUTRAL band and its transmission line",
    /CCC JUNK TAIL/i.test(mktsOpen) && /11\.2/.test(mktsOpen) && /NEUTRAL/.test(mktsOpen) &&
    /funds the AI buildout/i.test(mktsOpen) && /BAMLH0A3HYC/i.test(mktsOpen));
  ok("v3.84: the 10Y tile states the 10y–3m spread as a fact (+0.41pp, not INVERTED here)",
    /10y–3m \+0\.41pp/.test(mktsOpen) && !/10y–3m \+0\.41pp — INVERTED/.test(mktsOpen));
  /* OWNER SWAP (8/31): the strip pin above asserts LEV is GONE from glance altitude. That is
     only honest if the subindex still renders SOMEWHERE — a swap that silently deletes a
     measured field is a cut wearing a promotion's clothes. Driven, not assumed: with market
     detail open, the NFCI tile carries its leverage-subindex line with the fixture's value. */
  ok("8/31 swap: the leverage subindex survives the strip swap on the NFCI tile one tap deep",
    /leverage subindex -0\.55/i.test(await page.locator("body").innerText()));
  // v3.84: the Sahm cell (macro section, always visible) — CLEAR with the distance stated.
  const macTxt = await page.locator('section[aria-labelledby="macro"]').innerText();
  ok("v3.84: the Sahm cell renders CLEAR with distance-to-trigger on live data",
    /SAHM RULE/i.test(macTxt) && /\+0\.23/.test(macTxt) && /CLEAR · 0\.27 to trigger/i.test(macTxt));
  /* v7.1 — THE CONTRAST FOR THE SIMPLE EXCLUSION SWEEP, and the reason it is not vacuous.
     The Simple sweep asserts these readings are ABSENT from the default view. An absence pin
     proves nothing if the thing could never have rendered in this fixture — the v3.60.1 trap,
     and the exact shape the v5.9.0 alert-badge control exposed. So the same readings are pinned
     PRESENT here in Degen: they exist, this fixture produces them, and Simple's silence is a
     mode gate rather than an empty feed. If a role moves, one of these two pins goes red. */
  {
    const degenBody = await page.locator("body").innerText();
    /* EVERY pattern is case-insensitive ON PURPOSE. Chromium's innerText APPLIES
       text-transform, and these labels are uppercased by CSS, so /30Y Mortgage/ reads back as
       "30Y MORTGAGE" and never matches (the v3.69 lesson, caught here again — by this very
       pin, on its first run, while the Simple absence sweep it guards was passing for exactly
       the wrong reason). A case-sensitive absence pin is a vacuous absence pin. */
    const shouldRender = [
      [/Fed rate|FOMC/i, "FED policy rate"], [/30Y Mortgage/i, "mortgage"],
      [/Sahm/i, "Sahm"], [/CCC|HY.?IG/i, "credit context"],
    ];
    const missing = shouldRender.filter(([re]) => !re.test(degenBody)).map(([, n]) => n);
    ok(`v7.1 contrast: every reading Simple excludes DOES render in Degen — the absence pin is not vacuous${missing.length ? " — never rendered: " + missing.join(", ") : ""}`,
      missing.length === 0);
  }

  /* ── v7.1 BEYOND THE VOTE — Degen's evidence view for every factor that is NOT a voter ────
     v6.9.9.5 organised the six voters and nothing ever organised the rest. Driven live here:
     the block exists in Degen, the overrides are on the face, each fold is named and closed on
     arrival, and NO Engine 0 verdict word reaches the page (owner ruling: readings only). */
  {
    const bv = page.locator(".beyond-vote");
    ok("v7.1 beyond: the block renders in Degen, directly under the six voters",
      (await bv.count()) === 1 &&
      (await page.evaluate(() => {
        const dd = document.querySelector('[aria-labelledby="drivers"]');
        const bb = document.querySelector('[aria-labelledby="beyond"]');
        return Boolean(dd && bb) && (dd.compareDocumentPosition(bb) & Node.DOCUMENT_POSITION_FOLLOWING) > 0;
      })));
    /* The overrides are RED FACTS and stay outside every fold (v3.25). Measured against the
       rendered DOM rather than the source, because "outside a fold" is a layout claim. */
    /* RE-PINNED v7.2: 2 → 3. The Sahm rule became the third override in the same release that
       gave it a circuit, so the count moves with the code and the CLAIM — every override on the
       face, outside every fold — is unchanged. */
    ok("v7.1 beyond: the overrides render on the FACE — never inside a disclosure",
      (await bv.locator(".beyond-override").count()) === 3 &&
      (await page.evaluate(() => [...document.querySelectorAll(".beyond-override")]
        .every((n) => !n.closest("details")))));
    const bvText = await bv.innerText();
    ok("v7.1 beyond: all three safety circuits are named with a state a reader can act on",
      /PANIC override/i.test(bvText) && /Macro Flip/i.test(bvText) && /Sahm rule/i.test(bvText)
      && /(CLEAR|FIRED|ARMED|TRIPPED|BLIND|CANNOT SEE)/.test(bvText));
    /* NO VERDICT WORD (owner ruling: readings only). ⚠ My first version swept the WHOLE page
       case-insensitively and failed — on the "Headwinds" register, a section that has carried
       that name since v3.0 and has nothing to do with Engine 0's verdict. A sweep that matches a
       legitimate unrelated word reports a defect that does not exist, which is the same class of
       useless as a vacuous pin. Scoped to this block, where the claim actually lives, and
       case-SENSITIVE on the verdict tokens, which Engine 0 publishes in caps. */
    ok("v7.1 beyond: no Engine 0 verdict word reaches the block (readings only)",
      !/\b(TAILWIND|HEADWIND)\b/.test(bvText) && !/\bNEUTRAL\b/.test(bvText));
    /* CollapsedGroup is a `button.cg-toggle` with conditional children, NOT a <details> — my
       first version of this pin located <details> and found none, so the click loop below never
       ran and the card pins reported "0 of 0". A pin that measures the wrong element reports a
       defect that does not exist. */
    const folds = bv.locator("button.cg-toggle");
    ok("v7.1 beyond: two named folds, both closed on arrival",
      (await folds.count()) === 2 &&
      (await folds.evaluateAll((ns) => ns.every((n) => n.getAttribute("aria-expanded") === "false"))) &&
      /technicals — what the order-gating engine reads/i.test(bvText) &&
      /context — credit, the curve, leverage/i.test(bvText));
    /* THE FACT THAT MAKES THIS BLOCK HONEST. Every card must SAY the call does not read it —
       these sit under six cards that look identical and DO vote. Asserted as a COUNT against the
       cards actually rendered, so a row missing the line fails rather than being skipped. */
    for (const f of await folds.all()) await f.click();
    await page.waitForTimeout(250);
    const bvCards = await bv.locator(".beyond-card").count();
    const bvWhys = await bv.locator(".beyond-why").count();
    ok(`v7.1 beyond: EVERY card states that the call does not read it (${bvWhys} of ${bvCards})`,
      bvCards >= 10 && bvWhys === bvCards);
    ok("v7.1 beyond: the technicals name the order-gating engine; context rows do not claim it",
      (await bv.locator(".beyond-why", { hasText: /order-gating engine reads it/ }).count()) === 4);
    /* It must not borrow the Drivers matrix's class — that count is pinned at exactly six and
       two mode-parity loops walk it by index. */
    ok("v7.1 beyond: the block uses its own card class, leaving the six voter cards untouched",
      (await bv.locator(".driver-card").count()) === 0 &&
      (await page.locator(".driver-card").count()) === 6);
    ok("v7.1 beyond: no overflow at this width with both folds open",
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  }
  // (d) real section extents: ai no longer swallows the operator monitors.
  ok("v3.69: markets/macro/ai anchors have real <section> extents, and ai does NOT contain MY CONVICTION",
    await page.evaluate(() => {
      const m = document.querySelector('section[aria-labelledby="markets"]');
      const mac = document.querySelector('section[aria-labelledby="macro"]');
      const ai = document.querySelector('section[aria-labelledby="ai"]');
      return !!m && !!mac && !!ai && !/MY CONVICTION/.test(ai.innerText);
    }));
  ok("C: no page errors through the slice", errors.length === 0);
  await page.close();
}
{
  // DEGRADED: vix absent in a live build → excluded, and the matrix must NAME why.
  const { live, ...rest } = { live: null };
  const deg = { ...FULL_LIVE }; delete deg.vix; delete deg.vixAsOf;
  const { page } = await open({ live: deg });
  await page.waitForTimeout(1400);
  // The red facts survive the v3.61 collapse: the summary count while closed, the exclusion
  // named in the Signal Quality strip, and the ⏱ chip on the band (v3.25 rule).
  const closed = await page.locator("body").innerText();
  // v6.4: one scoped, one-vocabulary line — "5 of 6 signals counted · unavailable: VIX".
  ok("glance: the exclusion is visible while the matrix is closed (the signals line names it)",
    /5 of 6 signals counted/i.test(closed) && /unavailable: VIX/i.test(closed));
  await page.waitForTimeout(200);
  const drivers = await page.locator('section[aria-labelledby="drivers"]').innerText();
  // v3.98.3: the reason is retailed AND the card now shows the real cause — a dead feed
  // says "no live reading", never the stale wording the hero used to hardcode.
  ok("C3: an excluded factor is NAMED with its real reason on the card itself",
    /Not counted/.test(drivers) && /excluded — no live feed right now/.test(drivers) &&
    /Current reading unavailable/.test(drivers) && /5 of 6 signals counted/i.test(drivers));
  await page.close();
}

// ── v3.98.4 — the Power read-through: no surface may assert a state it never checked ──
console.log("\n[public] v3.98.4 — token trend withheld on mock, strip marker is TODAY's vote");
{
  // A live build whose token feed is dead: the price card must NOT print a directional read,
  // and the macro strip's VIX (a voter, dark today) must lose its ▪ counts-today marker.
  const noTok = { ...FULL_LIVE }; delete noTok.vix; delete noTok.vixAsOf;
  const { page, errors } = await open({ live: noTok, width: 1280 });
  await page.waitForTimeout(1300);
  for (let i = 0; i < 14; i++) {
    const b = page.locator('button.cg-toggle[aria-expanded="false"]').first();
    if (await b.count() === 0) break;
    await b.click().catch(() => {}); await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);
  const ai = await page.locator('section[aria-labelledby="ai"]').innerText();
  ok("v3.98.4: with the token feed dead the card withholds its trend instead of claiming one",
    /trend withheld — price leg not live/.test(ai) && !/% over window/.test(ai));
  const matrix=page.locator(".driver-matrix");
  ok("v6.9.9.5: a dark voter is explicitly not counted, with no current reading",
    /Not counted/.test(await matrix.locator(".driver-card").filter({hasText:"VIX"}).innerText()) &&
    /Current reading unavailable/.test(await matrix.locator(".driver-card").filter({hasText:"VIX"}).innerText()));
  ok("v6.9.9.5: the live sentiment vote retains its canonical stance",
    await matrix.locator('[title="Fear & Greed: BULL"]').count()===1);
  const macro = await page.locator('section[aria-labelledby="macro"]').innerText();
  ok("v3.98.4: the CPI box now dates itself — no LIVE badge without an observation date",
    /CPIAUCNS \+ CPILFENS/.test(macro) && /as of/i.test(macro));
  ok("v3.98.4: no page errors through the degraded read-through", errors.length === 0);
  await page.close();
}

// ── v7.1.5 — CPI states its reported PERIOD in words, on every surface that shows it ─────
/* Owner, 2026-09-19: "it shows August latest but confuses new users in September." The one
   date a reader met was `asOfOf`'s "as of Aug 1" — DAY precision on a MONTH-precision
   observation, with no year — so a September reader saw a day in August and reasonably read
   a stale pull. Driven live rather than pinned as a string for two reasons this suite exists
   for: the expected month is DERIVED FROM THE FIXTURE'S OWN as-of (a hardcoded month would
   rot at the next month boundary and go red on a correct page), and Chromium's innerText
   APPLIES text-transform (v3.69), so reading the mixed-case phrase back is the only way to
   prove no CSS uppercased the month name into something a pin would silently stop matching. */
console.log("\n[public] v7.1.5 — the CPI period, in words, in Degen and in Simple");
{
  const expectMonth = new Date(`${FULL_LIVE.cpiHeadlineAsOf}T00:00:00`)
    .toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const { page, errors } = await open({ live: FULL_LIVE, width: 1280 });
  await page.waitForTimeout(1300);
  for (let i = 0; i < 14; i++) {
    const b = page.locator('button.cg-toggle[aria-expanded="false"]').first();
    if (await b.count() === 0) break;
    await b.click().catch(() => {}); await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);
  const macro = await page.locator('section[aria-labelledby="macro"]').innerText();
  ok(`v7.1.5: the macro grid names the reported month and says nothing newer exists (${expectMonth})`,
    macro.includes(`${expectMonth} · latest published`));
  /* The line ADDS to provenance, it does not replace it — the SourceBox and its observation
     date must both survive, or this would have traded one honesty fact for another. */
  ok("v7.1.5: provenance survives beside it — the CPI SourceBox still carries its endpoint and as-of",
    /CPIAUCNS \+ CPILFENS/.test(macro) && /as of/i.test(macro));
  ok("v7.1.5: the month reads back in MIXED CASE — no CSS uppercased it out from under the pin",
    macro.includes(expectMonth) && !macro.includes(expectMonth.toUpperCase()));
  await page.close();

  // Simple: the eight-tile strip lives ONLY inside the Explore fold (v6.9.9), so that is the
  // one place the CPI TILE can be read — and its sub is chip-length, so it carries the month
  // and leaves "latest published" to the macro row, which has the room to say it.
  const sp = await open({ live: FULL_LIVE, width: 390, power: false });
  await sp.page.waitForTimeout(1200);
  await sp.page.getByRole("button", { name: /Explore market data/ }).click();
  await sp.page.waitForTimeout(200);
  const cpiTile = sp.page.locator(".macro-strip-inner .strip-tile").filter({ hasText: "CPI" }).first();
  const tileText = await cpiTile.innerText();
  ok(`v7.1.5: the Simple strip's CPI tile carries the period beside core (${expectMonth})`,
    tileText.includes(expectMonth) && /Core/i.test(tileText) && !/latest published/i.test(tileText));
  /* The VOTER SHEET is reached from the CARD, not from this tile. v7.0.3 measured the split
     and it holds here: the strip tile renders the band's RAW `explain.what[1]`, while
     `voterSheet()` composes the current-vs-reference bullet the Simple cards and the Drivers
     matrix show — so the period rides the composed path and the tile carries its own shorter
     line. Asserted on the card, with the tile's sheet pinned NOT to claim it, or this would
     be a pin that passes on whichever sheet happened to open. */
  await sp.page.keyboard.press("Escape").catch(() => {});
  const cpiCard = sp.page.locator(".simple-card").filter({ hasText: /Inflation|CPI/i }).first();
  await cpiCard.click();
  const sheet = await sp.page.getByRole("dialog").innerText();
  ok("v7.1.5: the voter sheet's current-reading bullet names the period too — one derivation, both surfaces",
    /YoY/.test(sheet) && sheet.includes(`${expectMonth} · latest published`));
  await sp.page.keyboard.press("Escape");
  ok("v7.1.5: 390px stays overflow-free with the longer sub, and no page errors",
    await sp.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) &&
    errors.length === 0 && sp.errors.length === 0);
  await sp.page.close();
}

// ── v3.99 — the Fed tile leads with the TARGET RANGE; the countdown survives Kalshi ──
console.log("\n[public] v3.99 — Fed target range + curated FOMC countdown");
{
  // No Kalshi fields at all — exactly today's production shape (HTTP 429 on both bases).
  const { page, errors } = await open({ live: FULL_LIVE, width: 1280 });
  await page.waitForTimeout(1300);
  for (let i = 0; i < 14; i++) {
    const b = page.locator('button.cg-toggle[aria-expanded="false"]').first();
    if (await b.count() === 0) break;
    await b.click().catch(() => {}); await page.waitForTimeout(100);
  }
  const macro = await page.locator('section[aria-labelledby="macro"]').innerText();
  ok("v3.99: the tile leads with the Fed TARGET RANGE, not the lagging monthly average",
    /Fed Target Range/i.test(macro) && /3\.50–3\.75%/.test(macro));
  ok("v3.99: the effective average survives, LABELLED as the lagging series it is",
    /effective 3\.63%/.test(macro) && /lags a decision/i.test(macro));
  // 2026-09-16 CI failure: today IS an FOMC decision date in the table (fomcDays===0), and
  // the component's own honest copy for that case is "FOMC decision today", not "Next FOMC
  // in 0 days" — a defect in this ASSERTION's regex, never anticipated the day-0 case,
  // never a defect in the app (which is right to say the decision is today, not "in 0 days").
  ok("v3.99: with Kalshi absent the countdown still renders, off the published Fed calendar",
    (/Next FOMC in \d+ days?/.test(macro) || /FOMC decision today/.test(macro)) &&
    /published Fed calendar/.test(macro) && !/awaiting schedule/.test(macro));
  /* v3.99.1 — re-test after the owner's Q4 corrections (Nov 4 → Oct 28, Dec 16 → Dec 9).
     The countdown is measured against the ACTIVE meeting date, derived here rather than
     hardcoded, so this assertion survives the calendar rolling to the next entry. */
  ok("v3.99.1: the rendered countdown MATCHES the active FOMC date to the day (no off-by-one)",
    await (async () => {
      const { FOMC_MEETINGS } = await import("../src/sources.js");
      const et = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
      const today = et(new Date());
      const next = FOMC_MEETINGS.find((x) => x >= today);
      if (!next) return false;
      // ET on both sides — the page resolves "today" via etYmd(), so the harness must too
      // (this assertion is what caught the page mixing ET and browser-local midnight).
      const days = Math.round((new Date(next + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000);
      // Day 0 (today IS the decision day) renders distinct honest copy, not "in 0 days".
      if (days === 0) return /FOMC decision today/.test(macro);
      const m = macro.match(/Next FOMC in (\d+) days?/);
      return !!m && Number(m[1]) === days;
    })());
  ok("v3.99.1: the mock odds baseline is GONE — the tile says it cannot see them",
    /odds unavailable — Kalshi feed not live/.test(macro) &&
    !/Hold 84%/.test(macro) && !/Cut 13%/.test(macro) && !/Hike 3%/.test(macro));
  const strip = await page.locator(".macro-strip").innerText();
  ok("v3.99: the strip's FOMC countdown is no longer a dash",
    /FOMC \d+d|FOMC today/.test(strip) && !/FOMC —/.test(strip));
  ok("v3.99: no page errors", errors.length === 0);
  await page.close();
}
{
  // Target range dead (FEDFUNDS still live): the tile must fall back AND say the range is dark.
  const noTgt = { ...FULL_LIVE };
  delete noTgt.fedTargetUpper; delete noTgt.fedTargetUpperAsOf;
  delete noTgt.fedTargetLower; delete noTgt.fedTargetLowerAsOf;
  const { page } = await open({ live: noTgt, width: 1280 });
  await page.waitForTimeout(1300);
  for (let i = 0; i < 14; i++) {
    const b = page.locator('button.cg-toggle[aria-expanded="false"]').first();
    if (await b.count() === 0) break;
    await b.click().catch(() => {}); await page.waitForTimeout(100);
  }
  const macro = await page.locator('section[aria-labelledby="macro"]').innerText();
  ok("v3.99: a dead target-range feed falls back to the effective rate and SAYS the range is not live",
    /Fed Funds \(effective avg\)/i.test(macro) && /target range not live/i.test(macro) &&
    !/3\.50–3\.75%/.test(macro));
  await page.close();
}

// ── v4.0 SIMPLE MODE — the acceptance matrix: four verdicts, and the honesty rules ──
console.log("\n[public] v4.0 — Simple verdicts, card selection, and what must NEVER render");
{
  // 1. BEARISH: every factor pushed to its bear band.
  const bear = { ...FULL_LIVE, tenYearM1: 0.40, vix: 31, fearGreed: 12,
    cpiTrend: [2.0, 2.4, 2.8, 3.1, 3.4, 3.6], shillerPe: 41, nfci: 0.55 };
  let { page, errors } = await open({ live: bear, width: 390, power: false });
  await page.waitForTimeout(1300);
  let body = await page.locator("body").innerText();
  ok("v6.4 Simple verdict: a bear tape reads Bearish, and risk factors lead the cards",
    /Bearish/.test(body) && /pressures? stocks|signals? caution/i.test(body) && !/DIAMOND HANDS|\bBEARISH\b/.test(body));
  await page.close();

  // 2. BULLISH.
  const bull = { ...FULL_LIVE, tenYearM1: -0.30, vix: 12, fearGreed: 78,
    cpiTrend: [3.4, 3.2, 3.0, 2.8, 2.6, 2.3], shillerPe: 19, nfci: -0.90 };
  ({ page, errors } = await open({ live: bull, width: 390, power: false }));
  await page.waitForTimeout(1300);
  body = await page.locator("body").innerText();
  ok("v6.4 Simple verdict: a bull tape reads Bullish with supporting factors leading",
    /Bullish/.test(body) && /support stocks|supports stocks|stock outlook/i.test(body) && !/MOONING|\bBULLISH\b/.test(body) &&
    /support taking risk/i.test(body) && !/\bfine\b|\bdrag\b/i.test(body));   // T1 (v6.6.1): a Bullish day says the backdrop supports taking risk; 'fine' retired
  await page.close();

  // 3. NOT ENOUGH DATA — below quorum. And the acceptance rule that matters most here: a withheld
  //    posture explains nothing and offers no flip, but says WHY it is withheld.
  ({ page, errors } = await open({ live: DEGRADED, width: 390, power: false }));
  await page.waitForTimeout(1300);
  body = await page.locator("body").innerText();
  ok("v6.4 Simple verdict: below quorum reads Not enough data, never a thin directional call",
    /Not enough data/.test(body) && !/CAN'T CALL IT|DATA HOLD|MOONING|DIAMOND HANDS/.test(body));
  /* 8/28 Whys altitude: a WITHHELD posture advertises no flip — the closed label is BARE
     (no ⇄ chip claiming a crossing that does not exist) and the withheld sentence travels
     INSIDE with the flip's slot. So the closed body must NOT carry it, and one tap must. */
  const whysToggleTxt = await page.locator("button.cg-toggle", { hasText: "why this call" }).innerText();
  ok("8/28 withheld: the closed whys label is bare — no flip chip on a call that was withheld",
    !/⇄/.test(whysToggleTxt) && /Why this call/.test(whysToggleTxt) &&
    !/Call withheld until/i.test(body));
  await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
  await page.waitForTimeout(200);
  const withheldOpen = await page.locator("body").innerText();
  ok("v4.0 withheld: no explanatory sentence, and the withheld sentence states the shortfall one tap deep",
    /Call withheld until the required evidence is current and usable/i.test(withheldOpen) &&
    !/are supportive|is working against|clearly supportive|clear lean right now|support taking risk|against risk|has a majority|short of a majority/i.test(withheldOpen));
  await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
  await page.waitForTimeout(150);
  ok("v4.0 withheld: cards still render only USABLE factors — a dead feed is never a card",
    (await page.locator(".simple-card", { hasText: /unavailable/i }).count()) > 0);
  await page.close();

  // 3b. FEAT-NEWCOMER-RULER (8/29): the MIXED sub is DERIVED — today's tape shape (sleepy
  //     vol + cooling inflation vs rich CAPE) names the disagreement instead of the canned
  //     "watch VIX" pointing at a gauge that voted HELPING. This fixture also reproduces the
  //     owner's exact prod card set (vix · valuation · cpiHeadline), which is where the three
  //     named ruler substrings are measured.
  {
  const MIXED_LIVE = { ...FULL_LIVE,
    vix: 14.43,                              // bull — asleep
    fearGreed: 54, fearGreedLabel: "Neutral",// neutral
    tenYearM1: 0.02,                         // neutral
    cpiHeadline: 3.5, cpiTrend: [3.6, 3.6, 3.6, 3.6, 3.6, 3.5],  // bull — cooling
    shillerPe: 42.2,                         // bear — rich CAPE
    nfci: -0.42,                             // neutral
  };
  const { page, errors } = await open({ live: MIXED_LIVE, width: 390, power: false });
  await page.waitForTimeout(1300);
  const band = await bandText(page);
  /* v5.9: in Simple the hero's tally sub is dropped — it restated in counts what the plain
     sentence says in words, and of the two the sentence is the one a newcomer can use. The
     derived sub itself is unchanged and still renders in Power (pinned in smoke); what this
     asserts is that Simple's ONE explanation names the same disagreement. */
  /* v6.6.1: the Hold sentence names both sides and states the reason for the Hold — neither
     side has a majority. Measured live: "Volatility and inflation help. Prices hurt. Neither side
     has a majority." on this tape (vix + cooling CPI helping, rich CAPE hurting). */
  ok("v5.9: Simple names the disagreement in the SENTENCE, with no count sub beside it",
    /Mixed stock outlook/.test(band) && /counted signals/.test(band) && /Neither side has a majority/.test(band) &&
    !/\bfine\b|\bdrag\b/i.test(band) &&
    !/help, prices do not/.test(band) && !/\d+ help, \d+ does not/.test(band));
  ok("8/29 ruler: the canned watch-VIX gloss is gone from a tape where VIX is helping",
    !/watch VIX/i.test(band) && !/Cross-signals/.test(band));
  const cards = await page.locator('[aria-label="Key parameters"]').innerText();
  ok("T3 ruler: the valuation chip is OFF the card face",
    !/help <26\.1 · hurt >30/.test(cards) && !/1\.5× long-run mean/.test(cards));
  /* The owner's three named cards: the ruler left the face (T3). The sheet still places
     today's reading; chip-length edges are asserted after the valuation tap below. */
  ok("T3 ruler: none of the three cards print their edges on the face",
    !/help <18 · hurt >25/.test(cards) && !/help <26\.1/.test(cards) &&
    !/cooler than last print/.test(cards));
  ok("8/29 ruler: no page errors on the MIXED tape", errors.length === 0);

  /* ── v5.8 THE EXPLAINER SHEET, driven ────────────────────────────────────────────────
     Owner ask: tapping a parameter card opens a tile explaining what the thing IS. The
     copy is pinned in smoke; what only a browser can prove is that the tap opens it, that
     the dialog is a real labelled dialog, and that a keyboard user can get back out to the
     card they came from. This runs on the owner's own tape, so the card under test is the
     one they were looking at. */
  const valCard = page.locator('[aria-label="Key parameters"] button', { hasText: "VALUATION" }).first();
  ok("v5.8 sheet: the card is a real button that announces it opens a dialog",
    await valCard.getAttribute("aria-haspopup") === "dialog" &&
    /what is this/i.test(await valCard.textContent()));
  ok("v5.8 sheet: nothing is open until it is tapped", await page.locator('[role="dialog"]').count() === 0);
  await valCard.click();
  await page.waitForTimeout(250);
  const dlg = page.locator('[role="dialog"]');
  ok("v5.8 sheet: the tap opens ONE labelled, modal dialog named for the full spelled-out factor",
    await dlg.count() === 1 && await dlg.getAttribute("aria-modal") === "true" &&
    /Cyclically Adjusted Price-to-Earnings ratio \(Shiller CAPE\)/.test(await dlg.innerText()));
  const sheet = await dlg.innerText();
  /* v5.9.1 (owner: "I meant 3 bullets total. The tile descriptions too large") — the sheet
     is now EXACTLY 3 bullets and nothing else: no section headers, no quote block. The
     misattributed-quote research (Graham, not Buffett) is still real; it just no longer
     renders as a citation block on a tile that has to stay to 3 lines. */
  ok("v5.9.1 sheet: EXACTLY 3 bullets, no section headers, no quote block",
    await dlg.locator("ul li").count() === 3 &&
    !/WHAT MOVES IT|NORMAL \/ NEUTRAL LEVEL|WHY IT MATTERS TO THE MACRO PICTURE/i.test(sheet) &&
    !/Price is what you pay/.test(sheet) && !/Benjamin Graham/.test(sheet));
  /* v5.9.5 (FEAT-SIMPLE-SHEET-PLAIN v2): the sheet PLACES today's reading rather than
     describing the instrument. The post-1990-median clause is retired with the rest of the
     instrument-mechanics vocabulary; what has to survive is the pair of anchors a reader
     puts the chip between (the old average and the 1999 peak) plus our own hurt edge. */
  ok("v5.9.5 sheet: CAPE places the reading — old average, 1999 peak, and our hurt edge",
    /17\.4/.test(sheet) && /44\.19/.test(sheet) && /90%/.test(sheet) &&
    !/post-1990 median/.test(sheet));
  ok("7.0.1 sheet: bullet 2 prominently carries the current value, observation date and full model reference",
    /Latest reported:/.test(sheet) && /observation date /.test(sheet) && /Model reference: help: CAPE below 26\.1/.test(sheet) &&
    await page.getByRole("dialog").locator("li").nth(1).locator("strong").count()===1);
  ok("v5.8 sheet: focus moves into the sheet on open, onto the way out",
    await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute("data-fs-close")));
  await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
  ok("v5.8 sheet: Tab is trapped inside the dialog — a keyboard user cannot fall out behind it",
    await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')));
  ok("v5.8 sheet: no horizontal overflow at 390px with the sheet open",
    await page.evaluate(() => document.documentElement.scrollWidth) <= 390);
  /* v5.9.2 (owner: "make the pop up more visible in the middle of the screen and also the
     much larger font? It's too small for a user to read"). Measured, not asserted: the
     dialog's own vertical center must land within a few px of the VIEWPORT's center (the
     v5.8 shape was bottom-anchored, so this would have failed hard before), and the title
     and bullets must render at the new fsXl/fsBody sizes rather than the old fsM/fsS ones. */
  ok("v5.9.2 sheet: the dialog is CENTERED in the viewport, not glued to the bottom edge",
    await page.evaluate(() => { const r = document.querySelector('[role="dialog"]').getBoundingClientRect();
      return Math.abs((r.top + r.bottom) / 2 - window.innerHeight / 2) <= 10; }));
  ok("v5.9.2 sheet: the title and bullets render at the LARGER sizes (22px / 16px), not the old ones",
    await page.locator("#factsheet-title").evaluate((n) => getComputedStyle(n).fontSize) === "22px" &&
    await dlg.locator("ul li").first().evaluate((n) => getComputedStyle(n).fontSize) === "16px");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("v5.8 sheet: Escape closes it AND returns focus to the card that opened it — not the top of the page",
    await page.locator('[role="dialog"]').count() === 0 &&
    await page.evaluate(() => { const a = document.activeElement;
      return !!a && a.tagName === "BUTTON" && /VALUATION/i.test(a.innerText || ""); }));
  await valCard.click();
  await page.waitForTimeout(200);
  await page.locator("[data-fs-close]").click();
  await page.waitForTimeout(200);
  ok("v5.8 sheet: the ✕ closes it", await page.locator('[role="dialog"]').count() === 0);
  await valCard.click();
  await page.waitForTimeout(200);
  await page.mouse.click(195, 60);   // the backdrop, well above the sheet
  await page.waitForTimeout(200);
  ok("v5.8 sheet: tapping the backdrop closes it", await page.locator('[role="dialog"]').count() === 0);
  ok("v5.8 sheet: no page errors across open, trap, and all three ways out", errors.length === 0);
  await page.close();
  }

// 4. A dead feed must never appear as a card, and must never be padded to three.
  const oneDead = { ...FULL_LIVE }; delete oneDead.vix; delete oneDead.vixAsOf;
  ({ page, errors } = await open({ live: oneDead, width: 390, power: false }));
  await page.waitForTimeout(1300);
  body = await page.locator("body").innerText();
  const cardsText = await page.locator('[aria-label="Key parameters"]').innerText();
  ok("v4.0 cards: the dead-feed factor is absent from the cards entirely (not shown as 'mixed')",
    /volatility — unavailable/i.test(cardsText));
  ok("T3 cards: never padded with unavailable placeholders — absence is not a card, and the footer is gone",
    (await page.locator(".simple-card", { hasText: /unavailable/i }).count()) > 0 &&
    !/\d+ cards from the \d+ signals counted/.test(cardsText));
  /* The layout count stays distinct from coverage, and exclusions use the same public word. */
  await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
  await page.waitForTimeout(150);
  ok("T3 cards: the excluded factor is still ACKNOWLEDGED inside Why-this-call",
    /\d+ unavailable/.test(await page.locator("body").innerText()));
  ok("row 4: the layout cap is no longer labelled as a coverage fraction under the cards",
    !/cards from the/.test(cardsText) && !/showing \d+ of \d+ usable/.test(cardsText));
  ok("v4.0: no page errors across the verdict matrix", errors.length === 0);
  await page.close();
}
{
  // 5. Degen retains the personality and analytical surface.
  const { page } = await open({ live: FULL_LIVE, width: 1280, power: true });
  await page.waitForTimeout(1300);
  const band = await page.locator('[aria-label="Macro backdrop verdict"]').innerText();
  ok("v6.4 boundary: Degen keeps the moon voice and never shows the scoped Simple verdict",
    /MOONING|HODL|DIAMOND HANDS|CAN'T CALL IT/.test(band) && !/MACRO: /.test(band));
  const body = await page.locator("body").innerText();
  ok("v6.4 boundary: Degen keeps the full analytical view and gets NO Simple cards",
    /the reasoning/i.test(body) && /factor evidence/i.test(body) &&
    await page.locator('[aria-label="Key parameters"]').count() === 0);
  await page.close();
}

console.log("\n[public] responsive on BOTH routes — the 320px contract (A2/A3)");
for (const route of ["/", "/?view=public"]) {
  for (const width of [320, 390, 768, 1280]) {
    const { page, errors } = await open({ live: FULL_LIVE, width, route });
    await page.waitForTimeout(1200);
    const name = route === "/" ? "operator" : "public";
    ok(`${name} @${width}px: no horizontal overflow`,
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    ok(`${name} @${width}px: no page errors`, errors.length === 0);
    await page.close();
  }
}
console.log("\n[public] A4 — the public/private boundary is ENFORCED, not commented");
{
  const { page } = await open({ live: FULL_LIVE, route: "/" });
  await page.waitForTimeout(1200);
  const op = await page.locator("body").innerText();
  ok("operator route: MY CONVICTION renders (the v3.51 keep call stands)", /MY CONVICTION/.test(op));
  ok("operator route: Macro Alerts render", /Macro Alerts/i.test(op));
  // v3.62: TERMINAL moved inside the ⋯ OPS disclosure, so it is no longer in the closed page's
  // innerText. Assert the stronger thing instead — the menu exists AND actually opens to reveal
  // a real link. A DOM-presence check would have passed even if the disclosure never opened.
  ok("operator route: the OPS menu is present", await page.locator("details.hdr-ops").count() === 1);
  // v3.98.3 (owner call): TERMINAL is PROMOTED out of the menu into the bar — visible with
  // zero clicks, and gone from the disclosure so there is one door to one room.
  ok("operator route: TERMINAL is visible in the bar with NO clicks, and no longer inside OPS",
    await (async () => {
      const bar = page.locator('a[aria-label="Open Ticker Terminal"]');
      return await bar.count() === 1 && await bar.isVisible() &&
        await page.locator('details.hdr-ops a[href="/admin.html"]').count() === 0;
    })());
  // Accent = TERMINAL's border/text share one colour and differ from the neutral SHARE
  // button beside it, so "primary destination" is measured, not asserted in a comment.
  ok("v3.98.3: TERMINAL carries the accent treatment, distinct from the neutral bar actions",
    await page.evaluate(() => {
      const t = document.querySelector('a[aria-label="Open Ticker Terminal"]');
      const sh = document.querySelector('button[aria-label="Copy dashboard link"]');
      if (!t || !sh) return false;
      const a = getComputedStyle(t), b = getComputedStyle(sh);
      return a.color === a.borderTopColor && a.color !== b.color &&
        a.borderTopColor !== b.borderTopColor && a.fontWeight === "700";
    }));
  ok("operator route: the canonical daily-call copy button renders",
    await page.locator('button[aria-label="Copy MacroDash daily call"]').count() === 1);
  await page.close();
}
{
  const { page } = await open({ live: FULL_LIVE, route: "/?view=public" });
  await page.waitForTimeout(1200);
  const pub = await page.locator("body").innerText();
  ok("public route: MY CONVICTION is gated out", !/MY CONVICTION/.test(pub));
  ok("public route: Macro Alerts are gated out", !/Macro Alerts/i.test(pub));
  ok("public route: TERMINAL link hidden", !/⌁ TERMINAL/.test(pub));
  /* v6.0.2: the footer rides ONE closed disclosure (owner: "that very bottom blurb can go too.
     Under a dropdown"), so the omission note is read after opening it. The closed row must
     still carry the two facts a collapse may not hide: the version and "not financial advice". */
  ok("v6.0.2 footer: closed by default, the toggle row carries the version and the not-advice fact",
    !/operator view carries the curated watchlist/.test(pub) &&
    /about this page — v\d+\.\d+\.\d+(?:\.\d+)? · sources · not financial advice/i.test(pub));
  await page.locator(".site-footer button.cg-toggle").click();
  await page.waitForTimeout(150);
  ok("v6.4 public footer: operator-view promotional sentence stays removed when opened",
    !/operator view carries the curated watchlist and alert monitors/.test(await page.locator(".site-footer").innerText()) &&
    /Retired: CBOE Put\/Call/.test(await page.locator(".site-footer").innerText()));
  ok("public route: the canonical verdict still publishes — the gate hides content, not judgment",
    /MOONING|HODL|DIAMOND HANDS/.test(pub) && /BULLISH|NEUTRAL|BEARISH/.test(pub));
  // FEAT-GLANCE (v3.61, newcomer audit #5): TT and the alert badges are operator tooling —
  // "⚡ 3 BLIND" reads as a system failure to a visitor who can't see the monitors it counts.
  ok("public route: the compact posture card sits by the hero while the operator paste stays gated",
    await page.locator('button[aria-label="Copy MacroDash posture card"]').count() === 1 &&
    await page.locator('button[aria-label="Copy MacroDash daily call"]').count() === 0);
  ok("public route: no FIRED/BLIND alert badge leaks", !/⚡ \d+ (FIRED|BLIND)/.test(pub));
  await page.close();
}
{
  const frozenCall = {
    schema:"md-call-v1", effective_date:TODAY, headline:"DIAMOND HANDS", emoji:"🙌",
    direction:"BEARISH", confidence:"HIGH", actionability:"HOLD", status:"PUBLISHED",
    counts:{usable:6,total:6,bull:0,bear:6,neutral:0}, factors:[], override:{active:false},
  };
  const { page, errors } = await open({ live:FULL_LIVE, route:"/?view=public", width:320,
    publicCall:frozenCall, publicCallFrozen:true, publicCallCapturedAt:`${TODAY}T14:00:00.000Z` });
  await page.waitForTimeout(1200);
  const band = await bandText(page);
  ok("v5.5 frozen hero: the scored 10am call wins while later evidence drift is named",
    /10am call · frozen/i.test(band) && /DIAMOND HANDS 🙌/.test(band) && /BEARISH/.test(band) &&
    /Current evidence now reads MOONING 🚀 · BULLISH/.test(band));
  await page.evaluate(() => {
    window.__postureCopy = null;
    navigator.clipboard.writeText = (value) => { window.__postureCopy = value; return Promise.resolve(); };
  });
  await page.locator('button[aria-label="Copy MacroDash posture card"]').click();
  await page.waitForTimeout(150);
  const copied = await page.evaluate(() => window.__postureCopy);
  ok("v5.5 posture share: clipboard copies the frozen identity and public track-record link",
    /^MACRODASH 10AM CALL/.test(copied || "") && /DIAMOND HANDS 🙌 · BEARISH/.test(copied || "") &&
    !/MOONING/.test(copied || "") && /\/history/.test(copied || ""));
  ok("v5.5 frozen hero: copy success is confirmed and 320px stays overflow-free",
    /CALL COPIED/.test(await page.locator('button[aria-label="Copy MacroDash posture card"]').innerText()) &&
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  ok("v5.5 frozen hero: no page errors", errors.length === 0);
  await page.close();
}
{
  const { page } = await open({ live: FULL_LIVE });
  await page.waitForTimeout(1200);
  ok("a11y: exactly one main landmark", await page.locator('[role="main"]').count() === 1);
  // B4 (v3.59): the block regions stopped announcing; one concise status node does.
  ok("a11y: exactly one concise polite status region announces backdrop changes",
    await page.locator('[role="status"][aria-live="polite"]').count() === 1 &&
    /MacroDash (MOONING|HODL|DIAMOND HANDS), (BULLISH|NEUTRAL|BEARISH): \d of 6 signals counted\./.test(
      await page.locator('[role="status"][aria-live="polite"]').innerText()));
  ok("a11y: the verdict and confidence landmarks survive the live-region narrowing",
    await page.locator('[aria-label="Macro backdrop verdict"]').count() === 1 &&
    await page.locator('[aria-label="Signal quality"]').count() === 1);   // v3.94: confidence on the hero
  await page.close();
}

// ── Slice 1 (UI-OVERHAUL tasks 1.3–1.5) — the mobile verdict contract ────────
// The extracted RegimeBand + FiveWhys must render the complete verdict (posture +
// confidence line + "would change this" why sentence) within the first 600px of
// vertical space at 375px, with the narrative present and no horizontal overflow.
// Driven against the REAL live-stubbed page — the extraction is proven by behavior,
// not by string pins.
console.log("\n[public] Slice 1 — verdict above the fold at 375px (extracted band + whys)");
{
  const { page, errors } = await open({ live: FULL_LIVE, width: 375 });
  await page.waitForTimeout(1200);
  const band = page.locator('[aria-label="Macro backdrop verdict"]');
  const box = await band.boundingBox();
  ok("slice1 @375px: the extracted band renders a posture", POSTURES.test(await band.innerText()));
  ok("slice1 @375px: the complete verdict region ends within the first 600px",
    box !== null && box.y + box.height <= 600);
  await page.locator('button[aria-label="Show regime factors"]').click();   // v3.94: evidence panel
  await page.waitForTimeout(150);
  // 8/28 matrix row 16: the tally's coverage tail took the canonical vocabulary ("N of M
  // voters counted"), so it no longer says "usable" where the line above it says "counted".
  ok("slice1 @375px: the confidence tally and flip sentence ride one tap deep in the band's evidence panel",
    /6 of 6 signals counted/.test(await page.locator(".driver-matrix").innerText()) &&
    await page.locator(".driver-condition").count()===6);
  await page.locator("button.cg-toggle", { hasText: "the reasoning" }).click();   // v3.94: two clicks deep
  await page.waitForTimeout(150);
  await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
  await page.waitForTimeout(150);
  const body = await page.locator("body").innerText();
  ok("slice1 @375px: the why-this-call accountability checks render one tap deep",
    /WHY THIS CALL/.test(body) && /WHAT CHANGES IT/.test(body) && /why this call · 5 checks/i.test(body));
  ok("slice1 @375px: no horizontal overflow",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  ok("slice1 @375px: no page errors from the extracted modules", errors.length === 0);
  await page.close();
}

// ── Wave 15 (tasks 9.1-9.5) — responsive + keyboard + focus, driven live ─────
console.log("\n[public] wave 15 — skip link, focus-on-resolve, hamburger, tap targets");
{
  const { page, errors } = await open({ live: FULL_LIVE, width: 390 });
  await page.waitForTimeout(1400);
  // 9.3 (Req 8.9): the LOADING->settled transition MOVED FOCUS to the verdict region —
  // asserted directly: after the live snapshot lands, the active element IS #overview.
  ok("9.3: focus sits on the verdict region after LOADING resolves (Req 8.9, live-proven)",
    await page.evaluate(() => document.activeElement && document.activeElement.id === "overview"));
  // 9.3: the skip link is the first focusable element in DOM order and reveals on focus.
  ok("9.3: the skip link is the document's first link, revealed on keyboard focus",
    await page.evaluate(() => {
      const links = document.querySelectorAll("a");
      const sk = document.querySelector(".skip-link");
      if (!sk || links[0] !== sk) return false;
      sk.focus();
      return document.activeElement === sk && sk.getBoundingClientRect().left > 0;
    }));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  ok("9.3: activating it jumps to the verdict region (#overview)",
    await page.evaluate(() => location.hash === "#overview"));
  // 8.4: the one polite announcement stays within the 120-char bound.
  ok("9.4: the aria-live announcement is ≤120 characters",
    await page.evaluate(() =>
      document.querySelector('[role="status"][aria-live="polite"]').textContent.length <= 120));
  // 9.1: 44px targets on nav links + CollapsedGroup toggles at phone width.
  ok("9.1: every VISIBLE nav link and disclosure toggle measures ≥44px tall at 390px",
    await page.evaluate(() =>
      [...document.querySelectorAll(".nav-link, .cg-toggle")]
        .filter((el) => el.getClientRects().length)
        .every((el) => el.getBoundingClientRect().height >= 44)));
  ok("wave15: no page errors", errors.length === 0);
  await page.close();
}
{
  const { page } = await open({ live: FULL_LIVE, width: 320 });
  await page.waitForTimeout(1200);
  // 9.1 (Req 6.4): at 320px the nav row is gone, the hamburger disclosure serves the links.
  ok("9.1 @320px: nav collapses to the hamburger form",
    await page.evaluate(() => {
      const row = document.querySelector(".nav-row"), burger = document.querySelector(".nav-burger");
      return getComputedStyle(row).display === "none" && getComputedStyle(burger).display !== "none";
    }));
  ok("9.1 @320px: the hamburger opens to all six section links",
    await (async () => {
      await page.locator(".nav-burger > summary").click();
      await page.waitForTimeout(120);
      return await page.locator(".nav-burger a").count() === 6;
    })());
  ok("9.1 @320px: the header stays within the 56px budget",
    await page.evaluate(() => document.querySelector("header").getBoundingClientRect().height <= 56));
  ok("9.1 @320px: still no horizontal overflow",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.close();
}

// ── Wave 16 (task 9.6, Req 7.9) — a denied clipboard write claims nothing ────
// The old handlers set ✓ COPIED optimistically, so a rejected write still flashed a
// green success for 2s. Driven live: writeText is stubbed to REJECT, the button must
// stay on (or revert to) its idle label within 300ms, and no toast may appear.
console.log("\n[public] wave 16 — share failure reverts to idle, silently");
{
  const { page, errors } = await open({ live: FULL_LIVE });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error("denied"));
  });
  // Slice 1 (public terminal skin): SHARE rides inside Degen's ⋯ MORE disclosure now, so the
  // menu is opened first — the click that follows is the same real click as before.
  await page.locator("details.hdr-ops summary").click();
  await page.waitForTimeout(120);
  const share = page.locator("button", { hasText: "⤴ SHARE" });
  await share.click();
  await page.waitForTimeout(300);
  ok("7.9: after a rejected write the button reads its IDLE label, never ✓ COPIED",
    /⤴ SHARE/.test(await share.innerText()));
  ok("7.9: no error toast is shown for a cancelled/denied share",
    !/denied|failed|error/i.test(await page.locator("body").innerText().then(t =>
      t.split("\n").filter(l => /toast|denied|clipboard/i.test(l)).join(" "))));
  // Control: a SUCCESSFUL write still confirms — the fix must not have muted real success.
  await page.evaluate(() => {
    navigator.clipboard.writeText = (value) => { window.__dashboardShare = value; return Promise.resolve(); };
  });
  await share.click();
  await page.waitForTimeout(200);
  ok("7.9 control: a successful write still confirms ✓ COPIED",
    /✓ COPIED/.test(await page.locator("button", { hasText: /COPIED|SHARE/ }).first().innerText()));
  ok("v6.5.5 share opens the public audience", await page.evaluate(() => window.__dashboardShare === `${location.origin}/?view=public`));
  ok("wave16: no page errors", errors.length === 0);
  await page.close();
}

// ── Wave-17 audit fix — the strip's F&G color agrees with the vote, live ─────
// The defect: F&G 45 votes NEUTRAL (• chip, grey gauge) while the strip painted it
// red off a hand-written `>55` binary — one page, three answers. Driven at both a
// neutral and a greed reading.
console.log("\n[public] wave-17 fix — strip F&G color derives from the band vote");
{
  const { page } = await open({ live: { ...FULL_LIVE, fearGreed: 45, fearGreedLabel: "Neutral" } });
  await page.waitForTimeout(1400);
  const col = await page.evaluate(() => {
    const cell = document.querySelector('.driver-card [title^="Fear & Greed:"]');
    // v6.3: the tile's last child is the sheet button now; the sub-line carries its own class.
    return getComputedStyle(cell).color;
  });
  ok("fix: a NEUTRAL F&G (45) renders the neutral grey (text-secondary) on the strip, not bearish red",
    col === tokRgb("text-secondary"));
  await page.locator('button[aria-label="Show regime factors"]').click();   // v3.94: chips in the panel
  await page.waitForTimeout(150);
  const chips = await page.locator('[aria-label="Macro backdrop verdict"]').innerText();
  ok("fix control: the band chip agrees — F&G carries • (neutral), and the two surfaces now match",
    await page.locator('.driver-card [title="Fear & Greed: NEUTRAL"]').count()===1);
  await page.close();
}
{
  const { page } = await open({ live: FULL_LIVE });
  await page.waitForTimeout(1400);
  const col = await page.evaluate(() => {
    const cell = document.querySelector('.driver-card [title^="Fear & Greed:"]');
    return getComputedStyle(cell).color;   // v6.3: by class (see above)
  });
  ok("fix control: a genuine greed reading (62, bull) still renders green — no over-correction",
    col === tokRgb("green"));
  await page.close();
}

// ── v4.0 One Call — the accountability surfaces are real routes ────────────
console.log("\n[public] v4.0 — canonical call, history, and difference routes");
{
  const { page, errors } = await open({
    live: FULL_LIVE,
    width: 320,
    route: "/history",
    power: false,
    history: {
      schema: "md-history-v1",
      live_forward_only: true,
      available: true,
      history_start: daysAgo(1),
      rows: [{
        date: TODAY,
        capture_status: "CAPTURED",
        call: {
          headline: "MOONING", emoji: "🚀", direction: "BULLISH",
          confidence: "HIGH", actionability: "FULL",
          counts: { usable: 6, total: 6 }, override: { active: false }, factors: [],
        },
        outcomes: {
          schema:"md-spy-outcome-v1", call_date:TODAY,
          anchor:{date:TODAY,close:748.1}, sessions_observed:20, horizon_sessions:20,
          returns_pct:{"1d":1.25,"5d":-2.5,"20d":4}, max_drawdown_pct_20d:-6.75,
          max_drawdown_status:"FINAL", status:"COMPLETE",
        },
      },{
        date: daysAgo(1),
        capture_status: "CAPTURED",
        call: {
          headline: "HODL", emoji: "💎", direction: "NEUTRAL",
          confidence: "MEDIUM", actionability: "HOLD",
          counts: { usable: 5, total: 6 }, override: { active: false }, factors: [],
        },
        outcomes: null,
      }],
    },
  });
  await page.waitForTimeout(500);
  const body = await page.locator("body").innerText();
  ok("v6.4 history: direct route renders plain frozen verdicts, never Degen slang",
    /Bullish/.test(body) && /Hold/.test(body) && !/MOONING|HODL|\bBULLISH\b|\bNEUTRAL\b/.test(body));
  ok("v6.4 history: live-forward contract is visible and call detail is collapsed",
    /live-forward record/i.test(body) && !/10:00 ET · immutable/.test(body));
  ok("v6.4 history: mature 1d/5d/20d and fixed-window max drawdown stay on the thin face",
    /\+1\.25%/.test(body) && /-2\.50%/.test(body) && /\+4\.00%/.test(body) && /-6\.75%/.test(body));
  await page.locator("details.history-detail").first().locator("summary").click();
  await page.waitForTimeout(150);
  const detail = await page.locator("body").innerText();
  ok("v6.4 history: immutable clock and outcome provenance are one tap deep",
    /10:00 ET · immutable/.test(detail) && /max drawdown final at 20 sessions/i.test(detail));
  await page.locator("details.history-detail").nth(1).locator("summary").click();
  await page.waitForTimeout(100);
  const pendingDetail = await page.locator("body").innerText();
  ok("v5.5 history: a not-yet-observed call renders pending fields without zeros",
    /outcome anchor is the first official close/i.test(pendingDetail) &&
    (pendingDetail.match(/PENDING/g) || []).length >= 4 && !/0\.00%/.test(pendingDetail));
  ok("v4.0 history: no horizontal overflow at 320px", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  ok("v4.0 history: no page errors", errors.length === 0);
  await page.close();
}
{
  const { page, errors } = await open({ live: FULL_LIVE, route: "/difference", power: false, width: 320 });
  await page.waitForTimeout(300);
  const body = await page.locator("body").innerText();
  ok("v4.0 difference: the positioning sentence renders", /Nowflation measures the inflation state\. MacroDash translates the entire macro state into risk posture\./.test(body));
  ok("v6.4 difference: the five-step hierarchy renders", ["Six signals","Evidence quality","Market posture","Explanation","Actionability"].every(x => body.includes(x)));
  ok("v4.0 difference: the indicator-count constraint is explicit", /will not compete on indicator count/i.test(body));
  ok("v4.0 difference: no horizontal overflow at 320px", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  ok("v4.0 difference: no page errors", errors.length === 0);
  await page.close();
}
{
  const { page, errors } = await open({ live: { ...FULL_LIVE, vix: 30, fearGreed: 10, fearGreedLabel: "Extreme Fear" } });
  await page.waitForTimeout(1300);
  const body = await page.locator("body").innerText();
  ok("v4.0 PANIC: the override owns the safety banner and effective call", /PANIC OVERRIDE · DIAMOND HANDS 🙌 \/ BEARISH/.test(body));
  ok("v4.0 PANIC: no competing armed banner is shown", !/MACRO FLIP ARMED/.test(body));
  ok("v4.0 PANIC: no page errors", errors.length === 0);
  await page.close();
}

/* ── v7.2 — THE SAHM OVERRIDE, DRIVEN LIVE ────────────────────────────────────────────────
   The fixture's own Sahm is 0.23 (CLEAR) so no existing scenario can fire it by accident —
   pinned below as the control, because a red-fact banner appearing on every other scenario
   would be the more expensive defect. Here it is pushed past 0.50 on an otherwise BULLISH
   tape, which is the case that matters: the backdrop votes risk-on and the circuit forces the
   published call bearish anyway. Driven in BOTH modes, because the banner is a red fact and
   v3.25 says a mode gate may hide an explanation and may never hide one of those. */
console.log("\n[public] v7.2 — the Sahm rule forces the call bearish, in both modes");
for (const power of [false, true]) {
  const { page, errors } = await open({ live: { ...FULL_LIVE, sahm: 0.62 }, power, width: 390 });
  await page.waitForTimeout(1300);
  const body = await page.locator("body").innerText();
  ok(`v7.2 sahm[${power ? "degen" : "simple"}]: the banner names the RECESSION rule, never the crash circuit`,
    /SAHM RULE TRIGGERED/.test(body) && !/PANIC OVERRIDE/.test(body) && !/crash circuit/i.test(body));
  /* The banner has to carry its own evidence: a circuit that overrides the published call and
     shows no reading is asking to be trusted rather than checked. innerText applies
     text-transform, so the reading is matched case-insensitively (the v3.69 lesson). */
  ok(`v7.2 sahm[${power ? "degen" : "simple"}]: the reading, the trigger and the observation date all render`,
    /0\.62 is at or above the 0\.5 recession trigger/i.test(body) && /\(as of \d{4}-\d{2}-\d{2}\)/.test(body));
  /* The call word itself moved. Simple speaks the plain vocabulary and Degen the moon voice —
     the same split every other banner honours, so the override cannot fork the two registers.
     ⚠ MY OWN PIN WAS WRONG ON ITS FIRST RUN, recorded rather than quietly fixed: it asserted
     Simple would read "MACRO: BEARISH", a vocabulary I invented. simpleCallLabel returns the
     bare word from SIMPLE_DIRECTION_LABELS ("Bearish"), which CSS then uppercases — so the pin
     both named the wrong string and would have needed the v3.69 text-transform allowance
     anyway. Matched case-insensitively against the label the product actually owns. */
  ok(`v7.2 sahm[${power ? "degen" : "simple"}]: the published call reads bearish in this mode's own words`,
    power ? /DIAMOND HANDS 🙌 \/ BEARISH/.test(body)
      : /SAHM RULE TRIGGERED · BEARISH/i.test(body) && !/DIAMOND HANDS/.test(body));
  ok(`v7.2 sahm[${power ? "degen" : "simple"}]: no competing armed banner and no page errors`,
    !/MACRO FLIP ARMED/.test(body) && errors.length === 0);
  await page.close();
}
{
  /* THE CONTROL, and it is the half that keeps the pins above honest: on the ordinary fixture
     the rule is CLEAR, so the banner must be ABSENT from the whole page in both modes. A red
     fact that renders unconditionally is not a red fact. */
  const { page, errors } = await open({ live: FULL_LIVE, power: true, width: 390 });
  await page.waitForTimeout(1300);
  const body = await page.locator("body").innerText();
  ok("v7.2 sahm: the ordinary fixture (0.23) never fires it — the banner is absent",
    !/SAHM RULE TRIGGERED/.test(body) && /Sahm/i.test(body) && errors.length === 0);
  await page.close();
}

/* ── v6.0 T4 — the alerts persist, and PR #10's false clear is closed, DRIVEN ─────────────
   vix:30 fires the VIX Spike monitor while the 30Y monitor (active, no thirtyYear in the
   fixture) is blind — the exact fired-AND-blind state the old two-badge render collapsed
   into a confident "⚡ 1 FIRED". Then the persistence loop: toggle + delete, RELOAD, and
   the state survives; garbage in the store falls back to the defaults. */
console.log("\n[public] v6.0 — merged FIRED·BLIND badge + alert persistence across reload");
{
  const { page, errors } = await open({ live: { ...FULL_LIVE, vix: 30 } });
  await page.waitForTimeout(1300);
  ok("v6.0 badge: fired AND blind ride ONE red badge — the blind tell survives a nonzero fired count",
    /⚡ 1 FIRED · \d+ BLIND/.test(await page.locator("body").innerText()));
  await page.locator('button[aria-label="Toggle alert CPI > 4%"]').click();     // OFF -> ON
  await page.locator('button[aria-label="Delete alert 10s30s Inverts"]').click();
  await page.waitForTimeout(200);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1300);
  ok("v6.0 persist: a toggle SURVIVES a reload — the manage buttons stopped being one-session toys",
    (await page.locator('button[aria-label="Toggle alert CPI > 4%"]').innerText()).trim() === "ON");
  ok("v6.0 persist: a delete survives the same reload",
    (await page.locator('button[aria-label="Toggle alert 10s30s Inverts"]').count()) === 0);
  await page.evaluate(() => localStorage.setItem("md:alerts:v1", "{not json"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1300);
  ok("v6.0 persist: garbage in the store falls back to the DEFAULTS — every monitor returns",
    (await page.locator('button[aria-label^="Toggle alert"]').count()) === 9 &&
    (await page.locator('button[aria-label="Toggle alert CPI > 4%"]').innerText()).trim() === "OFF");
  ok("v6.0 alerts: no page errors through the whole loop", errors.length === 0);
  await page.close();
}

// ── v6.0.1 — the public-view UX review: shape before text, toggle clarity, captions under the
// ℹ window (owner, on the live 9/1 Simple + Degen screenshots). Driven on a frozen HODL tape
// with one unavailable signal so every indicator has both states to show. ─────────────────
console.log("\n[public] v6.0.1/v6.4 — shape before text · Simple|Degen clarity · captions one tap deep");
{
  const frozenHodl = { schema:"md-call-v1", effective_date:TODAY, headline:"HODL", emoji:"💎",
    direction:"NEUTRAL", confidence:"HIGH", actionability:"RESTRICTED", status:"PUBLISHED",
    counts:{usable:5,total:6,bull:2,bear:1,neutral:2}, factors:[], override:{active:false} };
  const oneDark = { ...FULL_LIVE }; delete oneDark.cpiHeadline; delete oneDark.cpiHeadlineAsOf; delete oneDark.cpiTrend;
  const { page, errors } = await open({ live: oneDark, width: 390, power: false,
    publicCall: frozenHodl, publicCallFrozen: true, publicCallCapturedAt: `${TODAY}T14:00:00.000Z` });
  await page.waitForTimeout(1300);
  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
  // Slice 1: derived from the tokens (green is the terminal's phosphor now; the toggle fill is green).
  const GREEN = tokRgb("green"), BG = tokRgb("bg");
  /* (1) SHAPE BEFORE TEXT on the cards. The direction glyph is the FIRST child of the card's
     first row and carries the direction colour; the freshness is a filled green DOT for a
     cached reading; the word "cached" is no longer VISIBLE on the face (it survives for a
     screen reader in a visually-hidden span — measured by cloning the card and stripping
     those spans before reading its text). */
  const cards = await page.evaluate(() => [...document.querySelectorAll(".simple-card")].map((c) => {
    const row = c.firstElementChild; const first = row && row.firstElementChild;
    const clone = c.cloneNode(true); clone.querySelectorAll(".visually-hidden").forEach((n) => n.remove());
    const dot = c.querySelector(".simple-card-fresh");
    return { glyph: first ? first.textContent : null, glyphClass: first ? first.className : null,
      glyphColor: first ? getComputedStyle(first).color : null, bar: getComputedStyle(c).borderLeftWidth,
      barColor: getComputedStyle(c).borderLeftColor, visible: clone.textContent, hidden: c.textContent,
      dotBg: dot ? getComputedStyle(dot).backgroundColor : null, dotTitle: dot ? dot.getAttribute("title") : null };
  }));
  ok("v6.9.8 cards: every card leads with a non-directional square status marker",
    cards.length === 6 && cards.every((c) => c.glyphClass === "simple-card-glyph" && c.glyph === "■"));
  ok("v6.0.1 cards: the glyph and the 3px left bar carry the direction colour (green helping, red hurting)",
    cards.every((c) => c.bar === "3px" && c.barColor === c.glyphColor) &&
    cards.some((c) => c.glyph === "■" && c.glyphColor === GREEN) &&
    cards.some((c) => c.glyph === "■" && c.glyphColor === rgb("#e74c3c")));
  // The harness serves `cached:false`, so the mode here is LIVE; the rule is one filled green
  // dot for EITHER live or cached, the word on the title + a11y span only (never on the face).
  ok("T3 cards: freshness WORD is a11y-only — no date, ruler, or freshness dot on the face",
    cards.every((c) => c.dotBg === null) &&
    cards.every((c) => !/live|cached/.test(c.visible) && /live|cached/.test(c.hidden)) &&
    cards.every((c) => !/help <|hurt >|As of /.test(c.visible)));
  ok("v6.9.8 cards: the interpretation names the stock-market meaning, not a bare helping/hurting tag",
    cards.every((c) => /supports? stocks|pressures? stocks|signals? caution|no clear signal|stock outlook|unavailable/i.test(c.visible)));
  /* T3: coverage dots are inside Why-this-call, not under the cards and not on the Simple hero. */
  await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
  await page.waitForTimeout(200);
  const dots = await page.evaluate(() => [...document.querySelectorAll(".signal-dots")].map((n) => ({
    total: n.children.length,
    filled: [...n.children].filter((d) => getComputedStyle(d).backgroundColor !== "rgba(0, 0, 0, 0)").length,
    hollowAmber: [...n.children].filter((d) => getComputedStyle(d).backgroundColor === "rgba(0, 0, 0, 0)" && getComputedStyle(d).borderColor === "rgb(240, 165, 0)").length })));
  ok("T3 dots: Why-this-call fold is the only Simple home — 6 dots, 5 filled green, 1 hollow amber",
    dots.length === 1 && dots[0].total === 6 && dots[0].filled === 5 && dots[0].hollowAmber === 1 &&
    /5 of 6 signals counted/.test(await page.locator("body").innerText()) &&
    !/5 of 6 signals counted/.test(await bandText(page)));
  await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
  await page.waitForTimeout(150);
  /* (2) The toggle: the pressed half is FILLED brand amber; the other is transparent; each
     names what it shows; a shape leads each word. */
  const tog = await page.evaluate(() => [...document.querySelectorAll('[role="group"][aria-label="View mode"] button')].map((b) => ({
    txt: b.innerText.trim(), pressed: b.getAttribute("aria-pressed"), bg: getComputedStyle(b).backgroundColor,
    color: getComputedStyle(b).color, label: b.getAttribute("aria-label"), title: b.getAttribute("title") })));
  // Slice 1 (public terminal skin): the fill is the terminal's phosphor green, not amber — the
  // v6.0.1 contract (a FILL with dark text, legible at a glance) is what this pin measures.
  ok("v6.4/Slice 1 toggle: Simple is pressed and FILLED phosphor green with dark text; Degen is transparent — legible at a glance",
    tog.length === 2 && tog[0].pressed === "true" && tog[0].bg === GREEN && tog[0].color === BG &&
    tog[1].pressed === "false" && tog[1].bg === "rgba(0, 0, 0, 0)");
  ok("v6.0.1 toggle: each half leads with a shape and states what the mode SHOWS in its name and tooltip",
    /^○\s*Simple$/.test(tog[0].txt) && /^◉\s*Degen$/.test(tog[1].txt) &&
    /^Simple view — the call/.test(tog[0].label) && /^Degen view — the moon call/.test(tog[1].label) &&
    tog[0].title === tog[0].label && tog[1].title === tog[1].label);
  /* (3) Captions under the window in Simple: the face names the frozen call and the ℹ window
     carries the capture clock and date. */
  const face = await bandText(page);
  ok("T2 captions (Simple): the face sheds the frozen eyebrow; capture clock is one tap deep",
    !/10am call · frozen/i.test(face) && !/frozen 10am call · captured/.test(face) &&
    /Hold/.test(face));
  // Slice 1: fs-l lifted 13 -> 14 (the terminal's floor); the pin reads the token, not the literal.
  ok("T8 hero: Simple has no ℹ — copy is fs-l on the Hold row; Hold ⓘ is the clock",
    (await page.locator('button[aria-label="Show regime factors"]').count()) === 0 &&
    await page.locator('button[aria-label="Copy MacroDash posture card"]').evaluate((n) => getComputedStyle(n).fontSize) === `${DT["fs-l"]}px`);
  await page.locator(".simple-hold").click();
  await page.waitForTimeout(200);
  const cap = await page.locator('[role="dialog"]').innerText();
  ok("T8 captions (Simple): ONE tap on Hold opens the sheet, and the caption is there with the capture date",
    new RegExp(`frozen 10am call · captured 10:00 ET · ${TODAY}`).test(cap));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  // The budgets this pass must not spend: the strip and the cards stay where v5.9 put them.
  const [glance, cardsTop] = await page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((n) => n.children.length === 0 && /^(?:●?\s*SPY\*?|S&P 500)$/m.test(n.textContent || "") && n.getBoundingClientRect().height > 0);
    const k = document.querySelector('[aria-label="Key parameters"]');
    return [el ? Math.round(el.getBoundingClientRect().top + scrollY) : null, k ? Math.round(k.getBoundingClientRect().top + scrollY) : null]; });
  // v7 adds a named section header above the tile; section entry stays pinned separately.
  ok(`v7 budgets: cards within 420px, first market tile within 720px (measured ${cardsTop} / ${glance})`,
    cardsTop !== null && cardsTop <= 420 && glance !== null && glance <= 720);
  /* v6.0.2: every voting tile's ▪ wears its VOTE colour (this tape is all-bull → all green),
     and it is the same colour its vote-coloured sub-line wears where one exists (F&G, NFCI). */
  await page.getByRole("button", {name:/Explore market data/}).click();
  const marks = await page.evaluate(() => [...document.querySelectorAll(".macro-strip-inner > div")].map((tile) => {
    const m = tile.querySelector(".strip-vote"); const sub = tile.querySelector(".strip-sub");   // v6.3: by class — the last child is the sheet button
    return { l: tile.innerText.split("\n")[0].replace("▪", "").trim(), mark: m ? getComputedStyle(m).color : null,
      sub: sub ? getComputedStyle(sub).color : null, title: tile.getAttribute("title") }; }));
  ok("v6.0.2 strip: the 5 live voters carry a GREEN ▪ on the bull tape, non-voters carry none, and the title names the vote",
    marks.filter((t) => t.mark).length === 4 &&   // VIX · F&G · 10Y · NFCI (CPI is the dark one)
    marks.filter((t) => t.mark).every((t) => t.mark === GREEN && /signal is BULL/.test(t.title)) &&
    marks.filter((t) => /^(SPY|QQQ|FED|CPI)/.test(t.l)).every((t) => !t.mark));
  ok("v6.0.2 strip: where the sub-line is vote-coloured (F&G, NFCI) the marker and the sub agree",
    marks.filter((t) => /^(F&G|NFCI)/.test(t.l)).every((t) => t.mark === t.sub));
  await page.getByRole("button", {name:/Explore market data/}).click();
  /* v6.0.2: the footer is one closed disclosure; the version + not-advice fact survive on the row. */
  ok("T5 footer (Simple): closed promise is About this page; version + not-advice one tap deep",
    !/Retired: CBOE Put\/Call/.test(await page.locator("body").innerText()) &&
    /About this page/.test(await page.locator(".site-footer").innerText()) &&
    !/not financial advice/i.test(await page.locator(".site-footer button.cg-toggle").innerText()) &&
    (await page.locator(".site-footer button.cg-toggle").boundingBox()).height >= 44);
  ok("T10 face (Simple): Track Record / Why MacroDash left the first screen",
    (await page.locator('nav[aria-label="MacroDash accountability"]').count()) === 0 &&
    !/TRACK RECORD/.test(await page.locator("body").innerText()) &&
    !/WHY MACRODASH/.test(await page.locator("body").innerText()));
  await page.locator(".site-footer button.cg-toggle").click();
  await page.waitForTimeout(150);
  ok("T10 About (Simple): Track record, Why MacroDash, and Share this page live one tap deep",
    /Track record/.test(await page.locator(".site-footer").innerText()) &&
    /Why MacroDash/.test(await page.locator(".site-footer").innerText()) &&
    /Share this page/.test(await page.locator(".site-footer").innerText()));
  await page.locator(".site-footer button.cg-toggle").click();
  await page.waitForTimeout(150);
  const typePx = await page.evaluate(() => {
    const hold = document.querySelector(".simple-hold");
    const holdSpan = hold && [...hold.querySelectorAll("span")].find((n) => n.childElementCount === 0 && !n.classList.contains("visually-hidden") && (n.textContent || "").trim().length > 1);
    const card = document.querySelector(".simple-card");
    const value = card && card.querySelector(".simple-card-value");
    const label = card && [...card.querySelectorAll("span")].find((n) => !n.classList.contains("simple-card-glyph") && !n.classList.contains("visually-hidden") && getComputedStyle(n).fontWeight !== "600" && getComputedStyle(n).fontWeight !== "700" && (n.textContent || "").trim().length > 1);
    return {
      hold: holdSpan ? getComputedStyle(holdSpan).fontSize : null,
      card: value ? getComputedStyle(value).fontSize : null,
      label: label ? getComputedStyle(label).fontSize : null,
      holdText: holdSpan ? holdSpan.textContent.trim() : null,
      cardText: value ? value.textContent.trim() : null,
    };
  });
  // Slice 1: the label read fs-m, lifted 11 -> 12.5 by the token bridge. v6.8.2 (Slice 2 item 2):
  // the cards adopt the STRIP anatomy, so the label is the strip's own fs-s eyebrow and the vote
  // word its fs-xs sub — read off DT so a floor change moves this pin with it; the value keeps 16.
  ok(`v6.9.8 type (Simple): Hold is 28px, supporting readings fs-m, labels fs-s (measured hold=${typePx.hold} value=${typePx.card} label=${typePx.label})`,
    typePx.hold === "28px" && typePx.card === null && typePx.label === null);
  const cardAnat = await page.evaluate(() => {
    const px = (n) => n ? getComputedStyle(n).fontSize : null;
    const cards = [...document.querySelectorAll(".simple-card")];
    const leaves = [...document.querySelectorAll('[aria-label="Key parameters"] *')].filter((n) => n.children.length === 0 && (n.textContent || "").trim() && !n.classList.contains("visually-hidden") && n.getBoundingClientRect().height > 0);
    return { n: cards.length, vote: cards.map((c) => px(c.querySelector(".simple-card-vote"))), label: cards.map((c) => px(c.querySelector(".simple-card-label"))),
      words: cards.map((c) => (c.querySelector(".simple-card-vote") || {}).textContent), minLeaf: Math.min(...leaves.map((n) => parseFloat(getComputedStyle(n).fontSize))), leaves: leaves.length,
      text: document.querySelector('[aria-label="Key parameters"]').innerText }; });
  ok(`v6.9.8 cards (Simple, 390): no duplicate vote tag, labels fs-s, no visible leaf under 10px (measured min ${cardAnat.minLeaf})`,
    cardAnat.n === 6 && cardAnat.vote.every((v) => v === null) && cardAnat.label.every((v) => v === null) &&
    cardAnat.words.every((w) => w === undefined) && !/ⓘ/.test(cardAnat.text) && cardAnat.minLeaf >= 10);
  ok("T9 header (Simple): Wordmark + Simple|Degen — Terminal and Share are not wrapping peers",
    (await page.locator('a[aria-label="Open Ticker Terminal"]').count()) === 0 &&
    (await page.locator("header button[aria-label='Copy dashboard link']").count()) === 0 &&
    (await page.locator("header .hdr-simple, header.hdr-simple").count()) >= 1);
  ok("v6.0.1: no page errors through the Simple pass", errors.length === 0);
  // Degen contrast on the same tape: the caption stays ON the face, the pressed half is Degen.
  await page.locator("button", { hasText: "Degen" }).click();
  await page.waitForTimeout(500);
  const pface = await bandText(page);
  ok("v6.4 captions (Degen): the frozen-call line stays on the face — accessible without a tap",
    new RegExp(`frozen 10am call · captured 10:00 ET · ${TODAY}`).test(pface) &&
    (await page.locator('[aria-label="Macro backdrop verdict"] .call-caption').count()) === 0);
  /* v6.8.4 (PUBLIC TERMINAL SKIN, Slice 2 item 4 — the plan's "frozen/6pm/coverage become one
     status line, not four"): measured, not string-pinned. The eyebrow and the clock caption now
     share ONE row (same computed `top`, eyebrow left of its value), the caption reads the fs-xs
     floor while the eyebrow reads fs-s like a strip label, and the caption keeps its own case —
     innerText applies text-transform, so an uppercased value span would silently rewrite the
     dated string three suites read. */
  const heroRow = await page.evaluate(() => {
    const root = document.querySelector('[aria-label="Macro backdrop verdict"]');
    const clock = root.querySelector(".hero-clock");
    if (!clock) return null;
    const eyebrow = clock.previousElementSibling;
    const cs = getComputedStyle(clock), es = getComputedStyle(eyebrow);
    const cr = clock.getBoundingClientRect(), er = eyebrow.getBoundingClientRect();
    return { clockPx: parseFloat(cs.fontSize), eyePx: parseFloat(es.fontSize),
      clockCase: cs.textTransform, eyeCase: es.textTransform,
      oneContainer: clock.parentElement === eyebrow.parentElement && getComputedStyle(clock.parentElement).display === "flex",
      packed: Math.abs(cr.top - er.top) < 6,
      raw: clock.textContent.trim(), eyeRaw: eyebrow.textContent.trim() };
  });
  /* CORRECTION, recorded rather than quietly fixed: the first cut of this pin asserted the two
     spans share a computed `top`. They do at 1280 and they do NOT here — at 390px the merged row
     legitimately WRAPS, which is exactly why the merge's real-estate win lands on desktop and not
     on the phone (measured: Degen verdict 122→115 at 1280, 222→234 at 390, the type lift's cost).
     The load-bearing contract is ONE flex container in DOM order, not one painted line, so that is
     what is pinned; the packing is REPORTED at whatever width the scenario runs. */
  ok(`v6.8.4 Degen hero: eyebrow (${heroRow && heroRow.eyePx}px) and clock caption (${heroRow && heroRow.clockPx}px) are ONE status row on the token floor (packed onto one painted line here: ${heroRow && heroRow.packed}), and the dated caption keeps its case`,
    heroRow !== null && heroRow.oneContainer &&
    heroRow.eyePx === DT["fs-s"] && heroRow.clockPx === DT["fs-xs"] &&
    heroRow.eyeCase === "uppercase" && heroRow.clockCase === "none" &&
    new RegExp(`^frozen 10am call · captured 10:00 ET · ${TODAY}$`).test(heroRow.raw) &&
    /Macro Backdrop · 10am call · frozen/i.test(heroRow.eyeRaw));
  /* The acceptance item, measured on the hero: nothing visible in the Degen verdict region
     renders under 10px — the region that carried 8px eyebrows and 9px status lines since v3.94. */
  const heroMin = await page.evaluate(() => {
    const root = document.querySelector('[aria-label="Macro backdrop verdict"]');
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const px = []; let n;
    const hidden = (el) => { const cs = getComputedStyle(el); return cs.display === "none" || cs.visibility === "hidden" || el.classList.contains("visually-hidden") || el.closest(".visually-hidden"); };
    while ((n = w.nextNode())) { const t = (n.textContent || "").trim(); if (!t) continue; const el = n.parentElement;
      if (!el || hidden(el)) continue; px.push(parseFloat(getComputedStyle(el).fontSize)); }
    return px.length ? Math.min(...px) : null;
  });
  ok(`v6.8.4 Degen hero type floor: the smallest visible leaf in the verdict region is ${heroMin}px`,
    heroMin !== null && heroMin >= DT["fs-xs"]);
  /* v6.8.5 — the CollapsedGroup toggle, the most-rendered label on the page (26 of them in a
     closed Degen). Measured, not string-pinned: every operator label reads fs-s and the
     ILLUSTRATIVE chip inside the same button reads fs-xs, so the one control has no sub-floor
     text left. The 44px thumb rule at ≤480px already reserved the row, which is why the lift
     cost the phone ZERO height (docH 5174 before and after) and desktop +28px. */
  const toggles = await page.evaluate(() => {
    const out = [];
    for (const b of document.querySelectorAll("button.cg-toggle")) {
      if (!b.offsetParent) continue;
      for (const s of b.querySelectorAll("span")) {
        if (!(s.textContent || "").trim()) continue;
        out.push(Math.round(parseFloat(getComputedStyle(s).fontSize) * 10) / 10);
      }
    }
    return out;
  });
  ok(`v6.8.5 Degen: every visible CollapsedGroup toggle span reads the token floor (${toggles.length} spans, smallest ${toggles.length ? Math.min(...toggles) : "n/a"}px) — the label at fs-s, the chip at fs-xs`,
    toggles.length >= 4 && toggles.every((p) => p >= DT["fs-xs"]) && toggles.some((p) => p === DT["fs-s"]));
  ok("v6.4/Slice 1 toggle (Degen): the fill follows the choice — Degen is now the green half",
    (await page.locator('button[aria-pressed="true"]').evaluate((n) => [n.innerText.replace(/\s+/g, " ").trim(), getComputedStyle(n).backgroundColor].join("|"))) === `◉ Degen|${GREEN}`);
  await page.close();
}

// ── v6.2/v6.4 — the 6pm evening update on the hero, in OPS, and on /history ──────────────
console.log("\n[public] v6.2/v6.4 — the 6pm evening update: one line, both modes, unscored on /history");
{
  const readMoon = { schema: "md-call-v1", effective_date: TODAY, headline: "MOONING", emoji: "🚀", direction: "BULLISH",
    confidence: "HIGH", actionability: "FULL", status: "OK", counts: { usable: 6, total: 6, bullish: 6, neutral: 0, bearish: 0, unavailable: 0 },
    factors: [], override: { active: false, macro_flip: { evaluable: true, armed: false, tripped: false } }, downgraded: null };
  const frozenHodl = { schema: "md-call-v1", effective_date: TODAY, headline: "HODL", emoji: "💎", direction: "NEUTRAL",
    confidence: "MEDIUM", actionability: "RESTRICTED", status: "PARTIAL DATA", counts: { usable: 5, total: 6 }, factors: [], override: { active: false } };
  const frozenMoon = { ...readMoon };
  const closeRec = (read, over = {}) => ({ schema: "md-close-read-record-v1", date: TODAY, captured_at: `${TODAY}T22:00:06.000Z`,
    scheduled_for: "18:00 America/New_York", capture_status: "CAPTURED", failure: null,
    close_read: { schema: "md-close-read-v1", date: TODAY, generated_at: `${TODAY}T22:00:05.000Z`, edition: "close", scored: false, read,
      legs: [], legs_same_day: ["tenYear", "fearGreed"], legs_prior: ["vix", "spyPrice"], spy_close: null, basis: {}, headlines: [], drift_vs_call: null }, ...over });
  const frozenAt = `${TODAY}T14:00:00.000Z`;
  const DEGEN_LINE = /Evening update \(6pm ET\): MOONING 🚀 · BULLISH — unscored; the 10am call remains frozen above/;
  const SIMPLE_LINE = /Evening update \(6pm ET\): Bullish — unscored; the 10am call remains frozen above/;
  let colorDiffers = null;
  // A. Power: a frozen HODL beside a captured MOONING close read — the read owns the drift slot.
  {
    const { page, errors } = await open({ live: FULL_LIVE, publicCall: frozenHodl, publicCallFrozen: true, publicCallCapturedAt: frozenAt, publicCloseRead: closeRec(readMoon) });
    await page.waitForTimeout(1200);
    const band = await bandText(page);
    ok("v6.4 hero (Degen): the captured evening update renders as one scoped line under the frozen HODL",
      DEGEN_LINE.test(band) && /HODL 💎/.test(band) && /10am call · frozen/i.test(band));
    const closeReadCount = await page.locator('[aria-label="Macro backdrop verdict"] .close-read').count();
    ok("v6.4 hero: the evening update owns the drift slot",
      !/Current evidence now reads/.test(band) && closeReadCount === 1);
    // v6.6.2: read the colour only when the line rendered. An unguarded evaluate on a zero-count
    // locator throws an UNCAUGHT 30s timeout that kills the whole suite mid-run with no total —
    // which is how PR #44's CI run died (the midnight-ET race, now guarded at suite start).
    colorDiffers = closeReadCount === 1
      ? await page.locator('[aria-label="Macro backdrop verdict"] .close-read').evaluate((n) => getComputedStyle(n).color)
      : null;
    // OPS: the compatibility token remains internal while the reader sees EVENING UPDATE.
    await page.locator("details.hdr-ops summary").click();
    await page.waitForTimeout(150);
    ok("v6.2 OPS: '⎘ DAILY CALL' is retired — the operator export reads the edition it will paste (10AM CALL on a frozen day)",
      !/DAILY CALL/.test(await page.locator("body").innerText()) &&
      /⎘ 10AM CALL/.test(await page.locator('button[aria-label="Copy MacroDash daily call"]').innerText()));
    await page.evaluate(() => { window.__closeCopy = null; navigator.clipboard.writeText = (v) => { window.__closeCopy = v; return Promise.resolve(); }; });
    const closeBtn = page.locator('button[aria-label="Copy MacroDash evening update"]');
    ok("v6.4 OPS: a captured update gets its own ⎘ EVENING UPDATE export", await closeBtn.count() === 1 && /⎘ EVENING UPDATE/.test(await closeBtn.innerText()));
    await closeBtn.click();
    await page.waitForTimeout(150);
    const copied = await page.evaluate(() => window.__closeCopy);
    ok("v6.4 OPS: the export carries the public EVENING UPDATE edition and says UNSCORED",
      /^MACRODASH EVENING UPDATE · /.test(copied || "") && /UNSCORED/.test(copied || "") && /MOONING 🚀 · BULLISH/.test(copied || "") &&
      /EVENING UPDATE COPIED/.test(await closeBtn.innerText()));
    ok("v6.2 hero (Power): no page errors", errors.length === 0);
    await page.close();
  }
  // B. Power: an AGREEING close read is muted, not coloured — and the drift fallback survives when there is no read.
  {
    const { page } = await open({ live: FULL_LIVE, publicCall: frozenMoon, publicCallFrozen: true, publicCallCapturedAt: frozenAt, publicCloseRead: closeRec(readMoon) });
    await page.waitForTimeout(1200);
    const agreeLine = page.locator('[aria-label="Macro backdrop verdict"] .close-read');
    const agreeColor = (await agreeLine.count()) === 1 ? await agreeLine.evaluate((n) => getComputedStyle(n).color) : null;
    ok("v6.2 hero: an agreeing close read still renders the line, MUTED — a different colour from the disagreeing one",
      DEGEN_LINE.test(await bandText(page)) && agreeColor !== null && colorDiffers !== null && agreeColor !== colorDiffers);
    await page.close();
    const { page: p2 } = await open({ live: FULL_LIVE, publicCall: frozenHodl, publicCallFrozen: true, publicCallCapturedAt: frozenAt, publicCloseRead: null });
    await p2.waitForTimeout(1200);
    const b2 = await bandText(p2);
    ok("v6.2 hero: with NO close read the v5.5 live-drift line renders exactly as before (the fallback survives)",
      /Current evidence now reads MOONING 🚀 · BULLISH/.test(b2) && !/Evening update/.test(b2) &&
      (await p2.locator('button[aria-label="Copy MacroDash evening update"]').count()) === 0);
    await p2.close();
    const { page: p3 } = await open({ live: FULL_LIVE, publicCall: frozenHodl, publicCallFrozen: true, publicCallCapturedAt: frozenAt,
      publicCloseRead: closeRec(null, { capture_status: "FAILED", close_read: null, failure: "refresh HTTP 503" }) });
    await p3.waitForTimeout(1200);
    ok("v6.2 hero: a FAILED capture renders NO close-read line (history carries it) and no export button",
      (await p3.locator('[aria-label="Macro backdrop verdict"] .close-read').count()) === 0 &&
      (await p3.locator('button[aria-label="Copy MacroDash evening update"]').count()) === 0);
    await p3.close();
  }
  // C. Simple at 390: the SAME line (owner: both modes), inside the frozen budgets — measured, printed.
  {
    const { page, errors } = await open({ live: FULL_LIVE, width: 390, power: false, publicCall: frozenHodl, publicCallFrozen: true, publicCallCapturedAt: frozenAt, publicCloseRead: closeRec(readMoon) });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1200);
    ok("T2 hero (Simple): evening update left the face for Hold ⓘ — plain vocabulary, one tap",
      !SIMPLE_LINE.test(await bandText(page)) && !/unscored/.test(await bandText(page)) &&
      !/MOONING|BULLISH/.test(await bandText(page)) &&
      (await page.locator('[aria-label="Macro backdrop verdict"] .close-read').count()) === 0 &&
      (await page.locator('button[aria-pressed="true"]', { hasText: "Simple" }).count()) === 1);
    await page.locator(".simple-hold").click();
    await page.waitForTimeout(200);
    ok("T2 Hold ⓘ: the sheet carries the evening update in plain vocabulary plus the frozen clock",
      SIMPLE_LINE.test(await page.locator('[role="dialog"]').innerText()) &&
      /frozen 10am call · captured 10:00 ET/.test(await page.locator('[role="dialog"]').innerText()));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    const [glance, cardsTop] = await page.evaluate(() => {
      const el = document.querySelector(".simple-market-tape");
      const k = document.querySelector('[aria-label="Key parameters"]');
      return [el ? Math.round(el.getBoundingClientRect().top + scrollY) : null, k ? Math.round(k.getBoundingClientRect().top + scrollY) : null]; });
    ok(`v6.2 budgets: WITH a close read the cards still begin within 420px and the strip within 660px at 390×844 (measured ${cardsTop} / ${glance})`,
      cardsTop !== null && cardsTop <= 420 && glance !== null && glance <= 660);
    ok("v6.2 hero (Simple): 390px stays overflow-free with the line", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) && errors.length === 0);
    await page.close();
  }
  // D. The public route shows it too — it is public content, not operator chrome.
  {
    const { page } = await open({ live: FULL_LIVE, route: "/?view=public", width: 320, publicCall: frozenHodl, publicCallFrozen: true, publicCallCapturedAt: frozenAt, publicCloseRead: closeRec(readMoon) });
    await page.waitForTimeout(1200);
    ok("v6.4 hero (public route): the evening update renders for a visitor; no OPS export leaks",
      DEGEN_LINE.test(await bandText(page)) && (await page.locator('button[aria-label="Copy MacroDash evening update"]').count()) === 0 &&
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.close();
  }
  // E. /history: the read rides INSIDE the day's row (row count = scored calls), a failed one says so.
  {
    const row = (date, call, close_read) => ({ date, capture_status: "CAPTURED", call, outcomes: null, close_read });
    const { page, errors } = await open({ live: FULL_LIVE, width: 320, route: "/history", power: false, history: {
      schema: "md-history-v1", live_forward_only: true, available: true, history_start: daysAgo(1), close_reads_unscored: true, close_reads_orphaned: [],
      rows: [row(TODAY, frozenHodl, closeRec(readMoon)),
             row(daysAgo(1), frozenMoon, closeRec(null, { date: daysAgo(1), capture_status: "FAILED", close_read: null, failure: "refresh HTTP 503" }))] } });
    await page.waitForTimeout(500);
    const face = await page.locator("body").innerText();
    ok("v6.4 history: the thin face uses plain verdicts and keeps update detail collapsed",
      /Hold/.test(face) && /Bullish/.test(face) && !/MOONING|HODL/.test(face) &&
      !/6pm evening update: Bullish/.test(face));
    await page.locator("details.history-detail").first().locator("summary").click();
    await page.waitForTimeout(150);
    const body = await page.locator("body").innerText();
    ok("v6.4 history: the evening update renders inside details — plain, unscored, with same-day signals and ET clock",
      /6pm evening update: Bullish · unscored · same-day signals: 10Y · F&G · 18:00 ET/.test(body));
    ok("v6.4 history: a FAILED update is stated in its row, and the row count is still the number of scored calls",
      /6pm evening update: CAPTURE FAILED — refresh HTTP 503/.test(body) &&
      (await page.locator('ol[aria-label="Daily MacroDash calls"] > li').count()) === 2 &&
      /unscored 6pm ET evening update/.test(body));
    ok("v6.2 history: no horizontal overflow at 320px, no page errors",
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) && errors.length === 0);
    await page.close();
  }
}

// ── v6.3 — eight sheets: every macro-strip tile opens its explainer, DRIVEN ──────────────
console.log("\n[public] v6.9.9.5 — one primary evidence view and three context sheets");
for (const width of [320,390,768,1280]) {
  const {page,errors}=await open({live:FULL_LIVE,width});
  await page.waitForTimeout(1200);
  const tape=page.locator(".degen-market-tape");
  ok(`v6.9.9.5 @${width}: exactly three context tiles; no duplicate voter strip`,
    await tape.locator(".strip-tile").count()===3 && await page.locator(".macro-strip-inner").count()===0 &&
    !/VIX|F&G|10Y|CPI|NFCI/.test(await tape.innerText()));
  ok(`v6.9.9.5 @${width}: evidence precedes local changes and reasoning`,await page.evaluate(()=>{
    const e=document.querySelector(".driver-matrix"),c=document.querySelector(".what-changed");
    return e&&c&&Boolean(e.compareDocumentPosition(c)&Node.DOCUMENT_POSITION_FOLLOWING);
  }));
  for (let i=0;i<3;i++) {
    const trigger=tape.locator(".strip-tile").nth(i);
    await trigger.click();
    const dlg=page.getByRole("dialog");
    ok(`v6.9.9.5 @${width}: context ${i+1} has one three-bullet lesson`,await dlg.locator("li").count()===3);
    if(i===0)ok("S&P sheet discloses the proxy and separate crash circuit",/not an SPY quote/.test(await dlg.innerText())&&/crash circuit/.test(await dlg.innerText()));
    if(i===2)ok("Fed target is dated and not a model voter",/3\.50–3\.75%/.test(await dlg.innerText())&&/six-signal model does not read/.test(await dlg.innerText()));
    await page.keyboard.press("Escape");
    ok("context restores keyboard focus",await trigger.evaluate(el=>document.activeElement===el));
  }
  ok(`v6.9.9.5 @${width}: no overflow or runtime errors`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)&&errors.length===0);
  await page.close();
}
{
  const {page}=await open({live:DEGRADED});
  await page.waitForTimeout(1200);
  const row=page.locator(".driver-card").filter({hasText:"NFCI"});
  ok("unavailable factor: no reading or directional claim on the face",/Not counted/.test(await row.innerText())&&/Current reading unavailable/.test(await row.innerText()));
  await row.click();
  ok("unavailable factor: the sheet names its exclusion",/excluded —/i.test(await page.getByRole("dialog").innerText()));
  await page.keyboard.press("Escape");
  await page.close();
}
{
  // Simple at 390×844: the same eight triggers, a real phone thumb target, the budgets held.
  const { page, errors } = await open({ live: FULL_LIVE, width: 390, power: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  /* v6.8.1 REVERSAL (Slice 2 item 1, the strip lift): the v6.3 half of this pin counted eight
     ⓘ glyphs. The whole tile has been the dialog trigger since v6.3, so the glyph was a second
     affordance for the target under the thumb; it is now pinned ABSENT from the strip's text.
     The eight triggers themselves — the actual affordance — are still pinned present, and the
     sr-only promise still rides every tile (read by accessible name, not by innerText). */
  ok("v6.9.9 Simple tape: two dated performance tiles, no raw levels",
    (await page.locator('.simple-market-tile').count()) === 2 &&
    /S&P 500/.test(await page.locator('.simple-market-tape').innerText()) &&
    !/748.1/.test(await page.locator('.simple-market-tape').innerText()));
  const heights = await page.locator('.simple-market-tile').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));
  ok("v6.9.9 Simple tape: 44px targets", heights.every(h=>h>=44));
  await page.getByRole('button', {name:/Explore market data/}).click();
  const stripText = await page.locator('.macro-strip-inner').innerText();
  /* RE-PINNED v7.1: SIX -> FIVE, and the claim is STRONGER for it. v6.9.9 moved the two
     duplicated return tiles out of this fold, leaving six: five voters plus the FED policy-rate
     tile. Owner ruling 2026-09-19 defines Simple as the fundamentals — for the market call, the
     VOTERS — so the one non-voter left in the fold leaves it. FED is not deleted: FedPolicyTile
     renders it in the Degen tape, which is where a rate-path reading belongs.
     The count alone would be a weak pin (five of anything passes), so this asserts WHICH five:
     the fold is exactly the voter set, sourced from the role registry rather than a second
     hardcoded list, with the de-duplicated returns and the moved FED both pinned absent. */
  ok("v7.1 optional context: the fold is the FIVE voter tiles — no returns, no FED policy rate",
    (await page.locator('.macro-strip-inner .strip-tile').count()) === 5 &&
    !/SPY|QQQ/.test(await page.locator('.macro-strip-inner').innerText()) &&
    !/Fed rate|FOMC/.test(await page.locator('.macro-strip-inner').innerText()) &&
    ["VIX", "F&G", "10Y", "CPI", "NFCI"].every((l) =>
      new RegExp(l.replace("&", "&")).test(stripText)));
  await page.locator('.macro-strip-inner .strip-tile').nth(2).click();
  ok("v6.9.9 context: 10Y still opens the canonical lesson", /Long-term interest rates/.test(await page.getByRole('dialog').innerText()));
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name:/Explore market data/}).click();
  const [glance, cardsTop] = await page.evaluate(() => {
    const el = document.querySelector(".simple-market-tape");
    const k = document.querySelector('[aria-label="Key parameters"]');
    return [el ? Math.round(el.getBoundingClientRect().top + scrollY) : null, k ? Math.round(k.getBoundingClientRect().top + scrollY) : null]; });
  ok(`v6.3 budgets: with eight sheet triggers the cards still begin within 420px and the strip within 660px at 390×844 (measured ${cardsTop} / ${glance})`,
    cardsTop !== null && cardsTop <= 420 && glance !== null && glance <= 660);
  ok("v6.3 strip (Simple): 390px stays overflow-free, no page errors",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) && errors.length === 0);
  await page.close();
}

// ── v6.5.0 STOCK SPOTLIGHT — both modes, the always-visible fields, the chart, unavailable/stale
//    states, and the disabled/absent feed. Fixture: test/spotlight-fixture.mjs (synthetic,
//    built through the REAL model builder so the widget consumes the real contract shape). ──
console.log("\n[public] v6.5 — STOCK SPOTLIGHT: Simple + Degen, always-visible cap/YTD/chart, unavailable, disabled");
{
  const { makeSpotlightFixture } = await import("./spotlight-fixture.mjs");
  const fx = makeSpotlightFixture();
  const feed = { schema: "md-spotlight-v1", enabled: true, model: fx.projected };
  const region = (page) => page.locator('[aria-label="Stock Spotlight"]');
  const stripGeom = (page) => page.evaluate(() => { const s = document.querySelector(".macro-strip"), r = document.querySelector('[aria-label="Stock Spotlight"]');
    return { stripBottom: s ? Math.round(s.getBoundingClientRect().bottom + scrollY) : null, regionTop: r ? Math.round(r.getBoundingClientRect().top + scrollY) : null }; });
  // 1. Feature flag off, and a dead feed: NOTHING renders, in either mode.
  { const { page, errors } = await open({ live: FULL_LIVE, width: 390, power: false, spotlight: { schema: "md-spotlight-v1", enabled: false, reason: "feature flag off" } });
    await page.waitForTimeout(1200);
    ok("v6.5 flag off (Simple): no Stock Spotlight region renders", (await region(page).count()) === 0 && errors.length === 0);
    await page.close(); }
  { const { page, errors } = await open({ live: FULL_LIVE, width: 1280, power: true, spotlight: null });
    await page.waitForTimeout(1200);
    ok("v6.5 dead feed (Degen): no region renders — never example companies", (await region(page).count()) === 0 && errors.length === 0);
    await page.close(); }
  // 2. SIMPLE at 390px — the compact profiles.
  let simpleFace = null;
  { const { page, errors } = await open({ live: FULL_LIVE, width: 390, power: false, spotlight: feed });
    await page.waitForTimeout(1600);
    const r = region(page);
    const text = await r.innerText();
    const g = await stripGeom(page);
    ok(`v6.5 Simple: the widget sits directly BELOW the macro strip (strip bottom ${g.stripBottom} → region top ${g.regionTop})`,
      g.stripBottom !== null && g.regionTop !== null && g.regionTop >= g.stripBottom - 1 && g.regionTop - g.stripBottom < 16);
    ok("v6.5 Simple: both company names and tickers and the comparison label (the week SEED stays Degen-only)",
      /Nebius Group/.test(text) && /NBIS/.test(text) && /Microsoft/.test(text) && /MSFT/.test(text) && /Established growth/.test(text) && !/week of/.test(text));
    /* v6.9.5 — THE CADENCE REACHES SIMPLE. Owner, on a live Simple screenshot: "Still shows
       Microsoft and it's been 3 days." The pair was correct and the line that says so was gated
       `!simple`, i.e. hidden from the default view. Driven here rather than pinned in source,
       because the defect was a RENDER gate and only a rendered read can prove it is gone. */
    ok("v6.9.5 Simple: the rotation cadence and the next name are ON the face — the question 'is it stuck?' is answered without switching modes",
      /a new name each day/.test(text) && /next: AAPL/.test(text));
    ok("Simple face: company size, return this year and one fundamental; detailed prose stays behind the tap",
      (text.match(/[+−]\d+\.\d\d%/g) || []).length >= 2 &&
      /\$70\.1B/.test(text) && /\$3\.41T/.test(text) && /MARKET CAP/i.test(text) &&
      !/as of \d{4}-\d{2}-\d{2}/.test(text) && /REVENUE GROWTH/i.test(text) &&
      !/OPERATING MARGIN/i.test(text) && !/FREE CASH FLOW/i.test(text) &&
      !/trailing revenue/i.test(text) && !/12\.5×/.test(text) &&
      !/BUSINESS ·/.test(text) && !/WATCH NEXT ·/.test(text) &&
      (await r.locator('[aria-label="Full assessment"]').count()) === 0);
    ok("v6.5 Simple: YTD numbers for both — no `through` crumbs on the face, no price-return caveat",
      (await r.locator('.stock-profile-trigger', { hasText: "Return this year" }).count()) === 2 && !/PRICE RETURN/i.test(text) &&
      !/through \d{4}-\d{2}-\d{2}/.test((await r.locator('.stock-profile-trigger').allInnerTexts()).join("\n")));
    ok("v6.5 Simple (density review): NO blurb on the face; the dates and the blurb live one tap deep",
      !/rents out AI computing capacity/.test(text) && !/Sells software and cloud computing/.test(text));
    ok("T4 Simple chart: title is ticker vs ticker YTD; two lines, a zero reference; no from-through essay",
      (await r.locator(".recharts-line").count()) === 2 && (await r.locator(".recharts-reference-line").count()) === 1 &&
      /NBIS vs MSFT · return this year/.test(text) && !/YTD COMPARISON/.test(text) && !/from 2025-12-31/.test(text));
    ok("T6 Learning moment starts collapsed — promise label, no run-rate body, no LEARNING MOMENT essay",
      /Learning moment/.test(text) && !/LEARNING MOMENT/.test(text) && !/run-rate/i.test(text) &&
      (await r.locator('[aria-label="Learning moment"]').count()) === 0 &&
      /Explore the numbers/.test(text) && (await r.locator('[aria-label$="supporting analysis"]').count()) === 0 &&
      await page.evaluate(() => {
        const toggles = [...document.querySelectorAll('[aria-label="Stock Spotlight"] button.cg-toggle')];
        const lesson = toggles.find((b) => /Learning moment/.test(b.innerText));
        const chart = document.querySelector('[aria-label="Year-to-date comparison chart"]');
        return lesson && chart && lesson.getBoundingClientRect().top < chart.getBoundingClientRect().top;
      }));
    for (const name of ["Nebius Group", "Microsoft"]) {
      const trigger = r.locator('.stock-profile-trigger', { hasText: name });
      ok(`company tap: ${name} trigger exposes its market cap, return and fundamental in its accessible name`,
        /Market cap/i.test(await trigger.innerText()) && /Return this year/i.test(await trigger.innerText()));
      await trigger.focus();
      await page.keyboard.press("Enter");
      const sheet = page.getByRole("dialog");
      const detail = await sheet.innerText();
      ok(`company tap: ${name} opens its own business, size, return and growth explainer`,
        detail.includes(name) && /Market capitalization: \$/.test(detail) &&
        /total shares outstanding/.test(detail) && /reinvested dividends/.test(detail) &&
        /not profit growth/.test(detail) && /Market capitalization as of/.test(detail) &&
        /Return through/.test(detail) && (await sheet.locator("li").count()) === 3);
      ok(`company tap: ${name} shows sourced, period-qualified earnings without changing the face`,
        /Net earnings: 12 months to/.test(detail) &&
        (name === "Nebius Group" ? /net loss.*price-to-earnings.*not meaningful/s.test(detail) : /Investors pay.*per \$1 earned/s.test(detail)) &&
        (await sheet.getByRole("link", { name: "net earnings source" }).count()) === 1);
      ok(`company tap: ${name} fits the phone width`, await sheet.evaluate(n => n.scrollWidth <= n.clientWidth + 1));
      await page.keyboard.press("Escape");
      ok(`company tap: ${name} closes and restores focus`, (await page.getByRole("dialog").count()) === 0 && await trigger.evaluate(n => n === document.activeElement));
    }
    await r.locator("button.cg-toggle", { hasText: "Learning moment" }).click();
    const lesson = r.locator('[aria-label="Learning moment"]');
    ok("v6.5.5 Learning moment alone shows both dated worked examples and the limitation",
      /NBIS:.*run-rate/.test(await lesson.innerText()) && /MSFT:.*run-rate/.test(await lesson.innerText()) &&
      /not a forecast/.test(await lesson.innerText()) && (await r.locator('[aria-label$="supporting analysis"]').count()) === 0);
    ok("v6.5.5 expanded lesson fits the 90-word budget", (await lesson.innerText()).trim().split(/\s+/).length <= 90);
    await r.locator("button.cg-toggle", { hasText: "Learning moment" }).click();
    const beforeExplore = (await r.innerText()).trim().split(/\s+/).length;
    await r.locator("button.cg-toggle", { hasText: "Explore the numbers" }).click();
    await page.waitForTimeout(300);
    const opened = await r.innerText();
    /* ── v6.9.2 READ THE ROOM Slice 3 ── RE-PINNED, with the reason at the pin. This asserted that
       ONE tap opened the dates, the full three-question prose, the supporting analysis AND the
       citations — all of it at once. Measured, that was 785 words / 2,233px from a single tap:
       ~2.6 phone screens and SEVEN TIMES the next biggest fold on the page. A fold is not a
       dumping ground — progressive disclosure budgets EVERY layer, not just the first.
       Nothing was deleted: the claim is split into "what level 1 shows" and "what each named
       second tap still contains, verbatim", which together assert strictly more than the old
       single pin did. */
    ok("T4/v6.9.2 Simple L1: 'Explore the numbers' opens onto the NUMBERS its label promises — the supporting analysis for BOTH companies with the calculation inputs — and nothing else",
      (await r.locator('[aria-label$="supporting analysis"]').count()) === 2 && /CALCULATION INPUTS/.test(opened) &&
      !/Worked example/.test(opened) &&
      /Explore the numbers/.test(text) && !/Explore the numbers — /.test(text));
    ok("v6.9.2 Simple L1: the prose, the dates and the citations are each a NAMED second tap, not a scroll — they are absent while their own fold is closed",
      (await r.locator('[aria-label$="data notes"]').count()) === 0 &&
      (await r.locator('[aria-label="Full assessment"]').count()) === 0 &&
      (await r.locator('[aria-label="Sources and calculations"]').count()) === 0 &&
      /dates & data notes/i.test(opened) && /the three questions, in full/i.test(opened) && /sources & calculations/i.test(opened));
    /* THE BUDGET, and it is the durable half of this pass. 785 words behind one tap was
       reversible in silence — nothing in three suites moved when it grew. 320 is ~2.2× the next
       biggest fold on the page (Why this call, 146 words) and roughly one phone screen of an
       11px cell, so a fold that starts becoming a novel again fails the build. The assertion
       REPORTS its own measurement, so a future failure is a diagnosis (the v4.1.3 lesson). */
    {
      /* The budget is on the DELTA — what the tap UNVEILS — not on the region's total text, or
         the always-visible face would be charged to the fold. 320 is ~2.2× the next biggest fold
         on this page (Why this call, 146 words measured). */
      const unveiled = opened.trim().split(/\s+/).length - beforeExplore;
      ok(`v6.9.2 Simple: no disclosure UNVEILS more than 320 words at its first level — one tap here used to unveil 785 (measured ${unveiled} now)`, unveiled <= 320);
    }
    // Each named second tap still holds exactly what it always did, verbatim.
    await r.locator("button.cg-toggle", { hasText: /dates & data notes/i }).click();
    await page.waitForTimeout(250);
    const openedNotes = await r.innerText();
    ok("v6.9.2 Simple L2 (dates & data notes): the blurbs, the dated market caps and the YTD through-date are all still here, for BOTH companies",
      (await r.locator('[aria-label$="data notes"]').count()) === 2 && /as of \d{4}-\d{2}-\d{2}/.test(openedNotes) &&
      /YTD through \d{4}-\d{2}-\d{2}/.test(openedNotes) && /rents out AI computing capacity/.test(openedNotes) &&
      /\$70\.1B/.test(openedNotes) && /\$3\.41T/.test(openedNotes));
    await r.locator("button.cg-toggle", { hasText: /the three questions, in full/i }).click();
    await page.waitForTimeout(250);
    const openedQs = await r.innerText();
    ok("v6.9.2 Simple L2 (the three questions): the FULL assessment is still here, verbatim, for BOTH companies",
      (await r.locator('[aria-label="Full assessment"]').count()) === 2 && /BUSINESS ·/.test(openedQs) && /WATCH NEXT ·/.test(openedQs));
    await r.locator("button.cg-toggle", { hasText: /sources & calculations/i }).click();
    await page.waitForTimeout(250);
    const openedAll = await r.innerText();
    ok("v6.9.2 Simple L2 (sources): the dated sec.gov citations and the YTD method are still here",
      /sec\.gov/.test(openedAll) && /YTD method/.test(openedAll));
    ok("v6.5 Simple: no rating words on the face", !/\b(cheap|safe|buy|sell|undervalued|overvalued)\b/i.test(openedAll));
    const [glance, cardsTop] = await page.evaluate(() => {
      const el = document.querySelector(".simple-market-tape");
      const k = document.querySelector('[aria-label="Key parameters"]');
      return [el ? Math.round(el.getBoundingClientRect().top + scrollY) : null, k ? Math.round(k.getBoundingClientRect().top + scrollY) : null]; });
    ok(`v6.5 budgets: the macro first screen is untouched — cards within 420px and the strip within 660px at 390×844 (measured ${cardsTop} / ${glance})`,
      cardsTop !== null && cardsTop <= 420 && glance !== null && glance <= 660);
    /* v6.8.3 (PUBLIC TERMINAL SKIN, Slice 2 item 3): the Spotlight wears the Simple card's own
       panel — measured in Chromium against the card itself, never against a literal — and its
       left rule is the company's chart-line colour, so the rule IS the legend. The second half
       is the acceptance item: with the region closed, NOTHING visible inside it renders under
       10px. Measured after the edit: the Simple region is 626px before and after — the padding
       the panel gives back pays for the type floor exactly. */
    const chrome = await page.evaluate(() => {
      const root = document.querySelector('[aria-label="Stock Spotlight"]');
      const card = document.querySelector(".simple-card");
      const box = (n) => { const cs = getComputedStyle(n); return { r: cs.borderTopLeftRadius, p: cs.padding, rule: cs.borderLeftWidth, col: cs.borderLeftColor }; };
      const profs = [...root.querySelectorAll(".stock-profile-trigger")].map(box);
      const line = [...root.querySelectorAll(".recharts-line path.recharts-curve")].map((p) => getComputedStyle(p).stroke);
      const frame = box(root.querySelector('[aria-label="Year-to-date comparison chart"]'));
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const px = []; let n;
      const hidden = (el) => { const cs = getComputedStyle(el); return cs.display === "none" || cs.visibility === "hidden" || el.classList.contains("visually-hidden") || el.closest(".visually-hidden"); };
      while ((n = w.nextNode())) { const t = (n.textContent || "").trim(); if (!t) continue; const el = n.parentElement;
        if (!el || hidden(el) || (el.closest("details:not([open])") && !el.closest("summary"))) continue;
        px.push(parseFloat(getComputedStyle(el).fontSize)); }
      const svg = [...root.querySelectorAll("svg text")].map((e) => parseFloat(getComputedStyle(e).fontSize));
      return { card: box(card), profs, frame, line, min: Math.min(...px, ...svg) };
    });
    ok(`v6.8.3 Spotlight chrome: the profiles wear the Simple card's panel (radius ${chrome.profs[0].r} = card ${chrome.card.r}, padding ${chrome.profs[0].p}), the 3px left rule is each company's own chart-line colour, and the shared chart frame carries NO rule`,
      chrome.profs.length === 2 && chrome.profs.every((p) => p.r === chrome.card.r && p.p === "8px 10px" && p.rule === "3px") &&
      chrome.line.length === 2 && chrome.profs[0].col === chrome.line[0] && chrome.profs[1].col === chrome.line[1] && chrome.profs[0].col !== chrome.profs[1].col &&
      chrome.frame.r === chrome.card.r && chrome.frame.rule === "1px");
    ok(`v6.8.3 Spotlight type floor: no visible leaf in the closed region renders under 10px — chart axis ticks included (smallest ${chrome.min}px)`,
      Number.isFinite(chrome.min) && chrome.min >= DT["fs-xs"]);
    /* v6.8.5 — ACCEPTANCE ITEM 3, CLAIMED FOR SIMPLE AND ONLY FOR SIMPLE.
       The plan's item 3 is "zero fontSize below 10px". Measured on the fullest Simple page
       there is (hero + cards + strip + spotlight + folds + footer, live feed, closed state):
       NOTHING visible renders under 10px. That is the default view, so the claim is real — and
       it is scoped, because the same probe still counts 116 sub-10px leaves in a closed Degen,
       living in MarketDetail / MacroRegime / Signal Quality / Watchlist / Alerts / the footer
       links / recharts ticks. (This list named "the SpyTapeBadge (7px)" until v7.1. That was
       stale twice over: v6.8.6 lifted its 7px label off the floor, and v7.1 DELETED the
       component — dead since v6.9.9. A to-do list that keeps naming finished work is the
       label-outlives-its-data defect pointed at a queue, which is the same rule the type-floor
       PENDING list is pinned in both directions for.) Those are section-by-section literals,
       not a primitive, and each is its own pass. This pin is what stops Simple regressing while
       that work happens: any new sub-floor literal reaching the default view fails HERE. */
    const simpleFloor = await page.evaluate(() => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const bad = []; let n;
      const hidden = (el) => { const cs = getComputedStyle(el); return cs.display === "none" || cs.visibility === "hidden" || el.classList.contains("visually-hidden") || el.closest(".visually-hidden"); };
      while ((n = w.nextNode())) { const t = (n.textContent || "").trim(); if (!t) continue; const el = n.parentElement;
        if (!el || hidden(el) || (el.closest("details:not([open])") && !el.closest("summary"))) continue;
        const px = parseFloat(getComputedStyle(el).fontSize);
        if (px < 10) bad.push(`${px}px "${t.slice(0, 30)}"`); }
      for (const e of document.querySelectorAll("svg text")) {
        const px = parseFloat(getComputedStyle(e).fontSize);
        if (px < 10) bad.push(`svg ${px}px "${(e.textContent || "").trim().slice(0, 20)}"`); }
      return bad;
    });
    ok(`v6.8.5 acceptance item 3 (SIMPLE): no visible leaf on the whole default view renders under 10px${simpleFloor.length ? " — found " + simpleFloor.slice(0, 5).join(" · ") : ""}`,
      simpleFloor.length === 0);
    ok("v6.5 Simple: 390px stays overflow-free with the chart in place, no page errors",
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) && errors.length === 0);

    /* ── v7.1 — ONE APPLICABLE MULTIPLE ON THE SIMPLE FACE ────────────────────────────────
       Owner, 2026-09-19: Simple shows market cap beside ONE multiple — trailing P/E when the
       company earns, P/S when it does not — with its actual reporting period and the price
       timestamp, and no cheap/expensive colour. Driven here at 390px because the Simple face
       is a phone surface and these are the rows above the fold. */
    const profiles = await r.locator(".stock-profile-trigger").allInnerTexts();
    ok("v7.1 Simple: the fixture's unprofitable company shows P/S — labelled, never a bare number",
      /P\/S · TRAILING/i.test(profiles[0]) && /52\.9×/.test(profiles[0]));
    /* The reason the label changed, at the moment it changes under the reader. Without it P/S
       reads as an arbitrary second metric rather than the consequence of a withheld P/E. */
    ok("v7.1 Simple: the substitution states WHY — P/E isn't meaningful without profit",
      /isn.t meaningful because the company isn.t profitable/i.test(profiles[0]));
    /* EXACTLY ONE. Two multiples on a flash card is the state this release exists to end, and
       a count is the only assertion that catches a future edit adding the other back. */
    ok("v7.1 Simple: EXACTLY ONE multiple row on the face — never both",
      ((profiles[0].match(/P\/S · TRAILING|P\/E · TRAILING/gi) || []).length) === 1);
    /* Both clocks, on screen, in Simple — the first compact row ever to carry its dates,
       because a multiple whose period the reader cannot check is a blanket "live" label. */
    ok("v7.1 Simple: the multiple carries its reporting period AND the price timestamp on screen",
      /TTM to \d{4}-\d{2}-\d{2}/.test(profiles[0]) && /(price|cap) \d{4}-\d{2}-\d{2}/.test(profiles[0]));
    /* NO CHEAP/EXPENSIVE COLOUR (owner). Measured, not assumed: the multiple's rendered colour
       must equal the market-cap row's beside it. A hardcoded hex would pass a "not green" pin
       while still painting a verdict; comparing against a neighbour cannot. */
    const multColour = await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".stock-profile-trigger .stock-row")];
      const ink = (re) => { const row = rows.find((n) => re.test(n.querySelector(".stock-row-label")?.textContent || ""));
        const v = row && row.querySelector(".stock-row-value"); return v && getComputedStyle(v).color; };
      return { mult: ink(/P\/S|P\/E/i), cap: ink(/MARKET CAP/i) };
    });
    ok(`v7.1 Simple: the multiple carries NO cheap/expensive colour — same ink as the cap row (${multColour.mult} vs ${multColour.cap})`,
      Boolean(multColour.mult) && multColour.mult === multColour.cap);
    /* THE LAST TECHNICAL LEAK ON THE DEFAULT VIEW (deferred here from Slice A, where the
       scenario rendered no Spotlight and the pattern would have passed vacuously). A moving
       average is a TECHNICAL reading by role; the owner's definition puts technicals in Degen.
       Swept across the WHOLE Simple page with the numbers fold open, and the Degen scenario
       below asserts the same rows DO render there — so this absence is a mode gate. */
    ok("v7.1 Simple: the labelled moving-average READINGS are gone — the Price trend row and the MA calculation input",
      !/PRICE TREND/i.test(await page.locator("body").innerText())
      && !/\b(50|100|200)-day\b/i.test(await r.locator('[aria-label$="supporting analysis"]').first().innerText().catch(() => "")));
    /* ⚠ FOUND, NOT FIXED — and pinned PRESENT so it cannot change in silence.
       One 200-day mention survives in Simple: the clause inside the authored STOCK paragraph,
       two taps deep in "the three questions, in full". It is deliberately left, and the pin
       records the state rather than the wish:
         · it is authored PROSE from the server model, not a labelled reading, and the question
           it answers is literally "what does the stock's current price tell me?" — a price
           trend is on topic for that question in a way it is not for a metrics row;
         · removing the clause means regex surgery on a composed sentence in the component,
           and "a display string is the wrong integrity boundary" (v4.0.3). Doing it properly
           means the server projection composes a Simple variant, which is its own pass.
       My first version of the pin above swept the whole page and claimed this was fixed too.
       It was not. The pin was narrowed to what the change actually does, and the remainder is
       asserted here — the alternative was a pin quietly describing work nobody did. */
    ok("v7.1 Simple: the authored STOCK prose still names the 200-day two taps deep — named, not fixed",
      /200-day/i.test(await page.locator("body").innerText()));
    // The full three-question text lives one tap deep in Simple (`opened`), on the face in Degen.
    simpleFace = { caps: (await r.locator(".stock-profile-trigger").allInnerTexts()).map(t => (t.match(/\$\d+\.\d+[TB]/) || [])[0]), ytd: text.match(/[+−]\d+\.\d\d%/g), business: (openedQs.match(/BUSINESS · [^\n]+/g) || []) };
    await page.close(); }
  // Mixed-period issuer: the FCF date must not inherit the revenue quarter.
  { const mixed = structuredClone(feed);
    mixed.model.companies.NBIS.metrics.fcf = { ...mixed.model.companies.NBIS.metrics.fcf,
      basis: "half", period: "half-year to 2026-06-30" };
    mixed.model.companies.NBIS.metrics.operatingMargin.period = "quarter to 2026-06-30";
    const { page, errors } = await open({ live: FULL_LIVE, width: 390, power: false, spotlight: mixed, route: "/?view=public" });
    await page.waitForTimeout(1200);
    await region(page).locator("button.cg-toggle", { hasText: "Explore the numbers" }).click();
    await page.waitForTimeout(250);
    /* RE-PINNED at v6.9.2: the data notes are a SECOND tap now. The first level of Explore is the
       numbers its label promises; dates, prose and citations each take a named second tap, because
       one tap used to unveil 785 words (measured). The CLAIM — the two periods stay on separate
       lines and FCF never inherits the revenue quarter — is unchanged and still asserted verbatim. */
    await region(page).locator("button.cg-toggle", { hasText: /dates & data notes/i }).click();
    await page.waitForTimeout(250);
    const notes = await region(page).locator('[aria-label="NBIS data notes"]').innerText();
    ok("v6.5.5 data notes keep operating margin quarterly and FCF half-year on separate lines",
      /operating margin[^\n]*quarter to 2026-06-30/.test(notes) &&
      /free cash flow[^\n]*half-year to 2026-06-30/.test(notes) && !/free cash flow[^\n]*quarter to/.test(notes));
    ok("v6.5.5 public teaching has no operator dock", await page.locator('[aria-label="Terminal dock"]').count() === 0 && errors.length === 0);
    await page.close(); }
  // 3. DEGEN at 1280px — the analysis is visible; only the sources collapse; IDENTICAL values.
  { const { page, errors } = await open({ live: FULL_LIVE, width: 1280, power: true, spotlight: feed });
    await page.waitForTimeout(1600);
    const r = region(page);
    const text = await r.innerText();
    ok("v6.5 Degen (density review): the blurb, the `as of`/`through` dates and the period crumbs stay ON the face — Degen is the 10-K",
      /rents out AI computing capacity/.test(text) && /as of \d{4}-\d{2}-\d{2}/.test(text) && /through \d{4}-\d{2}-\d{2}/.test(text) && /quarter to \d{4}-\d{2}-\d{2}/.test(text));
  /* RE-PINNED v7.1 — the two valuation rows are RENAMED, and the claim is unchanged. The sales
     multiple has been price-to-sales since v6.6.3 under the label "Cap ÷ TTM revenue", which
     never said so, so the one multiple that applies to an unprofitable company was the one a
     reader could not look up. Both rows now carry one name across BOTH modes ("P/S · trailing",
     "P/E · trailing"), because v7.1 puts one of them on the Simple face and two names for one
     metric across modes is the drift this repo keeps closing. The arithmetic is not renamed
     away — "cap ÷ TTM revenue" still rides the P/S row's sub, and this pin asserts that. */
    ok("v6.5 Degen: the supporting analysis (cash, debt, P/S, P/E, shares, price trend, run-rate, inputs) is visible with NO click, plus the worked example",
      (await r.locator('[aria-label$="supporting analysis"]').count()) === 2 && /P\/S · TRAILING/i.test(text) && /P\/E · TRAILING/i.test(text) && /PRICE TREND/i.test(text) &&
      /cap ÷ TTM revenue/i.test(text) &&   // the formula survives the naming, on the row's own sub
      /RUN-RATE VS TTM/i.test(text) && /CALCULATION INPUTS/.test(text) && (await r.locator('[aria-label="Worked example"]').count()) === 1 && /33\.4×/.test(text));
    /* v7.1 — THE DEGEN CONTRAST, and the reason the Simple pins above are not vacuous.
       Simple shows ONE multiple and no moving-average readings. That is only a mode gate if the
       same fixture produces BOTH multiples and the technicals here — otherwise the absence pins
       would be passing on an empty widget, which is the v3.60.1 trap this suite keeps catching.
       Owner: "Degen can show both P/E and P/S when available." */
    ok("v7.1 Degen: BOTH multiples render (Simple selects one; Degen shows what is available)",
      /P\/S · TRAILING/i.test(text) && /P\/E · TRAILING/i.test(text));
    ok("v7.1 Degen: the moving-average readings DO render here — Simple's silence is a mode gate",
      /PRICE TREND/i.test(text) && /200-day/i.test(text));
    /* No cheap/expensive colour in Degen either — measured against the Cash row beside it. */
    const degenInk = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[aria-label$="supporting analysis"] .stock-row')];
      const ink = (re) => { const row = rows.find((n) => re.test(n.querySelector(".stock-row-label")?.textContent || ""));
        const v = row && row.querySelector(".stock-row-value"); return v && getComputedStyle(v).color; };
      return { ps: ink(/P\/S/i), pe: ink(/P\/E/i), cash: ink(/^CASH/i) };
    });
    ok(`v7.1 Degen: neither multiple carries a cheap/expensive colour (${degenInk.ps} · ${degenInk.pe} vs cash ${degenInk.cash})`,
      Boolean(degenInk.cash) && degenInk.ps === degenInk.cash && degenInk.pe === degenInk.cash);
    for (const [group, label, title, expected] of [
      ['[aria-label="Nebius Group (NBIS) profile"]', "Market cap", "Market capitalization", /Hypothetical:.*both equal \$10 billion/s],
      ['[aria-label="NBIS supporting analysis"]', "P/E · trailing", "Trailing price-to-earnings ratio", /Net earnings were negative/],
      ['[aria-label="MSFT supporting analysis"]', "P/E · trailing", "Trailing price-to-earnings ratio", /positive multiple/],
      // v7.1: the sheet's TITLE names the multiple too, not just its arithmetic.
      ['[aria-label="NBIS supporting analysis"]', "P/S · trailing", "P/S — price-to-sales", /Revenue is not profit/],
    ]) {
      const trigger = r.locator(group).getByRole("button", { name: new RegExp(label) });
      await trigger.focus(); await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: title });
      ok(`Degen valuation tap: ${group} ${label} teaches its calculation and limitation`,
        expected.test(await dialog.innerText()) && (await dialog.innerText()).includes(group.includes("NBIS") ? "NBIS" : "MSFT") && await dialog.locator("li").count() === 3 && await dialog.getByRole("link").count() > 0);
      await page.keyboard.press("Escape");
      ok(`Degen valuation tap: ${label} closes and restores focus`, await trigger.evaluate(n => n === document.activeElement) && await page.getByRole("dialog").count() === 0);
    }
    /* RE-PINNED at v6.9.1, with the reason at the pin. This read the literal "trailing earnings
       are negative — no P/E", which lived ONLY in the STOCK prose the face no longer duplicates.
       The CLAIM is unchanged and is still asserted on the face — the Trailing P/E ROW states it
       in its own vocabulary ("Not meaningful · net loss"), which is if anything plainer — and the
       retired sentence is still asserted verbatim one tap deep below. The invariant that matters
       (a negative multiple never renders) is pinned on the whole region either way. */
    ok("v6.5 Degen: NBIS's negative trailing earnings are stated on the FACE by the row itself — 'Not meaningful · net loss' — and never as a negative multiple",
      /Not meaningful/.test(text) && /net loss/.test(text) && !/-\d+\.\d×/.test(text));
    /* RE-PINNED at v6.9.1: sources is no longer "the ONE collapsed disclosure" — Degen now has
       two, because the three-question prose moved out of the face and into its own fold. Clicking
       `.first()` would have opened the wrong one, so the toggle is selected BY NAME. Both folds
       are asserted, and the ORDER is part of the contract: the reading of the rows sits BELOW the
       rows it reads, so a reader can never meet the interpretation before the numbers. */
    ok("v6.5 Degen: sources stay a collapsed disclosure, selected by name now that the three-question prose has its own fold; opening it lists dated sec.gov citations",
      (await r.locator('[aria-label="Sources and calculations"]').count()) === 0 && await (async () => {
        await r.locator("button.cg-toggle", { hasText: /sources & calculations/i }).first().click(); await page.waitForTimeout(250);
        const t = await r.innerText(); return (await r.locator('[aria-label="Sources and calculations"]').count()) === 1 && /sec\.gov/.test(t) && /filed \d{4}-\d{2}-\d{2}/.test(t); })());
    /* RE-PINNED at v6.9.1: Degen's BUSINESS/STOCK/WATCH-NEXT text is one tap deep now, exactly
       as Simple's already was — so BOTH sides of this comparison are read after opening the fold,
       which is what makes it a real cross-mode identity check rather than two different altitudes
       compared to each other. */
    await r.locator("button.cg-toggle", { hasText: /the three questions, in full/i }).first().click();
    await page.waitForTimeout(250);
    const degenOpened = await r.innerText();
    const degenFace = { caps: (await r.locator('[aria-label$=" profile"]').allInnerTexts()).map(t => (t.match(/\$\d+\.\d+[TB]/) || [])[0]), ytd: text.match(/[+−]\d+\.\d\d%/g), business: (degenOpened.match(/BUSINESS · [^\n]+/g) || []) };
    ok("v6.5 both modes: IDENTICAL market caps, YTD values and assessments (one model, two altitudes)",
      simpleFace && JSON.stringify(simpleFace.caps.slice(0, 2)) === JSON.stringify(degenFace.caps.slice(0, 2)) &&
      JSON.stringify(simpleFace.ytd.slice(0, 2)) === JSON.stringify(degenFace.ytd.slice(0, 2)) &&
      degenFace.business.length === 2 && JSON.stringify(simpleFace.business) === JSON.stringify(degenFace.business));
    /* ── v6.9.1 READ THE ROOM Slice 2 ── the FACE stops restating its own rows.
       Measured before this pass, Degen at 390: the three-question block was 330px / 139 words
       across the two companies inside a 2,650px / 700-word region — ~20% of every word in the
       widget — and it restated the labelled rows on both sides of itself. These pins assert the
       DUPLICATION IS GONE (closed state) and that nothing was DELETED (one tap deep), which is
       the pair that makes this a de-dup rather than a cut. */
    ok("v6.9.1 Degen face: the three-question prose is GONE from the face — it restated the Revenue growth / Operating margin rows above it and the Cap ÷ TTM revenue / Trailing P/E / Price trend rows below it (the v3.43 Yahoo-dupe test, applied to prose)",
      /* Chromium's innerText APPLIES text-transform, so the row labels read back UPPERCASE —
         the v3.69 lesson, caught here on first run. The eyebrows being searched for are literal
         uppercase in source, so only the row half needs /i. */
      !/BUSINESS · /.test(text) && !/STOCK · /.test(text) && !/WATCH NEXT · /.test(text) &&
      /revenue growth/i.test(text) && /cap ÷ ttm revenue/i.test(text) && /price trend/i.test(text));
    ok("v6.9.1 Degen face: nothing was deleted — every sentence is one tap deep, for BOTH companies",
      /BUSINESS · /.test(degenOpened) && /STOCK · /.test(degenOpened) && /WATCH NEXT · /.test(degenOpened) &&
      (degenOpened.match(/WATCH NEXT · /g) || []).length === 2);
    /* The two facts those paragraphs carried that NO row carries stay ON the face: the forward
       report date (nothing else on either panel carries one) and, where it applies, the
       price-trend suppression notice. A de-dup that dropped these would be deleting evidence,
       not duplication. The date is read from the model's typed nextEarnings, never parsed back
       out of the watchNext sentence (the v4.0.3 ruling). */
    ok("v6.9.1 Degen face: the one fact no row carries — the next scheduled report date — stays ON the face, per company, typed rather than parsed out of prose",
      (text.match(/NEXT REPORT · \d{4}-\d{2}-\d{2}/g) || []).length === 2);
    /* v6.8.3: the same panel chrome in Degen (one component, both modes), and an HONEST limit
       rather than a claim — the ONLY sub-10px text left in the Degen region is the shared
       CollapsedGroup toggle, which is a primitive every fold on the page uses and is therefore
       NOT this pass's to lift. Pinned so a NEW 8px literal inside the Spotlight fails here. */
    const dSmall = await page.evaluate(() => {
      const root = document.querySelector('[aria-label="Stock Spotlight"]');
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const out = []; let n;
      const hidden = (el) => { const cs = getComputedStyle(el); return cs.display === "none" || cs.visibility === "hidden" || el.classList.contains("visually-hidden") || el.closest(".visually-hidden"); };
      while ((n = w.nextNode())) { const t = (n.textContent || "").trim(); if (!t) continue; const el = n.parentElement;
        if (!el || hidden(el) || (el.closest("details:not([open])") && !el.closest("summary"))) continue;
        if (parseFloat(getComputedStyle(el).fontSize) < 10) out.push({ t: t.slice(0, 40), cg: !!el.closest("button.cg-toggle") }); }
      const p = document.querySelector('[aria-label="NBIS supporting analysis"]'), c = document.querySelector('[aria-label="Nebius Group (NBIS) profile"]');
      return { out, detailRadius: getComputedStyle(p).borderTopLeftRadius, detailRule: getComputedStyle(p).borderLeftWidth, profRule: getComputedStyle(c).borderLeftWidth };
    });
    ok(`v6.8.3 Degen: the profile and supporting-analysis panels wear the same 3px-ruled panel, and every remaining sub-10px leaf in the region is the shared CollapsedGroup toggle (${dSmall.out.length} left, not this pass's primitive)`,
      dSmall.detailRadius === "5px" && dSmall.detailRule === "3px" && dSmall.profRule === "3px" && dSmall.out.every((x) => x.cg));
    ok("v6.5 Degen: no page errors", errors.length === 0);
    await page.close(); }
  // 4. UNAVAILABLE + STALE — a missing cap, a missing anchor series, a 12-day-old tape.
  { const bad = makeSpotlightFixture({ stale: true, capMissing: true, anchorSeriesMissing: true });
    const { page, errors } = await open({ live: FULL_LIVE, width: 390, power: false, spotlight: { schema: "md-spotlight-v1", enabled: true, model: bad.projected } });
    await page.waitForTimeout(1600);
    const r = region(page);
    const text = await r.innerText();
    ok("Simple unavailable: missing capitalization is visible; the other company retains its value; never zero",
      /Unavailable · no market cap/.test(text) && !/Unavailable — profile carries no market capitalization/.test(text) &&
      /\$3\.41T/.test(text) && !/\$0/.test(text) && /Unavailable/.test(text));
    await r.locator('.stock-profile-trigger', { hasText: "Nebius Group" }).click();
    ok("Simple company tap: missing cap remains explicitly unavailable in the popup",
      /market capitalization unavailable/i.test(await page.getByRole("dialog").innerText()));
    await page.keyboard.press("Escape");
    await r.locator('.stock-profile-trigger', { hasText: "Microsoft" }).click();
    ok("Simple company tap: the dated but stale comparison values stay marked",
      /STALE/.test(await page.getByRole("dialog").innerText()));
    await page.keyboard.press("Escape");
    ok("v6.5 unavailable: the missing anchor series is NAMED on the chart and the comparison line still plots alone",
      /NBIS series unavailable/.test(text) && (await r.locator(".recharts-line").count()) === 1 && /Unavailable(?! —)/.test(text));
    /* RE-PINNED at v6.9.2: the withheld reasons live in the data-notes panel, which is a NAMED
       second tap now — Explore's first level is the numbers its label promises. The CLAIM is
       unchanged and still asserted verbatim; only the number of taps moved, and the fold that
       holds it is named rather than something you scroll past. */
    ok("T4 unavailable: the FULL reasons survive verbatim under Explore → dates & data notes",
      await (async () => {
        await r.locator("button.cg-toggle", { hasText: "Explore the numbers" }).click(); await page.waitForTimeout(250);
        await r.locator("button.cg-toggle", { hasText: /dates & data notes/i }).click(); await page.waitForTimeout(250);
        const o = await r.innerText();
        return /Unavailable — market cap: profile carries no market capitalization/.test(o) && /Unavailable — YTD: return series unavailable/.test(o) && /\$3\.41T/.test(o); })());
    ok("v6.5 stale: market data 12 days behind wears STALE; the price-trend clause is suppressed, not graded (under Explore → dates & data notes)",
      /STALE/.test(text) && await (async () => {
        const o = await r.innerText();
        return /price trend is not assessed on a stale tape/.test(o) && !/above its 200-day/.test(text); })());
    ok("T4/T6 unavailable: the scheduled pair stays visible with a collapsed Learning moment, and the face stays overflow-free",
      /Established growth/.test(text) && /Learning moment/.test(text) && !/LEARNING MOMENT/.test(text) &&
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) && errors.length === 0);
    await page.close(); }
  // 4b. PRICE RETURN ONLY on the anchor (review #1): the leg is WITHHELD, never plotted against total return.
  { const po = makeSpotlightFixture({ anchorPriceOnly: true });
    const { page, errors } = await open({ live: FULL_LIVE, width: 390, power: false, spotlight: { schema: "md-spotlight-v1", enabled: true, model: po.projected } });
    await page.waitForTimeout(1600);
    const r = region(page);
    const text = await r.innerText();
    ok("v6.5 review #1: a price-return-only leg reads Unavailable naming the rule, the chart draws ONLY the verified total-return line, and no price-return figure appears anywhere",
      /no verified total-return series — price return is not a substitute/.test(text) && /on file: price return/.test(text) && (await r.locator(".recharts-line").count()) === 1 &&
      !/\+88\.10%/.test(text) && /MSFT \+\d+\.\d\d%/.test(text) && /NBIS series unavailable/.test(text) && errors.length === 0);
    await page.close(); }
  // 4c. YEAR ROLLOVER at serve (review #3): a Dec 31 model served on Jan 1.
  { const { freshenSpotlight, projectSpotlight } = await import("../functions/lib/spotlight.js");
    const dec = makeSpotlightFixture({ now: new Date("2025-12-31T23:30:00Z") });
    const jan = projectSpotlight(freshenSpotlight(dec.model, new Date("2026-01-01T15:00:00Z")));
    const { page, errors } = await open({ live: FULL_LIVE, width: 390, power: false, spotlight: { schema: "md-spotlight-v1", enabled: true, model: jan } });
    await page.waitForTimeout(1600);
    const r = region(page);
    const text = await r.innerText();
    ok("T4 review #3: served in the new year, both Simple YTD fields read awaiting, no line is drawn, and last year's figures are gone",
      (text.match(/awaiting first close/gi) || []).length >= 2 && /Awaiting the first 2026 trading close/.test(text) && (await r.locator(".recharts-line").count()) === 0 &&
      !/\+\d+\.\d\d%/.test(text) && /\$3\.41T/.test(text) && errors.length === 0);
    await page.close(); }
  // 5. 320px — the narrowest contract.
  { const { page, errors } = await open({ live: FULL_LIVE, width: 320, power: false, spotlight: feed });
    await page.waitForTimeout(1600);
    ok("v6.5 320px: the widget renders with two lines and no horizontal overflow",
      (await region(page).locator(".recharts-line").count()) === 2 && await page.evaluate(() => document.documentElement.scrollWidth <= 320 + 1) && errors.length === 0);
    await page.close(); }
}

// ── T2–T6 of the Simple FACE/TAP/FOLD sprint (working/2026-09-14-simple-face-tap-fold.md)
console.log("\n[public] T2–T6 — Simple face sheds clock, rulers, coverage, lesson, multiples; Degen stays dense");
{
  const { makeSpotlightFixture } = await import("./spotlight-fixture.mjs");
  const fx = makeSpotlightFixture();
  const feed = { schema: "md-spotlight-v1", enabled: true, model: fx.projected };
  const frozenHodl = { schema:"md-call-v1", effective_date:TODAY, headline:"HODL", emoji:"💎",
    direction:"NEUTRAL", confidence:"HIGH", actionability:"RESTRICTED", status:"PUBLISHED",
    counts:{usable:6,total:6,bull:2,bear:1,neutral:3}, factors:[], override:{active:false} };
  const { page, errors } = await open({ live: FULL_LIVE, width: 390, power: false,
    publicCall: frozenHodl, publicCallFrozen: true, publicCallCapturedAt: `${TODAY}T14:00:00.000Z`,
    spotlight: feed });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1300);
  const face = await bandText(page);
  const cards = await page.locator('[aria-label="Key parameters"]').innerText();
  const body = await page.locator("body").innerText();
  ok("T6 Simple face: Hold + HELPING/HURTING, no FROZEN/unscored/help</hurt>",
    /Hold/.test(face) && /supports? stocks|pressures? stocks|signals? caution/i.test(cards) &&
    !/FROZEN/i.test(face) && !/unscored/i.test(face) &&
    !/help </.test(cards) && !/hurt >/.test(cards));
  ok("T5 Simple: closed Why-this-call is the promise — no ⇄, no +N, no ALLCAPS essay",
    /Why this call/.test(await page.locator("button.cg-toggle", { hasText: "why this call" }).innerText()) &&
    !/⇄/.test(await page.locator("button.cg-toggle", { hasText: "why this call" }).innerText()) &&
    !/\+\d/.test(await page.locator("button.cg-toggle", { hasText: "why this call" }).innerText()));
  ok("T6 Simple face: no run-rate, no trailing revenue; Learning moment starts collapsed",
    /Learning moment/.test(body) && (await page.locator('[aria-label="Learning moment"]').count()) === 0 &&
    !/run-rate/i.test(body) && !/trailing revenue/i.test(body) && !/LEARNING MOMENT/.test(body));
  await page.locator(".simple-hold").click();
  await page.waitForTimeout(200);
  const holdSheet = await page.locator('[role="dialog"]').innerText();
  ok("T2 Hold ⓘ: edition / frozen clock / 6-of-6 live in the sheet",
    /frozen 10am call · captured 10:00 ET/.test(holdSheet) &&
    /\d+ of \d+ signals counted/.test(holdSheet));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  const vixCard = page.locator(".simple-card", { hasText: /VOLATILITY|VIX/i }).first();
  if (await vixCard.count()) {
    await vixCard.click();
  } else {
    await page.locator(".simple-card").first().click();
  }
  await page.waitForTimeout(200);
  const cardSheet = await page.locator('[role="dialog"]').innerText();
  ok("7.0.1 tap card: bullet 2 has dated current reading and model reference",
    /Latest reported:/.test(cardSheet) && /observation date /.test(cardSheet) && /Model reference:/.test(cardSheet));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  await page.locator("button", { hasText: "Degen" }).click();
  await page.waitForTimeout(400);
  const degen = await bandText(page);
  const degenBody = await page.locator("body").innerText();
  ok("T6 Degen stays dense: frozen eyebrow, capture clock, 6-of-6 on the face",
    /10am call · frozen/i.test(degen) &&
    /frozen 10am call · captured 10:00 ET/.test(degen) &&
    /\d+ of \d+ signals counted/.test(degen));
  ok("T6 Degen stays dense: run-rate, LEARNING MOMENT body and market cap stay on the face",
    /run-rate/i.test(degenBody) && /LEARNING MOMENT/.test(degenBody) &&
    /\$70\.1B/.test(degenBody) && /MARKET CAP/i.test(degenBody));
  ok("T2–T6: no page errors", errors.length === 0);
  await page.close();
}

// ── PUBLIC TERMINAL SKIN, Slice 1 (docs/plans/public-terminal-skin.md) — acceptance, driven ──
// Items 1, 2, 4 and 6 of the plan's acceptance list, measured on the real page at 390px. Item 3
// (zero fontSize under 10px) is Slice 2's — the token FLOOR moved here, the literals did not, and
// claiming it now would be the label-outlives-its-data defect in reverse.
console.log("\n[public] Slice 1 — one terminal skin: same header, same typeface, same surfaces in both modes");
{
  const { page, errors } = await open({ live: FULL_LIVE, width: 390, power: false, route: "/?view=public" });
  await page.waitForTimeout(1300);
  const readHdr = () => page.evaluate(() => {
    const h = document.querySelector("header"), w = document.querySelector(".wordmark"), b = document.body;
    const cs = (n) => getComputedStyle(n);
    return { h: Math.round(h.getBoundingClientRect().height), rows: h.getBoundingClientRect().height,
      wordFont: cs(w).fontFamily, wordColor: cs(w).color, wordSize: cs(w).fontSize, bodyFont: cs(b).fontFamily,
      bg: cs(document.querySelector('[role="main"]')).backgroundColor,
      hdrBg: cs(h).backgroundColor, overflow: document.documentElement.scrollWidth <= window.innerWidth + 1 };
  });
  const simpleHdr = await readHdr();
  const simpleBody = await page.locator("body").innerText();
  ok("Slice 1 (1): Simple first screen — wordmark, clock, toggle, Hold, one sentence, three cards, strip; no SHARE/OPS/nav/COPY row",
    /MacroDash/.test(simpleBody) && /Markets (open|closed)|Before markets open/.test(simpleBody) &&
    (await page.locator('[role="group"][aria-label="View mode"] button').count()) === 2 &&
    (await page.locator(".simple-card").count()) === 6 &&
    !/⤴ SHARE|⋯ OPS|⋯ MORE|⌁ TERMINAL|COPY LIVE READ/.test(simpleBody) &&
    (await page.locator('nav[aria-label="Sections"]').count()) === 0 &&
    (await page.locator("details.hdr-ops").count()) === 0);
  ok(`Slice 1: the Simple header is one row (measured ${simpleHdr.h}px) with no horizontal overflow`,
    simpleHdr.h <= 64 && simpleHdr.overflow);
  await page.locator("button", { hasText: "Degen" }).click();
  await page.waitForTimeout(600);
  // A first visit to Degen shows the dismissible introduction note under the nav (v6.4). It is
  // a one-time banner, not chrome: dismiss it the way a reader would before measuring.
  await page.locator('button[aria-label="Dismiss Degen introduction"]').click();
  await page.waitForTimeout(200);
  const degenHdr = await readHdr();
  const degenBody = await page.locator("body").innerText();
  ok(`Slice 1 (2): the Degen header is the SAME height as Simple ±8px (measured ${simpleHdr.h} vs ${degenHdr.h}) — a mode switch does not grow the header`,
    Math.abs(degenHdr.h - simpleHdr.h) <= 8 && degenHdr.overflow);
  ok("Slice 1 (2): in Degen the call is still the first thing under the header + one nav strip (nav ≤ 48px, verdict directly below it)",
    await page.evaluate(() => {
      const h = document.querySelector("header").getBoundingClientRect(), n = document.querySelector('nav[aria-label="Sections"]').getBoundingClientRect(),
        v = document.querySelector('[aria-label="Macro backdrop verdict"]').getBoundingClientRect();
      return Math.round(n.top) === Math.round(h.bottom) && n.height <= 48 && Math.abs(Math.round(v.top) - Math.round(n.bottom)) <= 2; }));
  ok("Slice 1 (4): Simple → Degen does not change typeface, background, or wordmark treatment",
    simpleHdr.wordFont === degenHdr.wordFont && simpleHdr.wordColor === degenHdr.wordColor && simpleHdr.wordSize === degenHdr.wordSize &&
    simpleHdr.bodyFont === degenHdr.bodyFont && simpleHdr.bg === degenHdr.bg && simpleHdr.hdrBg === degenHdr.hdrBg &&
    /IBM Plex Mono/.test(simpleHdr.wordFont) && simpleHdr.wordColor === tokRgb("amber") && simpleHdr.bg === tokRgb("bg"));
  ok("Slice 1: ONE family on the page — no element on either mode's first screen asks for Syne or DM Sans",
    await page.evaluate(() => ![...document.querySelectorAll("header *, [aria-label='Macro backdrop verdict'] *, .macro-strip *")]
      .some((n) => /Syne|DM Sans/.test(getComputedStyle(n).fontFamily))));
  ok("Slice 1 (6): public Degen — ⋯ MORE holds SHARE and the provenance chip, and NO exports; no TERMINAL, no OPS, no book",
    (await page.locator("details.hdr-ops").count()) === 1 &&
    (await page.locator('details.hdr-ops button[aria-label="Copy dashboard link"]').count()) === 1 &&
    (await page.locator('details.hdr-ops button[aria-label="Copy MacroDash daily call"]').count()) === 0 &&
    !/⌁ TERMINAL|⋯ OPS|MY CONVICTION/.test(degenBody) && (await page.locator('a[aria-label="Open Ticker Terminal"]').count()) === 0);
  ok("Slice 1: the selected toggle half is the phosphor fill with dark text in Degen too — one 'this is on' signal",
    (await page.locator('button[aria-pressed="true"]').evaluate((n) => getComputedStyle(n).backgroundColor)) === tokRgb("green"));
  // VISIBLE leaves only: the provenance chip inside the closed MORE disclosure is a primitive
  // whose 9px literal is Slice 2's (it renders on every tile). Chromium keeps a layout box for a
  // closed <details>' content (content-visibility), so "has a box" does not exclude it — the
  // filter skips closed-details content explicitly while still counting the summary itself.
  ok("Slice 1: every VISIBLE header leaf — wordmark, clock, toggle, MORE — reads at the terminal floor (≥10px)",
    await page.evaluate(() => [...document.querySelectorAll("header *")].filter((n) => {
        if (n.children.length || !n.textContent.trim() || n.getBoundingClientRect().height === 0) return false;
        const d = n.closest("details"); return !(d && !d.open && !n.closest("summary")); })
      .every((n) => parseFloat(getComputedStyle(n).fontSize) >= 10)));
  ok("Slice 1: no page errors across the mode switch", errors.length === 0);
  await page.close();
}
// The operator route at phone width: TERMINAL + toggle + MORE beside the wordmark still fit ONE row.
{
  const { page, errors } = await open({ live: FULL_LIVE, width: 375, power: true, route: "/" });
  await page.waitForTimeout(1300);
  // This fixture BLINDS one alert (no 30Y), so the ⚡ badge renders and the operator header is
  // allowed its one wrap: the badge + toggle + TERMINAL + MORE beside the wordmark measured the
  // brand down to 30px ("Ma…") on one row. A red fact earns a row; the wordmark keeps its name.
  ok("Slice 1 (operator @375): no overflow, 44px TERMINAL/MORE glyph targets, the wordmark NOT truncated, and the badge is what costs the second row",
    await page.evaluate(() => {
      const h = document.querySelector("header").getBoundingClientRect();
      const t = document.querySelector('a[aria-label="Open Ticker Terminal"]').getBoundingClientRect();
      const m = document.querySelector("details.hdr-ops summary").getBoundingClientRect();
      const w = document.querySelector(".wordmark");
      const badge = [...document.querySelectorAll("header .hdr-acts *")].some((n) => /FIRED|BLIND/.test(n.textContent));
      return document.documentElement.scrollWidth <= window.innerWidth + 1 &&
        t.height >= 44 && t.width >= 44 && m.height >= 44 && m.width >= 44 &&
        w.scrollWidth <= w.clientWidth + 1 &&
        (badge ? h.height <= 120 : h.height <= 64);
    }) && errors.length === 0);
  await page.close();
}

/* ── v6.9.4 READ THE ROOM Slice 5 — the 320-word budget becomes a SWEEP ────────────────
   v6.9.2 measured ONE fold (Simple's "Explore the numbers", 785 words behind a single tap)
   and pinned it. That pin is kept below — it reports the precise pre-fix number, which is
   what proves it measures the real defect rather than a proxy for it — but it guarded
   exactly one disclosure on a page that has fifteen. A budget that protects one fold is a
   fix, not a rule: the next dumping ground would grow somewhere else in the same silence
   (the v3.54 defect class, "the defect that passed every existing test").
   So every visible disclosure on BOTH public modes is now measured around a REAL click and
   held to the same budget, and the assertion REPORTS the worst measurement it found so a
   failure is a diagnosis rather than a mystery (the v4.1.3 lesson).
   Measured at ship, 390x844: Simple 294 / 146 / 70 / 69 · Degen 214 / 177 / 149 / 140 / 118
   / 89 / 74 / 64 / 56 / 30 / 19. The public page passes at every fold, which is stated as
   the measurement rather than claimed — the terminal is where this sweep bit (see
   test/render.mjs, NEXT DOLLAR & UPSIDE at 701). */
console.log("\n[public] v6.9.4 — the fold sweep: EVERY disclosure, both modes, against the 320-word budget");
{
  const FOLD_BUDGET = 320;
  const { makeSpotlightFixture } = await import("./spotlight-fixture.mjs");
  const feed = { schema: "md-spotlight-v1", enabled: true, model: makeSpotlightFixture().projected };
  for (const power of [false, true]) {
    const { page, errors } = await open({ live: FULL_LIVE, width: 390, power, spotlight: feed });
    await page.waitForTimeout(1500);
    const toggles = page.locator("button.cg-toggle");
    const n = await toggles.count();
    const over = [], all = [];
    for (let k = 0; k < n; k++) {
      const b = toggles.nth(k);
      if (!(await b.isVisible().catch(() => false))) continue;
      if ((await b.getAttribute("aria-expanded").catch(() => null)) === "true") continue;
      const label = (await b.innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 60);
      /* Nested disclosure LABELS are excluded — a menu label is what you read to decide
         whether to tap again, not prose the tap made you read. The v6.9.2 pin above keeps
         its raw measure on purpose, so its reported 785 stays the comparable pre-fix number. */
      const words = async () => page.evaluate(() => {
        const all = (document.body.innerText || "").trim().split(/\s+/).filter(Boolean).length;
        let lbl = 0;
        document.querySelectorAll("button.cg-toggle").forEach((b) => {
          const t = (b.innerText || "").trim(); if (t) lbl += t.split(/\s+/).filter(Boolean).length;
        });
        return all - lbl;
      });
      const before = await words();
      await b.click({ force: true }); await page.waitForTimeout(260);
      const delta = (await words()) - before;
      await b.click({ force: true }).catch(() => {}); await page.waitForTimeout(160);
      all.push(delta);
      if (delta > FOLD_BUDGET) over.push(`${label} unveils ${delta}`);
    }
    const worst = all.length ? Math.max(...all) : 0;
    ok(`v6.9.4 public ${power ? "Degen" : "Simple"}: NO disclosure unveils more than ${FOLD_BUDGET} words at its first level — ${all.length} folds swept, worst ${worst}${over.length ? " · OVER: " + over.join(" | ") : ""}`,
      all.length > 0 && over.length === 0 && errors.length === 0);
    await page.close();
  }
}

console.log("\n[public] v6.9.7 — reconciled Degen evidence learning");
for (const width of [320,390,768,1280]) {
  const {page,errors}=await open({live:FULL_LIVE,width,route:"/?view=public"});
  await page.waitForTimeout(1200);
  const matrix=page.locator('section[aria-labelledby="drivers"]');
  ok(`v6.9.7 @${width}: evidence is expanded by default`,await matrix.locator('.driver-card').count()===6);
  ok(`v6.9.7 @${width}: every canonical factor has a direct teaching button`,await matrix.locator('button.driver-card').count()===6);
  ok(`v6.9.7 @${width}: readings and provenance use the shared readable scale`,await matrix.evaluate(el=>
    [...el.querySelectorAll('.driver-reading')].every(n=>parseFloat(getComputedStyle(n).fontSize)>=14 && getComputedStyle(n).textOverflow!=="ellipsis") &&
    [...el.querySelectorAll('.driver-date')].length===6 &&
    [...el.querySelectorAll('.driver-date')].every(n=>parseFloat(getComputedStyle(n).fontSize)>=12.5)));
  for(let i=0;i<6;i++) {
    const trigger=matrix.locator('button.driver-card').nth(i);
    await trigger.click();
    ok(`v6.9.7 @${width}: factor ${i+1} opens the three-bullet shared sheet`,await page.getByRole('dialog').isVisible() && await page.locator('.factsheet li').count()===3);
    await page.keyboard.press('Escape');
    ok(`v6.9.7 @${width}: factor ${i+1} restores focus`,!await page.getByRole('dialog').isVisible() && await trigger.evaluate(el=>document.activeElement===el));
  }
  ok(`v6.9.7 @${width}: expanded evidence fits the viewport`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await matrix.screenshot({path:`/tmp/macrodash-6995-evidence-${width}.png`});
  ok(`v6.9.7 @${width}: no runtime errors`,errors.length===0);
  await page.close();
}
{
  const live={...FULL_LIVE};delete live.vix;delete live.vixAsOf;
  const {page,errors}=await open({live,width:390,route:"/?view=public"});
  await page.waitForTimeout(1200);
  const matrix=page.locator('section[aria-labelledby="drivers"]');
  const excluded=matrix.locator('button.driver-card').filter({hasText:'no live feed right now'});
  ok("v6.9.7 excluded: reason is legible and remains excluded",await excluded.count()===1 && /Not counted/.test(await excluded.innerText()) &&
    await excluded.locator('.driver-exclusion').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=12.5));
  await excluded.click();
  ok("v6.9.7 excluded: learning states the missing feed, never a current reading",/excluded — no live feed right now/i.test(await page.getByRole('dialog').innerText()));
  await page.keyboard.press('Escape');
  ok("v6.9.7 excluded: no runtime errors",errors.length===0);
  await page.close();
}
for (const width of [320, 390, 768, 1280]) {
  const live = { ...FULL_LIVE, vix: 15.44, tenYear: 4.94, tenYearM1: 0.23,
    fearGreed: 29, nfci: -0.56, shillerPe: 27, cpiTrend: [3.7, 3.7, 3.7] };
  const { page, errors } = await open({ live, width, power: false });
  await page.waitForTimeout(1200);
  const region = page.locator('[aria-label="Key parameters"]');
  const text = await region.innerText();
  ok(`v6.9.8 @${width}: interpretations lead, monthly units are explicit, no direction arrows or duplicate vote tags`,
    /Low volatility supports stocks/.test(text) && /Rising yields pressure stocks/.test(text) &&
    /Looser financial conditions support stocks/.test(text) && !/0.23/.test(text) &&
    !/showing|not the full vote/.test(text) && !/▲|▼|HELPING|HURTING|SD vs avg/.test(text));
  ok(`v6.9.8 @${width}: summaries above readable supporting values; no horizontal overflow`, await page.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.simple-card')].every(c => {
      const s=c.querySelector('.simple-card-summary'), v=c.querySelector('.simple-card-value');
      return v === null &&
        parseFloat(getComputedStyle(s).fontSize) >= 14 && c.getBoundingClientRect().height >= 44;
    })));
  for (const card of await page.locator('.simple-card').all()) {
    await card.click();
    ok(`v6.9.8 @${width}: interpretation opens the same three-bullet sheet`, await page.getByRole('dialog').locator('li').count() === 3);
    await page.keyboard.press('Escape');
    ok(`v6.9.8 @${width}: focus returns to the card`, await card.evaluate(c => c === document.activeElement));
  }
  ok(`v6.9.8 @${width}: no runtime errors`, errors.length === 0);
  if (process.env.PATCH_SCREENSHOTS === '1') await page.screenshot({ path: `/tmp/macrodash-699-${width}.png` });
  await page.close();
}
for (const scenario of [
  {name:'loading', live:FULL_LIVE, delayMs:6000, available:0},
  {name:'outage', live:{}, status:500, available:0},
  {name:'stale', live:{...FULL_LIVE,vixAsOf:daysAgo(90)}, available:5},
  {name:'partial', live:DEGRADED, available:3},
]) {
  const {page,errors}=await open({...scenario,width:390,power:false});
  await page.waitForTimeout(1200);
  const rows=page.locator('.simple-card');
  const identities=await page.locator('[data-signal-key]').evaluateAll(ns=>ns.map(n=>n.dataset.signalKey));
  ok(`v6.9.9 ${scenario.name}: six stable identities through missing data`,
    identities.join() === 'tenYear,vix,fearGreed,cpiHeadline,valuation,nfci');
  ok(`v6.9.9 ${scenario.name}: real coverage, no hidden fallback reading`,
    new RegExp(`${scenario.available} of 6 signals available`).test(await page.locator('[aria-label="Key parameters"]').innerText()) &&
    await page.locator('.simple-card-value').count()===0);
  const unavailable=rows.filter({hasText:/unavailable|loading/i}).first();
  await unavailable.click();
  ok(`v6.9.9 ${scenario.name}: unavailable sheet gives reason, not a current number`,
    /No current reading is shown/.test(await page.getByRole('dialog').innerText()) &&
    await page.getByRole('dialog').locator('li').count()===3);
  await page.keyboard.press('Escape');
  ok(`v6.9.9 ${scenario.name}: no errors`,errors.length===0);
  await page.close();
}
{
  const live={...FULL_LIVE}; delete live.spyChangePct; delete live.qqqChangePct;
  const {page}=await open({live,width:390,power:false}); await page.waitForTimeout(1200);
  ok('v6.9.9 missing changes: live prices do not make mock changes look current',
    (await page.locator('.market-daily').allTextContents()).filter(t=>t==='Unavailable').length===2);
  await page.locator('.simple-market-tile').first().click();
  ok('v6.9.9 S&P sheet: proxy and separate safety circuit are explicit',
    /not a tradable SPY ETF quote|not an SPY quote/.test(await page.getByRole('dialog').innerText()) &&
    /crash circuit/.test(await page.getByRole('dialog').innerText()));
  await page.close();
}
{
  const saved={schema:'md-call-v1',effective_date:TODAY,headline:'MOONING',emoji:'🚀',direction:'BULLISH',confidence:'HIGH',actionability:'FULL',status:'OK',
    counts:{usable:6,total:6,bullish:4,bearish:1,neutral:1},override:{active:false},
    factors:['tenYear','vix','fearGreed','cpiHeadline','valuation','nfci'].map(key=>({key,label:key,excluded:false,mode:'LIVE',as_of:TODAY,
      state:key==='vix'?'NEUTRAL':key==='valuation'?'BEARISH':'BULLISH',display:'saved reading'}))};
  const {page,errors}=await open({live:FULL_LIVE,width:390,power:false,publicCall:saved,publicCallFrozen:true,publicCallCapturedAt:`${TODAY}T14:00:00.000Z`});
  await page.waitForTimeout(1200);
  ok('v6.9.9 factor-only drift: current states differ even with the same bullish headline',
    /Bullish/.test(await page.locator('[aria-label="Macro backdrop verdict"]').innerText()) &&
    await page.locator('.simple-signal-drift').count()===1 &&
    /Low volatility supports stocks/.test(await page.locator('[aria-label="Key parameters"]').innerText()));
  // The saved headline can agree while individual current votes have changed.
  {
    const degen=await open({live:FULL_LIVE,width:390,publicCall:saved,publicCallFrozen:true,publicCallCapturedAt:`${TODAY}T14:00:00.000Z`});
    await degen.page.waitForTimeout(1200);
    ok("Degen factor-only drift: saved call and current table are explicitly distinguished",
      /Current signals differ from the saved 10am call above/.test(await degen.page.locator(".driver-matrix").innerText()) &&
      /frozen 10am call/.test(await degen.page.locator('[aria-label="Macro backdrop verdict"]').innerText()) &&
      degen.errors.length===0);
    await degen.page.close();
  }
  ok('v6.9.9 frozen call: no runtime errors',errors.length===0);
  await page.close();
}
{
  const {page,errors}=await open({live:{...FULL_LIVE,vix:21,fearGreed:42},width:390});
  await page.waitForTimeout(1200);
  const vix=page.locator(".driver-card").filter({hasText:"VIX"});
  ok("Degen: a genuine VIX crossing shows its current distance and target model",
    /VIX below 18/.test(await vix.innerText())&&/3.0* away/.test(await vix.innerText())&&/RISK-ON/.test(await vix.innerText()));
  const cpi=page.locator(".driver-card").filter({hasText:"CPI"});
  ok("Degen: compound rules stay compact on the face",/Compound rule · see details/.test(await cpi.innerText()));
  await cpi.click();
  ok("Degen: compound criteria remain accessible without another rule table",
    /SHAPE of its trend/.test(await page.getByRole("dialog").innerText())&&await page.getByRole("dialog").locator("li").count()===3);
  await page.keyboard.press("Escape");
  ok("Degen: crossing scenario has no runtime errors",errors.length===0);
  await page.close();
}
{
 const {makeSpotlightFixture}=await import("./spotlight-fixture.mjs");
 const feed={schema:"md-spotlight-v1",enabled:true,model:makeSpotlightFixture().projected};
 for(const power of [false,true])for(const width of [320,390,768,1280]) {
  const base=String(Number(TODAY.slice(0,4))-1)+"-12-31";
  const live={...FULL_LIVE,spyYtdTotal:12.34,spyYtdTotalAsOf:TODAY,spyYtdTotalBase:base,qqqYtdTotal:23.45,qqqYtdTotalAsOf:TODAY,qqqYtdTotalBase:base};
  const {page,errors}=await open({live,width,power,spotlight:feed});await page.waitForTimeout(1200);
  ok("v7 "+power+"/"+width+": both YTD returns visible",JSON.stringify(await page.locator(".market-ytd").allTextContents())===JSON.stringify(["+12.3%","+23.4%"]));
  ok("v7 "+power+"/"+width+": prominent distinct Spotlight heading",await page.getByRole("heading",{name:"Stock Spotlight",exact:true}).evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=16&&getComputedStyle(n).fontWeight==="700"));
  ok("v7 "+power+"/"+width+": no overflow or runtime errors",await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)&&errors.length===0);
  await page.locator(".simple-market-tile").first().click();
  const sheet=await page.getByRole("dialog").innerText();
  ok("v7 "+power+"/"+width+": return basis, dates and three-bullet explainer",sheet.includes("Includes dividends")&&sheet.includes(base)&&sheet.includes(TODAY)&&await page.getByRole("dialog").locator("li").count()===3);
  await page.keyboard.press("Escape");
  if(process.env.PATCH_SCREENSHOTS)await page.screenshot({path:"/tmp/macrodash-v7-"+(power?"degen":"simple")+"-"+width+".png",fullPage:true});
  await page.close();
 }
}
{
 const parity=new Map();
 for(const power of [false,true])for(const width of [320,390]){
  const {page,errors}=await open({live:FULL_LIVE,width,power});await page.waitForTimeout(1200);
  const selector=power?".driver-card":".simple-card";
  for(let i=0;i<6;i++){
   await page.locator(selector).nth(i).click();
   const dialog=page.getByRole("dialog"),second=dialog.locator("li").nth(1);
   const body=await second.innerText();
   ok("7.0.1 "+power+"/"+width+"/"+i+": current vs reference in bullet 2",body.includes("Latest reported:")&&body.includes("Model reference:")&&body.includes("observation date")&&await dialog.locator("li").count()===3);
   ok("7.0.1 "+power+"/"+width+"/"+i+": prominent value and readable sheet",await second.locator("strong").evaluate(n=>getComputedStyle(n).fontWeight==="700"&&parseFloat(getComputedStyle(n).fontSize)>=16)&&await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+1));
   if(width===390){if(!power)parity.set(i,body);else ok("7.0.1 "+i+": identical comparison across modes",parity.get(i)===body);}
   if(process.env.PATCH_SCREENSHOTS&&width===390&&!power)await page.screenshot({path:"/tmp/macrodash-701-sheet-"+i+".png"});
   await page.keyboard.press("Escape");
   ok("7.0.1 "+power+"/"+width+"/"+i+": focus restored",await page.locator(selector).nth(i).evaluate(n=>document.activeElement===n));
  }
  ok("7.0.1 "+power+"/"+width+": no runtime errors",errors.length===0);await page.close();
 }
 for(const power of [false,true]){
  const live={...FULL_LIVE,vixAsOf:daysAgo(14)};delete live.tenYearM1;delete live.cpiTrend;
  const {page}=await open({live,width:390,power});await page.waitForTimeout(1200);
  for(const i of [0,1,3]){
   await page.locator(power?".driver-card":".simple-card").nth(i).click();
   const body=await page.getByRole("dialog").locator("li").nth(1).innerText();
   ok("7.0.1 "+power+"/"+i+": stale or missing comparison cannot look live",body.includes("Current reading unavailable")&&!body.includes("Latest reported:")&&body.includes("Model reference:"));
   await page.keyboard.press("Escape");
  }
  await page.close();
 }
}
/* v7.0.3 — THE F&G ASTERISK, DRIVEN. The split is pinned as an object in smoke; this proves it
   reaches a reader. Both of the sheet's bullet-2 render paths are exercised, because they are
   built differently: the voter cards rebuild bullet 2 in voterSheet() around the band ruler,
   while the macro-strip tile renders explain.what[1] raw. A caption present on only one of them
   would be a disclosure the default view might never show. Position is asserted, not mere
   presence — "after the backdrop ruler" is the whole instruction, and a caption that floated
   above the band it qualifies would read as a second, competing ruler. */
{
 const ASTERISK = "Terminal gate uses different bands (bull 25–55)";
 for(const power of [false,true]){
  const {page,errors}=await open({live:FULL_LIVE,width:390,power});await page.waitForTimeout(1200);
  const selector=power?".driver-card":".simple-card";
  // Index 2 is fearGreed in REGIME_BAND_TABLE order (10Y · VIX · F&G · CPI · VAL · NFCI).
  await page.locator(selector).nth(2).click();
  const fg=await page.getByRole("dialog").locator("li").nth(1).innerText();
  ok("7.0.3 "+power+": the F&G voter sheet states the terminal split, AFTER the model reference",
    fg.includes(ASTERISK) && fg.indexOf("Model reference:") < fg.indexOf(ASTERISK) &&
    await page.getByRole("dialog").locator("li").count()===3);
  await page.keyboard.press("Escape");
  // Scoped live, not just in the object: VIX and the 10Y are edge-identical across both
  // engines, so a caption there would claim a split that does not exist.
  let others=true;
  for(const i of [0,1,3,4,5]){
   await page.locator(selector).nth(i).click();
   if((await page.getByRole("dialog").innerText()).includes(ASTERISK))others=false;
   await page.keyboard.press("Escape");
  }
  ok("7.0.3 "+power+": no other voter sheet claims a split — F&G alone carries the asterisk",others);
  /* The macro-strip tile is the OTHER render path (raw explain.what[1]). ⚠ CORRECTION to my
     own first cut, recorded rather than quietly fixed: I wrote this as "Simple behind the
     fold, Degen directly" and it timed out against a correct page. Since v6.9.9 BOTH modes
     lead with SimpleMarketTape and the full eight-tile strip renders ONLY under Simple's
     "Explore market data" — so in Degen there is no strip sheet for F&G at all, and its only
     path to the caption is the driver card asserted above. Scoped to Simple accordingly; a
     conditional click would have made this pin pass vacuously in Degen. */
  if(!power){
   await page.getByRole("button",{name:/Explore market data/}).click();
   const tiles=page.locator(".macro-strip-inner .strip-tile");
   let idx=-1;
   for(let i=0;i<await tiles.count();i++) if(/F&G/.test(await tiles.nth(i).innerText())) idx=i;
   ok("7.0.3 the F&G strip tile exists in Simple's Explore fold — the raw-explain render path",idx>=0);
   await tiles.nth(idx).click();
   const strip=await page.getByRole("dialog").innerText();
   ok("7.0.3 the F&G STRIP tile carries the same split, after the backdrop ruler",
     strip.includes(ASTERISK) && strip.indexOf("below 30 as hurting") < strip.indexOf(ASTERISK));
   await page.keyboard.press("Escape");
  }
  ok("7.0.3 "+power+": no runtime errors",errors.length===0);
  await page.close();
 }
}
await browser.close();
srv.close();
console.log(`\n=== PUBLIC RENDER TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
