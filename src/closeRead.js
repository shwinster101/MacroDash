// MacroDash v6.2 — the 6pm CLOSE READ. PURE: no React, no network; Node-importable so smoke
// RUNS it. Imported by functions/api/snapshot/refresh.js (the close edition builds it) and
// src/dashboard.jsx (the hero renders ONE line from it).
//
// WHAT THIS IS, AND IS NOT (owner rulings 2026-09-02):
//   · A labeled, SUBORDINATE, UNSCORED read of the same six-factor engine at 18:00 ET, after
//     most same-day legs have landed. The 10am call stays THE call: it is the row /history
//     keys, the record the outcome ledger scores, the call every receipt binds.
//   · `read` is a REAL md-call-v1 from buildMacroCall — the same engine speaks, so the close
//     read can never disagree with the vocabulary or the bands. The edition lives ONLY in
//     this envelope: md-call-v1 is never given an edition axis, so validFrozenCall,
//     captureDailyCall and the tt-alloc effective-date binding cannot see it.
//   · It never enters /readout.json (owner ruling 5) and never rebuilds the day key — the
//     basis every open receipt hashed and the basis the scored call was projected from.
import { buildMacroCall } from "./macroCall.js";
import { CLOSE_READ_SCHEMA, CLOSE_READ_RECORD_SCHEMA } from "./publicHistory.js";
import { parseTopHeadlines } from "./headlines.js";

/* The legs a close read describes, and where each one's date and attribution live. A leg
   with no `source` field names its ONE publisher as `fallback`; a leg that CAN be served by
   a failsafe carries the source key the snapshot stamps (tenYearSource · thirtyYearSource ·
   vixSource). Daily-cadence legs are the only ones that can be "same-day" — a monthly CPI
   print or a weekly NFCI is neither same-day nor prior, and lands in neither array.
   spyClose is the DISPLAY-ONLY Finnhub leg (see snapshot.js fetchSpyClose): it rides here so
   a reader can compare it against the FRED proxy, and nowhere else. */
export const CLOSE_LEGS = Object.freeze([
  { key: "tenYear",     label: "10Y",  asOf: "tenYearAsOf",    source: "tenYearSource",    fallback: "FRED DGS10",      cadence: "daily" },
  { key: "thirtyYear",  label: "30Y",  asOf: "thirtyYearAsOf", source: "thirtyYearSource", fallback: "FRED DGS30",      cadence: "daily" },
  { key: "vix",         label: "VIX",  asOf: "vixAsOf",        source: "vixSource",        fallback: "FRED VIXCLS",     cadence: "daily" },
  { key: "fearGreed",   label: "F&G",  asOf: "fearGreedAsOf",  source: null,               fallback: "CNN Fear & Greed", cadence: "daily" },
  { key: "spyPrice",    label: "SPY",  asOf: "spyPriceAsOf",   source: null,               fallback: "FRED SP500/10 proxy", cadence: "daily" },
  { key: "spyClose",    label: "SPY last (Finnhub, display-only)", asOf: "spyCloseAsOf", source: "spyCloseSource", fallback: "Finnhub SPY last print", cadence: "daily", displayOnly: true },
  { key: "cpiHeadline", label: "CPI",  asOf: "cpiHeadlineAsOf", source: null,              fallback: "FRED CPIAUCNS",   cadence: "monthly" },
  { key: "shillerPe",   label: "CAPE", asOf: "shillerPeAsOf",  source: null,               fallback: "multpl.com",      cadence: "monthly" },
  { key: "nfci",        label: "NFCI", asOf: "nfciAsOf",       source: null,               fallback: "FRED NFCI",       cadence: "weekly" },
]);

const finite = (v) => typeof v === "number" && Number.isFinite(v);

/* classifyLegs(live, date) → { legs, legs_same_day, legs_prior }.
   `legs` lists every leg the snapshot actually carries (value + as_of + source);
   `legs_same_day` are the DAILY legs dated `date`; `legs_prior` are the daily legs dated
   earlier — OR undated, because an undated leg cannot claim same-day (fail closed on the
   claim, never on the number). Monthly/weekly legs appear in `legs` only. */
export function classifyLegs(live = {}, date = null) {
  const l = live && typeof live === "object" ? live : {};
  const legs = [];
  for (const spec of CLOSE_LEGS) {
    const value = l[spec.key];
    if (!finite(value)) continue;
    const as_of = typeof l[spec.asOf] === "string" ? l[spec.asOf] : null;
    const source = spec.source && typeof l[spec.source] === "string" ? l[spec.source] : spec.fallback;
    legs.push({ key: spec.key, label: spec.label, value, as_of, source, cadence: spec.cadence,
      display_only: spec.displayOnly === true, same_day: spec.cadence === "daily" ? as_of === date : null });
  }
  const daily = legs.filter((x) => x.cadence === "daily");
  return {
    legs,
    legs_same_day: daily.filter((x) => x.same_day === true).map((x) => x.key),
    legs_prior: daily.filter((x) => x.same_day !== true).map((x) => x.key),
  };
}

/* buildCloseRead({ live, date, generatedAt, frozenCall, now }) → the md-close-read-v1 payload.
   `frozenCall` is today's validated md-call-v1 (or null on a day with no 10am row) — the
   drift line compares direction AND headline, the same test the hero's live drift uses. */
export function buildCloseRead({ live = {}, date = null, generatedAt = null, frozenCall = null, now = new Date() } = {}) {
  const genAt = generatedAt || (now instanceof Date ? now.toISOString() : new Date().toISOString());
  const read = buildMacroCall(live, { cached: false, effectiveDate: date, generatedAt: genAt, now });
  const { legs, legs_same_day, legs_prior } = classifyLegs(live, date);
  const spy = legs.find((x) => x.key === "spyClose") || null;
  const frozenOk = frozenCall && frozenCall.schema === "md-call-v1" && frozenCall.effective_date === date;
  const drift_vs_call = frozenOk ? {
    changed: read.direction !== frozenCall.direction || read.headline !== frozenCall.headline,
    from: { headline: frozenCall.headline ?? null, emoji: frozenCall.emoji ?? null, direction: frozenCall.direction ?? null },
    to:   { headline: read.headline ?? null,       emoji: read.emoji ?? null,       direction: read.direction ?? null },
  } : null;
  return {
    schema: CLOSE_READ_SCHEMA,
    date,
    generated_at: genAt,
    edition: "close",
    scored: false,
    read,
    legs,
    legs_same_day,
    legs_prior,
    spy_close: spy ? { price: spy.value, as_of: spy.as_of, source: spy.source, display_only: true } : null,
    basis: {
      engine: "public 6-factor backdrop (src/regime.js) — the same engine as the 10am call",
      spy_flip: "the Macro Flip circuit runs on the FRED SP500/10 proxy pair; the Finnhub SPY leg is display-only and never merged",
      scored: "no — the 10am call is the scored record; this read is never joined into the outcome ledger",
      day_key: "untouched — the 6pm build never republishes the day's snapshot",
    },
    headlines: parseTopHeadlines((live && typeof live === "object" ? live : {}).marketHeadlinesJson),
    drift_vs_call,
  };
}

/* closeReadLine(record, dailyCall, today) → the ONE object the hero renders, or null.
   `record` is the Worker's captured envelope (md-close-read-record-v1). A FAILED capture
   renders NOTHING here — /history carries CAPTURE FAILED; the hero slot is for a read, and
   before 18:00 the same absence means "no read yet". `differs` is against the SAME frozen
   call the hero shows (dailyCall), never a recomputation; `frozen` states whether a 10am
   call was frozen for this date, which decides the tail of the sentence. */
export function closeReadLine(record, dailyCall = null, today = null) {
  if (!record || record.schema !== CLOSE_READ_RECORD_SCHEMA || record.capture_status !== "CAPTURED") return null;
  const cr = record.close_read;
  if (!cr || cr.schema !== CLOSE_READ_SCHEMA || !cr.read) return null;
  if (today && record.date !== today) return null;
  const r = cr.read;
  const headline = r.headline ?? null, emoji = r.emoji ?? null, direction = r.direction ?? null;
  const label = headline ? `${headline}${emoji ? ` ${emoji}` : ""} · ${direction || "DATA HOLD"}` : "CAN'T CALL IT 🌫️ · DATA HOLD";
  const frozen = !!(dailyCall && dailyCall.schema === "md-call-v1" && dailyCall.effective_date === record.date);
  const differs = frozen && (direction !== (dailyCall.direction ?? null) || headline !== (dailyCall.headline ?? null));
  return { date: record.date, headline, emoji, direction, label, frozen, differs,
    legs_same_day: Array.isArray(cr.legs_same_day) ? cr.legs_same_day : [], captured_at: record.captured_at || null };
}
