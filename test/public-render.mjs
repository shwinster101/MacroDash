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
  picks = null, history = null, publicCall = null, publicCallFrozen = false, publicCallCapturedAt = null }) {
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
      body: JSON.stringify({ live, cached: false, asOf: new Date().toISOString(),
        publicCall, publicCallFrozen, publicCallCapturedAt }) });
  });
  // v3.97: /api/picks stub — pass a picks-v1 body to render the strip, omit (null) to
  // simulate the failed/absent feed (the strip must then render NOTHING, never example data).
  await page.route("**/api/picks*", (r) => picks
    ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(picks) })
    : r.fulfill({ status: 500, body: "no picks feed" }));
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
  ok("loading: no factors are claimed to be voting", /no factors voting yet/i.test(band));
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
  ok("live: all six factors vote", /6 of 6 voters counted/i.test(await page.locator("body").innerText()));
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
    // 8/28 matrix row 2 — canonical coverage vocabulary, driven live.
    /only 3 of 6 voters counted/i.test(band) && /4 needed to call it/i.test(band) &&
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
  ok("v5.3 simple: the Glance layer renders — human call, machine direction, sentence, cards, scoped confidence, key numbers",
    /MOONING|HODL|DIAMOND HANDS|CAN'T CALL IT/.test(body) && POSTURES.test(body) &&
    /(supportive|working against|clear lean right now)/i.test(body) &&   // v4.0.1 named-factor copy
    /\d+ of \d+ voters counted/.test(body) && /SPY/.test(body));
  ok("v4.0.3 simple: the tracked-signal census is GONE from Simple — one confidence number, scoped",
    !/SIGNAL QUALITY/i.test(body) && !/of \d+ tracked/i.test(body));
  const bandTxt = await page.locator('[aria-label="Macro backdrop verdict"]').innerText();
  ok("v4.0 simple: EXACTLY ONE verdict — the engine label never renders beside the scoped one",
    (() => { const t = bandTxt; return !/RISK-ON|RISK-OFF|\bMIXED\b/.test(t); })());
  ok("v5.3 simple: the moon voice is primary and the machine direction is secondary",
    /MOONING|HODL|DIAMOND HANDS|CAN'T CALL IT/.test(bandTxt) &&
    /BULLISH|NEUTRAL|BEARISH|DATA HOLD/.test(bandTxt) && !/MACRO: /.test(bandTxt));
  // 8/28 A4/A6: the unfrozen Simple face says "live read", never "the call", and carries
  // the counterpart caption — either clock branch, since suite runs at arbitrary ET hours.
  ok("v4.0/8-28 simple: the unfrozen eyebrow reads 'live read', never the official-call name",
    /live read/i.test(await page.locator('[aria-label="Macro backdrop verdict"]').innerText()) &&
    !/· the call/i.test(await page.locator('[aria-label="Macro backdrop verdict"]').innerText()) &&
    !/wen moon/i.test(await page.locator('[aria-label="Macro backdrop verdict"]').innerText()));
  ok("8/28 A6: the unfrozen counterpart caption renders, phrased by the client clock",
    /live read — today's (official call freezes at 10:00 ET|10am record not loaded)/.test(
      await page.locator('[aria-label="Macro backdrop verdict"]').innerText()));
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
  ok("v5.9 ruler: cards carry the CHIP form of their own edges — no prose on the face",
    /help <−0\.1 · hurt >0\.15/.test(cardsInner) &&
    !/1-mo change below/.test(cardsInner));
  ok("8/29 ruler: an EXCLUDED factor is not a card, so it contributes no ruler",
    !/help <18/.test(cardsInner));
  /* v5.9: the why-it-matters SENTENCE left the face for the sheet (the card was four lines,
     three times over). Value, direction, freshness and the named truncation stay — those are
     facts, not prose, and the v3.1 provenance invariant is not a density trade. */
  ok("v5.9 simple: cards carry value + direction + freshness, and the truncation is NAMED",
    /HELPING|HURTING|MIXED/.test(body) && !/discount rate on every future dollar/.test(body) &&
    /\d+ cards from the \d+ voters counted/.test(body) &&
    // 8/28: the flip's ONE home is the whys — chip on the closed label, absent from cards.
    /⇄/.test(await page.locator("button.cg-toggle", { hasText: "why this call" }).innerText()) &&
    !/⇄/.test(await page.locator('[aria-label="Key parameters"]').innerText()));
  /* 8/28: chip-length in place, VERBATIM one tap deep (v3.66) — the chip must be a genuine
     prefix of the full line, so a truncated read continues where it left off. */
  {
    const chipTxt = await page.locator("button.cg-toggle", { hasText: "why this call" }).innerText();
    await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
    await page.waitForTimeout(200);
    const openTxt = await page.locator("body").innerText();
    const chip = (chipTxt.split("⇄")[1] || "").replace(/…\s*$/, "").trim().toLowerCase();
    ok("8/28: the closed chip is a real prefix of the flip rendered verbatim inside",
      chip.length > 0 && openTxt.toLowerCase().includes(chip));
    await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
    await page.waitForTimeout(150);
  }
  /* v4.0.4 — the label-to-metric contract, driven live. The card is labelled "the 10-year
     yield"; before this it showed only the voted monthly delta, so the delta read AS the
     yield. Both must be on the card, level first, delta signed. */
  ok("v4.0.4 simple: the 10Y card shows the LEVEL its label names, with the voted delta as context",
    (() => { const t = cardsInner;
      return /4\.46%/.test(t) && /-0\.22pp 1-mo/.test(t) &&
        t.indexOf("4.46%") < t.indexOf("-0.22pp"); })());
  ok("v4.0 simple: the v3.97 prose no longer renders (the cards replaced it)",
    !/The bull case right now:/.test(body) && !/The bear case:/.test(body));
  ok("v3.97 simple: no picks feed → the strip renders NOTHING, never example picks",
    !/My S-Tier/i.test(body) && !/not investment advice/i.test(body));
  ok("simple: Layer 2/3 content is NOT in the DOM — the Power reasoning group, factor evidence, market detail, macro grid",
    !/the reasoning/i.test(body) && !/factor evidence/i.test(body) &&
    !/full market detail/i.test(body) && !/MACRO REGIME/i.test(body) && !/Data Health/i.test(body));
  // v3.95: the whys ARE reachable in Simple — one honestly-labelled expander under the
  // hero sentence, closed on a first visit, holding the chain and nothing technical.
  ok("v3.95 simple: the checks expander is present and CLOSED — label visible, no check statements",
    /why this call · 5 checks/i.test(body) && !/WHAT DROVE IT/.test(body));
  await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
  await page.waitForTimeout(250);
  const whysOpen = await page.locator("body").innerText();
  ok("v3.95 simple: one tap opens the five accountability checks",
    /WHY THIS CALL/.test(whysOpen) && /WHAT CHANGES IT/.test(whysOpen));
  /* FEAT-NFCILEV (8/29): the subindex MOVED to the macro strip — zero-tap, and out of the
     whys entirely (the chain narrates only the six voters). Driven live: the tile is on the
     strip, the whys never mention it, and it wears no voter marker. */
  {
    const strip = await page.locator(".macro-strip").innerText();
    ok("8/29 nfciLeverage: the LEV tile renders on the macro strip at glance altitude",
      /LEV/.test(strip) && /-0\.55/.test(strip) && /0 = avg/.test(strip));
    ok("8/29 nfciLeverage: it is NOT in the whys chain — the explanation layer stays six voters",
      !/Leverage subindex/i.test(whysOpen) && !/context, not a vote/i.test(whysOpen));
    const marked = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll(".macro-strip-inner > div")];
      const lev = tiles.find(t => /^LEV\b/m.test(t.innerText.trim()));
      return lev ? { txt: lev.innerText, title: lev.getAttribute("title") || "" } : null;
    });
    ok("8/29 nfciLeverage: the tile carries NO voter marker and says 'Context only — does not vote'",
      !!marked && !marked.txt.includes("\u25aa") && /Context only — does not vote/.test(marked.title));
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
    ok("v5.9 verdict: the sheet names all four calls and both machine words",
      /MOONING/.test(vsheet) && /HODL/.test(vsheet) && /DIAMOND HANDS/.test(vsheet) &&
      /CAN'T CALL IT/.test(vsheet) && /BULLISH/.test(vsheet) && /BEARISH/.test(vsheet));
    ok("v5.9 verdict: it says plainly what this is not — a backdrop read, not advice",
      /not a view on any one stock/.test(vsheet) && /not advice/.test(vsheet));
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
  // One tap to Power: the full view appears; the choice persists across reload.
  await page.locator("button", { hasText: "Power" }).click();
  await page.waitForTimeout(400);
  /* The CONTRAST that keeps the Simple-chrome assertion above from passing vacuously: the
     same fixture, one tap over, must actually SHOW what Simple dropped. A pin that only
     asserts an absence proves nothing if the thing was never going to render (the v3.60.1
     trap — and the negative control for this fix found exactly that on the alert badge). */
  {
    const pbody = await page.locator("body").innerText();
    ok("v5.9 chrome contrast: Power shows what Simple sheds — the wordmark echo and the OPS menu",
      (await page.locator(".sub-wordmark").count()) === 1 && /⋯ OPS/.test(pbody));
  }
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
    ok("dock: hiding it costs the public route nothing — the call still publishes",
      /MOONING|HODL|DIAMOND HANDS|CAN'T CALL IT/.test(body));
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
        n.children.length === 0 && /^●?\s*SPY\*?$/m.test(n.textContent || "") && n.getBoundingClientRect().height > 0);
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
    /\d+ of \d+ voters counted/i.test(driversClosed) && /factor evidence/i.test(driversClosed) &&
    !/as of \d{4}-\d{2}-\d{2}/.test(driversClosed));
  await page.locator('section[aria-labelledby="drivers"] button[aria-expanded]').click();
  await page.waitForTimeout(200);
  const drivers = await page.locator('section[aria-labelledby="drivers"]').innerText();
  ok("C3: the Evidence Matrix renders six factor cards with votes (one tap deep)",
    (drivers.match(/BULL|BEAR|NEUTRAL/g) || []).length >= 6 && /6 of 6 voters counted/i.test(drivers));
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
    /no live reading — not counted/.test(drivers) && /5 of 6 voters counted/i.test(drivers));
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
    /CPIAUCNS \+ CPILFENS/.test(macro) && /as of/i.test(macro));
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
  ok("v5.3 verdict: a bear tape reads DIAMOND HANDS / BEARISH, and risk factors lead the cards",
    /DIAMOND HANDS 🙌/.test(body) && /BEARISH/.test(body) && /HURTING/.test(body));
  await page.close();

  // 2. BULLISH.
  const bull = { ...FULL_LIVE, tenYearM1: -0.30, vix: 12, fearGreed: 78,
    cpiTrend: [3.4, 3.2, 3.0, 2.8, 2.6, 2.3], shillerPe: 19, nfci: -0.90 };
  ({ page, errors } = await open({ live: bull, width: 390, power: false }));
  await page.waitForTimeout(1300);
  body = await page.locator("body").innerText();
  ok("v5.3 verdict: a bull tape reads MOONING / BULLISH with supporting factors leading",
    /MOONING 🚀/.test(body) && /BULLISH/.test(body) && /HELPING/.test(body) &&
    /supportive/i.test(body));   // v4.0.1: the sentence names factors, supportive-side leading
  await page.close();

  // 3. DATA HOLD — below quorum. And the acceptance rule that matters most here: a withheld
  //    posture explains nothing and offers no flip, but says WHY it is withheld.
  ({ page, errors } = await open({ live: DEGRADED, width: 390, power: false }));
  await page.waitForTimeout(1300);
  body = await page.locator("body").innerText();
  ok("v5.3 verdict: below quorum reads CAN'T CALL IT / DATA HOLD, never a thin directional call",
    /CAN'T CALL IT 🌫️/.test(body) && /DATA HOLD/.test(body) && !/MOONING|DIAMOND HANDS/.test(body));
  /* 8/28 Whys altitude: a WITHHELD posture advertises no flip — the closed label is BARE
     (no ⇄ chip claiming a crossing that does not exist) and the withheld sentence travels
     INSIDE with the flip's slot. So the closed body must NOT carry it, and one tap must. */
  const whysToggleTxt = await page.locator("button.cg-toggle", { hasText: "why this call" }).innerText();
  ok("8/28 withheld: the closed whys label is bare — no flip chip on a call that was withheld",
    !/⇄/.test(whysToggleTxt) && /why this call · 5 checks/i.test(whysToggleTxt) &&
    !/Call withheld until/i.test(body));
  await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
  await page.waitForTimeout(200);
  const withheldOpen = await page.locator("body").innerText();
  ok("v4.0 withheld: no explanatory sentence, and the withheld sentence states the shortfall one tap deep",
    /Call withheld until the required evidence is current and usable/i.test(withheldOpen) &&
    !/are supportive|is working against|clearly supportive|clear lean right now/i.test(withheldOpen));
  await page.locator("button.cg-toggle", { hasText: "why this call" }).click();
  await page.waitForTimeout(150);
  ok("v4.0 withheld: cards still render only USABLE factors — a dead feed is never a card",
    !/HELPING|HURTING|MIXED/.test(body) || /\d+ cards from the \d+ voters counted/.test(body));
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
  ok("v5.9: Simple names the disagreement in the SENTENCE, with no count sub beside it",
    /are supportive, but stocks are priced for perfection/.test(band) &&
    !/help, prices do not/.test(band) && !/\d+ help, \d+ does not/.test(band));
  ok("8/29 ruler: the canned watch-VIX gloss is gone from a tape where VIX is helping",
    !/watch VIX/i.test(band) && !/Cross-signals/.test(band));
  const cards = await page.locator('[aria-label="Key parameters"]').innerText();
  ok("v5.9 ruler: the valuation card's CHIP carries the derived 26.1 edge beside the rich CAPE",
    /help <26\.1 · hurt >30/.test(cards) && !/1\.5× long-run mean/.test(cards));
  /* The owner's three named cards, measured on the tape they were read from: the ruler is a
     projection of REGIME_BAND_TABLE.ruler, so this proves the pass-through end to end rather
     than a string that happens to live in the bundle. */
  ok("v5.9 ruler: all three cards on the owner's tape carry their own edges, chip-length",
    /help <18 · hurt >25/.test(cards) && /help <26\.1/.test(cards) &&
    /cooler than last print/.test(cards));
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
    !/volatility/i.test(cardsText));
  ok("v4.0 cards: never padded with UNAVAILABLE placeholders — absence is not content",
    !/UNAVAILABLE/i.test(cardsText) && /\d+ cards from the \d+ voters counted/.test(cardsText));
  /* 8/28 matrix row 4: "showing 3 of 5 usable · 1 not counted" read as a coverage fraction
     under a hero saying "5 of 6" — neither number matched, and the 3 is a LAYOUT cap. The 3
     is now labelled as cards and the exclusion uses the hero's own word, "dark". */
  ok("v4.0 cards: the excluded factor is still ACKNOWLEDGED in the count line",
    /\d+ dark/.test(cardsText));
  ok("row 4: the layout cap is labelled as CARDS, never as a coverage fraction",
    /cards from the/.test(cardsText) && !/showing \d+ of \d+ usable/.test(cardsText));
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
  ok("public route: the footer NAMES the omission (a cut takes its attribution with it)",
    /operator view carries the curated watchlist and alert monitors/.test(pub));
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
    /10am frozen call/i.test(band) && /DIAMOND HANDS 🙌/.test(band) && /BEARISH/.test(band) &&
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
    /MacroDash (MOONING|HODL|DIAMOND HANDS), (BULLISH|NEUTRAL|BEARISH): \d of 6 voters counted\./.test(
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
    /\d+ bull · \d+ neutral · \d+ bear — \d+ of \d+ voters counted/.test(await band.innerText()) &&
    /would change this/i.test(await band.innerText()));
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
  ok("v4.0 history: direct route renders the frozen canonical call", /MOONING 🚀/.test(body) && /BULLISH/.test(body));
  ok("v4.0 history: live-forward and immutable contract is visible", /live-forward record/i.test(body) && /immutable call/i.test(body));
  ok("v5.5 history: mature 1d/5d/20d and fixed-window max drawdown render beneath the call",
    /\+1\.25%/.test(body) && /-2\.50%/.test(body) && /\+4\.00%/.test(body) && /-6\.75%/.test(body) &&
    /max DD final at 20 sessions/i.test(body));
  ok("v5.5 history: a not-yet-observed call renders pending fields without zeros",
    /awaiting first eligible close/i.test(body) && (body.match(/PENDING/g) || []).length >= 4);
  ok("v4.0 history: no horizontal overflow at 320px", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  ok("v4.0 history: no page errors", errors.length === 0);
  await page.close();
}
{
  const { page, errors } = await open({ live: FULL_LIVE, route: "/difference", power: false, width: 320 });
  await page.waitForTimeout(300);
  const body = await page.locator("body").innerText();
  ok("v4.0 difference: the positioning sentence renders", /Nowflation measures the inflation state\. MacroDash translates the entire macro state into risk posture\./.test(body));
  ok("v4.0 difference: the five-step hierarchy renders", ["Six factors","Evidence quality","Market posture","Explanation","Actionability"].every(x => body.includes(x)));
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

await browser.close();
srv.close();
console.log(`\n=== PUBLIC RENDER TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
