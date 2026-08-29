// src/fiveWhys.js — MacroDash v2.9
// Rule-based "5 Whys" generator. PURE (no React, no network, no LLM, $0): a deterministic
// macro narrative derived from the live snapshot + the regime computeRegime() produced.
//
// STRUCTURE (v5.4 accountability repair):
//   #1  What is the call? — canonical human + machine vocabulary and exact vote arithmetic
//   #2  What drove it? — ONLY the six canonical factor rows that actually voted
//   #3  Why does that matter? — causal transmission for the directional factors
//   #4  Can I trust it? — evidence quality, snapshot time, exclusions, headline as context only
//   #5  What changes it? — nearest load-bearing threshold and actionability
//
// opts = { call, factors, flips, snapshotAsOf, headlineFresh }
//   call/factors/flips are the same canonical artifacts rendered by the hero and readout.
//   headlineFresh gates context only; headlines never vote.

const listOf = (xs) => xs.length <= 1 ? (xs[0] || "")
  : xs.length === 2 ? `${xs[0]} and ${xs[1]}`
  : `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`;

const PUBLIC_LABEL = { "RISK-ON": "MOONING", MIXED: "HODL", "RISK-OFF": "DIAMOND HANDS" };

/* v5.8 (owner: "sound more macro defined"): WHY #3 is the transmission layer, so each clause
   now names the CHANNEL in the macro vocabulary that channel actually has — discount rate and
   duration, the price of protection, the policy path, the earnings cushion, the credit channel
   — instead of a general gesture at importance. Deliberately still clause-length: these are
   joined into one sentence, and three long clauses would turn the most explanatory why into a
   wall (the v4.0.1 voice pass: short sentences, one voice, no lecture). */
const WHY_IT_MATTERS = {
  tenYear: "the 10-year yield is the discount rate sitting under every long-duration asset",
  vix: "VIX is the 30-day price of protection, and risk limits tighten as it rises",
  fearGreed: "sentiment shows how much optimism is already in the price, confirming risk appetite rather than causing it",
  cpiHeadline: "inflation's direction sets how much room the Fed has to cut",
  valuation: "a high CAPE means less cushion if the next decade of earnings disappoints",
  nfci: "financial conditions are the credit channel itself — whether money is reaching borrowers or the plumbing is tightening",
};

function cleanDisplay(v) {
  return String(v || "").replace(/\s+—\s+undefined\b/g, "").trim();
}

function factorClause(f) {
  const state = f.state || (f.vote === "bull" ? "BULLISH" : f.vote === "bear" ? "BEARISH"
    : f.vote === "neutral" ? "NEUTRAL" : "UNAVAILABLE");
  const display = cleanDisplay(f.display || f.val);
  return `${f.label || f.key}: ${state}${display ? ` — ${display}` : ""}${f.as_of || f.asOf ? ` (as of ${f.as_of || f.asOf})` : ""}`;
}

function etStamp(v) {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true }) + " ET";
}

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

/* 8/28 clock matrix A13: the prefix is the NARRATION's clock. Narrating a FROZEN 10am call,
   an evening reader met "Post-close —" leading its explanation: the time of reading stamped
   onto a call made hours earlier. When the chain explains the frozen artifact it says so;
   the live session prefix is for the unfrozen read only. Freeze mechanics untouched — this
   reads the flag the server already sets. */
function sessionPrefix(session) {
  if (session === "PRE") return "Pre-open setup —";
  if (session === "CLOSE") return "Post-close —";
  return "Midday —";
}

export function computeFiveWhys(data, regime = {}, opts = {}) {
  const call = opts.call || null;
  const factors = Array.isArray(call?.factors) ? call.factors
    : Array.isArray(opts.factors) ? opts.factors : [];
  const usableFactors = factors.filter((f) => !f.excluded && (f.state || f.vote));
  const total = call?.counts?.total ?? regime.totalFactors ?? 6;
  const active = call?.counts?.usable ?? regime.counted ?? usableFactors.length;
  const bull = call?.counts?.bullish ?? regime.bullVotes ?? usableFactors.filter((f) => f.vote === "bull").length;
  const bear = call?.counts?.bearish ?? regime.bearVotes ?? usableFactors.filter((f) => f.vote === "bear").length;
  const neutral = call?.counts?.neutral ?? Math.max(0, active - bull - bear);
  const baseLabel = regime.raw || regime.label || "MIXED";
  const label = call?.headline || PUBLIC_LABEL[baseLabel] || (active >= 4 ? "HODL" : "CAN'T CALL IT");
  const direction = call?.direction || (baseLabel === "RISK-ON" ? "BULLISH" : baseLabel === "RISK-OFF" ? "BEARISH" : "NEUTRAL");
  const required = active ? Math.floor(active / 2) + 1 : 0;

  /* 8/28 vocabulary matrix, row 11. This read "{bull}/{active} usable factors bullish" — the
     same N/M shape and the same word "usable" as the hero's coverage line, with the numerator
     silently switched from voters-counted to bullish-voters. On a full-coverage day the reader
     met "6 of 6 voters counted" above and "3/6 usable factors bullish" here and concluded half
     the book had gone dark. A tally now says it is a tally, and never wears a slash. */
  const prefix = opts.callFrozen ? "10am call —" : sessionPrefix(data.session);
  const headline = `${prefix} ${label} · ${direction}; ${bull} of the ${active} counted voters lean bullish.`;
  const whys = [];

  whys.push(
    /* Rows 12-13: coverage takes the canonical "N of M voters counted" form (it was the
       hero's own fact wearing a slash), and the majority RULE stops looking like a third
       tally — "3 of 5" sat between two counts and read as one. */
    `${label} — ${direction}. The model has ${bull} bullish, ${neutral} neutral, and ${bear} bearish` +
    `${active < total ? ` — ${active} of ${total} voters counted` : ` — all ${total} voters counted`}. ` +
    `${required ? `A directional call needs a strict majority of the counted voters — at least ${required} here.` : "There is not enough usable evidence to publish a direction."}`
  );

  const supports = usableFactors.filter((f) => (f.state || "").toUpperCase() === "BULLISH" || f.vote === "bull");
  const risks = usableFactors.filter((f) => (f.state || "").toUpperCase() === "BEARISH" || f.vote === "bear");
  const balances = usableFactors.filter((f) => (f.state || "").toUpperCase() === "NEUTRAL" || f.vote === "neutral");
  const driverParts = [];
  if (supports.length) driverParts.push(`Support: ${supports.map(factorClause).join("; ")}`);
  if (risks.length) driverParts.push(`Risk: ${risks.map(factorClause).join("; ")}`);
  if (balances.length) driverParts.push(`Neutral: ${balances.map(factorClause).join("; ")}`);
  whys.push(driverParts.length ? driverParts.join(". ") + "." : "No canonical factor is usable, so no driver is being claimed.");

  const directional = [...supports, ...risks];
  const mechanisms = directional.map((f) => WHY_IT_MATTERS[f.key]).filter(Boolean);
  whys.push(mechanisms.length
    ? `${listOf(mechanisms)}. These are transmission channels, not proof that any one factor caused today's market move.`
    : "No factor has a directional vote, so the model is not claiming a causal market driver.");

  const excluded = factors.filter((f) => f.excluded);
  const stamp = etStamp(opts.snapshotAsOf) || data.lastRefresh || null;
  const hd = data.marketPulse?.headline;
  const headlineFresh = !!(hd?.text && hd?.source && hd.source !== "—" && opts.headlineFresh !== false);
  const context = headlineFresh && isMacroMaterial(hd.text)
    ? `Tracked context (${hd.source}): “${deent(hd.text)}”`
    : headlineFresh
      ? `The top ${hd.source} RSS item failed the macro-relevance filter`
      : "No current macro headline passed the feed and relevance gates";
  whys.push(
    `Evidence confidence is ${call?.confidence || (active === total ? "HIGH" : active >= 4 ? "MEDIUM" : "LOW")}` +
    `${stamp ? `; the snapshot was pulled ${stamp}` : ""}. ` +
    `${excluded.length ? `${excluded.map((f) => f.label || f.key).join(", ")} ${excluded.length === 1 ? "was" : "were"} excluded.` : "No factor was excluded."} ` +
    `${context}. Headlines are context only and never cast a vote.`
  );

  const nearest = Array.isArray(opts.flips) ? opts.flips[0] : null;
  const nextLabel = nearest ? (PUBLIC_LABEL[nearest.would] || nearest.would) : null;
  const override = call?.override?.active ? ` The ${call.override.type} safety override is active.` : "";
  const downgraded = call?.downgraded ? ` ${call.downgraded}.` : "";
  whys.push(
    (nearest
      ? `Nearest load-bearing change: ${nearest.copy} would move the base call to ${nextLabel}.`
      : "No single tracked threshold changes this call; it would take a combination of factor moves.") +
    ` Actionability is ${call?.actionability || "HOLD"}.${override}${downgraded}`
  );

  return {
    regime: `${label} · ${direction}`,
    headline,
    whys,
    labels: ["WHY THIS CALL", "WHAT DROVE IT", "WHY IT MATTERS", "CAN I TRUST IT", "WHAT CHANGES IT"],
    generatedAt: new Date().toISOString(),
  };
}
