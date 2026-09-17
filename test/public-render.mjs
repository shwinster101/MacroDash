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
  ok("T2/T3 simple: the Glance layer renders — one plain call, sentence, cards, key numbers; coverage is one tap deep",
    /Bullish|Hold|Bearish|Not enough data/.test(body) &&
    /(support taking risk|against risk|has a majority|short of a majority|clear lean)/i.test(body) &&   // T1: holdReason (v6.6.1 posture vocabulary), not the lecture sentence
    /HELPING|HURTING|MIXED/.test(body) && /SPY/.test(body) &&
    !/\d+ of \d+ signals counted/.test(await page.locator('[aria-label="Macro backdrop verdict"]').innerText()) &&
    !/\d+ cards from the \d+ signals counted/.test(await page.locator('[aria-label="Key parameters"]').innerText()));
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
    /HELPING|HURTING|MIXED/.test(body) && !/discount rate on every future dollar/.test(body) &&
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
  ok("v4.0.4 simple: the 10Y card shows the LEVEL its label names, with the voted delta as context",
    (() => { const t = cardsInner;
      return /4\.46%/.test(t) && /-0\.22pp 1-mo/.test(t) &&
        t.indexOf("4.46%") < t.indexOf("-0.22pp"); })());
  ok("v4.0 simple: the v3.97 prose no longer renders (the cards replaced it)",
    !/The bull case right now:/.test(body) && !/The bear case:/.test(body));
  ok("v3.97 simple: no picks feed → the strip renders NOTHING, never example picks",
    !/My S-Tier/i.test(body) && !/not investment advice/i.test(body));
  ok("simple: Layer 2/3 content is NOT in the DOM — the Degen reasoning group, factor evidence, market detail, macro grid",
    !/the reasoning/i.test(body) && !/factor evidence/i.test(body) &&
    !/full market detail/i.test(body) && !/MACRO REGIME/i.test(body) && !/Data Health/i.test(body));
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
    const strip = await page.locator(".macro-strip").innerText();
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
    ok("v5.9 chrome contrast: Degen shows what Simple sheds — the wordmark echo and the OPS menu",
      (await page.locator(".sub-wordmark").count()) === 1 && /⋯ OPS/.test(pbody));
    const tape = await page.locator(".spy-tape-mobile").textContent();
    ok("v6.4 tape: Degen labels SPY's session move without borrowing moon vocabulary",
      /(TODAY|LAST) SPY\s*FLAT/.test(tape || "") &&
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
    /\d+ of \d+ signals counted/i.test(driversClosed) && /factor evidence/i.test(driversClosed) &&
    !/as of \d{4}-\d{2}-\d{2}/.test(driversClosed));
  await page.locator('section[aria-labelledby="drivers"] button[aria-expanded]').click();
  await page.waitForTimeout(200);
  const drivers = await page.locator('section[aria-labelledby="drivers"]').innerText();
  ok("C3: the Evidence Matrix renders six factor cards with votes (one tap deep)",
    (drivers.match(/BULL|BEAR|NEUTRAL/g) || []).length >= 6 && /6 of 6 signals counted/i.test(drivers));
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
  await page.locator('section[aria-labelledby="drivers"] button[aria-expanded]').click();
  await page.waitForTimeout(200);
  const drivers = await page.locator('section[aria-labelledby="drivers"]').innerText();
  // v3.98.3: the reason is retailed AND the card now shows the real cause — a dead feed
  // says "no live reading", never the stale wording the hero used to hardcode.
  ok("C3: an excluded factor is NAMED with its real reason on the card itself",
    /EXCLUDED/.test(drivers) && /excluded — no live feed right now/.test(drivers) &&
    /no live reading — not counted/.test(drivers) && /5 of 6 signals counted/i.test(drivers));
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
    /Bearish/.test(body) && /HURTING/.test(body) && !/DIAMOND HANDS|\bBEARISH\b/.test(body));
  await page.close();

  // 2. BULLISH.
  const bull = { ...FULL_LIVE, tenYearM1: -0.30, vix: 12, fearGreed: 78,
    cpiTrend: [3.4, 3.2, 3.0, 2.8, 2.6, 2.3], shillerPe: 19, nfci: -0.90 };
  ({ page, errors } = await open({ live: bull, width: 390, power: false }));
  await page.waitForTimeout(1300);
  body = await page.locator("body").innerText();
  ok("v6.4 Simple verdict: a bull tape reads Bullish with supporting factors leading",
    /Bullish/.test(body) && /HELPING/.test(body) && !/MOONING|\bBULLISH\b/.test(body) &&
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
    (await page.locator(".simple-card", { hasText: /unavailable/i }).count()) === 0);
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
     side has a majority. Measured live: "Vol and inflation help. Prices hurt. Neither side
     has a majority." on this tape (vix + cooling CPI helping, rich CAPE hurting). */
  ok("v5.9: Simple names the disagreement in the SENTENCE, with no count sub beside it",
    /help\./.test(band) && /hurt\./.test(band) && /Neither side has a majority/.test(band) &&
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
  ok("T3/T6 sheet: tapping a card surfaces as-of + the ruler chip that left the face",
    /As of /.test(sheet) && /Rule: help <26\.1 · hurt >30/.test(sheet));
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
  ok("T3 cards: never padded with unavailable placeholders — absence is not a card, and the footer is gone",
    (await page.locator(".simple-card", { hasText: /unavailable/i }).count()) === 0 &&
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
    /about this page — v\d+\.\d+\.\d+ · sources · not financial advice/i.test(pub));
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
    /\d+ bull · \d+ neutral · \d+ bear — \d+ of \d+ signals counted/.test(await band.innerText()) &&
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
    // v6.3: the tile's last child is the sheet button now; the sub-line carries its own class.
    return getComputedStyle(cell.querySelector(".strip-sub")).color;
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
    return getComputedStyle(cell.querySelector(".strip-sub")).color;   // v6.3: by class (see above)
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
  /* v6.6 RE-PIN: this read a hardcoded 9, which was the default-set size on the day it was
     written and went red the moment v6.6 added the three policy alerts — a correct addition
     failing a test that was measuring a COUNT rather than the property. The property is
     "garbage restores the WHOLE default set", so the expected number is now DERIVED from
     DEFAULT_ALERTS itself (the SOURCES/DERIVED_OF reconciliation convention): a later alert
     arrives without touching this pin, while a default that silently fails to render still
     turns it red. */
  ok("v6.0 persist: garbage in the store falls back to the DEFAULTS — every monitor returns",
    (await page.locator('button[aria-label^="Toggle alert"]').count())
      === (await import("../src/alertEngine.js")).DEFAULT_ALERTS.length &&
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
  const GREEN = rgb("#2ecc71"), AMBER = rgb("#f0a500");
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
  ok("v6.0.1 cards: every card LEADS with a direction glyph (▲/▼/•) that is the first thing in the row",
    cards.length === 3 && cards.every((c) => c.glyphClass === "simple-card-glyph" && /^[▲▼•]$/.test(c.glyph)));
  ok("v6.0.1 cards: the glyph and the 3px left bar carry the direction colour (green helping, red hurting)",
    cards.every((c) => c.bar === "3px" && c.barColor === c.glyphColor) &&
    cards.some((c) => c.glyph === "▲" && c.glyphColor === GREEN) &&
    cards.some((c) => c.glyph === "▼" && c.glyphColor === rgb("#e74c3c")));
  // The harness serves `cached:false`, so the mode here is LIVE; the rule is one filled green
  // dot for EITHER live or cached, the word on the title + a11y span only (never on the face).
  ok("T3 cards: freshness WORD is a11y-only — no date, ruler, or freshness dot on the face",
    cards.every((c) => c.dotBg === null) &&
    cards.every((c) => !/live|cached/.test(c.visible) && /live|cached/.test(c.hidden)) &&
    cards.every((c) => !/help <|hurt >|As of /.test(c.visible)));
  ok("v6.0.1 cards: the direction WORD still confirms the shape at the row's end (HELPING/HURTING survive)",
    cards.every((c) => /HELPING|HURTING|MIXED/.test(c.visible)));
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
  ok("v6.4 toggle: Simple is pressed and FILLED amber with dark text; Degen is transparent — legible at a glance",
    tog.length === 2 && tog[0].pressed === "true" && tog[0].bg === AMBER && tog[0].color === rgb("#08090b") &&
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
  ok("T8 hero: Simple has no ℹ — copy is 13px on the Hold row; Hold ⓘ is the clock",
    (await page.locator('button[aria-label="Show regime factors"]').count()) === 0 &&
    await page.locator('button[aria-label="Copy MacroDash posture card"]').evaluate((n) => getComputedStyle(n).fontSize) === "13px");
  await page.locator(".simple-hold").click();
  await page.waitForTimeout(200);
  const cap = await page.locator('[role="dialog"]').innerText();
  ok("T8 captions (Simple): ONE tap on Hold opens the sheet, and the caption is there with the capture date",
    new RegExp(`frozen 10am call · captured 10:00 ET · ${TODAY}`).test(cap));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  // The budgets this pass must not spend: the strip and the cards stay where v5.9 put them.
  const [glance, cardsTop] = await page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((n) => n.children.length === 0 && /^●?\s*SPY\*?$/m.test(n.textContent || "") && n.getBoundingClientRect().height > 0);
    const k = document.querySelector('[aria-label="Key parameters"]');
    return [el ? Math.round(el.getBoundingClientRect().top + scrollY) : null, k ? Math.round(k.getBoundingClientRect().top + scrollY) : null]; });
  ok(`v6.0.1 budgets: the cards begin within 420px and the strip within 660px with the window closed (measured ${cardsTop} / ${glance})`,
    cardsTop !== null && cardsTop <= 420 && glance !== null && glance <= 660);
  /* v6.0.2: every voting tile's ▪ wears its VOTE colour (this tape is all-bull → all green),
     and it is the same colour its vote-coloured sub-line wears where one exists (F&G, NFCI). */
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
    const value = card && [...card.querySelectorAll("span")].find((n) => getComputedStyle(n).fontWeight === "600");
    const label = card && [...card.querySelectorAll("span")].find((n) => !n.classList.contains("simple-card-glyph") && !n.classList.contains("visually-hidden") && getComputedStyle(n).fontWeight !== "600" && getComputedStyle(n).fontWeight !== "700" && (n.textContent || "").trim().length > 1);
    return {
      hold: holdSpan ? getComputedStyle(holdSpan).fontSize : null,
      card: value ? getComputedStyle(value).fontSize : null,
      label: label ? getComputedStyle(label).fontSize : null,
      holdText: holdSpan ? holdSpan.textContent.trim() : null,
      cardText: value ? value.textContent.trim() : null,
    };
  });
  ok(`T7 type (Simple): Hold is 28px, card values 16px, labels 11px (measured hold=${typePx.hold} value=${typePx.card} label=${typePx.label} «${typePx.holdText}» «${typePx.cardText}»)`,
    typePx.hold === "28px" && typePx.card === "16px" && typePx.label === "11px");
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
  ok("v6.4 toggle (Degen): the fill follows the choice — Degen is now the amber half",
    (await page.locator('button[aria-pressed="true"]').evaluate((n) => [n.innerText.replace(/\s+/g, " ").trim(), getComputedStyle(n).backgroundColor].join("|"))) === `◉ Degen|${AMBER}`);
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
    ok("v6.4 hero: the evening update owns the drift slot",
      !/Current evidence now reads/.test(band) && (await page.locator('[aria-label="Macro backdrop verdict"] .close-read').count()) === 1);
    colorDiffers = await page.locator('[aria-label="Macro backdrop verdict"] .close-read').evaluate((n) => getComputedStyle(n).color);
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
    const agreeColor = await page.locator('[aria-label="Macro backdrop verdict"] .close-read').evaluate((n) => getComputedStyle(n).color);
    ok("v6.2 hero: an agreeing close read still renders the line, MUTED — a different colour from the disagreeing one",
      DEGEN_LINE.test(await bandText(page)) && agreeColor !== colorDiffers);
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
      const el = [...document.querySelectorAll("*")].find((n) => n.children.length === 0 && /^●?\s*SPY\*?$/m.test(n.textContent || "") && n.getBoundingClientRect().height > 0);
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
console.log("\n[public] v6.3 — eight sheets on the macro strip (Power, Simple, a dark voter)");
{
  const { page, errors } = await open({ live: FULL_LIVE });
  await page.waitForTimeout(1200);
  const tiles = page.locator(".macro-strip-inner > div");
  const trigger = (i) => tiles.nth(i).locator('button[aria-haspopup="dialog"]');
  ok("v6.3 strip: all EIGHT tiles carry a dialog trigger, and nothing is open until one is tapped",
    (await page.locator('.macro-strip-inner button[aria-haspopup="dialog"]').count()) === 8 &&
    (await page.locator('[role="dialog"]').count()) === 0);
  // SPY* — a context tile with the new copy.
  await trigger(0).click();
  await page.waitForTimeout(250);
  const dlg = page.locator('[role="dialog"]');
  const spyBody = await dlg.innerText();
  ok("v6.3 SPY* sheet: the official name as the title, exactly 3 bullets, the proxy stated, and the eyebrow carrying the tile's OWN reading + CONTEXT ONLY",
    /S&P 500 Index/.test(await page.locator("#factsheet-title").innerText()) && (await dlg.locator("li").count()) === 3 &&
    /SPY\* · \$748\.1 · CONTEXT ONLY/i.test(spyBody) && /÷ 10 from FRED/.test(spyBody) && /six-signal model does not read/.test(spyBody));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("v6.3 SPY* sheet: Escape closes it and focus lands back on the SPY tile",
    (await page.locator('[role="dialog"]').count()) === 0 &&
    await page.evaluate(() => !!document.activeElement && document.activeElement.getAttribute("aria-haspopup") === "dialog" && /SPY\*/.test(document.activeElement.innerText)));
  // VIX — a voter tile: the SAME sheet the Simple card opens (one home, proven on the wire).
  await trigger(2).click();
  await page.waitForTimeout(250);
  const vixBody = await dlg.innerText();
  ok("v6.4 VIX sheet: the band's own sheet — same title as the card's, the band's own bullet, and the eyebrow says SIGNAL BULL",
    (await page.locator("#factsheet-title").innerText()) === "Cboe Volatility Index (VIX)" &&
    /The teens are calm/.test(vixBody) && /VIX · 16\.1 · SIGNAL BULL/i.test(vixBody));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  // FED — the target range is live in this fixture.
  await trigger(5).click();
  await page.waitForTimeout(250);
  const fedBody = await dlg.innerText();
  /* v6.6 RE-PIN: the eyebrow gained the optional POLICY MARKER between the tile's reading
     and its vote clause, so the two were no longer adjacent. Matching them as adjacent also
     made this pin quietly CALENDAR-DEPENDENT — it would pass on an ordinary day and fail on
     any FOMC decision day, which is the v3.35/v3.80 rotting-fixture defect. It now pins the
     load-bearing property instead: whatever the tile reports, a CONTEXT tile's eyebrow still
     ENDS in "context only", so a marker can never read as a vote this tile does not cast. */
  ok("v6.3 FED sheet: the target range's official name, the tile's own range reading, and both readings named in the body",
    /Federal Funds Rate Target Range/.test(await page.locator("#factsheet-title").innerText()) &&
    /FED · 3\.50–3\.75%[^\n]*· CONTEXT ONLY/i.test(fedBody) && /effective average/.test(fedBody) && /lags a decision/.test(fedBody));
  /* v6.6 — the marker itself, driven live. DERIVED from the calendar rather than hardcoded
     (the v3.99.1 convention two pins down), so it survives the table rolling forward: on a
     decision day the tile must SAY the meeting is today, and on any other day it must fall
     back to the countdown and claim no event at all. */
  ok("v6.6 FED marker: on a decision day the tile reports the MEETING; on any other day it renders no event",
    await (async () => {
      const { FOMC_MEETINGS, etYmd } = await import("../src/sources.js");
      const decisionDay = FOMC_MEETINGS.includes(etYmd());
      /* Scoped to the EYEBROW line, not the sheet body. The first draft swept the whole body
         for an outcome word and went red against correct code: FED_EXPLAIN's own third
         bullet says "a surprise cut or hike", so the pin was reading the explainer's prose as
         a claim the marker had made — the v5.10.0 defect of asserting the wrong object. */
      const eyebrow = fedBody.split("\n").find((l) => /FED\s·/i.test(l)) || "";
      return decisionDay
        ? /FOMC today/i.test(eyebrow) && !/HIKED|\bCUT\b/i.test(eyebrow)
        : !/FOMC today/i.test(eyebrow);
    })());
  await page.locator("button.fs-close").click();
  await page.waitForTimeout(200);
  // NFCI — the 8th tile, a voter reading bull on this tape.
  await trigger(7).click();
  await page.waitForTimeout(250);
  ok("v6.4 NFCI sheet: the 8th tile opens the NFCI band's sheet with its signal state in the eyebrow",
    /Chicago Fed National Financial Conditions Index/.test(await page.locator("#factsheet-title").innerText()) &&
    /NFCI · -0\.62 · SIGNAL BULL/i.test(await dlg.innerText()));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("v6.3 strip (Power): the hover tooltips survive beside the sheets — three vote states, verbatim",
    /Context only — does not affect the call\./.test(await tiles.nth(0).getAttribute("title")) &&
    /Counts toward today's posture — signal is BULL\./.test(await tiles.nth(2).getAttribute("title")));
  ok("v6.3 strip (Power): no page errors through four sheets", errors.length === 0);
  await page.close();
}
{
  // An unavailable signal: the eyebrow must say so, never claim a state.
  const { page } = await open({ live: DEGRADED });
  await page.waitForTimeout(1200);
  await page.locator(".macro-strip-inner > div").nth(7).locator('button[aria-haspopup="dialog"]').click();
  await page.waitForTimeout(250);
  ok("v6.4 sheet: an unavailable signal opens its sheet with 'unavailable today' in the eyebrow",
    /NFCI · .* · UNAVAILABLE TODAY/i.test(await page.locator('[role="dialog"]').innerText()) &&
    !/SIGNAL (BULL|BEAR|NEUTRAL)/i.test(await page.locator('[role="dialog"]').innerText()));
  await page.keyboard.press("Escape");
  await page.close();
}
{
  // Simple at 390×844: the same eight triggers, a real phone thumb target, the budgets held.
  const { page, errors } = await open({ live: FULL_LIVE, width: 390, power: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  ok("v6.3 strip (Simple): all eight tiles are sheet triggers and each wears the ⓘ affordance",
    (await page.locator('.macro-strip-inner button[aria-haspopup="dialog"]').count()) === 8 &&
    ((await page.locator(".macro-strip-inner").innerText()).match(/ⓘ/g) || []).length === 8);
  const heights = await page.evaluate(() => [...document.querySelectorAll(".macro-strip-inner .strip-tile")].map((b) => Math.round(b.getBoundingClientRect().height)));
  ok(`v6.3 strip (Simple): every tile button is a ≥44px thumb target at 390px (measured ${Math.min(...heights)}–${Math.max(...heights)})`,
    heights.length === 8 && heights.every((h) => h >= 44));
  await page.locator(".macro-strip-inner > div").nth(4).locator('button[aria-haspopup="dialog"]').click();   // 10Y
  await page.waitForTimeout(250);
  ok("v6.3 sheet (Simple): the 10Y tile opens the 10Y band's sheet, centred and inside the phone viewport",
    (await page.locator("#factsheet-title").innerText()) === "10-Year U.S. Treasury Yield" &&
    await page.evaluate(() => { const r = document.querySelector('[role="dialog"]').getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth; }));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const [glance, cardsTop] = await page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((n) => n.children.length === 0 && /^●?\s*SPY\*?$/m.test(n.textContent || "") && n.getBoundingClientRect().height > 0);
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
    ok("v6.5 Simple: both company names and tickers and the comparison label (week is Degen-only)",
      /Nebius Group/.test(text) && /NBIS/.test(text) && /Microsoft/.test(text) && /MSFT/.test(text) && /Established growth/.test(text) && !/week of/.test(text));
    ok("T4 Simple face: name + YTD + one quality stat; market cap, multiples and the summary are NOT on the face",
      (text.match(/[+−]\d+\.\d\d%/g) || []).length >= 2 &&
      !/\$70\.1B/.test(text) && !/\$3\.41T/.test(text) && !/MARKET CAP/i.test(text) &&
      !/as of \d{4}-\d{2}-\d{2}/.test(text) && !/REVENUE GROWTH/i.test(text) &&
      !/OPERATING MARGIN/i.test(text) && !/FREE CASH FLOW/i.test(text) &&
      !/trailing revenue/i.test(text) && !/12\.5×/.test(text) &&
      !/BUSINESS ·/.test(text) && !/WATCH NEXT ·/.test(text) &&
      (await r.locator('[aria-label="Full assessment"]').count()) === 0);
    ok("v6.5 Simple: YTD numbers for both — no `through` crumbs on the face, no price-return caveat",
      (await r.locator('[aria-label$=" profile"]', { hasText: "YTD" }).count()) === 2 && !/PRICE RETURN/i.test(text) &&
      !/through \d{4}-\d{2}-\d{2}/.test((await r.locator('[aria-label$=" profile"]').allInnerTexts()).join("\n")));
    ok("v6.5 Simple (density review): NO blurb on the face; the dates and the blurb live one tap deep",
      !/rents out AI computing capacity/.test(text) && !/Sells software and cloud computing/.test(text));
    ok("T4 Simple chart: title is ticker vs ticker YTD; two lines, a zero reference; no from-through essay",
      (await r.locator(".recharts-line").count()) === 2 && (await r.locator(".recharts-reference-line").count()) === 1 &&
      /NBIS vs MSFT YTD/.test(text) && !/YTD COMPARISON/.test(text) && !/from 2025-12-31/.test(text));
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
    await r.locator("button.cg-toggle", { hasText: "Explore the numbers" }).click();
    await page.waitForTimeout(300);
    const opened = await r.innerText();
    ok("T4 Simple: 'Explore the numbers' opens the dates & blurbs, market caps, the FULL three-question assessment and the supporting analysis for BOTH companies, the worked example and dated sources",
      (await r.locator('[aria-label$="data notes"]').count()) === 2 && /as of \d{4}-\d{2}-\d{2}/.test(opened) && /YTD through \d{4}-\d{2}-\d{2}/.test(opened) && /rents out AI computing capacity/.test(opened) &&
      /\$70\.1B/.test(opened) && /\$3\.41T/.test(opened) &&
      /Explore the numbers/.test(text) && !/Explore the numbers — /.test(text) &&
      (await r.locator('[aria-label="Full assessment"]').count()) === 2 && /BUSINESS ·/.test(opened) && /WATCH NEXT ·/.test(opened) &&
      (await r.locator('[aria-label$="supporting analysis"]').count()) === 2 && /Worked example/.test(opened) && /CALCULATION INPUTS/.test(opened) && /sec\.gov/.test(opened) && /YTD method/.test(opened));
    ok("v6.5 Simple: no rating words on the face", !/\b(cheap|safe|buy|sell|undervalued|overvalued)\b/i.test(opened));
    const [glance, cardsTop] = await page.evaluate(() => {
      const el = [...document.querySelectorAll("*")].find((n) => n.children.length === 0 && /^●?\s*SPY\*?$/m.test(n.textContent || "") && n.getBoundingClientRect().height > 0);
      const k = document.querySelector('[aria-label="Key parameters"]');
      return [el ? Math.round(el.getBoundingClientRect().top + scrollY) : null, k ? Math.round(k.getBoundingClientRect().top + scrollY) : null]; });
    ok(`v6.5 budgets: the macro first screen is untouched — cards within 420px and the strip within 660px at 390×844 (measured ${cardsTop} / ${glance})`,
      cardsTop !== null && cardsTop <= 420 && glance !== null && glance <= 660);
    ok("v6.5 Simple: 390px stays overflow-free with the chart in place, no page errors",
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) && errors.length === 0);
    // The full three-question text lives one tap deep in Simple (`opened`), on the face in Degen.
    simpleFace = { caps: opened.match(/\$\d+\.\d+[TB]/g), ytd: text.match(/[+−]\d+\.\d\d%/g), business: (opened.match(/BUSINESS · [^\n]+/g) || []) };
    await page.close(); }
  // 3. DEGEN at 1280px — the analysis is visible; only the sources collapse; IDENTICAL values.
  { const { page, errors } = await open({ live: FULL_LIVE, width: 1280, power: true, spotlight: feed });
    await page.waitForTimeout(1600);
    const r = region(page);
    const text = await r.innerText();
    ok("v6.5 Degen (density review): the blurb, the `as of`/`through` dates and the period crumbs stay ON the face — Degen is the 10-K",
      /rents out AI computing capacity/.test(text) && /as of \d{4}-\d{2}-\d{2}/.test(text) && /through \d{4}-\d{2}-\d{2}/.test(text) && /quarter to \d{4}-\d{2}-\d{2}/.test(text));
    ok("v6.5 Degen: the supporting analysis (cash, debt, cap ÷ TTM revenue, P/E, shares, price trend, run-rate, inputs) is visible with NO click, plus the worked example",
      (await r.locator('[aria-label$="supporting analysis"]').count()) === 2 && /CAP ÷ TTM REVENUE/i.test(text) && /TRAILING P\/E/i.test(text) && /PRICE TREND/i.test(text) &&
      /RUN-RATE VS TTM/i.test(text) && /CALCULATION INPUTS/.test(text) && /Worked example/.test(text) && /33\.4×/.test(text));
    ok("v6.5 Degen: NBIS's negative trailing earnings read 'no P/E' — never a negative multiple", /trailing earnings are negative — no P\/E/.test(text) && !/-\d+\.\d×/.test(text));
    ok("v6.5 Degen: sources are the one collapsed disclosure; opening it lists dated sec.gov citations",
      (await r.locator('[aria-label="Sources and calculations"]').count()) === 0 && await (async () => {
        await r.locator("button.cg-toggle").first().click(); await page.waitForTimeout(250);
        const t = await r.innerText(); return (await r.locator('[aria-label="Sources and calculations"]').count()) === 1 && /sec\.gov/.test(t) && /filed \d{4}-\d{2}-\d{2}/.test(t); })());
    const degenFace = { caps: text.match(/\$\d+\.\d+[TB]/g), ytd: text.match(/[+−]\d+\.\d\d%/g), business: (text.match(/BUSINESS · [^\n]+/g) || []) };
    ok("v6.5 both modes: IDENTICAL market caps, YTD values and assessments (one model, two altitudes)",
      simpleFace && JSON.stringify(simpleFace.caps.slice(0, 2)) === JSON.stringify(degenFace.caps.slice(0, 2)) &&
      JSON.stringify(simpleFace.ytd.slice(0, 2)) === JSON.stringify(degenFace.ytd.slice(0, 2)) && JSON.stringify(simpleFace.business) === JSON.stringify(degenFace.business));
    ok("v6.5 Degen: no page errors", errors.length === 0);
    await page.close(); }
  // 4. UNAVAILABLE + STALE — a missing cap, a missing anchor series, a 12-day-old tape.
  { const bad = makeSpotlightFixture({ stale: true, capMissing: true, anchorSeriesMissing: true });
    const { page, errors } = await open({ live: FULL_LIVE, width: 390, power: false, spotlight: { schema: "md-spotlight-v1", enabled: true, model: bad.projected } });
    await page.waitForTimeout(1600);
    const r = region(page);
    const text = await r.innerText();
    ok("T4 unavailable (Simple face): a missing market cap is NOT on the face (it rides Explore); the other company still shows YTD; never a zero",
      !/Unavailable · no market cap/.test(text) && !/Unavailable — profile carries no market capitalization/.test(text) &&
      !/\$3\.41T/.test(text) && !/\$0/.test(text) && /Unavailable/.test(text));
    ok("v6.5 unavailable: the missing anchor series is NAMED on the chart and the comparison line still plots alone",
      /NBIS series unavailable/.test(text) && (await r.locator(".recharts-line").count()) === 1 && /Unavailable(?! —)/.test(text));
    ok("T4 unavailable: the FULL reasons survive verbatim one tap deep in Explore",
      await (async () => {
        await r.locator("button.cg-toggle", { hasText: "Explore the numbers" }).click(); await page.waitForTimeout(250); const o = await r.innerText();
        return /Unavailable — market cap: profile carries no market capitalization/.test(o) && /Unavailable — YTD: return series unavailable/.test(o) && /\$3\.41T/.test(o); })());
    ok("v6.5 stale: market data 12 days behind wears STALE; the price-trend clause is suppressed, not graded (one tap deep)",
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
      !/\+\d+\.\d\d%/.test(text) && !/\$3\.41T/.test(text) && errors.length === 0);
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
    /Hold/.test(face) && /HELPING|HURTING/.test(cards) &&
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
  ok("T6 tap card: sheet has as-of + ruler",
    /As of /.test(cardSheet) && /Rule: /.test(cardSheet));
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

await browser.close();
srv.close();
console.log(`\n=== PUBLIC RENDER TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);


await browser.close();
srv.close();
console.log(`\n=== PUBLIC RENDER TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
