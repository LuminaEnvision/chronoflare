import { useEffect, useMemo, useState } from "react";
import { formatDate, formatMetric } from "../data/format";
import {
  loadHarmonizationPairs,
  logDomain,
  logPosition,
  pairedRows,
  roleCounts,
  roleNames,
  roleNotes,
  sampleRoles,
} from "../data/harmonization-pairs";
import type { PairRow, SampleRole } from "../data/harmonization-pairs";

// Validated categorical slots (colorblind-safe on a white surface); shape repeats the identity.
const roleColors: Record<SampleRole, string> = {
  independent_holdout: "#2a78d6",
  post_hoc_examined_holdout: "#eb6834",
  training_window_in_sample: "#6250d6",
};
// Evidence on top: training first, independent last.
const drawOrder: SampleRole[] = [
  "training_window_in_sample",
  "post_hoc_examined_holdout",
  "independent_holdout",
];
const size = 360,
  left = 54,
  right = 12,
  top = 14,
  bottom = 46;
const plot = { width: size - left - right, height: size - top - bottom };
type Paired = PairRow & { snpp_mw: number };
type Hover = {
  row: Paired;
  panel: "estimate" | "benchmark";
  x: number;
  y: number;
};

function Marker({ role, x, y }: { role: SampleRole; x: number; y: number }) {
  const common = { fill: roleColors[role], stroke: "#fff", strokeWidth: 0.8 };
  if (role === "independent_holdout")
    return <circle cx={x} cy={y} r={3.4} {...common} />;
  if (role === "training_window_in_sample")
    return <rect x={x - 3} y={y - 3} width={6} height={6} {...common} />;
  return (
    <rect
      x={x - 3}
      y={y - 3}
      width={6}
      height={6}
      transform={`rotate(45 ${x} ${y})`}
      {...common}
    />
  );
}
const tickLabel = (power: number) =>
  power >= 6
    ? `${10 ** (power - 6)}M`
    : power >= 3
      ? `${10 ** (power - 3)}k`
      : String(10 ** power);

function Panel({
  panel,
  title,
  axis,
  rows,
  domain,
  hover,
  onHover,
}: {
  panel: Hover["panel"];
  title: string;
  axis: string;
  rows: Paired[];
  domain: { low: number; high: number };
  hover: Hover | null;
  onHover: (hover: Hover | null) => void;
}) {
  const x = (value: number) => left + logPosition(value, domain) * plot.width;
  const y = (value: number) =>
    top +
    (1 - Math.min(1, Math.max(0, logPosition(value, domain)))) * plot.height;
  const floor = 10 ** domain.low;
  const powers = Array.from(
    { length: domain.high - domain.low + 1 },
    (_, i) => domain.low + i,
  );
  const active = hover?.panel === panel ? hover : null;
  return (
    <figure className="pair-panel">
      <figcaption>{title}</figcaption>
      <div className="pair-plot">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${title}: ${rows.length} solar dates on logarithmic axes; the dashed diagonal marks equal values. A summary table follows.`}
          onPointerLeave={() => onHover(null)}
        >
          {powers.map((p) => (
            <g key={p} className="pair-grid">
              <line
                x1={left}
                x2={left + plot.width}
                y1={y(10 ** p)}
                y2={y(10 ** p)}
              />
              <line
                x1={x(10 ** p)}
                x2={x(10 ** p)}
                y1={top}
                y2={top + plot.height}
              />
              <text x={left - 7} y={y(10 ** p) + 4} textAnchor="end">
                {tickLabel(p)}
              </text>
              <text
                x={x(10 ** p)}
                y={top + plot.height + 16}
                textAnchor="middle"
              >
                {tickLabel(p)}
              </text>
            </g>
          ))}
          <line
            className="pair-identity"
            x1={x(floor)}
            y1={y(floor)}
            x2={x(10 ** domain.high)}
            y2={y(10 ** domain.high)}
          />
          <text
            className="pair-identity-label"
            x={x(10 ** domain.high) - 6}
            y={y(10 ** domain.high) + 26}
            textAnchor="end"
          >
            equal values
          </text>
          {panel === "estimate" &&
            rows.map((r) => (
              <line
                key={`interval-${r.date}`}
                className="pair-interval"
                stroke={roleColors[r.role]}
                x1={x(r.snpp_mw)}
                x2={x(r.snpp_mw)}
                y1={y(Math.max(r.lower_mw, floor))}
                y2={y(r.upper_mw)}
              />
            ))}
          {drawOrder.flatMap((role) =>
            rows
              .filter((r) => r.role === role)
              .map((r) => {
                const value =
                  panel === "estimate" ? r.estimate_mw : r.benchmark_mw;
                const cx = x(r.snpp_mw),
                  cy = y(value);
                return (
                  <g
                    key={r.date}
                    onPointerEnter={() =>
                      onHover({ row: r, panel, x: cx, y: cy })
                    }
                  >
                    <circle cx={cx} cy={cy} r={8} fill="transparent" />
                    <Marker role={r.role} x={cx} y={cy} />
                  </g>
                );
              }),
          )}
          {active && (
            <circle className="pair-focus" cx={active.x} cy={active.y} r={7} />
          )}
          <text
            className="pair-axis"
            x={left + plot.width / 2}
            y={size - 8}
            textAnchor="middle"
          >
            S-NPP observed, MW (log scale)
          </text>
          <text
            className="pair-axis"
            transform={`rotate(-90 13 ${top + plot.height / 2})`}
            x={13}
            y={top + plot.height / 2}
            textAnchor="middle"
          >
            {axis}
          </text>
        </svg>
        {active && (
          <div
            className="pair-tooltip"
            role="presentation"
            style={{
              left: `${(active.x / size) * 100}%`,
              top: `${(active.y / size) * 100}%`,
              transform: `translate(${active.x > size / 2 ? "-104%" : "4%"}, ${active.y > size / 2 ? "-104%" : "4%"})`,
            }}
          >
            <strong>{formatDate(active.row.date)}</strong>
            <span>{roleNames[active.row.role]}</span>
            <span>S-NPP observed: {formatMetric(active.row.snpp_mw)} MW</span>
            {panel === "estimate" ? (
              <>
                <span>
                  Point estimate: {formatMetric(active.row.estimate_mw)} MW
                </span>
                <span>
                  80% interval: {formatMetric(active.row.lower_mw)}–
                  {formatMetric(active.row.upper_mw)} MW
                </span>
                {active.row.extrapolated && (
                  <span>Beyond the training range</span>
                )}
              </>
            ) : (
              <span>Benchmark: {formatMetric(active.row.benchmark_mw)} MW</span>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}

export default function HarmonizationChart() {
  const [rows, setRows] = useState<PairRow[]>();
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState<Record<SampleRole, boolean>>({
    independent_holdout: true,
    post_hoc_examined_holdout: true,
    training_window_in_sample: true,
  });
  const [hover, setHover] = useState<Hover | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    loadHarmonizationPairs(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setRows(data.rows);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);
  const paired = useMemo(() => (rows ? pairedRows(rows) : []), [rows]);
  // One domain for both axes and both panels, fixed across filters.
  const domain = useMemo(
    () =>
      paired.length
        ? logDomain(
            paired.flatMap((r) => [
              r.snpp_mw,
              r.estimate_mw,
              r.benchmark_mw,
              r.upper_mw,
            ]),
          )
        : null,
    [paired],
  );
  if (failed)
    return (
      <p role="status">
        The paired comparison chart is unavailable. The registered metrics above
        are unaffected.
      </p>
    );
  if (!rows || !domain) return <p role="status">Loading paired comparison…</p>;
  const counts = roleCounts(rows);
  const shown = paired.filter((r) => visible[r.role]);
  const withoutReference = rows.length - paired.length;
  return (
    <div className="pair-chart">
      <div
        className="pair-filters"
        role="group"
        aria-label="Sample roles shown in both charts"
      >
        {sampleRoles.map((role) => (
          <button
            key={role}
            type="button"
            aria-pressed={visible[role]}
            onClick={() => {
              setHover(null);
              setVisible((v) => ({ ...v, [role]: !v[role] }));
            }}
          >
            <svg viewBox="0 0 14 14" aria-hidden="true">
              <Marker role={role} x={7} y={7} />
            </svg>
            {roleNames[role]} · {counts.find((c) => c.role === role)!.paired}
          </button>
        ))}
      </div>
      <div className="pair-panels">
        <Panel
          panel="benchmark"
          title="Before: uncalibrated MODIS benchmark"
          axis="Weighted native MODIS, MW"
          rows={shown}
          domain={domain}
          hover={hover}
          onHover={setHover}
        />
        <Panel
          panel="estimate"
          title="After: harmonized estimate"
          axis="Harmonized estimate, MW"
          rows={shown}
          domain={domain}
          hover={hover}
          onHover={setHover}
        />
      </div>
      <div className="pair-legend">
        <span>
          <svg viewBox="0 0 14 14" aria-hidden="true">
            <circle cx="7" cy="7" r="3.4" fill="#52605c" />
          </svg>
          Point value for one solar date
        </span>
        <span>
          <svg viewBox="0 0 14 14" aria-hidden="true">
            <line
              x1="7"
              x2="7"
              y1="1"
              y2="13"
              stroke="#52605c"
              strokeWidth="1.4"
            />
          </svg>
          Empirical 80% interval (harmonized panel only)
        </span>
        <span>
          <svg viewBox="0 0 22 14" aria-hidden="true">
            <line x1="1" x2="21" y1="7" y2="7" className="pair-identity" />
          </svg>
          Equal values; points below it underestimate S-NPP
        </span>
      </div>
      <p className="footnote">
        Each point pairs two values from the same solar date. {paired.length} of{" "}
        {rows.length} published dates are plotted; {withoutReference} have no
        S-NPP reference with both turns and stay unavailable. Dates without an
        estimate are gaps, not zeros, and are not plotted. Both panels share the
        same axes. Agreement inside the training period is not validation
        evidence.
      </p>
      <details>
        <summary>Table view: dates behind the chart</summary>
        <div className="research-table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Sample role</th>
                <th scope="col">Published dates</th>
                <th scope="col">Plotted (paired)</th>
                <th scope="col">No S-NPP reference</th>
                <th scope="col">What it supports</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => (
                <tr key={c.role}>
                  <th scope="row">{roleNames[c.role]}</th>
                  <td>{c.published}</td>
                  <td>{c.paired}</td>
                  <td>{c.withoutReference}</td>
                  <td>{roleNotes[c.role]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
