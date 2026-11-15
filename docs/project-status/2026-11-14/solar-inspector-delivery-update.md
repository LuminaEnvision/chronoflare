# ChronoFlare — exact solar detection inspection

Delivered November 14, 2026. This update follows the experimental real calendar.

## What changed and why

The experimental calendar now opens an exact source-record inspector for its
selected platform, solar day and raw/proposed-filter selection. Users can see
points on a map, inspect a keyboard-accessible paginated table, and read each
record's UTC timestamp, FRP, confidence, source type and original CSV reference.

A simple link to the original Map would not reproduce the calendar count. The
Map retains the supplier's original delivery and UTC filters, while the calendar
uses the independent API snapshot, solar dates and next-UTC-day padding. The new
inspector therefore uses exactly the same frozen API observations as the calendar.
The original Map keeps its source and existing review workflow.

## Reproduction and integrity

No new NASA request or credential was needed. The existing eight CSVs were
revalidated and normalized offline. The official IBGE reference cut, solar dates
and proposed quality results were recomputed, and the entire reproduced summary
was compared with the committed calendar before export.

The export contains **33,413 source records in 45 day/platform shards**, plus an
integrity manifest bound to the calendar file's SHA-256. Only a selected shard is
loaded after inspection opens. Source rows preserve the CSV hash and one-based
data-row number excluding the header. Distinct source rows are not deduplicated.

Runtime checks verify shard hash/size, dates, platform, source lineage, quality
results and all raw/filtered counts and FRP audit sums. Tests independently
reconcile every committed shard against the calendar. Corrupted or mixed
snapshots fail closed with a retry action, without removing the calendar.

The selected source row and open inspector have their own URL parameters.
Copied links and Back/Forward restore the row. Changing the source selection
clears its old identity. Other demo, comparison and map parameters are preserved.

## Map and failure behavior

Leaflet maps the exact selected rows and groups points only for display. Source
records are always available through the table when the basemap fails. The
existing pinned IBGE 2025 outline provides local geographic context and has its
own integrity/failure handling. The OpenStreetMap layer retains attribution.

The inspector requires HTTPS or localhost for browser cryptographic checks.
A plain HTTP LAN address cannot perform secure inspection. This restriction is
explicit and matches the original review-map policy.

## Decisions and differences from the plan

- Replaced a proposed direct link to the original Map with an inspector tied to
  the calendar snapshot, avoiding mismatched counts and time boundaries.
- Reused existing frozen evidence rather than repeating API requests.
- Exported small per-day/per-platform files instead of loading the entire dataset
  for every inspection.
- Added source-row deep links and snapshot validation before record display.
- Kept recorded detections, display groups and scientific fire events distinct.
  No approval, coverage fraction, harmonization or new metric was introduced.

## Verification and remaining work

| Stage | Completed | Remaining |
| --- | --- | --- |
| Evidence export | Offline reproduction and all 33,413 traceable rows | Reacquisition only when intentionally changing the snapshot or after source-artifact expiry |
| UI inspection | Exact points/table/counts, pagination, source details and links | Physical iPhone/Safari review after deployment |
| Integrity | Calendar binding, file hashes, quality/count/FRP reconciliation | Keep versioned assets together in deployment |
| Scientific interpretation | Unreviewed status and proposed-filter labels preserved | André's indicator.md for final metric/filter/duplicate and combination decisions |
| Comparison | Existing demonstration preserved | Equivalent real second period and approved comparison method |

Local checks passed: 102 TypeScript tests, 100 Python tests, production build,
English language check and whitespace checks. Browser checks passed for desktop
and 390px mobile layout, keyboard source selection, pagination, source deep links,
Back/Forward, a real August 16 UTC padding record, platform/filter changes,
map/demo transitions, injected HTTP 503 with retry and basemap failure. No page
errors or document-level horizontal mobile overflow were observed.

The workflow generates assets only on a separate review branch. Its manual
export job uses scoped repository-write permission; it does not receive the
FIRMS secret, write to main or deploy. Unchanged regeneration exits without
creating another commit.

Verified offline export:
https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43654641861

Scientific decisions remain pending. No additional key is required.
