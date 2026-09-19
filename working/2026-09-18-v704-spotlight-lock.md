# v7.0.4 Spotlight lock

Branch: `working/v7.0.4-spotlight-lock`

## On the branch now
- `src/simpleFace.js` — `spotlightLocked` + lesson copy
- `test/spotlight-lock.mjs` — 10 pure pins (`node test/spotlight-lock.mjs`)

## Still drop in (API payload too large from this session)
- Restore `src/dashboard.jsx` from `1b639e3`, then set:
  `<StockSpotlight spotlight={spotlight} simple={simple} callHeadline={dailyCall.headline}/>`
- Replace `src/sections/StockSpotlight.jsx` with the lock UI (eyebrow, YTD demoted, Simple fold)

Do not merge while dashboard.jsx is PLACEHOLDER.
