// src/fiveWhys.js — MacroDash v2.5
// Rule-based "5 Whys" generator. PURE (no React, no network, no LLM, $0): a
// deterministic macro narrative derived from the live snapshot + the regime that
// computeRegime() already produced — so it stays as fresh as the data with no
// cron/agent/secret. Smoke-tested like sources.js.

const pct = (v, d = 1) => `${v >= 0 ? "+" : ""}${Number(v).toFixed(d)}%`;

// Session framing — honors the "pre-open setup / post-close recap" cadence
// without a scheduler (the dashboard recomputes this every load).
function sessionPrefix(session) {
  if (session === "PRE") return "Pre-open setup —";
  if (session === "CLOSE") return "Post-close —";
  return "Midday —";
}

// Biggest public Mag-10 mover (curated input — used for flavor, not as a live claim).
function topMover(mag10) {
  const pub = (mag10 || []).filter((s) => s && !s.isPrivate && Number.isFinite(s.chgPct));
  if (!pub.length) return null;
  return pub.reduce((a, b) => (Math.abs(b.chgPct) > Math.abs(a.chgPct) ? b : a));
}

// computeFiveWhys(data, regime) -> { regime, headline, whys:[5], generatedAt }.
// `regime` is the object from computeRegime(d): { label, sub, bullVotes, bearVotes }.
export function computeFiveWhys(data, regime = {}) {
  const mp = data.marketPulse, ca = data.crossAsset, mac = data.macro;
  const spy = mp.spy, vix = mp.vix, fg = mp.fearGreed, pc = mp.putCall;
  const ten = ca.treasury10y, fed = mac.fedFunds, cpi = mac.cpi;
  const mover = topMover(data.mag10);
  const cpiCooling =
    Array.isArray(cpi.trend) && cpi.trend.length >= 2
      ? cpi.trend[cpi.trend.length - 1] < cpi.trend[cpi.trend.length - 2]
      : false;

  const label = regime.label || "MIXED";
  const sub = regime.sub || "cross-signals";
  const bull = regime.bullVotes ?? 0;

  const headline =
    `${sessionPrefix(data.session)} SPY ${pct(spy.changePct)}: ` +
    `${label} regime on ${bull}/5 bullish factors` +
    (mover ? `, ${mover.ticker} ${pct(mover.chgPct)} leading.` : ".");

  const whys = [
    // 1 — equities / leadership
    `Equities: SPY ${pct(spy.changePct)}, QQQ ${pct(mp.qqq.changePct)}` +
      (mover ? `; ${mover.ticker} ${pct(mover.chgPct)} set the tone.` : "."),
    // 2 — volatility / sentiment
    `Risk appetite: VIX ${vix.current} (${pct(vix.weekChg)} WoW), Fear & Greed ${fg.score} (${fg.label}) — ` +
      `${vix.current < 18 ? "calm tape" : vix.current > 25 ? "stress building" : "elevated but contained"}.`,
    // 3 — rates / policy
    `Rates: 10Y ${ten.current}% (${ten.d1 >= 0 ? "+" : ""}${ten.d1} 1D), Fed ${fed.rate}%, FOMC in ${fed.daysUntil}d — ` +
      `${ten.m1 < -0.1 ? "falling yields ease the discount rate" : ten.m1 > 0.15 ? "rising yields pressure multiples" : "yields roughly flat"}.`,
    // 4 — inflation
    `Inflation: CPI ${cpi.headline}% headline / ${cpi.core}% core — ${cpiCooling ? "cooling on the last two prints" : "not yet cooling"}.`,
    // 5 — positioning / structural
    `Positioning: Put/Call ${pc.current} (${pc.current < 0.75 ? "bullish skew" : pc.current > 1 ? "defensive" : "neutral"}); ` +
      `verdict ${label} — ${sub}.`,
  ];

  return {
    regime: sub ? `${label} · ${sub}` : label,
    headline,
    whys,
    generatedAt: new Date().toISOString(),
  };
}
