# Learning release integration after main v6.5.5

## Baseline and resolution

Main advanced from `204eda53` to `9bcb44d` via #41 (FOMC decision-day
assertions) and #40 (dashboard decomposition). PR #39 was still on its isolated
`codex/spotlight-learning` branch with no uncommitted changes.

Renumbered the learning release to v6.5.6 before merging main: package.json,
both lockfile homes, both terminal strings, and the newest CLAUDE heading.
The old draft v6.5.5 label is explicitly historical; main's v6.5.5 release note
and decomposition remain intact. Renumber commit: `2914f44`.

Resolved the four reported content conflicts and the version-file conflicts
made explicit by renumbering: keep main's refactored dashboard imports with
publicDashboardUrl added (do not restore the removed spyMoveDirection import),
retain both smoke blocks, preserve both release notes in version order, and use
main's FOMC wording assertion. The same decision-day numeric assertion was
already identical and merged automatically.

DriversMatrix remains byte-identical to main and imports voteStyle. This branch's
regime.js changes are explainer metadata/prose only; voteStyle and all voting
thresholds are unchanged. stripExplain changes only teaching copy.

Added smoke checks tying the newest CLAUDE heading and both lockfile homes to
package.json. These checks detect metadata drift, not same-version reuse against
main. The version collision was addressed explicitly by taking 6.5.6.

## Boundaries

No Pages deployment configuration or branch protection changed. The existing
workflow runs CI alongside the automatic Pages build; release gating needs a
separate deployment-workflow change, not a claim that this new metadata pin
blocks production. No deployment or merge of PR #39 is part of this pass.

The duplicate FOMC discovery is recorded in both working notes; main's fix is
now authoritative. The branch has a shared, committed integration record.

## Outcomes

Final Node 22 / Chrome `REQUIRE_BROWSER=1 npm run gates`: **2,369 smoke +
309 terminal + 342 public checks**, all passing; production audit zero
vulnerabilities. Build succeeds with the pre-existing bundle-size warning.
Main rechecked at `9bcb44d` after validation; no further drift. No unmerged paths
remain. Both learning and decomposition guards pass together, including the new
version metadata pins and the company-card keyboard/mobile checks.

Validated integration commit: `beb6420`; version relabel commit: `2914f44`.
