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
// ⚠ §14.8 BAR (owner call 2026-08-17): the FORCED funding tier reads ONLY owner-marked
// signals — a board decision carrying forced_exit:true, or cut-list membership. The shadow
// score engine's BROKEN_THESIS must NOT feed it until activation; this module deliberately
// receives no score records at all, so the bar holds by construction (smoke pins that no
// tt:score reference exists in this file or the endpoint).
//
// ⚠ MIRRORS (admin.html is buildless and cannot import — the MAX_BODY convention, each pair
// smoke mirror-pinned): CAP_PCT (admin L1340) · PX_STALE_D=4 (admin L1347) · REG_RANK
// (admin L3326) · run-state thresholds 30/90 (admin runState) · the gate-ladder rung order
// (admin gateFail region). POS_STALE_D is imported from the positions store, which owns it.

import { ptModelRows, ptRowYears, lintPtModel, pickRow, annualise } from "../../src/ptModel.js";
import { etYmd } from "../../src/sources.js";
import { POS_STALE_D } from "../api/positions.js";

export const ALLOC_RULE_VERSION = "tt-alloc-v1.0.0";
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

// ── the gate ladder ──────────────────────────────────────────────────────────
// Rung-for-rung with admin.html's circuit veto + gateFail ladder. Every unreadable input is
// a NAMED veto — fail closed, never default to clear. Returns null when every gate reads.
export function allocGateLadder({ board, readout }) {
  const b = board || {};
  if (String(b.circuit && b.circuit.state).toLowerCase() === "tripped")
    return { rung: "circuit", reason: "leverage circuit tripped — deleverage-only; no name is eligible while the circuit holds" };
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
export function evalBuyRow({ entry, idx, quote, board, horizon, now }) {
  const sym = entry.sym;
  const blockers = [], cautions = [];
  if (!idx) {
    return { sym, blockers: ["dd index unavailable — the board working set carries no entry for this name"], cautions, px: null, tgt: null, up: null, ann: null, quality: null, rolled: null };
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

  const pk = rows.length ? (pickRow(rows, horizon || "", now) || pickRow(rows, "", now)) : null;
  const r = pk && pk.row;
  const tgt = r ? (typeof r.prem === "number" ? r.prem : (typeof r.fl === "number" ? r.fl : null)) : null;
  const up = px !== null && tgt !== null ? Math.round((tgt / px - 1) * 1000) / 10 : null;
  const ann = up !== null && r ? annualise(up, r.y, now) : null;
  const quality = idx.composite && (idx.composite.score ?? null) !== null
    ? { score: idx.composite.score, tier: idx.composite.raw_tier || null } : null;
  return { sym, blockers, cautions, px, live: live !== null, tgt, y: r ? r.y : null,
    up, ann, quality, rolled: pk ? pk.rolled : null };
}

// The per-row veto ladder (admin why(r)), on the server row shape. null = eligible.
export function whyNot(row, weightPct) {
  if (!(row.up > 0)) return "no gap";
  if (weightPct !== null && weightPct >= CAP_PCT) return `already ${weightPct}% — at the ${CAP_PCT}% cap, no room`;
  if (row.blockers.length) return `evidence: ${row.blockers.join(", ")}`;
  if (!row.quality) return "unscored — no TT run";
  const s = row.quality.score;
  if ((row.quality.tier && /^C\b/.test(String(row.quality.tier))) || (s !== null && s < 5.5))
    return `TT ${s !== null ? Number(s).toFixed(1) : "C"} — quality fails`;
  return null;
}

// ── the funding side ─────────────────────────────────────────────────────────
/* Five tiers, owner-locked precedence, governing reason per row. Weight prefers the
   broker-measured pct; the tracked-book floor is NAMED as a floor when it substitutes.
   do_not_trim is FLAGGED, never hidden (the RANKFAIR rule). Options-only sleeves keep the
   v3.44 rules: signed sum, unmeasured reads as such, a net-short sleeve is an obligation. */
export function fundingRanking({ book, board, positions, rowsAnn, now }) {
  const b = board || {}, pos = positions || {};
  const cut = new Set(Array.isArray(book && book.cut) ? book.cut : []);
  const forcedSyms = new Map(); // sym -> reason
  for (const d of (Array.isArray(b.decisions) ? b.decisions : []))
    if (d && d.forced_exit === true && d.sym)
      forcedSyms.set(String(d.sym).toUpperCase(), `owner-marked forced exit${d.q ? `: ${String(d.q).slice(0, 80)}` : ""}`);
  for (const s of Object.keys(pos)) if (cut.has(s)) forcedSyms.set(s, "on the cut list — exited from the book, still held");

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
    else { tier = 5; reason = ann === null ? "unmodelled — no expected-return basis; listed last" : `lowest expected return funds first — ${ann}%/yr at the shared horizon`; }
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
export function evaluateAllocation({ book, ddIndex, posDoc, quotes, readout, now }) {
  const board = (book && book.board) || {};
  const entries = Array.isArray(book && book.book) ? book.book : [];
  const idxEntries = (ddIndex && ddIndex.entries) || {};
  const positions = (posDoc && typeof posDoc.positions === "object" && !Array.isArray(posDoc.positions)) ? posDoc.positions : {};
  const gate = allocGateLadder({ board, readout });

  // rows for every book name (the ranking is always computed — the gate withholds
  // ELIGIBILITY, never the math; the v3.74.1 "ranking always renders" contract).
  const rowsBySym = {};
  for (const e of entries) {
    const idx = idxEntries[e.sym];
    rowsBySym[e.sym] = idx ? ptModelRows(idx, etYmd(now).slice(0, 4)) : [];
  }
  const horizon = autoHorizonOf(rowsBySym);
  const rows = entries.map((e) => evalBuyRow({ entry: e, idx: idxEntries[e.sym],
    quote: quotes && quotes[e.sym], board, horizon, now }))
    .sort((a, b) => ((b.ann ?? b.up ?? -1e9) - (a.ann ?? a.up ?? -1e9)));

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

  const state = gate ? "WAIT" : !eligible ? "NONE" : context_blockers.length ? "BUY_ELIGIBLE" : "ALLOCATABLE";
  const rowsAnn = {}; rows.forEach((r) => { rowsAnn[r.sym] = r.ann; });
  const funding = fundingRanking({ book, board, positions, rowsAnn, now });

  return {
    rule_version: ALLOC_RULE_VERSION,
    state,                       // WAIT (gate) | NONE (no eligible) | BUY_ELIGIBLE | ALLOCATABLE
    gate: gate || null,          // null = every gate read clean
    horizon,                     // computed, never asserted (D1)
    eligible: eligible ? { sym: eligible.sym, y: eligible.y, tgt: eligible.tgt, up: eligible.up,
      ann: eligible.ann, live_px: eligible.live, cautions: eligible.cautions } : null,
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
