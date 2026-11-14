# Exact solar detection inspection

Open **Calendar → Calendar dataset → Real detections · experimental · August
2020**, select a platform/day and choose **Inspect selected detections**.

This inspector maps and lists the exact API records behind the selected solar
calendar cell. It does not redirect to the original Map delivery: that delivery
has different UTC boundaries and 96 fewer records before solar-date selection.
The original Map remains available for its existing national/regional review.

## Display and source traceability

The map, table and count use the same raw or proposed-filter selection as the
calendar. Map grouping is only a display convenience, not a fire-event count.
Zoom into groups or inspect a row using the accessible paginated table. Source
record details include acquisition UTC, solar day/platform, FRP, confidence,
source type, proposed-filter result/reasons, request identifier, original CSV
hash and the one-based data-row number excluding the header.

The fixed solar window is `[03:46:36Z, next-day 03:46:36Z)`. In particular,
August 15 can show August 16 UTC acquisitions that belong to its solar day.
No background zero, observation fraction, overpass count or approval is inferred.
All scientific limitations and pending indicator decisions remain unchanged.

The optional OpenStreetMap basemap has attribution and an independent failure
notice. The pinned IBGE 2025 reference outline is loaded from an existing local
asset with hash/size verification. An unavailable basemap or outline does not
remove valid source points or the table. Leaflet is loaded only when inspection
is opened. Ordinary calendar use does not download the point shards.

## Snapshot integrity

The committed package is `app/public/data/experimental/records-v1/`: 33,413
records divided into 45 day/platform shards plus a manifest. Only the selected
shard is loaded. Each manifest entry records hash, byte count, raw count and
proposed-filter count. The manifest binds the complete frozen calendar file by
SHA-256. Every source CSV hash must occur in the calendar's eight-file provenance.

Before display the frontend verifies:

- The requested source manifest reconciles with all 45 calendar cells.
- The calendar's raw bytes and parsed data match the displayed snapshot.
- The selected shard matches its expected hash, size, platform and solar window.
- Each row belongs to a known source file, valid request date and data-row range.
- No source row identity is repeated; distinct original rows remain distinct.
- Proposed quality decisions/reasons reproduce the existing rule.
- Raw and filtered counts and raw FRP audit sums reproduce the calendar cell.

If a file is missing, mixed with another snapshot or corrupted, inspection stops
with a retry state. The calendar, demonstration and original map remain usable.
Source-file verification requires HTTPS or localhost, as in the original review
map. Network-address HTTP is not a supported secure inspection context.

## Reproduction without new NASA requests

`science/scripts/export_solar_records.py` reuses the eight original CSVs from the
retained solar-preview artifact. It validates and normalizes them again, repeats
the official regional cut, derives solar dates, recomputes proposed filtering,
and requires exact equality with the frozen calendar summary before exporting.
The unfiltered original observations are preserved; the export is a minimal
projection of traceability fields, not an arbitrary raw-record dump.

In **Actions → Test NASA FIRMS API access**, use `mode=records` and set
`replay_run_id` to a successful run containing `firms-solar-preview-evidence`.
The export job has no FIRMS secret or NASA request step. It writes changes only
to a separate `data/solar-records-<run ID>` review branch, never the default branch
or a deployment. If generated assets already match, it exits successfully without
a new commit. Its repository-write permission is limited to that manual export
job; the download job retains its existing read-only permissions.

Verified export run:
https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43654641861

That run reproduced all 33,413 records from frozen evidence and issued no new
FIRMS requests. Regeneration depends on the seven-day artifact retention window;
committed shards and their integrity tests remain available after expiry.

## Links and validation

`solar_inspect=1` opens the inspector. `solar_record=<CSV SHA-256>:<data row>`
restores a selected source record. These parameters accompany the existing
`solar_day`, `solar_platform` and `solar_filter` namespace. Changing day, platform
or filter clears the old row identity. Back/Forward and copied links retain the
remaining calendar, comparison and raw-map context.

Tests reconcile every committed record and hash against all calendar cells and
exercise timestamp, quality, lineage, duplicate, snapshot and corruption failures.
Browser review covers desktop and 390px mobile emulation, keyboard selection,
pagination, deep links, Back/Forward, UTC padding rows, map/demo transitions,
HTTP 503/retry, unavailable tiles and page-error monitoring. Physical
Safari/iPhone review remains a post-deployment follow-up.

Review captures: [desktop](solar-detection-inspector/desktop.png) and
[mobile](solar-detection-inspector/mobile.png). The captures include the verified
local reference outline and the explicit unavailable-basemap state.
