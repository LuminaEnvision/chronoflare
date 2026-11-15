# Persistent inspection and shared exploration

This frontend-only follow-up resolves issues reproduced during testing of the
public post-#52 app. Scientific exports, registered metrics, thresholds, decision
and frozen model are unchanged. No calibration, acquisition or scoring is run.

## Paired chart inspection

Tapping/clicking a point selects its date in a persistent, in-flow inspector and
reveals that inspector. It shows the harmonized estimate, S-NPP observation,
uncalibrated benchmark, empirical 80% interval, extrapolation flag and sample role.
The selected point is marked in both charts. Pointer leave only clears temporary
hover information; it never clears the selected date.

A native date selector plus previous/next controls provide the same per-date
values to keyboard users without placing 1,240 SVG points into the Tab order.
Clear selection is explicit. Hiding the selected point's evidence group clears
its selection, so excluded data are not left visible as if they matched filters.
Requested dates without a visible paired point produce an explanation and no
inferred replacement value. The inspector only contains dates with both values
available; missing-reference estimates remain available in the main calendar.

## Counts and empty state

The chart states the current visible point count separately from the full
available-pair and publication counts. The 620 available pairs and 635 published
estimates are not described as all visible after filtering. With all groups off,
the app displays a no-groups-selected message and disables date inspection.
The original table is accurately labeled as full-dataset sample-role counts.
Filtering does not recalculate or alter the registered 506-day evaluation.

## URL and history

- `obs_compare_day=MM-DD` preserves the comparison inspector independently of the
  calendar's selected date. Validation uses a leap-year month/day anchor; February
  29 remains selectable for comparisons with an explicitly nonexistent date in
  a non-leap year.
- `pair_roles` stores the enabled evidence groups in canonical order. Absence
  means all groups; `none` explicitly preserves an empty selection.
- `pair_date=YYYY-MM-DD` preserves the selected paired point. Only canonical
  civil dates are accepted; no value or sample-role meaning is inferred from an
  arbitrary URL.

These parameters coexist with existing calendar/map parameters. They use the
same push/pop navigation as the app, so reload, copied links and Back/Forward
restore the exploration context. Both chart panels keep their full-data axis
domain while filters change; historical numerical reports remain untouched.

## Sparse-year navigation

The daily panel offers previous/next available-estimate buttons for the harmonized
series, or previous/next recorded-value buttons for native series. The controls
stay within the selected year and disable at the boundaries. Native recorded
values may contain only one turn; the partial-turn notice remains in force.

Navigation is always explicit. Changing years still preserves an ordinary
calendar selection rather than silently choosing a favorable day. For example,
2025-08-01 remains a missing estimate until the user requests the next available
estimate, 2025-10-05. Gaps are not filled and counts are unchanged.

## Review routes

- `/?view=methodology&pair_roles=independent_holdout&pair_date=2020-01-04`
- `/?view=methodology&pair_roles=none`
- `/?obs_source=harmonized&obs_year=2020&obs_compare=2024&obs_compare_day=08-02`
- `/?obs_source=harmonized&obs_year=2025&obs_date=2025-08-01`

Unit tests cover URL round-trips, explicit empty filters, invalid/leap dates and
sparse/native navigation without mutation or zero inference. Browser regression
checks use the committed real assets at desktop and 390px with touch emulation:
selection survives pointer leave/reload, keyboard inspection works, filtered
counts reconcile, comparison month/day survives history, and sparse navigation
retains correct values. Actual Safari/iPhone verification remains a team check
after deployment; Chromium emulation is not a substitute for that device test.
