import { ChronoLoader } from "./ChronoLoader";
import {
  lazy,
  Suspense,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
const SolarDetectionInspector = lazy(() => import("./SolarDetectionInspector"));
import {
  loadSolarPreview,
  locationSearch,
  navigateSolar,
  solarPlatforms,
  solarSelection,
  subscribeLocation,
  type SolarPreview,
} from "../data/experimental-solar";

const integer = (value: number | null) =>
  value === null ? "No positive records" : value.toLocaleString("en-US");
export default function ExperimentalCalendar() {
  const search = useSyncExternalStore(subscribeLocation, locationSearch);
  const { platform, day, filtered, inspect } = solarSelection(search);
  const [data, setData] = useState<SolarPreview>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    loadSolarPreview(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Experimental data is unavailable or failed validation. The demo calendar and map remain available.",
          );
      });
    return () => controller.abort();
  }, [attempt]);
  if (error)
    return (
      <section className="notice" role="alert">
        <p>{error}</p>
        <button onClick={() => setAttempt((value) => value + 1)}>
          Retry experimental data
        </button>
      </section>
    );
  if (!data)
    return (
      <ChronoLoader
        open
        variant="panel"
        message="Loading and validating real detection summaries…"
      />
    );
  const rows = data.records.filter((row) => row.platform === platform);
  const selected = rows.find((row) => row.solar_date === day)!;
  const selectedTotals = filtered
    ? selected.proposed_filter
    : selected.all_detections;
  const total = rows.reduce(
    (sum, row) =>
      sum +
      ((filtered ? row.proposed_filter : row.all_detections).detection_count ??
        0),
    0,
  );
  const maximum = Math.max(
    1,
    ...rows.map(
      (row) =>
        (filtered ? row.proposed_filter : row.all_detections).detection_count ??
        0,
    ),
  );
  return (
    <div className="solar-preview">
      <aside className="review-warning" role="status">
        <strong>REAL DETECTIONS · EXPERIMENTAL · UNREVIEWED</strong>
        <p>
          August 1–15, 2020 · Pantanal, IBGE 2025 reference. These are recorded
          detections, not counts of individual fires. Observation coverage is
          unknown.
        </p>
        <p>
          The proposed quality filter is unapproved. No harmonization,
          historical baseline or anomaly classification is available.
        </p>
      </aside>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">SOLAR-DAY DETECTION CALENDAR</span>
            <h2>Fifteen days of real observations</h2>
            <p>
              Color represents recorded detections within each platform. Sensor
              counts have different detection capabilities.
            </p>
          </div>
        </div>
        <div className="review-controls">
          <label>
            Platform
            <select
              aria-label="Experimental platform"
              value={platform}
              onChange={(event) =>
                navigateSolar({ solar_platform: event.target.value })
              }
            >
              {solarPlatforms.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Record selection
            <select
              aria-label="Experimental record selection"
              value={filtered ? "proposed" : "all"}
              onChange={(event) =>
                navigateSolar({ solar_filter: event.target.value })
              }
            >
              <option value="all">All recorded detections</option>
              <option value="proposed">
                Proposed vegetation filter · unapproved
              </option>
            </select>
          </label>
        </div>
        <p>
          {filtered
            ? "Proposed filter: source type 0; MODIS confidence ≥30; VIIRS nominal/high. Repeated observations are retained."
            : "All confidence classes and source types are retained, including repeated observations."}
        </p>
        <p className="solar-total">
          <strong>{total.toLocaleString("en-US")}</strong> recorded detections ·{" "}
          {platform} · {filtered ? "proposed filter" : "unfiltered"}
        </p>
        <div
          className="solar-days"
          aria-label={`${platform} detections by solar day`}
        >
          {rows.map((row) => {
            const count = (filtered ? row.proposed_filter : row.all_detections)
              .detection_count;
            const level =
              count === null
                ? 0
                : Math.max(1, Math.ceil((count / maximum) * 4));
            return (
              <button
                key={row.solar_date}
                className={`solar-day level-${level}`}
                aria-pressed={day === row.solar_date}
                aria-label={`August ${Number(row.solar_date.slice(-2))}, 2020: ${integer(count)}; coverage unknown`}
                onClick={() => navigateSolar({ solar_day: row.solar_date })}
              >
                <span>AUG {Number(row.solar_date.slice(-2))}</span>
                <strong>
                  {count === null ? "—" : count.toLocaleString("en-US")}
                </strong>
              </button>
            );
          })}
        </div>
        <p className="muted">
          Lighter to darker: fewer to more recorded detections. A dash means no
          positive records in this selection; it never means zero fire. Each
          platform uses its own color scale.
        </p>
      </section>
      <section className="panel" aria-live="polite">
        <span className="eyebrow">SELECTED SOLAR DAY</span>
        <h2>
          {selected.solar_date} · {platform}
        </h2>
        <dl className="solar-details">
          <div>
            <dt>Recorded detections</dt>
            <dd>{integer(selectedTotals.detection_count)}</dd>
          </div>
          <div>
            <dt>Observation coverage</dt>
            <dd>Unknown</dd>
          </div>
          <div>
            <dt>Excluded by proposed filter</dt>
            <dd>
              {selected.rejected_record_count.toLocaleString("en-US")} records
            </dd>
          </div>
          <div>
            <dt>Overpasses</dt>
            <dd>Not measured</dd>
          </div>
        </dl>
        <details>
          <summary>Raw FRP audit statistic and time window</summary>
          <p>
            Raw FRP sum:{" "}
            {selectedTotals.raw_frp_sum_mw === null
              ? "Not reported"
              : `${selectedTotals.raw_frp_sum_mw.toLocaleString("en-US", { maximumFractionDigits: 2 })} MW`}
            . This sum combines observations across passes. It is not energy,
            burned area or an approved activity metric.
          </p>
          <p>
            UTC interval: {selected.period_start_utc} to{" "}
            {selected.period_end_utc_exclusive}, end exclusive. All requested
            input dates are present; clear-sky observation coverage is still
            unknown.
          </p>
        </details>
      </section>
      <section className="panel">
        <h2>Inspect this day’s detections</h2>
        <p>
          Open the exact records behind the selected calendar count, with a map,
          accessible table and original CSV row references.
        </p>
        <button
          className="solar-inspect-toggle"
          aria-expanded={inspect}
          onClick={() =>
            navigateSolar({
              solar_inspect: inspect ? "" : "1",
              solar_record: "",
            })
          }
        >
          {inspect ? "Hide source inspection" : "Inspect selected detections"}
        </button>
        {inspect && (
          <Suspense
            fallback={<p role="status">Preparing source inspection…</p>}
          >
            <SolarDetectionInspector
              key={`${platform}|${day}`}
              preview={data}
              platform={platform}
              day={day}
              filtered={filtered}
            />
          </Suspense>
        )}
      </section>
      <section className="panel">
        <h2>Source and limitations</h2>
        <p>
          NASA FIRMS Standard Processing · MODIS Terra/Aqua and VIIRS S-NPP.
          Mean solar date uses the fixed regional reference −56.65° (UTC
          −03:46:36).
        </p>
        <p>
          The API reproduced all 33,243 original regional reference observations
          in the compared fields and returned 96 additional observations before
          solar-day selection. Their cause remains under review; this preview
          uses the API input independently of the map’s earlier delivery.
        </p>
        <p>
          Only one fifteen-day period is available here. Year-to-year comparison
          is not available for this dataset.
        </p>
        <a
          href="https://github.com/j-c-fstk-dev/chronoflare/blob/main/docs/experimental-solar-calendar.md"
          target="_blank"
          rel="noreferrer"
        >
          Processing rules and provenance ↗
        </a>
        <details>
          <summary>Original CSV hashes</summary>
          <ul className="solar-hashes">
            {data.provenance.map((item) => (
              <li key={`${item.source}-${item.requested_start_utc}`}>
                {item.source} · {item.requested_start_utc}–
                {item.requested_end_utc_inclusive}
                <br />
                <code>{item.sha256}</code>
              </li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}
