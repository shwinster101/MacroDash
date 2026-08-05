// ─── MARKET DETAIL (UI-OVERHAUL wave 9, task 5.2) ───────────────────────────
// Extracted VERBATIM from dashboard.jsx: the ONE market-detail CollapsedGroup —
// SPY chart + MA cross, YTD KPI tiles, live-first signal tiles (VIX · F&G · HY-IG ·
// NFCI), and the cross-asset DirTile row. PRESENTATION ONLY: provenance (modeOf/
// asOfOf), the FEAT-322 demotion rule (demoted), the chart series (spyData) and the
// MA-cross read (goldenCross) are computed in the orchestrator and handed over.
// NFCI band constants come from regime.js — the same ONE band table the vote uses.
// The only addition is the Property-9 null guard.
import { Fragment } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { T } from "../design-tokens.js";
import { NFCI_TIGHT, NFCI_LOOSE, REGIME_BAND_TABLE } from "../regime.js";
import { fmt, pctColor } from "../format.js";
import { Badge, Label } from "../primitives/atoms.jsx";
import SectionHeader from "../primitives/SectionHeader.jsx";
import SourceBox, { DataModeBadge } from "../primitives/SourceBox.jsx";
import { ILLUS_HATCH, IllustrativeChip, isIllustrative } from "../primitives/Illustrative.jsx";
import CollapsedGroup from "../primitives/CollapsedGroup.jsx";
import DirTile from "../primitives/DirTile.jsx";
import FGGauge from "../primitives/FGGauge.jsx";

/* v3.69 NARRATIVE-FIRST supersedes the FEAT-161 60/40 COMMAND CENTER GRID and the
          FEAT-171 above-fold contract: the two-column race is what buried the 5 Whys ~5 phone
          screens down (Zone A stacked entirely before Zone B on mobile). The narrative now
          leads in the overview; the chart and tile rows are reference material behind ONE
          expander (the macro strip above stays the always-visible summary — v3.25: its
          provenance dots and voting markers survive the collapse). Count = 1 chart + 2 YTD
          + 4 signal + 4 cross-asset tiles. */
const MarketDetail=({d,modeOf,asOfOf,demoted,spyData,goldenCross})=>{
  if(!d||typeof modeOf!=="function"||!Array.isArray(spyData))return <div aria-hidden="true"/>;
  return(
      <div style={{padding:"12px 20px 0"}}>
        <CollapsedGroup count={11} label="full market detail — chart & tiles" chip={false}>
        <div style={{display:"grid",gap:16,marginTop:8}}>

          {/* ── market detail (was ZONE A) ── */}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* A1: SPY Chart + MA cross */}
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"14px 16px"}}>
              <SectionHeader>Market Pulse</SectionHeader>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,flexWrap:"wrap",gap:6}}>
                <div>
                  <div style={{fontFamily:T.fontSans,fontSize:11,color:T.textMuted}}>S&P 500 — 100D & 200D Moving Average</div>
                  <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                    <Badge label={`100D MA $${d.marketPulse.spy.ma100}`} color={T.blue} small/>
                    <Badge label={`200D MA $${d.marketPulse.spy.ma200}`} color={T.purple} small/>
                    <Badge label={goldenCross?"GOLDEN CROSS ✓":"DEATH CROSS ✗"} color={goldenCross?T.green:T.red} small/>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:T.fontMono,fontSize:22,color:T.textPrimary,fontWeight:700}}>${d.marketPulse.spy.price}</div>
                  <div style={{fontFamily:T.fontMono,fontSize:11,color:pctColor(d.marketPulse.spy.changePct)}}>{fmt.pct(d.marketPulse.spy.changePct)} today</div>
                  {/* FEAT-202: live S&P 500 index (FRED SP500) */}
                  <div style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>S&amp;P 500 index {d.marketPulse.spx.index.toLocaleString()}</div>
                </div>
              </div>
              {/* B4 (v3.59): the chart is aria-hidden; the visually-hidden line below is its
                  text equivalent — trend + both moving averages, the decision content. */}
              <span className="visually-hidden">
                SPY {d.marketPulse.spy.price>=d.marketPulse.spy.ma200?"above":"below"} its 200-day average of ${d.marketPulse.spy.ma200}
                {" and "}{d.marketPulse.spy.price>=d.marketPulse.spy.ma100?"above":"below"} its 100-day average of ${d.marketPulse.spy.ma100}.
              </span>
              <div aria-hidden="true" style={{height:140}}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spyData}>
                    <XAxis dataKey="date" hide/>
                    <YAxis domain={["auto","auto"]} tick={{fontSize:8,fill:T.textMuted}} width={38}/>
                    <Tooltip contentStyle={{background:T.surfaceHigh,border:`1px solid ${T.border}`,fontSize:10,fontFamily:T.fontMono}} formatter={(val)=>[`$${val.toFixed(2)}`,"Price"]}/>
                    <ReferenceLine y={d.marketPulse.spy.ma200} stroke={T.purple} strokeDasharray="4 2" strokeWidth={1}/>
                    <ReferenceLine y={d.marketPulse.spy.ma100} stroke={T.blue} strokeDasharray="4 2" strokeWidth={1}/>
                    <Line type="monotone" dataKey="price" stroke={T.amber} dot={false} strokeWidth={2}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <SourceBox api="FRED" endpoint="SP500 ÷10 proxy" mode={modeOf('spyPrice')} asOf={asOfOf('spyPrice')}/>
            </div>

            {/* A2-A5: KPI row — v3.1: SPY P/E (mock, Yahoo-dupe) cut; each tile carries provenance */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[
                {l:"SPY YTD",  f:"spyYtd", v:fmt.pct(d.marketPulse.spy.ytd),  c:pctColor(d.marketPulse.spy.ytd)},
                {l:"QQQ YTD",  f:"qqqYtd", v:fmt.pct(d.marketPulse.qqq.ytd),  c:pctColor(d.marketPulse.qqq.ytd)},
              ].map(({l,v,c})=>{
                const m=modeOf(l==="SPY YTD"?"spyYtd":"qqqYtd"); const illus=isIllustrative(m);
                return(
                <div key={l} style={{background:T.surface,backgroundImage:illus?ILLUS_HATCH:undefined,border:`1px solid ${T.border}`,borderRadius:5,padding:"8px 12px",flex:"1 1 90px",opacity:illus?0.92:1}}>
                  <Label>{l}</Label>
                  <div style={{fontFamily:T.fontMono,fontSize:18,color:illus?T.textSecondary:c,fontWeight:700}}>{v}</div>
                  <div style={{marginTop:2}}>{illus?(m==="STALE"?<DataModeBadge mode="STALE"/>:<IllustrativeChip/>):<DataModeBadge mode={m}/>}</div>
                </div>
                );
              })}
            </div>

            {/* A6-A8: Signal tiles, live-first (FEAT-322) — equity fear (VIX | F&G) + credit
                risk. Descriptor array so stale tiles demote into a CollapsedGroup instead of
                renting default-view space at full size (DEC-31 already retired P/C). */}
            {(()=>{
              const signalTiles=[
                { f:"vix", render:()=>{
                  /* Wave-17 audit fix (finding 2): the 18/25 edges were a hand-written second
                     copy of the VIX band — if the band moved, this tile silently disagreed
                     with the vote it sits beside. The color now branches on the band table's
                     OWN vote (bull/neutral/bear -> the tile's green/yellow/red palette). */
                  const vixVote=REGIME_BAND_TABLE.find((b)=>b.key==="vix").vote(d.marketPulse.vix.current);
                  return (
                  <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,padding:"10px 12px"}}>
                    <Label>VIX</Label>
                    <div style={{fontFamily:T.fontMono,fontSize:20,color:{bull:T.green,neutral:T.yellow,bear:T.red}[vixVote]||T.textSecondary,fontWeight:700}}>{d.marketPulse.vix.current}</div>
                    <div style={{fontFamily:T.fontMono,fontSize:9,color:pctColor(d.marketPulse.vix.weekChg,true)}}>{fmt.pct(d.marketPulse.vix.weekChg)} WoW</div>
                    <div style={{height:28,marginTop:6}}><ResponsiveContainer width="100%" height="100%"><LineChart data={d.marketPulse.vix.series.map((v,i)=>({v,i}))}><Line type="monotone" dataKey="v" stroke={T.amber} dot={false} strokeWidth={1.5}/></LineChart></ResponsiveContainer></div>
                    <SourceBox api="FRED" endpoint="VIXCLS" mode={modeOf('vix')} asOf={asOfOf('vix')}/>
                  </div>
                );}},
                { f:"fearGreed", render:()=>(
                  <FGGauge score={d.marketPulse.fearGreed.score} label={d.marketPulse.fearGreed.label} mode={modeOf('fearGreed')} asOf={asOfOf('fearGreed')}/>
                )},
                // HY-IG Credit Spread — widening is a bearish leading indicator for equities
                { f:"creditSpread", render:()=>(
                  <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,padding:"10px 12px"}}>
                    <Label>HY–IG SPREAD</Label>
                    <div style={{fontFamily:T.fontMono,fontSize:20,color:d.macro.credit.spread>5?T.red:d.macro.credit.spread>3.5?T.yellow:T.textPrimary,fontWeight:700}}>
                      {d.macro.credit.spread.toFixed(2)}<span style={{fontSize:11}}>pp</span>
                    </div>
                    <div style={{fontFamily:T.fontMono,fontSize:9,color:d.macro.credit.spreadD1>0?T.red:d.macro.credit.spreadD1<0?T.green:T.textMuted}}>
                      {d.macro.credit.spreadD1>0?"▲":d.macro.credit.spreadD1<0?"▼":"→"} {Math.abs(d.macro.credit.spreadD1).toFixed(2)}pp {d.macro.credit.spreadD1>0?"widening":d.macro.credit.spreadD1<0?"tightening":"unchanged"}
                    </div>
                    <div style={{height:28,marginTop:6}}><ResponsiveContainer width="100%" height="100%"><LineChart data={d.macro.credit.series.map((v,i)=>({v,i}))}><Line type="monotone" dataKey="v" stroke={d.macro.credit.spreadD1>0?T.red:T.green} dot={false} strokeWidth={1.5}/></LineChart></ResponsiveContainer></div>
                    <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginTop:3}}>HY {d.macro.credit.hy.toFixed(2)}% · IG {d.macro.credit.ig.toFixed(2)}%</div>
                    <SourceBox api="FRED" endpoint="ICE BofA OAS" mode={modeOf('creditSpread')} asOf={asOfOf('creditSpread')}/>
                  </div>
                )},
                /* FEAT-NFCI (v3.43): financial conditions — the closest thing to a direct
                   answer to this dashboard's own thesis question, and the one macro series
                   here that a retail site (Yahoo/SA/TipRanks) effectively never surfaces.
                   Sits beside HY-IG because both are risk-TRANSMISSION gauges: credit prices
                   the risk, NFCI measures how tight the plumbing carrying it has become. */
                { f:"nfci", render:()=>{
                  const nMode=modeOf('nfci'), nIllus=isIllustrative(nMode);
                  const v=d.macro.nfci.current, w=d.macro.nfci.w1;
                  /* NFCI_BANDS (v3.43.1) — derived, not asserted. The index is a Z-SCORE by
                     construction (mean 0, SD 1 over 1971–), so its native unit is standard
                     deviations and a decimal deadband like the old ±0.10 meant nothing in it.
                     Two thresholds, each with a reason:
                       > 0     TIGHT — zero is the DEFINITIONAL mean, so crossing it is the event
                       ≤ -0.5  LOOSE — a half standard deviation below the mean, stated in the
                               index's own unit rather than a made-up decimal
                     Deliberately ASYMMETRIC (the same doctrine as the v3.40 TAILWIND withhold):
                     tight conditions CAUSE drawdowns, while merely-looser-than-average is the
                     ordinary post-GFC backdrop, not a buy signal. A symmetric band around zero
                     would have voted bullish nearly every week — a factor that always votes the
                     same way does not inform a majority tally, it silently biases it. */
                  const band=v>NFCI_TIGHT?"TIGHT":v<=NFCI_LOOSE?"LOOSE":"NEUTRAL";
                  const bandCol=band==="TIGHT"?T.red:band==="LOOSE"?T.green:T.yellow;
                  return (
                  <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,padding:"10px 12px",
                    backgroundImage:nIllus?ILLUS_HATCH:undefined,opacity:nIllus?0.92:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:6,flexWrap:"wrap"}}>
                      <Label>FIN CONDITIONS</Label>
                      {/* v3.1 honesty invariant: TIGHT/LOOSE is a directional call, so it is
                          suppressed on mock/stale exactly like the CAPE BUBBLE verdict. */}
                      {nIllus?(nMode==="STALE"?<DataModeBadge mode="STALE"/>:<IllustrativeChip/>)
                             :<Badge label={band} color={bandCol} small/>}
                    </div>
                    <div style={{fontFamily:T.fontMono,fontSize:20,color:nIllus?T.textSecondary:bandCol,fontWeight:700}}>
                      {v>0?"+":""}{v.toFixed(2)}
                    </div>
                    <div style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>
                      {w==null?"—":`${w>0?"▲ +":w<0?"▼ ":"→ "}${Math.abs(w).toFixed(2)} WoW`} · 0 = avg
                    </div>
                    <div style={{height:28,marginTop:6}}><ResponsiveContainer width="100%" height="100%"><LineChart data={d.macro.nfci.series.map((val,i)=>({v:val,i}))}><Line type="monotone" dataKey="v" stroke={nIllus?T.textMuted:bandCol} dot={false} strokeWidth={1.5}/></LineChart></ResponsiveContainer></div>
                    <SourceBox api="FRED" endpoint="NFCI · Chicago Fed" mode={nMode} asOf={asOfOf('nfci')}/>
                  </div>
                );}},
              ];
              const liveSig=signalTiles.filter(t=>!demoted(t.f));
              const degSig=signalTiles.filter(t=>demoted(t.f));
              return (
                <>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {liveSig.map(t=><Fragment key={t.f}>{t.render()}</Fragment>)}
                  </div>
                  {degSig.length>0&&(
                    <CollapsedGroup count={degSig.length} label={`stale signal tile${degSig.length===1?"":"s"}`}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
                        {degSig.map(t=><Fragment key={t.f}>{t.render()}</Fragment>)}
                      </div>
                    </CollapsedGroup>
                  )}
                </>
              );
            })()}

            {/* Cross-asset direction tiles — live-first (FEAT-322): live tiles own the row;
                curated (Gold has no SOURCES key — permanently Manual) + stale ones demote
                behind a "+N stale/curated" expander. */}
            <div>
              <SectionHeader>Cross-Asset Direction</SectionHeader>
              {(()=>{
                const dirTiles=[
                  { f:"tenYear", render:()=><DirTile label="10Y Treasury" value={`${d.crossAsset.treasury10y.current}%`} d1={d.crossAsset.treasury10y.d1} w1={d.crossAsset.treasury10y.w1} m1={d.crossAsset.treasury10y.m1} band={0.10} invert={true} spark={d.crossAsset.treasury10y.series} source="FRED" sourceEp="DGS10" mode={modeOf('tenYear')} asOf={asOfOf('tenYear')}/> },
                  /* FEAT-30Y (v3.55): the LONG END, beside the 10Y because the pair is the
                     point. TLT was rejected in v3.43 as a monotonic transform of the 10Y —
                     DGS30 is not: "long end breaking out while the front holds" is its own
                     transmission channel (term premium / fiscal risk), and the tile states
                     the 10s30s spread on its face so the pair reads as one signal. The 5%
                     line is a stated REFERENCE, never a verdict — a directional call off a
                     level would be the v3.1 invariant violated. */
                  { f:"thirtyYear", render:()=><DirTile label="30Y Treasury" value={`${d.crossAsset.treasury30y.current}%`} d1={d.crossAsset.treasury30y.d1} w1={d.crossAsset.treasury30y.w1} m1={d.crossAsset.treasury30y.m1} band={0.10} invert={true} spark={d.crossAsset.treasury30y.series} source="FRED" sourceEp="DGS30" mode={modeOf('thirtyYear')} asOf={asOfOf('thirtyYear')}
                      note={`10s30s ${d.crossAsset.term.spread10s30s>=0?"+":""}${d.crossAsset.term.spread10s30s.toFixed(2)}pp${d.crossAsset.term.spread10s30s<0?" — INVERTED":""}`}
                      noteTitle={"5.00% = the 2007 pre-GFC reference level"}/> },
                  { f:"wti", render:()=><DirTile label="WTI Crude"   value={`$${d.crossAsset.wti.current}`}         d1={d.crossAsset.wti.d1pct}  w1={d.crossAsset.wti.w1pct}  m1={d.crossAsset.wti.m1pct}  band={1.0} spark={d.crossAsset.wti.series}  source="FRED" sourceEp="DCOILWTICO" mode={modeOf('wti')} asOf={asOfOf('wti')}/> },
                  { f:"btc", render:()=><DirTile label="Bitcoin"     value={`$${(d.crossAsset.btc.current/1000).toFixed(1)}K`} d1={d.crossAsset.btc.d1pct} w1={d.crossAsset.btc.w1pct} m1={d.crossAsset.btc.m1pct} band={2.0} spark={d.crossAsset.btc.series} source="FRED" sourceEp="CBBTCUSD" mode={modeOf('btc')} asOf={asOfOf('btc')}/> },
                ];
                const liveDir=dirTiles.filter(t=>!(t.curated||demoted(t.f)));
                const degDir=dirTiles.filter(t=>t.curated||demoted(t.f));
                return (
                  <>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}} className="dir-tiles">
                      {liveDir.map(t=><Fragment key={t.f}>{t.render()}</Fragment>)}
                    </div>
                    {degDir.length>0&&(
                      <CollapsedGroup count={degDir.length} label="stale/curated cross-asset">
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}} className="dir-tiles">
                          {degDir.map(t=><Fragment key={t.f}>{t.render()}</Fragment>)}
                        </div>
                      </CollapsedGroup>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

        </div>
        </CollapsedGroup>
      </div>
  );
};
export default MarketDetail;
