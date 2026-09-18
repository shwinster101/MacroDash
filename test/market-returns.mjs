import {marketReturns,returnFields,returnJson} from "../functions/lib/marketReturns.js";
import {ytdView} from "../src/marketReturnView.js";
export async function testMarketReturns(ok) {
 const now=new Date("2026-09-18T18:00:00Z");
 const {closes}=await import("./spotlight-fixture.mjs");
 const dates=closes("2025-12-31","2026-09-17");
 const raw=dates.map((r,i)=>({date:r.date,close:100+10*i/(dates.length-1),adjClose:99+11*i/(dates.length-1)}));
 const got=returnFields("SPY",raw,now);
 ok("v7 YTD: dividend-adjusted baseline yields 11.11%, not 10% price return",got.spyYtdTotal===11.11&&got.spyYtdTotalBase==="2025-12-31"&&got.spyYtdTotalAsOf==="2026-09-17");
 ok("v7 YTD: missing exact baseline fails closed",Object.keys(returnFields("QQQ",raw.map(r=>({...r,date:r.date==="2025-12-31"?"2025-12-30":r.date})),now)).length===0);
 ok("v7 YTD: unverified adjusted series fails closed",Object.keys(returnFields("SPY",raw.map(r=>({...r,adjClose:r.close*0.5})),now)).length===0);
 const data={ytdTotal:0,ytdTotalBase:"2025-12-31"};
 ok("v7 YTD: zero is a valid current return",ytdView(data,"LIVE","2026-09-17","2026-09-18").available);
 for(const mode of ["MOCK","STALE",undefined])ok("v7 YTD: withholds "+mode,!ytdView(data,mode,"2026-09-17","2026-09-18").available);
 for(const date of ["2025-12-31","2026-09-19",null])ok("v7 YTD: rejects old/future/absent date "+date,!ytdView(data,"LIVE",date,"2026-09-18").available);
 ok("v7 YTD: quote alone cannot supply return baseline",!ytdView({ytdTotal:9},"LIVE","2026-09-17","2026-09-18").available);
 const cache=new Map(),writes=[];let calls=0;
 const env={SPOTLIGHT_ENABLED:"1",TIINGO_KEY:"synthetic",PULSE_CACHE:{get:async k=>cache.get(k)||null,put:async(k,v,o)=>{cache.set(k,JSON.parse(v));writes.push(o.expirationTtl);}}};
 const fetcher=async()=>{calls++;return Response.json(raw);};
 ok("v7 returns: disabled without public-display flag",Object.keys(await marketReturns({...env,SPOTLIGHT_ENABLED:"0"},now,fetcher)).length===0&&calls===0);
 const fresh=await marketReturns(env,now,fetcher);
 ok("v7 returns: both ETFs fetched independently",calls===2&&fresh.spyYtdTotal===11.11&&fresh.qqqYtdTotal===11.11);
 await marketReturns(env,now,fetcher);
 ok("v7 returns: warm cache adds no provider requests",calls===2);
 await marketReturns(env,new Date("2026-09-18T22:00:00Z"),fetcher);
 ok("v7 returns: cache rolls after close, lagging data retries briefly",calls===4&&writes.includes(300));
 const failed=await marketReturns(env,new Date("2026-09-19T18:00:00Z"),async()=>{throw Error("synthetic-secret");});
 ok("v7 returns: failure preserves last-good observation date, no error disclosure",failed.spyYtdTotalAsOf==="2026-09-17"&&!JSON.stringify(failed).includes("secret"));
 const noWrite=await marketReturns({...env,PULSE_CACHE:{get:async()=>null,put:async()=>{throw Error("KV");}}},now,fetcher);
 ok("v7 returns: KV write failure retains verified fresh return",noWrite.spyYtdTotal===11.11&&noWrite.qqqYtdTotal===11.11);
 for(const [name,response] of [["oversize",new Response(" ".repeat(1024*1024+1))],["malformed",new Response("{")],["HTTP",new Response("bad",{status:503})]]) {
  let rejected=false;try{await returnJson("https://fixture.invalid",async()=>response);}catch{rejected=true;}
  ok("v7 returns: bounded reader rejects "+name,rejected);
 }
}
