// MacroDash v5.5 — public-call history + forward outcome contracts.
//
// Pure, React-free and runtime-neutral: imported by the Pages history/readout paths,
// the scheduled Worker, and smoke tests. The frozen call and its later market outcome
// deliberately use DIFFERENT KV keys. A score may mature; the call it scores may not move.

export const HISTORY_PREFIX = "public:regime-history:v1:";
export const OUTCOME_PREFIX = "public:regime-outcome:v1:";
export const HISTORY_RECORD_SCHEMA = "md-history-record-v1";
export const OUTCOME_SCHEMA = "md-spy-outcome-v1";
export const OUTCOME_HORIZON = 20;

export const historyKey = (date) => `${HISTORY_PREFIX}${date}`;
export const outcomeKey = (date) => `${OUTCOME_PREFIX}${date}`;

/* v6.2 — the 6pm CLOSE READ is a THIRD key family, deliberately not a second history row.
   The history key is a bare ET date and first-write-wins, so a second scored artifact under
   it would either be refused or would notarize the morning's call twice; the outcome anchor
   scores the first close ON OR AFTER the call date, which the close read has already seen.
   So: its own prefix, its own record schema, joined INTO the day's row by history.json (the
   outcome-companion precedent) and never counted as a row. A FAILED capture is still a
   record — a bad evening must not vanish any more than a bad morning does. */
export const CLOSE_READ_PREFIX = "public:close-read:v1:";
export const CLOSE_READ_SCHEMA = "md-close-read-v1";               // the payload (built by src/closeRead.js)
export const CLOSE_READ_RECORD_SCHEMA = "md-close-read-record-v1"; // the Worker's captured envelope
export const closeReadKey = (date) => `${CLOSE_READ_PREFIX}${date}`;
export function validCloseRead(record, date = null) {
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (record?.schema !== CLOSE_READ_RECORD_SCHEMA || !ymd.test(String(record.date || ""))) return null;
  if (date && record.date !== date) return null;
  if (record.capture_status === "FAILED") return record;
  return record.capture_status === "CAPTURED" && record.close_read?.schema === CLOSE_READ_SCHEMA &&
    record.close_read.date === record.date ? record : null;
}

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const round2 = (v) => Math.round(v * 100) / 100;
const returnPct = (from, to) => finite(from) && from > 0 && finite(to)
  ? round2((to / from - 1) * 100) : null;

// FRED observations may arrive newest-first, contain weekend "." placeholders, or repeat
// a date. Normalize to one finite, positive S&P 500 close per trading date, oldest-first.
export function normalizeSp500Observations(observations = []) {
  const byDate = new Map();
  for (const row of Array.isArray(observations) ? observations : []) {
    const date = typeof row?.date === "string" ? row.date.slice(0, 10) : "";
    const close = Number(row?.value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || row?.value === "." || !finite(close) || close <= 0) continue;
    byDate.set(date, close);
  }
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, close]) => ({ date, close }));
}

export function maxDrawdownPct(closes = []) {
  if (!Array.isArray(closes) || !closes.length || !finite(closes[0]) || closes[0] <= 0) return null;
  let peak = closes[0];
  let worst = 0;
  for (const close of closes) {
    if (!finite(close) || close <= 0) return null;
    if (close > peak) peak = close;
    worst = Math.min(worst, (close / peak - 1) * 100);
  }
  return round2(worst);
}

// The call is made at 10am ET while the official FRED SP500 observation still describes
// the prior close. Anchoring there would count pre-call price movement as an outcome. The
// first official close ON OR AFTER the call date is therefore day 0; 1d/5d/20d are the
// next 1/5/20 trading closes. Until day 20, max drawdown is explicitly "so far".
export function buildForwardOutcome(record, observations, updatedAt = new Date().toISOString()) {
  if (!record || record.capture_status !== "CAPTURED" || !record.call || !/^\d{4}-\d{2}-\d{2}$/.test(String(record.date || ""))) return null;
  const rows = normalizeSp500Observations(observations);
  const anchorIndex = rows.findIndex((row) => row.date >= record.date);
  const anchor = anchorIndex >= 0 ? rows[anchorIndex] : null;
  const forward = anchor ? rows.slice(anchorIndex + 1, anchorIndex + 1 + OUTCOME_HORIZON) : [];
  const at = (n) => forward.length >= n ? forward[n - 1].close : null;
  const observed = forward.length;

  return {
    schema: OUTCOME_SCHEMA,
    call_date: record.date,
    benchmark: {
      symbol: "SPY_PROXY",
      label: "S&P 500 price return (SPY proxy)",
      source: "FRED SP500",
      return_type: "price",
      basis: "first official close on or after the 10am ET call to subsequent trading closes",
    },
    anchor: anchor ? { date: anchor.date, close: round2(anchor.close / 10) } : null,
    sessions_observed: observed,
    horizon_sessions: OUTCOME_HORIZON,
    returns_pct: {
      "1d": anchor ? returnPct(anchor.close, at(1)) : null,
      "5d": anchor ? returnPct(anchor.close, at(5)) : null,
      "20d": anchor ? returnPct(anchor.close, at(20)) : null,
    },
    max_drawdown_pct_20d: anchor ? maxDrawdownPct([anchor.close, ...forward.map((row) => row.close)]) : null,
    max_drawdown_status: observed >= OUTCOME_HORIZON ? "FINAL" : "SO_FAR",
    status: observed >= OUTCOME_HORIZON ? "COMPLETE" : "PENDING",
    updated_at: updatedAt,
  };
}

export function validFrozenCall(record, date = null) {
  return record?.schema === HISTORY_RECORD_SCHEMA && record?.capture_status === "CAPTURED" &&
    record?.call?.schema === "md-call-v1" && record.call.effective_date === record.date &&
    (!date || record.date === date)
    ? record.call : null;
}
