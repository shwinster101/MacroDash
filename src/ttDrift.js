// src/ttDrift.js — MacroDash v4.3 FEAT-TT-DRIFT
// PURE, React-free, Node-importable — the src/regime.js / ttScore.js / ptModel.js convention.
//
// THE ASSERTED LAYER FALLING BEHIND THE MEASURED LAYER. Three instances of one pattern, all
// measured on the live book 2026-08-22:
//   · META's "Consensus financials" hinge asked for a screenshot for NINE DAYS after the
//     screenshot arrived and the pt_model was built from it. Nothing checked.
//   · 7 of 17 composites carried hinge evidence NEWER than the score itself — and the
//     composite is a HARD eligibility gate (admin.html: the eligible line needs composite>=B),
//     so a stale composite gates the next dollar on judgment that predates its own evidence.
//   · Consensus years carried by 1-2 analysts priced real rungs. ALAB FY2029 at TWO analysts
//     read as a crest at the mean and GREW at the high — direction flipping on a two-person
//     sample — and retiring it moved the multiple 40x -> 44x.
// None of these needs a network call: every input is already in the payload. That is why this
// is a lint and not a sourcing agent.
//
// ⚠ ONE DESIGN RULE, learned by getting it wrong TWICE on the same name. The first cut scanned
// EVERY date in the payload and reported CRM 170 days stale — it had matched a FUTURE key_date.
// Restricting to a capture whitelist did NOT fix it: CRM's capture free-text names its fiscal
// period end (2027-01-31), which scanned as a capture. Both guards are therefore required —
// captureDates() reads whitelisted fields ONLY, and within them accepts only dates <= today,
// because a capture records when data ARRIVED and cannot be in the future.
//
// All findings are sev:"warn". Never an error: these are advisory reads on legacy payloads the
// owner has not revisited, and a hard gate would block saves on data that is merely old. The
// MISKEY precedent (v3.39) earns a hard gate by being a DEFECT; being out of date is not one.

const THIN_MIN = 3;          // owner rule 2026-08-22: a forward projection is carried by >=3 analysts
const COMPOSITE_MAX_D = 14;  // a composite older than this is flagged on age alone

function etYmd(_now) {
  return new Date(_now == null ? Date.now() : _now)
    .toLocaleDateString("en-CA", { timeZone: "America/New_York" }).slice(0, 10);
}
function ymd(v) { const s = String(v == null ? "" : v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; }
function dayGap(a, b) { return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000); }
function asArr(v) { return Array.isArray(v) ? v : (v && typeof v === "object" ? Object.values(v) : []); }

/* The CAPTURE whitelist — the only places a "when was this payload last fed" date may come
   from. Free-text fields are scanned for ISO dates because that is how this book records
   provenance ("REAL CONSENSUS MEANS, owner capture 2026-08-13"), but ONLY these fields. */
function captureDates(dd, _now) {
  const out = [];
  /* A CAPTURE DATE CAN NEVER BE IN THE FUTURE. The whitelist alone was not enough: CRM's
     capture free-text names its fiscal period end ("FY2027 ... 2027-01-31"), which scanned as
     a capture and reported the hinge 170 days stale — the same false positive twice, first
     from scanning key_dates and then from scanning inside a whitelisted field. Forward dates
     are fiscal periods, targets and events; only a past date can record when data arrived. */
  const today = etYmd(_now);
  const push = (v) => { const d = ymd(v); if (d && d <= today) out.push(d); };
  const scan = (s) => { String(s || "").replace(/\d{4}-\d{2}-\d{2}/g, (m) => { push(m); return m; }); };
  if (!dd || typeof dd !== "object") return out;
  push(dd.as_of); push(dd.updated);
  const c = dd.consensus || {}, m = dd.pt_model || {};
  push(c.as_of); scan(c.source); scan(c.analyst_counts_source);
  push(m.multiple_edited); scan(m.multiple_ruling);
  const st = c.street_target || {}; push(st.as_of);
  return out;
}
function newestCapture(dd, _now) {
  const d = captureDates(dd, _now).sort();
  return d.length ? d[d.length - 1] : null;
}

/* THIN COVERAGE, scoped to the years the LADDER ACTUALLY REACHES. MU carries 1-analyst years
   out to 2035 and none of them matter at a 2027 horizon; ALAB's 2-analyst FY2029 mattered
   because a rung priced it. Scoping is what makes this a signal instead of noise — an
   unscoped version fires 23 times on the live book, a scoped one fires only where a rung
   depends on it.

   ⚠ `rowYears` MUST be the years of the rows ptModelRows() ACTUALLY EMITS — ptModelRows(dd)
   .map(r=>r.y) — and NOT ptRowYears(dd). They are different sets, and the difference is
   exactly where this fired wrong. ptRowYears is the CANDIDATE list: it unions the revenue and
   eps year keys, so a year with revenue but no eps still proposes a row. Under the earnings
   lens that row is never emitted. Measured on the live book: excluding NVDA's and HOOD's
   2-analyst FY2030 EPS correctly removed their deepest rung, but their FY2030 REVENUE stayed
   (5 and 3 analysts, legitimately), so ptRowYears kept proposing y=2029 and this lint reported
   both names as still thin AFTER they had been fixed. A lint that reports resolved work as
   outstanding is the asserted-vs-measured defect this whole module exists to catch, committed
   by the module itself — the fourth false positive in this feature (CRM twice on capture
   dates, then this). The rule that survives all four: read the OUTCOME, never the proposal. */
function thinCoverage(dd, rowYears) {
  const c = (dd && dd.consensus) || {};
  const ac = c.analyst_counts;
  if (!ac || typeof ac !== "object" || Array.isArray(ac)) return [];
  const reach = new Set(asArr(rowYears).map((y) => String(+y + 1)));
  const hits = [];
  for (const [series, v] of Object.entries(ac)) {
    if (!v || typeof v !== "object") continue;          // flat {yr:n} handled below
    for (const [yr, n] of Object.entries(v))
      if (typeof n === "number" && n < THIN_MIN && reach.has(String(yr)))
        hits.push({ series, year: String(yr), n });
  }
  for (const [yr, n] of Object.entries(ac))             // flat per-year shape (the v3.85 floor stamp)
    if (typeof n === "number" && n < THIN_MIN && reach.has(String(yr)))
      hits.push({ series: "both", year: String(yr), n });
  return hits.sort((a, b) => a.year < b.year ? -1 : 1);
}

/* A hinge written BEFORE the payload's newest capture may already be answered by that capture
   — META's exact defect. UNKNOWN only: a graded hinge being older than a capture is ordinary
   (the capture may not bear on it), but an UNGRADED one sitting behind fresh evidence is the
   thing nobody checks. */
function staleHinges(dd, _now) {
  const cap = newestCapture(dd, _now);
  if (!cap) return [];
  return asArr(dd && dd.hinges).filter((h) => h && typeof h === "object" &&
      String(h.state || "").toLowerCase() === "unknown")
    .map((h) => ({ label: h.label || h.key || h.id || "unnamed", asOf: ymd(h.asOf || h.as_of), cap }))
    .filter((h) => h.asOf === null || h.asOf < cap)
    .map((h) => ({ ...h, gap: h.asOf ? dayGap(h.asOf, cap) : null }));
}

/* The legacy composite gated the eligible line (>=B) until §14.8 activation (v5.0); it is
   HISTORY now — the server card governs — but a stale historical judgment still misleads a
   reader, so the lint survives with its claim corrected. Two independent flags: evidence
   moved after the score, and plain age. Both warn; neither re-grades. */
function compositeDrift(dd, _now) {
  const comp = (dd && dd.composite) || {};
  if (comp.score == null) return null;
  const dates = [];
  String(comp.basis || "").replace(/\d{4}-\d{2}-\d{2}/g, (m) => { dates.push(m); return m; });
  const scored = dates.sort().length ? dates[dates.length - 1] : null;
  if (!scored) return { scored: null, reason: "the composite basis carries no date — it cannot be aged" };
  const hd = asArr(dd.hinges).map((h) => ymd(h && (h.asOf || h.as_of))).filter(Boolean).sort();
  const newestHinge = hd.length ? hd[hd.length - 1] : null;
  const age = dayGap(scored, etYmd(_now));
  const moved = newestHinge && newestHinge > scored;
  if (!moved && age <= COMPOSITE_MAX_D) return null;
  return { scored, newestHinge, age, moved: !!moved };
}

/* ═══ v5.0 (W2/W3) — three more instances of the same pattern, each caught BY HAND first ═══
   TARGET_STALE: the score card freezes P1's target at computed_at while the board ranks on
   the live rung; on 2026-08-23 all 30 cards agreed with a fresh ptModelRows run ONLY because
   everything had been scored that day at live quotes — freshness coincidence, not a guard.
   The stated rule this lint enforces: the receipt governs eligibility AT ITS STAMPED BASIS,
   the live ladder governs ranking, and a gap past TARGET_DRIFT_PCT is NAMED with both
   numbers. RUNWAY_SPLIT: the same runway fact lives in P3 and PH_G2 per card, and an
   intra-session split (ACHR, 21.9 vs 24 — two derivations of one fact) was caught only by a
   human re-reading the card. Mode-aware: a PROFITABLE-mode P3 has no runway field (the SYM
   shape) and SELF_FUNDING matches only itself. LABEL_DRIFT: GEV's pt_model.basis read
   "Floor only … No premium multiple asserted" for a DAY beside the premium the v4.2 seed
   had added — the label-outlives-its-data defect INSIDE stored data, second instance that
   week (CRWV's net-debt note was the first). All three sev:warn like the rest of the family. */
const TARGET_DRIFT_PCT = 5;
function targetDrift(card, rows) {
  const p1 = card && card.pillars && card.pillars.owner_valuation;
  if (!p1 || typeof p1.target !== "number" || !p1.target_year) return null;
  const row = asArr(rows).find((r) => r && String(r.y) === String(p1.target_year));
  const fresh = row ? (p1.basis_used === "FLOOR"
    ? (typeof row.fl === "number" ? row.fl : null)
    : (typeof row.prem === "number" ? row.prem : (typeof row.fl === "number" ? row.fl : null))) : null;
  if (fresh === null) return { gone: true, y: String(p1.target_year), card_target: p1.target };
  const pct = Math.abs(fresh / p1.target - 1) * 100;
  if (pct <= TARGET_DRIFT_PCT) return null;
  return { gone: false, card_target: p1.target, fresh, y: String(p1.target_year),
    pct: Math.round(pct * 10) / 10, basis: p1.basis_used || null };
}
function runwaySplit(ui) {
  const p3 = ui && ui.economic_quality && ui.economic_quality.runway_months;
  const g2 = ui && ui.route_gates && ui.route_gates.PH_G2_RUNWAY;
  if (!p3 || !g2 || !("runway_months" in g2)) return null;   // mode-aware: PROFITABLE P3 has no runway
  const a = p3.value, b = g2.runway_months;
  const num = (v) => typeof v === "number" && isFinite(v);
  if (num(a) && num(b) && a !== b) return { a, b, kind: "numeric" };
  const sf = (v) => v === "SELF_FUNDING";
  if ((sf(a) && num(b)) || (num(a) && sf(b)))
    return { a, b, kind: "sentinel" };                       // a generator with a numeric burn is a contradiction
  return null;
}
function labelDrift(dd) {
  const m = (dd && dd.pt_model) || {};
  const premiumPresent = m.pe_premium_multiple != null || m.ev_s_multiple != null;
  if (!premiumPresent) return null;
  const text = String(m.basis || "") + " " + String(m.note || "");
  if (/no premium multiple|no premium asserted/i.test(text))
    return { phrase: "no premium multiple", fob: !!m.floor_only_before };
  // "floor only" beside a premium is legitimate exactly when floor_only_before scopes it.
  if (/floor[- ]only/i.test(text) && !m.floor_only_before)
    return { phrase: "floor only", fob: false };
  return null;
}

function lintDrift(dd, rowYears, _now, ctx) {
  const out = [];
  for (const t of thinCoverage(dd, rowYears))
    out.push({ sev: "warn", code: "THIN_COVERAGE",
      msg: `FY${t.year} ${t.series} is carried by ${t.n} analyst${t.n === 1 ? "" : "s"} (<${THIN_MIN}) and a rung prices it — ` +
        `a two-person sample can flip direction between its mean and its high. Exclude the year from the rung-forming series, or accept it explicitly.` });
  for (const h of staleHinges(dd, _now))
    out.push({ sev: "warn", code: "HINGE_STALE",
      msg: `hinge "${h.label}" is UNKNOWN and dated ${h.asOf || "never"}, but this payload was captured ${h.cap}` +
        (h.gap ? ` — ${h.gap} day${h.gap === 1 ? "" : "s"} later` : "") +
        `. It may already be answered by data now in the payload (the META case). Re-read before sourcing.` });
  if (ctx && ctx.card) {
    const td = targetDrift(ctx.card, ctx.rows);
    if (td) out.push({ sev: "warn", code: "TARGET_STALE",
      msg: td.gone
        ? `the score card's target ($${td.card_target} at YE${td.y}) no longer has a rung — the model moved from under the receipt; re-score`
        : `the score card froze $${td.card_target} (${td.basis || "?"}, YE${td.y}) but the live ladder now computes $${td.fresh} — ${td.pct}% apart (>${TARGET_DRIFT_PCT}%). The receipt governs eligibility at its stamped basis; the ladder governs ranking; re-score to close the gap.` });
  }
  if (ctx && ctx.ui) {
    const rw = runwaySplit(ctx.ui);
    if (rw) out.push({ sev: "warn", code: "RUNWAY_SPLIT",
      msg: rw.kind === "numeric"
        ? `runway is stored twice and the copies disagree — P3 says ${rw.a} months, PH_G2 says ${rw.b}. One fact, two derivations (the ACHR 21.9-vs-24 case); reconcile to the better-sourced basis.`
        : `runway contradiction — one home says SELF_FUNDING while the other carries a numeric burn (${rw.kind === "sentinel" ? `${rw.a} vs ${rw.b}` : ""}). A cash generator and a burn-down cannot both be true.` });
  }
  const ld = labelDrift(dd);
  if (ld) out.push({ sev: "warn", code: "LABEL_DRIFT",
    msg: `pt_model prose claims "${ld.phrase}" while a premium multiple is stored — the label outlived its data (the GEV case). Rewrite basis/note to describe the model that exists${ld.phrase === "floor only" ? ", or scope it with floor_only_before" : ""}.` });
  const cd = compositeDrift(dd, _now);
  if (cd) out.push({ sev: "warn", code: "COMPOSITE_STALE",
    msg: cd.scored === null ? cd.reason
      : (cd.moved ? `legacy composite scored ${cd.scored} but hinge evidence moved to ${cd.newestHinge} — historical since §14.8, yet a judgment older than its own evidence still misleads`
                  : `legacy composite scored ${cd.scored}, ${cd.age}d old (>${COMPOSITE_MAX_D}d) — historical since §14.8; refresh or retire it`) });
  return out;
}

export { lintDrift, thinCoverage, staleHinges, compositeDrift, captureDates, newestCapture,
  targetDrift, runwaySplit, labelDrift,
  THIN_MIN, COMPOSITE_MAX_D, TARGET_DRIFT_PCT };
