// ─── FEAT-169 · REGIME VERDICT BAND (UI-OVERHAUL Slice 1, task 1.3) ──────────
// Extracted VERBATIM from dashboard.jsx: the friend-readable headline ("wen moon?") —
// first signal seen on mobile (above the command grid) and prominent on desktop. Soft
// regime tint per AS2-01. Reuses computeRegime + regimeFactors. Behavior-identical to
// the inline predecessor; the ONLY addition is the null-guard (spec Property 9: a
// missing required prop renders a safe empty state, never a throw).
// This module also owns the verdict VOCABULARY (WITHHELD_LABEL + WEN_MOON_STATES) —
// shared with the orchestrator's WenMoonBadge and regimeView, imported from here so
// there is exactly one copy (ENGINE0-CONT: the literal INSUFFICIENT never reaches a
// reader; FEAT-QUORUM: the withheld state has its own honest moon voice).
import { useState } from "react";
import { DT, T } from "../design-tokens.js";
import { computeRegime, regimeFactors, flipConditions, voteStyle } from "../regime.js";
import { fmt } from "../format.js";

// ENGINE0-CONT: the ONE rendered label for a withheld posture (the engine's internal
// INSUFFICIENT sentinel never reaches a reader). Shared by the verdict band, the 5 Whys
// (via regimeView), and pinned by the public render suite.
export const WITHHELD_LABEL = "DATA HOLD";
export const WEN_MOON_STATES = [
  { label: "MOONING 🚀",       color: T.green, glow: T.green },
  { label: "HODL 💎",          color: T.amber, glow: T.amber },
  { label: "DIAMOND HANDS 🙌", color: T.red,   glow: T.red },
  // FEAT-QUORUM (v3.54): "can't call it" is NOT one of the three postures. Defaulting an
  // evidence-less state to HODL would render a real hold call made from nothing — the exact
  // failure this release fixes. The moon voice stays primary (owner call), so it gets its
  // own honest state instead of borrowing a directional one.
  { label: "CAN'T CALL IT 🌫️", color: T.textMuted, glow: T.textMuted },
];

/* v3.94 DRIVERS-ONLY (owner call: "audit the key drivers and only show those — everything
   else 2-3 clicks away"): the hero's visible surface is the VERDICT, the plain-language
   SENTENCE (moved here from the standalone WHY block), and ONE status line whose red facts
   (crash gauge blind, exclusions) stay visible (v3.25). The tally, the flip line and the
   factor chips — evidence, not the answer — moved INSIDE the existing ℹ panel: one click. */
/* v4.0 SIMPLE MODE: `plainVerdict` is the scoped plain-language verdict object
   ({label, tone}) from evidence.js's simpleVerdict. PROP-GATED on purpose — passed only in
   Simple, so Power keeps MOONING/HODL/DIAMOND HANDS untouched and this component has ONE
   verdict derivation rather than a mode flag it interprets itself. Absent (null) = the
   moon voice, which is also what the extraction-reuse fallback gets.
   The v3.97 `prose` prop is GONE: the Simple cards now carry the per-factor detail it was
   carrying, and rendering both would be the same fact twice. */
/* v4.0.3 (audit, preventive) — CANONICAL EVIDENCE. This component used to call
   computeRegime() and flipConditions() itself, so the hero ran a SECOND derivation of the
   verdict beside buildEvidenceSet's. It agreed today, but the two take their exclusions from
   different arguments and would drift at exactly the boundaries that matter — freshness,
   loading, error. v3.98.3 already canonicalized the factor ROWS (factorRows) after the hero
   and the Drivers matrix printed different exclusion reasons; this finishes the job for the
   regime and the flips. The local calls survive ONLY as the extraction-reuse fallback
   (Property 9), which is why they are still imported. */
/* v5.3 ONE CALL: `call` owns the visible human headline and secondary machine direction.
   `plainVerdict` remains a Simple-mode scope signal for the eyebrow only; it can no longer
   introduce a competing public label. */
const RegimeBand=({d,stale=new Set(),loading=false,liveBuild=false,srcLabel="derived from live data",sentence=null,conf=null,factorRows=null,plainVerdict=null,regimeIn=null,flipsIn=null,call=null,callFrozen=false,callCapturedAt=null,callDrift=null,onCopyCall=null,callCopied=false,copyDisabled=false})=>{
  const [open,setOpen]=useState(false);
  // Property 9 (null-safe): no data object means nothing to compute — an empty, hidden
  // region, never a throw. The orchestrator always passes `d`; this guards extraction reuse.
  if(!d)return <div aria-hidden="true"/>;
  const regime=regimeIn||computeRegime(d,stale);
  // C1 (v3.60): the pure engine returns token KEYS; the UI owns the palette.
  regime.tint=DT[regime.tintKey]; regime.color=T[regime.colorKey];
  if(call&&call.direction){
    regime.color=call.direction==="BULLISH"?T.green:call.direction==="BEARISH"?T.red:T.amber;
    regime.tint=call.direction==="BULLISH"?DT["regime-on-bg"]:call.direction==="BEARISH"?DT["regime-off-bg"]:DT["regime-mix-bg"];
  }
  /* v3.98.3 — ONE derivation, two altitudes. This re-derived its own factor rows via
     regimeFactors(d,stale), which cannot see WHY a factor was excluded, so the hero panel
     and the C3 Drivers matrix printed different reasons for the same factor. The
     orchestrator now hands over evidenceSet.factors (which carries the real cause); the
     local call survives only as the extraction-reuse fallback (Property 9). */
  const factors=(Array.isArray(factorRows)&&factorRows.length)
    ? factorRows.map((f)=>({...f, val:f.display!==undefined?f.display:f.val}))
    : regimeFactors(d,stale);
  // FEAT-QUORUM: LOADING is not a verdict state — during the first fetch there is no evidence
  // yet, so the posture is withheld outright rather than computed from the mock baseline.
  const withheld=loading||regime.insufficient||(call&&!call.headline);
  // FEAT-FLIP (v3.53): what would change this call. The NEAREST load-bearing crossing rides
  // the first screen; the full set (plus abstentions and exclusions) lives one tap down.
  const fc=flipsIn||flipConditions(d,stale);
  const nearest=fc.flips[0]||null;
  // FEAT-GLANCE (v3.61, newcomer audit): the neutral vote is STATED, not implicit — the old
  // "2/4 bullish · 2 votes bull / 1 bear" left a vote unaccounted for.
  const neutralVotes=Math.max(0,regime.counted-regime.bullVotes-regime.bearVotes);
  /* 8/28 vocabulary matrix, row 3 — ONE strip, BOTH branches. The engine's MIXED fallback
     sub ends "N of M inputs usable" (regime.js untouched: the paste block and the 5 Whys
     still want the full sub). The voters line 3px below already states that coverage in the
     canonical vocabulary, so the tail here is the same number in a second wording. The strip
     ran on the directional branch only; the withheld branch now shares it, so a sub carrying
     a fraction can never reach a reader through the DATA HOLD path either. */
  const subText=conf&&/\d+ of \d+ inputs usable$/.test(regime.sub)
    ? regime.sub.replace(/ — \d+ of \d+ inputs usable$/,"")
    : regime.sub;
  // "wen moon?" — map the regime verdict to our moon ratings: RISK-ON→MOONING, MIXED→HODL, RISK-OFF→DIAMOND HANDS
  const moon=withheld?WEN_MOON_STATES[3]:WEN_MOON_STATES[{ "RISK-ON":0, "MIXED":1, "RISK-OFF":2 }[regime.label] ?? 1];
  const callLabel=call&&call.headline?`${call.headline}${call.emoji?` ${call.emoji}`:""}`:moon.label;
  const machineLabel=call&&call.direction?call.direction:regime.label;
  return(
    <div role="region" aria-label="Macro backdrop verdict"
      style={{background:regime.tint,borderBottom:`1px solid ${regime.color}33`,borderTop:`1px solid ${regime.color}22`,padding:"10px 20px",position:"relative"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        {/* Left: label + sub */}
        <div style={{display:"flex",alignItems:"baseline",gap:12,flexWrap:"wrap",minWidth:0}}>
          <div>
            {/* The eyebrow follows the verdict below it: asking "wen moon?" over a "MACRO: BULLISH"
                line is two vocabularies in 20px. Power keeps the voice (owner ruling); Simple
                says what the block IS. */}
            <div style={{fontFamily:T.fontMono,fontSize:8,color:regime.color,letterSpacing:"0.14em",textTransform:"uppercase"}}>
              {callFrozen?"Macro Backdrop · 10am frozen call":plainVerdict?"Macro Backdrop · live read":"Macro Backdrop · wen moon?"}
            </div>
            <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
              <span style={{fontFamily:T.fontMono,fontSize:T.fsXl,fontWeight:700,color:regime.color,letterSpacing:"-0.01em"}}>{callLabel}</span>
              <span style={{fontFamily:T.fontMono,fontSize:T.fsL,color:T.textSecondary}}>
                {/* ENGINE0-CONT: the rendered label is DATA HOLD — a deterministic wait
                    posture ("the system lacks evidence, hold"), not the internal
                    INSUFFICIENT sentinel the engine still uses (regime.js is untouched;
                    presentation only). The literal INSUFFICIENT never reaches a reader. */}
                {/* v3.98.3: the engine's stale-watch fallback sub ends "N of M inputs
                    usable" — the exact fact the voters line renders 3px below. Drop it HERE
                    (presentation only; regime.sub is untouched for the paste block and the
                    5 Whys, where no such line exists). */}
                {/* v4.0 acceptance test 1 — Simple leads with EXACTLY ONE verdict. The engine
                    label ("RISK-ON") beside the scoped one ("MACRO: BULLISH") is two names for
                    one call, so Simple keeps only the descriptor; Power keeps both. The
                    withheld line drops it too — DATA HOLD is already the scoped label. */}
                {loading?"LOADING · waiting for live data before calling a posture"
                        /* superseded by the canonical call projection:
                        :`${plainVerdict?"":`${regime.label} · `}${conf&&/\d+ of \d+ inputs usable$/.test(regime.sub)?regime.sub.replace(/ — \d+ of \d+ inputs usable$/,""):regime.sub}`}
                        */
                        :regime.insufficient?`${WITHHELD_LABEL} · ${subText}`
                        :`${machineLabel} · ${subText}`}
              </span>
              {(loading||regime.insufficient)&&<span style={{fontFamily:T.fontMono,fontSize:T.fsS,color:T.textMuted}}>
                {loading?"no factors voting yet"
                        :`only ${regime.counted} of ${regime.totalFactors} voters counted — ${regime.quorum} needed to call it`}
              </span>}
            </div>
            {!withheld&&sentence&&<div style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.textPrimary,lineHeight:1.5,maxWidth:"72ch",marginTop:3}}>{sentence}</div>}
            {callFrozen&&<div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginTop:3}}>
              immutable public call · captured 10:00 ET{callCapturedAt?` · ${String(callCapturedAt).slice(0,10)}`:""}
            </div>}
            {/* 8/28 clock matrix A6 — the frozen caption's missing counterpart. The unfrozen
                face said nothing, so post-10am a live recomputation wore the product's
                official-call identity by silence. Phrased from the CLIENT clock (before/after
                10:00 ET is a render-time fact — freeze mechanics untouched); liveBuild-gated
                so a demo baseline never claims a live read; withheld/loading suppressed —
                there is no read to disclaim. */}
            {liveBuild&&!callFrozen&&!withheld&&<div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginTop:3}}>
              {(Number(new Date().toLocaleString("en-US",{timeZone:"America/New_York",hour:"numeric",hour12:false}))%24)<10
                ?"live read — today's official call freezes at 10:00 ET"
                :"live read — today's 10am record not loaded"}
            </div>}
            {callDrift&&<div style={{fontFamily:T.fontMono,fontSize:9,color:callDrift.direction==="BEARISH"?T.red:T.amber,marginTop:4,lineHeight:1.45}}>
              Current evidence now reads {callDrift.headline}{callDrift.emoji?` ${callDrift.emoji}`:""} · {callDrift.direction}; the scored 10am call remains frozen above.
            </div>}
            {/* v3.98.3 — one line, one scope word, one vocabulary. It used to read
                "4/6 factors voting · excluded: 10Y · VIX" directly under a sentence saying
                those same two were "dark", while the verdict sub above ALSO said "4 of 6
                inputs usable" — three renderings of one fact and two words for one state.
                "VOTERS" is the scope word that resolves the other ambiguity: WHY #2 lists
                dark CROSS-SIGNALS (WTI, HY-IG among them), a deliberately wider set than the
                six that vote, and nothing said so. */}
            {conf&&!loading&&<div style={{fontFamily:T.fontMono,fontSize:9,marginTop:3,display:"flex",gap:10,flexWrap:"wrap"}}>
              <span style={{color:regime.insufficient?T.red:conf.counted===conf.total?T.green:T.amber}}>{conf.counted} of {conf.total} voters counted</span>
              {conf.excluded.length>0&&<span style={{color:T.amber}}>dark: {conf.excluded.join(" · ")}</span>}
              {conf.blind&&<span style={{color:T.red}}>⚠ crash gauge (VIX) unavailable</span>}
            </div>}
            {/* FEAT-FLIP: the audit's fourth first-screen answer — what would change the call.
                "Nothing single-handedly" is stated plainly rather than padded with the nearest
                distance to look responsive (abstention rule 3). */}
            {withheld&&<div style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted,marginTop:3}}>
                  {loading
                    ? "Nothing is being asserted from the demo baseline while the live snapshot loads."
                    : `evidence too thin${liveBuild?" — live data unavailable or stale; the mock baseline is NOT voting":""}.`}
                </div>}
          </div>
        </div>
        {/* Right: the ℹ toggle — the chips ride inside the panel now (v3.94: evidence, one click). */}
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {onCopyCall&&<button onClick={onCopyCall} disabled={copyDisabled} aria-label="Copy MacroDash posture card"
            title={copyDisabled?"live data required":callFrozen?"Copy the frozen 10am public call":"Copy the current live read — not the 10am call"}
            style={{background:callCopied?"#1a3020":T.surfaceHigh,border:`1px solid ${callCopied?T.green:regime.color}66`,borderRadius:3,color:callCopied?T.green:regime.color,cursor:copyDisabled?"not-allowed":"pointer",padding:"4px 9px",minHeight:44,fontFamily:T.fontMono,fontSize:9,opacity:copyDisabled?0.45:1,whiteSpace:"nowrap"}}>
            {callCopied?"✓ CALL COPIED":callFrozen?"⎘ COPY 10AM CALL":"⎘ COPY LIVE READ"}
          </button>}
          <button onClick={()=>setOpen(o=>!o)} aria-label="Show regime factors" aria-expanded={open}
            style={{background:"none",border:`1px solid ${regime.color}44`,borderRadius:3,color:regime.color,cursor:"pointer",padding:"4px 8px",minWidth:44,minHeight:44,fontFamily:T.fontMono,fontSize:11,flexShrink:0}}>
            {open?"▲":"ℹ"}
          </button>
        </div>
      </div>
      {/* Expandable plain-language breakdown */}
      {open&&(
        <div style={{marginTop:10,borderTop:`1px solid ${T.border}`,paddingTop:8,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"4px 18px"}}>
          {/* v3.94: the chips + tally + nearest flip — formerly first-screen, now the panel head.
              FEAT-NEUTRAL (v3.62) holds: chips render the REAL 4-state vote via voteStyle. */}
          <div style={{gridColumn:"1/-1",display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
            {factors.map((f)=>{
              const vs=voteStyle(f.vote); const c=T[vs.colorKey];
              return(
              <span key={f.label} title={`${f.label}: ${vs.word}`} style={{fontFamily:T.fontMono,fontSize:T.fsM,color:c,border:`1px solid ${c}44`,borderRadius:3,padding:"1px 5px",letterSpacing:"0.03em",background:"#00000022",whiteSpace:"nowrap",opacity:f.vote==="excluded"?0.7:1}}>
                {f.short} {vs.glyph}
              </span>
            );})}
            <span style={{fontFamily:T.fontMono,fontSize:T.fsS,color:T.textMuted}}>
              {`${regime.bullVotes} bull · ${neutralVotes} neutral · ${regime.bearVotes} bear — ${regime.counted} of ${regime.totalFactors} voters counted`}
            </span>
          </div>
          {!withheld&&<div style={{gridColumn:"1/-1",fontFamily:T.fontMono,fontSize:T.fsS,color:T.textSecondary}}>
            <span style={{color:T.textMuted}}>⇄ would change this: </span>
            {nearest
              ? <><span style={{color:regime.color}}>{nearest.copy}</span>
                  <span style={{color:T.textMuted}}> ({fmt.num(nearest.distance,nearest.dec)}{nearest.unit} away) → </span>
                  <span style={{color:T.textPrimary,fontWeight:700}}>{nearest.would}</span>
                  <span style={{color:T.textMuted}}> if other signals stay put</span>
                  {fc.flips.length>1&&<span style={{color:T.textMuted}}> · +{fc.flips.length-1} more</span>}</>
              : <span style={{color:T.textMuted}}>no single factor crossing flips this verdict — it would take two</span>}
          </div>}
          {factors.map(f=>(
            <div key={f.label} style={{display:"flex",gap:8,alignItems:"baseline"}}>
              <div style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted,minWidth:100,flexShrink:0}}>{f.label}</div>
              {/* Same 4-state map as the chips — the drawer used to paint NFCI's own honest
                  "Looser than mean, but within ½ SD" copy red, contradicting its own words. */}
              <div style={{fontFamily:T.fontMono,fontSize:9,color:T[voteStyle(f.vote).colorKey]}}>{f.val}</div>
            </div>
          ))}
          {/* FEAT-FLIP: every load-bearing crossing, then what abstained and why. The
              abstentions are NOT omitted — a factor that cannot express a single threshold is
              a fact about the rule, and hiding it would read as "these four are all there is". */}
          <div style={{gridColumn:"1/-1",borderTop:`1px solid ${T.border}`,marginTop:4,paddingTop:6}}>
            <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,letterSpacing:"0.1em",marginBottom:3}}>WHAT WOULD CHANGE THIS VERDICT</div>
            {fc.flips.length===0&&(
              <div style={{fontFamily:T.fontMono,fontSize:9,color:T.textSecondary}}>
                No single factor crossing changes the call — with {fc.bullVotes} bull and {fc.bearVotes} bear among the {fc.counted} counted,
                it would take two factors moving together.
              </div>
            )}
            {fc.flips.map(f=>(
              <div key={`${f.key}-${f.to}`} style={{fontFamily:T.fontMono,fontSize:9,color:T.textSecondary,display:"flex",gap:6,flexWrap:"wrap",marginBottom:1}}>
                <span style={{color:regime.color,minWidth:190}}>{f.copy}</span>
                <span style={{color:T.textMuted}}>now {fmt.num(f.value,f.dec)}{f.unit} · {fmt.num(f.distance,f.dec)}{f.unit} away</span>
                <span style={{color:T.textPrimary}}>→ {f.would}</span>
              </div>
            ))}
            {fc.abstained.map(a=>(
              <div key={a.key} style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginTop:2}}>
                {a.label}: no single threshold — {a.why}
              </div>
            ))}
            {fc.excluded.length>0&&(
              <div style={{fontFamily:T.fontMono,fontSize:8,color:T.amber,marginTop:2}}>
                Dark, so their thresholds are not load-bearing: {fc.excluded.map(e=>e.short).join(" · ")}
              </div>
            )}
          </div>
          <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,gridColumn:"1/-1"}}>Rule-based 6-factor vote · stale/dead inputs auto-excluded · {srcLabel}</div>
        </div>
      )}
    </div>
  );
};

export default RegimeBand;
