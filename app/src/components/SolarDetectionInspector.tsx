import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  groupReviewPoints,
  checkedAsset,
  reviewBoundarySchema,
  type DatedReviewPoint,
} from "../data/detection-review";
import {
  locationSearch,
  navigateSolar,
  solarSelection,
  subscribeLocation,
  type SolarPlatform,
  type SolarPreview,
} from "../data/experimental-solar";
import {
  loadSolarRecords,
  recordId,
  type SolarRecord,
} from "../data/solar-records";

const pageSize = 15;
export default function SolarDetectionInspector({
  preview,
  platform,
  day,
  filtered,
}: {
  preview: SolarPreview;
  platform: SolarPlatform;
  day: string;
  filtered: boolean;
}) {
  const [rows, setRows] = useState<SolarRecord[]>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(0);
  const { record: selectedId } = solarSelection(
    useSyncExternalStore(subscribeLocation, locationSearch),
  );
  const selectRecord = useCallback(
    (id: string) => navigateSolar({ solar_record: id }),
    [],
  );
  const [selectedOnly, setSelectedOnly] = useState(filtered);
  // Reset table state synchronously when the parent selection changes.
  if (selectedOnly !== filtered) {
    setSelectedOnly(filtered);
    setPage(0);
  }
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    loadSolarRecords(preview, platform, day, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setRows(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error && error.message.includes("HTTPS")
              ? error.message
              : "Source records could not be loaded or failed integrity checks. The calendar remains available.",
          );
      });
    return () => controller.abort();
  }, [preview, platform, day, attempt]);
  const visible = useMemo(
    () => rows?.filter((row) => !filtered || row.candidate_quality_pass) ?? [],
    [rows, filtered],
  );
  const selected = visible.find((row) => recordId(row) === selectedId);
  useEffect(() => {
    const index = visible.findIndex((row) => recordId(row) === selectedId);
    if (index >= 0) setPage(Math.floor(index / pageSize));
  }, [visible, selectedId]);
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  if (error)
    return (
      <div className="notice" role="alert">
        <p>{error}</p>
        <button onClick={() => setAttempt((value) => value + 1)}>
          Retry source records
        </button>
      </div>
    );
  if (!rows)
    return <p role="status">Loading and verifying exact source records…</p>;
  return (
    <div className="solar-inspector">
      <p className="review-warning">
        <strong>Exact API snapshot · unreviewed.</strong> This inspector uses
        the selected solar day and platform, including UTC padding. The main Map
        view retains the earlier delivery. Grouped points are for display, not
        individual fire events.
      </p>
      <p role="status" className="solar-record-count">
        {visible.length.toLocaleString("en-US")} source records · {platform} ·
        solar {day} ·{" "}
        {filtered ? "proposed filter, unapproved" : "all detections"}
      </p>
      {visible.length ? (
        <RecordMap
          platform={platform}
          rows={visible}
          select={selectRecord}
          selected={selected}
        />
      ) : (
        <p>
          No positive records in this selection. This does not establish zero
          fire or complete observation coverage.
        </p>
      )}
      {selected && (
        <section className="solar-source-detail" aria-live="polite">
          <h3>Selected source record</h3>
          <dl className="solar-details">
            <div>
              <dt>Acquired UTC</dt>
              <dd>{selected.acquired_at_utc}</dd>
            </div>
            <div>
              <dt>Solar date / platform</dt>
              <dd>
                {day} / {platform}
              </dd>
            </div>
            <div>
              <dt>FRP</dt>
              <dd>{selected.frp_mw.toLocaleString("en-US")} MW</dd>
            </div>
            <div>
              <dt>Confidence / source type</dt>
              <dd>
                {selected.confidence_raw} / {selected.source_type ?? "Missing"}
              </dd>
            </div>
            <div>
              <dt>Proposed filter</dt>
              <dd>
                {selected.candidate_quality_pass
                  ? "Selected · unapproved"
                  : `Excluded: ${selected.candidate_quality_reasons.map((value) => value.replaceAll("_", " ")).join(", ")}`}
              </dd>
            </div>
            <div>
              <dt>CSV data row (1-based)</dt>
              <dd>
                {selected.source_record.toLocaleString("en-US")} ·{" "}
                {selected.request_id}
              </dd>
            </div>
          </dl>
          <p>
            CSV SHA-256: <code>{selected.source_file_sha256}</code>
          </p>
          <p>
            Coordinates: {selected.latitude}, {selected.longitude}. Coverage
            unknown; overpasses not measured.
          </p>
        </section>
      )}
      <h3>Inspect without the map</h3>
      <div
        className="solar-record-table"
        tabIndex={0}
        role="region"
        aria-label="Scrollable solar source record table"
      >
        <table>
          <caption>
            Source rows for {platform}, solar {day}.{" "}
            {filtered
              ? "Proposed filter is unapproved."
              : "All recorded confidence classes and source types."}
          </caption>
          <thead>
            <tr>
              <th>UTC acquisition</th>
              <th>FRP (MW)</th>
              <th>Confidence</th>
              <th>Source type</th>
              <th>CSV data row</th>
            </tr>
          </thead>
          <tbody>
            {visible
              .slice(page * pageSize, (page + 1) * pageSize)
              .map((row) => (
                <tr key={recordId(row)}>
                  <td>{row.acquired_at_utc}</td>
                  <td>{row.frp_mw.toLocaleString("en-US")}</td>
                  <td>{row.confidence_raw}</td>
                  <td>{row.source_type ?? "Missing"}</td>
                  <td>
                    <button
                      aria-pressed={selectedId === recordId(row)}
                      onClick={() => selectRecord(recordId(row))}
                    >
                      Inspect row {row.source_record.toLocaleString("en-US")}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="solar-record-pagination">
        <button
          disabled={page === 0}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous records
        </button>
        <label>
          Page
          <input
            aria-label="Solar source table page"
            type="number"
            min={1}
            max={pages}
            value={page + 1}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isInteger(next) && next >= 1 && next <= pages)
                setPage(next - 1);
            }}
          />
        </label>
        <span>of {pages}</span>
        <button
          disabled={page + 1 >= pages}
          onClick={() => setPage((value) => value + 1)}
        >
          Next records
        </button>
      </div>
    </div>
  );
}

function RecordMap({
  platform,
  rows,
  select,
  selected,
}: {
  platform: SolarPlatform;
  rows: SolarRecord[];
  select: (id: string) => void;
  selected?: SolarRecord;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [zoom, setZoom] = useState(6);
  const [basemap, setBasemap] = useState("Loading basemap…");
  const [boundaryStatus, setBoundaryStatus] = useState(
    "Loading IBGE reference outline…",
  );
  const coordinates = rows.map(
    (row) => [row.latitude, row.longitude] as L.LatLngTuple,
  );
  useEffect(() => {
    const value = L.map(container.current!, {
      preferCanvas: true,
      zoomAnimation: false,
    }).setView([-18.5, -56.5], 6);
    const controller = new AbortController();
    checkedAsset(
      {
        path: "pantanal/boundary.json",
        sha256:
          "474e762695516c78f1f63749b6dcf787601ee9a692766484a167cd1c67983e9c",
        bytes: 1333702,
      },
      controller.signal,
    )
      .then((raw) => {
        const boundary = reviewBoundarySchema.parse(raw);
        if (!controller.signal.aborted) {
          L.geoJSON(boundary, {
            interactive: false,
            style: { color: "#267b67", weight: 2, fillOpacity: 0.04 },
            attribution:
              'Boundary: <a href="https://geoftp.ibge.gov.br/informacoes_ambientais/estudos_ambientais/biomas/vetores/">IBGE 2025</a>',
          }).addTo(value);
          setBoundaryStatus("IBGE 2025 outline verified.");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setBoundaryStatus(
            "Reference outline unavailable; records remain available.",
          );
      });
    map.current = value;
    layer.current = L.layerGroup().addTo(value);
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 18,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    ).addTo(value);
    tiles.on("tileload", () =>
      setBasemap("Basemap loaded; detections remain unreviewed."),
    );
    tiles.on("tileerror", () =>
      setBasemap(
        "Basemap unavailable; source points and table remain available.",
      ),
    );
    const update = () => setZoom(value.getZoom());
    value.on("zoomend", update);
    value.fitBounds(L.latLngBounds(coordinates), {
      padding: [25, 25],
      maxZoom: 10,
      animate: false,
    });
    return () => {
      controller.abort();
      tiles.off("tileload tileerror");
      value.off("zoomend", update);
      value.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const dated: DatedReviewPoint[] = rows.map((row, index) => ({
      date: row.acquired_at_utc.slice(0, 10),
      point: [
        index,
        row.longitude,
        row.latitude,
        row.acquired_at_utc.slice(11),
        platform,
        row.frp_mw,
        row.confidence_raw,
        row.source_type,
      ],
    }));
    for (const group of groupReviewPoints(dated, zoom)) {
      const marker = L.circleMarker([group.latitude, group.longitude], {
        radius:
          group.rows.length > 1
            ? Math.min(22, 7 + Math.log2(group.rows.length))
            : 5,
        weight: 1,
        color: "#183e43",
        fillColor: "#e97833",
        fillOpacity: 0.8,
      });
      const tooltip = document.createElement("span");
      tooltip.textContent =
        group.rows.length > 1
          ? `${group.rows.length} records; zoom to inspect`
          : `${rows[group.rows[0].point[0]].frp_mw} MW · click to inspect source row`;
      marker.bindTooltip(tooltip);
      marker.on("click", () => {
        if (group.rows.length === 1)
          select(recordId(rows[group.rows[0].point[0]]));
        else
          map.current?.fitBounds(
            L.latLngBounds(
              group.rows.map((row) => [row.point[2], row.point[1]]),
            ),
            { maxZoom: 12, padding: [25, 25], animate: false },
          );
      });
      marker.addTo(layer.current);
    }
  }, [rows, zoom, select, platform]);
  useEffect(() => {
    if (selected)
      map.current?.setView(
        [selected.latitude, selected.longitude],
        Math.max(10, map.current.getZoom()),
        { animate: false },
      );
  }, [selected]);
  return (
    <>
      <button
        onClick={() =>
          map.current?.fitBounds(L.latLngBounds(coordinates), {
            padding: [25, 25],
            maxZoom: 10,
            animate: false,
          })
        }
      >
        Fit selected records
      </button>
      <p role="status">
        {basemap} {boundaryStatus}
      </p>
      <div
        className="solar-record-map"
        ref={container}
        role="region"
        aria-label="Map of exact solar-day source records. The table provides keyboard inspection."
      />
      <p>
        Display grouping only. The basemap and reference outline provide
        geographic context; observation coverage remains unknown.
      </p>
    </>
  );
}
