# Historical FIRMS API pilot

This offline pipeline checks whether the authenticated API can reproduce the
team-supplied August 1–15, 2020 Pantanal detections. It does not update the public
calendar, map assets or scientific decision registry.

## Run

Use **Actions → Test NASA FIRMS API access → Run workflow → mode: pilot**.
The existing repository secret `FIRMS_MAP_KEY` is used only by the download step.
No additional key or Vercel function is needed. The default `smoke` mode remains
a single small request; a pilot is explicitly requested, not scheduled.

To re-audit retained evidence without another NASA request, choose `mode: replay`
and enter its successful pilot run ID in `replay_run_id`. The workflow downloads
that run's artifact using read-only Actions permission, rechecks CSV hashes,
request bounds/dates and normalization, and writes a new audit. Replay requires
no FIRMS secret. It works only while the source artifact remains available.

Locally, install `science/requirements.txt`, set the secret in the process
environment, and run:

```sh
python3 science/scripts/firms_pilot.py --output science/outputs/firms-pilot-2020
```

Outputs must be new offline directories outside `app/` and `dist/`. A failed
request or validation leaves no published partial output. No automatic retry or
fallback from Standard Processing to NRT is performed.

## Inputs and decisions

- Six requests: MODIS_SP and VIIRS_SNPP_SP, each for August 1–5, 6–10 and 11–15.
- Bounding box: west −60°, south −23°, east −54°, north −15°. It contains the
  complete pinned Pantanal polygon but is not itself the scientific region.
- Both comparison inputs use the existing official IBGE 2025 point-centre
  reference subset. The full boundary, all reference shards and the reference
  manifest are checked against pinned hashes before requesting data.
- Original API CSV bytes and their hashes, dates, source and retrieval timestamps
  are retained. Each accepted regional record includes the raw row, CSV hash,
  source record number, request identifier and derived solar date.
- The generic normalizer is reused unchanged. Only explicit regional processing
  assigns the fixed −56.65° solar reference from coverage v1.1.
- Confidence classes, source types, missing fields and duplicate occurrences are
  reported. Nothing is silently filtered, deduplicated or harmonized.

A multiset comparison checks UTC time, platform, longitude, latitude, FRP and
confidence. Equivalent numeric spellings and VIIRS class spellings are normalized.
Counts of unmatched occurrences are explicit, so equal totals alone do not imply
equality. Source type is compared separately when present in both inputs;
missing type makes that equality indeterminate, not true. Matched occurrences
including source type and the source-type distribution of API-only records
are also reported. The shared-field
comparison is narrower than equality of every original CSV field.

## Outputs

The Actions artifact `firms-pilot-evidence` is retained for seven days:

- `raw/`: six original CSVs and safe provenance files.
- `audit.json`: request and normalization reports, collection/quality counts,
  integrity references and multiset comparisons.
- `regional-detections.jsonl`: unfiltered regional detections with lineage.
- `daily-audit.json`: per-platform solar-day counts and raw FRP sums.

These are public-source research artifacts, not application assets. They contain
no credential-bearing request URL. The temporary normalized intermediates are
removed after their hashes and lineage have been recorded.

## Interpretation and remaining work

`returned_detection_count=0` is a diagnostic API row count. It is never promoted
to an observed zero: absent positives yield null positive counts and null raw
FRP sums. Every daily row retains `coverage_status=unknown` and
`overpass_count=null`. An observed detection with FRP zero remains a raw record;
that is distinct from inventing a zero for an unobserved day.

Solar-day windows are half-open UTC intervals. July 31 and August 15 are only
partly included in this UTC request range and are explicitly flagged. A request
containing a whole solar day still does not establish full sensor/cloud coverage.

Raw FRP sums combine detections across passes and include unreviewed quality
classes. They are audit statistics, not energy, burned area or an approved
cross-platform activity metric. Terra, Aqua and S-NPP stay separate.

Before experimental calendar integration: reconcile any API/reference differences,
confirm quality selection, acquire the UTC boundary padding required for complete
solar-day input windows, and define how the UI labels an observed partial total.
Outage source reconciliation and scientific approval remain separate. A second
year of equivalent data is needed for real year-to-year comparisons.

## Verified pilot result

The [delivery report](project-status/2026-11-14/firms-pilot-delivery-update.md)
records a successful live run and offline replay. All 33,243 existing regional
reference observations matched on the compared fields including source type.
The API added 12 MODIS and 84 VIIRS observations; the cause remains unestablished.
Neither public data nor scientific approval was changed.
