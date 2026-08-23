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
import { etYmd } from "../../src/sources.js";
import { POS_STALE_D } from "../api/positions.js";

// v2.0.0 (v5.0 §14.8 activation): the quality rung moved from legacy free-text composites
// to server score cards, and broken_thesis entered the forced funding tier — receipt
// semantics changed on BOTH sides, so cached v1.x receipts must not be reinterpreted
// (the v4.1.4 precedent). v1.1.0 was the horizon-never-substituted change.
export const ALLOC_RULE_VERSION = "tt-alloc-v2.0.0";
export const CAP_PCT = 18;      // mirror of admin.html (hard single-position cap)
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
  const quality = card && (card.raw_score ?? card.provisional_score) !== null && (card.raw_score ?? card.provisional_score) !== undefined
    ? { score: card.raw_score ?? card.provisional_score,
        tier: card.raw_score !== null && card.raw_score !== undefined ? (card.capped_tier || null) : (card.provisional_tier || null),
        status: card.status || null,
        methodology_current: card.methodology_current === true }
    : (card ? { score: null, tier: null, status: card.status || null, methodology_current: card.methodology_current === true } : null);
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
  if (weightPct !== null && weightPct >= CAP_PCT) return `already ${weightPct}% — at the ${CAP_PCT}% cap, no room`;
  if (row.blockers.length) return `evidence: ${row.blockers.join(", ")}`;
  /* v5.0 §14.8 ACTIVATION (SCORED-only, owner ruling 2026-08-23): the quality rung reads
     the server card. Each non-eligible state gets ITS OWN reason — a PROVISIONAL name and
     an unscored one are different facts, and the veto text is what the owner reads. */
  if (!row.quality) return "no server card — unscored";
  const q = row.quality;
  if (q.status === "PROVISIONAL")
    return `falsifiers pending — score capped at ${q.tier || "B"} until they're committed (PROVISIONAL is never eligible)`;
  if (q.status !== "SCORED")
    return `server card ${q.status || "incomplete"} — blockers on the card`;
  if (!q.methodology_current)
    return "card predates the current methodology — re-score to verify (§4.3)";
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
export function fundingRanking({ book, board, positions, rowsAnn, now, noRungSyms, brokenSyms }) {
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
    let tier, reason;
    if (forcedSyms.has(sym)) { tier = 1; reason = forcedSyms.get(sym); }
    else if (pct !== null && pct >= CAP_PCT) { tier = 2; reason = `${pct}% of acct equity — at/over the ${CAP_PCT}% cap (broker-measured)`; }
    else if (clusterOver.has(sym)) { tier = 3; reason = clusterOver.get(sym); }
    else if (orderMarked.has(sym)) { tier = 4; reason = orderMarked.get(sym).reason; }
    else { tier = 5; reason = ann === null
      ? (noRung.has(sym)
          ? "no rung at the shared horizon — no expected-return basis at this year; listed last"
          : "unmodelled — no expected-return basis; listed last")
      : `lowest expected return funds first — ${ann}%/yr at the shared horizon`; }
    rows.push({ sym, tier, reason, pct, mv: isFinite(Number(p.mv)) ? Number(p.mv) : null, ann,
      dnt: dnt.has(sym), pos_age_d: ageDaysEt(p.at, now),
      lots: lots.length ? { lt_sh: lt, st_sh: st } : null });
  }
  rows.sort((a, b2) => a.tier - b2.tier
    || (a.tier === 4 ? (orderMarked.get(a.sym).i - orderMarked.get(b2.sym).i) : 0)
    || ((a.ann ?? 1e9) - (b2.ann ?? 1e9)) || ((b2.mv ?? 0) - (a.mv ?? 0)));
  return { label: FUNDING_LABEL, rows, optOnly };
}

// ── the whole evaluation ─────────────────────────────────────────────────────
export function evaluateAllocation({ book, ddIndex, posDoc, quotes, readout, now, scoreIndex, methodologyVersion }) {
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
  const funding = fundingRanking({ book, board, positions, rowsAnn, now, noRungSyms, brokenSyms });

  return {
    rule_version: ALLOC_RULE_VERSION,
    state,                       // WAIT (gate) | NONE (no eligible) | BUY_ELIGIBLE | ALLOCATABLE
    /* v4.1 Step 2: ALLOCATABLE is an allocation-CONTEXT state — everything the recommendation
       depends on is present and fresh. It is NOT a cash-availability or sizing approval (the
       8/18 audit read it beside a measured cash of −$286k), and the receipt now says so in a
       machine field so no renderer can quietly re-imply it. */
    meaning: state === "ALLOCATABLE" ? "context_complete_not_cash_or_sizing_approval" : null,
    gate: gate || null,          // null = every gate read clean
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
