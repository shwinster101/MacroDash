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

/* The composite is a HARD eligibility gate (>=B), so it is the one asserted number whose
   staleness has a mechanical consequence. Two independent flags: evidence moved after the
   score, and plain age. Both warn; neither re-grades — detecting drift is automatable,
   scoring judgment is not. */
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

function lintDrift(dd, rowYears, _now) {
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
  const cd = compositeDrift(dd, _now);
  if (cd) out.push({ sev: "warn", code: "COMPOSITE_STALE",
    msg: cd.scored === null ? cd.reason
      : (cd.moved ? `composite scored ${cd.scored} but hinge evidence moved to ${cd.newestHinge} — it gates the eligible line (>=B) on judgment older than its own evidence`
                  : `composite scored ${cd.scored}, ${cd.age}d old (>${COMPOSITE_MAX_D}d) — it gates the eligible line (>=B)`) });
  return out;
}

export { lintDrift, thinCoverage, staleHinges, compositeDrift, captureDates, newestCapture,
  THIN_MIN, COMPOSITE_MAX_D };
