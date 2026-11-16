# Real observations, approved harmonization and research evidence

## Current behavior

The primary calendar now consumes the exact hashed exports introduced in PR #49,
not the synthetic `data/v1` fixture package. With the recorded scientific-owner
approval present, it defaults to the calibrated v2 series in 2020. Native Terra,
Aqua and Suomi-NPP remain separately selectable. The approved scope publishes
only days with both complete aligned MODIS platforms; no single-platform estimate
is promoted into that calendar.

The exported files contain 4,318 acquired solar dates in 2012–2015 and 2017–2026,
and 635 calibrated estimates. No 2016 data were acquired. An acquired date can
still lack valid selected positive detections. These states are distinct:

- Not acquired: no date row exists.
- No selected positive records: date exists, native turns are null.
- One native turn: a partial observed sum, never a complete-day claim.
- Both native turns: positive recorded day/night values, observation coverage unknown.
- No publishable estimate: aligned complete-platform inputs are unavailable.
- Calibrated estimate: approved frozen model, empirical interval and extrapolation flag.

Native solar dates are unchanged. Harmonized Terra night explicitly references
the previous native date. The runtime consumer checks native-input agreement,
ordered dates, physical values, scope and model identity. Each loaded year must
match its manifest byte count and SHA-256 before rendering. Corrupt or unavailable
assets produce an error; they never fall back to fabricated values.

## Comparison and navigation

`obs_source`, `obs_year`, `obs_date`, `obs_compare` and `obs_compare_day` preserve
real-data selection independently of saved demo/map parameters. Evidence groups
and inspected pairs use `pair_roles` / `pair_date`. Back/Forward, reload and copied
links restore these choices. See [current navigation](selection-navigation.md).
Two years use a shared 366-slot month/day axis, preserving February 29 without
shifting March. Lines break at gaps, and isolated valid dates remain visible as
points. Native comparisons use both recorded turns; partial native sums remain
inspectable in the calendar. No missing value is converted to zero, no annual
percentage change is inferred, and different native sensors are not joined.

The calendar uses one fixed logarithmic color scale (0–100,000+ MW); the comparison
chart uses a shared linear MW axis and horizontal scrolling on narrow screens.
Accessible date controls provide inspection independent of color/hover. The evidence
chart offers a persistent paired-date inspector, matching tap/click selection with
keyboard controls and visible filtered counts. Explicit calendar/comparison choices
reveal their result; year switches explain a nearest-valued-date choice, while valid
deep-linked gaps stay unchanged. Available-value navigation does not fill gaps. The map
remains the separate August 2020 review batch, not the exact source of every cell.

## Evidence and limitations shown in the app

The Methodology view separates the rejected v1, descriptive diagnostics/post-hoc
v2 evaluation, registered independent test and scientific-owner Plan A approval.
It shows the combined test's 506 paired days, 40 weeks, bias −1.0%, Spearman 0.965,
MAE 1,675.5 MW versus matched benchmark 2,589.0 MW, daily interval coverage 72.7%
and median relative width 1.74. It also retains the benchmark's slightly better
ranking and the absence of independent backward validation.

Publication applies a stricter complete-platform availability rule but spans additional
periods; its 635 dates are not the same population as the 506-day evaluation. They include 232 training-period dates, 161 previously examined dates and 242 independent-
holdout dates. Agreement in the training period is not validation evidence. Only
six estimates are published in 2025 and five in 2026; the independent evaluation
has 28 and 13 paired dates in those years. These are different counts and cohorts.
Per-date sample roles are shown when inspecting an estimate. There are 55 published
extrapolated dates. No anomaly/season classification is enabled by calibration approval.

`scripts/export-research-evidence.ts` creates the small public research sidecar
from committed evidence and verifies model identity. It does not fit models,
repeat the single-use score or modify scientific artifacts. This is a display
transformation, not a replacement scientific report.

## Integration and remaining work

The implementation follows the agreed consumer/export split. The legacy package,
August 2020 preview and map remain explicitly separate. Dataset validation for
`data/v1` still reports synthetic status by design; real exports are validated
by the dedicated runtime schema and shipped-data reconciliation test.

The original broad proposal anticipated a continuous historical calendar and
seasonal/anomaly results. Actual publication is restricted by the available
positive observations and the owner's complete-platform approval. That reduces
recent coverage rather than filling gaps or relaxing the scientific scope.

Operational closeout: keep any deployment fork synced after new merges, verify
the published application on the team's real phones, and confirm the final
submission media/AI inventory. A prior successful deployment is not a claim that
every later commit has been deployed or every device has passed. Seasonal
baseline, anomaly classifications, H3 aggregation and further geography/time
coverage remain future work, not claims of this release. No additional API keys
are required to serve these static artifacts. Scientific files, decision record,
model, thresholds and registered score are unchanged by this integration.

## Verification

Application tests cover real asset hashes/counts, rejected scope/model changes,
complete aligned inputs, null/partial semantics, safe asset paths and leap dates.
Browser checks on the committed real export cover desktop and 390px mobile,
comparison, Back/Forward, view transitions, synthetic-mode isolation and rejection
of a same-length corrupted year asset. Local screenshots are review artifacts;
the deployment itself must be checked after publishing.

## Loading feedback

The shared loader shows its globe and loading status immediately; reduced motion
uses a static globe. Calendar entry and dataset-mode changes have a 500 ms
presentation window, including cached synthetic data, to prevent a flashing
transition. This window does not represent measured download progress.
Subsequent data loading keeps the loader present for as long as needed.

Synthetic JSON decoding and full schema validation run in a dedicated Web Worker,
which is terminated on completion, failure or view cancellation. Cached validated
fixtures are reused within the current session. Locale formatters are shared,
rather than recreated for thousands of grid labels. These changes keep expensive
fixture preparation away from the globe animation and reduce grid-render work.
Existing data validation is unchanged; failures retain the retry/error state.

Local browser checks cover first load, warm F5, cached mode changes, reduced
motion and failures. Firefox and real-device confirmation of the original report
remain separate from Chromium automation.
