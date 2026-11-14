# Optional MapBiomas 2020 context

The Pantanal raw-map view now offers an **opt-in annual land-cover background**:
MapBiomas Collection 11, **2020**, 30 m, coverage asset **v3**. It is deliberately
separate from the optional daily MODIS Terra image. Enabling either background
disables the other; the dark basemap and detection records remain independent.

This layer adds landscape context to the August 2020 batch. It does not measure
thermal activity, daily clear-sky/orbital coverage or burned area, and it does not
assign a land-cover class to individual detections. It does not alter raw records,
scientific approvals, the fixture calendar or comparison chart.

## Identity and legend

The fixed public Earth Engine source identifier is:

```text
projects/mapbiomas-public/assets/brazil/lulc/collection11/mapbiomas_brazil_collection11_coverage_v3
```

The adapter checks the provider's public subtheme definition before requesting a
map: expected subtheme ID/key, public annual product, `col. 11` badge, exact asset
identifier, `classification_{year}` band convention, 30 m scale and availability of
2020. It separately checks the legend's binding and every one of its 33 English
leaf-class labels, numeric values and colors against the recorded reference.
A changed product/legend is rejected rather than silently displayed as the old
collection. This verifies the provider's declared identity, not every raster pixel.

The expandable class legend matches the requested leaf classes. Source attribution,
collection, year, resolution and access date are shown. MapBiomas publishes the
source under CC-BY; the provider platform link and attribution remain available.
IBGE class codes and MapBiomas class codes are not treated as interchangeable.

## Public service access and temporary tiles

The adapter uses the publicly readable MapBiomas platform API at
`https://prd.plataforma.mapbiomas.org/api/v1/brazil/`, with the public routing header
`tenant-id: mapbiomas`. This header selects the public project; it is not an API key.
Requests omit credentials and use CORS. Anonymous access from the application
origin was verified during development. No login, Earth Engine credentials or
backend service was added.

The metadata/legend requests are followed by a map request for territory `1-4-6`
(Pantanal / IBGE 2025), fixed year 2020 and all pinned leaf classes. Only HTTPS tile
templates on the expected MapBiomas Earth Engine project are accepted. Temporary
tile addresses are fetched on demand, not committed, placed in the selection URL
or written to application storage. API responses use `no-store`; each retry obtains
a new map session. The ordinary browser/provider image cache is not controlled by
this application.

This is a live platform adapter, not an archived raster export or a guaranteed
public API SLA. Provider schema, availability and rate limits can change. The
identity guards and clear failure state preserve correctness when that happens.
The raw map works without the context service. The loader has a request timeout
and abort cleanup; no background polling or automatic retry loop is used.

## Controls and failure behavior

- Select **Pantanal · IBGE 2025**, then enable **Land cover 2020 · MapBiomas**.
- An opacity control keeps points and the reference boundary readable.
- `raw_landcover=1` records intent only; temporary tile URLs never enter history.
- The option is unavailable in the national view or outside the delivered 2020
  context window. Invalid deep links fall back with the existing correction notice.
- Back/Forward restores intent. Changing to Brazil removes the context layer and
  attribution; returning through history can request a fresh session.
- Provider failure, identity mismatch or expired/unavailable tiles produces a
  context-only message and retry/open-provider actions. Loaded detection records,
  table, source/date controls and the scientific missing-data rules are unchanged.
- Individual detection points get a darker outline against the colored background.
  Their size still does not represent FRP or burned area.

## Verification

Unit tests use a sanitized English snapshot of public provider metadata and mock
network responses. They cover silent source/year/scale/legend changes, URL
allowlisting, fixed year/class requests, credential omission, fresh sessions,
cancellation, failures and independent selection state. CI makes no live MapBiomas
requests.

Chromium against a production preview verified actual public tiles, attribution,
opacity/keyboard control, desktop/390px layout, history, background exclusivity,
country cleanup and context failure isolation. Screenshots are under
`docs/mapbiomas-context/`. Physical-device QA and deployed-commit review remain team
tasks; successful tile loading does not approve any scientific coverage method.
