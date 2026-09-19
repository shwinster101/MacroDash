# v7.0.4 Spotlight lock (working branch)

Branch: `working/v7.0.4-spotlight-lock`
Baseline: main @ 489c22c (v7.0.1).

## Scope
Presentation only. No roster, rotation, thresholds, APIs, or frozen-call arithmetic.

When the frozen public headline is Hold, HODL, Bearish, or RISK-OFF:

- Eyebrow becomes `lesson — not a buy list` (both modes).
- Simple card order is market cap → quality stat → YTD, and YTD is not the big number.
- Simple folds the widget behind `Stock Spotlight · lesson` so the face can end at Market Performance.

Bullish / RISK-ON is unchanged.

## Files
- `src/simpleFace.js` — `spotlightLocked`, copy constants
- `src/sections/StockSpotlight.jsx` — eyebrow, row order, fold
- `src/dashboard.jsx` — passes `dailyCall.headline`
- `test/smoke.mjs` — pins live in the local checkout; fold into smoke before merge if desired

Rotation helpers (`cadenceLine`, `comparisonForDate`, week seed) are untouched.
