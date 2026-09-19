import {heroFace,FROZEN_ACTION,TERMINAL_ENGINE_NOTE} from "../src/heroFace.js";
import {REGIME_BAND_TABLE} from "../src/regime.js";
import {callFromEvidence} from "../src/macroCall.js";
export function testHeroFace(ok){
 const now=new Date("2026-09-18T18:00:00Z");
 const factors=REGIME_BAND_TABLE.map((b,i)=>({key:b.key,field:b.key==="valuation"?"shillerPe":b.key,vote:["bear","bull","bear","neutral","bear","bull"][i],excluded:false,mode:"CACHED",asOf:"2026-09-18"}));
 const evidence={state:"CACHED",factors};
 const call=callFromEvidence({...evidence,withheld:false,regime:{label:"MIXED"},counted:6,totalFactors:6});
 const face=heroFace({evidence,call,frozen:true,now});
 ok("7.0.2 tally: same six votes, caution/support/neutral order",face.tally==="3 caution · 2 support · 1 neutral");
 ok("7.0.2 Hold action and separate engine sentence exact",face.action==="Do not add risk."&&face.engine==="Terminal order-gate is a different engine.");
 for(const [direction,action] of Object.entries(FROZEN_ACTION)){
  const saved={...call,direction};
  for(const vote of ["bull","bear","neutral"]){
   const changed={...evidence,factors:factors.map(f=>({...f,vote}))};
   ok("7.0.2 "+direction+"/"+vote+": action remains frozen while tally changes",heroFace({evidence:changed,call:saved,frozen:true,now}).action===action);
  }
 }
 const aged=date=>({...evidence,factors:factors.map(f=>f.key==="cpiHeadline"?{...f,asOf:date}:f)});
 ok("7.0.2 CPI live date is fresh under existing monthly rule",!heroFace({evidence:aged("2026-08-01"),now}).tally.includes("stale"));
 ok("7.0.2 CPI exactly 70 days is not stale",!heroFace({evidence:aged("2026-07-10"),now}).tally.includes("stale"));
 ok("7.0.2 counted CPI at 71 days is disclosed, not silently removed",heroFace({evidence:aged("2026-07-09"),now}).tally==="3 caution · 2 support · 1 neutral · 1 stale counted");
 const excluded=aged("2026-07-09");excluded.factors=excluded.factors.map(f=>f.key==="cpiHeadline"?{...f,excluded:true}:f);
 ok("7.0.2 stale excluded voter is neither tallied nor stale counted",heroFace({evidence:excluded,now}).tally==="3 caution · 2 support · 0 neutral");
 for(const state of ["LOADING","ERROR","DEMO"])ok("7.0.2 "+state+": no illustrative votes",heroFace({evidence:{...evidence,state},now}).tally==="0 caution · 0 support · 0 neutral");
 for(const args of [{call,frozen:false},{call:{...call,published:false,status:"DATA HOLD"},frozen:true},{call:{...call,published:undefined,status:"PUBLISHED"},frozen:true},{call:{...call,direction:null},frozen:true},{}]){
  ok("7.0.2 missing/invalid frozen call creates no action advice",heroFace({...args,evidence,now}).action==="10am action unavailable.");
 }
 ok("7.0.2 missing evidence degrades safely",heroFace().tally==="0 caution · 0 support · 0 neutral"&&heroFace().engine===TERMINAL_ENGINE_NOTE);
 ok("7.0.2 unknown extra factor cannot change six-voter tally",heroFace({evidence:{...evidence,factors:[...factors,{key:"extra",vote:"bear"}]},now}).tally===face.tally);
 for(const [counted,panic,status,action] of [[6,false,"OK","Do not add risk."],[4,false,"PARTIAL DATA","Do not add risk."],[6,true,"PANIC","Reduce or don’t add."]]){
  const real=callFromEvidence({...evidence,withheld:false,regime:{label:"MIXED"},counted,totalFactors:6},{panic});
  ok("7.0.4 actual publisher "+status+": frozen action uses published boolean",real.status===status&&real.published===true&&heroFace({evidence,call:real,frozen:true,now}).action===action);
 }
}
