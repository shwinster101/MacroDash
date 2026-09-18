// ─── MACRO STRIP (UI-OVERHAUL Slice 2, task 3.1) ────────────────────────────
// Extracted VERBATIM from dashboard.jsx: the persistent ticker — always visible
// (v3.69: it IS the market summary while the chart + tiles collapse behind the
// market-detail expander; v3.25: its provenance dots and voting markers survive
// that collapse). FEAT-170: reflows to a 4-col grid on mobile via the
// .macro-strip/.macro-strip-inner rules in the orchestrator's global stylesheet.
// PRESENTATION ONLY — provenance (modeOf), the FOMC label and the voting-fields
// set are computed in the orchestrator and handed over; `badge` is a slot for
// the WenMoonBadge so the tape mood stays the orchestrator's concern.
// Wave-17 audit fix (findings 1-3): the F&G and CPI sub-line colors are DERIVED
// from REGIME_BAND_TABLE's own vote — the strip painted a NEUTRAL F&G (30-55)
// bearish red off a hand-written `>55` binary while the gauge below rendered it
// grey and the band chip rendered `•` (the FEAT-NEUTRAL defect surviving on one
// surface), and CPI asserted red/green off a `>3` level threshold that exists
// nowhere in the engine (the factor votes on trend SHAPE). One band, one home —
// the same documented exception MarketDetail's NFCI constants use. And because a
// vote-derived color IS a directional read, it is muted when the field is not
// live (the NFCI TIGHT/LOOSE precedent, v3.1). Delta colors (pctColor on day
// moves) are arithmetic facts, not verdicts, and keep their existing treatment.
import { etYmd } from "../sources.js";
import { ytdView } from "../marketReturnView.js";
import SectionHeader from "../primitives/SectionHeader.jsx";
import { T } from "../design-tokens.js";
import { REGIME_BAND_TABLE, voteStyle } from "../regime.js";
import { fmt, pctColor } from "../format.js";
/* v6.3 (owner: "publish the descriptor popups for the 8 parameters"): every tile opens the
   SAME 3-bullet sheet the Simple cards open. The copy is resolved by src/stripExplain.js —
   a band factor's tile hands over the band's OWN explainer object (one home, never a copy),
   the three context tiles get theirs from the one context table. The sheet and its open
   state live in the primitive (sections stay presentation-only, the v3.73 boundary). */
import { Explainable } from "../primitives/FactSheet.jsx";
import { stripExplainFor } from "../stripExplain.js";

const bandOf=(k)=>REGIME_BAND_TABLE.find((b)=>b.key===k);

const SimpleMarketTape=({d,modeOf,asOfOf,degen=false,fomcLabel})=><div className={degen?"macro-strip degen-market-tape":"macro-strip simple-market-tape"} role="region" aria-label={degen?"Market context — not model voters":"Market performance"}
  style={{background:T.surfaceHigh,padding:"8px 20px",borderBottom:`1px solid ${T.border}`,display:"grid",gridTemplateColumns:degen?"repeat(3,minmax(0,1fr))":"repeat(2,minmax(0,1fr))",gap:12}}>
  <div style={{gridColumn:"1/-1"}}><SectionHeader major>{degen?"Market context":"Market performance"}</SectionHeader></div>
  {[
    {label:"S&P 500",field:"spyPrice",changeField:"spyChangePct",data:d.marketPulse.spy,proxy:true},
    {label:"Nasdaq-100 / QQQ",field:"qqqPrice",changeField:"qqqChangePct",data:d.marketPulse.qqq},
  ].map(({label,field,changeField,data,proxy})=>{
    const live=["LIVE","CACHED"].includes(modeOf(changeField));
    const date=asOfOf?.(changeField);
    const available=live&&Boolean(date)&&Number.isFinite(data.changePct);
    const quoteLive=["LIVE","CACHED"].includes(modeOf(field))&&Boolean(asOfOf?.(field))&&Number.isFinite(data.price);
    const ytdField=proxy?"spyYtdTotal":"qqqYtdTotal";
    const ytd=ytdView(data,modeOf(ytdField),asOfOf?.(ytdField),etYmd());
    const ytdText=ytd.available?`${proxy?"SPY":"QQQ"} YTD total return ${fmt.pct(ytd.value)}, through ${ytd.date}, from ${data.ytdTotalBase}. Includes dividends (Tiingo adjusted closes).`:"YTD total return unavailable — no current, verified year-end baseline.";
    const ex=stripExplainFor(field);
    const reading=available?`${fmt.pct(data.changePct)} daily change`:"Daily change unavailable";
    const level=quoteLive?proxy?`S&P 500 index ÷ 10: ${data.price} (not an SPY quote)`:`QQQ ETF quote: $${data.price}`:"Level unavailable";
    return <Explainable key={field} explain={{...ex,metadata:`${reading}. ${ytdText} ${available?`As of ${date}. Data: ${modeOf(changeField)}.`:"No current change is shown."} ${level}${quoteLive&&asOfOf?.(field)?` · as of ${asOfOf(field)}`:""}.`}}
      title={ex.full} eyebrow={`${label} · ${reading}`} className="strip-tile simple-market-tile"
      style={{background:"none",border:"none",padding:0,minWidth:0}}>
      <div style={{fontFamily:T.fontMono,fontSize:T.fsL,fontWeight:700,color:T.textPrimary}}>{label}</div>
      <div className="market-daily" style={{fontFamily:T.fontMono,fontSize:T.fsL,fontWeight:700,color:available?pctColor(data.changePct):T.textMuted}}>{available?fmt.pct(data.changePct):"Unavailable"}</div>
      <div style={{fontFamily:T.fontMono,fontSize:T.fsS,color:T.textMuted}}>{available?`Daily · ${date}`:"No current reading"}</div>
      <div className="market-ytd" style={{fontFamily:T.fontMono,fontSize:T.fsL,fontWeight:700,color:ytd.available?pctColor(ytd.value):T.textMuted,marginTop:6}}>{ytd.available?fmt.pct(ytd.value):"Unavailable"}</div>
      <div style={{fontFamily:T.fontMono,fontSize:T.fsS,color:T.textMuted}}>{proxy?"SPY YTD total":"QQQ YTD total"}<br/>{ytd.available?ytd.date:"No current reading"}</div>
      <span className="visually-hidden">Opens an explainer.</span>
    </Explainable>;
  })}
  {degen&&<FedPolicyTile d={d} modeOf={modeOf} asOfOf={asOfOf} fomcLabel={fomcLabel}/>}
</div>;


function FedPolicyTile({d,modeOf,asOfOf,fomcLabel}) {
  const {targetLower:lo,targetUpper:hi,rate}=d.macro.fedFunds;
  const current=f=>["LIVE","CACHED"].includes(modeOf(f))&&Boolean(asOfOf?.(f));
  const target=Number.isFinite(lo)&&Number.isFinite(hi)&&current("fedTargetUpper")&&current("fedTargetLower");
  const field=target?"fedTargetUpper":"fedFunds";
  const available=target||(Number.isFinite(rate)&&current(field));
  const reading=available?target?`${lo.toFixed(2)}–${hi.toFixed(2)}%`:`${rate}% avg`:"Unavailable";
  const ex=stripExplainFor(field);
  return <Explainable className="strip-tile fed-context-tile" title={ex.full}
    explain={{...ex,metadata:`${reading}. ${target?"Policy target range":"Monthly effective average — not the policy target"}. ${available?`As of ${asOfOf(field)}. Data: ${modeOf(field)}.`:"No current reading."}`}}
    eyebrow="Fed rate · context only" style={{background:"none",border:"none",padding:0,minWidth:0}}>
    <div style={{fontFamily:T.fontMono,fontSize:T.fsM,color:T.textMuted}}>Fed rate</div>
    <div style={{fontFamily:T.fontMono,fontSize:T.fsL,fontWeight:700,color:available?T.textPrimary:T.textMuted}}>{reading}</div>
    <div style={{fontFamily:T.fontMono,fontSize:T.fsS,color:T.textMuted}}>{available?`${target?"Target":"Monthly avg"} · ${asOfOf(field)}`:"No current reading"}</div>
    <div style={{fontFamily:T.fontMono,fontSize:T.fsS,color:T.textMuted}}>FOMC {fomcLabel}</div>
  </Explainable>;
}

const MacroStrip=({d,modeOf,asOfOf,fomcLabel,fomcDays,votingFields,badge,variant="full"})=>{
  if(!d||typeof modeOf!=="function")return <div aria-hidden="true"/>;
  if(variant==="simple")return <SimpleMarketTape d={d} modeOf={modeOf} asOfOf={asOfOf}/>;
  if(variant==="degen")return <SimpleMarketTape d={d} modeOf={modeOf} asOfOf={asOfOf} degen fomcLabel={fomcLabel}/>;
  const vf=votingFields||new Set();
  const fedLo=d.macro.fedFunds.targetLower, fedHi=d.macro.fedFunds.targetUpper;
  const fedTargetLive=Number.isFinite(fedLo)&&Number.isFinite(fedHi)&&["LIVE","CACHED"].includes(modeOf("fedTargetUpper"));
  return(
    <div style={{background:T.surfaceHigh,borderBottom:`1px solid ${T.border}`,padding:"6px 20px",overflowX:"auto",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}} className="macro-strip">
      <div style={{display:"flex",gap:20,minWidth:"max-content",flex:1}} className="macro-strip-inner">
        {[
          {l:"SPY*", f:"spyPrice", v:`$${d.marketPulse.spy.price}`,      s:fmt.pct(d.marketPulse.spy.changePct), sc:pctColor(d.marketPulse.spy.changePct), t:"S&P 500 ÷ 10 (FRED SP500 proxy, NOT an SPY ETF quote — Stooq blocks the edge). Tracks the ETF closely; not identical."},
          {l:"QQQ",  f:"qqqPrice", v:`$${d.marketPulse.qqq.price}`,      s:fmt.pct(d.marketPulse.qqq.changePct), sc:pctColor(d.marketPulse.qqq.changePct), t:"Nasdaq-100 ETF — big tech"},
          {l:"VIX",  f:"vix", v:`${d.marketPulse.vix.current}`,     s:fmt.pct(d.marketPulse.vix.weekChg)+" WoW", t:"Volatility index — the market's fear gauge (lower = calmer)"},
          {l:"F&G",  f:"fearGreed", v:`${d.marketPulse.fearGreed.score}`, s:d.marketPulse.fearGreed.label, voteKey:"fearGreed", t:"Fear & Greed — market sentiment, 0 = fear, 100 = greed"},
          {l:"10Y",  f:"tenYear", v:`${d.crossAsset.treasury10y.current}%`, s:fmt.bps(d.crossAsset.treasury10y.d1)+" 1D", t:"10-year Treasury yield — the benchmark interest rate"},
          {l:"FED",  f:fedTargetLive?"fedTargetUpper":"fedFunds",
           v:fedTargetLive?`${fedLo.toFixed(2)}–${fedHi.toFixed(2)}%`:`${d.macro.fedFunds.rate}% avg`,
           s:`FOMC ${fomcLabel}`, sc:fomcDays===0?T.amber:T.textMuted,
           t:fedTargetLive?"Federal Reserve target range — current policy setting":"FEDFUNDS monthly effective average — lags a policy decision"},
          {l:"CPI",  f:"cpiHeadline", v:`${d.macro.cpi.headline}%`,         s:`Core ${d.macro.cpi.core}%`, voteKey:"cpiHeadline", t:"Consumer Price Index — inflation, year-over-year"},
          /* OWNER SWAP (8/31), reversing the FEAT-NFCILEV tile that held this slot since 8/29:
             the 8th slot goes to the NFCI COMPOSITE, not its leverage subindex.
             The reason is the voter/glance mismatch the 6-vs-8 study named: NFCI has VOTED in
             the six-factor backdrop since v3.43, and it was the one voter with ZERO glance
             presence — while the slot beside it was rented to a context-only field that votes
             nowhere. A strip whose job is "the market summary" was showing the non-voter and
             hiding the voter.
             It VOTES, so — unlike the tile it replaces — the ▪ marker and the "Counts toward
             today's posture" tooltip now render BY CONSTRUCTION (`nfci` is in FACTOR_FIELD's
             values, hence in VOTING_FIELDS), and `voteKey` gives the sub-line the band table's
             own vote colour, muted when the field is not live (v3.1).
             The sub-line stays the reference point, never the TIGHT/LOOSE word: a bare z-score
             is unreadable without it (v3.43), and the word is a directional call whose text —
             not just its colour — must be suppressed off a dead feed.
             NOTHING IS DELETED: `nfciLeverage` keeps its home on the NFCI tile in MarketDetail
             (the leverage-subindex line), so this is a promotion of the voter to glance and a
             demotion of the context field to the tile it already had, not a cut. */
          {l:"NFCI", f:"nfci",
           v:Number.isFinite(d.macro.nfci.current)?`${d.macro.nfci.current>0?"+":""}${d.macro.nfci.current.toFixed(2)}`:"—",
           s:"0 = avg", voteKey:"nfci",
           t:"Chicago Fed National Financial Conditions Index — how easily money and credit are flowing through the financial system, from 105 measures. Standardized so 0 = the 1971– average; positive is tighter than average, negative is looser."},
        ].filter(row=>variant!=="context"||!["spyPrice","qqqPrice"].includes(row.f)).map(({l,f,v,s,sc,voteKey,t})=>{
          const m=modeOf(f); const live=m==="LIVE"||m==="CACHED";
          // Vote-derived sub-line color: the band table is the ONE expression of the
          // threshold, voteStyle the ONE vote->appearance map. Not live -> muted (a
          // directional read off mock/stale is what the v3.1 invariant forbids).
          if(voteKey){const b=bandOf(voteKey);sc=b&&live?T[voteStyle(b.vote(b.read(d))).colorKey]:T.textMuted;}
          /* v6.9.5 — A VOTING TILE MAY NOT COLOUR ITS SUB-LINE FROM A HAND-WRITTEN READ.
             Owner, on a live Simple screenshot: the 10-year appeared twice ~200px apart — the
             card said "+0.23pp 1-mo · HURTING" in red, the strip said "−7bps 1D" in GREEN with
             a RED ▪ beside it. Every one of those is honest alone; together they read as the
             page contradicting itself, and the green came from `sc:pctColor(-d1)` — a directional
             judgment written by hand, on a window the band NEVER reads. That is the same defect
             v3.62 fixed for the hero chips (`f.bull ? green : red`, band table ignored) and the
             last place on the public page still carrying one.
             The sub is NOT re-coloured with the vote either, which would be the mirror error:
             the band judged the MONTH, so painting the 1-day move with the month's verdict
             claims a reading that never happened. A voter's sub-line is a neutral fact about a
             different window — muted — and the ▪ marker, already band-derived, is the ONE colour
             signal. SPY/QQQ/FED keep their directional colour on purpose: they vote nowhere, so
             "the price rose" has no verdict to contradict. */
          else if(vf.has(f))sc=T.textMuted;
          const dot=live?T.green:m==="STALE"?T.amber:T.textMuted; // provenance dot: live/stale/mock
          /* v3.62 (newcomer audit): "voting indicators and context indicators are mixed".
             A blanket per-SECTION label would be false here — this one strip carries both
             (VIX/F&G/10Y/CPI vote, SPY/QQQ/FED do not) — so the marker goes on the ITEM.
             Derived from FACTOR_FIELD's VALUES, not REGIME_FACTOR_FIELDS: that array holds
             only the five whose field key equals their factor key, with CAPE riding a
             separate `shillerPe`→`valuation` alias line in factorExclusions. Using it here
             would silently un-mark a CAPE tile the day one is added to a strip. */
          /* v3.98.4 (Power read-through): `vf` is the STATIC six-voter set, so a factor
             whose feed was dead still wore ▪ and its tooltip still read "Counts toward
             today's posture" — a marker asserting a state it cannot see, the same defect
             class the hero's hardcoded exclusion reason was. A voter that is dark today is
             NOT counted, and now says so instead of claiming the opposite. */
          const isVoter=vf.has(f); const votes=isVoter&&live;
          /* v6.0.2 (owner: "what's key — a word, or just an icon or colour"): the ▪ voter marker
             was a CONSTANT amber square, so a voting tile said "I vote" and never WHICH WAY —
             VIX and 10Y carried a delta-coloured sub while their actual vote (a monthly-change
             band) was nowhere on the strip. The marker now wears the vote's own colour through
             the ONE voteStyle map (green bull · red bear · secondary neutral), so every voter's
             direction reads as colour before any word, and agrees with the card and the hero
             chip for the same factor. Glyph unchanged (the "counts today" contract, v3.98.4);
             the vote WORD rides the title so a reader can confirm what the colour means. */
          const vb=votes?bandOf(f):null; const vs=vb?voteStyle(vb.vote(vb.read(d))):null;
          /* v6.3: the tile's WHOLE face is the tap target (the v5.8 card rule — "clicking on
             each context parameter", not hunting an affordance on a phone). The outer div keeps
             the layout, the classes and the hover title (a mouse still gets the tooltip); the
             button inside it is the phone's path to the same fact, one tap deep. The sheet's
             eyebrow restates THIS tile's own reading and its vote state in the strip's own
             vocabulary, so a context tile can never wear a voter's words. */
          const ex=stripExplainFor(f);
          return(
          <div key={l} title={`${t}\n(${m.toLowerCase()})${votes?`\nCounts toward today's posture — signal is ${vs.word}.`
            :isVoter?"\nA signal, but unavailable today — not counted.":"\nContext only — does not affect the call."}`} style={{flexShrink:0,minWidth:68,cursor:"help"}}>
            <Explainable explain={ex} title={ex?ex.full:l}
              eyebrow={`${l} · ${v}${votes?` · signal ${vs.word}`:isVoter?" · unavailable today":" · context only"}`}
              className="strip-tile" style={{background:"none",border:"none",padding:0,margin:0}}>
              {/* v6.8.1 (PUBLIC TERMINAL SKIN, Slice 2 item 1 — the strip lift): the three
                  sizes read the TOKEN floor (label fs-s 11 · value fs-l 14 · sub and ▪ fs-xs 10)
                  instead of the 8/13/9 literals the baseline measured as the smallest text on
                  the page — on the one row whose label is the only thing that says what the
                  number IS. The per-tile ⓘ is DELETED, not shrunk: since v6.3 the whole face is
                  the Explainable button, so an 8px glyph beside every ticker was a second
                  affordance for a target the reader is already touching. The screen-reader
                  promise stays — an sr-only sentence is the affordance a screen reader needs,
                  and it costs no pixels. */}
              <div style={{display:"flex",alignItems:"center",gap:3}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:live?dot:"transparent",border:`1px solid ${dot}`,flexShrink:0}}/>
                <span style={{fontFamily:T.fontMono,fontSize:T.fsS,color:T.textMuted}}>{l}</span>
                {votes&&<span aria-hidden="true" className="strip-vote" title={`counts toward today's posture — signal is ${vs.word}`} style={{fontFamily:T.fontMono,fontSize:T.fsXs,fontWeight:700,color:T[vs.colorKey],letterSpacing:"0.05em"}}>▪</span>}
                {ex&&<span className="visually-hidden"> — what is this? Opens an explainer.</span>}
              </div>
              <div style={{fontFamily:T.fontMono,fontSize:T.fsL,color:T.textPrimary,fontWeight:700,lineHeight:1.1}}>{v}</div>
              <div className="strip-sub" style={{fontFamily:T.fontMono,fontSize:T.fsXs,color:sc}}>{s}</div>
            </Explainable>
          </div>
          );
        })}
      </div>
      {/* Degen-only SPY session badge. It stays off the compact phone strip. */}
      {badge&&<div className="spy-tape-mobile">{badge}</div>}
    </div>
  );
};
export default MacroStrip;
