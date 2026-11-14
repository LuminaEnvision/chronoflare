# Offline raw CSV normalization

This is the technical intake step between a local FIRMS SP CSV and the scientific pipeline. It can run before scientific decisions are finalized. It does not publish calendar/map artifacts or approve the data.

## Run on a downloaded package

After the existing FIRMS downloader creates a directory containing `detections.csv` and `provenance.json`:

```sh
python3 science/scripts/normalize_detections.py \
  --input science/outputs/modis-sp-2025-09-01/detections.csv \
  --source MODIS_SP \
  --provenance science/outputs/modis-sp-2025-09-01/provenance.json \
  --output science/outputs/normalized-modis-sp-2025-09-01
```

The normalizer runs entirely offline and needs no key or third-party Python packages. `--source` is explicit; it is not guessed from the filename. Supported sources are `MODIS_SP`, `VIIRS_SNPP_SP`, `VIIRS_NOAA20_SP`, and `VIIRS_NOAA21_SP`.

The optional provenance file must agree on the source, processing level, and SHA-256. If a size or row count is declared, it must agree too. The tool checks consistency, not NASA authenticity or scientific validity. Its checksum check detects a modified CSV; it cannot authenticate an arbitrary manually supplied metadata file.

## Run on an archive CSV supplied by André

```sh
python3 science/scripts/normalize_detections.py \
  --input science/outputs/archive-modis.csv \
  --source MODIS_SP \
  --output science/outputs/normalized-archive-modis
```

Without a provenance file, the tool still hashes the original file but reports `input_provenance_verified=false` and an unknown retrieval timestamp. Keep the archive source, collection, extraction history, and AOI notes from André alongside the raw inputs. A declared CLI source does not prove the origin of a file.

This adapter supports the FIRMS detection CSV column layout. It does not parse binary formats, shapefiles, GeoJSON, or arbitrary native-product text files. Run each source CSV into its own new output directory. Bulk orchestration, scientific joins, and derived frontend exports are later steps.

## Input fields and technical checks

Required columns: `latitude`, `longitude`, `acq_date`, `acq_time`, `satellite`, `confidence`, and `frp`. Header matching is case-insensitive and accepts a UTF-8 BOM. Duplicate/ambiguous headers and inconsistent row widths are rejected.

Optional fields include `instrument`, `version`, `daynight`, `scan`, `track`, and `type`. All original columns and their string values, including unknown columns, are retained in `raw_record`. The input CSV itself remains unchanged.

The tool validates finite numbers, coordinate ranges, nonnegative raw FRP, acquisition dates/times, documented satellite aliases, and source/instrument consistency. It zero-pads UTC HHMM values such as `430` to `04:30`. It rejects technically invalid records rather than silently dropping them. It does not require both sensors to have detections on the same day.

For `VIIRS_SNPP_SP` only, the FIRMS SUOMI VIIRS C2 archive instrument label
`SNPP` is accepted as an alias for VIIRS. The normalized sensor remains `VIIRS`,
the platform remains `S-NPP`, and the original label is preserved in `raw_record`.
This alias is rejected for MODIS and NOAA sources.

A product version, if present, must identify an SP collection. `RT`, `URT`, and `NRT` suffixes are explicitly rejected rather than being misclassified as SP. If version/collection is absent, the collection remains null and the report counts that absence. Missing optional day/night, type, or pixel dimensions remain null.

## Output package

The output directory must not already exist and cannot be inside `app/` or `dist/`. Keep local outputs under Git-ignored `science/outputs/`.

- `detections.jsonl`: one JSON record per valid input record, with normalized technical fields, the original raw fields, input hash, and a one-based source-record number.
- `report.json`: input/output hashes, source, normalization version, UTC processing timestamp, acquisition range, row counts, duplicate-identity count, missing optional-field counts, and pending scientific steps.

The report's acquisition range describes returned detection timestamps, not continuous sensor coverage. A header-only file produces zero records with unknown coverage and a null acquisition range; it never means zero fire activity.

A malformed file produces no published output package. Temporary normalization files are removed after an error. A successful rerun to a different output directory produces the same JSONL bytes for unchanged inputs; the report processing timestamp can differ. Existing output directories are never overwritten.

## Technical identities, not fire events

`detection_id` is a SHA-256 of sensor, canonical platform, UTC acquisition time, and canonical decimal coordinates. Equivalent coordinate spellings and zero-padded times produce the same identity. Collection and FRP are not identity inputs, allowing reprocessed records to be recognized without pretending they are the same fire event.

Repeated identities are counted and **retained**, including when FRP differs. Do not use this technical identity as an automatic scientific deduplication rule or an incident identifier. Reconcile duplicates later with provenance and an approved policy.

## Scientific boundaries

Every package remains `scientific_status=unreviewed` and `coverage_status=unknown`.

- Low-confidence detections and static-source types are retained.
- VIIRS `l/n/h` labels can be expanded to their descriptive classes; this does not approve or filter them.
- Numeric MODIS confidence is preserved without choosing unapproved class boundaries.
- `quality_pass` and `quality_rule_version` remain null.
- `local_solar_date` remains null until the agreed convention is implemented.
- `region_id` and `cell_id` remain null. A download bounding box does not imply confirmed AOI membership.
- No coverage, overpass count, platform combination, H3 aggregation, baseline, anomaly, calibration, or uncertainty is inferred.

These are **intermediate raw-detection records**, not frontend `ActivityAggregate` objects. Frontend fixtures and scientific approval gates are unchanged. The team will implement the subsequent processing once André supplies the data and decisions in the [handoff contract](data-handoff.md).

## Verification

```sh
npm run test:science
npm run language:check
```

Tests cover MODIS/VIIRS variants, preserved low confidence/static types, missing optional fields, duplicate retention, deterministic output, malformed input cleanup, SP/RT/NRT separation, provenance mismatches, CLI errors, and the downloader-to-normalizer handoff. Network calls use mocked responses; no live FIRMS key or reviewed scientific dataset has been used for these checks.

## Receive multiple yearly files in one batch

Use `science/scripts/intake_batch.py` when a delivery contains several CSVs.
Create a local JSON manifest next to the original files (for example under
Git-ignored `science/outputs/delivery/manifest.json`):

```json
{
  "schema_version": "raw-intake/1.0.0",
  "files": [
    {"id": "modis-2020", "input": "modis-2020.csv", "source": "MODIS_SP"},
    {"id": "snpp-2020", "input": "snpp-2020.csv", "source": "VIIRS_SNPP_SP"}
  ]
}
```

```sh
python3 science/scripts/intake_batch.py \
  --manifest science/outputs/delivery/manifest.json \
  --output science/outputs/intake-delivery-1
```

Paths resolve relative to the manifest, independently of the working directory.
Each entry requires a unique lowercase ID (letters, digits, hyphens or
underscores, maximum 64 characters), an input path and an explicit SP source.
An optional `provenance` path enables the existing downloader metadata checks.
Unknown manifest fields are rejected to catch misspelled settings.

The tool runs the existing normalizer separately for every entry. It writes an
ID-named package per file and `batch-report.json`, containing the manifest hash,
individual reports and their hashes, total record count and groups of identical
input hashes. Repeated files are flagged but retained; totals include them.
Records from distinct files are not joined or deduplicated. Memory usage includes
the existing normalizer's identity set for the current file, not all files at once.

If any file fails technical validation, no completed batch directory is published.
Staging files are removed on handled errors; an abrupt process termination may
leave a `.intake-*` staging directory, which is not a completed package. Existing
output packages are never overwritten. Outputs inside `app/` or `dist/`, including
symlink aliases, are blocked.

A successful batch is still **unreviewed**, with **unknown coverage**. Neither an
empty file nor a missing file proves zero activity. The batch does not authenticate
NASA origin, validate the Pantanal polygon, infer requested date windows, filter
points, apply scientific rules or replace frontend fixtures. Keep delivery notes,
the original download selections and the authoritative boundary alongside the raw
files for subsequent scientific review.

## Verify an intake package after transfer

Run the read-only integrity checker before reusing a received batch:

```sh
python3 science/scripts/verify_intake.py \
  --package science/outputs/intake-delivery-1
```

It checks the batch structure, each individual report hash and its embedded copy,
normalized JSONL hashes, row counts, source-file hash references, source labels,
record sequence, total count and repeated-input groups. Member paths must remain
inside their package directory; missing files and escaping symlinks are rejected.
Records are read one line at a time. Original raw CSVs are not required for this
check and their availability or current contents are not verified.

The command prints the SHA-256 of `batch-report.json`. Save that hash separately
when creating the package and communicate it through a trusted channel. The
receiver can pin it using `--expected-sha256 HASH`. Without that independently
trusted hash, the checker only establishes internal consistency: someone who
changes data and recomputes all metadata can produce a self-consistent package.
The checker is not a signature or an authentication service.

Passing these checks never confirms NASA origin, correct AOI membership, complete
coverage, scientific validity or permission to publish real data. The package
remains unreviewed. Unreferenced extra files are not inventoried by this command.
