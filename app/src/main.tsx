import React, {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import { buildAnnualComparison } from "./data/annual-comparison";
import ComparisonChart from "./components/ComparisonChart";
import { ChronoLoader } from "./components/ChronoLoader";
import { scrollLeftToRevealDay } from "./data/calendar-scroll";
import { loadDataset, calendarSlot } from "./data/load";
import {
  basisMetrics,
  comparisonSource,
  isSelectionDate,
} from "./data/selection";
import { useSelection } from "./hooks/useSelection";
import { activateSelectionLink } from "./data/link-navigation";
import type { ActivityAggregate, Dataset } from "./data/schema";
import "./style.css";
import {
  locationSearch,
  navigateSolar,
  solarSelection,
  subscribeLocation,
} from "./data/experimental-solar";
const ObservationCalendar = lazy(
  () => import("./components/ObservationCalendar"),
);
const ResearchMethodology = lazy(
  () => import("./components/ResearchMethodology"),
);
const ExperimentalCalendar = lazy(
  () => import("./components/ExperimentalCalendar"),
);
import { formatMetric as number, formatDate as dateLabel } from "./data/format";
const DetectionReviewMap = lazy(
  () => import("./components/DetectionReviewMap"),
);

const months = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
function App() {
  const solarLocation = useSyncExternalStore(subscribeLocation, locationSearch);
  const experimentalCalendar = solarSelection(solarLocation).experimental;
  const calendarMode = experimentalCalendar
    ? "experimental"
    : new URLSearchParams(solarLocation).get("calendar_data") === "demo"
      ? "demo"
      : "observations";
  const [dataset, setDataset] = useState<Dataset>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const {
    selection,
    selection: {
      view: page,
      basis,
      date: selectedDate,
      compare,
      years: comparisonYears,
    },
    availableBases,
    dateRange,
    issues: selectionIssues,
    homeHref,
    setPage,
    setBasis: changeBasis,
    setDate: setSelectedDate,
    setCompare,
    setCompareBasis,
    setComparisonYear,
  } = useSelection(dataset);
  useEffect(() => {
    if (page !== "calendar" || calendarMode !== "demo") return;
    let active = true;
    setError("");
    loadDataset()
      .then((d) => {
        if (active) setDataset(d);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Failed to load data");
      });
    return () => {
      active = false;
    };
  }, [attempt, page, calendarMode]);
  const records = useMemo(
    () =>
      dataset?.calendar.records.filter((r) =>
        basis === "harmonized"
          ? r.metric_name === "harmonized_frp_index"
          : r.metric_name === `${basis}_frp_sum`,
      ) ?? [],
    [dataset, basis],
  );
  const years = useMemo(
    () =>
      [...new Set(records.map((r) => r.period_start.slice(0, 4)))]
        .sort()
        .reverse(),
    [records],
  );
  const byDate = useMemo(
    () => new Map(records.map((r) => [r.period_start, r])),
    [records],
  );
  const selected = records.find((r) => r.period_start === selectedDate);
  const source = comparisonSource(selection, availableBases);
  const [comparisonYearA = "", comparisonYearB = ""] =
    comparisonYears.split(",");
  const sourceYears = useMemo(
    () =>
      [
        ...new Set(
          (dataset?.calendar.records ?? [])
            .filter((record) => record.metric_name === basisMetrics[source])
            .map((record) => record.period_start.slice(0, 4)),
        ),
      ].sort(),
    [dataset, source],
  );
  const comparison = useMemo(() => {
    if (
      !dataset ||
      !/^\d{4}$/.test(comparisonYearA) ||
      !/^\d{4}$/.test(comparisonYearB)
    )
      return null;
    try {
      return buildAnnualComparison(dataset, {
        basis: source,
        years: [Number(comparisonYearA), Number(comparisonYearB)],
      });
    } catch (error) {
      return error instanceof Error
        ? error
        : new Error("Comparison is unavailable.");
    }
  }, [dataset, source, comparisonYearA, comparisonYearB]);
  const comparisonIssues = selectionIssues.filter((issue) =>
    /different years|not in this source|Harmonized comparisons|comparison source/i.test(
      issue,
    ),
  );
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = calendarScrollRef.current;
    const day = root?.querySelector<HTMLElement>(".day.selected");
    if (!root || !day) return;
    const rootRect = root.getBoundingClientRect();
    const dayRect = day.getBoundingClientRect();
    root.scrollLeft = scrollLeftToRevealDay({
      scrollLeft: root.scrollLeft,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      dayLeftInView: dayRect.left - rootRect.left,
      dayWidth: dayRect.width,
    });
  }, [selectedDate, page, basis, dataset]);
  const fixture = dataset?.manifest.data_status === "fixture";
  const maximum = Math.max(1, ...records.map((r) => r.metric_value ?? 0));
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <a
          className="brand"
          href={homeHref}
          aria-label="ChronoFlare home"
          onClick={(event) =>
            activateSelectionLink(event, () => setPage("calendar"))
          }
        >
          <span className="brand-icon">◈</span> Chrono<span>Flare</span>
          <small>EARTH / TIME / INSIGHT</small>
        </a>
        <nav aria-label="Main navigation">
          {(
            [
              ["calendar", "Calendar"],
              ["map", "Map"],
              ["methodology", "Methodology"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
              aria-current={page === id ? "page" : undefined}
            >
              {label}
            </button>
          ))}
        </nav>
        <span className="project-tag">NASA SPACE APPS · PROJECT</span>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className={
          page === "calendar" && calendarMode === "observations"
            ? "focused-calendar"
            : undefined
        }
      >
        {page !== "map" && (
          <>
            <div className="eyebrow">
              OBSERVE THE PAST. UNDERSTAND THE PATTERNS.
            </div>
            <div className="heading">
              <div>
                <h1>
                  {page === "methodology"
                    ? "Method, evidence and limitations"
                    : "Fire has a history."}
                </h1>
                <p>
                  {page === "methodology"
                    ? "How the harmonized series was tested, what passed, and what it does not show."
                    : "Explore fire activity through time, with the source and limitations of every observation."}
                </p>
              </div>
              <span className="status">
                <i />{" "}
                {page === "methodology"
                  ? "Scientific evidence"
                  : calendarMode === "demo"
                    ? "Synthetic demonstration"
                    : calendarMode === "experimental"
                      ? "Raw detection review"
                      : "Real-data calendar"}
              </span>
            </div>
          </>
        )}
        {page === "calendar" && (
          <div className="calendar-dataset-control">
            <label>
              Calendar dataset
              <select
                aria-label="Calendar dataset"
                value={calendarMode}
                onChange={(event) =>
                  navigateSolar({
                    calendar_data: event.target.value,
                  })
                }
              >
                <option value="observations">
                  Real observations · multi-year
                </option>
                <option value="demo">Synthetic demonstration</option>
                <option value="experimental">
                  Real detections · experimental · August 2020
                </option>
              </select>
            </label>
          </div>
        )}
        {page === "map" ? (
          <section className="panel map-page">
            <span className="eyebrow">
              BRAZIL / PANTANAL · AUGUST 2020 REVIEW BATCH
            </span>
            <h1 className="review-title">Detection explorer</h1>
            <p>
              Where did the satellites detect activity? Review the August 1–15,
              2020 delivery below.
            </p>
            <Suspense
              fallback={
                <ChronoLoader
                  open
                  variant="panel"
                  message="Preparing detection explorer…"
                />
              }
            >
              <DetectionReviewMap />
            </Suspense>
            <button className="text-button" onClick={() => setPage("calendar")}>
              ← Back to calendar
            </button>
          </section>
        ) : page === "methodology" ? (
          <Suspense
            fallback={<p role="status">Preparing scientific evidence…</p>}
          >
            <ResearchMethodology />
          </Suspense>
        ) : calendarMode === "observations" ? (
          <Suspense
            fallback={<p role="status">Preparing real-data calendar…</p>}
          >
            <ObservationCalendar />
          </Suspense>
        ) : page === "calendar" && experimentalCalendar ? (
          <Suspense
            fallback={<p role="status">Preparing experimental calendar…</p>}
          >
            <ExperimentalCalendar />
          </Suspense>
        ) : error ? (
          <section role="alert" className="notice">
            <h2>Unable to interpret the data</h2>
            <p>{error}</p>
            <button onClick={() => setAttempt((v) => v + 1)}>Try again</button>
          </section>
        ) : !dataset ? (
          <ChronoLoader
            open
            variant="fullscreen"
            message="Loading and checking dataset artifacts…"
          />
        ) : (
          <>
            {fixture && (
              <aside className="fixture" role="status">
                <strong>DEMO · SYNTHETIC DATA</strong>
                <span>
                  These values illustrate the interface. They are not FIRMS
                  observations or validated results.
                </span>
              </aside>
            )}
            {selectionIssues.length > 0 && (
              <aside className="notice" role="status" aria-live="polite">
                <strong>Selection updated</strong>
                {selectionIssues.map((issue) => (
                  <p key={issue}>{issue}</p>
                ))}
              </aside>
            )}
            <section className="context">
              <div>
                <span className="mini">PROPOSED PILOT REGION</span>
                <strong>↗ Brazilian Pantanal</strong>
                <small>Scientific AOI review is pending</small>
              </div>
              <div>
                <span className="mini">
                  {fixture ? "SIMULATED DATE RANGE" : "DATASET DATE RANGE"}
                </span>
                <strong>
                  {fixture
                    ? `${years.at(-1) ?? "—"} — ${years[0] ?? "—"}`
                    : `${dataset.manifest.actual_date_range?.start} — ${dataset.manifest.actual_date_range?.end}`}
                </strong>
                <small>
                  {fixture
                    ? "No claim of historical coverage"
                    : "See details for gaps and coverage"}
                </small>
              </div>
              <div>
                <span className="mini">SCIENTIFIC VALIDATION</span>
                <strong>
                  {dataset.validation.status === "not_run"
                    ? "Not performed"
                    : dataset.validation.status === "passed"
                      ? "Approved"
                      : "Not approved"}
                </strong>
                <small>
                  {dataset.manifest.decision === "pending"
                    ? "Plan A/B decision pending"
                    : dataset.manifest.decision === "plan_a"
                      ? "Plan A"
                      : "Plan B · separate sensors"}
                </small>
              </div>
            </section>
            {page === "calendar" && (
              <>
                <section className="panel calendar-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">BURNING ACTIVITY CALENDAR</span>
                      <h2>A new perspective on every season</h2>
                      <p>
                        {fixture
                          ? "Synthetic patterns for exploring the product."
                          : "Daily detected activity in the selected region."}{" "}
                        Select a day to inspect its data basis.
                      </p>
                    </div>
                    <label className="select-label">
                      Data basis
                      <select
                        value={basis}
                        onChange={(e) => changeBasis(e.target.value)}
                      >
                        <option
                          value="viirs"
                          disabled={!availableBases.includes("viirs")}
                        >
                          Original VIIRS
                          {!availableBases.includes("viirs")
                            ? " · no records"
                            : ""}
                        </option>
                        <option
                          value="modis"
                          disabled={!availableBases.includes("modis")}
                        >
                          Original MODIS
                          {!availableBases.includes("modis")
                            ? " · no records"
                            : ""}
                        </option>
                        <option
                          value="harmonized"
                          disabled={!availableBases.includes("harmonized")}
                        >
                          Harmonized
                          {!dataset.approved
                            ? " · awaiting validation"
                            : !availableBases.includes("harmonized")
                              ? " · no records"
                              : ""}
                        </option>
                      </select>
                    </label>
                  </div>
                  <p className="sensor-note">
                    <span className={"dot " + basis} /> {basis.toUpperCase()} ·{" "}
                    {basis === "harmonized"
                      ? "Relative index on the VIIRS-equivalent scale"
                      : "Daily FRP sum (MW), original sensor scale"}
                    . Original sensor scales are not directly comparable.
                  </p>
                  <div
                    ref={calendarScrollRef}
                    className="calendar-scroll"
                    aria-label="Calendar by year and day; alternative selectors are available below"
                  >
                    <div className="calendar">
                      <div className="month-row">
                        <span />
                        {months.map((m, i) => (
                          <span
                            key={m}
                            style={{
                              gridColumn: `${Math.floor(calendarSlot(`2000-${String(i + 1).padStart(2, "0")}-01`)) + 2} / span 28`,
                            }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                      {years.map((year) => (
                        <div className="year-row" key={year}>
                          <span className="year">{year}</span>
                          {Array.from({ length: 366 }, (_, slot) => {
                            const date = new Date(Date.UTC(2000, 0, 1 + slot));
                            const suffix = date.toISOString().slice(4, 10);
                            const r = byDate.get(year + suffix);
                            if (!r) {
                              const exists = isSelectionDate(year + suffix);
                              return (
                                <span
                                  key={slot}
                                  className={
                                    exists ? "day no_data" : "day nonexistent"
                                  }
                                  title={
                                    exists
                                      ? "No record; this does not mean zero"
                                      : "This date does not exist in this year"
                                  }
                                />
                              );
                            }
                            return (
                              <button
                                key={slot}
                                tabIndex={-1}
                                className={`day ${r.coverage_flag} ${r.value_basis === "estimated_from_modis" ? "estimated" : ""} ${r.is_unusual ? "unusual" : ""} ${r.period_start === selectedDate ? "selected" : ""}`}
                                style={{
                                  backgroundColor:
                                    r.metric_value === null
                                      ? undefined
                                      : `color-mix(in srgb, #ed6b35 ${15 + (85 * r.metric_value) / maximum}%, #f8f3e9)`,
                                }}
                                onClick={() => setSelectedDate(r.period_start)}
                                title={`${dateLabel(r.period_start)} · ${r.metric_value === null ? "No data" : number(r.metric_value)}${fixture ? " · synthetic" : ""}`}
                                aria-label={`${dateLabel(r.period_start)}, ${number(r.metric_value)}`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="legend">
                    <span>
                      <i className="swatch observed" /> Observed
                      {fixture ? " (simulated)" : ""}
                    </span>
                    <span>
                      <i className="swatch estimated" /> Estimated*
                    </span>
                    <span>
                      <i className="swatch no_data" /> No data
                    </span>
                    <span>
                      <i className="swatch zero" /> Zero / adequate coverage
                    </span>
                    <span>
                      <i className="swatch unusual" /> Unusual
                    </span>
                    <span>
                      <i className="swatch partial" /> Partial coverage
                    </span>
                    <span className="scale">
                      Lower <i /> Higher
                    </span>
                  </div>
                  <p className="footnote">
                    * Estimates are only available after validation. Before
                    2012: extrapolation without direct validation against VIIRS.
                    Color intensity does not represent confidence.
                  </p>
                </section>
                <section
                  className="panel year-comparison"
                  aria-labelledby="year-comparison-heading"
                >
                  <span className="eyebrow">COMPARE TWO YEARS</span>
                  <h2 id="year-comparison-heading">
                    Same source, two different years
                  </h2>
                  <p>
                    Choose one sensor and two years from the current dataset.
                    Harmonized comparison stays unavailable until validation.
                  </p>
                  <div className="compare-controls">
                    <label>
                      Source
                      <select
                        value={source}
                        onChange={(e) => setCompareBasis(e.target.value)}
                      >
                        <option
                          value="viirs"
                          disabled={!availableBases.includes("viirs")}
                        >
                          Original VIIRS
                          {!availableBases.includes("viirs")
                            ? " · no records"
                            : ""}
                        </option>
                        <option
                          value="modis"
                          disabled={!availableBases.includes("modis")}
                        >
                          Original MODIS
                          {!availableBases.includes("modis")
                            ? " · no records"
                            : ""}
                        </option>
                        <option
                          value="harmonized"
                          disabled={!availableBases.includes("harmonized")}
                        >
                          Harmonized
                          {!dataset.approved ? " · awaiting validation" : ""}
                        </option>
                      </select>
                    </label>
                    <label>
                      First year
                      <select
                        value={comparisonYearA}
                        onChange={(e) =>
                          setComparisonYear("first", e.target.value)
                        }
                      >
                        <option value="">Choose a year</option>
                        {sourceYears.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Second year
                      <select
                        value={comparisonYearB}
                        onChange={(e) =>
                          setComparisonYear("second", e.target.value)
                        }
                      >
                        <option value="">Choose a year</option>
                        {sourceYears
                          .filter((year) => year !== comparisonYearA)
                          .map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  {comparisonIssues.map((issue) => (
                    <p key={issue} role="status">
                      {issue}
                    </p>
                  ))}
                  {comparison instanceof Error ? (
                    <p role="status">{comparison.message}</p>
                  ) : comparison ? (
                    <>
                      <ComparisonChart comparison={comparison} />
                      <dl className="comparison-summary">
                        {comparison.series.map((series) => (
                          <div key={series.year}>
                            <dt>{series.year}</dt>
                            <dd>
                              {series.counts.valueDays} days with a value ·{" "}
                              {series.counts.noDataDays} no-data days ·{" "}
                              {series.counts.missingRecordDays} missing records
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p className="footnote">{comparison.notice}</p>
                      {comparison.dataStatus === "fixture" && (
                        <p className="footnote">
                          These counts illustrate the controls. They are not
                          FIRMS observations or validated results.
                        </p>
                      )}
                      {comparison.pre2012Notice &&
                        comparison.series.some(
                          (series) => series.year < 2012,
                        ) && (
                          <p className="notice">{comparison.pre2012Notice}</p>
                        )}
                    </>
                  ) : null}
                </section>
                <section className="bottom-grid">
                  <article className="panel details">
                    <div className="eyebrow">EXPLORE A DAY</div>
                    <div className="detail-controls">
                      <label>
                        Date
                        <input
                          type="date"
                          min={dateRange?.start}
                          max={dateRange?.end}
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                        />
                      </label>
                      <label>
                        Compare the same month/day
                        <select
                          value={compare}
                          onChange={(e) => setCompare(e.target.value)}
                        >
                          <option value="">Choose a year</option>
                          {years
                            .filter((y) => y !== selectedDate.slice(0, 4))
                            .map((y) => (
                              <option key={y}>{y}</option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <div className="comparison">
                      <Detail record={selected} fixture={!!fixture} />
                      {compare && (
                        <Detail
                          record={records.find(
                            (r) =>
                              r.period_start ===
                              compare + selectedDate.slice(4),
                          )}
                          fixture={!!fixture}
                        />
                      )}
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPage("map")}
                    >
                      Open the separate detection explorer ↗
                    </button>
                  </article>
                  <article className="panel explanation">
                    <span className="eyebrow">READ BEYOND THE COLOR</span>
                    <h2>Comparison needs context.</h2>
                    <p>
                      MODIS and VIIRS have different resolutions, overpass
                      times, and confidence criteria. A sensor change can appear
                      to be a change in activity.
                    </p>
                    <p>
                      Missing data stays missing. Every value retains its basis,
                      version, and coverage.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => setPage("methodology")}
                    >
                      Understand the methodology ↗
                    </button>
                  </article>
                </section>
              </>
            )}
          </>
        )}
        <footer>
          <span>
            ChronoFlare <small>Understanding fire activity through time.</small>
          </span>
          <span>
            Thermal detections ≠ confirmed fires · Independent project
          </span>
        </footer>
      </main>
    </>
  );
}
function Detail({
  record: r,
  fixture,
}: {
  record?: ActivityAggregate;
  fixture: boolean;
}) {
  if (!r)
    return (
      <div className="detail-card">
        <h3>No record for this date</h3>
        <p>No record does not mean zero. Choose another day.</p>
      </div>
    );
  const basis = {
    observed_modis: "Original MODIS",
    observed_viirs: "Original VIIRS",
    observed_both: "Both sensors",
    estimated_from_modis: "Estimated from MODIS",
  }[r.value_basis];
  return (
    <div className="detail-card">
      <h3>{dateLabel(r.period_start)}</h3>
      <div className="value">
        {number(r.metric_value)}
        <small>
          {r.metric_value === null
            ? "no data"
            : r.metric_name === "harmonized_frp_index"
              ? "relative index"
              : "MW · daily FRP sum"}
        </small>
      </div>
      <span className="chip">
        {fixture ? "Synthetic · " : ""}
        {basis}
      </span>
      <dl>
        <div>
          <dt>Coverage</dt>
          <dd>
            {r.coverage_flag === "ok"
              ? "Adequate"
              : r.coverage_flag === "partial"
                ? "Partial"
                : "No data"}
            {fixture ? " (simulated)" : ""}
          </dd>
        </div>
        <div>
          <dt>Uncertainty interval</dt>
          <dd>
            {r.uncertainty_lower === null
              ? "Not available"
              : `${number(r.uncertainty_lower)} – ${number(r.uncertainty_upper)} (${number((r.interval_level ?? 0) * 100)}%)`}
          </dd>
        </div>
        <div>
          <dt>Median / P10–P90</dt>
          <dd>
            {number(r.baseline_median)} / {number(r.baseline_p10)}–
            {number(r.baseline_p90)}
          </dd>
        </div>
        <div>
          <dt>Baseline years</dt>
          <dd>{r.baseline_n_years || "Insufficient baseline"}</dd>
        </div>
        <div>
          <dt>Percentile / robust z</dt>
          <dd>
            {number(
              r.percentile_rank === null ? null : r.percentile_rank * 100,
            )}{" "}
            / {number(r.robust_z)}
          </dd>
        </div>
        <div>
          <dt>Overpasses</dt>
          <dd>{number(r.overpass_count)}</dd>
        </div>
      </dl>
      {r.is_extrapolated && (
        <p className="notice">
          Extrapolation without direct validation against VIIRS.
        </p>
      )}
      <small>
        Dataset: {r.dataset_version} · Method: {r.methodology_version}
      </small>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
