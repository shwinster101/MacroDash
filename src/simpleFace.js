// src/simpleFace.js — Simple FACE / TAP / FOLD registry (T1)
//
// Presentation-only. No votes, no thresholds, no freshness rules. The 2026-09-14
// sprint locked four buckets (Face / Tap / Fold / Kill); every helper here projects
// already-decided evidence into the Face (or names the Fold). Degen does not import
// this module.
export const HOLD_REASON_MAX = 15;
export const FACE_NOUN = Object.freeze({
  vix: "Volatility",
  nfci: "credit",
  tenYear: "Rates",
  valuation: "prices",
  fearGreed: "sentiment",
  cpiHeadline: "inflation",
});
export const FACE_GLYPH = Object.freeze({ helping: "▲", hurting: "▼", mixed: "•" });
export const LESSON_FOLD_LABEL = "Learning moment";
export const EXPLORE_FOLD_LABEL = "Explore the numbers";
export const WHYS_FOLD_LABEL = "Why this call";
export const ABOUT_FOLD_LABEL = "About this page";

const joinAnd = (arr) => {
  if (!arr.length) return "";
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const lc = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
// Nouns that take a plural verb on their own ("rates work", "prices hurt"); the rest are
// singular ("volatility works", "credit helps"). Verb agreement is per NAME, not per count.
const PLURAL_NOUN = new Set(["tenYear", "valuation"]);

/* Face: the so-what under the one-word call, ≤HOLD_REASON_MAX words.
   v6.6.1 (owner, on the live 2026-09-16 screenshot: "not a fan of 'fine' and 'drag' — higher
   leverage, 15 words max"). The sentence now says what the CALL means and lets the names
   carry the why: a Bullish day says the backdrop supports taking risk and names the only
   pushback; a Bearish day says what is working against risk and that the helpers do not
   offset it; a Hold day states the split and that NEITHER SIDE HAS A MAJORITY — which is
   the actual reason for a Hold under the strict-majority rule, and the one fact a newcomer
   can act on. The branch follows ev.regime.label, the same field the hero's verdict word
   reads, so the sentence can never describe a different call from the word above it.
   At most two names per side (the fold names them all); every branch is ≤15 words BY
   CONSTRUCTION — no runtime truncation, a truncated sentence is garbage — and smoke sweeps
   every helping/hurting split in every posture to prove the budget. */
export function holdReason(ev) {
  if (!ev || ev.withheld) return null;
  const rows = (ev.factors || []).filter((x) => !x.excluded);
  const side = (vote) => rows.filter((x) => x.vote === vote).slice(0, 2)
    .map((x) => ({ text: lc(FACE_NOUN[x.key] || x.short || x.key), plural: PLURAL_NOUN.has(x.key) }));
  const helping = side("bull"), hurting = side("bear");
  if (!helping.length && !hurting.length) return "Nothing we track has a clear lean.";
  const names = (g) => joinAnd(g.map((n) => n.text));
  const v = (g, one, many) => (g.length === 1 && !g[0].plural ? one : many);
  const line = (g, one, many) => `${cap(names(g))} ${v(g, one, many)}`;
  const label = ev.regime && ev.regime.label;
  if (label === "RISK-ON" && helping.length) {
    const lead = `${line(helping, "supports", "support")} taking risk.`;
    return hurting.length ? `${lead} The only pushback: ${names(hurting)}.`
      : `${lead} Nothing tracked is pushing back.`;
  }
  if (label === "RISK-OFF" && hurting.length) {
    const lead = `${line(hurting, "works", "work")} against risk.`;
    return helping.length ? `${lead} ${line(helping, "doesn't", "don't")} offset that.`
      : `${lead} Nothing tracked offsets that.`;
  }
  // Hold (MIXED): the split is the so-what. Larger side first; a tie leads with the helpers.
  if (helping.length && hurting.length) {
    const bullFirst = helping.length >= hurting.length;
    const first = bullFirst ? line(helping, "helps", "help") : line(hurting, "hurts", "hurt");
    const second = bullFirst ? line(hurting, "hurts", "hurt") : line(helping, "helps", "help");
    return `${first}. ${second}. Neither side has a majority.`;
  }
  return helping.length
    ? `${line(helping, "helps", "help")}; nothing tracked hurts. Still short of a majority.`
    : `${line(hurting, "hurts", "hurt")}; nothing tracked helps. Still short of a majority.`;
}

export function cardFace(card) {
  if (!card) return { glyph: "•", label: "", value: "—", tone: "mixed" };
  return {
    glyph: FACE_GLYPH[card.direction] || "•",
    label: card.label || "",
    value: card.currentValue || "—",
    tone: card.direction || "mixed",
  };
}

// Tap: the sentence that used to sit on the card (whyItMatters). Never a second thesis.
export function sheetLead(card) {
  if (!card) return null;
  return card.why || null;
}

const pct = (v, d = 1) => (typeof v === "number" && Number.isFinite(v)
  ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%` : null);
const money = (v) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const s = v < 0 ? "−" : "", a = Math.abs(v);
  return a >= 1e12 ? `${s}$${(a / 1e12).toFixed(2)}T`
    : a >= 1e9 ? `${s}$${(a / 1e9).toFixed(1)}B`
    : a >= 1e6 ? `${s}$${(a / 1e6).toFixed(0)}M`
    : `${s}$${a.toFixed(0)}`;
};

// Face projection: return + one fundamental (revenue growth, else margin, else FCF).
// The profile also renders the existing market cap; multiples and the lesson stay folded.
export function spotlightFace(company, leg) {
  if (!company) return null;
  const m = company.metrics || {};
  const ytd = !leg ? { value: null, unavailable: "return series unavailable" }
    : leg.awaiting ? { value: "awaiting first close", unavailable: null }
    : typeof leg.pct === "number" ? { value: pct(leg.pct, 2), unavailable: null }
    : { value: null, unavailable: leg.unavailable || "no common trading date yet" };
  let stat = null;
  const rg = m.revenueGrowth || {};
  const om = m.operatingMargin || {};
  const fcf = m.fcf || {};
  if (typeof rg.pct === "number") stat = { label: "Revenue growth", value: pct(rg.pct), unavailable: null };
  else if (typeof om.pct === "number") stat = { label: "Operating margin", value: `${om.pct.toFixed(1)}%`, unavailable: null };
  else if (typeof fcf.value === "number") stat = { label: "Free cash flow", value: money(fcf.value), unavailable: null };
  else {
    const gap = rg.unavailable || om.unavailable || fcf.unavailable || null;
    stat = { label: "Revenue growth", value: null, unavailable: gap };
  }
  return {
    name: company.name, symbol: company.symbol,
    ytd, stat,
    stale: Boolean((company.freshness && company.freshness.series && company.freshness.series.stale)
      || (company.freshness && company.freshness.market && company.freshness.market.stale)),
  };
}

export function lessonTitle(_lesson) { return LESSON_FOLD_LABEL; }
export function lessonBody(lesson) {
  if (!lesson) return null;
  return {
    title: lesson.title || "",
    body: lesson.body || "",
    example: lesson.example || null,
    exampleLines: lesson.exampleLines || (lesson.example ? [lesson.example] : []),
    limitation: lesson.limitation || null,
    exampleUnavailable: lesson.exampleUnavailable || null,
  };
}

export function chartTitle(pair) {
  if (!pair || !pair.anchor || !pair.comparison) return "YTD";
  return `${pair.anchor} vs ${pair.comparison} YTD`;
}

// Company tap: reuse the public three-bullet sheet; every value/date comes from its model.
export function spotlightExplain(company, leg) {
  const face = spotlightFace(company, leg);
  if (!face) return null;
  const cap = company.marketCap || {}, m = company.metrics || {};
  const metric = face.stat.label === "Operating margin" ? m.operatingMargin
    : face.stat.label === "Free cash flow" ? m.fcf : m.revenueGrowth;
  const definition = face.stat.label === "Operating margin"
    ? "Operating margin is the share of sales left after operating costs, before interest and taxes."
    : face.stat.label === "Free cash flow"
      ? "Free cash flow is operating cash left after spending on long-lived assets."
      : "Revenue growth compares sales with the same period a year earlier; it is not profit growth.";
  const size = cap.display && !cap.unavailable ? cap.display : `Unavailable — ${cap.unavailable || "no dated market cap"}`;
  const ret = leg?.unavailable ? `Unavailable — ${leg.unavailable}` : face.ytd.value || `Unavailable — ${face.ytd.unavailable}`;
  const stat = face.stat.value && !metric?.unavailable ? face.stat.value : `Unavailable — ${metric?.unavailable || face.stat.unavailable || "no reported figure"}`;
  return {
    full: company.name,
    what: [
      `${company.blurb || "Business description unavailable."} Market capitalization: ${size}. This is the stock market's value of all outstanding shares, not the company's cash.`,
      `Return this year: ${ret}. This measures the change since last year's final trading close, including reinvested dividends. Past returns do not predict future returns.`,
      `${face.stat.label}: ${stat}. ${definition}`,
    ],
    metadata: [cap.observedAt ? `Market capitalization as of ${cap.observedAt}${cap.method === "derived" ? " (derived)" : ""}.` : null,
      leg?.through ? `Return through ${leg.through}.` : null,
      metric?.period ? `${face.stat.label}: ${metric.period}.` : null,
      face.stale ? "Market data is stale." : null,
      "M = million; B = billion; T = trillion. Sources and calculations: Explore the numbers."].filter(Boolean).join(" "),
  };
}
