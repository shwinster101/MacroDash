// src/ttReadout.js — MacroDash v3.3 · TT ("Ticker Terminal") regime readout mapping (FEAT-330).
//
// PURE, React-free, Node-testable. Imports only { isStale } from ./sources.js (also pure).
// Consumed by THREE call sites — keep it dependency-free so all three bundle cleanly:
//   1. functions/readout.json.js  (Cloudflare Pages Function; esbuild inlines this relative
//      import — the first functions/→src/ import in the repo, so it MUST stay React/DOM-free)
//   2. src/dashboard.jsx          (the Macro Flip banner + "Copy TT readout" button)
//   3. test/smoke.mjs             (every band boundary below is asserted)
//
// ⚠ THIS TABLE GATES REAL ORDERS in the maintainer's TT framework (Engine 0 / Macro Flip
// circuit). Every band boundary is smoke-tested (DEC-33). Change a band ONLY with a matching
// test change — a silent drift here mis-classifies live capital.

import { isStale } from "./sources.js";

const round2 = (n) => Math.round(n * 100) / 100;
const bandLabel = (s) => (s == null ? "unavailable" : s); // null band -> "unavailable" check state

// ─── Per-check band functions (DEC-33 — boundaries pinned; null input -> null) ───────────

// SPY vs 200-day SMA (percent). >+3% bullish · within ±3% neutral · <−3% bearish.
export function bandSpyVs200d(pct) {
  if (pct == null || !isFinite(pct)) return null;
  if (pct > 3) return "bullish";
  if (pct < -3) return "bearish";
  return "neutral";
}

// VIX level. <18 bullish · 18–25 neutral · >25 bearish. (25 is still neutral; panic needs >25.)
export function bandVix(v) {
  if (v == null || !isFinite(v)) return null;
  if (v < 18) return "bullish";
  if (v > 25) return "bearish";
  return "neutral";
}

// CNN Fear & Greed. 25–55 bullish · <20 or >75 bearish · everything between neutral
// (the 20–25 and 55–75 ranges are doc gaps in the TT §1.2 table — resolved to neutral, DEC-33).
export function bandFearGreed(v) {
  if (v == null || !isFinite(v)) return null;
  if (v < 20 || v > 75) return "bearish";
  if (v >= 25 && v <= 55) return "bullish";
  return "neutral";
}

// QQQ/SPY relative strength from the 1-day change delta (pp). Returns an RS state, not a
// bull/bear state (mapped separately). ±0.3pp deadband so a normal same-direction day = "inline".
export function bandRs(delta) {
  if (delta == null || !isFinite(delta)) return null;
  if (delta > 0.3) return "leading";
  if (delta < -0.3) return "breaking_down";
  return "inline";
}

// 10Y monthly trend (m1 delta, ppt). Mirrors computeRegime() in dashboard.jsx:
// < −0.10 falling · −0.10…+0.15 rangebound · > +0.15 spiking. Never substitute a weekly delta.
export function bandTenYear(m1) {
  if (m1 == null || !isFinite(m1)) return null;
  if (m1 < -0.1) return "falling";
  if (m1 > 0.15) return "spiking";
  return "rangebound";
}

// Kalshi NEXT-MEETING odds (not "by December"). cut>50 bullish · hike>50 bearish · else neutral.
export function bandFedOdds({ hold, cut, hike } = {}) {
  const anyLive = [hold, cut, hike].some((x) => typeof x === "number" && isFinite(x));
  if (!anyLive) return null;
  if (typeof cut === "number" && cut > 50) return "bullish";
  if (typeof hike === "number" && hike > 50) return "bearish";
  return "neutral";
}

const RS_TO_STATE = { leading: "bullish", inline: "neutral", breaking_down: "bearish" };
const TREND_TO_STATE = { falling: "bullish", rangebound: "neutral", spiking: "bearish" };

// ─── Verdict aggregation ─────────────────────────────────────────────────────────────────
// Plurality of bullish vs bearish among AVAILABLE checks (neutral counts only toward available).
// <3 available -> INSUFFICIENT (a 1–2-input verdict must never gate an order). Tie -> NEUTRAL.
// PANIC is applied by buildTtReadout (it needs the raw vix/F&G values), overriding everything.
export function aggregateVerdict(checks) {
  let available = 0, bullish = 0, bearish = 0;
  for (const c of checks) {
    if (c.state === "unavailable") continue;
    available++;
    if (c.state === "bullish") bullish++;
    else if (c.state === "bearish") bearish++;
  }
  let verdict;
  if (available < 3) verdict = "INSUFFICIENT";
  else if (bullish > bearish) verdict = "TAILWIND";
  else if (bearish > bullish) verdict = "HEADWIND";
  else verdict = "NEUTRAL";
  return { verdict, available, bullish, bearish };
}

// ─── Macro Flip circuit (null-safe) ──────────────────────────────────────────────────────
// armed = VIX > 22 · tripped = SPY < 200-day SMA AND VIX > 25. Any missing input -> null
// (a fabricated circuit state is worse than none — same doctrine as the dashboard honesty rule).
export function computeMacroFlip({ vix, spyPrice, spyMa200 } = {}) {
  const v = typeof vix === "number" && isFinite(vix) ? vix : null;
  const p = typeof spyPrice === "number" && isFinite(spyPrice) ? spyPrice : null;
  const m = typeof spyMa200 === "number" && isFinite(spyMa200) ? spyMa200 : null;
  const armed = v == null ? null : v > 22;
  const tripped = v == null || p == null || m == null ? null : p < m && v > 25;
  const pct_vs_200d = p != null && m != null && m !== 0 ? round2(((p - m) / m) * 100) : null;
  return { armed, tripped, inputs: { vix: v, spy_price: p, spy_ma200: m, pct_vs_200d } };
}

// ─── The full readout body ───────────────────────────────────────────────────────────────
// `live` = flat snapshot fields (the `live` object /api/snapshot returns, or the projection the
// dashboard builds from LIVE/CACHED tiles). A field is USED only if present, finite, and not
// stale for its cadence (isStale reused from sources.js — the same gate the dashboard vote uses).
export function buildTtReadout(live, { now = new Date() } = {}) {
  const L = live || {};
  const asOf = (key) => L[key + "AsOf"] ?? null;
  const fresh = (key, cadence = "daily") => {
    const v = L[key];
    if (v === undefined || v === null) return null;
    if (isStale(L[key + "AsOf"], now, cadence)) return null;
    return v;
  };
  const num = (key, cadence = "daily") => {
    const v = fresh(key, cadence);
    return typeof v === "number" && isFinite(v) ? v : null;
  };

  // Blocks — each null-safe; whole block null when its identifying inputs are all missing.
  const spyPrice = num("spyPrice");
  const spyMa200 = num("spyMa200"); // may be null: <200 valid SP500 obs — check skips, never fabricated
  const pctVs200d = spyPrice != null && spyMa200 != null && spyMa200 !== 0 ? round2(((spyPrice - spyMa200) / spyMa200) * 100) : null;
  const spy = { price: spyPrice, sma200: spyMa200, pct_vs_200d: pctVs200d, as_of: asOf("spyPrice") };

  const vix = { value: num("vix"), week_chg: num("vixWeekChg"), as_of: asOf("vix") };
  const fear_greed = { value: num("fearGreed"), label: fresh("fearGreedLabel") ?? null, as_of: asOf("fearGreed") };

  const qqq1d = num("qqqChangePct");
  const spy1d = num("spyChangePct");
  let qqq_spy_rs = null, rsDelta = null;
  if (qqq1d != null && spy1d != null) {
    rsDelta = round2(qqq1d - spy1d);
    qqq_spy_rs = { state: bandRs(rsDelta), basis: "1d", qqq_1d: qqq1d, spy_1d: spy1d, as_of: asOf("qqqPrice") };
  }

  const m1 = num("tenYearM1");
  const us10y = { yield: num("tenYear"), trend: bandTenYear(m1), m1_delta: m1, as_of: asOf("tenYear") };

  const hold = num("rateOddsHold"), cut = num("rateOddsCut"), hike = num("rateOddsHike");
  const fed_odds = hold == null && cut == null && hike == null ? null
    : { next_meeting: fresh("nextFomcDate") ?? null, days_out: num("fomcDays"), hold, cut, hike, as_of: asOf("rateOddsHold") };

  // Checks — ALWAYS six, in a stable order, for audit. state ∈ bullish|neutral|bearish|unavailable.
  const rsState = qqq_spy_rs ? RS_TO_STATE[qqq_spy_rs.state] : null;
  const trendState = us10y.trend ? TREND_TO_STATE[us10y.trend] : null;
  const fedState = fed_odds ? bandFedOdds({ hold, cut, hike }) : null;
  const checks = [
    { name: "spy_vs_200d", state: bandLabel(bandSpyVs200d(pctVs200d)), value: pctVs200d,
      reason: pctVs200d == null ? "SPY or 200d SMA unavailable" : `${pctVs200d > 0 ? "+" : ""}${pctVs200d}% vs 200d (bands ±3%)` },
    { name: "vix", state: bandLabel(bandVix(vix.value)), value: vix.value,
      reason: vix.value == null ? "VIX unavailable" : `VIX ${vix.value} (bands 18 / 25)` },
    { name: "fear_greed", state: bandLabel(bandFearGreed(fear_greed.value)), value: fear_greed.value,
      reason: fear_greed.value == null ? "F&G unavailable" : `F&G ${fear_greed.value} (bull 25–55 · bear <20 / >75)` },
    { name: "qqq_spy_rs", state: bandLabel(rsState), value: rsDelta,
      reason: qqq_spy_rs == null ? "QQQ or SPY 1d change unavailable" : `QQQ ${rsDelta > 0 ? "+" : ""}${rsDelta}pp vs SPY (1d basis, ±0.3pp)` },
    { name: "us10y_trend", state: bandLabel(trendState), value: m1,
      reason: m1 == null ? "10Y monthly delta unavailable" : `m1 ${m1 > 0 ? "+" : ""}${m1} → ${us10y.trend}` },
    { name: "fed_next_meeting", state: bandLabel(fedState), value: fed_odds ? hold : null,
      reason: fed_odds == null ? "Kalshi odds unavailable" : `hold ${hold} / cut ${cut} / hike ${hike} (next meeting)` },
  ];

  const agg = aggregateVerdict(checks);
  // PANIC — mechanized capitulation. Both inputs must be live; overrides any base verdict
  // (including INSUFFICIENT) because it is the most safety-critical state (25/20 are non-panic).
  const panic = vix.value != null && fear_greed.value != null && vix.value > 25 && fear_greed.value < 20;
  const verdict = panic ? "PANIC" : agg.verdict;

  const macro_flip = computeMacroFlip({ vix: vix.value, spyPrice, spyMa200 });

  return {
    spy, vix, fear_greed, qqq_spy_rs, us10y, fed_odds,
    regime: {
      verdict, checks,
      available: agg.available, bullish: agg.bullish, bearish: agg.bearish,
      panic_inputs: { vix: vix.value, fear_greed: fear_greed.value, panic },
    },
    macro_flip,
    attribution: ["FRED (SP500/10 proxy · VIXCLS · DGS10)", "CNN Fear & Greed", "Kalshi KXFEDDECISION"],
  };
}

// ─── Human paste block (TT integration doc §1.2) ─────────────────────────────────────────
// Compact fixed-width text for the "Copy TT readout" button — a maintainer on mobile pastes
// this into a chat. `n/a` for any null; the footer carries the honesty caveats.
export function formatTtPaste(readout, { generatedEt } = {}) {
  const r = readout || {};
  const na = (v, suffix = "") => (v == null ? "n/a" : `${v}${suffix}`);
  const pct = (v) => (v == null ? "n/a" : `${v > 0 ? "+" : ""}${v}%`);
  // Value cell: pad to a column, but always leave ≥1 space so a long label can't touch the paren.
  const cell = (s) => { s = String(s); return s.length >= 11 ? s + " " : s.padEnd(11); };
  const spy = r.spy || {}, vix = r.vix || {}, fg = r.fear_greed || {}, rs = r.qqq_spy_rs, ten = r.us10y || {}, fed = r.fed_odds, reg = r.regime || {}, flip = r.macro_flip || {};
  const lines = [];
  lines.push(`TT READOUT${generatedEt ? ` · ${generatedEt}` : ""} · macrodash.pages.dev`);
  lines.push(`SPY vs 200d  ${cell(pct(spy.pct_vs_200d))}(${na(spy.price)} / ${na(spy.sma200)}${spy.as_of ? ` · as of ${spy.as_of}` : ""})`);
  lines.push(`VIX          ${cell(na(vix.value))}(${vix.week_chg == null ? "wk n/a" : `wk ${vix.week_chg > 0 ? "+" : ""}${vix.week_chg}%`}${vix.as_of ? ` · as of ${vix.as_of}` : ""})`);
  lines.push(`F&G          ${cell(`${na(fg.value)}${fg.label ? ` ${fg.label}` : ""}`)}(${fg.as_of ? `as of ${fg.as_of}` : "n/a"})`);
  lines.push(`QQQ RS 1d    ${cell(na(rs && rs.state))}(${rs ? `QQQ ${rs.qqq_1d > 0 ? "+" : ""}${rs.qqq_1d}% vs SPY ${rs.spy_1d > 0 ? "+" : ""}${rs.spy_1d}%` : "n/a"})`);
  lines.push(`10Y TREND    ${cell(na(ten.trend))}(${na(ten.yield, "%")}${ten.m1_delta == null ? "" : ` · m1 ${ten.m1_delta > 0 ? "+" : ""}${ten.m1_delta}`})`);
  lines.push(`FED NEXT     ${fed ? `hold ${fed.hold} / cut ${fed.cut} / hike ${fed.hike}` : "n/a"}${fed && fed.next_meeting ? `  (${fed.next_meeting}${fed.days_out != null ? ` · ${fed.days_out}d` : ""})` : ""}`);
  lines.push("-".repeat(56));
  lines.push(`REGIME       ${cell(na(reg.verdict))}(${reg.bullish ?? 0} bull / ${reg.bearish ?? 0} bear · ${reg.available ?? 0} checks)`);
  const flipTxt = flip.tripped ? "TRIPPED — de-risk" : flip.armed ? "ARMED" : flip.armed === false ? "not armed" : "n/a";
  lines.push(`MACRO FLIP   ${flipTxt}`);
  lines.push("RS basis=1d only · Fed odds = next meeting (not by-Dec) · end-of-day data · not advice");
  return lines.join("\n");
}
