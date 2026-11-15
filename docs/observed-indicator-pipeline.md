# Observed indicator preparation, delivery 3 v1.1

The Python-only pipeline prepares source-bound native-scale observations. It
does not update the website or enable a harmonized series.

## Run without a FIRMS key

Use **Test NASA FIRMS API access → Run workflow → mode=indicator**, with
`replay_run_id` pointing to a retained `training-period-evidence` artifact.

The job has no FIRMS secret and cannot perform a NASA acquisition. It revalidates
all sixteen CSVs against the committed 2019 hashes and frozen 2020 provenance,
then repeats region membership, solar dates and SP quality before aggregation.
A separate publisher stages only sanitized observations/summary on a review
branch. It never pushes to main or deploys.

Locally:

```sh
python3 science/scripts/build_indicator_observations.py \
  --evidence path/to/training-period-evidence \
  --output science/outputs/observed-indicators-v1.1
```

The output must be a new offline directory outside app/ and dist/. Source
integrity/date failures stop processing. No fallback to live downloads or NRT is
available in this command.

## Outputs and semantics

For each year, `observations.json` contains ninety platform/solar-day/turn cells.
Only deterministic technical-key winners contribute to native FRP sums and
counts. Missing positive observations stay null. Float64 values are not rounded
before deduplication or summation; `math.fsum` reduces order sensitivity.

`record-dispositions.jsonl` retains every regional source row, including quality
failures and duplicate losers, together with its input ordinal, source hash/data
row and winner reference. Raw CSVs remain in the source evidence artifact.

`summary.json` binds the current protocol hash and records source counts,
observed same-turn pairing/exclusions, train/test labels and sample-floor audits.
The current inputs have only one training year, so no stratum can pass the
registered three-year floor. Nothing is fitted even where a test sample floor
happens to pass.

Committed observed products are under `docs/indicator-observations/`. They are
research outputs, not public frontend assets or approved model predictions.
The Actions `observed-indicator-evidence` artifact retains complete dispositions
and observed products for thirty days. Source CSVs remain bound by their hashes
to the training-period artifact.

## Deterministic primitives

`indicator_methods.py` implements:

- Recomputed quality before exact-key selection with stable provenance ties.
- Native observed platform/D/N aggregation, rejecting mixed regions/platforms.
- Complete-turn daily-estimate gating and convex combination of supplied values.
- Numerically stable inverse-OOF-MAE weighting with the registered floor.
- ISO weekly same-day pairing, minimum-five support, separate paired means and
  canonical seven-day equivalents, with exclusive period ends.
- Distinct-training-date/year sample-floor checks, rejecting held-out dates.
- Application of supplied empirical residual quantiles and extrapolation
  inflation, without fitting them or claiming guaranteed coverage.

These helpers check mathematical/data-contract conditions. Future model fitting
must still enforce training-only inputs, registered method selection, OOF
provenance, uncertainty calibration and delivery-4 approval criteria.

The canonical rule details and attachment reconciliation are in the
[v1.1 review](indicator-v1.1-review.md). That review supersedes the initial
questions, not the historical audit snapshots. Existing calendars and source
inspectors keep their original hashes, source selections and labels.
