// FEAT-TT-V2: pure measured-fact normalization. Provider adapters live in the route;
// extraction and last-good merge live here so malformed upstream data is testable offline.

import { TT_FACTS_SCHEMA } from "./tt-v2.js";

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const round = (v, places = 6) => {
  if (!Number.isFinite(v)) return null;
  const p = 10 ** places;
  return Math.round((v + Number.EPSILON) * p) / p;
};

const goodStatus = (s) => ["LIVE", "CACHED"].includes(String(s || "").toUpperCase());
const goodFact = (f) => f && f.value !== null && f.value !== undefined && goodStatus(f.status);
const hasLastGoodValue = (f) => f && f.value !== null && f.value !== undefined;

/* v5.6.1 — series continuity, the BANDS doctrine pointed at candles. Found LIVE the night
   v5.6 shipped: a Nasdaq multi-window merge for NBIS carried a 6-month interior hole (a
   failed middle window) and a tail window from ANOTHER INSTRUMENT ($104.88 -> $7.78 across
   adjacent rows) — stored as LIVE, it anchored a stamped outcome at $7.62 on a $277 stock.
   Two structural tells, either one damning for a DAILY series that claims to be ONE
   instrument: an interior calendar gap wider than any holiday run, or an adjacent-close
   jump no split-adjusted series produces. Reject the impossible, not the unusual — a
   3x day-over-day move on real prints is beyond any single-session repricing this store
   feeds (and a provider's own series is split-adjusted internally). Returns the fault
   NAMED, or null. Used at BOTH ingestion builders and again at the outcome reader, because
   merge-only last-good semantics can keep an already-stored corrupt series alive as STALE. */
export function candleSeriesFault(rows) {
  const r = Array.isArray(rows) ? rows : [];
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1], b = r[i];
    if (!a || !b || !a.date || !b.date) continue;
    const gapDays = (new Date(b.date + "T00:00:00Z") - new Date(a.date + "T00:00:00Z")) / 86400000;
    if (gapDays > 14) return `interior gap ${a.date} -> ${b.date} (${Math.round(gapDays)}d) — a window failed; the merge is not one series`;
    const ca = Number(a.close), cb = Number(b.close);
    if (ca > 0 && cb > 0 && (cb / ca > 3 || ca / cb > 3))
      return `adjacent-close discontinuity ${a.date} $${ca} -> ${b.date} $${cb} — not one instrument's series`;
  }
  return null;
}

export function mergeFactsRecord(previous, incoming, now = new Date()) {
  const prior = previous?.fields || {};
  const next = incoming?.fields || {};
  const fields = {};
  for (const name of new Set([...Object.keys(prior), ...Object.keys(next)])) {
    const fresh = next[name], old = prior[name];
    if (goodFact(fresh)) fields[name] = fresh;
    // A second failed refresh must not erase the value retained by the first one. Once a
    // last-good field is marked STALE it remains usable as stale evidence until a new LIVE /
    // CACHED observation replaces it; its original observedAt is preserved throughout.
    else if (hasLastGoodValue(old)) fields[name] = {
      ...old,
      status: "STALE",
      retrievedAt: fresh?.retrievedAt || now.toISOString(),
      lastRefreshError: fresh?.error || fresh?.reason || "provider did not return a current value",
    };
    else fields[name] = fresh || old;
  }
  return {
    schema: TT_FACTS_SCHEMA,
    symbol: incoming?.symbol || previous?.symbol || null,
    updatedAt: now.toISOString(),
    fields,
    degradation: Object.entries(fields).filter(([, f]) => !goodStatus(f?.status)).map(([name, f]) => ({
      field: name, status: f?.status || "MISSING", reason: f?.error || f?.reason || f?.lastRefreshError || "unavailable",
    })),
  };
}

function observations(companyfacts, tag, unit) {
  const xs = companyfacts?.facts?.["us-gaap"]?.[tag]?.units?.[unit];
  return Array.isArray(xs) ? xs.filter((x) => finite(x?.val) && /^10-(?:Q|K)(?:\/A)?$/.test(String(x?.form || "")) && /^\d{4}-\d{2}-\d{2}$/.test(String(x?.end || ""))) : [];
}

function durationDays(x) {
  if (!x?.start || !x?.end) return Infinity;
  return (Date.parse(`${x.end}T12:00:00Z`) - Date.parse(`${x.start}T12:00:00Z`)) / 86400000;
}

export function latestSecFact(companyfacts, tags, unit, { preferQuarter = false } = {}) {
  const candidates = [];
  for (const tag of tags) for (const x of observations(companyfacts, tag, unit)) candidates.push({ ...x, tag });
  candidates.sort((a, b) => String(b.end).localeCompare(String(a.end))
    || String(b.filed || "").localeCompare(String(a.filed || ""))
    || (preferQuarter ? durationDays(a) - durationDays(b) : 0)
    || Number(Boolean(b.frame)) - Number(Boolean(a.frame)));
  return candidates[0] || null;
}

const sameEnd = (xs) => xs.every((x) => x && x.end === xs[0].end);

export function extractSecFacts(companyfacts, { retrievedAt = new Date().toISOString(), sourceUrl = "https://data.sec.gov/" } = {}) {
  const cash = latestSecFact(companyfacts, ["CashAndCashEquivalentsAtCarryingValue"], "USD");
  const securities = latestSecFact(companyfacts, ["MarketableSecuritiesCurrent", "ShortTermInvestments"], "USD");
  const debtCurrent = latestSecFact(companyfacts,
    ["LongTermDebtCurrent", "LongTermDebtAndFinanceLeaseObligationsCurrent", "FinanceLeaseLiabilityCurrent"], "USD");
  const debtLong = latestSecFact(companyfacts,
    ["LongTermDebtNoncurrent", "LongTermDebtAndFinanceLeaseObligationsNoncurrent", "FinanceLeaseLiabilityNoncurrent"], "USD");
  const diluted = latestSecFact(companyfacts, ["WeightedAverageNumberOfDilutedSharesOutstanding"], "shares", { preferQuarter: true });
  const fields = {};
  if (diluted) fields.dilutedSharesB = {
    value: round(diluted.val / 1e9), unit: "B shares", status: "LIVE", observedAt: diluted.end,
    retrievedAt, provider: "SEC", sourceUrl, tag: diluted.tag, filing: diluted.accn || null,
  };
  if (cash) fields.cashB = {
    value: round(cash.val / 1e9), unit: "USD B", status: "LIVE", observedAt: cash.end,
    retrievedAt, provider: "SEC", sourceUrl, tag: cash.tag, filing: cash.accn || null,
  };
  if (securities) fields.marketableSecuritiesB = {
    value: round(securities.val / 1e9), unit: "USD B", status: "LIVE", observedAt: securities.end,
    retrievedAt, provider: "SEC", sourceUrl, tag: securities.tag, filing: securities.accn || null,
  };
  if (debtCurrent) fields.currentDebtB = {
    value: round(debtCurrent.val / 1e9), unit: "USD B", status: "LIVE", observedAt: debtCurrent.end,
    retrievedAt, provider: "SEC", sourceUrl, tag: debtCurrent.tag, filing: debtCurrent.accn || null,
  };
  if (debtLong) fields.longTermDebtB = {
    value: round(debtLong.val / 1e9), unit: "USD B", status: "LIVE", observedAt: debtLong.end,
    retrievedAt, provider: "SEC", sourceUrl, tag: debtLong.tag, filing: debtLong.accn || null,
  };
  if (sameEnd([cash, securities, debtCurrent, debtLong])) {
    const value = (cash.val + securities.val - debtCurrent.val - debtLong.val) / 1e9;
    fields.netCashB = {
      value: round(value), unit: "USD B", status: "LIVE", observedAt: cash.end, retrievedAt,
      provider: "SEC", sourceUrl,
      components: {
        cashB: round(cash.val / 1e9), marketableSecuritiesB: round(securities.val / 1e9),
        currentDebtB: round(debtCurrent.val / 1e9), longTermDebtB: round(debtLong.val / 1e9),
      },
      tags: [cash.tag, securities.tag, debtCurrent.tag, debtLong.tag],
    };
  } else fields.netCashB = {
    value: null, unit: "USD B", status: "MISSING", retrievedAt, provider: "SEC", sourceUrl,
    reason: "cash, securities, current debt, and long-term debt were not all reported for the same period; zero was not assumed",
  };
  return fields;
}

export function filingsFromSubmissions(submissions, cik) {
  const recent = submissions?.filings?.recent || {};
  const n = Array.isArray(recent.accessionNumber) ? recent.accessionNumber.length : 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    const form = recent.form?.[i];
    if (!/^10-(?:Q|K)(?:\/A)?$/.test(String(form || ""))) continue;
    const accn = String(recent.accessionNumber[i] || "");
    const primary = String(recent.primaryDocument?.[i] || "");
    if (!/^\d{10}-\d{2}-\d{6}$/.test(accn) || !primary) continue;
    out.push({
      form, filed: recent.filingDate?.[i] || null, periodEnd: recent.reportDate?.[i] || null,
      accessionNumber: accn,
      url: `https://www.sec.gov/Archives/edgar/data/${String(Number(cik))}/${accn.replace(/-/g, "")}/${primary}`,
    });
    if (out.length >= 6) break;
  }
  return out;
}
