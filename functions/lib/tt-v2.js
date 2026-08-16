// FEAT-TT-V2: shared Ticker Terminal street-input and gate contract.
//
// This module is deliberately pure and browser-free. Pages Functions validate with it,
// the analysis route computes with it, and smoke imports the exact same implementation.
// A value cannot be accepted at the API and interpreted differently by the board.

export const TT_STREET_SCHEMA = "tt-street-v1";
export const TT_FACTS_SCHEMA = "tt-facts-v1";
export const TT_ANALYSIS_SCHEMA = "tt-analysis-v1";
// v2.1.0 (v3.91): binary window moved OUTSIDE the eligibility set (report-only, BINCAL
// doctrine) and the quote gate became session-aware — both change what a receipt of a given
// version means, so the engine version moves with them (receipts bind engineVersion).
export const TT_ENGINE_VERSION = "tt-gates-v2.1.0";

export const TARGET_FRESH_DAYS = 30;
export const ESTIMATE_FRESH_DAYS = 45;
export const STREET_GAP_MIN_PCT = 15;
export const BINARY_WINDOW_DAYS = 10;
export const QUOTE_MAX_AGE_MINUTES = 15;
export const COMPOSITE_MIN_SCORE = 5.5;
export const RR_FLOORS = Object.freeze({ core: 2, tactical: 2.5, speculative: 3 });

const SYMBOL_RE = /^[A-Z.\-]{1,8}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const finite = (v) => typeof v === "number" && Number.isFinite(v);
const round = (v, places = 6) => {
  if (!Number.isFinite(v)) return null;
  const p = 10 ** places;
  return Math.round((v + Number.EPSILON) * p) / p;
};

export function validDate(value) {
  if (!DATE_RE.test(String(value || ""))) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function ageDays(value, now = new Date()) {
  if (!validDate(value)) return null;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
  const observed = new Date(`${value}T12:00:00Z`);
  return Math.floor((today - observed) / 86400000);
}

function numberOrOriginal(v) {
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return v;
}

function cleanUrl(v) {
  return typeof v === "string" ? v.trim() : v;
}

export function normalizeStreetPacket(raw) {
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const estimates = p.estimates && typeof p.estimates === "object" ? p.estimates : {};
  const target = p.analystTarget && typeof p.analystTarget === "object" ? p.analystTarget : {};
  const ratings = target.ratings && typeof target.ratings === "object" ? target.ratings : {};
  return {
    schema: TT_STREET_SCHEMA,
    symbol: String(p.symbol || "").trim().toUpperCase(),
    confirmedAt: p.confirmedAt,
    estimates: {
      provider: String(estimates.provider || "").trim(),
      sourceUrl: cleanUrl(estimates.sourceUrl),
      asOf: estimates.asOf,
      currency: String(estimates.currency || "").trim().toUpperCase(),
      revenueUnit: String(estimates.revenueUnit || "B").trim().toUpperCase(),
      epsBasis: String(estimates.epsBasis || "").trim().toLowerCase(),
      periods: Array.isArray(estimates.periods)
        ? estimates.periods.map((row) => ({
            periodEnd: row?.periodEnd,
            ...(row?.revenueB !== undefined ? { revenueB: numberOrOriginal(row.revenueB) } : {}),
            ...(row?.eps !== undefined ? { eps: numberOrOriginal(row.eps) } : {}),
            ...(row?.analysts !== undefined ? { analysts: numberOrOriginal(row.analysts) } : {}),
          })).sort((a, b) => String(a.periodEnd).localeCompare(String(b.periodEnd)))
        : [],
    },
    analystTarget: {
      provider: String(target.provider || "").trim(),
      sourceUrl: cleanUrl(target.sourceUrl),
      asOf: target.asOf,
      currency: String(target.currency || "").trim().toUpperCase(),
      average: numberOrOriginal(target.average),
      ...(target.low !== undefined ? { low: numberOrOriginal(target.low) } : {}),
      ...(target.high !== undefined ? { high: numberOrOriginal(target.high) } : {}),
      ...(target.analystCount !== undefined ? { analystCount: numberOrOriginal(target.analystCount) } : {}),
      ratings: {
        ...(ratings.buy !== undefined ? { buy: numberOrOriginal(ratings.buy) } : {}),
        ...(ratings.hold !== undefined ? { hold: numberOrOriginal(ratings.hold) } : {}),
        ...(ratings.sell !== undefined ? { sell: numberOrOriginal(ratings.sell) } : {}),
      },
      lookbackMonths: numberOrOriginal(target.lookbackMonths ?? 3),
      horizonMonths: numberOrOriginal(target.horizonMonths ?? 12),
      ...(target.referencePrice !== undefined ? { referencePrice: numberOrOriginal(target.referencePrice) } : {}),
    },
  };
}

function validHttpUrl(value) {
  if (typeof value !== "string" || !value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch (_e) {
    return false;
  }
}

function sourceHostMatches(value, domain) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  } catch (_e) { return false; }
}

function numeric(errors, path, value, { min = -Infinity, max = Infinity, integer = false, optional = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (!optional) errors.push(`${path} is required`);
    return;
  }
  if (!finite(value)) errors.push(`${path} must be a finite number`);
  else if (value < min || value > max) errors.push(`${path} must be between ${min} and ${max}`);
  else if (integer && !Number.isInteger(value)) errors.push(`${path} must be an integer`);
}

export function validateStreetPacket(raw, { now = new Date(), rejectFuture = true } = {}) {
  const value = normalizeStreetPacket(raw);
  const errors = [];
  if (!SYMBOL_RE.test(value.symbol)) errors.push("symbol must be 1–8 uppercase ticker characters");
  if (!ISO_RE.test(String(value.confirmedAt || "")) || !Number.isFinite(Date.parse(value.confirmedAt)))
    errors.push("confirmedAt must be an ISO UTC timestamp");
  else if (rejectFuture && Date.parse(value.confirmedAt) > now.getTime() + 5 * 60000)
    errors.push("confirmedAt cannot be in the future");

  const checkLicensedHeader = (block, path) => {
    if (!block.provider) errors.push(`${path}.provider is required`);
    if (!validHttpUrl(block.sourceUrl)) errors.push(`${path}.sourceUrl must be an http(s) URL`);
    if (!validDate(block.asOf)) errors.push(`${path}.asOf must be YYYY-MM-DD`);
    else if (rejectFuture && ageDays(block.asOf, now) < 0) errors.push(`${path}.asOf cannot be in the future`);
    if (!CURRENCY_RE.test(block.currency)) errors.push(`${path}.currency must be a three-letter code`);
  };
  checkLicensedHeader(value.estimates, "estimates");
  checkLicensedHeader(value.analystTarget, "analystTarget");
  if (value.estimates.provider.toLowerCase() !== "seeking alpha")
    errors.push("estimates.provider must be Seeking Alpha");
  if (value.estimates.sourceUrl && !sourceHostMatches(value.estimates.sourceUrl, "seekingalpha.com"))
    errors.push("estimates.sourceUrl must be on seekingalpha.com");
  if (value.analystTarget.provider.toLowerCase() !== "tipranks")
    errors.push("analystTarget.provider must be TipRanks");
  if (value.analystTarget.sourceUrl && !sourceHostMatches(value.analystTarget.sourceUrl, "tipranks.com"))
    errors.push("analystTarget.sourceUrl must be on tipranks.com");

  if (value.estimates.revenueUnit !== "B") errors.push("estimates.revenueUnit must be B");
  if (!value.estimates.epsBasis) errors.push("estimates.epsBasis is required");
  if (value.estimates.periods.length < 2) errors.push("estimates.periods must contain at least two rows");
  const periods = new Set();
  let observations = 0;
  value.estimates.periods.forEach((row, i) => {
    const path = `estimates.periods[${i}]`;
    if (!validDate(row.periodEnd)) errors.push(`${path}.periodEnd must be YYYY-MM-DD`);
    else if (periods.has(row.periodEnd)) errors.push(`${path}.periodEnd is duplicated`);
    else periods.add(row.periodEnd);
    const hasRevenue = row.revenueB !== undefined;
    const hasEps = row.eps !== undefined;
    if (!hasRevenue && !hasEps) errors.push(`${path} needs revenueB or eps`);
    if (hasRevenue) {
      observations++;
      numeric(errors, `${path}.revenueB`, row.revenueB, { min: 0.000001, max: 1e7 });
    }
    if (hasEps) {
      observations++;
      numeric(errors, `${path}.eps`, row.eps, { min: -1e5, max: 1e5 });
    }
    if (row.analysts !== undefined)
      numeric(errors, `${path}.analysts`, row.analysts, { min: 0, max: 10000, integer: true, optional: true });
  });
  if (observations < 2) errors.push("estimates must contain at least two numeric observations");

  const t = value.analystTarget;
  numeric(errors, "analystTarget.average", t.average, { min: 0.000001, max: 1e7 });
  numeric(errors, "analystTarget.low", t.low, { min: 0.000001, max: 1e7, optional: true });
  numeric(errors, "analystTarget.high", t.high, { min: 0.000001, max: 1e7, optional: true });
  numeric(errors, "analystTarget.analystCount", t.analystCount, { min: 1, max: 10000, integer: true, optional: true });
  numeric(errors, "analystTarget.lookbackMonths", t.lookbackMonths, { min: 1, max: 24, integer: true });
  numeric(errors, "analystTarget.horizonMonths", t.horizonMonths, { min: 12, max: 12, integer: true });
  numeric(errors, "analystTarget.referencePrice", t.referencePrice, { min: 0.000001, max: 1e7, optional: true });
  if (finite(t.low) && finite(t.average) && t.low > t.average)
    errors.push("analystTarget.low must not exceed the published average");
  if (finite(t.high) && finite(t.average) && t.high < t.average)
    errors.push("analystTarget.high must not be below the published average");
  for (const k of ["buy", "hold", "sell"])
    numeric(errors, `analystTarget.ratings.${k}`, t.ratings[k], { min: 0, max: 10000, integer: true, optional: true });
  const ratingValues = [t.ratings.buy, t.ratings.hold, t.ratings.sell];
  if (finite(t.analystCount) && ratingValues.every(finite)) {
    const total = ratingValues.reduce((a, b) => a + b, 0);
    if (total !== t.analystCount)
      errors.push(`analystTarget ratings total ${total} does not equal analystCount ${t.analystCount}`);
  }
  if (value.estimates.currency && t.currency && value.estimates.currency !== t.currency)
    errors.push("estimate and target currencies must match");

  return { ok: errors.length === 0, errors, value };
}

function growthSeries(periods, key) {
  const rows = periods.filter((r) => finite(r[key]));
  return rows.slice(1).map((row, i) => {
    const previous = rows[i];
    const days = (Date.parse(`${row.periodEnd}T12:00:00Z`) - Date.parse(`${previous.periodEnd}T12:00:00Z`)) / 86400000;
    if (days < 300 || days > 430) return null; // chart endpoints are observations, not interpolated annual rows
    const pct = previous[key] === 0 ? null : (row[key] / previous[key] - 1) * 100;
    return { from: previous.periodEnd, to: row.periodEnd, pct: round(pct) };
  }).filter(Boolean);
}

function cagr(periods, key) {
  const rows = periods.filter((r) => finite(r[key]) && r[key] > 0);
  if (rows.length < 2) return null;
  // Use the longest contiguous annual run. A visible 2035 chart tooltip after a 2029
  // table must not turn six unseen years into a smooth forecast series.
  const runs = [];
  let run = [];
  for (const row of rows) {
    const prev = run.at(-1);
    const gap = prev ? (Date.parse(`${row.periodEnd}T12:00:00Z`) - Date.parse(`${prev.periodEnd}T12:00:00Z`)) / 86400000 : null;
    if (prev && (gap < 300 || gap > 430)) { runs.push(run); run = []; }
    run.push(row);
  }
  runs.push(run);
  const annual = runs.sort((a, b) => b.length - a.length || String(b.at(-1)?.periodEnd).localeCompare(String(a.at(-1)?.periodEnd)))[0];
  if (!annual || annual.length < 2) return null;
  const first = annual[0], last = annual.at(-1);
  const sameFiscalDay = first.periodEnd.slice(4) === last.periodEnd.slice(4);
  const years = sameFiscalDay ? Number(last.periodEnd.slice(0, 4)) - Number(first.periodEnd.slice(0, 4))
    : (Date.parse(`${last.periodEnd}T12:00:00Z`) - Date.parse(`${first.periodEnd}T12:00:00Z`)) / 31557600000;
  if (!(years > 0)) return null;
  return { from: first.periodEnd, to: last.periodEnd, years: round(years, 4), pct: round((last[key] / first[key]) ** (1 / years) * 100 - 100) };
}

function nearestEpsPeriod(periods, targetDate) {
  return periods.filter((p) => finite(p.eps) && p.eps > 0).sort((a, b) =>
    Math.abs(Date.parse(`${a.periodEnd}T12:00:00Z`) - targetDate) -
    Math.abs(Date.parse(`${b.periodEnd}T12:00:00Z`) - targetDate))[0] || null;
}

export function deriveStreetMetrics(packet, quote, { now = new Date() } = {}) {
  const checked = validateStreetPacket(packet, { now });
  if (!checked.ok) return { status: "INVALID", errors: checked.errors };
  const p = checked.value;
  const directQuote = typeof quote === "number";
  const px = directQuote ? quote : quote?.value ?? quote?.px;
  const quoteOk = finite(px) && px > 0;
  const quoteCurrency = directQuote ? p.analystTarget.currency : String(quote?.currency || "").toUpperCase() || null;
  const currencyMatch = quoteCurrency ? quoteCurrency === p.analystTarget.currency : null;
  const gap = (v) => quoteOk && finite(v) ? round((v / px - 1) * 100) : null;
  const targetDate = new Date(now);
  targetDate.setUTCMonth(targetDate.getUTCMonth() + p.analystTarget.horizonMonths);
  const targetEpsPeriod = nearestEpsPeriod(p.estimates.periods, targetDate.getTime());
  return {
    status: "OK",
    symbol: p.symbol,
    quote: quoteOk ? round(px) : null,
    quoteCurrency,
    currencyMatch,
    gaps: {
      averagePct: gap(p.analystTarget.average),
      lowPct: gap(p.analystTarget.low),
      highPct: gap(p.analystTarget.high),
    },
    revenueGrowth: growthSeries(p.estimates.periods, "revenueB"),
    epsGrowth: growthSeries(p.estimates.periods, "eps"),
    revenueCagr: cagr(p.estimates.periods, "revenueB"),
    epsCagr: cagr(p.estimates.periods, "eps"),
    forwardPe: p.estimates.periods.filter((r) => finite(r.eps) && r.eps > 0)
      .map((r) => ({ periodEnd: r.periodEnd, value: quoteOk ? round(px / r.eps) : null })),
    targetImpliedPe: targetEpsPeriod ? {
      periodEnd: targetEpsPeriod.periodEnd,
      value: round(p.analystTarget.average / targetEpsPeriod.eps),
    } : null,
    freshness: {
      estimatesAgeDays: ageDays(p.estimates.asOf, now),
      estimatesStatus: ageDays(p.estimates.asOf, now) <= ESTIMATE_FRESH_DAYS ? "PASS" : "FAIL",
      targetAgeDays: ageDays(p.analystTarget.asOf, now),
      targetStatus: ageDays(p.analystTarget.asOf, now) <= TARGET_FRESH_DAYS ? "PASS" : "FAIL",
    },
    analystConfidence: finite(p.analystTarget.analystCount) ? (p.analystTarget.analystCount <= 2 ? "THIN" : "KNOWN") : "UNKNOWN",
    target: p.analystTarget,
    periods: p.estimates.periods,
  };
}

export function renormalizeComposite(pillars, { minimum = COMPOSITE_MIN_SCORE } = {}) {
  const entries = Object.entries(pillars && typeof pillars === "object" ? pillars : {});
  const used = [], missing = [];
  for (const [name, raw] of entries) {
    const item = finite(raw) ? { score: raw, weight: 1, status: "AVAILABLE" } : (raw || {});
    const score = item.score;
    const weight = finite(item.weight) && item.weight > 0 ? item.weight : 1;
    if (!finite(score) || score < 0 || score > 10 || /UNKNOWN|MISSING|ERROR|STALE/.test(String(item.status || ""))) {
      missing.push(name);
      continue;
    }
    used.push({ name, score, weight, evidence: Array.isArray(item.evidence) ? item.evidence : [] });
  }
  if (!used.length) return { status: "UNKNOWN", score: null, minimum, used: [], missing, reason: "no usable composite pillars" };
  const totalWeight = used.reduce((sum, x) => sum + x.weight, 0);
  const score = round(used.reduce((sum, x) => sum + x.score * x.weight, 0) / totalWeight, 3);
  return {
    status: score >= minimum ? "PASS" : "FAIL",
    score, minimum, used: used.map((x) => ({ ...x, normalizedWeight: round(x.weight / totalWeight, 4) })), missing,
    reason: `${score.toFixed(1)}/10 across ${used.length} available pillar${used.length === 1 ? "" : "s"}`,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// The legacy composite names five pillars (V/G/P/M/R) but a first licensed screenshot
// contains no prior estimate snapshot from which a revision can be measured. V/G/P/M are
// deterministic and cited to their inputs; R stays missing and renormalizeComposite spreads
// no phantom zero across the other four. Once a prior street revision exists, callers can
// supply revisionScore and its evidence.
export function deriveAutomaticComposite(metrics, technicals, { revisionScore = null, revisionEvidence = [] } = {}) {
  if (!metrics || metrics.status !== "OK") return renormalizeComposite({});
  const avgGap = metrics.gaps?.averagePct;
  const revCagr = metrics.revenueCagr?.pct;
  const epsCagr = metrics.epsCagr?.pct;
  const positiveEps = metrics.periods?.filter((r) => finite(r.eps)).every((r) => r.eps > 0);
  const valuation = finite(avgGap) ? round(clamp(5.5 + (avgGap - STREET_GAP_MIN_PCT) / 8, 0, 10), 2) : null;
  const growthInputs = [revCagr, epsCagr].filter(finite);
  const growthRate = growthInputs.length ? growthInputs.reduce((a, b) => a + b, 0) / growthInputs.length : null;
  const growth = finite(growthRate) ? round(clamp(4 + growthRate / 7, 0, 10), 2) : null;
  const profitability = finite(epsCagr) ? round(clamp((positiveEps ? 5.5 : 2.5) + epsCagr / 10, 0, 10), 2) : null;
  const momentumBase = technicals?.trend === "UPTREND" ? 7.5 : technicals?.trend === "MIXED" ? 5.5 : technicals?.trend === "DOWNTREND" ? 3 : null;
  const supportQuality = technicals?.support?.quality;
  const momentum = finite(momentumBase) ? round(clamp(momentumBase + (finite(supportQuality) ? (supportQuality - 5) / 5 : 0), 0, 10), 2) : null;
  return renormalizeComposite({
    valuation: finite(valuation) ? { score: valuation, evidence: [`TipRanks average gap ${round(avgGap, 1)}%`] } : { status: "UNKNOWN" },
    growth: finite(growth) ? { score: growth, evidence: [`revenue CAGR ${round(revCagr, 1)}%`, `EPS CAGR ${round(epsCagr, 1)}%`].filter((x) => !x.includes("null")) } : { status: "UNKNOWN" },
    profitability: finite(profitability) ? { score: profitability, evidence: [`positive forward EPS ${positiveEps}`, `EPS CAGR ${round(epsCagr, 1)}%`] } : { status: "UNKNOWN" },
    momentum: finite(momentum) ? { score: momentum, evidence: technicals?.evidence || [] } : { status: "UNKNOWN" },
    revisions: finite(revisionScore) ? { score: revisionScore, evidence: revisionEvidence } : { status: "MISSING" },
  });
}

const gate = (id, status, reason, evidence = []) => ({ id, status, reason, evidence });

function factValue(facts, name) {
  const f = facts?.fields?.[name] ?? facts?.[name];
  if (f && typeof f === "object" && "value" in f) return f;
  return f === undefined ? null : { value: f, status: "UNKNOWN" };
}

function macroGate(readout) {
  const regime = readout?.regime || readout;
  const actionability = String(regime?.actionability || readout?.actionability || "").toUpperCase();
  const verdict = String(regime?.verdict || readout?.verdict || "").toUpperCase();
  const flip = readout?.macro_flip || regime?.macro_flip;
  const canGate = readout?.health?.can_gate;
  const evidence = [
    actionability && `actionability ${actionability}`,
    verdict && `verdict ${verdict}`,
    canGate !== undefined && `health.can_gate ${canGate}`,
    flip?.evaluable !== undefined && `Macro Flip evaluable ${flip.evaluable}`,
  ].filter(Boolean);
  if (!actionability || !verdict) return gate("macro", "UNKNOWN", "Engine 0 actionability or verdict is unavailable", evidence);
  if (actionability === "HOLD") return gate("macro", "FAIL", "Engine 0 says HOLD", evidence);
  if (actionability === "RESTRICTED") return gate("macro", "FAIL", "Engine 0 is RESTRICTED; only FULL may gate capital", evidence);
  if (canGate === false) return gate("macro", "FAIL", "Engine 0 health cannot gate capital", evidence);
  if (!flip || flip.evaluable !== true) return gate("macro", "FAIL", "Macro Flip is not evaluable", evidence);
  if (flip.tripped === true || verdict === "PANIC") return gate("macro", "FAIL", "macro risk circuit is tripped", evidence);
  if (actionability !== "FULL")
    return gate("macro", "UNKNOWN", `unrecognized Engine 0 actionability ${actionability}`, evidence);
  return gate("macro", "PASS", "Engine 0 permits full evaluation", evidence);
}

// v3.91 (audit #5): the closed-market carry window for a last-close print. 72h covers a
// weekend + one holiday; anything older is a genuinely dead feed, not a closed market.
export const QUOTE_CLOSED_MAX_AGE_HOURS = 72;

function quoteGate(quote, now, session = null) {
  if (!quote || !finite(quote.value) || quote.value <= 0)
    return gate("quote", "UNKNOWN", "no usable sourced quote", []);
  const status = String(quote.status || "UNKNOWN").toUpperCase();
  if (["ERROR", "MISSING", "STALE", "UNKNOWN"].includes(status))
    return gate("quote", "UNKNOWN", `quote status is ${status}`, [quote.observedAt, quote.provider].filter(Boolean));
  // Retrieval time is not market observation time. Falling back to it would let a delayed
  // provider response relabel an old print as a fresh quote.
  const observed = Date.parse(String(quote.observedAt || ""));
  const ageMinutes = Number.isFinite(observed) ? (now.getTime() - observed) / 60000 : null;
  if (ageMinutes === null || ageMinutes < -5)
    return gate("quote", "UNKNOWN", ageMinutes === null ? "quote observation time is unavailable" : "quote observation time is in the future",
      [quote.observedAt, quote.retrievedAt].filter(Boolean));
  /* v3.91 (audit #5): SESSION-AWARE freshness. The 15-minute rule is an intraday claim —
     applied around the clock it made street eligibility perpetually WAIT outside regular
     hours, because every close print is >15min old by 16:16 ET. Outside an OPEN session the
     last close IS the freshest fact the market has produced, so it passes inside a bounded
     carry window, with the session NAMED on the gate. session comes from the same Engine 0
     readout the macro gate already consumes (one clock, never a second session derivation);
     an UNAVAILABLE session keeps the strict intraday rule — fail closed, never assume closed. */
  const sess = String(session || "").toUpperCase();
  const marketOpen = sess ? sess === "OPEN" : true;   // unknown session → strict
  if (marketOpen) {
    if (ageMinutes > QUOTE_MAX_AGE_MINUTES)
      return gate("quote", "UNKNOWN", `quote is ${Math.round(ageMinutes)} minutes old`,
        [quote.observedAt, quote.retrievedAt, `maximum ${QUOTE_MAX_AGE_MINUTES} minutes intraday`].filter(Boolean));
    return gate("quote", "PASS", `usable ${status.toLowerCase()} quote`, [quote.provider, quote.observedAt].filter(Boolean));
  }
  if (ageMinutes > QUOTE_CLOSED_MAX_AGE_HOURS * 60)
    return gate("quote", "UNKNOWN", `quote is ${Math.round(ageMinutes / 60)} hours old — past the closed-market carry window`,
      [quote.observedAt, `maximum ${QUOTE_CLOSED_MAX_AGE_HOURS}h while closed`].filter(Boolean));
  return gate("quote", "PASS", `market ${sess} — last-close print accepted (${Math.round(ageMinutes / 60)}h old)`,
    [quote.provider, quote.observedAt].filter(Boolean));
}

function binaryGate(nextEvent, now) {
  if (!nextEvent || !validDate(nextEvent.value)) return gate("binary", "UNKNOWN", "earnings/catalyst calendar is unavailable", []);
  const status = String(nextEvent.status || "UNKNOWN").toUpperCase();
  if (!["LIVE", "CACHED"].includes(status))
    return gate("binary", "UNKNOWN", `earnings/catalyst calendar status is ${status}`, [nextEvent.provider, nextEvent.observedAt].filter(Boolean));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
  const event = new Date(`${nextEvent.value}T12:00:00Z`);
  const days = Math.round((event - today) / 86400000);
  if (days < 0) return gate("binary", "UNKNOWN", "next event date is in the past", [nextEvent.value]);
  if (days <= BINARY_WINDOW_DAYS)
    return gate("binary", "FAIL", `binary event in ${days} day${days === 1 ? "" : "s"} (≤${BINARY_WINDOW_DAYS})`, [nextEvent.value, nextEvent.provider].filter(Boolean));
  return gate("binary", "PASS", `next binary event is ${days} days away`, [nextEvent.value, nextEvent.provider].filter(Boolean));
}

export function rewardRiskFloor(tier = "core", regimeVerdict = "NEUTRAL") {
  const base = RR_FLOORS[String(tier).toLowerCase()] ?? RR_FLOORS.core;
  return base + (String(regimeVerdict).toUpperCase() === "HEADWIND" ? 0.5 : 0);
}

export function buildGateReceipt({ street, facts, readout, composite, qualitative, technicals, tier = "core", now = new Date() } = {}) {
  const quote = factValue(facts, "quote");
  const metrics = street ? deriveStreetMetrics(street, quote, { now }) : { status: "INVALID", errors: ["street packet unavailable"] };
  // v3.91 (audit #5): the session comes from the SAME readout the macro gate consumes —
  // one clock. Absent → quoteGate stays strict intraday.
  const session = readout?.session || readout?.regime?.session || null;
  const gates = [];
  gates.push(macroGate(readout));
  gates.push(quoteGate(quote, now, session));

  if (metrics.status !== "OK") {
    gates.push(gate("street_gap", "UNKNOWN", "confirmed street packet is unavailable or invalid", metrics.errors || []));
    gates.push(gate("licensed_freshness", "UNKNOWN", "licensed-input freshness cannot be established", metrics.errors || []));
  } else {
    const avgGap = metrics.gaps.averagePct;
    gates.push(metrics.currencyMatch !== true
      ? gate("street_gap", "UNKNOWN", metrics.currencyMatch === false
        ? `quote currency ${metrics.quoteCurrency} does not match target currency ${metrics.target.currency}`
        : "sourced quote currency is unavailable", [metrics.quoteCurrency, metrics.target.currency].filter(Boolean))
      : avgGap === null
      ? gate("street_gap", "UNKNOWN", "street gap cannot be computed without a quote", [])
      : avgGap >= STREET_GAP_MIN_PCT
        ? gate("street_gap", "PASS", `TipRanks published average is ${round(avgGap, 1)}% above the sourced quote`, [`minimum ${STREET_GAP_MIN_PCT}%`])
        : gate("street_gap", "FAIL", `TipRanks published average is only ${round(avgGap, 1)}% above the sourced quote`, [`minimum ${STREET_GAP_MIN_PCT}%`]));
    const fresh = metrics.freshness.estimatesStatus === "PASS" && metrics.freshness.targetStatus === "PASS";
    gates.push(gate("licensed_freshness", fresh ? "PASS" : "FAIL",
      fresh ? "SA estimates and TipRanks target are current" : "licensed estimates or target are stale",
      [`SA ${metrics.freshness.estimatesAgeDays}d`, `TipRanks ${metrics.freshness.targetAgeDays}d`]));
  }

  if (!composite || composite.status === "UNKNOWN")
    gates.push(gate("composite", "UNKNOWN", composite?.reason || "composite evidence is unavailable", composite?.missing || []));
  else gates.push(gate("composite", composite.status === "PASS" ? "PASS" : "FAIL", composite.reason,
    [...(composite.used || []).map((x) => `${x.name} ${x.score}`), ...(composite.missing || []).map((x) => `${x} unavailable`)]));

  if (!qualitative || qualitative.status === "UNKNOWN")
    gates.push(gate("qualitative", "UNKNOWN", qualitative?.reason || "cited qualitative evidence is unavailable", qualitative?.citations || []));
  else {
    const citations = Array.isArray(qualitative.citations) ? qualitative.citations.filter((x) => typeof x === "string" && /^https?:\/\//.test(x)) : [];
    const qStatus = qualitative.status === "PASS" && citations.length ? "PASS" : qualitative.status === "FAIL" ? "FAIL" : "UNKNOWN";
    gates.push(gate("qualitative", qStatus,
      citations.length ? qualitative.reason || "qualitative rubric evaluated" : "qualitative judgment has no validated citation",
      citations));
  }

  const verdict = readout?.regime?.verdict || readout?.verdict;
  const floor = rewardRiskFloor(tier, verdict);
  if (!technicals || !finite(technicals.rewardRisk))
    gates.push(gate("reward_risk", "UNKNOWN", "reward/risk cannot be computed from sourced candles and a stop", [`minimum ${floor}x`]));
  else gates.push(technicals.rewardRisk >= floor
    ? gate("reward_risk", "PASS", `${round(technicals.rewardRisk, 2)}x reward/risk clears ${floor}x`, technicals.evidence || [])
    : gate("reward_risk", "FAIL", `${round(technicals.rewardRisk, 2)}x reward/risk is below ${floor}x`, technicals.evidence || []));

  /* v3.91 (audit #4): the binary window REPORTS, never enforces — the BINCAL doctrine
     (v3.26) now holds on BOTH surfaces. v3.90 had the same earnings date hard-veto street
     eligibility while the canonical board deliberately only reported it: a doctrine
     inversion between two surfaces reading one fact. The gate still evaluates (its FAIL/
     UNKNOWN states are real information) but it sits OUTSIDE the eligibility set: it can
     never produce WAIT, only a named warning the receipt carries. */
  const binary = binaryGate(factValue(facts, "nextEarnings"), now);
  const eligible = gates.every((g) => g.status === "PASS");
  const warnings = [];
  if (binary.status === "FAIL")
    warnings.push(`${binary.reason} — reported, never enforced (BINCAL doctrine); sizing near a print is the owner's call`);
  else if (binary.status === "UNKNOWN")
    warnings.push(`binary calendar: ${binary.reason}`);
  if (metrics.status === "OK" && metrics.analystConfidence === "UNKNOWN")
    warnings.push("TipRanks analyst count was not captured; coverage confidence is unknown");
  else if (metrics.status === "OK" && metrics.analystConfidence === "THIN")
    warnings.push(`TipRanks target has thin analyst coverage (${metrics.target.analystCount})`);
  return {
    schema: TT_ANALYSIS_SCHEMA,
    engineVersion: TT_ENGINE_VERSION,
    symbol: street?.symbol || facts?.symbol || null,
    evaluatedAt: now.toISOString(),
    status: eligible ? "ELIGIBLE" : "WAIT",
    eligible,
    gates,
    binary,
    blockers: gates.filter((g) => g.status !== "PASS").map((g) => ({ id: g.id, status: g.status, reason: g.reason })),
    warnings,
    metrics: metrics.status === "OK" ? metrics : null,
    technicals: technicals || null,
    composite: composite || null,
    qualitative: qualitative || null,
    policy: { streetGapMinPct: STREET_GAP_MIN_PCT, binaryWindowDays: BINARY_WINDOW_DAYS, rrFloor: floor, riskTier: tier },
  };
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : stableStringify(value));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function attestGateReceipt(receipt, inputs) {
  const inputHash = await sha256Hex(inputs);
  const resultHash = await sha256Hex(receipt);
  return {
    at: receipt.evaluatedAt,
    engineVersion: receipt.engineVersion,
    inputVersions: {
      street: inputs?.street?.confirmedAt || null,
      facts: inputs?.facts?.updatedAt || null,
      regime: inputs?.readout?.as_of || inputs?.readout?.asOf || inputs?.readout?.generated_at || null,
      regimeActionability: inputs?.readout?.regime?.actionability || null,
      regimeVerdict: inputs?.readout?.regime?.verdict || null,
      macroFlipState: inputs?.readout?.macro_flip?.state || null,
      riskTier: inputs?.riskTier || null,
    },
    inputHash,
    resultHash,
    status: receipt.status,
  };
}
