import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { locationSearch, subscribeLocation } from "../data/experimental-solar";
import { formatDate, formatMetric } from "../data/format";
import {
  calendarFocusTarget,
  loadObservationManifest,
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
import { ChronoLoader } from "./ChronoLoader";

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
            onChange={(e) =>
              navigateObservation({
                obs_year: e.target.value,
                obs_date: `${e.target.value}-08-01`,
                ...(Number(e.target.value) === compareYear
                  ? { obs_compare: "" }
                  : {}),
              })
            }
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
              if (e.target.value)
                navigateObservation({ obs_date: e.target.value });
            }}
          />
        </label>
        <label>
          Compare with
          <select
            aria-label="Compare with"
            value={compareYear ?? ""}
            onChange={(e) =>
              navigateObservation({ obs_compare: e.target.value })
            }
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
          <strong>Plan A · approved v2 · both complete MODIS platforms</strong>
          {research && (
            <p>
              <strong>
                {research.publication.by_year["2025"]} estimates in 2025 ·{" "}
                {research.publication.by_year["2026"]} in 2026.
              </strong>{" "}
              {research.publication.by_sample_role.training_window_in_sample}/
              {research.publication.total_days} published dates are in the
              training period, not validation evidence. No independent backward
              test.
            </p>
          )}
          <details>
            <summary>Approval, alignment and sampling details</summary>
            <p>{manifest.approval.approved_claim}</p>
            <p>
              Terra night is aligned to the following reference date; native
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
              FRP sum in MW
              {source === "harmonized"
                ? " on the calibrated VIIRS reference scale"
                : " from selected positive records"}
              . Coverage remains unknown. No annual total or anomaly is inferred
              from gaps.
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
                      const intensity =
                        r.value === null
                          ? 0
                          : Math.min(
                              1,
                              Math.log1p(r.value) / Math.log1p(100000),
                            );
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
                              ? {
                                  backgroundColor: `color-mix(in srgb, #de582b ${15 + 85 * intensity}%, #fff5df)`,
                                }
                              : undefined
                          }
                          aria-pressed={day === date}
                          aria-label={`${formatDate(day)}: ${r.value === null ? readingLabels[r.status] : `${formatMetric(r.value)} MW; ${readingLabels[r.status]}`}${r.extrapolated ? "; beyond training range" : ""}`}
                          title={`${day} · ${r.value === null ? readingLabels[r.status] : `${formatMetric(r.value)} MW`}`}
                          onClick={() => navigateObservation({ obs_date: day })}
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
                  className={`swatch ${source === "harmonized" ? "estimated" : "observed"}`}
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
                No positive records / no estimate
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
              {[10, 100, 1000, 10000, 100000].map((value) => (
                <span key={value}>
                  <i
                    style={{
                      backgroundColor: `color-mix(in srgb, #de582b ${15 + 85 * Math.min(1, Math.log1p(value) / Math.log1p(100000))}%, #fff5df)`,
                    }}
                  />
                  {formatMetric(value)}
                  {value === 100000 ? "+" : ""} MW
                </span>
              ))}
            </div>
            <p className="footnote">
              Arrow keys move focus; Enter or Space selects a day. Fixed
              logarithmic color scale: 0 to 100,000+ MW, shared by both years.
              Color shows magnitude, not confidence. {counts.unacquired}{" "}
              calendar dates were not acquired in this year. Native platforms
              have different sensitivities; compare years within one series.
            </p>
          </section>
          <section
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
            {source === "harmonized" && reading.value !== null && (
              <p className="notice">
                <strong>
                  {research?.publication.roles_by_date[date]
                    ? sampleRoleLabels[research.publication.roles_by_date[date]]
                    : "Sample role unavailable · do not infer validation from agreement on this date"}
                </strong>
              </p>
            )}
            {reading.count !== null && (
              <p>
                {formatMetric(reading.count)} selected thermal detections ·
                coverage unknown
              </p>
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
  const [inspection, setInspection] = useState("08-01");
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
  const maximum = Math.max(
    1,
    ...series.flatMap((s) =>
      s.points
        .filter((p) => usable(p.reading))
        .map((p) => p.reading.value ?? 0),
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
          onChange={(e) => setInspection(e.target.value)}
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
