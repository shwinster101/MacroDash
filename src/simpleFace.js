// src/simpleFace.js — Simple FACE / TAP / FOLD registry (T1)
//
// Presentation-only. No votes, no thresholds, no freshness rules. The 2026-09-14
// sprint locked four buckets (Face / Tap / Fold / Kill); every helper here projects
// already-decided evidence into the Face (or names the Fold). Degen does not import
// this module.
export const HOLD_REASON_MAX = 18;
export const FACE_NOUN = Object.freeze({
  vix: "Vol",
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

const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean);
const joinAnd = (arr) => {
  if (!arr.length) return "";
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const verb = (names) => (names.length === 1 && !/^(rates|prices)$/i.test(names[0]) ? "is" : "are");

// Face: ≤18-word so-what. Helping names "are fine"; hurting names "are the drag".
// At most two names per side so a 6-factor day cannot lecture.
export function holdReason(ev) {
  if (!ev || ev.withheld) return null;
  const rows = (ev.factors || []).filter((x) => !x.excluded);
  const name = (x) => FACE_NOUN[x.key] || x.short || x.key;
  const helping = rows.filter((x) => x.vote === "bull").map(name);
  const hurting = rows.filter((x) => x.vote === "bear").map(name);
  const parts = [];
  if (helping.length) {
    const g = helping.slice(0, 2);
    parts.push(`${cap(joinAnd(g))} ${verb(g)} fine`);
  }
  if (hurting.length) {
    const g = hurting.slice(0, 2);
    parts.push(`${cap(joinAnd(g))} ${verb(g)} the drag`);
  }
  if (!parts.length) return "Nothing we track has a clear lean.";
  const out = `${parts.join(". ")}.`;
  return words(out).length <= HOLD_REASON_MAX ? out : `${parts[0]}.`;
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

// Face: YTD + one quality stat (revenue growth, else margin, else FCF). Cap / multiples / lesson stay off.
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
