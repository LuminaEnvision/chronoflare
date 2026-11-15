# Bounded 2019 training-period pilot and same-rule 2020 replay

This preparation obtains a limited sample from the forward training period. It
does not fit a model, validate harmonization or update the public application.

## Verified acquisition

The authenticated FIRMS Area API returned all eight requested 2019 files:
MODIS_SP and VIIRS_SNPP_SP, each for August 1–5, 6–10, 11–15 and 16 UTC. The
last day supplies the padding required to complete August 15's solar window.
The request rectangle is −60,−23,−54,−15; both years are clipped to the same
pinned official IBGE 2025 point-centre reference, with no buffer.

The previous eight 2020 files were reused and bound to the committed preview's
source hashes. Both years were processed with `indicator-sp-quality/1.0.0`, the
same fixed −56.65° solar reference and separate Terra/Aqua/S-NPP and D/N groups.
The earlier 2020 candidate filter was not used as the new quality rule.

| Year / platform | Regional solar records | Quality pass, before dedup |
| --- | --- | --- |
| 2019 Terra | 485 | 461 |
| 2019 Aqua | 753 | 713 |
| 2019 S-NPP | 4,409 | 4,053 |
| 2020 Terra | 2,655 | 2,481 |
| 2020 Aqua | 4,210 | 3,950 |
| 2020 S-NPP | 26,548 | 23,701 |

2019 totals are 5,647 raw and 5,227 quality-passing observations. These are
**pre-dedup audit counts**, not validated fire-event totals or a calibrated
cross-year trend. Observation coverage is unknown in every group.

The stricter replay rejects three non-positive-FRP S-NPP observations in the
2020 regional sample; some also fail other criteria. One passed the older preview
filter, so the new selection has 23,701 rather than 23,702 S-NPP records. The
frozen preview and its exact inspector are unchanged and remain internally
consistent with their earlier candidate rule.

Reported version tokens are 6.03 for MODIS and 2 for VIIRS in both audits. These
are preserved provider values, not independently inferred collection names or
proof of equivalent observation coverage.

## Turn and duplicate diagnostics

Every year has a 90-cell inventory: 15 solar dates × 3 platforms × 2 turns.
Missing quality-passing positives yield null counts/sums. Raw record counts are
separate diagnostics. Missing/invalid turn records remain explicitly counted;
no turn or observed zero is invented.

Potential same-turn positive overlap with S-NPP, before final deduplication:

| Year | Terra | Aqua |
| --- | --- | --- |
| 2019 | 26 groups | 25 groups |
| 2020 | 30 groups | 28 groups |

These are availability diagnostics, not final calibration pairs. No missing
partner is filled with zero, and positive presence does not prove clear-sky AOI
coverage. The actual models and validation thresholds remain absent.

The delivery-3 duplicate key was audited under both Decimal half-even and
half-up five-decimal rounding. Neither scenario found a collision in either
sample. This does not settle the future conflict/tie policy. No winner was
selected and no original row was removed. The experimental spatial-overlap
variant remains disabled.

## Evidence and reruns

Acquisition and safe report publication passed in:
https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43663652155

Committed reports:

- [2019 audit](training-period-audit/2019-august-summary.json)
- [2020 same-rule audit](training-period-audit/2020-august-summary.json)
- [Cross-period readiness](training-period-audit/readiness.json)

The `training-period-evidence` Actions artifact retains the sixteen original
CSVs, safe provenance, regional raw-row lineage and reports for **30 days**. Only
sanitized reports are committed; credentials and credential-bearing URLs are
excluded. The report publisher has repository-write permission in a separate job
without the FIRMS key and writes only to a review branch, never main or deployment.

In **Test NASA FIRMS API access → Run workflow**, choose:

- `mode=training`, `evidence_layout=solar-preview`, and the source preview run ID
  to acquire eight 2019 requests and replay eight 2020 files.
- `mode=training`, `evidence_layout=training-period`, and a retained training run
  ID to replay both years with **zero NASA requests and no FIRMS key**. The 2019
  hashes must match the committed acquisition report; 2020 hashes must match the
  frozen calendar. Replay retains evidence but skips report publication.

Locally, `training_period_pilot.py --reference-evidence PATH --output NEW_DIR`
recognizes the preview or two-year artifact layout. A fresh acquisition requires
`FIRMS_MAP_KEY`; replay of both years does not. Output must be a new offline
directory outside app/ and dist/. Invalid frozen evidence fails before spending
the new acquisition request budget. The batch is published only on full success.
No retries, broad historical loops, NRT fallback or automatic deployment occur.

## Training/test separation and remaining work

Under the declared forward experiment, 2019 is a training-period candidate and
2020 a held-out-period candidate. Reports and observations remain separate by
year. The pinned boundary loader does not read 2020 detection shards to prepare
the 2019 sample. No model-selection or fitting step consumes either year.

Both samples contain only fifteen dry-season days. Multi-year/wet-season inputs,
backward-test and NOAA-20 data remain missing. The final duplicate policy,
missing-turn estimate semantics, weekly rules and delivery-4 thresholds still
need registration. The application continues to show its earlier 2020 snapshot;
2019 is currently an offline audit input, not a new public calendar year.

No additional credential was required.

The current two-year replay also passed without supplying FIRMS_MAP_KEY:
https://github.com/j-c-fstk-dev/chronoflare/actions/runs/43664381035
It reported zero NASA requests and sixteen source-file replays.
