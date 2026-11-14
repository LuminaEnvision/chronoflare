# External-source integration

## NASA GIBS: public visual context

The Map view loads Leaflet and public NASA GIBS tiles on demand. No key, authentication, backend, or fire-data API call is involved.

Configuration is defined in `app/src/data/gibs.ts`:

- Layer: `MODIS_Terra_CorrectedReflectance_TrueColor`.
- Projection: EPSG:3857.
- Tile matrix: `GoogleMapsCompatible_Level9`, zoom capped at 9.
- Date: the selected UTC calendar date, explicitly included in every tile request.
- Endpoint: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/`.

The approximate starting camera is centered on the Pantanal region. It does **not** define or confirm the scientific AOI. No AOI polygon or fire overlay is invented. Imagery gaps, cloud cover, and a successful HTTP response do not establish fire-observation coverage. The imagery date uses UTC; it is not the pipeline's local solar date. The background always uses MODIS Terra even if the activity base is VIIRS, and the UI states this separation.

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

The authenticated path has been tested using mocked responses only; no live FIRMS download has been verified in this session. The script exits with a clear setup error when no key is configured. Automated tests never contact NASA or require credentials.

### What this does not perform

No filtering by scientific confidence, vegetation-source classification, deduplication, local-solar-day conversion, platform combination, H3 aggregation, baseline/anomaly computation, calibration, or approval is done here. Those decisions remain with André. Raw downloads are not a replacement for the [scientific delivery contract](data-handoff.md), nor are they automatically promoted to `data_status=real`.

Primary documentation: [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/) and [FIRMS archive downloads](https://firms.modaps.eosdis.nasa.gov/download/).
