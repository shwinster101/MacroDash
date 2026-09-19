// Face honesty: current on-screen votes, but action belongs only to the frozen call.
import { cadenceOf, isStale } from "./sources.js";
import { REGIME_BAND_TABLE } from "./regime.js";

export const TERMINAL_ENGINE_NOTE = "Terminal order-gate is a different engine.";
export const FROZEN_ACTION = Object.freeze({
  NEUTRAL: "Do not add risk.",
  BULLISH: "Backdrop supports adding risk.",
  BEARISH: "Reduce or don’t add.",
});

export function heroFace({ evidence, call, frozen = false, now = new Date() } = {}) {
  const usable = !["LOADING", "ERROR", "DEMO"].includes(evidence?.state);
  // Restrict to the same six canonical identities; no tally from a different engine.
  const counted = usable ? REGIME_BAND_TABLE.map(b =>
    evidence?.factors?.find(f => f.key === b.key)
  ).filter(f => f && !f.excluded && ["bull", "bear", "neutral"].includes(f.vote)) : [];
  const count = vote => counted.filter(f => f.vote === vote).length;
  const stale = counted.filter(f => isStale(f.asOf, now, cadenceOf(f.field || (f.key === "valuation" ? "shillerPe" : f.key)))).length;
  const tally = `${count("bear")} caution · ${count("bull")} support · ${count("neutral")} neutral${stale ? ` · ${stale} stale counted` : ""}`;
  const action = frozen && call?.schema === "md-call-v1" && call?.status === "PUBLISHED"
    ? FROZEN_ACTION[call.direction] || "10am action unavailable."
    : "10am action unavailable.";
  return { tally, action, engine: TERMINAL_ENGINE_NOTE };
}
