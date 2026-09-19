# v7.0.4 packet repair, integration, and deployment

Owner supplied v704-drop.zip after the remote dashboard was replaced with PLACEHOLDER.
Inspected all archive names before extracting to a task-specific temporary directory.

## Repair and integration

- Repaired working/v7.0.4-spotlight-lock from 4208791 using the supplied dashboard and
  StockSpotlight files. Commit 181bd73 pushed to that branch before release merge.
- Original packet's 10 helper/copy pins passed. Its npm test run was 2710 pass / 1 fail:
  an existing source guard expected the old exact Spotlight prop list. Updated that guard
  to require the new headline/frozen wiring; did not relax its no-fetch/no-computation rules.
- Packet dashboard is based on 7.0.1. Three-way integration preserves 7.0.2 hero parity
  and 7.0.3 F&G caption/band reconciliation; no whole-file rollback on the release branch.
- Added canonical Bearish headline DIAMOND HANDS to the helper (packet only recognized
  legacy Bearish/RISK-OFF), and require published frozen call state so live drift cannot lock.
- Corrected packet's nested region/padding: one named Spotlight region; expanded Simple
  body uses existing outer inset so 320px does not squeeze the 260px minimum profile grid.
- All original helper tests retained, plus canonical headline coverage; connected to smoke.
- Browser pins cover frozen Hold/Bearish/Bullish, unfrozen and unpublished calls, both modes
  at 320/390px, default fold, keyboard access, row order, YTD emphasis, focus restoration,
  reader's saved fold choice, immutable lock through live drift, and no overflow/errors.

No provider, rotation, thresholds, saved-call calculation, or original dirty checkout edits.
- Full browser regression found an older frozen-Hold test expecting Learning moment on
  the initial face. It now opens the new outer fold before checking the unchanged inner
  lesson contract. New tests separately require the outer fold to start closed.
## Verification

Final browser-required npm run gates passed: 2754 smoke checks plus 11 standalone lock
pins, 353 admin-browser, 861 public-browser; production audit zero vulnerabilities.
All 102 new browser assertions passed independently and in the full suite. Expanded
320px screenshot inspected: /tmp/macrodash-704-open-320.png. Original layout budgets
and earlier release tests remain enforced. Final git diff --check passed.
Release commit and production verification follow the push.

## Production-contract correction (before completion)

Initial merge eb604ae deployed, but live verification found a real frozen HODL record with
published:true and status:OK. The 7.0.2 hero had wrongly tested status:PUBLISHED, and the
first 7.0.4 integration reused that error. Earlier reports that no frozen capture existed
were wrong: the UI had rejected a valid record. The initial synthetic tests repeated the
same mistaken status and therefore passed. This was a publication-contract bug, not a
data outage or a missing 10am capture.

Corrected both UI consumers through one isFrozenPublishedCall predicate using the actual
md-call-v1 published boolean, frozen flag and valid direction. No publisher/model change.
Hero tests now construct records with callFromEvidence and cover OK, PARTIAL DATA and PANIC;
browser frozen-action/Spotlight fixtures also use the real builder instead of invented
publication statuses. A PUBLISHED string without the boolean is explicitly rejected.
The exact live production call was replayed through the corrected local build as a separate
check, so UI activation is verified against an actual saved record, not just fixtures.
Corrected full gates and redeployment outcomes follow below.

Corrected browser-required npm run gates passed 2758 smoke + 11 lock pins, 353 admin,
861 public checks; audit zero vulnerabilities. Real production-record replay passed:
frozen:true, published:true, status:OK, headline:HODL yields “Do not add risk.” and a
closed lesson fold, with no page errors. The previous claim of a missing capture is retracted.
