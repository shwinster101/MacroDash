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
   in a decision surface, which is the one thing this dashboard exists not to do. */
export const REGIME_BAND_TABLE = [
  { key:"tenYear", short:"10Y", label:"10Y Direction",
    read:(d)=>d.crossAsset.treasury10y.m1,
    vote:(v)=> v < -0.10 ? "bull" : v > 0.15 ? "bear" : "neutral",
    flip:{ bullEdge:-0.10, bearEdge:0.15, bullSide:"below", bullInclusive:false,
           unit:" ppt", dec:2, name:"the 10Y monthly change" } },
  { key:"vix", short:"VIX", label:"VIX Level",
    read:(d)=>d.marketPulse.vix.current,
    vote:(v)=> v < 18 ? "bull" : v > 25 ? "bear" : "neutral",
    flip:{ bullEdge:18, bearEdge:25, bullSide:"below", bullInclusive:false,
           unit:"", dec:2, name:"VIX" } },
  { key:"fearGreed", short:"F&G", label:"Fear & Greed",
    read:(d)=>d.marketPulse.fearGreed.score,
    vote:(v)=> v > 55 ? "bull" : v < 30 ? "bear" : "neutral",
    // The one INVERTED factor: bullish ABOVE its edge, not below.
    flip:{ bullEdge:55, bearEdge:30, bullSide:"above", bullInclusive:false,
           unit:"", dec:0, name:"Fear & Greed" } },
  { key:"cpiHeadline", short:"CPI", label:"CPI Trend",
    read:(d)=>d.macro.cpi.trend,
    vote:(t)=> t[t.length-1] < t[t.length-2] ? "bull"
             : (t[t.length-1] - t[0] > 0.5 ? "bear" : "neutral"),
    flip:null,
    flipWhy:"votes on the SHAPE of its trend (latest print vs the prior one, and drift from the series start) — there is no single level to cross" },
  { key:"valuation", short:"VAL", label:"Valuation",
    read:(d)=>d.macro.shillerPe,
    vote:(c)=>{ const p = c.ath ? (c.current / c.ath) * 100 : c.pctOfAth;
                return c.current < c.mean * 1.5 ? "bull" : (c.current > 30 || p > 90 ? "bear" : "neutral"); },
    flip:null,
    flipWhy:"turns bearish on EITHER an absolute CAPE above 30 OR a level above 90% of its all-time high — two conditions, so no single crossing defines the flip" },
  { key:"nfci", short:"NFCI", label:"Fin Conditions",
    read:(d)=>d.macro.nfci.current,
    // Asymmetric and INCLUSIVE on the bull side (<=), unlike every other factor — see the
    // NFCI_BANDS derivation at the tile. flipConditions renders "at or below" for it.
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
  "MIXED":    { sub:"Cross-signals — watch VIX", tintKey:"regime-mix-bg", colorKey:"yellow" },
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
  REGIME_BAND_TABLE.forEach((f)=>{
    if(stale.has(f.key)) return;
    counted++;
    const v=f.vote(f.read(d), d);
    if(v==="bull") bullVotes++; else if(v==="bear") bearVotes++;
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
  return { label, sub:m.sub, tintKey:m.tintKey, colorKey:m.colorKey,
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
export function regimeFactors(d, stale=new Set()) {
  const factors=[
    {key:"tenYear",     short:"10Y",  label:"10Y Direction",  val:d.crossAsset.treasury10y.m1<-0.10?"Falling ↓ (bullish)":"Flat/rising",  bull:d.crossAsset.treasury10y.m1<-0.10},
    {key:"vix",         short:"VIX",  label:"VIX Level",      val:`${d.marketPulse.vix.current} — ${d.marketPulse.vix.current<18?"Low (bullish)":d.marketPulse.vix.current<25?"Elevated":"Spiking (bearish)"}`, bull:d.marketPulse.vix.current<18},
    {key:"fearGreed",   short:"F&G",  label:"Fear & Greed",   val:`${d.marketPulse.fearGreed.score} — ${d.marketPulse.fearGreed.label}`,   bull:d.marketPulse.fearGreed.score>55},
    {key:"cpiHeadline", short:"CPI",  label:"CPI Trend",      val:d.macro.cpi.trend.slice(-1)[0]<d.macro.cpi.trend.slice(-2)[0]?"Cooling (bullish)":"Re-accelerating", bull:d.macro.cpi.trend.slice(-1)[0]<d.macro.cpi.trend.slice(-2)[0]},
    {key:"valuation",   short:"VAL",  label:"Valuation",      val:`${d.macro.shillerPe.current} CAPE · ${(d.macro.shillerPe.ath?(d.macro.shillerPe.current/d.macro.shillerPe.ath)*100:d.macro.shillerPe.pctOfAth).toFixed(1)}% of ATH`, bull:d.macro.shillerPe.current<d.macro.shillerPe.mean*1.5},
    {key:"nfci",        short:"NFCI", label:"Fin Conditions", val:`${d.macro.nfci.current>0?"+":""}${d.macro.nfci.current.toFixed(2)} SD — ${d.macro.nfci.current>NFCI_TIGHT?"Tighter than the 1971– mean (bearish)":d.macro.nfci.current<=NFCI_LOOSE?"≥½ SD below mean (bullish)":"Looser than mean, but within ½ SD"}`, bull:d.macro.nfci.current<=NFCI_LOOSE},
  ];
  // Stale factors: neutralize the bull flag and annotate so the UI shows them as excluded.
  return factors.map(f => stale.has(f.key) ? { ...f, stale:true, bull:false, val:`${f.val} · STALE — excluded` } : f);
}
