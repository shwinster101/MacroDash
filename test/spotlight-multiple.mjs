/* v7.1 — THE APPLICABLE VALUATION MULTIPLE, run rather than read.

   WHAT THESE PINS EXIST TO PREVENT, and the third one is the whole reason the rule is a rule.

   (1) TWO MULTIPLES WHERE ONE APPLIES. Both have existed since v6.6.3 and neither was ever
   selected: Degen rendered them as two unconditional rows and Simple rendered neither, so a
   reader was left to work out which one describes this company. The owner's rule picks one.

   (2) A MULTIPLE NOBODY COULD LOOK UP. `capToTtmRevenue` IS price-to-sales, and the string
   "P/S" appeared nowhere in the product — so the multiple this product reserves for
   unprofitable companies was the one with no name.

   (3) ⚠ A SILENT P/S SUBSTITUTION ON MISSING EARNINGS. This is the branch that must never
   drift. Falling through to P/S when earnings are ABSENT shows a reader the multiple reserved
   for unprofitable companies, which asserts a loss nobody measured — "missing earnings evidence
   is not a loss", the rule the P/E sheet already states and earningsEvidence was written to
   enforce. A missing PERIOD counts as missing for the same reason: a net-income figure with no
   period of its own cannot establish an earnings reference, and borrowing the revenue period
   would date one number with another's clock. Both are pinned, and the ORDER is pinned, because
   the guarantee is positional — missing returns before any fallback can exist.

   (4) A CHEAP/EXPENSIVE COLOUR. Neither multiple means anything without a comparison this
   product does not make (no peer set, no history, no growth adjustment), so a coloured multiple
   would be a verdict the evidence cannot support — the v3.1 invariant pointed at a valuation
   number. The module returns no colour at all, so a caller has nothing to paint with, and the
   browser suite measures the rendered colour against the market-cap row beside it. */
import { applicableMultiple, earningsEvidence, operatingEvidence, psReasonFor, multipleSub,
  multipleDates, MULTIPLE_LABELS, PS_REASON, PS_REASON_NONOPERATING }
  from "../src/spotlightMultiple.js";
import { spotlightFace } from "../src/simpleFace.js";
import { valuationExplain, SPOTLIGHT_WORD_MAX } from "../src/spotlightExplain.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");

/* One base company, varied one field at a time. Built here rather than lifted from the shared
   fixture so each branch differs by EXACTLY the input the rule reads — a variant that moved two
   fields would not tell you which one the rule responded to. */
const co = (valuation, capOver = {}) => ({
  name: "Test Co", symbol: "TST",
  marketCap: { usd: 7.0e10, display: "$70.0B", observedAt: "2026-09-18", method: "derived", unavailable: null, ...capOver },
  metrics: { valuation: { capToTtmRevenue: 52.9, ttmRevenue: 1.324e9, ttmRevenuePeriod: "TTM to 2026-06-30",
    trailingPe: null, ttmNetIncome: -3.8e8, ttmNetIncomePeriod: "TTM to 2026-06-30", peNote: null, unavailable: null, ...valuation } },
});

export function testSpotlightMultiple(ok) {
  const PROFIT = co({ ttmNetIncome: 2.1e9, trailingPe: 33.4 });
  const LOSS = co({});                                    // the base: negative TTM net income
  const ZERO = co({ ttmNetIncome: 0, trailingPe: null });
  const NO_EARNINGS = co({ ttmNetIncome: null, ttmNetIncomePeriod: null });
  const NO_PERIOD = co({ ttmNetIncome: -3.8e8, ttmNetIncomePeriod: null });
  const NO_CAP = co({}, { usd: null, display: null, observedAt: null, unavailable: "no market cap" });
  const NO_REV_PERIOD = co({ ttmRevenuePeriod: null });
  const REPORTED_CAP = co({ ttmNetIncome: 2.1e9, trailingPe: 33.4 }, { method: "provider-reported" });

  /* ── THE TRUTH TABLE ─────────────────────────────────────────────────────────────────────── */
  {
    const m = applicableMultiple(PROFIT);
    ok("[93] profit -> trailing P/E, dated by the EARNINGS period (not revenue's)",
      m.kind === "pe" && m.label === MULTIPLE_LABELS.pe && m.value === "33.4×"
      && m.period === "TTM to 2026-06-30" && m.reason === null && m.unavailable === null
      && m.explainKind === "pe");
  }
  for (const [name, c] of [["loss", LOSS], ["zero", ZERO]]) {
    const m = applicableMultiple(c);
    ok(`[93] ${name} -> P/S, EXPLICITLY LABELLED, with the reason the label changed`,
      m.kind === "ps" && m.label === MULTIPLE_LABELS.ps && m.value === "52.9×"
      && m.period === "TTM to 2026-06-30" && m.reason === PS_REASON && m.unavailable === null
      && m.explainKind === "ps");
  }
  /* THE BRANCH THAT MATTERS. Both missing shapes must land on UNAVAILABLE, and — the actual
     guarantee — neither may produce the P/S the same company would get if it reported a loss.
     Asserted as `kind !== "ps"` rather than only `unavailable !== null`, because a future edit
     that set BOTH would satisfy a weaker pin while still showing the reader a loss multiple. */
  for (const [name, c, why] of [
    ["no net income", NO_EARNINGS, "reported net earnings unavailable"],
    ["net income with NO PERIOD of its own", NO_PERIOD, "earnings reporting period unavailable"],
  ]) {
    const m = applicableMultiple(c);
    ok(`[93] ⚠ ${name} -> UNAVAILABLE naming the gap, and NEVER P/S (missing is not a loss)`,
      m.kind === null && m.value === null && m.unavailable === why && m.reason === null);
  }
  /* ⚠ RE-PINNED v7.3, claim unchanged and strictly WIDER, with the reason at the pin. This
     measured source POSITION — indexOf('kind: "ps"') had to fall after indexOf('missing') —
     which is the shape that passes through any wrong rewrite and fails on the right one (the
     v5.6.4 / v6.8.4 lesson). v7.3 hoists the P/S construction into ONE shared builder so both
     causes emit an identical row, a correct refactor that moved the literal above the missing
     check and turned this red while the guarantee held. It now asserts the BEHAVIOUR, against a
     company rigged so that EVERY other path would have produced a P/S: the sales multiple is
     complete and dated AND the operating evidence says non-operating. Only the earnings
     evidence is absent, so a rule that consulted either fallback first would emit "ps" here. */
  ok("[93] the missing branch returns BEFORE any fallback — neither P/S path can be reached",
    (() => {
      const rigged = co({ ttmNetIncome: null, ttmNetIncomePeriod: null });
      rigged.metrics.operatingMargin = { pct: -30.2, period: "quarter to 2026-06-30", unavailable: null };
      const m = applicableMultiple(rigged);
      return m.kind === null && m.reason === null && m.value === null
        && operatingEvidence(rigged).state === "nonoperating"          // the other fallback IS armed
        && Number.isFinite(rigged.metrics.valuation.capToTtmRevenue)   // and P/S IS fully available
        && applicableMultiple(NO_EARNINGS).kind === null;
    })());
  {
    const m = applicableMultiple(NO_CAP);
    ok("[93] no dated market cap -> UNAVAILABLE naming the cap gap, no multiple of either kind",
      m.kind === null && m.unavailable === "no market cap");
  }
  {
    // A loss whose SALES multiple is itself undated: the same undated-reference defect the
    // earnings branch refuses, so P/S is withheld rather than shown with a borrowed clock.
    const m = applicableMultiple(NO_REV_PERIOD);
    ok("[93] a loss with an UNDATED sales multiple withholds P/S — no borrowed period",
      m.kind === null && typeof m.unavailable === "string" && m.reason === PS_REASON);
  }
  {
    const m = applicableMultiple(co({ ttmNetIncome: 2.1e9, trailingPe: null }));
    ok("[93] profit with no computed P/E -> UNAVAILABLE, never a P/S substitution",
      m.kind === null && m.unavailable === "earnings multiple unavailable");
  }

  /* ── NO COLOUR, AND NOTHING TO PAINT WITH ────────────────────────────────────────────────── */
  ok("[93] the selector returns NO colour, tone or direction — a caller cannot paint a verdict",
    [PROFIT, LOSS, NO_EARNINGS].every((c) => {
      const m = applicableMultiple(c);
      return !("color" in m) && !("tone" in m) && !("direction" in m) && !("cheap" in m);
    }) && !/color|tone|green|red|cheap|expensive/i.test(
      src("../src/spotlightMultiple.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")));

  /* ── THE TWO CLOCKS, EACH NAMED ──────────────────────────────────────────────────────────── */
  /* The owner asked for "its actual reporting period and price timestamp, not a blanket 'live'
     label". Those are different clocks and must not merge — and the second is named for what it
     IS: marketCap.observedAt is the PRICE date only when the cap was derived (price × shares);
     for a provider-reported cap it is the provider's own date, so calling it a price would be a
     small fabricated provenance. */
  ok("[93] the date sub carries BOTH clocks, and names the second for what it actually is",
    multipleSub(applicableMultiple(PROFIT)) === "TTM to 2026-06-30 · price 2026-09-18"
    && multipleSub(applicableMultiple(REPORTED_CAP)) === "TTM to 2026-06-30 · cap 2026-09-18"
    && multipleDates(PROFIT).derived === true && multipleDates(REPORTED_CAP).derived === false);
  ok("[93] an undated cap yields no invented timestamp — the sub degrades to the period alone",
    multipleDates(co({}, { observedAt: null })).asOf === null);

  /* ── THE TYPED FACE ──────────────────────────────────────────────────────────────────────── */
  /* Both cap and multiple now arrive through spotlightFace. The cap row used to be JSX reaching
     around this projection into c.marketCap, which is exactly why it was the one Simple row
     nobody could pin. */
  {
    const f = spotlightFace(LOSS, null);
    ok("[93] spotlightFace carries cap AND the multiple typed — no JSX reaching around it",
      f.cap.value === "$70.0B" && f.cap.unavailable === null
      && f.multiple.kind === "ps" && f.multiple.label === MULTIPLE_LABELS.ps
      && f.multiple.value === "52.9×" && f.multiple.reason === PS_REASON
      && /TTM to 2026-06-30/.test(f.multiple.sub) && /price 2026-09-18/.test(f.multiple.sub));
    const fp = spotlightFace(PROFIT, null);
    ok("[93] a profitable company's face carries P/E and NO substitution reason",
      fp.multiple.kind === "pe" && fp.multiple.reason === null);
    const fm = spotlightFace(NO_EARNINGS, null);
    ok("[93] a face with missing earnings shows NO multiple and names the gap",
      fm.multiple.kind === null && fm.multiple.value === null
      && fm.multiple.unavailable === "reported net earnings unavailable");
  }
  ok("[93] spotlightFace never throws on a partial or absent model (Property 9)",
    spotlightFace(null, null) === null
    && applicableMultiple(null).kind === null && applicableMultiple({}).kind === null
    && applicableMultiple({ metrics: {} }).unavailable !== null);

  /* ── THE EXPLAINER NAMES THE MULTIPLE, AND SAYS WHAT IT IS NOT ───────────────────────────── */
  ok("[93] the P/S sheet is NAMED, accepts the ps alias, and keeps the equity-value precision",
    (() => {
      const a = valuationExplain(LOSS, "ps"), b = valuationExplain(LOSS, "revenue");
      return /P\/S/.test(a.full) && /price-to-sales/i.test(a.full)
        && a.full === b.full && a.what[0] === b.what[0]      // alias, not a second sheet
        && /equity-value-to-sales multiple, not enterprise value/.test(a.what[0]);
    })());
  ok("[93] the P/S sheet states the owner's reason and that it is NOT profitability",
    (() => {
      const a = valuationExplain(LOSS, "ps");
      return a.what[1].startsWith(PS_REASON) && /not profitability/.test(a.what[1])
        && /Revenue is not profit/.test(a.what[1]);
    })());
  ok("[93] a PROFITABLE company's P/S sheet omits the reason — it never withheld a P/E",
    !valuationExplain(PROFIT, "ps").what[1].startsWith(PS_REASON));
  /* The ceilings are the v6.6.3 contract and are re-measured, never loosened. */
  ok("[93] both valuation sheets stay inside the Degen word ceiling, re-measured not loosened",
    ["pe", "ps", "cap"].every((k) => [PROFIT, LOSS].every((c) => {
      const words = valuationExplain(c, k).what.join(" ").trim().split(/\s+/).length;
      return words <= SPOTLIGHT_WORD_MAX.degen;
    })));

  /* ── v7.3 · THE OPERATIONS GATE ───────────────────────────────────────────────────────────
     (5) A P/E DIVIDED BY A DENOMINATOR THE BUSINESS DID NOT PRODUCE. v7.1 tested the SIGN of
     TTM earnings, which is not the same claim as "this company earns". Reproduced from the LIVE
     model on 2026-09-19, which is the shape these fixtures carry: NBIS TTM net income +$115.1M
     (real, and entirely below the operating line) against −$175.9M of quarterly operating
     income, cap $59.26B -> the row printed P/E 514.9×. The fixtures below use those measured
     numbers rather than round ones, so a failure reads as the live case it came from. */
  const opq = (pct, period = "quarter to 2026-06-30") => ({ pct, period, unavailable: null });
  /* NBIS as served: net profitable, operating LOSS, pathological P/E. */
  const NBIS = { ...co({ capToTtmRevenue: 43.7, ttmRevenue: 1.3551e9, trailingPe: 514.9,
    ttmNetIncome: 1.151e8 }, { usd: 5.926e10, method: "provider-reported" }) };
  NBIS.metrics.operatingMargin = opq(-30.2);
  /* TSLA as measured the same day: 338.4× and a real operating business. The owner's ruling
     lives or dies on this fixture. */
  const TSLA = { ...co({ capToTtmRevenue: 7.1, ttmRevenue: 1.02e11, trailingPe: 338.4,
    ttmNetIncome: 4.25e9 }) };
  TSLA.metrics.operatingMargin = opq(6.4, "quarter to 2026-06-30");

  ok("[93] v7.3 THE REPORTED DEFECT: net profitable but the profit is NOT from operations -> P/S",
    (() => { const m = applicableMultiple(NBIS);
      return m.kind === "ps" && m.value === "43.7×" && m.reason === PS_REASON_NONOPERATING
        && m.period === "TTM to 2026-06-30" && m.unavailable === null; })());
  ok("[93] v7.3 and it can never print the 514.9× P/E it used to — the earnings label is gone",
    (() => { const m = applicableMultiple(NBIS);
      return m.kind !== "pe" && m.label !== MULTIPLE_LABELS.pe && !/514/.test(String(m.value)); })());
  /* ⚠ THE OWNER RULING, PINNED AS A CONTROL. A magnitude arm (P/E > 80) would demote this row,
     and the ruling is that it must not: TSLA earns from operations and is merely expensive, so
     printing ~7× P/S in place of a real 338× would make the priciest name on the roster read
     CHEAPER than it is. Adding a magnitude gate later turns this pin red, which is the point. */
  ok("[93] v7.3 NO MAGNITUDE ARM: 338.4× on a real operating business still reads P/E",
    (() => { const m = applicableMultiple(TSLA);
      return m.kind === "pe" && m.value === "338.4×" && m.reason === null
        && m.operatingBasis === "quarter"; })());
  ok("[93] v7.3 the six other roster names are untouched — an ordinary earner keeps its P/E",
    (() => { const c = co({ ttmNetIncome: 1.92879e11, trailingPe: 27.4 });
      c.metrics.operatingMargin = opq(66.2, "quarter to 2026-07-26");
      return applicableMultiple(c).kind === "pe"; })());

  /* THE BASIS. TTM is the SAME window as the net line and must WIN when both are present —
     proven with the two bases DISAGREEING, so the preference cannot pass by coincidence. */
  ok("[93] v7.3 TTM operating income is PREFERRED over the quarterly margin when both are on file",
    (() => { const c = co({ ttmNetIncome: 1.151e8, trailingPe: 514.9,
        ttmOperatingIncome: 4.4e8, ttmOperatingIncomePeriod: "TTM to 2026-06-30" });
      c.metrics.operatingMargin = opq(-30.2);            // quarter says nonoperating, TTM says operating
      const m = applicableMultiple(c);
      return operatingEvidence(c).basis === "ttm" && m.kind === "pe" && m.operatingBasis === "ttm"; })());
  ok("[93] v7.3 the quarterly margin is the FALLBACK, named — a record written before this release still gates",
    operatingEvidence(NBIS).basis === "quarter" && operatingEvidence(NBIS).state === "nonoperating");
  ok("[93] v7.3 an undated operating period is not evidence — it falls through rather than judging",
    (() => { const c = co({ ttmNetIncome: 1.151e8, trailingPe: 514.9,
        ttmOperatingIncome: -1.0e8, ttmOperatingIncomePeriod: "an undated period" });
      c.metrics.operatingMargin = { pct: -30.2, period: "no period", unavailable: null };
      return operatingEvidence(c).state === "unknown"; })());
  ok("[93] v7.3 exactly zero operating income is NOT operating — the edge is > 0, like the earnings edge",
    (() => { const c = co({ ttmNetIncome: 1.151e8, trailingPe: 514.9,
        ttmOperatingIncome: 0, ttmOperatingIncomePeriod: "TTM to 2026-06-30" });
      return operatingEvidence(c).state === "nonoperating" && applicableMultiple(c).kind === "ps"; })());

  /* ⚠ THE HONEST LIMIT, pinned as the state it is actually in rather than as the state I would
     prefer. With no operating evidence the P/E still renders: withholding it, or calling the
     profit non-operating, would assert something nobody measured — the same rule the MISSING
     branch follows ("missing earnings evidence is not a loss"). */
  ok("[93] v7.3 LIMIT: no operating evidence -> the P/E still renders, and claims nothing about operations",
    (() => { const m = applicableMultiple(PROFIT);   // the base fixture carries no operatingMargin
      return operatingEvidence(PROFIT).state === "unknown" && m.kind === "pe"
        && m.reason === null && m.operatingBasis === null; })());
  ok("[93] v7.3 an unknown operating state never emits the non-operating cause",
    psReasonFor(PROFIT) === null && operatingEvidence(co({})).state === "unknown");

  /* THE CAUSE IS NEVER FABRICATED. NBIS IS net profitable, so PS_REASON — "the company isn't
     profitable" — would be false about it. Two different sentences, and the loss case keeps its
     own (the operations gate must not hijack the original cause). */
  ok("[93] v7.3 the two P/S causes are DIFFERENT sentences — a net-profitable company is never called unprofitable",
    PS_REASON !== PS_REASON_NONOPERATING && !/isn’t profitable/.test(PS_REASON_NONOPERATING)
    && psReasonFor(NBIS) === PS_REASON_NONOPERATING && psReasonFor(LOSS) === PS_REASON
    && psReasonFor(ZERO) === PS_REASON && applicableMultiple(LOSS).reason === PS_REASON);
  ok("[93] v7.3 the ROW and its SHEET name the same cause — one home, so they cannot disagree",
    (() => { const m = applicableMultiple(NBIS), a = valuationExplain(NBIS, "ps");
      return m.reason === PS_REASON_NONOPERATING && a.what[1].startsWith(PS_REASON_NONOPERATING); })());
  ok("[93] v7.3 the sheet's word ceiling survives the added cause, re-measured not loosened",
    [NBIS, TSLA].every((c) => ["pe", "ps", "cap"].every((k) => {
      const e = valuationExplain(c, k);
      return !e || e.what.join(" ").trim().split(/\s+/).length <= SPOTLIGHT_WORD_MAX.degen; })));

  /* ORDERING IS STILL THE RULE. The operations gate sits INSIDE the profit branch, so it can
     never run ahead of the missing-earnings return — the positional guarantee v7.1 pinned. */
  ok("[93] v7.3 missing earnings STILL returns before the operations gate can be reached",
    (() => { const c = co({ ttmNetIncome: null, ttmNetIncomePeriod: null });
      c.metrics.operatingMargin = opq(-30.2);
      const m = applicableMultiple(c);
      return m.kind === null && m.reason === null && /earnings/.test(m.unavailable); })());
  /* ONE P/S construction reached from two causes — two would be two copies waiting to disagree
     about what a complete P/S is. */
  ok("[93] v7.3 the sales multiple is built ONCE and reached from both causes",
    (src("../src/spotlightMultiple.js").match(/kind: "ps"/g) || []).length === 1);

  /* THE SERVER HALF. The field exists, rides the public whitelist through `valuation`, and is
     emitted on the SAME chain as revenue and net income so a 6-K filer's half-year tiling
     produces it or nothing does. */
  ok("[93] v7.3 ttmOperatingIncome is derived on the same ttmOf chain and rides the public whitelist",
    (() => { const s = src("../functions/lib/spotlight.js");
      return /const ot = ttmOf\(f\?\.operatingIncome\)/.test(s)
        && /ttmOperatingIncome: ot \? ot\.value : null/.test(s)
        && /ttmOperatingIncomePeriod: ot \? ot\.label : null/.test(s)
        && /PUBLIC_METRIC_KEYS = \[[^\]]*"valuation"/.test(s); })());

  /* ── THE MODULE IS A LEAF, WHICH IS WHY THE GRAPH DOES NOT CYCLE ─────────────────────────── */
  ok("[93] spotlightMultiple.js imports NOTHING — simpleFace and spotlightExplain both read it",
    !/^\s*import\s/m.test(src("../src/spotlightMultiple.js"))
    && /from "\.\/spotlightMultiple\.js"/.test(src("../src/simpleFace.js"))
    && /from "\.\/spotlightMultiple\.js"/.test(src("../src/spotlightExplain.js")));
  ok("[93] earningsEvidence moved but is RE-EXPORTED — every existing caller and pin resolves",
    typeof earningsEvidence === "function" && earningsEvidence(LOSS).state === "loss"
    && /export \{ earningsEvidence \} from "\.\/spotlightMultiple\.js"/.test(src("../src/spotlightExplain.js")));
}
