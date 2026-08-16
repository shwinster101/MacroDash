// FEAT-TT-V2: deterministic technical evidence from sourced daily OHLC.
// No prose, model output, or hand-entered support level can enter this calculation.

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const round = (v, places = 6) => {
  if (!Number.isFinite(v)) return null;
  const p = 10 ** places;
  return Math.round((v + Number.EPSILON) * p) / p;
};

export function normalizeCandles(raw) {
  if (!Array.isArray(raw)) return [];
  const rows = raw.map((c) => ({
    date: String(c?.date || c?.t || "").slice(0, 10),
    open: Number(c?.open ?? c?.o),
    high: Number(c?.high ?? c?.h),
    low: Number(c?.low ?? c?.l),
    close: Number(c?.close ?? c?.c),
    volume: Number(c?.volume ?? c?.v),
  })).filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.date) && [c.open, c.high, c.low, c.close].every(finite)
    && c.low > 0 && c.high >= c.low && c.high >= c.open && c.high >= c.close && c.low <= c.open && c.low <= c.close)
    .sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return [...byDate.values()];
}
export function sma(values, window) {
  if (!Array.isArray(values) || values.length < window || window <= 0) return null;
  const xs = values.slice(-window);
  return xs.every(finite) ? xs.reduce((a, b) => a + b, 0) / window : null;
}

export function atr(candles, window = 14) {
  const rows = normalizeCandles(candles);
  if (rows.length < window + 1) return null;
  const tr = rows.slice(1).map((r, i) => Math.max(r.high - r.low, Math.abs(r.high - rows[i].close), Math.abs(r.low - rows[i].close)));
  return round(sma(tr, window));
}

export function pivotLevels(candles, span = 2) {
  const rows = normalizeCandles(candles);
  const out = [];
  for (let i = span; i < rows.length - span; i++) {
    const around = rows.slice(i - span, i + span + 1);
    if (around.every((x, j) => j === span || rows[i].low <= x.low))
      out.push({ type: "support", price: rows[i].low, date: rows[i].date, volume: finite(rows[i].volume) ? rows[i].volume : null });
    if (around.every((x, j) => j === span || rows[i].high >= x.high))
      out.push({ type: "resistance", price: rows[i].high, date: rows[i].date, volume: finite(rows[i].volume) ? rows[i].volume : null });
  }
  return out;
}

export function clusterLevels(levels, tolerance) {
  const sorted = (Array.isArray(levels) ? levels : []).filter((x) => finite(x.price)).sort((a, b) => a.price - b.price);
  const clusters = [];
  for (const level of sorted) {
    let hit = clusters.find((c) => Math.abs(c.price - level.price) <= tolerance);
    if (!hit) {
      hit = { type: level.type, price: level.price, touches: 0, firstDate: level.date, lastDate: level.date, levels: [] };
      clusters.push(hit);
    }
    hit.levels.push(level);
    hit.touches++;
    hit.price = hit.levels.reduce((s, x) => s + x.price, 0) / hit.levels.length;
    hit.firstDate = hit.levels[0].date;
    hit.lastDate = hit.levels.at(-1).date;
  }
  return clusters.map((c) => ({ ...c, price: round(c.price, 4) }));
}

function trendOf(close, ma20, ma50, ma200) {
  if (![close, ma20, ma50, ma200].every(finite)) return "UNKNOWN";
  if (close > ma20 && ma20 > ma50 && ma50 > ma200) return "UPTREND";
  if (close < ma20 && ma20 < ma50 && ma50 < ma200) return "DOWNTREND";
  return "MIXED";
}

export function deriveTechnicals(candles, { target, quote } = {}) {
  const rows = normalizeCandles(candles);
  if (rows.length < 201) return {
    status: "UNKNOWN", rewardRisk: null, reason: `need at least 201 valid daily candles; received ${rows.length}`,
    evidence: [`${rows.length} valid daily candles`],
  };
  const last = rows.at(-1);
  const px = finite(quote) && quote > 0 ? quote : last.close;
  const closes = rows.map((r) => r.close);
  const atr14 = atr(rows, 14);
  const ma20 = sma(closes, 20), ma50 = sma(closes, 50), ma200 = sma(closes, 200);
  const tolerance = Math.max((atr14 || 0) * 0.75, px * 0.015);
  const clusters = clusterLevels(pivotLevels(rows.slice(-160), 2), tolerance);
  const supports = clusters.filter((c) => c.type === "support" && c.price < px).sort((a, b) => b.price - a.price);
  const resistances = clusters.filter((c) => c.type === "resistance" && c.price > px).sort((a, b) => a.price - b.price);
  const support = supports[0] || null;
  const resistance = resistances[0] || null;
  if (!support || !finite(atr14)) return {
    status: "UNKNOWN", rewardRisk: null, quote: round(px, 4), atr14, support: null, resistance,
    reason: "no defensible support cluster for a sourced stop",
    evidence: [`ATR(14) ${atr14 ?? "unavailable"}`, `${clusters.length} pivot clusters`],
  };
  const stop = support.price - atr14 * 0.5;
  const upsideTarget = finite(target) && target > px ? target : resistance?.price;
  const risk = px - stop;
  const reward = finite(upsideTarget) ? upsideTarget - px : null;
  const rr = finite(reward) && risk > 0 ? reward / risk : null;
  const daysOld = Math.max(0, Math.round((Date.parse(`${last.date}T12:00:00Z`) - Date.parse(`${support.lastDate}T12:00:00Z`)) / 86400000));
  const touchScore = Math.min(4, support.touches * 1.25);
  const recencyScore = daysOld <= 30 ? 2 : daysOld <= 90 ? 1 : 0;
  const trend = trendOf(px, ma20, ma50, ma200);
  const trendScore = trend === "UPTREND" ? 2 : trend === "MIXED" ? 1 : 0;
  const distanceScore = (px - support.price) / px <= 0.12 ? 2 : 1;
  const supportQuality = round(Math.min(10, touchScore + recencyScore + trendScore + distanceScore), 1);
  return {
    status: finite(rr) ? "OK" : "UNKNOWN",
    asOf: last.date,
    quote: round(px, 4),
    atr14,
    ma20: round(ma20, 4), ma50: round(ma50, 4), ma200: round(ma200, 4), trend,
    support: { ...support, distancePct: round((px / support.price - 1) * 100, 3), quality: supportQuality },
    resistance,
    stop: round(stop, 4),
    target: finite(upsideTarget) ? round(upsideTarget, 4) : null,
    rewardRisk: round(rr, 4),
    evidence: [
      `${rows.length} sourced daily candles through ${last.date}`,
      `ATR(14) ${round(atr14, 2)}`,
      `support ${round(support.price, 2)} from ${support.touches} pivot touch${support.touches === 1 ? "" : "es"}`,
      `stop ${round(stop, 2)}`,
      finite(upsideTarget) ? `target ${round(upsideTarget, 2)}` : "target unavailable",
    ],
  };
}
