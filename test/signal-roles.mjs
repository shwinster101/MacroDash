/* v7.1 — SIX VOTERS, STATED. The signal-role registry held against the rest of the product.

   WHAT THESE PINS EXIST TO PREVENT. Two things, and the first is the reason the module exists.

   (1) A 7th VOTER ARRIVING BY ACCIDENT. REGIME_QUORUM was a bare literal `4` while verdictFrom()
   derived its majority from `counted`. At six voters both rules read two-thirds; at seven the
   majority drops to 57% BY DESIGN and the quorum would have dropped to 57% BY OMISSION —
   loosening the strongest abstention claim the public engine makes, silently, as a side effect
   of what looks like a pure addition. That is the DEC-31 / v5.97.0 count trap one engine over.
   The quorum is DERIVED now, so the two-thirds rule regime.js has always CLAIMED is the one it
   COMPUTES; these pins hold that derivation, its value today, and the owner's ceiling against
   the table itself, so adding a seat turns a test red rather than moving majority math.

   (2) A SIGNAL WITH NO STATED JOB. Role was inferred at three unrelated sites and written down
   nowhere. The sweep below fails on the first SOURCES field that has no role, no inherited role
   and no explicit exemption — and it NAMES the offenders rather than counting them (v3.65), so
   the failure is a diagnosis.

   THE VOTER SET IS RECONCILED, NOT DERIVED — signalRoles.js deliberately does not import
   REGIME_BAND_TABLE (see the module header for why). The suite imports both and holds them
   against each other: the SOURCES <-> DERIVED_OF and playwright EXECUTABLE_PATHS idiom, and the
   same call v7.0.3 made for the F&G band reconciliation. Note the comparison must map through
   FACTOR_FIELD: the band table keys the valuation factor `valuation` while its SOURCES field is
   `shillerPe`, and a raw comparison would fail on that alias while proving nothing. */
import {
  VOTER_CEILING, SIGNAL_ROLES, ROLES, ROLE_EXEMPT,
  roleOf, roleEntry, simpleAllowed, whyNotAVoter, fieldsWithRole, unroledFields,
} from "../src/signalRoles.js";
import { REGIME_BAND_TABLE, REGIME_QUORUM, verdictFrom } from "../src/regime.js";
import { FACTOR_FIELD } from "../src/evidence.js";
import { SOURCES, DERIVED_OF } from "../src/sources.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
// Comments quote the very literals these sweeps look for, so a raw match would find the
// explanation instead of the code — the v3.60.1 self-matching trap, three times over in this
// repo's history. Every source sweep below reads comment-stripped text.
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

export function testSignalRoles(ok) {
  const regimeSrc = strip(src("../src/regime.js"));
  const rolesSrc = strip(src("../src/signalRoles.js"));
  const tableKeys = REGIME_BAND_TABLE.map((b) => b.key);

  /* ── THE CEILING AND THE DERIVED QUORUM ─────────────────────────────────────────────────── */
  ok("[92] v7.1 ceiling: the owner's 6 === the band table's own length (owner ruling 2026-09-19)",
    VOTER_CEILING === 6 && REGIME_BAND_TABLE.length === VOTER_CEILING);

  /* Three pins, and they fail on DIFFERENT mistakes on purpose. The value pin alone would stay
     green against a hardcoded 4, which is exactly the state this release removes — so the
     derivation is pinned at SOURCE, the value is pinned behaviourally, and the ceiling ties both
     to the table. The negative control (hardcode `= 4` back) turns only the first one red. */
  ok("[92] quorum is DERIVED from the table, not a literal — the count trap cannot reopen",
    /REGIME_QUORUM\s*=\s*Math\.ceil\(\(REGIME_BAND_TABLE\.length\s*\*\s*2\)\s*\/\s*3\)/.test(regimeSrc)
    && !/REGIME_QUORUM\s*=\s*\d+\s*;/.test(regimeSrc));
  ok("[92] quorum is BYTE-IDENTICAL in behaviour today: 6 voters → 4, exactly as the literal was",
    REGIME_QUORUM === 4);
  ok("[92] quorum states the two-thirds rule the comment always claimed (5 at 7, 4 at 6, 3 at 4)",
    Math.ceil((7 * 2) / 3) === 5 && Math.ceil((6 * 2) / 3) === 4 && Math.ceil((4 * 2) / 3) === 3);

  /* THE TRAP ITSELF, measured rather than asserted. This is the number the release exists to
     stop moving: at six voters the quorum is two-thirds of the evidence base; a 7th seat with
     the old literal would have made it 57% while the majority ALSO fell to 57%. */
  ok("[92] the count trap, measured: a literal 4 at 7 voters is 57% where the design says 67%",
    (4 / 7) < 0.6 && (Math.ceil((7 * 2) / 3) / 7) > 0.66
    && verdictFrom(4, 0, 7) === "RISK-ON" && verdictFrom(3, 0, 7) === "MIXED");

  /* ── THE RECONCILIATION (two homes, held against each other) ─────────────────────────────── */
  const registryVoters = fieldsWithRole("voter").sort();
  const tableFields = tableKeys.map((k) => FACTOR_FIELD[k]).sort();
  ok("[92] voters reconcile: the registry's voter set IS the band table, mapped through FACTOR_FIELD",
    registryVoters.length === VOTER_CEILING && registryVoters.join(",") === tableFields.join(","));
  ok("[92] the alias is what makes that a real check — valuation votes, shillerPe is its field",
    FACTOR_FIELD.valuation === "shillerPe" && roleOf("shillerPe") === "voter" && !SIGNAL_ROLES.valuation);
  /* signalRoles.js must NOT import the band table — that coupling is the thing the separation
     buys, and a future edit "simplifying" the reconciliation away would undo it silently. */
  ok("[92] signalRoles.js does not import regime.js — the engines stay married-never-merged",
    !/from\s+["'][^"']*regime\.js["']/.test(rolesSrc) && !/REGIME_BAND_TABLE/.test(rolesSrc));

  /* ── EVERY FIELD HAS A JOB ───────────────────────────────────────────────────────────────── */
  const unroled = unroledFields();
  ok(`[92] every SOURCES field has a role, inherits one, or is exempt (unroled: ${unroled.join(",") || "none"})`,
    unroled.length === 0);
  ok("[92] the role vocabulary is CLOSED — no entry invents a seventh kind of job",
    Object.values(SIGNAL_ROLES).every((e) => ROLES.includes(e.role)));
  ok("[92] every non-voter states WHY it does not vote — the fact with no other home",
    Object.keys(SIGNAL_ROLES).every((k) => SIGNAL_ROLES[k].role === "voter"
      || (typeof SIGNAL_ROLES[k].why === "string" && SIGNAL_ROLES[k].why.length > 20)));
  ok("[92] whyNotAVoter is null for a voter and a real sentence for everything else",
    whyNotAVoter("vix") === null && typeof whyNotAVoter("mortgage30") === "string");
  /* The registry carries no display label BY DESIGN: band.plain, the evidence alias and
     simpleFace's FACE_NOUN are already three noun tables for these six signals, and a fourth
     would be the drift this module exists to stop. Pinned so one cannot be added quietly. */
  ok("[92] the registry carries NO display label — a fourth noun table is the drift it prevents",
    Object.values(SIGNAL_ROLES).every((e) => !("label" in e) && !("short" in e) && !("plain" in e)));

  /* ── INHERITANCE THROUGH THE DERIVATION GRAPH ────────────────────────────────────────────── */
  ok("[92] a derivative inherits its parent's job — no entry needed for spyChangePct or vixSeries",
    !SIGNAL_ROLES.spyChangePct && roleOf("spyChangePct") === "return"
    && !SIGNAL_ROLES.vixSeries && roleOf("vixSeries") === "voter"
    && DERIVED_OF.spyChangePct === "spyPrice" && DERIVED_OF.vixSeries === "vix");
  /* The one place inheritance would be WRONG, and why an own entry must win. The derivation
     graph is about DATES; a moving average computed from a price is a different KIND of claim
     than the price, and the 200-day is the Macro Flip's own input. */
  ok("[92] an own entry beats the inherited one: spyMa200 is TECHNICAL though spyPrice is a return",
    DERIVED_OF.spyMa200 === "spyPrice" && roleOf("spyPrice") === "return"
    && roleOf("spyMa200") === "technical" && SIGNAL_ROLES.spyMa200.engine0Check === "spy_vs_200d");

  /* ── THE MODE GATE ───────────────────────────────────────────────────────────────────────── */
  ok("[92] Simple carries voters and returns ONLY — no technical or context reading",
    Object.keys(SIGNAL_ROLES).every((k) =>
      !SIGNAL_ROLES[k].simple || ["voter", "return"].includes(SIGNAL_ROLES[k].role)));
  ok("[92] all six voters are in Simple — the market call IS the voters (owner definition)",
    tableFields.every((f) => simpleAllowed(f)));
  ok("[92] returns stay in Simple — owner ruling 2026-09-19, 'returns are fundamentals'",
    ["spyPrice", "qqqPrice", "spyYtdTotal", "qqqYtdTotal"].every((f) => simpleAllowed(f))
    && fieldsWithRole("return").every((f) => simpleAllowed(f)));
  ok("[92] the FED tile is NOT a Simple reading — the one non-voter that was in the fold",
    !simpleAllowed("fedFunds") && !simpleAllowed("fedTargetUpper") && roleOf("fedFunds") === "context");
  /* FAIL CLOSED. A field nobody has given a job to is absent from Simple until someone does —
     the alternative is a new signal appearing on the default view by omission. */
  ok("[92] simpleAllowed FAILS CLOSED on an unknown field — absent until given a job",
    simpleAllowed("somethingNobodyClassified") === false && roleOf("somethingNobodyClassified") === null
    && roleEntry("somethingNobodyClassified") === null);

  /* ── THE TWO RULINGS RECORDED IN THE REGISTRY ────────────────────────────────────────────── */
  /* MORTGAGE (owner question 2026-09-19). It is the only housing number in the product and it is
     CONTEXT — as a vote it would be the TLT rejection in a different wrapper (a spread over the
     10-year the backdrop already votes on: one observation, two votes, the v3.83 collinearity
     defect). Pinned in BOTH directions so a later pass cannot seat it without answering this. */
  ok("[92] mortgage30 is CONTEXT, never a voter — the v3.43 moat test, stated at the entry",
    roleOf("mortgage30") === "context" && !simpleAllowed("mortgage30")
    && !tableFields.includes("mortgage30")
    && /10-year the backdrop already votes on/.test(SIGNAL_ROLES.mortgage30.why));
  /* ⚠ PIN FLIPPED IN v7.2, and the reason is recorded here rather than the pin quietly
     rewritten. It read `roleOf("sahm") === "context" && !fieldsWithRole("override").length` and
     said in as many words that it would flip with the code, in the same commit. That commit is
     v7.2: the bearish-only override ships in src/macroCall.js, so the registry now claims a job
     the product does. The CLAIM is unchanged — the registry may never name a role the code does
     not honour — only its direction moved, and the full behavioural cover lives in [96]. */
  ok("[92] sahm is the ONE override role — promoted in the same commit as the circuit (v7.2)",
    roleOf("sahm") === "override" && fieldsWithRole("override").join(",") === "sahm"
    && /at its own trigger it OVERRIDES/.test(SIGNAL_ROLES.sahm.why));

  /* ── THE OVERRIDE ANNOTATION ─────────────────────────────────────────────────────────────── */
  /* An override input is the one case where a non-voting number can move the published call, so
     it is STATED rather than left to be inferred from a banner. `simple` governs a READING, not
     a verdict built from one — PANIC and Macro Flip banners render in both modes (v3.25), and
     spyMa200 being simple:false does not gate them. Pinned, because that looks like an
     inconsistency to anyone reading the table cold. */
  const feeders = Object.keys(SIGNAL_ROLES).filter((k) => SIGNAL_ROLES[k].feedsOverride);
  ok("[92] the PANIC, Macro Flip and SAHM inputs are NAMED as override feeders", // +sahm, v7.2
    feeders.sort().join(",") === "fearGreed,sahm,spyMa200,spyPrice,vix"
    && /PANIC/.test(SIGNAL_ROLES.vix.feedsOverride) && /MACRO FLIP/.test(SIGNAL_ROLES.spyMa200.feedsOverride)
    && /SAHM/.test(SIGNAL_ROLES.sahm.feedsOverride));
  ok("[92] a circuit's input may be simple:false while the circuit itself renders in both modes",
    SIGNAL_ROLES.spyMa200.simple === false && SIGNAL_ROLES.vix.simple === true);

  /* ── THE v3.88 SEPARATION STILL HOLDS ────────────────────────────────────────────────────── */
  /* The whole reason this is a NEW module: the v3.88 sweep asserts creditTail/sahm/spread10y3m
     are ABSENT from evidence.js and the band-table slice of regime.js, so a non-voter cannot
     drift into the voting path. This re-states that from the other side — the registry NAMES
     them, and naming them must not have required touching either file. */
  const evSrc = strip(src("../src/evidence.js"));
  ok("[92] naming the non-voters did not leak them into the voting path (the v3.88 separation)",
    ["creditTail", "sahm", "spread10y3m", "mortgage30"].every((k) =>
      !evSrc.includes(k) && !regimeSrc.includes(k) && Boolean(roleEntry(k))));
  ok("[92] ROLE_EXEMPT states its reason: a mapped passthrough with no render site is not a signal",
    ROLE_EXEMPT.includes("mag10PricesJson") && Boolean(SOURCES.mag10PricesJson)
    && roleEntry("mag10PricesJson") === null);
}
