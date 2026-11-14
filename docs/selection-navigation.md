# Validated selection and browser navigation

Selection logic lives in `app/src/data/selection.ts`; React integration lives in `app/src/hooks/useSelection.ts`. The application passes the validated dataset to this hook and supplies its values/callbacks to presentational components.

## URL contract

Supported routing parameters:

| Key       | Values                                                        | Behavior                                                                              |
| --------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `view`    | `calendar`, `map`, `methodology`                              | Unknown values fall back to Calendar.                                                 |
| `basis`   | `viirs`, `modis`, `harmonized`                                | Must have matching metric records. Harmonized also requires validated approval.       |
| `date`    | Actual ISO date, `YYYY-MM-DD`                                 | Validated against real dates and the selected basis's record range.                   |
| `region`  | The currently loaded calendar region                          | Other IDs fall back to the loaded region; this does not dynamically load another AOI. |
| `compare` | An available four-digit year different from the selected year | Invalid or unavailable comparisons are cleared. Omitted when inactive.                |

Example: `?view=calendar&basis=viirs&date=2024-02-29&region=pantanal-pilot&compare=2023`.

Routing keys are canonicalized to single values; when duplicates exist, the first is validated and retained. Unrelated query parameters, repeated unrelated values, the pathname, and URL fragment are preserved.

## Defaults and corrections

- The default view is Calendar.
- Prefer the harmonized basis only when approved and backed by matching records. Otherwise prefer VIIRS, then MODIS, based on actual available metrics.
- With no date, select the latest record date for the selected basis; there is no hardcoded historical date or dependence on the workstation's current date.
- A malformed date in a link falls back to that latest date. A valid date outside the basis range is clamped to its nearest range boundary, with an explanatory notice.
- A valid date inside the range stays selected even if no record exists for it. No nearest-observation substitution, interpolation, or zero-filling takes place.
- Invalid interactive date input, including clearing the date field, preserves the current valid date and explains the correction without adding a history entry.
- Basis changes clear the comparison. Selecting a date in the comparison year also clears that now-invalid comparison.
- A February 29 comparison against a non-leap year remains a missing record, not a March 1 substitution.
- Original bases without records are disabled and labeled accordingly. An approved dataset without harmonized records still cannot enable that option.

This module does not evaluate scientific quality, infer coverage, or calculate aggregate/anomaly values. It consumes approval state from the existing validated-data loader. Date ranges describe available record boundaries, not proof of adequate observation coverage.

## Loading and history

Preserve a pending deep link until the dataset is loaded. For example, do not rewrite a requested harmonized link to VIIRS before discovering whether approved records are available.

Initial/default corrections replace the current history entry. Deliberate changes to view, basis, date, or comparison push a new entry only when the URL changes. Back/forward restores the selection via `popstate`, without adding new entries. Correction notices survive subscription cleanup/re-attachment, including React Strict Mode behavior.

The hook resolves the loaded-data selection before paint, preventing a pending unapproved selection from appearing enabled during dataset hydration. Browser listeners are attached on subscription and removed when no subscribers remain.

## Integration guidance for product/frontend work

Use the hook values (`selection`, `availableBases`, `dateRange`, `issues`) and callbacks (`setPage`, `setBasis`, `setDate`, `setCompare`) through the application. Avoid adding separate view/date state or calling `history.pushState` in presentational components; that would create two competing navigation owners.

`selection` contains `view`, `basis`, `date`, `region`, and `compare`. `dateRange` is null if no matching record range exists. `issues` contains user-facing English explanations of corrected parameters; present them as informational status notices, not scientific validation results.

The small `main.tsx` integration owns these bindings. Header/legend/feedback component work should preserve them. No CSS, map imagery logic, data schemas, or scientific fixtures are changed by this navigation feature.

## Verification and preview checklist

Automated tests use a browser-independent history adapter and sparse validated fixtures. They cover defaults with unsorted data, malformed dates, unavailable bases/regions, approval gating, leap days, gaps, duplicate routing keys, comparison restoration, initial hydration, history entry counts, and subscription cleanup.

For browser QA after deployment:

1. Open a link with an invalid date/view/region or unavailable harmonized basis; verify a corrected selection and an English explanation.
2. Open the February 29 comparison example; verify that the comparison year has no fabricated date/value.
3. Change the date, basis, view, and comparison; use Back and Forward and verify restoration.
4. Copy the resulting URL into another tab and check that the same selection appears.
5. Add `utm_source=team#details` and confirm that navigation retains the unrelated query and fragment.
6. Clear the date field; confirm the previous valid selection remains and no extra history entry is created.
7. Verify disabled bases explain missing records/approval, while missing-data cells still remain missing.

The adapter tests do not replace browser/device QA. No browser visual verification was performed in this session because the browser-control tool is unavailable.
