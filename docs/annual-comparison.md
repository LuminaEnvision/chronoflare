# Annual comparison data adapter

`app/src/data/annual-comparison.ts` prepares two years of the **same metric and basis** for a future comparison chart. It is independent of the calendar component, its scroll behavior, and all CSS. This delivery adds the data logic and an offline inspection command; it does not add or replace a chart in the application.

## Use from application logic

Pass a `Dataset` returned by the existing validated loader or `parseDataset`:

```ts
import { buildAnnualComparison } from "./data/annual-comparison";

// Call only after a comparison year has been selected.
const comparison = buildAnnualComparison(dataset, {
  basis: "viirs",
  years: [2024, 2023],
});
```

The requested order is preserved. Each year must have at least one record for that basis; absent years fail explicitly instead of producing an invented zero series. The basis must be available. Harmonized records additionally require the loader's approved state. Original sensor records must have matching value-basis labels; unconverted MODIS observations cannot be mislabeled as a harmonized comparison.

The shared `basisMetrics` mapping is exported by `selection.ts`, keeping the navigation and comparison adapters on the same metric names. No new library or production backend is required.

## Month/day alignment and missing data

Both series use a shared 366-slot leap-year axis. Slots are zero-based: February 28 is 58, February 29 is 59, and March 1 is 60. A non-leap year has a `not_in_year` slot for February 29; March never shifts to a different column. Actual leap-day records remain intact.

Every point contains `slot`, `monthDay`, actual ISO `date` or null, `value`, `status`, and a copy of the source aggregate or null:

| Status           | Meaning                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `available`      | A record with a non-null metric value and an `ok` coverage flag. This includes a measured zero.     |
| `partial`        | A source record declares partial coverage. Its value is preserved, including null when unavailable. |
| `no_data`        | A source record declares no data.                                                                   |
| `no_value`       | A record exists with a null metric value but neither partial nor no-data status.                    |
| `missing_record` | The date exists in the year, but no record was delivered for it.                                    |
| `not_in_year`    | The axis date does not exist in that year, such as February 29 in 2023.                             |

No date/value is shifted, interpolated, or zero-filled. Source uncertainty bounds, nominal interval level, baseline fields, percentiles, anomaly flags, basis, extrapolation, coverage, overpasses, and version identifiers are copied unchanged. Output record copies and metadata arrays do not share mutable objects with the input dataset.

## Chart-ready segments

Each series includes `segments`, with inclusive `startSlot` and `endSlot` indices into `points`. Segments break at missing/nonexistent dates, null values, coverage-status changes, and observed/estimated/extrapolation transitions. A single-point segment remains present; a renderer should draw an appropriate marker rather than discard it.

Use these segments instead of connecting every non-null point across gaps. Distinguish partial coverage and estimates visually, and retain the synthetic-data and pre-2012 notices. The chart must not present a change from observed to estimated values as one undifferentiated observed series.

## Counts and common value extent

Per-year counts describe the supplied records, not physical observation coverage:

- `calendarDays`: 365 or 366 actual dates.
- `recordDays`: dates with a supplied record, including no-data records.
- `valueDays`: dates with a non-null metric, including partial-coverage values.
- `missingRecordDays`, `noDataDays`, `nullValueDays`, and `partialDays`: distinct structural/data states; some counts overlap by definition.
- `zeroDays`: supplied zero values with `ok` coverage.
- `notInYearSlots`: nonexistent leap-day slots, excluded from actual calendar days.

`valueExtent` is the exact shared minimum/maximum of non-null values from the selected basis across both years. It is null when all values are null and remains `{min: 0, max: 0}` for zero-only data. A renderer may add visual padding to an axis but must not change the underlying values or treat missing series as zero.

The result retains the region, metric/units, dataset/method/calibration versions, data status, A/B decision, validation status, dataset source list, platform-combination rule, coverage method, pre-2012 notice, and limitations. Dataset source names describe the overall manifest; they do not imply that every listed sensor contributed to each selected point.

**No annual totals, seasonal baseline, anomaly calculation, calibration, or approval is performed.** A same-basis comparison is a structural presentation facility, not proof that changing platforms/collections or observation conditions are scientifically comparable.

## Offline inspection command

From the repository root:

```sh
npm run data:compare -- --basis viirs --years 2024,2023
```

The command loads and validates the current frontend artifact package, then prints a compact JSON summary. It does not download NASA data or write files by default. Current artifacts remain synthetic; André's unreviewed raw sample is not used or promoted by this command.

To save the full comparison explicitly:

```sh
npm run data:compare -- --basis viirs --years 2024,2023 \
  --output science/outputs/comparison-2024-2023.json
```

Outputs are local inspection artifacts, not a replacement for `/data/v1/` or reviewed science exports. Existing files are never overwritten. Destinations inside `app/` or `dist/`, including parent-directory symlink aliases, are rejected. Keep analysis outputs under the Git-ignored `science/outputs/` directory.

Supported options are `--basis`, `--years`, optional `--output`, and `--help`. Invalid/identical years, unavailable bases, incompatible records, version conflicts in the input package, and output errors fail explicitly. The existing `data:validate` command now shares the same local validated-data reader.

## Frontend coordination and verification

No changes are made to `main.tsx`, `style.css`, the header, or calendar scrolling. Anastasia's calendar work can proceed independently. A subsequent chart integration can consume this adapter through application logic and pass a prepared model to a presentational component, rather than implementing its own date alignment or gap filling.

Tests cover leap alignment, record/value/coverage distinctions, gap-safe segments, source-basis transitions, all-null/zero-only data, single-basis isolation, approval gating, invalid years and labels, duplicate protection, provenance/non-mutation, CLI inspection/export, overwrite refusal, and protected output paths. No live credentials or scientifically approved real dataset are needed.
