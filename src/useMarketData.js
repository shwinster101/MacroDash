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
  // B1 (v3.59): retryTick re-arms the whole fetch effect — the manual Retry the re-audit
  // asked for. Incrementing it re-runs attempt() with the full timeout/retry machinery.
  const [retryTick, setRetryTick] = useState(0);
  // FEAT-QUORUM (v3.54): `mode:"MOCK"` is AMBIGUOUS — it is both "this is a demo build" and
  // "this is a live build whose fetch failed". Those must render differently: the demo's
  // baseline IS mock and should show its verdict, while a live build falling back to mock has
  // no evidence and must WITHHOLD one. `liveBuild` is the build's INTENT, constant for the
  // session, and is the same distinction `demoted()` already makes via anyLive.
  const liveBuild = MODE === "live";
  const [state, setState] = useState({
    data: mockData,
    mode: liveBuild ? "LOADING" : "MOCK",
    asOf: null,
    provenance: {},
    dataAsOf: {},
    loading: liveBuild,
    liveBuild,
    lastError: null,
    publicCall: null,
    publicCallFrozen: false,
    publicCallCapturedAt: null,
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
          setState({ data: merged.data, mode: merged.badge, asOf: merged.asOf, provenance: merged.provenance, dataAsOf: merged.dataAsOf,
            loading: false, liveBuild, publicCall: payload.publicCall || null,
            publicCallFrozen: payload.publicCallFrozen === true, publicCallCapturedAt: payload.publicCallCapturedAt || null });
        })
        .catch((err) => {
          clearTimeout(timeoutTimer);
          if (cancelled) return;
          /* B1 (v3.59, re-audit MED-robustness): a failed live fetch used to collapse to
             mode:"MOCK" — indistinguishable from an intentional demo build, with no way to
             tell whether to wait, retry, or treat the page as a demo. ERROR is now its own
             mode: mock content still renders underneath (graceful degradation holds, and
             everything mock stays ILLUSTRATIVE), but the page can say "the live service
             failed" and offer Retry. MOCK now means exactly one thing: a demo build.
             This completes the liveBuild disambiguation v3.54 started. */
          setState({ data: mockData, mode: "ERROR", asOf: null, provenance: {}, dataAsOf: {}, loading: false, liveBuild,
            lastError: (err && err.message) || String(err), publicCall: null, publicCallFrozen: false, publicCallCapturedAt: null });
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
  }, [mockData, publicView, retryTick]);

  // Manual retry: reset to LOADING (so the UI withholds rather than showing stale ERROR
  // chrome mid-flight) and re-arm the effect. No-op in a demo build — nothing to retry.
  const retry = () => {
    if (!liveBuild) return;
    setState((s) => ({ ...s, mode: "LOADING", loading: true, lastError: null }));
    setRetryTick((t) => t + 1);
  };
  return { ...state, retry };
}
