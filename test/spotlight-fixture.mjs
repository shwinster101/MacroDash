// SYNTHETIC Stock Spotlight fixture (v6.5.0) — shared by test/smoke.mjs and
// test/public-render.mjs so both suites exercise the SAME contract shape the widget renders.
// Every number is invented; dates are COMPUTED relative to today (the v3.35 rule — a fixture
// stamped "today" at write time rots at the first midnight). No real filing figure enters
// this repo through here.
import { buildCompany, buildTracker, buildSpotlightModel, extractSpotlightFundamentals, projectSpotlight, freshenSpotlight } from "../functions/lib/spotlight.js";
import { etYmd, isSessionDay } from "../src/sources.js";

const ymd = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => ymd(new Date(Date.parse(`${s}T12:00:00Z`) + n * 86400000));

/* Trading-day closes from `from` to `to` (inclusive), skipping weekends/holidays, following a
   deterministic path so a dividend-adjusted twin can be derived from the same closes. */
export function closes(from, to, { start = 100, drift = 0.001, seed = 1, skip = [] } = {}) {
  const rows = [];
  let v = start, x = seed, d = from;
  while (d <= to) {
    if (isSessionDay(d) && !skip.includes(d)) {
      x = (x * 9301 + 49297) % 233280;
      v = v * (1 + drift + ((x / 233280) - 0.5) * 0.02);
      rows.push({ date: d, value: Math.round(v * 100) / 100, close: Math.round(v * 100) / 100 });
    }
    d = addDays(d, 1);
  }
  return rows;
}

/* A companyfacts-shaped SEC fixture: four 10-Q quarters + a 10-K, cumulative YTD facts so the
   extractor has to DERIVE Q2/Q3/Q4 (the real shape of a US filer's XBRL). */
export function companyFacts({ revenueQ = [60e9, 62e9, 65e9, 70e9, 76e9], opIncQ = [27e9, 28e9, 29e9, 31e9, 35e9],
  netIncQ = [22e9, 23e9, 24e9, 26e9, 29e9], ocfQ = [30e9, 31e9, 33e9, 35e9, 38e9], capexQ = [14e9, 15e9, 16e9, 17e9, 20e9],
  cash = 30e9, debt = 40e9, shares = 7.43e9, quarterEnds, form = "10-Q", taxonomy = "us-gaap", entityName = "Fixture Corp" } = {}) {
  // quarterEnds: five consecutive quarter ends, oldest first; the fiscal year ends at [3].
  const qe = quarterEnds;
  const fyStart = addDays(qe[0], -90);
  const cum = (arr, n) => arr.slice(0, n).reduce((a, b) => a + b, 0);
  const dur = (start, end, val, f, filed) => ({ start, end, val, form: f, filed, accn: `000-${end}` });
  const facts = (arr) => [
    dur(fyStart, qe[0], arr[0], form, addDays(qe[0], 30)),
    dur(fyStart, qe[1], cum(arr, 2), form, addDays(qe[1], 30)),
    dur(fyStart, qe[2], cum(arr, 3), form, addDays(qe[2], 30)),
    dur(fyStart, qe[3], cum(arr, 4), form === "10-Q" ? "10-K" : "20-F", addDays(qe[3], 45)),
    dur(addDays(qe[3], 1), qe[4], arr[4], form, addDays(qe[4], 30)),
  ];
  const inst = (val, end) => [{ end, val, form, filed: addDays(end, 30), accn: `000-${end}` }];
  const tags = taxonomy === "ifrs-full"
    ? { rev: "Revenue", op: "ProfitLossFromOperatingActivities", ni: "ProfitLoss", ocf: "CashFlowsFromUsedInOperatingActivities", capex: "PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", cash: "CashAndCashEquivalents", debt: "Borrowings" }
    : { rev: "Revenues", op: "OperatingIncomeLoss", ni: "NetIncomeLoss", ocf: "NetCashProvidedByUsedInOperatingActivities", capex: "PaymentsToAcquirePropertyPlantAndEquipment", cash: "CashAndCashEquivalentsAtCarryingValue", debt: "LongTermDebtNoncurrent" };
  const fx = { entityName, facts: { [taxonomy]: {
    [tags.rev]: { units: { USD: facts(revenueQ) } }, [tags.op]: { units: { USD: facts(opIncQ) } }, [tags.ni]: { units: { USD: facts(netIncQ) } },
    [tags.ocf]: { units: { USD: facts(ocfQ) } }, [tags.capex]: { units: { USD: facts(capexQ) } },
    [tags.cash]: { units: { USD: inst(cash, qe[4]) } },
  }, dei: { EntityCommonStockSharesOutstanding: { units: { shares: inst(shares, addDays(qe[4], 20)) } } } } };
  if (debt !== null) fx.facts[taxonomy][tags.debt] = { units: { USD: inst(debt, qe[4]) } };
  return fx;
}

/* Five consecutive quarter ends, the latest ending ~40 days before `today`. */
export function quarterEnds(today) {
  const latest = addDays(today, -40);
  const ends = [latest];
  for (let i = 1; i < 5; i++) ends.unshift(addDays(ends[0], -91));
  return ends;
}

export function makeSpotlightFixture({ now = new Date(), stale = false, anchorSeriesMissing = false, capMissing = false } = {}) {
  const today = etYmd(now);
  const year = today.slice(0, 4);
  const lastObs = stale ? addDays(today, -12) : today;
  const from = `${Number(year) - 1}-11-15`;
  const nbisRows = closes(from, lastObs, { start: 24, drift: 0.004, seed: 7 });
  const msftRows = closes(from, lastObs, { start: 420, drift: 0.0008, seed: 3 });
  const qe = quarterEnds(today);
  const nbisFacts = extractSpotlightFundamentals(companyFacts({ revenueQ: [105e6, 147e6, 245e6, 350e6, 582e6], opIncQ: [-80e6, -90e6, -95e6, -70e6, -40e6],
    netIncQ: [-100e6, -110e6, -120e6, -90e6, -60e6], ocfQ: [-20e6, -10e6, 5e6, 20e6, 60e6], capexQ: [400e6, 600e6, 900e6, 1500e6, 2200e6],
    cash: 3.2e9, debt: 1.0e9, shares: 250e6, quarterEnds: qe, form: "6-K", taxonomy: "ifrs-full", entityName: "Nebius Group N.V." }),
    { retrievedAt: now.toISOString(), sourceUrl: "https://www.sec.gov/edgar/browse/?CIK=0001513845" });
  const msftFacts = extractSpotlightFundamentals(companyFacts({ quarterEnds: qe, entityName: "MICROSOFT CORP" }),
    { retrievedAt: now.toISOString(), sourceUrl: "https://www.sec.gov/edgar/browse/?CIK=0000789019" });
  // capMissing: the provider cap AND the quote are dark, so nothing can be derived either — the
  // widget's genuine "Unavailable — reason" path (with a quote it would correctly DERIVE a cap).
  const facts = (sym, px, capM, shOutM, mcMissing) => ({
    quote: mcMissing ? { value: null, status: "MISSING", provider: "Finnhub", reason: "quote unavailable" }
      : { value: px, currency: "USD", status: "LIVE", provider: "Finnhub", sourceUrl: "https://finnhub.io/", observedAt: `${lastObs}T20:00:00.000Z` },
    marketCap: mcMissing ? { value: null, status: "MISSING", provider: "Finnhub", reason: "profile carries no market capitalization" }
      : { value: capM, unit: "USD M", currency: "USD", status: "LIVE", provider: "Finnhub (profile market capitalization)", sourceUrl: "https://finnhub.io/", observedAt: lastObs },
    sharesOutstanding: { value: shOutM * 1e6, unit: "shares", kind: "outstanding", status: "LIVE", provider: "Finnhub (profile shares outstanding)", observedAt: lastObs },
    nextEarnings: { value: addDays(today, 50), status: "LIVE", provider: "Finnhub", sourceUrl: "https://finnhub.io/" },
  });
  // The real refresh hands the tracker a series fact WITH its symbol even when the rows are
  // missing (companyFromRecord), so the missing leg can be NAMED; the fixture mirrors that.
  const nbisSeries = anchorSeriesMissing ? { symbol: "NBIS", rows: null, unavailable: "return series unavailable" } : { symbol: "NBIS", basis: "price_return", provider: "Nasdaq daily history (closes — dividends not included)", sourceUrl: "https://www.nasdaq.com/market-activity/stocks", rows: nbisRows, currency: "USD" };
  const msftSeries = { symbol: "MSFT", basis: "total_return", provider: "Tiingo (adjClose — split- and dividend-adjusted)", sourceUrl: "https://www.tiingo.com/", rows: msftRows, currency: "USD" };
  const nbis = buildCompany({ symbol: "NBIS", name: "Nebius Group", facts: facts("NBIS", nbisRows[nbisRows.length - 1].value, 70_100, 250, capMissing), fundamentals: nbisFacts, series: nbisSeries.rows ? nbisSeries : null, today, now });
  const msft = buildCompany({ symbol: "MSFT", name: "Microsoft", facts: facts("MSFT", msftRows[msftRows.length - 1].value, 3_410_000, 7430, false), fundamentals: msftFacts, series: msftSeries, today, now });
  const tracker = buildTracker(nbisSeries, msftSeries, today);
  const rotation = { index: 0, weekKey: "2026-09-14", advanced: false, first: true };
  const model = buildSpotlightModel({ anchor: nbis, comparison: msft, rotation, tracker, now, failures: [] });
  return { model, projected: projectSpotlight(freshenSpotlight(model, now)), today, lastObs, nbisRows, msftRows, qe };
}
