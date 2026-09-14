// ─── STOCK SPOTLIGHT (v6.5.0, docs/plans/stock-spotlight.md) ─────────────────────────
// NBIS beside one rotating "Established growth" comparison, answering ONE question in both
// modes: what do this business's latest results and its stock's current price tell me?
//
// PRESENTATION ONLY (the v3.73 boundary): every number, label, basis and sentence here was
// computed server-side by functions/lib/spotlight.js and arrives already projected. This
// file formats nothing that could disagree with the model — it joins strings. The fetch
// lives in the orchestrator (the TerminalDock precedent). No hooks, no storage.
//
// Rules this component enforces at render:
//   · Renders NOTHING without an enabled feed and a model (a feature flag off, a failed
//     fetch or a demo build must never show example companies).
//   · Company name + ticker, MARKET CAP (with its observation date), YTD return (with its
//     through-date and its BASIS label) and the shared YTD chart are ALWAYS visible in both
//     modes — never behind a disclosure. Missing = "Unavailable" + the reason, never 0.
//   · Simple: compact profiles (what the company does, cap, YTD, three fundamentals, a
//     TWO-SENTENCE summary) then the learning moment, then the chart, with the full
//     business/stock/watch-next treatment, the analysis and the sources one tap deep under
//     "explore the numbers" (review 2026-09-13: Simple must feel like a learning moment, not
//     two research cards). Degen: the full treatment and the analysis are visible and only
//     the source disclosures collapse.
//   · The tracker draws ONLY verified total-return legs; a withheld leg reads Unavailable
//     with its reason, and a new year before its first close reads "awaiting".
//   · No verdict badges, no rating words: the assessment text is the model's deterministic
//     template and is rendered verbatim.
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { T } from "../design-tokens.js";
import CollapsedGroup from "../primitives/CollapsedGroup.jsx";

const LINE = { anchor: { stroke: T.amber, dash: null }, comparison: { stroke: T.blue, dash: "5 3" } };
const money = (v) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const s = v < 0 ? "−" : "", a = Math.abs(v);
  return a >= 1e12 ? `${s}$${(a / 1e12).toFixed(2)}T` : a >= 1e9 ? `${s}$${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${s}$${(a / 1e6).toFixed(0)}M` : `${s}$${a.toFixed(0)}`;
};
const pct = (v, d = 1) => typeof v === "number" && Number.isFinite(v) ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%` : null;
const hostOf = (u) => { try { return new URL(u).host; } catch (_e) { return null; } };
// One tick per calendar month (the first plotted date of each), so a wide chart never repeats
// a month label — a display choice, not a computation on the data.
const monthStarts = (pts) => pts.filter((p, i) => i === 0 || String(p.date).slice(0, 7) !== String(pts[i - 1].date).slice(0, 7)).map((p) => p.date);
const monthTick = (d) => { const m = String(d || "").slice(5, 7); return ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m)] || ""; };

/* "Unavailable" is a first-class value: the word, then the reason at caption weight. */
const Unavail = ({ reason }) => (
  <span style={{ fontFamily: T.fontMono, fontSize: T.fsM, color: T.amber }}>Unavailable
    {reason ? <span style={{ color: T.textMuted, fontFamily: T.fontSans, fontSize: T.fsS }}> — {reason}</span> : null}</span>
);
const Row = ({ label, value, sub, unavailable, big = false }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap", minWidth: 0, padding: "2px 0" }}>
    <span style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0, minWidth: 92 }}>{label}</span>
    {value != null && !unavailable
      ? <span style={{ fontFamily: T.fontMono, fontSize: big ? T.fsL : T.fsM, fontWeight: big ? 700 : 500, color: T.textPrimary, minWidth: 0 }}>{value}</span>
      : <Unavail reason={unavailable} />}
    {sub && value != null && !unavailable ? <span style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted, minWidth: 0 }}>{sub}</span> : null}
  </div>
);
const Stale = ({ f }) => f && f.stale
  ? <span title={f.reason || "stale"} style={{ fontFamily: T.fontMono, fontSize: 8, color: T.amber, border: `1px solid ${T.amber}55`, borderRadius: 3, padding: "0 4px", marginLeft: 4 }}>STALE</span>
  : null;

const Profile = ({ c, leg, simple }) => {
  const m = c.metrics || {};
  const rg = m.revenueGrowth || {}, om = m.operatingMargin || {}, fcf = m.fcf || {};
  const cap = c.marketCap || {};
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "10px 12px", minWidth: 0 }}
      role="group" aria-label={`${c.name} (${c.symbol}) profile`}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: T.fontSans, fontSize: T.fsL, fontWeight: 700, color: T.textPrimary }}>{c.name}</span>
        <span style={{ fontFamily: T.fontMono, fontSize: T.fsM, color: T.amber }}>{c.symbol}</span>
      </div>
      {c.blurb && <div style={{ fontFamily: T.fontSans, fontSize: T.fsS, color: T.textSecondary, lineHeight: 1.35, marginBottom: 3 }}>{c.blurb}</div>}
      {/* Always visible, both modes: market cap with its date; YTD with its through-date + basis. */}
      <Row label="Market cap" big value={cap.display} unavailable={cap.unavailable}
        sub={cap.observedAt ? <>as of {cap.observedAt}{cap.method === "derived" ? " · derived" : ""}<Stale f={c.freshness && c.freshness.market} /></> : null} />
      {leg && leg.awaiting
        ? <Row label="YTD total return" big value="awaiting first trading close" sub={leg.unavailable || null} />
        : <Row label="YTD total return" big
            value={leg && typeof leg.pct === "number" ? pct(leg.pct, 2) : null}
            unavailable={leg ? (leg.unavailable || (typeof leg.pct !== "number" ? "no common trading date yet" : null)) : "return series unavailable"}
            sub={leg && leg.through ? <>through {leg.through}<Stale f={c.freshness && c.freshness.series} /></> : null} />}
      <div style={{ borderTop: `1px solid ${T.border}`, margin: "6px 0 4px" }} />
      <Row label="Revenue growth" value={pct(rg.pct)} unavailable={rg.unavailable} sub={rg.period ? `${rg.period} vs a year earlier` : null} />
      <Row label="Operating margin" value={typeof om.pct === "number" ? `${om.pct.toFixed(1)}%` : null} unavailable={om.unavailable}
        sub={typeof om.priorPct === "number" ? `from ${om.priorPct.toFixed(1)}% a year earlier` : om.period || null} />
      <Row label="Free cash flow" value={money(fcf.value)} unavailable={fcf.unavailable} sub={fcf.period ? `${fcf.period} · OCF − capex` : null} />
      {c.freshness && c.freshness.fundamentals &&
        <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted, marginTop: 2 }}>
          {c.freshness.fundamentals.label}{c.freshness.fundamentals.period ? ` · ${c.freshness.fundamentals.period}` : ""}{c.freshness.fundamentals.form ? ` · ${c.freshness.fundamentals.form}` : ""}
        </div>}
      {c.assessment && (simple
        ? <div style={{ marginTop: 6, fontFamily: T.fontSans, fontSize: T.fsM, color: T.textPrimary, lineHeight: 1.45 }}>
            {(c.assessment.summary || []).slice(0, 2).join(" ")}
          </div>
        : <FullAssessment a={c.assessment} />)}
    </div>
  );
};
/* The three questions in full — on the Degen face, and one tap deep in Simple. */
const FullAssessment = ({ a }) => (
  <div style={{ marginTop: 6, fontFamily: T.fontSans, fontSize: T.fsS, color: T.textPrimary, lineHeight: 1.45 }} role="group" aria-label="Full assessment">
    <div><span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: T.fsXs }}>BUSINESS · </span>{a.business}</div>
    <div style={{ marginTop: 3 }}><span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: T.fsXs }}>STOCK · </span>{a.stock}</div>
    <div style={{ marginTop: 3, color: T.textSecondary }}><span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: T.fsXs }}>WATCH NEXT · </span>{a.watchNext}</div>
  </div>
);

const Detail = ({ c }) => {
  const m = c.metrics || {};
  const v = m.valuation || {}, tr = m.trend || {}, rr = m.runRate, cash = m.cash || {}, debt = m.debt || {}, sh = m.shares || {};
  return (
    <div style={{ background: T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", minWidth: 0 }} role="group" aria-label={`${c.symbol} supporting analysis`}>
      <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.amber, letterSpacing: "0.1em", marginBottom: 4 }}>{c.symbol} · SUPPORTING ANALYSIS</div>
      <Row label="Cash" value={money(cash.value)} unavailable={cash.unavailable} sub={cash.asOf ? `at ${cash.asOf}` : null} />
      <Row label="Debt" value={money(debt.value)} unavailable={debt.unavailable} sub={debt.asOf ? `at ${debt.asOf}` : null} />
      <Row label="Cap ÷ TTM revenue" value={typeof v.capToTtmRevenue === "number" ? `${v.capToTtmRevenue.toFixed(1)}×` : null} unavailable={v.unavailable} sub={v.ttmRevenuePeriod ? `${money(v.ttmRevenue)} ${v.ttmRevenuePeriod}` : null} />
      <Row label="Trailing P/E" value={typeof v.trailingPe === "number" ? `${v.trailingPe.toFixed(1)}×` : null} unavailable={typeof v.trailingPe === "number" ? null : (v.peNote || v.unavailable || "unavailable")} sub={typeof v.ttmNetIncome === "number" ? `TTM net income ${money(v.ttmNetIncome)}` : null} />
      <Row label="Shares out." value={typeof sh.value === "number" ? `${(sh.value / 1e9).toFixed(3)}B` : null} unavailable={sh.unavailable} sub={sh.asOf ? `at ${sh.asOf}` : null} />
      <Row label="Price trend"
        value={typeof tr.px === "number" && typeof tr.ma200 === "number" ? `$${tr.px} · ${tr.above200 ? "above" : "below"} 200-day $${tr.ma200}${typeof tr.ma50 === "number" ? ` · 50-day $${tr.ma50}` : ""}` : null}
        unavailable={typeof tr.px === "number" && typeof tr.ma200 === "number" ? null : (tr.unavailable || "unavailable")}
        sub={tr.asOf ? `close ${tr.asOf}${tr.basis === "total_return" ? " · adjusted series" : ""}` : null} />
      {rr && <Row label="Run-rate vs TTM" value={`${money(rr.annualized)} vs ${money(rr.ttm) || "TTM unavailable"}`} sub={typeof rr.gapPct === "number" ? `latest quarter × 4 is ${pct(rr.gapPct)} vs reported TTM` : "latest quarter × 4"} />}
      {c.assessment && c.assessment.inputs && c.assessment.inputs.length > 0 && (
        <div style={{ marginTop: 5 }}>
          <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted, letterSpacing: "0.1em" }}>CALCULATION INPUTS</div>
          <ul style={{ margin: "2px 0 0", paddingLeft: 16, fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textSecondary, lineHeight: 1.5 }}>
            {c.assessment.inputs.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};

const Sources = ({ companies, tracker }) => (
  <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted, lineHeight: 1.6 }} role="group" aria-label="Sources and calculations">
    {tracker && tracker.method && <div>YTD method: {tracker.method}.</div>}
    {tracker && tracker.baselineMismatch && <div style={{ color: T.amber }}>{tracker.baselineMismatch}</div>}
    {companies.map((c) => (
      <div key={c.symbol} style={{ marginTop: 4 }}>
        <div style={{ color: T.textSecondary }}>{c.symbol}{c.marketCap && c.marketCap.note ? ` · market cap: ${c.marketCap.note}` : ""}{c.marketCap && c.marketCap.method ? ` (${c.marketCap.method})` : ""}</div>
        {(c.sources || []).map((s, i) => (
          <div key={i}>{s.label}: <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: T.blue }}>{s.provider || s.url}</a>
            {hostOf(s.url) ? <span style={{ color: T.textMuted }}> ({hostOf(s.url)})</span> : null}{s.form ? ` · ${s.form}` : ""}{s.filed ? ` filed ${s.filed}` : s.observedAt ? ` · ${s.observedAt}` : ""}</div>
        ))}
      </div>
    ))}
  </div>
);

const Chart = ({ tracker, syms }) => {
  if (!tracker) return null;
  if (tracker.yearRollover)
    return <div style={{ padding: "6px 0", fontFamily: T.fontMono, fontSize: T.fsM, color: T.textSecondary }}>Awaiting the first {tracker.year} trading close — both lines restart at 0% from {tracker.baselineDate}.</div>;
  if (tracker.unavailable || !tracker.points || tracker.points.length === 0)
    return <div style={{ padding: "6px 0" }}><Unavail reason={tracker.unavailable || "no chart points yet"} /></div>;
  const legs = tracker.legs || {};
  const pts = tracker.points;
  const sample = pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / 8)) === 0 || i === pts.length - 1);
  const drawn = syms.filter((s) => legs[s] && legs[s].points !== undefined ? true : pts.some((p) => typeof p[s] === "number"));
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline", marginBottom: 2 }} aria-hidden="true">
        {syms.map((s, i) => {
          const leg = legs[s]; const k = i === 0 ? "anchor" : "comparison";
          return (
            <span key={s} style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textSecondary, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 14, height: 0, borderTop: `2px ${LINE[k].dash ? "dashed" : "solid"} ${LINE[k].stroke}` }} />
              {s}{leg && typeof leg.pct === "number" ? ` ${pct(leg.pct, 2)}` : leg && leg.unavailable ? " — unavailable" : ""}
            </span>
          );
        })}
        <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted }}>from {tracker.baselineDate} · through {tracker.through}</span>
      </div>
      {tracker.partial && <div style={{ fontFamily: T.fontSans, fontSize: T.fsS, color: T.amber }}>{tracker.partial}</div>}
      <div aria-hidden="true" style={{ height: 160, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={pts} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" ticks={monthStarts(pts)} tickFormatter={monthTick} tick={{ fontSize: 8, fill: T.textMuted }} interval={0} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 8, fill: T.textMuted }} width={40} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ background: T.surfaceHigh, border: `1px solid ${T.border}`, fontSize: 10, fontFamily: T.fontMono }}
              formatter={(val, name) => [typeof val === "number" ? pct(val, 2) : "gap", name]} labelFormatter={(d) => `${d}`} />
            <ReferenceLine y={0} stroke={T.textMuted} strokeDasharray="3 3" label={{ value: "0%", fontSize: 8, fill: T.textMuted, position: "insideTopLeft" }} />
            {drawn.map((s, i) => {
              const k = syms.indexOf(s) === 0 ? "anchor" : "comparison";
              return <Line key={s} type="linear" dataKey={s} name={s} stroke={LINE[k].stroke} strokeDasharray={LINE[k].dash || undefined}
                dot={false} strokeWidth={i === 0 ? 2 : 1.6} connectNulls={false} isAnimationActive={false} />;
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Accessible inspection: the same points, as a table, keyboard- and reader-reachable. */}
      <details style={{ marginTop: 2 }}>
        <summary style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted, cursor: "pointer", letterSpacing: "0.08em" }}>▸ INSPECT CHART VALUES (date · YTD %)</summary>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textSecondary, marginTop: 4 }}>
            <thead><tr><th style={{ textAlign: "left", padding: "1px 8px 1px 0" }}>date</th>{syms.map((s) => <th key={s} style={{ textAlign: "right", padding: "1px 8px" }}>{s}</th>)}</tr></thead>
            <tbody>{sample.map((p) => (
              <tr key={p.date}><td style={{ padding: "1px 8px 1px 0" }}>{p.date}</td>
                {syms.map((s) => <td key={s} style={{ textAlign: "right", padding: "1px 8px" }}>{typeof p[s] === "number" ? pct(p[s], 2) : "—"}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
};

const Lesson = ({ lesson, simple }) => (
  <div style={{ marginTop: 8, borderLeft: `2px solid ${T.amber}`, padding: "4px 10px" }} role="group" aria-label="Learning moment">
    <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.amber, letterSpacing: "0.1em" }}>LEARNING MOMENT · {lesson.title}</div>
    <div style={{ fontFamily: T.fontSans, fontSize: simple ? T.fsM : T.fsS, color: T.textPrimary, lineHeight: 1.45, marginTop: 2 }}>{lesson.body}</div>
    {!simple && (lesson.example
      ? <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>Worked example — {lesson.example}</div>
      : <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.amber, marginTop: 4 }}>{lesson.exampleUnavailable}</div>)}
  </div>
);

const StockSpotlight = ({ spotlight, simple }) => {
  if (!spotlight || !spotlight.enabled || !spotlight.model || !spotlight.model.pair) return null;
  const m = spotlight.model;
  const syms = [m.pair.anchor, m.pair.comparison];
  const companies = syms.map((s) => m.companies && m.companies[s]).filter(Boolean);
  if (companies.length !== 2) return null;
  const legs = (m.tracker && m.tracker.legs) || {};
  const lesson = m.lesson;
  return (
    <div role="region" aria-label="Stock Spotlight" className="stock-spotlight"
      style={{ padding: "10px 20px", background: T.bg, borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.amber, letterSpacing: "0.12em", textTransform: "uppercase" }}>Stock Spotlight</span>
        <span style={{ fontFamily: T.fontSans, fontSize: T.fsM, color: T.textPrimary }}>{m.pair.anchor} × {m.pair.comparisonLabel} ({m.pair.comparison})</span>
        <span style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted }}>week of {m.pair.weekKey} · next: {m.pair.nextComparison}</span>
        <span style={{ marginLeft: "auto", fontFamily: T.fontMono, fontSize: 8, color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: 3, padding: "0 5px" }}>educational · not advice</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 8 }}>
        {companies.map((c) => <Profile key={c.symbol} c={c} leg={legs[c.symbol]} simple={simple} />)}
      </div>
      {/* Simple: the learning moment comes BEFORE the chart, right after the two compact
          profiles — the widget is a lesson first (review 2026-09-13). Degen keeps chart → lesson. */}
      {simple && lesson && <Lesson lesson={lesson} simple />}
      <div style={{ marginTop: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", minWidth: 0 }} role="group" aria-label="Year-to-date comparison chart">
        <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textMuted, letterSpacing: "0.1em", marginBottom: 2 }}>YTD COMPARISON · total return from 0% at the prior-year close</div>
        <Chart tracker={m.tracker} syms={syms} />
      </div>
      {!simple && lesson && <Lesson lesson={lesson} simple={false} />}
      {simple ? (
        <CollapsedGroup count={companies.length * 7} label="explore the numbers — full assessment, cash, debt, valuation, price trend, inputs & sources" chip={false}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 8, marginTop: 4 }}>
            {companies.map((c) => (
              <div key={c.symbol} style={{ minWidth: 0 }}>
                <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.amber, letterSpacing: "0.1em" }}>{c.symbol} · THE THREE QUESTIONS</div>
                {c.assessment && <FullAssessment a={c.assessment} />}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 8, marginTop: 8 }}>
            {companies.map((c) => <Detail key={c.symbol} c={c} />)}
          </div>
          {lesson && (lesson.example
            ? <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.textSecondary, marginTop: 6, lineHeight: 1.5 }}>Worked example — {lesson.example}</div>
            : <div style={{ fontFamily: T.fontMono, fontSize: T.fsXs, color: T.amber, marginTop: 6 }}>{lesson.exampleUnavailable}</div>)}
          <div style={{ marginTop: 6 }}><Sources companies={companies} tracker={m.tracker} /></div>
        </CollapsedGroup>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 8, marginTop: 8 }}>
            {companies.map((c) => <Detail key={c.symbol} c={c} />)}
          </div>
          <CollapsedGroup count={companies.reduce((n, c) => n + ((c.sources || []).length), 0)} label="sources & calculations — dated citations" chip={false}>
            <Sources companies={companies} tracker={m.tracker} />
          </CollapsedGroup>
        </>
      )}
      <div style={{ fontFamily: T.fontMono, fontSize: 8, color: T.textMuted, marginTop: 4 }}>
        {m.disclaimer}{m.businessDate ? ` · refreshed ${m.businessDate}` : ""}
      </div>
    </div>
  );
};
export default StockSpotlight;
