// src/regime.js — MacroDash v3.60 (C1, UX-re-audit sprint) — THE public regime engine.
//
// PURE, React-free, token-free, Node-importable — the same convention as sources.js and
// ttReadout.js. Extracted VERBATIM from dashboard.jsx (behavior-neutral; the one change is
// that computeRegime returns tintKey/colorKey for the UI to resolve, instead of resolved
// colors). Three consumers:
//   1. src/dashboard.jsx        (RegimeBand, the confidence strip, the moon voice)
//   2. src/evidence.js          (buildEvidenceSet — the typed contract new components render)
//   3. test/smoke.mjs           (REAL imports now, not source-lifts)
//
// ⚠ REGIME_BAND_TABLE gates the PUBLIC verdict. vote() is the ONLY expression of a band:
// computeRegime votes from it, flipConditions measures distance to the same edges. Change a
// band only with a matching boundary-test change (the DEC-33 convention).


// NFCI band thresholds (v3.43.1) — shared by the tile, the regime vote and the factor
// breakdown so a single table drives all three. Expressed in the index's own unit: NFCI is
// standardized to mean 0 / SD 1 over 1971–, so 0 is the definitional mean and -0.5 is half a
// standard deviation below it. ASYMMETRIC on purpose — full reasoning at the tile.
export const NFCI_TIGHT = 0;      // above the historical mean → tighter than average → bearish
export const NFCI_LOOSE = -0.5;   // ≥ half an SD below the mean → genuinely accommodative → bullish

// FEAT-CCC (v3.84): CCC-and-lower OAS thresholds — shared by the tile and smoke, and
// deliberately NOT in REGIME_BAND_TABLE (arrives NON-VOTING, the NFCI/30Y rule: a new voter
// changes the majority math and these bands are ASSERTED, not calibrated — FRED is
// unreachable from this build environment). Full-history mean ~10pp; <7 ≈ tight-market
// regimes, >12 ≈ recession-scare territory. Every boundary is smoke-tested, so moving one
// is one edit plus one red test.
export const CREDIT_TAIL_CALM   = 7;
export const CREDIT_TAIL_STRESS = 12;

// FEAT-NEWCOMER-RULER (8/29): the CAPE reference constants move HERE from macroCall.js —
// the band-constants home, beside NFCI_TIGHT/NFCI_LOOSE — so the valuation ruler below can
// derive "26.1" from CAPE_MEAN * 1.5 instead of minting a second literal (regime.js is
// deliberately import-free, and macroCall sits downstream via evidence.js, so the import
// runs the other way). macroCall.js imports them back; the vote itself is UNTOUCHED — it
// still reads the runtime c.mean the evidence carries, which macroCall stamps from this
// same constant.
export const CAPE_MEAN = 17.4;
export const CAPE_ATH  = 44.19;

/* FEAT-NEWCOMER-RULER (8/29): the mobile budget for the derived MIXED sub. The ticket set
   the target as "~48 chars"; MEASURED at 375px (its own acceptance width) the sub renders as
   13px mono in a 335px box and fits ~32 characters per line INCLUDING its "NEUTRAL · "
   prefix. Rendered line counts, measured at BOTH phone widths by driving the real bundle:
   44 · 54 · 55 · 60 chars all wrap to TWO lines at 375px and 390px — the height today's
   44-char tape already occupies — while 67 is three at 375 and 79 is three at both. The
   budget is therefore stated in the unit that actually binds (rendered lines) at the
   character count that expresses it on the NARROWER phone: 60 = the last sub that still
   fits two lines at 375px. A char cap is a proxy for a wrap, so it is deliberately set at
   the measured boundary rather than at the ticket's round "~48", which measurement showed
   to be the same two lines and would have degraded ordinary 2-vs-1 tapes for nothing. Past
   the budget the sub states the SPLIT rather than naming six factors across four lines of
   hero — and the fully named sentence renders directly beneath it either way, so the names
   move one line down, never out of reach. */
export const MIXED_SUB_MAX = 60;

/* v5.9 (beginner read, 2026-08-29: "new folks likely have no context on hodl mooning or
   diamond hands"). The verdict is the one word on the page everybody sees, and for a reader
   who has never met the vocabulary it is decoration. Tapping it now explains itself.
   It lives HERE because this module already owns the verdict vocabulary and says so in its
   header — one copy of the words, one copy of what they mean, beside each other. The three
   states are described by WHAT THE EVIDENCE DID, never as advice: this page reads a backdrop,
   it does not tell anyone to buy or sell, and that is the last section for a reason. */
/* v5.9.1 (owner: "I meant 3 bullets total. The tile descriptions too large") — the sheet
   contract shrinks to exactly what the tile ever was: `{full, what: [3 bullets]}`, one shape
   for every explainer in the product, verdict included. The v5.9 draft had ballooned this
   into a lead sentence plus four more prose sections plus a quote — four sections is not
   "3 bullets", whatever the ticket's original wording implied. Nothing here is a new fact:
   each bullet below folds what used to be a whole section into one sentence. */
export const VERDICT_EXPLAIN = {
  full: "What this call means",
  what: [
    "MOONING 🚀 = BULLISH · HODL 💎 = NEUTRAL · DIAMOND HANDS 🙌 = BEARISH · CAN'T CALL IT 🌫️ = too little live data to say.",
    "Bullish means conditions have historically been friendly to owning risky things; bearish means the opposite; neutral means the evidence genuinely does not lean — a real answer, not a missing one.",
    "This is a read on the whole market's backdrop, not a view on any one stock, and it is not advice.",
  ],
};

/* v5.9 (beginner read: "too many words at first glance") — the CHIP form of a band's ruler.
   The full sentence-form `ruler` is right, and at phone width two of the six wrap to three
   lines on the card, which is most of what the read was reacting to. So the full form moves
   into the explainer sheet and the CARD carries this: the same two edges, no prose.
   For the four scalar bands it is DERIVED from the band's own `flip`, so it cannot drift from
   the vote — the same reconciliation the full ruler is held to, except here the numbers are
   not restated at all. The two compound bands (CPI's trend shape, CAPE's two-condition OR)
   have no single crossing to render, so they carry an authored `rulerShort` — which is the
   same reason `flip` is null for them and the same reason nothing invents a crossing. */
const edgeText = (v, dec) => String(Number(Number(v).toFixed(dec))).replace("-", "−");
export function rulerChip(band) {
  if (!band) return null;
  if (!band.flip) return band.rulerShort || null;
  const { bullEdge, bearEdge, bullSide, bullInclusive, dec } = band.flip;
  const below = bullSide === "below";
  const bull = `${below ? (bullInclusive ? "≤" : "<") : (bullInclusive ? "≥" : ">")}${edgeText(bullEdge, dec)}`;
  const bear = `${below ? ">" : "<"}${edgeText(bearEdge, dec)}`;
  return `help ${bull} · hurt ${bear}`;
}

/* ═══ REGIME BAND TABLE (FEAT-FLIP, v3.53) — ONE table, two altitudes ═══════════════════
   computeRegime() VOTES from this table; flipConditions() measures DISTANCE to the same
   edges. Before this the bands were inline literals inside computeRegime, so any "what would
   change the verdict" surface needed a SECOND copy of every threshold — the exact drift
   defect this project keeps paying for (the v3.49 5-vs-6 denominator, the v3.51 stale factor-count
   label, the v3.39 ptModelRows audit). A second copy of a threshold that gates a public
   verdict is not a shortcut; it is a future bug with a date on it.
   `vote()` returns bull | bear | neutral and is the ONLY place a band is expressed. A
   non-finite value votes NEUTRAL by construction (every comparison against NaN is false) —
   the same behaviour the inline ifs had, stated rather than incidental.
   `flip` is OPTIONAL: present only where the vote turns on a single scalar crossing. Where
   it is absent (CPI's trend shape, CAPE's two-condition OR) flipConditions ABSTAINS and
   names the reason — inventing a crossing for a compound rule would be a fabricated number
   in a decision surface, which is the one thing this dashboard exists not to do. 
   `plainBull`/`plainBear` (v3.97 SHAREABLE SIMPLE) are the newbie-facing DIRECTIONAL verb
   phrases — a bare noun list misleads ("working for the market: inflation" reads as
   inflation-is-good when the factor is bullish because inflation is COOLING). They live
   HERE, beside the rule they describe, for the same reason `plain` does: one home per band,
   no parallel copy-table to rot.

   `metric` (v4.0.3) is the TYPED current reading a Simple card shows: {read, unit, dec, note}.
   It exists because the card's value used to be PARSED out of `val`, the Power matrix's
   display copy — and for 10Y and CPI that string contains no number at all ("Falling ↓",
   "Cooling"), so a card asking "what is the current metric?" answered with a judgment. A
   display string is the wrong integrity boundary; this is a typed projection off the same
   data the vote reads. Where the vote is on a compound quantity (CPI's trend shape, CAPE's
   two-condition OR) the metric is the LEVEL a reader means by that name — stated at the
   band, never inferred.

   `whyItMatters` (v4.0 SIMPLE CARDS) is the newcomer-facing "why should I care about this
   number at all" line — what the factor TRANSMITS, never which way it is pointing today
   (plainBull/plainBear already own the direction, and duplicating it here would be two
   copies of one fact). Same one-home-per-band rule: it lives on the band, not in a card
   lookup table that could drift from the rule it explains. */
export const REGIME_BAND_TABLE = [
  { key:"tenYear", short:"10Y", label:"10Y Direction",
    plain:"the 10-year yield",
    plainBull:"long-term rates are falling", plainBear:"long-term rates are climbing",
    whyItMatters:"Long rates set the discount rate on every future dollar a company earns.",
    explain:{ full:"10-Year U.S. Treasury Yield",
      what:[
        "What it costs the U.S. government to borrow for ten years — the benchmark rate everything else is priced against, moved by the Fed's expected path, expected inflation, and a term premium.",
        "There's no single “normal” level; it's mostly traded 1.5%–5% over the past two decades. MacroDash votes on the 1-month CHANGE, not the level.",
        "It's the discount rate under every future dollar of earnings — when it rises, the most growth-heavy stocks fall hardest.",
      ] },
    read:(d)=>d.crossAsset.treasury10y.m1,
    /* The label says "the 10-year yield", so the LEVEL leads and the voted quantity (the
       1-month change) follows as context. Codex read-through, 2026-08-18: a card labelled
       with a level while displaying only a delta is a label-to-metric contract bug — the
       reader takes "-0.12pp 1-mo change" for the yield itself. `context` is the leading
       reading; `read` stays the quantity `vote()` consumes, so the DISPLAY changed and the
       vote did not. */
    metric:{ read:(d)=>d.crossAsset.treasury10y.m1, unit:"pp", dec:2, note:"1-mo", signed:true,
             context:{ read:(d)=>d.crossAsset.treasury10y.current, unit:"%", dec:2 } },
    ruler:"help: 1-mo change below −0.10 ppt · hurt: above +0.15 ppt",
    vote:(v)=> v < -0.10 ? "bull" : v > 0.15 ? "bear" : "neutral",
    flip:{ bullEdge:-0.10, bearEdge:0.15, bullSide:"below", bullInclusive:false,
           unit:" ppt", dec:2, name:"the 10Y monthly change" } },
  { key:"vix", short:"VIX", label:"VIX Level",
    plain:"volatility",
    plainBull:"volatility is asleep", plainBear:"volatility is spiking",
    whyItMatters:"The market's own estimate of how violently prices could move from here.",
    explain:{ full:"Cboe Volatility Index (VIX)",
      what:[
        "The options market's estimate of how much the S&P 500 will move over the next 30 days — the cost of insurance, not a survey of opinion.",
        "Long-run average is roughly 20. Above 30 is market convention for “fear” — not an official Cboe line.",
        "When it spikes, hedging gets expensive and risk-limit strategies mechanically sell into the move — it moves before the economic data confirms anything.",
      ] },
    read:(d)=>d.marketPulse.vix.current,
    metric:{ read:(d)=>d.marketPulse.vix.current, unit:"", dec:2, note:null },
    ruler:"help below 18 · mid 18–25 · hurt above 25",
    vote:(v)=> v < 18 ? "bull" : v > 25 ? "bear" : "neutral",
    flip:{ bullEdge:18, bearEdge:25, bullSide:"below", bullInclusive:false,
           unit:"", dec:2, name:"VIX" } },
  { key:"fearGreed", short:"F&G", label:"Fear & Greed",
    plain:"sentiment",
    plainBull:"sentiment is greedy", plainBear:"sentiment is fearful",
    whyItMatters:"Crowd positioning — how much optimism is already priced into the tape.",
    explain:{ full:"CNN Business Fear and Greed Index",
      what:[
        "A 0-to-100 score of whether investors are acting scared or greedy, blending seven signals: momentum, breadth, put/call volume, volatility, and safe-haven and junk-bond demand.",
        "50 is the midpoint; below ~45 reads fear, above ~55 reads greed. One of the seven inputs IS volatility, so it partly overlaps the VIX card.",
        "It's a positioning read, not a cause — extreme greed means the marginal buyer is largely spent; extreme fear means forced selling may be near exhausted.",
      ] },
    read:(d)=>d.marketPulse.fearGreed.score,
    metric:{ read:(d)=>d.marketPulse.fearGreed.score, unit:"", dec:0, note:"of 100" },
    ruler:"help above 55 · mid 30–55 · hurt below 30",
    vote:(v)=> v > 55 ? "bull" : v < 30 ? "bear" : "neutral",
    // The one INVERTED factor: bullish ABOVE its edge, not below.
    flip:{ bullEdge:55, bearEdge:30, bullSide:"above", bullInclusive:false,
           unit:"", dec:0, name:"Fear & Greed" } },
  { key:"cpiHeadline", short:"CPI", label:"CPI Trend",
    plain:"inflation",
    plainBull:"inflation is cooling", plainBear:"inflation is running hot",
    whyItMatters:"Inflation is what decides whether the Fed can ease or has to keep squeezing.",
    explain:{ full:"Consumer Price Index (CPI), year over year",
      what:[
        "The average change in prices urban consumers pay, published monthly by the Bureau of Labor Statistics — the year-over-year number is “the inflation rate.”",
        "The Fed's 2% target is on PCE, not CPI — the most commonly repeated error about this number. MacroDash votes on the SHAPE of the trend, not the level.",
        "Inflation sets the policy path — hot prints push the Fed higher for longer, lifting the discount rate on every future dollar.",
      ] },
    // The vote is on the trend SHAPE, so there is no single voted scalar — the metric is
    // the latest PRINT, which is the number a reader means by "current CPI". The direction
    // chip and whyItMatters carry the shape; this never implies the vote is on the level.
    metric:{ read:(d)=>{const t=d.macro.cpi.trend;return Array.isArray(t)&&t.length?t[t.length-1]:null;}, unit:"%", dec:1, note:"YoY" },
    read:(d)=>d.macro.cpi.trend,
    /* v5.8 CORRECTION to the 8/29 locked copy. The ruler ended "· Fed target 2% is context,
       not the vote", which reads as a 2% CPI target — and the Fed's 2% target is on PCE, a
       different index that usually runs a little below CPI (FOMC Statement on Longer-Run
       Goals, 2012). That is the most commonly repeated error about this number, and a
       dashboard that exists to refuse fabricated facts cannot print one in its own ruler.
       The clause is REMOVED here and stated correctly, with the PCE distinction, in the
       explainer sheet's baseline. Shorter on the card as a side effect, which is the
       direction the owner asked the primary view to move anyway. */
    ruler:"help: latest YoY cooler than prior print · hurt: series up >0.5 pt from start",
    rulerShort:"help: cooler than last print · hurt: drifting up",
    vote:(t)=> t[t.length-1] < t[t.length-2] ? "bull"
             : (t[t.length-1] - t[0] > 0.5 ? "bear" : "neutral"),
    flip:null,
    flipWhy:"votes on the SHAPE of its trend (latest print vs the prior one, and drift from the series start) — there is no single level to cross" },
  { key:"valuation", short:"VAL", label:"Valuation",
    plain:"valuation",
    plainBull:"valuations are sane", plainBear:"stocks are priced for perfection",
    whyItMatters:"How much good news is already in the price — the cushion if things disappoint.",
    explain:{ full:"Cyclically Adjusted Price-to-Earnings ratio (Shiller CAPE)",
      // The two numbers here are the SAME constants the vote and the ruler read (CAPE_MEAN,
      // CAPE_ATH) — never retyped, or the explainer could one day describe a level the model
      // no longer uses.
      what:[
        "The S&P 500's price divided by its average inflation-adjusted earnings over the past ten years, so one boom or bust year can't distort it.",
        `Long-run mean is about ${CAPE_MEAN}, all-time high ${CAPE_ATH} (Dec 1999); the post-1990 median (~25) is a live argument about what's normal now.`,
        "It says nothing about next month — high starting valuations have historically meant weaker ten-year returns and less cushion if expectations slip.",
      ] },
    // Compound vote (absolute CAPE OR % of ATH); the metric is the CAPE level itself.
    metric:{ read:(d)=>d.macro.shillerPe && d.macro.shillerPe.current, unit:"", dec:1, note:"CAPE" },
    read:(d)=>d.macro.shillerPe,
    ruler:`help: CAPE below ${(CAPE_MEAN*1.5).toFixed(1)} (1.5× long-run mean ${CAPE_MEAN}) · hurt: CAPE above 30 or >90% of ATH ${CAPE_ATH}`,
    rulerShort:`help <${(CAPE_MEAN*1.5).toFixed(1)} · hurt >30`,
    vote:(c)=>{ const p = c.ath ? (c.current / c.ath) * 100 : c.pctOfAth;
                return c.current < c.mean * 1.5 ? "bull" : (c.current > 30 || p > 90 ? "bear" : "neutral"); },
    flip:null,
    flipWhy:"turns bearish on EITHER an absolute CAPE above 30 OR a level above 90% of its all-time high — two conditions, so no single crossing defines the flip" },
  { key:"nfci", short:"NFCI", label:"Fin Conditions",
    plain:"financial conditions",
    plainBull:"credit is cheap and easy", plainBear:"credit is tightening up",
    whyItMatters:"Whether money is actually flowing through the financial plumbing, or seizing up.",
    explain:{ full:"Chicago Fed National Financial Conditions Index (NFCI)",
      what:[
        "One weekly number for how easily money and credit are flowing through the U.S. financial system, built from 105 measures across money markets and both the traditional and shadow banking systems.",
        "Zero is average by construction — positive is tighter, negative is looser. Conditions have run persistently below zero since 2008.",
        "It measures the plumbing, not the price — funding stress usually shows up here before it shows up in growth data.",
      ] },
    metric:{ read:(d)=>d.macro.nfci.current, unit:"", dec:2, note:"SD vs avg" },
    read:(d)=>d.macro.nfci.current,
    // Asymmetric and INCLUSIVE on the bull side (<=), unlike every other factor — see the
    // NFCI_BANDS derivation at the tile. flipConditions renders "at or below" for it.
    ruler:"help at or below −0.5 SD · mid −0.5 to 0 · hurt above 0 (0 = 1971– mean)",
    vote:(v)=> v <= NFCI_LOOSE ? "bull" : v > NFCI_TIGHT ? "bear" : "neutral",
    flip:{ bullEdge:NFCI_LOOSE, bearEdge:NFCI_TIGHT, bullSide:"below", bullInclusive:true,
           unit:" SD", dec:2, name:"NFCI" } },
];

/* THRESHOLD (FEAT-NFCI, v3.43). DEC-31 set "≥3 of 5 = strict majority", explicitly moving
   AWAY from ≥3 of 6 because that is 50%, not a majority. Adding NFCI as a 6th factor would
   have silently reintroduced exactly that bug against a hardcoded 3. So the rule is computed
   from the factors that actually voted: a STRICT majority of `counted`.
     6 live → needs 4   (majority preserved, DEC-31's intent held)
     5 live → needs 3   (IDENTICAL to the old constant — today's common case is unchanged)
     3 live → needs 2   (the old constant demanded unanimity here, which was never intended)
   Honest consequence: with all six live a verdict is harder to trigger, so MIXED is more
   common. That is what adding a voter costs.
   Extracted (v3.53) so flipConditions() SIMULATES with the identical rule rather than
   restating it — a flip claim computed off a different majority test would be worse than none. */
export function verdictFrom(bullVotes, bearVotes, counted) {
  const bull = counted > 0 && bullVotes > counted / 2;
  const bear = counted > 0 && bearVotes > counted / 2;
  if (bull && !bear) return "RISK-ON";
  if (bear && !bull) return "RISK-OFF";
  return "MIXED";
}
/* FEAT-QUORUM (v3.54, 11.4.5 audit Critical) — the dashboard had NO abstention rule.
   The tt-v1 machine readout has refused to publish a verdict below 3 available checks since v3.3
   ("a 1–2-input verdict must never gate an order"), but the PUBLIC page — the surface whose
   entire promise is a trustworthy posture — would compute a confident MIXED/RISK-ON from a
   single usable factor, or from six MOCK ones during LOADING. The two engines disagreed
   about when to stay silent, and the human-facing one was the permissive side.
   FOUR of six, deliberately STRICTER than the readout's three: the readout is consumed by a
   maintainer who knows what INSUFFICIENT means, this page is read by someone who does not,
   and 4/6 is two-thirds of the evidence base. One constant to change if that proves wrong. */
export const REGIME_QUORUM = 4;
const REGIME_META = {
  // FEAT-v17-07: hyphen separators (was middot) for RISK-ON / RISK-OFF legibility
  "RISK-ON":  { sub:"Disinflation + low vol",   tintKey:"regime-on-bg",  colorKey:"green"  },
  "RISK-OFF": { sub:"Rate pressure + stress",   tintKey:"regime-off-bg", colorKey:"red"    },
  // `watchKey` names the factor the sub tells the reader to watch, so computeRegime can
  // re-derive the sub when that factor is EXCLUDED (v3.61, newcomer audit: the hero read
  // "watch VIX" while VIX sat two rows below marked stale-excluded — the first explanation
  // resting on evidence the model says it cannot use).
  "MIXED":    { sub:"Cross-signals — watch VIX", watchKey:"vix", tintKey:"regime-mix-bg", colorKey:"yellow" },
  // Not a posture — the ABSENCE of one. Rendered as a withhold, never as a neutral reading.
  "INSUFFICIENT": { sub:"not enough usable evidence to call it", tintKey:"regime-mix-bg", colorKey:"textMuted" },
};

// ─── REGIME VERDICT ENGINE (FEAT-163, rule-based) ──────────────────────────
// FEAT-DQ: `stale` is a Set of factor keys whose live data has gone STALE (cadence-aware).
// A stale factor is EXCLUDED from the vote — better to drop a signal than let a dead feed
// (e.g. a dead scraper) cast a phantom bull/bear vote on today's tape.
export function computeRegime(d, stale=new Set()) {
  let bullVotes=0, bearVotes=0, counted=0;
  // `counted` = factors that actually voted (available, whatever way they leaned). It drives
  // the strict majority in verdictFrom rather than a hardcoded number.
  // FEAT-NEWCOMER-RULER (8/29): the KEYS are collected beside the counts so the MIXED sub
  // below can name the disagreement from the votes actually cast — same loop, no re-vote.
  const bullKeys=[], bearKeys=[];
  REGIME_BAND_TABLE.forEach((f)=>{
    if(stale.has(f.key)) return;
    counted++;
    const v=f.vote(f.read(d), d);
    if(v==="bull"){ bullVotes++; bullKeys.push(f.key); }
    else if(v==="bear"){ bearVotes++; bearKeys.push(f.key); }
  });
  /* Below quorum the page states that it cannot call it, rather than calling it from
     whatever survived. `raw` records what the majority WOULD have said — never silent about
     the withhold, the same contract as the tt-v1 TAILWIND downgrade (v3.40). */
  const raw=verdictFrom(bullVotes, bearVotes, counted);
  const insufficient=counted < REGIME_QUORUM;
  const label=insufficient ? "INSUFFICIENT" : raw;
  const m=REGIME_META[label];
  // FIX-E (v3.49): `counted`/`totalFactors` ride the verdict so every surface (RegimeBand
  // header, 5-Whys headline, WHY #5, the confidence strip) states the SAME denominator this
  // vote was decided over — fiveWhys.js used to re-derive it from its own hardcoded pre-NFCI
  // list and said "/5" while the header said "/6".
  // C1 (v3.60): PURE — the engine returns token KEYS; the UI resolves them to colors at its
  // one consumer (RegimeBand). This module must stay React/token-free so evidence.js and the
  // Node test suite can import it directly.
  // v3.61 (FEAT-GLANCE): the sub must never name an excluded factor. If the meta copy's
  // watched factor is not voting, derive "watch X" from the NEAREST load-bearing flip —
  // flipConditions already computes exactly "the nearest usable factor that would change
  // this call" (one derivation, no second copy of any threshold). No flip → state the
  // evidence base instead of naming a gauge the model cannot see.
  let sub=m.sub;
  if(!insufficient && m.watchKey && stale.has(m.watchKey)){
    const nearest=flipConditions(d, stale).flips[0];
    sub=nearest ? `Cross-signals — watch ${nearest.short}`
                : `Cross-signals — ${counted} of ${REGIME_BAND_TABLE.length} inputs usable`;
  }
  /* FEAT-NEWCOMER-RULER (8/29) — the MIXED sub is DERIVED, not canned. The static
     "Cross-signals — watch VIX" rendered on every mixed tape regardless of what actually
     disagreed: on 2026-08-29 VIX was already asleep (<18, a HELPING vote) while the real
     split was sleepy vol + cooling inflation vs a rich CAPE — and the sub told a newcomer
     to watch the one gauge that was fine. When both sides are present the sub names them
     from the band table's own `plain` nouns (valuation → "prices" is the ONE allowed alias,
     this sub only — a noun list needs a short word for the bear side's most common member).
     One-sided mixes (all-bull or all-bear with neutrals holding the majority off) keep the
     v3.61 nearest-flip fallback: there is no disagreement to name, so the honest line is
     still "what would change this". The VIX-excluded path above is UNCHANGED. */
  else if(!insufficient && label==="MIXED"){
    if(bullKeys.length && bearKeys.length){
      const noun=(k)=>{ if(k==="valuation") return "prices";
        const b=REGIME_BAND_TABLE.find((x)=>x.key===k); return (b && b.plain) || k; };
      const list=(xs)=> xs.length<=1 ? (xs[0]||"")
        : xs.length===2 ? `${xs[0]} and ${xs[1]}`
        : `${xs.slice(0,-1).join(", ")} and ${xs[xs.length-1]}`;
      // Verb agreement: a single mass noun takes helps/does not ("volatility helps");
      // multi-noun lists and the plural-agreeing nouns take help/do not ("prices do not",
      // "financial conditions do not"). Caught by the fixture battery on the first run —
      // the flat "do not" printed "volatility do not".
      const PLURAL=new Set(["prices","financial conditions"]);
      const plural=(ns)=> ns.length>1 || PLURAL.has(ns[0]);
      const bn=bullKeys.map(noun), rn=bearKeys.map(noun);
      const named=`${list(bn)} ${plural(bn)?"help":"helps"}, ${list(rn)} ${plural(rn)?"do":"does"} not`;
      /* MOBILE BUDGET, measured rather than guessed (390/375px, the owner's phone): the sub
         renders at 13px mono in a 335px box and fits ~32 characters per line INCLUDING the
         "NEUTRAL · " prefix, so the ticket's ~48-char target is two lines — which is what
         today's 44-char tape occupies. A 3-3 split would name six factors at ~98 characters,
         four lines of hero, and duplicate the full sentence rendered directly beneath it.
         Past the budget the sub states the SPLIT instead: still derived from the same votes,
         still never pointing at the wrong gauge, and the names are one line further down
         rather than one tap (the v3.66 chip-length rule, with a shorter journey). */
      sub = named.length<=MIXED_SUB_MAX ? named
        : `${bn.length} ${bn.length===1?"helps":"help"}, ${rn.length} ${rn.length===1?"does":"do"} not`;
    } else {
      const nearest=flipConditions(d, stale).flips[0];
      sub=nearest ? `Cross-signals — watch ${nearest.short}`
                  : `Cross-signals — ${counted} of ${REGIME_BAND_TABLE.length} inputs usable`;
    }
  }
  return { label, sub, tintKey:m.tintKey, colorKey:m.colorKey,
    bullVotes, bearVotes, counted, totalFactors:REGIME_BAND_TABLE.length,
    insufficient, raw, quorum:REGIME_QUORUM };
}

/* ═══ FEAT-FLIP (v3.53) — "what would change the verdict" ═══════════════════════════════
   The audit's last unbuilt first-screen item (Posture ✓ · Confidence ✓ v3.51 · Why ✓ · what
   changes the call ✗), and the public-side counterpart to the terminal's readiness(): that
   one answers "is the evidence there to act", this one answers "what would move the answer".
   The naive version prints six distances. This computes which crossings are actually
   LOAD-BEARING — it simulates the flip through verdictFrom (the SAME majority rule the vote
   used) and keeps only the ones that change the label. Three abstention rules, all of which
   have precedent here:
     1. A STALE/excluded factor is not voting, so its threshold is not load-bearing — it is
        listed as excluded, never as a distance. (Same gate as the vote itself.)
     2. A factor whose vote is not a single scalar crossing ABSTAINS with the reason named
        (CPI's trend shape, CAPE's two-condition OR) — never an invented number.
     3. "No single flip changes this" is a real and common answer and is stated plainly,
        never padded with the nearest distance to look responsive. (The counterpart to
        readiness()'s BLOCKED, and to isMacroMaterial's one-way withhold.)
   Only ADJACENT band transitions are offered: from the bull band you can reach neutral, not
   bear. Claiming "VIX above 25 would flip this" while VIX sits at 17 would quote a distance
   across a zone the value has to traverse first — true arithmetic, misleading as a next step. */
export function flipConditions(d, stale=new Set()) {
  const live=REGIME_BAND_TABLE.filter(f=>!stale.has(f.key));
  const counted=live.length;
  const votes={}; let bullVotes=0, bearVotes=0;
  live.forEach(f=>{ const v=f.vote(f.read(d), d); votes[f.key]=v;
    if(v==="bull") bullVotes++; else if(v==="bear") bearVotes++; });
  const current=verdictFrom(bullVotes, bearVotes, counted);
  // Simulate one factor moving to a new vote, through the SAME majority rule.
  const sim=(key,to)=>{
    let b=bullVotes, r=bearVotes;
    const from=votes[key];
    if(from==="bull") b--; else if(from==="bear") r--;
    if(to==="bull") b++; else if(to==="bear") r++;
    return verdictFrom(b, r, counted);
  };
  const flips=[], abstained=[];
  live.forEach(f=>{
    if(!f.flip){ abstained.push({key:f.key, short:f.short, label:f.label, why:f.flipWhy}); return; }
    const v=f.read(d);
    if(!Number.isFinite(v)){ abstained.push({key:f.key, short:f.short, label:f.label,
      why:"no live value to measure a distance from"}); return; }
    const cur=votes[f.key];
    const bearSide=f.flip.bullSide==="below" ? "above" : "below";
    // Adjacent transitions only (see the note above).
    const targets = cur==="bull" ? [{to:"neutral", edge:f.flip.bullEdge, leaving:"bull"}]
      : cur==="bear" ? [{to:"neutral", edge:f.flip.bearEdge, leaving:"bear"}]
      : [{to:"bull", edge:f.flip.bullEdge}, {to:"bear", edge:f.flip.bearEdge}];
    targets.forEach(t=>{
      const would=sim(f.key, t.to);
      if(would===current) return;   // crossing it changes nothing — not load-bearing
      // Direction + inclusivity copy. Entering the bull band on an inclusive edge reads
      // "at or below"; LEAVING that same band means strictly passing it.
      let side, inclusive;
      if(t.to==="bull"){ side=f.flip.bullSide; inclusive=f.flip.bullInclusive; }
      else if(t.to==="bear"){ side=bearSide; inclusive=false; }
      else { // leaving a band: cross back the other way
        const leavingBull=t.leaving==="bull";
        side=(leavingBull ? f.flip.bullSide : bearSide)==="below" ? "above" : "below";
        inclusive=leavingBull ? !f.flip.bullInclusive : true;
      }
      flips.push({ key:f.key, short:f.short, label:f.label, name:f.flip.name,
        to:t.to, leaving:t.leaving||null, edge:t.edge, value:v,
        distance:Math.round(Math.abs(v-t.edge)*1000)/1000,
        unit:f.flip.unit, dec:f.flip.dec, side, inclusive, would,
        copy:`${f.flip.name} ${inclusive?`at or ${side}`:side} ${Number(t.edge).toFixed(f.flip.dec)}${f.flip.unit}` });
    });
  });
  flips.sort((a,b)=>a.distance-b.distance);
  return { current, counted, bullVotes, bearVotes, flips, abstained,
    excluded:REGIME_BAND_TABLE.filter(f=>stale.has(f.key)).map(f=>({key:f.key, short:f.short, label:f.label})) };
}

// Shared SIX-factor breakdown (RegimeBand · FEAT-169; DEC-31 retired Put/Call, FEAT-NFCI added NFCI).
// ⚠ The count is stated in three user-facing strings below — a label that disagrees with the vote it
// describes is the FIX-E defect; keep them and REGIME_FACTOR_FIELDS in step. `stale` (Set of factor keys)
// marks factors backed by dead/stale live data — they are flagged and excluded from the
// bull tally so the displayed "X/Y bullish" matches the vote computeRegime actually cast.
/* FEAT-NEUTRAL (v3.62) — the row's STATE comes from REGIME_BAND_TABLE, never from a second
   copy of the thresholds.

   This function predates the band table and was never migrated, so until now each row carried
   a hand-written boolean `bull` that duplicated the table's BULL edge (`<-0.10`, `<18`, `>55`,
   `<=NFCI_LOOSE`) and had no copy of the BEAR edge at all. That made `neutral` and `bear`
   indistinguishable downstream, and RegimeBand — whose only inputs were these rows — rendered
   every non-bull factor as a red ▼. The hero therefore printed "N bull · N neutral · N bear"
   while painting the neutral factor bearish, and the Drivers matrix (which reads the real
   4-state vote) disagreed with it 500px lower on the same page.

   `vote` is now exactly what computeRegime counted: one derivation, many altitudes — the same
   rule the terminal's ptModelRows follows. EXCLUDED wins over the band vote, because a factor
   that is not voting has no lean to report. */
/* v3.98.3 — the exclusion REASON is no longer hardcoded. This function knew only THAT a
   factor was excluded, so it stamped every one of them "· STALE — excluded": a factor
   excluded because its feed is DEAD (mode MOCK) read as merely old, while the C3 Drivers
   matrix — which does see the real mode — said "not live in a live build" 300px below. One
   page, two reasons for the same factor, and the wrong one wore the stale clock.
   `reasons` is an optional Map key→{kind:"stale"|"nofeed", asOf}. The two cases print
   DIFFERENTLY on purpose: a stale factor's number is a REAL observation (keep it, date it),
   a no-feed factor's number is the mock baseline (drop it entirely — a fabricated value
   wearing a judgment word is the v3.1 invariant's exact target). Absent map = generic
   "not counted", never a fabricated cause. */
export function regimeFactors(d, stale=new Set(), reasons=null) {
  const voteOf=(key)=>{
    const band=REGIME_BAND_TABLE.find((t)=>t.key===key);
    return band ? band.vote(band.read(d), d) : "neutral";
  };
  const factors=[
    {key:"tenYear",     short:"10Y",  label:"10Y Direction",  val:d.crossAsset.treasury10y.m1<-0.10?"Falling ↓ (bullish)":"Flat/rising"},
    {key:"vix",         short:"VIX",  label:"VIX Level",      val:`${d.marketPulse.vix.current} — ${d.marketPulse.vix.current<18?"Low (bullish)":d.marketPulse.vix.current<25?"Elevated":"Spiking (bearish)"}`},
    {key:"fearGreed",   short:"F&G",  label:"Fear & Greed",   val:`${d.marketPulse.fearGreed.score} — ${d.marketPulse.fearGreed.label}`},
    {key:"cpiHeadline", short:"CPI",  label:"CPI Trend",      val:d.macro.cpi.trend.slice(-1)[0]<d.macro.cpi.trend.slice(-2)[0]?"Cooling (bullish)":"Re-accelerating"},
    {key:"valuation",   short:"VAL",  label:"Valuation",      val:`${d.macro.shillerPe.current} CAPE · ${(d.macro.shillerPe.ath?(d.macro.shillerPe.current/d.macro.shillerPe.ath)*100:d.macro.shillerPe.pctOfAth).toFixed(1)}% of ATH`},
    {key:"nfci",        short:"NFCI", label:"Fin Conditions", val:`${d.macro.nfci.current>0?"+":""}${d.macro.nfci.current.toFixed(2)} SD — ${d.macro.nfci.current>NFCI_TIGHT?"Tighter than the 1971– mean (bearish)":d.macro.nfci.current<=NFCI_LOOSE?"≥½ SD below mean (bullish)":"Looser than mean, but within ½ SD"}`},
  ].map((f)=>({ ...f, vote:voteOf(f.key) }));
  // Stale factors: the vote becomes EXCLUDED and the row says so — a factor the model refuses
  // to count must never also report a lean.
  const excludedVal=(f)=>{
    const r=reasons && typeof reasons.get==="function" ? reasons.get(f.key) : null;
    if(r && r.kind==="nofeed") return "no live reading — not counted";
    if(r && r.kind==="stale")  return `${f.val} · too old to count${r.asOf?` (as of ${r.asOf})`:""}`;
    return `${f.val} · not counted`;
  };
  return factors.map(f => stale.has(f.key)
    ? { ...f, stale:true, vote:"excluded", val:excludedVal(f) }
    : f);
}

/* The ONE vote→appearance mapping. Both altitudes that render a factor (the hero chip strip in
   RegimeBand and the C3 Drivers matrix) resolve through this, so they cannot drift apart again
   — which is exactly how a neutral factor came to be green-or-red with no third option. */
export const VOTE_STYLE = {
  bull:     { colorKey:"green",         glyph:"▲", word:"BULL"     },
  bear:     { colorKey:"red",           glyph:"▼", word:"BEAR"     },
  neutral:  { colorKey:"textSecondary", glyph:"•", word:"NEUTRAL"  },
  excluded: { colorKey:"amber",         glyph:"⏱", word:"EXCLUDED" },
};
export const voteStyle = (vote) => VOTE_STYLE[vote] || VOTE_STYLE.neutral;
