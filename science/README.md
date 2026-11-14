# Offline science workflow

## Available now

`science/scripts/firms_download.py` downloads one explicit FIRMS Standard Processing window and saves the original CSV plus SHA-256 provenance. Configure `FIRMS_MAP_KEY` locally and follow [external-source setup](../docs/external-sources.md). The script uses Python's standard library; no package installation is required.

```sh
npm run test:science
python3 science/scripts/firms_download.py --help
```

Tests use mocked network responses. Live authenticated access has not been verified. Raw downloads under `science/outputs/` are ignored by Git and must never become frontend assets.

## Technical CSV normalization

`science/scripts/normalize_detections.py` reads a local FIRMS SP CSV, preserves original fields, normalizes UTC timestamps/platform aliases/numbers, and writes traceable JSONL plus an intake report. It optionally verifies the downloader provenance file. See [raw-ingestion instructions](../docs/raw-ingestion.md).

```sh
python3 science/scripts/normalize_detections.py --help
```

The adapter retains low-confidence/static-source records and duplicates; quality decisions, AOI/cell assignment, and local solar dates remain unset. Its output is an unreviewed intermediate format, not a frontend aggregate. No key or third-party Python dependencies are required.

## Still pending

Scientific derivations, local solar dates, confidence/coverage rules, platform combination, H3 aggregation, calibration, seasonal baselines, uncertainty and validation remain André's responsibility. The downloader does not implement these steps or approve any output.

Confirm the AOI and collections, pre-register thresholds with a timestamp, and preserve input provenance/hashes before running experiments. The decisions in `configs/decisions.json` intentionally remain pending.

Expected frontend outputs: [scientific handoff](../docs/data-handoff.md). The browser consumes derived static artifacts, not raw FIRMS detections or authenticated NASA APIs.

## Batch intake

`science/scripts/intake_batch.py` accepts an explicit local manifest for multiple
CSV files, runs the existing normalizer per source and creates a consolidated
traceability report. Failed batches are not published; repeated file hashes are
flagged without deleting records. See [batch instructions](../docs/raw-ingestion.md#receive-multiple-yearly-files-in-one-batch).

After transferring a batch, use `science/scripts/verify_intake.py --package PATH`
to check referenced file hashes, record counts and internal provenance without
modifying the package. An independently recorded batch-report hash can be pinned
with `--expected-sha256 HASH`. See [integrity checks](../docs/raw-ingestion.md#verify-an-intake-package-after-transfer).
