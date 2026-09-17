// Palette Move 1a — Nasdaq/Zacks street-target mapper.
// Pure, browser-free, fail-closed. Unknown shapes leave numeric fields empty and warn;
// low/high are never averaged into a published mean. Lookback is never invented.

import { matchStreetSource } from "./tt-v2.js";

export const NASDAQ_STREET_HEADERS = Object.freeze({
  "User-Agent": "Mozilla/5.0 (compatible; MacroDash/1.0)",
  Accept: "application/json, text/plain, */*",
  Origin: "https://www.nasdaq.com",
  Referer: "https://www.nasdaq.com/",
});

const NASDAQ_SOURCE = matchStreetSource("analystTarget", "Nasdaq (Zacks consensus)");
export const NASDAQ_TARGET_PROVIDER = NASDAQ_SOURCE.canonical;
export const NASDAQ_TARGETPRICE_PATH = "/api/analyst/{sym}/targetprice";

const finite = (v) => typeof v === "number" && Number.isFinite(v);

function nasdaqNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/[$,]/g, "");
  if (!cleaned || cleaned === "—" || cleaned === "N/A" || cleaned === "n/a") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function positivePrice(n) {
  return n !== null && n > 0 ? n : null;
}

function wholeCount(n, { min = 0 } = {}) {
  if (n === null || n < min || !Number.isFinite(n)) return null;
  return Number.isInteger(n) ? n : null;
}

function getPath(obj, path) {
  return path.split(".").reduce((cur, key) => {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    return cur[key];
  }, obj);
}

function firstNumber(root, paths) {
  for (const path of paths) {
    const n = nasdaqNumber(getPath(root, path));
    if (n !== null) return n;
  }
  return null;
}

function nasdaqDate(value) {
  const s = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

function nasdaqSourceUrl(symbol) {
  const sym = String(symbol || "").trim().toLowerCase();
  return sym
    ? `https://www.nasdaq.com/market-activity/stocks/${encodeURIComponent(sym)}`
    : "https://www.nasdaq.com/";
}

export function blankNasdaqDraft(symbol = "", asOf = new Date().toISOString().slice(0, 10)) {
  const sym = String(symbol || "").trim().toUpperCase();
  return {
    symbol: sym,
    confirmedAt: null,
    estimates: {
      provider: "Seeking Alpha", sourceUrl: "https://seekingalpha.com/", asOf,
      currency: "USD", revenueUnit: "B", epsBasis: "provider-consensus", periods: [],
    },
    analystTarget: {
      provider: NASDAQ_TARGET_PROVIDER,
      sourceUrl: nasdaqSourceUrl(sym),
      asOf,
      currency: "USD",
      average: null, low: null, high: null, analystCount: null,
      ratings: { buy: null, hold: null, sell: null },
      lookbackMonths: null,
      horizonMonths: 12,
      referencePrice: null,
    },
  };
}

const AVERAGE_PATHS = [
  "data.priceTarget.consensusPriceTarget",
  "data.priceTarget.priceTarget",
  "data.consensusPriceTarget",
  "priceTarget.consensusPriceTarget",
  "consensusPriceTarget",
];
const LOW_PATHS = [
  "data.priceTarget.lowPriceTarget",
  "data.lowPriceTarget",
  "data.priceTarget.low",
  "priceTarget.lowPriceTarget",
  "lowPriceTarget",
];
const HIGH_PATHS = [
  "data.priceTarget.highPriceTarget",
  "data.highPriceTarget",
  "data.priceTarget.high",
  "priceTarget.highPriceTarget",
  "highPriceTarget",
];
const COUNT_PATHS = [
  "data.priceTarget.numOfAnalysts",
  "data.priceTarget.numberOfAnalysts",
  "data.priceTarget.numOfBrokers",
  "data.numOfAnalysts",
  "data.numberOfAnalysts",
  "data.consensusOverview.numOfAnalysts",
  "priceTarget.numOfAnalysts",
  "priceTarget.numberOfAnalysts",
  "priceTarget.numOfBrokers",
  "consensusOverview.numOfAnalysts",
  "numOfAnalysts",
];
const BUY_PATHS = [
  "data.consensusOverview.buyCount", "data.buyCount",
  "consensusOverview.buyCount", "buyCount",
];
const HOLD_PATHS = [
  "data.consensusOverview.holdCount", "data.holdCount",
  "consensusOverview.holdCount", "holdCount",
];
const SELL_PATHS = [
  "data.consensusOverview.sellCount", "data.sellCount",
  "consensusOverview.sellCount", "sellCount",
];
const REF_PATHS = [
  "data.priceTarget.lastSalePrice", "data.lastSalePrice",
  "data.referencePrice", "priceTarget.lastSalePrice",
];
const DATE_PATHS = [
  "data.priceTarget.asOf", "data.priceTarget.effectiveDate",
  "data.asOf", "data.effectiveDate", "asOf", "effectiveDate",
];

function scalarPriceTarget(root) {
  const nested = getPath(root, "data.priceTarget");
  if (nested !== undefined && nested !== null && typeof nested !== "object")
    return nasdaqNumber(nested);
  const top = getPath(root, "priceTarget");
  if (top !== undefined && top !== null && typeof top !== "object")
    return nasdaqNumber(top);
  return null;
}

export function nasdaqStreetDraft(payload, { symbol = "", asOf = new Date().toISOString().slice(0, 10), sourceUrl } = {}) {
  const warnings = [];
  const draft = blankNasdaqDraft(symbol, asOf);
  if (sourceUrl) draft.analystTarget.sourceUrl = sourceUrl;
  const t = draft.analystTarget;
  const root = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
  if (!root) {
    warnings.push("Nasdaq analyst payload was empty or not an object; numeric fields left empty");
    return { draft, warnings };
  }

  const published = nasdaqDate(DATE_PATHS.map((p) => getPath(root, p)).find((v) => v != null && v !== ""));
  if (published) t.asOf = published;
  else warnings.push("Nasdaq did not publish an as-of date; draft uses the retrieval date — verify before CONFIRM");

  let average = positivePrice(firstNumber(root, AVERAGE_PATHS));
  if (average === null) average = positivePrice(scalarPriceTarget(root));
  const low = positivePrice(firstNumber(root, LOW_PATHS));
  const high = positivePrice(firstNumber(root, HIGH_PATHS));
  const analystCount = wholeCount(firstNumber(root, COUNT_PATHS), { min: 1 });
  const buy = wholeCount(firstNumber(root, BUY_PATHS), { min: 0 });
  const hold = wholeCount(firstNumber(root, HOLD_PATHS), { min: 0 });
  const sell = wholeCount(firstNumber(root, SELL_PATHS), { min: 0 });
  const referencePrice = positivePrice(firstNumber(root, REF_PATHS));

  if (average !== null) t.average = average;
  else if (low !== null && high !== null)
    warnings.push("Nasdaq published low/high but no consensus average; low/high were not averaged into a fake mean");
  else warnings.push("Nasdaq analyst payload did not match a known target-price shape; numeric fields left empty");

  if (low !== null) t.low = low;
  if (high !== null) t.high = high;
  if (analystCount !== null) t.analystCount = analystCount;
  if (buy !== null) t.ratings.buy = buy;
  if (hold !== null) t.ratings.hold = hold;
  if (sell !== null) t.ratings.sell = sell;
  if (referencePrice !== null) t.referencePrice = referencePrice;

  if (finite(t.analystCount) && [t.ratings.buy, t.ratings.hold, t.ratings.sell].every(finite)) {
    const total = t.ratings.buy + t.ratings.hold + t.ratings.sell;
    if (total !== t.analystCount)
      warnings.push(`ratings total ${total} does not equal analystCount ${t.analystCount} — verify before CONFIRM`);
  }

  t.lookbackMonths = null;
  t.horizonMonths = 12;
  t.provider = NASDAQ_TARGET_PROVIDER;
  draft.confirmedAt = null;
  return { draft, warnings };
}

export function nasdaqTargetpriceUrl(sym) {
  return `https://api.nasdaq.com/api/analyst/${encodeURIComponent(sym)}/targetprice`;
}
