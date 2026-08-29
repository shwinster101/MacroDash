// ─── 5 WHYS · TODAY (UI-OVERHAUL Slice 1, task 1.4) ─────────────────────────
// Extracted VERBATIM from dashboard.jsx (the v3.69 NARRATIVE-FIRST overview strip).
// PRESENTATION ONLY: computeFiveWhys, the FW_FIELDS freshness set, the A1 liveBuild
// gating and the derivedLabel derivation all stay in the orchestrator — this renders
// what it is handed.
// v3.92 QUIET OVERVIEW (owner call, REVERSING the v3.61/v3.62 "full 5 Whys stays
// expanded" ruling on a live phone screenshot): the five-paragraph chain collapses
// behind the house CollapsedGroup. The v3.25 rule holds — the regime state line (the
// one red/amber fact this block carries) stays OUTSIDE the collapse, visible while
// closed; the chain, headline and provenance are verbatim one tap deep. The
// public-render suite opens the expander before reading the LOADING/ERROR anchor
// ("not enough usable evidence to publish a direction") and pins the closed summary
// separately. That anchor USED to read "0/3 core inputs usable"; the v5.3 One Call
// rewrite of WHY #1 retired the phrase and this comment kept naming it — corrected on
// the 8/28 vocabulary pass, which found no code or pin emitting it anywhere.
//
// Props: fw           — computeFiveWhys() output ({regime, headline, whys[]})
//        derivedLabel — the state-derived footer (B2 v3.59: one derivation, both footers)
//        mode / asOf  — provenance for the SourceBox (anchored to the equity close: a
//                       market synthesis is "as of the last close"; a secondary input
//                       FRED publishes a day late must not drag the whole badge STALE)
import { T } from "../design-tokens.js";
import SourceBox from "../primitives/SourceBox.jsx";
import CollapsedGroup from "../primitives/CollapsedGroup.jsx";

//        label        — the toggle's copy. The same accountability label is used in Simple
//                       and Power; only the nesting altitude differs.
//        persistKey   — remember the open state per device, so a reader who wants the chain
//                       does not re-open it every visit (WHYS_KEY below; both call sites
//                       share ONE key — the same block, two altitudes, one preference).
export const WHYS_KEY="md:exp:whys:v1";

/* 8/28 Whys altitude. The closed block was mute — one bare toggle row saying nothing about
   what the five checks concluded. It now carries the FLIP, which is the one sentence a
   closed reader acts on, in the house form: chip-length in place, verbatim one tap deep
   (v3.66). The chip rides the LABEL, never a sibling element — a second node outside the
   CollapsedGroup would break both the one-toggle-row contract (smoke) and the 60px closed
   budget (public-render). */
export const FLIP_CHIP_MAX=40;
export const flipChipOf=(s)=>{
  if(!s)return null;
  const t=String(s).trim();
  return t.length<=FLIP_CHIP_MAX?t:`${t.slice(0,FLIP_CHIP_MAX-1).trimEnd()}…`;
};

/*      leverage     — FEAT-NFCILEV (8/28): {v, asOf, live} for the CONTEXT footer inside
                       the OPEN expander, or null (extraction fallback renders nothing).
                       Deliberately NOT a sixth check and NOT in evidenceSet.factors — the
                       chain narrates only the six band-table voters (smoke-pinned); this is
                       one labelled context line below them, and it says so in its own text.
        flipChip     — chip-length flip for the CLOSED label, or null. Null on a withheld
                       posture: there is no flip to advertise, so the label stays BARE.
        flipLine     — the SAME text verbatim, rendered inside as the last check's tail. On
                       a withheld posture this is the withheld sentence — it travels with the
                       flip to the one home rather than being stranded on the cards. */
const FiveWhys=({fw,derivedLabel,mode,asOf,label="why this call · 5 checks",flipChip=null,flipLine=null,leverage=null,persistKey=WHYS_KEY})=>{
  // Property 9 (null-safe): nothing computed yet means nothing to narrate — an empty,
  // hidden region, never a throw and never a fabricated narrative.
  if(!fw||!Array.isArray(fw.whys))return <div aria-hidden="true"/>;
  return(
    <div style={{padding:"9px 20px",background:T.bg,borderBottom:`1px solid ${T.border}`}}>
      {/* v3.93 QUIET-2 (screenshot-measured: three rows of chrome cost 100px at 390px for a
          collapsed block): ONE toggle row. The section header and the regime line are gone
          from the closed view — the regime state is a byte-for-byte duplicate of the hero
          verdict 100px above, so v3.25 is satisfied by the hero itself; the line rides
          INSIDE the collapse so the chain still opens with its own anchor. */}
      <CollapsedGroup count={5} label={flipChip?`${label} — ⇄ ${flipChip}`:label} chip={false} persistKey={persistKey}>
        <div style={{fontFamily:T.fontMono,fontSize:9,color:T.amber,marginBottom:2}}>{fw.regime}</div>
        <div style={{fontFamily:T.fontSans,fontSize:12,color:T.textSecondary,lineHeight:1.6,fontStyle:"italic"}}>"{fw.headline}"</div>
        {/* The final check is the actionable flip condition, so it carries the strongest weight. */}
        {fw.whys.map((w,i)=>{const last=i===fw.whys.length-1;return(
          <div key={i} style={{borderLeft:`${last?3:2}px solid ${T.amber}${last?"":"44"}`,paddingLeft:8,marginTop:8}}>
            <div style={{fontFamily:T.fontMono,fontSize:8,color:T.amber}}>{fw.labels?.[i]||`WHY #${i+1}`}</div>
            <div style={{fontFamily:T.fontSans,fontSize:11,color:last?T.textPrimary:T.textSecondary,fontWeight:last?600:400,lineHeight:1.5}}>{w}</div>
          </div>
        );})}
        {/* The closed chip truncates; this is its verbatim continuation, one tap deep, sitting
            with the last check it belongs to (v3.66). A withheld posture has no flip, so this
            slot carries the withheld sentence instead — the fact still lands, it just stops
            renting a line on the cards above. */}
        {flipLine&&<div style={{fontFamily:T.fontMono,fontSize:T.fsS,color:T.textSecondary,marginTop:6,lineHeight:1.5}}>⇄ {flipLine}</div>}
        {/* FEAT-NFCILEV: context, stated as context. "not loaded" covers mock, stale,
            error and loading alike — a mock subindex number in the explanation layer would
            be a live-looking number where trust is decided (the A1 rule). */}
        {leverage&&<div style={{fontFamily:T.fontMono,fontSize:T.fsS,color:T.textMuted,marginTop:6}}>
          {leverage.live&&Number.isFinite(leverage.v)
            ?`Leverage subindex ${leverage.v>0?"+":""}${leverage.v.toFixed(2)}${leverage.asOf?` ${leverage.asOf}`:""} · context, not a vote`
            :"Leverage subindex not loaded"}
        </div>}
        <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginTop:8}}>Rule-based · {derivedLabel} (no LLM)</div>
        <SourceBox api="Rule-based" endpoint="6-factor regime · stale inputs excluded" mode={mode} asOf={asOf}/>
      </CollapsedGroup>
    </div>
  );
};
export default FiveWhys;
