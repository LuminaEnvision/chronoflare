import { useLayoutEffect, useRef, useState } from "react";
import {
  comparisonAxis,
  type AnnualComparison,
  type ComparisonSegment,
} from "../data/annual-comparison";
import {
  describePoint,
  FEBRUARY_29_SLOT,
  segmentDash,
  segmentPath,
  singletonValue,
  valueToY,
} from "../data/comparison-chart";
import { formatMetric } from "../data/format";

const view = {
  width: 720,
  height: 280,
  left: 52,
  right: 12,
  top: 16,
  bottom: 36,
};

export default function ComparisonChart({
  comparison,
}: {
  comparison: AnnualComparison;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [slot, setSlot] = useState(FEBRUARY_29_SLOT);
  const extent = comparison.valueExtent;
  const plotRight = view.width - view.right;
  const plotBottom = view.height - view.bottom;
  const plotWidth = plotRight - view.left;
  const x = (index: number) => view.left + (index / 365) * plotWidth;
  const y = (value: number) =>
    valueToY(value, extent ?? { min: 0, max: 0 }, view.top, plotBottom);

  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const watch = new ResizeObserver(() =>
      setCompact(element.clientWidth < 560),
    );
    watch.observe(element);
    setCompact(element.clientWidth < 560);
    return () => watch.disconnect();
  }, []);

  if (!extent) {
    return (
      <p className="notice" role="status">
        Neither year has a value to plot. Missing data is not shown as zero.
      </p>
    );
  }

  const months = comparisonAxis.filter((item) => item.monthDay.endsWith("-01"));
  const visibleMonths = compact
    ? months.filter((_, index) => index % 3 === 0)
    : months;
  const inspected = comparisonAxis[slot];
  const styles = [
    { dash: "", marker: "circle" as const },
    { dash: "7 4", marker: "square" as const },
  ];

  const move = (clientX: number, bounds: DOMRect) => {
    const local = ((clientX - bounds.left) / bounds.width) * view.width;
    const next = Math.round(((local - view.left) / plotWidth) * 365);
    setSlot(Math.max(0, Math.min(365, next)));
  };

  return (
    <div className="comparison-chart" ref={frame}>
      <div className="chart-legend">
        {comparison.series.map((series, index) => (
          <span key={series.year}>
            <svg
              className="legend-sample"
              viewBox="0 0 36 12"
              aria-hidden="true"
            >
              <line
                x1="1"
                y1="6"
                x2="28"
                y2="6"
                stroke={index === 0 ? "#1f6f62" : "#ad532b"}
                strokeWidth="2"
                strokeDasharray={styles[index].dash}
              />
              {styles[index].marker === "circle" ? (
                <circle cx="30" cy="6" r="3" fill="#1f6f62" />
              ) : (
                <rect x="27" y="3" width="6" height="6" fill="#ad532b" />
              )}
            </svg>
            {series.year} ·{" "}
            {index === 0 ? "solid line, circles" : "dashed line, squares"}
          </span>
        ))}
        <span>
          <svg className="legend-sample" viewBox="0 0 36 12" aria-hidden="true">
            <line
              x1="1"
              y1="6"
              x2="35"
              y2="6"
              stroke="#1f6f62"
              strokeWidth="2"
              strokeDasharray={segmentDash(partialSample, "")}
            />
          </svg>
          <svg className="legend-sample" viewBox="0 0 36 12" aria-hidden="true">
            <line
              x1="1"
              y1="6"
              x2="35"
              y2="6"
              stroke="#ad532b"
              strokeWidth="2"
              strokeDasharray={segmentDash(partialSample, "7 4")}
            />
          </svg>
          Partial coverage
        </span>
        <span>Breaks are missing data, not zero.</span>
      </div>
      <svg
        className="chart-plot"
        viewBox={`0 0 ${view.width} ${view.height}`}
        role="img"
        aria-label={`Comparison of ${comparison.series.map((series) => series.year).join(" and ")} on a shared month and day axis. February 29 stays aligned.`}
        onPointerMove={(event) =>
          move(event.clientX, event.currentTarget.getBoundingClientRect())
        }
        onPointerDown={(event) =>
          move(event.clientX, event.currentTarget.getBoundingClientRect())
        }
      >
        <line
          x1={view.left}
          y1={y(extent.min)}
          x2={plotRight}
          y2={y(extent.min)}
          className="chart-axis"
        />
        <line
          x1={view.left}
          y1={y(extent.max)}
          x2={plotRight}
          y2={y(extent.max)}
          className="chart-axis"
        />
        <text
          x={view.left - 8}
          y={y(extent.max) + 4}
          className="chart-label"
          textAnchor="end"
        >
          {formatMetric(extent.max)}
        </text>
        <text
          x={view.left - 8}
          y={y(extent.min) + 4}
          className="chart-label"
          textAnchor="end"
        >
          {formatMetric(extent.min)}
        </text>
        <text x={8} y={16} className="chart-label">
          {comparison.units}
        </text>
        <line
          x1={x(FEBRUARY_29_SLOT)}
          y1={view.top}
          x2={x(FEBRUARY_29_SLOT)}
          y2={plotBottom}
          className="chart-leap"
        />
        <text
          x={x(FEBRUARY_29_SLOT)}
          y={plotBottom + 26}
          className="chart-label"
          textAnchor="middle"
        >
          Feb 29
        </text>
        {visibleMonths.map((month) => (
          <text
            key={month.monthDay}
            x={x(month.slot)}
            y={plotBottom + 14}
            className="chart-label"
            textAnchor="middle"
          >
            {
              [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
              ][Number(month.monthDay.slice(0, 2)) - 1]
            }
          </text>
        ))}
        {comparison.series.map((series, index) => (
          <g key={series.year}>
            {series.segments.map((segment) => {
              const alone = singletonValue(series.points, segment);
              const color = index === 0 ? "#1f6f62" : "#ad532b";
              return (
                <g
                  key={`${series.year}-${segment.startSlot}-${segment.status}`}
                >
                  <path
                    d={segmentPath(series.points, segment, x, y)}
                    fill="none"
                    stroke={color}
                    strokeWidth={segment.isExtrapolated ? 1.25 : 1.75}
                    strokeDasharray={
                      segmentDash(segment, styles[index].dash) || undefined
                    }
                  />
                  {alone === null ? null : (
                    <SingletonMark
                      cx={x(segment.startSlot)}
                      cy={y(alone)}
                      square={index === 1}
                      color={color}
                    />
                  )}
                </g>
              );
            })}
            {series.points
              .filter((item) => item.value === 0)
              .map((item) => (
                <ZeroMark
                  key={`${series.year}-zero-${item.slot}`}
                  cx={x(item.slot)}
                  cy={y(0)}
                  square={index === 1}
                  color={index === 0 ? "#1f6f62" : "#ad532b"}
                />
              ))}
          </g>
        ))}
        <line
          x1={x(slot)}
          y1={view.top}
          x2={x(slot)}
          y2={plotBottom}
          className="chart-cursor"
        />
      </svg>
      <label className="chart-inspect">
        Inspect a day
        <input
          type="range"
          min={0}
          max={365}
          value={slot}
          aria-valuetext={`${inspected.monthDay}. ${comparison.series
            .map((series) => {
              const item = series.points.find((point) => point.slot === slot);
              return item
                ? `${series.year}: ${describePoint(item, comparison.basis, comparison.units)}`
                : `${series.year}: unavailable`;
            })
            .join(" ")}`}
          onChange={(event) => setSlot(Number(event.target.value))}
        />
      </label>
      <div className="chart-readout" aria-live="polite">
        <strong>
          {inspected.monthDay === "02-29" ? "February 29" : inspected.monthDay}
        </strong>
        {comparison.series.map((series) => {
          const item = series.points.find((point) => point.slot === slot);
          return (
            <p key={series.year}>
              {series.year} ·{" "}
              {item
                ? describePoint(item, comparison.basis, comparison.units)
                : "Unavailable"}
            </p>
          );
        })}
      </div>
    </div>
  );
}

const partialSample: ComparisonSegment = {
  startSlot: 0,
  endSlot: 0,
  status: "partial",
  valueBasis: "observed_viirs",
  isExtrapolated: false,
};

function SingletonMark({
  cx,
  cy,
  square,
  color,
}: {
  cx: number;
  cy: number;
  square: boolean;
  color: string;
}) {
  return square ? (
    <rect x={cx - 3.5} y={cy - 3.5} width="7" height="7" fill={color} />
  ) : (
    <circle cx={cx} cy={cy} r="3.5" fill={color} />
  );
}

function ZeroMark({
  cx,
  cy,
  square,
  color,
}: {
  cx: number;
  cy: number;
  square: boolean;
  color: string;
}) {
  return square ? (
    <rect
      x={cx - 3}
      y={cy - 3}
      width="6"
      height="6"
      fill="#fff"
      stroke={color}
      strokeWidth="1.5"
    />
  ) : (
    <circle
      cx={cx}
      cy={cy}
      r="3"
      fill="#fff"
      stroke={color}
      strokeWidth="1.5"
    />
  );
}
