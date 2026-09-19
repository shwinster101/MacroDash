/* BEYOND THE VOTE (v7.1) — the pure projection behind Degen's non-voter evidence block.
   No computation of its own: every threshold comes from contextBands.js, every role and every
   "why it does not vote" sentence from signalRoles.js, and every reading from the SAME merged
   data object the rest of the page renders. Presentation shaping only.

   WHY THIS BLOCK EXISTS. v6.9.9.5 gave the SIX VOTERS one primary evidence view. Nothing ever
   organised the rest. The non-voting signals the feed already carries — credit, the junk tail,
   both curve spreads, financial leverage, labour, the price technicals, the rate path — reached
   Degen only as leftover tiles from the pre-v6 era, with NO STATED ROLE. A reader could not tell
   a context tile from a voter from an input to a safety circuit, and the page never said which
   readings the call is actually built from. Owner, 2026-09-19: the seat count is fixed at six,
   and everything else is real and must be integrated — as something other than a vote.

   ⚠ CORRECTION TO MY OWN PLAN, recorded rather than quietly followed. The plan for this slice
   said to call buildTtReadout() client-side for the four Engine 0 checks the backdrop does not
   vote on, and to simply never read its verdict. That was the wrong shape, for two reasons.
   (1) Every one of those four checks is a READING this page already holds — SPY against its
   200-day, QQQ against SPY, the Fed odds, the 30Y curve — so running an order-gating engine to
   re-derive them would put a SECOND derivation beside the strip that renders the same numbers,
   which is the one-page-two-answers defect (v6.0.2) introduced on purpose. (2) "Readings only,
   no verdict word" (owner ruling) becomes structural if there is no verdict in scope, and a
   remembered discipline if there is. So this module reads the merged data directly and cannot
   print a verdict, because it never computes one. What the readout DOES contribute is the check
   NAME, which the role registry already records as `engine0Check` — the useful half.

   THE THREE GROUPS, and the split is the point:
     OVERRIDES  — can move the published call regardless of the vote. Red facts, so they stay on
                  the FACE, outside every fold (v3.25).
     TECHNICALS — Engine 0 gates orders on these; the backdrop does not read them.
     CONTEXT    — real macro readings neither engine gates on. */

import { roleEntry, whyNotAVoter } from "./signalRoles.js";
import { bandContext } from "./contextBands.js";

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const LIVE = new Set(["LIVE", "CACHED"]);
const num = (v, dec = 2, unit = "") => (finite(v) ? `${v.toFixed(dec)}${unit}` : null);
const signed = (v, dec = 2, unit = "") => (finite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(dec)}${unit}` : null);

/* One row builder for technicals and context alike. `available` follows the same rule the rest
   of the product uses — LIVE or CACHED, with a date — so a dark feed reads as unavailable here
   exactly as it does on the strip, rather than printing a mock number in an evidence block. */
function row({ key, field, label, reading, sub, modeOf, asOfOf, band = null }) {
  const mode = typeof modeOf === "function" ? modeOf(field) : null;
  const asOf = typeof asOfOf === "function" ? asOfOf(field) || null : null;
  const available = LIVE.has(mode) && Boolean(asOf) && reading !== null;
  const entry = roleEntry(field);
  return {
    key, field, label,
    role: entry ? entry.role : null,
    engine0Check: (entry && entry.engine0Check) || null,
    /* The fact that makes this block honest: every row states that the six-signal backdrop does
       not read it. Sourced from the registry, so a role change moves the sentence with it. */
    why: whyNotAVoter(field),
    reading: available ? reading : null,
    sub: available ? sub || null : null,
    state: available && band ? band.state : null,
    toneKey: available && band ? band.toneKey : "textMuted",
    mode, asOf, available,
    unavailable: available ? null : (!LIVE.has(mode) ? "no live feed right now" : !asOf ? "no dated reading" : "no current reading"),
  };
}

/* THE OVERRIDES. These are the only non-voters that can move the published call, so they are
   reported with DISTANCE TO TRIGGER rather than a bare state — "armed" tells a reader nothing
   about how close the edge is. A blind circuit says so; it never reads as clear, which is the
   v3.40 asymmetry (absence of confirmation is not a confirmation of absence). */
export function overrideRows({ d, modeOf, asOfOf, flip, panic }) {
  if (!d) return [];
  const live = (k) => LIVE.has(typeof modeOf === "function" ? modeOf(k) : null);
  const vix = d.marketPulse?.vix?.current, fg = d.marketPulse?.fearGreed?.score;
  const px = d.marketPulse?.spy?.price, ma = d.marketPulse?.spy?.ma200;
  const rows = [];

  /* PANIC — vix > 25 AND fearGreed < 20. BOTH gauges must be current: a carried print may keep
     a bearish caution but must never fire, or clear, the most safety-critical override. */
  const panicReadable = live("vix") && live("fearGreed") && finite(vix) && finite(fg);
  rows.push({
    key: "panic", label: "PANIC override",
    fired: panic === true,
    readable: panicReadable,
    state: !panicReadable ? "CANNOT SEE" : panic === true ? "FIRED" : "CLEAR",
    toneKey: !panicReadable ? "amber" : panic === true ? "red" : "green",
    detail: panicReadable
      ? `VIX ${num(vix, 2)} of 25 · Fear & Greed ${num(fg, 0)} of 20`
      : "needs current volatility and sentiment",
    /* Distance is stated only when BOTH legs are readable, and names the leg that is furthest
       from firing — the binding constraint, which is the honest answer to "how close is this". */
    distance: panicReadable && panic !== true
      ? `${vix > 25 ? "sentiment" : "volatility"} is the binding leg`
      : null,
    asOf: typeof asOfOf === "function" ? asOfOf("vix") || null : null,
  });

  /* MACRO FLIP — armed above VIX 22, tripped when SPY is below its 200-day AND VIX above 25.
     `evaluable:false` is a BLIND circuit and is reported as such: it is not "not armed". */
  const f = flip || {};
  const blind = f.evaluable !== true;
  rows.push({
    key: "macroFlip", label: "Macro Flip circuit",
    fired: f.tripped === true,
    readable: !blind,
    state: blind ? "BLIND" : f.tripped === true ? "TRIPPED" : f.armed === true ? "ARMED" : "CLEAR",
    toneKey: blind ? "amber" : f.tripped === true ? "red" : f.armed === true ? "yellow" : "green",
    detail: blind
      ? (f.reason || "missing or stale inputs")
      : `SPY ${num(px, 2, "")} vs 200-day ${num(ma, 2, "")} · VIX ${num(vix, 2)}`,
    distance: !blind && finite(px) && finite(ma)
      ? `${px >= ma ? "above" : "below"} the 200-day by ${num(Math.abs(px - ma), 2)}`
      : null,
    asOf: typeof asOfOf === "function" ? asOfOf("spyPrice") || null : null,
  });
  return rows;
}

/* THE FOUR ENGINE 0 CHECKS THE BACKDROP DOES NOT VOTE ON. Readings and dates, no verdict word
   — and no verdict is computed here, so there is none to leak. */
export function technicalRows({ d, modeOf, asOfOf }) {
  if (!d) return [];
  const spy = d.marketPulse?.spy || {}, qqq = d.marketPulse?.qqq || {};
  const t30 = d.crossAsset?.treasury30y || {}, term = d.crossAsset?.term || {};
  const fed = d.macro?.fedFunds || {};
  const rs = finite(qqq.changePct) && finite(spy.changePct) ? qqq.changePct - spy.changePct : null;
  return [
    row({ key: "spy200", field: "spyMa200", label: "S&P 500 vs 200-day", modeOf, asOfOf,
      reading: finite(spy.price) && finite(spy.ma200)
        ? `${spy.price >= spy.ma200 ? "above" : "below"} by ${num(Math.abs(spy.price - spy.ma200), 2)}` : null,
      sub: finite(spy.ma200) ? `200-day ${num(spy.ma200, 2)}` : null }),
    row({ key: "rs", field: "qqqChangePct", label: "Nasdaq-100 vs S&P, 1 day", modeOf, asOfOf,
      reading: rs !== null ? `${signed(rs, 2, "pp")}` : null,
      sub: finite(qqq.changePct) && finite(spy.changePct) ? `QQQ ${signed(qqq.changePct, 2, "%")} · SPY ${signed(spy.changePct, 2, "%")}` : null }),
    row({ key: "fedPath", field: "rateOddsHold", label: "Rate path into the next decision", modeOf, asOfOf,
      reading: finite(fed.odds?.hold) ? `hold ${num(fed.odds.hold, 0, "%")}` : null,
      sub: finite(fed.odds?.cut) && finite(fed.odds?.hike)
        ? `cut ${num(fed.odds.cut, 0, "%")} · hike ${num(fed.odds.hike, 0, "%")}` : null }),
    row({ key: "curve30", field: "thirtyYear", label: "30-year and the 10s30s curve", modeOf, asOfOf,
      reading: finite(t30.current) ? `${num(t30.current, 2, "%")}` : null,
      sub: finite(term.spread10s30s) ? `10s30s ${signed(term.spread10s30s, 2, "pp")}` : null,
      band: bandContext("spread10s30s", term.spread10s30s) }),
  ];
}

/* THE CONTEXT READINGS. Neither engine gates on these; they inform and never decide. */
export function contextRows({ d, modeOf, asOfOf }) {
  if (!d) return [];
  const credit = d.macro?.credit || {}, term = d.crossAsset?.term || {};
  const nfci = d.macro?.nfci || {}, un = d.macro?.unemployment || {}, sv = d.macro?.savings || {};
  const mort = d.macro?.mortgage || {}, ten = d.crossAsset?.treasury10y || {};
  return [
    row({ key: "creditSpread", field: "creditSpread", label: "High-yield over investment grade", modeOf, asOfOf,
      reading: num(credit.spread, 2, "pp"),
      sub: finite(credit.hy) && finite(credit.ig) ? `HY ${num(credit.hy, 2, "%")} · IG ${num(credit.ig, 2, "%")}` : null,
      band: bandContext("creditSpread", credit.spread) }),
    row({ key: "creditTail", field: "creditTail", label: "CCC junk tail", modeOf, asOfOf,
      reading: num(credit.tail, 2, "pp"),
      sub: finite(credit.tailD1) ? `${credit.tailD1 > 0 ? "widening" : credit.tailD1 < 0 ? "tightening" : "unchanged"} ${num(Math.abs(credit.tailD1), 2, "pp")}` : null,
      band: bandContext("creditTail", credit.tail) }),
    row({ key: "curve10y3m", field: "spread10y3m", label: "10-year minus 3-month", modeOf, asOfOf,
      reading: signed(term.spread10y3m, 2, "pp"), sub: "the classic recession lead",
      band: bandContext("spread10y3m", term.spread10y3m) }),
    row({ key: "leverage", field: "nfciLeverage", label: "Financial leverage subindex", modeOf, asOfOf,
      reading: signed(nfci.leverage, 2), sub: "0 = the 1971– average" }),
    row({ key: "labour", field: "unemployment", label: "Unemployment", modeOf, asOfOf,
      reading: num(un.national, 1, "%"),
      sub: finite(un.lfpr) ? `participation ${num(un.lfpr, 1, "%")}` : null }),
    row({ key: "savings", field: "savings", label: "Household saving rate", modeOf, asOfOf,
      reading: num(sv.rate, 1, "%"), sub: "the consumer cushion" }),
    /* The owner's 2026-09-19 question, rendered as the answer: the mortgage rate as a SPREAD
       over the 10-year, which is the part the 10-year alone cannot see and the reason this is
       context rather than a seventh seat. Both legs must be current or no spread is shown — a
       spread across a dead leg is a fabricated number (the pairRs rule). */
    row({ key: "mortgage", field: "mortgage30", label: "30-year mortgage", modeOf, asOfOf,
      reading: num(mort.national, 2, "%"),
      sub: finite(mort.national) && finite(ten.current) && LIVE.has(typeof modeOf === "function" ? modeOf("tenYear") : null)
        ? `${num(mort.national - ten.current, 2, "pp")} over the 10-year` : "spread needs both legs current" }),
  ];
}

export function beyondRows(input) {
  const safe = input || {};
  return {
    overrides: overrideRows(safe),
    technicals: technicalRows(safe),
    context: contextRows(safe),
  };
}
