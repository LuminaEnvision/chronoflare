# ChronoFlare

**Understanding fire activity through time.**

Explore satellite-detected fire activity through time with MODIS and VIIRS, making sensor provenance, coverage, and uncertainty visible. An independent NASA Space Apps project; not an official NASA product.

## Current status

The application uses **synthetic fire-activity data**, clearly labeled throughout the interface. André's dataset, confirmed Pantanal area of interest (AOI), coverage assessment, and scientific validation are still pending. Harmonization is disabled until approval.

Available now:

- Daily year-by-month/day calendar, original MODIS/VIIRS bases, date selection, details, and same-day comparisons across years.
- Calendar, Map, and Methodology views with date/base preserved in the URL.
- Interactive **NASA GIBS context imagery** for the selected UTC date, using public MODIS Terra true-color tiles. This real background imagery is independent of the synthetic calendar and has no fire-detection overlay or confirmed AOI boundary.
- An **offline NASA FIRMS SP download client**, preserving original CSVs and SHA-256 provenance. A local MAP_KEY is required; no live FIRMS download has been verified yet.
- An offline CSV normalizer that preserves raw fields and provenance, validates technical fields, and produces unreviewed raw-detection JSONL without applying pending scientific rules. See [raw-ingestion setup](docs/raw-ingestion.md).
- Runtime dataset validation, automated tests, CI, and Vercel configuration.

Seasonal references, anomalies, uncertainty intervals, H3 fire layers, calibration, and scientific diagnostics must come from reviewed offline outputs. They are not inferred from context imagery.

## Quick start

Use Node.js 22.12+ or 24. Python 3.12+ is needed only for the offline client and its tests; it has no third-party dependencies.

```sh
npm ci
npm run dev
```

Open the Vite URL printed in the terminal. To verify the application:

```sh
npm test
npm run test:science
npm run data:validate
npm run build
```

Optional live connectivity check (Node.js 24.5+, not run in CI; honors proxy environment variables):

```sh
npm run sources:check
```

This checks a public GIBS JPEG, not fire coverage or scientific validity. The map loads on demand and handles image loading errors separately from calendar data.

## External sources

**NASA GIBS:** connected directly from the browser for visual context, without credentials. The imagery date is UTC; the fire aggregates use the pipeline's local-solar-day convention. Missing imagery does not mean zero fire. See [GIBS API documentation](https://nasa-gibs.github.io/gibs-api-docs/access-basics/).

**NASA FIRMS:** the download client makes one explicit, bounded SP request (1–5 days), using `FIRMS_MAP_KEY` from the local environment. Raw downloads stay outside the frontend. See [external-source setup](docs/external-sources.md) for key setup, an example command, provenance, and current limits. No backend, database, or authenticated browser API is required.

## Scientific handoff

Read the [delivery contract](docs/data-handoff.md), [blueprint v1.2](docs/blueprint-v1.2.md), and [validation status](docs/validation-report.md). Executable schemas live in `app/src/data/schema.ts`.

The frontend serves derived static artifacts from `app/public/data/v1/`. Replace the complete fixture package with consistent reviewed outputs and run:

```sh
npm run data:validate -- --real
```

This is a structural check, not scientific approval. The offline FIRMS downloader does not produce frontend aggregates, establish coverage, select platforms, calibrate sensors, or authorize `data_status=real`.

`npm run fixtures` regenerates deterministic synthetic artifacts. **Do not run it after integrating real data:** it replaces the fixture paths under `app/public/data/v1/`. The build never runs it automatically.

## Deploy to Vercel

Import this repository with the repository root as the Root Directory. `vercel.json` sets `npm run build` and the `dist/` output. Views use query parameters, so no SPA rewrite is needed. This change does not create or verify a deployment. Never add the FIRMS key to frontend environment variables; GIBS needs no key.

## Repository

```text
app/src/                 React UI, source adapters, schemas, tests
app/public/data/v1/      Static derived artifacts (currently synthetic)
science/scripts/        Offline FIRMS download and raw CSV normalization
science/tests/          Offline acquisition/intake tests; no live credentials
science/configs/        Pending scientific decisions
scripts/                Fixture generation, data validation, source smoke check
docs/                   Blueprint, scientific handoff, external-source setup
```

## Next milestones

- André: confirm AOI, collections, dates, coverage, filters, platform-combination rules, pre-registered thresholds, and plan A/B outputs.
- Application: integrate reviewed H3/GeoJSON fire layers, scientific charts, and full-year comparisons.
- Team: browser/device QA, scientific and code review, Vercel deployment, and presentation materials.

## Interpretation and AI disclosure

FRP is radiative power, not total energy or burned area. Thermal detections are not confirmed individual fires. Original sensor scales are not directly comparable; missing observations are not zeros. Estimates before 2012 are extrapolations without direct VIIRS validation. This is not a forecasting or emergency-response service.

Built with React, TypeScript, Vite, Zod, Leaflet, and Python's standard library. Codex assisted with implementation and documentation. Human review of code, interface, and scientific claims is required before submission; no empirical scientific results have been produced by AI here. Project license remains to be selected by the team.

## Project language

English is the working language for the interface, accessibility labels, CLI output, tests, documentation, commit messages, and pull requests. Run `npm run language:check` before submitting changes; CI checks common Portuguese regressions. Documents specifically addressed to André under `docs/handoff/` may remain in Portuguese; proper names such as André and Pantanal retain their spelling. The Portuguese README has been retired under the current English-only requirement.
