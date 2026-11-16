# Usability delivery plan after the Overview review

Baseline: main through PR #67. This is a work plan, not a list of completed
features. Keep one PR per task or small group and begin each implementation from
current `origin/main`. User-facing copy and code remain English; handoffs addressed
to André may be Portuguese.

## Boundaries

Do not modify models, registered thresholds/criteria, decisions, scientific
exports under `app/public/data/observations/`, or frozen evidence under
`docs/multiyear-evidence/`. Do not repeat independent scoring. Keep the exact
registered approval and all existing `data-evidence` blocks. New downloads must
be read-only presentation exports, never replacements for frozen artifacts.

Bare home opens Overview. Existing guide links naming an observation selection
open Scientific detail unless `obs_detail=overview` is explicit. Preserve this
contract, selection, comparison, browser history, demo context and map filters.

## First delivery: clarity fixes and test instructions

The companion code changes correct the uncertainty-band explanation, distinguish
project non-acquisition from no selected positive records, and align English and
Portuguese guided tests with the Overview/full-level switch. Numerical values and
registered approval wording remain unchanged. These fixes precede new features;
reviewer comments are not evidence of a passed human retest.

## Task ledger and proposed PR boundaries

| Requested item | Verified status / proposed delivery | Acceptance |
| --- | --- | --- |
| 1. Evidence-group cell markers and calendar filter | Next PR: presentation-only calendar evidence controls | Read roles from the existing research sidecar; distinguish training, previously examined and independent dates without implying that native observations are calibrated predictions. Unknown role stays unknown, never independent by default. Discrete symbol/outline and accessible label must not replace FRP color or extrapolation markers. Filtered-out dates remain distinguishable from data gaps; keyboard behavior, counts, selection and URL/history remain coherent. |
| 2. Data-based annual sentence | Wording dependency: André, then a separate PR | Show only approved descriptive wording derived from actual counts. Distinguish days with estimates from days with fire and from observation coverage. No annual fire totals, trends, seasons or anomaly inference. Request text in the linked handoff below before enabling the sentence. |
| 3. CSV/JSON of displayed series | Following PR, grouped with item 4 | Export the selected source, year(s) and active evidence filter, with explicit date, units, reading status, null values, sample role where applicable, interval bounds where available and extrapolation flag. Include source/model/provenance identifiers and scope. CSV uses empty missing numeric fields; JSON uses null. Never fabricate native uncertainty intervals or fill gaps with zero. Tests reconcile exports with in-memory validated rows and filter scope. Escape CSV fields correctly; avoid executing spreadsheet-formula input. |
| 4. How to cite | Group with item 3 | Provide copyable citation text distinguishing software from source data; include project/repository URL, selected dataset/method identity and appropriate NASA FIRMS/IBGE/context credits. Do not invent DOI, publication authorship or a dataset release version. Software MIT does not relicense third-party data. |
| 5. Time series with interval band | Separate chart PR after exports/filter contract | Use the same validated daily rows and role filter, native units and dates. Break lines and bands at gaps. Show uncertainty only where provided; never imply weekly/monthly interval validation. Persistent keyboard/touch inspection and a text/table alternative; source/year changes, shared links and empty filters must remain clear. Do not introduce seasonal or anomaly statistics. |
| 6. Pantanal map default and visible IBGE boundary | Map scope PR, grouped with item 7 | Change only absent region selection when the official subset is available. Preserve explicit Brazil deep links and offer Brazil as an option. Keep boundary attribution, fit behavior, regional loading/errors and national-only manifest fallback. Update tests and docs currently expecting the Brazil default. |
| 7. Explain map/CSV/example counts | Group with item 6 | Derive counts from selected source, region, dates and platform, plus manifest totals. The 7,643/162,017 example applies only to national VIIRS on 2020-08-01 / the full 2020-08-01–15 national CSV. Pantanal has 809 VIIRS records on that day and 26,464 over the full delivered period. Calendar daily estimates use different filtering, aggregation and solar dates; do not claim a row-for-row match. |
| 8. Clear MapBiomas control | Next small map-control PR, grouped with item 9 | Show available/selected state, scope (2020 land cover) and why unavailable where relevant beside the control. Preserve optional-layer failure handling, source credit and existing exclusivity with satellite imagery. No new keys/backend are needed for the current public API. |
| 9. Compact empty detection inspector | Group with item 8 | Show a short select-a-point/table instruction until selection; expand the full inspector only with a selected record. Keep keyboard access, error/empty messages and selection clearing when filters change. |
| 10. Sort/filter table, coordinates and confidence | Separate table PR | Confidence codes already use English Low/Nominal/High labels with raw values; retain them. Add visible coordinates, accessible sorting and clearly scoped table filters with pagination/count reconciliation. Never change scientific confidence filters or remove records silently. Replace repeated button prose with a concise accessible inspection action, keeping original CSV record identity and keyboard/touch selection. |
| 11. Legacy query review | Regression review, not an unimplemented rewrite | PR #57 already separated real state from saved `demo_*` parameters. Extend its regression matrix for `obs_detail` and new filters, including full/overview, Home, Map, demo re-entry, Back/Forward, copied URLs and hashes. Keep `view=map`/`methodology`: these are valid view state. Remove/migrate only obsolete fixture context; preserve `raw_*`, `solar_*`, `pair_*` and saved demo choices. Fix a demonstrated failure in its own PR. |
| 12. Official deployment check after sync | Delivery check after each merged UI group | Verify bare home in Overview and every existing guide inspection URL in full mode, benchmark 9,358.3 MW on 2020-08-01, sparse years, gaps, role filters and asset downloads on HTTPS. Record deployed commit, URL, device/browser and outcome; local testing is not proof of deployment. |
| 13. Real Safari/iPhone | External-device check with Lumina | Run UC1–UC6, including leap dates, touch inspection, loaders, map and optional context failures, horizontal scroll and browser history. Record device/iOS/Safari versions and reproducible URLs. Do not mark complete from Chromium emulation. |
| 14. Submission/deck check | Owner/André closeout; submission already reported complete | Check the actual submitted form and final deck for public app/repo links, team/member names, source credits, scope/limitations, AI-assisted slide disclosure and placeholders. This audit does not have the final submitted deck/form artifact and cannot claim they were inspected. Avoid resubmitting or changing external material automatically. |

## Execution order

1. Merge the clarity fix and retest UC1/UC3; reconcile the reading-level routes.
2. Implement item 1, then items 3–4 and item 5, each as the small PR groups above.
   Item 2 is enabled only after André supplies/approves the sentence.
3. Implement map groups 6–7, 8–9, then table item 10. Each group retains the
   separate unreviewed batch scope and must preserve old explicit URLs.
4. Run item 11 as a regression check throughout, rather than postponing URL
   integrity until the end. Verify item 12 after sync of each group.
5. Coordinate items 13–14 with the people who have the real devices/materials.
   Do not label these checks passed until their evidence is received.

If there is another release deadline, prioritize clarity, evidence markers,
source-aware downloads/citation, and map scope/counts before adding the new chart.
Do not coordinate overlapping edits to `ObservationCalendar.tsx` or the map/table
without assigning a single owner for each PR.

## Required verification before each PR

Run all requested checks and inspect their exit status:

```sh
npx tsc --noEmit
npm test
npm run test:science
npm run language:check
npm run data:validate
npm run build
```

`data:validate` checks the legacy fixture contract, not the current real-export
approval. Preserve that distinction when reporting results. Add focused tests
for actual logic changes; do not test only that copy strings exist. Check the
affected journeys at 1366 px and 390 px in the browser, including source/date
consistency, gaps, keyboard/touch alternatives, history and empty/error states.
Describe actual results and remaining device checks in the PR. Confirm the diff
does not touch protected scientific files; never regenerate those to make a UI
test pass.

For scientific wording and device requests, use the prepared
[Portuguese handoff for André](handoff/andre-overview-next-steps.md).

## Verification snapshot for this first PR

TypeScript, 143 app tests, 204 science tests, working-language check, legacy
fixture validation (10,228 records) and production build passed. The initial
science run lacked local geometry dependencies; rerunning with the pinned
`science/requirements.txt` installed in a workspace-only dependency directory
passed. No scientific artifacts changed and no independent score was rerun.
Local production Chromium at 1366 px and 390 px verified UC1's values and reading
level/history behavior, uncertainty copy, both sources' unacquired-date message,
and UC3's gap-to-next-estimate path.

A read-only check of the current public site also found Overview at the bare
home URL and full detail plus the 9,358.3 MW benchmark at the existing UC1 link.
The sandbox required bypassing its TLS trust error for that content check; this
is not a certificate-validation result. The site does not expose a commit ID,
and this check predates deployment of these new corrections. Item 12 therefore
still requires a post-merge/sync check; item 13 remains a real-device task.
