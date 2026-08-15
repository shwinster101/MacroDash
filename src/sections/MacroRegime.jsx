// ─── MACRO REGIME GRID (UI-OVERHAUL wave 9, task 5.3) ───────────────────────
// Extracted VERBATIM from dashboard.jsx: Fed funds + Kalshi odds, the inflation
// quartet, labor + savings, housing, and the Shiller CAPE (verdict suppressed on
// mock/stale — the v3.1 invariant). PRESENTATION ONLY: modeOf/asOfOf/fomcDays are
// computed in the orchestrator. The only addition is the Property-9 null guard.
import { LineChart, Line, ResponsiveContainer, ReferenceLine } from "recharts";
import { T } from "../design-tokens.js";
import { Badge, Label } from "../primitives/atoms.jsx";
import SectionHeader from "../primitives/SectionHeader.jsx";
import SourceBox, { DataModeBadge } from "../primitives/SourceBox.jsx";
import { ILLUS_HATCH, IllustrativeChip, isIllustrative } from "../primitives/Illustrative.jsx";
import { SAHM_TRIGGER } from "../sahm.js";

const MacroRegime=({d,modeOf,asOfOf,fomcDays})=>{
  if(!d||typeof modeOf!=="function")return <div aria-hidden="true"/>;
  return(
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"14px 16px"}}>
              <SectionHeader>Macro Regime</SectionHeader>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {/* Fed */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
                  <div>
                    <Label>Fed Funds Rate</Label>
                    <div style={{fontFamily:T.fontMono,fontSize:22,color:T.amber,fontWeight:700}}>{d.macro.fedFunds.rate}%</div>
                    <div style={{fontFamily:T.fontMono,fontSize:9,color:fomcDays===0?T.amber:T.textMuted}}>{fomcDays==null?"Next FOMC — awaiting schedule":fomcDays===0?"FOMC decision today":`Next FOMC in ${fomcDays} day${fomcDays===1?"":"s"}`}</div>
                    {/* Next-FOMC decision odds (Kalshi prediction market) */}
                    <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap",alignItems:"baseline"}}>
                      <span style={{fontFamily:T.fontMono,fontSize:7,color:T.textMuted,letterSpacing:"0.08em"}}>NEXT-MTG</span>
                      <span style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>Hold {d.macro.fedFunds.odds.hold}%</span>
                      <span style={{fontFamily:T.fontMono,fontSize:9,color:T.green}}>Cut {d.macro.fedFunds.odds.cut}%</span>
                      <span style={{fontFamily:T.fontMono,fontSize:9,color:T.red}}>Hike {d.macro.fedFunds.odds.hike}%</span>
                      <span style={{fontFamily:T.fontMono,fontSize:7,color:T.textMuted,border:`1px dashed ${T.border}`,borderRadius:2,padding:"0 3px"}}>Kalshi · {modeOf('rateOddsHold').toLowerCase()}</span>
                    </div>
                  </div>
                  <SourceBox api="FRED" endpoint="FEDFUNDS · odds: Kalshi" mode={modeOf('fedFunds')} asOf={asOfOf('fedFunds')}/>
                </div>
                {/* CPI */}
                <div style={{paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
                  <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,marginBottom:4,letterSpacing:"0.1em"}}>INFLATION · FED TARGETS CORE PCE</div>
                  <div style={{display:"flex",gap:14,marginBottom:5,flexWrap:"wrap"}}>
                    <div><Label>PCE Core</Label><div style={{fontFamily:T.fontMono,fontSize:18,color:d.macro.pce.core>2.5?T.yellow:T.green,fontWeight:700}}>{d.macro.pce.core}%</div></div>
                    <div><Label>PCE Head</Label><div style={{fontFamily:T.fontMono,fontSize:16,color:T.textSecondary,fontWeight:700}}>{d.macro.pce.headline}%</div></div>
                    <div><Label>CPI Head</Label><div style={{fontFamily:T.fontMono,fontSize:16,color:T.textSecondary,fontWeight:700}}>{d.macro.cpi.headline}%</div></div>
                    <div><Label>CPI Core</Label><div style={{fontFamily:T.fontMono,fontSize:16,color:T.textSecondary,fontWeight:700}}>{d.macro.cpi.core}%</div></div>
                  </div>
                  <div style={{height:36}}><ResponsiveContainer width="100%" height="100%"><LineChart data={d.macro.cpi.trend.map((v,i)=>({v,i}))}><Line type="monotone" dataKey="v" stroke={T.red} dot={false} strokeWidth={1.5}/><ReferenceLine y={2.0} stroke={T.green} strokeDasharray="3 2" strokeWidth={1}/></LineChart></ResponsiveContainer></div>
                  <SourceBox api="FRED" endpoint="CPIAUCSL + CPILFESL" mode={modeOf('cpiHeadline')}/>
                </div>
                {/* Labor + household savings (+ Sahm, v3.84 — wraps at phone widths: five
                    cells no longer fit one 320px row, and an overflowing row is a suite red) */}
                <div style={{display:"flex",gap:12,paddingBottom:8,borderBottom:`1px solid ${T.border}`,alignItems:"flex-start",flexWrap:"wrap"}}>
                  <div><Label>Unemployment</Label><div style={{fontFamily:T.fontMono,fontSize:16,color:T.textPrimary,fontWeight:700}}>{d.macro.unemployment.national}%</div></div>
                  <div><Label>Entry Level</Label><div style={{fontFamily:T.fontMono,fontSize:16,color:T.yellow,fontWeight:700}}>{d.macro.unemployment.entryLevel}%</div></div>
                  <div><Label>LFPR</Label><div style={{fontFamily:T.fontMono,fontSize:16,color:T.textPrimary,fontWeight:700}}>{d.macro.unemployment.lfpr}%</div></div>
                  <div title="Personal Saving Rate — % of disposable income households save (FRED PSAVERT). Lower = thinner consumer cushion.">
                    <Label>Savings Rate</Label>
                    <div style={{fontFamily:T.fontMono,fontSize:16,color:d.macro.savings.rate<4?T.yellow:T.textPrimary,fontWeight:700}}>{d.macro.savings.rate}%</div>
                    <SourceBox api="FRED" endpoint="PSAVERT" mode={modeOf('savings')} asOf={asOfOf('savings')}/>
                  </div>
                  {/* FEAT-SAHM (v3.84): 3-mo avg U-3 minus its trailing-12-mo min; >= 0.50
                      ("0.50 or more" — Sahm's own definition, so the comparison is >=) has
                      marked every US recession start since 1970. TRIGGERED/CLEAR is a
                      directional call → suppressed on mock/stale (the CAPE/NFCI pattern).
                      Computed from the same UNRATE pull (src/sahm.js) — can differ ±0.01
                      from FRED's SAHMREALTIME (rounding/vintage). NON-VOTING on arrival. */}
                  {(()=>{const sMode=modeOf('sahm'); const sIllus=isIllustrative(sMode);
                    const sv=d.macro.unemployment.sahm; const trig=sv>=SAHM_TRIGGER; return (
                  <div title="Sahm rule: 3-month average unemployment minus its 12-month low. 0.50pp or more = recession signal (every US recession since 1970, no real-time false positives)."
                       style={{backgroundImage:sIllus?ILLUS_HATCH:undefined,borderRadius:5,padding:sIllus?"2px 6px":0,opacity:sIllus?0.92:1}}>
                    <Label>Sahm Rule</Label>
                    <div style={{fontFamily:T.fontMono,fontSize:16,color:sIllus?T.textSecondary:trig?T.red:T.green,fontWeight:700}}>
                      {sv>=0?"+":""}{sv.toFixed(2)}<span style={{fontSize:10}}>pp</span>
                    </div>
                    {sIllus?(sMode==="STALE"?<DataModeBadge mode="STALE"/>:<IllustrativeChip/>)
                           :<Badge label={trig?"TRIGGERED":`CLEAR · ${(SAHM_TRIGGER-sv).toFixed(2)} to trigger`} color={trig?T.red:T.green} small/>}
                    <SourceBox api="FRED" endpoint="UNRATE → Sahm (computed)" mode={sMode} asOf={asOfOf('sahm')}/>
                  </div>
                  );})()}
                </div>
                {/* Housing */}
                <div style={{display:"flex",gap:12,paddingBottom:8,borderBottom:`1px solid ${T.border}`}}>
                  <div><Label>30Y Mortgage</Label><div style={{fontFamily:T.fontMono,fontSize:16,color:T.red,fontWeight:700}}>{d.macro.mortgage.national}%</div></div>
                  <div><Label>Peoria IL</Label><div style={{fontFamily:T.fontMono,fontSize:14,color:T.yellow,fontWeight:700}}>{d.macro.mortgage.peoria}%</div><div style={{fontFamily:T.fontMono,fontSize:9,color:T.textMuted}}>${d.macro.housing.peoria.toLocaleString()}</div></div>
                </div>
                {/* Shiller PE — v3.1: live (multpl); suppress BUBBLE/ELEVATED verdict + red on mock/stale */}
                {(()=>{const shMode=modeOf('shillerPe'); const shIllus=isIllustrative(shMode);
                  const shPctAth=(d.macro.shillerPe.ath?(d.macro.shillerPe.current/d.macro.shillerPe.ath)*100:d.macro.shillerPe.pctOfAth).toFixed(1); return (
                <div style={{backgroundImage:shIllus?ILLUS_HATCH:undefined,borderRadius:5,padding:shIllus?"6px 8px":0,opacity:shIllus?0.92:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:6,flexWrap:"wrap"}}>
                    <Label>Shiller P/E (CAPE)</Label>
                    {shIllus?(shMode==="STALE"?<DataModeBadge mode="STALE"/>:<IllustrativeChip/>):<Badge label={d.macro.shillerPe.current>40?"BUBBLE":"ELEVATED"} color={d.macro.shillerPe.current>40?"#7f1d1d":T.red} small/>}
                  </div>
                  <div style={{fontFamily:T.fontMono,fontSize:22,color:shIllus?T.textSecondary:"#ef4444",fontWeight:700}}>{d.macro.shillerPe.current}</div>
                  <div style={{display:"flex",gap:12,marginTop:2}}>
                    <div style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted}}>Mean {d.macro.shillerPe.mean} · Median {d.macro.shillerPe.median}</div>
                    <div style={{fontFamily:T.fontMono,fontSize:8,color:shIllus?T.textMuted:T.red}}>{shPctAth}% of ATH</div>
                  </div>
                  <SourceBox api="multpl.com" endpoint="Shiller CAPE (scraped, monthly cadence) · Yale/Shiller series" mode={shMode} asOf={asOfOf('shillerPe')}/>
                </div>
                );})()}
              </div>
            </div>
  );
};
export default MacroRegime;
