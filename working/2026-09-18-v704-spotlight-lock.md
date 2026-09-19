# v7.0.4 Spotlight lock (working branch)

Branch: `working/v7.0.4-spotlight-lock`
Baseline: main @ 489c22c (v7.0.1).

## DO THIS FIRST
`src/dashboard.jsx` on this branch was briefly overwritten. Restore from the parent commit, then apply one line:

```
git checkout 1b639e3f50316a4f842a0f2aa128ce3d09d63a70 -- src/dashboard.jsx
```

Change the Spotlight mount to:

```
<StockSpotlight spotlight={spotlight} simple={simple} callHeadline={dailyCall.headline}/>
```

Drop in `src/sections/StockSpotlight.jsx` from this working packet (eyebrow, row order, Simple fold).

`src/simpleFace.js` on the branch is already correct (`spotlightLocked`).

## Scope
Presentation only. No roster, rotation, thresholds, APIs, or frozen-call arithmetic.

When the frozen public headline is Hold, HODL, Bearish, or RISK-OFF:

- Eyebrow becomes `lesson — not a buy list` (both modes).
- Simple card order is market cap → quality stat → YTD, and YTD is not the big number.
- Simple folds the widget behind `Stock Spotlight · lesson` so the face can end at Market Performance.

Bullish / RISK-ON is unchanged.
