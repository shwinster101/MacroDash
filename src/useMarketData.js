// MacroDash v2.0 — useMarketData hook (ONE wiring point).
// In dashboard.jsx, replace `const DATA = {...}` reads with:
//     const { data: DATA, mode, asOf, loading } = useMarketData(MOCK_DATA, { publicView });
// Mock stays the fallback; live values overlay only the paths in sources.js.

import { useEffect, useState } from "react";
import { mergeLiveOverMock } from "./sources.js";

// The flip. 'mock' (default) = no network, all mock. 'live' = fetch /api/snapshot.
const MODE = (import.meta.env && import.meta.env.VITE_DATA_MODE) || "mock";

// FEAT-SNAP-UX: the fetch must be BOUNDED. A cold /api/snapshot assembly (first visit of
// the ET day) runs three upstream phases with per-fetch 9s timeouts, so it can legitimately
// take tens of seconds — and a hung mobile connection never resolves at all. Without a
// deadline the badge sat on LOADING with mock numbers indefinitely, which reads as "the
// site is broken". Timeout generously (don't cut off a slow-but-succeeding cold assembly),
// fall back to MOCK honestly, then retry once — by then the first request has usually
// finished write-through-warming the per-day KV cache, so the retry returns instantly.
const FETCH_TIMEOUT_MS = 40_000;
const RETRY_DELAY_MS = 10_000;
const RETRIES = 1;

export function useMarketData(mockData, opts = {}) {
  const publicView = !!opts.publicView;
  const [state, setState] = useState({
    data: mockData,
    mode: MODE === "live" ? "LOADING" : "MOCK",
    asOf: null,
    provenance: {},
    dataAsOf: {},
    loading: MODE === "live",
  });

  useEffect(() => {
    if (MODE !== "live") return;
    let cancelled = false;
    let ctl = null;
    let timeoutTimer = null;
    let retryTimer = null;

    const attempt = (retriesLeft) => {
      ctl = new AbortController();
      // Manual timeout (not AbortSignal.timeout/any) so unmount-abort + deadline-abort
      // share one controller — AbortSignal.any is too new for older mobile Safari.
      timeoutTimer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);

      fetch(`/api/snapshot${publicView ? "?view=public" : ""}`, { signal: ctl.signal })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((payload) => {
          clearTimeout(timeoutTimer);
          if (cancelled) return;
          const merged = mergeLiveOverMock(mockData, payload, publicView);
          setState({ data: merged.data, mode: merged.badge, asOf: merged.asOf, provenance: merged.provenance, dataAsOf: merged.dataAsOf, loading: false });
        })
        .catch((err) => {
          clearTimeout(timeoutTimer);
          if (cancelled) return;
          // Network/timeout/parse failure: fall back to mock with an honest MOCK badge
          // (never a stuck LOADING). The dashboard never breaks on a bad fetch.
          setState({ data: mockData, mode: "MOCK", asOf: null, provenance: {}, dataAsOf: {}, loading: false });
          if (typeof console !== "undefined" && console.warn) {
            console.warn("[MacroDash] /api/snapshot fetch failed:", (err && err.message) || err);
          }
          if (retriesLeft > 0) retryTimer = setTimeout(() => attempt(retriesLeft - 1), RETRY_DELAY_MS);
        });
    };
    attempt(RETRIES);

    return () => {
      cancelled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(retryTimer);
      if (ctl) ctl.abort();
    };
  }, [mockData, publicView]);

  return state;
}
