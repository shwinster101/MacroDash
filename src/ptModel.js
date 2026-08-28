// src/ptModel.js — MacroDash v3.73 (TT-SCORE commit 1)
// PURE, React-free, token-free, Node-importable — the same convention as sources.js,
// ttReadout.js, regime.js and evidence.js.
//
// THE PT-MODEL CHAIN, extracted so the server can run it. Every function body below is
// BYTE-IDENTICAL to its copy in public/admin.html (which is buildless and cannot import,
// so it keeps its own copies) — smoke section [49] lifts the admin.html source and asserts
// identity against these exports, so the two copies cannot drift silently (the tripwire
// pattern functions/readout.json.js's header names as the inlining fallback).
//
// Consumers:
//   1. public/admin.html        — byte-identical inline copies (the originals)
//   2. src/ttScore.js           — P1 Owner Valuation consumes ptModelRows/pickRow/lintPtModel
//   3. functions/api/score.js   — via ttScore.js (esbuild-inlined at the edge)
//   4. test/smoke.mjs           — direct import (real execution) + the [49] identity tripwire
//
// Clock injection: the only impurity these functions ever had was reading the clock
// (new Date() for the ET year, Date.now() for year-fractions). Each now takes an OPTIONAL
// trailing clock argument (_y0 = ET year "YYYY", _now = epoch ms) — absent, behavior is
// exactly as before. The server passes its scoring ET date; tests pass fixed instants
// (the v3.39 Q4-cliff proof needs a December clock no July run can supply).
//
// ⚠ This chain gates real orders (P1 of the TT Underwriting Score reads it, and the
// terminal's next-dollar ranking already did). Behavior changes require the DEC process.

const LENS_MAX_PE=100;
const ANN_MIN_Y=0.25;      // under ~3 months, annualising amplifies noise into absurdity

function schedAt(s,y){
  if(typeof s==="number")return s;
  if(!s||typeof s!=="object")return null;
  if(s[y]!=null)return +s[y];
  let best=null;Object.keys(s).sort().forEach(k=>{if(k<=y)best=+s[k];});
  return best;
}
function ptModelRows(dd,_y0){
  const m=dd&&dd.pt_model;
  if(!m||typeof m!=="object")return [];
  const c=dd.consensus||{};
  const rev={...(c.revenue_B||{}),...(m.revenue_B||{})},eps={...(c.eps||{}),...(m.eps||{})};
  const pe=+m.pe_floor_multiple||null;
  const y0=_y0||new Date().toLocaleDateString("en-CA",{timeZone:"America/New_York"}).slice(0,4);
  const fmt=v=>v>=100?Math.round(v):Math.round(v*100)/100;
  const years=[...new Set([...Object.keys(rev),...Object.keys(eps)].map(y=>String(+y-1)))]
    .filter(y=>y>=y0).sort();
  return years.map(y=>{
    const fwd=String(+y+1);
    const mult=schedAt(m.ev_s_multiple,y),sh=schedAt(m.share_count_M,y),nc=schedAt(m.net_cash_B,y);
    const e=eps[fwd];
    // Two lenses, chosen per name. The EV/S premium was built for pre-profit compounders
    // (NBIS/JOBY); forcing it onto an already-profitable name (UBER at ~18x trailing)
    // prices the wrong thing. pe_premium_multiple opts a name into the earnings lens —
    // absent, behavior is exactly as before, so existing payloads are untouched.
    const pePrem=schedAt(m.pe_premium_multiple,y);
    const earnLens=pePrem>0&&typeof e==="number"&&e>0;
    const prem=earnLens?fmt(pePrem*e)
      :(mult>0&&sh>0&&rev[fwd]!=null&&typeof nc==="number"&&isFinite(nc))?fmt((mult*rev[fwd]+nc)*1000/sh):null;
    const fl=(pe>0&&typeof e==="number")?(e>0?fmt(pe*e):"n/m"):null;
    // v3.33 FEAT-TT-SPREAD: carry the raw inputs a row was built from (sh/nc/revFwd/epsFwd)
    // alongside the computed prem/fl. Nothing downstream of ptModelRows breaks — these are
    // additive fields — but impliedMultiple() can now invert the SAME numbers the ladder
    // used, so a spread can never quote a multiple the row above it would disagree with.
    return {y,prem,fl,mult:earnLens?pePrem:mult,lens:earnLens?"P/E":"EV/S",
      sh,nc,revFwd:rev[fwd],epsFwd:e,pe};
  }).filter(r=>r.prem!==null||r.fl!==null);
}
function ptRowYears(dd,_y0){
  const m=(dd&&dd.pt_model)||{},c=(dd&&dd.consensus)||{};
  const rev={...(c.revenue_B||{}),...(m.revenue_B||{})},eps={...(c.eps||{}),...(m.eps||{})};
  const y0=_y0||new Date().toLocaleDateString("en-CA",{timeZone:"America/New_York"}).slice(0,4);
  return [...new Set([...Object.keys(rev),...Object.keys(eps)].map(y=>String(+y-1)))]
    .filter(y=>y>=y0).sort();
}
function lintPtModel(dd,_y0){
  const out=[],m=dd&&dd.pt_model;
  if(!m||typeof m!=="object")return out;
  const c=(dd&&dd.consensus)||{};
  const rev={...(c.revenue_B||{}),...(m.revenue_B||{})},eps={...(c.eps||{}),...(m.eps||{})};
  const years=ptRowYears(dd,_y0);
  /* E2E (v3.57): a payload whose numbers are QUOTED ("100" not 100) produces zero rows, and
     NOFLOOR then reports the inputs as missing when they are present — the message sends you
     looking for the wrong defect. Name the actual one. Hand-edited JSON does this constantly. */
  const strNum=[];
  const scanNums=(o,path)=>{ if(!o||typeof o!=="object")return;
    Object.entries(o).forEach(([k,v])=>{
      if(v&&typeof v==="object")return scanNums(v,`${path}.${k}`);
      if(typeof v==="string"&&v.trim()!==""&&isFinite(Number(v)))strNum.push(`${path}.${k}`);
    });};
  ["ev_s_multiple","pe_premium_multiple","pe_floor_multiple","share_count_M","net_cash_B"]
    .forEach(k=>{ if(m[k]!==undefined)scanNums({[k]:m[k]},"pt_model"); });
  ["revenue_B","eps"].forEach(k=>{ if(c[k]!==undefined)scanNums({[k]:c[k]},"consensus"); });
  if(strNum.length)out.push({sev:"error",code:"TYPES",
    msg:`${strNum.length} numeric field(s) are stored as STRINGS, so no rung computes: ${strNum.slice(0,4).join(", ")}${strNum.length>4?` +${strNum.length-4}`:""}. Remove the quotes — "100" is not 100.`});
  if(!years.length)return out;   // no future rows at all — ddEstRunSec already says UNRANKED
  const first=years[0],fwd=String(+first+1),e=eps[fwd];
  const fob=String(m.floor_only_before||"");
  [["pe_premium_multiple",m.pe_premium_multiple],["ev_s_multiple",m.ev_s_multiple]].forEach(([name,s])=>{
    if(!s||typeof s!=="object")return;   // a bare number covers every row — no key to mis-place
    const keys=Object.keys(s).sort();
    if(!keys.length)return;
    if(schedAt(s,first)===null&&!(fob&&first<fob))
      out.push({sev:"error",code:"MISKEY",
        msg:`${name} keys start at ${keys[0]} but the first row prices year-end ${first} — schedule keys are the YEAR-END PRICED, not the estimate year (row ${first} uses FY${fwd} estimates). As written row ${first} silently falls through to the floor. Re-key to ${first}, or set floor_only_before:"${keys[0]}" if the early rungs are meant to be floor-only.`});
    // ORPHAN = a key schedAt would NEVER select for any row. Note a key BELOW the row range is
    // not automatically dead — it may be the backward match every row resolves to (a deliberate
    // flat schedule). So compute the selected set and diff. Keys ABOVE the last row are excluded
    // on purpose: a schedule reaching past the estimate series is not a defect, it is the reason
    // the auto-horizon stops where it does.
    const last=years[years.length-1];
    const used=new Set(years.map(y=>{let b=null;keys.forEach(k=>{if(k<=y)b=k;});return b;}));
    keys.filter(k=>k<=last&&!used.has(k)).forEach(k=>out.push({sev:"warn",code:"ORPHAN",
      msg:`${name} key ${k} is never used — every row (${years.join(", ")}) resolves to a later key, so this one is a leftover`}));
  });
  const netCashYears=years.filter(y=>{
    const fwd=String(+y+1),mult=schedAt(m.ev_s_multiple,y),sh=schedAt(m.share_count_M,y);
    const pePrem=schedAt(m.pe_premium_multiple,y),earnLens=pePrem>0&&typeof eps[fwd]==="number"&&eps[fwd]>0;
    const nc=schedAt(m.net_cash_B,y),declaredFloorOnly=fob&&y<fob;
    return !earnLens&&!declaredFloorOnly&&mult>0&&sh>0&&typeof rev[fwd]==="number"&&!(typeof nc==="number"&&isFinite(nc));
  });
  if(netCashYears.length)out.push({sev:"warn",code:"NETCASH",
    msg:`premium withheld: net cash is unmeasured for ${netCashYears.join(", ")} — the visible row uses its floor, not the configured EV/S premium. Enter the measured value, explicit 0, or declare the period floor-only.`});
  // Lens doctrine (the TSM/UBER rule): a sales multiple prices the wrong thing for a name that
  // already earns. WARN only — which lens fits is the owner's judgement, never the lint's.
  // v3.47: "EPS > 0" is not the same as "the name earns". RKLB's FY2027 consensus EPS is 0.05,
  // which at $63.85 is a 1,277x forward P/E — a company CROSSING zero, not an earnings line the
  // lowest-representative-line rule would ever select. Firing LENS there is substantively wrong,
  // so the test is now magnitude-aware: above LENS_MAX_PE the earnings line is a crossing
  // artifact and the sales lens is correct. Needs a price, and ref_px is the only one a pure
  // function has; with none, behavior is unchanged (warn) — failing toward the warning.
  const lensPx=dd&&dd.ref_px&&typeof dd.ref_px.px==="number"?dd.ref_px.px:null;
  const nominalEps=lensPx!==null&&typeof e==="number"&&e>0&&(lensPx/e)>LENS_MAX_PE;
  if(m.ev_s_multiple!=null&&m.pe_premium_multiple==null&&typeof e==="number"&&e>0&&!nominalEps)
    out.push({sev:"warn",code:"LENS",
      msg:`modelled on ev_s_multiple while FY${fwd} EPS is ${e} (>0) — earnings-lens candidate (pe_premium_multiple), the rule that put TSM and UBER there`});
  // The mirror trap: a P/E premium that cannot engage because there is no positive EPS to
  // multiply, so the row quietly uses the sales lens or the floor instead of what was written.
  if(m.pe_premium_multiple!=null&&!(typeof e==="number"&&e>0))
    out.push({sev:"warn",code:"LENSOFF",
      msg:`pe_premium_multiple is set but FY${fwd} EPS is ${e==null?"absent":e} — the earnings lens cannot engage, so row ${first} uses the sales lens or the floor, not this multiple`});
  // NOFLOOR only when the payload does NOT already explain itself. A pt_model carrying basis/note
  // with no computable rung is the DELIBERATELY-UNRANKED case ddEstRunSec renders as "⊘ … not
  // overlooked" — calling that a defect would contradict a decision the owner already made.
  if(!ptModelRows(dd,_y0).length&&!(m.basis||m.note))
    out.push({sev:"warn",code:"NOFLOOR",
      msg:"no rung is computable and nothing here says why — a premium needs (ev_s_multiple + share_count_M + revenue) or (pe_premium_multiple + positive EPS); a floor needs pe_floor_multiple. Add basis/note if being unranked is deliberate."});
  return out;
}
function yrsToYearEnd(y,_now){
  const end=Date.parse(y+"-12-31T21:00:00Z"); // ~4pm ET on the last session of that year
  return (end-(_now!=null?_now:Date.now()))/(365.25*86400000);
}
function annualise(pct,y,_now){
  const t=yrsToYearEnd(y,_now);
  if(!(t>=ANN_MIN_Y)||pct<=-100)return null;
  return Math.round((Math.pow(1+pct/100,1/t)-1)*1000)/10;
}
function pickRow(rr,hz,_now){
  if(!rr||!rr.length)return null;
  const at=hz?rr.find(r=>r.y===hz):null;
  if(hz&&!at)return null;               // pinned year absent → excluded and counted, never substituted
  const want=at||rr[0];
  if(yrsToYearEnd(want.y,_now)>=ANN_MIN_Y)return{row:want,rolled:null};
  const next=rr.find(r=>yrsToYearEnd(r.y,_now)>=ANN_MIN_Y);
  return next?{row:next,rolled:want.y}:{row:want,rolled:null};
}

/* FEAT-TT-SUGGEST (v4.2): the street-implied multiple — an INVERT, never an invention.
   impliedMultiple() (v3.33) solves a ROW's formula backwards at the live price; this solves
   the same two formulas backwards at the STREET TARGET, picks the lens with the existing
   TSM/UBER + RKLB crossing rules, and returns a SEED the owner may confirm — it never writes.
   The v3.85 sourcing doctrine holds: the multiple is derived from a reviewed/sourced target,
   not asserted by the assistant; UNKNOWN names every missing input rather than guessing.
   The seed's floor_only_before mirrors the MU trough-anchor mechanics: a single-year key
   later than the first row year would fire MISKEY without it (schedAt looks backward). */
function suggestMultiple(dd,tgt,px,hz,_y0){
  const m=(dd&&dd.pt_model)||{};
  if(m.pe_premium_multiple!=null||m.ev_s_multiple!=null)return{state:"modelled"};
  const c=(dd&&dd.consensus)||{};
  const rev={...(c.revenue_B||{}),...(m.revenue_B||{})},eps={...(c.eps||{}),...(m.eps||{})};
  const years=ptRowYears(dd,_y0);
  if(!years.length)return{state:"unknown",unknown:["no consensus series at all — nothing to invert"]};
  const y=(hz&&years.indexOf(hz)>=0)?hz:years[0];
  const fwd=String(+y+1);
  const fob=m.floor_only_before;
  if(fob&&y<fob)return{state:"floor_by_design",y,fob};
  if(!(tgt&&isFinite(tgt.pt)&&tgt.pt>0))return{state:"unknown",y,fwd,unknown:["no street target on file"]};
  const e=eps[fwd],r=rev[fwd];
  const sh=schedAt(m.share_count_M,y),nc=schedAt(m.net_cash_B,y);
  const peOk=typeof e==="number"&&e>0;
  const crossing=peOk&&isFinite(px)&&px>0&&(px/e)>LENS_MAX_PE;
  const pe=peOk?{mult:Math.round(tgt.pt/e*10)/10,eps:e}:null;
  const evsReady=typeof r==="number"&&r>0&&isFinite(sh)&&sh>0&&typeof nc==="number"&&isFinite(nc);
  let evs=null;
  if(evsReady){
    const v=Math.round(((tgt.pt*sh/1000)-nc)/r*100)/100;
    if(v>0)evs={mult:v,rev:r,sh,nc};
  }
  const pick=(peOk&&!crossing)?"P/E":(evs?"EV/S":null);
  if(!pick){
    const why=[];
    if(!peOk)why.push("FY"+fwd+" EPS "+(e==null?"absent":e)+" — the earnings lens cannot engage");
    else if(crossing)why.push("FY"+fwd+" EPS "+e+" is a crossing artifact at ~"+Math.round(px/e)+"x — the sales lens is correct (the RKLB rule)");
    if(!evsReady){
      const miss=[];
      if(!(typeof r==="number"&&r>0))miss.push("revenue_B["+fwd+"]");
      if(!(isFinite(sh)&&sh>0))miss.push("share_count_M");
      if(!(typeof nc==="number"&&isFinite(nc)))miss.push("net_cash_B");
      why.push("EV/S invert blocked — missing "+miss.join(", "));
    }else if(!evs)why.push("EV/S invert yields a non-positive multiple — the target sits below net cash");
    return{state:"unknown",y,fwd,pe,unknown:why};
  }
  const mult=pick==="P/E"?pe.mult:evs.mult;
  return{state:"suggest",y,fwd,pick,mult,pe,evs,crossing:!!crossing,
    seed:{path:pick==="P/E"?"pe_premium_multiple":"ev_s_multiple",year:y,mult,
      floor_only_before:years[0]<y?y:null}};
}

export { schedAt, ptModelRows, ptRowYears, lintPtModel, yrsToYearEnd, annualise, pickRow,
  suggestMultiple, LENS_MAX_PE, ANN_MIN_Y };
