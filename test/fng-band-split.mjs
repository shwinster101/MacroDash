/* v7.0.3 — THE TWO F&G BAND TABLES, RECONCILED AGAINST EACH OTHER.
   This product reads Fear & Greed through TWO different band tables and, until v7.0.3, said so
   nowhere: the public backdrop (`REGIME_BAND_TABLE.fearGreed`, src/regime.js) is MONOTONE
   (>55 helps, <30 hurts), while Engine 0's order-gating check (`bandFearGreed`,
   src/ttReadout.js) is a CONTRARIAN BAND (25–55 bullish, <20 OR >75 bearish).

   WHY THE PINS LIVE HERE AND NOT IN THE RUNTIME. src/regime.js imports NOTHING, and the two
   engines are deliberately married-never-merged — making the public backdrop import an
   order-gating band function to render a caption would couple them for a presentation reason,
   and the coupling would be load-bearing the first time anyone edited either. So the
   reconciliation lives in the suite, which already imports both. Same idiom as the
   SOURCES ↔ DERIVED_OF reconciliation, the playwright EXECUTABLE_PATHS reconciliation and the
   v5.8 ruler ↔ vote() ↔ flip reconciliation: two homes held against each other from the test,
   never fused.

   WHAT THESE PINS EXIST TO PREVENT — and it is BOTH directions. A silent UNIFY is the outcome
   that must be impossible, because either direction moves a number that already gates
   something: the terminal's 20 line is the PANIC override's own edge (`vix > 25 AND
   fearGreed < 20`) and /readout.json gates real orders on the check, while the backdrop's band
   moves the published daily call above 75 and re-bands 30–55. A silent DIVERGENCE (someone
   nudging one table and leaving the caption describing the other) is the mirror failure, and
   the caption's numbers are therefore DERIVED from bandFearGreed here rather than trusted.
   The ruling — one job or two — is written up in working/2026-09-19-fng-band-split.md and has
   NOT been made. These pins force it into the open rather than making it. */
import { REGIME_BAND_TABLE, FG_GATE_ASTERISK } from "../src/regime.js";
import { bandFearGreed, bandVix, bandTenYear } from "../src/ttReadout.js";
import { voterSheet } from "../src/voterSheet.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
// Engine 0 speaks bullish/bearish; the backdrop speaks bull/bear. Normalise so a comparison is
// about the VERDICT and not about two spellings of it.
const norm = (s) => (s === "bullish" ? "bull" : s === "bearish" ? "bear" : s);

/* Contiguous integer ranges per state, 0–100. Nothing here retypes an edge: every boundary the
   pins below assert is READ OFF this sweep, so moving a band moves the derived edges with it. */
function ranges(fn) {
  const out = [];
  for (let v = 0; v <= 100; v++) {
    const s = norm(fn(v));
    const last = out[out.length - 1];
    if (last && last.state === s && last.hi === v - 1) last.hi = v;
    else out.push({ lo: v, hi: v, state: s });
  }
  return out;
}
const spanOf = (rs, state) => {
  const hit = rs.filter((r) => r.state === state);
  return hit.length ? { lo: Math.min(...hit.map((r) => r.lo)), hi: Math.max(...hit.map((r) => r.hi)) } : null;
};

export function testFngBandSplit(ok) {
  const fg = REGIME_BAND_TABLE.find((b) => b.key === "fearGreed");
  const back = ranges((v) => fg.vote(v));
  const term = ranges((v) => bandFearGreed(v));
  const backBull = spanOf(back, "bull"), backBear = spanOf(back, "bear");
  const termBull = spanOf(term, "bull");

  /* ── 1. THE BACKDROP TABLE, pinned behaviourally at its own edges ───────────────────────── */
  ok("v7.0.3 backdrop F&G: bull above 55 · bear below 30 · neutral between (edges DERIVED, not retyped)",
    fg.vote(55) === "neutral" && fg.vote(56) === "bull" && fg.vote(30) === "neutral" &&
    fg.vote(29) === "bear" && backBull.lo === 56 && backBull.hi === 100 &&
    backBear.lo === 0 && backBear.hi === 29);
  /* The SHAPE is the load-bearing half, not the numbers: this table has no upper bearish
     region at all, so "more greed is more bullish, without limit" is a structural property and
     not an artefact of where 55 happens to sit. It is what makes the split a difference of
     THEORY rather than a typo, which is the whole reason a caption was owed. */
  ok("v7.0.3 backdrop F&G is MONOTONE — no reading above the bull edge ever votes bear",
    !back.some((r) => r.state === "bear" && r.lo > backBull.lo));

  /* ── 2. THE TERMINAL GATE TABLE, same treatment ─────────────────────────────────────────── */
  ok("v7.0.3 terminal F&G: bull 25–55 inclusive · bear <20 or >75 (edges DERIVED, not retyped)",
    norm(bandFearGreed(24)) === "neutral" && norm(bandFearGreed(25)) === "bull" &&
    norm(bandFearGreed(55)) === "bull" && norm(bandFearGreed(56)) === "neutral" &&
    norm(bandFearGreed(19)) === "bear" && norm(bandFearGreed(20)) === "neutral" &&
    norm(bandFearGreed(75)) === "neutral" && norm(bandFearGreed(76)) === "bear" &&
    termBull.lo === 25 && termBull.hi === 55);
  ok("v7.0.3 terminal F&G is CONTRARIAN — a bearish reading sits ABOVE a bullish one",
    term.some((hi) => hi.state === "bear" && term.some((lo) => lo.state === "bull" && lo.hi < hi.lo)));

  /* ── 3. THE SPLIT IS A MEASURED FACT, and closing it in EITHER direction turns this red ──── */
  const disagree = [];
  for (let v = 0; v <= 100; v++) if (fg.vote(v) !== norm(bandFearGreed(v))) disagree.push(v);
  // REPORTS ITS OWN MEASUREMENT (the v4.1.3 lesson): a future failure must be a diagnosis, not
  // a mystery. 81 is measured, not chosen — the two tables agree only on 0–19.
  ok(`v7.0.3 the two F&G tables disagree on 81 of 101 readings — a silent unify turns this red (measured ${disagree.length})`,
    disagree.length === 81 && disagree[0] === 20 && disagree[disagree.length - 1] === 100);
  /* The two SIGN INVERSIONS are named separately, because they are the part a reader can be
     wrong about: at 25–29 the public page says this factor hurts while Engine 0 counts it
     bullish, and at 76–100 the public page says it helps while Engine 0 counts it bearish. */
  ok("v7.0.3 the split INVERTS twice: 25–29 (page bear / gate bull) and 76–100 (page bull / gate bear)",
    [25, 27, 29].every((v) => fg.vote(v) === "bear" && norm(bandFearGreed(v)) === "bull") &&
    [76, 90, 100].every((v) => fg.vote(v) === "bull" && norm(bandFearGreed(v)) === "bear"));

  /* ── 4. THE CAPTION'S NUMBERS ARE DERIVED FROM THE TERMINAL TABLE, NEVER TRUSTED ─────────── */
  // This is the pin that stops the caption rotting into the thing it exists to prevent: move
  // bandFearGreed's bull range and the asterisk no longer describes it, so the edit goes red
  // here instead of shipping a caption about a band that no longer exists.
  const nums = FG_GATE_ASTERISK.match(/(\d+)\s*[–-]\s*(\d+)/);
  ok("v7.0.3 the asterisk's bull range is the one bandFearGreed actually votes — reconciled, not retyped",
    !!nums && Number(nums[1]) === termBull.lo && Number(nums[2]) === termBull.hi);
  ok("v7.0.3 the asterisk names the TERMINAL gate as the other band, and claims nothing more",
    /terminal gate/i.test(FG_GATE_ASTERISK) && /different bands/i.test(FG_GATE_ASTERISK) &&
    // It must not smuggle in a verdict, a recommendation, or a claim that either band is right.
    !/(better|correct|wrong|prefer|should|instead|overrid)/i.test(FG_GATE_ASTERISK));

  /* ── 5. BOTH RENDER PATHS CARRY IT, IMMEDIATELY AFTER THE BACKDROP RULER ─────────────────── */
  // The F&G sheet has TWO bullet-2 render paths: the macro-strip tile renders explain.what[1]
  // raw, while the Simple cards and the Drivers matrix rebuild bullet 2 in voterSheet(). A
  // caption on only one of them would be a disclosure the default view might never show.
  const raw = fg.explain.what[1];
  ok("v7.0.3 strip path: bullet 2 carries the asterisk AFTER the backdrop ruler it qualifies",
    raw.includes(FG_GATE_ASTERISK) &&
    raw.indexOf("below 30 as hurting") < raw.indexOf(FG_GATE_ASTERISK));
  const sheet = voterSheet({ key: "fearGreed", explain: fg.explain, available: true, mode: "LIVE",
    asOf: "2026-09-18", vote: "bull", comparison: { current: "62 of 100", context: "" } });
  ok("v7.0.3 voter-sheet path: the asterisk follows `Model reference: <ruler>.` directly",
    sheet.what[1].includes(`Model reference: ${fg.ruler}. ${FG_GATE_ASTERISK}`));
  // A withheld reading still states the split: the bands are a property of the model, not of
  // today's feed, so a dead scraper must not quietly drop the disclosure (the v3.25 rule).
  const dark = voterSheet({ key: "fearGreed", explain: fg.explain, available: false, mode: "MOCK", reason: "no live feed" });
  ok("v7.0.3 a withheld F&G reading still states the split — the bands are model, not feed",
    dark.what[1].includes(FG_GATE_ASTERISK) && !dark.what[1].includes("Latest reported:"));
  ok("v7.0.3 the sheet still has exactly three bullets and keeps bullets 1 and 3 verbatim",
    sheet.what.length === 3 && sheet.what[0] === fg.explain.what[0] && sheet.what[2] === fg.explain.what[2]);

  /* ── 6. ONE HOME ────────────────────────────────────────────────────────────────────────── */
  const regimeSrc = src("../src/regime.js"), voterSrc = src("../src/voterSheet.js");
  ok("v7.0.3 the asterisk is written ONCE and interpolated — never a second literal",
    regimeSrc.split(FG_GATE_ASTERISK).length - 1 === 1 &&
    regimeSrc.includes("${FG_GATE_ASTERISK} Its inputs partly overlap VIX") &&
    !voterSrc.includes("Terminal gate uses different bands"));

  /* ── 7. SCOPED TO F&G, AND THE SCOPING IS ITSELF MEASURED ───────────────────────────────── */
  // VIX and the 10Y are the other two inputs BOTH engines read. They are edge-identical, so an
  // asterisk there would claim a split that does not exist. Pinning that keeps the scoping
  // honest in both directions: if a future edit makes either of them diverge, this goes red and
  // the caption question gets asked for that factor instead of being missed.
  const vixBand = REGIME_BAND_TABLE.find((b) => b.key === "vix");
  let vixSame = true;
  for (let v = 5; v <= 60; v += 0.5) if (vixBand.vote(v) !== norm(bandVix(v))) vixSame = false;
  ok("v7.0.3 VIX is edge-identical across BOTH engines (18/25) — no split to disclose there",
    vixSame && vixBand.vote(17.9) === "bull" && norm(bandVix(17.9)) === "bull" &&
    vixBand.vote(25.1) === "bear" && norm(bandVix(25.1)) === "bear");
  /* ⚠ CORRECTION recorded rather than edited away: my first sweep reported the 10Y as diverging
     on 121 of 121 readings. That was an artefact of comparing bandTenYear's TREND vocabulary
     (falling/rangebound/spiking) against bull/bear/neutral as if the strings were comparable.
     The EDGES are identical; only the vocabulary differs, and it is mapped to a vote
     downstream. Pinned on the edges, which is the claim that actually matters. */
  const tenBand = REGIME_BAND_TABLE.find((b) => b.key === "tenYear");
  const tenMap = { falling: "bull", spiking: "bear", rangebound: "neutral" };
  let tenSame = true;
  for (let v = -60; v <= 60; v++) { const x = v / 100;
    if (tenBand.vote(x) !== tenMap[bandTenYear(x)]) tenSame = false; }
  ok("v7.0.3 the 10Y is edge-identical across both engines (−0.10/+0.15) — only its vocabulary differs",
    tenSame && bandTenYear(-0.11) === "falling" && tenBand.vote(-0.11) === "bull" &&
    bandTenYear(0.16) === "spiking" && tenBand.vote(0.16) === "bear");
  ok("v7.0.3 F&G is the SOLE carrier of gateAsterisk — adding another is a deliberate act",
    REGIME_BAND_TABLE.filter((b) => b.gateAsterisk).map((b) => b.key).join() === "fearGreed");
  // A band with no gateAsterisk composes bullet 2 exactly as v7.0.1 did — the field is additive.
  const vixSheet = voterSheet({ key: "vix", explain: vixBand.explain, available: true, mode: "LIVE",
    asOf: "2026-09-18", vote: "bull", comparison: { current: "14.6", context: "" } });
  ok("v7.0.3 a band without gateAsterisk renders bullet 2 byte-identically to v7.0.1",
    vixSheet.what[1] === `Latest reported: 14.6. LIVE · observation date 2026-09-18. Model reference: ${vixBand.ruler}. Supports stocks.`);

  /* ── 8. NO BAND MOVED IN THIS SLICE ─────────────────────────────────────────────────────── */
  // Stated explicitly rather than left to be inferred from the pins above: this release is a
  // caption and a reconciliation. The PANIC edge in particular is untouched.
  ok("v7.0.3 no band moved: the backdrop ruler and the PANIC-side terminal edge are unchanged",
    fg.ruler === "help above 55 · mid 30–55 · hurt below 30" &&
    fg.flip.bullEdge === 55 && fg.flip.bearEdge === 30 && fg.flip.bullSide === "above" &&
    norm(bandFearGreed(19.99)) === "bear" && norm(bandFearGreed(20)) === "neutral");

  /* ── 9. THE DECISION RECORD EXISTS AND RECORDS THAT IT IS UNMADE ─────────────────────────── */
  // "Write the decision first" is only a contract if the absence of the ruling is itself
  // pinned. Someone who unifies the bands trips §3 above; someone who lands the ruling has to
  // come here and change this, which is the point at which the working note gets updated too.
  const note = src("../working/2026-09-19-fng-band-split.md");
  ok("v7.0.3 the split is written up as an OPEN owner ruling naming both options",
    /keep two jobs/i.test(note) && /one number, one vote/i.test(note) &&
    /DECISION DEFERRED/i.test(note) && /has NOT been made|not been made/i.test(note));
}
