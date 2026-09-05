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
  full: "Federal Funds Rate Target Range (FOMC)",
  what: [
    "The interest rate the Federal Reserve sets for overnight lending between banks — the floor every other rate in the economy is built on. Shown as the FOMC's current target range; if that feed is dark, the monthly effective average, which lags a decision.",
    "Higher is tighter money, lower is easier. MacroDash's six-factor vote does not read the level — the 10-year yield and financial conditions carry the rate story — so this is context, with the countdown to the next FOMC decision beside it.",
    "Markets move on the path more than the level: a surprise cut or hike, or a change in what the Fed signals next, reprices stocks and bonds the same afternoon.",
  ],
});

export const CONTEXT_EXPLAIN = Object.freeze({
  spyPrice: Object.freeze({
    full: "S&P 500 Index (the SPY proxy)",
    what: [
      "The 500 largest U.S. companies in one number — the broadest scoreboard for “the market”. The star means this is the S&P 500 index ÷ 10 from FRED: it tracks the SPY ETF closely but is not the ETF's own quote.",
      "There is no right level; the trend is what matters. MacroDash's six-factor vote does not read the price, so this is context — but the crash circuit does: SPY below its 200-day average with the VIX above 25 forces the call bearish.",
      "A ±1% day is ordinary and a ±3% day is a headline. When the price crosses its 200-day average, trend followers on both sides tend to act, so moves can accelerate.",
    ],
  }),
  qqqPrice: Object.freeze({
    full: "Invesco QQQ Trust (Nasdaq-100 ETF)",
    what: [
      "The 100 largest non-financial Nasdaq stocks in one ticker — heavily big tech, so it is the growth and AI side of the market. A live Finnhub quote, unlike the SPY proxy beside it.",
      "Read it against SPY: QQQ leading means risk appetite is on; QQQ lagging while SPY holds means money is rotating out of growth. MacroDash's six-factor vote does not read it, so this is context — Engine 0's relative-strength check compares the Nasdaq-100 to the S&P 500 on the same day.",
      "Concentrated and growth-heavy, it usually moves further than SPY in both directions — first to fly, first to fall.",
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
