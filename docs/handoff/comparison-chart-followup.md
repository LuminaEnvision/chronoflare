# Frontend follow-up: isolated chart values and coverage legend

> **Historical task handoff.** This is the original allocation, not a current incomplete-work list. Use the [current behavior](../real-observation-experience.md) and [acceptance journeys](../user-journey-acceptance-tests.md) for the delivered app.

**Update:** this task is already implemented in open [PR #20](https://github.com/j-c-fstk-dev/chronoflare/pull/20), pending review/merge. Do not assign it again. The original task is retained below for traceability.

Next ready-to-forward task, **after #20 and the map PR are merged**:

> Hi Anastasia! Once PRs #20 and #21 are merged, please pull the latest main and take a small integrated product/visual QA pass on Calendar → Comparison chart → Map → Calendar.
>
> Check desktop and mobile, keyboard focus, Back/Forward, preserved filters, and whether the distinction between synthetic calendar/chart data and the unreviewed Brazil detection batch is clear. Please check point/table inspection and loading/error messages; the map should not show a Pantanal boundary.
>
> Please record browser/device, deployed commit, reproduction steps and screenshots. Open a small English fix PR for any frontend issues you find. Keep scientific rules, raw/generated datasets and backend processing unchanged. A physical-phone check is especially useful if available.

Original task for Anastasia / Lumina:

> Hi Anastasia! PR #18 is merged—thank you. Please pull the latest `main` before starting.
>
> Could you take a small chart-only follow-up? Make isolated nonzero observations visible and clarify the partial-coverage legend.
>
> A one-day segment currently produces only an SVG move command, so a valid nonzero observation can disappear between gaps. Render a visible marker for those singleton segments, using a distinct shape for each year. Keep gaps unconnected and preserve actual zero values.
>
> Add a compact legend explaining the partial-coverage line pattern, so users can distinguish it from the second year's dashed line. Keep the existing keyboard day inspector working.
>
> Please add a meaningful singleton regression test, check desktop/mobile and keyboard use, and include screenshots in a small English PR. Keep changes scoped to the comparison-chart component/helpers/tests and namespaced chart styles. We are finishing the raw-data map and reviewing the coverage proposal on our side; no map or scientific-rule changes are needed for this task.

Acceptance criteria:

- A nonzero valid day surrounded by missing records remains visible, including
  when a coverage change splits the series into a one-day segment.
- Both years retain distinct line/marker identities beyond color.
- Missing values are not joined or changed to zero.
- Partial-coverage meaning has a visible legend entry.
- Keyboard inspection, source selection, leap-day alignment and URL history remain
  compatible with #18.
- UI, commits and PR description stay in English. Fixtures remain fixtures and
  harmonized comparisons stay gated.
