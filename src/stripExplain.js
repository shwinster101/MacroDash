// MacroDash v6.3 — the macro strip's explainer resolver. PURE: no React, no network;
// Node-importable so smoke RUNS the resolution (a "one home" claim about copy is a claim
// about object identity, and a string pin cannot prove one).
//
// Owner ask (2026-09-05, on the live VIX sheet): "publish the descriptor popups for the 8
// parameters" — every macro-strip tile opens the same 3-bullet sheet the Simple cards open.
// Five of the eight tiles ARE band factors (VIX · F&G · 10Y · CPI · NFCI) and their copy
// already lives on REGIME_BAND_TABLE beside the rule it describes — the v5.8 one-home rule —
// so the strip resolves THOSE to the band's own object, never a second copy: the card's sheet
// and the strip's sheet for one factor are the same object by construction.
// The other three (SPY* · QQQ · FED) vote nowhere and have no band to sit beside, so their
// copy lives HERE, keyed by the strip's field name. Same contract as every explainer in the
// product: `{full, what: [exactly 3 bullets]}` in the v5.9.5 beat order — what it is · where
// the reading sits AND what MacroDash does with it · what usually happens when it moves.
// Beat 2 for a context tile is load-bearing and pinned: each sheet must SAY the six-factor
// vote does not read it, or a tile that wears the same sheet as a voter would imply a vote.
// This also closes the v3.73 audit finding "hover-only strip explanations unreachable on
// touch" — the title tooltip stays for a mouse; the sheet is the phone's path to the same fact.
import { REGIME_BAND_TABLE } from "./regime.js";

const FED_EXPLAIN = Object.freeze({
  full: "Federal Funds Rate Target Range (FOMC)", shortTitle: "Fed policy rate",
  what: [
    "The Federal Reserve sets a target range for overnight interest rates. The monthly effective average is a fallback and lags a decision.",
    "Higher rates generally tighten financing conditions. This tile is context: MacroDash’s six-signal model does not read the policy-rate level.",
    "Changes and unexpected policy guidance can affect stocks and bonds. The meeting countdown is a calendar reminder, not a forecast.",
  ],
});

export const CONTEXT_EXPLAIN = Object.freeze({
  spyPrice: Object.freeze({
    full: "S&P 500 Index (the SPY proxy)", shortTitle: "The broad U.S. stock market",
  what: [
    "The S&P 500 tracks large U.S. companies. SPY* here is the FRED index divided by ten, not a tradable SPY ETF quote.",
    "This is context: the six-signal model does not read this price. Separately, the crash circuit turns bearish when SPY is below its 200-day average and VIX exceeds 25.",
    "The daily move describes the index, not every stock. Its level alone does not establish a good entry price.",
  ],
  }),
  qqqPrice: Object.freeze({
    full: "Invesco QQQ Trust (Nasdaq-100 ETF)", shortTitle: "Large Nasdaq companies",
  what: [
    "QQQ tracks the Nasdaq-100, a group of large non-financial Nasdaq companies with substantial technology exposure.",
    "Comparing its move with the broad market helps describe relative performance. MacroDash’s six-signal model does not read QQQ, so this tile is context.",
    "Its concentration can magnify gains and losses. A strong day does not establish business growth, a reasonable valuation, or the direction of the next move.",
  ],
  }),
  // The FED tile has TWO field identities (the target range when live, the FEDFUNDS monthly
  // average when that feed is dark — MacroStrip flips `f` by liveness). One instrument, one
  // sheet: both keys resolve to the SAME object, pinned by identity.
  fedTargetUpper: FED_EXPLAIN,
  fedFunds: FED_EXPLAIN,
});

/* stripExplainFor(field) → the explainer object for a strip tile, or null.
   Band factors FIRST (the band's own `explain`, by identity — one home), then the context
   table, then null — and null degrades Explainable to a plain div (a button that opens
   nothing is a lie, the v3.97 CUT-row rule). */
export function stripExplainFor(field) {
  if (typeof field !== "string" || !field) return null;
  const band = REGIME_BAND_TABLE.find((b) => b.key === field);
  if (band && band.explain) return band.explain;
  return CONTEXT_EXPLAIN[field] || null;
}
