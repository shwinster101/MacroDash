/* v7.2 — THE SAHM BEARISH-ONLY OVERRIDE. Section [96].

   WHAT THESE PINS EXIST TO PREVENT.

   (1) A ONE-WAY CIRCUIT BECOMING TWO-WAY. This is the whole safety claim: the Sahm rule may
   move the published call TOWARD bearish and by no path away from it. A future edit that let it
   clear a bearish call, or lift a downgrade, would turn a recession gauge into a buy signal.
   The pin is a SWEEP over every base posture × every gauge state, comparing the call against
   the same call computed with the gauge absent — never a single hand-picked case, because a
   one-way property is a claim about all inputs.

   (2) FIRING ON EVIDENCE NOBODY CAN TRUST. Three conditions, each failing closed: usable
   (LIVE/CACHED), DATED, and at or above the trigger. An undated reading is the dangerous one —
   `fieldMode` returns LIVE for a value with no observation date, and `isStale` fails open on a
   missing date by design, so without the explicit `as_of` requirement a dateless number could
   force the public call bearish. Pinned as its own case.

   (3) A DRIFTED EDGE. SAHM_TRIGGER is Sahm's own printed definition and has ONE home. Three
   surfaces read it now — the labour row, the Beyond-the-vote row, and this override — so the
   pins execute the boundary at 0.49 / 0.50 / 0.51 through the REAL engine and reconcile the
   constant across its consumers rather than retyping 0.5 anywhere.

   (4) A CIRCUIT NAMED WRONG ON THE PAGE. "the crash circuit" was correct while PANIC was the
   only override. Printing it under a SAHM would attribute the forced call to a circuit that did
   not fire — a fabricated cause, the same defect class as a fabricated number. Swept across the
   paste block, both five-why registers and the history page.

   (5) A FROZEN RECORD BROKEN BY AN ADDITIVE FIELD. `override.sahm` is always present, so a
   pre-7.2 stored call simply lacks the key and reads fired:false by absence (the v5.1.1 rule).
   `validFrozenCall` is pinned NOT to enumerate the override vocabulary, which is the property
   that made the additive design safe — verified before the code was written, pinned after. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { callFromEvidence, buildMacroCall, sahmFromLive, formatMacroCallPaste,
  formatMacroShareCard, SAHM_TRIGGER } from "../src/macroCall.js";
import { SAHM_TRIGGER as SAHM_TRIGGER_HOME } from "../src/sahm.js";
import { validFrozenCall } from "../src/publicHistory.js";
import { computeFiveWhys } from "../src/fiveWhys.js";
import { roleOf, simpleAllowed, fieldsWithRole, SIGNAL_ROLES } from "../src/signalRoles.js";
import { beyondRows } from "../src/beyondRows.js";
import { MOCK_DATA } from "../src/mockData.js";
const MOCK_SAHM = MOCK_DATA.macro.unemployment.sahm;

const src = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
// Comments quoting a rule are not the rule (the v3.60.1 self-matching trap, which this file's
// own explanatory prose would otherwise trip every time it names a literal it forbids).
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/* GUARDED, because a section that throws prints no total and reads exactly like a suite that
   passed (the v3.99.4 P0 shape). My own first run of this section died on `computeFiveWhys(...)
   .join` — it returns an object, not an array — and took the whole suite's total with it.
   Recorded rather than quietly fixed: a throw is a RED assertion here now. */
export function testSahmOverride(ok) {
  console.log("\n[96] v7.2 — the Sahm rule as a bearish-only safety override");
  try { runSahmOverride(ok); } catch (e) {
    ok(`[96] the section ran to completion — it threw instead: ${e && e.message}`, false);
  }
}

function runSahmOverride(ok) {
  const D = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const now = new Date(`${D}T16:00:00Z`);
  const live = (o = {}) => ({
    tenYear: 4.1, tenYearM1: -0.2, tenYearAsOf: D,
    vix: 15, vixAsOf: D,
    fearGreed: 60, fearGreedLabel: "Greed", fearGreedAsOf: D,
    cpiHeadline: 2.4, cpiTrend: [3.0, 2.8, 2.6, 2.4], cpiHeadlineAsOf: D,
    shillerPe: 20, shillerPeAsOf: D,
    nfci: -0.6, nfciAsOf: D,
    spyPrice: 700, spyMa200: 650, spyPriceAsOf: D,
    ...o,
  });
  const call = (o) => buildMacroCall(live(o), { now, effectiveDate: D });

  /* ── THE CONSTANT HAS ONE HOME ─────────────────────────────────────────────────────────── */
  ok("[96] SAHM_TRIGGER is Sahm's own printed definition, re-exported not retyped",
    SAHM_TRIGGER === 0.5 && SAHM_TRIGGER === SAHM_TRIGGER_HOME
    && /import \{ SAHM_TRIGGER \} from "\.\/sahm\.js"/.test(src("../src/macroCall.js"))
    && /import \{ SAHM_TRIGGER \} from "\.\/sahm\.js"/.test(src("../src/beyondRows.js")));
  // Three surfaces read the edge. A literal 0.5 at any of them would be the 5-vs-6 denominator
  // defect with a recession rule: the tile would say CLEAR while the call read BEARISH.
  ok("[96] no consumer retypes the edge — the tile, the beyond row and the override share it",
    [ "../src/macroCall.js", "../src/beyondRows.js", "../src/sections/MacroRegime.jsx" ]
      .every((f) => !/>=\s*0\.5\b/.test(strip(src(f)))));

  /* ── THE BOUNDARY, EXECUTED THROUGH THE REAL ENGINE ────────────────────────────────────── */
  const at = call({ sahm: 0.5, sahmAsOf: D });
  const under = call({ sahm: 0.49, sahmAsOf: D });
  const over = call({ sahm: 0.51, sahmAsOf: D });
  ok("[96] the rule is `>=` — 0.50 fires, 0.49 does not, 0.51 does",
    at.override.type === "SAHM" && under.override.type === null && over.override.type === "SAHM");
  ok("[96] a fired rule forces the call bearish while base_direction keeps the backdrop's own word",
    over.direction === "BEARISH" && over.headline === "DIAMOND HANDS" && over.base_direction === "BULLISH");
  ok("[96] a clear rule changes NOTHING — the bullish call and its status pass through",
    under.direction === "BULLISH" && under.status === "OK" && under.override.active === false
    && under.override.sahm.fired === false && under.override.sahm.value === 0.49);

  /* ── FAIL CLOSED ON THE EVIDENCE ───────────────────────────────────────────────────────── */
  /* The undated case is the dangerous one and is pinned on its own: fieldMode returns LIVE for a
     value with no observation date (isStale fails OPEN on a missing date, correctly — there is
     nothing to judge), so without the explicit as_of requirement a dateless number would force
     the public call bearish. */
  const undated = call({ sahm: 0.6 });
  const stale = call({ sahm: 0.6, sahmAsOf: "2026-01-01" });
  const absent = call({});
  ok("[96] an UNDATED reading never fires — a circuit that moves the call must show its date",
    undated.override.type === null && undated.override.sahm.fired === false
    && undated.override.sahm.value === null && undated.direction === "BULLISH");
  ok("[96] a STALE reading never fires, and says so in its own mode field",
    stale.override.type === null && stale.override.sahm.fired === false
    && stale.override.sahm.mode === "STALE" && stale.direction === "BULLISH");
  ok("[96] an ABSENT gauge is reported as MOCK with a null value — never a zero that reads clear",
    absent.override.sahm.value === null && absent.override.sahm.mode === "MOCK"
    && absent.override.sahm.fired === false && absent.override.sahm.trigger === SAHM_TRIGGER);
  /* A BLIND GAUGE WITHHOLDS NOTHING — deliberately the opposite of the crash circuit's rule.
     The crash circuit's silence is uninformative about the very event it exists to catch; a
     missing recession gauge makes no claim about the economy in either direction. Pinned so the
     difference reads as a ruling rather than an oversight. */
  ok("[96] ⚠ a blind Sahm withholds NOTHING — the v3.40 asymmetry does not extend to it",
    absent.direction === "BULLISH" && absent.actionability === "FULL" && absent.downgraded === null);

  /* ── ONE-WAY: THE WHOLE SAFETY CLAIM, SWEPT ────────────────────────────────────────────── */
  /* Compared against the SAME call computed with the gauge absent, across every base posture and
     every gauge state. A single hand-picked case cannot support a claim about all inputs. */
  const rank = { BEARISH: 0, NEUTRAL: 1, BULLISH: 2 };
  const postures = {
    bull: {},
    mixed: { tenYearM1: 0, vix: 20, fearGreed: 40, cpiTrend: [2.4, 2.4], shillerPe: 27, nfci: -0.2 },
    bear: { tenYearM1: 0.2, vix: 26, fearGreed: 20, cpiTrend: [2.0, 2.6], shillerPe: 40, nfci: 0.1 },
    blind: { spyMa200: undefined },
    withheld: { vix: undefined, fearGreed: undefined, nfci: undefined },
  };
  const gauges = [
    { sahm: 0.6, sahmAsOf: D }, { sahm: 0.5, sahmAsOf: D }, { sahm: 0.49, sahmAsOf: D },
    { sahm: 0.0, sahmAsOf: D }, { sahm: 9.0, sahmAsOf: D }, { sahm: 0.6 },
    { sahm: 0.6, sahmAsOf: "2026-01-01" },
  ];
  let oneWay = true, movedAtLeastOnce = false;
  for (const p of Object.values(postures)) {
    const without = call(p);
    for (const g of gauges) {
      const withG = call({ ...p, ...g });
      const a = rank[withG.direction], b = rank[without.direction];
      // A withheld call has no direction on either side; nothing to compare, nothing to move.
      if (a === undefined || b === undefined) { if (a !== b) oneWay = false; continue; }
      if (a > b) oneWay = false;
      if (a < b) movedAtLeastOnce = true;
    }
  }
  ok("[96] ONE-WAY: across every posture × gauge state, Sahm never moves a call more bullish",
    oneWay === true);
  ok("[96] …and the sweep is not vacuous — at least one case actually moved the call bearish",
    movedAtLeastOnce === true);
  // The no-op case, stated: a fired rule on a backdrop that already voted bearish changes the
  // direction by nothing. It still RECORDS that it fired, exactly as PANIC does.
  const bearFired = call({ ...postures.bear, sahm: 0.6, sahmAsOf: D });
  ok("[96] a fired rule on an already-bearish backdrop is a direction no-op, still recorded",
    bearFired.direction === "BEARISH" && bearFired.base_direction === "BEARISH"
    && bearFired.override.sahm.fired === true);

  /* ── PRECEDENCE, AND THE FACT THAT SURVIVES IT ─────────────────────────────────────────── */
  const both = call({ sahm: 0.6, sahmAsOf: D, vix: 26, fearGreed: 19, spyPrice: 600 });
  ok("[96] PANIC wins when both fire — one override word owns the banner",
    both.override.type === "PANIC" && both.status === "PANIC" && both.direction === "BEARISH");
  ok("[96] …and the gauge's own fact survives the precedence rule rather than vanishing",
    both.override.sahm.fired === true && both.override.panic === true);
  /* A withheld call has no direction to override, so `type` stays null while `fired` records the
     gauge. Publishing a directional call off one non-voting number below quorum would be worse
     than withholding — the same guard the PANIC arm has carried since v5.3. */
  const thinFired = call({ ...postures.withheld, sahm: 0.6, sahmAsOf: D });
  ok("[96] below quorum the rule cannot publish a direction — fired is a fact, not a call",
    thinFired.published === false && thinFired.direction === null
    && thinFired.override.type === null && thinFired.override.sahm.fired === true
    && thinFired.status === "DATA HOLD");

  /* ── STATUS AND ACTIONABILITY ──────────────────────────────────────────────────────────── */
  ok("[96] SAHM takes its OWN status word — the one machine field must name the right circuit",
    over.status === "SAHM" && under.status === "OK" && both.status === "PANIC");
  /* Actionability answers "may this call gate capital" and its inputs are evidence QUALITY plus
     the crash circuit. A bearish call on full evidence is exactly the kind a reader should act
     on. Pinned in BOTH directions, because the terminal's macro gate reads this field (FULL →
     SEND IT) and coupling it here would be an unannounced change to an order-gating surface. */
  ok("[96] ⚠ actionability is UNTOUCHED by a fired Sahm, while PANIC still forces HOLD",
    over.actionability === "FULL" && over.confidence === "HIGH"
    && both.actionability === "HOLD" && under.actionability === "FULL");

  /* ── THE FROZEN-CALL BOUNDARY ──────────────────────────────────────────────────────────── */
  /* Verified BEFORE the code was written and pinned after: validFrozenCall checks the schema,
     the capture status and the date — never the override vocabulary. That is the property that
     made an additive `type` value safe. */
  const histSrc = strip(src("../src/publicHistory.js"));
  ok("[96] validFrozenCall does not enumerate the override vocabulary (the additive precondition)",
    !/override/.test(histSrc));
  const frozen = (c) => validFrozenCall({
    schema: "md-history-record-v1", capture_status: "CAPTURED", date: D, call: c });
  ok("[96] a SAHM-overridden call freezes and reads back exactly like any other",
    frozen(over) !== null && frozen(over).override.type === "SAHM");
  /* THE v5.1.1 RULE. A record written before this release carries no `sahm` key at all. Reading
     it must yield fired:false by ABSENCE — failing closed on a field nobody had written yet
     would flip the whole frozen history red, which is an outage dressed as a safety rule. */
  const legacy = JSON.parse(JSON.stringify(under));
  delete legacy.override.sahm;
  ok("[96] a pre-7.2 record lacks the key entirely and reads fired:false by absence",
    frozen(legacy) !== null && legacy.override.sahm === undefined
    && !(legacy.override.sahm?.fired) && legacy.override.type === null);

  /* ── THE CIRCUIT IS NAMED, EVERYWHERE A CAUSE IS STATED ────────────────────────────────── */
  const fired = call({ sahm: 0.6, sahmAsOf: D });
  const paste = formatMacroCallPaste(fired);
  ok("[96] the paste names the recession rule and its reading, never the crash circuit",
    /OVERRIDE SAHM · recession rule triggered — 0\.60 vs 0\.50 trigger · as of /.test(paste)
    && !/crash circuit/.test(paste));
  /* The fired-but-not-owning case gets its own line. A red fact hidden by its own precedence
     rule is exactly the case a reader would most want to know about (v3.25). */
  ok("[96] a fired rule that did NOT win the override still prints, naming what owns it",
    /SAHM RULE TRIGGERED · 0\.60 vs 0\.50 trigger · as of .* — PANIC owns the override/
      .test(formatMacroCallPaste(both))
    && /no call was published to override/.test(formatMacroCallPaste(thinFired)));
  ok("[96] a PANIC paste is byte-unchanged — the existing override line did not move",
    /OVERRIDE PANIC · crash circuit tripped/.test(formatMacroCallPaste(both)));
  ok("[96] the share card stays exactly five lines — the friend-facing card did not grow",
    formatMacroShareCard(over, { frozen: true }).split("\n").length === 5
    && formatMacroShareCard(both).split("\n").length === 5);

  /* Both five-why registers. Simple says "the recession rule"; Degen reads override.type, which
     was already generic — pinned so it stays that way. */
  const whyOf = (c, vocabulary) => computeFiveWhys(
    { marketPulse: { headline: null } },
    { label: c.headline, counted: c.counts.usable, totalFactors: c.counts.total },
    { vocabulary, call: c, fresh: new Set() }).whys;
  const simpleWhys = whyOf(fired, "simple").join(" ");
  const degenWhys = whyOf(fired, "degen").join(" ");
  ok("[96] Simple's whys name the recession rule, and no longer claim the crash circuit",
    /forced by the recession rule/.test(simpleWhys) && /recession rule triggered/i.test(simpleWhys)
    && !/crash circuit/.test(simpleWhys));
  ok("[96] Degen's whys read override.type, so the name follows the circuit with no second table",
    /SAHM override/.test(degenWhys));
  ok("[96] a PANIC call still reads the crash circuit in both registers — nothing was renamed away",
    /forced by the crash circuit/.test(whyOf(both, "simple").join(" "))
    && /PANIC override/.test(whyOf(both, "degen").join(" ")));
  // The history page renders the STORED type. A frozen record is immutable, so a hardcoded word
  // would have described a circuit that never fired, forever.
  ok("[96] /history renders the stored override type, never a hardcoded PANIC",
    /\{c\.override\.type\|\|"PANIC"\} OVERRIDE/.test(strip(src("../src/PublicPages.jsx"))));

  /* ── THE REGISTRY PROMOTION ────────────────────────────────────────────────────────────── */
  /* v7.1 pinned sahm at `context` and said the promotion would land in the same commit as the
     code that makes it true. It has — so that pin FLIPS here rather than being deleted. */
  ok("[96] sahm is promoted to role `override` — the registry now claims a job the code does",
    roleOf("sahm") === "override" && fieldsWithRole("override").join(",") === "sahm"
    && SIGNAL_ROLES.sahm.feedsOverride === "SAHM RULE");
  /* `simple` governs a READING, not a verdict built from one. The reading stays Degen-only; the
     BANNER is call state and renders in both modes. That is the documented split (the same one
     spyMa200 carries), not an inconsistency — pinned because it looks like one read cold. */
  /* The registry says the READING is Degen-only; the orchestrator's banner slot carries NO mode
     gate, and passes `simple` down so the banner speaks the reader's own vocabulary instead of
     disappearing. Both halves are asserted, because the split is only coherent if both hold —
     and the public browser suite drives it live in both modes, which is the stronger proof. */
  ok("[96] the READING stays Degen-only while the banner renders in both modes",
    simpleAllowed("sahm") === false && SIGNAL_ROLES.sahm.simple === false
    && !/!simple\s*&&\s*\{?\s*dailyCall\.override/.test(strip(src("../src/dashboard.jsx")))
    && /<SahmOverrideBanner call=\{dailyCall\} simple=\{simple\}\/>/.test(src("../src/dashboard.jsx")));
  /* THE v3.88 SEPARATION STILL HOLDS, and it is what makes the override safe to add at all: the
     override is CALL state, not a vote, so `sahm` stays absent from the band table, evidence.js
     and ttReadout.js. The seat count is untouched. */
  const regimeSrc = src("../src/regime.js");
  const bandSlice = regimeSrc.slice(regimeSrc.indexOf("REGIME_BAND_TABLE"), regimeSrc.indexOf("verdictFrom"));
  ok("[96] the override did NOT leak into the voting path — the six-voter ceiling is untouched",
    !bandSlice.includes("sahm") && !src("../src/evidence.js").includes("sahm")
    && !src("../src/ttReadout.js").includes("sahm")
    && over.counts.total === 6 && over.factors.length === 6);

  /* ── THE DEMO BUILD, AND A PRE-EXISTING PIN THAT JUST BECAME LOAD-BEARING ──────────────── */
  /* The override arm is NOT demo-guarded, and that is deliberate — it matches PANIC exactly,
     while the blind-circuit downgrade below it IS guarded (`!isDemo`). What keeps a demo build
     from publishing a forced-bearish call is therefore the MOCK BASELINE itself: v3.88 pinned
     `MOCK_DATA.macro.unemployment.sahm < SAHM_TRIGGER` as a rendering fact, and v7.2 makes that
     same pin the thing standing between the demo and a fabricated recession call. Stated here,
     because a guarantee that rests on another file's constant should not rest on it silently. */
  ok("[96] the demo cannot fire it — the mock baseline abstains, and that is now load-bearing",
    MOCK_SAHM < SAHM_TRIGGER && !/!isDemo && base && sahmFired/.test(strip(src("../src/macroCall.js")))
    && /!isDemo && base && base\.direction === "BULLISH"/.test(strip(src("../src/macroCall.js"))));

  /* ── THE BEYOND-THE-VOTE ROW ───────────────────────────────────────────────────────────── */
  const bd = (sahm, mode = "LIVE", asOf = D) => beyondRows({
    d: { macro: { unemployment: { sahm }, credit: {}, nfci: {}, savings: {}, mortgage: {} },
      marketPulse: { vix: { current: 15 }, fearGreed: { score: 60 }, spy: { price: 700, ma200: 650 } },
      crossAsset: { treasury10y: {}, term: {} } },
    modeOf: (k) => k === "sahm" ? mode : "LIVE",
    asOfOf: (k) => k === "sahm" ? asOf : D,
    flip: { evaluable: true, armed: false, tripped: false }, panic: false,
  }).overrides.find((r) => r.key === "sahm");
  ok("[96] the block carries THREE overrides now, and the Sahm row states its distance",
    bd(0.13).state === "CLEAR" && bd(0.13).distance === "0.37 below the trigger"
    && bd(0.6).state === "TRIGGERED" && bd(0.6).toneKey === "red"
    && beyondRows({ d: { macro: {}, marketPulse: {}, crossAsset: {} }, modeOf: () => "LIVE",
      asOfOf: () => D, flip: {}, panic: false }).overrides.length === 3);
  ok("[96] a dark or undated gauge reads CANNOT SEE on the row, never CLEAR (v3.40)",
    bd(0.13, "MOCK").state === "CANNOT SEE" && bd(0.13, "STALE").state === "CANNOT SEE"
    && bd(0.13, "LIVE", null).state === "CANNOT SEE");

  /* ── THE PROVENANCE HELPER, AND THE CLIENT MIRROR ──────────────────────────────────────── */
  ok("[96] sahmFromLive resolves provenance the way the crash circuit's helper does",
    sahmFromLive({ sahm: 0.6, sahmAsOf: D }, { now }).mode === "LIVE"
    && sahmFromLive({ sahm: 0.6, sahmAsOf: D }, { cached: true, now }).mode === "CACHED"
    && sahmFromLive({}, { now }).mode === "MOCK" && sahmFromLive({}, { now }).value === null);
  /* THE TRIGGER COMPARISON IS NOT IN THE MIRROR. The dashboard hands over the reading and its
     mode; callFromEvidence applies the edge. Two comparisons would be two answers on one page. */
  const dashSrc = strip(src("../src/dashboard.jsx"));
  ok("[96] the client mirror hands over the reading, never a verdict — one derivation, two homes",
    /sahm:sahmState/.test(dashSrc) && /mode:modeOf\("sahm"\)/.test(dashSrc)
    && !/SAHM_TRIGGER/.test(dashSrc));
  /* The RAW observation date, never asOfOf's display string — which carries no year, the exact
     misreading v7.1.5 closed one release ago (and a display string is the wrong integrity
     boundary for a circuit that forces the call, the v4.0.3 ruling). */
  ok("[96] the mirror reads the RAW date, not the display string",
    /as_of:dataAsOf\?\.sahm\|\|null/.test(dashSrc) && !/as_of:asOfOf\("sahm"\)/.test(dashSrc));
  ok("[96] the banner ladder branches on the override TYPE, so it cannot name the wrong circuit",
    /dailyCall\.override\.type==="SAHM"/.test(dashSrc)
    && /<SahmOverrideBanner call=\{dailyCall\}/.test(dashSrc));
  /* ⚠ MY OWN FIRST DRAFT OF THE BANNER COPY OVERCLAIMED, corrected before shipping rather than
     recorded after. It read "every past trigger coincided with a recession" — the no-false-
     positives converse, which is the contested half of the rule's reputation (2024 triggered
     without an NBER-dated recession) and a historical batting average the product cannot
     substantiate on the page. A safety banner that forces the published call bearish must state
     what the rule MEASURES, which is citable from src/sahm.js and cannot go out of date. The
     retired phrasing is pinned ABSENT, the v3.85 retired-claim rule. */
  const cbSrc = src("../src/sections/CallBanners.jsx");
  ok("[96] the banner states the rule's MECHANISM, never a historical batting average",
    /3-month average against its own 12-month low/.test(cbSrc)
    && !/every past trigger/.test(cbSrc) && !/no false positives/i.test(cbSrc));
}
