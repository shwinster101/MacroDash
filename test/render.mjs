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
// CI-FIX (2026-08-02 audit §4): the repo's first CI run failed here on a browser that was
// PRESENT. playwright-core ships Chrome-for-Testing builds, which renamed the per-platform
// directory (linux-x64: chrome-linux/ → chrome-linux64/; mac: Chromium.app → the CfT
// bundle). The hardcoded list below knew only the pre-CfT names, so on ubuntu-latest a
// freshly-downloaded chromium read as absent — and under REQUIRE_BROWSER=1 that failed loud
// on a present browser, which is the inverse of what A3 (v3.58) built that flag to catch.
// The pre-CfT names still ship for linux-arm64 and older pinned images, so BOTH generations
// have to be searched; searching only the new ones would just move the false skip.
const CHROMIUM_RELS = [
  "chrome-linux64/chrome",                                                       // linux-x64 (CfT)
  "chrome-linux/chrome",                                                         // linux-arm64 + pre-CfT
  "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "chrome-mac/Chromium.app/Contents/MacOS/Chromium",                             // pre-CfT
  "chrome-win64/chrome.exe",                                                     // win-x64
];
function findChromium() {
  // An explicit path is honoured only if it EXISTS — trusting it blindly turns a typo into
  // a launch stack trace instead of the clean skip this function is for.
  const direct = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (direct) return existsSync(direct) ? direct : null;
  // Ask playwright-core FIRST. Its own registry IS the source of truth for the layout, so
  // this keeps working when the next build renames the directory again — the whole reason
  // the hardcoded list rotted. It COMPUTES a path rather than verifying one (and computes it
  // for the build pinned in node_modules), so the result is still existence-checked, and a
  // browser installed by a DIFFERENT playwright build is left to the scan below.
  try {
    const p = chromium.executablePath();
    if (p && existsSync(p)) return p;
  } catch (_e) { /* no registry entry for this platform — fall through to the scan */ }
  // An explicitly set browsers path WINS outright. Quietly supplementing it with the
  // hardcoded fallback would mean the env var could never express "look nowhere else".
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
  // A3 (v3.58): under REQUIRE_BROWSER=1 (CI) a missing browser is a FAILURE, not a skip.
  if (process.env.REQUIRE_BROWSER === "1") {
    console.error(`\n=== RENDER TEST: FAILED — ${why} (REQUIRE_BROWSER=1) ===`);
    process.exit(1);
  }
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
// DATES ARE COMPUTED, not hardcoded — a fixture stamped "today" at write time silently
// rots as the calendar rolls (the MACROEVT "prints today" assert died the first midnight
// after it was written). Anything meaning "now"/"recent"/"stale" derives from TODAY_ET.
const ET_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });
const TODAY_ET = ET_FMT.format(new Date());
const etDaysAgo = (n) => ET_FMT.format(new Date(Date.now() - n * 86400000)); // negative = future
const dd = (px, rev, eps, extra = {}) => ({
  thesis_version: "v1.0 (2026-07-20)", updated: etDaysAgo(3),
  ref_px: { px, at: TODAY_ET },
  consensus: { revenue_B: rev, eps },
  pt_model: { ev_s_multiple: 8, share_count_M: 1100, pe_floor_multiple: 18 },
  hinges: [{ label: "demand", state: "red", note: "supplier layer" }],
  key_dates: [{ date: etDaysAgo(-22), label: "own print" }],
  gates: [{ name: "G1 scale", status: "PASS" }, { name: "G2 funding", status: "FAIL" }],
  kill_combination: { conditions: ["demand stalls", "funding shuts"], joint_probability: "8%" },
  rules: ["never average down into a broken base"],
  capital: { runway_q: 6 },
  leading_indicators: { bookings: "up" },
  some_unknown_block: { alpha: 1, beta: 2 },
  ...extra,
});
const POS = (sh, mv, pct, extra = {}) => ({ sh, mv, pct, at: `${TODAY_ET}T14:32:00Z`, src: "test", ...extra });
const BOOK = [
  { sym: "AAA", tier: "WATCH", lens: "AI", rank: "#1", lastRun: etDaysAgo(1), note: "queued",
    deepDive: dd(800, { 2027: 55, 2028: 62, 2029: 70 }, { 2027: 40, 2028: 46, 2029: 52 }, {
      // FEAT-TT-PTLINT (v3.39): FY2027 is marked DERIVED, which must dim/italicise that row's
      // rev+eps cells AND propagate to the target computed off them (the FY2027 estimates price
      // the year-end-2026 rung). Chosen deliberately so the 2028-row assertions below — $509,
      // 8x EV/S, -36.4% — keep testing the ladder rather than the marker.
      consensus: { revenue_B: { 2027: 55, 2028: 62, 2029: 70 }, eps: { 2027: 40, 2028: 46, 2029: 52 },
        derived: { 2027: ["rev", "eps"] } },
      // FEAT-TT-SPREAD (v3.33): pt_consensus on the SAME horizon (2028, fwd=2029) as the
      // pt_model row — lets the test confirm the "street $X vs mine $Y" confrontation.
      // "severe" is deliberately excluded from the street average (same dim rule as
      // ddPtConsensusSec: /floor|bear|severe/i), leaving base+bull -> avg 485.
      pt_consensus: { rows: { "2028": { severe: 300, base: 450, bull: 520 } } },
      capex_exposure: { type: "direct", pct_of_rev: 40, via: ["HYPA", "HYPB"] },
    }) },
  { sym: "BBB", tier: "WATCH", lens: "AI", rank: "#1 optics", lastRun: etDaysAgo(1), note: "queued too",
    deepDive: dd(609, { 2027: 9, 2028: 11 }, { 2027: 18, 2028: 22 },
      { // v3.73 TT-SCORE: legacy composite tier S vs the shadow fixture's capped B — the
        // methods-disagree line must render. Synthetic, as always.
        composite: { score: 8.7, basis: "V9 G9 P8 M8 R8 (synthetic)", capped_tier: "S — conviction" },
        capex_exposure: { type: "neocloud", own_capex_B: 9 },
        // FEAT-TOKW (v3.46): the neocloud case — mix sums to 100, so the fleet index is
        // exact: (40×1.00 + 60×4.50)/100 = 3.10 vs frontier 4.50 = 69% of frontier tokens/W.
        tokens_per_watt: { at: "2026-07-30", mw_now: 100, mw_planned: 300,
          gen_mix: [{ gen: "G1", pct: 40, idx: 1.00 }, { gen: "G2", pct: 60, idx: 4.50 }],
          note: "synthetic fixture" } }) },
  // CCC carries a manual queue rank but NO deepDive/pt_model — the v3.36 coverage gap:
  // a name under active consideration that the computed ranking can say nothing about.
  { sym: "CCC", tier: "A", lens: "AI", rank: "#3", lastRun: etDaysAgo(1), note: "held" },
  { sym: "DDD", tier: "S", lens: "AI", lastRun: etDaysAgo(1), note: "no position measured" },
  { sym: "EEE", tier: "S", lens: "QC", lastRun: etDaysAgo(1), note: "diversifier" },
  { sym: "FFF", tier: "B", lens: "SP", lastRun: etDaysAgo(45), note: "leveraged" },
  // JJJ is MODELLED BUT NOT HELD (no entry in POSITIONS) — the v3.37 case: the ranking
  // deliberately spans both universes, so an unheld name must be labelled, not left blank.
  { sym: "JJJ", tier: "WATCH", lens: "AI", lastRun: etDaysAgo(2), note: "candidate, no position",
    deepDive: dd(100, { 2027: 5, 2028: 6, 2029: 7 }, { 2027: 3, 2028: 4, 2029: 5 },
      // A PARTIAL mix (sums to 80) and no date — the fail-closed path: FLOOR, not an average.
      { capex_exposure: { type: "fab" },
        tokens_per_watt: { gen_mix: [{ gen: "G1", pct: 80, idx: 1.00 }] } }) },
];
// FEAT-TT-POSSTORE (v3.34): pos now lives at /api/positions, not embedded in the book —
// same fixture data, moved to its own map, keyed by sym.
// FEAT-TT-OWNDEBT (v3.35): AAA carries cost basis + P/L + a strikeless put (the
// strike-only-when-captured path); EEE is OPTIONS-ONLY (no shares — the LITE case, which
// used to render as unheld), its leg expiring inside OPT_NEAR_D so the amber flag fires.
// FEAT-TT-PTLINT (v3.39): leg provenance is per-leg and optional. AAA's leg is broker-synced,
// EEE's came off a screenshot (the class that was mistyped call-for-put in the live book), and
// FFF's carry NONE — which must read as unrecorded, never as sync.
const POSITIONS = {
  AAA: POS(30, 24000, 21.4, { cb: 18000, upl_pct: 33.3,
    opt: [{ k: "put", side: "long", n: 1, exp: etDaysAgo(-140), src: "sync" }] }),
  BBB: POS(10, 6090, 5.1),
  CCC: POS(700, 114100, 9.9),
  EEE: { at: `${TODAY_ET}T14:32:00Z`, src: "test", mv: 4200,
    opt: [{ k: "call", side: "long", n: 2, strike: 100, exp: etDaysAgo(-52), src: "screenshot", mv: 4200 }] },
  // FFF funds the deleverage line, so its short calls are what the trim blocker is verified
  // against. The SECOND leg is deliberately EXPIRED: before v3.39 the cover filter ignored exp
  // entirely, so an expired short call still "covered" shares in the one place the board says a
  // trim is blocked — while the expiry ladder flagged the same leg "expired?" two drawers away.
  FFF: POS(412, 30104, 4.2, { opt: [
    { k: "call", side: "short", n: 3, strike: 50, exp: "2028-01-21" },
    { k: "call", side: "short", n: 5, strike: 40, exp: etDaysAgo(30) },
  ] }),
};
const BOARD = {
  as_of: TODAY_ET, source: "synthetic fixture", verified: false,
  regime: { asserted: "PANIC", as_of: TODAY_ET, source: "fixture", verified: false },
  circuit: { id: "C1", label: "Leverage circuit", state: "tripped", metric: "debt % of NAV",
    value: 128, trip_line: 130, as_of: TODAY_ET, verified: false,
    rule: "deleverage-only until a live pull disproves it" },
  account: { nav: 1150000, debt: 1472000, debt_pct_nav: 128, formula: "margin_balance / net_liquidation",
    at: `${TODAY_ET}T14:32:00Z`, src: "test", untracked: ["ZZZ"] },
  clusters: [{ id: "c1", label: "Synthetic cluster", members: ["AAA", "BBB", "CCC", "DDD"],
    rule: "size as ONE position" }],
  // FEAT-TT-CAPEX (v3.45): synthetic tape — 2 of 3 guiding down (tripwire) and a pool small
  // enough that AAA's direct exposure (55 × 40% = 22) BREACHES it (agg 18) — both red paths lit.
  // FEAT-TT-CAPABILITY (v3.55): the demand leg, deliberately set PAST its pre-committed
  // threshold so the tripped falsifier is exercised end to end (20mo observed vs an 18mo
  // threshold), and slowing versus the prior reading.
  capability: { metric: "task-horizon doubling (synthetic)", observed_months: 20,
    prior_months: 12, threshold_months: 18, source: "fixture", as_of: TODAY_ET,
    threshold_basis: "synthetic basis" },
  capex: { rows: [
    { co: "HYPA", fy_guide_B: 8, dir: "down", at: etDaysAgo(2) },
    { co: "HYPB", fy_guide_B: 6, dir: "down", at: etDaysAgo(1) },
    { co: "HYPC", fy_guide_B: 4, dir: "hold", at: etDaysAgo(4) },
  ] },
  funding: { as_of: TODAY_ET, rule: "trims fund debt first",
    order: [{ sym: "FFF", est: "~$30k", blocker: "close the short calls FIRST" }, { sym: "GGG", est: "~$8k" }],
    do_not_trim: ["CCC"] },
  decisions: [
    { q: "undated standing question", blocking: true },
    { q: "aged question", asked: etDaysAgo(10), blocking: true },
  ],
  // "prints today" only means today if the fixture says today — the original hardcoded
  // date killed two asserts the first midnight after it was written.
  binaries: [{ date: TODAY_ET, scope: "MACROEVT", label: "a print that is not a book ticker" }],
};

// FEAT-TT-LEDGER (v3.32) fixture: AAA carries per-name history (a tier flip + a hinge
// flip); the cross-book "recent" feed carries the SCORECARD's tier entry (AAA, since-move
// against its $800 live quote) and the divergence flag's est entry (BBB: estimate revised
// UP while price has since fallen — the automated CRDO pattern: estimates up, price down).
const LEDGER_AAA = [
  { t: "2026-07-20T12:00:00Z", v: "1.0", kind: "run", sym: "AAA", field: null, from: null, to: "2026-07-20", px: 750 },
  { t: "2026-07-25T12:00:00Z", v: "1.05", kind: "hinge", sym: "AAA", field: "demand", from: "green", to: "red", px: 780 },
  { t: "2026-07-28T12:00:00Z", v: "1.1", kind: "tier", sym: "AAA", field: null, from: "A", to: "WATCH", px: 700 },
];
const LEDGER_RECENT_FIXTURE = [
  ...LEDGER_AAA,
  // BBB: FY2028 revenue estimate revised UP (9 -> 11) while price fell from $700 to the
  // live $609 (~13% down) -- estimates up, price down, unresolved by the market yet.
  { t: "2026-07-26T12:00:00Z", v: "1.08", kind: "est", sym: "BBB", field: "rev:2028", from: 9, to: 11, px: 700 },
];

// FEAT-DERIV-OWN (v3.41): mutable so a later test can swap in a blind-circuit / withheld-verdict
// body and re-open the page — loadRegime() re-fetches on every navigation, so this is enough to
// drive the pill through every state without a second server.
let READOUT_FIXTURE = { as_of: `${TODAY_ET}T14:30:00Z`, regime: { verdict: "HEADWIND" }, macro_flip: { armed: true } };
// ENGINE0-CONT: null = endpoint absent (404), so the pre-existing refreshRanks test keeps
// exercising the read-only fallback ladder; set to a body to drive the real POST path.
let REFRESH_FIXTURE = null;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const json = (o) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (url.pathname === "/api/snapshot/refresh") {
    if (req.method !== "POST" || !REFRESH_FIXTURE) { res.writeHead(REFRESH_FIXTURE ? 405 : 404); return res.end(); }
    return json(REFRESH_FIXTURE);
  }
  if (url.pathname === "/api/tt")
    return json({ version: "1.1", asOf: TODAY_ET, book: BOOK, cut: ["XXX"], board: BOARD,
      empty: false, auth: { mode: "pin", src: "kv", session_days_left: 29 } });
  if (url.pathname === "/readout.json")
    return json(READOUT_FIXTURE);
  if (url.pathname === "/api/positions")
    return json({ asOf: TODAY_ET, positions: POSITIONS });
  if (url.pathname === "/api/quotes")
    return json({ asOf: `${TODAY_ET}T14:35:00Z`, quotes: { AAA: { px: 800, chg: -11, at: TODAY_ET },
      BBB: { px: 609, chg: -14.5, at: TODAY_ET } } });
  // v3.73 TT-SCORE: shadow scorecard fixtures. AAA = awaiting falsifiers with a
  // NO_FLOOR_PREPROFIT + context premium; BBB = SCORED but DISAGREEING with the legacy
  // composite, so the methods-disagree line renders. Synthetic only, as always.
  if (url.pathname === "/api/score") {
    const s = url.searchParams.get("sym");
    if (s === "AAA") return json({ sym: "AAA", record: { sym: "AAA", underwriting_inputs: {},
      scorecard: { methodology_version: "tt-underwriting-v2.3.0", status: "UNSCORABLE", actionability: "BLOCKED",
        route: "AI_INFRA", profile: null, route_mapping_version: "tt-route-v1",
        raw_score: null, raw_tier: null, capped_tier: null, input_hash: "sha256:aaaa1111",
        blockers: ["falsifier_health: AWAITING_FALSIFIERS", "owner_valuation: NO_FLOOR_PREPROFIT"],
        pillars: { owner_valuation: { score: null, weight: 0.25, basis_used: "NONE", premium_prerequisite_state: "UNKNOWN",
            blockers: ["NO_FLOOR_PREPROFIT"], context_premium: { target: 382, target_year: "2027",
              annualized_return_pct: 45.75, note: "CONTEXT ONLY — contingent premium, not a pillar score" } },
          trajectory: { score: null, weight: 0.25, blockers: ["trajectory inputs missing"] },
          economic_quality: { score: null, weight: 0.25, blockers: ["quality inputs missing"] },
          falsifier_health: { score: null, weight: 0.25, bootstrap: "PRECOMMITTED_PENDING", blockers: ["AWAITING_FALSIFIERS"] } },
        gate_results: [{ id: "AI_G3_2028_BRIDGE", state: "UNKNOWN", premium_prerequisite: true, raw_state: "DEMANDING-BUT-CREDIBLE" }] } } });
    if (s === "BBB") return json({ sym: "BBB", record: { sym: "BBB", underwriting_inputs: {},
      scorecard: { methodology_version: "tt-underwriting-v2.3.0", status: "SCORED", actionability: "CAUTION",
        route: "PHYSICAL_AI", profile: null, route_mapping_version: "tt-route-v1",
        raw_score: 6.12, raw_tier: "B", capped_tier: "B", input_hash: "sha256:bbbb2222",
        blockers: [], pillars: { owner_valuation: { score: 6.5, weight: 0.25, basis_used: "FLOOR", premium_prerequisite_state: "UNKNOWN", blockers: [] },
          trajectory: { score: 7.0, weight: 0.25, blockers: [] },
          economic_quality: { score: 5.0, weight: 0.25, blockers: [] },
          falsifier_health: { score: 6.0, weight: 0.25, blockers: [] } },
        gate_results: [] } } });
    return json({ sym: s, record: null });
  }
  if (url.pathname === "/api/ledger") {
    const p = url.searchParams;
    if (p.get("recent") === "1") return json({ days: 90, entries: LEDGER_RECENT_FIXTURE });
    if (p.get("sym") === "AAA") return json({ sym: "AAA", entries: LEDGER_AAA });
    if (p.get("sym")) return json({ sym: p.get("sym"), entries: [] });
    return json({ index: { AAA: { count: 3, last: "2026-07-28" }, BBB: { count: 1, last: "2026-07-26" } } });
  }
  res.writeHead(200, { "content-type": "text/html" });
  res.end(readFileSync(ADMIN, "utf8"));
});
await new Promise((r) => server.listen(PORT, r));

let pass = 0, fail = 0;
const ok = (name, cond) => { console.log((cond ? "  PASS  " : "  FAIL  ") + name); cond ? pass++ : fail++; };

const browser = await chromium.launch({ executablePath: exe });
const errors = [];

async function open(width, height=2200) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => errors.push(`[${width}px] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // ENGINE0-CONT: the refresh button feature-detects POST /api/snapshot/refresh; on an
    // older deploy (this stub's 404 default) the browser logs the failed resource before
    // the client's documented fallback runs. That probe is by-design — not a page error.
    if (/Failed to load resource/.test(m.text()) && /\/api\/snapshot\/refresh/.test(m.location()?.url || "")) return;
    errors.push(`[${width}px] console: ${m.text()}`);
  });
  await page.goto(`http://127.0.0.1:${PORT}/admin.html`);
  await page.waitForTimeout(1200);
  return page;
}
const txt = async (page, id) => (await page.locator("#" + id).innerText().catch(() => "")).replace(/\s+/g, " ");

// ── desktop pass ────────────────────────────────────────────────────────────
const page = await open(1200);
// v3.38 FOCUS2: everything but the four drivers lives inside the closed DESK drawer.
// Open it once up front so the pre-existing section reads keep working; the closed-state
// guarantees are asserted separately (phone pass + the focus2 section below).
await page.evaluate(() => { document.getElementById("dDesk").open = true; });
await page.waitForTimeout(80);

console.log("\n[render] TODAY — the default view answers the daily loop");
const today = await txt(page, "todayCard");
ok("stance leads with the circuit veto, not the macro read", /NO NEW POSITIONS/.test(today));
ok("today names tonight's print before anything discretionary", /MACROEVT prints today/.test(today));
ok("a single-name cap breach is a TODAY stop", /AAA is 21\.4% of acct equity — 3\.4pts over the 18% cap/.test(today));
ok("a cluster cap breach is a TODAY stop", /Cluster .*is 36\.4% of acct equity — 18\.4pts over the 18% cap/.test(today));
ok("the deleverage line carries real size", /FFF is first to trim — 412 sh, \$30k \(4\.2% of acct equity\)/.test(today));
// FEAT-TT-PTLINT (v3.39): only LIVE legs cover, and the strike is named rather than every short
// call counting alike. FFF holds 3 live contracts (exp 2028) + 5 EXPIRED ones: the cover claim
// must count 300 shares, not 800, and must say the expired leg was dropped.
ok("the blocker is verified against real option legs — expired ones cover nothing",
  /3 live short call\(s\) cover 300 of 412 sh @ \$50/.test(today) &&
  /1 more expired or undated, NOT counted/.test(today) &&
  !/cover 800/.test(today));
ok("no add candidate is offered while a stop is live", !/Add candidate|Eligible next dollar/.test(today));

// FEAT-TT-RANKEXPORT (v3.56): build the real document from the fixture and drive the share
// chain. A string pin cannot prove a document renders; this executes it.
console.log("\n[render] FEAT-TT-RANKEXPORT — the rankings document and the share chain");
const rank = await page.evaluate(() => {
  const md = buildRankingsMd();
  return { md, len: md.length,
    rows: (md.match(/\n\| \d+ \| \*\*/g) || []).length,
    hasNaN: /NaN|undefined|\[object/.test(md) };
});
ok("rankexport: the document builds and is substantial", rank.len > 800);
ok("rankexport: no NaN/undefined/[object Object] leaked into the output", !rank.hasNaN);
ok("rankexport: it leads with STANCE, then the master ranking",
  /# TT RANKINGS/.test(rank.md) && rank.md.indexOf("## STANCE") < rank.md.indexOf("## MASTER RANKING"));
ok("rankexport: the fixture's tripped circuit is carried into the stance line",
  /NO NEW POSITIONS/.test(rank.md));
ok("rankexport: the stance verdict is not printed twice on one line",
  !/\*\*NO NEW POSITIONS\*\* — NO NEW POSITIONS/.test(rank.md) &&
  (rank.md.match(/NO NEW POSITIONS/g) || []).length <= 2);
ok("rankexport: every ranked name gets a master-table row with category ranks",
  rank.rows >= 3 && /Rank: in tier/.test(rank.md));
ok("rankexport: per-tier and per-lens leaderboards render",
  /### Tier /.test(rank.md) && /### Lens /.test(rank.md));
ok("rankexport: funding priority carries its not-a-sell-call disclaimer",
  /NOT a sell recommendation/.test(rank.md));
ok("rankexport: unranked names are NAMED rather than silently dropped",
  /## NOT RANKED/.test(rank.md));
ok("rankexport: provenance states the floor denominator", /a floor — NAV unmeasured/.test(rank.md));
if(process.env.DUMP_RANKINGS)console.log("\n----- SAMPLE OUTPUT -----\n"+rank.md+"\n----- END -----\n");
// Share chain: stub navigator.share and confirm a File is what gets offered.
const shared = await page.evaluate(async () => {
  const seen = {};
  const origShare = navigator.share, origCan = navigator.canShare;
  Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
  Object.defineProperty(navigator, "share", { value: async (d) => {
    seen.files = d.files ? d.files.length : 0;
    seen.name = d.files && d.files[0] ? d.files[0].name : null;
    seen.type = d.files && d.files[0] ? d.files[0].type : null;
    seen.size = d.files && d.files[0] ? d.files[0].size : 0;
  }, configurable: true });
  await exportRankings();
  if (origShare) Object.defineProperty(navigator, "share", { value: origShare, configurable: true });
  else delete navigator.share;
  if (origCan) Object.defineProperty(navigator, "canShare", { value: origCan, configurable: true });
  else delete navigator.canShare;
  return seen;
});
ok("share: a real File is handed to the share sheet (what iOS needs for Files/Notes)",
  shared.files === 1 && shared.size > 800);
ok("share: the filename is dated .md and the type is iOS-friendly text/plain",
  /^TT-RANKINGS-\d{4}-\d{2}-\d{2}\.md$/.test(shared.name || "") && shared.type === "text/plain");
// A cancelled sheet must not surface as an error.
const cancelled = await page.evaluate(async () => {
  const origShare = navigator.share, origCan = navigator.canShare;
  Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
  Object.defineProperty(navigator, "share", { value: async () => {
    const e = new Error("cancelled"); e.name = "AbortError"; throw e; }, configurable: true });
  let threw = false;
  try { await exportRankings(); } catch (_e) { threw = true; }
  if (origShare) Object.defineProperty(navigator, "share", { value: origShare, configurable: true });
  else delete navigator.share;
  if (origCan) Object.defineProperty(navigator, "canShare", { value: origCan, configurable: true });
  else delete navigator.canShare;
  return { threw, toast: (document.getElementById("toast").textContent || "") };
});
ok("share: cancelling the sheet neither throws nor reports a failure",
  !cancelled.threw && !/could not|fail/i.test(cancelled.toast));

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
// The ledger's cross-book "recent" fetch lands asynchronously (loadLedgerRecent -> render());
// give it a moment before reading chips/scorecard so the divergence flag has data to show.
await page.waitForTimeout(500);
const board = await page.locator("#board").innerText();
ok("chips carry the live day move", /-11%/.test(board) && /-14\.5%/.test(board));
ok("chips carry the measured weight", /21\.4%/.test(board) && /4\.2%/.test(board));
ok("an over-cap chip is flagged on the chip", /21\.4%!/.test(board));
ok("a name with no measured position shows no weight", !/DDD[^\n]*%/.test(board));
const cov = await txt(page, "coverage");
ok("coverage counts measured positions alongside runs", /5\/7 measured/.test(cov));
// v3.35 fixpack: the quote batch finally states when it was taken.
ok("coverage states when the quote batch was taken", /quotes as of/.test(cov));

console.log("\n[render] FEAT-TT-ROLLUP — the tracked book, summed and labeled a floor");
const roll = await txt(page, "bookRollup");
ok("rollup totals the tracked book (Σmv = $178,494 → $178k)", /TRACKED BOOK/.test(roll) && /\$178k/.test(roll));
ok("rollup P/L uses only both-ends-measured names (AAA alone: +$6k, +33.3%)",
  /\+\$6k \(\+33\.3%\)/.test(roll) && /1 of 5 carry cost basis/.test(roll));
ok("rollup states its denominator and its honesty label",
  /5\/7 measured/.test(roll) && /NOT NAV/.test(roll));
ok("rollup splits by tier so the tier list reads as capital, not just names",
  /A \$114k/.test(roll) && /B \$30k/.test(roll));

console.log("\n[render] FEAT-TT-OWNDEBT — the invisible position fields render");
// Scope each check to that SYM's own chip element, not a text-offset window — chips sit
// right beside each other in the DOM, so a loose window can read a neighbour's flag.
const chipText = async (sym) => (await page.locator(`.chip:has(.sym:text-is("${sym}"))`).innerText().catch(() => ""));
ok("AAA's chip carries its unrealized P/L, colored", /\+33\.3%/.test(await chipText("AAA")));
ok("EEE (options-only) chip carries the ◇opt marker instead of reading as unheld",
  /◇opt/.test(await chipText("EEE")));

console.log("\n[render] v3.35 fixpack — the card is the tap surface for measured facts");
await page.evaluate((s) => openCard(s), "AAA");
await page.waitForTimeout(120);
const cardBody = await page.locator("#cBody").textContent();
ok("card MEASURED row carries live price, size and weight (the old tooltip, tappable)",
  /MEASURED/.test(cardBody) && /\$800/.test(cardBody) && /30 sh/.test(cardBody) && /21\.4% of acct equity/.test(cardBody));
// FEAT-TT-READY (v3.50): the consolidated statement leads the card, and every blocker stays a
// visible chip. AAA in the fixture is measured and modelled — whatever its verdict, the bar
// must render a real verdict token and never a blank.
ok("ready: the card leads with a DECISION READINESS verdict, not eight scattered dates",
  /READINESS/.test(cardBody) && /DECISION READINESS/.test(cardBody) &&
  /(READY|CAUTION|BLOCKED)/.test(cardBody));
ok("ready: the card's readiness bar states each clock rather than only a verdict",
  /TT run|TT never run/.test(cardBody) && /thesis/.test(cardBody));
await page.evaluate(() => closeCard());
await page.waitForTimeout(80);

console.log("\n[render] FEAT-TT-SPREAD — the divergence flag (the automated CRDO pattern)");
ok("BBB's chip flags estimates-up/price-down (est revised up, price since fallen ~13%)",
  /est↑ px↓/.test(await chipText("BBB")));
ok("AAA's chip carries NO divergence flag (nothing in its ledger disagrees with price)",
  !/est↑|est↓/.test(await chipText("AAA")));

console.log("\n[render] FEAT-TT-LEDGER — the board SCORECARD");
await page.evaluate(() => document.querySelectorAll("details.drawer").forEach((d) => (d.open = true)));
await page.waitForTimeout(200);
const score = await txt(page, "scorecardLine");
// textContent, not innerText: drawer summaries render CSS text-transform:uppercase, so
// innerText would report "1 BELIEF CHANGE" — assert against the raw (pre-transform) text.
const sScoreTxt = await page.locator("#sScore").textContent();
ok("scorecard summary carries the biggest since-move while the drawer could be closed",
  /SCORECARD/i.test(sScoreTxt) && /1 belief change/i.test(sScoreTxt) && /AAA \+14\.3%/.test(sScoreTxt));
ok("scorecard body shows the tier change with price-then and since-move",
  /AAA/.test(score) && /TIER/.test(score) && /A → WATCH/.test(score) && /@ \$700/.test(score) && /\+14\.3%/.test(score));
ok("scorecard excludes non-scorecard kinds (the hinge/run entries do not appear here)",
  !/HINGE/.test(score) && !/TT RUN/.test(score));

console.log("\n[render] exposure — clusters and reconciliation");
await page.evaluate(() => document.querySelectorAll("details.drawer").forEach((d) => (d.open = true)));
await page.waitForTimeout(150);
const cl = await txt(page, "clusterLine");
ok("cluster total is summed against the cap", /36\.4% of acct equity/.test(cl) && /OVER the 18% cap/.test(cl));
ok("an unmeasured member is named and the total called a floor", /1 unmeasured \(DDD\)/.test(cl) && /FLOOR/.test(cl));
ok("held-but-untracked exposure is surfaced", /1 held but NOT in the book/.test(cl) && /ZZZ/.test(cl));
const circuit = await txt(page, "circuitLine");
ok("circuit shows the arithmetic behind the number that vetoes adds",
  /computed as margin_balance \/ net_liquidation/.test(circuit));
ok("circuit still flags itself as unreconciled", /not reconciled against a live account pull/.test(circuit));
ok("stated state vs last measurement is reconciled, not smoothed over", /asserted ahead of the number/.test(circuit));
const fund = await txt(page, "fundingLine");
ok("funding marks an off-book trim candidate", /off-book/.test(fund));
// FEAT-TT-OWNDEBT (v3.35): the expiry ladder — every measured leg, one list, worst first.
const ladder = await txt(page, "optLadder");
// case-insensitive: the .lbl class renders through text-transform:uppercase.
ok("expiry ladder lists every measured leg book-wide, sorted by expiry",
  // 4 legs: AAA long put, EEE long call, FFF's live short call + FFF's expired one (v3.39 —
  // an expired leg is still LISTED here; what changed is that it no longer counts as cover).
  /Option expiries — 4 legs across 3 names/i.test(ladder) &&
  /EEE/.test(ladder) && /FFF/.test(ladder) && /2028-01-21/.test(ladder));
ok("a leg inside the 60d window is flagged amber on the ladder", /⚠/.test(ladder));
// textContent: the summary is CSS-uppercased and the drawer may be closed on a real visit.
ok("the EXPOSURE summary carries the near-expiry count while closed",
  /1 leg ≤60d/i.test(await page.locator("#sExp").textContent()));
const nd = await txt(page, "nextDollar");
ok("the stricter regime governs and both readings print",
  /PANIC regime/.test(nd) && /engines disagree/.test(nd) && /HEADWIND/.test(nd));

console.log("\n[render] v3.38 FOUR DRIVERS — stance strip, buy, sell, calendar");
// AAA: pct 21.4 → forced trim, 3.4pts over, 24000×3.4/21.4 ≈ $3,813 → "$4k to cap".
// BBB: modelled+held, deep negative model upside → first (only) discretionary source.
// CCC (no model) + FFF (no model) → "cannot rank"; EEE → options-only; CCC also do_not_trim.
// Asserted funding first = FFF vs computed first = AAA → reconciliation line prints both.
const sellB = await txt(page, "sellBlock");
ok("sell: a cap breach is a FORCED trim with the computed dollar amount",
  /TRIM/.test(sellB) && /AAA/.test(sellB) && /3\.4pts over the 18% cap/.test(sellB) && /\$4k to cap/.test(sellB));
// FEAT-TT-GLANCE (v3.61): the methodology sentences + the unranked tail moved into a closed
// est-mini expander. What stays visible while closed: the rows, chip-length basis tags, the
// unranked COUNT, and the session-disagreement chip (signal, not explanation).
ok("glance: closed SELL shows chip-length basis tags, never the repeated sentences",
  /%\/yr model/.test(sellB) && !/lowest expected return funds first/i.test(sellB) &&
  !/ranked on realisable dollars/.test(sellB));
ok("glance: the unranked COUNT is visible while the expander is closed (no silent truncation)",
  /○ 2 unranked/.test(sellB) && /how this list is ranked/i.test(sellB));
ok("glance: the disagreement chip stays visible while closed — it is signal",
  /⚖ session: FFF first · computed: AAA/.test(sellB));
ok("glance: the SELL methodology expander is est-mini class, never drawer (phone harness rule)",
  (await page.locator("#sellBlock details.est-mini").count()) === 1 &&
  (await page.locator("#sellBlock details.drawer").count()) === 0);
// One tap deep, everything survives verbatim.
await page.locator("#sellBlock details.est-mini > summary").click();
const sellOpen = await txt(page, "sellBlock");
ok("sell: discretionary source is the LOWEST expected return (BBB), stated as such",
  /BBB/.test(sellOpen) && /%\/yr model/.test(sellOpen) && /lowest expected return funds first/i.test(sellOpen));
ok("sell: unmodelled held names are named, not silently missing",
  /cannot rank — no model:/i.test(sellOpen) && /CCC/.test(sellOpen) && /FFF/.test(sellOpen));
// v3.44: an options-only position with synced legs ranks IN the list, on realisable dollars.
ok("sell: an options-only position ranks IN the list, on dollars, and says so",
  /EEE/.test(sellOpen) && /ranked on realisable dollars/.test(sellOpen) &&
  !/selling legs is not selling shares/.test(sellOpen));
ok("sell: the asserted funding order is confronted with the computed one",
  /asserts FFF first/i.test(sellOpen) && /computed says AAA/i.test(sellOpen));
ok("sell: a tripped circuit makes SELL the active list",
  /this IS the active list/i.test(sellOpen));
const buyB = await txt(page, "buyBlock");
ok("buy: compact block carries the veto banner and the same ranked rows",
  /NO NEW POSITIONS/.test(buyB) && /AAA/.test(buyB) && /13\.4%\*/.test(buyB));
const calB = await txt(page, "calBlock");
ok("calendar block leads with today's binary", /TODAY/.test(calB) && /MACROEVT/.test(calB));
const strip = await txt(page, "stanceStrip");
ok("stance strip carries the red counts while DESK is closed",
  /over cap/.test(strip) && /binaries/.test(strip));
ok("stance strip carries the refresh button and the quote stamp",
  (await page.locator("#refreshRanks").count()) === 1 && /quotes \d{2}:\d{2}Z/.test(strip));
// v3.42 READABLE DESK: the verdict is a TOKEN, not a buried clause — the tripped fixture
// makes it deterministic. The prose moved one tap deep; a closed why-drawer must still show
// every red fact via the token/chips/badges (v3.25 rule at strip altitude).
ok("stance bar: the verdict renders as a single large token (tripped fixture → NO NEW POSITIONS)",
  (await page.locator("#stanceStrip .vbadge").count()) === 1 &&
  /NO NEW POSITIONS/.test(await page.locator("#stanceStrip .vbadge").innerText()));
ok("stance bar: the why drawer starts closed and holds the full prose verbatim",
  (await page.locator("#stanceStrip details.why[open]").count()) === 0 &&
  /leverage circuit tripped/i.test(await page.locator("#stanceStrip details.why div").textContent()));
ok("stance bar: with the drawer closed the verdict + red counts are all still visible",
  /NO NEW POSITIONS/.test(strip) && /over cap/.test(strip) && /binaries/.test(strip));
ok("stance bar: badges and controls are real buttons — keyboard-reachable",
  (await page.locator("#stanceStrip button").count()) >= 4);
// v3.42 slice 2: driver rows are grid buttons — the primary datum sits right-aligned at
// --fs-l, and Enter activates the row like a click would.
ok("slice2: BUY and SELL rows render as focusable buttons with a promoted primary datum",
  (await page.locator("#buyBlock button.fdr-row").count()) >= 3 &&
  (await page.locator("#sellBlock button.fdr-row").count()) >= 1 &&
  (await page.locator("#buyBlock .fdr-p").count()) >= 3);
await page.locator("#buyBlock button.fdr-row").first().focus();
await page.keyboard.press("Enter");
ok("slice2: a BUY row activates from the keyboard — Enter opens the TT card",
  await page.evaluate(() => document.getElementById("overlay").classList.contains("on")));
await page.evaluate(() => closeCard());
ok("slice2: skeletons hold the SELL geometry while positions are pending, and never linger after",
  await page.evaluate(() => {
    const P = POSITIONS, f = POS_PENDING;
    POSITIONS = {}; POS_PENDING = true; render();
    const during = document.querySelectorAll("#sellBlock .skel-row").length > 0;
    POSITIONS = P; POS_PENDING = f; render();
    const after = document.querySelectorAll("#boardView .skel-row").length === 0;
    return during && after;
  }));
await page.evaluate(() => refreshRanks());
await page.waitForTimeout(600);
ok("refresh button refetches and reports, cache window named",
  /Ranks refreshed/.test(await page.locator("#toast").innerText()));

console.log("\n[render] FEAT-TT-RANKFAIR — held weight is a ranking input, not a footnote");
// AAA is 24000/178494 = 13.4% of the tracked book -> "*" (thin). EEE is options-only -> "◇".
const upRank = await txt(page, "upsideRank");
ok("a ranked pick carries the weight already held", /13\.4%\*/.test(upRank));
// v3.66 QUIET BOARD: the methodology (denominator, shared-horizon note, floor/premium
// definitions) moved one tap deep into the "how this list is ranked" est-mini. The facts
// must still EXIST — read them with the expander open, and pin that the summary invites it.
ok("the ranking methodology lives one tap deep — 'how this list is ranked' summary present",
  /how this list is ranked/i.test(upRank));
await page.evaluate(() => { document.querySelectorAll("#upsideRank details.est-mini").forEach(d => d.open = true); });
const upRankOpen = await txt(page, "upsideRank");
ok("the denominator is stated as tracked-book, never NAV",
  /% of TRACKED BOOK \(a floor/i.test(upRankOpen));
ok("queue names with no pt_model are NAMED rather than silently absent",
  /cannot be ranked here — no pt_model/.test(upRank));
// BBB is modelled but carries NO position — the ranking spans both universes and must say so.
ok("an unheld name is labelled, never left blank against a held one", /new — not held/.test(upRank));
// The load-bearing fix. The fixture circuit is TRIPPED, which short-circuits the whole
// agree block — so clear it first, or the veto path never executes and the test passes
// for the wrong reason. Restore both mutations before returning.
const capped = await page.evaluate(() => {
  const prevState = BOARD.circuit.state, prevMv = POSITIONS.AAA.mv, prevPx = LIVE_PX.AAA;
  // FIX-B (v3.49): the fixture's asserted PANIC regime now vetoes the whole agree block
  // before why() ever runs — clear it too, or the cap veto is unreachable (the same
  // passes-for-the-wrong-reason trap the circuit comment above describes).
  const prevReg = BOARD.regime;
  BOARD.regime = null;
  BOARD.circuit.state = "clear";
  // AAA must have a POSITIVE gap to reach the cap branch at all — why() returns "no gap"
  // first, and the fixture prices AAA ($800) above its nearest target ($400).
  LIVE_PX.AAA = { px: 300, chg: 0, at: prevPx.at };
  POSITIONS.AAA = { ...POSITIONS.AAA, mv: 999999 };   // ~85% of the tracked book
  render();
  const t = document.getElementById("upsideRank").innerText;
  const res = { over: /at the 18% cap, no room/.test(t), pick: AGREE_PICK ? AGREE_PICK.sym : null };
  BOARD.circuit.state = prevState; BOARD.regime = prevReg; POSITIONS.AAA = { ...POSITIONS.AAA, mv: prevMv }; LIVE_PX.AAA = prevPx;
  render();
  return res;
});
ok("a name over the cap is vetoed from the next dollar with its reason named", capped.over);
ok("...and is never left standing as AGREE_PICK", capped.pick !== "AAA");
// FIX-B (v3.49): with the circuit cleared but the session still asserting PANIC, the green
// line hard-WAITs at board level with the gate NAMED — driven live, not just source-pinned.
const gated = await page.evaluate(() => {
  const prevState = BOARD.circuit.state;
  BOARD.circuit.state = "clear";
  render();
  const t = document.getElementById("upsideRank").innerText;
  BOARD.circuit.state = prevState;
  render();
  return { wait: /eligibility gate failed/.test(t) && /ADDS SUSPENDED/.test(t), pick: AGREE_PICK ? AGREE_PICK.sym : null };
});
ok("FIX-B: an asserted PANIC stance vetoes eligibility, gate named in the WAIT box", gated.wait);
ok("FIX-B: no AGREE_PICK survives a failed eligibility gate", gated.pick === null);
await page.waitForTimeout(120);

console.log("\n[render] FEAT-TT-ESTRUN — the board expression inside NEXT DOLLAR");
const estBoard = await txt(page, "estRunBoard");
ok("every modelled name gets a row, denominator stated",
  /3 modelled of 7/i.test(estBoard) && /AAA/.test(estBoard) && /BBB/.test(estBoard));
// FEAT-TT-PTLINT (v3.39, D1+D2): this list used rows[0] (always nearest) while the ranking
// honoured the horizon — two altitudes of the same board naming different years. All three
// surfaces now share pickRow(), so every row here targets the horizon in force. The fixture's
// auto horizon is 2027: AAA and JJJ reach 2028 but BBB's estimates stop at 2027, and the auto
// rule picks the deepest year EVERY modelled name reaches.
ok("every row targets the horizon in force, not its own nearest rung (auto = 2027 here)",
  /\$451 by 2027/.test(estBoard) && /%\/yr/.test(estBoard) &&
  (estBoard.match(/by 2027/g) || []).length === 3 && !/by 2026/.test(estBoard));
await page.evaluate(() => { document.querySelector("#estRunBoard details").open = true; });
await page.waitForTimeout(120);
ok("a row expands to the SAME per-year table the deep dive renders",
  /2029/.test(await txt(page, "estRunBoard")) && /70/.test(await txt(page, "estRunBoard")));
ok("expanded state is tracked so an async re-render can't snap it shut",
  await page.evaluate(() => EST_OPEN.size === 1));
await page.evaluate(() => { window.location.hash = ""; document.querySelector('#estRunBoard details summary span[onclick*="switchTab"]').click(); });
await page.waitForTimeout(250);
ok("the tab link lands on that name's deep dive",
  await page.evaluate(() => document.getElementById("deepView").style.display !== "none"));
await page.evaluate(() => switchTab("BOARD"));
await page.waitForTimeout(150);

console.log("\n[render] deep-dive tab — four answers, corpus in drawers");
await page.evaluate(() => switchTab("AAA"));
await page.waitForTimeout(300);
// FEAT-TT-PTLINT (v3.39, D1): the default horizon is now COMPUTED (deepest year-end every
// modelled name reaches), so the assertions below — which pin a specific 2028 rung's arithmetic
// to test the SPREAD, not the horizon — pin the horizon explicitly first. This is the same
// action the owner takes by tapping the 2028 chip; auto-mode is asserted separately above.
await page.evaluate(() => setHorizon("2028"));
await page.waitForTimeout(120);
const dv = (await page.locator("#deepView").innerText()).replace(/\s+/g, " ");
ok("the four answers render above the corpus",
  /WHAT IT'S WORTH/i.test(dv) && /WHAT CHANGES MY MIND/i.test(dv) && /WHEN/i.test(dv) && /WHAT I OWN/i.test(dv));
// FEAT-TT-READY (v3.50): the consolidated statement sits ABOVE the four answers, and the
// red facts survive the consolidation (v3.25) — AAA carries a RED hinge, which must be
// named on the bar as a caution while never blocking (D3: the board reports, not enforces).
ok("ready: the readiness verdict leads the deep-dive tab, above the four answers",
  /DECISION READINESS/i.test(dv) &&
  dv.indexOf("DECISION READINESS") < dv.toUpperCase().indexOf("WHAT IT'S WORTH"));
ok("ready: every clock is stated on the bar — TT run, thesis, model, price, position, hinges",
  /TT run|TT never run/i.test(dv) && /thesis/i.test(dv) && /hinge/i.test(dv));
ok("ready: a RED hinge is named on the bar but never appears as a blocker (D3 doctrine)",
  /1 hinge RED/i.test(dv) && !/not actionable until:[^\n]*RED/i.test(dv));
ok("what-changes-my-mind names the red hinge", /1 red/.test(dv) && /demand/.test(dv));
// ═══ v3.73 TT-SCORE: the shadow scorecard panel — server result rendered verbatim ═══
// AAA's stub is UNSCORABLE/AWAITING_FALSIFIERS with a NO_FLOOR_PREPROFIT and a contingent
// premium: the panel must render the NAMED states and never a placeholder score.
await page.waitForTimeout(400);   // lazy score fetch lands and re-renders the tab
const dvS = (await page.locator("#deepView").innerText()).replace(/\s+/g, " ");
ok("score: the shadow panel renders between readiness and the four answers (§15 order)",
  /TT UNDERWRITING · SHADOW/i.test(dvS) &&
  dvS.indexOf("DECISION READINESS") < dvS.toUpperCase().indexOf("TT UNDERWRITING") &&
  dvS.toUpperCase().indexOf("TT UNDERWRITING") < dvS.toUpperCase().indexOf("WHAT IT'S WORTH"));
ok("score: AWAITING_FALSIFIERS and NO_FLOOR_PREPROFIT render as NAMED states, never a score",
  /AWAITING_FALSIFIERS/.test(dvS) && /NO_FLOOR_PREPROFIT/.test(dvS));
ok("score: the bootstrap head LEADS with the measurable diagnostic, never the blocker count",
  /\$382 2027 · \+45\.75%\/yr/.test(dvS) && /bootstrap 0\/4 pillars/.test(dvS) &&
  !/13 blockers/.test(dvS));
await page.evaluate(() => { document.querySelectorAll("#deepView details.schema").forEach((d) => { d.open = true; }); });
const dvSO = (await page.locator("#deepView").innerText()).replace(/\s+/g, " ");
ok("score: the contingent premium is labelled CONTEXT ONLY with no pillar contribution",
  /CONTEXT ONLY/.test(dvSO) && /contingent premium \$382/.test(dvSO));
ok("score: a normalized legacy gate label shows its raw state for audit",
  /AI_G3_2028_BRIDGE UNKNOWN/.test(dvSO) && /was: DEMANDING-BUT-CREDIBLE/.test(dvSO));
// BBB's stub is a COMPLETE shadow score (B) against a legacy S composite — during shadow
// the disagreement renders as WAIT — methods disagree, and legacy keeps governing.
await page.evaluate(() => switchTab("BBB"));
await page.waitForTimeout(500);
await page.evaluate(() => { document.querySelectorAll("#deepView details.schema").forEach((d) => { d.open = true; }); });
const dvB = (await page.locator("#deepView").innerText()).replace(/\s+/g, " ");
ok("score: a complete shadow score that disagrees with legacy renders WAIT — methods disagree",
  /WAIT — methods disagree/.test(dvB) && /legacy S vs TT B/.test(dvB) && /legacy governs/i.test(dvB));
ok("score: the legacy composite is relabelled LEGACY \/ UNVERIFIED inside the panel (one home)",
  /LEGACY \/ UNVERIFIED/.test(dvB) && /governs the board until activation/.test(dvB));
await page.evaluate(() => switchTab("AAA"));
await page.waitForTimeout(150);
ok("what-I-own reads the measured position", /21\.4% of acct equity/.test(dv) && /30 sh/.test(dv));
ok("when carries the next dated event", /own print/.test(dv));
// FEAT-TT-OWNDEBT (v3.35): the own cell renders what the sync measured — all of it.
ok("own cell carries cost basis, colored unrealized P/L and the source",
  /cost \$18k/.test(dv) && /\+33\.3% unrl/.test(dv) && /src test/.test(dv));
ok("the option legs table renders beside the thesis they express (strikeless put shown without a strike)",
  /Option legs \(1\)/i.test(dv) && /strike shown only where captured/.test(dv));

console.log("\n[render] FEAT-TT-ESTRUN — the estimate run + dual PTs, above the fold");
ok("the section label carries the tier — the math renders under the tier claim",
  /ESTIMATE RUN — WATCHLIST/i.test(dv));
ok("per-year YoY growth renders beside the estimates (rev 62→70 = +12.9%)",
  /\+12\.9%/.test(dv) && /\+13%/.test(dv));
ok("the PT columns join the SAME rows ptModelRows computed ($509 by 2028 · 8× EV/S)",
  /\$509/.test(dv) && /8× EV\/S/.test(dv));
ok("upside prices the best target against the live quote (509/800 → -36.4%)",
  /-36\.4%/.test(dv));
ok("the old split sections are gone — one table, one year axis",
  !/Consensus estimates/i.test(dv) && !/PT ladder — computed from inputs/i.test(dv));

// SHOTS=/path/prefix → drop full-page screenshots for a human eyeball pass (never in CI).
if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "-desktop-dd.png", fullPage: true });

console.log("\n[render] FEAT-TT-SPREAD — the worth cell confronts market vs mine");
// AAA's 2028 row (fwd 2029, rev $70B, 8x, 1100M sh) prices $509; at the live $800 quote
// that implies the market is paying ~12.57x FY+1 revenue against the 8x underwritten.
ok("the spread inverts the SAME row the ladder computed (never a second number)",
  /market pays 12\.57× FY\+1 vs you 8×/.test(dv));
ok("the spread states what % of the case the market already credits",
  /credits 157\.2% of your 2028 case/.test(dv));
ok("street PT (pt_consensus, non-bear columns averaged) is confronted against mine",
  /street ~\$485 vs mine \$509/.test(dv));

console.log("\n[render] FEAT-TT-LEDGER — the per-name HISTORY drawer");
// AAA's ledger carries 3 entries fetched lazily on tab open; wait for that fetch to land.
await page.waitForTimeout(400);
// textContent, not innerText: the summary is still CLOSED here (drawers don't force-open
// on data arrival) AND its CSS text-transform:uppercase would rewrite "3 changes" to
// "3 CHANGES" — the same closed-drawer / case-transform traps this file already documents.
const histSummary = page.locator("#deepView details.drawer > summary", { hasText: "HISTORY" });
const histSumTxt = await histSummary.textContent();
ok("history summary carries the count and the latest change while it could be closed",
  /HISTORY/i.test(histSumTxt) && /3 changes/i.test(histSumTxt) && /TIER A → WATCH/.test(histSumTxt));

const ddSums = (await page.locator("#deepView details.drawer > summary").allInnerTexts()).join(" | ");
ok("valuation summary carries the computed target", /VALUATION/i.test(ddSums));
ok("thesis summary carries the failing gate count", /1\/2 GATES FAILING/i.test(ddSums));
ok("an unknown payload key is NAMED, never invisible", /SOME_UNKNOWN_BLOCK/i.test(ddSums));
await page.evaluate(() => document.querySelectorAll("#deepView details.drawer").forEach((d) => (d.open = true)));
await page.waitForTimeout(100);
const dvOpen = (await page.locator("#deepView").innerText()).replace(/\s+/g, " ");
ok("every stored section is reachable when expanded",
  /alpha/.test(dvOpen) && /runway_q/.test(dvOpen) && /kill/i.test(dvOpen) && /bookings/.test(dvOpen));
ok("history timeline shows the tier flip with its price stamp and since-move (now expanded)",
  /TIER A → WATCH[\s\S]{0,20}@ \$700[\s\S]{0,30}\+14\.3%/.test(dvOpen));
ok("history timeline also carries the hinge flip and the run stamp (every kind, not just tier)",
  /HINGE demand: green → red/.test(dvOpen) && /TT RUN stamped 2026-07-20/.test(dvOpen));
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
// ── FEAT-TT-PTLINT (v3.39) — the PT chain's guards, rendered ────────────────
console.log("\n[render] FEAT-TT-PTLINT — model lints, auto horizon, derived marks, leg provenance");
await page.evaluate(() => { setHorizon("auto"); switchTab("BOARD"); });
await page.waitForTimeout(200);
await page.evaluate(() => { document.querySelectorAll("#upsideRank details.est-mini").forEach(d => d.open = true); });
const rankTxt = await txt(page, "upsideRank");
// D1: the auto pick must SAY it is auto and say WHY — an auto horizon that looked deliberate is
// how "2028" survived long enough to silently drop three modelled names from the ranking.
ok("the auto horizon states itself and its rule, never passing as a deliberate choice",
  /auto · year-end 2027/i.test(rankTxt) && /deepest year EVERY modelled name reaches/i.test(rankTxt));
// Every modelled+priced name must appear — the D1 bug was that a pinned year silently dropped
// names whose estimates ended earlier. Asserted as a PROPERTY (all three modelled names ranked,
// no drop notice) rather than a tally: an earlier handoff-merge test adds a name to BOOK, so a
// hardcoded denominator here would be test-order dependent.
ok("every modelled+priced name is ranked at the auto horizon (nothing silently dropped)",
  /AAA/.test(rankTxt) && /BBB/.test(rankTxt) && /JJJ/.test(rankTxt) &&
  !/dropped for having no/.test(rankTxt) && /all % share the 2027 horizon/i.test(rankTxt));

// The whole-book lint: a mis-keyed schedule must be named at the altitude the ranking is read,
// not only on a tab nobody opened. Mutated in-page then restored, so no fixture count shifts.
const lintSeen = await page.evaluate(() => {
  const keep = JSON.parse(JSON.stringify(BOOK[0].deepDive.pt_model));
  // Key the schedule at the ESTIMATE years instead of the year-end priced — the NVDA bug.
  BOOK[0].deepDive.pt_model.ev_s_multiple = { 2028: 8, 2029: 7 };
  render();
  const board = document.getElementById("upsideRank").innerText;
  switchTab("AAA");
  const tab = document.getElementById("deepView").innerText;
  BOOK[0].deepDive.pt_model = keep;
  switchTab("BOARD"); render();
  return { board, tab };
});
ok("a mis-keyed multiple schedule is named on the BOARD, not just buried on its tab",
  /MIS-KEYED/i.test(lintSeen.board) && /AAA/.test(lintSeen.board) &&
  /the rung shown is a floor fallback/i.test(lintSeen.board));
ok("...and the name's own tab explains it, naming the year-end-priced convention",
  /MISKEY/.test(lintSeen.tab) && /YEAR-END PRICED/i.test(lintSeen.tab));
await page.waitForTimeout(150);

// D4 + derived marks live on the deep-dive tab.
await page.evaluate(() => switchTab("AAA"));
await page.waitForTimeout(250);
const der = await page.evaluate(() => {
  const dv = document.getElementById("deepView");
  return { cells: dv.querySelectorAll("td.derived").length, txt: dv.innerText,
           legs: dv.innerText };
});
ok("derived estimate cells are marked, and the marker PROPAGATES to targets computed off them",
  // FY2027 rev + eps + that row's floor + the 2026 rung's premium and upside cells.
  der.cells >= 4 && /°/.test(der.txt));
ok("the derived legend says what italic means — an extrapolation, not a pulled analyst row",
  /DERIVED/.test(der.txt) && /not a pulled analyst row/i.test(der.txt));
ok("per-leg provenance renders, and the footer no longer claims broker sync for every leg",
  /\bsync\b/.test(der.legs) && /verify side/i.test(der.legs) &&
  !/from broker sync ·/.test(der.legs));
const unrec = await page.evaluate(() => {
  const keep = JSON.parse(JSON.stringify(POSITIONS.AAA));
  POSITIONS.AAA.opt = [{ k: "call", side: "short", n: 1, exp: "2029-01-19" }];   // no src
  renderDeepDive("AAA");
  const t = document.getElementById("deepView").innerText;
  POSITIONS.AAA = keep; renderDeepDive("AAA");
  return t;
});
ok("a leg with NO provenance reads as unrecorded — never assumed to be broker data",
  /no provenance recorded on 1 leg/i.test(unrec) && /not verifiable as broker data/i.test(unrec));
await page.evaluate(() => switchTab("BOARD"));
await page.waitForTimeout(150);

console.log("\n[render] slice 3 — book chips and the tab strip are keyboard-reachable");
ok("tab strip: role=tablist with one roving tabindex (only the active tab is Tab-reachable)",
  await page.evaluate(() => {
    const bar = document.getElementById("tabBar");
    const tabs = [...bar.querySelectorAll('[role="tab"]')];
    return bar.getAttribute("role") === "tablist" &&
      tabs.filter((t) => t.tabIndex === 0).length === 1 &&
      tabs.find((t) => t.dataset.tid === "BOARD").getAttribute("aria-selected") === "true";
  }));
await page.locator('#tabBar .tab[data-tid="BOARD"]').focus();
await page.keyboard.press("ArrowRight");
ok("tab strip: ArrowRight moves AND selects the next tab, focus follows",
  await page.evaluate(() => TAB === "AAA" &&
    document.activeElement === document.querySelector('#tabBar .tab[data-tid="AAA"]')));
await page.keyboard.press("End");
ok("tab strip: End jumps to the last tab",
  await page.evaluate(() => document.activeElement.dataset.tid === document.querySelector("#tabBar .tab:last-child").dataset.tid));
await page.evaluate(() => switchTab("BOARD"));
await page.waitForTimeout(120);

ok("book chips are real buttons — Enter opens the card, same as a click",
  await page.evaluate(() => document.querySelector("#board .tier.S .chip") instanceof HTMLButtonElement));
await page.locator("#board .tier.S .chip").first().focus();
await page.keyboard.press("Enter");
ok("a chip activates from the keyboard", await page.evaluate(() => document.getElementById("overlay").classList.contains("on")));
await page.evaluate(() => closeCard());
await page.waitForTimeout(80);

console.log("\n[render] FEAT-TT-CAPEX — tape, tripwire, conservation, typed exposure");
await page.evaluate(() => { document.getElementById("dDesk").open = true; document.getElementById("dCapex").open = true; });
await page.waitForTimeout(100);
const cxPanel = await txt(page, "capexPanel");
// FEAT-TT-CAPABILITY (v3.55): supply and demand render in ONE panel — capex is what is being
// spent, capability trajectory is whether it stays worth spending.
ok("capability: the tripped demand falsifier renders with both numbers named",
  /THESIS FALSIFIER TRIPPED/.test(cxPanel) && /20mo doubling is past your pre-committed 18mo/.test(cxPanel));
ok("capability: the threshold's BASIS renders, so the number stays checkable later",
  /threshold basis: synthetic basis/.test(cxPanel));
ok("capability: it states the metric, the source and that it is NOT extrapolated",
  /task-horizon doubling \(synthetic\)/.test(cxPanel) && /source fixture/.test(cxPanel) &&
  /deliberately NOT extrapolated/.test(cxPanel));
ok("capex: the tripwire banner fires at 2 of 3 down, naming the typed transmission order",
  /CAPEX REGIME TURNING/.test(cxPanel) && /2 of 3/.test(cxPanel) && /Direct names take it first/.test(cxPanel));
ok("capex: the conservation lint computes AAA's implied draw (55 × 40% = $22B) against the $18B pool and BREACHES",
  /\$22B/.test(cxPanel) && /122%/.test(cxPanel) && /more capex than the spenders have guided/.test(cxPanel) && /AAA/.test(cxPanel));
ok("capex: fab and neocloud are excluded WITH their reasons, and the neocloud shows its own 1× capex/rev",
  /JJJ/.test(cxPanel) && /double-counts/.test(cxPanel) &&
  /BBB/.test(cxPanel) && /two-sided/.test(cxPanel) && /1×/.test(cxPanel));
ok("capex: the closed drawer summary carries the red count (v3.25 — a collapse never hides it)",
  /2 of 3 down/i.test(await txt(page, "sCapex")));   // drawer summaries are CSS-uppercased
// v3.55: the fixture now has BOTH legs red (capex turning + demand falsified), so the strip
// carries the MERGED badge — one chip for one thesis, one drawer. The capex-only and
// demand-only forms are pinned at source in smoke.
ok("capex: the stance strip carries the ⚡ badge while everything is closed",
  /⚡ AI both legs/.test(await txt(page, "stanceStrip")));
await page.evaluate(() => switchTab("AAA"));
await page.waitForTimeout(250);
await page.evaluate(() => document.querySelectorAll("#deepView details").forEach((d) => (d.open = true)));
await page.waitForTimeout(120);
const cxDd = await page.evaluate(() => document.getElementById("deepView").innerText);
ok("capex: AAA's deep dive renders the typed exposure (direct, 40%, via the tracked spenders)",
  /Hyperscaler-capex exposure/i.test(cxDd) && /DIRECT/.test(cxDd) && /40%/.test(cxDd) && /HYPA/.test(cxDd));
ok("tokw: BBB's neocloud tab decomposes the power envelope — fleet 3.10× vs frontier 4.50× " +
  "= 69%, capacity 3.00×, productive ≈ 2.07× — beside utilization, never inside it",
  await (async () => { await page.evaluate(() => switchTab("BBB")); await page.waitForTimeout(250);
    await page.evaluate(() => document.querySelectorAll("#deepView details").forEach((d) => (d.open = true)));
    await page.waitForTimeout(120);
    const t = await page.evaluate(() => document.getElementById("deepView").innerText);
    return /Tokens\/watt/i.test(t) && /3\.10×/.test(t) && /4\.50×/.test(t) && /69%/.test(t) &&
           /100MW → 300MW/.test(t) && /3\.00×/.test(t) && /2\.07×/.test(t) &&
           /Before utilization and before \$\/token/.test(t) && !/\$\d+\s*\/\s*MW/.test(t); })());
ok("tokw: a partial mix reads as a FLOOR and an undated block says so — the fail-closed " +
  "path renders the shortfall rather than an implied average",
  await (async () => { await page.evaluate(() => switchTab("JJJ")); await page.waitForTimeout(250);
    await page.evaluate(() => document.querySelectorAll("#deepView details").forEach((d) => (d.open = true)));
    await page.waitForTimeout(120);
    const t = await page.evaluate(() => document.getElementById("deepView").innerText);
    return /mix sums to 80%/.test(t) && /FLOOR/.test(t) && /undated/i.test(t) &&
           /capacity leg unmeasured/i.test(t); })());
await page.evaluate(() => switchTab("BOARD"));
await page.waitForTimeout(150);

console.log("\n[render] slice 4 — modal focus management, destructive confirm, live toast");
await page.locator("#board .tier.S .chip").first().click();
await page.waitForTimeout(120);
ok("opening a card moves focus INSIDE it — never left stranded on the page behind it",
  await page.evaluate(() => document.querySelector("#overlay .card").contains(document.activeElement)));
const trapped = await page.evaluate(() => {
  const card = document.querySelector("#overlay .card");
  const foc = [...card.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')]
    .filter((el) => el.offsetParent !== null);
  return { count: foc.length, firstId: foc[0]?.id || foc[0]?.tagName, lastId: foc[foc.length - 1]?.id || foc[foc.length - 1]?.tagName };
});
ok("the card has a real focusable boundary to trap (more than zero controls)", trapped.count > 0);
await page.evaluate(() => document.querySelector("#overlay .card button,#overlay .card [href],#overlay .card input,#overlay .card select,#overlay .card textarea")?.focus());
await page.keyboard.press("Shift+Tab");
ok("Shift+Tab from the FIRST control wraps to the LAST — focus can't escape the modal backward",
  await page.evaluate(() => {
    const card = document.querySelector("#overlay .card");
    const foc = [...card.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
    return document.activeElement === foc[foc.length - 1];
  }));
await page.keyboard.press("Escape");
await page.waitForTimeout(80);
ok("Escape closes the card AND returns focus to the chip that opened it",
  !(await page.evaluate(() => document.getElementById("overlay").classList.contains("on"))) &&
  (await page.evaluate(() => document.activeElement && document.activeElement.className.includes("chip"))));

// v3.42 slice 4c: the destructive save-banner actions need a SECOND click within the confirm
// window. Drive showUnsaved() directly (no network dependency) and click the discard link twice.
await page.evaluate(() => showUnsaved("simulated failure", undefined));
const firstClickLabel = await page.evaluate(() => {
  document.getElementById("cfDiscard").click();
  return document.getElementById("cfDiscard").textContent;
});
ok("first click on a destructive banner link ARMS it — it does not fire the action yet",
  /confirm — really/i.test(firstClickLabel) &&
  (await page.locator("#saveBanner").innerText()).includes("simulated failure"));
await page.evaluate(() => document.getElementById("cfDiscard").click());
await page.waitForTimeout(150);
ok("the second click within the window runs the real action (discardLocal reloads the book)",
  await page.evaluate(() => document.getElementById("saveBanner").style.display === "none"));

// The confirm must also EXPIRE — an armed link left alone must not stay armed forever.
await page.evaluate(() => showUnsaved("expiry check"));
const armedLabel = await page.evaluate(() => { document.getElementById("cfDiscard").click(); return document.getElementById("cfDiscard").textContent; });
await page.waitForTimeout(4300);
const revertedLabel = await page.evaluate(() => document.getElementById("cfDiscard")?.textContent);
ok("an armed confirm reverts its label on its own after the window elapses",
  /confirm — really/i.test(armedLabel) && revertedLabel === "discard & reload server copy");
await page.evaluate(() => { document.getElementById("saveBanner").style.display = "none"; });

ok("the toast element is a live region (role=status, aria-live=polite) — announced without focus",
  await page.evaluate(() => {
    const t = document.getElementById("toast");
    return t.getAttribute("role") === "status" && t.getAttribute("aria-live") === "polite";
  }));

console.log("\n[render] slice 5 — only the highest-leverage things survive the first glance");
ok("slice5: the MACRO pill drops the year when it IS the current year, so it fits one header row",
  /·\s\d{2}-\d{2}$/.test((await txt(page, "regimePill")).trim()));
ok("slice5: the header's status + toolbar start hidden behind ⋯ MENU, and the pill stays out",
  await page.evaluate(() => document.getElementById("headInfo").style.display === "none" &&
    document.getElementById("regimePill").offsetParent !== null &&
    document.getElementById("headToggle").getAttribute("aria-expanded") === "false"));
await page.evaluate(() => toggleHeadInfo());
ok("slice5: ⋯ MENU reveals BOOK/AUTH and the action toolbar, and reports aria-expanded",
  await page.evaluate(() => document.getElementById("headInfo").style.display !== "none" &&
    document.getElementById("bookStamp").offsetParent !== null &&
    document.getElementById("backupToggle").offsetParent !== null &&
    document.getElementById("headToggle").getAttribute("aria-expanded") === "true"));
await page.evaluate(() => toggleHeadInfo());
// The asymmetry, driven live: flip the fixture from its tripped/PANIC state to a fully
// permissive one and confirm the strip collapses to a pill while the red badges survive.
const perm = await page.evaluate(() => {
  const keepC = BOARD.circuit.state, keepA = BOARD.regime.asserted, keepM = REGIME.regime.verdict;
  BOARD.circuit.state = "clear"; BOARD.regime.asserted = "TAILWIND"; REGIME.regime.verdict = "TAILWIND";
  render();
  const el = document.getElementById("stanceStrip");
  const res = {
    txt: el.innerText, vbadge: el.querySelectorAll(".vbadge").length,
    why: el.querySelectorAll("details.why").length,
    pill: (el.querySelector(".qual") || {}).textContent || "",
    h: Math.round(el.querySelector(".stance-top").getBoundingClientRect().height),
  };
  BOARD.circuit.state = keepC; BOARD.regime.asserted = keepA; REGIME.regime.verdict = keepM;
  render();
  return res;
});
ok(`slice5: a permissive stance collapses to a small pill — no token, no why drawer (${perm.h}px)`,
  perm.vbadge === 0 && perm.why === 0 && /ADDS OK/.test(perm.pill) && perm.h < 90);
ok("slice5: ...but its red badges still render — a collapse never hides a red fact",
  /over cap/.test(perm.txt) && /binaries/.test(perm.txt));
ok("slice5: a restrictive stance still gets the full token + why drawer treatment",
  (await page.locator("#stanceStrip .vbadge").count()) === 1 &&
  (await page.locator("#stanceStrip details.why").count()) === 1);

await page.close();

// ── phone pass ──────────────────────────────────────────────────────────────
console.log("\n[render] phone (390px) — the daily answer above the book");
// v3.62: use the phone HEIGHT named by this pass. A 2200px test viewport made 100svh
// resolve to 2200px, so it could not truthfully exercise a viewport-height mobile surface.
const phone = await open(390, 844);
const tY = (await phone.locator("#stanceStrip").boundingBox()).y;
const bY = (await phone.locator("#board").boundingBox()).y;
const dailySpan = Math.round(bY - tY);
ok("the stance strip leads the primary view, above the book", tY < bY);
// v3.62: BUY and FUNDING are now horizontal alternatives, not two vertically stacked
// answers. The hidden panel must not set the page height; one focus view plus the calendar
// and the start of the book still fit inside the old two-screen budget.
ok(`one decision focus view + calendar reaches the book inside two phone screens (${dailySpan}px)`,
  dailySpan < 1688);
// v3.42 READABLE DESK: the old stance strip wrapped ~5 lines of prose at 390px; the bar's
// top row (token + chips + badges) must stay compact with the why drawer closed.
const stanceTopH = (await phone.locator("#stanceStrip .stance-top").boundingBox()).height;
ok(`stance bar top row is compact at 390px — token and chips, never five lines of prose (${stanceTopH}px)`,
  stanceTopH < 140);
ok("the tab strip is ONE row at 390px — it scrolls horizontally, it never wraps",
  (await phone.locator("#tabBar").boundingBox()).height < 60);
// v3.62 FEAT-TT-DECK: the two capital-allocation answers are phone focus views. The buttons
// are the accessible contract; scroll-snap is an optional touch shortcut.
ok("decision deck: SHARE RANKS is visible without opening MENU",
  await phone.locator("header .hb-ranks").isVisible() &&
  !(await phone.locator("#headInfo").isVisible()));
ok("decision deck: two labelled controls exist and BUY starts selected",
  (await phone.locator('.decision-tabs [role="tab"]').count()) === 2 &&
  (await phone.locator("#decisionBuyTab").getAttribute("aria-selected")) === "true" &&
  (await phone.locator('.decision-tabs [role="tab"][tabindex="0"]').count()) === 1 &&
  await phone.locator("#decisionFund").getAttribute("inert") !== null);
// FEAT-TT-DECK follow-up (H1 2026-08-03, R4/R7): AAA sits at 21.4%, over the 18% cap — a
// real forced trim in this fixture. It must surface as a RED count on the CLOSED tab, and
// the owner's "do not auto-open" call means the default selection must be untouched by it —
// nothing may silently flip the panel just because there is something forced to see. Resolve
// --red through a probe rather than copying its hex: the assertion must fail if the rendered
// badge changes to amber even when its text remains correct (H3 negative control).
const fundCountIsRed = await phone.locator("#fundTabCount > span").evaluate((el) => {
  const probe = document.createElement("span");
  probe.style.color = "var(--red)";
  document.body.appendChild(probe);
  const expected = getComputedStyle(probe).color;
  probe.remove();
  return getComputedStyle(el).color === expected;
});
const fundTabText = await phone.locator("#decisionFundTab").textContent();
ok('decision deck: a forced cap trim shows as a RED count on the closed FUND / TRIM tab, and never auto-opens it',
  /^FUND \/ TRIM · [1-9]\d* FORCED$/.test(fundTabText) &&
  fundCountIsRed &&
  (await phone.locator("#decisionBuyTab").getAttribute("aria-selected")) === "true" &&
  await phone.locator("#decisionFund").getAttribute("inert") !== null);
// R1 (H5 finding, confirmed vacuous): the old assertion called decisionGo(1) directly, which
// never exercises onscroll="syncDecisionDeck()" — the actual swipe path. Drive a REAL scroll.
await phone.evaluate(() => {
  const d = document.getElementById("decisionDeck");
  d.scrollLeft = d.clientWidth;
  d.dispatchEvent(new Event("scroll"));
});
await phone.waitForTimeout(50);
ok("decision deck: a REAL horizontal scroll (not a decisionGo() call) flips the selected tab — the swipe path itself is exercised",
  (await phone.locator("#decisionFundTab").getAttribute("aria-selected")) === "true" &&
  await phone.locator("#decisionBuy").getAttribute("inert") !== null &&
  await phone.locator("#decisionFund").getAttribute("inert") === null);
await phone.evaluate(() => decisionGo(0));
await phone.waitForTimeout(350);
// R2: a real .click() on the button — depends on onclick="decisionGo(1)" actually being
// wired in the markup, which calling decisionGo() directly would not have caught.
await phone.locator("#decisionFundTab").click();
await phone.waitForTimeout(350);
const fundDeck = await phone.evaluate(() => {
  const d=document.getElementById("decisionDeck");
  return { ratio:d.clientWidth?d.scrollLeft/d.clientWidth:0,
    selected:document.getElementById("decisionFundTab").getAttribute("aria-selected") };
});
ok("decision deck: FUND / TRIM is reachable through a real click on the tab button (the onclick wiring)",
  fundDeck.ratio > .8 && fundDeck.selected === "true" &&
  await phone.locator("#decisionBuy").getAttribute("inert") !== null &&
  await phone.locator("#decisionFund").getAttribute("inert") === null);
await phone.evaluate(() => decisionGo(0));
await phone.waitForTimeout(350);
// v3.67: the deck height is a BUDGET, not a floor — it shrinks to the active panel's
// content (min 180) and never exceeds max(520, viewport−220). A short BUY list no longer
// rents a blank half-screen; a tall panel still scrolls inside the same ceiling.
ok("decision deck: panel height stays within the v3.67 budget (shrinks to content, caps at viewport budget)",
  await phone.evaluate(() => {
    const h = document.getElementById("decisionBuy").getBoundingClientRect().height;
    const budget = Math.max(520, Math.round((window.visualViewport ? visualViewport.height : innerHeight) - 220));
    return h >= 180 && h <= budget + 2;
  }));

// R3/R5/R6 (H1 §7): run on a DEDICATED phone page, not the shared one above — v3.57 already
// lost time to a shared closure leaking state between fixtures; a separate page makes that
// structurally impossible rather than dependent on every mutation's restore executing.
const phone2 = await open(390, 844);
// R6: positions still in flight must read as unmeasured-loading, never a false zero.
const pending = await phone2.evaluate(() => {
  const P = POSITIONS, f = POS_PENDING;
  POSITIONS = {}; POS_PENDING = true; render();
  const txt = document.getElementById("decisionFundTab").textContent;
  POSITIONS = P; POS_PENDING = f; render();
  return txt;
});
ok(`decision deck: positions still loading reads "…", never a false zero (was "${pending}")`,
  pending === "FUND / TRIM · …");
// The H1 open decision (§5, adopted recommendation): loaded, but bookRollup().mv <= 0 means
// sellRank() itself returns null — nothing is MEASURED, which must not fall through to the
// plain checked-clear label (that would assert a clear the board never checked, §P.2/§P.3).
const unmeasured = await phone2.evaluate(() => {
  const P = POSITIONS, f = POS_PENDING;
  POSITIONS = {}; POS_PENDING = false; render();
  const txt = document.getElementById("decisionFundTab").textContent;
  POSITIONS = P; POS_PENDING = f; render();
  return txt;
});
ok(`decision deck: loaded with nothing measured reads "?", never the plain checked-clear label (was "${unmeasured}")`,
  unmeasured === "FUND / TRIM · ?");
// R5: nothing over cap must read as a plain, honest checked-clear — no stale suffix.
const clear = await phone2.evaluate(() => {
  const P = POSITIONS, f = POS_PENDING;
  POSITIONS = { ...POSITIONS, AAA: { ...POSITIONS.AAA, pct: 5 } };
  POS_PENDING = false; render();
  const txt = document.getElementById("decisionFundTab").textContent;
  POSITIONS = P; POS_PENDING = f; render();
  return txt;
});
ok(`decision deck: nothing over cap reads the plain, honest "FUND / TRIM" — no stale suffix (was "${clear}")`,
  clear === "FUND / TRIM");
// R3 (H5 finding, confirmed vacuous in BOTH conjuncts): the shared fixture only ever yields
// 2 discretionary rows, so the old "<=6 rows, some details.est-mini exists" assertion never
// actually observed a tail — and the est-mini it found was the unconditional "how this list
// is ranked" methodology expander, a different element. Extend the fixture IN-PAGE (cloning
// BBB's modelled shape) rather than the shared BOOK/POSITIONS globals, which would ripple
// into tier counts, cluster sums, the BUY top-5 and the rankings export.
const extraDisc = ["G1", "G2", "G3", "G4", "G5", "G6"].map((sym, i) =>
  ({ sym, tier: "WATCH", lens: "AI", lastRun: etDaysAgo(1),
    deepDive: dd(100 + i, { 2027: 9, 2028: 11 }, { 2027: 18, 2028: 22 }) }));
const extraPos = {};
extraDisc.forEach((e, i) => { extraPos[e.sym] = POS(10, 1000 + i, 2 + i); });
const tail = await phone2.evaluate(({ book, pos }) => {
  const B = BOOK, P = POSITIONS, f = POS_PENDING;
  BOOK = [...BOOK, ...book]; POSITIONS = { ...POSITIONS, ...pos }; POS_PENDING = false;
  render();
  const sellEl = document.getElementById("sellBlock");
  const directRows = sellEl.querySelectorAll(":scope > button.fdr-row").length;
  const tailDetails = [...sellEl.querySelectorAll("details.est-mini")]
    .find((d) => d.querySelector("summary").textContent.includes("lower-priority funding sources"));
  const tailRows = tailDetails ? tailDetails.querySelectorAll(".fdr-row").length : -1;
  const tailSummary = tailDetails ? tailDetails.querySelector("summary").textContent : "";
  BOOK = B; POSITIONS = P; POS_PENDING = f; render();
  return { directRows, tailRows, tailSummary };
}, { book: extraDisc, pos: extraPos });
ok(`decision deck: exactly 5 discretionary rows show by default with 8 total; the rest are counted, not hidden (direct=${tail.directRows}, tail=${tail.tailRows}, "${tail.tailSummary}")`,
  tail.directRows === 6 &&   // 1 forced + 5 visible discretionary
  tail.tailRows === 3 &&     // 8 disc - 5 visible = 3 in the tail
  /\+3 lower-priority funding sources/.test(tail.tailSummary) &&
  /8 ranked total/.test(tail.tailSummary));
await phone2.close();
// v3.42 slice 5 — the headline metric. Measured at 390x844 before this slice: the BUY block
// began at y=587 of an 844px viewport, so 70% of the first screen was spent on chrome before
// the first answer (the header alone was 209px of it). These budgets are the whole point of
// the slice; if chrome creeps back, this fails rather than quietly eating the fold again.
// BOTH states are pinned, because they are deliberately different sizes: this fixture runs
// RESTRICTIVE (tripped circuit), which keeps the full-size stance bar on purpose, while the
// everyday PERMISSIVE board collapses it to a pill.
const buyTopRestrictive = Math.round((await phone.locator("#buyBlock").boundingBox()).y);
const buyTopPermissive = await phone.evaluate(() => {
  const keepC = BOARD.circuit.state, keepA = BOARD.regime.asserted, keepM = REGIME.regime.verdict;
  BOARD.circuit.state = "clear"; BOARD.regime.asserted = "TAILWIND"; REGIME.regime.verdict = "TAILWIND";
  render();
  const y = Math.round(document.getElementById("buyBlock").getBoundingClientRect().y + window.scrollY);
  BOARD.circuit.state = keepC; BOARD.regime.asserted = keepA; REGIME.regime.verdict = keepM;
  render();
  return y;
});
// This fixture carries three red badges (a cap breach, binaries in window, and a changed
// count), which wrap the stance strip to ~2 rows — that is legitimate high-leverage content,
// not chrome, so the permissive budget accounts for it rather than pretending it away.
// v3.45: the fixture's turning capex tape adds a FOURTH red badge to the strip — legitimate
// red content, not chrome, so the budget moves with it (was <360 at three badges).
// The 42px labelled view switcher is now part of the answer, not expendable chrome. Keep
// the first ranked row in the upper half of the phone while budgeting that accessible control.
ok(`slice5: on an everyday PERMISSIVE board the first ANSWER is high on screen — BUY at y=${buyTopPermissive} of 844, was 587`,
  buyTopPermissive < 450);
// FEAT-TT-DECK follow-up (H1 2026-08-03): the forced-trim count on FUND / TRIM is a
// deliberate two-line badge (measured: the 22-char "FUND / TRIM · 1 FORCED" does not fit
// beside the label in a ~128px monospace tab, so it wraps unpredictably unless forced onto
// its own line) — legitimate red content restoring a v3.25 violation, not chrome, so the
// budget moves with it, same precedent as the v3.45 capex badge (was <460 with no count).
ok(`slice5: even RESTRICTIVE (full stance bar, by design) the BUY block still clears the fold — y=${buyTopRestrictive}`,
  buyTopRestrictive < 475);
ok("every drawer starts closed except what-changed",
  (await phone.locator("#boardView details.drawer[open]").count()) <= 1);
ok("no horizontal overflow at 390px",
  await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
// v3.35 fixpack: the deep-dive tables were the actual overflow risk — the board assert
// above never exercised them. Switch to a tab with every table type, open everything.
await phone.evaluate(() => switchTab("AAA"));
await phone.waitForTimeout(300);
await phone.evaluate(() => document.querySelectorAll("#deepView details").forEach((d) => (d.open = true)));
await phone.waitForTimeout(150);
ok("no horizontal overflow at 390px on a deep-dive tab with all sections open",
  await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
ok("slice3: dd-pt table headers are sticky at 390px so a scrolled row keeps its column labels",
  await phone.evaluate(() => {
    const th = document.querySelector("table.dd-pt th");
    return !!th && getComputedStyle(th).position === "sticky";
  }));
// FEAT-TT-ESTRUN: the board expression must also scroll inside its container on a phone.
await phone.evaluate(() => switchTab("BOARD"));
await phone.waitForTimeout(200);
await phone.evaluate(() => {
  document.getElementById("dNext").open = true;
  const d = document.querySelector("#estRunBoard details"); if (d) d.open = true;
});
await phone.waitForTimeout(150);
ok("no horizontal overflow at 390px with a board estimate-run row expanded",
  await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
if (process.env.SHOTS) await phone.screenshot({ path: process.env.SHOTS + "-phone-board.png", fullPage: true });
await phone.close();

ok("no page errors at either width", errors.length === 0 || (console.log(errors), false));

// ── FEAT-DERIV-OWN (v3.41): the MACRO pill must distinguish "cannot see" from "healthy" ────
// v3.40 added `evaluable`/`reason` on macro_flip and `downgraded` on regime.verdict, but nothing
// rendered them — a blind circuit and a plain "not armed" produced the SAME pill suffix (none),
// and a withheld TAILWIND read as an unremarkable NEUTRAL. This is the one surface where that
// silence would actually matter: the maintainer reads the pill, not the JSON.
console.log("\n[render] MACRO pill — blind circuit and withheld verdict are never silent");
READOUT_FIXTURE = {
  as_of: `${TODAY_ET}T14:30:00Z`,
  regime: { verdict: "NEUTRAL", raw_verdict: "TAILWIND",
    downgraded: "TAILWIND withheld — VIX unavailable, so the PANIC override cannot fire; a risk-on call needs the risk gauge" },
  macro_flip: { armed: null, tripped: null, evaluable: false, reason: "circuit BLIND — missing or stale: vix" },
};
const blindPage = await open(1200);
const blindPill = await txt(blindPage, "regimePill");
const blindCls = await blindPage.locator("#regimePill").getAttribute("class");
ok("a blind circuit renders 'flip BLIND', never the same blank suffix a healthy circuit gets",
  /flip BLIND/.test(blindPill));
ok("a withheld TAILWIND does not read as a plain, unremarkable NEUTRAL",
  /TAILWIND withheld/.test(blindPill));
ok("the withheld state takes the amber warn class, not the green ok class",
  /\bwarn\b/.test(blindCls) && !/\bok\b/.test(blindCls));
await blindPage.close();

READOUT_FIXTURE = { as_of: `${TODAY_ET}T14:30:00Z`, regime: { verdict: "TAILWIND" },
  macro_flip: { armed: false, tripped: false, evaluable: true, reason: null } };
const healthyPage = await open(1200);
const healthyPill = await txt(healthyPage, "regimePill");
ok("a fully-fed, unarmed circuit still reads as a plain TAILWIND (no false BLIND tell)",
  /TAILWIND/.test(healthyPill) && !/BLIND/.test(healthyPill) && !/withheld/.test(healthyPill));
await healthyPage.close();

/* ENGINE0-CONT: the two admin states the continuity plan adds — a degraded HOLD pill that
   is amber and never says INSUFFICIENT, and a refresh button that renders the POST
   response DIRECTLY (never rereading eventually-consistent KV). */
console.log("\n[render] ENGINE0-CONT — degraded HOLD pill + real data refresh");
READOUT_FIXTURE = { as_of: `${TODAY_ET}T14:30:00Z`,
  regime: { verdict: "NEUTRAL", raw_verdict: "INSUFFICIENT", confidence: "LOW", actionability: "HOLD",
    status: "DATA DEGRADED", current: 2, historical: 3, missing: 1,
    reason: "3 checks use historical observations; current VIX unavailable" },
  spy: { as_of: TODAY_ET }, vix: { as_of: "2026-07-31" }, fear_greed: { as_of: TODAY_ET }, us10y: { as_of: "2026-07-30" },
  macro_flip: { armed: null, tripped: null, evaluable: false, state: "UNCONFIRMED_FROM_LAST_CLOSE",
    reason: "latest VIX is historical (2026-07-31) — circuit cannot confirm" } };
const holdPage = await open(1200);
const holdPill = await txt(holdPage, "regimePill");
const holdCls = await holdPage.locator("#regimePill").getAttribute("class");
ok("degraded-hold: pill carries HOLD · DATA DEGRADED and is amber, never green",
  /HOLD/.test(holdPill) && /DATA DEGRADED/.test(holdPill) && /\bwarn\b/.test(holdCls) && !/\bok\b/.test(holdCls));
ok("degraded-hold: the literal INSUFFICIENT never renders on the pill", !/INSUFFICIENT/.test(holdPill));
ok("degraded-hold: a carried-VIX circuit reads 'flip unconfirmed (last close)', never blank",
  /flip unconfirmed \(last close\)/.test(holdPill));
ok("degraded-hold: counts + observation dates ride the pill tooltip",
  /2 current · 3 historical/.test(await holdPage.locator("#regimePill").getAttribute("title") || ""));

REFRESH_FIXTURE = { ok: true, published: true, improved: true,
  message: "Engine 0 recovered to 6 current check(s) (HIGH confidence, FULL)",
  readout: { as_of: `${TODAY_ET}T15:00:00Z`,
    regime: { verdict: "TAILWIND", confidence: "HIGH", actionability: "FULL", status: "OK", current: 6, historical: 0, missing: 0 },
    spy: { as_of: TODAY_ET }, vix: { as_of: TODAY_ET }, fear_greed: { as_of: TODAY_ET }, us10y: { as_of: TODAY_ET },
    macro_flip: { armed: false, tripped: false, evaluable: true, state: "CLEAR", reason: null } } };
await holdPage.evaluate(() => refreshRanks());
await holdPage.waitForTimeout(600);
const refreshedPill = await txt(holdPage, "regimePill");
ok("refresh: the pill renders the RETURNED readout immediately (HOLD -> TAILWIND, no KV reread)",
  /TAILWIND/.test(refreshedPill) && !/HOLD/.test(refreshedPill));
ok("refresh: the server's recovery message reaches the operator",
  /recovered to 6 current/.test(await holdPage.locator("#toast").innerText()));
ok("refresh: the button re-enables in finally",
  await holdPage.evaluate(() => !document.getElementById("refreshRanks").disabled));

REFRESH_FIXTURE = { ok: true, published: false, improved: false,
  message: "refresh completed but the candidate was worse; retained the prior snapshot",
  readout: READOUT_FIXTURE };
await holdPage.evaluate(() => refreshRanks());
await holdPage.waitForTimeout(600);
ok("refresh-failure: 'retained the prior snapshot' is reported, never silent",
  /retained the prior snapshot/.test(await holdPage.locator("#toast").innerText()));
await holdPage.close();
REFRESH_FIXTURE = null;

await browser.close();
server.close();
console.log(`\n=== RENDER TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
