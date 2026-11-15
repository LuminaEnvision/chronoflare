# ChronoFlare — official Pantanal filter delivery

> **Historical/stage-specific record.** This page preserves the facts, test counts and remaining work of its original delivery. It is not the current project approval or feature checklist. See [current validation and scope](../../validation-report.md) and the [documentation index](../../README.md). Any associated dated PDF/Word remains that historical snapshot.

**Updated:** November 14, 2026. This is the current implementation checkpoint,
supplementing the earlier national-map and source-review reports.

## Delivered behavior

The map now offers **Brazil download** and **Pantanal · IBGE 2025**. Brazil remains
the default and retains every national record. The region selector works with
UTC dates, source/platform controls, URL links, Back/Forward, table inspection and
optional satellite context. The raw map is still separate from the synthetic
calendar and annual-comparison chart.

| Source | National records preserved | Official Pantanal subset |
|---|---:|---:|
| MODIS Terra + Aqua | 42,902 | 6,779 |
| VIIRS S-NPP | 162,017 | 26,464 |
| Total | 204,919 | 33,243 |

These are detection records, not independent fires. Every regional tuple is an
unchanged tuple from the national source. Low-confidence/static-source records
and coincident detections are retained. National daily file bytes are unchanged.

## Why this reference is defensible

The supplied IBGE land-use files were verified against the official downloads but
contain a 1 km classification grid. The old Gemini polygon is not used. Engineering
located the separate official IBGE 2025 biome archive, verified its hash and
selected exactly `CD_BIOMA=6; NM_BIOMA=Pantanal`.

The valid source polygon has 32,918 vertices, native SIRGAS 2000 coordinates and
one ring. A recorded EPSG transformation exports WGS84 longitude/latitude with
1 m stated transformation accuracy. No repair, simplification, snapping or
invented boundary is applied. The pinned archive hash prevents silently replacing
this source with another polygon/version.

Point centres strictly inside or exactly on that polygon are included, without a
buffer or tolerance. This is a reference filter, not pixel-footprint intersection,
measured sensor coverage, proof of a fire event, burned area or scientific-method
approval. Boundary scale and input geolocation/rounding still limit interpretation.
The 2025 reference remains fixed across displayed dates.

## Implementation and decisions

- Offline builder `prepare_pantanal_review.py`: verify archive/national inputs,
  derive regional files, preserve national data and fail without publishing a
  partial package. Geometry reading/CRS dependencies are pinned.
- Existing national schema remains supported; an optional `pantanal` descriptor
  adds source metadata, hashes, counts and the reference boundary.
- Browser validates region/source/path/count/provenance consistency. Only the
  selected scope/source/days and required boundary are fetched.
- A dashed cyan boundary, official-source link and recorded hash identify the
  reference. `Fit boundary` differs from `Fit detections`.
- Region changes clear mismatched records. Failed regional files do not retain
  national points labeled as Pantanal. Returning to Brazil removes boundary and
  attribution. Scope is stored independently in `raw_region` URL state.
- The earlier regional totals 6,660/26,179 belonged to the unsupported polygon;
  they were not relabeled as official results.

## Source roles and pending science

MapBiomas Collection 11, 2020, 30 m remains the proposed context layer for the FIRMS
2020 batch. It is not integrated yet. The new MMA link was inspected: its landing
page identifies historical deforestation monitoring for 2002–2008, coordinated by
MMA/SBF and executed by IBAMA. Individual vector archives were not verified or
integrated. These resources do not establish daily clear-sky/orbital coverage.

Coverage delivery 2 remains a disabled proposal. Required clarification includes
event source URLs, S-NPP catalogue-cutoff meaning, positive AOI/platform/turn
observation evidence, UTC/local-solar-day handling and the partial-zero rule.
Illustrative examples also need complete reproducible records. The exact questions
are saved in Portuguese specifically for André under
`docs/handoff/andre-coverage-questions.md`.

`science/configs/decisions.json` and the fixture calendar remain unchanged. The
new filter does not enable real aggregates, zeros, anomalies or harmonization.

## Verification

- 83 TypeScript tests and 69 Python tests passed: **152 total** at this checkpoint.
- All 10,228 calendar records still validate as fixture, decision pending.
- Production build, English language check and whitespace check passed.
- Chromium checks against the production preview covered region/source counts,
  history, preserved calendar date, boundary attribution add/remove, keyboard
  inspection, 390px mobile and corrupt-boundary retry.
- The reusable browser smoke check also covers independent calendar failure,
  imagery cleanup, repeated zoom/unmount navigation and an empty narrow-screen
  response. Desktop/mobile screenshots are under `docs/pantanal-region/`.

Passing checks is not scientific approval or confirmation of a production
deployment. Physical-device and hosted-version QA remain team tasks.

## Remaining responsibilities

**Engineering:** review/merge this delivery, preserve fixed source provenance and
implement scientific coverage/aggregation only after the rule and evidence are
complete. Longer-term: add correctly dated land-cover context and reviewed
historical outputs.

**André:** answer the documented coverage questions when available, confirm the
scientific aggregation conventions and provide sufficient history, reproducible
validation/uncertainty/baseline results and a human plan A/B decision. No additional
hand-generated polygon is needed.

**Anastasia:** continue integrated hosted desktop/mobile/keyboard QA after pulling
the merged version. Record the deployed commit and reproduction steps; keep fixes
small and avoid changes to scientific rules or generated datasets.

**Project owner:** merge reviewable PRs, verify the hosted commit and keep scientific
acceptance separate from CI. No direct team messages were sent by the agent.

Full reproduction instructions: `docs/pantanal-region.md`. Prior implementation
and source-review reports remain available as dated context.
