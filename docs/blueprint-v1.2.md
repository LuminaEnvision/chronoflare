# ChronoFlare — Final product, science, and implementation blueprint

> **Historical/stage-specific record.** This page preserves the facts, test counts and remaining work of its original delivery. It is not the current project approval or feature checklist. See [current validation and scope](validation-report.md) and the [documentation index](README.md). Any associated dated PDF/Word remains that historical snapshot.

**Consolidated version:** 1.2 · **Date:** November 14, 2026 · **Event:** NASA Space Apps Challenge 2026 (November 14–15)

> **Understanding fire activity through time.**

**Original planning status.** This was the team's consolidated operational blueprint at the start of development; the current operational contracts and approval are linked above. It incorporates revised v1.1/v1.1.1 sections 4.3, 7.3, 11, 14, and 17, with the agreed editorial corrections. Other sections were reconstructed as execution guidance from the available decisions because the complete v1.0 text was not available during consolidation. Added details are marked as **implementation proposals**, not validated scientific decisions. This English edition preserves the planning requirements; translation does not approve a scientific method or establish actual data availability.

**Scientific status at this planning snapshot:** the strategy had been selected; empirical calibration approval, quantitative thresholds, and data quality still require André's assessment. **MVP instruction at that time:** start development immediately using synthetic data that follows the real contract.

## Executive summary

ChronoFlare is a web application for exploring **satellite-detected fire activity through time**, emphasizing comparability between MODIS and VIIRS records. Its core is a historical year-by-day calendar showing seasonality, unusual periods, observation provenance, and uncertainty. A simple map and a Methodology page complement the calendar.

The project **does not detect fires in real time**, **does not confirm fire incidents**, and **does not predict risk**. The scientific task is to test whether a MODIS-to-VIIRS-scale transformation is defensible during sensor overlap. If it is not, the product displays separate series and makes that limitation part of the result. Before 2012, VIIRS-scale estimates are extrapolations without direct validation against VIIRS.

The MVP uses **precomputed static artifacts**, a static interface, and **one deployment**. It does not require a production Python API, PostGIS, or a persistent backend during the hackathon. The proposed pilot is the **Brazilian Pantanal**, subject to confirmation of the area of interest (AOI), data availability, and coverage.

### Non-negotiable commitments

- Traceable science: never label estimates as observations or a rejected series as harmonized.
- No data ≠ zero: insufficient coverage must not become artificial zeros.
- Frontend, science, and presentation work proceed in parallel.
- The scientific checkpoint ends in a **plan A/plan B decision**, not unlimited optimization.
- The deliverable is a reproducible, understandable, transparent demo, without claiming a perfect historical reconstruction.

## 1. Problem, opportunity, and objective

### 1.1. Problem

MODIS and VIIRS observe thermal anomalies with different instruments, resolutions, overpass times, and confidence criteria. Simply concatenating annual counts or FRP may introduce artificial changes that look like changes in observed fire activity, especially as sensors and platforms enter the series. Users may also confuse missing records with the absence of fire.

### 1.2. Opportunity

Help researchers, communicators, environmental analysts, and non-specialists investigate **when** detected activity tends to occur and **how** it changes between years, while understanding the limitations of orbital observations. A unified visual interface explains methodology and uncertainty without hiding them.

### 1.3. MVP objective

Answer: **“What is the region's seasonal pattern, which years or periods depart from it, and how much can we trust the temporal comparison?”** The answer must remain useful if harmonization fails.

### 1.4. Non-goals

The MVP does not implement forecasting, emergency alerts, fire spread, burned area, causal attribution, individual-event fusion, emission estimates, an on-demand global map, or a real-time operational dashboard. These are possible future studies, not MVP commitments.

## 2. Positioning and identity

### 2.1. Name and message

**ChronoFlare** — _Understanding fire activity through time._

Product message: _Explore the history of satellite-detected fire activity, with more transparent sensor comparisons and visible uncertainty._

### 2.2. Language and editorial commitments

Use **thermal detections**, **detections**, **detected activity**, **relative activity index**, **observed**, **estimated**, **extrapolated**, and **insufficient coverage**. Avoid “number of fires,” “historical truth,” and “total fire energy.” Every comparison metric must identify its scale, sensor, and methodological status.

### 2.3. Visual guidance — operational proposal

- A clean, data-oriented interface that is readable on desktop and mobile.
- A perceptually uniform **intensity** progression from low values to orange/red. **Do not use the same orange to identify MODIS**: violet is the proposed MODIS identity color, with a separate VIIRS color.
- Categorical states — observed, estimated, missing, adequately covered zero, unusual — also use **patterns, outlines, or text**, never color alone.
- Keep the state legend beside the calendar and keyboard accessible. Intensity does not communicate confidence; estimation and uncertainty intervals are separate layers.

## 3. Audience, journeys, and navigation

### 3.1. Priority audiences

1. Researchers/analysts need methodology, versions, coverage, and MODIS–VIIRS comparisons to be traceable.
2. Journalists/educators need to identify seasonality and explain unusual years without claiming causality.
3. Interested non-specialists need clarity without prior remote-sensing knowledge.

### 3.2. P0 navigation

**Calendar · Map · Methodology**. Calendar is the entry view. Overview and analysis information belongs in cards and the detail panel, without extra routes. Preserve the AOI, year, and selected period when switching between Calendar and Map.

### 3.3. Demonstrable journey

Open the pilot region, identify the typical season, select an unusual period, read its value/basis/uncertainty and percentile, open the filtered map, return to the calendar, and check how the conclusion was produced on the Methodology page. This journey must work under both plan A and plan B.

## 4. Screens and user experience

### 4.1. Calendar — header and indicators

P0 includes the region name, actual observation date range, basis selector (**Approved harmonized**, **Original MODIS**, **Original VIIRS**), status legend, relative indicator, typical season window, and validation status. Under plan B, **Approved harmonized is unavailable**, with an explicit explanation; it never appears as a valid series.

Prefer the **harmonized FRP index** in KPIs only if calibration passes. Otherwise show original sensor metrics and a warning that they are not directly comparable. Detection counts must never be presented as counts of fires.

### 4.2. Overall structure and interaction

P0 layout: AOI context bar, main calendar, persistent legend, detail panel with baseline/uncertainty/provenance, and links to Map and Methodology. Loading, missing-file, network-failure, and insufficient-data states need understandable text. Explain why disabled controls are unavailable.

### 4.3. Burning Activity Calendar — core module

**Objective:** show when fire activity typically occurs, which years/periods were unusual, and how reliable each value is in one view. This is ChronoFlare's main differentiator.

#### Layout

**Header**

- Region and historical date range.
- Metric: harmonized index by default **only after validation approval**; otherwise the selected sensor's original basis.
- Data basis: Harmonized, Original MODIS, or Original VIIRS.
- Daily original series, optional 7-day moving average for display, and exploratory weekly/monthly aggregations.

**Main visualization**

- Heatmap: years vertically and day of year horizontally, with month labels.
- Perceptually uniform sequential colors, distinct from the MODIS identity color (section 2.3).
- Top band for the typical critical window: onset, peak, and end of the median year.
- Outlines around unusual periods.

#### Required visual states

| State                            | Representation                    | Meaning                                                                                                               |
| -------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Observed VIIRS                   | Solid color                       | Measured value                                                                                                        |
| Estimated from MODIS             | Hatched color                     | Estimated VIIRS-equivalent value; tooltip shows uncertainty and, before 2012, extrapolation without direct validation |
| No data or insufficient coverage | Neutral gray with its own pattern | Missing information, not zero                                                                                         |
| Zero with adequate coverage      | Lowest color on the scale         | No detections                                                                                                         |
| Unusual period                   | Red outline                       | Above baseline P90 for at least 3 consecutive days in the daily series                                                |

Keep all five states in a permanently visible legend.

#### Metrics

- **Default:** harmonized index, the sum of FRP on the VIIRS-equivalent scale per AOI-day, subject to section 11 validation.
- **Alternatives:** detection count, with a sensor-resolution caveat, and the number of days with activity.

#### Interactions

- Select a year or period, day or week.
- Compare two years side by side, or a year against the historical baseline.
- Switch data basis.
- Open the map filtered to the selected period.
- Export PNG/CSV in P1.

#### Detail panel

For the selected year or period, show value and observed/estimated basis; uncertainty interval; historical median and P10–P90 excluding that year; percentile and robust z; observation counts and coverage by sensor; and the daily series. If the period is unusual, show the rule and reference used.

#### “Why harmonize?” mode

Compare three series for the same AOI: original MODIS, a naive splice using MODIS through 2011 and VIIRS afterward, and the harmonized series. The Methodology chart is P0; a calendar toggle is P1. If a 2012 discontinuity does not appear in real data, document that honestly and adjust the pitch. Under plan B (11.7), show separate MODIS/VIIRS series and their overlap comparison.

#### Scientific requirements

- Missing data must never appear as zero.
- Estimated years must never appear observed. Pre-overlap estimates, before 2012, extrapolate a calibrated relationship without direct VIIRS validation. State this in the legend, tooltip, and methodology.
- Every calendar color must be explainable as a value, basis, and uncertainty in the detail panel.
- The calendar describes satellite-detected activity, not forecasts or confirmed incidents.

#### Completion criterion

A new user can identify the season in about 10 seconds and explain which year was unusual and why.

### 4.4. Map — spatial context

**Objective:** show aggregated activity for the selected year or period, **without reconstructing fire boundaries**. P0 uses precomputed H3 cells, a metric legend, the AOI boundary, selected date range, provenance, and coverage information. Start the camera at the pilot AOI.

- At distant zoom levels, display cell aggregates, never hundreds of thousands of raw points.
- Cell click/hover: value, period, basis, coverage, and uncertainty for estimates.
- Period changes fetch only files at the required resolution.
- P1: multiple regions, sensor filters, and spatial export.
- If reliable aggregates are unavailable in time, use an explanatory static map with a representative real-data subset; do not imply live updates.

### 4.5. Methodology — trust first

P0 covers FIRMS provenance; sensor differences; confidence scales; FRP and relative-index definitions; coverage and zero interpretation; local solar day; satellite combination; training/test windows; pre-registered criteria; metrics/charts; adopted plan A/B; limitations; and data/code versions. The “Why harmonize?” chart follows the scientific decision in 11.7.

### 4.6. Responsiveness, accessibility, and states

The calendar scrolls horizontally on narrow screens, with accessible legend and detail panel. Provide keyboard selection or an alternative year/day selector, visible focus, text/patterns redundant with color, and textual chart summaries. Prioritize desktop for the presentation and verify mobile on a real device. Charts need equivalent text, not an unexplained canvas.

## 5. MVP technical architecture

### 5.1. Principle

**Precompute once, serve many.** Science runs offline. Publish only derived, compressed JSON/GeoJSON and a React interface. The browser neither harmonizes scientific data nor downloads the complete raw archive.

### 5.2. Components — implementation proposal

| Layer            | Suggested technology                     | Responsibility                                     | Priority |
| ---------------- | ---------------------------------------- | -------------------------------------------------- | -------- |
| Application      | React + TypeScript + Vite                | UI, filter state, calendar, details                | P0       |
| Styling          | CSS/Tailwind if familiar                 | Responsive layout, theme, states                   | P0       |
| Map              | MapLibre GL JS or a familiar library     | H3/GeoJSON and AOI                                 | P0       |
| Charts           | Lightweight SVG/D3 or a familiar library | Curves, comparisons, diagnostics                   | P0       |
| Offline pipeline | Python, pandas, geospatial/H3 libraries  | ETL, aggregation, calibration, tests, export       | P0       |
| MVP persistence  | Versioned files                          | Manifest, aggregate series, map, validation report | P0       |
| Hosting          | **Vercel, one static deployment**        | Frontend and assets                                | P0       |
| Backend          | FastAPI only if justified                | Future dynamic queries                             | P1       |
| Spatial database | PostgreSQL/PostGIS if needed later       | Arbitrary AOIs and on-demand queries               | Post-MVP |

Specific libraries are **implementation proposals**, not scientific requirements. **Exclude** docker-compose, React Hook Form, authentication, queues, databases, and production APIs without a concrete MVP justification.

### 5.3. Build flow

```text
FIRMS archive / official files
           |
           v
    ingest and verify
           |
           v
 normalize + provenance
           |
           v
 quality + solar day + H3
           |
           v
 sensor-combination experiments
           |
           v
 calibration + validation ---> plan A/B decision
           |                          |
           +-----------+--------------+
                       v
          daily aggregates + map
                       |
                       v
          JSON / GeoJSON / manifest
                       |
                       v
              React/Vite + Vercel
```

### 5.4. Science/frontend contract

Frontend work **does not wait** for processing: use fixtures matching **Activity Aggregate**, **Dataset Manifest**, and **Validation Summary** exactly. Demo data must not appear real. When integrating real artifacts, remove fixtures from the public build and verify `data_status=real` in the manifest.

### 5.5. Volume management

Serve AOI-day aggregates for the heatmap and geographic blocks or bounded time windows for the map. Avoid browser downloads of all raw detections. Measure real-demo load time and transferred size; “a few tens of thousands of features” is a **performance hypothesis**, not a guarantee.

## 6. Source data, units, and limitations

### 6.1. Source and availability

Use **NASA FIRMS** MODIS/VIIRS active detections. Prefer **Standard Processing (SP)** for historical analysis. If recent NRT is used, identify it and acknowledge that definitive science data may replace it. Actual dates and gaps come from the extraction manifest, not assumptions.

| Family | Considered platforms    | Nominal spatial scale | Historical planning reference                                                             |
| ------ | ----------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| MODIS  | Terra, Aqua             | ~1 km                 | Terra from November 2000; Aqua from July 2002                                             |
| VIIRS  | S-NPP, NOAA-20, NOAA-21 | ~375 m at nadir       | S-NPP from January 2012; NOAA-20 from April 2018; verify the available NOAA-21 collection |

Differences between NASA pages about NOAA-21 coverage require recording the **first valid record actually used** and its collection. Never infer availability from the platform name. The table is a planning reference, not proof of uninterrupted coverage or current operation.

### 6.2. Data semantics

`frp` is fire radiative power in MW per detection. Its AOI-day sum is a **relative comparison index**, not total energy or burned area. MODIS confidence is numeric (0–100); VIIRS uses low/nominal/high classes. They are not equivalent by direct numeric conversion. Resolution and observation time affect detectability.

### 6.3. Observation, coverage, and zero

**Critical methodological risk:** a CSV containing **positive detections** alone does not establish adequate observation on days without detections. `coverage_flag=ok` requires evidence of overpasses/observation, a documented method, or a conservative definition approved by André. Without evidence, use `partial/no_data` or “undetermined coverage”; do not invent zeros. `overpass_count` provides context, not automatic proof of cloud-free coverage.

### 6.4. Pilot region

The Brazilian Pantanal is the **suggested AOI**, subject to confirmation. Record polygon and boundary version, source/CRS/date, intersection method (pixel center versus geometry as feasible), available temporal extent, and test subset. Use the same AOI across sensor comparisons to avoid artificial area differences.

### 6.5. Versioning and reproducibility

Retain source dataset, collection/processing, UTC download time, filters, AOI, input hashes, code version, parameters, training/test windows, and export version. Check reuse restrictions before republishing raw data. Provide a README for reproducing processing from FIRMS.

## 7. Data model and scientific contract

### 7.1. Raw Detection

Retain original fields and provenance on every row. Proposed minimum fields, supplemented by 7.3:

| Field                                              | Meaning                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| `detection_id`                                     | Stable derived technical identifier, without claiming event identity |
| `source_dataset`, `collection`, `processing_level` | FIRMS product and SP/NRT                                             |
| `sensor`, `satellite`                              | MODIS/VIIRS; Terra/Aqua/S-NPP/NOAA-20/NOAA-21                        |
| `latitude`, `longitude`                            | Reported pixel center                                                |
| `acquired_at_utc`                                  | Preserved acquisition date/time in UTC                               |
| `frp_mw`                                           | Original-product FRP                                                 |
| `confidence_raw`                                   | Original numeric or categorical value                                |
| `region_id`, `cell_id`                             | AOI and derived aggregation cell                                     |
| `quality_pass`, `quality_rule_version`             | Traceable filter application                                         |

**Do not create a fire-event ID from proximity between pixels.**

### 7.2. Supporting entities

- **Region/AOI:** ID, name, geometry/source, bbox, polygon version, language, and available date range.
- **Dataset Manifest:** global version, generation time, sources, actual dates per sensor, plan A/B, thresholds, calibration versions, hashes, coverage, and derived-file paths.
- **Validation Summary:** training/test periods, metrics per platform/stratum, `passed|failed|not_run`, rationale, combination selection, and plan A/B decision.
- **Daily/Map Assets:** aggregates from the same pipeline with matching version identifiers.

### 7.3. Activity Aggregate — revised, plus additions to 7.1

#### Additional Raw Detection fields

| Field              | Type            | Reason                                                                                    |
| ------------------ | --------------- | ----------------------------------------------------------------------------------------- |
| `day_night`        | D / N           | Different overpass times require stratification                                           |
| `scan`, `track`    | Float           | Actual pixel size                                                                         |
| `local_solar_date` | Date            | Derived from UTC/longitude with one midnight rule, avoiding inconsistent night assignment |
| `source_type`      | Nullable string | Vegetation/static-source filtering when available                                         |
| `confidence_class` | Derived enum    | Comparable class while preserving raw confidence                                          |

#### Activity Aggregate

An aggregation by period and spatial unit, on the harmonized scale when approved.

| Field                                                                 | Meaning                                                             |
| --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `region_id`                                                           | Region/AOI                                                          |
| `cell_id`                                                             | H3 cell; null for AOI aggregation                                   |
| `period_start`, `period_end`                                          | Period boundaries                                                   |
| `temporal_resolution`                                                 | day, week, or month                                                 |
| `spatial_resolution`                                                  | H3 resolution or aoi                                                |
| `metric_name`                                                         | For example, harmonized_frp_index                                   |
| `metric_value`                                                        | Index value; null if unavailable                                    |
| `value_basis`                                                         | observed_modis, observed_viirs, observed_both, estimated_from_modis |
| `uncertainty_lower`, `uncertainty_upper`, `interval_level`            | Uncertainty bounds and nominal level, e.g. 80%                      |
| `modis_frp_sum`, `viirs_frp_sum`                                      | Original-scale sums per sensor                                      |
| `modis_detection_count`, `viirs_detection_count`                      | Detection counts per sensor                                         |
| `coverage_flag`                                                       | ok, partial, or no_data                                             |
| `coverage_fraction`                                                   | Fraction of the period with observation                             |
| `baseline_median`, `baseline_p10`, `baseline_p90`, `baseline_n_years` | Seasonal reference excluding the assessed year                      |
| `percentile_rank`, `robust_z`                                         | Position and magnitude relative to the reference                    |
| `is_unusual`                                                          | Rule in 11.4                                                        |
| `calibration_version`, `methodology_version`, `dataset_version`       | Traceability                                                        |

#### Additional patched fields

| Field                 | Meaning                                                    |
| --------------------- | ---------------------------------------------------------- |
| `is_extrapolated`     | Estimate outside the MODIS–VIIRS overlap                   |
| `estimation_method`   | ratio, quantile_map, or gbm                                |
| `calibration_stratum` | AOI, platform, day/night, season                           |
| `overpass_count`      | Recorded overpasses considered; no automatic normalization |

**Zero versus missing:** `metric_value=null` with `coverage_flag=no_data`. Record zero only with adequate coverage and no detections.

#### Calibration Record — new

One record per calibrated stratum:

| Field                            | Meaning                                |
| -------------------------------- | -------------------------------------- |
| `stratum`                        | AOI, Terra/Aqua, day/night, season     |
| `method`                         | ratio, quantile_map, or gbm            |
| `parameters`                     | Fitted parameters                      |
| `training_period`, `test_period` | Training/test periods                  |
| `validation_metrics`             | MAE, bias, Spearman, interval coverage |
| `created_at`, `code_version`     | Traceability                           |

Also retain `acceptance_thresholds`: minimum weekly Spearman, maximum bias, minimum coverage of nominal 80% intervals, and minimum sample per stratum. Register the timestamp **before testing** and separate Terra from Aqua strata.

## 8. Data interfaces, contracts, and examples

For the MVP, “endpoints” are **static files under `/data/v1/`**. Section 8.5 retains future logical API parameters; P0 resolves filters through precomputed files and local state without a running server.

### 8.1. Manifest

`GET /data/v1/manifest.json`. Illustrative model, **not a scientific result**:

```json
{
  "schema_version": "1.0.0",
  "dataset_version": "REPLACE_WITH_REAL_VERSION",
  "methodology_version": "1.2",
  "generated_at_utc": null,
  "data_status": "fixture",
  "decision": "pending",
  "harmonization_approved": false,
  "region_ids": ["pantanal-pilot"],
  "sources": ["MODIS", "VIIRS"],
  "spatial_resolution": "h3-6",
  "temporal_resolutions": ["day", "week", "month"],
  "actual_date_range": null,
  "coverage_method": "pending_scientific_review",
  "files": {
    "calendar_day": "/data/v1/regions/pantanal-pilot/calendar/day.json",
    "validation": "/data/v1/validation/summary.json"
  }
}
```

`data_status=fixture` **prevents display as real observations**. Switch to `real` for scientific publication only after validating versions and files.

### 8.2. Regions

`GET /data/v1/regions/index.json`: ID, name, simplified polygon/bbox, geometry source, observation range, and available bases. P0 may contain only the pilot AOI.

### 8.3. Validation report

`GET /data/v1/validation/summary.json`: `decision`, `thresholds_registered_at`, `thresholds`, `training_period`, `test_period`, `results_by_platform`, `combination_rule`, `coverage_method`, `pre2012_notice`, `limitations`, `calibration_version`, `dataset_version`. Disable harmonized views for `decision=plan_b`.

### 8.4. Geographic data

`GET /data/v1/regions/{region_id}/map/{period_key}.geojson` or equivalent aggregates. Cell properties: `cell_id`, period boundaries, metric name/value, basis, coverage, uncertainty bounds, and dataset version. All files must match the manifest dataset version. Mismatches block interpretation and produce an integrity error.

### 8.5. Calendar — required logical contract

**Input:** `region_id`, `resolution=day|week|month`, `basis=harmonized|modis|viirs`, optional year/range. P0 uses files per resolution/region and selects the basis from delivered records. P1 may introduce `GET /api/calendar?region_id=...&resolution=...&basis=...`.

**Response:** `{region_id, resolution, basis, dataset_version, calibration_version, coverage_method, records: ActivityAggregate[]}`. Include **all** section 7.3 fields, especially basis, uncertainty, coverage, baseline statistics/sample size, extrapolation flag, and overpass count.

**Synthetic record** — deliberately fictional:

```json
{
  "region_id": "pantanal-pilot",
  "cell_id": null,
  "period_start": "2011-08-01",
  "period_end": "2011-08-02",
  "temporal_resolution": "day",
  "spatial_resolution": "aoi",
  "metric_name": "harmonized_frp_index",
  "metric_value": 27.4,
  "value_basis": "estimated_from_modis",
  "is_extrapolated": true,
  "estimation_method": "ratio",
  "calibration_stratum": "pantanal-pilot|Terra|D|dry",
  "uncertainty_lower": 14.1,
  "uncertainty_upper": 40.9,
  "interval_level": 0.8,
  "modis_frp_sum": 21.3,
  "viirs_frp_sum": null,
  "modis_detection_count": 4,
  "viirs_detection_count": null,
  "coverage_flag": "ok",
  "coverage_fraction": 1.0,
  "overpass_count": 2,
  "baseline_median": 18.0,
  "baseline_p10": 7.0,
  "baseline_p90": 32.0,
  "baseline_n_years": 9,
  "percentile_rank": 0.78,
  "robust_z": 0.8,
  "is_unusual": false,
  "calibration_version": "illustrative-only",
  "methodology_version": "1.2",
  "dataset_version": "fixture"
}
```

**Integration rule:** this fixture was neither extracted from FIRMS nor validated. Publish `estimated_from_modis` entries as approved harmonization only after scientific approval with `harmonization_approved=true`. Under plan B, any exploratory estimates must be distinct from approved harmonized metrics, including their metric names and visible wording.

### 8.6. Required consistency cases

- `coverage_flag=no_data` implies `metric_value=null` and missing-data rendering, without interpolation to zero.
- A zero requires adequate, documented coverage.
- `is_extrapolated=true` requires `estimated_from_modis` and an explicit lack-of-direct-validation notice.
- Original MODIS/VIIRS units must not appear directly comparable without a method.
- `harmonization_approved=false` removes options/labels implying validated harmonization.
- `validation.status=not_run` never counts as approval.

## 9. Repository and engineering

Suggested structure, adaptable to the team:

```text
chronoflare/
├── README.md
├── docs/
│   ├── methodology.md
│   ├── data-dictionary.md
│   ├── validation-report.md
│   └── submission.md
├── app/
│   ├── src/
│   │   ├── components/     # heatmap, legend, details, controls
│   │   ├── pages/          # Calendar, Map, Methodology
│   │   ├── data/           # loader, adapters, contract validation
│   │   ├── fixtures/       # development only
│   │   ├── styles/
│   │   └── types/
│   ├── public/data/v1/     # exported scientific artifacts
│   ├── package.json
│   └── vite.config.ts
├── science/
│   ├── scripts/           # ingest, normalize, aggregate, calibrate
│   ├── tests/             # series, calendar, bootstrap, splits
│   ├── configs/           # region, filters, registered thresholds
│   └── outputs/           # do not version large raw files
└── .github/workflows/     # simple CI as time permits
```

Keep the main branch demonstrable, PRs small, reviews quick, and data artifacts versioned with checksums. Earthdata/MAP_KEY secrets remain local, never in frontend code, bundles, or Git. The demo must not call authenticated FIRMS endpoints directly.

## 10. Quality, tests, and observability

### 10.1. P0 data tests

Check schemas/types/enums, UTC/solar dates, window boundaries, leap years, sum/aggregate consistency, missing-value nulls, platform separation, duplicates/provenance, changes as platforms enter, known simulated series, idempotent reruns, and matching versions. Removing NOAA-21, when present, must not silently change the interpretation of earlier years.

### 10.2. P0 product tests

Open on a clean network; switch bases without mixing units; select days/weeks/years; check tooltips and the five-state legend; deep-link to the map with region/period; compare series; test missing files/version conflicts; verify plan B, keyboard navigation, responsiveness, and another device.

### 10.3. Publication integrity

Check that `data_status=real` has genuine data and validation, a decision is present, AOI source/date range is declared, all referenced assets exist, compressed payloads fit the measured browser budget, and methodology charts match the exported report.

### 10.4. Performance — proposal

Measure demo-device opening time and calendar/map transfer size. Prefer precomputation and file partitioning to unmeasured numeric targets. The feature-volume test in section 17 is an actual demo acceptance check.

## 11. Scientific and analytical strategy

Items marked **proposal** require André's confirmation after examining the data.

### 11.1. Required principles

1. Preserve provenance.
2. Do not directly compare incompatible metrics.
3. Do not treat missing observations as zero.
4. Do not assume nearby detections are the same event.
5. Do not delete original records during harmonization.
6. Document normalization methods.
7. Version methods and datasets.
8. Every harmonized series includes uncertainty.
9. No harmonized result is displayed before passing out-of-sample validation (11.5).
10. Do not sum same-sensor satellites automatically. Experimentally choose cell-day maximum or a fixed reference satellite (11.2, step 4).
11. Group dates by local solar day derived from UTC and longitude.
12. Pre-overlap estimates are extrapolations and never described as directly validated.
13. Register acceptance thresholds before testing.

### 11.2. Harmonization pipeline — proposal

1. **Normalize:** one column schema, preserving sensor and satellite.
2. **Quality:** filter vegetation fire when a type field exists; exclude static sources; remove low-confidence VIIRS and evaluate an equivalent MODIS threshold. Record sensitivity to thresholds.
3. **Aggregate:** H3 resolution 6, approximately 36 km², configurable from 5–7 and larger than MODIS pixels. Unit: cell × day × day/night. H3 aggregates; it does not deduplicate.
4. **Within-sensor combination:** Terra/Aqua and S-NPP/NOAA-20/NOAA-21 may see persistent activity on the same day. Experiment with (a) cell-day maximum and (b) a fixed reference satellite on identical periods/spatial units. A maximum may discard distinct activity observed by only one satellite; a sum may duplicate persistence. Evaluate bias against the reference, temporal stability, series correlation, sensitivity to added platforms, and coverage. Record `overpass_count` and the selected rule. Verify actual FIRMS platform availability and whether adding NOAA-21 affects overlap; if it does, use a fixed reference.
5. **Calibrate during overlap, from 2012:** target the VIIRS-equivalent scale. Main proposed training: 2012–2019, hypothesized to be more orbitally stable, subject to André's confirmation. Use 2020–2025 for stress testing. Analyze Terra and Aqua separately. Start with median MODIS→VIIRS ratios per stratum; progress to quantile mapping only if necessary; GBM is P2. Stop at the first method that validates adequately.
6. **Uncertainty:** quantile regression or stratified residual bootstrap, propagated to calendar values.
7. **Harmonized series:** observed VIIRS where available; estimated VIIRS-equivalent values with intervals earlier; observed and estimated values side by side during overlap.
8. **Main index:** sum of VIIRS-equivalent FRP per AOI-day as a relative indicator, not total released energy.

**Early hypothesis:** FRP sums may be more comparable than counts because counts depend strongly on resolution. Choose the metric with better held-out rank correlation and lower bias. Alternative: calibrated counts by stratum.

**Stationarity diagnostic:** annual MODIS/VIIRS ratio by Terra/Aqua separately. Reports of recent orbital drift and overpass-time changes require confirmation from NASA/NSIDC, not an assumption of either stability or failure. If bias changes systematically, test period/platform stratification. Normalize by overpass count only if it improves comparability.

### 11.3. Burning Activity Calendar

- Original daily data underpin every calculation; 7-day smoothing is display-only; week/month views are exploratory aggregates.
- For each month/day, use a ±15-day reference window across other years, excluding the assessed year (leave one year out).
- Handle February 29 only in the seasonal reference: proposed 365-day reference pools it with February 28, without shifting later dates. **Preserve the original February 29 observation in the daily dataset and series.**
- Minimum valid years are configurable, proposed as 8; flag insufficient reference samples.
- Display insufficient-coverage periods separately from zeros; show sample size and reference method in details.

### 11.4. Anomalies and critical windows — proposal

**Unusual:** daily value above reference P90 for at least 3 consecutive days, using original daily data rather than a moving average. Magnitude uses robust z from median/MAD. For MODIS-derived estimates, declare an anomaly only if the uncertainty lower bound exceeds P90; otherwise mark it as possible.

**Critical window:** on the median-year cumulative curve, onset is 10%, peak is the smoothed maximum, and end is 90%. Repeat per year to assess earlier onset, duration, and trends; trends are P1.

Every anomaly must explain period, indicator, reference, deviation, and method. It is not a fire forecast.

### 11.5. Validation

- Train and test on separate periods; metrics are MAE, bias, weekly Spearman, and coverage of nominal 80% intervals.
- Compare original MODIS, naive splice, and harmonized approaches.
- Check S-NPP against NOAA-20 for cross-platform sanity.
- Assess sensitivity to H3 resolution, confidence threshold, and reference window.
- Record parameters and data versions in Calibration Records.

Proposed windows, adjustable after availability is confirmed:

| Test                | Train     | Test      | Purpose                                                                |
| ------------------- | --------- | --------- | ---------------------------------------------------------------------- |
| Temporal validation | 2012–2019 | 2020–2025 | Stress-test stability after possible orbital drift                     |
| Backward transfer   | 2016–2025 | 2012–2015 | Complementary earlier-year stability check; does not validate pre-2012 |

Report Terra and Aqua separately. André defines minimum weekly Spearman, maximum bias, minimum 80% interval coverage, and minimum stratum sample based on data quality/variability, with a registration timestamp **before tests**.

**Pre-2012 limitation:** estimates extrapolate the calibrated relationship. Model uncertainty is not direct VIIRS validation. Pitch wording: _Historical estimates before 2012 are extrapolations based on the MODIS–VIIRS relationship calibrated during their overlap period. They are not directly validated against VIIRS observations._

Results feed Methodology and the “Why harmonize?” chart.

### 11.6. Pending-decision deadline

Update section 18 decisions on sources, fields, confidence, combination, indicator, aggregation, resolution, and anomalies before the 3-hour checkpoint. Without evidence, use the document's provisional defaults **only for development and experiments**. Unapproved values must not be published as harmonized results. UI work continues with contract-compliant synthetic data.

### 11.7. Three-hour decision checkpoint and plan B

Three hours is a decision limit, not a completion guarantee. Decide A/B even if evidence is insufficient to harmonize. Download/ingestion is outside this clock and has its own limit set by André at the start.

1. Hour 1: overlap data, behavior around 2012, quality.
2. Hour 2: cell-day maximum versus fixed-reference variants (mean is outside initial scope), plus simple median-ratio calibration per stratum.
3. Hour 3: temporal validation, backward transfer, annual platform-specific MODIS/VIIRS ratios.
4. Decide using pre-registered thresholds.

| Item             | Plan A — passed                                                     | Plan B — failed or insufficient evidence                                                     |
| ---------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Displayed series | Harmonized with uncertainty                                         | Separate MODIS and VIIRS                                                                     |
| Overlap          | Observations and estimates side by side                             | Direct comparison with median ratios by stratum                                              |
| Before 2012      | VIIRS-scale estimate labeled extrapolated without direct validation | Original MODIS, or explicitly exploratory, low-confidence, unvalidated VIIRS-scale estimates |

Never call a failed series harmonized. Plan B explains why direct comparisons can mislead and how much sensor difference is explainable. Calibration complexity must not consume the rest of the hackathon.

## 12. Priorities, dependencies, and risk

### 12.1. Product priorities

| P0 — required                                  | P1 — after P0 is stable  | P2 / outside hackathon                  |
| ---------------------------------------------- | ------------------------ | --------------------------------------- |
| Year × day calendar, five states/legend        | PNG/CSV export           | GBM and exploratory ML                  |
| Basis filters, details, year comparisons       | Seasonal trend analysis  | Unlimited AOIs/on-demand queries        |
| Methodology, validation, versions, limitations | Optional FastAPI         | Spatial database/distributed processing |
| Simple aggregated map                          | More filters/resolutions | Accounts, alerts, forecasts             |
| Real data, A/B decision, backup video          | Design refinement        | Real-time services                      |

### 12.2. Risk matrix

| Risk                                   | Impact | Prevention/response                                                    |
| -------------------------------------- | ------ | ---------------------------------------------------------------------- |
| Cannot download the full series        | High   | Feasible pilot subset, available files, actual coverage, plan B        |
| Harmonization fails                    | High   | Registered thresholds, fixed checkpoint, separate sensor display       |
| Too few samples per stratum            | High   | Report insufficiency; missing tests never pass; justify simplification |
| Missing records confused with no fire  | High   | Require coverage evidence before zero                                  |
| Orbit/platform changes bias the series | High   | Separate Terra/Aqua, annual diagnostics, fixed-reference variant       |
| UI/dataset mismatch                    | High   | Section 7.3 contract, fixtures, manifest validation                    |
| Excessive map payload                  | Medium | H3 aggregation, bounded files, ordinary-hardware tests                 |
| Scope growth                           | High   | Three views, no P0 FastAPI, simple models first                        |
| Presentation left until the end        | High   | Named owner, early script, backup video, early submission              |
| AI introduces errors                   | High   | Disclose usage; human review of code, charts, claims                   |

### 12.3. Scope reduction

Prioritize **Calendar → Details → Methodology → Simple map**, preserving real data and A/B transparency. Reduce polish and secondary features before removing provenance or validation. An honest plan B demo is preferable to misrepresented harmonization.

## 13. Deployment and distribution

### 13.1. Hackathon deployment

One static **Vercel** project serves the frontend and derived files in `public/data/v1/`. Run science before publication. Do not publish large raw data, NASA keys, or credential-bearing scripts. Configure routes/SPA fallback as needed and version-aware caching.

### 13.2. Reproducible publication

1. Validate tests and manifest.
2. Copy reviewed outputs into `app/public/data/v1/`.
3. Build and inspect file sizes.
4. Preview A/B status, source, limitations, routes, and interactions.
5. Publish and test on another device.
6. Record a backup demonstration video for hosting/network failure.

### 13.3. After the event

Only after the MVP consider FastAPI, dynamic AOIs, PostGIS, and update jobs. Evaluate cost, reproducibility, and SP/NRT separation before adopting them.

## 14. Execution plan — targeted adjustments

Start four workstreams together with a shared checkpoint:

| Workstream           | Owner                      | First deliverable                                                                                      |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Application          | Tech Lead                  | Year × day calendar, details, bases, states, static architecture with section 7.3 fixtures             |
| Data and methodology | André                      | Overlap, 2012 assessment, aggregation variants, calibration, validation, stability, historical dataset |
| Frontend and product | Frontend/product developer | Visual identity, responsive components, simple map                                                     |
| Presentation         | Assign immediately         | Narrative, video, scientific explanation, submission                                                   |

1. Start the frontend with fixtures; replace them when André delivers.
2. André delivers overlap/2012 analysis first. It guides interpretation and data replacement but does **not block calendar development**.
3. The 3-hour checkpoint ends with plan A/B.
4. Add the simple map, methodology results, and harmonization chart with real outputs.

**Pitch framing:** ChronoFlare does not perfectly reconstruct fire history since 2000. It is a reproducible attempt at more comparable records, with overlap validation, declared retrospective estimates, and explicit uncertainty.

## 15. Communication, pitch, and submission

### 15.1. Scientific narrative

**Problem:** apparent trends may reflect changing resolution, coverage, platforms, and processing, not just environmental change.

**Proposal:** combine history, provenance, seasonality, and transparent estimates/uncertainty. **Evidence:** held-out validation or documented harmonization limits, without hiding failure.

**Value:** identify when detected activity typically occurs, inspect an unusual year, and understand why a temporal comparison is or is not trustworthy.

### 15.2. Demo script — proposal

1. Explain sensor comparability in one sentence.
2. Show the calendar season and select an unusual period.
3. Explain observed/estimated basis, uncertainty, and reference.
4. Relate it to spatial aggregates on the map.
5. Show Methodology, metrics, and plan A/B.
6. State extrapolation limits and unsuitable uses.

### 15.3. Messages to retain

- _Understanding fire activity through time._
- _ChronoFlare does not claim to reconstruct a perfect history since 2000._
- _Historical estimates before 2012 are extrapolations based on the MODIS–VIIRS relationship calibrated during their overlap period. They are not directly validated against VIIRS observations._
- Thermal detections are neither confirmed incidents nor an operational emergency tool.

### 15.4. Submission materials

Public URL, accessible repository, setup/reproduction README, problem/solution, NASA sources and licenses, methodology/limitations, demo video, AI disclosure and human review, and visual evidence for validation/A/B. Verify the **actual local event** deadline/format and aim to submit at least 4 hours early (section 17).

## 16. Team, roles, and coordination

| Role                   | Owner                      | Responsibilities                                                        | First milestone                             |
| ---------------------- | -------------------------- | ----------------------------------------------------------------------- | ------------------------------------------- |
| Tech Lead              | Project owner              | Architecture, contracts, calendar, build/deploy, technical coordination | Functional fixture-based view               |
| Data/science           | André                      | FIRMS, AOI, quality, calibration, tests, limitations, versioned exports | Overlap analysis and threshold registration |
| Frontend/product       | Frontend/product developer | Identity, states, components, map, responsive UX                        | Integrated map/components with fixtures     |
| Narrative/presentation | **Assign immediately**     | Script, video, evidence, submission                                     | Video outline and delivery checklist        |

### 16.1. Handoff contracts

André → application: manifest, calendar day/week/month, map, validation summary, metric definitions, limitations. Application → product: types, fixtures, composable components, A/B states. Presentation → team: demo script reflecting actual results, without anticipating calibration approval.

### 16.2. Cadence

Brief syncs at the start and checkpoints; maintain a shared decision record. Missing real data must not block UI development. Scientific rule changes after A/B require evidence and explicit version updates.

## 17. Acceptance criteria

The project is demonstrable when each item is verified:

**Product**

1. Calendar, Map, and Methodology open/navigate without errors.
2. The pilot region is identified on every view.
3. Year × day calendar displays real data with section 4.3 states and legend.
4. Users compare years and open details for any period.
5. The real-data map does not freeze the browser; measure the proposed few-tens-of-thousands-of-features target before treating it as a guarantee.

**Data and science**

6. Real MODIS and VIIRS data are available, aiming from the actual MODIS start through the obtainable recent period. State actual dates/gaps. Plan A pre-overlap estimates show extrapolation and uncertainty without direct validation; plan B shows original MODIS or explicitly unvalidated exploratory estimates, never approved harmonization.
7. Every value has traceable sensor/basis provenance.
8. Calibration is documented and versioned in Calibration Records.
9. Report temporal validation and backward transfer separately for Terra/Aqua, with MAE, bias, Spearman, and interval coverage against registered thresholds. If a test is missing, explicitly state **not performed**, why, and implications. Missing mandatory validation means plan B.
10. The harmonization chart compares original MODIS, naive splice, and harmonized values **only under plan A**. Plan B shows separate sensors and overlap. If no 2012 jump exists, document that without inventing a pitch discontinuity.
11. At least one interpretable anomaly indicator — percentile and robust z — has visible method/reference.
12. Missing data and zeros are distinguishable everywhere.

**Transparency**

13. Document that thermal detections are not confirmed fires, cloud/smoke can hide them, overpasses occur at specific times, and data must not alone protect lives/property.
14. List sources, libraries, tools, AI tasks, and human verification.
15. The README enables FIRMS-based dataset reproduction.

**Delivery**

16. A public demo is tested on another device, with a recorded backup video.
17. Video, description, repository, and form are ready/submitted at least 4 hours before the actual local deadline.

**Additional patched criteria**

18. Added satellites do not introduce undocumented artificial steps; record selected combination rules and variant comparisons.
19. Reproduce any calendar value from data, parameters, and calibration version.
20. Register thresholds before tests and document A/B results.
21. Plan B never labels a failed series harmonized.

Prioritize a complete, defensible, explainable scientific journey over disconnected incomplete features.

## 18. Decisions, pending parameters, and freeze

Section 11.6 refers to this register. Entries are operational decisions with owners, tests, and publication conditions, not an invitation to reopen scope.

| Topic                     | Current decision/default                                               | Owner             | Pending evidence/action                       | Status               |
| ------------------------- | ---------------------------------------------------------------------- | ----------------- | --------------------------------------------- | -------------------- |
| Name/positioning          | ChronoFlare; detected activity through time                            | Team              | None                                          | Closed               |
| Pilot region              | Brazilian Pantanal                                                     | André             | Confirm AOI, boundary, availability           | Proposed             |
| Sources                   | FIRMS MODIS + VIIRS; prefer SP                                         | André             | Confirm collections and actual platform dates | Agreed in principle  |
| Confidence                | Preserve raw confidence; sensor-specific documented filters            | André             | Evaluate MODIS/VIIRS thresholds               | Pending data         |
| Within-sensor combination | Compare cell-day maximum with fixed reference; no automatic sum        | André             | Empirical comparison/decision                 | Pending test         |
| Spatial unit              | H3 r6; assess r5–r7 if feasible                                        | André             | Sensitivity, compatibility, size              | Proposed             |
| Calendar                  | Original year × day; visual-only 7-day smoothing                       | Tech Lead + André | Integration verification                      | Closed               |
| Main indicator            | VIIRS-equivalent FRP sum per AOI-day if approved                       | André             | Compare against calibrated counts             | Pending test         |
| Calibration               | Median ratio by stratum, then quantiles if needed                      | André             | Fit and validate                              | Pending test         |
| Orbital stability         | Proposed 2012–2019 train, 2020–2025 stress                             | André             | Sources and Terra/Aqua diagnostics            | Pending verification |
| Backward transfer         | Train 2016–2025; test 2012–2015                                        | André             | Run or mark not performed                     | Pending test         |
| Scientific thresholds     | Spearman, bias, 80% coverage, minimum sample                           | André             | **Values and timestamp before testing**       | Required             |
| Coverage/zero             | Zero only with demonstrated adequate coverage                          | André             | Define/record method                          | Critical             |
| Local solar day/leap day  | UTC + longitude; preserve original February 29; reference-only pooling | André             | Specify conversion and tests                  | Agreed in principle  |
| Anomaly                   | >P90 for ≥3 daily observations; robust z                               | André             | Validate reference/minimum sample             | Proposed             |
| Pre-2012 series           | Extrapolation, no direct validation                                    | Everyone          | Visible wording                               | Closed               |
| Plan A/B                  | Required checkpoint decision                                           | André + Tech Lead | Record decision                               | Required             |
| Views                     | Calendar, Map, Methodology                                             | Product team      | Final integration                             | Closed               |
| Infrastructure            | Static files, Vercel, no P0 backend                                    | Tech Lead         | Tested deployment                             | Closed               |
| Presentation              | Assign owner, backup video, early submission                           | Team              | Assign/check local deadline                   | Open                 |

### 18.1. Freeze criterion

After threshold registration and A/B, freeze the demo's metric, coverage handling, combination rules, parameters, anomaly method, narrative, and dataset version. Changes require **evidence, a proven error, or an operational blocker**, with version updates and recalculation as needed.

### 18.2. Presentation definition of done

One working URL; traceable dataset/validation; clear limitations; section 17 items verified or explicitly marked unmet; script aligned with the adopted scientific plan; submission complete. **Never present unperformed work as completed.**

## Appendix A — Primary references

1. [NASA FIRMS Active Fire Data](https://firms.modaps.eosdis.nasa.gov/content/active_fire/) — products, platforms, SP/NRT.
2. [NASA FIRMS Archive Download](https://firms.modaps.eosdis.nasa.gov/download/) — historical availability/formats.
3. [NASA FIRMS VIIRS fire hotspots](https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html) — fields/confidence.
4. [NASA FIRMS Fire Alert Notes](https://firms.modaps.eosdis.nasa.gov/alerts/notes.php) — detection limitations/confidence.
5. [NASA FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area) — sources/limits if needed for extraction.

Official pages may report different start dates depending on collection/processing. Record the actual product, collection, first/last record, and extraction timestamp. No scientific queries or results were produced when this blueprint was consolidated; André must define thresholds beforehand.

## Appendix B — Consolidation history

- **v1.0:** original blueprint referenced during review; complete text unavailable during consolidation.
- **v1.1:** harmonization, daily calendar, data model, validation, acceptance criteria.
- **v1.1.1:** pre-2012 extrapolation, display-only smoothing, satellite comparisons, stability, registered thresholds, plan B, parallel execution.
- **v1.2:** 18-section consolidation, explicit decision register, missing tests distinguished from passes, leap-day preservation, UI work independent of 2012 analysis, plan-B-compatible acceptance criteria, P0 architecture/contracts.
- **English edition:** project-wide working-language translation. Scientific approval status is unchanged.

**End of blueprint.**
