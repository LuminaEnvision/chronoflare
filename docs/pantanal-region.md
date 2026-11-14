# Brazil / Pantanal raw-map views

The detection explorer now offers two **independent raw-data views**:

- **Brazil download** (default): all 204,919 supplied records, with national files unchanged.
- **Pantanal · IBGE 2025**: 6,779 MODIS and 26,464 S-NPP point centres inside or exactly
  on the official 2025 reference boundary. These are 33,243 records, not fire events.

The region selector participates in `raw_region=brazil|pantanal` URL state,
Back/Forward, source/date/platform filters and view switching. Calendar and chart
fixtures remain separate. Selecting the region never approves scientific coverage,
zero generation, calibration, unique events or burned area.

## Offline derivation

```sh
python3 -m pip install -r science/requirements.txt
python3 science/scripts/prepare_pantanal_review.py \
  --national science/outputs/detection-review-national \
  --archive science/outputs/2025_Biomas-e-Sistema-Costeiro-Marinho-do-Brasil-1-250000_shp.zip \
  --output science/outputs/detection-review-with-pantanal
```

Start with the national-only package from `export_detection_review.py`. The region
builder accepts only the pinned official archive:

- Institution/edition: IBGE 2025, [official download](https://geoftp.ibge.gov.br/informacoes_ambientais/estudos_ambientais/biomas/vetores/2025_Biomas-e-Sistema-Costeiro-Marinho-do-Brasil-1-250000_shp.zip).
- SHA-256: `247b15c427070805044ebe02012f15552850d535fbfecaddb359875cdda1ea8f`.
- Layer: `lml_bioma_e250k_v20250911_A`; exact feature selection
  `CD_BIOMA=6; NM_BIOMA=Pantanal`.
- Source CRS: SIRGAS 2000, EPSG:4674. Output: WGS84 longitude/latitude (CRS84), via
  the recorded EPSG operation, with 1 m stated transformation accuracy.

The original polygon is valid and has 32,918 vertices. No geometry repair,
simplification, snapping or generated boundary is applied to the exported data.
Point inclusion uses planar longitude/latitude predicates after transformation:
strict interiors and exact boundary points are included, with **no buffer or
numerical tolerance**. Boundary records are counted in source metadata. This is
not a pixel-footprint intersection or an assessment of positional certainty.
Cartographic scale, input geolocation/rounding and transformation accuracy limit
interpretation near the boundary. The reference edition stays fixed across dates.

The builder verifies every national asset hash, byte count, source/date metadata,
record reference and total. Selected point tuples are copied without changing
coordinates, timestamps, FRP, confidence, type or original CSV record number.
Coincident or technically repeated detections are retained. National bytes are
copied unchanged; corrupt or unsupported input aborts without a completed package.
Existing outputs, frontend/dist targets and source-package subdirectories are
rejected. Processing is offline; Python dependencies are pinned and no service
credentials are required.

Review the result before replacing the frontend package. The root remains the
national `brazil_download` contract with `aoi_status=not_applied` for that national
view; its optional `pantanal` descriptor contains the reference provenance,
boundary asset, regional counts and day files. Old national-only manifests still
load, with the Pantanal option disabled. Do not interpret the root field as the
status of the explicitly selected regional view.

## Frontend behavior

The browser validates regional paths/counts/provenance against the national
manifest and the pinned reference hash. It fetches only the selected scope/source/
days and, for Pantanal, the hashed boundary. The cyan dashed outline is labeled
**IBGE 2025 reference boundary**. Its official download and source hash are visible
in the provenance panel. `Fit boundary` and `Fit detections` have distinct purposes.

Changing scope clears mismatched selections and loads the corresponding data;
failed/corrupt regional files do not leave national points mislabeled as Pantanal.
Returning to Brazil removes the boundary layer and its attribution. Empty subsets
remain records-with-unknown-coverage, not observed zeros. All matched records are
accessible through the table, including points overlapping visually.

## Scientific and source status

The source is verified, the reference filter is implemented, and the observations
remain **unreviewed**. `science/configs/decisions.json` is unchanged. A scientific
aggregate still requires reviewed quality, coverage, platform/date rules and
approval. No value is calculated from the shape or copied from the old Gemini
polygon. The earlier 6,660/26,179 counts were relative to that unsupported geometry
and have not been relabeled as results from the official boundary.

MapBiomas Collection 11 / 2020 remains a proposed historical context layer, not
integrated. The MMA link is a separately documented historical deforestation
resource (2002–2008); its archive contents have not been verified or integrated.
Neither product is evidence that a sensor observed the AOI on a given day. See
[source review](geographic-sources-review.md) and [coverage review](coverage-delivery-review.md).

## Checks

Tests verify exact regional/national tuple correspondence, source hashes, region
URL fallback, source/total/path mismatches, holes/edges/coincident detections,
no-overwrite and corrupt-source rollback. Browser checks cover scope/source/date
switching, history, boundary attribution, keyboard/mobile inspection and corrupt
boundary retry. Physical-device and deployed-version QA remain team tasks.
