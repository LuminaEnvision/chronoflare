# Current interface usability pass

## Review scope

The supplied UI review describes a mix of pre-PR-50 screens and current behavior.
PR #50 already made real observations the default, separated native platforms,
introduced one-year month/day grids, logarithmic colors, sample-role inspection,
real comparisons and the harmonization evidence panel. Those features were kept;
the legacy synthetic screen remains a labeled demonstration mode.

This pass addresses the remaining small interaction and presentation issues:

- Compact real-calendar heading, controls and approval summary. Recent sampling
  (six published 2025 estimates, five in 2026), training-period limitations and
  absence of independent backward validation remain visible. The full approval,
  alignment explanation and distinction between publication/test cohorts are
  available in an adjacent expandable section.
- Replace the generic science-in-progress badge with the current view's role;
  Plan A status still comes from the verified export's approval, not a global
  claim attached to synthetic/unreviewed modes.
- Use actual system fonts instead of declaring font families that were never
  loaded. This avoids a new network/font dependency close to submission.
- Increase calendar targets to at least 24 × 24 CSS pixels. The month/day layout
  stays aligned across years; horizontal scrolling handles narrow screens.
  Roving focus uses Left/Right for adjacent dates, Up/Down for adjacent months
  with valid-day clamping, Home/End within the month, and Enter/Space to select.
- Add numeric anchors to the existing fixed logarithmic color scale and label
  calibrated estimates correctly. Hide the partial-turn legend when none exist.
- Use tabular numbers and improve shared small-text sizing. Internal day/map
  actions use a directional arrow rather than an external-link arrow.
- Explain raw source confidence codes without changing values or filtering;
  use explicit "View on map" table actions, a sticky acquisition column and an
  explanation adjacent to disabled MapBiomas context.
- Add explicit text results to the registered-criteria table.

## Loader changes

The decorative globe is preserved. An omitted `progress` means genuinely
indeterminate loading: no timer-generated percentage, invented processing step
or progress value is exposed. Explicit finite progress remains supported for
callers with measured progress. Accessible status text does not change per percent.

The loader appears only after 250 ms and disappears as soon as content is ready;
it no longer holds ready content for a 900 ms exit. Panel loading participates
in document flow rather than unintentionally covering unrelated page content.
Reduced-motion preference stops decorative animation and the indeterminate bar.

## Deliberate limits

A weekly-grid redesign, custom touch tooltip, new interval/reference analytical
chart and a full map-table card redesign are larger changes. They are not needed
to repair the current default calendar and are not silently included in this
focused pass. The explicit date inspector remains the touch/keyboard alternative
to hover. The current date/series defaults and registered scientific evidence are
unchanged; no model, export, approval or threshold was edited.

The remaining technical closeout after this PR is deployed-phone/Safari QA,
source/AI/media inventory completion, and small fixes identified by that review.
That is lighter than a full new chart or calendar redesign. The scientific
integration itself was completed in PR #50.

## Verification

Existing app tests plus focused date-focus and confidence-boundary tests run
without live credentials. Browser checks use actual committed data, keyboard
focus/selection, desktop and 390px mobile layout, map record controls, and a held
manifest response to inspect indeterminate loading and reduced motion. Scientific
artifacts remain byte-identical to main. Real-device Safari remains a team check.
