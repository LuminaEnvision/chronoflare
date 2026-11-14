# External-source integration

## NASA GIBS: public visual context

The Map view loads Leaflet on demand, with an OpenStreetMap basemap restyled for contrast. An optional NASA GIBS context layer needs no key or authentication. Detection points come from separate local static [review assets](detection-explorer.md), not an authenticated browser API. OpenStreetMap attribution is retained; neither map provider validates the detections.

Configuration is defined in `app/src/data/gibs.ts`:

- Layer: `MODIS_Terra_CorrectedReflectance_TrueColor`.
- Projection: EPSG:3857.
- Tile matrix: `GoogleMapsCompatible_Level9`, native zoom capped at 9 (overzoomed for map inspection).
- Date: the end of the review map’s inclusive UTC range, explicitly included in every tile request. This is independent of the calendar.
- Endpoint: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/`.

The approximate starting camera shows Brazil. It does **not** define or confirm the scientific AOI. No Pantanal polygon is drawn; the raw detection overlay retains all supplied national records. Imagery gaps, cloud cover, and a successful HTTP response do not establish fire-observation coverage. The imagery date uses UTC; it is not the pipeline's local solar date. The optional imagery always uses MODIS Terra even if the activity base is VIIRS, and the UI states this separation.

The published capabilities identify the product from 2000-02-24, with gaps. The frontend rejects invalid, pre-product and future dates, but does not infer availability for each pixel/day. Tile failures show a retry state. A blank successful tile remains possible and is explained in the interface. If the service is unavailable, the calendar continues to work.

Run `npm run sources:check` with Node.js 24.5+ for an explicit public-network smoke check. The Node `--use-env-proxy` option honors local proxy configuration; it is not part of the browser bundle. A sample tile returned HTTP 200 with JPEG content during development on 2026-11-14. This is not a browser visual test or an assurance of complete imagery coverage.

Primary documentation: [GIBS access basics](https://nasa-gibs.github.io/gibs-api-docs/access-basics/) and [current EPSG:3857 capabilities](https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml).

## NASA FIRMS: offline Standard Processing downloads

`science/scripts/firms_download.py` downloads **one** bounded Area API request. Python 3.12+ is recommended; only standard-library modules are used.

Supported sources: `MODIS_SP`, `VIIRS_SNPP_SP`, `VIIRS_NOAA20_SP`, `VIIRS_NOAA21_SP`. This client deliberately excludes NRT. Availability and collection details must be confirmed by André; listing a source does not promise data for every requested date.

### Configure authentication locally

Request a free MAP_KEY through the official [FIRMS Area API page](https://firms.modaps.eosdis.nasa.gov/api/area/). Set `FIRMS_MAP_KEY` in the shell environment that runs the Python command. For example, in Bash, enter it interactively rather than placing it in shell history:

```sh
read -rsp "FIRMS MAP_KEY: " FIRMS_MAP_KEY
export FIRMS_MAP_KEY
```

`.env.example` documents the variable. The Python client does **not** automatically load `.env` files. Never use a `VITE_` prefix, put the key in a URL shared with the team, commit it, or add it to browser code. No key is needed for the Vercel frontend.

### Request a small pilot window

```sh
python3 science/scripts/firms_download.py \
  --source MODIS_SP \
  --bbox=-58,-20,-54,-16 \
  --start 2025-09-01 \
  --days 1 \
  --output science/outputs/modis-sp-2025-09-01
```

The bounding box above is an **illustrative request window**, not a confirmed Pantanal boundary. Coordinates are west,south,east,north. The API accepts 1–5 days per request and the client requires explicit dates. The returned range is start through start + days − 1, inclusive in UTC. The client does not cross the antimeridian, retry automatically, query the world, or loop over historical years. Confirm availability and quotas before requesting additional windows. For long historical records, André should evaluate the FIRMS archive workflow rather than blindly issuing many Area API calls.

The output directory must be new. It receives:

- `detections.csv`: original response bytes, unchanged.
- `provenance.json`: source/SP, requested UTC dates and bbox, retrieval timestamp, SHA-256, response size and row count. Collection remains null until verified; science is `unreviewed` and coverage is `unknown`.

Raw files under `science/outputs/` are Git-ignored. The client rejects outputs inside `app/` and `dist/`, refuses existing output directories, checks CSV columns, numeric/date/coordinate constraints, caps responses at 25 MiB, and avoids logging credential-bearing URLs or provider error bodies. API redirects are rejected. A header-only CSV means zero returned rows, **not** proof of zero fire or adequate observation coverage.

The authenticated path passed a live GitHub Actions test on November 14, 2026: MODIS_SP returned seven detections for August 10, 2020 in a small Pantanal bounding box. Historical Area API access therefore worked for that source/date; availability of other requests still requires validation. The script exits with a clear setup error when no key is configured. Automated tests never contact NASA or require credentials.

### What this does not perform

No filtering by scientific confidence, vegetation-source classification, deduplication, local-solar-day conversion, platform combination, H3 aggregation, baseline/anomaly computation, calibration, or approval is done here. Those decisions remain with André. Raw downloads are not a replacement for the [scientific delivery contract](data-handoff.md), nor are they automatically promoted to `data_status=real`.

Primary documentation: [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/) and [FIRMS archive downloads](https://firms.modaps.eosdis.nasa.gov/download/).

## After downloading: technical intake

Pass a local SP CSV and its optional provenance file to `science/scripts/normalize_detections.py`. The [raw-ingestion guide](raw-ingestion.md) explains supported columns, preserved raw values, integrity checks, and the intermediate output format. Normalization does not approve the data, infer coverage, filter by confidence/type, or create frontend aggregates.

## Repository-secret API smoke test

Set the repository Actions secret `FIRMS_MAP_KEY`. After merging the workflow,
open **Actions → Test NASA FIRMS API access → Run workflow**. Its initial merge
also triggers the test. It requests one historical MODIS SP day (August 10,
2020), bounded to −57,−19,−56,−18, then validates the CSV schema, coordinates and
dates. Availability is tested rather than assumed. A provider rejection fails
the job with a sanitized error; the existing client rejects redirects.

Only the count and CSV hash enter the job summary. The key is scoped to the
request step, no raw-data artifacts are uploaded, and temporary files are removed.
An empty valid CSV proves request success only, not observation coverage. This
workflow neither updates the public data nor schedules production ingestion.

## Vercel secret storage

In the Vercel project, use **Settings → Environment Variables → Add Environment
Variable**. Add `FIRMS_MAP_KEY` as a sensitive variable where that option is
available. Select Production and only trusted Preview/Development environments
that need authenticated server execution. Do not use a `VITE_` prefix or copy
the value into source files, build commands, logs, screenshots or pull requests.

The current application is a static Vite frontend. Storing this variable does
not enable FIRMS fetching, and frontend code must not read it. A future server
function or ingestion job needs to consume it explicitly. For that future
consumer, deploy after changing environment variables so the new deployment
receives the configuration. No redeploy is required solely to enable the
GitHub Actions test, which uses the separate repository secret.

For the six-request historical reconciliation and solar audit, see the
[historical pilot guide](firms-pilot-ingestion.md).
