/* CONTEXT BANDS (v7.1) — one home for the thresholds of the signals that do NOT vote.
   Pure, React-free, Node-importable. Returns a `toneKey` (a T alias name), never a resolved
   colour: the C1 purity rule the regime engine already follows, so a section resolves the ink.

   WHY THIS EXISTS. The six VOTERS have had one home for their thresholds since v3.53
   (REGIME_BAND_TABLE, where `vote()` is the only expression of a band) — precisely because a
   second copy of a threshold is the drift defect this repo keeps paying for. The non-voters
   never got that treatment, and their bands were scattered across three kinds of home:

     creditSpread  — inline JSX literals, `> 5` red and `> 3.5` yellow, with NO named constant
                     anywhere in the product.
     creditTail    — constants in regime.js (CREDIT_TAIL_CALM/STRESS, deliberately kept out of
                     the band table), but the CALM/NEUTRAL/STRESSED mapping inline in JSX.
     spread10y3m   — no constant and no band at all: an inline `< 0 → " — INVERTED"` string.

   So a threshold a reader sees on the page could not be found by searching for a name, and the
   same number rendered in two places would have had no way to stay in agreement. v7.1 adds a
   SECOND surface that renders these readings (the Degen "beyond the vote" block), which turns
   that latent problem into an immediate one — two homes disagreeing is a matter of time.

   ⚠ THESE BANDS ARE ASSERTED, NOT CALIBRATED, and that is unchanged by moving them. FRED is
   unreachable from this build environment (the NFCI v3.43 / CCC v3.84 posture), so nothing here
   claims a fitted edge. Every boundary is executed in smoke, so changing one is one edit and one
   red test. NONE of these signals votes, and this module cannot make one vote: it returns a
   descriptive state, never a bull/bear/neutral word, so no caller can accidentally feed a
   context reading into a tally. */

import { CREDIT_TAIL_CALM, CREDIT_TAIL_STRESS } from "./regime.js";

const finite = (v) => typeof v === "number" && Number.isFinite(v);

/* HY–IG credit spread. What risky borrowers pay over investment grade — the transmission NFCI
   measures upstream. The two edges were inline JSX literals until v7.1; they are named here
   with their meaning, and MarketDetail now reads them rather than restating them. */
export const CREDIT_SPREAD_WIDE = 5;      // pp — stress territory
export const CREDIT_SPREAD_WATCH = 3.5;   // pp — above the ordinary band, not yet stress

export function bandCreditSpread(v) {
  if (!finite(v)) return { state: null, toneKey: "textMuted" };
  if (v > CREDIT_SPREAD_WIDE) return { state: "WIDE", toneKey: "red" };
  if (v > CREDIT_SPREAD_WATCH) return { state: "WATCH", toneKey: "yellow" };
  return { state: "ORDINARY", toneKey: "textPrimary" };
}

/* The CCC junk tail. AI-infra debt is rated single-B/CCC, and the tail widens FIRST while broad
   high yield still looks calm — which is why it is tracked separately from the spread above.
   Constants stay in regime.js (their home since v3.84) and are read, never re-typed. */
export function bandCreditTail(v) {
  if (!finite(v)) return { state: null, toneKey: "textMuted" };
  if (v > CREDIT_TAIL_STRESS) return { state: "STRESSED", toneKey: "red" };
  if (v < CREDIT_TAIL_CALM) return { state: "CALM", toneKey: "green" };
  return { state: "NEUTRAL", toneKey: "yellow" };
}

/* 10y–3m, the classic recession lead. Inversion has led every US recession since 1969, so ZERO
   is a structural edge rather than an asserted one — the same kind of definitional line as
   NFCI's mean. Deliberately NO "inverted for N months" memory: that would be asserted rather
   than measured, and this product does not keep a duration it never observed. */
export function bandCurve10y3m(v) {
  if (!finite(v)) return { state: null, toneKey: "textMuted" };
  return v < 0 ? { state: "INVERTED", toneKey: "red" } : { state: "POSITIVE", toneKey: "textPrimary" };
}

/* 10s30s term premium. Its own inversion is a different claim from the 10y–3m above — the long
   end carries fiscal risk the front end does not — so it gets its own reading rather than
   sharing one word with a different spread. */
export function bandCurve10s30s(v) {
  if (!finite(v)) return { state: null, toneKey: "textMuted" };
  return v < 0 ? { state: "INVERTED", toneKey: "red" } : { state: "POSITIVE", toneKey: "textPrimary" };
}

/* Every band in one table, so a caller can iterate without knowing the names — and so smoke can
   sweep the set rather than a list someone has to remember to extend. */
export const CONTEXT_BANDS = Object.freeze({
  creditSpread: bandCreditSpread,
  creditTail: bandCreditTail,
  spread10y3m: bandCurve10y3m,
  spread10s30s: bandCurve10s30s,
});

export function bandContext(field, value) {
  const fn = CONTEXT_BANDS[field];
  return fn ? fn(value) : { state: null, toneKey: "textMuted" };
}
