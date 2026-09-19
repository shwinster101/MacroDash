# v7.0.4 drop packet

Copy these onto `working/v7.0.4-spotlight-lock`:

| this file | repo path |
| --- | --- |
| `dashboard.jsx` | `src/dashboard.jsx` |
| `StockSpotlight.jsx` | `src/sections/StockSpotlight.jsx` |
| `simpleFace.js` | `src/simpleFace.js` (already on branch) |
| `spotlight-lock.mjs` | `test/spotlight-lock.mjs` (already on branch) |

Then: `node test/spotlight-lock.mjs`

Do not merge while `src/dashboard.jsx` on the branch is still the word PLACEHOLDER.
