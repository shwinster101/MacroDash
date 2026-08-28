# 2026-08-28 — Sprint survey: the clock, and the Five Whys altitude

**Status: SURVEY — no code changed by this pass.** Matrix + proposals only, per the sprint
brief ("clock + Whys altitude"). When implementation lands, append an Outcomes section per
the per-pass protocol; corrections to this survey go there, never edited in silently.

Scope rules carried from the brief: propose copy only; do NOT change when the freeze
happens; the five paragraphs stay inside the expander.

---

## A. Every public-Simple string naming the call or its time

Mechanics established first, because two of them drive every row:

- **The header stamp is a MIXED clock.** `d.session` is recomputed per request from wall
  time (v3.8: "session is recomputed on cached reads"), while `d.lastRefresh` is the
  instant the day's snapshot was BUILT and is deliberately never recomputed
  (`snapshot.js:188`). So `OPEN · 08/28/2026 02:40 ET` is one live word and one frozen
  timestamp on one line, with nothing labelling which is which.
- **`callFrozen` is a per-request server fact** (`frozenPublicCall`, `snapshot.js:146-154`,
  spread onto the cached-read return at :200) — the day's cached snapshot does NOT trap the
  pre-10am state; a post-capture visit gets `publicCallFrozen: true` whenever the history
  record exists and validates. `dailyCall = callFrozen ? publicCall : currentCall`
  (`dashboard.jsx:554-555`).

| # | File | Exact string | Frozen vs live posture | Would a phone reader think this is the 10am official call? |
|---|---|---|---|---|
| A1 | `dashboard.jsx:823` (header stamp) | `{d.session} · {d.lastRefresh}` → "OPEN · 08/28/2026 02:40 ET" | MIXED — session live, timestamp = snapshot build time | **Yes, as a call-time claim.** At 11:04 the face reads "OPEN · 02:40 ET": a reader parses 02:40 as "when this call was made" (it is when the DATA was pulled) or as a broken clock. The "· end-of-day, not real-time" suffix modifies the data, but nothing binds 02:40 to the data rather than the call |
| A2 | `dashboard.jsx:841` (header suffix) | `· end-of-day, not real-time` | neutral (describes the data) | No — but it is the only label near A1's timestamp, and it does not name WHICH element is end-of-day |
| A3 | `RegimeBand.jsx:108` (eyebrow, frozen) | `Macro Backdrop · 10am frozen call` | frozen only | — (this is the honest frozen face; it works) |
| A4 | `RegimeBand.jsx:108` (eyebrow, Simple unfrozen) | `Macro Backdrop · the call` | **live posture wearing the product's official-call name** | **Yes — the sharpest trap in part A.** v5.3 defines the product as "one canonical public daily call"; post-10am, "THE CALL" over a live recomputation reads as that call. Observed live 2026-08-28 11:04 ET: MOONING under "THE CALL" with no frozen caption — an unfrozen face an hour after capture time |
| A5 | `RegimeBand.jsx:108` (eyebrow, Power unfrozen) | `Macro Backdrop · wen moon?` | live | No — the voice marks it informal (locked owner ruling; not proposed for change) |
| A6 | `RegimeBand.jsx:138-139` (frozen caption) | `immutable public call · captured 10:00 ET · {date}` | frozen only | — honest and dated. **The gap is its ABSENCE**: the unfrozen state renders no counterpart line, so "this is NOT the 10am call" is never stated anywhere on the face |
| A7 | `RegimeBand.jsx:141-142` (drift line) | `Current evidence now reads {X}; the scored 10am call remains frozen above.` | frozen + diverged only | — honest; no change proposed |
| A8 | `RegimeBand.jsx:169,171` (COPY button) | `⎘ COPY 10AM CALL` / `⎘ COPY POSTURE` (+ matching titles) | distinguishes | No — the pair works. Minor: "POSTURE" does not say "not the 10am call", it merely avoids claiming it |
| A9 | `macroCall.js:225` (share card, hero COPY → `formatMacroShareCard`) | `MACRODASH 10AM CALL · {date}` / `MACRODASH CURRENT POSTURE · {date}` | distinguishes via the `frozen` flag | No — correct pair; the RECIPIENT of a shared "CURRENT POSTURE" card can still not tell whether an official call exists that day, but the card does not claim to be it |
| A10 | `macroCall.js:203` (operator paste, ⎘ header/OPS button → `formatMacroCallPaste`) | `MACRODASH DAILY CALL · {date} · macrodash.pages.dev` | **ALWAYS "DAILY CALL", frozen or not** — the builder takes no `frozen` flag | **Yes — the sharpest trap in the copy path.** An unfrozen live posture pastes under the exact official-call banner, dated today. The share card learned the frozen/live pair; this sibling never did, and both consume the same `dailyCall` (the v8/28 clipboard-agreement lesson, one field over) |
| A11 | `RegimeBand.jsx:~230` (ℹ panel footer) | `Rule-based 6-factor vote · stale/dead inputs auto-excluded · {srcLabel}` where srcLabel ∈ "derived from live data" / "derived from today's cached snapshot" / … | names DATA freshness, not call freshness | No — but it is the ℹ panel's only time claim, and "today's cached snapshot" beside a frozen call describes a different artifact than the call being explained |
| A12 | header `DataModeBadge` | `CACHED` (etc.) | data mode | Mostly no — at a glance "CACHED" beside the hero can read as "the CALL is cached/stale"; it means the day's snapshot was served from KV. Pre-existing vocabulary, out of scope beyond noting the adjacency |
| A13 | `fiveWhys.js:100-104` (headline prefix, one tap deep) | `Pre-open setup —` / `Midday —` / `Post-close —` | **narration time, not call time** — computed from live `data.session` even when the chain narrates the FROZEN call | Partially — an evening reader of a frozen 10am call sees "Post-close —" leading its explanation: the time of READING stamped onto the call's narrative |

### Proposed face copy (frozen vs not-frozen; freeze timing untouched)

The principle: the frozen state already says what it is (A3/A6/A7 are honest). Every
defect is in the UNFROZEN state saying nothing, plus one mislabelled clock. All proposals
are copy/props-level; none moves when or how the freeze happens.

| Row | Not-frozen face | Frozen face |
|---|---|---|
| A1 | `{session} · data pulled {lastRefresh}` — three words bind the timestamp to the data, dissolving the fake clock. (Same string both states; the stamp describes data either way) | same |
| A4 | Eyebrow: `Macro Backdrop · live read` — "the call" is reserved for the artifact that IS the call | keep `Macro Backdrop · 10am frozen call` |
| A6 | Add the missing counterpart caption, phrased by the client clock (no freeze-mechanics change — before/after 10:00 ET is client-computable): before 10am → `live read — today's official call freezes at 10:00 ET`; after 10am with no record → `live read — today's 10am record not loaded` | keep `immutable public call · captured 10:00 ET · {date}` |
| A8 | `⎘ COPY LIVE READ` (title: "Copy the current live read — not the 10am call") | keep `⎘ COPY 10AM CALL` |
| A9 | `MACRODASH LIVE READ · {date}` (or keep CURRENT POSTURE — either works; pick ONE word pair and use it in A4/A8/A9/A10) | keep `MACRODASH 10AM CALL · {date}` |
| A10 | Pass `frozen` into `formatMacroCallPaste` and reuse A9's exact pair: `MACRODASH 10AM CALL` / `MACRODASH LIVE READ` — one vocabulary, two builders, extending the existing clipboard-agreement pin | ditto |
| A13 | Prefix from the CALL's own time when frozen (`10am call —`), live session prefix only when unfrozen | ditto |

Vocabulary rule to pin: **"call" appears on a face only when `callFrozen` is true**; the
unfrozen word is "live read" (or "current posture" — one pair, everywhere). Mirrors the
GATE:/MACRO: scoping rule (v3.51/v3.62/v5.6: one word must not carry two verdicts).

**Operational observation, filed not asserted:** at 2026-08-28 11:04 ET the live page
rendered the UNFROZEN face (eyebrow "THE CALL", no captured-at caption, `⎘ COPY POSTURE`)
— an hour after the 10:00 capture cron should have written the history record. Either the
capture failed today or `validFrozenCall` rejected the record. Worth one `?debug` check of
`pulse:cron:lastwarm` / the history key before assuming the copy fix is the whole story —
the frozen face cannot render if the freeze never lands.

---

## B. Five Whys — closed vs open, and the closed-state line

### Today

**Closed (default, both modes):** exactly one toggle row —
`▸ +5 why this call · 5 checks` (CSS-uppercased on phones). Nothing else: no regime line
(moved inside at v3.93), no date, no flip, no signal of what the five checks concluded.

**Open (one tap):** the amber regime line (`{label} · {direction}`) → the italic headline
sentence → five bordered paragraphs labelled WHY THIS CALL / WHAT DROVE IT / WHY IT
MATTERS / CAN I TRUST IT / WHAT CHANGES IT (the fifth at full weight) → `Rule-based ·
{derivedLabel} (no LLM)` → the SourceBox.

### The proposal — the closed line carries the flip

The fifth check (WHAT CHANGES IT) is this block's natural one-line summary, and the flip
is the one sentence a closed reader acts on. Proposed closed form (label text, so the
block stays ONE toggle row):

> `▸ +5 why this call · 5 checks — ⇄ NFCI above -0.50 SD would flip this to MACRO: HODL`

Rules riding it:
- **The flip MOVES here from the SimpleCards footer — it does not duplicate.** It renders
  zero-tap in the cards footer today (`· ⇄ {flipLine}`), ~200px above this block. Two
  renderings of one fact is the v3.61/v3.62 duplication defect; one home, and the cards
  footer keeps only the coverage line. (If the owner prefers the flip to stay on the cards,
  then the whys' closed line should carry something else — a flip in two places is the one
  outcome this proposal rules out.)
- The verdict word in the flip goes through `SIMPLE_VERDICTS` exactly as `simpleFlipLine`
  already does (v4.0.3: no engine label leaks into Simple).
- Withheld/loading: no flip exists — the closed line degrades to today's bare label; the
  withheld sentence ("Call withheld until…") travels WITH the flip to its one home.
- The tail is chip-length in place, verbatim inside (v3.66) — see the budget pin below.
- The five paragraphs stay inside the expander, byte-identical. Nothing else moves.

### Pins that read the chain or the label while the group is closed

| Pin | What it does today | Consequence for this proposal |
|---|---|---|
| `public-render.mjs:197-199` (v3.92) | Reads the CLOSED body: asserts `!/WHAT DROVE IT/` (chain absent) and `/DATA HOLD\|CAN'T CALL IT\|LOADING/` — the second currently satisfied by the HERO, not this block | Survives. But if the closed line gains verdict words, re-read it deliberately — it would start passing via the whys' label too, which changes what it proves |
| `public-render.mjs:220` | `/6\/6 factors voting\|6 bullish\|of 6/i` on the CLOSED body — **two of its three alternates are chain-interior text** ("6 bullish" renders only inside the open chain/ℹ panel); today it passes via the hero's "of 6" | **Flag: semi-vacuous alternation.** It looks like a chain-read-while-closed and isn't — tighten to the voters line so a chain-visibility change can't silently flip which alternate carries it |
| `public-render.mjs:404` and `:995` | Pin the literal closed label `why this call · 5 checks` | Re-pin on the new label shape. The six `hasText: "why this call"` locators (≈204, 312, 405, 414, 981, 991) survive on substring — keep that prefix verbatim |
| `public-render.mjs:344` (v3.93 budget) | Closed block ≤60px to the next block at 390×844 | **Will fail as written**: a full flip sentence wraps at 390px. Either truncate the tail chip-length (v3.66, full text inside) and keep 60px, or re-pin with the measurement and reason. Truncation is the house answer |
| `smoke.mjs:2276-2283` (v3.93 structural) | Regime line + chain INSIDE the collapse; ONE toggle row; chip-free | Survives ONLY if the flip rides the `label` prop. A sibling element outside the CollapsedGroup breaks this pin AND the 60px budget — the label is the only legal home |
| `smoke.mjs:2264` and `:5614` | Pin the literal label in `whysSrc` and the Simple call-site prop | Re-pin. Note :5614 also pins the label as a STATIC prop (`label="…"`); a computed label (needed to carry the flip) changes the shape this regex matches |
| `public-render.mjs:~371` ("exactly one verdict") | `!/RISK-ON\|RISK-OFF\|MIXED/` — scoped to `bandTxt` only | Survives (band-scoped), provided the closed flip uses `SIMPLE_VERDICTS` mapping as proposed |

### Blast radius outside the pins

`simpleFlipLine` gains a second consumer (or the cards footer loses one) — the "flip has
one derivation" property already holds (`evidence.js`); only the RENDER home moves.
`CollapsedGroup` needs no change if the flip rides `label`; `persistKey` behavior is
untouched.
