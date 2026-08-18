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
const TODAY = ET.format(new Date());
const daysAgo = (n) => ET.format(new Date(Date.now() - n * 86400000));

// Every field a regime factor depends on, with its own AsOf so nothing reads stale.
const FULL_LIVE = {
  lastRefresh: `${TODAY} 16:00 ET`, session: "CLOSE",
  spyPrice: 748.1, spyPriceAsOf: TODAY, spyChangePct: 0.4, spyMa200: 700, spyMa100: 720,
  tenYear: 4.46, tenYearAsOf: TODAY, tenYearM1: -0.22, tenYearD1: 0.01,
  vix: 16.1, vixAsOf: TODAY,
  fearGreed: 62, fearGreedAsOf: TODAY, fearGreedLabel: "Greed",
  cpiHeadline: 2.4, cpiHeadlineAsOf: daysAgo(20), cpiTrend: [3.1, 2.9, 2.8, 2.7, 2.6, 2.4],
  fedFunds: 3.63, fedFundsAsOf: daysAgo(20),
  // v3.99: the Fed's DAILY target-range bounds — the tile's headline when live.
  fedTargetUpper: 3.75, fedTargetUpperAsOf: TODAY, fedTargetLower: 3.50, fedTargetLowerAsOf: TODAY,
  nfci: -0.62, nfciAsOf: daysAgo(4),
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
async function open({ live, status = 200, delayMs = 0, width = 1280, route = "/", power = true, picks = null }) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  // v3.94 SIMPLE/POWER: SIMPLE is the product default; the legacy scenarios below assert the
  // full analytical view, so they seed the persisted Power preference the way a returning
  // power user's device would carry it. Simple-mode scenarios pass power: false (nothing
  // stored — the true first-visit state).
  if (power) await page.addInitScript(() => { try { localStorage.setItem("md:view:v1", "power"); } catch (_e) {} });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/api/snapshot*", async (r) => {
    if (delayMs) await new Promise((res) => setTimeout(res, delayMs));
    const st = typeof status === "function" ? status() : status;   // B1: flip-able stub
    if (st !== 200) return r.fulfill({ status: st, body: "upstream failure" });
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ live, cached: false, asOf: new Date().toISOString() }) });
  });
  // v3.97: /api/picks stub — pass a picks-v1 body to render the strip, omit (null) to
  // simulate the failed/absent feed (the strip must then render NOTHING, never example data).
  await page.route("**/api/picks*", (r) => picks
    ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(picks) })
    : r.fulfill({ status: 500, body: "no picks feed" }));
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: "domcontentloaded" });
  return { page, errors };
}
const bandText = (page) => page.locator('[aria-label="Macro backdrop verdict"]').innerText();
const POSTURES = /\b(RISK-ON|RISK-OFF|MIXED)\b/;

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
  ok("loading: no factors are claimed to be voting", /no factors voting yet/i.test(band));
  ok("loading: the flip line is suppressed — there is no posture to flip",
    !/would change this/i.test(band));
  // A1 (v3.58, re-audit HIGH): the verdict said CAN'T CALL IT while the 5 Whys narrated mock
  // SPY/CPI/Fed as today's core tape. The narrative must carry ZERO mock numbers now.
  // v3.92 QUIET OVERVIEW: the chain is one tap deep — the regime state stays visible while
  // closed (pinned), and the anchors are read AFTER opening the expander.
  ok("v3.92: the whys collapse by default with the regime state visible while closed",
    !/WHY #1/.test(await page.locator("body").innerText()) &&
    /DATA HOLD|CAN'T CALL IT|LOADING/i.test(await page.locator("body").innerText()));
  // v3.94: the whys are TWO clicks deep (reasoning group → why chain); the inner toggle is
  // matched on its unique tail — the group label also contains "5 whys".
  await page.locator("button.cg-toggle", { hasText: "the reasoning" }).click();
  await page.waitForTimeout(150);
  await page.locator("button.cg-toggle", { hasText: "narrative & provenance" }).click();
  await page.waitForTimeout(150);
  const loadBody = await page.locator("body").innerText();
  // v3.97.2: WHY #1 is labelless (voice rules), so the guard pins the narrated SHAPE —
  // "SPY $<price> (<pct>)" — which only the whys emit (the macro strip breaks price onto
  // its own line, so it can never match).
  ok("loading A1: the 5 Whys narrates NO mock core numbers (no 'SPY $<px> (<pct>)' clause)",
    !/SPY \$[\d.]+ \(/.test(loadBody));
  ok("loading A1: the anchor states itself as empty — 0/3 core inputs usable",
    /0\/3 core inputs usable/.test(loadBody));
  ok("loading A1: the headline carries no mock SPY day-move",
    !/bullish factors — SPY/.test(loadBody));
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
  ok("live: all six factors vote", /6\/6 factors voting|6 bullish|of 6/i.test(await page.locator("body").innerText()));
  await page.locator('button[aria-label="Show regime factors"]').click();
  await page.waitForTimeout(150);
  ok("live: the flip line returns once there is a posture to flip (v3.94: inside the ℹ evidence panel)",
    /would change this/i.test(await bandText(page)));
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
      return t.includes("•") && !t.includes("▼") && !t.includes("▲"); })());
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
      return m !== null && Number(m[1]) === chips && chips > 0;
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
    /only 3 of 6 factors usable/i.test(band) && /4 required/i.test(band));
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
  await page.locator("button.cg-toggle", { hasText: "narrative & provenance" }).click();
  await page.waitForTimeout(150);
  const errBody = await page.locator("body").innerText();
  ok("error: the page still renders (graceful degradation holds — it never breaks)",
    errBody.length > 500);
  ok("error A1: the 5 Whys narrates no mock numbers after a failed fetch either",
    !/SPY \$[\d.]+ \(/.test(errBody) && /0\/3 core inputs usable/.test(errBody));
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
    return { whys: top(/the reasoning/i), sq: top(/SIGNAL QUALITY/i), spy: top(/^●?\s*SPY\*?$/m) };
  });
  ok("v3.93 budget: first market data begins within 700px at 390×844 (measured 663 at pass time)",
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
  ok("v4.0.3 simple: the Glance layer renders — scoped verdict, one sentence, cards, SCOPED confidence, key numbers",
    /MACRO: (BULLISH|HODL|BEARISH|DATA HOLD)/.test(body) &&
    /(supportive|working against|clear lean right now)/i.test(body) &&   // v4.0.1 named-factor copy
    /\d+ of \d+ voters counted/.test(body) && /SPY/.test(body));
  ok("v4.0.3 simple: the tracked-signal census is GONE from Simple — one confidence number, scoped",
    !/SIGNAL QUALITY/i.test(body) && !/of \d+ tracked/i.test(body));
  const bandTxt = await page.locator('[aria-label="Macro backdrop verdict"]').innerText();
  ok("v4.0 simple: EXACTLY ONE verdict — the engine label never renders beside the scoped one",
    (() => { const t = bandTxt; return !/RISK-ON|RISK-OFF|\bMIXED\b/.test(t); })());
  ok("v4.0 simple: the verdict is SCOPED and the moon voice is gone from the Simple hero",
    /MACRO: /.test(body) && !/MOONING|DIAMOND HANDS|CAN'T CALL IT/.test(
      await page.locator('[aria-label="Macro backdrop verdict"]').innerText()));
  ok("v4.0 simple: the eyebrow is scoped too — no 'wen moon?' above a MACRO: verdict",
    /the call/i.test(await page.locator('[aria-label="Macro backdrop verdict"]').innerText()) &&
    !/wen moon/i.test(await page.locator('[aria-label="Macro backdrop verdict"]').innerText()));
  ok("v4.0 simple: card values are METRICS — the matrix's inline '(bullish)' judgment is gone",
    !/\(bullish\)|\(bearish\)/.test(await page.locator('[aria-label="Key parameters"]').innerText()));
  ok("v4.0 simple: cards carry value + direction + why + freshness, and the truncation is NAMED",
    /HELPING|HURTING|MIXED/.test(body) && /discount rate|violently|already priced|Fed can ease|good news|plumbing/.test(body) &&
    /showing \d+ of \d+ usable/.test(body) && /⇄/.test(body));
  ok("v4.0 simple: the v3.97 prose no longer renders (the cards replaced it)",
    !/The bull case right now:/.test(body) && !/The bear case:/.test(body));
  ok("v3.97 simple: no picks feed → the strip renders NOTHING, never example picks",
    !/My S-Tier/i.test(body) && !/not investment advice/i.test(body));
  ok("simple: Layer 2/3 content is NOT in the DOM — the Power reasoning group, factor evidence, market detail, macro grid",
    !/the reasoning/i.test(body) && !/factor evidence/i.test(body) &&
    !/full market detail/i.test(body) && !/MACRO REGIME/i.test(body) && !/Data Health/i.test(body));
  // v3.95: the whys ARE reachable in Simple — one honestly-labelled expander under the
  // hero sentence, closed on a first visit, holding the chain and nothing technical.
  ok("v3.95 simple: the whys expander is present and CLOSED — label visible, no why statements",
    /why this posture — 5 whys/i.test(body) && !/WHY #1/.test(body));
  await page.locator("button.cg-toggle", { hasText: "why this posture" }).click();
  await page.waitForTimeout(250);
  const whysOpen = await page.locator("body").innerText();
  ok("v3.95 simple: one tap opens the five why statements",
    /WHY #1/.test(whysOpen) && /WHY #5/.test(whysOpen));
  ok("v3.95 simple: opening the whys does NOT pull the technical layer in with it",
    !/factor evidence/i.test(whysOpen) && !/full market detail/i.test(whysOpen));
  await page.reload(); await page.waitForTimeout(1200);
  ok("v3.95 simple: the open state is remembered per device across a reload",
    /WHY #1/.test(await page.locator("body").innerText()));
  // Back to closed for the glance measurement below — the budget is a first-visit claim.
  await page.locator("button.cg-toggle", { hasText: "why this posture" }).click();
  await page.waitForTimeout(250);
  ok("simple: red facts ignore the mode — the crash-gauge warning renders in Simple",
    /crash gauge \(VIX\) unavailable/.test(body));
  ok("simple: the toggle is present, labelled honestly, Simple pressed",
    await page.locator('button[aria-pressed="true"]', { hasText: "Simple" }).count() === 1);
  const glance = await page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((n) =>
      n.children.length === 0 && /^●?\s*SPY\*?$/m.test(n.textContent || "") && n.getBoundingClientRect().height > 0);
    return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
  });
  // v3.95 re-pin 520 -> 540, WITH the reason (the v3.45 legitimate-content precedent, not a
  // budget quietly loosened): the owner-requested whys expander is ONE toggle row under the
  // hero sentence and measured +10px (520 -> 530). Chrome creeping back still fails the build.
  /* v4.0 — the budget is RE-PINNED 540 -> 780 with the measurement and the reason (the
     v3.45/v3.95 precedent, never a budget quietly loosened). What changed is legitimate
     PRIMARY content, not chrome: three parameter cards carrying current values, direction,
     why-it-matters and freshness now sit between the verdict and the macro strip. Measured
     at 390×844: 536 -> 747 (817 before the cards were compacted from tall cards to rows).
     SPY still lands inside the 844px first screen. */
  ok("v4.0 glance budget: in Simple the macro strip still begins within 780px at 390×844",
    glance !== null && glance <= 780);
  /* And the pin that now matters MORE: the ANSWER — the parameter cards — must be near the
     top. A budget that only watched the raw strip would let the cards drift downward while
     still passing. */
  const cardsTop = await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Key parameters"]');
    return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
  });
  ok("v4.0: the parameter cards — the answer — begin within 400px at 390×844",
    cardsTop !== null && cardsTop <= 400);
  // One tap to Power: the full view appears; the choice persists across reload.
  await page.locator("button", { hasText: "Power" }).click();
  await page.waitForTimeout(400);
  const powerBody = await page.locator("body").innerText();
  ok("power: one tap reveals the Explain/Dig layers",
    /the reasoning/i.test(powerBody) && /factor evidence/i.test(powerBody) && /full market detail/i.test(powerBody));
  ok("v3.97 power: the compact sentence returns and the newbie prose leaves (swap, not stack)",
    /leans? (bullish|bearish)/.test(powerBody) && !/The bull case right now:/.test(powerBody));
  await page.reload(); await page.waitForTimeout(1200);
  ok("power: the choice is remembered per device across a reload",
    /the reasoning/i.test(await page.locator("body").innerText()));
  ok("v3.94: no page errors through both modes", errors.length === 0);
  await page.close();
}

// ── v3.97 SHAREABLE SIMPLE — the live S-tier picks strip ────────────────────
console.log("\n[public] v3.97 — picks strip renders live-fetched syms, bottom of Simple, both routes");
{
  const PICKS = { schema: "picks-v1", asOf: TODAY, picks: [
    { sym: "AAA", tier: "S", note: "synthetic fixture pick" }, { sym: "BBB", tier: "S" } ] };
  const { page, errors } = await open({ live: FULL_LIVE, width: 390, power: false, picks: PICKS, route: "/?view=public" });
  await page.waitForTimeout(1200);
  const body = await page.locator("body").innerText();
  ok("picks: the strip renders the fetched syms with the not-advice line and asOf — on the ?view=public route too",
    /My S-Tier/i.test(body) && /AAA/.test(body) && /BBB/.test(body) &&
    /not investment advice/i.test(body) && body.includes(`as of ${TODAY}`));
  ok("picks: the owner-authored share_note rides its chip",
    /synthetic fixture pick/.test(body));
  ok("picks: chips are non-interactive — no button inside the strip (a dead button is a lie)",
    await page.locator('[aria-label="My S-tier picks"] button').count() === 0);
  ok("picks: the strip sits BELOW the key numbers (bottom of the page, never above the answer)",
    await page.evaluate(() => {
      const strip = document.querySelector('[aria-label="My S-tier picks"]');
      const spy = [...document.querySelectorAll("*")].find((n) =>
        n.children.length === 0 && /^●?\s*SPY\*?$/m.test(n.textContent || "") && n.getBoundingClientRect().height > 0);
      return !!strip && !!spy && strip.getBoundingClientRect().top > spy.getBoundingClientRect().top;
    }));
  ok("v3.97: no page errors with the picks feed live", errors.length === 0);
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
    /RISK-ON|RISK-OFF|MIXED/.test(body2) && !/⚠ ERROR/.test(body2));
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
    /factors usable/i.test(driversClosed) && /factor evidence/i.test(driversClosed) &&
    !/as of \d{4}-\d{2}-\d{2}/.test(driversClosed));
  await page.locator('section[aria-labelledby="drivers"] button[aria-expanded]').click();
  await page.waitForTimeout(200);
  const drivers = await page.locator('section[aria-labelledby="drivers"]').innerText();
  ok("C3: the Evidence Matrix renders six factor cards with votes (one tap deep)",
    (drivers.match(/BULL|BEAR|NEUTRAL/g) || []).length >= 6 && /6\/6 factors usable/i.test(drivers));
  ok("C3: each card carries freshness and an as-of date",
    /LIVE/.test(drivers) && /as of \d{4}-\d{2}-\d{2}/.test(drivers));
  await page.locator("button.cg-toggle", { hasText: "the reasoning" }).click();   // v3.94: WC rides the group
  await page.waitForTimeout(150);
  const body1 = await page.locator("body").innerText();
  ok("C4: first valid visit says BASELINE SET, never 'nothing changed'",
    /baseline set — tracking starts today on this device/.test(body1));
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
    /no material change since your previous visit on this device \(\d{4}-\d{2}-\d{2}\)/.test(body2));
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
    /SPY\*/.test(mktsClosed) && !/MARKET PULSE/i.test(mktsClosed) && /full market detail/i.test(mktsClosed));
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
  // v3.84: the Sahm cell (macro section, always visible) — CLEAR with the distance stated.
  const macTxt = await page.locator('section[aria-labelledby="macro"]').innerText();
  ok("v3.84: the Sahm cell renders CLEAR with distance-to-trigger on live data",
    /SAHM RULE/i.test(macTxt) && /\+0\.23/.test(macTxt) && /CLEAR · 0\.27 to trigger/i.test(macTxt));
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
  // v3.98.3: one scoped, one-vocabulary line — "5 of 6 voters counted · dark: VIX".
  ok("glance: the exclusion is visible while the matrix is closed (the voters line names it)",
    /5 of 6 voters counted/i.test(closed) && /dark: VIX/i.test(closed));
  await page.locator('section[aria-labelledby="drivers"] button[aria-expanded]').click();
  await page.waitForTimeout(200);
  const drivers = await page.locator('section[aria-labelledby="drivers"]').innerText();
  // v3.98.3: the reason is retailed AND the card now shows the real cause — a dead feed
  // says "no live reading", never the stale wording the hero used to hardcode.
  ok("C3: an excluded factor is NAMED with its real reason on the card itself",
    /EXCLUDED/.test(drivers) && /excluded — no live feed right now/.test(drivers) &&
    /no live reading — not counted/.test(drivers) && /5\/6 factors usable/i.test(drivers));
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
  const strip = page.locator(".macro-strip");
  ok("v3.98.4: a DARK voter loses the ▪ marker and its tooltip stops claiming it counts",
    await strip.evaluate((el) => {
      const item = [...el.querySelectorAll("[title]")].find((n) => /Volatility index/.test(n.getAttribute("title") || ""));
      if (!item) return false;
      return /not counted/.test(item.getAttribute("title")) && !item.textContent.includes("▪");
    }));
  ok("v3.98.4: a LIVE voter still carries ▪ and still says it counts (the marker kept its meaning)",
    await strip.evaluate((el) => {
      const item = [...el.querySelectorAll("[title]")].find((n) => /Fear & Greed/.test(n.getAttribute("title") || ""));
      return !!item && /Counts toward today/.test(item.getAttribute("title")) && item.textContent.includes("▪");
    }));
  const macro = await page.locator('section[aria-labelledby="macro"]').innerText();
  ok("v3.98.4: the CPI box now dates itself — no LIVE badge without an observation date",
    /CPIAUCSL \+ CPILFESL/.test(macro) && /as of/i.test(macro));
  ok("v3.98.4: no page errors through the degraded read-through", errors.length === 0);
  await page.close();
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
  ok("v3.99: with Kalshi absent the countdown still renders, off the published Fed calendar",
    /Next FOMC in \d+ days?/.test(macro) && /published Fed calendar/.test(macro) &&
    !/awaiting schedule/.test(macro));
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
  ok("v4.0 verdict: a bear tape reads MACRO: BEARISH, and risk factors lead the cards",
    /MACRO: BEARISH/.test(body) && /HURTING/.test(body));
  await page.close();

  // 2. BULLISH.
  const bull = { ...FULL_LIVE, tenYearM1: -0.30, vix: 12, fearGreed: 78,
    cpiTrend: [3.4, 3.2, 3.0, 2.8, 2.6, 2.3], shillerPe: 19, nfci: -0.90 };
  ({ page, errors } = await open({ live: bull, width: 390, power: false }));
  await page.waitForTimeout(1300);
  body = await page.locator("body").innerText();
  ok("v4.0 verdict: a bull tape reads MACRO: BULLISH with supporting factors leading",
    /MACRO: BULLISH/.test(body) && /HELPING/.test(body) &&
    /supportive/i.test(body));   // v4.0.1: the sentence names factors, supportive-side leading
  await page.close();

  // 3. DATA HOLD — below quorum. And the acceptance rule that matters most here: a withheld
  //    posture explains nothing and offers no flip, but says WHY it is withheld.
  ({ page, errors } = await open({ live: DEGRADED, width: 390, power: false }));
  await page.waitForTimeout(1300);
  body = await page.locator("body").innerText();
  ok("v4.0 verdict: below quorum reads MACRO: DATA HOLD, never a thin directional call",
    /MACRO: DATA HOLD/.test(body) && !/MACRO: (BULLISH|BEARISH|HODL)/.test(body));
  ok("v4.0 withheld: no explanatory sentence, and the flip line states the evidence shortfall",
    /Call withheld until the required evidence is current and usable/.test(body) &&
    !/are supportive|is working against|clearly supportive|clear lean right now/i.test(body));
  ok("v4.0 withheld: cards still render only USABLE factors — a dead feed is never a card",
    !/HELPING|HURTING|MIXED/.test(body) || /showing \d+ of \d+ usable/.test(body));
  await page.close();

  // 4. A dead feed must never appear as a card, and must never be padded to three.
  const oneDead = { ...FULL_LIVE }; delete oneDead.vix; delete oneDead.vixAsOf;
  ({ page, errors } = await open({ live: oneDead, width: 390, power: false }));
  await page.waitForTimeout(1300);
  body = await page.locator("body").innerText();
  const cardsText = await page.locator('[aria-label="Key parameters"]').innerText();
  ok("v4.0 cards: the dead-feed factor is absent from the cards entirely (not shown as 'mixed')",
    !/volatility/i.test(cardsText));
  ok("v4.0 cards: never padded with UNAVAILABLE placeholders — absence is not content",
    !/UNAVAILABLE/i.test(cardsText) && /showing \d+ of \d+ usable/.test(cardsText));
  ok("v4.0 cards: the not-counted factor is still ACKNOWLEDGED in the count line",
    /not counted/.test(cardsText));
  ok("v4.0: no page errors across the verdict matrix", errors.length === 0);
  await page.close();
}
{
  // 5. POWER must be untouched by all of the above.
  const { page } = await open({ live: FULL_LIVE, width: 1280, power: true });
  await page.waitForTimeout(1300);
  const band = await page.locator('[aria-label="Macro backdrop verdict"]').innerText();
  ok("v4.0 boundary: Power keeps the moon voice and never shows the scoped Simple verdict",
    /MOONING|HODL|DIAMOND HANDS|CAN'T CALL IT/.test(band) && !/MACRO: /.test(band));
  const body = await page.locator("body").innerText();
  ok("v4.0 boundary: Power keeps the full analytical view and gets NO Simple cards",
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
  ok("operator route: the TT copy button renders (v3.61 gate leaves the operator view whole)",
    await page.locator('button[aria-label="Copy TT regime readout"]').count() === 1);
  await page.close();
}
{
  const { page } = await open({ live: FULL_LIVE, route: "/?view=public" });
  await page.waitForTimeout(1200);
  const pub = await page.locator("body").innerText();
  ok("public route: MY CONVICTION is gated out", !/MY CONVICTION/.test(pub));
  ok("public route: Macro Alerts are gated out", !/Macro Alerts/i.test(pub));
  ok("public route: TERMINAL link hidden", !/⌁ TERMINAL/.test(pub));
  ok("public route: the footer NAMES the omission (a cut takes its attribution with it)",
    /operator view carries the curated watchlist and alert monitors/.test(pub));
  ok("public route: the verdict itself still publishes — the gate hides content, not judgment",
    /RISK-ON|RISK-OFF|MIXED/.test(pub));
  // FEAT-GLANCE (v3.61, newcomer audit #5): TT and the alert badges are operator tooling —
  // "⚡ 3 BLIND" reads as a system failure to a visitor who can't see the monitors it counts.
  ok("public route: the TT copy button is gated out",
    await page.locator('button[aria-label="Copy TT regime readout"]').count() === 0);
  ok("public route: no FIRED/BLIND alert badge leaks", !/⚡ \d+ (FIRED|BLIND)/.test(pub));
  await page.close();
}
{
  const { page } = await open({ live: FULL_LIVE });
  await page.waitForTimeout(1200);
  ok("a11y: exactly one main landmark", await page.locator('[role="main"]').count() === 1);
  // B4 (v3.59): the block regions stopped announcing; one concise status node does.
  ok("a11y: exactly one concise polite status region announces backdrop changes",
    await page.locator('[role="status"][aria-live="polite"]').count() === 1 &&
    /Backdrop (RISK-ON|RISK-OFF|MIXED): \d of 6 factors usable\./.test(
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
  ok("slice1 @375px: the confidence tally and flip sentence ride one tap deep in the band's evidence panel",
    /of \d+ usable/.test(await band.innerText()) && /would change this/i.test(await band.innerText()));
  await page.locator("button.cg-toggle", { hasText: "the reasoning" }).click();   // v3.94: two clicks deep
  await page.waitForTimeout(150);
  await page.locator("button.cg-toggle", { hasText: "narrative & provenance" }).click();
  await page.waitForTimeout(150);
  const body = await page.locator("body").innerText();
  ok("slice1 @375px: the extracted 5 Whys narrative renders one tap deep (WHY #1–#5 present)",
    /WHY #1/.test(body) && /WHY #5/.test(body) && /5 Whys · Today/i.test(body));
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
    navigator.clipboard.writeText = () => Promise.resolve();
  });
  await share.click();
  await page.waitForTimeout(200);
  ok("7.9 control: a successful write still confirms ✓ COPIED",
    /✓ COPIED/.test(await page.locator("button", { hasText: /COPIED|SHARE/ }).first().innerText()));
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
    const cell = [...document.querySelectorAll(".macro-strip-inner > div")]
      .find((el) => /F&G/.test(el.textContent));
    return getComputedStyle(cell.lastElementChild).color;
  });
  ok("fix: a NEUTRAL F&G (45) renders the neutral grey on the strip, not bearish red",
    col === "rgb(136, 146, 164)");
  await page.locator('button[aria-label="Show regime factors"]').click();   // v3.94: chips in the panel
  await page.waitForTimeout(150);
  const chips = await page.locator('[aria-label="Macro backdrop verdict"]').innerText();
  ok("fix control: the band chip agrees — F&G carries • (neutral), and the two surfaces now match",
    /F&G •/.test(chips));
  await page.close();
}
{
  const { page } = await open({ live: FULL_LIVE });
  await page.waitForTimeout(1400);
  const col = await page.evaluate(() => {
    const cell = [...document.querySelectorAll(".macro-strip-inner > div")]
      .find((el) => /F&G/.test(el.textContent));
    return getComputedStyle(cell.lastElementChild).color;
  });
  ok("fix control: a genuine greed reading (62, bull) still renders green — no over-correction",
    col === "rgb(46, 204, 113)");
  await page.close();
}

await browser.close();
srv.close();
console.log(`\n=== PUBLIC RENDER TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
