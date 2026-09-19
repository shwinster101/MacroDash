/* v7.1 — BEYOND THE VOTE. The non-voters' evidence block, and the one home for their bands.

   WHAT THESE PINS EXIST TO PREVENT.

   (1) A CONTEXT READING DRIFTING INTO THE VOTE. This block renders signals the backdrop
   deliberately does not read, in cards that look like the voter cards directly above them. The
   row-level "Not a voter — <why>" line is what stops that reading as a seventh seat, and it is
   sourced from the role registry so a role change moves the sentence with it. Swept across every
   row, in both groups, because one row missing it is the whole defect.

   (2) A VERDICT WORD ON THE PUBLIC PAGE (owner ruling: readings only). Engine 0 publishes
   TAILWIND/NEUTRAL/HEADWIND and this block renders four of its checks. The guarantee is
   STRUCTURAL rather than remembered: beyondRows reads the merged data directly and never calls
   buildTtReadout, so there is no verdict in scope to print. Pinned both ways — the vocabulary is
   absent from the rendered rows AND the module does not import the engine that produces it.

   (3) TWO COPIES OF A THRESHOLD. creditSpread's 5 and 3.5 were inline JSX literals with no name
   anywhere in the product; creditTail's mapping was inline while its constants sat in regime.js;
   spread10y3m had no band at all. v7.1 adds a SECOND surface rendering the same readings, which
   turns "two copies waiting to disagree" from latent into immediate. One home now, and
   MarketDetail READS it — pinned, with the retired inline expressions pinned absent.

   (4) A MOCK NUMBER IN AN EVIDENCE BLOCK. Every row follows the same LIVE/CACHED + dated rule
   the rest of the product uses, so a dark feed reads Unavailable here exactly as on the strip. */
import { beyondRows, overrideRows, technicalRows, contextRows } from "../src/beyondRows.js";
import * as CBands from "../src/contextBands.js";
import { CREDIT_TAIL_CALM, CREDIT_TAIL_STRESS } from "../src/regime.js";
import { roleOf } from "../src/signalRoles.js";
import { MOCK_DATA } from "../src/mockData.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const liveAll = () => "LIVE";
const datedAll = () => "2026-09-18";
const darkOne = (field) => (k) => (k === field ? "MOCK" : "LIVE");

export function testBeyondVote(ok) {
  const bvSrc = src("../src/sections/BeyondVote.jsx");
  const brSrc = src("../src/beyondRows.js");
  const ctxSrc = src("../src/contextBands.js");
  const mdSrc = src("../src/sections/MarketDetail.jsx");
  const base = { d: MOCK_DATA, modeOf: liveAll, asOfOf: datedAll,
    flip: { evaluable: true, armed: false, tripped: false, reason: null }, panic: false };

  /* ── THE BANDS, EXECUTED AT EVERY EDGE ───────────────────────────────────────────────────── */
  ok("[94] credit spread: the two edges are NAMED and exclusive, not inline literals",
    CBands.CREDIT_SPREAD_WIDE === 5 && CBands.CREDIT_SPREAD_WATCH === 3.5
    && CBands.bandCreditSpread(5.01).state === "WIDE" && CBands.bandCreditSpread(5).state === "WATCH"
    && CBands.bandCreditSpread(3.51).state === "WATCH" && CBands.bandCreditSpread(3.5).state === "ORDINARY");
  ok("[94] credit tail reads regime.js's constants — one home, boundaries executed through it",
    CBands.bandCreditTail(CREDIT_TAIL_STRESS + 0.01).state === "STRESSED"
    && CBands.bandCreditTail(CREDIT_TAIL_STRESS).state === "NEUTRAL"
    && CBands.bandCreditTail(CREDIT_TAIL_CALM).state === "NEUTRAL"
    && CBands.bandCreditTail(CREDIT_TAIL_CALM - 0.01).state === "CALM");
  ok("[94] both curve spreads invert at ZERO — a structural edge, not an asserted one",
    CBands.bandCurve10y3m(-0.01).state === "INVERTED" && CBands.bandCurve10y3m(0).state === "POSITIVE"
    && CBands.bandCurve10s30s(-0.01).state === "INVERTED" && CBands.bandCurve10s30s(0).state === "POSITIVE");
  ok("[94] a non-finite reading yields NO state and a muted tone — never a banded verdict",
    Object.values(CBands.CONTEXT_BANDS).every((f) =>
      [null, undefined, NaN, "x"].every((v) => f(v).state === null && f(v).toneKey === "textMuted")));
  /* Purity: colour is resolved by the section, never by the band — the C1 rule the regime
     engine already follows, so a pure module never learns a design token's value. */
  ok("[94] the bands return a toneKey, never a resolved colour (the C1 purity rule)",
    !/#[0-9a-f]{3,8}|rgb\(/i.test(strip(ctxSrc))
    && Object.values(CBands.CONTEXT_BANDS).every((f) => typeof f(1).toneKey === "string"));
  /* ONE HOME: MarketDetail reads the band functions, and the retired inline mappings are gone. */
  ok("[94] MarketDetail READS the shared bands — the inline literals are retired, not duplicated",
    /import \{[^}]*bandCreditSpread[^}]*\} from "\.\.\/contextBands\.js"/.test(mdSrc)
    && mdSrc.includes("bandCreditSpread(d.macro.credit.spread)") && mdSrc.includes("bandCreditTail(v)")
    && !/spread>5\?T\.red/.test(mdSrc) && !/CREDIT_TAIL_STRESS\s*\?/.test(mdSrc));

  /* ── EVERY ROW STATES THAT THE CALL DOES NOT READ IT ─────────────────────────────────────── */
  const rows = beyondRows(base);
  const allCards = [...rows.technicals, ...rows.context];
  ok(`[94] every technical and context row carries its own "does not vote" sentence (${allCards.length} rows)`,
    allCards.length >= 10 && allCards.every((r) => typeof r.why === "string" && r.why.length > 20));
  ok("[94] every row's role comes from the registry, and NONE of them is a voter",
    allCards.every((r) => ["technical", "context"].includes(r.role) && roleOf(r.field) === r.role)
    && !allCards.some((r) => r.role === "voter"));
  /* The four Engine 0 checks the backdrop does not vote on are NAMED as such — the useful half
     of the readout, carried by the registry rather than by calling the engine. */
  ok("[94] the four technicals name the Engine 0 check that reads them",
    rows.technicals.length === 4
    && rows.technicals.map((r) => r.engine0Check).sort().join(",")
       === "fed_next_meeting,qqq_spy_rs,spy_vs_200d,us30y_curve");

  /* ── NO VERDICT WORD, STRUCTURALLY ───────────────────────────────────────────────────────── */
  ok("[94] beyondRows does NOT import the order-gating engine — there is no verdict in scope",
    /* Comment-stripped: both files EXPLAIN that they never call the engine, so a raw sweep
       finds the explanation instead of an import — the v3.60.1 self-matching trap, which this
       session has now hit three times in three different files. */
    !/ttReadout/.test(strip(brSrc)) && !/buildTtReadout/.test(strip(brSrc))
    && !/buildTtReadout/.test(strip(bvSrc)));
  ok("[94] no Engine 0 verdict vocabulary reaches the rendered rows or the section",
    (() => {
      const text = JSON.stringify(rows) + strip(bvSrc);
      return !/TAILWIND|HEADWIND/.test(text)
        // the direction words the backdrop uses for its own verdict must not appear either
        && !/RISK-ON|RISK-OFF|MOONING|DIAMOND HANDS/.test(text);
    })());

  /* ── THE OVERRIDES ───────────────────────────────────────────────────────────────────────── */
  ok("[94] the overrides are on the FACE — outside every fold (v3.25: a collapse never hides a red fact)",
    (() => {
      const cut = bvSrc.indexOf("beyond-overrides");
      const firstFold = bvSrc.indexOf("<CollapsedGroup");
      return cut > 0 && firstFold > cut;
    })());
  ok("[94] a readable PANIC circuit reports CLEAR with the distance to BOTH edges stated",
    (() => { const p = overrideRows(base).find((r) => r.key === "panic");
      return p.state === "CLEAR" && p.readable === true && /of 25/.test(p.detail) && /of 20/.test(p.detail); })());
  ok("[94] a fired PANIC reads FIRED, in red — never softened",
    overrideRows({ ...base, panic: true }).find((r) => r.key === "panic").state === "FIRED");
  /* THE ASYMMETRY. A blind circuit is NOT a clear one — absence of confirmation is not
     confirmation of absence (v3.40). Pinned separately for each override. */
  ok("[94] ⚠ a dark gauge makes PANIC read CANNOT SEE, never CLEAR",
    (() => { const p = overrideRows({ ...base, modeOf: darkOne("fearGreed") }).find((r) => r.key === "panic");
      return p.state === "CANNOT SEE" && p.readable === false && p.toneKey === "amber"; })());
  ok("[94] ⚠ an unevaluable Macro Flip reads BLIND with its reason, never CLEAR",
    (() => { const f = overrideRows({ ...base, flip: { evaluable: false, reason: "missing VIX" } })
        .find((r) => r.key === "macroFlip");
      return f.state === "BLIND" && f.toneKey === "amber" && /missing VIX/.test(f.detail); })());
  ok("[94] an armed and a tripped flip are DIFFERENT states, each with its own tone",
    (() => {
      const armed = overrideRows({ ...base, flip: { evaluable: true, armed: true, tripped: false } }).find((r) => r.key === "macroFlip");
      const trip = overrideRows({ ...base, flip: { evaluable: true, armed: true, tripped: true } }).find((r) => r.key === "macroFlip");
      return armed.state === "ARMED" && trip.state === "TRIPPED" && armed.toneKey !== trip.toneKey; })());

  /* ── A DARK FEED IS UNAVAILABLE, NEVER A MOCK NUMBER ─────────────────────────────────────── */
  ok("[94] a dark feed reads Unavailable with the cause — the same rule the rest of the page uses",
    (() => { const r = contextRows({ ...base, modeOf: darkOne("creditSpread") }).find((x) => x.key === "creditSpread");
      return r.available === false && r.reading === null && r.state === null
        && r.unavailable === "no live feed right now"; })());
  ok("[94] an undated reading is unavailable too — LIVE with no date is unjudgeable",
    (() => { const r = contextRows({ ...base, asOfOf: (k) => (k === "creditTail" ? null : "2026-09-18") })
        .find((x) => x.key === "creditTail");
      return r.available === false && r.unavailable === "no dated reading"; })());

  /* ── THE MORTGAGE SPREAD — the owner's question, rendered as the answer ──────────────────── */
  ok("[94] the mortgage row states the SPREAD over the 10-year — the part the 10-year cannot see",
    (() => { const r = contextRows(base).find((x) => x.key === "mortgage");
      return r.available && /over the 10-year/.test(r.sub) && roleOf("mortgage30") === "context"; })());
  ok("[94] a dark 10-year withholds the spread rather than computing across a dead leg (the pairRs rule)",
    (() => { const r = contextRows({ ...base, modeOf: darkOne("tenYear") }).find((x) => x.key === "mortgage");
      return r.sub === "spread needs both legs current"; })());

  /* ── PROPERTY 9 AND THE BOUNDARY ─────────────────────────────────────────────────────────── */
  ok("[94] absent evidence renders no invented rows, and nothing throws",
    beyondRows(null).overrides.length === 0 && beyondRows({}).technicals.length === 0
    && beyondRows({ d: {} }).context.length > 0
    && beyondRows({ d: {} }).context.every((r) => r.available === false));
  ok("[94] the section is presentation-only — no computation, storage or fetch import",
    !/useState|useEffect|localStorage|fetch\(|useMarketData|computeRegime|buildEvidenceSet|evalAlert/.test(strip(bvSrc))
    && /from "\.\.\/beyondRows\.js"/.test(bvSrc));
  /* The class name is load-bearing: the Drivers matrix pins a count of exactly six
     `.driver-card`s at four widths, and two mode-parity loops walk them by index. */
  ok("[94] the block uses its OWN card class — reusing .driver-card would break three suites' arithmetic",
    /className="beyond-card"/.test(bvSrc) && !/className="driver-card"/.test(bvSrc));
}
