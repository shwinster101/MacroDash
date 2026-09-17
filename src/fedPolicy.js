// src/fedPolicy.js — the FED tile's DECISION STATE and the policy-move magnitude.
// Pure, React-free, Node-importable (the src/sahm.js / src/headlines.js shape), so smoke
// RUNS it instead of string-pinning a claim about numbers.
//
// WHY THIS EXISTS (the 2026-09-16 FOMC read-through; the dated finding is on the branch, not
// named here — a product file may not carry a notes path, and smoke pins that).
// The FOMC raised the target range 25bp to 3.75–4.00% — the first hike in three years — and
// the dashboard scored well on every axis except one: NOTHING ON THE PAGE SAID SO. Measured
// live that evening: Kalshi carried the move at 86% and Engine 0's fed_next_meeting check
// voted BEARISH on it, the 10Y read 5.00 with a +0.32 monthly delta (`spiking`, bearish in
// both engines), and the ranked-headline engine put all three post-decision ranks on the
// hike at category weight 7 — while the FED tile rendered `3.50–3.75%` with a `FOMC today`
// countdown beside it and the outcome nowhere.
//
// The tile was not WRONG. DFEDTARU/DFEDTARL are the Fed's own daily target-range bounds and
// they step on the implementation note's EFFECTIVE DATE, which is the business day AFTER the
// meeting (2026-09-17 for this one), so on decision day the series correctly still carries
// the pre-meeting setting. The defect is that the tile had no way to SAY that: this engine
// reasons about STATE and an FOMC decision is an EVENT, so a scheduled, dated, discrete
// policy change could pass through the page as an unchanged number.
//
// Two states, and the ORDER between them is the honesty rule:
//   MOVED — the range has stepped and the step is recent. A confirmed fact, so it outranks
//           the calendar. Direction and size are MEASURED off the two bounds, never asserted.
//   TODAY — the FOMC decides today and the range has not stepped yet. States the MEETING
//           and, when the market feed is live, what the market has PRICED — and it NEVER
//           claims an outcome, because on decision day this module cannot see one. (Reading
//           the outcome out of a news headline would be a fabricated policy fact taken from
//           a title the ranker is forbidden to rewrite or score — the v3.51 one-way rule.)
//
// ⚠ CONTEXT, NOT A VOTE. The FED tile votes nowhere: REGIME_BAND_TABLE has no Fed factor,
// and the six-signal backdrop reads the policy story through the 10Y and financial
// conditions instead. Nothing here votes either, and the renderer paints the marker AMBER
// rather than through voteStyle — a green/red marker on a context tile would imply a vote it
// never casts (the v6.3 beat-2 rule, in colour). Promoting the policy path to a SEVENTH
// voter would move the majority math of a contract that gates real orders, and that is an
// owner ruling with the NFCI (v3.43) and 30Y (v3.55) precedents behind it — never a side
// effect of adding a marker.

/* How long a policy move stays NEWS. ASSERTED, not calibrated (the NFCI-deadband
   convention) — every boundary is EXECUTED in smoke, so retuning it is one edit plus one red
   test. Seven days covers the week in which the move is still the thing that happened; past
   that the range IS the state, and the tile's job goes back to showing the level. */
export const FED_MOVE_FRESH_D = 7;

const num = (v) => (Number.isFinite(v) ? v : null);
const ymd = (s) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
const dayGap = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
const bpOf = (a, b) => Math.round((a - b) * 100);
const rng = (lo, hi) => `${lo.toFixed(2)}–${hi.toFixed(2)}%`;

/* The prior DISTINCT value of a daily target-range series, and the FIRST date carrying the
   current one — i.e. the implementation note's effective date, READ OFF THE DATA rather than
   asserted. `obs` is FRED's own newest-first observation list ({date, value}).
   Returns null when the window is flat: "no step in view" is not a zero-size step, and the
   consumers below treat the two differently. Lives here rather than in snapshot.js so the
   walk is executable from Node (snapshot.js already imports src/sources.js and src/sahm.js —
   same esbuild-inline path). */
export function targetStepFrom(obs) {
  if (!Array.isArray(obs) || !obs.length) return null;
  const cur = parseFloat(obs[0] && obs[0].value);
  if (!Number.isFinite(cur)) return null;
  for (let i = 1; i < obs.length; i++) {
    const v = parseFloat(obs[i] && obs[i].value);
    if (!Number.isFinite(v)) continue;
    if (v !== cur) return { prev: v, changedAt: ymd(obs[i - 1] && obs[i - 1].date) };
  }
  return null;
}

/* The market's leading expectation, or null. ALL THREE legs are required: a partial book is
   not a priced market, and picking a leader out of two of them would overstate what the feed
   actually said. The caller passes `odds` only when the Kalshi leg is LIVE/CACHED. */
function leadOdds(od) {
  const hike = num(od.hike), hold = num(od.hold), cut = num(od.cut);
  if (hike === null || hold === null || cut === null) return null;
  const rows = [["hike", hike], ["hold", hold], ["cut", cut]].sort((a, b) => b[1] - a[1]);
  return { word: rows[0][0], pct: Math.round(rows[0][1]), hike, hold, cut };
}

function fedMove(x) {
  const up = num(x.upper), lo = num(x.lower), pUp = num(x.prevUpper), pLo = num(x.prevLower);
  const today = ymd(x.today);
  if (up === null || lo === null || pUp === null || pLo === null || !today) return null;
  /* SAME-DATE PAIR (the pairRs / pairCboeVix rule, one metric over): two bounds that stepped
     on DIFFERENT dates are not one range move, and describing them as one would be a
     fabricated event. Refuse rather than pick a date. */
  const cUp = ymd(x.changedUpper), cLo = ymd(x.changedLower);
  if (!cUp || !cLo || cUp !== cLo) return null;
  const age = dayGap(cUp, today);
  // A future effective date cannot be judged (the ageDays fail-closed convention), and past
  // the window the move is history, not news.
  if (!Number.isFinite(age) || age < 0 || age > FED_MOVE_FRESH_D) return null;
  const bps = bpOf(up, pUp), loBps = bpOf(lo, pLo);
  if (bps === 0) return null;
  /* Both bounds must move the SAME WAY. Opposite signs are incoherent for a target RANGE, so
     fail closed rather than describe it. A change in the range's WIDTH is coherent (the
     corridor has been 25bp wide throughout the range era, but that is a fact about history,
     not a rule), so it is NAMED in `detail` rather than refused. */
  if (loBps !== 0 && Math.sign(loBps) !== Math.sign(bps)) return null;
  const hiked = bps > 0, mag = Math.abs(bps);
  return {
    kind: "MOVED",
    direction: hiked ? "HIKED" : "CUT",
    bps: mag, signedBps: bps, effective: cUp, ageDays: age,
    from: { lower: pLo, upper: pUp }, to: { lower: lo, upper: up },
    widthChanged: loBps !== bps,
    priced: null,
    label: `${hiked ? "HIKED" : "CUT"} ${hiked ? "+" : "-"}${mag}bp`,
    detail: `The FOMC ${hiked ? "raised" : "lowered"} the federal funds target range by ${mag}bp`
      + ` — ${rng(pLo, pUp)} to ${rng(lo, up)}, effective ${cUp}.`
      + (loBps !== bps ? ` The range width changed too (lower bound ${loBps > 0 ? "+" : ""}${loBps}bp).` : "")
      + " Context only — the six-signal model does not read the policy level.",
  };
}

/* fedDecisionState({upper, lower, prevUpper, prevLower, changedUpper, changedLower,
                     decidesToday, odds, today}) → a decision state, or null.
   Every input is the CALLER's to gate on freshness: the orchestrator passes the range legs
   only when fedTargetUpper/Lower read LIVE/CACHED and `odds` only when the Kalshi leg does,
   so a dead feed can never manufacture a marker. null renders nothing — the tile falls back
   to its countdown, which is the honest state when there is no event to report. */
export function fedDecisionState(o) {
  const x = o && typeof o === "object" ? o : {};
  // A confirmed step outranks a calendar entry: the fact beats the schedule.
  const moved = fedMove(x);
  if (moved) return moved;
  if (x.decidesToday !== true) return null;
  const lead = x.odds && typeof x.odds === "object" ? leadOdds(x.odds) : null;
  return {
    kind: "TODAY",
    direction: null, bps: null, signedBps: null, effective: null, ageDays: null,
    from: null, to: null, widthChanged: false, priced: lead,
    label: lead ? `today · ${lead.pct}% ${lead.word}` : "FOMC today",
    detail: "The FOMC decides today. The range shown is the setting BEFORE this meeting — a"
      + " change takes effect the next business day, so it is confirmed here tomorrow."
      + (lead
        ? ` Market pricing right now: ${lead.hike}% hike / ${lead.hold}% hold / ${lead.cut}% cut`
          + " — an expectation, not the outcome."
        : " Market pricing is unavailable.")
      + " Context only — the six-signal model does not read the policy level.",
  };
}

/* The MAGNITUDE in bp (unsigned) of a policy move inside the freshness window — the alert
   layer's reader. Direction is deliberately dropped: a CUT is as wake-worthy as a hike (and
   the more bullish of the two), so ONE alert covers both and the tile's marker carries the
   direction one glance away.
   Returns 0 when the range is READABLE and nothing moved, and NaN only when the range itself
   cannot be read — "nothing tripped" and "I cannot see whether it tripped" are different
   facts, and only the second may read BLIND (the v3.52 rule). */
export function fedMoveBp(fed, today) {
  const f = fed && typeof fed === "object" ? fed : {};
  if (!Number.isFinite(f.targetUpper) || !Number.isFinite(f.targetLower)) return NaN;
  const m = fedMove({
    upper: f.targetUpper, lower: f.targetLower,
    prevUpper: f.prevTargetUpper, prevLower: f.prevTargetLower,
    changedUpper: f.targetUpperChangedAt, changedLower: f.targetLowerChangedAt,
    today,
  });
  return m ? m.bps : 0;
}
