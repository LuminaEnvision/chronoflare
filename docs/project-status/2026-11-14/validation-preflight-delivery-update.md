# ChronoFlare — validation preparation before delivery 4

> **Historical/stage-specific record.** This page preserves the facts, test counts and remaining work of its original delivery. It is not the current project approval or feature checklist. See [current validation and scope](../../validation-report.md) and the [documentation index](../../README.md). Any associated dated PDF/Word remains that historical snapshot.

Prepared November 14, 2026 (São Paulo). This update follows delivery-3 quality
auditing. It changes neither the application nor a scientific approval decision.

## Delivered work and rationale

An offline preflight inventories the frozen real preview against the registered
experiment windows and records why it cannot yet be used for fitting or approval.
The report includes input hashes, date/season/platform availability and explicit
blockers. Missing metrics remain null; validation views remain not_run.

Independent Python helpers validate inclusive train/test windows, label outside
dates, pair only same-region/date/turn/metric observations, and list every
unmatched/null/outside exclusion. Duplicate aggregate keys and mixed derived
processing versions fail rather than being summed or silently selected.

An explicit training-input check rejects held-out, outside, empty or mislabeled
fitting inputs. Forward and backward experiments are separately declared; the
NOAA-20 sanity comparison is not invented as a training experiment. These
helpers prepare a future supported fitting path; they do not themselves fit a
model or authenticate upstream observations.

## Current real-input inventory

| Item | Current snapshot |
| --- | --- |
| Solar dates | August 1–15, 2020; 15 distinct dates |
| Platform/day cells | 15 each for Terra, Aqua and S-NPP |
| Seasonal support | 15 dry dates, no wet dates |
| Forward split | No training dates; 15 test dates |
| Backward split | 15 training dates; no test dates |
| NOAA-20 series | Absent |
| Final day/night indicator pairs | Not evaluated from this earlier preview |
| Fitting and approval | Blocked; no metric or coefficient generated |

Date availability is not measured observation coverage. The preview contains
per-platform daily totals, not final day/night aggregates with registered exact
deduplication. Its earlier candidate filter is not relabeled as the full
indicator rule. Original CSVs can support later processing, but this preflight
does not infer missing turn values from a daily total or substitute zero.

## Decisions and differences from the next-stage plan

- Prepare temporal and pairing safeguards now rather than waiting for numerical
  thresholds; no threshold value is chosen by engineering.
- Keep the report as a date/input inventory, not a calibration or validation run.
- Refuse duplicate or version-mixed aggregate inputs instead of resolving the
  scientific deduplication ambiguity implicitly.
- Require matched turn support; do not treat D and N or different metrics as
  interchangeable.
- Preserve pending weekly/uncertainty rules and all existing scientific gates.
- Avoid new downloads: the current snapshot already demonstrates the missing
  training/seasonal inputs; larger acquisition can be explicitly planned later.

## Verification and remaining work

| Stage | Completed | Remaining |
| --- | --- | --- |
| Time windows | Inclusive endpoints, disjoint splits, backward experiment and held-out input checks | Use the guard in the eventual fitting entry point |
| Pairing | Exact region/date/turn/metric match, version checks, exclusions and duplicate rejection | Supply final quality-passed, deduplicated observed aggregates |
| Readiness | Hash-bound report generated from the real frozen preview | Training, wet-season, backward-test and NOAA-20 inputs |
| Scientific rules | Outstanding configuration fields remain explicit | Previous clarification points and delivery 4 |
| Approval | No fit, metrics, intervals, weights or approval produced | Registered thresholds followed by independent validation |

All 122 Python tests passed locally, including temporal endpoints, invalid and
overlapping windows, turn/region/metric mismatch, missing/reference nulls,
version/duplicate rejection, held-out-label tampering, empty fitting input and
the actual frozen preview inventory. Language and whitespace checks passed.
No frontend code changed; the existing CI also verifies the application/data.

The operational guide is docs/validation-preflight.md. The persistent report is
docs/validation-preflight/current-preview-readiness.json. No new question for André,
additional credential or NASA request was introduced by this preparation.
