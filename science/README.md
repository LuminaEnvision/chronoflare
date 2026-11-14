# Offline science workflow

## Available now

`science/scripts/firms_download.py` downloads one explicit FIRMS Standard Processing window and saves the original CSV plus SHA-256 provenance. Configure `FIRMS_MAP_KEY` locally and follow [external-source setup](../docs/external-sources.md). The script uses Python's standard library; no package installation is required.

```sh
npm run test:science
python3 science/scripts/firms_download.py --help
```

Tests use mocked network responses. Live authenticated access has not been verified. Raw downloads under `science/outputs/` are ignored by Git and must never become frontend assets.

## Still pending

Scientific normalization, local solar dates, confidence/coverage rules, platform combination, H3 aggregation, calibration, seasonal baselines, uncertainty and validation remain André's responsibility. The downloader does not implement these steps or approve any output.

Confirm the AOI and collections, pre-register thresholds with a timestamp, and preserve input provenance/hashes before running experiments. The decisions in `configs/decisions.json` intentionally remain pending.

Expected frontend outputs: [scientific handoff](../docs/data-handoff.md). The browser consumes derived static artifacts, not raw FIRMS detections or authenticated NASA APIs.
