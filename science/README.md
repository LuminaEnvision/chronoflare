# Offline science workflow

## Available now

`science/scripts/firms_download.py` downloads one explicit FIRMS Standard Processing window and saves the original CSV plus SHA-256 provenance. Configure `FIRMS_MAP_KEY` locally and follow [external-source setup](../docs/external-sources.md). The script uses Python's standard library; no package installation is required.

```sh
npm run test:science
python3 science/scripts/firms_download.py --help
```

Tests use mocked network responses. Authenticated FIRMS access and historical pilots have been verified; current multi-year evidence is tracked separately. Raw downloads under `science/outputs/` are ignored by Git and must never become frontend assets.

## Technical CSV normalization

`science/scripts/normalize_detections.py` reads a local FIRMS SP CSV, preserves original fields, normalizes UTC timestamps/platform aliases/numbers, and writes traceable JSONL plus an intake report. It optionally verifies the downloader provenance file. See [raw-ingestion instructions](../docs/raw-ingestion.md).

```sh
python3 science/scripts/normalize_detections.py --help
```

The adapter retains low-confidence/static-source records and duplicates; quality decisions, AOI/cell assignment, and local solar dates remain unset. Its output is an unreviewed intermediate format, not a frontend aggregate. No key or third-party Python dependencies are required.

## Registered protocols and scientific pipeline

The current scientific decision is **Plan A for the frozen v2 forward model in
Pantanal**, published only with both complete aligned MODIS platforms. The
[validation overview](../docs/validation-report.md) links the decision, independent
metrics, exact model and limitations. The rejected v1 Plan B remains historical
evidence; source acquisition and automated checks do not grant approval.

The [multi-year pipeline](../docs/multiyear-pipeline.md) documents the original
bounded acquisition, complete-block reconstruction and v1 experiments. The
[v2 record](../docs/harmonization-v2-candidate.md) documents the revised frozen
model, registered independent test and subsequent approval. Raw inputs under
`science/outputs/` remain separate from app assets.

## Approved static publication

`science/scripts/export_harmonized_series.py` applies the approved frozen model
without refitting and verifies decision/evidence hashes. It produced 4,318
acquired-date rows and 635 estimates in `app/public/data/observations/v1/`.
No score is repeated to serve or build the application. See the
[active handoff](../docs/data-handoff.md) and [export contract](../docs/observation-app-export-contract.md).

The scientific export needs the original reconstruction artifacts, which are
retained separately from Git; preserve them before Actions retention expires.
The browser consumes committed derived static files, not authenticated NASA
APIs. Known interruptions are negative evidence, not proof of cloud-free AOI
coverage; missing observations remain null. Only six/five estimates are published
in 2025/2026, and no independent backward validation is claimed.

## Batch intake

`science/scripts/intake_batch.py` accepts an explicit local manifest for multiple
CSV files, runs the existing normalizer per source and creates a consolidated
traceability report. Failed batches are not published; repeated file hashes are
flagged without deleting records. See [batch instructions](../docs/raw-ingestion.md#receive-multiple-yearly-files-in-one-batch).

## Provisional spatial diagnostics

Install `science/requirements.txt` for the Shapely geometry dependency, then run
`science/scripts/diagnose_detections.py` with an explicit source, GeoJSON polygon
and AOI reference. It preserves inside/boundary/outside partitions and reports
UTC per-platform diagnostics without approving the boundary or scientific rules.
See [spatial diagnostics](../docs/raw-ingestion.md#provisional-spatial-diagnostics).
The downloader and normalizer themselves still use only the standard library.
After transferring a batch, use `science/scripts/verify_intake.py --package PATH`
to check referenced file hashes, record counts and internal provenance without
modifying the package. An independently recorded batch-report hash can be pinned
with `--expected-sha256 HASH`. See [integrity checks](../docs/raw-ingestion.md#verify-an-intake-package-after-transfer).

## Exploratory map export

`science/scripts/export_detection_review.py` creates minimal per-source/day map
assets directly from the original national CSVs, without AOI clipping. It keeps review status separate
from calendar aggregates and preserves source/AOI hashes. See the
[detection explorer contract](../docs/detection-explorer.md) before exporting or
publishing any exploratory data.

## Official Pantanal reference filter

`science/scripts/prepare_pantanal_review.py` adds a spatial subset from the pinned
official IBGE 2025 archive. Install `science/requirements.txt` for Shapely, pyshp
and pyproj. The national records remain unchanged. This raw-map layer remains unreviewed as
fire-activity metrics and does not inherit the separate calendar's v2 approval;
observation coverage is still unknown. See [regional derivation and limits](../docs/pantanal-region.md).
