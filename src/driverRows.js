// Pure display projection. Crossings come ONLY from EvidenceSet.flips.
export function driverRows(evidenceSet) {
  return (evidenceSet?.factors||[]).map(f=>{
    const available=!f.excluded&&["LIVE","CACHED"].includes(f.mode)&&Boolean(f.asOf)&&Number.isFinite(f.metric?.value)&&!["LOADING","ERROR"].includes(evidenceSet.state);
    const crossings=available&&!evidenceSet.withheld?(evidenceSet.flips?.flips||[]).filter(c=>c.key===f.key):[];
    const compound=(evidenceSet.flips?.abstained||[]).find(c=>c.key===f.key);
    const reason=f.reason||(!f.asOf?"no dated reading":"no current live reading");
    return {...f,available,reason,
      conditionDetail:available&&!evidenceSet.withheld&&compound?compound.why:null,
      reading:available?f.metric.text:"Current reading unavailable",
      stance:available?({bull:"Bullish",bear:"Bearish",neutral:"Neutral"}[f.vote]||"Not counted"):"Not counted",
      condition:!available?"Unavailable — no threshold shown":evidenceSet.withheld?"Posture withheld — no flip calculated":
        crossings.length?crossings.map(c=>`${c.copy} → ${c.would} (${c.distance.toFixed(c.dec)}${c.unit} away)`).join("; "):
        compound?"Compound rule · see details":"No solo flip",
    };
  });
}
