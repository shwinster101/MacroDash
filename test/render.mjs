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
// The production index builder — see the /api/deepdive stub below.
import { ddIndexEntry } from "../functions/api/deepdive.js";

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
  pt_model: { ev_s_multiple: 8, share_count_M: 1100, pe_floor_multiple: 18,
    note: "synthetic caveat — the payload distrusts its own number" },
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
      // Legacy comparison only. An explicit provider average must win; low/average/high
      // are aggregates, not scenarios to average into a fourth invented target.
      pt_consensus: { rows: { "2028": { low: 300, average: 485, high: 520 } } },
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
  // FEAT-TT-DDSTORE (v3.75): JJJ's payload is deliberately NOT embedded here — it lives ONLY
  // in the /api/deepdive store below. Every JJJ assertion in this suite (the ranking, the fab
  // exclusion, the tokens/watt FLOOR, the unheld label) was written before the split and is
  // left UNCHANGED, so their continuing to pass is the proof that the storage move is
  // invisible to every renderer — the same property posOf() gave the position split. A field
  // the board reads but the index omits fails HERE, which is how capex_exposure was caught.
  { sym: "JJJ", tier: "WATCH", lens: "AI", lastRun: etDaysAgo(2), note: "candidate, no position" },
];
// A PARTIAL mix (sums to 80) and no date — the fail-closed path: FLOOR, not an average.
const JJJ_DD = dd(100, { 2027: 5, 2028: 6, 2029: 7 }, { 2027: 3, 2028: 4, 2029: 5 },
  { capex_exposure: { type: "fab" },
    tokens_per_watt: { gen_mix: [{ gen: "G1", pct: 80, idx: 1.00 }] } });
const DD_STORE = { JJJ: JJJ_DD };
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
  // FEAT-CAPEX-OCF (v3.83): HYPA 8/6=1.33 and HYPB 6/5=1.20 both past OCF (debt-funded fires
  // at ≥2); HYPC carries no ocf_B — the unmeasured row must be NAMED, never counted.
  capex: { rows: [
    { co: "HYPA", fy_guide_B: 8, ocf_B: 6, dir: "down", at: etDaysAgo(2) },
    { co: "HYPB", fy_guide_B: 6, ocf_B: 5, dir: "down", at: etDaysAgo(1) },
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

// FEAT-TT-V2: the browser exercises the same split persistence contract as production — the
// reviewed licensed packet, measured facts and attested analysis receipt are three independent
// responses. The values stay synthetic; only the contract mirrors the NVDA acceptance fixture.
const READOUT_AS_OF = `${TODAY_ET}T14:30:00Z`;
const nextFiscal = (n) => `${new Date().getUTCFullYear() + n}-01-31`;
const streetPacket = (symbol, rows, target) => ({
  schema: "tt-street-v1", symbol, confirmedAt: `${TODAY_ET}T17:00:00.000Z`,
  storedAt: `${TODAY_ET}T17:00:00.000Z`, version: `fixture-${symbol.toLowerCase()}`,
  estimates: {
    provider: "Seeking Alpha", sourceUrl: "https://seekingalpha.com/", asOf: TODAY_ET,
    currency: "USD", revenueUnit: "B", epsBasis: "diluted", periods: rows,
  },
  analystTarget: {
    provider: "TipRanks", sourceUrl: "https://www.tipranks.com/", asOf: TODAY_ET,
    currency: "USD", low: target.low, average: target.average, high: target.high,
    analystCount: 15, ratings: { buy: 12, hold: 2, sell: 1 },
    lookbackMonths: 3, horizonMonths: 12, referencePrice: target.referencePrice,
  },
});
let STREET_FIXTURE = {
  AAA: streetPacket("AAA", [
    { periodEnd: nextFiscal(1), revenueB: 55, eps: 40 },
    { periodEnd: nextFiscal(2), revenueB: 62, eps: 46 },
    { periodEnd: nextFiscal(3), revenueB: 70, eps: 52 },
  ], { low: 850, average: 1100, high: 1500, referencePrice: 800 }),
  BBB: streetPacket("BBB", [
    { periodEnd: nextFiscal(1), revenueB: 9, eps: 18 },
    { periodEnd: nextFiscal(2), revenueB: 11, eps: 22 },
  ], { low: 560, average: 650, high: 800, referencePrice: 609 }),
  JJJ: streetPacket("JJJ", [
    { periodEnd: nextFiscal(1), revenueB: 5, eps: 3 },
    { periodEnd: nextFiscal(2), revenueB: 6, eps: 4 },
  ], { low: 90, average: 160, high: 220, referencePrice: 100 }),
};
const fact = (value, extra = {}) => ({
  value, status: "LIVE", provider: "synthetic provider", observedAt: `${TODAY_ET}T14:35:00Z`,
  retrievedAt: `${TODAY_ET}T14:35:00Z`, ...extra,
});
let FACTS_FIXTURE = {
  AAA: { schema: "tt-facts-v1", symbol: "AAA", updatedAt: `${TODAY_ET}T14:35:00Z`, fields: {
    quote: fact(800, { currency: "USD", changePct: -1.1 }), nextEarnings: fact(etDaysAgo(-22)),
    netCashB: fact(42.3, { unit: "USD B", provider: "SEC" }),
  } },
  BBB: { schema: "tt-facts-v1", symbol: "BBB", updatedAt: `${TODAY_ET}T14:35:00Z`, fields: {
    quote: fact(609, { currency: "USD", changePct: -1.4 }), nextEarnings: fact(etDaysAgo(-22)),
  } },
  JJJ: { schema: "tt-facts-v1", symbol: "JJJ", updatedAt: `${TODAY_ET}T14:35:00Z`, fields: {
    quote: fact(100, { currency: "USD", changePct: 0.5 }), nextEarnings: fact(etDaysAgo(-22)),
  } },
};
const gate = (id, status, reason, evidence = []) => ({ id, status, reason, evidence });
const analysisReceipt = (sym, { gap, target, eligible, failing = null }) => {
  const gates = [
    gate("macro", "PASS", "Engine 0 permits full evaluation", ["actionability FULL"]),
    gate("quote", "PASS", "usable live quote", ["synthetic provider"]),
    gate("street_gap", failing === "street_gap" ? "FAIL" : "PASS",
      failing === "street_gap" ? `TipRanks published average is only ${gap}% above the sourced quote` :
        `TipRanks published average is ${gap}% above the sourced quote`, ["minimum 15%"]),
    gate("licensed_freshness", "PASS", "SA estimates and TipRanks target are current"),
    gate("composite", "PASS", "8.2/10 across 4 available pillars", ["revisions unavailable"]),
    gate("qualitative", failing === "qualitative" ? "UNKNOWN" : "PASS",
      failing === "qualitative" ? "primary filing evidence is unavailable" : "primary evidence supports the rubric",
      failing === "qualitative" ? [] : ["https://www.sec.gov/fixture"]),
    gate("reward_risk", "PASS", "3x reward/risk clears 2x", ["ATR stop"]),
  ];
  const blockers = gates.filter((g) => g.status !== "PASS").map((g) => ({ id: g.id, status: g.status, reason: g.reason }));
  return {
    schema: "tt-analysis-v2", engineVersion: "tt-gates-v2.2.0", symbol: sym,
    evaluatedAt: `${TODAY_ET}T14:36:00Z`, status: eligible ? "ELIGIBLE" : "WAIT", eligible,
    gates, advisories: [gate("binary", "CLEAR", "next binary event is 22 days away", [etDaysAgo(-22)])], blockers, warnings: [],
    metrics: { status: "OK", quote: FACTS_FIXTURE[sym].fields.quote.value,
      gaps: { averagePct: gap, lowPct: null, highPct: null }, target: { average: target } },
    technicals: { status: "OK", rewardRisk: 3, trend: "UPTREND", evidence: ["ATR stop"] },
    composite: { status: "PASS", score: 8.2, reason: "8.2/10 across 4 available pillars" },
    qualitative: failing === "qualitative"
      ? { status: "UNKNOWN", score: null, reason: "primary filing evidence is unavailable", citations: [] }
      : { status: "PASS", score: 8, reason: "primary evidence supports the rubric", citations: ["https://www.sec.gov/fixture"] },
    priceBasis: { kind: "INTRADAY", value: FACTS_FIXTURE[sym].fields.quote.value,
      observedAt: FACTS_FIXTURE[sym].fields.quote.observedAt, provider: "synthetic provider" },
    policy: { streetGapMinPct: 15, binaryWindowDays: 10, rrFloor: 2 },
    attestation: { at: `${TODAY_ET}T14:36:00Z`, engineVersion: "tt-gates-v2.2.0", status: eligible ? "ELIGIBLE" : "WAIT",
      inputVersions: { street: STREET_FIXTURE[sym].confirmedAt, facts: FACTS_FIXTURE[sym].updatedAt,
        regime: READOUT_AS_OF, regimeActionability: "FULL", regimeVerdict: "HEADWIND", macroFlipState: "ARMED", riskTier: "tactical" },
      inputHash: "a".repeat(64), resultHash: "b".repeat(64) },
  };
};
let ANALYSIS_FIXTURE = {
  AAA: analysisReceipt("AAA", { gap: 37.5, target: 1100, eligible: true }),
  BBB: analysisReceipt("BBB", { gap: 6.7, target: 650, eligible: false, failing: "street_gap" }),
  JJJ: analysisReceipt("JJJ", { gap: 60, target: 160, eligible: false, failing: "qualitative" }),
};
let STREET_PUTS = 0;
let OCR_CALLS = 0;

// FEAT-DERIV-OWN (v3.41): mutable so later tests can swap in blind/HOLD readouts and
// reopen the page. FULL + evaluable is required for the initial receipt to remain current.
let READOUT_FIXTURE = {
  as_of: READOUT_AS_OF,
  regime: { verdict: "HEADWIND", actionability: "FULL", status: "OK" },
  health: { can_gate: true },
  macro_flip: { armed: true, tripped: false, evaluable: true, state: "ARMED", reason: null },
};
// ENGINE0-CONT: null = endpoint absent (404), so the pre-existing refreshRanks test keeps
// exercising the read-only fallback ladder; set to a body to drive the real POST path.
let REFRESH_FIXTURE = null;

const server = http.createServer(async (req, res) => {
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
  // FEAT-TT-DDSTORE (v3.75). The index is built by the REAL ddIndexEntry, imported from the
  // handler — a hand-written fixture index could quietly disagree with what production emits,
  // which is the exact drift this suite exists to catch.
  if (url.pathname === "/api/deepdive") {
    const p = url.searchParams;
    if (p.get("index") === "1") {
      const entries = {};
      for (const [k, v] of Object.entries(DD_STORE)) entries[k] = ddIndexEntry(v);
      return json({ asOf: TODAY_ET, entries });
    }
    if (p.get("all") === "1") return json({ asOf: TODAY_ET, deepDives: DD_STORE, count: Object.keys(DD_STORE).length, missing: [] });
    const s2 = p.get("sym");
    return json({ sym: s2, deepDive: DD_STORE[s2] || null });
  }
  if (url.pathname === "/api/positions")
    return json({ asOf: TODAY_ET, positions: POSITIONS });
  if (url.pathname === "/api/quotes")
    return json({ asOf: `${TODAY_ET}T14:35:00Z`, quotes: { AAA: { px: 800, chg: -11, at: TODAY_ET },
      BBB: { px: 609, chg: -14.5, at: TODAY_ET } } });
  // v3.73 TT-SCORE: shadow scorecard fixtures. AAA = awaiting falsifiers with a
  // NO_FLOOR_PREPROFIT + context premium; BBB = SCORED but DISAGREEING with the legacy
  // composite, so the methods-disagree line renders. Synthetic only, as always.
  if (url.pathname === "/api/score") {
    // v5.0 §14.8: the board loads the index at boot. Baseline is EMPTY — every name reads
    // "no server card", so no test passes for the wrong reason; the eligible-line recipes
    // inject their own SCORED entry and restore it.
    if (url.searchParams.get("book") === "1")
      return json({ methodology_version: "tt-underwriting-v2.6.0", index: {} });
    const s = url.searchParams.get("sym");
    if (s === "AAA") return json({ sym: "AAA", record: { sym: "AAA", underwriting_inputs: {},
      scorecard: { methodology_version: "tt-underwriting-v2.6.0", status: "UNSCORABLE", actionability: "BLOCKED",
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
      scorecard: { methodology_version: "tt-underwriting-v2.6.0", status: "SCORED", actionability: "CAUTION",
        route: "PHYSICAL_AI", profile: null, route_mapping_version: "tt-route-v1",
        raw_score: 6.12, raw_tier: "B", capped_tier: "B", input_hash: "sha256:bbbb2222",
        blockers: [], pillars: { owner_valuation: { score: 6.5, weight: 0.25, basis_used: "FLOOR", premium_prerequisite_state: "UNKNOWN", blockers: [] },
          trajectory: { score: 7.0, weight: 0.25, blockers: [] },
          economic_quality: { score: 5.0, weight: 0.25, blockers: [] },
          falsifier_health: { score: 6.0, weight: 0.25, blockers: [] } },
        gate_results: [] } } });
    return json({ sym: s, record: null });
  }
  if (url.pathname === "/api/street/ocr") {
    OCR_CALLS++;
    return json({ draft: JSON.parse(JSON.stringify(STREET_FIXTURE.AAA)), warnings: ["synthetic OCR draft — verify every field"] });
  }
  if (url.pathname === "/api/street") {
    if (req.method === "PUT") {
      STREET_PUTS++;
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const packet = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const record = { ...packet, storedAt: `${TODAY_ET}T17:05:00.000Z`, version: `fixture-${packet.symbol.toLowerCase()}-saved` };
      STREET_FIXTURE = { ...STREET_FIXTURE, [packet.symbol]: record };
      return json({ record, changes: [{ path: "confirmedAt", from: null, to: packet.confirmedAt }] });
    }
    return json({ records: STREET_FIXTURE, missing: [] });
  }
  if (url.pathname === "/api/ticker-facts") {
    let sym = String(url.searchParams.get("sym") || "").toUpperCase();
    if (req.method === "POST") {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      sym = String(JSON.parse(Buffer.concat(chunks).toString("utf8")).symbol || "").toUpperCase();
    }
    return json({ records: sym ? { [sym]: FACTS_FIXTURE[sym] } : FACTS_FIXTURE, missing: [] });
  }
  if (url.pathname === "/api/ticker-analysis") {
    if (req.method === "POST") {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const sym = String(body.symbol || "").toUpperCase();
      const receipt = ANALYSIS_FIXTURE[sym];
      if (receipt) receipt.attestation.inputVersions.street = STREET_FIXTURE[sym]?.confirmedAt || null;
      return json({ receipt: receipt || null });
    }
    return json({ records: ANALYSIS_FIXTURE, missing: [] });
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
// v5.2 CAP-ASTERISK (owner ruling 2026-08-25): cap breaches are WARN items now, not stops —
// "reference cap (informational)", with the asterisk named in the sub. Still visible in TODAY.
ok("a single-name cap breach is a TODAY warn — reference cap, informational (v5.2)",
  /AAA is 21\.4% of acct equity — 3\.4pts over the 18% reference cap \(informational\)/.test(today));
ok("a cluster cap breach is a TODAY warn — reference cap, informational (v5.2)",
  /Cluster .*is 36\.4% of acct equity — 18\.4pts over the 18% reference cap \(informational\)/.test(today));
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
// v3.76: the flat NOT RANKED bin split into a reviewed-but-unpriceable RANKING (ordered on
// the TT composite) and a genuinely-not-reviewed list. Coverage must still be total, so this
// asserts every book name lands in exactly one of the three places rather than pinning a heading.
// COVERAGE, not a heading: every book name must land somewhere. The fixture's unranked names
// all carry a lastRun, so NOT REVIEWED is correctly ABSENT — an empty section that rendered
// anyway would be the placeholder-noise this board refuses everywhere else.
ok("rankexport: unranked names are NAMED rather than silently dropped",
  /## REVIEWED — NOT RATE-RANKABLE/.test(rank.md) && !/## NOT REVIEWED/.test(rank.md) &&
  BOOK.every((x) => new RegExp("\\*\\*" + x.sym + "\\*\\*").test(rank.md)));
ok("rankexport: the reviewed-but-unpriceable section is a RANKING on the TT composite, and " +
   "every row names its missing input WITH the fix — never a bare 'unrankable'",
  /Ranked on TT composite/.test(rank.md) && /Why no %\/yr\|Fix/.test(rank.md) &&
  /no thesis payload stored\|add a deep-dive payload/.test(rank.md) &&
  /— no score yet/.test(rank.md));
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
ok("ready: canonical readiness stays distinct while the ticker-gates block renders the attested chain and binary advisory",
  /DECISION READINESS/.test(cardBody) && /TICKER GATES/.test(cardBody) && /macro/.test(cardBody) &&
  /street gap/.test(cardBody) && /reward risk/.test(cardBody) && /binary/.test(cardBody));
await page.evaluate(() => closeCard());
await page.waitForTimeout(80);

console.log("\n[render] FEAT-TT-V2 — screenshot draft, explicit review, confirmed write");
await page.evaluate(() => openStreetImport("AAA"));
await page.waitForTimeout(120);
const streetFlow = { title: await page.locator("#cTitle").innerText(), body: await page.locator("#cBody").innerText(), accept: await page.locator("#streetImages").getAttribute("accept") };
ok("the narrow input flow names both licensed providers and exposes an image-only draft control",
  /REVIEW STREET INPUTS/i.test(streetFlow.title) &&
  /Seeking Alpha source URL/i.test(streetFlow.body) &&
  /TipRanks average/i.test(streetFlow.body) &&
  streetFlow.accept === "image/png,image/jpeg,image/webp");
await page.locator("#streetImages").setInputFiles({
  name: "synthetic-street.png", mimeType: "image/png", buffer: Buffer.from("synthetic image fixture"),
});
await page.evaluate(() => ocrStreetDraft());
await page.waitForTimeout(220);
ok("OCR returns an editable draft with the provider-published average intact",
  (await page.inputValue("#stAvg")) === "1100" && (await page.locator("#streetPeriods .street-period").count()) === 3 &&
  /verify every field/i.test(await page.locator("#cBody").innerText()));
ok("OCR itself is ephemeral — no licensed packet write occurs before explicit confirmation",
  OCR_CALLS === 1 && STREET_PUTS === 0);
await page.evaluate(() => saveStreetPacket());
await page.waitForTimeout(450);
ok("CONFIRM persists exactly one reviewed packet, refreshes facts, and returns an attested card",
  STREET_PUTS === 1 && /TICKER GATES/.test(await page.locator("#cBody").innerText()) &&
  /ELIGIBLE/.test(await page.locator("#cBody").innerText()));
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
/* v5.2 CAP-ASTERISK: the ⛔ TRIM forced tier is GONE (SELLRANK v3.38 REVERSED, owner ruling
   2026-08-25) — the over-cap row ranks on MERIT and carries the same trimPts/trim$ arithmetic
   as an amber informational chip instead, so nothing the forced row said is lost. */
ok("sell: a cap breach is an informational chip on a merit row — same arithmetic, no forced tier (v5.2)",
  !/⛔ TRIM/.test(sellB) && /AAA/.test(sellB) &&
  /3\.4pts over the 18% reference cap/.test(sellB) && /\$4k to cap \(informational\)/.test(sellB));
// FEAT-TT-GLANCE (v3.61): the methodology sentences + the unranked tail moved into a closed
// est-mini expander. What stays visible while closed: the rows, chip-length basis tags, the
// unranked COUNT, and the session-disagreement chip (signal, not explanation).
ok("glance: closed SELL shows chip-length basis tags, never the repeated sentences",
  /%\/yr model/.test(sellB) && !/lowest expected return funds first/i.test(sellB) &&
  !/ranked on realisable dollars/.test(sellB));
// v5.2: no-rate share rows and measured options rows all RANK now (tape + score are still
// axes), so this fixture has ZERO unranked and the count chip honestly disappears; the
// methodology expander stays. No-silent-truncation is carried by the in-list "no %/yr"
// primaries asserted below — nothing left this surface.
ok("glance: nothing is silently missing — the expander stays, no stale unranked count renders (v5.2)",
  !/○ \d+ unranked/.test(sellB) && /how this list is ranked/i.test(sellB));
// v5.2: merit sort — BBB (lowest %/yr, −27.3) computes first; AAA's cap no longer forces
// it to the head of the queue. The chip itself is unchanged signal.
ok("glance: the disagreement chip stays visible while closed — it is signal (merit first: BBB)",
  /⚖ session: FFF first · computed: BBB/.test(sellB));
ok("glance: the SELL methodology expander is est-mini class, never drawer (phone harness rule)",
  (await page.locator("#sellBlock details.est-mini").count()) === 1 &&
  (await page.locator("#sellBlock details.drawer").count()) === 0);
// One tap deep, everything survives verbatim.
await page.locator("#sellBlock details.est-mini > summary").click();
const sellOpen = await txt(page, "sellBlock");
ok("sell: discretionary source is the LOWEST expected return (BBB), stated as such",
  /BBB/.test(sellOpen) && /%\/yr model/.test(sellOpen) && /lowest expected return funds first/i.test(sellOpen));
// v5.2: unmodelled held names rank IN the list (exiling them re-created the v3.44
// exclusion one bucket over) — the primary honestly reads "no %/yr", never a borrowed rate.
ok("sell: unmodelled held names rank IN the list with an honest no-%/yr primary (v5.2)",
  /CCC/.test(sellB) && /FFF/.test(sellB) && (sellB.match(/no %\/yr/g) || []).length >= 2 &&
  !/cannot rank — no model:/i.test(sellOpen));
// v3.44: an options-only position with synced legs ranks IN the list, on realisable dollars.
ok("sell: an options-only position ranks IN the list, on dollars, and says so",
  /EEE/.test(sellOpen) && /ranked on realisable dollars/.test(sellOpen) &&
  !/selling legs is not selling shares/.test(sellOpen));
ok("sell: the asserted funding order is confronted with the computed one (merit: BBB first, v5.2)",
  /asserts FFF first/i.test(sellOpen) && /computed says BBB/i.test(sellOpen));
ok("sell: a tripped circuit makes SELL the active list",
  /this IS the active list/i.test(sellOpen));
const buyB = await txt(page, "buyBlock");
ok("buy: compact block carries the veto banner and the same canonical ranked rows",
  /NO NEW POSITIONS/.test(buyB) && /AAA/.test(buyB) && /13\.4%\*/.test(buyB));
/* v4.6 THE RANKING BRIDGE — the footer used to state the truncation and deep-link to DESK
   for the rest (the v3.72 defect: a control that reports instead of acting). The remainder
   now opens IN PANEL. Fixture has 3 ranked / 4 unranked, so the tail path is live here; the
   ranked-overflow path is driven at runtime below, the way the circuit tests already do. */
// Re-pinned at v5.6: the stamped-history drawer joins the bridge expander — TWO est-minis
// now, still ZERO drawers (the phone harness counts open drawers, the invariant that matters).
ok("bridge: the +N expander and the v5.6 stamped history are BOTH est-mini, never drawer",
  (await page.locator("#buyBlock details.est-mini").count()) === 2 &&
  (await page.locator("#buyBlock details.drawer").count()) === 0);
ok("bridge: the COUNT rides the closed summary — silent truncation cannot read as full coverage",
  /\*1 more reviewed/.test(buyB));
ok("bridge: the old DESK deep-link for NAMES is gone; only the methodology link remains",
  !/full math, horizons/.test(buyB) && /caveats, lints & horizon pin/.test(buyB));
{
  const closed = await page.locator("#buyBlock").innerText();
  // v5.6: two est-minis exist now (bridge + stamped history); the bridge is FIRST in DOM.
  await page.locator("#buyBlock details.est-mini > summary").first().click();
  const opened = await page.locator("#buyBlock").innerText();
  const hidden = await page.evaluate(() => UNRANKED_ROWS.slice(3).map(r => r.sym));
  ok("bridge: the overflow name is absent while closed and present one tap deep",
    hidden.length === 1 && !closed.includes(hidden[0]) && opened.includes(hidden[0]));
  /* The invariant is "no horizontal overflow at the ACTIVE width" — this block runs at the
     1200px desktop viewport, so pinning a literal 390 would have measured nothing. */
  ok("bridge: expanding adds no horizontal overflow at the active viewport width",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
}
/* Ranked overflow: inject two synthetic rows so UPSIDE_ROWS exceeds the visible 5, then
   assert the expander continues the SAME order with correct rank numbers — the rows in the
   expander must be rank 6 and 7, not a restarted list. */
{
  const rk = await page.evaluate(() => {
    const base = UPSIDE_ROWS[0];
    const keep = UPSIDE_ROWS.slice();
    while (UPSIDE_ROWS.length < 7)
      UPSIDE_ROWS.push({ ...base, sym: "ZZ" + UPSIDE_ROWS.length, ann: -90 - UPSIDE_ROWS.length, upside: -90 });
    renderBuyBlock();
    const el = document.getElementById("buyBlock");
    const sum = el.querySelector("details.est-mini > summary").innerText;
    el.querySelector("details.est-mini").open = true;
    const openTxt = el.innerText;
    const visibleRows = el.querySelectorAll(":scope > button.fdr-row").length;
    UPSIDE_ROWS.length = 0; UPSIDE_ROWS.push(...keep); renderBuyBlock();
    return { sum, openTxt, visibleRows };
  });
  ok("bridge: with 7 ranked the summary counts the 2 hidden, and only 5 render by default",
    /\+2 more ranked/.test(rk.sum) && rk.visibleRows <= 5 + 3);
  ok("bridge: expander continues the SAME order — ranks #6 and #7, never a restarted list",
    /#6/.test(rk.openTxt) && /#7/.test(rk.openTxt) && rk.openTxt.includes("ZZ5") && rk.openTxt.includes("ZZ6"));
}
const calB = await txt(page, "calBlock");
ok("calendar block leads with today's binary", /TODAY/.test(calB) && /MACROEVT/.test(calB));
// FEAT-TT-CIRCUIT (v4.1 Step 1): the fail-closed path, driven live. Clearing the structured
// circuit in-page must flip the stance to ADDS SUSPENDED (not fall through to the regime
// rungs and read ADDS OK/GATED) and render the UNRESOLVED strip instead of hiding it —
// the 8/18 audit's live defect, where circuit:null + tripped PROSE still permitted adds.
const unresolved = await page.evaluate(() => {
  const keep = BOARD.circuit;
  BOARD.circuit = null;
  render();
  const strip = document.getElementById("stanceStrip").innerText;
  const circ = (document.getElementById("circuitLine") || {}).innerText || "";
  BOARD.circuit = keep; render();
  return { strip, circ };
});
ok("circuit absent → stance fails CLOSED to ADDS SUSPENDED, never through to the regime rungs",
  /ADDS SUSPENDED/.test(unresolved.strip) && !/ADDS OK|ADDS GATED/.test(unresolved.strip));
ok("circuit absent → the UNRESOLVED strip renders loud instead of hiding",
  /CIRCUIT UNRESOLVED — adds suspended/i.test(unresolved.circ) &&
  /prose is explanation, not permission/i.test(unresolved.circ));
const strip = await txt(page, "stanceStrip");
/* v5.6.5 (owner call): under a RESTRICTIVE gate the badges move behind one expander whose
   CLOSED summary carries their COUNT and colour — the v3.25 rule at a different altitude:
   a collapse may hide a red fact's DETAIL, never that one exists. Both halves are pinned:
   the count while closed, and every badge verbatim one tap deep. */
ok("stance strip SIGNALS the reds while closed — a counted, coloured flag summary",
  // /i: innerText APPLIES text-transform:uppercase on the summary (the v3.69 lesson).
  /⚠ \d+ flags?/i.test(strip) && /why, and what else is red/i.test(strip));
{
  await page.locator("#stanceStrip details.why > summary").click();
  const open = await txt(page, "stanceStrip");
  ok("stance strip: one tap reveals every red badge verbatim — nothing was deleted, only moved",
    /over cap/.test(open) && /binaries/.test(open));
  await page.locator("#stanceStrip details.why > summary").click();
}
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
  // v5.6.5: the expander nests a chip row + the prose, so scope to the prose div (the last).
  /leverage circuit tripped/i.test(await page.locator("#stanceStrip details.why div").last().textContent()));
// v5.6.5: on a RESTRICTIVE board the verdict stays on the face and the reds are SIGNALLED
// by a counted summary (revealed verbatim one tap deep, asserted above).
ok("stance bar: with the drawer closed the verdict and a counted red signal are both visible",
  /NO NEW POSITIONS/.test(strip) && /⚠ \d+ flags?/i.test(strip));
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
ok("missing net cash produces a visible migration audit naming the retired implicit-zero target/rank effect",
  /net-cash migration audit/i.test(upRankOpen) && /old implicit-zero target/i.test(upRankOpen) && /measured-only target/i.test(upRankOpen));
// BBB is modelled but carries NO position — the ranking spans both universes and must say so.
ok("an unheld name is labelled, never left blank against a held one", /new — not held/.test(upRank));
// The fixture circuit is TRIPPED, which short-circuits the whole agree block — clear it
// first, or the path under test never executes and the test passes for the wrong reason.
// Restore every mutation before returning.
const capped = await page.evaluate(() => {
  const prevState = BOARD.circuit.state, prevMv = POSITIONS.AAA.mv, prevPx = LIVE_PX.AAA;
  const prevReg = BOARD.regime;
  const prevCard = SCORE_INDEX && SCORE_INDEX.AAA;
  BOARD.regime = null;
  BOARD.circuit.state = "clear";
  LIVE_PX.AAA = { px: 300, chg: 0, at: prevPx.at };
  POSITIONS.AAA = { ...POSITIONS.AAA, mv: 999999 };   // far over the reference cap
  /* v5.2: quality clears via a SCORED card (the entry-recipe pattern), so the ONLY thing
     between AAA and the line is its weight — which no longer vetoes. */
  SCORE_INDEX = SCORE_INDEX || {};
  SCORE_INDEX_META = SCORE_INDEX_META || { methodology_version: "tt-underwriting-v2.6.0" };
  SCORE_INDEX.AAA = { status: "SCORED", raw_score: 8.0, raw_tier: "A", capped_tier: "A",
    methodology_version: SCORE_INDEX_META.methodology_version, broken_thesis: false };
  render();
  const t = document.getElementById("upsideRank").innerText;
  const res = { vetoGone: !/at the 18% cap, no room/.test(t),
    pick: AGREE_PICK ? AGREE_PICK.sym : null,
    green: /ELIGIBLE NEXT DOLLAR — all gates passed/.test(t),
    asterisk: /over the 18% reference cap \(asterisk, not a veto\)/.test(t) };
  BOARD.circuit.state = prevState; BOARD.regime = prevReg; POSITIONS.AAA = { ...POSITIONS.AAA, mv: prevMv }; LIVE_PX.AAA = prevPx;
  if (prevCard === undefined) delete SCORE_INDEX.AAA; else SCORE_INDEX.AAA = prevCard;
  render();
  return res;
});
/* v5.2 CAP-ASTERISK — DOCUMENTED REVERSAL of RANKFAIR v3.36 (owner ruling 2026-08-25:
   "keep it as an asterisk"). The over-cap name now TAKES the eligible line, carrying the
   reference-cap chip exactly where the veto used to fire — chosen with eyes open. */
ok("v5.2: an over-cap name is no longer vetoed — the pick stands, the green line lights",
  capped.vetoGone && capped.pick === "AAA" && capped.green);
ok("v5.2: the reference-cap asterisk renders ON the eligible line itself, never only in a drawer",
  capped.asterisk);
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

console.log("\n[render] FEAT-TT-V2 — published target receipt, additive to canonical ranking");
const streetRank = await txt(page, "streetEligibility");
ok("the receipt uses TipRanks' explicit published average on one 12-month horizon",
  /\$1100 published average · 12m/.test(streetRank) && /\+37\.5%/.test(streetRank) && /low\/average\/high are never re-averaged/.test(streetRank));
ok("the receipt explicitly ignores position size, names its denominator, and disclaims canonical scoring",
  /position ignored/i.test(streetRank) && /diagnostic, not canonical score/i.test(streetRank) && /3 reviewed of 7/.test(streetRank));
ok("a wider gap cannot outrun a failed sourced gate",
  /JJJ[\s\S]*WAIT[\s\S]*\+60%/.test(streetRank) && /1 ELIGIBLE/.test(streetRank) && /no winner selected/.test(streetRank));
ok("a below-hurdle provider target is named as WAIT, never promoted by an owner model",
  /BBB[\s\S]*WAIT[\s\S]*\+6\.7%/.test(streetRank) && /only 6\.7% above/.test(streetRank));

const exposureIndependent = await page.evaluate(() => {
  const keep = JSON.parse(JSON.stringify(POSITIONS.AAA));
  const before = document.getElementById("streetEligibility").innerText;
  POSITIONS.AAA = { ...POSITIONS.AAA, mv: 999999999, pct: 99.9 };
  render();
  const during = document.getElementById("streetEligibility").innerText;
  POSITIONS.AAA = keep; render();
  return { before, during };
});
ok("changing exposure cannot veto or reorder the ticker-level street receipt",
  exposureIndependent.during === exposureIndependent.before && /1 ELIGIBLE/.test(exposureIndependent.during) && !/cap, no room/.test(exposureIndependent.during));

const holdInvalidates = await page.evaluate(() => {
  const reg = JSON.parse(JSON.stringify(REGIME));
  REGIME.regime.actionability = "HOLD"; REGIME.health.can_gate = false;
  REGIME.macro_flip.evaluable = false; REGIME.macro_flip.state = "UNCONFIRMED";
  render();
  const during = document.getElementById("streetEligibility").innerText;
  REGIME = reg; render();
  return during;
});
ok("an Engine 0 HOLD invalidates the prior FULL street receipt fail-closed",
  /WAIT/.test(holdInvalidates) && /predates current Engine 0 readout/.test(holdInvalidates));
await page.waitForTimeout(120);

// FEAT-TT-ENTRY (v3.82): the WHEN leg driven live. Clear the gates (the capped-test recipe),
// give AAA a composite + a positive gap + a committed entry ABOVE the live price (pullback
// unmet), and the eligible line must light green WITH the distance chip — proving in one
// pass both that WHEN renders where the decision is read and that it never vetoes.
const paLive = await page.evaluate(() => {
  const a = BOOK.find((e) => e.sym === "AAA");
  const prev = { reg: BOARD.regime, circ: BOARD.circuit.state, px: LIVE_PX.AAA,
    comp: a.deepDive.composite, pa: a.deepDive.price_action,
    card: SCORE_INDEX && SCORE_INDEX.AAA };
  BOARD.regime = null; BOARD.circuit.state = "clear";
  LIVE_PX.AAA = { px: 300, chg: 0, at: prev.px.at };
  /* v5.0 §14.8: the quality rung reads SERVER CARDS — clearing it means a SCORED index
     entry under the current methodology, no longer a legacy composite. */
  SCORE_INDEX = SCORE_INDEX || {};
  SCORE_INDEX_META = SCORE_INDEX_META || { methodology_version: "tt-underwriting-v2.6.0" };
  SCORE_INDEX.AAA = { status: "SCORED", raw_score: 8.0, raw_tier: "A", capped_tier: "A",
    methodology_version: SCORE_INDEX_META.methodology_version, broken_thesis: false };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  a.deepDive.price_action = { as_of: today,
    levels: { ma50: 280, ma200: 240 },
    entry: { level: 250, kind: "pullback", set_at: today } };
  render();
  const t = document.getElementById("upsideRank").innerText;
  const buy = document.getElementById("buyBlock").innerText;
  const out = { pick: AGREE_PICK ? AGREE_PICK.sym : null,
    green: /ELIGIBLE NEXT DOLLAR — all gates passed/.test(t),
    chip: /\+20\.0% above committed entry \$250/.test(t),
    when: /WHEN — price action, reported never enforced/.test(t),
    buyChip: /above committed entry \$250/.test(buy) };
  // Now move the price TO the committed level — the chip must flip to AT ENTRY.
  LIVE_PX.AAA = { px: 245, chg: 0, at: prev.px.at };
  render();
  out.hit = /✓ AT ENTRY/.test(document.getElementById("upsideRank").innerText);
  BOARD.regime = prev.reg; BOARD.circuit.state = prev.circ; LIVE_PX.AAA = prev.px;
  if (prev.card === undefined) delete SCORE_INDEX.AAA; else SCORE_INDEX.AAA = prev.card;
  if (prev.pa === undefined) delete a.deepDive.price_action; else a.deepDive.price_action = prev.pa;
  render();
  return out;
});
ok("entry: the eligible line lights green WITH the entry distance — WHEN reported beside WHAT, not a veto",
  paLive.pick === "AAA" && paLive.green && paLive.chip && paLive.when);
ok("entry: the SAME chip renders on the primary-view BUY block (one builder, two altitudes)",
  paLive.buyChip);
ok("entry: price reaching the committed level flips the chip to AT ENTRY, live",
  paLive.hit);

// FEAT-TT-TECHREAD (v3.83): the banded WHEN verdict, driven live. Same recipe — clear the
// gates, stamp levels that make AAA a clean price-action uptrend, and assert the verdict
// prints beside (never inside) the valuation answer. Then flip the levels bearish and prove
// the read follows the tape rather than the ranking.
const techLive = await page.evaluate(() => {
  const a = BOOK.find((e) => e.sym === "AAA");
  const prev = { reg: BOARD.regime, circ: BOARD.circuit.state, px: LIVE_PX.AAA,
    comp: a.deepDive.composite, pa: a.deepDive.price_action,
    card: SCORE_INDEX && SCORE_INDEX.AAA };
  BOARD.regime = null; BOARD.circuit.state = "clear";
  LIVE_PX.AAA = { px: 300, chg: 0, at: prev.px.at };
  // v5.0 §14.8: quality clears via a SCORED card, not a legacy composite (the entry recipe).
  SCORE_INDEX = SCORE_INDEX || {};
  SCORE_INDEX_META = SCORE_INDEX_META || { methodology_version: "tt-underwriting-v2.6.0" };
  SCORE_INDEX.AAA = { status: "SCORED", raw_score: 8.0, raw_tier: "A", capped_tier: "A",
    methodology_version: SCORE_INDEX_META.methodology_version, broken_thesis: false };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  // px 300 vs ma50 280 (+7.1%) vs ma200 240 (+25%), cross +16.7%, range (300-200)/(320-200)=83%
  // → all four price-action factors bull → BULLISH, no withhold.
  a.deepDive.price_action = { as_of: today,
    levels: { ma50: 280, ma200: 240, swing_lo_3m: 200, swing_hi_3m: 320 },
    indicators: { rsi14: 62, macd_hist: 0.4 } };
  render();
  const t = document.getElementById("upsideRank").innerText;
  const out = { pick: AGREE_PICK ? AGREE_PICK.sym : null,
    bull: /TECH BULLISH/.test(t),
    // 2 price-action factors post-collinearity-fix, not 4 — the tally must report the real
    // count of independent observations, which is the whole point of that fix.
    split: /price action 2▲\/0▼ of 2/.test(t),
    // WHAT and WHEN are two lines, not one blended score — the married-never-merged proof.
    both: /%\/yr/.test(t) && /TECH BULLISH/.test(t) };
  // Now invert the levels: price below both MAs, bottom of range → BEARISH, and the pick
  // must SURVIVE (the read reports, it never vetoes).
  a.deepDive.price_action = { as_of: today,
    levels: { ma50: 340, ma200: 360, swing_lo_3m: 290, swing_hi_3m: 420 },
    indicators: { rsi14: 32, macd_hist: -0.4 } };
  render();
  const t2 = document.getElementById("upsideRank").innerText;
  out.bear = /TECH BEARISH/.test(t2);
  out.stillEligible = /ELIGIBLE NEXT DOLLAR — all gates passed/.test(t2)
    && (AGREE_PICK ? AGREE_PICK.sym : null) === "AAA";
  BOARD.regime = prev.reg; BOARD.circuit.state = prev.circ; LIVE_PX.AAA = prev.px;
  if (prev.card === undefined) delete SCORE_INDEX.AAA; else SCORE_INDEX.AAA = prev.card;
  if (prev.pa === undefined) delete a.deepDive.price_action; else a.deepDive.price_action = prev.pa;
  render();
  return out;
});
ok("techread: a clean price-action uptrend renders TECH BULLISH with the split tally on the eligible line",
  techLive.bull && techLive.split);
ok("techread: WHAT (%/yr) and WHEN (the tech verdict) print as separate answers — married, never merged",
  techLive.both);
ok("techread: inverting the levels flips the read to BEARISH — it follows the tape, not the ranking",
  techLive.bear);
ok("techread: a BEARISH tape does NOT veto — the pick stays eligible, the read is reported beside it",
  techLive.stillEligible);

// FEAT-TT-ALLOC (v3.100): the server allocation receipt driven live. Synthetic receipt only
// (the SEED/BOARD invariant); ALLOC is a top-level global the loaders normally set, so the
// harness sets it directly — exactly how BOARD/LIVE_PX scenarios already work.
console.log("\n[render] FEAT-TT-ALLOC — the server receipt beside the client's read");
const allocLive = await page.evaluate(() => {
  const prev = ALLOC, prevAcct = ACCOUNT;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  // v4.1 Step 2: the audit's live shape — a green context state beside NEGATIVE cash and
  // margin debt. The chip must render the measured account and the not-a-cash-claim
  // qualifier, or the state reads as spending approval.
  ACCOUNT = { equity: 316711.76, cash: -286817.09, buying_power: 16149.66, debt: 286817.09,
    at: today + "T22:22:00Z", src: "rh" };
  // v4.1 Step 5: the confirm affordance is withheld while the local stance reads stop —
  // the fixture's tripped circuit exercised exactly that (a green confirm link under a
  // tripped circuit was the two-answers defect). Clear the circuit to test the link, then
  // restore to test the withhold.
  const keepCirc = BOARD.circuit, keepReg = BOARD.regime;
  BOARD.circuit = { state: "clear", as_of: today };
  // The fixture's session also asserts PANIC — a second reason the pre-v4.1 link was a
  // two-answers defect (green confirm under an asserted-PANIC stance). Neutralize both to
  // test the affordance; each is restored to test its own withhold.
  BOARD.regime = { asserted: "TAILWIND", as_of: today };
  ALLOC = { schema: "tt-alloc-receipt-v1", at: today + "T14:00:00Z", state: "ALLOCATABLE",
    gate: null, horizon: "2027", eligible: { sym: "AAA", y: "2027", tgt: 999, up: 20, ann: 15 },
    why_not: [], context_blockers: [],
    funding: { label: "FUNDING PRIORITY — not a sell recommendation",
      rows: [{ sym: "FFF", tier: 4, reason: "session funding order #1" }], optOnly: [] },
    inputs: { readout_as_of: today },
    attestation: { input_hash: "a".repeat(64), basis_hash: "b".repeat(64), result_hash: "c".repeat(64) },
    confirmation: null };
  render();
  const buy = document.getElementById("buyBlock").innerText;
  const sell = document.getElementById("sellBlock").innerText;
  /* v5.6.5 (owner call): the receipt's disclosures — the not-a-cash-claim qualifier, the
     measured account, the basis versions — moved one tap down behind allocDisclose so the
     STATE leads. Open both altitudes' expanders and assert every line survived verbatim. */
  document.querySelectorAll("#buyBlock details.est-mini, #sellBlock details.est-mini")
    .forEach((d) => { if (/what this claims/i.test(d.querySelector("summary").textContent)) d.open = true; });
  const buyOpen = document.getElementById("buyBlock").innerText;
  const sellOpen = document.getElementById("sellBlock").innerText;
  const out = {
    // v4.1 Step 2: renamed label + permanent qualifier + measured account, both altitudes.
    buyChip: /ALLOCATION CONTEXT READY — AAA/.test(buy) && !/server: ALLOCATABLE/.test(buy),
    sellChip: /ALLOCATION CONTEXT READY — AAA/.test(sell),
    // the state stays on the FACE; the disclaimers are one tap deep, at BOTH altitudes
    faceIsClean: !/not a cash-availability or sizing claim/.test(buy),
    discloseSummary: /what this claims/i.test(buy) && /what this claims/i.test(sell),
    qualifier: /not a cash-availability or sizing claim/.test(buyOpen) &&
               /not a cash-availability or sizing claim/.test(sellOpen),
    acctBeside: /acct: equity \$317k · cash -\$287k · BP \$16k · debt \$287k/.test(buyOpen),
    confirmLink: document.getElementById("allocFundLink") !== null,
    confirmIntentOnly: /RECORD FUNDING INTENT — AAA · no order/.test(buy),
    disagree: /SERVER RECEIPT GOVERNS CONFIRMATION/.test(sell) && /server: FFF first/.test(sell) &&
              /diagnostic shadows/.test(sell) };
  // v4.1 Step 5: restore the tripped circuit — the same ALLOCATABLE receipt must now
  // WITHHOLD the affordance because the local permission state moved against it.
  BOARD.circuit = keepCirc; render();
  out.withheldOnStop = document.getElementById("allocFundLink") === null &&
    /confirmation withheld — local permission reads/.test(document.getElementById("buyBlock").innerText);
  BOARD.circuit = { state: "clear", as_of: today }; render();
  // WAIT state: the gate reason renders, no confirm affordance survives.
  ALLOC = { ...ALLOC, state: "WAIT", eligible: null,
    gate: { rung: "flip", reason: "Macro Flip BLIND — missing inputs" }, confirmation: null };
  render();
  out.waitChip = /server: WAIT — Macro Flip BLIND/.test(document.getElementById("buyBlock").innerText);
  out.waitNoConfirm = document.getElementById("allocFundLink") === null;
  // No receipt at all (older deploy / never evaluated): stated, never blank.
  ALLOC = null; render();
  out.honest = /server allocation: no receipt/.test(document.getElementById("buyBlock").innerText);
  ALLOC = prev; ACCOUNT = prevAcct; BOARD.circuit = keepCirc; BOARD.regime = keepReg; render();
  return out;
});
ok("alloc: the context-ready receipt renders the SAME chip at both altitudes (one builder)",
  allocLive.buyChip && allocLive.sellChip);
ok("alloc v5.6.5: the STATE leads the face and the disclaimers sit behind one expander at BOTH altitudes",
  allocLive.faceIsClean && allocLive.discloseSummary);
ok("alloc: the not-a-cash-claim qualifier survives verbatim one tap deep, at BOTH altitudes",
  allocLive.qualifier);
ok("alloc: the measured account (negative cash, debt) survives one tap deep",
  allocLive.acctBeside);
ok("alloc: RECORD FUNDING INTENT — no order is the confirm affordance, two-step",
  allocLive.confirmLink && allocLive.confirmIntentOnly);
ok("alloc: the server-vs-client funding disagreement prints — married, never merged",
  allocLive.disagree);
ok("alloc: WAIT renders the gate reason and withdraws the confirm affordance",
  allocLive.waitChip && allocLive.waitNoConfirm);
ok("alloc: no receipt is a STATED state, never a blank surface",
  allocLive.honest);
ok("alloc: a permission state that moved AGAINST the receipt withdraws the confirm affordance, saying why",
  allocLive.withheldOnStop);

/* v5.6 THE DAILY CONTRACT — driven live: the GATE token on both branches, the spread line
   at both altitudes, the flip line, and the STAMP affordance's three honest states. */
console.log("\n[render] v5.6 THE DAILY CONTRACT — gate, spread, flip line, stamp");
ok("gate: the tripped default fixture reads GATE: TOUCH GRASS on the strip — fail-closed, chip-length, scoped",
  /GATE: TOUCH GRASS/.test(await txt(page, "stanceStrip")));
const daily = await page.evaluate(() => {
  const a = BOOK.find((e) => e.sym === "AAA");
  const prev = { alloc: ALLOC, stamped: ALLOC_STAMPED, circ: BOARD.circuit, reg: BOARD.regime,
    px: LIVE_PX.AAA, card: SCORE_INDEX && SCORE_INDEX.AAA };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  // the entry-recipe: clear gates + a SCORED card so AGREE_PICK lights and both spread
  // altitudes render (the compact banner only exists under a pick).
  BOARD.circuit = { state: "clear", as_of: today };
  BOARD.regime = { asserted: "TAILWIND", as_of: today };
  LIVE_PX.AAA = { px: 300, chg: 0, at: LIVE_PX.AAA.at };
  SCORE_INDEX = SCORE_INDEX || {};
  SCORE_INDEX_META = SCORE_INDEX_META || { methodology_version: "tt-underwriting-v2.6.0" };
  SCORE_INDEX.AAA = { status: "SCORED", raw_score: 8.0, raw_tier: "A", capped_tier: "A",
    methodology_version: SCORE_INDEX_META.methodology_version, broken_thesis: false };
  ALLOC = { schema: "tt-alloc-receipt-v1", at: today + "T14:00:00Z", business_date_et: today,
    state: "BUY_ELIGIBLE", gate: null, macro_gate: { gate: "SEND_IT", rung: null, reason: null },
    eligible: { sym: "AAA", y: "2027", tgt: 400, up: 33.3, ann: 24.1 }, why_not: [],
    context_blockers: ["no measured positions — sync has never run"],
    spread: { AAA: { belief: { pt: 400, y: "2027" }, street: { pt: 340, src: "sourced", as_of: today },
      pct: 20, sign: "you_richer" } },
    overtake: { leader: "AAA", runner_up: "BBB", at_px: 352.4, note: "BBB overtakes AAA if AAA reaches $352.4 first" },
    funding: { label: "FUNDING PRIORITY — not a sell recommendation", rows: [], optOnly: [] },
    inputs: { readout_as_of: today },
    attestation: { input_hash: "a".repeat(64), basis_hash: "b".repeat(64), result_hash: "c".repeat(64) },
    confirmation: null };
  ALLOC_STAMPED = false;
  render();
  const strip = document.getElementById("stanceStrip").innerText;
  const up = document.getElementById("upsideRank").innerText;
  const buy = document.getElementById("buyBlock").innerText;
  const out = {
    gateSendIt: /GATE: SEND IT/.test(strip),
    // ONE builder, TWO altitudes: the labeled sourced leg + the frozen number on both.
    spreadDesk: /you \$400 vs street \$340/.test(up) && /\(sourced/.test(up) && /\+20% you richer/.test(up),
    spreadBuy: /you \$400 vs street \$340/.test(buy),
    flipLine: /BBB overtakes AAA if AAA reaches \$352\.4 first/.test(up),
    stampLink: document.getElementById("allocStampLink") !== null,
    histSummary: /stamped history — the days you committed, scored/.test(buy) };
  // stamped ✓ replaces the link — the committed state is stated, not implied.
  ALLOC_STAMPED = true; render();
  out.stampedTick = /⭑ stamped ✓/.test(document.getElementById("buyBlock").innerText) &&
    document.getElementById("allocStampLink") === null;
  // a prior-business-date receipt WITHHOLDS the stamp with the reason named.
  ALLOC_STAMPED = false; ALLOC = { ...ALLOC, business_date_et: "2026-01-02" }; render();
  out.stampWithheld = /stamp withheld — receipt is dated 2026-01-02/.test(document.getElementById("buyBlock").innerText) &&
    document.getElementById("allocStampLink") === null;
  // street-null on the receipt = STATED, never a number.
  ALLOC = { ...ALLOC, business_date_et: (new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })),
    spread: { AAA: { belief: { pt: 400, y: "2027" }, street: null, pct: null, sign: null } } };
  render();
  out.unreviewed = /street unreviewed — no packet, no sourced target/.test(document.getElementById("upsideRank").innerText);
  ALLOC = prev.alloc; ALLOC_STAMPED = prev.stamped; BOARD.circuit = prev.circ; BOARD.regime = prev.reg;
  LIVE_PX.AAA = prev.px;
  if (prev.card === undefined) delete SCORE_INDEX.AAA; else SCORE_INDEX.AAA = prev.card;
  render();
  return out;
});
ok("gate: a cleared board under FULL actionability reads GATE: SEND IT", daily.gateSendIt);
ok("spread: one builder, two altitudes — labeled sourced leg + the frozen number on the DESK box AND the compact banner",
  daily.spreadDesk && daily.spreadBuy);
ok("flip line: the #2-overtakes sentence renders under the eligible line", daily.flipLine);
ok("stamp: the two-step link renders on a today receipt; stamped ✓ replaces it; a stale receipt withholds with the date named",
  daily.stampLink && daily.stampedTick && daily.stampWithheld);
ok("spread: a null street leg is STATED (street unreviewed), never a number", daily.unreviewed);
ok("stamped history rides the BUY block tail, one tap deep", daily.histSummary);

console.log("\n[render] FEAT-TT-ESTRUN — the board expression inside NEXT DOLLAR");
const estBoard = await txt(page, "estRunBoard");
ok("every modelled name gets a row, denominator stated",
  /3 modelled of 7/i.test(estBoard) && /AAA/.test(estBoard) && /BBB/.test(estBoard));
// FEAT-TT-PTLINT (v3.39, D1+D2): this list used rows[0] (always nearest) while the ranking
// honoured the horizon — two altitudes of the same board naming different years. All three
// surfaces now share pickRow(), so every row here targets the horizon in force. The fixture's
// auto horizon is 2027: AAA and JJJ reach 2028 but BBB's estimates stop at 2027, and the auto
// rule picks the deepest year EVERY modelled name reaches.
ok("legacy owner comparisons still share one explicit horizon after leaving eligibility",
  /by 2027/.test(estBoard) && /%\/yr/.test(estBoard) &&
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
const deepReadyText = await page.locator("#deepView .dd-sec").filter({ hasText: "DECISION READINESS" }).first().innerText();
ok("ready: canonical deep-dive readiness contains no street receipt gate — the two conclusions remain separate",
  /DECISION READINESS/i.test(deepReadyText) && !/street gap|qualitative|reward risk|TICKER GATES/i.test(deepReadyText));
ok("ready: thesis hinges remain visible below the receipt without becoming ticker blockers",
  /1 red/i.test(dv) && /demand/i.test(dv) && !/not actionable until:[^\n]*hinge/i.test(dv));
ok("what-changes-my-mind names the red hinge", /1 red/.test(dv) && /demand/.test(dv));
// ═══ v3.73 TT-SCORE: the shadow scorecard panel — server result rendered verbatim ═══
// AAA's stub is UNSCORABLE/AWAITING_FALSIFIERS with a NO_FLOOR_PREPROFIT and a contingent
// premium: the panel must render the NAMED states and never a placeholder score.
await page.waitForTimeout(400);   // lazy score fetch lands and re-renders the tab
const dvS = (await page.locator("#deepView").innerText()).replace(/\s+/g, " ");
ok("score: the governing panel renders between readiness and the four answers (§15 order)",
  /TT UNDERWRITING · GOVERNS/i.test(dvS) &&
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
// BBB's stub is a COMPLETE server card (B) against a legacy S composite. v5.0 §14.8: the
// CARD governs — the disagreement is HISTORY inside the collapsed details, never a WAIT.
await page.evaluate(() => switchTab("BBB"));
await page.waitForTimeout(500);
await page.evaluate(() => { document.querySelectorAll("#deepView details.schema").forEach((d) => { d.open = true; }); });
const dvB = (await page.locator("#deepView").innerText()).replace(/\s+/g, " ");
// RE-PINNED at v5.0 (§14.8 activation): "WAIT — methods disagree" is RETIRED — the wait
// state existed because two live methods shared one board. The disagreement survives as
// HISTORY beside the legacy number, and the legacy label says superseded, not governing.
ok("score: the card GOVERNS — disagreement with legacy is stated as history, never as a WAIT",
  !/WAIT — methods disagree/.test(dvB) &&
  /disagreed with the governing card: legacy S vs TT B/.test(dvB) && /history, not a wait/.test(dvB));
ok("score: the legacy composite is relabelled HISTORICAL — superseded at activation (one home)",
  /LEGACY \(historical — superseded at §14\.8 activation/.test(dvB) &&
  !/governs the board until activation/.test(dvB));
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
ok("the legacy EV/S premium refuses to equate missing net cash with zero",
  !/\$509/.test(dv) && /18× FY\+1 EPS/.test(dv));
ok("the explicit floor remains available as an owner comparison ($936 vs $800 → +17%)",
  /\$936/.test(dv) && /\+17%/.test(dv));
ok("the old split sections are gone — one table, one year axis",
  !/Consensus estimates/i.test(dv) && !/PT ladder — computed from inputs/i.test(dv));

// SHOTS=/path/prefix → drop full-page screenshots for a human eyeball pass (never in CI).
if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "-desktop-dd.png", fullPage: true });

console.log("\n[render] FEAT-TT-SPREAD — legacy comparison stays honest under missing inputs");
ok("missing net cash suppresses the EV/S inversion instead of assuming exactly zero",
  !/market pays/.test(dv) && !/credits [\d.]+% of your 2028 case/.test(dv));
ok("the published legacy average is read directly rather than recomputing low/average/high",
  /street ~\$485 vs mine \$936/.test(dv));
ok("the additive street receipt separately labels TipRanks' 12-month published average",
  /\$1100 published average · 12m/.test(streetRank));

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
ok("the auto horizon states itself and its rule, never passing as a deliberate choice",
  /auto · year-end 2027/i.test(rankTxt) && /deepest year EVERY modelled name reaches/i.test(rankTxt));
ok("every modelled+priced name is ranked at the auto horizon (nothing silently dropped)",
  /AAA/.test(rankTxt) && /BBB/.test(rankTxt) && /JJJ/.test(rankTxt) &&
  !/dropped for having no/.test(rankTxt) && /all % share the 2027 horizon/i.test(rankTxt));

// v3.81: the picker itself. It rendered the CHOICE at 9.5px but offered no usable way to
// CHANGE it, which is how a live book sat on "nearest" reporting +1970%/yr. Driven for real:
// the colour must be readable before the tap, and the tap must actually move the horizon.
const hzKinds = await page.evaluate(() => [...document.querySelectorAll("#upsideRank .hzb")]
  .map(b => ({ lab: b.textContent.trim(), tag: b.tagName, pressed: b.getAttribute("aria-pressed"),
               c: getComputedStyle(b).getPropertyValue("--hzc").trim() })));
const hzAuto = hzKinds.find(b => b.lab === "auto"), hzNear = hzKinds.find(b => b.lab === "nearest");
const hzYear = hzKinds.find(b => /^\d{4}$/.test(b.lab));
ok("horizon picker: every option is a real <button> carrying aria-pressed, and auto reads pressed",
  hzKinds.length >= 3 && hzKinds.every(b => b.tag === "BUTTON" && b.pressed !== null)
  && hzAuto.pressed === "true" && hzNear.pressed === "false");
ok("horizon picker: the three kinds paint three DIFFERENT colours — the mode is legible before the tap",
  !!hzAuto && !!hzNear && !!hzYear
  && new Set([hzAuto.c, hzNear.c, hzYear.c]).size === 3
  && hzAuto.c !== "" && hzNear.c !== "");
// A real click, not a setHorizon() call — the whole defect was that the control could be seen
// and not used, so the proof has to go through the element. (The session modal from the block
// above is still open and would intercept the pointer.)
await page.evaluate(() => closeCard());
await page.waitForTimeout(100);
await page.locator("#upsideRank .hzb", { hasText: /^nearest$/ }).click();
await page.waitForTimeout(150);
const nearState = await page.evaluate(() => ({
  horizon: HORIZON,
  pressed: [...document.querySelectorAll("#upsideRank .hzb")]
    .filter(b => b.getAttribute("aria-pressed") === "true").map(b => b.textContent.trim()),
  txt: document.getElementById("upsideRank").innerText,
}));
// setHorizon normalises a falsy pick to null (the v3.21 contract), so "nearest" is null here.
ok("horizon picker: clicking an option actually moves the horizon and moves the pressed state with it",
  nearState.horizon === null && nearState.pressed.length === 1 && nearState.pressed[0] === "nearest");
// The fixture's nearest rungs are ordinary, so the distortion warning must NOT fire — it is a
// measurement, not decoration. (The four-figure case is executed in smoke against real rows.)
ok("horizon picker: no distortion nag on an undistorted nearest ranking — the warning is computed, not decorative",
  !/NEAREST is distorting/i.test(nearState.txt));
const backToAuto = await page.evaluate(() => {
  const b = [...document.querySelectorAll("#upsideRank .hzb")].find(x => x.textContent.trim() === "auto");
  b.click(); return HORIZON;
});
ok("horizon picker: auto is one tap back from nearest, with no navigation", backToAuto === "auto");

// The whole-book lint remains canonical, while the provider receipt must stay independent of
// owner-model schedules. Mutated in-page then restored, so no fixture count shifts.
const lintSeen = await page.evaluate(() => {
  const streetBefore = document.getElementById("streetEligibility").innerText;
  const keep = JSON.parse(JSON.stringify(BOOK[0].deepDive.pt_model));
  BOOK[0].deepDive.pt_model.ev_s_multiple = { 2028: 8, 2029: 7 };
  render();
  const board = document.getElementById("upsideRank").innerText;
  const streetAfter = document.getElementById("streetEligibility").innerText;
  switchTab("AAA");
  const tab = document.getElementById("deepView").innerText;
  BOOK[0].deepDive.pt_model = keep;
  switchTab("BOARD"); render();
  return { streetBefore, streetAfter, board, tab };
});
ok("a mis-keyed multiple schedule is named on the canonical BOARD",
  /MIS-KEYED/i.test(lintSeen.board) && /AAA/.test(lintSeen.board) && /the rung shown is a floor fallback/i.test(lintSeen.board));
ok("changing an owner multiple cannot change the independent published-target receipt",
  lintSeen.streetAfter === lintSeen.streetBefore && !/MIS-KEYED/i.test(lintSeen.streetAfter));
ok("the name's own tab explains a bad schedule and its convention",
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
// FEAT-CAPEX-OCF (v3.83): the funding tell — amber, leading, distinct from the red turn.
ok("capex-ocf: the DEBT-FUNDED banner fires at 2 of 2 measured past OCF, naming both",
  /DEBT-FUNDED BUILDOUT/.test(cxPanel) && /2 of 2 measured/.test(cxPanel) &&
  /HYPA, HYPB/.test(cxPanel));
ok("capex-ocf: per-row ratios render (8/6 = 1.33) and the unmeasured row is NAMED, never counted",
  /capex\/OCF 1\.33/.test(cxPanel) && /capex\/OCF 1\.20/.test(cxPanel) &&
  /funding unmeasured \(no ocf_B\): HYPC/.test(cxPanel));
ok("capex-ocf: the closed drawer summary carries the amber funding chip beside the red count",
  /debt-funded 2\/2/i.test(await txt(page, "sCapex")));
// v3.55: the fixture now has BOTH legs red (capex turning + demand falsified), so the strip
// carries the MERGED badge — one chip for one thesis, one drawer. The capex-only and
// demand-only forms are pinned at source in smoke.
ok("capex: the ⚡ badge is SIGNALLED while closed and reads verbatim one tap deep (v5.6.5)",
  (await (async () => {
    const closed = await txt(page, "stanceStrip");
    if (!/⚠ \d+ flags?/i.test(closed)) return false;
    await page.locator("#stanceStrip details.why > summary").click();
    const open = await txt(page, "stanceStrip");
    await page.locator("#stanceStrip details.why > summary").click();
    return /⚡ AI both legs/.test(open);
  })()));
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

// v4.1 Step 7 — WHY MACRO: the pill toggles the evidence panel (the readout's checks/
// bullish/bearish/confidence were published and never read; the hover title is unreachable
// on touch). The fixture readout predates evidence detail, so the FIRST open proves the
// honest-empty branch — a message, never zeros dressed as a tally.
ok("step7: the pill is a real button and WHY MACRO starts closed at zero height",
  await page.evaluate(() => document.getElementById("regimePill").tagName === "BUTTON" &&
    document.getElementById("regimePill").getAttribute("aria-expanded") === "false" &&
    getComputedStyle(document.getElementById("macroEvidence")).display === "none"));
await page.locator("#regimePill").click();
ok("step7: tapping the pill opens the panel, aria follows, and an old body SAYS it predates evidence detail",
  await page.evaluate(() => document.getElementById("regimePill").getAttribute("aria-expanded") === "true" &&
    document.getElementById("macroEvidence").style.display === "block" &&
    /predates evidence detail/.test(document.getElementById("macroEvidence").textContent)));
ok("step7: a full evidence body renders the tally + per-check rows — bearish named, 10Y level, missing warned, presentation-only stated",
  await page.evaluate(() => {
    const keep = REGIME;
    applyRegime({ as_of: keep.as_of, us10y: { yield: 4.31 },
      regime: { ...keep.regime, checks: [
        { name: "spy_vs_200d", state: "bullish", reason: "+4.1% vs 200d (bands ±3%)", as_of: "2026-08-18" },
        { name: "us10y_trend", state: "bearish", reason: "m1 +0.17 → spiking", as_of: "2026-08-18" },
        { name: "fed_next_meeting", state: "unavailable", reason: "Kalshi odds unavailable", as_of: null },
      ], bullish: 1, bearish: 1, missing: 1, confidence: "HIGH", actionability: "FULL",
      reason: "missing: fed_next_meeting" },
      macro_flip: keep.macro_flip });
    const t = document.getElementById("macroEvidence").innerText;
    const good = /1 bullish/.test(t) && /1 bearish/.test(t) && /1 missing/.test(t) &&
      /HIGH · FULL/.test(t) && /us10y_trend/.test(t) && /level 4\.31%/.test(t) &&
      /missing: fed_next_meeting/.test(t) && /presentation only/.test(t);
    applyRegime(keep);
    return good;
  }));
await page.locator("#regimePill").click();
ok("step7: a second tap closes WHY MACRO and aria follows — the fold budget below is measured closed",
  await page.evaluate(() => document.getElementById("regimePill").getAttribute("aria-expanded") === "false" &&
    document.getElementById("macroEvidence").style.display === "none"));
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
/* Budget history, each move measured and reasoned (the v3.45 rule — never quietly loosened):
   140 (v3.42) -> 185 (v5.6, the GATE token earned one packing row, measured 178 on this
   dense restrictive fixture) -> 120 (v5.6.5, TIGHTENED): the qualifiers and badges moved
   behind one counted expander, so the top row is gate + verdict + controls and measures
   86px. A budget that no longer binds is not a guard, so it comes back down with the win;
   120 leaves one wrap row of headroom and still fails on a second. */
const stanceTopH = (await phone.locator("#stanceStrip .stance-top").boundingBox()).height;
ok(`stance bar top row is compact at 390px — gate, verdict and controls, never prose soup (${stanceTopH}px)`,
  stanceTopH < 120);
ok("the tab strip is ONE row at 390px — it scrolls horizontally, it never wraps",
  (await phone.locator("#tabBar").boundingBox()).height < 60);
// v3.81: the horizon defect was reachability, not visibility — measure the thumb target where
// the failure actually happened. The picker lives in DESK on the phone layout.
await phone.evaluate(() => openDesk("dNext"));
await phone.waitForTimeout(200);
const hzBox = await phone.locator("#upsideRank .hzb").first().boundingBox();
ok(`horizon picker: a real thumb target at 390px, not the old 9.5px chip (${Math.round(hzBox.height)}px)`,
  hzBox.height >= 40);
// Restore the closed default — the later assertions budget the primary view, and a left-open
// DESK would both fail the closed-drawer contract and widen the page.
await phone.evaluate(() => { document.querySelectorAll("#boardView details[open]")
  .forEach(d => { if (d.id !== "dChanged") d.open = false; }); });
await phone.waitForTimeout(100);
// v3.62 FEAT-TT-DECK: the two capital-allocation answers are phone focus views. The buttons
// are the accessible contract; scroll-snap is an optional touch shortcut.
ok("decision deck: SHARE RANKS is visible without opening the OPS disclosure",
  await phone.locator("header .hb-ranks").isVisible() &&
  !(await phone.locator("#headInfo").isVisible()));
// v4.0.2: the loop's back half — ← MACRO permanent in the bar, zero clicks, real href;
// and the old footnote is NOT hiding in the (closed) disclosure waiting to confuse.
ok("v4.0.2: ← MACRO is visible with ZERO clicks and links home",
  await phone.locator("header .hb-back").isVisible() &&
  (await phone.locator("header .hb-back").getAttribute("href")) === "/" &&
  await phone.locator('#headInfo a[href="/"]').count() === 0);
ok("v4.0.2: the bar stays ONE LINE at 390px even with a long verdict in the pill",
  await phone.evaluate(() => {
    document.getElementById("regimePill").textContent = "HOLD · degraded — do not gate";
    return Math.round(document.querySelector(".hbar").getBoundingClientRect().height) < 30;
  }));
ok("decision deck: three labelled controls exist (BUY / FUND / MAG 7, v3.84) and BUY starts selected",
  (await phone.locator('.decision-tabs [role="tab"]').count()) === 3 &&
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
// v5.2: the count is over-cap rows (informational) — "N ⚠cap", still RED on the closed
// tab (v3.25: the red fact survives the collapse) and still never auto-opens.
ok('decision deck: an over-cap position shows as a RED ⚠cap count on the closed FUND / TRIM tab, and never auto-opens it (v5.2)',
  /^FUND \/ TRIM · [1-9]\d* ⚠cap$/.test(fundTabText) &&
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
// FEAT-TT-MAG7 (v3.84): the third panel, driven for real. End key from the FUND tab reaches
// MAG 7; the panel renders the honest empty state on this fixture (no Mag-7 name is modelled).
await phone.locator("#decisionFundTab").focus();
await phone.keyboard.press("End");
await phone.waitForTimeout(350);
ok("mag7 deck: End key reaches the MAG 7 tab and its panel is active (not inert)",
  (await phone.locator("#decisionMagTab").getAttribute("aria-selected")) === "true" &&
  await phone.locator("#decisionMag").getAttribute("inert") === null);
const magTxt = await phone.locator("#magBlock").innerText();
ok("mag7 deck: with no Mag-7 name modelled the panel states it honestly — never an empty box",
  /no Mag-7 name carries a rankable model/i.test(magTxt) &&
  /the main ranking is the source/i.test(magTxt));
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
ok(`decision deck: exactly 5 rows show by default with 11 ranked total (v5.2: no forced tier; no-rate and options rows rank too) — the rest counted, never hidden (direct=${tail.directRows}, tail=${tail.tailRows}, "${tail.tailSummary}")`,
  tail.directRows === 5 &&   // FUNDING_VISIBLE — no forced row above the pool any more
  tail.tailRows === 6 &&     // 11 ranked (5 base incl. AAA/CCC/FFF/EEE + 6 injected) - 5 visible
  /\+6 lower-priority funding sources/.test(tail.tailSummary) &&
  /11 ranked total/.test(tail.tailSummary));
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
// FEAT-TT-MAG7 (v3.84): the third tab is a labelled accessible control for a real view —
// legitimate content, not chrome, so the budget moves with it (the v3.45 capex-badge and H1
// forced-trim precedents). Measured +6px at 390px (the wider tab row).
ok(`slice5: on an everyday PERMISSIVE board the first ANSWER is high on screen — BUY at y=${buyTopPermissive} of 844, was 587`,
  buyTopPermissive < 470);
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
const holdGateState = await holdPage.evaluate(() => {
  BOARD.circuit.state = "clear"; render();
  return {
    stance: stance().txt,
    rank: document.getElementById("upsideRank").textContent,
    street: document.getElementById("streetEligibility").textContent,
    pick: AGREE_PICK && AGREE_PICK.sym,
  };
});
ok("degraded-hold: Engine 0 HOLD is a hard WAIT in stance, not a permissive NEUTRAL",
  /ADDS SUSPENDED — Engine 0 HOLD/.test(holdGateState.stance));
ok("degraded-hold: a prior FULL street receipt becomes WAIT and the canonical pick also clears",
  holdGateState.pick === null && /WAIT/.test(holdGateState.rank) && /WAIT/.test(holdGateState.street) &&
  /predates current Engine 0 readout/.test(holdGateState.street));

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

/* ── FEAT-TT-DDSTORE (v3.75) — the split, driven live ────────────────────────────────
   JJJ's payload is NOT embedded in the book fixture; it exists only behind /api/deepdive.
   The strongest evidence for the split is negative and already recorded above: every JJJ
   assertion in this suite predates it and still passes. What follows tests the two things
   those cannot — that the board can act on a name it never opened, and that the tab shows
   strictly MORE than the board's working set once the full payload lands. */
{
  const p2 = await open(1200);
  await p2.waitForTimeout(700);
  const board = (await p2.locator("body").innerText()).replace(/\s+/g, " ");
  // The board ranks JJJ off index-carried pt_model/consensus/ref_px with no tab ever opened.
  ok("ddstore: a name whose payload is store-only still reaches the board's ranking — the index " +
     "carries the fields the ranking reads, so lazy loading never costs a name its place",
    /JJJ/.test(board));
  // v3.25, the rule this split could most easily have broken: a red hinge that only lives in
  // the full payload would silently read as zero reds on every unopened name.
  ok("ddstore: JJJ's red hinge is counted on the board WITHOUT the tab ever being opened",
    await p2.evaluate(() => {
      const dd = ddOf(find("JJJ"));
      return !!dd && Array.isArray(dd.hinges) && dd.hinges.filter((h) => h.state === "red").length === 1;
    }));
  ok("ddstore: what the board holds for JJJ IS the index — partial, and it says so",
    await p2.evaluate(() => ddIsPartial("JJJ") === true));
  // The index is a whitelist: prose it omits must be absent from the board's copy, or the
  // split would have bought nothing.
  ok("ddstore: the board's copy carries the ranking inputs and NOT the prose the tab renders",
    await p2.evaluate(() => {
      const dd = ddOf(find("JJJ"));
      return !!dd.pt_model && !!dd.consensus && !!dd.ref_px && dd.rules === undefined && dd.kill_combination === undefined;
    }));
  // Opening the tab must fetch the whole thesis and render what the index never carried.
  await p2.evaluate(() => switchTab("JJJ"));
  await p2.waitForTimeout(600);
  await p2.evaluate(() => { document.querySelectorAll("#deepView details").forEach((d) => { d.open = true; }); });
  const dvJ = (await p2.locator("#deepView").innerText()).replace(/\s+/g, " ");
  ok("ddstore: opening the tab loads the FULL payload — fields the index omits render there",
    /never average down into a broken base/.test(dvJ) && await p2.evaluate(() => ddIsPartial("JJJ") === false));
  ok("ddstore: once the full payload has landed the partial banner is gone",
    !/board index only/.test(dvJ));
  // A fetch that changes nothing must not collapse what the reader just opened, and must not
  // refire on every render — renderDeepDive calls the loader unconditionally.
  const before = await p2.evaluate(() => document.querySelectorAll("#deepView details[open]").length);
  await p2.evaluate(() => renderDeepDive("JJJ"));
  await p2.waitForTimeout(400);
  ok("ddstore: a re-render does not refetch and does not collapse the reader's open sections",
    await p2.evaluate(() => !DD_INFLIGHT.has("JJJ")) && before > 0);
  await p2.close();
}

/* ── FEAT-TT-ALLREVIEWED (v3.76) — the reviewed-but-unpriced tail, driven live ──────────
   Owner: "every TT review must factor into the next dollar even if with an asterisk." The
   fixture's CCC/DDD/EEE/FFF all carry a run stamp and no model, so they are exactly the case
   that used to leave the surface entirely and survive as a sentence in a collapsed expander. */
{
  const p3 = await open(390, 844);
  await p3.waitForTimeout(1200);
  const buy = (await p3.locator("#buyBlock").innerText()).replace(/\s+/g, " ");
  ok("allreviewed: the PRIMARY view carries the asterisked tail — a reviewed name is never " +
     "absent from the next dollar merely because the math cannot price it",
    /reviewed · no %\/yr yet/i.test(buy) && /ranked on TT composite/i.test(buy));
  ok("allreviewed: each primary-view tail row names the missing input",
    /no thesis payload stored/i.test(buy));
  ok("allreviewed: the tail rows are real buttons (a card is one tap from the ranking)",
    await p3.evaluate(() => {
      const btns = [...document.querySelectorAll("#buyBlock button.fdr-row")];
      return btns.length > 0 && btns.some((b) => /no thesis payload/i.test(b.innerText));
    }));
  ok("allreviewed: the footer counts BOTH populations, so 'N ranked of M' can no longer read " +
     "as though the remainder was never considered",
    /ranked of/i.test(buy) && /reviewed but unpriced/i.test(buy));
  // The two bases must stay visually and semantically separate — a tail row must never show a
  // %/yr, or the reader would sort it against the ranked rows above.
  ok("allreviewed: no tail row shows a %/yr — the rate it does not have never leaks in",
    await p3.evaluate(() => [...document.querySelectorAll("#buyBlock button.fdr-row")]
      .filter((b) => /no thesis payload|no pt_model|no usable price|rung/i.test(b.innerText))
      .every((b) => !/%\/yr/.test(b.innerText))));
  // Found live on 2026-08-05: the two names topping the real ranking both carried a
  // pt_model.note saying distrust the number, and that note reached only the DESK list.
  ok("allreviewed: a model caveat on a ranked pick surfaces on the PRIMARY view, not only in " +
     "DESK — a stored warning about the number being shown must reach where it is acted on",
    await p3.evaluate(() => {
      const b = [...document.querySelectorAll("#buyBlock button.fdr-row")]
        .find((n) => /⚠ model note/.test(n.innerText));
      return !!b && /\S/.test(b.querySelector('[title]')?.getAttribute("title") || "");
    }));
  ok("allreviewed: the tail adds no horizontal overflow at 390px",
    await p3.evaluate(() => document.documentElement.scrollWidth <= 390));
  // And the same array, one level down, in the DESK ranking.
  await p3.evaluate(() => openDesk("dNext"));
  await p3.waitForTimeout(500);
  const desk = (await p3.locator("#upsideRank").innerText()).replace(/\s+/g, " ");
  ok("allreviewed: the DESK ranking renders the SAME tail with its full reason list",
    /Reviewed · not rate-rankable/i.test(desk) && /ordered by TT card score/i.test(desk));
  ok("allreviewed: the DESK tail count equals the board's — one computation, two altitudes",
    await p3.evaluate(() => {
      const n = UNRANKED_ROWS.length;
      const deskN = document.querySelectorAll("#upsideRank .picks")[1]?.children.length || 0;
      return n > 0 && deskN === n;
    }));
  await p3.close();
}

await browser.close();
server.close();
console.log(`\n=== RENDER TEST: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
