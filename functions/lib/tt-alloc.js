// FEAT-TT-ALLOC (v3.100): the pure allocation core — the server-side answer to
// "if this is the best eligible buy, what should fund it, and what could invalidate that?"
//
// WHY THIS EXISTS (2026-08-17 allocation review, verified): the ELIGIBLE NEXT DOLLAR ladder
// lived ONLY in admin.html — no server record ever bound "this was the eligible buy" to the
// evidence that made it eligible. This module re-derives that ladder rung-for-rung from
// server-resident data so /api/allocation can persist a receipt. It is RECOMMENDATION-ONLY:
// nothing here (or anywhere in this repo) places, prepares, or references a broker order.
//
// PURE by construction: no KV, no fetch, no Date.now() defaults leaking hidden state — the
// endpoint feeds it plain data. Node-importable, so smoke RUNS the truth tables.
//
// ⚠ §14.8 ACTIVATED (owner ruling 2026-08-23, SCORED-only policy): the shadow period is
// over. This module now RECEIVES the server score index (still pure — the endpoint loads
// tt:score:index:v1 and passes it in) and the quality rung of the eligibility ladder reads
// SERVER CARDS, never the legacy free-text composite: only a card with status SCORED,
// minted under the CURRENT methodology, may make a name eligible; a PROVISIONAL card ranks
// (B-capped) and is vetoed with the falsifiers-pending reason; no card at all is "no server
// card — unscored". The old bar's own text said BROKEN_THESIS was barred from the forced
// funding tier "until activation" — this is that moment: a server-stamped broken_thesis
// flag (kill-flagged falsifier RED, or a BROKEN_THESIS gate FAIL) now forces tier 1,
// beside the owner-marked signals it joins. Smoke [68] pins the ACTIVATED contract — the
// inverse of the pin that held the bar.
//
// ⚠ MIRRORS (admin.html is buildless and cannot import — the MAX_BODY convention, each pair
// smoke mirror-pinned): CAP_PCT (admin L1340) · PX_STALE_D=4 (admin L1347) · REG_RANK
// (admin L3326) · run-state thresholds 30/90 (admin runState) · the gate-ladder rung order
// (admin gateFail region). POS_STALE_D is imported from the positions store, which owns it.

import { ptModelRows, ptRowYears, lintPtModel, pickRow, annualise } from "../../src/ptModel.js";
import { computeTechRead } from "../../src/techRead.js";
import { etYmd } from "../../src/sources.js";
import { POS_STALE_D } from "../api/positions.js";
import { maxDrawdownPct } from "../../src/publicHistory.js";

// v3.1.0 (v5.6 THE DAILY CONTRACT, owner sprint doc 2026-08-26): ADDITIVE receipt fields —
// the product macro gate (macro_gate: SEND_IT | HODL | TOUCH_GRASS, ONE projection of the
// gate ladder so the word can never disagree with the veto it names), the public md-call
// binding, per-row belief-vs-street spread on the eligible + why_not rows (formula frozen,
// street legs LABELED reviewed/sourced per the v4.2 target priority), the #2-overtakes flip
// line, and the endpoint's ATTEST/stamped-day + outcome layer. No existing field is
// reinterpreted — a v3.0.0 receipt stays readable; the bump records the added meaning.
// v3.0.0 (v5.2 CAP-ASTERISK, owner ruling 2026-08-25: "I'm not adhering to the allocation
// cap — keep it as an asterisk and rank sells by pure technicals, pt, and scores"): the
// 18% cap DEMOTES from enforcement to annotation on BOTH ladders — the buy-side cap veto
// (RANKFAIR v3.36) and the forced funding tier (SELLRANK v3.38) are REVERSED as documented
// owner reversals. The funding ranking becomes MERIT, lexicographic in the owner's stated
// axis order: tape (techRead, BEARISH first) -> lowest %/yr -> lowest TT card score —
// never a blended unit (DEC-D2). Cluster and session-order tiers demote to flags the same
// way. Receipt semantics changed on both sides, so the version moved (the v4.1.4 rule).
// v2.1.0 (v5.1.1) added the card-actionability veto rung; v2.0.0 was the §14.8 activation
// (quality rung to server cards + broken_thesis into forced funding); v1.1.0 was the
// horizon-never-substituted change.
export const ALLOC_RULE_VERSION = "tt-alloc-v3.1.0";
export const CAP_PCT = 18;      // mirror of admin.html — REFERENCE cap (asterisk, not a wall, since v5.2)
export const PX_STALE_D = 4;    // mirror of admin.html (a stamped mark older than this misleads)
export const REG_RANK = { TAILWIND: 0, NEUTRAL: 1, HEADWIND: 2, PANIC: 3 };
/* FIX-C (v3.49) verbatim — the funding list is where the next dollar comes FROM, never a
   sell call. This string rides every receipt so the persisted record carries the same
   honesty the screen does. */
export const FUNDING_LABEL = "FUNDING PRIORITY — not a sell recommendation";
export { POS_STALE_D };

// ── time ────────────────────────────────────────────────────────────────────
// Completed-day age of an ISO date/datetime against the ET calendar (the etYmd clock every
// other time-judge in this stack uses — FIX-A). null = undated, which every consumer treats
// as the WORST state, never the freshest.
export function ageDaysEt(iso, now) {
  if (!iso) return null;
  const d = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const days = Math.round((new Date(etYmd(now) + "T00:00:00Z") - new Date(d + "T00:00:00Z")) / 86400000);
  return isFinite(days) ? days : null;
}

function runStateOf(iso, now) {   // mirror of admin runState(): 30d fresh · 90d head · never
  const d = ageDaysEt(iso, now);
  if (d === null || d < 0) return { k: "never", days: null };
  if (d > 90) return { k: "head", days: d };
  if (d > 30) return { k: "stale", days: d };
  return { k: "fresh", days: d };
}

/* ── FEAT-TT-CIRCUIT (v4.1 Step 1): the structured circuit is CANONICAL ─────────────────
   The 8/18 ambiguity audit's P0: the live board carried "presumed tripped" PROSE while the
   structured `board.circuit` was null — and null read as not-tripped everywhere, so both the
   client and this ladder permitted allocation. A permission the session only narrates is not
   a permission state. Absence, a malformed record, an undated record, and a stale
   clear/armed record are all UNRESOLVED — fail closed, adds suspended, reason named.
   ASYMMETRY (house doctrine, v3.40): `tripped` NEVER expires into clear — stale bearishness
   survives; stale permission-to-add does not. `clear`/`armed` older than CIRCUIT_STALE_D
   degrade to unresolved. Mirrored in admin.html (buildless) — the smoke mirror pin keeps the
   two constants and the resolution rules from drifting. */
export const CIRCUIT_STALE_D = 7;   // mirror of admin.html — a week-old "clear" is not evidence of safety
export function circuitState(c, now) {
  if (!c || typeof c !== "object" || Array.isArray(c))
    return { st: "unresolved", age: null, reason: "no structured circuit record on the board — session prose is explanation, not permission" };
  const st = String(c.state || "").toLowerCase();
  if (!["clear", "armed", "tripped"].includes(st))
    return { st: "unresolved", age: null, reason: `circuit state "${c.state}" is not clear|armed|tripped` };
  const age = ageDaysEt(c.as_of, now);
  if (st === "tripped")   // fail-safe direction: an old or undated trip still trips
    return { st, age, reason: age === null ? "tripped — state undated; still binding until a live pull disproves it" : null };
  if (age === null)
    return { st: "unresolved", age, reason: `circuit ${st.toUpperCase()} is undated — an undated permission reads as unresolved, never as current` };
  if (age < 0)
    return { st: "unresolved", age, reason: `circuit ${st.toUpperCase()} is dated in the future — cannot be judged` };
  if (age > CIRCUIT_STALE_D)
    return { st: "unresolved", age, reason: `circuit ${st.toUpperCase()} asserted ${age}d ago (limit ${CIRCUIT_STALE_D}d) — stale permission is not evidence of safety; re-assert it in ◧ SESSION` };
  return { st, age, reason: null };
}

// ── the gate ladder ──────────────────────────────────────────────────────────
// Rung-for-rung with admin.html's circuit veto + gateFail ladder. Every unreadable input is
// a NAMED veto — fail closed, never default to clear. Returns null when every gate reads.
export function allocGateLadder({ board, readout, now }) {
  const b = board || {};
  const cs = circuitState(b.circuit, now);
  if (cs.st === "tripped")
    return { rung: "circuit", reason: "leverage circuit tripped — deleverage-only; no name is eligible while the circuit holds" };
  if (cs.st === "unresolved")
    return { rung: "circuit", reason: `ADDS SUSPENDED — circuit state unresolved: ${cs.reason}. A structured circuit record is required before any add — set it in ◧ SESSION` };
  // `armed` is a CAUTION, not a veto (mirrors the client stance) — carried on the receipt's
  // permission block and the eligible row's cautions by evaluateAllocation, never a gate.
  const measured = (readout && readout.regime && readout.regime.verdict) || null;
  const asserted = b.regime && typeof b.regime.asserted === "string" ? b.regime.asserted.toUpperCase() : null;
  const mR = REG_RANK[measured], aR = REG_RANK[asserted];
  if (mR === undefined && aR === undefined)
    return { rung: "stance", reason: "stance UNKNOWN — no measured or asserted regime; a live regime read is mandatory before an add" };
  const gov = mR === undefined ? asserted : aR === undefined ? measured : (aR > mR ? asserted : measured);
  if (gov === "PANIC")
    return { rung: "stance", reason: "adds suspended — PANIC regime blocks ticker eligibility until Engine 0 clears" };
  if (!readout)
    return { rung: "feed", reason: "regime feed unavailable — Macro Flip cannot be read, and an unreadable crash circuit vetoes rather than defaulting to clear" };
  const reg = readout.regime;
  if (!reg || !reg.actionability)
    return { rung: "actionability", reason: "Engine 0 actionability unavailable — only an explicit FULL may gate capital" };
  if (reg.actionability !== "FULL")
    return { rung: "actionability", reason: `regime actionability ${reg.actionability}${reg.status ? ` (${reg.status})` : ""} — the evidence axis says don't gate on this, regardless of the verdict` };
  const mf = readout.macro_flip;
  if (!mf) return { rung: "flip", reason: "readout carries no Macro Flip block — the crash circuit cannot be read" };
  if (mf.evaluable === false) return { rung: "flip", reason: mf.reason || "Macro Flip BLIND — missing inputs" };
  if (mf.tripped) return { rung: "flip", reason: "Macro Flip TRIPPED — de-risk, no adds" };
  return null;
}

/* v5.6 THE DAILY CONTRACT — the product gate: three words over the ladder above, derived
   from its RESULT so the gate can never disagree with the veto it names (the verdictFrom
   rule: one expression of a rule). SEND_IT = the ladder read clean (actionability FULL by
   construction of the ladder itself). HODL = the ONE looking-session state: everything is
   readable and the ranking fully usable, but the evidence axis said RESTRICTED — visible,
   still vetoed (owner ruling: fail-closed doctrine untouched), named. Every other veto
   (tripped/unresolved circuit, PANIC, unreadable feed/flip, HOLD) is TOUCH_GRASS: no clean
   macro-dependent BUY path. Vocabulary is the owner's locked product voice (2026-08-26
   sprint doc); the tt-v1 machine contract does not move. */
export function macroGateFrom(gateResult, readout) {
  if (gateResult === null) return { gate: "SEND_IT", rung: null, reason: null };
  const hodl = gateResult.rung === "actionability" &&
    !!(readout && readout.regime && readout.regime.actionability === "RESTRICTED");
  return { gate: hodl ? "HODL" : "TOUCH_GRASS", rung: gateResult.rung, reason: gateResult.reason };
}

/* v5.6 — the belief-vs-street spread, FROZEN: (belief − street) / live price × 100, both
   legs against the same price so the number is comparable across names. Sign buckets carry
   an asserted ±SPREAD_ALIGNED_PCT deadband (the NFCI convention: asserted, boundary-
   executed in smoke, one edit + one red test to change). */
export const SPREAD_ALIGNED_PCT = 10;
export function spreadOf(belief, street, px) {
  if (![belief, street, px].every((v) => typeof v === "number" && isFinite(v)) || px <= 0) return null;
  const pct = Math.round(((belief - street) / px) * 1000) / 10;
  const sign = pct > SPREAD_ALIGNED_PCT ? "you_richer" : pct < -SPREAD_ALIGNED_PCT ? "street_richer" : "aligned";
  return { pct, sign };
}
/* The street leg, per the v4.2 target priority: a REVIEWED packet's published TipRanks
   average (consumed directly, never re-averaged — the v3.90 rule) outranks a stored
   assistant-sourced consensus.street_target; both are LABELED so a sourced number can
   never wear the reviewed rung's authority. Neither present = null, never a guess. */
export function streetLegOf(idx, streetRec) {
  const t = streetRec && streetRec.analystTarget;
  const pub = t && Number(t.average);
  if (isFinite(pub) && pub > 0)
    return { pt: pub, src: "reviewed", as_of: (t && (t.as_of || t.asOf)) || streetRec.as_of || streetRec.asOf || null };
  const st = idx && idx.consensus && idx.consensus.street_target;
  const pt = st && Number(st.pt);
  if (isFinite(pt) && pt > 0) return { pt, src: "sourced", as_of: st.as_of || null };
  return null;
}

// ── the buy side ─────────────────────────────────────────────────────────────
// D1 (v3.39): the horizon is COMPUTED — the deepest year-end EVERY modelled name reaches.
export function autoHorizonOf(rowsBySym) {
  let hz = null;
  for (const rows of Object.values(rowsBySym)) {
    if (!rows.length) continue;
    const maxY = rows[rows.length - 1].y;
    if (hz === null || +maxY < +hz) hz = maxY;
  }
  return hz;
}

/* One name's server-side evaluation. Readiness blockers mirror the client subset that is
   server-computable from index + book + quotes; anything this altitude cannot see is NAMED
   as a blocker (a missing dd-index entry), never silently passed. Cautions do not veto —
   the client rule (aging evidence is the owner's to weigh; missing evidence is not). */
export function evalBuyRow({ entry, idx, quote, board, horizon, now, card }) {
  const sym = entry.sym;
  const blockers = [], cautions = [];
  if (!idx) {
    return { sym, blockers: ["dd index unavailable — the board working set carries no entry for this name"], cautions, px: null, tgt: null, up: null, ann: null, quality: null, rolled: null, no_rung_at_horizon: null };
  }
  const rs = runStateOf(entry.lastRun, now);
  if (rs.k === "never") blockers.push("TT never run");
  else if (rs.k === "head") blockers.push(`TT run ${rs.days}d old`);
  else if (rs.k === "stale") cautions.push(`TT run ${rs.days}d old`);
  const td = ageDaysEt(idx.as_of, now);
  if (td === null || td < 0) blockers.push("thesis undated");
  else if (td > 30) cautions.push(`thesis ${td}d old`);
  const rows = ptModelRows(idx, etYmd(now).slice(0, 4));
  const lints = lintPtModel(idx, etYmd(now).slice(0, 4));
  if (!rows.length) blockers.push("no pt_model — no target computes");
  else if (lints.some((l) => l.sev === "error")) blockers.push("pt_model MIS-KEYED");
  const live = quote && isFinite(quote.px) ? quote.px : null;
  const stamp = idx.ref_px && isFinite(idx.ref_px.px) ? idx.ref_px.px : null;
  const px = live !== null ? live : stamp;
  // v4.1 Step 4: the date under the price rides the row, so the basis can be DISCLOSED.
  const px_at = live !== null ? ((quote && quote.at) || null) : ((idx.ref_px && idx.ref_px.at) || null);
  if (px === null) blockers.push("no usable price");
  else if (live === null) {
    const pd = ageDaysEt(idx.ref_px && idx.ref_px.at, now);
    if (pd === null) cautions.push("mark undated");
    else if (pd > PX_STALE_D) cautions.push(`mark ${pd}d old`);
  }
  const hinges = Array.isArray(idx.hinges) ? idx.hinges : [];
  if (!hinges.length) blockers.push("no hinges defined");
  else {
    const reds = hinges.filter((h) => h.state === "red").length;
    if (reds) cautions.push(`${reds} hinge${reds === 1 ? "" : "s"} RED`); // D3: surfaced, never a veto
  }
  const ds = Array.isArray(board && board.decisions) ? board.decisions : [];
  const mine = ds.filter((d) => d && d.blocking && d.sym && String(d.sym).toUpperCase() === sym);
  if (mine.length) blockers.push(`${mine.length} blocking decision${mine.length === 1 ? "" : "s"} open`);

  /* v4.1.3 — the horizon is never substituted. `pickRow` returns null when the shared year
     is absent ("pinned year absent → excluded and counted, never substituted", ptModel.js),
     and BOTH other consumers honour that: scoreP1 blocks with "no row at the shared horizon
     — never substituted", and the terminal's own renderUpsideRank excludes the name and
     counts it (admin.html, the ddWorth audit note). This module alone fell back to the
     name's nearest row, so a name with a gappy estimate series was ranked on a DIFFERENT
     year from every row it was sorted against — an apples-to-oranges sort key (the DEC-D2
     units error) and a server receipt that silently disagreed with the client ranking for
     the same name. The fallback is gone; the exclusion is NAMED instead. */
  const pk = rows.length ? pickRow(rows, horizon || "", now) : null;
  const noRung = rows.length > 0 && !pk ? (horizon || null) : null;
  const r = pk && pk.row;
  const tgt = r ? (typeof r.prem === "number" ? r.prem : (typeof r.fl === "number" ? r.fl : null)) : null;
  const up = px !== null && tgt !== null ? Math.round((tgt / px - 1) * 1000) / 10 : null;
  const ann = up !== null && r ? annualise(up, r.y, now) : null;
  /* v5.0 §14.8 ACTIVATION: quality is the SERVER CARD, never the legacy free-text
     composite. This also closes a silent client/server divergence for free: the old code
     took idx.composite.score RAW (unparsed — deepdive.js copies it verbatim), so a string
     score like "R3-A: 9.0" compared `s < 5.5` as false and PASSED by accident while the
     client parsed 9.0 out of the same text. A card score is numeric by construction.
     `card` is the score-index entry for this sym (or null): {status, raw_score,
     provisional_score, capped_tier, provisional_tier, methodology_version, broken_thesis}
     plus `methodology_current` stamped by the caller. Ranking may use a provisional
     number; ELIGIBILITY requires SCORED under the current methodology — whyNot() is
     where that distinction is enforced. */
  const qBase = card ? { status: card.status || null, methodology_current: card.methodology_current === true,
    p4: card.p4 || null, actionability: card.actionability ?? null, blocked_on: card.blocked_on || [] } : null;
  const quality = card && (card.raw_score ?? card.provisional_score) !== null && (card.raw_score ?? card.provisional_score) !== undefined
    ? { ...qBase, score: card.raw_score ?? card.provisional_score,
        tier: card.raw_score !== null && card.raw_score !== undefined ? (card.capped_tier || null) : (card.provisional_tier || null) }
    : (qBase ? { ...qBase, score: null, tier: null } : null);
  /* CAUTION never vetoes — aging evidence is the owner's to weigh, missing evidence is not
     (the readiness() rule). It is surfaced here so the row still says the card is aging. */
  if (quality && quality.actionability === "CAUTION") cautions.push("card actionability CAUTION — aging evidence");
  return { sym, blockers, cautions, px, px_at, live: live !== null, tgt, y: r ? r.y : null,
    up, ann, quality, rolled: pk ? pk.rolled : null, no_rung_at_horizon: noRung };
}

/* v4.1 Step 4: ONE price-basis vocabulary, shared by server and client (the receipt carries
   the computed string, so the buildless client never re-derives it). The 8/18 audit found
   eligible.live_px:false rendered NOWHERE — a green allocation state built on a stamped mark
   disclosed nothing. A stamped mark is never relabelled live. */
export function priceBasisOf(e) {
  if (!e || e.px === null || e.px === undefined || !isFinite(Number(e.px))) return "no usable price";
  const isLive = e.live === true || e.live_px === true;
  if (isLive) return "live price";
  return e.px_at ? "stamped price" : "stamped price — undated";
}

// The per-row veto ladder (admin why(r)), on the server row shape. null = eligible.
export function whyNot(row, weightPct) {
  /* Ordered before "no gap" deliberately: a modelled name with no rung at the shared year
     also has up === null, and reporting that as "no gap" would claim the comparison ran and
     found no upside. It never ran. (v4.1.3) */
  if (row.no_rung_at_horizon)
    return `no ${row.no_rung_at_horizon} rung — excluded at the shared horizon, never substituted`;
  if (!(row.up > 0)) return "no gap";
  /* v5.2 CAP-ASTERISK: the cap rung is GONE — a documented owner reversal of RANKFAIR
     (v3.36), which vetoed the pick at/over CAP_PCT. The weight still rides the row and an
     over-cap pick carries the reference-cap caution (added in evaluateAllocation), so the
     asterisk survives everywhere the veto used to fire — visible, never enforcing. */
  if (row.blockers.length) return `evidence: ${row.blockers.join(", ")}`;
  /* v5.0 §14.8 ACTIVATION (SCORED-only, owner ruling 2026-08-23): the quality rung reads
     the server card. Each non-eligible state gets ITS OWN reason — a PROVISIONAL name and
     an unscored one are different facts, and the veto text is what the owner reads. */
  if (!row.quality) return "no server card — unscored";
  const q = row.quality;
  if (q.status === "PROVISIONAL") {
    /* v5.0.1: the veto names WHICH half of §6.4.1 is missing. The old single string said
       "until they're committed" for every PROVISIONAL name — false for a committed set
       awaiting observations (TSM, measured live: 6 server-stamped hinges, 0 observed).
       "Unwritten" and "unobserved" are different owner actions; the counts say which. */
    const cap = q.tier || "B", tail = ` — capped at ${cap} (PROVISIONAL is never eligible)`;
    const p4 = q.p4;
    if (!p4 || !p4.kind) return "falsifiers pending" + tail;         // pre-v5.0.1 index entry — kind unknown, claim neither half
    if (p4.kind === "LEGACY_POST_HOC" || !(p4.hinges > 0)) return "falsifiers unwritten" + tail;
    if (p4.hinges < 3) return `falsifiers ${p4.hinges}/3 written — set incomplete` + tail;
    if (p4.observed < p4.hinges) return `falsifiers committed, ${p4.observed}/${p4.hinges} observed — awaiting qualifying observations` + tail;
    return "falsifiers committed this write — a later write scores them (§6.4.1)" + tail;
  }
  if (q.status !== "SCORED")
    return `server card ${q.status || "incomplete"} — blockers on the card`;
  if (!q.methodology_current)
    return "card predates the current methodology — re-score to verify (§4.3)";
  /* v5.1.1 — THE CARD'S OWN ACTIONABILITY, read at the gate at last. §7's rollup sets
     BLOCKED when a route gate returned UNKNOWN (gatePrecedence: "UNKNOWN blocks"), and
     §11.2 evalEligibility has always refused anything but FULL/CAUTION — but the LIVE
     ladder never asked, so a SCORED card whose own evidence rollup said BLOCKED could
     light green. Same defect shape as the v3.71 follow-up, one layer over: computed,
     published, rendered, and not READ where it gates capital.
     CAUTION passes (surfaced as a caution above) — aging evidence is the owner's call.
     An ABSENT field passes: a pre-v5.1.1 index entry simply predates the field, and
     failing closed there would veto the whole book over a value nobody wrote yet — an
     outage dressed as a safety rule. Re-scoring populates it (the v5.0.1 p4 precedent). */
  if (q.actionability === "BLOCKED")
    return `card actionability BLOCKED — ${q.blocked_on && q.blocked_on.length
      ? `${q.blocked_on.join(", ")} cannot be read`
      : "evidence missing on the card"} (UNKNOWN blocks, §8.1)`;
  const s = q.score;
  if ((q.tier && /^C\b/.test(String(q.tier))) || (s !== null && s < 5.5))
    return `TT ${s !== null ? Number(s).toFixed(1) : "C"} — quality fails`;
  return null;
}

// ── the funding side ─────────────────────────────────────────────────────────
/* Five tiers, owner-locked precedence, governing reason per row. Weight prefers the
   broker-measured pct; the tracked-book floor is NAMED as a floor when it substitutes.
   do_not_trim is FLAGGED, never hidden (the RANKFAIR rule). Options-only sleeves keep the
   v3.44 rules: signed sum, unmeasured reads as such, a net-short sleeve is an obligation. */
/* v5.2 CAP-ASTERISK: the five owner-locked tiers collapse to TWO. Tier 1 (owner-marked
   forced exits, the cut list, server-stamped BROKEN_THESIS) still ranks first — those are
   decisions already made, not rankings. Everything else is ONE merit pool, lexicographic
   in the owner's stated axis order: tape (techRead label, BEARISH first; MIXED/UNREAD and
   no-read all middle — an unmeasured tape is never a judgment) -> lowest %/yr -> lowest TT
   card score, size as the final tie-break. Axes stay lexicographic, never blended, and the
   row states all three. The old tiers 2-4 (over-cap, cluster, session order) become FLAGS —
   informational, visible on the row, enforcing nothing (owner ruling 2026-08-25). */
export function fundingRanking({ book, board, positions, rowsAnn, now, noRungSyms, brokenSyms, techBySym = {}, scoreBySym = {} }) {
  const b = board || {}, pos = positions || {};
  const cut = new Set(Array.isArray(book && book.cut) ? book.cut : []);
  const forcedSyms = new Map(); // sym -> reason
  for (const d of (Array.isArray(b.decisions) ? b.decisions : []))
    if (d && d.forced_exit === true && d.sym)
      forcedSyms.set(String(d.sym).toUpperCase(), `owner-marked forced exit${d.q ? `: ${String(d.q).slice(0, 80)}` : ""}`);
  for (const s of Object.keys(pos)) if (cut.has(s)) forcedSyms.set(s, "on the cut list — exited from the book, still held");
  /* v5.0 §14.8 ACTIVATION: a server-stamped broken thesis (kill-flagged falsifier RED, or
     a BROKEN_THESIS gate FAIL) forces tier 1 for a HELD name — the signal the old bar
     deferred "until activation". Server-stamped only (the index flag), never client
     free text; owner-marked reasons take precedence when both apply (first-set wins). */
  if (brokenSyms instanceof Set)
    for (const s of Object.keys(pos))
      if (brokenSyms.has(s) && !forcedSyms.has(s))
        forcedSyms.set(s, "BROKEN_THESIS — kill-flagged falsifier RED on the server card");

  const clusters = Array.isArray(b.clusters) ? b.clusters : [];
  const clusterOver = new Map(); // sym -> reason
  for (const cl of clusters) {
    let sum = 0, n = 0; const missing = [];
    for (const m of cl.members || []) {
      const p = pos[m];
      if (!p || !isFinite(Number(p.pct))) { missing.push(m); continue; }
      sum += Number(p.pct); n++;
    }
    if (n && sum > CAP_PCT) {
      const label = cl.label || cl.id;
      for (const m of cl.members || []) if (pos[m])
        clusterOver.set(m, `cluster "${label}" at ${Math.round(sum * 10) / 10}%${missing.length ? ` (FLOOR — unmeasured: ${missing.join(", ")})` : ""} — over the ${CAP_PCT}% cap`);
    }
  }
  const orderMarked = new Map();
  (Array.isArray(b.funding && b.funding.order) ? b.funding.order : []).forEach((r, i) => {
    if (r && r.sym) orderMarked.set(String(r.sym).toUpperCase(), { i, reason: `session funding order #${i + 1}${r.note ? ` — ${String(r.note).slice(0, 60)}` : ""}` });
  });
  const noRung = noRungSyms instanceof Set ? noRungSyms : new Set();
  const dnt = new Set(Array.isArray(b.funding && b.funding.do_not_trim) ? b.funding.do_not_trim : []);

  const rows = [], optOnly = [];
  for (const [sym, p] of Object.entries(pos)) {
    const oo = Array.isArray(p.opt) && p.opt.length > 0 && !(Number(p.sh) > 0);
    if (oo) {
      const legs = p.opt;
      const unsynced = legs.filter((o) => o.mv === undefined).length;
      const mv = unsynced ? null : legs.reduce((a, o) => a + Number(o.mv), 0);
      optOnly.push({ sym, legs: legs.length, mv,
        note: unsynced ? `${unsynced} of ${legs.length} leg(s) have no synced value` : (mv <= 0 ? `net short — closing costs ${Math.abs(mv).toFixed(0)}, a USE of cash` : null) });
      continue;
    }
    const pct = isFinite(Number(p.pct)) ? Number(p.pct) : null;
    const ann = rowsAnn && sym in rowsAnn ? rowsAnn[sym] : null;
    const lots = Array.isArray(p.lots) ? p.lots : [];
    const lt = lots.filter((l) => (ageDaysEt(l.acquired, now) ?? 0) > 365).reduce((a, l) => a + Number(l.sh), 0);
    const st = lots.reduce((a, l) => a + Number(l.sh), 0) - lt;
    const tech = techBySym[sym] ?? null;
    const score = scoreBySym[sym] ?? null;
    // BEARISH sells first; MIXED, UNREAD and no-read all sit in the middle — an unmeasured
    // tape is never a judgment in either direction (the v3.83 rule), so it cannot outrank a
    // measured BEARISH nor hide behind a BULLISH it never earned.
    const techRank = tech === "BEARISH" ? 0 : tech === "BULLISH" ? 2 : 1;
    const flags = [];
    if (pct !== null && pct >= CAP_PCT)
      flags.push(`⚠ ${pct}% — over the ${CAP_PCT}% reference cap (informational — owner ruling 2026-08-25)`);
    if (clusterOver.has(sym)) flags.push(`⚠ ${clusterOver.get(sym)} (informational)`);
    if (orderMarked.has(sym)) flags.push(`${orderMarked.get(sym).reason} — asserted, shown not enforced`);
    let tier, reason;
    if (forcedSyms.has(sym)) { tier = 1; reason = forcedSyms.get(sym); }
    else {
      tier = 2;
      reason = `merit rank — tape ${tech ?? "UNREAD"} · ` +
        (ann !== null ? `${ann}%/yr` : (noRung.has(sym) ? "no rung at the shared horizon" : "unmodelled — no %/yr")) +
        ` · TT ${score !== null ? score : "no card"}`;
    }
    rows.push({ sym, tier, reason, pct, mv: isFinite(Number(p.mv)) ? Number(p.mv) : null, ann,
      tech, techRank, score, flags,
      dnt: dnt.has(sym), pos_age_d: ageDaysEt(p.at, now),
      lots: lots.length ? { lt_sh: lt, st_sh: st } : null });
  }
  rows.sort((a, b2) => a.tier - b2.tier
    || (a.tier === 1 ? 0
      : (a.techRank - b2.techRank
        || ((a.ann ?? 1e9) - (b2.ann ?? 1e9))
        || ((a.score ?? 1e9) - (b2.score ?? 1e9))))
    || ((b2.mv ?? 0) - (a.mv ?? 0)));
  return { label: FUNDING_LABEL, rows, optOnly,
    basis: "merit rank (owner ruling 2026-08-25): tape (bearish first) -> lowest %/yr -> lowest TT card score; cap, cluster and session order are FLAGS, never tiers" };
}

/* v5.6 — outcomes for a stamped day, mirroring the shipped public pattern
   (src/publicHistory.js buildForwardOutcome, v5.5): day 0 is the FIRST official close ON OR
   AFTER the stamp date — a stamp made mid-session must not count pre-stamp movement as an
   outcome — 1d/5d/20d are the next trading closes, and drawdown is explicitly "so far"
   until session 20 (maxDrawdownPct is IMPORTED, one implementation). Closes come from the
   facts store's daily candles; no usable history = a NAMED reason, never a zero. */
export function stampOutcome(dateEt, closes) {
  const rows = (Array.isArray(closes) ? closes : [])
    .map((r) => ({ date: String(r && r.date || "").slice(0, 10), close: Number(r && r.close) }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && isFinite(r.close) && r.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const i = rows.findIndex((r) => r.date >= dateEt);
  if (i < 0) return { anchor: null, reason: "no close on or after the stamp date in the facts store" };
  const anchor2 = rows[i], fwd = rows.slice(i + 1, i + 21);
  const ret = (n) => fwd.length >= n ? Math.round((fwd[n - 1].close / anchor2.close - 1) * 1000) / 10 : null;
  return { anchor: { date: anchor2.date, close: anchor2.close },
    returns_pct: { "1d": ret(1), "5d": ret(5), "20d": ret(20) },
    max_drawdown_pct: maxDrawdownPct([anchor2.close, ...fwd.map((r) => r.close)]),
    max_drawdown_status: fwd.length >= 20 ? "FINAL" : "SO_FAR",
    sessions_observed: fwd.length, status: fwd.length >= 20 ? "COMPLETE" : "PENDING" };
}

// ── the whole evaluation ─────────────────────────────────────────────────────
export function evaluateAllocation({ book, ddIndex, posDoc, quotes, readout, now, scoreIndex, methodologyVersion, streetBySym = {} }) {
  const board = (book && book.board) || {};
  const entries = Array.isArray(book && book.book) ? book.book : [];
  const idxEntries = (ddIndex && ddIndex.entries) || {};
  const positions = (posDoc && typeof posDoc.positions === "object" && !Array.isArray(posDoc.positions)) ? posDoc.positions : {};
  const gate = allocGateLadder({ board, readout, now });
  // FEAT-TT-CIRCUIT (v4.1): the permission facts ride the receipt explicitly, so the client
  // renders the SAME resolution this evaluation gated on rather than re-deriving its own.
  const cs = circuitState(board.circuit, now);

  // rows for every book name (the ranking is always computed — the gate withholds
  // ELIGIBILITY, never the math; the v3.74.1 "ranking always renders" contract).
  const rowsBySym = {};
  for (const e of entries) {
    const idx = idxEntries[e.sym];
    rowsBySym[e.sym] = idx ? ptModelRows(idx, etYmd(now).slice(0, 4)) : [];
  }
  const horizon = autoHorizonOf(rowsBySym);
  /* v5.0 §14.8 ACTIVATION: the score index is the quality source. Each entry is stamped
     methodology_current HERE — one comparison, against the engine version the caller
     passes — so evalBuyRow and whyNot never re-derive it. An absent index (older deploy,
     KV fault) degrades every name to "no server card", the fail-closed read. */
  const sIdx = (scoreIndex && typeof scoreIndex === "object") ? scoreIndex : {};
  const cardOf = (sym) => {
    const e = sIdx[sym];
    if (!e || typeof e !== "object") return null;
    return { ...e, methodology_current: !!(e.methodology_version && methodologyVersion && e.methodology_version === methodologyVersion) };
  };
  const rows = entries.map((e) => evalBuyRow({ entry: e, idx: idxEntries[e.sym],
    quote: quotes && quotes[e.sym], board, horizon, now, card: cardOf(e.sym) }))
    .sort((a, b) => ((b.ann ?? b.up ?? -1e9) - (a.ann ?? a.up ?? -1e9)));
  const brokenSyms = new Set(Object.keys(sIdx).filter((s2) => sIdx[s2] && sIdx[s2].broken_thesis === true));

  const weightOf = (sym) => {
    const p = positions[sym];
    return p && isFinite(Number(p.pct)) ? Number(p.pct) : null;
  };
  let eligible = null; const whyNotTop = [];
  if (!gate) {
    for (const r of rows) {
      const wn = whyNot(r, weightOf(r.sym));
      if (wn === null) { eligible = r; break; }
      if (whyNotTop.length < 8) whyNotTop.push({ sym: r.sym, reason: wn });
    }
  }

  /* ALLOCATABLE context: everything the recommendation depends on beyond underwriting.
     Failures NAME the blocker and degrade the state — WAIT, never a wrong answer, never an
     inferred zero (the review's own rule, which this repo already enforced everywhere else). */
  const context_blockers = [];
  const posAge = ageDaysEt(posDoc && posDoc.asOf, now);
  if (!posDoc || !Object.keys(positions).length) context_blockers.push("no measured positions — sync has never run");
  else {
    if (!posDoc.snap) context_blockers.push("positions doc predates snapshot versioning — re-sync to stamp one");
    if (posAge === null) context_blockers.push("positions snapshot undated");
    else if (posAge > POS_STALE_D) context_blockers.push(`positions snapshot ${posAge}d old (stale past ${POS_STALE_D}d) — re-sync`);
  }
  const acct = posDoc && posDoc.account;
  if (!acct) context_blockers.push("account unmeasured — cap denominators are tracked-book FLOORS, not equity");
  else {
    const aAge = ageDaysEt(acct.at, now);
    if (aAge === null || aAge > POS_STALE_D) context_blockers.push(`account record ${aAge === null ? "undated" : aAge + "d old"} — re-sync`);
  }
  if (eligible) {
    const w = weightOf(eligible.sym);
    if (w === null && positions[eligible.sym]) context_blockers.push(`${eligible.sym} held but weight unmeasured`);
    /* v5.2 CAP-ASTERISK: the veto RANKFAIR put here is gone; the asterisk it leaves behind
       rides the pick's cautions so an over-cap add is chosen with eyes open, never silently. */
    if (w !== null && w >= CAP_PCT)
      eligible.cautions = [...(eligible.cautions || []),
        `already ${w}% of acct equity — over the ${CAP_PCT}% REFERENCE cap (asterisk, not a veto — owner ruling 2026-08-25)`];
  }

  // FEAT-TT-CIRCUIT (v4.1): an ARMED circuit is a caution the server previously could not
  // see (the client downgraded stance; the ladder checked only "tripped" — a client/server
  // permission divergence). Not a veto: one more leg down trips it, so it rides the eligible
  // row's cautions where the sizing decision is read.
  if (eligible && cs.st === "armed")
    eligible.cautions = [...(eligible.cautions || []), "leverage circuit ARMED — one more leg down trips it; size accordingly"];

  const state = gate ? "WAIT" : !eligible ? "NONE" : context_blockers.length ? "BUY_ELIGIBLE" : "ALLOCATABLE";
  const rowsAnn = {}; rows.forEach((r) => { rowsAnn[r.sym] = r.ann; });
  /* v3.65 rule, applied to the receipt: a silent truncation reads as full coverage, so the
     names the shared horizon excluded are NAMED, never just counted. */
  const noRungSyms = new Set(rows.filter((r) => r.no_rung_at_horizon).map((r) => r.sym));
  /* v5.2 CAP-ASTERISK: the funding merit axes, computed HERE so fundingRanking stays pure.
     Tape: the dd-index price_action through the REAL computeTechRead — one table, so the
     receipt's tape axis can never disagree with the name's own band read. (Owner ruling
     2026-08-25 revises the v3.83 married-never-merged scope for THIS surface only: the
     verdict is a lexicographic sort axis here, never a blended score — the buy sort,
     gateFail and whyNot ladders keep the ban.) Score: the same cardOf the quality rung
     reads — raw when SCORED, provisional otherwise; no card ranks last in its bucket. */
  const techBySym = {}, scoreBySym = {};
  for (const e of entries) {
    const idx = idxEntries[e.sym];
    const pa = idx && idx.price_action;
    if (pa) {
      const q2 = quotes && quotes[e.sym];
      const px = q2 && isFinite(Number(q2.px)) ? Number(q2.px)
        : (idx.ref_px && isFinite(Number(idx.ref_px.px)) ? Number(idx.ref_px.px) : null);
      const t = computeTechRead(pa, px, { age: ageDaysEt(pa.as_of, now) });
      if (t && t.label) techBySym[e.sym] = t.label;
    }
    const c = cardOf(e.sym);
    if (c) {
      const s2 = c.raw_score ?? c.provisional_score;
      if (s2 !== null && s2 !== undefined) scoreBySym[e.sym] = s2;
    }
  }
  const funding = fundingRanking({ book, board, positions, rowsAnn, now, noRungSyms, brokenSyms, techBySym, scoreBySym });

  /* v5.6 THE DAILY CONTRACT — the product gate is ONE projection of the ladder result
     computed above, and the public daily call rides the SAME readout body the gate read.
     The call binds only when it is genuinely TODAY's (effective_date == the receipt's own
     business date) — anything else is null-honest, never yesterday's headline wearing
     today's receipt. */
  const macro_gate = macroGateFrom(gate, readout);
  const call = readout && readout.call && readout.call.schema === "md-call-v1"
    && readout.call.effective_date === etYmd(now)
    ? { headline: readout.call.headline || null, direction: readout.call.direction || null,
        frozen: readout.call_frozen === true }
    : null;

  /* v5.6 — belief-vs-street spread for the decision set (the eligible pick + the top
     why_not rows): belief = the row's OWN ladder target (never recomputed — the pickRow
     one-computation rule), street per streetLegOf's labeled priority, formula per spreadOf.
     A name with no street leg carries street:null — the client says "street unreviewed",
     never a number. */
  const spread = {};
  const spreadSyms = [...new Set([eligible && eligible.sym, ...whyNotTop.map((w) => w.sym)].filter(Boolean))].slice(0, 9);
  for (const s5 of spreadSyms) {
    const r5 = rows.find((x) => x.sym === s5);
    if (!r5 || typeof r5.tgt !== "number") continue;
    const leg = streetLegOf(idxEntries[s5], streetBySym[s5]);
    const sp = leg ? spreadOf(r5.tgt, leg.pt, r5.px) : null;
    spread[s5] = { belief: { pt: r5.tgt, y: r5.y }, street: leg,
      pct: sp ? sp.pct : null, sign: sp ? sp.sign : null };
  }

  /* v5.6 — the flip line: the price at which #1's %/yr equals #2's. yrs is recovered from
     the leader row's OWN (up, ann) pair — ann = ((1+up/100)^(1/yrs)−1)·100, so
     yrs = ln(1+up/100)/ln(1+ann/100) — which inverts the same annualise the ranking used
     rather than copying the year-end clock (the §P.4 one-clock rule). Computed only when
     both top RANKED rows carry finite rates; otherwise null, never a guess. */
  let overtake = null;
  const rankedTop = rows.filter((r6) => typeof r6.ann === "number" && isFinite(r6.ann)
    && typeof r6.tgt === "number" && typeof r6.up === "number" && r6.up > -100);
  if (rankedTop.length >= 2) {
    const a6 = rankedTop[0], b6 = rankedTop[1];
    const la = Math.log(1 + a6.ann / 100), lb = Math.log(1 + b6.ann / 100);
    if (isFinite(la) && la !== 0 && isFinite(lb)) {
      const yrs = Math.log(1 + a6.up / 100) / la;
      const pxStar = yrs > 0 ? a6.tgt / Math.pow(1 + b6.ann / 100, yrs) : null;
      if (pxStar !== null && isFinite(pxStar) && pxStar > 0)
        overtake = { leader: a6.sym, runner_up: b6.sym, at_px: Math.round(pxStar * 100) / 100,
          note: `${b6.sym} overtakes ${a6.sym} if ${a6.sym} reaches $${Math.round(pxStar * 100) / 100} first` };
    }
  }

  return {
    rule_version: ALLOC_RULE_VERSION,
    state,                       // WAIT (gate) | NONE (no eligible) | BUY_ELIGIBLE | ALLOCATABLE
    /* v4.1 Step 2: ALLOCATABLE is an allocation-CONTEXT state — everything the recommendation
       depends on is present and fresh. It is NOT a cash-availability or sizing approval (the
       8/18 audit read it beside a measured cash of −$286k), and the receipt now says so in a
       machine field so no renderer can quietly re-imply it. */
    meaning: state === "ALLOCATABLE" ? "context_complete_not_cash_or_sizing_approval" : null,
    gate: gate || null,          // null = every gate read clean
    macro_gate,                  // v5.6 product gate: {gate: SEND_IT|HODL|TOUCH_GRASS, rung, reason}
    call,                        // v5.6 today's md-call {headline, direction, frozen} or null
    spread,                      // v5.6 belief-vs-street for the decision set, keyed by sym
    overtake,                    // v5.6 flip line: {leader, runner_up, at_px, note} or null
    // FEAT-TT-CIRCUIT (v4.1): the resolved permission facts this evaluation gated on.
    permission: {
      circuit: cs.st.toUpperCase(),               // CLEAR | ARMED | TRIPPED | UNRESOLVED
      circuit_as_of: (board.circuit && board.circuit.as_of) || null,
      circuit_age_d: cs.age ?? null,
      circuit_note: cs.reason || null,
    },
    horizon,                     // computed, never asserted (D1)
    /* Modelled names carrying no rung at `horizon`. They are excluded from the ranking
       rather than substituted onto another year (v4.1.3) — named here so the exclusion is
       visible at receipt altitude, not merely absent from the rows. */
    unranked_at_horizon: [...noRungSyms],
    eligible: eligible ? { sym: eligible.sym, y: eligible.y, tgt: eligible.tgt, up: eligible.up,
      ann: eligible.ann, live_px: eligible.live,
      // v4.1 Step 4: the price the target was measured against, its date, and the basis —
      // previously the price itself never left this function.
      px: eligible.px, px_at: eligible.px_at, price_basis: priceBasisOf(eligible),
      cautions: eligible.cautions } : null,
    why_not: whyNotTop,          // the top rows that did NOT take the line, reason each
    context_blockers,            // what separates BUY_ELIGIBLE from ALLOCATABLE, named
    funding,                     // {label: FIX-C verbatim, rows[{sym,tier,reason,...}], optOnly}
    inputs: {                    // what this was computed FROM — the receipt binds to these
      book_version: (book && book.version) || null,
      positions_snap: (posDoc && posDoc.snap) || null,
      positions_asOf: (posDoc && posDoc.asOf) || null,
      dd_index_asOf: (ddIndex && ddIndex.asOf) || null,
      readout_as_of: (readout && readout.as_of) || null,
    },
  };
}
