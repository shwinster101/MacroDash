/* v7.1.5 — CPI: calendar-month pairing, release-aware freshness, and the period in words.

   WHAT THESE PINS EXIST TO PREVENT.

   (1) THE 13-MONTH PAIRING, WHICH LIVED INSIDE A VOTE AND HAD NO TEST AT ALL. `snapshot.js`
   derived YoY as `obs[m] / obs[m + 12]` — twelve ROWS back — and never read either
   observation's date. It was correct only because the caller pre-filters suppressed values,
   so any month BLS suppresses dropped out and the array closed ranks: "12 months prior"
   silently became "13 months prior". Nothing pinned `(a / b - 1) * 100` in any form, which
   is why the defect could sit inside the inflation voter unnoticed. The pins below feed
   synthetic observations WITH a gap and assert the 13-month pairing cannot occur — and the
   NEGATIVE CONTROL runs the retired positional arithmetic over the same fixture, so the old
   code fails the new pin while passing every old one. That is what makes this measure the
   real defect rather than a proxy for it.

   (2) A SUBSTITUTION WEARING A REFUSAL'S CLOTHES. The rule is REFUSE, never substitute
   (v4.1.4): an unpairable month yields NO value and is NAMED in `holes`. A hole that merely
   shortened the array would re-anchor `trend[0]` — the month the CPI vote's drift arm reads —
   with no tell, which is the same silent re-anchoring in a different place.

   (3) A CURRENT PRINT READING STALE, WHICH COSTS A VOTER. Measured: CPI for month M is
   period-dated M-01 and stays the freshest published value for ~71 days, so the flat
   `ageDays > 70` rule marked a perfectly current print STALE for a day or two before every
   release. Release-awareness removes that. Pinned in BOTH directions, because the risk of a
   release calendar is that it captures fields it has no business judging: a calendar-less
   monthly field (PCE, savings, CAPE, unemployment, FEDFUNDS) must keep the 70-day rule
   BYTE-IDENTICALLY, and a caller that passes no field at all must be unchanged.

   (4) A MONTH-PRECISION OBSERVATION RENDERED AT DAY PRECISION. The one date a reader saw was
   "as of Aug 1" — no year, a day that does not exist as an observation — which is the
   September misreading the owner reported. `cpiPeriodLabel` never guesses: an undatable
   value yields null, and the caller renders nothing rather than a month it does not have. */
import { yoyFromObservations, YOY_TREND_POINTS } from "../src/inflation.js";
import {
  isStale, cadenceOf, monthKey, monthsBefore, expectedRefMonth, nextCpiRelease,
  CPI_RELEASES, CPI_RELEASE_GRACE_D, etYmd,
} from "../src/sources.js";
import { cpiPeriodLabel, cpiPeriodLine, CPI_PERIOD_SUFFIX } from "../src/publicCopy.js";
import { comparisonReading } from "../src/voterSheet.js";
import { factorExclusions } from "../src/evidence.js";
import cronWorker, { cpiReleaseOn } from "../worker/cron.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url));
const readSrc = (p) => readFileSync(join(HERE, p), "utf8").replace(/\r\n/g, "\n");
const stripComments = (s) => s.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");

// A clean monthly index: value = 100 + index, newest first, `months` rows back from `end`.
const seriesFrom = (endMonth, months, valueAt) => {
  const rows = [];
  for (let i = 0; i < months; i++) {
    const m = monthsBefore(endMonth, i);
    rows.push({ date: `${m}-01`, value: String(valueAt(i, m)) });
  }
  return rows;   // newest first, the order FRED serves with sort_order=desc
};

export async function testCpiRelease(ok) {
  // ── month arithmetic: one home, shared by the pairing and the freshness gate ──
  ok("[95] monthKey reads the PERIOD out of both accepted date shapes, and refuses anything else",
    monthKey("2026-08-01") === "2026-08" && monthKey("2026-08-31") === "2026-08" &&
    monthKey("8/1/2026") === "2026-08" && monthKey("") === null && monthKey("not a date") === null);
  ok("[95] monthsBefore crosses a year boundary and refuses a malformed key",
    monthsBefore("2026-01", 12) === "2025-01" && monthsBefore("2026-08", 12) === "2025-08" &&
    monthsBefore("2026-01", 1) === "2025-12" && monthsBefore("2026-8", 12) === null &&
    monthsBefore("2026-08", NaN) === null);

  // ── (1) THE PAIRING, run against a series with a suppressed month ──
  /* The gap is deliberately placed 12 months before the NEWEST period, so under the retired
     positional rule the newest row would have paired against the month BEFORE its true
     comparator — the exact 13-month shift, at the exact place it does the most damage. */
  const withGap = seriesFrom("2026-08", 26, (i) => 100 + (25 - i)).filter((o) => o.date !== "2025-08-01");
  const gapped = yoyFromObservations(withGap);
  ok("[95] a suppressed month REFUSES rather than pairing against 13 months back",
    gapped.holes.length === 1 && gapped.holes[0].startsWith("2026-08 (needs 2025-08)") &&
    gapped.yoy === null && gapped.period === "2026-08");
  ok("[95] the hole is NAMED, and the months that CAN pair still compute",
    gapped.trend.length === YOY_TREND_POINTS - 1 && gapped.trend.every(Number.isFinite) &&
    gapped.points === YOY_TREND_POINTS);
  /* NEGATIVE CONTROL, run in place: the retired positional arithmetic over the SAME fixture.
     It returns a confident number for 2026-08 — paired against 2025-07, thirteen months back —
     which is the defect. A pin that only checked "the trend has six finite points" would have
     passed on this output, which is precisely why the old code shipped untested. */
  ok("[95] negative control: the retired `obs[m + 12]` rule pairs 2026-08 against 2025-07 and " +
     "publishes it as a number — the shape the new pin catches and the old pins could not",
    (() => {
      const yoyAt = (m) => {
        const a = parseFloat(withGap[m]?.value), b = parseFloat(withGap[m + 12]?.value);
        return (isFinite(a) && isFinite(b) && b > 0) ? parseFloat(((a / b - 1) * 100).toFixed(1)) : NaN;
      };
      return withGap[12].date === "2025-07-01" && Number.isFinite(yoyAt(0));
    })());

  // A clean series pairs every month and names no holes.
  const clean = yoyFromObservations(seriesFrom("2026-08", 26, (i) => 100 + (25 - i)));
  ok("[95] a complete series computes every point, names no hole, and dates itself by its own newest row",
    clean.holes.length === 0 && clean.trend.length === YOY_TREND_POINTS &&
    clean.period === "2026-08" && clean.asOf === "2026-08-01" && Number.isFinite(clean.yoy));
  /* Order is asserted against a fixture whose two YoY values are DIFFERENT and hand-computed,
     rather than against the shape of a synthetic ramp — a ramp's YoY direction is an artefact
     of the ramp, so a pin read off it would prove the fixture, not the ordering. */
  ok("[95] the trend runs OLDEST → NEWEST and its last point IS the published YoY",
    (() => {
      const obs = [
        { date: "2026-08-01", value: "103" }, { date: "2026-07-01", value: "101" },
        { date: "2025-08-01", value: "100" }, { date: "2025-07-01", value: "100" },
      ];
      const y = yoyFromObservations(obs);
      return y.trend.length === 2 && y.trend[0] === 1 && y.trend[1] === 3 &&
        y.trend[y.trend.length - 1] === y.yoy && y.period === "2026-08";
    })() && clean.trend[clean.trend.length - 1] === clean.yoy);
  // Arithmetic, against hand-computed values rather than the implementation's own shape.
  ok("[95] the YoY is (latest ÷ same month a year earlier − 1) × 100, to one decimal",
    (() => {
      const obs = [{ date: "2026-08-01", value: "321.5" }, { date: "2025-08-01", value: "310.2" }];
      return yoyFromObservations(obs).yoy === parseFloat(((321.5 / 310.2 - 1) * 100).toFixed(1));
    })());
  ok("[95] fail-closed: an empty pull, a non-array, a zero base and an unparseable date all REFUSE",
    yoyFromObservations([]).yoy === null && yoyFromObservations(null).yoy === null &&
    yoyFromObservations([{ date: "2026-08-01", value: "300" }, { date: "2025-08-01", value: "0" }]).yoy === null &&
    yoyFromObservations([{ date: "nope", value: "300" }]).points === 0);
  ok("[95] a duplicate period keeps the FIRST row — FRED serves newest-first, so a revision " +
     "cannot be overwritten by the vintage beneath it",
    (() => {
      const obs = [{ date: "2026-08-01", value: "330" }, { date: "2026-08-01", value: "300" },
        { date: "2025-08-01", value: "300" }];
      return yoyFromObservations(obs).yoy === 10;
    })());

  // The wiring: snapshot.js must USE it, and the retired expression must be absent.
  const snapSrc = stripComments(readSrc("../functions/api/snapshot.js"));
  ok("[95] snapshot.js derives inflation through the shared module and the positional " +
     "expression is pinned ABSENT",
    /yoyFromObservations\(obs\)/.test(snapSrc) && !/obs\[m \+ 12\]/.test(snapSrc) &&
    /from "\.\.\/\.\.\/src\/inflation\.js"/.test(snapSrc));
  ok("[95] an unpaired month rides the SAME status row as evidence, never a second one",
    /yoy_unpaired: infl\.holes/.test(snapSrc));
  ok("[95] the inflation pull widened to the same 26 points as every other series — calendar " +
     "matching needs slack a positional rule never did",
    /const limit = 26;/.test(snapSrc) && !/INFLATION\.has\(field\) \? 20/.test(snapSrc));

  // ── (2) the trend-length guard: too short to vote is UNAVAILABLE, not a quiet neutral ──
  const prov = { cpiHeadline: "LIVE", cpiTrend: "LIVE" };
  const asOfs = { cpiHeadline: "2026-08-01", cpiTrend: "2026-08-01" };
  const withTrend = (trend) => ({ macro: { cpi: { trend } } });
  const excl = (trend) => factorExclusions({ provenance: prov, dataAsOf: asOfs, liveBuild: true,
    d: withTrend(trend), now: new Date("2026-09-19T12:00:00Z") });
  ok("[95] a one-point CPI trend EXCLUDES the factor — the band's bull arm compares against " +
     "the PREVIOUS print, and one point is not a comparison",
    excl([2.4]).has("cpiHeadline") && excl([]).has("cpiHeadline"));
  ok("[95] two finite points is enough, and a NaN inside an array of two is not",
    !excl([2.6, 2.4]).has("cpiHeadline") && excl([NaN, 2.4]).has("cpiHeadline"));
  ok("[95] the guard is OPT-IN — a caller that passes no `d` is byte-identical to v7.1.0",
    !factorExclusions({ provenance: prov, dataAsOf: asOfs, liveBuild: true,
      now: new Date("2026-09-19T12:00:00Z") }).has("cpiHeadline"));

  // ── (3) release-aware freshness, pinned in BOTH directions ──
  ok("[95] the release calendar is chronological, dated, and maps each release to the month " +
     "it reports — a table out of order would make the expected-month walk lie",
    CPI_RELEASES.length > 0 &&
    CPI_RELEASES.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.release) && /^\d{4}-\d{2}$/.test(r.refMonth)) &&
    CPI_RELEASES.every((r, i) => i === 0 || r.release > CPI_RELEASES[i - 1].release) &&
    CPI_RELEASES.every((r, i) => i === 0 || r.refMonth > CPI_RELEASES[i - 1].refMonth) &&
    // the reported month always precedes its release, or the table describes time travel
    CPI_RELEASES.every((r) => r.refMonth < r.release.slice(0, 7)));
  /* THE EXPIRY TRIPWIRE, the FOMC_MEETINGS precedent. This table is ASSERTED (bls.gov is
     unreachable from this build environment), so it cannot be allowed to rot silently: a
     calendar that has run out stops judging, which is safe but returns CPI to the flat rule
     without anyone noticing. RED under 90 days of runway forces the refill. */
  ok("[95] EXPIRY TRIPWIRE: the CPI release table has more than 90 days of runway left " +
     `(last entry ${CPI_RELEASES[CPI_RELEASES.length - 1].release})`,
    (() => {
      const last = new Date(`${CPI_RELEASES[CPI_RELEASES.length - 1].release}T00:00:00`);
      return (last - new Date(`${etYmd(new Date())}T00:00:00`)) / 86400000 > 90;
    })());

  const AT = (ymd) => new Date(`${ymd}T12:00:00`);
  /* The measured cry-wolf: July's print (period 2026-07-01) is 71 days old on 2026-09-10, the
     morning August's is released. The flat rule calls it STALE — dropping a VOTER — while the
     release rule correctly says the next scheduled print has not landed yet. */
  ok("[95] the cry-wolf this closes: a CURRENT print reads stale under the flat rule and " +
     "fresh under the release rule, on the same date",
    isStale("2026-07-01", AT("2026-09-10"), "monthly") === true &&
    isStale("2026-07-01", AT("2026-09-10"), "monthly", "cpiHeadline") === false);
  ok("[95] a genuinely MISSED release is stale once the scheduled date plus its grace has passed",
    isStale("2026-07-01", AT("2026-09-14"), "monthly", "cpiHeadline") === false &&
    isStale("2026-07-01", AT("2026-09-15"), "monthly", "cpiHeadline") === true);
  ok("[95] the grace is the asserted calendar's safety margin, and it is real",
    CPI_RELEASE_GRACE_D >= 3 &&
    expectedRefMonth("cpiHeadline", AT("2026-09-14")) === "2026-07" &&
    expectedRefMonth("cpiHeadline", AT("2026-09-15")) === "2026-08");
  ok("[95] the freshest published print is never stale, whatever the day of the month",
    ["2026-09-01", "2026-09-10", "2026-09-19", "2026-09-30", "2026-10-12"]
      .every((day) => isStale("2026-08-01", AT(day), "monthly", "cpiHeadline") === false));
  ok("[95] a feed dead for years is still STALE under the release rule — release-awareness " +
     "is not a bypass",
    isStale("2019-10-01", AT("2026-09-19"), "monthly", "cpiHeadline") === true);
  ok("[95] cpiCore rides the same calendar, and cpiTrend inherits it through DERIVED_OF " +
     "(its parent's calendar, the way cadenceOf already resolves its parent's cadence)",
    isStale("2026-07-01", AT("2026-09-10"), "monthly", "cpiCore") === false &&
    isStale("2026-07-01", AT("2026-09-10"), "monthly", "cpiTrend") === false);

  /* BOTH DIRECTIONS. A release calendar that captured a field it has no business judging
     would be worse than the flat number it replaces — PCE is a BEA release on a different
     schedule, and the others are not inflation at all. Each must be byte-identical. */
  for (const field of ["pceHeadline", "pceCore", "savings", "shillerPe", "unemployment", "fedFunds"])
    ok(`[95] ${field} has NO calendar and keeps the flat 70-day rule byte-identically`,
      expectedRefMonth(field, AT("2026-09-19")) === null &&
      isStale("2026-07-01", AT("2026-09-10"), "monthly", field) ===
        isStale("2026-07-01", AT("2026-09-10"), "monthly"));
  ok("[95] a caller that passes no field is unchanged, and the cadence TOKEN did not fork",
    isStale("2026-05-01", AT("2026-06-08"), "monthly") === false &&
    isStale("2026-03-01", AT("2026-06-08"), "monthly") === true &&
    cadenceOf("cpiHeadline") === "monthly" && cadenceOf("cpiCore") === "monthly" &&
    cadenceOf("cpiTrend") === "monthly");
  ok("[95] weekly is untouched — the release branch is monthly-only",
    isStale("2026-06-04", AT("2026-06-10"), "weekly") === false &&
    isStale("2026-06-04", AT("2026-06-25"), "weekly") === true &&
    isStale("2026-06-04", AT("2026-06-25"), "weekly", "cpiHeadline") === true);
  /* Past the end of the table the rule DEGRADES TO THE FLAT ONE rather than failing fully
     open. ⚠ Correction to this release's own plan, which said "fail open": a calendar that
     has run out cannot say a release was missed, but a feed dead since 2019 must still read
     STALE, so the pre-v7.1.5 behaviour is the honest floor. */
  ok("[95] past the end of the calendar the gate degrades to the flat rule, never fully open",
    (() => {
      const after = AT("2099-01-01");
      return expectedRefMonth("cpiHeadline", after) === null &&
        isStale("2098-10-01", after, "monthly", "cpiHeadline") === true &&
        isStale("2098-12-01", after, "monthly", "cpiHeadline") === false;
    })());
  ok("[95] nextCpiRelease returns the next scheduled release and NULL past the end — never " +
     "an extrapolated date (the nextFomcDate rule)",
    nextCpiRelease(AT(CPI_RELEASES[0].release)).release === CPI_RELEASES[0].release &&
    nextCpiRelease(AT("2099-01-01")) === null);

  // ── (4) the period, in words ──
  ok("[95] cpiPeriodLabel renders the reported MONTH and YEAR, not a day",
    cpiPeriodLabel("2026-08-01") === "August 2026" && cpiPeriodLabel("2026-01-01") === "January 2026" &&
    !/\b1\b/.test(cpiPeriodLabel("2026-08-01")));
  ok("[95] cpiPeriodLine adds the one thing a date cannot say — that nothing newer exists yet",
    cpiPeriodLine("2026-08-01") === `August 2026 · ${CPI_PERIOD_SUFFIX}` &&
    CPI_PERIOD_SUFFIX === "latest published");
  ok("[95] an undatable value yields NULL in both — never a guessed month",
    cpiPeriodLabel(null) === null && cpiPeriodLabel("") === null && cpiPeriodLabel("nope") === null &&
    cpiPeriodLine(undefined) === null);
  ok("[95] the voter sheet's bullet 2 names the period, and withholds it when undated",
    (() => {
      const d = { macro: { cpi: { trend: [3.1, 2.9, 2.8, 2.7, 2.6, 2.4] } } };
      const metric = { value: 2.4, text: "2.4%" };
      const dated = comparisonReading("cpiHeadline", d, metric, "2026-08-01");
      const undated = comparisonReading("cpiHeadline", d, metric);
      return dated.current === "2.4% YoY (August 2026 · latest published)" &&
        undated.current === "2.4% YoY" && dated.context === undated.context;
    })());
  ok("[95] the period is derived ONCE in the orchestrator and handed to both surfaces, so the " +
     "strip tile and the macro row can never name different months",
    (() => {
      const dash = stripComments(readSrc("../src/dashboard.jsx"));
      return /const cpiPeriodWords=cpiPeriodLabel\(dataAsOf\?\.cpiHeadline\)/.test(dash) &&
        /const cpiPeriodFull=cpiPeriodLine\(dataAsOf\?\.cpiHeadline\)/.test(dash) &&
        (dash.match(/cpiPeriod=\{cpiPeriodWords\}/g) || []).length === 2 &&
        /cpiPeriod=\{cpiPeriodFull\}/.test(dash);
    })());
  ok("[95] neither section computes the label itself — presentation only (the v3.73 boundary)",
    (() => {
      const strip = readSrc("../src/sections/MacroStrip.jsx");
      const regime = readSrc("../src/sections/MacroRegime.jsx");
      return !/cpiPeriodLabel|cpiPeriodLine|publicCopy/.test(strip) &&
        !/cpiPeriodLabel|cpiPeriodLine|publicCopy/.test(regime) &&
        /cpiPeriod=null/.test(strip) && /cpiPeriod=null/.test(regime);
    })());
  ok("[95] both render sites withhold the line entirely when the period cannot be dated",
    (() => {
      const strip = stripComments(readSrc("../src/sections/MacroStrip.jsx"));
      const regime = stripComments(readSrc("../src/sections/MacroRegime.jsx"));
      return /cpiPeriod\?` · \$\{cpiPeriod\}`:""/.test(strip) && /\{cpiPeriod&&<div/.test(regime);
    })());

  // ── the release-day cron arm ──
  const cronSrc = readSrc("../worker/cron.js");
  const cronCode = stripComments(cronSrc);
  ok("[95] the release-day arm is GATED on the shared calendar, and reads it from ONE home",
    /import \{ CPI_RELEASES \} from "\.\.\/src\/sources\.js"/.test(cronCode) &&
    /const rel = cpiReleaseOn\(etDate\)/.test(cronCode));
  // The gate RUN both ways. A source pin alone cannot tell a live arm from a disabled one.
  ok("[95] the gate fires on a scheduled release date and on no other day",
    cpiReleaseOn(CPI_RELEASES[0].release)?.refMonth === CPI_RELEASES[0].refMonth &&
    cpiReleaseOn(CPI_RELEASES[3].release)?.refMonth === CPI_RELEASES[3].refMonth &&
    cpiReleaseOn("2026-09-11") === null && cpiReleaseOn(etYmd(new Date())) ===
      (CPI_RELEASES.find((r) => r.release === etYmd(new Date())) || null));
  /* THE DISPATCH, DRIVEN. The first negative control disabled the arm with `false &&` and the
     suite stayed GREEN, because the pin matched the comparison's text rather than its effect —
     recorded rather than quietly fixed, and closed here: the arm is fired against a fake KV
     and must leave its own per-job heartbeat. On a non-release day (almost every run) that
     heartbeat carries the SKIP, because "did not fire" and "never ran" are different facts and
     a silent no-op reads exactly like a cron that never ran (the v6.0 T2 rule). */
  ok("[95] firing the 8:45am arm leaves a per-job heartbeat — a disabled arm leaves none",
    await (async () => {
      const m = new Map();
      const kv = { _m: m, async get(k, t) { const v = m.get(k); return t === "json" && v ? JSON.parse(v) : (v ?? null); },
        async put(k, v) { m.set(k, v); },
        async list({ prefix, limit }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).slice(0, limit).map((name) => ({ name })) }; } };
      const realFetch = globalThis.fetch, realErr = console.error;
      globalThis.fetch = async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
      console.error = () => {};
      /* TRY/CATCH AROUND THE DRIVE, and it is load-bearing rather than defensive. A disabled
         arm falls THROUGH to the legacy FRED path, which throws on the absent FRED_KEY — so
         the first run of this pin killed the process with no total, which reads exactly like
         a suite that passed (the v3.99.4 P0 shape). A throw is a RED assertion here, never a
         dead run; recorded rather than quietly patched. */
      const waits = [];
      try {
        await cronWorker.scheduled({ cron: "45 12 * * MON-FRI" }, { PULSE_CACHE: kv }, { waitUntil: (p) => waits.push(p) });
        await Promise.all(waits);
      } catch { /* fall-through to the legacy arm — the heartbeat check below reports it */ }
      finally { globalThis.fetch = realFetch; console.error = realErr; }
      const hb = JSON.parse(m.get("pulse:cron:lastwarm:cpi-845amET") || "null");
      if (!hb) return false;
      // The gate decides which shape: today is a release day, or it is not. Both are records.
      return cpiReleaseOn(etYmd(new Date()))
        ? hb.cpi_release === etYmd(new Date())
        : hb.skipped === "not a CPI release day";
    })());
  ok("[95] the arm carries its EST variant beside it, like every other snapshot constant",
    /SNAPSHOT_CPI_CRON = "45 12 \* \* MON-FRI"; \/\/ 8:45am America\/New_York \(EDT\); EST -> "45 13 \* \* MON-FRI"/.test(cronSrc));
  /* WHY THE ARM EXISTS AT ALL, pinned so the reason survives the next person who reads the
     10am cron and concludes it is redundant: readoutQuality is built from Engine 0's checks
     and CPI is not one of them, so `improved` is false and a degraded unrelated leg rejects
     the whole candidate — pinning the pre-release value for the rest of the ET day. */
  ok("[95] the reason the 10am cron is NOT a substitute is recorded where the constant lives",
    /improved` comes back false|improved` comes back `false`|improved` comes back false\./.test(cronSrc) ||
    /CPI IS NOT ONE OF THEM/.test(cronSrc));
}
