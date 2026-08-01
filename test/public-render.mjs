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
function findChromium() {
  const direct = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (direct) return existsSync(direct) ? direct : null;
  const roots = process.env.PLAYWRIGHT_BROWSERS_PATH
    ? [process.env.PLAYWRIGHT_BROWSERS_PATH]
    : ["/opt/pw-browsers"];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root)) {
      if (!dir.startsWith("chromium-")) continue;
      for (const rel of ["chrome-linux/chrome", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) {
        const p = `${root}/${dir}/${rel}`;
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}
const skip = (why) => {
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
async function open({ live, status = 200, delayMs = 0, width = 1280 }) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/api/snapshot*", async (route) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (status !== 200) return route.fulfill({ status, body: "upstream failure" });
    route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ live, cached: false, asOf: new Date().toISOString() }) });
  });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });
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

// ── 3. DEGRADED — below quorum, no thin verdict ─────────────────────────────
console.log("\n[public] DEGRADED — below-quorum evidence yields INSUFFICIENT");
{
  const { page, errors } = await open({ live: DEGRADED });
  await page.waitForTimeout(1200);
  const band = await bandText(page);
  const body = await page.locator("body").innerText();
  ok("degraded: the posture is withheld, not computed from what survived",
    /INSUFFICIENT/i.test(band) && !POSTURES.test(band));
  ok("degraded: the band names how much evidence is missing",
    /only 3 of 6 factors usable/i.test(band) && /4 required/i.test(band));
  ok("degraded: the confidence strip states the withhold too",
    /POSTURE WITHHELD/i.test(body));
  ok("degraded: it explains that the mock baseline is deliberately NOT voting",
    /mock baseline is NOT voting/i.test(band));
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
    /INSUFFICIENT|CAN'T CALL IT/i.test(band));
  ok("error: the page still renders (graceful degradation holds — it never breaks)",
    (await page.locator("body").innerText()).length > 500);
  ok("error: no page errors", errors.length === 0);
  await page.close();
}

// ── 5. Responsive + a11y basics on the live state ───────────────────────────
console.log("\n[public] responsive + a11y on the published state");
for (const width of [320, 390, 1280]) {
  const { page, errors } = await open({ live: FULL_LIVE, width });
  await page.waitForTimeout(1200);
  ok(`${width}px: no horizontal overflow`,
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  ok(`${width}px: no page errors`, errors.length === 0);
  await page.close();
}
{
  const { page } = await open({ live: FULL_LIVE });
  await page.waitForTimeout(1200);
  ok("a11y: exactly one main landmark", await page.locator('[role="main"]').count() === 1);
  ok("a11y: the verdict and confidence regions announce politely",
    await page.locator('[aria-live="polite"]').count() >= 2);
  await page.close();
}

await browser.close();
srv.close();
console.log(`\n=== PUBLIC RENDER TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
