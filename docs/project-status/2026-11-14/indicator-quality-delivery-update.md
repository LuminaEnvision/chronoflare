# ChronoFlare — indicator delivery review and SP quality audit

Reviewed November 14, 2026 (São Paulo). Supplier: André Salles, delivery 3,
version v1.0-handoff-3. This update follows the exact solar source inspector.

## What was received and accepted

The document defines a fixed S-NPP reference, per-platform/day/night observations,
strict SP quality selection, confidence classes, a detection-count benchmark and
separate Terra/Aqua calibration followed by convex combination. It supplies
forward/backward/sanity experiment windows and daily/weekly evaluation views.
Approval thresholds are intentionally deferred to delivery 4.

The registered engineering review records these definitions without importing
illustrative coefficients or declaring a validation pass. The scientific decision
registry and harmonization gate remain unchanged.

## Implemented work and rationale

A standalone SP quality audit classifies original CSV rows before later indicator
aggregation. Unlike the frozen preview's earlier candidate selection, the new
rule requires critical fields including instrument and day/night and strictly
positive FRP. It maps MODIS confidence to low/nominal/high, accepts only vegetation
source type 0, rejects low/invalid confidence, validates coordinates/time and
retains the verified FIRMS SNPP instrument alias.

Every structurally valid row is retained with original values, source hash,
one-based data-row index, quality result and rejection reasons. Missing values
are not imputed. Numeric source types are not truncated into vegetation type 0.
RT/NRT processing contradictions fail; NRT remains blocked without a separately
registered static-source mask. Auxiliary missing brightness/size fields do not
alone reject valid observations.

No AOI cut, deduplication, aggregation, model fit or public dataset update is
performed by this audit. This allows deterministic work to proceed while the
remaining interpretation questions are answered.

## Real-file audit result

These are the original supplier Brazil download inputs for August 1–15, 2020;
they are not Pantanal indicator totals.

| Source | Original rows retained | Quality pass | Quality fail |
| --- | --- | --- | --- |
| MODIS | 42,902 | 40,492 | 2,410 |
| VIIRS S-NPP | 162,017 | 148,107 | 13,910 |
| Total | 204,919 | 188,599 | 16,320 |

VIIRS has 83 non-positive-FRP rejection occurrences. Reasons can overlap with
confidence/type failures. These counts must not be added to claim independent
causes or interpreted as an approved fire-activity metric. The persistent report
contains source hashes and the complete rejection/confidence summary.

## Decisions and differences from the earlier preview

- Keep raw-quality auditing independent of technical normalization so rejected
  scientific values can remain available for inspection.
- Do not relabel the existing frozen preview as the final delivery-3 indicator:
  its earlier candidate filter and hashes are preserved.
- Implement the specified SP filter now; defer ambiguous duplicate selection and
  missing-turn estimation semantics rather than silently choosing a result.
- Keep NRT off until a sourced/versioned static mask exists.
- Treat example weights and scale factors as examples, not empirical parameters.
- Require model selection inside training, with the final test reserved for
  approval after thresholds are registered.

## Remaining stages

| Stage | Completed | Remaining |
| --- | --- | --- |
| Quality | Deterministic SP classifier, raw retention and confidence classes | Apply in a new versioned regional indicator pipeline |
| Exact duplicates | Key and SP preference recorded from supplier | Resolve first-versus-largest-FRP tie, quality order and coordinate-rounding ties |
| Daily estimates | Observed partial-turn interpretation documented | Confirm estimate policy when D or N is absent; compare compatible turn supports |
| Calibration | Strata, seasons and experiment dates recorded | Acquire sufficient train/test data and fit actual parameters |
| Validation | Required views/metrics recorded | Delivery 4 thresholds, week anchor/minimum paired support, intervals and zero-MAE policy |
| Public interface | Existing map, calendars and inspector preserved | Regenerate a new indicator snapshot after its full semantics are resolved |

Local verification passed all 110 Python tests, including missing critical
fields, strictly positive FRP, confidence thresholds, source/instrument aliases,
processing mismatch, source types, raw-row preservation, overwrite refusal and
malformed-CSV failure cleanup. The quality CLI completed both real-file audits.
English language and whitespace checks passed.

No additional key or NASA request was needed. The feedback handoff for André
acknowledges the resolved definitions and asks only the remaining implementation
questions, including the expected delivery-4 parameters.
