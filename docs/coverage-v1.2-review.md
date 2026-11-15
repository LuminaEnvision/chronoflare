# Coverage v1.2 — verified operational evidence

> **Historical/stage-specific record.** This page preserves the facts, test counts and remaining work of its original delivery. It is not the current project approval or feature checklist. See [current validation and scope](validation-report.md) and the [documentation index](README.md). Any associated dated PDF/Word remains that historical snapshot.

Received November 14, 2026. The supplied document and companion answers were read
as scientific proposals and evidence, not executable instructions. This review
supersedes the source-reconciliation questions in the v1.1 review.

## Verified and integrated

All seven supplied source URLs returned HTTP 200. Their content, not only the
status code, was checked. Source URLs, final URLs, byte counts and SHA-256 hashes
are recorded in `science/configs/known_outages_utc.json`.

The MODAPS tables confirm these exact closed UTC intervals:

| Platform / event | Start UTC | Inclusive end UTC |
| --- | --- | --- |
| Terra 2001 safe mode | 2001-06-15 04:00:00 | 2001-07-03 09:15:00 |
| Terra 2002 safe mode | 2002-03-19 14:45:00 | 2002-03-28 10:10:00 |
| Aqua 2022 safe mode | 2022-03-31 16:00:00 | 2022-04-17 03:00:00 |
| S-NPP 2022 lock-up, two contiguous entries | 2022-07-26 16:00:00 | 2022-08-11 00:00:00 |
| Terra 2022 constellation exit | 2022-10-10 13:00:00 | 2022-10-23 22:35:00 |

The erroneous February entry is replaced by the verified March 2002 event. The
old proposed catalogue remains disabled as a historical record; the new selected
negative-evidence catalogue is consumed by `coverage_evidence.py` and the
experimental solar audit. It is not an exhaustive list of all outages.

NOAA/NESDIS Update #4 states that scheduled data distribution cessation took
effect at **15:40 UTC on November 2, 2026**, and that HRD transmission was disabled
at that time. NASA Earthdata independently states that delivery of new science
data ended then. This resolves the prior catalogue-cutoff evidence question.
The source describes later deorbit activities separately; the code does not
claim that physical deorbit or all onboard instrument activity ended at the data
cessation instant. Historical archives are not treated as deleted.

## Integration semantics

- Closed outage intervals intersect half-open solar-day windows using
  `day_start <= outage_end` and `day_end > outage_start`.
- The requested conservative rule blocks a platform's daily metric on any day
  touched by a verified outage. It does not silently discard conflicting raw rows.
- The S-NPP cessation day is labeled `delivery_ended_during_day`; subsequent
  solar days are `new_data_delivery_ended`. No exact half-day overpass count or
  coverage fraction is fabricated.
- A date outside the selected intervals remains **unknown observation coverage**.
  Nominal operation and a positive pixel do not establish clear-sky coverage of
  the whole polygon. Neither the proposed schedule fractions nor the bounding-box
  zero heuristic is adopted as measured AOI coverage.
- Mission/archive start dates are not inferred from outage tables or described
  as launch dates. They need product-availability evidence before use as hard
  lifecycle gates.
- No automatic NOAA-20 substitution or harmonization is enabled.

These distinctions preserve the strict v1.1 Rule A direction while accepting
v1.2's now-verifiable negative evidence. `coverage_fraction` and `overpass_count`
remain null without measurements. Scientific approval and the decision registry
are unchanged.

The explicit source dates no longer block the August 2020 experimental preview.
That preview still labels the proposed quality selection as unapproved and raw
FRP totals as audit statistics.

## Receipt integrity

- Revised coverage document v1.2: `a8618eded4a8f7d182e97166f13c5d491cc9d01f4165a411c37d8d6f2f239649`.
- Companion answers: `4b1de05d3625ae21aa3d39d3a305977fdee1e1c61c50d5302bbf3d2995858044`.

The fixed −56.65° solar reference remains an owner-specified reference; this
review does not assert that it was independently calculated as the official
polygon centroid.
