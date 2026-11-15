# ChronoFlare

> **Historical task handoff.** This is the original allocation, not a current incomplete-work list. Use the [current behavior](../real-observation-experience.md) and [acceptance journeys](../user-journey-acceptance-tests.md) for the delivered app.

## Product & frontend development handoff

For Anastasia • November 14, 2026 • Version 1.0

This guide assigns small product and frontend tasks that can proceed while André prepares the scientific data. Your focus is deployment verification, usability, and presentation. The Tech Lead and Codex will handle application state, data contracts, scientific integration, and the offline pipeline.

## Start here

Finish the deployment from main, record the published commit, and review the deployed experience. The English-language update is already merged into main (PR #4). Then take one small UI task at a time. A deployment can happen in parallel with development; production updates need coordination.

## Task overview

| Task                                       | Scope                                                                                      | Done when                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 1. Review mobile and keyboard usability    | Test Calendar, Map, and Methodology on desktop and mobile.                                 | A short, reproducible issue list is delivered, with screenshots where helpful.                 |
| 2. Extract and improve the activity legend | Build ActivityLegend.tsx and its own CSS module. Preserve all six existing entries.        | Labels and patterns remain understandable without color; the legend wraps on mobile.           |
| 3. Build reusable feedback states          | Build StatusNotice.tsx for loading, missing data, errors, and pending science.             | Clear English copy, accessible markup, and retry only where an action exists.                  |
| 4. Improve the small-screen header         | Build AppHeader.tsx with responsive navigation and a visible active view.                  | It works at 360 px without page-level horizontal overflow; keyboard focus is visible.          |
| 5. Improve Methodology readability         | Organize the existing English content into clear sections or accessible disclosure panels. | Sources, limitations, and validation status are easy to find; scientific meaning is preserved. |

> Suggested order: deployment verification → task 1 → task 2 → task 3 → task 4 → task 5. UI tasks can be reprioritized after the usability review. No task requires real scientific data.

Working language: English for interface text, accessibility labels, code comments, test names, documentation, commit messages, and PRs. Documents specifically addressed to André are the agreed Portuguese exception.

---

## Deployment: close the loop before UI changes

Use the current main branch as the deployment source. Record the actual commit shown by the hosting platform; do not assume a deployment contains the latest merge just because its URL is unchanged.

- Share the deployment URL, commit SHA, environment (preview or production), and any build or runtime issue. Put the short record in docs/qa/deployment-check.md or the relevant PR.

- Verify the English interface is live: navigation, buttons, error/loading messages, and methodology content. A stale deployment is different from a missing translation.

- Walk through Calendar → select a day → open Map → return to Calendar → open Methodology. Confirm the selected date and basis are preserved where expected.

- Check whether NASA GIBS imagery loads. If it fails, record the date, error/retry behavior, and connectivity conditions. The calendar must remain usable. A missing or blank image is not proof of zero fire activity.

- If automatic production deployment is enabled, coordinate merges to main while someone is testing, recording the demo, or presenting. Use branch previews when available.

> The Vercel frontend does not need a FIRMS MAP_KEY. The authenticated FIRMS client runs offline. Never add that key to browser code, public assets, or VITE_ environment variables.

## Task 1 — review mobile and keyboard usability

Deliver a focused audit before making broad design changes. This gives the team a shared list of observed problems and avoids two people changing the same layout simultaneously.

- Test a desktop layout and a mobile layout around 360 px wide. Use a real mobile device when available; record whether the result came from a device or an emulated viewport.

- Inspect navigation, long text, selects, date input, legend, detail/comparison cards, map controls, and Methodology. The calendar may scroll horizontally inside its own container; the whole page should not overflow.

- Use Tab, Shift+Tab, Enter, and Space where applicable. Check visible focus and clear labels. Use the alternative date selector for keyboard calendar selection; traversing thousands of heatmap cells is not required.

- Check that the synthetic-data warning is visible and that missing values cannot be mistaken for zeros or approved scientific results.

Deliverable: docs/qa/usability-review.md, with one entry per issue: view, viewport/device/browser, steps, expected result, actual result, screenshot if useful, and impact. Separate functional blockers from visual polish. If something passes, record the check rather than inventing an issue.

Completion: another developer can reproduce each reported issue. The review records its tested deployment commit. Start with observation; assign fixes to small follow-up PRs.

---

## Task 2 — extract and improve the activity legend

Create app/src/components/ActivityLegend.tsx and ActivityLegend.module.css. Preserve the six current entries: Observed, Estimated, No data, Zero / adequate coverage, Unusual, and Partial coverage. Retain the simulated-data qualification when fixtures are active.

- Keep existing scientific meaning and caveats: no data is not zero; intensity is not confidence; estimates are unavailable until approval; pre-2012 estimates are extrapolations without direct VIIRS validation.

- Use text plus patterns/outlines so the meaning does not depend on color alone. Make spacing and wrapping readable on narrow screens.

- Keep the component presentational. The application supplies the fixture/scientific state; do not infer validation, coverage, or unusual periods inside the legend.

Completion: the existing view can use the component without changing data behavior. Include desktop/mobile screenshots and explain how the fixture notice is retained. Coordinate the small main.tsx integration with the Tech Lead.

## Task 3 — build reusable feedback states

Create app/src/components/StatusNotice.tsx and StatusNotice.module.css. Support loading, missing data, error, and pending-science presentations. Agree on the props with the Tech Lead before wiring them to application state.

- Use short English headings and explanations. Show a retry action only if the caller supplies a meaningful retry callback; pending scientific approval is not a network error.

- Provide appropriate accessible status/error announcements. Do not make every informational notice an urgent alert or move keyboard focus unexpectedly.

- Preserve the existing synthetic-data warning and the distinction between missing records and a measured zero. Display state must not change scientific status.

Completion: each variant is demonstrated in the PR, visually readable on mobile, and usable with a keyboard. Use existing dependencies; do not add a component framework solely for this task.

## Task 4 — improve the small-screen header

Create app/src/components/AppHeader.tsx and AppHeader.module.css. The application remains responsible for the active view and navigation callbacks. Preserve Calendar, Map, and Methodology and their existing filter/URL behavior.

- At 360 px, prevent page-level overflow and keep touch targets and labels usable. Show active navigation through more than color, and retain visible keyboard focus.

- Keep all three views reachable. If introducing a collapsed menu, support keyboard operation, meaningful labels, and the correct expanded/collapsed state.

Completion: provide desktop/mobile screenshots and confirm navigation still preserves the selected date and basis. Avoid global typography or theme changes in this PR.

---

## Task 5 — make Methodology easier to read

Organize the existing Methodology content into clear sections or accessible disclosure panels. A proposed new file is app/src/components/MethodologyContent.tsx with its own CSS module; agree on its inputs with the Tech Lead before implementation.

- Make data sources, sensor differences, coverage limitations, validation status, and dataset/method versions easy to find. Keep source links reachable.

- Preserve the scientific text and live status values. Do not introduce new formulas, approval claims, percentages, metrics, or benchmark numbers.

- Do not hide essential warnings: this is not a fire forecast or confirmation service, the current activity dataset is synthetic, and harmonization remains blocked until scientific approval.

Completion: content is readable on mobile and accessible by keyboard. The PR identifies any copy changes for review. The page remains useful when scientific results are not yet available.

## Ownership and integration boundaries

| Owner                                                                                                                                                                                                                                                                                                                                                                                   | Primary responsibility                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Anastasia                                                                                                                                                                                                                                                                                                                                                                               | Deployment verification, usability findings, presentational components, and their scoped CSS modules.                        |
| Tech Lead + Codex                                                                                                                                                                                                                                                                                                                                                                       | Application state/URL logic, app/src/data/, science/, scripts/, contracts, experiment code, and scientific-data integration. |
| André                                                                                                                                                                                                                                                                                                                                                                                   | Data inputs, AOI, scientific rules and thresholds, methodology approval, and final interpretation.                           |
| main.tsx and style.css are shared integration points. Coordinate edits before touching them. The Tech Lead will separate the current monolithic view as needed; component extraction and that refactor must not run independently on the same section. Prefer scoped CSS modules over broad global overrides. Proposed component interfaces are coordination points, not existing APIs. |

## One task, one small PR

- Start each task from an updated main branch. Use a separate branch, for example ui/activity-legend, and keep commits and PRs in English. Avoid unrelated dependency or lockfile changes.

- Describe the problem, resulting behavior, checks performed, and known limits. Include screenshots for visual changes, noting whether they show a local build or a deployed preview.

```sh
npm run language:check
npm test
npm run build
```

Run relevant additional checks if touching data or the pipeline; those areas should normally stay with the Tech Lead. Ask for review before merging, coordinate production updates, and report any dependency or unclear requirement early. Existing test/CI success does not replace visual and keyboard verification.

> Keep the scope small: improve how the product communicates and behaves, while preserving the data contract, synthetic-data labels, uncertainty wording, and scientific approval gate.
