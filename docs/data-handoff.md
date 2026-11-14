# André → application handoff

## Minimum package for the first integration

Deliver a complete tree under `app/public/data/v1/`:

- `manifest.json`: schema `1.0.0`, dataset/methodology version, sources, actual dates, status, decision, and file paths.
- `regions/pantanal-pilot/calendar/day.json`: envelope and complete section 7.3 records, one row per date and basis, with an exclusive period end.
- `validation/summary.json`: decision, status, thresholds and prior registration timestamp, training/test periods, results separated by platform, combination rule, limitations, and calibration version.
- For the fire-map integration: GeoJSON per period/basis with H3 cells, a confirmed AOI, metric, coverage, and the same dataset version. The fire-layer loader will be implemented alongside that delivery.

Complete reference structures are available in the synthetic artifacts and `app/src/data/schema.ts`. Fields without results must remain null; do not invent metrics, overpasses, coverage, or intervals. Demo artifacts are not scientific-analysis templates.

## Initial implementation conventions

- Daily AOI calendar (`cell_id=null`, `spatial_resolution=aoi`), ISO dates, exclusive period end.
- A `basis=separate` envelope contains independent `observed_modis` and `observed_viirs` rows. For plan A, add `harmonized_frp_index` rows containing observed VIIRS and approved MODIS estimates. Original bases remain separate.
- `metric_name=modis_frp_sum|viirs_frp_sum` for original bases; the value is the sum on the original scale, without automatically summing platforms.
- `metric_value=null` when `coverage_flag=no_data`; zero requires evidence-supported `ok` coverage.
- `baseline_*`, percentile, and z belong to the same basis and are computed offline. Do not compare bases on different scales.
- No scientific calculation runs in the browser. The heatmap aligns month/day positions on a leap-year grid, preserving February 29 without shifting March in other years.
- Estimates require an interval, interval level, and approval. Extrapolations retain a visible notice.
- `data_status=real` requires a date range, generation timestamp, and coverage method; **only human review can authorize this status**.

## Evidence of approval

Plan A requires `harmonization_approved=true`, `decision=plan_a`, and `validation.status=passed`, consistent calibration versions, registered thresholds, and results. Plan B retains `harmonization_approved=false` and original bases. A test that was not run never counts as a pass.

Include the AOI geometry source/version, SP/NRT collections and platforms, first/last records, input hashes, filters, local-solar-day and baseline leap-day rules, parameters, and reproducible code. The offline FIRMS downloader is available in `science/scripts/firms_download.py` (see [setup](external-sources.md)). It preserves the raw CSV and provenance. The [technical CSV normalizer](raw-ingestion.md) now produces traceable intermediate raw detections; scientific rules and the aggregate/result reproduction pipeline are still pending.

## Verification

```sh
npm run data:validate -- --real
npm test
npm run build
```

Then visually review selection, gaps, leap years, bases, plan A/B, and versions; integrate the fire map and measure payload size. Publish real data only after scientific review.

## Context imagery

The Map view has a separate [unreviewed raw-detection explorer](detection-explorer.md), using the full Brazil download without a Pantanal polygon, plus optional public NASA GIBS context imagery without a key. It does not provide approved calendar activity or H3 aggregates. Imagery dates are UTC and must not be confused with the aggregates' local solar day. The approximate camera does not confirm the AOI. H3/GeoJSON cells and the scientific boundary still await delivery.
