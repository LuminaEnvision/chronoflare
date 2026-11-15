# Usability review follow-up: Home and coverage labels

> **Historical/stage-specific record.** This page preserves the facts, test counts and remaining work of its original delivery. It is not the current project approval or feature checklist. See [current validation and scope](validation-report.md) and the [documentation index](README.md). Any associated dated PDF/Word remains that historical snapshot.

Anastasia's November 14 review tested main at `77d3533`, before the offline-normalization and selection-navigation merges. The calendar interaction/layout, native date-field presentation, Home link, and internal coverage-token findings remained applicable after those merges. This follow-up addresses only the Home link and the displayed coverage method.

## Home navigation

The brand link now has a context-preserving `homeHref` supplied by `useSelection`. It changes only the view to Calendar and retains the selected basis, date, loaded region, comparison year, unrelated query parameters, pathname, and fragment.

Ordinary same-tab activation prevents the native reload and uses the existing `setPage("calendar")` callback. Browser Back returns to the prior view and selection. Ctrl/Command/Shift/Alt activation, other mouse buttons, and explicit new-tab/named targets retain native link behavior. The real href also preserves context when copied or opened separately.

Frontend integration: when extracting the header, pass both the hook's `homeHref` and its existing navigation callback. Do not replace the href with `?view=calendar` or recreate the selected date/basis locally. `activateSelectionLink` handles ordinary navigation without intercepting native link shortcuts.

## Coverage presentation

The Methodology metadata uses `formatCoverageMethod`:

- `pending_scientific_review` displays **Awaiting scientific review**.
- `unknown` / `undetermined` display **Coverage not established**.
- An empty value displays **Not specified**.
- Unrecognized methods display **See dataset manifest**, using the existing manifest link for the technical details.

The original identifier remains unchanged in the dataset manifest. These labels do not infer adequate coverage, approve a method, change scientific status, or humanize an unfamiliar token into a scientific claim.

## Ownership and remaining work

Anastasia owns the calendar usability work: keeping selected days in view, persistent year labels, usable day targets, keyboard navigation, and complete accessibility announcements. The native date control's regional presentation still needs a separate UX decision; setting the page language alone does not ensure a native date input matches English headings across browsers/operating systems.

No calendar rendering, keyboard model, CSS, data artifacts, or scientific-processing rules are changed here.

## Verification

Automated checks cover context-preserving hrefs, ordinary versus modified link activation, full Home/history restoration with a validated dataset, pending coverage labels, and safe fallback for unknown method identifiers. Browser visual QA remains pending because the browser-control tool is unavailable in this session.

On the next deployed preview:

1. Select Original MODIS, February 29, 2024, and comparison year 2023; open Map or Methodology.
2. Activate Home. Confirm Calendar opens without resetting the basis, date, comparison, or region.
3. Use Back and confirm the previous view/selection returns.
4. Open Home in a new tab or copy its link; confirm the same context survives the fresh load.
5. Check Methodology's Coverage row for the readable pending-review label. The synthetic-data banner, validation gate, and manifest contents must remain unchanged.
