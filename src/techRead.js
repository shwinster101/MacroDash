// FEAT-TT-TECHREAD (v3.83) — the WHEN leg gets a BANDED VERDICT, not just a distance.
//
// PURE, React-free, Node-importable. Consumers: public/admin.html (techChip on the eligible
// line + ddTechSec on the deep-dive tab), test/smoke.mjs (imports this module directly).
//
// WHY THIS EXISTS: v3.82 shipped the WHEN leg as a single measured distance (price vs a
// committed entry). The owner's follow-up asked for the rest of the technical picture —
// indicators, patterns, lines and levels — "knowing the bullish and bearish logic like on
// macro dash". That last clause is the actual specification: the macro board's strength is
// not that it has six factors, it is that REGIME_BAND_TABLE is ONE table where vote() is the
// only expression of a band, so the verdict and the "what would flip it" distances can never
// contradict each other. This module is that architecture applied to price.
//
// THE TENSION, RESOLVED RATHER THAN PICKED: the owner ALSO said (v3.82) that the macro
// board's indicators are lagging and that WHEN should be price-action focused. Both are
// honoured by structure instead of by choosing: every factor carries a `kind`
// (price_action | indicator | pattern), the tally is reported SPLIT by kind, and — the
// load-bearing part — a BULLISH verdict is DOWNGRADED to NEUTRAL when the price-action
// factors do not independently lean bull. A bull call carried entirely by lagging indicators
// is the one that makes you buy, so it is the one that must withhold. BEARISH passes through
// untouched: a caution built from lagging inputs is still safe to act on. That is the exact
// asymmetry of the v3.40 TAILWIND withhold, pointed at price, and `raw`/`downgraded` keep the
// honest record so the withhold is never silent.
//
// MISSING IS EXCLUDED, NEVER NEUTRAL. Unlike REGIME_BAND_TABLE (where a non-finite value
// votes neutral by construction), an unmeasured factor here is DROPPED from the count and
// named. The reason is that a technical read is built incrementally — levels get stamped
// first, indicators later, a pattern only when one is actually identifiable — so an unstamped
// RSI voting "neutral" would dilute a real tally toward MIXED and make an unfinished stamp
// look like a considered non-lean. "Not measured" and "measured, no lean" are different
// facts; this repo has fixed that same defect at four other altitudes.
//
// ⚠ MARRIED, NEVER MERGED — scope revised by owner ruling 2026-08-25 (v5.2 CAP-ASTERISK).
// This verdict must NEVER enter the BUY ranking sort, gateFail, or why() — WHEN still never
// gates ELIGIBILITY, and the %/yr sort stays a single measured unit. The SELL/FUNDING
// ranking is the one deliberate exception: the owner ruled sells rank on tape → %/yr → TT
// score, LEXICOGRAPHIC — each axis sorts in its own terms, every row states all three, so
// no blended number exists even there. That reverses the original blanket rule for one
// surface; smoke pins the surviving guards and the reversal both.

/* Deadband around a moving average. "At the 200d" is genuinely undecided — a price 0.3%
   above its 200d is not in an uptrend, it is on the line, and a band table that calls it one
   flaps on noise. 2% is asserted, not fitted (no historical backtest is reachable from this
   build environment); every boundary is smoke-tested so changing it is one edit plus one red
   test — the NFCI-deadband precedent. */
export const MA_BAND_PCT = 2;
/* MA alignment (the golden/death-cross factor) uses a TIGHTER band than price-vs-MA: two
   moving averages are already smoothed, so a 1% separation is a real regime, not noise. */
export const CROSS_BAND_PCT = 1;
/* Where in the 3-month range. Thirds — the plainest defensible split of a range, and the
   only one that does not imply a precision the input does not have. */
export const RANGE_HI = 66;
export const RANGE_LO = 33;

/* Pattern enums. ASSERTED input (an assistant or owner names the pattern from the chart);
   the enum exists so the assertion cannot be free text that votes — a pattern outside these
   lists is EXCLUDED and named, never guessed into a lean. */
export const PATTERN_BULL = ["higher_highs", "breakout", "cup_handle", "ascending_triangle",
  "double_bottom", "bull_flag", "reclaim"];
export const PATTERN_BEAR = ["lower_lows", "breakdown", "head_shoulders", "descending_triangle",
  "double_top", "bear_flag", "rejection"];
export const PATTERN_NEUTRAL = ["consolidation", "range", "base", "coil"];

const pct = (a, b) => (a / b - 1) * 100;

/* ═══ TECH BAND TABLE — ONE table, two altitudes ════════════════════════════════════════
   computeTechRead() VOTES from this table; techFlips() measures DISTANCE to the same edges.
   `read(t)` returns the factor's value from a resolved input object, or undefined when it is
   not measured (→ excluded, see the header). `vote(v)` is the ONLY expression of a band.
   `flip` is present only where the vote turns on a single scalar crossing; where the rule is
   compound (RSI's two-sided band) or categorical (pattern) it is null with `flipWhy`, and
   techFlips abstains rather than inventing a crossing — the CPI/CAPE precedent. */
export const TECH_BAND_TABLE = [
  /* TREND — ONE factor, not three. The first draft of this table carried `price vs 50d`,
     `price vs 200d` and `50d/200d alignment` as separate voters, and they are COLLINEAR:
     all three are functions of the same {px, ma50, ma200}, so a price above both averages
     cast three bull votes for one fact and the split tally read "4▲/0▼ of 4" on what was
     really one observation plus the range. A tally exists to measure how much independent
     evidence agrees; triple-counting inflates exactly the number the reader trusts. The
     three comparisons are now COMPONENTS of a single alignment score (−3…+3) and the factor
     votes once — 2-of-3 aligned carries it, which is the same call the three votes would
     have made, without the fake corroboration. */
  { key: "trend", short: "TRND", label: "Trend alignment", kind: "price_action", win: "mas",
    plain: "the trend",
    read: (t) => {
      if (!(Number.isFinite(t.px) && Number.isFinite(t.ma50) && Number.isFinite(t.ma200)
        && t.ma50 > 0 && t.ma200 > 0)) return undefined;
      const step = (v, band) => v > band ? 1 : v < -band ? -1 : 0;
      return step(pct(t.px, t.ma50), MA_BAND_PCT)
        + step(pct(t.px, t.ma200), MA_BAND_PCT)
        + step(pct(t.ma50, t.ma200), CROSS_BAND_PCT);
    },
    vote: (v) => v >= 2 ? "bull" : v <= -2 ? "bear" : "neutral",
    flip: { bullEdge: 2, bearEdge: -2, bullSide: "above", bullInclusive: true,
            unit: " of 3", dec: 0, name: "trend alignment" } },

  { key: "range", short: "RNG", label: "Position in 3-mo range", kind: "price_action", win: "swings",
    plain: "where price sits in its recent range",
    read: (t) => (Number.isFinite(t.px) && Number.isFinite(t.lo) && Number.isFinite(t.hi)
      && t.hi > t.lo ? ((t.px - t.lo) / (t.hi - t.lo)) * 100 : undefined),
    vote: (v) => v > RANGE_HI ? "bull" : v < RANGE_LO ? "bear" : "neutral",
    flip: { bullEdge: RANGE_HI, bearEdge: RANGE_LO, bullSide: "above", bullInclusive: false,
            unit: "% of range", dec: 0, name: "position in the 3-month range" } },

  { key: "rsi", short: "RSI", label: "RSI(14)", kind: "indicator", win: "indicators",
    plain: "momentum",
    read: (t) => (Number.isFinite(t.rsi14) ? t.rsi14 : undefined),
    /* TWO-SIDED on purpose, and this is the one band worth defending explicitly. In a
       trend-following WHEN layer, rising momentum is confirmation (bull above 55) — but
       an RSI above 80 is exhaustion, which is the opposite signal at the opposite extreme.
       Encoding only ">70 = overbought = bear" would fight every strong uptrend the ranking
       is designed to find; encoding only ">55 = bull" would call a blow-off top a buy. */
    vote: (v) => (v >= 80 || v < 45) ? "bear" : v > 55 ? "bull" : "neutral",
    flip: null,
    flipWhy: "votes on a TWO-SIDED band — bullish between 55 and 80, bearish below 45 OR above 80 (exhaustion) — so no single crossing defines the flip" },

  { key: "macd", short: "MACD", label: "MACD histogram", kind: "indicator", win: "indicators",
    plain: "the momentum trend",
    read: (t) => (Number.isFinite(t.macd_hist) ? t.macd_hist : undefined),
    vote: (v) => v > 0 ? "bull" : v < 0 ? "bear" : "neutral",
    flip: { bullEdge: 0, bearEdge: 0, bullSide: "above", bullInclusive: false,
            unit: "", dec: 2, name: "the MACD histogram" } },

  { key: "pattern", short: "PAT", label: "Chart pattern", kind: "pattern", win: "indicators",
    plain: "the chart pattern",
    read: (t) => (typeof t.pattern === "string" && t.pattern ? t.pattern : undefined),
    vote: (v) => PATTERN_BULL.includes(v) ? "bull"
      : PATTERN_BEAR.includes(v) ? "bear"
      : PATTERN_NEUTRAL.includes(v) ? "neutral" : "unknown",
    flip: null,
    flipWhy: "is categorical — a named chart formation, not a level, so there is no distance to an edge" },
];

/* ═══ v5.0 (W2) — CADENCE-AWARE STALENESS: each input declares how fast it ages ═══════════
   One flat 7-day window (PA_STALE_D) took the entire WHEN leg dark at once — measured
   2026-08-23: all 36 stamped names hit 8 days together and every read was withheld,
   including distances against 200-day averages that barely move in a week. Inputs age at
   different rates, so each factor declares its window (the dashboard's cadenceOf doctrine
   pointed at price): a pre-print ENTRY is arguably invalid the morning after a print (7d,
   the original number, unchanged); INDICATORS are fast-moving (7d); a 63-day SWING level
   ages moderately (14d); a long MOVING AVERAGE ages slowly (30d). ASSERTED, not calibrated
   — every boundary is smoke-tested, so changing one is one edit plus one red test.
   UNDATED still fails closed to stale EVERYWHERE: no window can rescue a stamp that never
   says when it was taken. A factor excluded for staleness is NAMED in `missing` with its
   window, so an aged read degrades toward UNREAD-with-reasons, never toward a silent vote. */
export const PA_CADENCE = { entry: 7, indicators: 7, swings: 14, mas: 30 };

/* Quorum. THREE of five. The collinearity fix above cost two voters, and the quorum moves
   with it honestly rather than being held at a number the table can no longer support: a
   levels-only stamp now measures exactly TWO independent things (is it in an uptrend, where
   in its range), which is the truth, so it reads UNREAD until momentum or a pattern lands.
   That is a real consequence and the right one — manufacturing four votes from two facts is
   what the fix removed. One historicals pull plus one indicator call clears it.
   NOTE the deliberate asymmetry this creates: price action can now supply at most 2 of 5
   votes and can never be a majority on its own. "Price action is primary" (the owner's
   standing directive) is therefore encoded NOT as vote weight but as the withhold below —
   a BULLISH call requires price action's assent regardless of how many indicators agree.
   A veto is a stronger form of primacy than a heavier vote, and it cannot be outvoted. */
export const TECH_QUORUM = 3;

/* Strict majority of the factors that actually voted — the same rule and the same reasoning
   as verdictFrom() in regime.js (DEC-31: 3 of 6 is 50%, not a majority). Extracted so
   techFlips() SIMULATES with the identical test rather than restating it. */
export function techVerdictFrom(bull, bear, counted) {
  const b = counted > 0 && bull > counted / 2;
  const s = counted > 0 && bear > counted / 2;
  if (b && !s) return "BULLISH";
  if (s && !b) return "BEARISH";
  return "MIXED";
}

/* Resolve the stored price_action block + a live price into the flat input the table reads.
   Kept separate from the vote so the table never touches payload shape. */
export function techInputs(pa, px) {
  const lv = (pa && pa.levels) || {};
  const ind = (pa && pa.indicators) || {};
  const pat = pa && pa.pattern;
  return {
    px: Number.isFinite(px) && px > 0 ? px : undefined,
    ma50: lv.ma50, ma100: lv.ma100, ma200: lv.ma200,
    lo: lv.swing_lo_3m, hi: lv.swing_hi_3m,
    rsi14: ind.rsi14, macd_hist: ind.macd_hist,
    pattern: pat && typeof pat === "object" ? pat.kind : pat,
  };
}

/**
 * The banded technical read. Returns a verdict on the SAME contract shape the macro regime
 * uses (label + tally + counted + raw + the withhold record), so a reader who understands
 * one understands the other.
 *
 * @param pa   the stored price_action block (may be null/partial)
 * @param px   the live or stamped price
 * @param opts {age?:number|null, stale?:boolean}
 *             age  — the stamp's age in days (v5.0, cadence-aware): each factor is judged
 *                    against ITS OWN window (PA_CADENCE via the factor's `win`), stale
 *                    factors excluded and NAMED rather than the whole read withheld.
 *                    age:null = the block is UNDATED — fail closed, everything withheld.
 *             stale — the pre-v5 global withhold, kept for callers that judged staleness
 *                     themselves; when true the whole read is withheld as before.
 */
export function computeTechRead(pa, px, opts = {}) {
  const base = { label: "UNREAD", factors: [], bull: 0, bear: 0, counted: 0,
    total: TECH_BAND_TABLE.length, byKind: { price_action: { bull: 0, bear: 0, counted: 0 },
      indicator: { bull: 0, bear: 0, counted: 0 }, pattern: { bull: 0, bear: 0, counted: 0 } },
    raw: null, downgraded: null, quorum: TECH_QUORUM, missing: [], stale: !!opts.stale };
  if (!pa || typeof pa !== "object")
    return { ...base, reason: "no price_action block stored" };
  if (opts.stale)
    return { ...base, reason: "levels are stale — a technical read off aged levels is not a fact about today's tape" };
  // v5.0: an explicitly UNDATED stamp (age passed as null) fails closed to the full
  // withhold — no window can rescue a stamp that never says when it was taken.
  if ("age" in opts && opts.age === null)
    return { ...base, stale: true,
      reason: "levels are undated — fail closed: a stamp with no date has no window to live in" };
  const age = typeof opts.age === "number" && isFinite(opts.age) ? opts.age : null;

  const t = techInputs(pa, px);
  const factors = [], missing = [];
  let bull = 0, bear = 0, counted = 0;
  const byKind = { price_action: { bull: 0, bear: 0, counted: 0 },
    indicator: { bull: 0, bear: 0, counted: 0 }, pattern: { bull: 0, bear: 0, counted: 0 } };

  for (const f of TECH_BAND_TABLE) {
    // v5.0 cadence gate: a factor whose inputs have outlived THEIR window is excluded and
    // NAMED — never silently voted, and never allowed to take the fresher factors with it.
    if (age !== null && f.win && age > PA_CADENCE[f.win]) {
      missing.push(`${f.short} (stale: ${age}d past its ${PA_CADENCE[f.win]}d window)`); continue;
    }
    const v = f.read(t);
    if (v === undefined) { missing.push(f.short); continue; }
    const vote = f.vote(v);
    // An out-of-enum pattern is an unrecognised assertion, not a lean — excluded and NAMED,
    // the same fail-closed rule the gate normalizer uses ("no label can manufacture a vote").
    if (vote === "unknown") { missing.push(`${f.short} (unrecognised: ${v})`); continue; }
    counted++; byKind[f.kind].counted++;
    if (vote === "bull") { bull++; byKind[f.kind].bull++; }
    else if (vote === "bear") { bear++; byKind[f.kind].bear++; }
    factors.push({ key: f.key, short: f.short, label: f.label, kind: f.kind,
      plain: f.plain, value: v, vote });
  }

  if (counted < TECH_QUORUM)
    return { ...base, factors, counted, bull, bear, byKind, missing,
      label: "UNREAD",
      reason: `only ${counted} of ${TECH_BAND_TABLE.length} technical inputs measured (needs ${TECH_QUORUM}) — missing ${missing.join(", ")}` };

  const raw = techVerdictFrom(bull, bear, counted);
  /* THE ASYMMETRIC WITHHOLD (see the header). A BULLISH read must be independently supported
     by price action; the owner's own observation is that indicators lag, and a lagging bull
     signal is precisely the one that gets you long at the top. The test is deliberately weak
     — price action need only not DISAGREE (more bull than bear among the PA factors that
     voted) — because requiring a PA majority would make the indicator votes decorative.
     BEARISH is never downgraded: a caution assembled from lagging inputs is still safe. */
  let label = raw, downgraded = null;
  if (raw === "BULLISH") {
    const pa4 = byKind.price_action;
    if (pa4.counted === 0) {
      label = "MIXED";
      downgraded = "BULLISH withheld — no price-action factor is measured, and a bull call resting only on lagging indicators is the one that must not stand alone";
    } else if (!(pa4.bull > pa4.bear)) {
      label = "MIXED";
      downgraded = `BULLISH withheld — price action does not confirm (${pa4.bull} bull vs ${pa4.bear} bear of ${pa4.counted} price-action factors); the bull tally is carried by lagging inputs`;
    }
  }
  return { label, factors, bull, bear, counted, total: TECH_BAND_TABLE.length, byKind,
    raw, downgraded, quorum: TECH_QUORUM, missing, stale: false, reason: null };
}

/* ═══ "What would change this read" — the techFlips counterpart to flipConditions ═══════
   Same three abstention rules as the macro side: an unmeasured factor is not voting so its
   threshold is not load-bearing; a compound/categorical rule abstains with the reason NAMED;
   and only crossings that ACTUALLY change the label are returned — a distance that leaves
   the verdict where it is is true arithmetic and a misleading next step. Sorted nearest
   first. "No single flip changes this" is a real answer, not an empty list to pad. */
export function techFlips(pa, px, opts = {}) {
  const read = computeTechRead(pa, px, opts);
  if (read.label === "UNREAD")
    return { flips: [], abstained: [], reason: read.reason };
  const t = techInputs(pa, px);
  const flips = [], abstained = [];
  for (const f of TECH_BAND_TABLE) {
    const cur = read.factors.find((x) => x.key === f.key);
    if (!cur) continue;                       // not voting → threshold not load-bearing
    if (!f.flip) { abstained.push({ short: f.short, why: f.flipWhy }); continue; }
    for (const target of ["bull", "bear", "neutral"]) {
      if (target === cur.vote) continue;
      // Simulate ONE crossing through the SAME majority rule the verdict used.
      let bull = read.bull, bear = read.bear;
      if (cur.vote === "bull") bull--; else if (cur.vote === "bear") bear--;
      if (target === "bull") bull++; else if (target === "bear") bear++;
      const would = techVerdictFrom(bull, bear, read.counted);
      if (would === read.raw) continue;       // not load-bearing
      const edge = target === "bull" ? f.flip.bullEdge : f.flip.bearEdge;
      // ADJACENT only: from a bull vote you can reach neutral, not bear in one step.
      if (cur.vote === "bull" && target === "bear") continue;
      if (cur.vote === "bear" && target === "bull") continue;
      flips.push({ key: f.key, short: f.short, name: f.flip.name, from: cur.vote, to: target,
        now: cur.value, edge, unit: f.flip.unit, dec: f.flip.dec,
        dist: Math.abs(cur.value - edge), would });
    }
  }
  flips.sort((a, b) => a.dist - b.dist);
  return { flips, abstained, reason: null };
}
