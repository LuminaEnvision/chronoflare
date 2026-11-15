# ChronoFlare — MapBiomas 2020 context delivery

> **Historical/stage-specific record.** This page preserves the facts, test counts and remaining work of its original delivery. It is not the current project approval or feature checklist. See [current validation and scope](../../validation-report.md) and the [documentation index](../../README.md). Any associated dated PDF/Word remains that historical snapshot.

**Updated:** November 14, 2026. This checkpoint follows merged PR #23's official
Pantanal reference filter. It adds landscape context without changing the raw
records, geographic subset, calendar fixtures or scientific approval state.

## Delivered

The Pantanal view can display optional **MapBiomas Collection 11, 2020, 30 m**
land-cover classification beneath the detection points and IBGE 2025 outline.
Opacity and the full English class legend are available. The option is off by
default and unavailable outside the 2020 Pantanal context. NASA satellite imagery
and the land-cover background are mutually exclusive, with intent preserved in
URL/history state through `raw_landcover`.

| Decision | Reason | Limit |
|---|---|---|
| Use 2020 rather than the supplied link's 2025 | Match the year of the August 2020 FIRMS records | Annual classification is not daily land condition or fire activity |
| Fix Collection 11 coverage v3 | Keep source identity reviewable | Provider definition/legend changes disable the layer pending review |
| Optional live public adapter | Actual public API and browser CORS access were verified without login | No guaranteed API SLA; context failure must not affect raw detections |
| Request a fresh temporary tile session | Avoid committing an expiring Earth Engine address | App does not write sessions to configuration/history/application storage |
| Separate image/classification controls | Avoid overlapping different kinds of background | Both remain contextual and are not coverage evidence |

The public asset ID, subtheme binding, year availability, band format, 30 m scale
and all 33 leaf-class values/colors/English labels are checked before a map request.
Tile addresses must match the expected HTTPS Earth Engine project. Only public
routing metadata is sent; requests omit credentials. There is no backend, login,
API key or new application dependency.

## What this does not calculate

No land-cover class is assigned to a detection. No fire event, burned area,
cloud-free observation, sensor overpass, coverage fraction, baseline, calibration
or anomaly is inferred. National and regional record counts remain 204,919 and
33,243 respectively. The calendar/chart remain synthetic fixtures.

The new coverage v1.1 documents are scientific inputs for a separate review and
implementation step. They do not change the meaning of this contextual layer.

## Verification

- 90 TypeScript tests passed, including recorded-provider metadata validation,
  silent identity/legend changes, unsafe tile URLs, fixed year/class requests,
  anonymous/no-store fetching, fresh sessions, aborts and independent URL state.
- Production TypeScript/Vite build, English language and whitespace checks passed.
- Chromium production-preview tests loaded actual public tiles and checked source
  attribution, desktop/390px layout, opacity keyboard use, background exclusivity,
  country cleanup and Back/Forward restoration without JavaScript page errors.
- An injected provider HTTP 503 left the records/table and return to the fixture
  calendar usable. No live provider calls are made in CI; full CI also runs the
  unchanged Python science suite.

Screenshots are in `docs/mapbiomas-context/`. A passing preview is not physical-device
QA, production deployment certification or independent raster-accuracy validation.

## Remaining work and roles

- Engineering: review CI/PR, preserve the source/legend identity guards and implement
  the separately accepted solar-time convention without silently activating
  unverified outages or coverage zeros.
- André: scientific coverage/classifier alignment and event references remain
  separate from annual land cover. The v1.1 responses are under engineering review.
- Anastasia: review the integrated deployed journey and small-screen controls after
  pulling the merged version; keep visual fixes scoped and source labels intact.
- Project owner: merge the reviewable change and verify the deployed commit.

Full technical contract: `docs/mapbiomas-context.md`. Earlier implementation and
source reports remain available as dated checkpoints.
