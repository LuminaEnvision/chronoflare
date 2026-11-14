# Frontend follow-up: isolated chart values and coverage legend

Ready-to-forward task for Anastasia / Lumina:

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
