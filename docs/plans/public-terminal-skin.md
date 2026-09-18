# Public Terminal Skin — Simple ∣ Degen unification

Status: **plan only**. No token, chrome, or component implementation in this PR.
Planning date: 2026-09-17. Base: live public dashboard (Simple + Degen screenshots, 2026-09-17).
Owner ask: unify font size, real estate, colors, theme; bridge to the Bloomberg/TT look originally shipped; Simple and Degen look like one product; not overwhelming to new users.
Highest-leverage change first. Do not start the edit until this plan is accepted.

---

## Review (2026-09-17, after the screenshots)

**Sure about the diagnosis.** The three live shots prove two products, not two altitudes. Simple is gold fintech (Syne wordmark, DM Sans sentence, three cards). Degen is operator debris glued onto that app (CACHED / FIRED / TERMINAL / SHARE / OPS / nav before the call). Spotlight is a third language. TT/admin.html already solved Bloomberg and public never inherited it.

**Sure about the call.** One public terminal skin. Simple and Degen consume it. They differ only in what is shown. Token bridge + shared header is Slice 1 because it hits font, color, theme, and the real estate that makes Degen feel like a different app — without rewriting RegimeBand, Drivers, or Five Whys.

**One correction.** Do not paint Simple in full phosphor + scanline. Simple's gold Hold + 15-word sentence + three cards already works for a newcomer. Full CRT on the default view would make the beginner face feel like the operator portal, which fights "not too overwhelming." Phosphor is the live/helping signal, not Simple's personality. Scanline is Degen-only or off until Slice 1 is seen. Amber wordmark stays so public is not a clone of `/admin.html`.

Locked, not in play: Simple remains default. Degen keeps the moon voice. v3.25 red facts never fold. Honesty invariant. Tokens have one home (`src/design-tokens.js`). Public view still hides book/terminal. No new sections.

---

## Baseline (from the three shots)

| Surface | Simple | Degen |
|---|---|---|
| Identity | Syne gold wordmark, DM Sans sentence | Same gold wordmark + leftover "macrodash" echo |
| Header | Wordmark + clock + toggle. Clean. | Clock + CACHED + FIRED + toggle + TERMINAL, then SHARE + OPS, then section nav. Four rows before the call. |
| Call | `Hold` ~28px, 15-word sentence | `HODL 💎` + `NEUTRAL · 2 help, 3 do not` + frozen caption + 6pm line + 6-of-6 dots + COPY + ℹ |
| Evidence | Three HELPING/HURTING cards | Collapsed 5 Whys + Signal Quality + Track Record + Factor Evidence |
| Shared | Same 8-tile strip, same gold spotlight cards | Same strip, spotlight grows into a wall of 8px mono |

The live Ticker Terminal already solved Bloomberg: one mono stack, phosphor green `#39ff9e`, surfaces `#05070a / #0a0f16`, type floor **10 / 11 / 12.5 / 14 / 16**. Public never inherited it. Public still runs three fonts, gold-as-identity, and a type scale whose load-bearing chrome is **7–9px** (~171 hardcoded `fontSize` literals). Owner already called that unreadably small at v5.9.2 — the sheet got `fs-body: 16`, the chrome did not.

So the split is not content. It is **skin + chrome**. Simple looks like a gold fintech app. Degen looks like operator debris glued onto that app. Spotlight is a third language (rounded consumer cards).

## The call

**Ship one public terminal skin. Simple and Degen consume it. They differ only in altitude.**

Do not restyle components one by one. Do not invent a third palette. Bridge public tokens to the already-shipped TT language, then put both modes on the same one-row header.

That is the highest-leverage change because it hits font, color, theme, and real estate in one pass, and it is the only change that makes a new user tapping Degen stay in the same product.

## Unification rules

1. **Same chrome, different rows.** Header is one row in both modes: wordmark · clock · Simple|Degen. Degen extras (CACHED, FIRED, TERMINAL, SHARE, OPS, section nav) fold behind one `MORE` / stay as red-fact badges. A mode switch must not grow the header.
2. **Same type, different volume.** One family: IBM Plex Mono (already loaded). Syne and DM Sans leave the public dashboard. Teaching copy in Simple stays readable — it just sits in the terminal face, not a second font.
3. **Same palette, different density.** Phosphor green is live / helping / selected. Amber is brand + alerts, not the whole UI. Red is hurting / fired. Surfaces match TT (`#05070a`, `#0a0f16`, `#16202c`). Gold wordmark stays as the brand accent so MacroDash does not clone `/admin.html`.
4. **Same tile language.** Cards, strip, spotlight, and Degen factor chips share one anatomy: eyebrow · value · delta/vote. Simple shows fewer tiles; Degen shows more of the same tiles.
5. **New-user test.** First screen in Simple still answers one question: *is the backdrop supporting risk?* Tapping Degen must feel like opening the hood on the same car, not landing in a different app.

Locked, not in play: Simple remains default. Degen keeps the moon voice (`HODL` / `MOONING` / `DIAMOND HANDS`). v3.25 red facts never fold. Honesty invariant (nothing reads live unless it is). Tokens have one home: `src/design-tokens.js`. Public view still hides book/terminal. No new sections, no extra indicators.

## Slice 1 — the high-leverage change (do this first)

**Token bridge + shared header.** Two files, paints the whole public surface.

**Tokens** in `src/design-tokens.js`:

- Surfaces → TT: `bg #05070a`, `surface #0a0f16`, `surface-high #0d141d`, `border #16202c`
- Brand green → phosphor `#39ff9e` (helping, live dots, selected state)
- Amber stays `#f0a500` / TT `#ffb454` for wordmark + alerts only
- Text → TT: primary `#c8d6cf`, secondary `#8aa0b4`, muted `#71877b` (already AA-lifted on admin)
- Type floor lifts to admin’s: `fs-xs 10`, `fs-s 11`, `fs-m 12.5`, `fs-l 14`, `fs-body 16`, `fs-xl 22`, `fs-xxl 28`
- `font-display` and `font-sans` alias to `font-mono` on the public dashboard (one family, no second load)
- Scanline is **Degen-only or off until Slice 1 is seen** (review correction). No glow spam, no CRT gimmick on Simple.

**Header** in `src/dashboard.jsx`:

- Both modes: `MacroDash` in mono + phosphor/amber tracking, clock on the same row, Simple|Degen segmented control
- Selected half of the toggle uses phosphor fill (terminal "this is on"), not a gold slab that fights the Hold tint
- Kill the Degen `macrodash` echo
- Public Degen: CACHED/SHARE move into `MORE`. FIRED stays visible (red fact). Section nav stays, but as a single 36px strip, not a second header
- Operator-only (TERMINAL, OPS, FIRED) remain `!publicView` — public Degen does not grow a trading desk

After Slice 1, Simple and Degen should be unmistakably the same terminal. Degen is just longer.

## Slice 2 — real estate (only after the skin lands)

- **Strip:** labels `fs-s` (11), values `fs-l` (14). Drop the 8px ⓘ next to every ticker — the whole tile is already the tap target. Four-column phone grid stays.
- **Simple cards:** keep three, restyle to strip anatomy (mono, left rule, HELPING/HURTING as color not a second word if the glyph already says it). One vote word max.
- **Hero:** Simple keeps one word + one sentence. Degen keeps moon voice, but frozen/6pm/coverage become one status line, not four. COPY sits in `MORE`, not a 44px sibling of the call.
- **Spotlight:** same panel chrome as a Simple card. Face stays name / one return / one fundamental. The 6-K paragraph wall stays inside the existing fold. No rounded consumer-card look.
- **Degen sections:** keep collapsed groups. Open state uses the same 12.5/14 scale, not 8px operator footnotes as body text.

## Slice 3 — do not do

- Do not restyle `/admin.html` in this pass. It is the source, not the target.
- Do not add a third font, a light theme, or a "beginner color."
- Do not put moon slang on Simple, or Hold-language on Degen.
- Do not hide the strip in Simple — it is the shared glance layer.
- Do not chase pixel-perfect Bloomberg. Phosphor + mono + dense-but-readable + one chrome is the bridge.
- Do not paint Simple in full phosphor/scanline (review correction).
- No layout rewrite of RegimeBand/Drivers/FiveWhys beyond what the shared skin forces.
- **No UI edit in this PR.** Plan file only.

## Acceptance (phone, 390-wide, both modes)

1. Simple first screen: wordmark, clock, toggle, Hold, one sentence, three cards, strip. No SHARE/OPS/nav/COPY row.
2. Degen first screen: same header height as Simple ±8px. Call is still the first thing under it.
3. Zero `fontSize` below 10px on any public surface. Strip labels readable without pinch-zoom.
4. Simple → Degen does not change typeface, background, or wordmark treatment.
5. Contrast still computed in smoke (muted text AA on the new surfaces).
6. Public `?view=public` still has no book, no TERMINAL, no OPS.
7. `npm run gates` green — especially public-render pins on Simple face, Hold copy, and red-fact visibility.

If this is the right call, next step is Slice 1 only: tokens + header. No component restyle until both modes already look like the same terminal.
