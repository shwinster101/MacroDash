// ─── FEAT-169 · REGIME VERDICT BAND (UI-OVERHAUL Slice 1, task 1.3) ──────────
// The friend-readable hero; presentation only. Engine rules stay in regime.js.
import { DT, T } from "../design-tokens.js";
import { computeRegime } from "../regime.js";
import { simpleCallLabel, simpleHoldExplain } from "../publicCopy.js";
import { Explainable } from "../primitives/FactSheet.jsx";

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


/* Historical v3.94 DRIVERS-ONLY (owner call: "audit the key drivers and only show those — everything
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
const RegimeBand=({d,stale=new Set(),loading=false,liveBuild=false,sentence=null,conf=null,plainVerdict=null,regimeIn=null,call=null,callFrozen=false,callCapturedAt=null,callDrift=null,closeRead=null,readCaption=null,noSessionDay=false,onCopyCall=null,callCopied=false,copyDisabled=false})=>{
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
  // FEAT-QUORUM: LOADING is not a verdict state — during the first fetch there is no evidence
  // yet, so the posture is withheld outright rather than computed from the mock baseline.
  const withheld=loading||regime.insufficient||(call&&!call.headline);
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
  const degenLabel=call&&call.headline?`${call.headline}${call.emoji?` ${call.emoji}`:""}`:moon.label;
  const machineLabel=call&&call.direction?call.direction:regime.label;
  const displayLabel=plainVerdict
    ? (call&&call.direction?simpleCallLabel(call):plainVerdict.label)
    : degenLabel;
  /* T8: Simple copy sits on the Hold row. Degen keeps the labelled clipboard on the right
     with the six-signal jump. One element, two slots — never both. */
  const copyControl=onCopyCall?<button onClick={onCopyCall} disabled={copyDisabled} aria-label="Copy MacroDash posture card"
    title={copyDisabled?"live data required":callFrozen?"Copy the frozen 10am public call":"Copy the current live read — not the 10am call"}
    style={{background:callCopied?"#1a3020":T.surfaceHigh,border:`1px solid ${callCopied?T.green:regime.color}66`,borderRadius:3,color:callCopied?T.green:regime.color,cursor:copyDisabled?"not-allowed":"pointer",padding:"4px 9px",minHeight:44,minWidth:plainVerdict?44:undefined,fontFamily:T.fontMono, /* v6.0.1: fsL glyph in Simple — a 9px speck in a 44px box was invisible */
      fontSize:plainVerdict?T.fsL:T.fsXs,opacity:copyDisabled?0.45:1,whiteSpace:"nowrap",flexShrink:0}}>
    {/* v5.9: icon-only in Simple. The action survives — losing a shipped feature from
        the DEFAULT view would be the worse trade — but "⎘ COPY LIVE READ" is three
        words of operator vocabulary sitting beside the answer, and the aria-label and
        tooltip already carry the full sentence for anyone who needs it. */}
    {plainVerdict
      ? (callCopied?"✓":"⎘")
      : (callCopied?"✓ CALL COPIED":callFrozen?"⎘ COPY 10AM CALL":"⎘ COPY LIVE READ")}
  </button>:null;
  return(
    <div role="region" aria-label="Macro backdrop verdict"
      style={{background:regime.tint,borderBottom:`1px solid ${regime.color}33`,borderTop:`1px solid ${regime.color}22`,padding:"10px 20px",position:"relative"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        {/* Left: label + sub */}
        <div style={{display:"flex",alignItems:"baseline",gap:12,flexWrap:"wrap",minWidth:0}}>
          <div>
            {/* T2: Simple kills the operator eyebrow. Degen keeps frozen / wen moon?.
                v6.8.4 (Slice 2 item 4 — "frozen/6pm/coverage become one status line, not four"):
                the eyebrow and the clock caption were two stacked rows saying one thing, so they
                are ONE ROW in the strip's anatomy — eyebrow mono fs-s tracked in the verdict
                colour, the caption its VALUE at fs-xs muted. Strings byte-unchanged, and the
                value span carries NO text-transform: innerText applies it, so uppercasing a
                dated caption would rewrite what three suites read. callFrozen and readCaption
                are mutually exclusive (liveReadCaption returns null when frozen), so this row
                shows at most one — the working note records that correction to "four". */}
            {!plainVerdict&&<div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
              <span style={{fontFamily:T.fontMono,fontSize:T.fsS,color:regime.color,letterSpacing:"0.14em",textTransform:"uppercase"}}>
                {callFrozen?"Macro Backdrop · 10am call · frozen":"Macro Backdrop · wen moon?"}
              </span>
              {callFrozen&&<span className="hero-clock" style={{fontFamily:T.fontMono,fontSize:T.fsXs,color:T.textMuted}}>
                frozen 10am call · captured 10:00 ET{callCapturedAt?` · ${String(callCapturedAt).slice(0,10)}`:""}
              </span>}
              {readCaption&&<span className="hero-clock" style={{fontFamily:T.fontMono,fontSize:T.fsXs,color:T.textMuted}}>{readCaption}</span>}
            </div>}
            <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:plainVerdict?"nowrap":"wrap"}}>
              {/* v5.9: in Simple the verdict TOKEN is the tap target for its own vocabulary
                  (Explainable owns the state and the dialog). Power keeps the plain span —
                  an operator who reads MOONING every morning does not need it explained, and
                  the moon voice there is a locked owner ruling. */}
              {plainVerdict
                ? <Explainable className="simple-hold" explain={simpleHoldExplain({callFrozen,callCapturedAt,readCaption,closeRead,callDrift,conf})} title="What this call means"
                    eyebrow={displayLabel}
                    style={{background:"none",border:"none",padding:0,width:"auto",display:"inline-block"}}>
                    <span style={{fontFamily:T.fontMono,fontSize:T.fsXxl,fontWeight:700,color:regime.color,letterSpacing:"-0.01em"}}>{displayLabel}</span>
                    <span aria-hidden="true" style={{fontFamily:T.fontMono,fontSize:T.fsXs,color:regime.color,verticalAlign:"super",marginLeft:4}}>ⓘ</span>
                    <span className="visually-hidden"> — what does this mean? Opens an explainer.</span>
                  </Explainable>
                : <span style={{fontFamily:T.fontMono,fontSize:T.fsXl,fontWeight:700,color:regime.color,letterSpacing:"-0.01em"}}>{displayLabel}</span>}
              {plainVerdict&&copyControl}
              {!plainVerdict&&<span style={{fontFamily:T.fontMono,fontSize:T.fsL,color:T.textSecondary}}>
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
                {/* v5.9 (beginner read): in Simple the sub is DROPPED — it restates in counts
                    what the plain sentence below says in words. Power keeps both. */}
                {loading?"LOADING · waiting for live data before calling a posture"
                        :regime.insufficient?`${WITHHELD_LABEL} · ${subText}`
                        :`${machineLabel} · ${subText}`}
              </span>}
              {(loading||regime.insufficient)&&<span style={{fontFamily:T.fontMono,fontSize:T.fsS,color:T.textMuted}}>
                {loading?"no signals counted yet"
                        :`only ${regime.counted} of ${regime.totalFactors} signals counted — ${regime.quorum} needed to call it`}
              </span>}
            </div>
            {!withheld&&sentence&&<div style={{fontFamily:plainVerdict?T.fontSans:T.fontMono,fontSize:plainVerdict?T.fsBody:T.fsM,color:T.textPrimary,lineHeight:plainVerdict?1.4:1.5,maxWidth:"36em",marginTop:plainVerdict?8:3}}>{sentence}</div>}
            {/* v6.0.1: in Simple both clock captions ride Hold ⓘ; Degen keeps them on the
                face, and since v6.8.4 on the ONE status row above the verdict rather than two
                rows beneath it. The 8/28 A6 contract is unchanged — the unfrozen face still
                names itself a live read, liveBuild-gated, suppressed while withheld. */}
            {/* v6.2: once captured, the 6pm CLOSE READ owns this slot (the drift line's designed
                successor — owner ruling 9/2, both modes, ONE labeled line); the scope words are
                load-bearing, since the same engine now speaks twice a day. Muted when it agrees. */}
            {!plainVerdict&&(closeRead
              ? <div className="close-read" style={{fontFamily:T.fontMono,fontSize:T.fsXs,color:closeRead.differs?(closeRead.direction==="BEARISH"?T.red:T.amber):T.textMuted,marginTop:4,lineHeight:1.45}}>
                  Evening update (6pm ET): {closeRead.label} — {closeRead.frozen?"unscored; the 10am call remains frozen above":"unscored; no 10am call was scheduled today"}
                </div>
              : callDrift&&<div style={{fontFamily:T.fontMono,fontSize:T.fsXs,color:callDrift.direction==="BEARISH"?T.red:T.amber,marginTop:4,lineHeight:1.45}}>
              Current evidence now reads {callDrift.headline}{callDrift.emoji?` ${callDrift.emoji}`:""} · {callDrift.direction}; the scored 10am call remains frozen above.
            </div>)}
            {/* v3.98.3 — one line, one scope word, one vocabulary. It used to read
                "4/6 factors voting · excluded: 10Y · VIX" directly under a sentence saying
                those same two were "dark", while the verdict sub above ALSO said "4 of 6
                inputs usable" — three renderings of one fact and two words for one state.
                "VOTERS" is the scope word that resolves the other ambiguity: WHY #2 lists
                dark CROSS-SIGNALS (WTI, HY-IG among them), a deliberately wider set than the
                six that vote, and nothing said so. */}
            {conf&&!loading&&!plainVerdict&&<div style={{fontFamily:T.fontMono,fontSize:T.fsXs,marginTop:3,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
              {/* v6.0.1 SHAPE BEFORE TEXT: one dot per voter (filled counted · hollow amber dark) ahead of the sentence. */}
              <span aria-hidden="true" className="signal-dots" style={{display:"inline-flex",gap:2,alignItems:"center"}}>
                {Array.from({length:conf.total},(_,i)=>{const on=i<conf.counted;return(
                  <span key={i} style={{width:6,height:6,borderRadius:"50%",background:on?T.green:"transparent",border:`1px solid ${on?T.green:T.amber}`}}/>);})}
              </span>
              <span style={{color:regime.insufficient?T.red:conf.counted===conf.total?T.green:T.amber}}>{conf.counted} of {conf.total} signals counted</span>
              {conf.excluded.length>0&&<span style={{color:T.amber}}>unavailable: {conf.excluded.join(" · ")}</span>}
              {conf.blind&&<span style={{color:T.red}}>⚠ crash gauge (VIX) unavailable</span>}
            </div>}
            {/* T2: 6-of-6 left the Simple face, but a red crash-gauge fact never folds (v3.25). */}
            {plainVerdict&&conf&&conf.blind&&!loading&&<div style={{fontFamily:T.fontMono,fontSize:T.fsXs,color:T.red,marginTop:3}}>⚠ crash gauge (VIX) unavailable</div>}
            {/* FEAT-FLIP: the audit's fourth first-screen answer — what would change the call.
                "Nothing single-handedly" is stated plainly rather than padded with the nearest
                distance to look responsive (abstention rule 3). */}
            {withheld&&<div style={{fontFamily:T.fontMono,fontSize:T.fsXs,color:T.textMuted,marginTop:3}}>
                  {loading
                    ? "Nothing is being asserted from the demo baseline while the live snapshot loads."
                    : `evidence too thin${liveBuild?" — live data unavailable or stale; the mock baseline is NOT voting":""}.`}
                </div>}
          </div>
        </div>
        {/* Right: Degen evidence jump + labelled copy. Simple copy is on the Hold row (T8); Simple ℹ is
            gone — Hold ⓘ already opens the clock, evening update, and coverage. */}
        {!plainVerdict&&<div style={{display:"flex",alignItems:"center",gap:8}}>
          {copyControl}
          <button onClick={()=>document.getElementById("drivers")?.scrollIntoView({block:"start",behavior:"smooth"})} aria-label="Show regime factors"
            style={{background:"none",border:`1px solid ${regime.color}44`,borderRadius:3,color:regime.color,cursor:"pointer",padding:"4px 8px",minWidth:44,minHeight:44,fontFamily:T.fontMono,fontSize:T.fsM}}>
            Six signals ↓
          </button>
        </div>}
      </div>
    </div>
  );
};

export default RegimeBand;
