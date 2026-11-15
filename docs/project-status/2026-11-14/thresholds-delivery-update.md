# ChronoFlare — Delivery 4 registration and validation gate

> **Historical/stage-specific record.** This page preserves the facts, test counts and remaining work of its original delivery. It is not the current project approval or feature checklist. See [current validation and scope](../../validation-report.md) and the [documentation index](../../README.md). Any associated dated PDF/Word remains that historical snapshot.

Delivery 4 now supplies the scientific acceptance criteria that were pending
after delivery 3. The received document and operational JSON have recorded
hashes. Source-declared preregistration and actual workspace receipt are separate.
No empirical model validation was run before or during this integration.

## What changed and why

The scientific pipeline now computes tie-aware Spearman, weekly PBias/MAE/rMAE,
daily interval coverage and median relative width, with explicit undefined cases.
It evaluates the naive splice on the same paired cohort, checks training/test
samples and refuses Plan A without complete forward/backward evidence and
verified frozen-model provenance. Real readiness is Plan B with null empirical
metrics: insufficient evidence, not a failed fitted model.

## Decisions different from the previous plan

The latest structured JSON governs conflicting prose. Weekly validation uses
paired daily means instead of delivery-3 seven-day equivalents. Terra's forward
PBias limit is 30%, versus 25% for Aqua/combined. Combined rMAE must be at most
0.45 and improve strictly over the naive splice; no 20% rule was invented.
Backward daily PICP must reach 68%. Test support now needs two distinct years,
including season fallback. These choices and exact formulas are documented in
`docs/scientific-thresholds.md`. Weekly interval coverage stays undefined because
no weekly interval construction was registered.

## Stage status

| Stage | Completed | Remaining |
| --- | --- | --- |
| Scientific registration | Threshold JSON, source receipt, explicit conflict resolutions | Review any future version before scoring |
| Observed inputs | Deterministic source-bound 2019/2020 platform/turn aggregates | Multi-year and seasonal expansion |
| Sample checks | Positive paired dates, train/test years, fallback and global support gates | Three training years, two test years and required days/weeks |
| Metrics and decision | Deterministic arithmetic, conservative Plan A/B gate and tests | Real frozen-model forward/backward predictions |
| Calibration | Existing mathematical primitives retained | Training-only model selection, weights and residual quantiles |
| Application | Existing map/calendar sources preserved | Reviewed, versioned publication of approved results |

The offline workflow reuses stored CSVs without a FIRMS key or new API requests.
Synthetic tests exercise mathematical success and failure paths; they do not
constitute scientific approval. Application fixture decisions are separate from
the offline scientific readiness registry. No additional key or manual download
is requested from André. His feedback is in the Portuguese handoff document.
