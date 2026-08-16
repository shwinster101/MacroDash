// /api/picks — the SHARED S-TIER PICKS feed (v3.97 SHAREABLE SIMPLE).
//
// ⚠ THIS IS THE ONE ENDPOINT THAT PUBLISHES BOOK-DERIVED CONTENT WITHOUT A PIN — an
// explicit owner call (2026-08-16): the Simple view is a share-with-friends page, and the
// picks strip is the "what I actually hold conviction in" layer no retail site can host.
// Everything else book-shaped stays PIN-gated (/api/tt, /api/deepdive, /api/quotes, …).
//
// The exposure is bounded by a WHITELIST PROJECTION (the readout.json.js pattern): only
// S-tier entries, and per entry only {sym, tier, note?}. Never theses, ranks, PTs,
// composites, positions, dots, deepDive keys — the projection below is built by explicit
// field picks, so a new book field can never leak by default. `note` comes ONLY from an
// explicit owner-authored `share_note` string on the entry (validateBook's unknown-key
// passthrough carries it; absence emits nothing; >140 chars truncates rather than silently
// dropping a note the owner wrote).
//
// Output order is BOOK ARRAY ORDER — stable and owner-controlled, never re-sorted by a
// metric this endpoint refuses to publish (sorting by upside would leak the ranking).
// A missing or malformed book yields {picks:[]}, never a 500 (graceful degradation), and
// the response is edge-cacheable for 5 minutes so anonymous traffic cannot hammer KV.

const BOOK_KEY = "tt:book:v1";
const SYM_RE = /^[A-Z.\-]{1,8}$/;
const NOTE_MAX = 140;

export function projectPicks(stored) {
  if (!stored || !Array.isArray(stored.book)) return { schema: "picks-v1", asOf: null, picks: [] };
  const picks = [];
  for (const e of stored.book) {
    if (!e || e.tier !== "S") continue;
    const sym = String(e.sym || "").toUpperCase();
    if (!SYM_RE.test(sym)) continue;
    const p = { sym, tier: "S" };
    if (typeof e.share_note === "string" && e.share_note.trim())
      p.note = e.share_note.trim().slice(0, NOTE_MAX);
    picks.push(p);
  }
  return { schema: "picks-v1", asOf: typeof stored.asOf === "string" ? stored.asOf : null, picks };
}

export async function onRequestGet({ env }) {
  let stored = null;
  try { stored = await env.PULSE_CACHE.get(BOOK_KEY, "json"); } catch (_e) {}
  return new Response(JSON.stringify(projectPicks(stored)), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
    },
  });
}
