// v7.0.4 — Spotlight lock pins (pure, no-network).
import { spotlightLocked, SPOTLIGHT_LOCK_EYEBROW, SPOTLIGHT_LOCK_FOLD } from "../src/simpleFace.js";

const fail = [];
const ok = (name, cond) => { if (!cond) fail.push(name); };

ok("Hold locks", spotlightLocked("Hold"));
ok("HODL locks", spotlightLocked("HODL"));
ok("Bearish locks", spotlightLocked("Bearish"));
ok("RISK-OFF locks", spotlightLocked("RISK-OFF"));
ok("canonical Bearish headline locks", spotlightLocked("DIAMOND HANDS"));
ok("BULLISH does not lock", !spotlightLocked("BULLISH"));
ok("RISK-ON does not lock", !spotlightLocked("RISK-ON"));
ok("empty does not lock", !spotlightLocked(""));
ok("null does not lock", !spotlightLocked(null));
ok("eyebrow copy", SPOTLIGHT_LOCK_EYEBROW === "lesson — not a buy list");
ok("fold copy", SPOTLIGHT_LOCK_FOLD === "Stock Spotlight · lesson");

if (fail.length) {
  console.error("v7.0.4 spotlight-lock FAIL:\n" + fail.map((n) => "  - " + n).join("\n"));
  process.exit(1);
}
console.log("v7.0.4 spotlight-lock: 11/11");
