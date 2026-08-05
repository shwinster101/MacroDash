import { chromium } from "playwright-core";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import http from "node:http";
const base="/opt/pw-browsers"; let exe=null;
for(const d of readdirSync(base)){for(const rel of ["chrome-linux64/chrome","chrome-linux/chrome"]){
  const p=`${base}/${d}/${rel}`; if(existsSync(p)){exe=p;break;}} if(exe)break;}
const R_=(f)=>JSON.parse(readFileSync(f,"utf8"));
const ADMIN=readFileSync("/tmp/adm.html","utf8"),BOOK=R_("/tmp/book2.json"),IDX=R_("/tmp/idx.json"),ALL=R_("/tmp/all.json"),POS=R_("/tmp/pos.json");
const srv=http.createServer((req,res)=>{const u=new URL(req.url,"http://x");
  const j=(o)=>{res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify(o));};
  if(u.pathname==="/api/tt")return j(BOOK);
  if(u.pathname==="/api/deepdive"){if(u.searchParams.get("index")==="1")return j(IDX);
    if(u.searchParams.get("all")==="1")return j(ALL);
    const s=u.searchParams.get("sym");return j({sym:s,deepDive:ALL.deepDives[s]||null});}
  if(u.pathname==="/api/positions")return j(POS);
  if(u.pathname==="/api/quotes")return j({asOf:null,quotes:{}});
  if(u.pathname.startsWith("/api/")||u.pathname==="/readout.json"){res.writeHead(404);return res.end("{}");}
  res.writeHead(200,{"content-type":"text/html"});res.end(ADMIN);});
await new Promise(r=>srv.listen(8798,r));
const br=await chromium.launch({executablePath:exe,args:["--no-sandbox"]});
const page=await br.newPage({viewport:{width:390,height:844}});
const errs=[];page.on("pageerror",e=>errs.push("pageerror: "+e.message));
await page.goto("http://127.0.0.1:8798/admin.html",{waitUntil:"networkidle"});
await page.waitForTimeout(3500);
const E=(f)=>page.evaluate(f);
console.log("book:",await E(()=>BOOK.length),"| ranked:",await E(()=>UPSIDE_ROWS.length),"| reviewed-unpriced tail:",await E(()=>UNRANKED_ROWS.length));
console.log("coverage:",await E(()=>{const r=new Set(UPSIDE_ROWS.map(x=>x.sym)),u=new Set(UNRANKED_ROWS.map(x=>x.sym));
  const miss=BOOK.filter(x=>!r.has(x.sym)&&!u.has(x.sym)).map(x=>x.sym);return {ranked:r.size,tail:u.size,neither:miss};}));
console.log("tail rows:");
console.log(await E(()=>UNRANKED_ROWS.map(r=>`  ${r.sym.padEnd(6)} ${String(r.tier).padEnd(6)} TT ${r.tt&&r.tt.score!=null?r.tt.score:(r.tt?r.tt.tier:"—")}  ${r.why}`).join("\n")));
const buy=(await page.locator("#buyBlock").innerText()).replace(/\s+/g," ");
console.log("\nBUY BLOCK (primary view):\n"+buy.slice(0,700));
console.log("\n390px overflow:",await E(()=>document.documentElement.scrollWidth>390));
console.log("page errors:",errs.length?errs.slice(0,4):"none");
await br.close();srv.close();
