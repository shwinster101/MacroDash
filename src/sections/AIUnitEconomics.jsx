// ─── AI UNIT ECONOMICS (UI-OVERHAUL wave 12, task 7.1) ──────────────────────
// Extracted VERBATIM from dashboard.jsx: the v3.0 differentiator — cost (GPU $/hr)
// ↔ price (token $/Mtok, live OpenRouter) ↔ conversion (tokens/watt) ↔ funding
// (hyperscaler capex). Curated legs stay ILLUSTRATIVE + hatched + collapsed and
// NEVER vote (the v3.1 invariant). Data + scissors math live in src/aiEcon.js.
// PRESENTATION ONLY; the only addition is the Property-9 null guard.
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { T } from "../design-tokens.js";
import { GPU_PRICING, TOKEN_EFFICIENCY, tokenScissors, HYPERSCALER_CAPEX } from "../aiEcon.js";
import SectionHeader from "../primitives/SectionHeader.jsx";
import SourceBox from "../primitives/SourceBox.jsx";
import { ILLUS_HATCH, IllustrativeChip, isIllustrative } from "../primitives/Illustrative.jsx";
import CollapsedGroup from "../primitives/CollapsedGroup.jsx";

const HyperscalerCapexCard = () => {
  const cx = HYPERSCALER_CAPEX;
  const agg = cx.rows.reduce((a, r) => a + r.guideB, 0);
  const downs = cx.rows.filter(r => r.dir === "down").length;
  // FEAT-CAPEX-OCF (v3.83): capex/OCF inline — the `downs >= 2` mirror precedent. >1 = the
  // buildout outruns operations (debt-funded); unmeasured (no ocfB) never counts, never a 0.
  const ratio = (r) => (Number.isFinite(r.ocfB) && r.ocfB > 0) ? r.guideB / r.ocfB : null;
  const overOcf = cx.rows.filter(r => ratio(r) !== null && ratio(r) > 1).length;
  const ocfMeasured = cx.rows.filter(r => ratio(r) !== null).length;
  const glyph = (d) => d === "down" ? "▼" : d === "up" ? "▲" : "→";
  const gcol  = (d) => d === "down" ? T.red : d === "up" ? T.green : T.textMuted;
  return (
    <div style={{ marginTop:16, background:T.surface, backgroundImage:ILLUS_HATCH, border:`1px solid ${T.border}`, borderRadius:6, padding:"12px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:6 }}>
        <SectionHeader>AI Infra · Hyperscaler CapEx (funding flow)</SectionHeader>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>{cx.fy} guides · reviewed {cx.reviewed}</span>
          <IllustrativeChip/>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:10, margin:"8px 0 2px", flexWrap:"wrap" }}>
        <span style={{ fontFamily:T.fontMono, fontSize:22, fontWeight:700, color:T.textPrimary }}>${agg}B</span>
        <span style={{ fontFamily:T.fontMono, fontSize:9, color:downs >= 2 ? T.red : T.textMuted }}>
          {downs >= 2 ? `⚡ ${downs} of ${cx.rows.length} guiding DOWN — the regime-turn tell` : `${downs} of ${cx.rows.length} guiding down`}
        </span>
        {overOcf >= 2 && (
          <span style={{ fontFamily:T.fontMono, fontSize:9, color:T.yellow }}>
            ⚠ {overOcf} of {ocfMeasured} measured guide capex past trailing-4Q OCF — debt-funded buildout
          </span>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:8, marginTop:8 }}>
        {cx.rows.map(r => (
          <div key={r.co} style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:5, padding:"8px 11px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
              <span style={{ fontFamily:T.fontMono, fontSize:11, fontWeight:700, color:T.textPrimary }}>{r.co}</span>
              <span style={{ fontFamily:T.fontMono, fontSize:10, color:gcol(r.dir) }}>{glyph(r.dir)}</span>
            </div>
            <div style={{ fontFamily:T.fontMono, fontSize:14, fontWeight:700, color:T.textSecondary }}>${r.guideB}B</div>
            <div style={{ fontFamily:T.fontMono, fontSize:9, color:ratio(r) !== null ? (ratio(r) > 1 ? T.yellow : T.textMuted) : T.textMuted }}>
              {ratio(r) !== null ? `capex/OCF ${ratio(r).toFixed(2)}` : "OCF unmeasured"}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily:T.fontSans, fontSize:10, color:T.textSecondary, lineHeight:1.4, marginTop:8 }}>{cx.note}</div>
      <SourceBox api="Manual" endpoint="earnings prints · curated per quarter" mode="MOCK"/>
    </div>
  );
};

const GpuPricingCard = () => {
  const g = GPU_PRICING;
  const qoq = (c) => parseFloat((((c.onDemand - c.prevQ) / c.prevQ) * 100).toFixed(1));
  return (
    <div style={{ marginTop:16, background:T.surface, backgroundImage:ILLUS_HATCH, border:`1px solid ${T.border}`, borderRadius:6, padding:"12px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:6 }}>
        <SectionHeader>AI Infra · GPU On-Demand $/hr</SectionHeader>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>{g.quarter} · curated quarterly</span>
          <IllustrativeChip/>
        </div>
      </div>
      <div style={{ fontFamily:T.fontSans, fontSize:10, color:T.textSecondary, lineHeight:1.4, margin:"6px 0 10px" }}>{g.note}</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8 }}>
        {g.chips.map(c => {
          const dq = qoq(c);
          const col = dq < -2 ? T.amber : dq > 2 ? T.green : T.textMuted;
          return (
            <div key={c.name} style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:5, padding:"9px 11px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                <span style={{ fontFamily:T.fontMono, fontSize:12, fontWeight:700, color:T.textPrimary }}>{c.name}</span>
                <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>NVIDIA</span>
              </div>
              <div style={{ fontFamily:T.fontMono, fontSize:18, fontWeight:700, color:T.textPrimary, marginTop:2 }}>${c.onDemand.toFixed(2)}</div>
              <div style={{ fontFamily:T.fontMono, fontSize:9, color:col }}>{dq>0?"▲":dq<0?"▼":"▬"} {Math.abs(dq).toFixed(1)}% QoQ</div>
            </div>
          );
        })}
      </div>
      <div style={{ height:30, marginTop:10 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={g.trend.map((v,i)=>({v,i}))}>
            <Line type="monotone" dataKey="v" stroke={T.amber} dot={false} strokeWidth={1.5}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <SourceBox api="Manual" endpoint="GPU list/on-demand · curated quarterly" mode="MOCK"/>
    </div>
  );
};

// AI UNIT ECONOMICS · LLM token pricing (the moat — price side, pairs with GPU $/hr cost side).
// Live from OpenRouter (props.tok = d.tokenomics; mode/asOf from provenance). Falling $/Mtok is the
// bearish read (intelligence commoditizing → pricing-power erosion), colored amber like the GPU card.
const TokenomicsCard = ({ tok, mode = "MOCK", asOf }) => {
  let models = [];
  try { models = JSON.parse(tok?.modelsJson || "[]"); } catch { models = []; }
  const trend = Array.isArray(tok?.trend) ? tok.trend : [];
  const blended = tok?.blendedMtok;
  // QoQ-style read off the trend: first vs last (the decline is the signal).
  const drop = trend.length >= 2 ? Math.round((1 - trend[trend.length - 1] / trend[0]) * 100) : null;
  const cheapest = models.length ? models.reduce((a, b) => (b.mtok < a.mtok ? b : a)) : null;
  return (
    <div style={{ marginTop:16, background:T.surface, border:`1px solid ${T.border}`, borderRadius:6, padding:"12px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:6 }}>
        <SectionHeader>AI Infra · LLM Token Price $/Mtok</SectionHeader>
        <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>price side of AI unit economics · pairs with GPU $/hr</span>
      </div>
      <div style={{ fontFamily:T.fontSans, fontSize:10, color:T.textSecondary, lineHeight:1.4, margin:"6px 0 10px" }}>
        Falling $/Mtok = intelligence commoditizing → AI pricing-power erosion. The demand-side mirror of the GPU $/hr supply squeeze — together, the AI margin-compression hinge.
      </div>
      <div style={{ display:"flex", gap:18, alignItems:"baseline", flexWrap:"wrap" }}>
        <div>
          <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>BLENDED FRONTIER · 3:1 in:out</div>
          <div style={{ fontFamily:T.fontMono, fontSize:24, fontWeight:700, color:T.textPrimary }}>${blended?.toFixed(2)}<span style={{ fontSize:11, color:T.textMuted }}>/Mtok</span></div>
        </div>
        {drop !== null && <div style={{ fontFamily:T.fontMono, fontSize:11, color:T.amber }}>▼ {drop}% over window</div>}
        {cheapest && <div style={{ fontFamily:T.fontMono, fontSize:9, color:T.textMuted }}>floor: {cheapest.name} ${cheapest.mtok}/Mtok</div>}
      </div>
      {models.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:8, marginTop:10 }}>
          {models.map((m) => (
            <div key={m.name} style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:5, padding:"8px 10px" }}>
              <div style={{ fontFamily:T.fontMono, fontSize:10, fontWeight:700, color:T.textPrimary }}>{m.name}</div>
              <div style={{ fontFamily:T.fontMono, fontSize:15, fontWeight:700, color:T.textPrimary, marginTop:2 }}>${Number(m.mtok).toFixed(2)}</div>
              <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>$/Mtok</div>
            </div>
          ))}
        </div>
      )}
      {trend.length >= 3 ? (
        <div style={{ height:30, marginTop:10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend.map((v, i) => ({ v, i }))}>
              <Line type="monotone" dataKey="v" stroke={T.amber} dot={false} strokeWidth={1.5}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        mode !== "MOCK" && <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted, marginTop:8 }}>trend accruing ({trend.length} pt{trend.length === 1 ? "" : "s"}) — builds daily</div>
      )}
      <SourceBox api="OpenRouter" endpoint="api/v1/models · frontier basket · blended $/Mtok" mode={mode} asOf={asOf}/>
    </div>
  );
};

// FEAT-TOKW (v3.46): the CONVERSION leg — tokens/watt × $/token = revenue per MW (in RATES only;
// see the TOKEN_EFFICIENCY comment for why no level is printable). Half live (the $/Mtok window
// from OpenRouter), half curated (the efficiency index), so the card is ILLUSTRATIVE always and
// NEVER votes. The band is withheld on mock/stale price data AND on a window shorter than
// minWeeks — "too short to read" and "flat" are different facts.
const TokenEfficiencyCard = ({ tok, mode = "MOCK" }) => {
  const e = TOKEN_EFFICIENCY;
  const s = tokenScissors(Array.isArray(tok?.trend) ? tok.trend : []);
  const pct = (v) => v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
  // A directional read off mock/stale price data is exactly what the v3.1 invariant forbids.
  const band = isIllustrative(mode) ? null : s.band;
  const bcol = band === "COMPRESSING" ? T.red : band === "EXPANDING" ? T.green : T.textMuted;
  const win = s.weeks ? `${s.weeks}-week window` : "no price window";
  return (
    <div style={{ marginTop:16, background:T.surface, backgroundImage:ILLUS_HATCH, border:`1px solid ${T.border}`, borderRadius:6, padding:"12px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:6 }}>
        <SectionHeader>AI Infra · Tokens/Watt × $/Token (revenue per MW)</SectionHeader>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>efficiency index reviewed {e.reviewed}</span>
          <IllustrativeChip/>
        </div>
      </div>
      <div style={{ fontFamily:T.fontSans, fontSize:10, color:T.textSecondary, lineHeight:1.4, margin:"6px 0 10px" }}>{e.note}</div>
      <div style={{ display:"flex", gap:18, alignItems:"baseline", flexWrap:"wrap" }}>
        <div>
          <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>SCISSORS · {win}</div>
          <div style={{ fontFamily:T.fontMono, fontSize:24, fontWeight:700, color: band ? bcol : T.textPrimary }}>
            {s.idx === null ? "—" : pct(s.idx)}
          </div>
        </div>
        {band
          ? <span style={{ fontFamily:T.fontMono, fontSize:11, color:bcol }}>{band === "COMPRESSING" ? "▼" : band === "EXPANDING" ? "▲" : "▬"} {band}</span>
          : <span style={{ fontFamily:T.fontMono, fontSize:9, color:T.textMuted }}>
              {s.short ? `window too short to read (<${e.minWeeks}w) — no verdict` : "verdict suppressed — price leg not live"}
            </span>}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8, marginTop:10 }}>
        <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:5, padding:"8px 11px" }}>
          <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>EFFICIENCY (curated)</div>
          <div style={{ fontFamily:T.fontMono, fontSize:15, fontWeight:700, color:T.green }}>{pct(s.effWin)}</div>
          <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>{pct(s.effCagr)}/yr projected onto the window</div>
        </div>
        <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:5, padding:"8px 11px" }}>
          <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>TOKEN PRICE ({mode === "MOCK" ? "mock" : "observed"})</div>
          <div style={{ fontFamily:T.fontMono, fontSize:15, fontWeight:700, color:T.amber }}>{pct(s.pxWin)}</div>
          <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted }}>never annualised — the window as measured</div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))", gap:8, marginTop:8 }}>
        {e.gens.map(g => (
          <div key={g.gen} style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:5, padding:"7px 10px" }}>
            <div style={{ fontFamily:T.fontMono, fontSize:10, fontWeight:700, color:T.textPrimary }}>{g.gen}</div>
            <div style={{ fontFamily:T.fontMono, fontSize:13, fontWeight:700, color:T.textSecondary }}>{g.idx.toFixed(2)}×</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.textMuted, marginTop:8, lineHeight:1.5 }}>
        {e.basis} · relative only — no $/MW figure is derivable from public data and none is shown.
      </div>
      <SourceBox api="Manual" endpoint="chip-generation tokens/W index × live OpenRouter $/Mtok" mode="MOCK"/>
    </div>
  );
};

const AIUnitEconomics=({d,modeOf,asOfOf})=>{
  if(!d||typeof modeOf!=="function")return <div aria-hidden="true"/>;
  return(
      <div style={{padding:"0 20px"}}>
        <h2 id="ai" className="visually-hidden">AI unit economics — cost, price, conversion and funding</h2>
        {/* ── AI UNIT ECONOMICS · cost side (GPU $/hr) + price side (token $/Mtok) ── */}
        <div style={{marginTop:16,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontFamily:T.fontMono,fontSize:10,color:"#a78bfa",letterSpacing:"0.14em",whiteSpace:"nowrap"}}>◆ AI UNIT ECONOMICS</span>
          {/* v3.53: `whiteSpace:"nowrap"` on a 317px string blew the PAGE out to 488px at 390px
              wide — found by the flip-conditions browser check, pre-existing since v3.46. The
              label is a subtitle; it wraps. */}
          <span style={{fontFamily:T.fontMono,fontSize:8,color:T.textMuted,minWidth:0}}>cost ↔ price ↔ conversion ↔ funding · the margin-compression hinge</span>
          <div style={{height:1,flex:1,background:T.border}}/>
        </div>
        {/* FEAT-322: the live price side (OpenRouter) leads; the curated GPU cost side is
            one tap away — always-curated content doesn't own the default view. */}
        <TokenomicsCard tok={d.tokenomics} mode={modeOf('tokenBlendedMtok')} asOf={asOfOf('tokenBlendedMtok')}/>
        <CollapsedGroup count={1} label="curated: GPU $/hr cost side">
          <GpuPricingCard />
        </CollapsedGroup>
        {/* FEAT-TOKW (v3.46): the conversion leg — what a fixed MW of power converts into. */}
        <CollapsedGroup count={1} label="curated: tokens/watt × $/token conversion">
          <TokenEfficiencyCard tok={d.tokenomics} mode={modeOf('tokenBlendedMtok')} />
        </CollapsedGroup>
        {/* FEAT-CAPEX (v3.45): the third leg — the capex pool that funds both sides above. */}
        <CollapsedGroup count={1} label="curated: hyperscaler capex funding flow">
          <HyperscalerCapexCard />
        </CollapsedGroup>
      </div>
  );
};
export default AIUnitEconomics;
