import {MOCK_DATA} from "../src/mockData.js";
import {mergeLiveOverMock,SOURCES,etYmd} from "../src/sources.js";
import {buildEvidenceSet,simpleSignals} from "../src/evidence.js";
import {driverRows} from "../src/driverRows.js";
import {REGIME_BAND_TABLE} from "../src/regime.js";
import {voterSheet,comparisonReading} from "../src/voterSheet.js";
export function testVoterSheets(ok){
 const now=new Date(),today=etYmd(now);
 const live={tenYear:4.94,tenYearM1:0.23,vix:15.44,fearGreed:29,cpiHeadline:3.7,cpiTrend:[3.1,3.3,3.5,3.7],shillerPe:38,nfci:-0.56};
 for(const k of Object.keys(live))live[k+"AsOf"]=today;
 function evidence(input=live,cached=false){
  const m=mergeLiveOverMock(MOCK_DATA,{live:input,cached});
  return buildEvidenceSet({d:m.data,provenance:m.provenance,dataAsOf:m.dataAsOf,mode:m.badge,liveBuild:true,now});
 }
 const ev=evidence(),simple=simpleSignals(ev).cards,degen=driverRows(ev);
 for(const [i,b] of REGIME_BAND_TABLE.entries()){
  const a=voterSheet(simple[i]),z=voterSheet(degen[i]);
  ok("7.0.1 "+b.key+": shared current-vs-reference bullet",a.what[1]===z.what[1]&&a.currentComparison.available&&a.what[1].includes(b.ruler));
  ok("7.0.1 "+b.key+": exactly three bullets preserve meaning and caveat",a.what.length===3&&a.what[0]===b.explain.what[0]&&a.what[2]===b.explain.what[2]);
  ok("7.0.1 "+b.key+": date and source mode adjacent to reading",a.currentComparison.stamp.includes(today)&&a.currentComparison.stamp.includes("LIVE"));
  for(const mode of ["STALE","MOCK","LOADING","ERROR"]){
   const s=voterSheet({...degen[i],mode});
   ok("7.0.1 "+b.key+": "+mode+" withholds comparison",!s.currentComparison.available&&!s.what[1].includes("Latest reported:")&&s.what[1].includes("No current reading is shown"));
  }
  ok("7.0.1 "+b.key+": cached is named, not called live",voterSheet({...degen[i],mode:"CACHED"}).currentComparison.stamp.startsWith("CACHED"));
 }
 ok("7.0.1 rates: monthly change compared, yield kept as context",voterSheet(simple[0]).what[1].includes("4.94% yield; 1-month change +0.23 percentage points"));
 const cpi=voterSheet(simple[3]);
 ok("7.0.1 CPI: actual previous print and window start",cpi.what[1].includes("Previous print: 3.5%")&&cpi.what[1].includes("start: 3.1%")&&!cpi.what[1].includes("2%"));
 for(const key of ["tenYearM1","cpiTrend"]){
  const missing={...live};delete missing[key];
  const index=key==="tenYearM1"?0:3;
  ok("7.0.1 missing "+key+": mock fallback cannot enter comparison",!voterSheet(simpleSignals(evidence(missing)).cards[index]).currentComparison.available);
 }
 for(const b of REGIME_BAND_TABLE.filter(b=>b.flip)){
  for(const value of [b.flip.bullEdge,b.flip.bearEdge]){
   const vote=b.vote(value);
   const s=voterSheet({key:b.key,explain:b.explain,comparison:{current:String(value),context:""},mode:"LIVE",asOf:today,available:true,vote});
   ok("7.0.1 "+b.key+" exact edge "+value+": uses canonical vote",s.currentComparison.result===({bull:"Supports stocks.",bear:"Signals caution.",neutral:"No clear signal."}[vote]));
  }
 }
 ok("7.0.1 CPI missing history cannot become a comparison",comparisonReading("cpiHeadline",{macro:{cpi:{trend:[]}}},{value:3.7})===null);
 ok("7.0.1 absent sheet degrades safely",voterSheet(null)===undefined);
}
