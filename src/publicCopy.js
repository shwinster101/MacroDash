// MacroDash v6.4 — reader-facing vocabulary and clock copy.
//
// This module is presentation-only. It never changes md-call-v1, md-close-read-v1,
// a vote, a threshold, or a persisted edition token. Keeping these projections pure
// lets the dashboard, history page, accessibility announcements, and tests speak one
// language without teaching the decision engines about UI modes.
import { etYmd, isMarketHoliday, parseObsDate } from "./sources.js";

export const SIMPLE_DIRECTION_LABELS = Object.freeze({
  BULLISH: "Bullish",
  NEUTRAL: "Hold",
  BEARISH: "Bearish",
});
export const SIMPLE_WITHHELD_LABEL = "Not enough data";

export function simpleCallLabel(callOrDirection) {
  const direction = typeof callOrDirection === "string"
    ? callOrDirection
    : callOrDirection && callOrDirection.direction;
  return SIMPLE_DIRECTION_LABELS[direction] || SIMPLE_WITHHELD_LABEL;
}

const etParts = (now) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "short", hour: "2-digit",
    minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now instanceof Date ? now : new Date(now));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return { weekday: get("weekday"), hour: Number(get("hour")), minute: Number(get("minute")) };
};

// Regular-session clock only. Early closes are deliberately not invented; the shared
// market calendar currently models full closures, matching every other dashboard clock.
export function publicMarketClock(now = new Date()) {
  const instant = now instanceof Date ? now : new Date(now);
  const { weekday, hour, minute } = etParts(instant);
  const date = etYmd(instant);
  const noSession = weekday === "Sat" || weekday === "Sun" || isMarketHoliday(date);
  if (noSession) return { state: "CLOSED", noSession: true, date };
  const minutes = hour * 60 + minute;
  if (minutes < 9 * 60 + 30) return { state: "PRE", noSession: false, date };
  if (minutes < 16 * 60) return { state: "OPEN", noSession: false, date };
  return { state: "CLOSED", noSession: false, date };
}

export function publicAsOfLabel(value) {
  const parsed = parseObsDate(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return value ? String(value) : "time unavailable";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function publicMarketClockLine({ now = new Date(), marketAsOf = null, snapshotAsOf = null } = {}) {
  const clock = publicMarketClock(now);
  const lead = clock.state === "PRE" ? "Before markets open"
    : clock.state === "OPEN" ? "Markets open" : "Markets closed";
  const asOf = publicAsOfLabel(marketAsOf || snapshotAsOf);
  return `${lead} · data as of ${asOf}${clock.noSession ? " · no new call today" : ""}`;
}

export function liveReadCaption({ now = new Date(), callFrozen = false, liveBuild = false, withheld = false } = {}) {
  if (callFrozen || !liveBuild || withheld) return null;
  const clock = publicMarketClock(now);
  if (clock.noSession) return "Latest market read · no new call is scheduled today";
  const { hour, minute } = etParts(now);
  return hour * 60 + minute < 10 * 60
    ? "Live market read · today's 10am call is scheduled"
    : "Live market read · today's 10am call is unavailable";
}

export function eveningUpdateLine(closeRead, { plain = false } = {}) {
  if (!closeRead) return null;
  const label = plain ? simpleCallLabel(closeRead.direction) : closeRead.label;
  const tail = closeRead.frozen
    ? "unscored; the 10am call remains frozen above"
    : "unscored; no 10am call was scheduled today";
  return `Evening update (6pm ET): ${label} — ${tail}`;
}

// T2 — Simple Hold ⓘ sheet. Three beats: what the word means, today's edition/clock,
// coverage + evening + the not-advice closer. Presentation only; no votes.
export function simpleHoldExplain({
  callFrozen = false,
  callCapturedAt = null,
  readCaption = null,
  closeRead = null,
  callDrift = null,
  conf = null,
} = {}) {
  const captured = callCapturedAt ? ` · ${String(callCapturedAt).slice(0, 10)}` : "";
  const clock = callFrozen
    ? `This is the frozen 10am call · captured 10:00 ET${captured}.`
    : (readCaption || "This is a live market read, not the 10am call.");
  const evening = eveningUpdateLine(closeRead, { plain: true })
    || (callDrift
      ? `Current evidence now reads ${simpleCallLabel(callDrift)}; the scored 10am call remains frozen above.`
      : null);
  const coverage = conf && Number.isFinite(conf.counted) && Number.isFinite(conf.total)
    ? `${conf.counted} of ${conf.total} signals counted${Array.isArray(conf.excluded) && conf.excluded.length ? ` · unavailable: ${conf.excluded.join(" · ")}` : ""}${conf.blind ? " · crash gauge (VIX) unavailable" : ""}`
    : null;
  const beat3 = [evening, coverage, "This describes market conditions, not whether to buy a particular stock. Education, not advice."]
    .filter(Boolean).join(" · ");
  return Object.freeze({
    full: "What this call means",
    what: Object.freeze([
      "Bullish means conditions support market risk; Bearish means they work against it. Hold means mixed evidence or a safety limit. Not enough data means too few current signals.",
      String(clock),
      beat3,
    ]),
  });
}

export const SPY_MOVE_UP = 0.5;
export const SPY_MOVE_DOWN = -0.5;
export function spyMoveDirection(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value > SPY_MOVE_UP) return "UP";
  if (value < SPY_MOVE_DOWN) return "DOWN";
  return "FLAT";
}

// CLOSE READ remains the compatibility token accepted by formatters and stored records.
export function publicEditionLabel(edition) {
  return edition === "CLOSE READ" ? "EVENING UPDATE" : edition;
}

// Shared links always open the public audience. Strip operator/debug parameters and
// hash context rather than forwarding the current browser location verbatim.
export function publicDashboardUrl(href) {
  const url = new URL(href);
  url.pathname = "/";
  url.search = "?view=public";
  url.hash = "";
  return url.href;
}
