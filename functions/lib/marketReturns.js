// Public ETF total returns. Display-only: never changes a quote, vote or frozen call.
import { tiingoSeries } from "./returnSeries.js";
import { ytdReturn } from "./spotlight.js";
import { etYmd, expectedObsDate } from "../../src/sources.js";

const PREFIX="pulse:market-returns:v1:";
const LIMIT=1024*1024;
export async function returnJson(url, fetchImpl=fetch) {
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),6000);
  let reader;
  try {
    const response=await fetchImpl(url,{headers:{Accept:"application/json"},signal:ctl.signal});
    if(!response.ok){await response.body?.cancel();throw new Error("return feed unavailable");}
    reader=response.body.getReader();
    const chunks=[];let size=0;
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>LIMIT)throw new Error("return feed exceeds size limit");
      chunks.push(value);
    }
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally { clearTimeout(timer);if(reader)await reader.cancel().catch(()=>{}); }
}

export function returnFields(symbol,raw,now=new Date()) {
  const series=tiingoSeries(raw,now.toISOString());
  if(!series.verified)return {};
  const result=ytdReturn(series.value,etYmd(now));
  if(!Number.isFinite(result.pct))return {};
  const field=symbol.toLowerCase()+"YtdTotal";
  return {[field]:result.pct,[field+"AsOf"]:result.through,[field+"Base"]:result.baseline.date};
}

export async function marketReturns(env,now=new Date(),fetchImpl=fetch) {
  // Reuse the existing public-display activation; a key alone is not permission.
  if(env.SPOTLIGHT_ENABLED!=="1"||!env.TIINGO_KEY||!env.PULSE_CACHE)return {};
  const today=etYmd(now), expected=expectedObsDate(now), fields={};
  await Promise.all(["SPY","QQQ"].map(async symbol=>{
    const key=PREFIX+symbol+":"+today+":"+expected;
    try {
      const cached=await env.PULSE_CACHE.get(key,"json");
      if(cached&&cached.schema===1){Object.assign(fields,cached.fields);return;}
      const start=`${Number(today.slice(0,4))-1}-12-01`;
      let current={};
      try {
        const raw=await returnJson(`https://api.tiingo.com/tiingo/daily/${symbol}/prices?startDate=${start}&endDate=${today}&token=${encodeURIComponent(env.TIINGO_KEY)}`,fetchImpl);
        current=returnFields(symbol,raw,now);
      } catch { /* No exception text or credentials enter the public payload. */ }
      // Retry lagging/failed observations after five minutes; roll the key after close.
      const success=Object.keys(current).length>0;
      if(!success) {
        const last=await env.PULSE_CACHE.get(PREFIX+symbol+":last","json");
        if(last)current=last; // dates travel unchanged; the client withholds stale/prior-year returns
      }
      Object.assign(fields,current);
      if(success)await env.PULSE_CACHE.put(PREFIX+symbol+":last",JSON.stringify(current),{expirationTtl:604800});
      const complete=success&&current[symbol.toLowerCase()+"YtdTotalAsOf"]>=expected;
      await env.PULSE_CACHE.put(key,JSON.stringify({schema:1,fields:current}),{expirationTtl:complete?86400:300});
    } catch { /* Optional display data must never fail the snapshot. */ }
  }));
  return fields;
}
