// Palette Move 1a — PIN Nasdaq/Zacks street DRAFT. Fetches the keyless analyst
// target-price door, maps fail-closed, and never writes KV. Owner still CONFIRMs
// via PUT /api/street. Nasdaq is labelled Nasdaq (Zacks consensus), never TipRanks.

import { authorize, crossOrigin } from "../tt.js";
import { blankNasdaqDraft, nasdaqStreetDraft, nasdaqTargetpriceUrl, NASDAQ_STREET_HEADERS } from "../../lib/nasdaqStreet.js";

const SYMBOL_RE = /^[A-Z.\-]{1,8}$/;
const STREET_KEY = (sym) => `tt:street:${sym}:v1`;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});

async function getJson(url, { headers = {}, timeout = 9000 } = {}, fetchImpl = fetch) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetchImpl(url, { headers: { Accept: "application/json", ...headers }, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

function etDate(now = new Date()) {
  return new Date(now).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

async function existingEstimates(env, sym) {
  if (!env?.PULSE_CACHE || typeof env.PULSE_CACHE.get !== "function") return null;
  try {
    const rec = await env.PULSE_CACHE.get(STREET_KEY(sym), "json");
    if (rec?.schema === "tt-street-v1" && rec.estimates) return rec.estimates;
  } catch (_e) { /* draft still returns; owner fills SA manually */ }
  return null;
}

export async function nasdaqDraftFor(sym, { env = {}, now = new Date(), fetchImpl = fetch } = {}) {
  const asOf = etDate(now);
  const warnings = [];
  let payload = null;
  try {
    payload = await getJson(nasdaqTargetpriceUrl(sym), { headers: NASDAQ_STREET_HEADERS, timeout: 12000 }, fetchImpl);
  } catch (e) {
    warnings.push(`Nasdaq analyst endpoint failed (${e?.message || "unknown"}); enter the published average manually`);
  }
  const mapped = nasdaqStreetDraft(payload, { symbol: sym, asOf });
  const estimates = await existingEstimates(env, sym);
  if (estimates) mapped.draft.estimates = estimates;
  mapped.draft.confirmedAt = null;
  mapped.draft.analystTarget.lookbackMonths = null;
  return {
    schema: "tt-street-nasdaq-draft-v1",
    draft: mapped.draft,
    warnings: [...warnings, ...mapped.warnings],
    requires_confirmation: true,
    persisted: false,
  };
}

async function handle({ request, env, fetchImpl = fetch }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error || "unauthorized" }, auth.status || 401);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);
  const url = new URL(request.url);
  let sym = String(url.searchParams.get("sym") || "").trim().toUpperCase();
  if (!sym && request.method === "POST") {
    try {
      const body = await request.json();
      sym = String(body?.symbol || body?.sym || "").trim().toUpperCase();
    } catch (_e) { /* query-only is fine */ }
  }
  if (!SYMBOL_RE.test(sym)) return json({ error: "valid sym is required" }, 400);
  const body = await nasdaqDraftFor(sym, { env, fetchImpl });
  return json(body);
}

export async function onRequestGet(ctx) { return handle(ctx); }
export async function onRequestPost(ctx) { return handle(ctx); }
