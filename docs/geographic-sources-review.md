# Verified IBGE and MapBiomas geographic sources

**Reviewed:** November 14, 2026. This supplements the implementation report after
merged PRs #20 and #21. No map filters, scientific approvals or public detection
artifacts are changed by this source review.

## Findings

| Resource | Verified meaning | Suitable role |
|---|---|---|
| Supplied IBGE land-cover PDF and SHP archive | Official land-cover/use ecosystem accounts for 2000–2018; supplied bytes exactly match the catalogue's official downloads | Historical land-cover context and optional class analysis, not orbital/cloud observation coverage |
| IBGE biome vector, 2019 archive | Valid Pantanal feature selected by `Bioma=Pantanal`, `CD_Bioma=6` | A traceable detailed candidate AOI, with its edition fixed |
| IBGE biome vector, 2025 archive | Valid Pantanal feature selected by `NM_BIOMA=Pantanal`, `CD_BIOMA=6` | Recommended current boundary candidate; matches the territory reference used by the supplied MapBiomas view |
| Supplied MapBiomas view | Coverage 30m, Collection 11, annual 1985–2025; selected year 2025; Pantanal territory using IBGE 2025 biomes | Land-cover context; select **2020** for the FIRMS August 2020 batch |

Source verification and pilot/method approval are separate. The old Gemini polygon
is not rehabilitated by finding these official products. It remains unsupported.
The national map remains valid without that polygon.

## 1. Exact verification of the supplied IBGE files

The live [IBGE catalogue entry](https://portaldemapas.ibge.gov.br/portal.php#mapa223032)
identifies the 2018 Pantanal land-cover map and directly links both files. Both were
independently downloaded from the official HTTPS server and compared byte for byte:

- [PDF](https://geoftp.ibge.gov.br/informacoes_ambientais/estatisticas_e_indicadores_ambientais/contas_economicas_ambientais/contas_de_extensao_dos_biomas/2000_2018/mapas/cobertura_uso_terra_pantanal_2018.pdf):
  SHA-256 `0624db2beaef6051195263d830aee59416c771c824affda0a6140226ecbdf75d`.
- [Vector ZIP](https://geoftp.ibge.gov.br/informacoes_ambientais/estatisticas_e_indicadores_ambientais/contas_economicas_ambientais/contas_de_extensao_dos_biomas/2000_2018/vetores/Cobertura_uso_terra_Pantanal_2000-2018.zip):
  SHA-256 `8746cdc4b1adb37001df27782206ab077c8ea8f8159053c336895134575755c6`.

The SHP contains **150,989 valid polygons**, each a full four-sided grid cell, with
classification fields `USO2000`, `USO2010`, `USO2012`, `USO2014`, `USO2016`, `USO2018`.
The native CRS is **SIRGAS 2000, EPSG:4674**, not a file already declared as WGS84.

An exact dissolve, without repair/snapping/simplification, yields four polygon
parts, no holes, 6,044 boundary vertices and approximately **150,989.000 km²** using
the native GRS80 geodesic calculation. This is the **grid footprint**. Its stepped
cell boundary is not automatically the detailed biome perimeter. The PDF's
1:3,000,000 printed map scale is not the grid's cell resolution.

## 2. The actual biome boundary was also located

The official [IBGE biome vector directory](https://geoftp.ibge.gov.br/informacoes_ambientais/estudos_ambientais/biomas/vetores/)
contains separate, purpose-built biome archives:

- [2019-hosted archive: Biomas_250mil.zip](https://geoftp.ibge.gov.br/informacoes_ambientais/estudos_ambientais/biomas/vetores/Biomas_250mil.zip),
  SHA-256 `1d8a4d860d9c203b10ef41dd0701ced2e389ad86442e23a815a7cccdc98ca0c5`.
- [2025 biome archive](https://geoftp.ibge.gov.br/informacoes_ambientais/estudos_ambientais/biomas/vetores/2025_Biomas-e-Sistema-Costeiro-Marinho-do-Brasil-1-250000_shp.zip),
  SHA-256 `247b15c427070805044ebe02012f15552850d535fbfecaddb359875cdda1ea8f`.

Both contain a valid **Pantanal Polygon with 32,918 vertices and one ring**, native
EPSG:4674. The calculated native geodesic area is approximately **150,961.062 km²**.
This calculated value is not substituted for an institution's published area
statistic: projection/measurement conventions can differ. The two editions have
very close coordinates but are not byte-identical; keep one edition fixed and
record its hash rather than silently switching versions.

A local delivery package extracts only the 2025 Pantanal feature while preserving
the original SHP geometry and CRS. A separate GeoJSON uses the recorded
`SIRGAS 2000 to WGS 84 (1)` EPSG operation with longitude/latitude output and stated
1 m operation accuracy. No boundary is generated, repaired or simplified. Its
provenance records the official URL/archive hash and exact feature selection.
This candidate is not added to the public app or declared scientifically approved
by this documentation change.

**The missing source can now be supplied directly. André does not need to generate
another polygon or locate this file manually.**

## 3. What the MapBiomas link actually selects

The live [MapBiomas platform](https://plataforma.mapbiomas.org/projects/mapbiomas/brazil)
was inspected in Chromium with the supplied theme/year/territory configuration. It
showed:

- **Coverage 30m, Collection 11**, annual maps for **1985–2025**.
- Selected **2025**, territory **Pantanal**, reference **Biome (IBGE, 2025)**.
- Land-cover classes, areas and annual time series, not satellite overpasses or
  cloud-free observation fractions.
- The platform's informational note updated **08/2026**, linking its
  [published methodology site](https://brasil.mapbiomas.org/)
  and accuracy analysis. This verifies the displayed product/configuration, not
  every pixel's accuracy.

For the August 2020 FIRMS batch, use the **2020 classification from that collection**
if a context layer is added. Do not describe a 2025 classification as the state of
the ground during 2020. Keep classification year and boundary edition explicit;
a fixed 2025 biome definition can be used as a constant region if selected and
reviewed, independently of the classification's year.

The platform is interactive, not a stable raw-data endpoint. Integration must pin
collection/year/class legend and use an official export or documented data asset;
do not persist a temporary Earth Engine tile token as a permanent data source.
Preserve the source attribution specified by MapBiomas.

## 4. Integration decisions to preserve

1. Boundary: propose the official **IBGE 2025 Pantanal** feature, with source/hash/CRS
   recorded and scope reviewed. Do not reuse the earlier generated geometry.
2. Context: prefer **MapBiomas Collection 11, 2020, 30 m** for the 2020 FIRMS batch;
   IBGE 2018 remains a separately labeled historical reference.
3. Do not equate numeric classes between IBGE and MapBiomas. They require separate
   legends and a reviewed crosswalk before combined statistics.
4. A point's land-cover context is not proof of the entire thermal pixel's burned
   land-cover class. MODIS/VIIRS and 30 m classification have different footprints.
5. None of these land-cover products establishes same-day orbital coverage,
   cloud-free observation or permission to infer zero fire activity. Coverage
   delivery 2 still needs its separate evidence/contract clarifications.
6. The map remains the full national unreviewed detection explorer until a deliberate
   regional-layer change is implemented and reviewed. No UI integration is claimed
   here. The scientific decision file is unchanged.

Machine-readable evidence and source hashes are in
`science/configs/geographic_sources.review.json`. Raw downloads, grid union and
candidate geometry remain offline, outside frontend assets. Existing calendar,
comparison-chart and detection-map contracts are unaffected.
