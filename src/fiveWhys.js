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

// v3.98.2: numeric-entity decode at RENDER too — the day's KV snapshot may still carry a
// pre-fix headline ("Fed&#x2019;s"), and a stored artifact must not print raw entities.
const deent = (t) => String(t || "")
  .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"');

/* MACRO-MATERIALITY FILTER (v3.51, public audit).
   WHY #3 gated the top RSS item on FRESHNESS alone and then labelled whatever came back
   "Headline driver". Freshness is not relevance: the audit caught a Fidelity death-certificate
   administrative story presented as the driver of a macro regime — a fresh, correctly-dated,
   correctly-attributed fact that explains nothing about risk posture, sitting in the one slot
   whose whole job is to explain the verdict. A confidently-irrelevant "why" is worse than no
   why, exactly as a fabricated number is worse than a missing one.
   The filter is an ALLOWLIST of macro-transmission vocabulary — the channels this dashboard
   actually votes on (policy · inflation · growth/labor · rates/credit · volatility/drawdown ·
   energy · the systemic-risk words). It is deliberately BROAD-BUT-BOUNDED and, critically,
   ONE-WAY: a non-matching headline is WITHHELD and the slot says so, never rewritten or
   scored. Missing a real macro headline costs one narrative line; asserting an irrelevant one
   as the market's driver costs the credibility of the whole explanation layer.
   ⚠ Curated, like MARKET_HOLIDAYS: a genuinely new macro vocabulary (a novel crisis word)
   needs an entry here, and until it gets one the slot abstains rather than guessing. */
const MACRO_TERMS = [
  // policy / central bank
  "fed", "fomc", "powell", "rate cut", "rate hike", "central bank", "ecb", "boj", "monetary",
  "quantitative", "basis point", "bps", "tightening", "easing",
  // inflation / prices
  "inflation", "cpi", "pce", "deflation", "price index", "wage growth",
  // growth / labor
  "gdp", "recession", "jobs report", "payroll", "unemployment", "jobless", "labor market",
  "consumer spending", "retail sales", "manufacturing", "ism", "pmi",
  // rates / credit / currency
  "treasury", "yield", "bond", "credit spread", "default", "downgrade", "debt ceiling",
  "dollar", "currency",
  // market-wide risk (not a single company's tape)
  "stocks", "equities", "s&p", "nasdaq", "dow", "selloff", "sell-off", "rally", "correction",
  "bear market", "bull market", "volatility", "vix", "risk-off", "risk off", "drawdown",
  "futures", "index", "benchmark",
  // commodities / energy
  "oil", "crude", "opec", "energy prices", "gold",
  // systemic / geopolitical shocks that transmit to the macro tape
  "tariff", "trade war", "sanctions", "war", "shutdown", "banking crisis", "bank failure",
  "contagion", "sovereign", "stimulus",
  // the RESOLUTION of a geopolitical shock moves the tape as much as its onset
  "peace", "ceasefire", "truce",
];
export function isMacroMaterial(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return false;
  return MACRO_TERMS.some((k) => t.includes(k));
}

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
  // FIX-E (v3.49, VALUE_PROPOSITION_AUDIT "regime denominators disagree"): the denominator
  // comes FROM computeRegime (`counted`/`totalFactors`) — this module used to re-derive it
  // from its own hardcoded factor list, which was still the pre-NFCI five, so the header
  // said "3/6 bullish" while WHY #5 said "3/5 live factors" on the same page. The local
  // list survives only as a fallback for a caller passing no regime (mock/demo), and now
  // names all six voters (FEAT-NFCI v3.43; "valuation" is the shillerPe factor's key).
  const total = regime.totalFactors ?? 6;
  const active = regime.counted ??
    ["tenYear", "vix", "fearGreed", "cpiHeadline", "valuation", "nfci"]
      .filter((k) => !stale.has(k)).length;

  // A1 (v3.58): the SPY clause freshness-gates like every other numeric claim — the headline
  // used to assert the mock day-move even while the verdict was withheld during loading.
  const headline =
    `${sessionPrefix(data.session)} ${label} regime, ${bull}/${active} bullish factors` +
    `${isLive("spyPrice") ? ` — SPY ${pct(spy.changePct)}` : ""}.`;

  const whys = [];

  /* WHY #1 — core anchor. v3.54 (11.4.5 audit, High): this clause asserted SPY, CPI and Fed
     values UNCONDITIONALLY while WHY #2 carefully freshness-gated its cross-signals. If CPI
     or the Fed rate fell back to mock, the narrative still called it "today's core tape" — a
     fabricated number in the page's own explanation of its verdict. Each of the three is now
     gated independently, unavailable clauses are OMITTED rather than filled from mock, and
     the count of usable core inputs is stated so a thin anchor is visible as thin. */
  const ma200 = spy.ma200;
  const above = ma200 != null && spy.price >= ma200;
  const coreParts = [];
  // VOICE (v3.97.2 owner rules, refined v4.0.1): one voice with the Simple cards — clear,
  // direct, lightly explanatory; short sentences, no insider phrasing. The v3.98 trader
  // slang ("sitting pretty", "don't get cute", "elsewhere on the tape") was cut on the
  // owner's read of the live page: the cards set the tone and the whys match it now. The
  // honesty literals are untouched: "N/3 core inputs usable", the named exclusions,
  // "dark — not counted" (the one-vocabulary rule, v3.98.3), the reduced-signal caveat.
  if (isLive("spyPrice")) {
    coreParts.push(
      `SPY $${spy.price} (${pct(spy.changePct)})` +
      (ma200 != null ? (above ? `, above its 200-day average` : `, below its 200-day average`) : "")
    );
  }
  if (isLive("cpiHeadline")) coreParts.push(`CPI ${cpi.headline}%`);
  if (isLive("fedFunds")) coreParts.push(`Fed at ${fed.rate}%`);
  const CORE_N = 3;
  if (coreParts.length) {
    whys.push(
      `${coreParts.join(", ")}. ` +
      (coreParts.length < CORE_N ? `${coreParts.length}/${CORE_N} core inputs usable — the rest aren't live right now. ` : "") +
      (isLive("spyPrice")
        ? (above ? "Trend intact." : "Below the long-term trend — that's the main risk flag.")
        : "No live SPY price, so no trend read.")
    );
  } else {
    // Every core input unavailable: say so. An empty anchor is a fact, not a blank line.
    whys.push(`0/${CORE_N} core inputs usable — nothing live to anchor on.`);
  }

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
    `Other live readings: ${sig.length ? sig.join(", ") : "nothing else is live right now"}.` +
    (excluded.length ? ` ${excluded.map((k) => FIELD_LABEL[k]).join(", ")} ${excluded.length === 1 ? "is" : "are"} dark — not counted.` : "")
  );

  // WHY #3 — top market headline: fresh AND macro-material (v3.51). Both gates, in that
  // order, so the reason for an empty slot is always the honest one.
  const hd = mp.headline;
  const hdFresh = !!(hd && hd.text && hd.source && hd.source !== "—" && isLive("marketHeadline"));
  if (hdFresh && isMacroMaterial(hd.text)) {
    whys.push(`Top story (${hd.source}): “${deent(hd.text)}”`);
  } else if (hdFresh) {
    // The distinction is load-bearing: "we have today's top story and it is not about the
    // macro tape" is a different fact from "no headline arrived", and it is the one that
    // stops an administrative story being read as the market's driver.
    whys.push(
      `Today's top story (${hd.source}) is not macro-material, so it doesn't move the call. ` +
      `Today is data-driven, not news-driven.`
    );
  } else {
    whys.push(`No fresh market headline today — the call is data-driven, not news-driven.`);
  }

  // WHY #4 — the tracked headwinds / tailwinds. These are a CURATED thesis register (no live
  // feed), so we attribute the review date rather than implying it's today's tape.
  const hw = Array.isArray(data.headwinds) ? data.headwinds : [];
  const worsening = hw.filter((h) => h.trend === "worsening").map((h) => h.name);
  const improving = hw.filter((h) => h.trend === "improving").map((h) => h.name);
  const reviewed = data.headwindsAsOf ? ` (hand-curated, ${data.headwindsAsOf})` : " (hand-curated)";
  whys.push(
    `Slow-burn risks${reviewed}: ${worsening.length ? `${worsening.join(", ")} getting worse` : "nothing getting worse"}` +
    `${improving.length ? `; ${improving.join(", ")} improving` : ""}. ` +
    `${worsening.length >= 2 ? "More than one is building — worth watching." : "No fresh escalation today."}`
  );

  // WHY #5 — synthesis + honest confidence caveat
  whys.push(
    `Bottom line: still ${label} — ${sub}. ${bull}/${active} live factors leaning bullish` +
    (active < total ? `; ${total - active} excluded as stale/dead — a reduced-signal read, so confidence is lower.` : "; full-signal read.")
  );

  return {
    regime: sub ? `${label} · ${sub}` : label,
    headline,
    whys,
    generatedAt: new Date().toISOString(),
  };
}
