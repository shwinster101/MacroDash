/* SIGNAL ROLES (v7.1) — the one home for "what job does this number do?".
   Pure, React-free, Node-importable. Imports only the derivation graph from sources.js.

   WHY THIS MODULE EXISTS. Until now the product answered three different questions about a
   signal at three unrelated sites: VOTING_FIELDS in dashboard.jsx decided whether the macro
   strip drew a vote marker, stripExplainFor()'s band-then-context fallthrough decided which
   explainer a tile got, and prose inside explain.what[1] told the reader whether the vote read
   it. Nothing said what a signal IS. A reader could not tell a context tile from a voter from
   an input to a safety circuit, and neither could a future maintainer deciding what belongs in
   Simple.

   ⚠ WHY IT IS A SEPARATE MODULE, NOT A FIELD ON REGIME_BAND_TABLE. Two reasons, both load-
   bearing. (1) src/regime.js is the import-free ROOT of the dependency tree and the two engines
   are married-never-merged; a table that had to name creditTail/sahm/spread10y3m to describe
   them would couple the public backdrop to signals it deliberately does not read. (2) The v3.88
   sweep in smoke asserts those very keys are ABSENT from src/evidence.js and from the band-table
   slice of regime.js, precisely so a non-voter cannot drift into the voting path. This module is
   where they are allowed to be named.

   THE VOTER SET IS RECONCILED, NOT DERIVED. This file does not import REGIME_BAND_TABLE — that
   would make the table's shape load-bearing for a presentation concern and re-couple what (1)
   separates. Smoke asserts the two lists agree (the SOURCES <-> DERIVED_OF and playwright
   EXECUTABLE_PATHS idiom: pin two homes against each other from the suite rather than fusing
   them). The same reasoning v7.0.3 gave for keeping the F&G band reconciliation in the suite. */

import { SOURCES, DERIVED_OF, DERIVED_EXEMPT } from "./sources.js";

/* ⚠ OWNER RULING 2026-09-19 — THE 7th VOTER SEAT STAYS EMPTY.
   The public backdrop is SIX voters and that is now a deliberate ceiling, not a count that
   happens to be six. Everything else the feed carries is real and is integrated by ROLE below.

   THE COUNT TRAP THIS CLOSES, measured before it could open: REGIME_QUORUM was a bare literal 4
   while verdictFrom() derived its majority from `counted`. At six voters both rules read
   two-thirds; at seven the majority drops to 57% BY DESIGN and the quorum would have dropped to
   57% BY OMISSION — silently loosening the strongest abstention claim the public engine makes.
   That is the DEC-31 / v5.97.0 count trap one engine over. regime.js now derives the quorum, and
   this constant is reconciled against REGIME_BAND_TABLE.length in smoke, so filling a 7th seat
   is a deliberate act that turns a test red rather than a quiet majority-math change.

   The ruling locks the COUNT, not the COMPOSITION. Two measured findings — valuation's
   near-permanent bear vote, and the sentiment/volatility input overlap — are RECORDED rather
   than acted on; CLAUDE.md names the note that carries them, as it does for every deferred
   ruling. The path is deliberately absent from this file. The notes tree is NOTES, no product
   surface may name it, and the sweep enforcing that caught this very comment on its first run —
   then caught the paraphrase of it on the second, because quoting the forbidden literal while
   explaining the rule is the v3.60.1 self-matching trap. The sweep was NOT taught to strip
   comments either time: a pin does not get loosened to fit the change that broke it. */
export const VOTER_CEILING = 6;

/* THE SIX ROLES.
   voter      — casts a vote in the public six-factor backdrop (REGIME_BAND_TABLE).
   override   — an input to a SAFETY CIRCUIT that can move the call regardless of the vote.
   technical  — a price or rate-path reading Engine 0 gates orders on and the backdrop does not.
   context    — a real macro reading neither engine gates on; it informs, it never decides.
   return     — a price change a reader owns the outcome of. Owner ruling 2026-09-19:
                "returns are fundamentals", so these stay in Simple.
   fundamental— reserved for the stock widget's own metrics, which do not ride SOURCES.       */
export const ROLES = Object.freeze(["voter", "override", "technical", "context", "return", "fundamental"]);

/* `simple` — MAY THIS FIELD'S READING BE RENDERED IN SIMPLE MODE?
   Read it narrowly: it governs a READING, not a verdict built from one. The PANIC and Macro Flip
   banners render in BOTH modes on purpose (v3.25 — a collapse may hide an explanation and may
   never hide a red fact), and they are call state from md-call-v1, not field readings, so they
   are not governed here. A field can therefore be simple:false while a circuit it feeds is
   visible in Simple; that is the intended split, not an inconsistency.

   `feedsOverride` — names the safety circuit this reading is an input to, or null. An override
   is the one case where a non-voting number can move the published call, so it is stated rather
   than left for a reader to infer from a banner.

   `engine0Check` — the /readout.json check name this reading backs, for the four Engine 0 checks
   the backdrop does NOT vote on. Annotation only: this module never evaluates a check.

   `why` — for a non-voter, the stated reason it does not vote. This is genuinely new information
   with no other home, which is why the registry carries it. It deliberately carries NO display
   label: band.plain, the evidence alias and simpleFace's FACE_NOUN are already three noun tables
   for the same six signals, and a fourth would be the drift this module exists to stop. */
const V = (why) => ({ role: "voter", simple: true, why });
const C = (why, extra = {}) => ({ role: "context", simple: false, why, ...extra });
const T = (why, engine0Check = null) => ({ role: "technical", simple: false, why, engine0Check });
const R = (why) => ({ role: "return", simple: true, why });

export const SIGNAL_ROLES = Object.freeze({
  // ── THE SIX VOTERS ────────────────────────────────────────────────────────────────────────
  tenYear:     V("Votes on its own monthly change — the discount rate under every future dollar."),
  vix:         { ...V("Votes on the level — the 30-day price of protection."), feedsOverride: "PANIC · MACRO FLIP" },
  fearGreed:   { ...V("Votes on the level — crowd positioning already in the tape."), feedsOverride: "PANIC" },
  cpiHeadline: V("Votes on the SHAPE of its trend — whether the Fed can ease or must keep squeezing."),
  shillerPe:   V("Votes on the level against its own history — how much good news is already priced."),
  nfci:        V("Votes on the level against its definitional mean — whether credit is actually flowing."),

  // ── RETURNS — fundamentals by owner ruling, so they stay in Simple ────────────────────────
  spyPrice:     { ...R("The tape a reader owns the outcome of. The backdrop does not vote on price."),
                  feedsOverride: "MACRO FLIP" },
  spxIndex:     R("The index the SPY proxy is derived from, stated so the proxy can be checked."),
  qqqPrice:     R("The tape a reader owns the outcome of. The backdrop does not vote on price."),
  spyYtdTotal:  R("Total return including dividends — the number a holder actually earned."),
  qqqYtdTotal:  R("Total return including dividends — the number a holder actually earned."),

  /* ── TECHNICALS — Engine 0 gates orders on these; the backdrop does not read them ──────────
     spyMa100/spyMa200 take EXPLICIT entries rather than inheriting spyPrice's `return` role.
     The derivation graph below is about DATES, not about jobs: a moving average computed from a
     price is a different KIND of claim than the price, and the 200-day is the Macro Flip's own
     input. Own entry wins over the parent's, exactly as cadenceOf() resolves a derivative that
     declares its own cadence. */
  spyMa200:     { ...T("The crash circuit's own line. Engine 0 gates on it; the backdrop does not.", "spy_vs_200d"),
                  feedsOverride: "MACRO FLIP" },
  spyMa100:     T("A trend reference shown beside the 200-day. Neither engine votes on it."),
  /* Like spyMa200 above, and caught the same way — by putting it on screen. qqqChangePct
     inherits `return` from qqqPrice through the derivation graph, but Nasdaq-vs-S&P RELATIVE
     STRENGTH is Engine 0's own check, not a return a reader holds. The graph is about dates. */
  qqqChangePct: T("Relative strength is Engine 0's check; the backdrop votes on neither index.", "qqq_spy_rs"),
  thirtyYear:   T("Engine 0 reads the long end's own speed and the curve SHAPE.", "us30y_curve"),
  spread10s30s: T("Term premium — the shape the 10-year alone structurally cannot see.", "us30y_curve"),
  /* ⚠ CORRECTION to my own v7.1 Slice A classification, recorded rather than edited away.
     Both of these were filed `technical`, and they are not: this file defines technical as a
     reading ENGINE 0 GATES ORDERS ON, and neither is among its seven checks (spy_vs_200d, vix,
     fear_greed, qqq_spy_rs, us10y_trend, fed_next_meeting, us30y_curve). They are context — real
     readings neither engine acts on. Caught by rendering them: a row that claimed the
     order-gating engine reads it, when it does not, is a fabricated provenance. */
  threeMonth:   C("The front end, carried only so the classic recession lead can be computed."),
  spread10y3m:  C("The classic recession lead. Neither engine gates on it; it informs."),
  rateOddsHold: T("The market's own read of the policy path, into the next decision.", "fed_next_meeting"),

  // ── CONTEXT — real readings neither engine gates on ───────────────────────────────────────
  fedFunds:       C("The lagging monthly average. The backdrop votes on no policy-rate level."),
  fedTargetUpper: C("The policy rate itself. It steps on a decision day; no engine votes on it."),
  fedTargetLower: C("The lower bound of the same range."),
  unemployment:   C("Labour is the one transmission channel the six voters do not span. Recorded."),
  lfpr:           C("Participation — context for the unemployment rate beside it."),
  savings:        C("The household cushion. A level, not a signal either engine acts on."),
  /* MORTGAGE — the owner's 2026-09-19 question, ruled here rather than left an orphan. It is
     the ONLY housing number in the product, and it is CONTEXT, never a candidate for a seat.
     As a vote it would fail the v3.43 moat test: the 30-year mortgage is a spread over the
     10-year the backdrop already votes on, so seating it would cast two votes for one
     observation — the v3.83 collinearity defect, the TLT rejection in a different wrapper.
     It earns its place as context because the SPREAD over the 10-year is a genuine credit-
     transmission fact the 10-year alone cannot see. */
  mortgage30:     C("A spread over the 10-year the backdrop already votes on — one observation, one vote."),
  cpiCore:        C("Stated beside headline. The vote reads the headline trend's shape alone."),
  pceHeadline:    C("The Fed's preferred gauge, shown because its 2% target is on PCE, not CPI."),
  pceCore:        C("The core of the same gauge."),
  wti:            C("Energy — a cost input, not a backdrop verdict."),
  btc:            C("Risk appetite at the far end of the curve. Neither engine reads it."),
  hySpread:       C("A leg of the credit spread below; not read on its own."),
  igSpread:       C("The other leg of the same spread."),
  creditSpread:   C("How much extra risky borrowers pay — the transmission NFCI measures upstream."),
  creditTail:     C("The junk TAIL widens first while broad high yield still looks calm."),
  nfciLeverage:   C("The leverage subindex. CONTEXT ONLY since v3.43 — the parent index votes, this does not."),
  /* SAHM — context TODAY. v7.1 Slice D promotes it to role "override" when the bearish-only
     safety circuit lands, and pins the promotion. It is deliberately NOT labelled "override"
     ahead of the code that would make that true: a registry claiming a job the product does not
     yet do is the label-outlives-its-data defect pointed forwards instead of backwards. */
  sahm:           C("Recession signal, computed from the same unemployment pull. Non-voting on arrival (v3.84)."),
  marketHeadline: C("Named as context in WHY #3. Today is data-driven, not news-driven."),
  tokenBlendedMtok: C("The price leg of AI unit economics. Curated pairing, votes nowhere."),
  tokenVolDay:      C("The volume leg. Price times volume is the demand read, not a verdict."),
});

/* NOT A SIGNAL. mag10PricesJson is a JSON passthrough kept MAPPED after v3.51 cut the Mag-10
   strip, because the same Finnhub pull feeds QQQ — so it has a SOURCES entry and no render site
   at all. Giving it a role would claim it informs a reader of something. Exempt, with the reason
   stated, the same shape as DERIVED_EXEMPT in sources.js. */
export const ROLE_EXEMPT = Object.freeze(["mag10PricesJson"]);

/* Own role first, else the DERIVED_OF parent's, else null — the cadenceOf() resolution exactly.
   Inheriting through the derivation graph is what keeps this table to PRIMARY fields only: a
   derivative describes the same underlying thing as its parent, so spyChangePct is a return and
   vixSeries is a voter's series without either needing an entry. A derivative whose JOB genuinely
   differs from its parent's declares its own (see spyMa200 above). */
export function roleEntry(field) {
  if (SIGNAL_ROLES[field]) return SIGNAL_ROLES[field];
  const parent = DERIVED_OF[field];
  return parent && SIGNAL_ROLES[parent] ? SIGNAL_ROLES[parent] : null;
}
export function roleOf(field) {
  const e = roleEntry(field);
  return e ? e.role : null;
}
/* THE MODE GATE. Simple carries the market call's own voters, the returns a reader owns, and
   nothing else. A field with no role is NOT allowed in Simple — fail closed, so a newly added
   signal is absent from Simple until someone gives it a job. */
export function simpleAllowed(field) {
  const e = roleEntry(field);
  return e ? e.simple === true : false;
}
/* The reason a non-voter does not vote, for the sheets that must state it (the stripExplain.js
   beat-2 rule, widened in v7.1 to every non-voting reading). Null for a voter — it votes. */
export function whyNotAVoter(field) {
  const e = roleEntry(field);
  return e && e.role !== "voter" ? e.why : null;
}
export function fieldsWithRole(role) {
  return Object.keys(SIGNAL_ROLES).filter((k) => SIGNAL_ROLES[k].role === role);
}
/* Every SOURCES field must have a role, inherit one, or be explicitly exempt. Returns the
   offenders so the smoke reconciliation can NAME them rather than report a count (v3.65). */
export function unroledFields() {
  return Object.keys(SOURCES).filter((k) =>
    !DERIVED_EXEMPT.includes(k) && !ROLE_EXEMPT.includes(k) && !roleEntry(k));
}
