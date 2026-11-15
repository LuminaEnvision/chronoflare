# Multi-year scientific pipeline

## Stage 2: initial v1.0 acquisition design

The latest design is v1.1, described in the support-expansion section below.

The versioned plan selects 63 consecutive solar days starting February 1 and
August 1 in 2013–2015, 2017–2021: 1,008 candidate dates, two seasonal windows,
eight years. It prioritizes 2017–2021 for forward training/testing before the
2013–2015 backward holdout. The scientific train/test windows remain unchanged.
Dates were selected before any real calibrated holdout scoring. These windows
are a bounded feasibility sample, not a representative full-year trend study.

Each source/block downloads 64 UTC dates to close the last fixed solar day.
MODIS_SP retains Terra and Aqua separately; VIIRS_SNPP_SP is the sole target.
The pinned official IBGE boundary remains the spatial reference. The bbox is a
transport filter; exact point-centre clipping happens before observed aggregation.
The plan contains 416 nonoverlapping requests of at most five days each. It does
not request Brazil-wide archives or introduce NOAA-20, NRT or an AOI change.

Candidate dates do not guarantee positive same-turn observations, clear-sky
coverage or enough eligible weeks. The sufficiency gate must measure actual
support. Any later window expansion must be versioned before its model evaluation;
never cherry-pick dates from holdout errors. Backward training may use dates that
are forward holdout, but its fitted objects must remain independent and must not
feed forward selection or residuals.

The current FIRMS key is sufficient. Download errors, expired artifacts or sample
shortfalls must be reported explicitly. Model approval remains separate from
source acquisition and from publishing application data.

## Stage 3: resumable acquisition

`acquire_multiyear.py --cache /offline/path --max-new-requests 416` verifies all
existing CSV hashes, schemas, dates, bounds, counts and SP provenance before
spending a new request. Completed entries are immutable. The cache is bound to
the exact plan; an exclusive process lock prevents concurrent writers. A corrupt
entry stops acquisition for investigation instead of silently redownloading it.

Requests run sequentially with pacing and at most three attempts. The request
budget includes retries. Failure stops the batch and preserves completed inputs;
no unbounded rate-limit retry is attempted. The manifest records only sanitized
metadata and hashes. Empty successful CSVs are retained, without inferring zeros.

The `Multi-year scientific pipeline` workflow retains private source artifacts
for 90 days, including partial results on failure. Set `resume_run_id` to the
previous run to continue; set budget to zero for verified offline replay. Before
artifact expiry, preserve the cache in controlled project storage. No secret
enters raw provenance, committed data or command-line arguments. The workflow
uses the existing `FIRMS_MAP_KEY` GitHub secret and never deploys application data.

## Stage 4: measure actual sample support

`multiyear_readiness.py` independently verifies source CSVs against each request,
reconstructs only complete 26-request blocks, clips to the pinned boundary,
recomputes strict quality before deterministic deduplication, and retains raw-row
dispositions. Incomplete blocks cannot masquerade as complete solar windows.
Missing positive turn values stay null; empty successful requests remain valid
transport evidence without proving coverage.

The audit evaluates both registered experiments, distinct positive paired dates
and years in each platform/turn/season, permitted same-platform/turn season
fallback, and candidate complete D+N test days and five-day ISO weeks. It reports
sample insufficiency separately from model performance. Complete acquisition and
all support prerequisites are required before the next pipeline stage fits models.
The workflow publishes only sanitized readiness to a review branch, even after a
partial acquisition; raw dispositions and observed cells remain in artifacts.
The real MODIS SP response for August 16–20, 2021 exposed finite negative FRP
rows. Multi-year acquisition explicitly retains these original bytes for audit;
the default downloader remains strict. This is raw retention, not scientific
acceptance. The downstream audit normalizer preserves finite negatives and the
unchanged `FRP > 0` quality rule excludes them before deduplication or aggregation.
Nonfinite values, invalid coordinates/timestamps and out-of-request rows still
fail transport validation. No negative value is clamped to zero or used in an
observed indicator. Acquisition provenance counts retained negative rows.
## Version 1.1 support expansion

The completed v1.0 input had 162 forward candidate test days but only 17 eligible
weeks, and 106 backward days but only eight weeks. Both are below the registered
25/15-week minima; no model fitting or empirical holdout scoring occurred.
Version 1.1 therefore completes every solar date from January 20, 2012 through
December 31, 2015, and adds the same fixed seasonal windows in consecutive years
2022–2024. This expands support without selecting dates using fitted-model errors.
The original eight-year requests remain byte-for-byte identical plan entries.

The expanded design has 2,450 candidate solar dates, 32 nonoverlapping solar
blocks and 1,012 bounded requests in total. Transport padding can overlap one UTC
date between neighboring solar blocks; exact solar clipping prevents duplicate
scientific dates. The remaining 596 requests reuse the 416 existing downloads.
Even these larger inputs are a bounded Pantanal subset, not entire global bases
or full annual forward-validation coverage. Known S-NPP gaps remain missing,
never zeros. Actual support must be checked again before fitting.
