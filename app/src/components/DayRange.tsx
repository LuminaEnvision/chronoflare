import { niceCeiling } from "../data/chart-scale";
import { formatMetric } from "../data/format";

type Props = {
  estimate: number;
  lower?: number;
  upper?: number;
  reference: number | null;
  benchmark: number | null;
};

/**
 * One shared axis for the three numbers that explain a day: the estimate with its
 * interval, the satellite reference, and the reading without calibration. Each value
 * is also written as text, so the picture is never the only way to read it.
 */
export default function DayRange({
  estimate,
  lower,
  upper,
  reference,
  benchmark,
}: Props) {
  const maximum = niceCeiling(
    Math.max(estimate, upper ?? 0, reference ?? 0, benchmark ?? 0),
  );
  const at = (value: number) => `${Math.min(100, (value / maximum) * 100)}%`;
  const rows = [
    {
      name: "Estimate",
      note: "what this calendar publishes",
      value: estimate,
      kind: "estimate",
    },
    {
      name: "Satellite reference",
      note: "VIIRS on Suomi-NPP, same day",
      value: reference,
      kind: "reference",
    },
    {
      name: "Without calibration",
      note: "raw MODIS, for comparison",
      value: benchmark,
      kind: "benchmark",
    },
  ] as const;
  return (
    <div className="day-range">
      {rows.map((row) => (
        <div className="day-range-row" key={row.kind}>
          <div className="day-range-name">
            <strong>{row.name}</strong>
            <span>{row.note}</span>
          </div>
          <div className="day-range-value">
            {row.value === null
              ? "Not available"
              : `${formatMetric(row.value)} MW`}
          </div>
          <div className="day-range-track" aria-hidden="true">
            {row.kind === "estimate" &&
              lower !== undefined &&
              upper !== undefined && (
                <i
                  className="day-range-band"
                  style={{
                    left: at(lower),
                    width: `calc(${at(upper)} - ${at(lower)})`,
                  }}
                />
              )}
            {row.value !== null && (
              <i
                className={`day-range-mark ${row.kind}`}
                style={{ left: at(row.value) }}
              />
            )}
          </div>
        </div>
      ))}
      <div className="day-range-axis" aria-hidden="true">
        <span>0</span>
        <span>{formatMetric(maximum / 2)}</span>
        <span>{formatMetric(maximum)} MW</span>
      </div>
      {lower !== undefined && upper !== undefined && (
        <p className="day-range-caption">
          The shaded band is the range the estimate is expected to fall in most
          of the time: {formatMetric(lower)} to {formatMetric(upper)} MW.
        </p>
      )}
    </div>
  );
}
