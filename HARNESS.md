# HARNESS.md — the model-per-phase build framework

> **Canonical project brief: [`CLAUDE.md`](./CLAUDE.md).** When this file and CLAUDE.md
> disagree, **CLAUDE.md wins.** This file describes *how a change gets made*; CLAUDE.md
> describes *what the thing is*.
>
> Like [`AGENTS.md`](./AGENTS.md), this file is deliberately free of **volatile facts** —
> no version numbers, no assertion counts, no feature lists. Those live in exactly one
> home each (`package.json`, the suite's own printed total, CLAUDE.md). Smoke pins that
> shape, because a doc rule nothing enforces is a rot vector.

A pass through this harness is: **one ticket, one phase at a time, each phase run by the
model that phase actually needs.** The phases are prompts, not vibes — copy them verbatim.

---

## §0. The two rules that make the rest work

**Rule 1 — the auditor is never the builder.** The reviewing model must be a *different
family* than the building model, or a *strictly higher tier*. **Never the same model.**
Every silent-drift defect this repo has ever shipped passed a same-author review; a
same-model review inherits the blind spot at a discount you cannot measure.

**Rule 2 — build-tier is inverse to test-net strength.** A cheap builder is safe only
where a gate catches it. This repo has a strong gate (four suites + CI), so the build
phase runs mid-tier on purpose. If you ever work a surface the suites do not cover, raise
the build tier for that pass and say so in the ticket.

### Rotation table

| If the builder (H2) is… | …then H3 test design may be | …and H5 audit may be |
|---|---|---|
| Claude Sonnet 5 | Claude Opus 5 · GPT-5.6 Sol | GPT-5.6 Sol · Grok 4.5 Heavy |
| GPT-5.6 Luna | Claude Opus 5 · GPT-5.6 Sol | Claude Opus 5 · Grok 4.5 Heavy |
| Gemini 3.6 Flash | any heavyweight | any heavyweight |
| Claude Opus 5 | GPT-5.6 Sol | GPT-5.6 Sol · Grok 4.5 Heavy |

H3 and H5 should also differ from **each other** where budget allows: they are the two
skeptical passes, and sharing a family halves their coverage.

---

## §P. The shared preamble  ⟵ *every phase prompt inherits this by reference*

Each phase prompt below opens with the literal line `Apply HARNESS.md §P.` **Do not paste
§P into the individual prompts.** One home for the invariants, referenced from many
altitudes — the same rule the codebase applies to thresholds and to `ptModelRows`. When
an invariant changes, it changes here, once.

> **§P — MacroDash standing constraints.**
>
> 1. **Read `CLAUDE.md` first.** It is canonical. Every ticket tag convention
>    (`FEAT-*`, `DEC-*`, `AS2-*`), locked decision and honesty invariant lives there.
> 2. **The honesty invariant is the product.** No number may read as live unless it is;
>    no directional verdict may render on mock or stale data; *absent* must never render
>    as `0`, as "flat", or as a clear. "I cannot see this" and "this did not happen" are
>    different facts and must render differently.
> 3. **Fail closed.** A missing date, an unreadable feed, an absent measurement → the
>    restrictive state, named. Never a defaulted green and never a silent skip.
> 4. **One computation, many altitudes.** Never write a second copy of a threshold, band,
>    rate or formula. If two surfaces need the same number, they call the same function.
>    A new constant that duplicates an existing one is a defect, not a convenience.
> 5. **A cut takes its attribution with it.** Deleting data means deleting every label,
>    footer, header and tooltip that described it, in the same change.
> 6. **Mock-first graceful degradation.** The dashboard never breaks on bad data. Live
>    values overlay only the paths `src/sources.js` declares.
> 7. **Private content never enters this repository.** No real book, position, thesis,
>    framework or ranking content — those live only in KV. Fixtures are synthetic.
> 8. **Order-gating surfaces are frozen unless the ticket says otherwise.**
>    `/readout.json` (`tt-v1`) and the regime band table gate real decisions; changing a
>    voter, a band or the aggregate math is its own ticket with its own approval.
> 9. **Say what you did not do.** Anything skipped, deferred, truncated or assumed is
>    stated explicitly. Silent truncation reads as full coverage.
> 10. **End every pass with, in this order:** *Completed* (max 2 bullets) · *Highest-leverage
>     question for the maintainer* (1 bullet) · *Highest-leverage next move* (1 bullet).

---

## §1. H1 — PLAN

**MODEL: GPT-5.6 Sol** · alternate: Claude Opus 5
*Why:* dependency graphs and threat modelling across a system whose failure mode is a
second-order interaction between surfaces. A miss here is not caught by any gate.

```
Apply HARNESS.md §P.

You are planning ONE ticket. Do not write code.

TICKET: <one sentence — the change, not the implementation>

Produce, in this order:

1. DEFECT CLASS. Which of these is this ticket? (a) a wrong number, (b) a label
   outliving its data, (c) a second copy of a threshold, (d) a claim made on absent
   evidence, (e) new capability. If it is (e), say what the FIRST FOUR would look like
   in the new surface — new capability is where they get introduced.

2. BLAST RADIUS. Every file, and every RENDERED SURFACE, that reads the value(s) this
   ticket touches. Name each surface explicitly; "and the UI" is not an answer.

3. DUPLICATION CHECK. Does this introduce any number, band, rate or string that already
   exists elsewhere in the repo? If yes, name the existing home and route through it
   instead. Show the grep you ran.

4. INVARIANT IMPACT. Which of §P.2–§P.8 does this touch? For each: what specifically
   keeps it true after the change?

5. THE ABSTENTION. What does this feature do when its input is missing, stale, mock,
   zero, negative or non-finite? Each case gets a rendered state, and "not measured"
   must be distinguishable from "measured as zero".

6. BAND PROVENANCE (only if the ticket adds a threshold). Is each boundary CALIBRATED
   against observed data, or ASSERTED? Say which, in the ticket and in the source
   comment. An asserted band may not gate an order-gating surface.

7. TEST PLAN — as claims, not files. Each claim in the form: "if <source change>, then
   <named assertion> fails." Any claim you cannot phrase that way is untestable; say so
   rather than inventing an assertion for it.

8. DELIBERATELY DEFERRED. What is adjacent, tempting, and out of scope — with the reason.

STOP. Do not proceed to implementation. Output the plan and wait for approval.
```

---

## §2. H2 — BUILD

**MODEL: Claude Sonnet 5** · alternate: GPT-5.6 Luna
*Why:* sustained adherence to contract boundaries across a long single-file edit. Safe at
mid-tier because the four suites and CI catch a miss (§0 Rule 2).

```
Apply HARNESS.md §P.

Implement the APPROVED PLAN for <ticket>, and nothing else.

BEFORE WRITING: show me the diff you intend to make. Wait for go-ahead.

CONSTRAINTS
- Scope is the plan's file list. A file not in the plan is scope expansion — stop and
  say so instead of editing it.
- Tag every new block with the ticket ID in a comment, in the style already used in the
  file you are editing.
- No new constant that duplicates an existing one (plan §3 already checked this — if you
  find one the plan missed, STOP and report it rather than adding it).
- Every new rendered value carries its provenance and its absent-state, per plan §5.
- If the plan turns out to be wrong mid-build, STOP and say why. Do not silently
  redesign — a plan that survives contact only because the builder quietly fixed it is a
  plan nobody reviewed.

AFTER WRITING
- Run: npm test && npm run test:ui && npm run test:public
- Paste the real output. If anything is red, fix it or report it — never describe a
  suite as passing without its output.
- State every plan item you did NOT implement, and why.
```

### H2b — mechanical sub-tasks

**MODEL: Gemini 3.6 Flash** · alternate: GPT-5.6 Luna
*Use for:* fixture regeneration, mass renames, doc pins, moving a constant to its shared
home once H1 has decided where that is. **Not for** anything that decides a threshold,
a band, an abstention or a rendered claim.

```
Apply HARNESS.md §P.

MECHANICAL TASK — no design decisions. If this task requires ANY judgement call about a
threshold, an abstention, a rendered label or which surface owns a value, STOP and
escalate rather than choosing.

<task>

Report: files touched, count of replacements, and the full output of `npm test`.
```

---

## §3. H3 — TEST DESIGN

**MODEL: Claude Opus 5** · alternate: GPT-5.6 Sol *(must differ from H2 — §0 Rule 1)*
*Why:* this is where the repo's worst defects are born. A test that passes for the wrong
reason is worse than no test, because it renders as coverage.

```
Apply HARNESS.md §P.

You are writing the assertions for <ticket>. You did NOT write the implementation and you
are not here to be reassured by it.

THE NEGATIVE-CONTROL RULE — this is the whole job:
  For EVERY assertion you write, state the exact source edit that would make it FAIL.
  Then actually make that edit, run the suite, and confirm it goes red.
  An assertion whose failing edit you cannot name is VACUOUS — delete it.
  Revert the edits afterward and confirm green.

Vacuous-assert patterns this repo has actually shipped — check for each:
  - An assert that matches text inside its own explanatory comment.
  - An assert that pins a VERB or a name when the claim is about SAFETY or BEHAVIOR
    (e.g. "no PUT handler exists" passing while the GET route wrote).
  - A pure function imported into the suite and never called.
  - A fixture stamped with a literal date that silently rots at the next midnight.
  - A reconciliation that passes because both sides were derived from the same constant.

PREFER BEHAVIOR OVER SOURCE TEXT. If the logic is importable, import and RUN it. Pin
source strings only for code that genuinely cannot be imported, and say which it is.

COVER, at minimum: every boundary value exactly ON the edge (both sides); the absent /
stale / mock / zero / negative / non-finite input for each new field; and the honest
empty state.

Output the assertions plus, for each, its named failing edit and the red/green evidence.
```

---

## §4. H4 — FIX LOOP

**MODEL: Grok 4.5 Heavy** · alternate: Gemini 3.6 Flash for one-line fixes
*Why:* convergent work against a known failure. Note this is the *deliberate-reasoning*
variant — if you want speed here instead, drop to a fast model; do not pay Heavy's
latency for a one-liner.

```
Apply HARNESS.md §P.

A suite is red. Do not propose a fix until you have REPRODUCED the failure and can state
the mechanism in one sentence.

1. REPRODUCE. Paste the actual failing output.
2. MECHANISM. One sentence: what is true at the moment of failure that the code assumed
   was not.
3. ROOT vs SURFACE. Is the defect in the value, or in the rendering of the value? Fix the
   root. If two surfaces disagree, the fix is almost always to give them ONE source
   (§P.4), not to correct the wrong one.
4. FIX. Minimal. If the fix requires touching a file outside the ticket, STOP and report.
5. VERIFY. Full suite output pasted. Then state: what ELSE reads the thing you changed,
   and did you check it?

Do not fix a second, unrelated thing you noticed. Report it as a finding instead.
```

---

## §5. H5 — AUDIT

**MODEL: GPT-5.6 Sol** · alternate: Grok 4.5 Heavy *(must differ from H2 and, budget
permitting, from H3 — §0 Rule 1)*
*Why:* maximum skepticism with no edit bias. Run on the finished ticket, before release.

```
Apply HARNESS.md §P.

You are auditing <ticket>'s diff. You did not write it. Do NOT edit any file — findings
only. Do not soften a finding because the change is nearly done.

Hunt these five classes specifically. They are the ones this repo actually ships:

  A. LABEL OUTLIVING ITS DATA. Any header, footer, tooltip, comment, count or attribution
     that describes something this change deleted, renamed or stopped fetching.
  B. SECOND COPY OF A THRESHOLD. Any number, band, formula or rate now expressed in two
     places. Grep for the literal value across the whole repo, not just the diff.
  C. VACUOUS ASSERT. Pick the three most load-bearing new assertions and break the source
     under each. If one stays green, it is not a test.
  D. CLAIM ON ABSENT EVIDENCE. Any surface that renders a state it did not verify — a
     clear it never checked, a freshness it inherited, a "0" that means "unmeasured", a
     count that omits what it could not see.
  E. THE UNGATED DERIVATIVE. Any value computed from a parent whose staleness, provenance
     or absence the derivative does not inherit.

For each finding: file:line · what is claimed · what is true · the concrete failure
scenario (inputs → wrong output a person could act on) · severity.

Then answer explicitly, even if the answer is "none":
  - Which rendered claim in this diff is the one most likely to be believed and wrong?
  - What did this change make WORSE that was previously fine?
  - If you found nothing in a class, say "class B: none found, grepped <value>" — an
     unmentioned class reads as checked when it may not have been.
```

---

## §6. H6 — UI STRUCTURE

**MODEL: Claude Sonnet 5** · alternate: Gemini 3.6 Flash for pure layout
*Why:* responsive structure and state visibility across two very different surfaces.

```
Apply HARNESS.md §P.

Restructure <surface> per the approved plan. Layout and hierarchy only — no logic
changes, no new data, no relabelling of the product voice (see H7).

HARD RULES
- A collapse is only honest if every RED fact stays visible while closed. A summary that
  hides a breach, an exclusion, an outage or a blocker is a lie by omission.
- Measure, do not assert: report the real pixel height of what you changed at the narrow
  phone width AND the desktop width, before and after.
- The page body must never scroll horizontally at the narrowest supported width. Wide
  content scrolls inside its own container.
- Contrast is COMPUTED, never claimed. Any text you restyle: report the measured ratio
  against its actual background. A token comment asserting compliance it does not have
  is the same defect class as a label outliving its data.
- Interactive things are real controls (focusable, keyboard-activatable). A control that
  does nothing must not look like a control.
- Absent data renders as an honest empty state, distinguishable from "not loaded yet".

Finish with the browser suites' real output, plus the before/after measurements.
```

---

## §7. H7 — NEWCOMER READ  ⟵ *the single Fable 5 slot*

**MODEL: Fable 5** · no alternate — spend the slot here
*Why:* the remaining open thread on this product is legibility, which is a *reading*
problem, not a reasoning-depth problem. It wants a model that has not been marinating in
the architecture.

```
Apply HARNESS.md §P — with one exception: you are NOT here to check invariants.

Read the page as a first-time reader who understands markets but has never seen this
tool and will not read documentation. Do not read the source. Do not open the repo.

Answer, in this order:
1. After ten seconds, what do you think this page is telling you to do?
2. What did you have to RECONSTRUCT — a conclusion the page made you assemble from parts
   instead of stating?
3. Where did two things on one screen appear to disagree?
4. Which single sentence carries the most weight, and is it the largest thing on screen?
   If not, what is?
5. What did you read as a system failure that is actually working as designed?

OUT OF SCOPE — do not propose these, they are settled owner calls:
  - Renaming or softening the product voice. The informal register is deliberate.
  - Replacing the freshness vocabulary.
  - Collapsing or shortening the reasoning section.
  - Changing which route is the default.

Findings only. No code, no mockups. Rank by how much a reader loses to each.
```

---

## §8. H8 — RELEASE

**MODEL: Claude Sonnet 5** · alternate: GPT-5.6 Luna
*Why:* house-style prose against a strict template, plus a mechanical doc-rot sweep.

```
Apply HARNESS.md §P.

Close out <ticket>.

1. Bump `version` in package.json — the single source of truth. The public bundle reads it
   through Vite, but the **buildless `/admin.html` cannot import and mirrors it** in its
   `<title>` and brand line: sweep both in the same commit. Smoke pins that they match, so a
   half-bump fails the gate. (This step read "nothing else restates it" until the first
   ticket run through this harness hit that gate — the prompt was wrong, not the repo.)
2. Write the CLAUDE.md changelog entry in the existing house style: what the defect WAS,
   why it survived, what the fix is, what was deliberately NOT changed, and the honest
   limits. Match the surrounding entries' voice. Do not add a summary line anywhere that
   would need hand-bumping on the next release — that is the rot vector this file's
   header exists to prevent.
3. DOC-ROT SWEEP. Grep the repo for anything that describes what this ticket changed:
   README, AGENTS.md, HARNESS.md, source comments, rendered footers, tooltips, test
   comments. A cut takes its attribution with it (§P.5).
4. Confirm all four gates green with real output: npm test · test:ui · test:public ·
   audit:prod.
5. Commit with a message naming the ticket. Push to the working branch.
```

---

## §E. Enhancement slot — adding a phase

New phases go here, not inside an existing one. A phase is admissible only if it
declares all five:

| Field | Requirement |
|---|---|
| **MODEL** | Named, with an alternate, and a one-line *why this tier* |
| **ROTATION** | Which phases it must differ from, per §0 Rule 1 |
| **GATE** | What catches it if it is wrong. "Nothing" is a valid answer — it just forces a higher tier per §0 Rule 2 |
| **OUTPUT CONTRACT** | What the next phase receives, exactly |
| **STOP CONDITION** | What makes this phase halt and escalate rather than improvise |

Two standing rules for enhancements:

- **Do not copy §P into the new prompt.** Open with `Apply HARNESS.md §P.` and add only
  what is genuinely phase-specific. Eight copies of an invariant rot exactly the way
  eight copies of a threshold do.
- **If the enhancement adds an invariant that applies to every phase, it belongs in §P**,
  not in the new prompt.

---

## §9. Running a pass

```
H1 Plan  ──►  [approve]  ──►  H2 Build  ──►  H3 Test design  ──►  H4 Fix (loop until green)
                                                     │
                                                     ▼
                                   H5 Audit  ──►  [H6 / H7 if the ticket is UI]  ──►  H8 Release
```

- **Approval gates** are at H1→H2 and before H8. Everything between runs without asking.
- **H3 may send work back to H2**; H4 loops until green. Neither is a failure state.
- **H5 findings** re-enter at H2 as new tickets, not as edits to the ticket under audit —
  single-purpose tickets debug faster than bundled ones.
- **A phase that wants to edit outside its scope stops and reports.** That is the
  designed behavior, not an obstruction.
