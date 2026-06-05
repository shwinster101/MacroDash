// MacroDash v2.0 — useMarketData hook (ONE wiring point).
// In dashboard.jsx, replace `const DATA = {...}` reads with:
//     const { data: DATA, mode, asOf, loading } = useMarketData(MOCK_DATA, { publicView });
// Mock stays the fallback; live values overlay only the paths in sources.js.

import { useEffect, useState } from "react";
import { mergeLiveOverMock } from "./sources.js";

// The flip. 'mock' (default) = no network, all mock. 'live' = fetch /api/snapshot.
const MODE = (import.meta.env && import.meta.env.VITE_DATA_MODE) || "mock";

export function useMarketData(mockData, opts = {}) {
  const publicView = !!opts.publicView;
  const [state, setState] = useState({
    data: mockData,
    mode: MODE === "live" ? "LOADING" : "MOCK",
    asOf: null,
    loading: MODE === "live",
  });

  useEffect(() => {
    if (MODE !== "live") return;
    let cancelled = false;
    const ctl = new AbortController();

    fetch(`/api/snapshot${publicView ? "?view=public" : ""}`, { signal: ctl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const merged = mergeLiveOverMock(mockData, payload, publicView);
        setState({ data: merged.data, mode: merged.badge, asOf: merged.asOf, loading: false });
      })
      .catch(() => {
        // Network/parse failure: silently fall back to mock. The dashboard
        // never breaks on a bad fetch; it just shows MOCK.
        if (!cancelled) setState({ data: mockData, mode: "MOCK", asOf: null, loading: false });
      });

    return () => {
      cancelled = true;
      ctl.abort();
    };
  }, [mockData, publicView]);

  return state;
}
