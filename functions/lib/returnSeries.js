// Shared verified adjusted-close adapter; no network or storage.
import { candleSeriesFault } from "./tt-facts.js";
const missing=(provider,reason,retrievedAt,sourceUrl)=>({value:null,status:"MISSING",provider,reason,retrievedAt,sourceUrl});

/* The structural signature of a split- AND dividend-adjusted close series (review #1, #5):
   the adjustment factor adjClose/close must be NON-DECREASING through time and equal 1 at
   the latest row (every adjustment applies backward from the present). A raw-close jump
   larger than the continuity band is accepted ONLY where the provider's own corporate-action
   evidence (splitFactor on that row) explains it; continuity itself is judged on the ADJUSTED
   series, which is continuous through a valid split. Returns {ok, reason}. */
export function verifyAdjustedSeries(rows) {
  const xs = (rows || []).filter((r) => Number.isFinite(r.value) && Number.isFinite(r.close) && r.value > 0 && r.close > 0);
  if (xs.length < 2) return { ok: false, reason: "too few rows with both close and adjClose to verify adjustment" };
  const last = xs[xs.length - 1];
  const lastRatio = last.value / last.close;
  if (Math.abs(lastRatio - 1) > 0.005) return { ok: false, reason: `latest adjClose/close is ${lastRatio.toFixed(4)}, not 1 — the series is not adjusted to the present` };
  let prev = xs[0].value / xs[0].close;
  for (let i = 1; i < xs.length; i++) {
    const ratio = xs[i].value / xs[i].close;
    // Provider closes are rounded (2–4 dp), so the factor jitters at the 1e-5 level between
    // rows; a genuine step (a dividend, a split) is orders of magnitude larger. 2e-4 relative.
    if (ratio < prev * (1 - 2e-4)) return { ok: false, reason: `adjustment factor falls at ${xs[i].date} (${prev.toFixed(4)} → ${ratio.toFixed(4)}) — not a backward-applied adjustment series` };
    prev = ratio;
    const jump = xs[i].close / xs[i - 1].close;
    if (jump > 3 || jump < 1 / 3) {
      const sf = Number(xs[i].splitFactor);
      const expected = xs[i - 1].close / xs[i].close;
      if (!(sf > 0) || Math.abs(sf / expected - 1) > 0.05)
        return { ok: false, reason: `raw close moves ${jump.toFixed(2)}× at ${xs[i].date} with no matching corporate-action evidence (splitFactor ${sf || "absent"})` };
    }
  }
  return { ok: true, reason: null };
}
export function tiingoSeries(raw, retrievedAt, refPx) {
  const rows = (Array.isArray(raw) ? raw : []).map((r) => ({ date: String(r?.date || "").slice(0, 10), value: Number(r?.adjClose), close: Number(r?.close),
      splitFactor: r?.splitFactor === undefined ? undefined : Number(r.splitFactor), divCash: r?.divCash === undefined ? undefined : Number(r.divCash) }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.value) && r.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length < 2) return missing("Tiingo", "daily adjusted-close response was empty", retrievedAt, "https://www.tiingo.com/");
  // Continuity on the ADJUSTED series (continuous through a valid split); the quote cross-check
  // still applies because the latest adjusted value equals the latest close by construction.
  const fault = candleSeriesFault(rows.map((r) => ({ date: r.date, close: r.value })), refPx);
  if (fault) return missing("Tiingo", "adjusted series failed continuity: " + fault, retrievedAt, "https://www.tiingo.com/");
  const v = verifyAdjustedSeries(rows);
  if (!v.ok) return missing("Tiingo", "total-return adjustment NOT verified: " + v.reason, retrievedAt, "https://www.tiingo.com/");
  return { value: rows.map((r) => ({ date: r.date, value: r.value, close: r.close })), basis: "total_return", verified: true, status: "LIVE",
    provider: "Tiingo (adjClose — split- and dividend-adjusted, verified)", sourceUrl: "https://www.tiingo.com/", observedAt: rows[rows.length - 1].date, retrievedAt };
}
