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
  nfci: -0.62, nfciAsOf: daysAgo(4),
  shillerPe: 31.2, shillerPeAsOf: daysAgo(20),
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
async function open({ live, status = 200, delayMs = 0, width = 1280, route = "/" }) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/api/snapshot*", async (r) => {
    if (delayMs) await new Promise((res) => setTimeout(res, delayMs));
    const st = typeof status === "function" ? status() : status;   // B1: flip-able stub
    if (st !== 200) return r.fulfill({ status: st, body: "upstream failure" });
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ live, cached: false, asOf: new Date().toISOString() }) });
  });
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
  const loadBody = await page.locator("body").innerText();
  ok("loading A1: the 5 Whys asserts NO mock core tape (no 'Core tape: SPY $…')",
    !/Core tape: SPY \$/.test(loadBody));
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
  ok("live: the flip line returns once there is a posture to flip", /would change this/i.test(band));
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
  const fg = page.locator('[title="Fear & Greed: NEUTRAL"]');
  ok("neutral: the F&G chip is labelled NEUTRAL, not bull/bear",
    await fg.count() === 1);
  ok("neutral: that chip carries the neutral glyph and NOT the bearish ▼ — the bug, as a test",
    await (async () => { const t = (await fg.first().innerText()).trim();
      return t.includes("•") && !t.includes("▼") && !t.includes("▲"); })());
  ok("neutral: a genuinely bearish factor still renders ▼ (no over-correction)",
    await page.locator('[title="Valuation: BEAR"]').count() === 1);
  const why = await page.locator('[aria-label="Why this posture"]').innerText();
  ok("why: the plain-language summary renders and names the neutral factor",
    /neutral/i.test(why) && /F&G/.test(why));
  ok("why: the four buckets are labelled",
    /SUPPORTS/.test(why) && /NEUTRAL/.test(why) && /ADDS RISK/.test(why) && /UNAVAILABLE/.test(why));
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
  const errBody = await page.locator("body").innerText();
  ok("error: the page still renders (graceful degradation holds — it never breaks)",
    errBody.length > 500);
  ok("error A1: the 5 Whys narrates no mock numbers after a failed fetch either",
    !/Core tape: SPY \$/.test(errBody) && /0\/3 core inputs usable/.test(errBody));
  ok("error: no page errors", errors.length === 0);
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
    /factors usable/i.test(driversClosed) && /factor evidence detail/i.test(driversClosed) &&
    !/as of \d{4}-\d{2}-\d{2}/.test(driversClosed));
  await page.locator('section[aria-labelledby="drivers"] button[aria-expanded]').click();
  await page.waitForTimeout(200);
  const drivers = await page.locator('section[aria-labelledby="drivers"]').innerText();
  ok("C3: the Evidence Matrix renders six factor cards with votes (one tap deep)",
    (drivers.match(/BULL|BEAR|NEUTRAL/g) || []).length >= 6 && /6\/6 factors usable/i.test(drivers));
  ok("C3: each card carries freshness and an as-of date",
    /LIVE/.test(drivers) && /as of \d{4}-\d{2}-\d{2}/.test(drivers));
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
  const body2 = await page.locator("body").innerText();
  ok("C4: an identical return visit names the device scope — 'since your previous visit on this device'",
    /no material change since your previous visit on this device \(\d{4}-\d{2}-\d{2}\)/.test(body2));
  // ── v3.69 NARRATIVE FIRST ─────────────────────────────────────────────────
  // (a) the 5 Whys renders in the overview region, BEFORE the market strip — the owner call
  // this release exists for. DOM order, not pixels: it must hold at every width.
  ok("v3.69: 5 Whys precedes the markets section in DOM order",
    await page.evaluate(() => {
      const whys = [...document.querySelectorAll("*")].find(n => n.childElementCount === 0 && /5 Whys · Today/.test(n.textContent || ""));
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
  ok("glance: the exclusion is visible while the matrix is closed (Signal Quality names it)",
    /5\/6 factors voting/i.test(closed) && /excluded: VIX/i.test(closed));
  await page.locator('section[aria-labelledby="drivers"] button[aria-expanded]').click();
  await page.waitForTimeout(200);
  const drivers = await page.locator('section[aria-labelledby="drivers"]').innerText();
  ok("C3: an excluded factor is NAMED with its reason on the card itself",
    /EXCLUDED/.test(drivers) && /excluded — not live in a live build/.test(drivers) &&
    /5\/6 factors usable/i.test(drivers));
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
  ok("operator route: TERMINAL link is reachable by opening the OPS menu",
    await (async () => {
      await page.locator("details.hdr-ops > summary").click();
      await page.waitForTimeout(150);
      const link = page.locator('details.hdr-ops a[href="/admin.html"]');
      return await link.count() === 1 && await link.isVisible();
    })());
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
    await page.locator('[aria-label="Signal quality and backdrop confidence"]').count() === 1);
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
  ok("slice1 @375px: the confidence tally and flip sentence ride inside that region",
    /of \d+ usable/.test(await band.innerText()) && /would change this/i.test(await band.innerText()));
  const body = await page.locator("body").innerText();
  ok("slice1 @375px: the extracted 5 Whys narrative renders (WHY #1–#5 present)",
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

await browser.close();
srv.close();
console.log(`\n=== PUBLIC RENDER TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
