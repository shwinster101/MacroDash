// src/fiveWhys.js — MacroDash v2.9
// Rule-based "5 Whys" generator. PURE (no React, no network, no LLM, $0): a deterministic
// macro narrative derived from the live snapshot + the regime computeRegime() produced.
//
// STRUCTURE (per maintainer spec):
//   #1  Core anchor — SPY vs 200DMA, CPI, Fed rate
//   #2  Other LIVE data only — VIX/F&G/10Y/WTI/BTC/credit, INCLUDED ONLY IF live + fresh
//       (mock or stale fields are skipped, never asserted as today's tape)
//   #3  Market headline — the top dated market headline (RSS), or "none" if not fresh
//   #4  Headwinds/tailwinds — what's worsening / improving in the tracked risks
//   #5  Synthesis — how #1–4 combine into the verdict, with a confidence caveat
//
// opts = { stale:Set<factorKey>, fresh:Set<fieldKey>|null }
//   stale → regime factors excluded from the vote (cadence-aware, from the dashboard).
//   fresh → fields whose provenance is LIVE/CACHED and not stale. null = mock/demo mode
//           (no live filtering — show everything, since mock IS the baseline).

const pct = (v, d = 1) => `${v >= 0 ? "+" : ""}${Number(v).toFixed(d)}%`;

function sessionPrefix(session) {
  if (session === "PRE") return "Pre-open setup —";
  if (session === "CLOSE") return "Post-close —";
  return "Midday —";
}

// Display labels for WHY #2 fields (and the "excluded" note).
const FIELD_LABEL = {
  vix: "VIX", fearGreed: "F&G", tenYear: "10Y", wti: "WTI",
  btc: "BTC", creditSpread: "HY-IG", marketHeadline: "headline",
};

export function computeFiveWhys(data, regime = {}, opts = {}) {
  const stale = opts.stale instanceof Set ? opts.stale : new Set();
  const fresh = opts.fresh instanceof Set ? opts.fresh : null; // null = treat all as usable (mock/demo)
  const isLive = (k) => (fresh ? fresh.has(k) : true);

  const mp = data.marketPulse, ca = data.crossAsset, mac = data.macro;
  const spy = mp.spy, vix = mp.vix, fg = mp.fearGreed;
  const ten = ca.treasury10y, fed = mac.fedFunds, cpi = mac.cpi;

  const label = regime.label || "MIXED";
  const sub = regime.sub || "cross-signals";
  const bull = regime.bullVotes ?? 0;
  // Active = the 5 regime factors minus any excluded for staleness (matches RegimeBand).
  // DEC-31 (v3.2): Put/Call retired from the factor set.
  const active = ["tenYear", "vix", "fearGreed", "cpiHeadline", "valuation"]
    .filter((k) => !stale.has(k)).length;

  const headline =
    `${sessionPrefix(data.session)} ${label} regime, ${bull}/${active} bullish factors — SPY ${pct(spy.changePct)}.`;

  const whys = [];

  // WHY #1 — core anchor: SPY vs 200DMA, CPI, Fed rate
  const ma200 = spy.ma200;
  const above = ma200 != null && spy.price >= ma200;
  whys.push(
    `Core tape: SPY $${spy.price} (${pct(spy.changePct)}) ${ma200 != null ? (above ? `above its 200-DMA ($${ma200})` : `below its 200-DMA ($${ma200})`) : ""}; ` +
    `CPI ${cpi.headline}% headline, Fed funds ${fed.rate}%. ` +
    `${above ? "Primary trend intact; policy/inflation set the backdrop." : "Below the long trend — primary risk flag."}`
  );

  // WHY #2 — other LIVE data only (mock/stale fields are skipped)
  const sig = [];
  if (isLive("vix")) sig.push(`VIX ${vix.current}`);
  if (isLive("fearGreed")) sig.push(`F&G ${fg.score} (${fg.label})`);
  if (isLive("tenYear")) sig.push(`10Y ${ten.current}%`);
  if (isLive("wti") && ca.wti) sig.push(`WTI $${ca.wti.current}`);
  if (isLive("btc") && ca.btc) sig.push(`BTC $${(ca.btc.current / 1000).toFixed(0)}K`);
  if (isLive("creditSpread") && mac.credit) sig.push(`HY-IG ${mac.credit.spread}pp`);
  const excluded = fresh
    ? ["vix", "fearGreed", "tenYear", "wti", "btc", "creditSpread"].filter((k) => !fresh.has(k))
    : [];
  whys.push(
    `Live cross-signals: ${sig.length ? sig.join(", ") : "none fresh right now"}.` +
    (excluded.length ? ` Excluded (mock/stale): ${excluded.map((k) => FIELD_LABEL[k]).join(", ")}.` : "")
  );

  // WHY #3 — top market headline (dated, fact-attributed)
  const hd = mp.headline;
  if (hd && hd.text && hd.source && hd.source !== "—" && isLive("marketHeadline")) {
    whys.push(`Headline driver (${hd.source}): “${hd.text}”`);
  } else {
    whys.push(`Headline driver: no fresh market headline today — direction is data-driven, not news-driven.`);
  }

  // WHY #4 — the tracked headwinds / tailwinds. These are a CURATED thesis register (no live
  // feed), so we attribute the review date rather than implying it's today's tape.
  const hw = Array.isArray(data.headwinds) ? data.headwinds : [];
  const worsening = hw.filter((h) => h.trend === "worsening").map((h) => h.name);
  const improving = hw.filter((h) => h.trend === "improving").map((h) => h.name);
  const reviewed = data.headwindsAsOf ? ` (curated, reviewed ${data.headwindsAsOf})` : " (curated)";
  whys.push(
    `Risk register${reviewed}: ${worsening.length ? `${worsening.join(", ")} worsening` : "no headwind worsening"}` +
    `${improving.length ? `; ${improving.join(", ")} improving` : ""}. ` +
    `${worsening.length >= 2 ? "Structural risks still building." : "No fresh escalation today."}`
  );

  // WHY #5 — synthesis + honest confidence caveat
  whys.push(
    `Net: ${label} — ${sub}. ${bull}/${active} live factors bullish` +
    (active < 5 ? `; ${5 - active} excluded as stale/dead, so this is a reduced-signal read.` : "; full-signal read.")
  );

  return {
    regime: sub ? `${label} · ${sub}` : label,
    headline,
    whys,
    generatedAt: new Date().toISOString(),
  };
}
