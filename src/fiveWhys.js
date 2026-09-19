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
// opts = { call, factors, flips, snapshotAsOf, headlineFresh, callFrozen, vocabulary }
//   call/factors/flips are the same canonical artifacts rendered by the hero and readout.
//   headlineFresh gates context only; headlines never vote.
//
// v6.6.1 "ONE ENGINE, TWO ALTITUDES" (owner, on the live 2026-09-16 Simple screenshot: the
// whys were "intentionally higher level for simple mode, 25 words max per why — dig into the
// bridge with the simple mode intentions; same for degen"). Before this the Simple whys were
// the Degen whys with word swaps — HELPING for BULLISH — and still carried six dated factor
// rows, band jargon ("≥½ SD below mean") and three quoted headlines: the 10-K leaking into
// the flash card (the v6.5.1 mode contract). The five QUESTIONS are the same in both modes
// and so is every number; what differs is the ALTITUDE each answer is pitched at:
//   SIMPLE — the bridge from the one-word call to understanding. Plain nouns (the same
//            FACE_NOUN vocabulary the hero sentence uses), the vote split, ONE transmission
//            phrase per side, confidence + coverage, and the ARITHMETIC of the flip ("Bullish
//            would take 2 more signals helping") — the ⇄ line beneath it then names the
//            nearest concrete crossing, so the two lines do different jobs instead of one
//            restating the other.
//   DEGEN  — the operator's register: MOONING · BULLISH, short codes, the channel vocabulary
//            the v5.8 ruling asked for, the snapshot clock, actionability, and the nearest
//            threshold. Dates and numbers are deliberately NOT repeated here: the Drivers
//            matrix and the hero chips already carry every one (v3.93's "same fact three
//            times" cut, applied to this block).
// WHY_WORD_MAX is the ONE budget for both altitudes. It is not enforced by truncation at
// runtime — a truncated derived sentence is garbage — but every input is bounded (six
// factors, a headline capped at HEADLINE_WORDS, chip-length flip copy), and smoke sweeps the
// worst case in both modes so a copy edit that breaks the budget fails the build.

const listOf = (xs) => xs.length <= 1 ? (xs[0] || "")
  : xs.length === 2 ? `${xs[0]} and ${xs[1]}`
  : `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`;

const PUBLIC_LABEL = { "RISK-ON": "MOONING", MIXED: "HODL", "RISK-OFF": "DIAMOND HANDS" };
import { SIMPLE_WITHHELD_LABEL, simpleCallLabel } from "./publicCopy.js";
import { FACE_NOUN } from "./simpleFace.js";
import { REGIME_BAND_TABLE, REGIME_QUORUM } from "./regime.js";

export const WHY_WORD_MAX = 25;
/* Degen WHY #4 quotes the rank-1 macro headline; a wire title runs 15-25 words on its own,
   so it is cut to a chip-length lead (the v3.66 rule — chip-length in place). The full title
   still rides the snapshot and the ranked-headline record; only this line shortens it. */
export const HEADLINE_WORDS = 6;

/* v5.8 (owner: "sound more macro defined") named the CHANNEL each factor runs through —
   discount rate, the price of protection, the policy path, the earnings cushion, the credit
   channel. v6.6.1 keeps exactly that vocabulary and compresses each to its chip-length name,
   because five clause-length channels cannot fit a 25-word why and the mechanism, not the
   prose around it, is what the ruling asked for. */
const CHANNEL = {
  tenYear: "discount rate",
  vix: "price of protection",
  fearGreed: "positioning",
  cpiHeadline: "policy path",
  valuation: "earnings cushion",
  nfci: "credit channel",
};

const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean);
const lc = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const noun = (k, one, many) => (k === 1 ? one : many);
const plural = (k, one, many) => `${k} ${noun(k, one, many)}`;
const bandOf = (key) => REGIME_BAND_TABLE.find((b) => b.key === key) || null;

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
/* v6.1.0: the allowlist MOVED to src/headlines.js — the ranked headline layer and this gate
   share ONE table (categories as data, terms verbatim), and isMacroMaterial is re-exported
   from here because every consumer (and smoke) imports it from this module. The doctrine
   above stays the doctrine; the ranker restates it for ORDER at the table's home. */
import { isMacroMaterial } from "./headlines.js";
export { isMacroMaterial };

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

const WITHHELD_WHY = "There is not enough usable evidence to publish a direction.";

/* ── SIMPLE: the bridge from the one-word call to understanding. ───────────────────────
   Every fact here is the same fact Degen states; only the altitude differs. Nouns are the
   FACE_NOUN vocabulary the hero sentence speaks (one Simple vocabulary, face and fold), the
   transmission phrases are the band table's own plainBull/plainBear (one home), and the
   fifth check is derived from the SAME strict-majority rule verdictFrom applies — so it can
   never disagree with the call it explains. */
function simpleWhys(x) {
  const { label, withheld, bull, bear, neutral, active, total, required, supports, risks,
    balances, excluded, confidence, call } = x;
  const faceNoun = (f) => lc(FACE_NOUN[f.key] || f.short || f.key);
  const list = (fs) => listOf(fs.map(faceNoun));
  const phrase = (f, side) => {
    const b = bandOf(f.key);
    const p = b && (side === "bull" ? b.plainBull : b.plainBear);
    return cap(p || `${faceNoun(f)} is ${side === "bull" ? "helping" : "hurting"}`);
  };
  const w = [];

  // #1 — the call and its arithmetic. A safety state is NAMED on the call word: a Hold that
  //      the votes would have made Bullish, or a Bearish the circuit forced, must not read as
  //      a contradiction between the word and the count beside it.
  /* v7.2: the circuit is NAMED. "the crash circuit" was correct while PANIC was the only
     override; saying it under a SAHM would attribute the forced call to a circuit that did not
     fire — a fabricated cause on the page's plainest sentence. */
  const qual = call && call.override && call.override.active
    ? (call.override.type === "SAHM" ? " — forced by the recession rule" : " — forced by the crash circuit")
    : call && call.downgraded ? " — Bullish withheld" : "";
  w.push(withheld ? WITHHELD_WHY
    : `${label}${qual}. ${bull} of ${active} signals help, ${bear} hurt, ${neutral} mixed. A call needs a majority — at least ${required}.`);

  // #2 — who is on which side, by name. Excluded names are NAMED (v3.65: silent truncation
  //      reads as full coverage), never folded into "mixed" (v3.62: not counted ≠ no lean).
  const drove = [];
  if (supports.length) drove.push(`Helping: ${list(supports)}.`);
  if (risks.length) drove.push(`Hurting: ${list(risks)}.`);
  if (balances.length) drove.push(`Mixed: ${list(balances)}.`);
  if (excluded.length) drove.push(`Not counted: ${list(excluded)}.`);
  w.push(withheld
    ? `Only ${active} of ${total} signals are current${excluded.length ? ` — not counted: ${list(excluded)}` : ""}.`
    : drove.length ? drove.join(" ") : "No counted signal has a lean either way.");

  // #3 — ONE transmission phrase per side, the side that agrees with the call first. "One
  //      reason" is true by construction (the factor voted that way) and admits the others.
  const bearFirst = call && call.direction === "BEARISH";
  const helpLine = supports.length ? `${phrase(supports[0], "bull")} — can support stocks.`
    : "Nothing counted is helping.";
  const hurtLine = risks.length ? `${phrase(risks[0], "bear")} — can pressure stocks.`
    : "Nothing counted is pressuring stocks.";
  w.push(withheld ? "With too few current signals, no channel is being claimed."
    : `${bearFirst ? `${hurtLine} ${helpLine}` : `${helpLine} ${hurtLine}`} Neither proves what moved markets today.`);

  // #4 — trust: confidence, coverage, and that news never votes. No headline here — one
  //      title alone would spend the whole budget, and Simple's job is the call, not the tape.
  //      The excluded NAMES ride #2 (once, not twice — the v3.93 same-fact cut).
  w.push(`Confidence is ${String(confidence).toLowerCase()}: ${withheld ? "only " : ""}${active} of ${total} signals are current.` +
    " News is context only — it never moves the call.");

  // #5 — the ARITHMETIC of the flip, off the same majority rule the verdict uses. The ⇄ line
  //      rendered beneath this block names the nearest concrete crossing; this says how far
  //      the vote itself is from a different answer. A safety state outranks the arithmetic:
  //      a downgraded bull call or a tripped circuit is what changes it, not one more vote.
  const sig = (k) => plural(k, "signal", "signals");
  let flip;
  if (withheld) {
    const need = REGIME_QUORUM - active;
    flip = need > 0 ? `Needs ${need} more current ${noun(need, "signal", "signals")} before any call can be made.`
      : "The call is withheld until its evidence is current and usable.";
  } else if (call && call.override && call.override.active) {
    flip = call.override.type === "SAHM"
      ? "The recession rule triggered — that forces Bearish until unemployment settles back."
      : "The crash circuit tripped — that forces Bearish until it clears.";
  } else if (call && call.downgraded) {
    flip = "Bullish is withheld while the crash circuit cannot see — it needs current price and volatility readings.";
  } else if (call && call.direction === "BULLISH") {
    const k = bull - required + 1;
    flip = `${cap(sig(k))} switching from helping would drop this to Hold.`;
  } else if (call && call.direction === "BEARISH") {
    const k = bear - required + 1;
    flip = `${cap(sig(k))} switching from hurting would lift this to Hold.`;
  } else {
    const needB = required - bull;
    flip = `Bullish would take ${needB} more ${noun(needB, "signal", "signals")} helping; Bearish, ${required - bear} more hurting.`;
  }
  w.push(flip);
  return w;
}

/* ── DEGEN: the operator's register, at the same word budget. ──────────────────────────
   Short codes, the machine direction beside the moon voice, the channel vocabulary, the
   snapshot clock, actionability and the nearest threshold. Numbers and dates are NOT
   repeated — the Drivers matrix and hero chips carry every one. */
function degenWhys(x, data, opts) {
  const { label, direction, withheld, bull, bear, neutral, active, total, required, supports,
    risks, balances, excluded, confidence, call } = x;
  const code = (f) => f.short || f.label || f.key;
  const codes = (fs) => fs.map(code).join(" · ");
  const w = [];

  const qual = call && call.override && call.override.active ? ` (${call.override.type || "PANIC"} override)`
    : call && call.downgraded ? " (Bullish withheld)" : "";
  w.push(withheld ? WITHHELD_WHY
    : `${label} · ${direction}${qual}. ${bull} bullish, ${neutral} neutral, and ${bear} bearish — ` +
      `${active === total ? `all ${total}` : `${active} of ${total}`} signals counted. Strict majority needed: at least ${required}.`);

  const drove = [];
  if (supports.length) drove.push(`Bull: ${codes(supports)}.`);
  if (risks.length) drove.push(`Bear: ${codes(risks)}.`);
  if (balances.length) drove.push(`Neutral: ${codes(balances)}.`);
  if (excluded.length) drove.push(`Excluded: ${codes(excluded)}.`);
  w.push(drove.length ? drove.join(" ") : "No canonical factor is usable, so no driver is being claimed.");

  const chan = (fs) => listOf(fs.map((f) => CHANNEL[f.key]).filter(Boolean));
  const bullVia = supports.length ? `Bull via ${chan(supports)}` : "";
  const bearVia = risks.length ? `bear via ${chan(risks)}` : "";
  w.push(bullVia || bearVia
    ? `${cap([bullVia, bearVia].filter(Boolean).join("; "))}. Transmission channels, not proof of causation.`
    : "No factor has a directional signal, so the model is not claiming a causal market driver.");

  const stamp = etStamp(opts.snapshotAsOf) || data.lastRefresh || null;
  const hd = data.marketPulse && data.marketPulse.headline;
  const headlineFresh = !!(hd && hd.text && hd.source && hd.source !== "—" && opts.headlineFresh !== false);
  const lead = (t) => { const ws = words(deent(t)); return ws.length > HEADLINE_WORDS ? `${ws.slice(0, HEADLINE_WORDS).join(" ")}…` : ws.join(" "); };
  // Rank-1 rides as a quoted lead with its source; ranks 2-3 (v6.1's top-3) no longer fit a
  // 25-word line and have no other page home yet — filed, not hidden. The exclusion NAMES ride
  // #2; this line states coverage as a count so a six-dark day cannot blow the budget.
  const context = headlineFresh && isMacroMaterial(hd.text)
    ? `“${lead(hd.text)}” (${hd.source})`
    : headlineFresh ? `Top ${hd.source} item is not macro-material`
    : "No macro headline passed the gates";
  w.push(`${confidence} confidence${stamp ? `; pulled ${stamp}` : ""}. ` +
    `${active === total ? `All ${total}` : `${active} of ${total}`} usable. ${context}. Headlines never affect the call.`);

  const nearest = Array.isArray(opts.flips) ? opts.flips[0] : null;
  const nextLabel = nearest ? (PUBLIC_LABEL[nearest.would] || nearest.would) : null;
  const override = call && call.override && call.override.active ? ` ${call.override.type} override active.` : "";
  // The full downgrade reason already renders on the hero and the paste block (v3.41); here
  // it is chip-length (v3.66) so the why stays inside its budget without dropping the fact.
  const downgraded = call && call.downgraded ? " Bullish withheld: crash circuit blind." : "";
  // A withheld call has no threshold to flip — a crossing cannot publish a direction below
  // quorum — so the line says what it needs instead of naming a flip it cannot honour.
  const need = REGIME_QUORUM - active;
  w.push((withheld
    ? (need > 0 ? `Call withheld — ${need} more current ${noun(need, "signal", "signals")} needed before any threshold can flip it.`
      : "Call withheld until its evidence is current and usable.")
    : nearest ? `Nearest flip: ${nearest.copy} → ${nextLabel}.`
    : "No single threshold flips this call; it would take a combination of moves.") +
    ` Actionability ${(call && call.actionability) || "HOLD"}.${override}${downgraded}`);
  return w;
}

export function computeFiveWhys(data, regime = {}, opts = {}) {
  const plain = opts.vocabulary === "simple";
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
  const direction = call?.direction || (baseLabel === "RISK-ON" ? "BULLISH" : baseLabel === "RISK-OFF" ? "BEARISH" : "NEUTRAL");
  const label = plain
    ? (call?.direction ? simpleCallLabel(call) : active >= 4 ? simpleCallLabel(direction) : SIMPLE_WITHHELD_LABEL)
    : call?.headline || PUBLIC_LABEL[baseLabel] || (active >= 4 ? "HODL" : "CAN'T CALL IT");
  const required = active ? Math.floor(active / 2) + 1 : 0;
  // A call carrying no direction was withheld; without a call, the regime's own quorum says.
  const withheld = call ? !call.direction : (regime.label === "INSUFFICIENT" || active < REGIME_QUORUM);

  /* 8/28 vocabulary matrix, row 11. This read "{bull}/{active} usable factors bullish" — the
     same N/M shape and the same word "usable" as the hero's coverage line, with the numerator
     silently switched from voters-counted to bullish-voters. On a full-coverage day the reader
     met "6 of 6 voters counted" above and "3/6 usable factors bullish" here and concluded half
     the book had gone dark. A tally now says it is a tally, and never wears a slash. */
  const prefix = opts.callFrozen ? "10am call —" : sessionPrefix(data.session);
  const headline = plain
    ? `${prefix} ${label}; ${bull} of the ${active} counted signals are helping.`
    : `${prefix} ${label} · ${direction}; ${bull} of the ${active} counted signals lean bullish.`;

  const is = (f, st, vote) => (f.state || "").toUpperCase() === st || f.vote === vote;
  const supports = usableFactors.filter((f) => is(f, "BULLISH", "bull"));
  const risks = usableFactors.filter((f) => is(f, "BEARISH", "bear"));
  const balances = usableFactors.filter((f) => is(f, "NEUTRAL", "neutral"));
  const excluded = factors.filter((f) => f.excluded);
  const confidence = call?.confidence || (active === total ? "HIGH" : active >= 4 ? "MEDIUM" : "LOW");

  const x = { label, direction, withheld, bull, bear, neutral, active, total, required,
    supports, risks, balances, excluded, confidence, call };
  const whys = plain ? simpleWhys(x) : degenWhys(x, data, opts);

  return {
    regime: plain ? label : `${label} · ${direction}`,
    headline,
    whys,
    labels: ["WHY THIS CALL", "WHAT DROVE IT", "WHY IT MATTERS", "CAN I TRUST IT", "WHAT CHANGES IT"],
    generatedAt: new Date().toISOString(),
  };
}
