// FEAT-TT-RENDER (v3.31) — browser render test for public/admin.html.
//
// WHY THIS EXISTS: admin.html is buildless, so test/smoke.mjs can only pin load-bearing
// STRINGS at source. That catches deletions; it cannot catch a strip that renders empty, a
// drawer that hides a red thing, a click that goes nowhere, or a template literal that
// throws at runtime. This harness serves the real file with a stubbed API and drives it in
// Chromium at phone and desktop widths.
//
// INVARIANT: the fixture is SYNTHETIC. No real ticker, position, cluster or session content
// belongs in this repo — the same rule that keeps SEED, BOARD and the framework doc empty.
//
// Run: npm run test:ui   (skips cleanly, exit 0, when no Chromium is available)

import http from "node:http";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const ADMIN = new URL("../public/admin.html", import.meta.url);
const PORT = 8791;

// ── locate a browser, or skip ───────────────────────────────────────────────
function findChromium() {
  // An explicit path is honoured only if it EXISTS — trusting it blindly turns a typo into
  // a launch stack trace instead of the clean skip this function is for.
  const direct = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (direct) return existsSync(direct) ? direct : null;
  // An explicitly set browsers path WINS outright. Quietly supplementing it with the
  // hardcoded fallback would mean the env var could never express "look nowhere else".
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
  console.log(`\n=== RENDER TEST: SKIPPED — ${why} ===`);
  console.log("    (source guards in test/smoke.mjs still ran; this suite is additive)");
  process.exit(0);
};
let chromium;
try { ({ chromium } = await import("playwright-core")); }
catch (_e) { skip("playwright-core is not installed (npm i)"); }
const exe = findChromium();
if (!exe) skip("no Chromium found — set PLAYWRIGHT_CHROMIUM_PATH or PLAYWRIGHT_BROWSERS_PATH");

// ── synthetic fixture ───────────────────────────────────────────────────────
// AAA is deliberately over the single-name cap; AAA+BBB+CCC exceed the cluster cap; FFF
// carries short calls so the deleverage blocker has something real to verify against.
const dd = (px, rev, eps, extra = {}) => ({
  thesis_version: "v1.0 (2026-07-20)", updated: "2026-07-26",
  ref_px: { px, at: "2026-07-28" },
  consensus: { revenue_B: rev, eps },
  pt_model: { ev_s_multiple: 8, share_count_M: 1100, pe_floor_multiple: 18 },
  hinges: [{ label: "demand", state: "red", note: "supplier layer" }],
  key_dates: [{ date: "2026-08-20", label: "own print" }],
  gates: [{ name: "G1 scale", status: "PASS" }, { name: "G2 funding", status: "FAIL" }],
  kill_combination: { conditions: ["demand stalls", "funding shuts"], joint_probability: "8%" },
  rules: ["never average down into a broken base"],
  capital: { runway_q: 6 },
  leading_indicators: { bookings: "up" },
  some_unknown_block: { alpha: 1, beta: 2 },
  ...extra,
});
const POS = (sh, mv, pct, extra = {}) => ({ sh, mv, pct, at: "2026-07-28T14:32:00Z", src: "test", ...extra });
const BOOK = [
  { sym: "AAA", tier: "WATCH", lens: "AI", rank: "#1", lastRun: "2026-07-28", note: "queued",
    pos: POS(30, 24000, 21.4), deepDive: dd(800, { 2027: 55, 2028: 62 }, { 2027: 40, 2028: 46 }) },
  { sym: "BBB", tier: "WATCH", lens: "AI", rank: "#1 optics", lastRun: "2026-07-28", note: "queued too",
    pos: POS(10, 6090, 5.1), deepDive: dd(609, { 2027: 9, 2028: 11 }, { 2027: 18, 2028: 22 }) },
  { sym: "CCC", tier: "A", lens: "AI", lastRun: "2026-07-28", note: "held", pos: POS(700, 114100, 9.9) },
  { sym: "DDD", tier: "S", lens: "AI", lastRun: "2026-07-28", note: "no position measured" },
  { sym: "EEE", tier: "S", lens: "QC", lastRun: "2026-07-28", note: "diversifier" },
  { sym: "FFF", tier: "B", lens: "SP", lastRun: "2026-05-01", note: "leveraged",
    pos: POS(412, 30104, 4.2, { opt: [{ k: "call", side: "short", n: 3, strike: 50, exp: "2028-01-21" }] }) },
];
const BOARD = {
  as_of: "2026-07-28", source: "synthetic fixture", verified: false,
  regime: { asserted: "PANIC", as_of: "2026-07-28", source: "fixture", verified: false },
  circuit: { id: "C1", label: "Leverage circuit", state: "tripped", metric: "debt % of NAV",
    value: 128, trip_line: 130, as_of: "2026-07-28", verified: false,
    rule: "deleverage-only until a live pull disproves it" },
  account: { nav: 1150000, debt: 1472000, debt_pct_nav: 128, formula: "margin_balance / net_liquidation",
    at: "2026-07-28T14:32:00Z", src: "test", untracked: ["ZZZ"] },
  clusters: [{ id: "c1", label: "Synthetic cluster", members: ["AAA", "BBB", "CCC", "DDD"],
    rule: "size as ONE position" }],
  funding: { as_of: "2026-07-28", rule: "trims fund debt first",
    order: [{ sym: "FFF", est: "~$30k", blocker: "close the short calls FIRST" }, { sym: "GGG", est: "~$8k" }],
    do_not_trim: ["CCC"] },
  decisions: [
    { q: "undated standing question", blocking: true },
    { q: "aged question", asked: "2026-07-14", blocking: true },
  ],
  binaries: [{ date: "2026-07-28", scope: "MACROEVT", label: "a print that is not a book ticker" }],
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const json = (o) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (url.pathname === "/api/tt")
    return json({ version: "1.1", asOf: "2026-07-28", book: BOOK, cut: ["XXX"], board: BOARD,
      empty: false, auth: { mode: "pin", src: "kv", session_days_left: 29 } });
  if (url.pathname === "/readout.json")
    return json({ as_of: "2026-07-28T14:30:00Z", regime: { verdict: "HEADWIND" }, macro_flip: { armed: true } });
  if (url.pathname === "/api/quotes")
    return json({ asOf: "2026-07-28", quotes: { AAA: { px: 800, chg: -11, at: "2026-07-28" },
      BBB: { px: 609, chg: -14.5, at: "2026-07-28" } } });
  res.writeHead(200, { "content-type": "text/html" });
  res.end(readFileSync(ADMIN, "utf8"));
});
await new Promise((r) => server.listen(PORT, r));

let pass = 0, fail = 0;
const ok = (name, cond) => { console.log((cond ? "  PASS  " : "  FAIL  ") + name); cond ? pass++ : fail++; };

const browser = await chromium.launch({ executablePath: exe });
const errors = [];

async function open(width) {
  const page = await browser.newPage({ viewport: { width, height: 2200 } });
  page.on("pageerror", (e) => errors.push(`[${width}px] pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${width}px] console: ${m.text()}`); });
  await page.goto(`http://127.0.0.1:${PORT}/admin.html`);
  await page.waitForTimeout(1200);
  return page;
}
const txt = async (page, id) => (await page.locator("#" + id).innerText().catch(() => "")).replace(/\s+/g, " ");

// ── desktop pass ────────────────────────────────────────────────────────────
const page = await open(1200);

console.log("\n[render] TODAY — the default view answers the daily loop");
const today = await txt(page, "todayCard");
ok("stance leads with the circuit veto, not the macro read", /NO NEW POSITIONS/.test(today));
ok("today names tonight's print before anything discretionary", /MACROEVT prints today/.test(today));
ok("a single-name cap breach is a TODAY stop", /AAA is 21\.4% of NAV — 3\.4pts over the 18% cap/.test(today));
ok("a cluster cap breach is a TODAY stop", /Cluster .*is 36\.4% of NAV — 18\.4pts over the 18% cap/.test(today));
ok("the deleverage line carries real size", /FFF is first to trim — 412 sh, \$30k \(4\.2% of NAV\)/.test(today));
ok("the blocker is verified against real option legs", /3 short call\(s\) cover 300 of 412 sh/.test(today));
ok("no add candidate is offered while a stop is live", !/Add candidate/.test(today));

console.log("\n[render] drawers — a closed drawer never hides a red thing");
const sums = (await page.locator("#boardView details.drawer > summary").allInnerTexts()).join(" | ");
ok("exposure summary carries the cap breach count", /OVER THE 18% CAP/i.test(sums));
ok("calendar summary carries the no-new-adds count", /INSIDE 10D/i.test(sums));
ok("decisions summary carries the blocking count", /2 OPEN . 2 BLOCKING/i.test(sums));
ok("circuit summary carries the tripped state", /CIRCUIT & REGIME . TRIPPED/i.test(sums));
// textContent, not innerText: this panel lives inside a CLOSED drawer, and innerText
// returns "" for hidden nodes — which would pass any "does not contain" assertion.
ok("what-changed reports a first visit, never 'nothing changed'",
  /First visit on this device/.test(await page.locator("#changedPanel").textContent()));

console.log("\n[render] the book as a monitoring surface");
const board = await page.locator("#board").innerText();
ok("chips carry the live day move", /-11%/.test(board) && /-14\.5%/.test(board));
ok("chips carry the measured weight", /21\.4%/.test(board) && /4\.2%/.test(board));
ok("an over-cap chip is flagged on the chip", /21\.4%!/.test(board));
ok("a name with no measured position shows no weight", !/DDD[^\n]*%/.test(board));
const cov = await txt(page, "coverage");
ok("coverage counts measured positions alongside runs", /4\/6 measured/.test(cov));

console.log("\n[render] exposure — clusters and reconciliation");
await page.evaluate(() => document.querySelectorAll("details.drawer").forEach((d) => (d.open = true)));
await page.waitForTimeout(150);
const cl = await txt(page, "clusterLine");
ok("cluster total is summed against the cap", /36\.4% of NAV/.test(cl) && /OVER the 18% cap/.test(cl));
ok("an unmeasured member is named and the total called a floor", /1 unmeasured \(DDD\)/.test(cl) && /FLOOR/.test(cl));
ok("held-but-untracked exposure is surfaced", /1 held but NOT in the book/.test(cl) && /ZZZ/.test(cl));
const circuit = await txt(page, "circuitLine");
ok("circuit shows the arithmetic behind the number that vetoes adds",
  /computed as margin_balance \/ net_liquidation/.test(circuit));
ok("circuit still flags itself as unreconciled", /not reconciled against a live account pull/.test(circuit));
ok("stated state vs last measurement is reconciled, not smoothed over", /asserted ahead of the number/.test(circuit));
const fund = await txt(page, "fundingLine");
ok("funding marks an off-book trim candidate", /off-book/.test(fund));
const nd = await txt(page, "nextDollar");
ok("the stricter regime governs and both readings print",
  /PANIC regime/.test(nd) && /engines disagree/.test(nd) && /HEADWIND/.test(nd));

console.log("\n[render] deep-dive tab — four answers, corpus in drawers");
await page.evaluate(() => switchTab("AAA"));
await page.waitForTimeout(300);
const dv = (await page.locator("#deepView").innerText()).replace(/\s+/g, " ");
ok("the four answers render above the corpus",
  /WHAT IT'S WORTH/i.test(dv) && /WHAT CHANGES MY MIND/i.test(dv) && /WHEN/i.test(dv) && /WHAT I OWN/i.test(dv));
ok("what-changes-my-mind names the red hinge", /1 red/.test(dv) && /demand/.test(dv));
ok("what-I-own reads the measured position", /21\.4% of NAV/.test(dv) && /30 sh/.test(dv));
ok("when carries the next dated event", /own print/.test(dv));
const ddSums = (await page.locator("#deepView details.drawer > summary").allInnerTexts()).join(" | ");
ok("valuation summary carries the computed target", /VALUATION/i.test(ddSums));
ok("thesis summary carries the failing gate count", /1\/2 GATES FAILING/i.test(ddSums));
ok("an unknown payload key is NAMED, never invisible", /SOME_UNKNOWN_BLOCK/i.test(ddSums));
await page.evaluate(() => document.querySelectorAll("#deepView details.drawer").forEach((d) => (d.open = true)));
await page.waitForTimeout(100);
const dvOpen = (await page.locator("#deepView").innerText()).replace(/\s+/g, " ");
ok("every stored section is reachable when expanded",
  /alpha/.test(dvOpen) && /runway_q/.test(dvOpen) && /kill/i.test(dvOpen) && /bookings/.test(dvOpen));
await page.evaluate(() => switchTab("BOARD"));

console.log("\n[render] handoff patch — merge, never replace");
await page.evaluate(() => openSession());
await page.waitForTimeout(200);
ok("session editor prefills the stored board", (await page.inputValue("#fSession")).includes("Leverage circuit"));
await page.fill("#fHandoff", JSON.stringify({ updates: [
  { sym: "AAA", note: "merged note" }, { sym: "HHH", tier: "WATCH", lens: "AI", note: "new name" }] }));
await page.evaluate(() => applyHandoff());
await page.waitForTimeout(300);
const banner = (await page.locator("#saveBanner").innerText()).replace(/\s+/g, " ");
ok("the merge previews without writing", /UNSAVED/.test(banner) && /handoff merged on screen/.test(banner));
ok("the merge names what it added, changed and left alone",
  /1 added \(HHH\)/.test(banner) && /AAA \(note\)/.test(banner) && /untouched/.test(banner));
await page.evaluate(() => openSession());
await page.waitForTimeout(150);
await page.fill("#fHandoff", JSON.stringify({ updates: [{ sym: "III", note: "no tier" }] }));
await page.evaluate(() => applyHandoff());
await page.waitForTimeout(200);
ok("a new name without tier+lens is rejected whole, with a precise message",
  (await page.locator("#toast").innerText()).includes("III is new to the book"));
await page.close();

// ── phone pass ──────────────────────────────────────────────────────────────
console.log("\n[render] phone (390px) — the daily answer above the book");
const phone = await open(390);
const tY = (await phone.locator("#todayCard").boundingBox()).y;
const bY = (await phone.locator("#board").boundingBox()).y;
ok("the TODAY card renders above the book", tY < bY);
ok("the whole daily answer fits well inside two phone screens", bY - tY < 1400);
ok("every drawer starts closed except what-changed",
  (await phone.locator("#boardView details.drawer[open]").count()) <= 1);
ok("no horizontal overflow at 390px",
  await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
await phone.close();

ok("no page errors at either width", errors.length === 0 || (console.log(errors), false));

await browser.close();
server.close();
console.log(`\n=== RENDER TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
