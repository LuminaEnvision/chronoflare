# ChronoFlare — current implementation and map delivery

> **Historical/stage-specific record.** This page preserves the facts, test counts and remaining work of its original delivery. It is not the current project approval or feature checklist. See [current validation and scope](../../validation-report.md) and the [documentation index](../../README.md). Any associated dated PDF/Word remains that historical snapshot.

**Updated:** November 14, 2026. **Repository:** https://github.com/j-c-fstk-dev/chronoflare

> Subsequent source checkpoint: [official IBGE biome vectors and the MapBiomas
> configuration have now been verified](../../geographic-sources-review.md).
> The national map remains unchanged. PRs #20 and #21 are merged; references to
> their pending merge below describe this report's original delivery snapshot.

This report updates the [earlier pause handoff](implementation-handoff.md).
That document and its Word/PDF copies remain historical snapshots. Their local,
polygon-dependent map and pause instructions do not describe the current delivery.
The user resumed implementation after PR #19 and supplied coverage delivery 2.

## 1. Result

The Map now explores the **full Brazil FIRMS archive batch for August 1–15, 2020**,
with independent source/platform/date filters, display grouping, point inspection,
an accessible paginated table and optional satellite imagery. MODIS and VIIRS are
never combined into a single scientific metric.

All **204,919 records** are retained: **42,902 MODIS** (Terra 14,777 / Aqua 28,125)
and **162,017 VIIRS S-NPP**. These are detection records, not independent fire events.
The source request numbers are 848303 and 848307. CSV hashes, source filenames,
normalization versions and raw collection values are in the review manifest.

The earlier polygon is not used, exported or drawn. André reported creating it
with Gemini Argon without a traceable authoritative source. No replacement AOI was
invented. The map area is the supplier-declared Brazil download; basemap borders
are context, not a scientifically verified country/Pantanal clipping operation.

The map is explicitly **raw/unreviewed**, with coverage **unknown**. The calendar
and annual-comparison chart still use **10,228 fixture records** and retain the
existing scientific approval gates. A visible notice separates the raw batch from
those synthetic historical values. No real aggregate package was approved.

## 2. What was implemented and why

| Stage | Current delivery | Reason / decision | Remaining work |
|---|---|---|---|
| Static architecture | React/TypeScript/Vite, Zod, Leaflet; offline Python; no API/database added | Consistent with the blueprint and hackathon deployment scope | Review deployed version and finish team QA |
| Calendar | Fixture-based daily view, original source bases, details and URL/history behavior | Product work could proceed before reviewed science | Reviewed daily aggregates, coverage and historical outputs |
| Annual comparison | #10 adapter, #14 controls and #18 chart remain integrated | Same metric/source, aligned month/day including February 29, gaps preserved | Singleton-marker/partial-legend fix is open as #20, pending merge; eventual real-data integration |
| Raw acquisition/intake | Original national CSVs normalized, batch/hash/request-window checks merged through #17 | Preserve provenance, detect technical errors, avoid manual file processing | Longer history and scientific provenance/collection confirmation |
| Raw map export | Original CSVs go through normalization; compact daily files retain every record | The earlier spatial partitions depended on unsupported geometry | Verified AOI only if a future reviewed regional layer is required |
| Map controls | Independent raw source/platform/inclusive UTC dates, deep links, Back/Forward | Real 15-day points must not inherit synthetic calendar selections | Shared selections only after compatible reviewed data exists |
| Geographic rendering | Dark attributed OpenStreetMap background, numbered screen-grid groups, individual canvas points at high zoom | Emphasize detections and keep a national dataset usable without plotting every marker at once | Physical-device performance review and future map polish |
| Inspection/accessibility | Point details plus all-record table, pagination and direct page number | Coincident or canvas-only points must remain inspectable by keyboard | Human accessibility review across supported devices |
| Optional imagery | NASA GIBS true color for the review range's final UTC date, opacity control | Satellite imagery adds context but is not the detection data | Provider availability remains external; no imagery-derived science |
| Reliability | Hashed/count-checked assets, hash-keyed cache URLs, abort handling, retry and independent background/data failures | Avoid stale/mismatched records and let the map work when calendar files fail | Continue deployment regression testing |
| Coverage delivery 2 | English engineering review and disabled proposed outage JSON | Preserve the supplier's input without converting unsourced dates/proxies into false zeros | Authoritative references and deterministic rule/contract clarification |
| Documentation and handoff | Current explorer contract, implementation report, coverage review, screenshots and frontend follow-up | Explain scope, decisions, departures and ownership | Keep reports current when science/deployment status changes |

## 3. Data path and scientific limits

1. Read the two original national CSVs, explicitly selecting MODIS SP and VIIRS S-NPP SP.
2. Run the existing technical normalizer. It validates values/time/platform and
   preserves duplicates, low confidence and static-source records. Full temporary
   JSONL remains outside the public app tree and is removed after export.
3. Write per-source/day compact JSON and a manifest under
   `app/public/data/detection-review/v1/`. Daily tuples contain original CSV record
   number, coordinates, UTC time, platform, FRP, raw confidence and source type.
4. Fetch only the selected source/days and validate hashes, byte counts, metadata,
   platform/date consistency and unique source-record references.
5. Group by screen grid for display below zoom 10. At high zoom, draw individual
   visible/nearby points. Counts and the table still include every matching record.

The package is approximately **12 MB uncompressed**, split into 30 day/source files
plus its manifest. Tests cap a daily file at 1.5 MB. Browser integrity requires HTTPS
or localhost. No credentials, original raw archives or full normalized JSONL are
frontend assets.

The exporter refuses overwrite, invalid/out-of-window input and calendar/dist output
paths. It does not authenticate NASA origin, approve data, calculate coverage,
identify unique fires, estimate burned area, harmonize sensors or classify anomalies.
Original MODIS raw version `6.03` is not silently rewritten to the C6.1 request label;
S-NPP's raw version is `2`. See [the explorer contract](../../detection-explorer.md).

## 4. Differences from the initial plan

| Difference | Why it was necessary | What is preserved / what comes next |
|---|---|---|
| Brazil download instead of a Pantanal-clipped point layer | The supplied polygon lacks a traceable authoritative source | Pilot-region science still needs a verified AOI; national data is clearly labeled |
| Raw map separate from the calendar | Only 15 days of real records are available; calendar/chart are synthetic | Do not connect real points to fictional historical activity. Future synchronization requires compatible reviewed artifacts |
| Display groups rather than approved H3 activity cells | Scientific grid, coverage, filters and aggregation are not delivered | Groups are only navigation aids, not scientific bins or events |
| Optional imagery rather than imagery-only map | A satellite photo did not explain where the supplied detections were | Image context remains available, while point data carries the exploratory task |
| No automatic zero generation from the new coverage document | Operational schedules and distant detections do not by themselves establish observed AOI coverage; rule/contract ambiguities remain | Preserve null/zero distinctions and integrate a classifier only after clarification |
| No harmonized scientific result or anomaly layer | Calibration, uncertainty, baselines, preregistration and plan A/B review are still pending | Original sources remain separate; approval gates are not bypassed |

The static architecture and calendar-first product structure still follow the
blueprint. Lack of plan A approval is not evidence that harmonization failed;
no empirical plan B decision is claimed.

## 5. Coverage delivery 2: outcome of review

The document makes useful commitments: missing rows are ambiguous, verified outages
can block false zeros, the Terra-only era differs from Terra+Aqua, and
`overpass_count` should stay null without actual orbital measurements.

It is **not integrated as an active coverage rule**. Its proposed dates are saved
in `science/configs/sensor_outages.proposed.json`, marked disabled and pending
source verification. The attachment's hash/version/declared registration are
recorded without claiming empirical preregistration approval.

Before integration, resolve:

- Official event URLs and time-zone/inclusive-boundary semantics for each outage.
- Whether S-NPP's `2026-11-02` catalogue cutoff is current availability, processing
  latency, product discontinuation or instrument shutdown. The screenshot alone
  does not justify treating all later dates as mission-wide no-data.
- Exact positive evidence for AOI/platform/turn coverage; South American detections
  and nominal swath width do not establish coverage of this AOI or cloud-free pixels.
- UTC versus local solar dates and handling of partial-day outages or contradictory
  positive detections.
- A deterministic partial-zero rule. The current schema rejects zero with partial
  coverage; the proposed text permits some such cases. Any change needs review,
  versioning and tests.
- Complete example records: use the next day as exclusive `period_end`, supply
  required metadata/uncertainty, and reproduce values rather than treating the
  supplied illustrations as validated measurements.

Full findings: [coverage engineering review](../../coverage-delivery-review.md).
`science/configs/decisions.json` and the scientific approval state are unchanged.

## 6. Verification and its limits

- **79 TypeScript tests and 65 Python tests passed**: 144 total at this delivery.
- Dataset validation: 10,228 records, status fixture, decision pending.
- Production TypeScript/Vite build passed.
- Browser checks used Chromium against the production preview, at 1440px desktop
  and 390px touch-mobile emulation: filters, platform selection, keyboard record
  inspection, Back/Forward, preserved calendar/chart URL state, chart day inspector,
  failed imagery, corrupted data and retry, invalid deep links and no page overflow.
- Additional browser regression checks passed: map usability with calendar HTTP
  503, correct imagery attribution removal, repeated navigation during zoom and
  empty data at 320px without stale points/page overflow. Leaflet CSS zoom
  animation was disabled to prevent delayed callbacks after React unmount.
- Screenshots are checked into `docs/detection-explorer/`.
- No production deployment, physical-device accessibility/performance certification,
  authoritative boundary review or empirical scientific validation is implied by
  these checks. CI results belong to the PR and should be checked before merging.

The previous pause snapshot's restoration package remains an archive of an earlier
uncommitted state. Do not restore its polygon-dependent map over this delivery.
For future work, use the current GitHub branch/PR or main after merge.

## 7. Who does what next

**Engineering (our side):** finish PR review/CI, keep raw and derived contracts
separate, and implement agreed coverage/aggregation only after the missing evidence
and definitions arrive. Obtain a traceable AOI before regional claims. Keep all new
commits, UI and project documentation in English.

**André:** provide event/product references and deterministic coverage evidence;
resolve cutoff/partial-zero/date conventions; supply a verified AOI; confirm archive
versions and quality/platform rules; deliver sufficient history, reproducible
calibration/validation, uncertainty, baselines, limitations and a human plan A/B
outcome. A generated polygon is not geographic evidence.

**Anastasia / Lumina:** the singleton-marker and partial-coverage legend task is
already open in [PR #20](https://github.com/j-c-fstk-dev/chronoflare/pull/20), not yet
merged at this snapshot. The current map branch preserves the #18 chart; it does
not claim to include #20. After #20 and the map PR merge, pull latest main and run
integrated desktop/mobile/keyboard QA on the hosted calendar, chart and map.
Record deployed commit, device, steps and screenshots; open narrow frontend fixes
without changing scientific rules or generated data. See the
[ready-to-forward follow-up](../../handoff/comparison-chart-followup.md).

**Project owner / deployment team:** review and merge concrete PRs, confirm the
deployed commit, test mobile/desktop on the actual hosted app and review scientific
claims separately from CI. No independent agent messages are sent to team members.

## 8. Reproduction and resumption

Use the exporter command in [the map contract](../../detection-explorer.md), then run
`npm test`, `npm run test:science` (install `science/requirements.txt`),
`npm run language:check`, `npm run data:validate` and `npm run build`.

The feature branch is `feat/review-detection-explorer`, based on main through #19.
PR #18's comparison component/helper/styles remain intact. No persistent backend,
authenticated browser FIRMS call or new scientific classifier is introduced.

A safe next-chat prompt is:

> Continue ChronoFlare from current main or the detection-explorer PR. Read the
> current map delivery update and coverage review, not only the older pause
> snapshot. The map uses all national Brazil records without the Gemini polygon;
> the calendar/chart are fixtures. The outage proposal is disabled pending sources
> and deterministic rule clarification. Preserve English language, the #18 chart,
> raw/derived separation and all scientific approval gates.
