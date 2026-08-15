// FEAT-TT-V2: ephemeral screenshot OCR. Images are decoded in-memory, sent to the
// configured Workers AI vision binding, and discarded before this request returns.
// The response is always a DRAFT and can never write to KV.

import { authorize, crossOrigin } from "../tt.js";

const MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const MAX_FILES = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = 16 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});

export function blankOcrDraft(asOf = new Date().toISOString().slice(0, 10)) {
  return {
    symbol: "",
    confirmedAt: null,
    estimates: {
      provider: "Seeking Alpha", sourceUrl: "https://seekingalpha.com/", asOf,
      currency: "USD", revenueUnit: "B", epsBasis: "provider-consensus", periods: [],
    },
    analystTarget: {
      provider: "TipRanks", sourceUrl: "https://www.tipranks.com/", asOf,
      currency: "USD", average: null, low: null, high: null, analystCount: null,
      ratings: { buy: null, hold: null, sell: null }, lookbackMonths: 3,
      horizonMonths: 12, referencePrice: null,
    },
  };
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  return btoa(binary);
}

function jsonFromModel(value) {
  const raw = typeof value === "string" ? value : value?.response ?? value?.result ?? value;
  if (raw && typeof raw === "object") return raw;
  const text = String(raw || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(text); } catch (_e) {
    const a = text.indexOf("{"), b = text.lastIndexOf("}");
    if (a >= 0 && b > a) try { return JSON.parse(text.slice(a, b + 1)); } catch (_e2) {}
    return null;
  }
}

const n = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const cleaned = v.trim().replace(/[$,%x×,]/gi, "");
  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*([BMT])?$/i);
  if (!match) return null;
  let out = Number(match[1]);
  if (!Number.isFinite(out)) return null;
  if (/T/i.test(match[2] || "")) out *= 1000;
  else if (/M/i.test(match[2] || "")) out /= 1000;
  return out;
};

function normalizePeriod(row) {
  const month = String(row?.periodEnd || row?.fiscalPeriod || "").trim();
  let periodEnd = /^\d{4}-\d{2}-\d{2}$/.test(month) ? month : null;
  const m = month.match(/(?:Jan(?:uary)?\s+)?(20\d{2})/i);
  if (!periodEnd && m) periodEnd = `${m[1]}-01-31`;
  if (!periodEnd) return null;
  const revenueB = n(row?.revenueB ?? row?.revenue);
  const eps = n(row?.eps);
  if (revenueB === null && eps === null) return null;
  return { periodEnd, ...(revenueB !== null ? { revenueB } : {}), ...(eps !== null ? { eps } : {}) };
}

export function mergeOcrExtractions(extractions, asOf = new Date().toISOString().slice(0, 10)) {
  const draft = blankOcrDraft(asOf);
  const warnings = [];
  const provenance = {};
  const periods = new Map();
  const set = (path, value, image) => {
    if (value === null || value === undefined || value === "") return;
    const parts = path.split(".");
    let obj = draft;
    for (const p of parts.slice(0, -1)) obj = obj[p];
    const key = parts.at(-1), old = obj[key];
    if (old !== null && old !== "" && old !== value && !([3, 12].includes(old) && [3, 12].includes(value)))
      warnings.push(`${path} conflicts across images (${old} vs ${value}); kept the first`);
    else { obj[key] = value; provenance[path] = image; }
  };
  extractions.forEach((x, i) => {
    const image = x.image || i + 1, data = x.data || {};
    set("symbol", String(data.symbol || "").trim().toUpperCase(), image);
    const rows = data.estimates?.periods || data.periods || [];
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const p = normalizePeriod(row);
      if (!p) return;
      const old = periods.get(p.periodEnd) || { periodEnd: p.periodEnd };
      for (const key of ["revenueB", "eps"]) {
        if (p[key] === undefined) continue;
        if (old[key] !== undefined && old[key] !== p[key]) warnings.push(`${p.periodEnd} ${key} conflicts across images`);
        else old[key] = p[key];
        provenance[`estimates.periods.${p.periodEnd}.${key}`] = image;
      }
      periods.set(p.periodEnd, old);
    });
    const t = data.analystTarget || data.target || {};
    for (const key of ["average", "low", "high", "analystCount", "lookbackMonths", "horizonMonths", "referencePrice"])
      set(`analystTarget.${key}`, n(t[key]), image);
    for (const key of ["buy", "hold", "sell"])
      set(`analystTarget.ratings.${key}`, n(t.ratings?.[key] ?? t[key]), image);
  });
  draft.estimates.periods = [...periods.values()].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  return { draft, warnings, provenance };
}

function promptFor(index) {
  return `You are extracting a licensed financial-app screenshot into a REVIEW DRAFT. Do not infer, interpolate, calculate, or fill unseen values. Return JSON only with this shape:\n{\n  "symbol": string|null,\n  "estimates": {"periods":[{"periodEnd":"YYYY-MM-DD or visible month/year","revenueB":number|null,"eps":number|null}]},\n  "analystTarget":{"average":number|null,"low":number|null,"high":number|null,"analystCount":number|null,"ratings":{"buy":number|null,"hold":number|null,"sell":number|null},"lookbackMonths":number|null,"horizonMonths":number|null,"referencePrice":number|null},\n  "warnings":[string]\n}\nRevenue must be in billions (1.15T becomes 1150). Preserve TipRanks' published average exactly; never average low/average/high. This is image ${index}.`;
}

export async function onRequestPost({ request, env }) {
  const auth = await authorize(request, env);
  if (!auth.ok) return json({ error: auth.error || "unauthorized" }, auth.status || 401);
  if (crossOrigin(request)) return json({ error: "cross-origin" }, 403);
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_REQUEST_BYTES) return json({ error: "request too large" }, 413);
  if (!env.AI || typeof env.AI.run !== "function")
    return json({ error: "Workers AI binding AI is unavailable", degraded: true, draft: blankOcrDraft(), requires_confirmation: true }, 503);
  let form;
  try { form = await request.formData(); } catch (_e) { return json({ error: "multipart form data is required" }, 400); }
  const files = form.getAll("images").filter((v) => v && typeof v.arrayBuffer === "function");
  if (!files.length || files.length > MAX_FILES) return json({ error: `attach 1–${MAX_FILES} images` }, 400);
  for (const file of files) {
    if (!ACCEPTED.has(file.type)) return json({ error: `unsupported image type ${file.type || "unknown"}` }, 415);
    if (!file.size || file.size > MAX_FILE_BYTES) return json({ error: "each image must be 5 MB or smaller" }, 413);
  }
  const extractions = [];
  const warnings = [];
  for (let i = 0; i < files.length; i++) {
    try {
      const bytes = new Uint8Array(await files[i].arrayBuffer());
      const image = `data:${files[i].type};base64,${bytesToBase64(bytes)}`;
      const response = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: "Extract only explicitly visible financial fields. Output strict JSON and no prose." },
          { role: "user", content: promptFor(i + 1) },
        ],
        image,
      });
      const data = jsonFromModel(response);
      if (!data) warnings.push(`image ${i + 1}: model response was not valid JSON`);
      else {
        extractions.push({ image: i + 1, data });
        if (Array.isArray(data.warnings)) warnings.push(...data.warnings.map((w) => `image ${i + 1}: ${w}`));
      }
    } catch (e) {
      warnings.push(`image ${i + 1}: OCR failed (${e?.message || "unknown"})`);
    }
  }
  const merged = mergeOcrExtractions(extractions);
  return json({
    schema: "tt-street-ocr-draft-v1",
    model: MODEL,
    draft: merged.draft,
    provenance: merged.provenance,
    warnings: [...warnings, ...merged.warnings],
    requires_confirmation: true,
    persisted: false,
  });
}
