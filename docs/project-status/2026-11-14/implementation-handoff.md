# ChronoFlare — implementation review and resumption handoff

> Historical snapshot: implementation resumed after this checkpoint. Read the
> [current map delivery update](map-delivery-update.md) for the national map,
> coverage delivery 2 review and present responsibilities. The archived Word/PDF
> copies preserve the original pause state.

**Snapshot:** November 14, 2026. **Repository:** https://github.com/j-c-fstk-dev/chronoflare

**User instruction at pause:** stop implementation changes and document the work, decisions, differences from the initial plan and remaining responsibilities. The user may continue in a new chat. Do not treat this handoff as permission to publish unfinished map work.

## 1. Read this first

1. PRs #12–#18 are merged into `main`. PR #18, by Anastasia/Lumina, adds the two-year comparison chart on a shared month/day axis. This handoff records that merge; the chart was not independently reviewed in this final documentation step.
2. The new raw-detection map is **local, uncommitted work**, not a merged feature. It was built against the main state before #18. Its main/style edits must be reconciled with #18 without removing the comparison chart.
3. **Critical new information:** André said the supposed Pantanal polygon was created using **Gemini Argon** because he could not find the specific IBGE shapefile. There is no traceable authoritative geometry source. Descriptive properties claiming IBGE provenance in that file are not proof.
4. The local map currently uses that polygon to subset detections and draw a provisional outline. **Do not deploy or merge that version as a Pantanal explorer.** Its regional counts are diagnostic only and are not verified Pantanal totals.
5. The proposed response was to remove this polygon and show the national Brazil download without regional clipping. **That change was NOT implemented:** the user asked to pause and document first. On resumption, revisit the decision and obtain a traceable boundary or clearly redesign the explorer around the national download.
6. Calendar and annual-comparison values remain synthetic fixtures. Real CSV detections have not replaced the scientific calendar artifacts. Scientific approval, sensor coverage and harmonization remain pending.

## 2. Product objective and original plan

The reference is `docs/blueprint-v1.2.md`. ChronoFlare's main differentiator is a historical activity calendar, supported by a map and methodology explanations. It should help users understand seasonality and compare periods while seeing sensor provenance, gaps and uncertainty.

The planned architecture is static: Python processing offline, precomputed artifacts, React/TypeScript frontend, one deployment. A production API, database or persistent backend was not required by the blueprint and has not been introduced.

The Pantanal was a proposed pilot, conditional on a confirmed AOI and usable data. Plan A permits MODIS-to-VIIRS harmonization only after empirical validation. If it is rejected, plan B retains separate original sensor series. Missing information must not become zeros; detections must not become claims about individual fires, burned area or forecasts.

## 3. What exists, why, and what remains

| Stage | What was implemented | Why / decision | Status and remaining work |
|---|---|---|---|
| Product and dataset contract | React/TypeScript/Vite app; Zod-validated manifest/calendar/validation structures; deterministic daily fixtures for 2012–2025 | Build and test the product before scientific delivery; preserve nulls, source basis and approval gates | Merged. 10,228 fixture records; real reviewed calendar artifacts still needed |
| Language and collaboration | English UI, CLI output, project docs, commits and PRs; handoff documents for André can remain Portuguese | Team accessibility and deployment collaboration | Merged policy in `AGENTS.md`; keep applying it |
| Calendar and navigation | Daily calendar, source/date selection, detail panel, same-day comparison, validated query links and Back/Forward; mobile visibility/scroll fixes | Make temporal exploration understandable and preserve user context | Merged through earlier PRs, including #9; real coverage, baselines and anomaly results still pending |
| Annual-comparison data | Gap-safe adapter and offline `data:compare` command (#10) | Same source/metric in both years; shared leap-year axis; preserve February 29, gaps, provenance and segment changes | Merged. No inferred scientific statistics or sensor harmonization |
| Annual-comparison UI | Different-year/source controls and URL history (#14); shared month/day chart (#18, Anastasia) | Let product work proceed using the validated adapter and fixtures | Both merged. Final combined browser/device review and future real-data integration remain |
| Context imagery | Leaflet and optional NASA GIBS MODIS Terra true-color imagery | Geographic context only; an image is not a detection or coverage layer | Existing implementation merged. Replacement by the new detection explorer is local WIP |
| Acquisition | Offline FIRMS SP downloader with locally supplied key and raw CSV/hash provenance | Reproducible downloads without exposing credentials in the browser | Merged; tests mock requests. The team's archive delivery is separate evidence, not proof that the authenticated API client was exercised live |
| CSV normalization | Source/platform/time/numeric checks, original raw fields, JSONL and intake report; source-specific `SNPP` instrument alias (#13) | Accept actual archive layout without guessing source, filtering records or changing scientific policy | Merged; outputs remain unreviewed, coverage unknown |
| Batch intake | Explicit manifest, per-file normalization, consolidated reports, repeated input hashes, rollback/refusal to overwrite (#11) | Receive yearly CSVs consistently; flag repeats without deleting scientific evidence | Merged; expected files must be listed explicitly |
| Package integrity | Report/JSONL hash, count, record-sequence and provenance-reference checks, optional separately trusted report hash (#12) | Detect missing/altered data during transfer | Merged. Internal consistency is not NASA authentication or scientific approval |
| Spatial diagnostics | Validated polygon input; inside/boundary/outside partitions; UTC/platform counts and raw FRP diagnostics (#15, integrated into main by #16) | Reproducible technical exploration without dropping records or approving an AOI | Code merged. The particular supplied polygon is now known to lack an authoritative source and must not support Pantanal claims |
| Request-window checks | Request number plus inclusive UTC dates; before/within/after counts; integrity verifier recomputation (#17) | Identify delivery discrepancies without inferring sensor coverage | Merged. Both received national CSVs fit August 1–15, 2020 |
| New detection explorer | Lightweight daily assets, source/platform/date filters, zoom-dependent display grouping, point details, accessible table, optional imagery | Give the map a concrete analytical role: where the supplied records are located | **Local/uncommitted WIP.** Current regional subset/outline must be reconsidered before publication; reconcile #18 and rerun checks |
| Scientific processing | Approval metadata and gates are scaffolded | Keep untested methods unavailable | Not completed: official AOI, quality rules, local solar dates, coverage, platform combination, H3, calibration, uncertainty, baseline, anomalies, plan A/B decision and reviewed real exports |
| Deployment | Vercel configuration and team deployment work | Static hosting consistent with the blueprint | Anastasia handles deployment. This snapshot does not certify the deployed URL/version or physical-device behavior |

## 4. Data deliveries and findings

### 4.1 First illustrative package

The first RAR delivery contained an AOI GeoJSON and two small overlap CSVs: 384 MODIS records and 1,900 VIIRS records for August 1–15, 2020. Both were technically normalized. Their exact original FIRMS provenance/subsetting history was not independently established.

Diagnostic geometry checks found a valid geometric polygon with approximately **175,664.889 km²** geodesic area, whereas its documentation claimed **150,355 km²**. There were **18 MODIS** and **85 VIIRS** sample records outside that polygon, despite documentation saying the samples were clipped. Those findings prompted the request for the original downloads and authoritative AOI evidence.

A mathematically valid polygon is not necessarily the correct geographic boundary. Following André's Gemini explanation, do not promote that polygon's embedded institution/version/area properties into verified provenance.

### 4.2 National MODIS archive

- Archive supplied: `Modis VIIRS S-NPP Ago 2020.rar`.
- Actual contents: `fire_archive_M-C61_848303.csv` plus FIRMS readme link; no VIIRS CSV in that archive.
- Request screenshot: **848303**, **MODIS C6.1**, Brazil, August 1–15, 2020.
- **42,902 records:** Terra **14,777**, Aqua **28,125**.
- CSV raw version value: **6.03**. Preserve it; do not silently equate or rewrite it to the product label C6.1. Ask the scientific owner to confirm the archive version convention if needed.
- No repeated technical identities were found by the normalizer.
- CSV SHA-256: `219f8d501f628e64069518df0a34c0106f0d90189efbe9d6529cf601718cba09`.

### 4.3 National VIIRS archive

- Archive supplied: `DL_FIRE_SV-C2_848307.zip`.
- CSV: `fire_archive_SV-C2_848307.csv`.
- Request screenshot: **848307**, **SUOMI VIIRS C2**, Brazil, August 1–15, 2020.
- **162,017 records**, platform S-NPP, CSV raw version value **2**.
- Its instrument column says `SNPP`, rather than `VIIRS`. PR #13 accepts that alias **only for `VIIRS_SNPP_SP`**, keeps the original value and normalizes sensor/platform to VIIRS/S-NPP. Other-source mismatch checks remain active.
- Normalization version was raised to **1.0.1** for reproducibility.
- No repeated technical identities were found.
- CSV SHA-256: `92b28f8e04c7fb375e548aa21c8f7fbec9c82ecdf7cba754ed7617dd8548de46`.

### 4.4 Combined technical outcome

The two national files contain **204,919 detection records**, all within the declared inclusive UTC window. They include low-confidence and static-source records because no approved quality filter was selected. Counts describe records, not independent fires; having records on a date does not establish complete sensor coverage.

The screenshot supports the request context but does not cryptographically authenticate the supplied file contents. Retrieval timestamps were not invented. Raw files and normalization outputs were kept offline; they were not inserted into calendar fixture paths.

### 4.5 Earlier regional diagnostics — not verified Pantanal totals

Using the supplied, now source-unverified polygon produced:

| Source | All national records | Inside polygon | Exact boundary | Outside polygon |
|---|---:|---:|---:|---:|
| MODIS | 42,902 | 6,660 | 0 | 36,242 |
| VIIRS S-NPP | 162,017 | 26,179 | 0 | 135,838 |

These numbers are reproducible **relative to that polygon only**. They are not an authoritative measurement for the Pantanal. The local map export currently contains these **32,839** inside/boundary records, so it is affected by the source problem and must not be shipped unchanged.

## 5. Work in progress at the pause

### Repository state

- Latest fetched `origin/main`: **`7692b05e1d02e86c015f13052981ebc257e93322`** (includes #18).
- Local active branch: **`feat/review-detection-explorer`**.
- Local HEAD/base of uncommitted changes: **`3df191e8a4cabbd241309597d1cd8c284723ea94`** (main through #17).
- No commit, push, PR or deployment was made for the new detection explorer.
- PR #18 changes the main UI, app CSS and annual-comparison documentation. Preserve `ComparisonChart` and its rendering/styles during any future reconciliation.

### Local files

New files:

- `app/src/components/DetectionReviewMap.tsx`: explorer UI, independent URL filters, Leaflet display layers, record details and paginated keyboard-accessible table.
- `app/src/data/detection-review.ts`: strict review metadata/record parsing, scoped asset fetching and hashes, date handling, URL utilities and display grouping.
- `app/src/data/detection-review.test.ts`: asset/source/date/hash/grouping/filter tests.
- `science/scripts/export_detection_review.py`: deterministic diagnostic-to-review export. **Currently requires the polygon-based diagnostic partitions; revise this if choosing the national approach.**
- `science/tests/test_export_detection_review.py`: retention, integrity, reproducibility and output protection tests.
- `app/public/data/detection-review/v1/`: approximately 2.3 MB of local generated map assets, currently the unsupported regional subset, with daily files and provisional boundary.
- `docs/detection-explorer.md`: local contract for that earlier provisional design. It predates the Gemini disclosure and needs revision before publication.

Modified files: `README.md`, `app/src/main.tsx`, `app/src/style.css`, `docs/data-handoff.md`, `docs/external-sources.md`, `science/README.md`. The old `ContextMap.tsx` is deleted locally because its role was being replaced.

### Implemented interaction choices

- Independent `raw_source`, `raw_from`, `raw_to`, `raw_satellite`, `raw_imagery` query parameters; no false linkage between real detections and synthetic calendar cells.
- One source at a time; MODIS platforms can be inspected separately.
- One UTC day by default, with inclusive range selection inside the delivered window.
- Screen-grid grouping below zoom 10, fixed-size individual points at higher zoom; neither point size nor group counts claim event size or burned area.
- Canvas drawing and viewport-limited individual markers at high zoom; full matching records remain in the table.
- The first chosen basemap provider returned an API-key-required image. It was replaced locally by attributed OpenStreetMap tiles with a dark CSS treatment. NASA imagery remains optional true color.
- Satellite context uses the last UTC day of the review range, with an opacity slider. It does not represent every date or platform in that range.
- Data integrity failures hide stale points and offer retry. Background errors do not invalidate or remove detection records.
- Map loading was separated from calendar artifact success; the chart/calendar still consume fixtures.

### Verification performed before the pause

- **75 TypeScript tests** and **65 Python science tests** passed during this WIP stage. Later UI/layout refinements were checked by build/browser runs; the complete suites should be rerun after reconciliation and the AOI decision.
- Latest WIP TypeScript/Vite build passed.
- English language/whitespace checks passed before the last small UI edits; rerun before publishing.
- Chromium browser checks at 1440px desktop and 390px touch-mobile emulation passed without page overflow: source/platform filters, keyboard inspection, Back/Forward, preserved calendar/comparison query values, remount behavior, invalid deep links, corrupt-file rejection/retry and independent imagery failure.
- A development hot-reload test once produced a Leaflet `_leaflet_pos` error while files were being edited. A stable rerun passed with no JavaScript page errors. Recheck navigation during active zoom/unmount and clean up map listeners if reproducible; do not describe this as conclusively fixed.
- Emulated browser tests are not physical-device QA. The #18 chart was merged afterward and has not been included in these WIP browser checks.
- Nothing in those checks validates the supplied polygon's identity, scientific results, coverage or a deployed production URL.

## 6. Decisions and differences from the blueprint

| Difference / staged delivery | Reason | What must happen next |
|---|---|---|
| Synthetic calendar delivered before historical observations | Real data and scientific decisions were unavailable; the blueprint explicitly allowed fixtures | Replace the full derived package only after scientific review, not by summing raw CSVs in the browser |
| Original MODIS/VIIRS exposed; harmonized option blocked | No empirical calibration or plan A approval exists | André must deliver reviewable results and a plan A/B decision; tests cannot approve science |
| Context satellite image preceded a detection map | Public imagery was available without a key while spatial artifacts were missing | New raw-point explorer is unfinished and must be revisited after the AOI disclosure |
| Raw detection explorer developed separately from the calendar | Only a 15-day real delivery exists; connecting it to synthetic historical values would mislead | Synchronize views only when they share reviewed compatible data and time conventions |
| Independent raw-map UTC dates instead of preserving calendar period as the map filter | Calendar dates/bases describe fixtures and a different data contract | Keep this separation explicit; implement the blueprint's synchronized journey after real aggregate integration |
| Raw display grouping instead of scientific H3 cells | H3 aggregation, quality/coverage rules and approved metrics are not delivered | Label groups as display-only and do not reuse them as scientific outputs |
| No baseline, seasonal-window or anomaly claims from the new CSVs | Fifteen days cannot support the planned historical seasonal analysis; coverage is unknown | Obtain sufficient history, preregister rules and compute results offline |
| Additional intake, integrity and request checks | Incoming samples needed reproducible technical validation and transfer safety | Keep checks lightweight and distinguish technical acceptance from scientific approval |
| Earlier exploratory use of a provisional polygon now needs reversal/review | André's later disclosure removes the basis for treating the file as traceable geographic evidence | Do not publish the regional subset; find an authoritative polygon or use an explicitly national un-clipped view |
| Proposed national Brazil explorer is a fallback, not a completed change | Genuine national detections are available and can be shown without inventing Pantanal geometry | User paused before this adaptation; decide and implement carefully on resumption |
| English working language, Portuguese handoffs only for André | Explicit user instruction for team accessibility | Do not translate the project back to Portuguese |

These are delivery/order changes and open scientific dependencies, not evidence that harmonization failed. Plan B has not been selected as an empirical result merely because plan A remains blocked.

## 7. Responsibilities and next actions

### Application/backend work — can proceed after resumption

1. Read this document and the latest `AGENTS.md`; fetch main and inspect current open PRs before editing.
2. Restore the saved WIP safely if the old workspace is unavailable. Reconcile #18 first and preserve Anastasia's comparison chart.
3. Settle the AOI issue before publishing the explorer. The discussed fallback was national Brazil detections with no Pantanal clipping/outline, but it has not been implemented or approved as a scientific boundary replacement.
4. If using national data, re-export all **204,919** records from the original CSVs/normalized data, revise schema/scope/notices, remove AOI-dependent point membership and public geometry, update payload limits/tests, and keep sources separate. Do not just relabel the existing 32,839-point subset as Brazil.
5. If obtaining an official boundary, record institution, original URL, dataset/version, CRS, download hash and any selection/reprojection steps. Verify geometry/area and have the scientific owner confirm scope. Do not ask an LLM to invent the missing coordinates.
6. Rerun unit, science, language, dataset, build and browser checks, including the chart and map together. Open an English PR with a concrete status/scope explanation.
7. Produce calendar/map scientific exports only after approved decisions; do not set real/approved metadata as a shortcut.

### André — scientific/data owner

- Confirm a traceable geographic boundary or agree on another defensible pilot scope. It is acceptable to say that a source cannot be found; generated coordinates are not a substitute.
- Confirm archive product/version conventions and source provenance, especially raw MODIS `6.03` versus the request product label C6.1.
- Supply reproducible confidence/static-source filtering, local solar-day convention, duplicate handling, coverage assessment and Terra/Aqua/S-NPP platform rules.
- Deliver adequate historical data after the initial batch is validated; the discussed acquisition targets were MODIS from the available 2000 start through 2025 and S-NPP from 2012 through 2025, documenting partial periods.
- Supply preregistered thresholds, calibration/validation split and per-platform results, uncertainty, baseline/leap-day treatment, limitations, reviewed output artifacts and a human plan A/B decision.

### Anastasia / Lumina — frontend/product/deployment

- #14 controls and #18 comparison chart are merged. Pull current main before more work.
- Finish combined mobile/desktop visual and keyboard review; report narrow fixes in separate English PRs.
- Continue chart/product work using fixtures while science is pending. Do not infer that a real point map approves the calendar.
- Coordinate map/style changes through the user to avoid conflicting edits. Agents must not message the team independently.
- Confirm deployed commit and perform deployment checks. This handoff does not certify a deployment.

### Project owner

- Keep the raw archives, this handoff and resume package available for the next chat.
- Decide the pilot's immediate presentation after the boundary issue is understood.
- Continue review/merge of concrete English PRs; review scientific claims separately from passing CI.

## 8. Resume package and safe recovery

The companion ZIP contains:

- This handoff in Markdown, Word and PDF.
- `tracked-changes.patch` for modifications/deletion to tracked files at the original WIP base.
- `new-files/` containing all new WIP code, tests, documentation and generated review assets.
- `inputs/` containing the two original archive deliveries and the earlier polygon **for audit only, not as a verified AOI**.
- Browser-check notes/scripts/screenshots as local development evidence, not production certification.
- `restore_wip.py`, which checks a clean checkout at the original base before restoring the patch and new files. It does not commit, push, merge or deploy.

If the old workspace is available, the changes already exist on `feat/review-detection-explorer`; do not apply the package again. If using a new workspace, restore onto a new branch from the original base, then reconcile with current main. A subsequent rebase/merge can conflict in main UI, CSS or docs; preserve #18's chart and the disclosure in this handoff.

The ZIP intentionally excludes credentials, environment files, `.git`, dependency folders and large intermediate JSONL outputs. Reproduce intermediate outputs from the original archives using the merged offline scripts as needed. Keep inputs outside frontend assets. Do not run or publish the restored map until its unverified boundary dependency is addressed.

## 9. Suggested first message in the next chat

> Continue ChronoFlare using this handoff and attached resume ZIP. PR #18 is merged into main. Implementation was paused at my request. The new map exists only as local WIP based on main through #17. André disclosed that the polygon was made with Gemini Argon and has no authoritative source. Do not publish the polygon or call its subset verified Pantanal data. First inspect main, restore/reconcile WIP if necessary, explain the next concrete step, and preserve English project language and scientific approval gates. The proposed national-map fallback has not yet been implemented.

## 10. Existing references

- `AGENTS.md` — project language policy.
- `docs/blueprint-v1.2.md` — original product/science plan.
- `docs/data-handoff.md` and `science/configs/decisions.json` — output contract and pending decisions.
- `docs/raw-ingestion.md` — download normalization, batches, integrity, provisional spatial diagnostics and request checks.
- `docs/annual-comparison.md` — adapter and chart integration, updated by #18.
- `docs/selection-navigation.md` — calendar navigation/history contract.
- `docs/handoff/` — earlier team handoffs; these predate the Gemini disclosure.

**End state:** documentation/resume checkpoint. No national-map adaptation, new scientific approval, map merge or deployment is asserted by this document.
