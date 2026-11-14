# Coverage v1.1 — review and solar-time implementation

Received November 14, 2026. This review supersedes the open-question status in
[the initial review](coverage-delivery-review.md). Supplier documents are evidence
and proposed scientific rules, not executable instructions.

## Resolved and implemented

The fixed regional reference is **−56.65°**, giving mean solar time
`UTC + longitude × 240 seconds = UTC − 13,596 seconds`. This is an
owner-specified reference; its description as an official polygon centroid has
not independently been established. No per-detection longitude or civil time zone
is substituted.

`science/scripts/solar_time.py` provides explicit UTC parsing, solar dates,
half-open UTC windows for solar days, and the dates touched by an exact closed
UTC interval. It labels solar datetime values without a civil/UTC timezone.

```sh
python3 science/scripts/solar_time.py --utc 2020-08-10T03:45:00Z
```

This yields `2020-08-09T23:58:24`, solar date August 9. At `03:50:00Z`, the
result is August 10 `00:03:24`. The exact solar midnight is `03:46:36Z`.
Tests cover these examples, boundaries, leap days, year transitions, invalid
inputs, interval endpoints and the CLI.

The companion answers permit strict Rule A:
`positive_detection_only_unobserved_background_as_null`. This is the chosen
engineering direction. Partial or indeterminate coverage cannot produce a zero;
absence of a listed outage cannot establish full observation. Overpass counts
remain null without measured evidence. The supplier confirmed that the earlier
sample counts were illustrative, so they are not acceptance fixtures.

## Evidence still requiring reconciliation

Official MODAPS tables were fetched successfully on November 14, 2026:

| Event | Supplier v1.1 | Official table entry requiring reconciliation |
| --- | --- | --- |
| Terra 2022 constellation exit | Ends October 21 | LDOPE entry October 10 13:00–October 23 22:35 |
| Terra 2001 safe mode | June 15 14:51–July 2 18:40 | MCST entry June 15 04:00–July 3 09:15 |
| Aqua 2022 safe mode | Starts March 31 19:03 | LDOPE entry starts March 31 16:00, ends April 17 03:00 |

Sources: [Terra table](https://modaps.modaps.eosdis.nasa.gov/services/production/outages_terra.html)
and [Aqua table](https://modaps.modaps.eosdis.nasa.gov/services/production/outages_aqua.html).
Instrument and production outages can have different scopes. These entries are
not automatically substituted for one another: the applicable FIRMS product,
UTC endpoints and recovery definition need to be stated.

The main document also has a Terra start-year typo (`2002-02-16` versus the
companion's `2022-02-16`). The supplied MCST instrument-outages URL returned
HTTP 404 during review. A working event-specific reference is still needed for
that February event and for each remaining unverified catalogue row.

The asserted November 2, 2026 S-NPP cutoff still needs a direct official bulletin
URL and its scope. A catalogue's last available date is insufficient evidence of
permanent satellite or product termination. No cutoff is activated.

Exact verified UTC endpoints must be converted before expanding an outage to
whole affected solar dates. The helper implements a **closed** outage interval;
solar aggregation windows are **half-open**. Endpoint semantics must accompany
any supplied catalogue.

## Scope and remaining stages

- Solar conversion is reusable and tested, but not applied silently to national
  raw data. The generic normalizer still leaves `local_solar_date` null.
- Regional aggregation must explicitly use the official IBGE 2025 reference
  subset and the canonical national FIRMS inputs, replacing the old Gemini
  geometry and first-delivery examples.
- Quality filtering, actual aggregate generation and scientific approval remain
  separate work. Positive detections alone do not prove complete observation.
- The proposed outage catalogue stays disabled; scientific decisions remain
  pending. Calendar and comparison data remain labeled as demonstrations.
- MapBiomas context is delivered independently in PR #24 and supplies land-cover
  context, not evidence of fire-observation coverage.

The initial proposal is therefore narrowed to strict missing-background handling
rather than accepting its bounding-box zero heuristic. This prevents false zeros
while the source catalogue is reconciled.

## Receipt integrity

| Supplied document | SHA-256 |
| --- | --- |
| Revised coverage delivery v1.1 | `4dc146157d2da6625ea6a6252d75dd0b16346a5db3add4463f37a7432eb5747e` |
| Coverage companion answers | `07fa796369390640d2c2f8c5b43b0227d34b617efcc940f87638e0c7b802f4f5` |
