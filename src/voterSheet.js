// Shared presentation of existing evidence. No votes or thresholds are calculated here.
import { REGIME_BAND_TABLE } from "./regime.js";
import { cpiPeriodLine } from "./publicCopy.js";
const finite=Number.isFinite;
// v7.1.5: `asOf` is optional and used by CPI alone — the reported PERIOD, in words, so the
// one bullet that states the current reading says WHICH MONTH it is the reading for. Callers
// that omit it render byte-identically to v7.0.3.
export function comparisonReading(key,d,metric,asOf=null) {
  if(!finite(metric?.value))return null;
  let current=metric.text, context="";
  if(key==="tenYear")current=`${metric.context ? metric.context+" yield; " : ""}1-month change ${metric.value>0?"+":""}${metric.value.toFixed(2)} percentage points`;
  if(key==="cpiHeadline"){
    const xs=d?.macro?.cpi?.trend;
    if(!Array.isArray(xs)||xs.length<2||!xs.every(finite))return null;
    const period=cpiPeriodLine(asOf);
    current=`${metric.value.toFixed(1)}% YoY${period?` (${period})`:""}`;
    context=`Previous print: ${xs[xs.length-2].toFixed(1)}% YoY; trend-window start: ${xs[0].toFixed(1)}% YoY (${xs.length} observations). `;
  }
  return {current,context};
}
export function voterSheet(f) {
  if(!f?.explain?.what)return f?.explain;
  const band=REGIME_BAND_TABLE.find(b=>b.key===f.key);
  if(!band)return f.explain;
  const available=f.available&&["LIVE","CACHED"].includes(f.mode)&&Boolean(f.asOf)&&Boolean(f.comparison?.current);
  const current=available?`Latest reported: ${f.comparison.current}`:"Current reading unavailable — not counted in this comparison.";
  // v7.0.3: the gate asterisk sits immediately AFTER the backdrop ruler it qualifies, so the
  // reference and its caveat are read together. Optional and currently carried by F&G alone —
  // a band without one renders byte-identically to v7.0.1.
  const reference=`${available?f.comparison.context:""}Model reference: ${band.ruler}.${band.gateAsterisk?` ${band.gateAsterisk}`:""}`;
  const result=available?({bull:"Supports stocks.",bear:"Signals caution.",neutral:"No clear signal."}[f.vote||({helping:"bull",hurting:"bear",mixed:"neutral"}[f.direction])]||""):"No current reading is shown.";
  const stamp=available?`${f.mode} · observation date ${f.asOf}`:`${f.mode||"Unavailable"} · ${f.reason||"No current, verified input"}`;
  const comparison={current,reference,result,stamp,available};
  return {...f.explain,what:[f.explain.what[0],`${current}. ${stamp}. ${reference} ${result}`,f.explain.what[2]],
    currentComparison:comparison,metadata:f.conditionDetail||null};
}
