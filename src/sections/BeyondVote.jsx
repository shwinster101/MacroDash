/* BEYOND THE VOTE (v7.1) — Degen's evidence view for every factor that is NOT a voter.
   Presentation only: beyondRows.js shapes the rows, contextBands.js owns every threshold, and
   signalRoles.js owns every "why it does not vote" sentence. Nothing is computed here.

   THE PROBLEM IT CLOSES. v6.9.9.5 organised the SIX voters into one primary evidence view and
   nothing ever organised the rest. Credit, the junk tail, both curve spreads, financial
   leverage, labour, the price technicals and the rate path reached Degen only as leftover tiles
   from the pre-v6 era, with no stated role — so a reader could not tell a context tile from a
   voter from an input to a safety circuit, and the page never said which readings the call is
   actually built from. Owner, 2026-09-19: the seat count is fixed at six, and everything else is
   real and must be INTEGRATED — as something other than a vote.

   THE THREE ALTITUDES, and the split is the whole design:
     OVERRIDES stay on the FACE. They can move the published call regardless of the vote, which
       makes them red facts, and a collapse may hide an explanation but never a red fact (v3.25).
     TECHNICALS and CONTEXT take a named tap each. Each fold is under the 320-word disclosure
       budget (v6.9.2), and the labels say what is inside so opening one is a choice.

   ⚠ NO VERDICT WORD, and it is structural rather than remembered (owner ruling). Engine 0
   publishes TAILWIND/NEUTRAL/HEADWIND and this block renders four of its checks — but it reads
   the merged data directly and never calls buildTtReadout, so there is no verdict in scope to
   print. One screen, one verdict: the hero's. What the readout contributes is the check NAME,
   carried by the role registry.

   THIS SITS BESIDE MarketDetail/MacroRegime, and does not duplicate them (the v3.43 Yahoo-dupe
   test, applied deliberately rather than by accident): this block carries ROLE, STATE and the
   does-not-vote fact; those sections keep the full tile grids with their charts and series. If a
   reading appears in both, this one shows it with its role and the old tile shows it with its
   chart. Merging the two is a release, not a slice, and is named as deferred. */
import { T } from "../design-tokens.js";
import { beyondRows } from "../beyondRows.js";
import CollapsedGroup from "../primitives/CollapsedGroup.jsx";
import { DataModeBadge } from "../primitives/SourceBox.jsx";

const Card = ({ r }) => (
  /* `beyond-card`, NOT `driver-card`. The Drivers matrix pins a count of exactly six voter
     cards at four widths, and the v7.0.1/v7.0.3 mode-parity loops walk `.driver-card` by index
     — so reusing the class would silently break three suites' arithmetic while looking tidy. */
  <div className="beyond-card" style={{ background: T.surface, border: `1px solid ${T.border}`,
    borderLeft: `3px solid ${T[r.toneKey] || T.border}`, borderRadius: 4, padding: "8px 10px", marginBottom: 5 }}>
    <div className="beyond-columns">
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: T.fsS, color: T.textMuted, letterSpacing: "0.06em" }}>{r.label}</div>
        <div className="beyond-reading" style={{ fontFamily: T.fontMono, fontSize: T.fsL, color: T.textPrimary, overflowWrap: "anywhere" }}>
          {r.available ? r.reading : "Unavailable"}
          {r.available && r.state ? <span style={{ color: T[r.toneKey] || T.textMuted, marginLeft: 6, fontSize: T.fsS }}>{r.state}</span> : null}
        </div>
        {r.sub && <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted }}>{r.sub}</div>}
      </div>
      <div style={{ minWidth: 0 }}>
        <DataModeBadge mode={r.mode} />
        <div className="beyond-date" style={{ fontFamily: T.fontMono, fontSize: T.fsM, color: T.textMuted }}>
          {r.asOf ? `as of ${String(r.asOf).slice(0, 10)}` : "No dated reading"}
        </div>
        {!r.available && <div style={{ fontFamily: T.fontMono, fontSize: T.fsM, color: T.amber }}>{r.unavailable}</div>}
      </div>
    </div>
    {/* THE FACT THAT MAKES THIS BLOCK HONEST, on every row. The strip's context tiles have had
        to state it in their sheets since v6.3 ("the six-factor vote does not read this"); here
        it is the row's own line, because a card that looks like a voter card must say it is not
        one. Sourced from the role registry, so a role change moves the sentence with it. */}
    {r.why && <div className="beyond-why" style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textSecondary, marginTop: 3 }}>
      Not a voter{r.engine0Check ? " · the order-gating engine reads it" : ""} — {r.why}
    </div>}
  </div>
);

const OverrideRow = ({ r }) => (
  <div className="beyond-override" style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap",
    padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
    <span style={{ fontFamily: T.fontMono, fontSize: T.fsM, color: T.textMuted, minWidth: 120 }}>{r.label}</span>
    <span style={{ fontFamily: T.fontMono, fontSize: T.fsL, fontWeight: 700, color: T[r.toneKey] || T.textMuted }}>{r.state}</span>
    <span style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted, minWidth: 0 }}>{r.detail}</span>
    {r.distance && <span style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted }}>· {r.distance}</span>}
  </div>
);

export default function BeyondVote({ d, modeOf, asOfOf, flip, panic }) {
  if (!d || typeof modeOf !== "function") return <div aria-hidden="true" />;
  const rows = beyondRows({ d, modeOf, asOfOf, flip, panic });
  const counted = (list) => list.filter((r) => r.available).length;
  return (
    <div className="beyond-vote">
      <div style={{ fontFamily: T.fontMono, fontSize: T.fsM, color: T.textSecondary, marginBottom: 6 }}>
        <strong style={{ fontSize: T.fsBody, color: T.textPrimary }}>Beyond the vote</strong> · six signals decide the call;
        these are real and do not. Safety overrides can move it anyway.
      </div>
      {/* OVERRIDES — on the face, never behind a fold (v3.25). */}
      <div className="beyond-overrides" style={{ marginBottom: 8 }}>
        {rows.overrides.map((r) => <OverrideRow key={r.key} r={r} />)}
      </div>
      <CollapsedGroup chip={false} count={counted(rows.technicals)}
        label="technicals — what the order-gating engine reads and the call does not">
        <div style={{ marginTop: 4 }}>{rows.technicals.map((r) => <Card key={r.key} r={r} />)}</div>
      </CollapsedGroup>
      <CollapsedGroup chip={false} count={counted(rows.context)}
        label="context — credit, the curve, leverage and the household">
        <div style={{ marginTop: 4 }}>{rows.context.map((r) => <Card key={r.key} r={r} />)}</div>
      </CollapsedGroup>
    </div>
  );
}
