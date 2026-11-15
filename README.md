# ChronoFlare

**Understanding fire activity through time.**

Explore satellite-detected fire activity through time with MODIS and VIIRS, making sensor provenance, coverage, and uncertainty visible. An independent NASA Space Apps project; not an official NASA product.

## Current status

The default calendar uses **real NASA FIRMS observations** and the **scientifically approved v2 harmonization** for the official IBGE Pantanal reference. Terra, Aqua and Suomi-NPP native series remain separate. Calibrated estimates are published only when Terra and Aqua both have complete aligned turns.

The export contains 4,318 acquired dates and 635 estimates across 2012–2015 and 2017–2026; 2016 was not acquired. **Only six estimates are published in 2025 and five in 2026.** Of the published dates, 232 are in the training period, where agreement is not validation evidence. There is no independent backward test. Missing records remain missing; positive detections do not prove cloud-free coverage or true zeros.

Available now:

- A real-data month/day calendar with separate native sources, approved calibrated estimates, 80% intervals, extrapolation flags and per-date sample roles.
- Two-year comparisons within the same series, preserving leap days and gaps, plus URL and Back/Forward navigation.
- A Methodology panel showing rejected v1 history, the registered independent v2 test, its limitations and the scientific-owner decision. The independent test used 506 paired days / 40 eligible weeks; publication uses a stricter both-platforms-complete subset.
- A separate [August 2020 detection explorer](docs/detection-explorer.md), with optional GIBS imagery and MapBiomas land cover. It is a review batch, not the exact source of every calendar cell.
- Explicitly separate **synthetic demonstration** and [experimental August 2020 preview](docs/experimental-solar-calendar.md) modes under **Calendar dataset**.
- Static, hash-verified observation assets, offline source acquisition and frozen model evidence, tests and Vercel configuration.

See the [documentation index](docs/README.md) and [real-data behavior, decisions and remaining work](docs/real-observation-experience.md). Anomalies, seasonal classifications and forecasts are not enabled by harmonization approval.

## Quick start

Use Node.js 22.12+ or 24. Python 3.12+ is needed for offline processing/tests. Offline geospatial processing requires Shapely, pyshp and pyproj from `science/requirements.txt`; the downloader and normalizer use the standard library.

```sh
npm ci
npm run dev
```

Open the Vite URL printed in the terminal. To verify the application:

```sh
npm test
python3 -m pip install -r science/requirements.txt
npm run test:science
npm run data:validate
npm run build
```

Optional live connectivity check (Node.js 24.5+, not run in CI; honors proxy environment variables):

```sh
npm run sources:check
```

This checks a public GIBS JPEG, not fire coverage or scientific validity. The map loads detection assets on demand and handles imagery failures independently of its records and the calendar.

## External sources

**NASA GIBS:** connected directly from the browser for visual context, without credentials. The imagery date is the review window's last UTC date; the regional aggregation helper separately uses the fixed −56.65° mean solar reference. Missing imagery does not mean zero fire. See [GIBS API documentation](https://nasa-gibs.github.io/gibs-api-docs/access-basics/).

**NASA FIRMS:** the download client makes one explicit, bounded SP request (1–5 days), using `FIRMS_MAP_KEY` from the local environment. Raw downloads stay outside the frontend. See [external-source setup](docs/external-sources.md) for key setup, an example command, provenance, and current limits. No backend, database, or authenticated browser API is required.

## Scientific handoff

Start with the [current validation and approval](docs/validation-report.md), [active data handoff](docs/data-handoff.md), [v2 method and history](docs/harmonization-v2-candidate.md), and [export contract](docs/observation-app-export-contract.md). The real-data runtime schema is `app/src/data/observations.ts`; `app/src/data/schema.ts` belongs to the separate synthetic package. The [original blueprint](docs/blueprint-v1.2.md) and [dated delivery reports](docs/project-status/README.md) remain historical context.

The primary frontend serves reviewed exports from `app/public/data/observations/v1/`, with a separate compact scientific-evidence sidecar. Its runtime schema and shipped-data test verify year hashes, complete-platform publication, aligned inputs, approval and source identity. The export and decision came from PR #49; the frontend does not refit or rescore models.

`app/public/data/v1/` remains the synthetic demonstration package. `npm run data:validate` checks that legacy package and still reports fixture status; this is not the status of the default real-data calendar. `npm run fixtures` only regenerates those synthetic paths and must not be used to manufacture real observations.

To regenerate the display-only research sidecar from committed evidence:

```sh
node --import tsx scripts/export-research-evidence.ts
npm run evidence:pairs
```

## Deploy to Vercel

Import this repository with the repository root as the Root Directory. `vercel.json` sets `npm run build` and the `dist/` output. Views use query parameters, so no SPA rewrite is needed. This change does not create or verify a deployment. Never add the FIRMS key to frontend environment variables; GIBS needs no key.

## Repository

```text
app/src/                 React UI, source adapters, schemas, tests
app/public/data/observations/v1/  Approved real observation/calibration exports
app/public/data/v1/      Separate synthetic demonstration artifacts
app/public/data/detection-review/v1/  Separate unreviewed regional detections
science/scripts/        Offline FIRMS download and raw CSV normalization
science/tests/          Offline acquisition/intake tests; no live credentials
science/configs/        Registered protocols, thresholds and scientific decisions
scripts/                Fixture generation, data validation, source smoke check
docs/                   Blueprint, scientific handoff, external-source setup
```

## Remaining work

- Sync the deployment fork after merge and verify the deployed calendar on real phones.
- Finalize submission media, source credits and the AI inventory.
- Future research: seasonal/anomaly statistics, more complete observation support, H3 aggregation and additional independently evaluated regions. These are not claims of the current release.

## Interpretation and AI disclosure

FRP is radiative power, not total energy or burned area. Thermal detections are not confirmed individual fires. Original sensor scales are not directly comparable; missing observations are not zeros. No pre-2012 estimates are currently published; any future such extension would lack direct VIIRS validation. This is not a forecasting or emergency-response service.

Built with React, TypeScript, Vite, Zod, Leaflet, Python and Shapely for offline geometry checks. Codex, Cursor and Claude/Claude Code assisted with development, testing, documentation and research diagnostics as recorded in the disclosure. Human review of code, interface, and scientific claims is required before submission; empirical results come from the source-bound offline pipeline and frozen validation reports, separate from synthetic application fixtures. Project license remains to be selected by the team.

## Project language

English is the working language for the interface, accessibility labels, CLI output, tests, documentation, commit messages, and pull requests. Run `npm run language:check` before submitting changes; CI checks common Portuguese regressions. Documents specifically addressed to André under `docs/handoff/` may remain in Portuguese; proper names such as André and Pantanal retain their spelling. The Portuguese README has been retired under the current English-only requirement.

The Calendar dataset selector also offers a separate
[experimental real-detection solar calendar](docs/experimental-solar-calendar.md)
for August 1–15, 2020. Platforms stay separate, quality filtering is proposed
and unapproved, and observation coverage remains unknown. See the
[verified v1.2 operational-evidence review](docs/coverage-v1.2-review.md).

The [indicator delivery review](docs/indicator-delivery-review.md) records the
new SP quality audit, supplied calibration protocol and remaining aggregation
clarifications. It does not approve harmonization or relabel frozen preview data.

A [bounded 2019 training-period pilot](docs/training-period-pilot.md) now has
verified acquisition and a same-rule offline 2020 audit. These are separate
pre-deduplication research inputs, not new approved calendar metrics or a fitted
harmonization model.

The [indicator pipeline](docs/observed-indicator-pipeline.md), [registered thresholds](docs/scientific-thresholds.md), [historical v1 report](docs/multiyear-evidence/experiment-summary.json), [v2 independent result](docs/multiyear-evidence/v2-candidate/independent-summary-v2.json) and [scientific-owner Plan A decision](science/configs/harmonization_decision.json) remain separately versioned. The v1 failure is preserved; approval applies to the frozen v2 and its restricted publication scope.

See the [AI assistance and content provenance disclosure](docs/ai-disclosure.md)
and machine-readable [`ai-disclosure.json`](app/public/ai-disclosure.json). The
team inventory and final submission media must be confirmed before calling the
disclosure complete. Raw NASA observations are distinct from AI-assisted code,
derived statistics and explicitly synthetic demonstration fixtures.
