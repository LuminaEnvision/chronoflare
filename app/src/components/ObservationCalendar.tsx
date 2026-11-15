import { adjacentValueDate, comparisonDay } from "../data/exploration-state";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  coherentSearch,
  nearestValueDate,
  sameDayInYear,
} from "../data/calendar-choice";
import { niceCeiling } from "../data/chart-scale";
import { locationSearch, subscribeLocation } from "../data/experimental-solar";
import { formatDate, formatMetric } from "../data/format";
import {
  calendarFocusTarget,
  loadObservationManifest,
  missingYears,
  observationIssues,
  loadObservationYear,
  navigateObservation,
  observationSelection,
  observationSources,
  readingFor,
  readingLabels,
  sourceLabels,
  yearDates,
} from "../data/observations";
import type {
  ObservationDay,
  ObservationManifest,
  ObservationSource,
  ObservationYear,
} from "../data/observations";
import {
  loadResearchEvidence,
  sampleRoleLabels,
} from "../data/research-evidence";
import type { ResearchEvidence } from "../data/research-evidence";
import { frpColor, frpScaleTicks } from "../data/frp-color";
import { loadHarmonizationPairs } from "../data/harmonization-pairs";
import type { PairRow } from "../data/harmonization-pairs";
import { ChronoLoader } from "./ChronoLoader";

// Short per-cell labels; the full explanation stays in the legend and the day panel.
const cellLabels: Record<keyof typeof readingLabels, string> = {
  ...readingLabels,
  not_publishable: "No estimate",
  no_positive_records: "No positive records",
  estimated: "Calibrated estimate",
  both_turns: "Day and night recorded",
  partial_turns: "One turn only",
};
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export default function ObservationCalendar() {
  const [manifest, setManifest] = useState<ObservationManifest>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    loadObservationManifest(controller.signal)
      .then(setManifest)
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Unable to load manifest");
      });
    return () => controller.abort();
  }, [attempt]);
  if (error)
    return (
      <section className="panel notice" role="alert">
        <h2>Real-data calendar unavailable</h2>
        <p>{error}</p>
        <button onClick={() => setAttempt((a) => a + 1)}>
          Retry real-data export
        </button>
        <button
          className="text-button"
          onClick={() => navigateObservation({ calendar_data: "experimental" })}
        >
          Open real August 2020 review ↗
        </button>
      </section>
    );
  if (!manifest)
    return (
      <ChronoLoader
        open
        variant="panel"
        message="Loading real-data provenance…"
      />
    );
  return <Calendar manifest={manifest} />;
}
function Calendar({ manifest }: { manifest: ObservationManifest }) {
  const [research, setResearch] = useState<ResearchEvidence>();
  useEffect(() => {
    const controller = new AbortController();
    loadResearchEvidence(controller.signal)
      .then((r) => {
        if (!controller.signal.aborted) setResearch(r);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  // Presentation-only companions of each estimate; absent values stay unavailable.
  const [pairs, setPairs] = useState<Map<string, PairRow>>();
  useEffect(() => {
    const controller = new AbortController();
    loadHarmonizationPairs(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setPairs(new Map(data.rows.map((row) => [row.date, row])));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const search = useSyncExternalStore(subscribeLocation, locationSearch);
  const { year, date, source, compareYear } = observationSelection(
    search,
    manifest,
  );
  const [loaded, setLoaded] = useState<{
    key: string;
    years: ObservationYear[];
  }>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const key = `${year}/${compareYear ?? ""}`;
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all(
      [year, ...(compareYear ? [compareYear] : [])].map((y) =>
        loadObservationYear(manifest, y, controller.signal),
      ),
    )
      .then((years) => {
        if (!controller.signal.aborted) setLoaded({ key, years });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Unable to load year");
      });
    return () => controller.abort();
  }, [manifest, year, compareYear, key, attempt]);
  const current = loaded?.key === key ? loaded.years : [];
  const primary = current.find((y) => y.year === year);
  const byDate = useMemo(
    () => new Map(primary?.days.map((d) => [d.date, d]) ?? []),
    [primary],
  );
  const [focusedDay, setFocusedDay] = useState(date);
  useEffect(() => setFocusedDay(date), [date]);
  // After a choice made in the calendar or controls, bring its result into view.
  const detailsRef = useRef<HTMLElement>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);
  const reveal = useRef<"details" | "comparison" | null>(null);
  const comparisonReady = current.length === 2;
  useEffect(() => {
    const target =
      reveal.current === "details"
        ? detailsRef.current
        : reveal.current === "comparison" && comparisonReady
          ? comparisonRef.current
          : null;
    if (!target) return;
    reveal.current = null;
    target.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [date, compareYear, comparisonReady, primary]);
  // Explain a link the calendar had to adjust, then make the address match the screen.
  const [issues, setIssues] = useState<{ notes: string[]; search: string }>();
  useEffect(() => {
    const notes = observationIssues(search, manifest);
    if (notes.length) {
      const corrected = coherentSearch(search, manifest);
      setIssues({ notes, search: corrected });
      const url = new URL(window.location.href);
      url.search = corrected;
      window.history.replaceState(window.history.state, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else
      setIssues((shown) =>
        shown && shown.search !== search ? undefined : shown,
      );
  }, [search, manifest]);
  // After the person switches year, land on a date that has a value and say so.
  const yearSwitch = useRef<string | null>(null);
  const [yearPick, setYearPick] = useState<{ date: string; note: string }>();
  useEffect(() => {
    const wanted = yearSwitch.current;
    if (!wanted || !primary || !wanted.startsWith(`${primary.year}-`)) return;
    yearSwitch.current = null;
    if (readingFor(byDate.get(wanted), source).value !== null) return;
    const nearest = nearestValueDate(primary, source, wanted);
    if (!nearest) return;
    setYearPick({
      date: nearest,
      note: `${formatDate(wanted)} has no value in this series, so the nearest date with one is selected: ${formatDate(nearest)}.`,
    });
    const url = new URL(window.location.href);
    url.searchParams.set("obs_date", nearest);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [primary, byDate, source]);
  const gaps = missingYears(manifest);
  const previousValue = primary
    ? adjacentValueDate(primary, source, date, "previous")
    : null;
  const nextValue = primary
    ? adjacentValueDate(primary, source, date, "next")
    : null;
  const selected = byDate.get(date);
  const reading = readingFor(selected, source);
  const dates = yearDates(year);
  const counts = dates.reduce(
    (acc, d) => {
      const r = readingFor(byDate.get(d), source);
      if (r.value !== null) acc.values++;
      if (r.status === "partial_turns") acc.partial++;
      if (r.status === "not_acquired") acc.unacquired++;
      return acc;
    },
    { values: 0, partial: 0, unacquired: 0 },
  );
  return (
    <div className="observation-experience">
      <aside className="observation-notice">
        <strong>
          {source === "harmonized"
            ? "REAL NASA INPUTS · CALIBRATED ESTIMATES"
            : "REAL OBSERVATIONS · NASA FIRMS"}
        </strong>
        <span>
          Pantanal · IBGE 2025 reference. Missing records do not mean zero fire
          activity.
        </span>
      </aside>
      {issues && (
        <aside className="notice observation-issues" role="status">
          <strong>
            This link asked for something the calendar does not have
          </strong>
          {issues.notes.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </aside>
      )}
      <section
        className="panel observation-controls"
        aria-label="Real-data selection"
      >
        <label>
          Series
          <select
            aria-label="Series"
            value={source}
            onChange={(e) =>
              navigateObservation({ obs_source: e.target.value })
            }
          >
            {observationSources.map((s) => (
              <option
                key={s}
                value={s}
                disabled={s === "harmonized" && !manifest.approval}
              >
                {sourceLabels[s]}
                {s === "harmonized" && !manifest.approval
                  ? " · publication pending"
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Year
          <select
            aria-label="Year"
            value={year}
            onChange={(e) => {
              const wanted = sameDayInYear(date, e.target.value);
              yearSwitch.current = wanted;
              navigateObservation({
                obs_year: e.target.value,
                obs_date: wanted,
                ...(Number(e.target.value) === compareYear
                  ? { obs_compare: "" }
                  : {}),
              });
            }}
          >
            {manifest.years.map((y) => (
              <option key={y.year} value={y.year}>
                {y.year}
              </option>
            ))}
          </select>
        </label>
        <label>
          Inspect a date
          <input
            type="date"
            aria-label="Inspect a date"
            min={`${year}-01-01`}
            max={`${year}-12-31`}
            value={date}
            onChange={(e) => {
              if (!e.target.value) return;
              reveal.current = "details";
              navigateObservation({ obs_date: e.target.value });
            }}
          />
        </label>
        <button
          type="button"
          onClick={() =>
            detailsRef.current?.scrollIntoView({
              block: "start",
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "auto"
                : "smooth",
            })
          }
        >
          View selected day details
        </button>
        <label>
          Compare with
          <select
            aria-label="Compare with"
            value={compareYear ?? ""}
            onChange={(e) => {
              reveal.current = e.target.value ? "comparison" : null;
              navigateObservation({ obs_compare: e.target.value });
            }}
          >
            <option value="">No comparison</option>
            {manifest.years
              .filter((y) => y.year !== year)
              .map((y) => (
                <option key={y.year} value={y.year}>
                  {y.year}
                </option>
              ))}
          </select>
        </label>
      </section>
      {source === "harmonized" && manifest.approval && (
        <aside className="notice observation-approval">
          <details>
            <summary>
              <strong>Plan A · approved v2</strong>
              <span>both MODIS platforms complete</span>
              {research && (
                <>
                  <span>
                    {research.publication.by_year["2025"]} estimates in 2025 ·{" "}
                    {research.publication.by_year["2026"]} in 2026
                  </span>
                  <span>
                    {
                      research.publication.by_sample_role
                        .training_window_in_sample
                    }
                    /{research.publication.total_days} dates in the training
                    period
                  </span>
                  <span>no independent backward test</span>
                </>
              )}
              <em>Details</em>
            </summary>
            <p>{manifest.approval.approved_claim}</p>
            <p>
              Dates in the training period are not validation evidence. Terra
              night is aligned to the following reference date; native
              observations retain their original solar date.
            </p>
            {research && (
              <p>
                The independent test used{" "}
                {research.v2.combined_forward.paired_days} paired days.
                Publication requires both complete platforms, so only{" "}
                {research.publication.by_sample_role.independent_holdout}{" "}
                published dates belong to that holdout.
              </p>
            )}
          </details>
        </aside>
      )}
      {error ? (
        <section className="panel notice" role="alert">
          <h2>Observations could not be verified</h2>
          <p>{error}</p>
          <button onClick={() => setAttempt((a) => a + 1)}>
            Retry year data
          </button>
        </section>
      ) : !primary ? (
        <ChronoLoader
          open
          variant="panel"
          message={`Verifying ${year}${compareYear ? ` and ${compareYear}` : ""} observations…`}
        />
      ) : (
        <>
          <section
            className="panel observation-calendar"
            aria-labelledby="observation-heading"
          >
            <div className="observation-section-heading">
              <div>
                <span className="eyebrow">BURNING ACTIVITY CALENDAR</span>
                <h2 id="observation-heading">
                  {year} · {sourceLabels[source]}
                </h2>
              </div>
              <span>
                {counts.values} days with values
                {counts.partial > 0 ? ` · ${counts.partial} partial` : ""}
              </span>
            </div>
            <p>
              Select a day square to see its value, uncertainty and available
              references below. Or use Inspect a date and View selected day details
              above. Blank days do not mean no fire.
            </p>
            {yearPick?.date === date && (
              <p className="observation-year-pick" role="status">
                {yearPick.note}
              </p>
            )}
            <p>
              FRP sum in MW
              {source === "harmonized"
                ? " on the calibrated VIIRS reference scale"
                : " from selected positive records"}
              . Coverage remains unknown. No annual total or anomaly is inferred
              from gaps.
            </p>
            <p className="observation-scroll-hint" aria-hidden="true">
              Scroll sideways for days 10–31 →
            </p>
            <div
              className="observation-grid-scroll"
              tabIndex={0}
              aria-label="Month and day calendar; scroll horizontally on small screens"
            >
              <div
                className="observation-grid"
                role="group"
                aria-label={`${year} daily FRP`}
              >
                <div className="observation-month">
                  <span>DAY</span>
                  {Array.from({ length: 31 }, (_, i) => (
                    <span key={i}>{i + 1}</span>
                  ))}
                </div>
                {months.map((month, index) => (
                  <div className="observation-month" key={month}>
                    <span>{month.slice(0, 3).toUpperCase()}</span>
                    {Array.from({ length: 31 }, (_, i) => {
                      const day = `${year}-${String(index + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                      if (!dates.includes(day))
                        return (
                          <span
                            className="observation-invalid"
                            key={i}
                            aria-hidden="true"
                          />
                        );
                      const r = readingFor(byDate.get(day), source);
                      return (
                        <button
                          key={day}
                          data-observation-date={day}
                          tabIndex={day === focusedDay ? 0 : -1}
                          onFocus={() => setFocusedDay(day)}
                          onKeyDown={(event) => {
                            const next = calendarFocusTarget(day, event.key);
                            if (!next) return;
                            event.preventDefault();
                            setFocusedDay(next);
                            event.currentTarget
                              .closest(".observation-grid")
                              ?.querySelector<HTMLButtonElement>(
                                `[data-observation-date="${next}"]`,
                              )
                              ?.focus();
                          }}
                          className={`observation-cell ${r.status} ${day === date ? "selected" : ""} ${r.extrapolated ? "extrapolated" : ""}`}
                          style={
                            r.value !== null
                              ? { backgroundColor: frpColor(r.value) }
                              : undefined
                          }
                          aria-pressed={day === date}
                          aria-label={`${formatDate(day)}: ${r.value === null ? cellLabels[r.status] : `${formatMetric(r.value)} MW; ${cellLabels[r.status]}`}${r.extrapolated ? "; beyond training range" : ""}`}
                          title={`${day} · ${r.value === null ? cellLabels[r.status] : `${formatMetric(r.value)} MW`}`}
                          onClick={() => {
                            reveal.current = "details";
                            navigateObservation({ obs_date: day });
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="legend observation-legend">
              <span>
                <i
                  className="observation-key"
                  style={{ backgroundColor: frpColor(1000) }}
                />
                {source === "harmonized"
                  ? "Calibrated estimate"
                  : "Positive FRP"}
              </span>
              {counts.partial > 0 && (
                <span>
                  <i className="observation-key partial_turns" />
                  One native turn
                </span>
              )}
              <span>
                <i className="observation-key no_positive_records" />
                {source === "harmonized"
                  ? "No estimate · needs both MODIS platforms complete"
                  : "No positive records"}
              </span>
              <span>
                <i className="observation-key not_acquired" />
                Not acquired
              </span>
              {source === "harmonized" && (
                <span>
                  <i className="observation-key extrapolated" />
                  Beyond training range
                </span>
              )}
            </div>
            <div
              className="observation-scale"
              aria-label="Logarithmic FRP color scale in MW"
            >
              {frpScaleTicks.map((value) => (
                <span key={value}>
                  <i style={{ backgroundColor: frpColor(value) }} />
                  {formatMetric(value)}
                  {value === 100000 ? "+" : ""} MW
                </span>
              ))}
            </div>
            <p className="footnote">
              Arrow keys move focus; Enter or Space selects a day. Fixed
              logarithmic color scale: 0 to 100,000+ MW, shared by both years.
              Color shows magnitude, not confidence.{" "}
              {counts.unacquired > 0 &&
                `${counts.unacquired} calendar dates were not acquired in this year. `}
              {gaps.length > 0 && `Not acquired at all: ${gaps.join(", ")}. `}
              Native platforms have different sensitivities; compare years
              within one series.
            </p>
          </section>
          <section
            ref={detailsRef}
            className="panel observation-details"
            aria-live="polite"
            aria-labelledby="observed-day-heading"
          >
            <span className="eyebrow">INSPECT A SOLAR DAY</span>
            <h2 id="observed-day-heading">{formatDate(date)}</h2>
            <div className="observation-value">
              {reading.value === null
                ? "Not available"
                : `${formatMetric(reading.value)} MW`}
            </div>
            <p>{readingLabels[reading.status]}</p>
            {reading.value === null && (
              <p>
                This gap does not mean zero fire activity.
                {source === "harmonized"
                  ? " Publication requires complete aligned day and night inputs from both Terra and Aqua. Use Next available estimate or Previous available estimate to inspect a published date in this year. Native observations, when present, are listed below."
                  : " No value is published for this selection; observation coverage remains unknown."}
              </p>
            )}
            <div
              className="observation-value-navigation"
              role="group"
              aria-label="Navigate dates with values"
            >
              <button
                disabled={!previousValue}
                onClick={() =>
                  previousValue &&
                  navigateObservation({ obs_date: previousValue })
                }
              >
                {source === "harmonized"
                  ? "Previous available estimate"
                  : "Previous recorded value"}
              </button>
              <button
                disabled={!nextValue}
                onClick={() =>
                  nextValue && navigateObservation({ obs_date: nextValue })
                }
              >
                {source === "harmonized"
                  ? "Next available estimate"
                  : "Next recorded value"}
              </button>
              <span>
                Within {year}; gaps are preserved. Native recorded values may
                contain only one turn.
              </span>
            </div>
            {source === "harmonized" && reading.value !== null && (
              <p className="observation-role">
                {research?.publication.roles_by_date[date]
                  ? sampleRoleLabels[research.publication.roles_by_date[date]]
                  : "Sample role unavailable · do not infer validation from agreement on this date"}
              </p>
            )}
            {source === "harmonized" && reading.value !== null && (
              <dl className="observation-turns observation-companions">
                <div>
                  <dt>S-NPP observed, same solar date</dt>
                  <dd>
                    {pairs?.get(date)?.snpp_mw != null
                      ? `${formatMetric(pairs.get(date)!.snpp_mw)} MW`
                      : pairs?.has(date)
                        ? "Unavailable · S-NPP lacks a day or night turn"
                        : "Unavailable"}
                  </dd>
                </div>
                <div>
                  <dt>Uncalibrated MODIS benchmark</dt>
                  <dd>
                    {pairs?.has(date)
                      ? `${formatMetric(pairs.get(date)!.benchmark_mw)} MW`
                      : "Unavailable"}
                  </dd>
                </div>
              </dl>
            )}
            {source === "harmonized" && reading.value === null && selected && (
              <dl className="observation-turns observation-natives">
                {(["terra", "aqua", "snpp"] as const).map((platform) => {
                  const native = readingFor(selected, platform);
                  return (
                    <div key={platform}>
                      <dt>{sourceLabels[platform]}, native</dt>
                      <dd>
                        {native.value === null
                          ? "No selected positive records"
                          : `${formatMetric(native.value)} MW${native.status === "partial_turns" ? " · one turn only" : ""}`}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
            {reading.count !== null && (
              <p>{formatMetric(reading.count)} selected thermal detections</p>
            )}
            {reading.lower !== undefined && (
              <p>
                Empirical 80% interval: {formatMetric(reading.lower)}–
                {formatMetric(reading.upper!)} MW.{" "}
                {reading.extrapolated
                  ? "Beyond the training range; interval inflation applied."
                  : "Within the model's recorded training-range policy."}
              </p>
            )}
            {selected && source !== "harmonized" && (
              <dl className="observation-turns">
                {(["day", "night"] as const).map((t) => (
                  <div key={t}>
                    <dt>{t === "day" ? "Day turn" : "Night turn"}</dt>
                    <dd>
                      {selected[source][t]
                        ? `${formatMetric(selected[source][t]!.frp_mw)} MW · ${selected[source][t]!.count} detections`
                        : "No selected positive records"}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="footnote">
              Fixed regional solar reference UTC−03:46:36; a native date runs
              from 03:46:36 UTC to the same time the following day. No positive
              records does not establish zero fire activity.
            </p>
            <button
              className="text-button"
              onClick={() => navigateObservation({ view: "map" })}
            >
              Open the separate August 2020 detection explorer →
            </button>
            <p className="footnote">
              The map is a separate review batch, not the exact detections
              behind every calendar cell.
            </p>
          </section>
          {compareYear && current.length === 2 && (
            <div ref={comparisonRef}>
              <ObservationComparison
                years={current}
                source={source}
                onInspect={(d, y) =>
                  navigateObservation({
                    obs_year: String(y),
                    obs_date: d,
                    obs_compare: String(y === year ? compareYear : year),
                  })
                }
              />
            </div>
          )}
        </>
      )}
      <details className="panel">
        <summary>Dataset provenance</summary>
        <p>
          {manifest.region_name} · coverage unknown ·{" "}
          {manifest.quality_rule_version} · {manifest.dedup_rule_version}
        </p>
        <a href="/data/observations/v1/manifest.json">
          Observation manifest, source hashes and year assets ↗
        </a>
      </details>
      <p className="footnote">
        Source:{" "}
        <a href="https://firms.modaps.eosdis.nasa.gov/">
          NASA FIRMS Standard Processing
        </a>{" "}
        ·{" "}
        <button
          className="text-button"
          onClick={() => navigateObservation({ view: "methodology" })}
        >
          Method, evidence and limitations
        </button>{" "}
        · <a href="/ai-disclosure.json">AI assistance disclosure</a>
      </p>
    </div>
  );
}
function ObservationComparison({
  years,
  source,
  onInspect,
}: {
  years: ObservationYear[];
  source: ObservationSource;
  onInspect: (date: string, year: number) => void;
}) {
  const anchor = yearDates(2000);
  const comparisonSearch = useSyncExternalStore(
    subscribeLocation,
    locationSearch,
  );
  const inspection = comparisonDay(comparisonSearch);
  const series = years.map((y) => {
    const rows = new Map(y.days.map((d) => [d.date.slice(5), d]));
    return {
      year: y.year,
      points: anchor.map((a) => ({
        date: `${y.year}-${a.slice(5)}`,
        reading: readingFor(rows.get(a.slice(5)), source),
      })),
    };
  });
  // Native year comparisons use both recorded turns; partial sums remain inspectable in the calendar.
  const usable = (r: ReturnType<typeof readingFor>) =>
    r.status === "both_turns" || r.status === "estimated";
  // Round the shared axis up so its labels are readable; no value is cut off.
  const maximum = niceCeiling(
    Math.max(
      1,
      ...series.flatMap((s) =>
        s.points
          .filter((p) => usable(p.reading))
          .map((p) => p.reading.value ?? 0),
      ),
    ),
  );
  const x = (i: number) => 65 + (i * 875) / 365,
    y = (value: number) => 235 - (value / maximum) * 195;
  const colors = ["#a74620", "#176b8e"];
  return (
    <section className="panel observation-comparison">
      <span className="eyebrow">SAME SERIES · TWO YEARS</span>
      <h2>
        {years[0].year} and {years[1].year} · {sourceLabels[source]}
      </h2>
      <p>
        Aligned by month and day, including February 29. Lines break at missing
        dates. Native comparison requires both recorded turns and excludes
        partial sums; this does not certify observation coverage.
      </p>
      <p className="observation-chart-hint" aria-hidden="true">
        Scroll sideways to see the full year →
      </p>
      <div
        className="observation-chart-scroll"
        tabIndex={0}
        aria-label="Daily comparison chart; scroll horizontally on small screens"
      >
        <svg
          viewBox="0 0 980 290"
          role="img"
          aria-label={`Daily FRP in MW for ${years[0].year} and ${years[1].year}; missing dates are gaps`}
        >
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line
                x1="65"
                x2="940"
                y1={y(f * maximum)}
                y2={y(f * maximum)}
                stroke="#cdd7d1"
              />
              <text
                x="58"
                y={y(f * maximum) + 4}
                textAnchor="end"
                fontSize="11"
              >
                {formatMetric(f * maximum)}
              </text>
            </g>
          ))}
          {months.map((m, i) => {
            const index = anchor.indexOf(
              `2000-${String(i + 1).padStart(2, "0")}-01`,
            );
            return (
              <text key={m} x={x(index)} y="265" fontSize="11">
                {m.slice(0, 3)}
              </text>
            );
          })}
          {series.map((s, i) => {
            let drawing = false;
            const segments = s.points
              .map((p, index) => {
                if (!usable(p.reading)) {
                  drawing = false;
                  return "";
                }
                const command = drawing ? "L" : "M";
                drawing = true;
                return `${command}${x(index).toFixed(2)},${y(p.reading.value!).toFixed(2)}`;
              })
              .join(" ");
            return (
              <path
                key={s.year}
                d={segments}
                fill="none"
                stroke={colors[i]}
                strokeWidth="2"
              />
            );
          })}
          {series.map((s, i) => (
            <g key={`points-${s.year}`} fill={colors[i]}>
              {s.points.map((p, index) =>
                usable(p.reading) ? (
                  <circle
                    key={p.date}
                    cx={x(index)}
                    cy={y(p.reading.value!)}
                    r={
                      !usable(
                        s.points[index - 1]?.reading ?? {
                          status: "not_acquired",
                          value: null,
                          count: null,
                        },
                      ) &&
                      !usable(
                        s.points[index + 1]?.reading ?? {
                          status: "not_acquired",
                          value: null,
                          count: null,
                        },
                      )
                        ? 3
                        : 1.4
                    }
                  >
                    <title>
                      {p.date}: {formatMetric(p.reading.value)} MW
                    </title>
                  </circle>
                ) : null,
              )}
            </g>
          ))}
          <text x="10" y="18" fontSize="11">
            MW
          </text>
        </svg>
      </div>
      <div className="observation-chart-key">
        {series.map((s, i) => (
          <span key={s.year} style={{ color: colors[i] }}>
            ━ {s.year}
          </span>
        ))}
      </div>
      <label>
        Compare a month/day
        <select
          value={inspection}
          onChange={(e) =>
            navigateObservation({ obs_compare_day: e.target.value })
          }
        >
          {anchor.map((d) => (
            <option key={d} value={d.slice(5)}>
              {d.slice(5)}
            </option>
          ))}
        </select>
      </label>
      <div className="observation-comparison-values">
        {series.map((s) => {
          const point = s.points.find((p) => p.date.slice(5) === inspection)!;
          const validDate = yearDates(s.year).includes(point.date);
          return (
            <article key={s.year}>
              <h3>
                {s.year} · {inspection}
              </h3>
              <p>
                {!validDate
                  ? "This date does not exist in this year"
                  : usable(point.reading)
                    ? `${formatMetric(point.reading.value)} MW`
                    : readingLabels[point.reading.status]}
              </p>
              {validDate && (
                <button
                  className="text-button"
                  onClick={() => onInspect(point.date, s.year)}
                >
                  Inspect date →
                </button>
              )}
            </article>
          );
        })}
      </div>
      <p className="footnote">
        No interpolation, annual percentage change or cross-sensor trend is
        inferred. The chart uses a shared linear MW axis; the calendar uses a
        logarithmic color scale.
      </p>
    </section>
  );
}
