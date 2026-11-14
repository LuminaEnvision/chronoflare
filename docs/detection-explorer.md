# Unreviewed Brazil detection explorer

The Map view answers **where the supplied satellite records are located**. It
uses the full national FIRMS download for August 1–15, 2020, independently of the
synthetic calendar and annual-comparison chart. It does not claim complete
observation coverage, confirmed fires or a reviewed activity metric.

## Scope, evidence and the boundary decision

| Source | Request | Records retained |
|---|---|---:|
| MODIS Terra + Aqua | 848303 | 42,902 |
| VIIRS S-NPP | 848307 | 162,017 |

The supplier's screenshot shows Brazil and the requested period. Source filenames,
CSV SHA-256 hashes, request IDs, normalization versions and raw collection values
are recorded in the manifest. The screenshot is supporting context, not
cryptographic authentication. No retrieval date is invented.

**No Pantanal polygon is applied or published.** André reported that the earlier
polygon was created using Gemini Argon without a traceable authoritative source.
Its metadata claiming an institution is not verified evidence. Earlier regional
counts (6,660 MODIS / 26,179 VIIRS) are diagnostic results relative to that geometry,
not verified Pantanal totals. They are not the dataset in this map.

The current explorer retains **all 204,919 national records**, including coincident
or repeated technical detections, low confidence and static-source types. The
country is the declared FIRMS request area; the app does not independently verify
country membership or impose a replacement country polygon. Basemap borders are
context, not a scientific AOI. A subsequent [source review](geographic-sources-review.md) located and checked
official IBGE biome vectors. Their version selection and regional integration
are separate from this national explorer; the earlier generated polygon remains
unused.

Artifacts use `status=raw_unreviewed`, `aoi_status=not_applied`,
`coverage_status=unknown` and `scope=brazil_download`. They do not set the calendar's
`data_status=real` or approve harmonization, coverage, zeros or scientific results.

## Interaction and rendering

- Choose MODIS or VIIRS separately. MODIS can be filtered to Terra or Aqua.
- Choose an inclusive UTC window within August 1–15, 2020. Default: one day.
- Numbered groups below zoom 10 use a screen grid for display. They are not fire
  incidents, scientific spatial bins, H3 cells or density estimates.
- At zoom 10+, fixed-size individual points are rendered near the viewport.
  Coincident points may overlap. Every matching record remains in the paginated
  table, with a page-number control for direct navigation.
- A point/table selection shows UTC timestamp, coordinates, platform, FRP in MW,
  raw confidence, source type and original CSV record number.
- The **Fit detections** button frames the selected records. Camera position and
  display groups do not define an AOI. Point size does not represent FRP or area.
- Empty selections mean no matching records, not zero activity or measured coverage.
- An attributed OpenStreetMap basemap is restyled for contrast. Optional NASA GIBS
  MODIS Terra imagery stays true color with adjustable opacity. It uses the last
  day of the selected range, not every day or the selected platform.

Filters use `raw_source`, `raw_from`, `raw_to`, `raw_satellite` and `raw_imagery`.
They preserve calendar/annual-comparison query parameters and support deep links,
Back/Forward and returning between views. Invalid review filters fall back with a
notice. The synthetic calendar date does not filter this real 15-day batch.

Map data loading is independent of calendar-artifact success. Corrupt/unavailable
detection files hide mismatched points and offer retry. Missing background imagery
does not remove valid records. The accessible table allows keyboard inspection
without pointing at canvas markers. Physical-device QA remains a team responsibility.

## Reproduce the assets

Run the exporter on the **original national CSVs**, not the old spatial partitions:

```sh
python3 science/scripts/export_detection_review.py \
  --modis science/outputs/delivery/fire_archive_M-C61_848303.csv \
  --viirs science/outputs/delivery/fire_archive_SV-C2_848307.csv \
  --start 2020-08-01 --end 2020-08-15 \
  --modis-request 848303 --viirs-request 848307 \
  --output science/outputs/detection-review-export
```

The standard-library exporter runs the merged technical CSV normalizer separately
for each source. Full normalized JSONL/report files remain in temporary directories
outside the public tree and are removed afterward. Only compact review assets are
published. Invalid CSVs or out-of-window records abort the whole export; records
are not silently dropped. Original files are not edited. Outputs are deterministic
and existing output directories are never overwritten.

Review the result before copying it into `app/public/data/detection-review/v1/`.
That dedicated directory is the only allowed direct frontend export target. The
exporter rejects output into calendar assets or `dist/`. Do not replace
`app/public/data/v1/` with this package.

The manifest indexes one JSON file per source/day. Browser code validates source,
dates, platforms, count totals, per-record references, asset byte counts and SHA-256.
Cache URLs include the declared hash to avoid stale daily files after updates.
Hashes establish consistency with the manifest, not independent authenticity.
HTTPS or localhost is required for browser integrity verification.

Point tuples are:

```text
[CSV record number, longitude, latitude, UTC time, platform,
 FRP MW, raw confidence, raw source type or null]
```

The raw MODIS `6.03` collection value is preserved rather than rewritten to the
request's C6.1 product label; S-NPP has raw collection value `2`. These conventions
still need scientific-owner confirmation. No quality policy is inferred from them.

Only the selected source/days are fetched. The full static package is approximately
12 MB uncompressed; each daily file is capped by tests at 1.5 MB. Default one-day
loading, canvas rendering, display grouping and viewport culling limit startup and
interaction costs. Compressed transfer size depends on the hosting configuration.

## Coverage delivery 2

The new outage/coverage proposal is documented in
[the engineering review](coverage-delivery-review.md). Its proposed configuration
is disabled and not consumed by this explorer. Positive-detection CSVs and mission
schedules alone do not establish observed AOI coverage or authorize zeros.

## Verification

```sh
npm test
python3 -m pip install -r science/requirements.txt
npm run test:science
npm run language:check
npm run data:validate
npm run build
```

Tests cover full shipped-asset integrity/counts, no AOI publication, source
isolation, unsafe paths, zero/low-confidence retention, leap dates, display
grouping, URL separation, deterministic export, invalid-source rollback and output
protection. The merged comparison chart remains available with its fixture data.

Optional browser regression check against a running production preview (test-only
tooling, not an application dependency):

```sh
python3 -m pip install playwright
python3 -m playwright install chromium
npm run preview
# In another terminal, using the URL printed by preview:
python3 scripts/check-map-browser.py --base-url http://127.0.0.1:4173
```

An existing browser can be selected with `--chromium /path/to/chromium`. The check
exercises calendar failure isolation, imagery attribution cleanup, navigation
during zoom and an empty-data response on a narrow viewport. It does not send
messages, modify production data or certify the scientific source.
