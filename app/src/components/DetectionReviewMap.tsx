import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { gibsTileUrl, GIBS_MAX_ZOOM } from "../data/gibs";
import {
  groupReviewPoints,
  loadReviewManifest,
  loadReviewPoints,
  resolveReviewSelection,
  reviewSelectionSearch,
  type DatedReviewPoint,
  type ReviewManifest,
  type ReviewSelection,
} from "../data/detection-review";

const subscribe = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};
const snapshot = () => window.location.search;
const integer = (value: number) => value.toLocaleString("en-US");
const sourceLabel = (source: string) =>
  source === "modis" ? "MODIS · Terra + Aqua" : "VIIRS · S-NPP";
const errorMessage = (error: unknown) => {
  if (
    error instanceof SyntaxError ||
    (error instanceof Error && error.name === "ZodError")
  )
    return "The review dataset does not match the supported format. Please retry or contact the project team.";
  if (error instanceof TypeError)
    return "Could not load detection data. Check the connection and retry.";
  return error instanceof Error
    ? error.message
    : "Detection data could not be loaded.";
};

export default function DetectionReviewMap() {
  const [manifest, setManifest] = useState<ReviewManifest>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    loadReviewManifest(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setManifest(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      });
    return () => controller.abort();
  }, [attempt]);
  if (error)
    return (
      <div role="alert" className="notice">
        <p>{error}</p>
        <button onClick={() => setAttempt((value) => value + 1)}>
          Retry detection dataset
        </button>
      </div>
    );
  if (!manifest)
    return <p role="status">Loading the separate detection review dataset…</p>;
  return <ReviewExplorer manifest={manifest} />;
}

function ReviewExplorer({ manifest }: { manifest: ReviewManifest }) {
  const search = useSyncExternalStore(subscribe, snapshot);
  const { selection, corrected } = resolveReviewSelection(search, manifest);
  const { source, start, end, satellite, imagery } = selection;
  const update = (patch: Partial<ReviewSelection>) => {
    const next = { ...selection, ...patch };
    if (patch.source) next.satellite = "all";
    if (next.start > next.end) {
      if (patch.start) next.end = next.start;
      else next.start = next.end;
    }
    const url =
      window.location.pathname +
      reviewSelectionSearch(window.location.search, next) +
      window.location.hash;
    if (
      url !==
      window.location.pathname + window.location.search + window.location.hash
    ) {
      window.history.pushState(null, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };
  const [data, setData] = useState<{
    key: string;
    rows: DatedReviewPoint[];
  }>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const key = `${source}/${start}/${end}`;
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    loadReviewPoints(manifest, source, start, end, controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setData({ key, rows });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      });
    return () => controller.abort();
  }, [manifest, source, start, end, key, attempt]);
  const current = data?.key === key && !error ? data : undefined;
  const rows = useMemo(
    () =>
      current?.rows.filter(
        ({ point }) => satellite === "all" || point[4] === satellite,
      ) ?? [],
    [current, satellite],
  );
  const initialFit = useRef(false);
  const [selected, setSelected] = useState<DatedReviewPoint>();
  const [tablePage, setTablePage] = useState(0);
  useEffect(() => {
    setSelected(undefined);
    setTablePage(0);
  }, [source, start, end, satellite]);
  const canvas = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const details = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState(4);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [baseStatus, setBaseStatus] = useState("Loading basemap…");
  const [baseAttempt, setBaseAttempt] = useState(0);
  const [opacity, setOpacity] = useState(0.65);
  const inspect = (row: DatedReviewPoint, move = false) => {
    setSelected(row);
    if (move) mapRef.current?.setView([row.point[2], row.point[1]], 10);
    window.requestAnimationFrame(() => details.current?.focus());
  };
  useEffect(() => {
    if (!canvas.current) return;
    const map = L.map(canvas.current, {
      center: [-14.5, -53.5],
      zoom: 4,
      minZoom: 3,
      maxZoom: 14,
      scrollWheelZoom: false,
      // Prevent delayed Leaflet zoom callbacks after the React view unmounts.
      zoomAnimation: false,
      preferCanvas: true,
    });
    mapRef.current = map;
    const updateViewport = () => {
      setZoom(map.getZoom());
      setMapBounds(map.getBounds().pad(0.15));
    };
    map.on("moveend zoomend", updateViewport);
    updateViewport();
    L.control.scale({ imperial: false }).addTo(map);
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(canvas.current);
    return () => {
      resize.disconnect();
      map.off("moveend zoomend", updateViewport);
      map.stop();
      map.remove();
      mapRef.current = null;
    };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setBaseStatus("Loading basemap…");
    let errors = 0,
      loaded = 0;
    const layer = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 14,
        noWrap: true,
        className: "review-basemap",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    );
    const status = () =>
      setBaseStatus(
        errors
          ? "Basemap is incomplete. Detection data is independent of the background."
          : loaded
            ? "Basemap loaded."
            : "Basemap unavailable. Detection data is independent of the background.",
      );
    layer.on("tileload", () => {
      loaded++;
      status();
    });
    layer.on("tileerror", () => {
      errors++;
      status();
    });
    const timer = window.setTimeout(status, 20000);
    layer.addTo(map);
    return () => {
      clearTimeout(timer);
      layer.off("tileload tileerror");
      map.removeLayer(layer);
    };
  }, [baseAttempt]);
  const [imageryStatus, setImageryStatus] = useState("");
  const imageryRef = useRef<L.TileLayer | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !imagery) return;
    setImageryStatus("Loading satellite context…");
    let errors = 0,
      loaded = 0;
    const layer = L.tileLayer(gibsTileUrl(end), {
      maxNativeZoom: GIBS_MAX_ZOOM,
      maxZoom: 14,
      opacity,
      noWrap: true,
      attribution:
        'Imagery: <a href="https://www.earthdata.nasa.gov/centers/gibs">NASA GIBS / MODIS Terra</a>',
    });
    const status = () =>
      setImageryStatus(
        errors
          ? "Satellite context is incomplete; missing imagery does not mean no fire."
          : loaded
            ? "Satellite context loaded."
            : "Satellite context unavailable; detections remain available.",
      );
    layer.on("tileload", () => {
      loaded++;
      status();
    });
    layer.on("tileerror", () => {
      errors++;
      status();
    });
    const timer = window.setTimeout(status, 20000);
    layer.addTo(map);
    imageryRef.current = layer;
    return () => {
      clearTimeout(timer);
      layer.off("tileload tileerror");
      map.removeLayer(layer);
      imageryRef.current = null;
    };
    // Opacity changes are handled without rebuilding the tile layer.
  }, [imagery, end, baseAttempt]);
  useEffect(() => {
    imageryRef.current?.setOpacity(opacity);
  }, [opacity]);
  const groups = useMemo(
    () =>
      groupReviewPoints(
        zoom >= 10 && mapBounds
          ? rows.filter(({ point }) => mapBounds.contains([point[2], point[1]]))
          : rows,
        zoom,
      ),
    [rows, zoom, mapBounds],
  );
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    for (const group of groups) {
      if (group.rows.length === 1) {
        const row = group.rows[0];
        L.circleMarker([row.point[2], row.point[1]], {
          radius: 3.5,
          stroke: true,
          color: "#ffd5a7",
          weight: 0.6,
          fillColor: "#ff902f",
          fillOpacity: 0.85,
        })
          .on("click", () => inspect(row))
          .bindTooltip("Inspect detection")
          .addTo(layer);
      } else {
        const marker = L.marker([group.latitude, group.longitude], {
          icon: L.divIcon({
            className: "review-cluster",
            html: `<span>${integer(group.rows.length)}</span>`,
            iconSize: [42, 32],
            iconAnchor: [21, 16],
          }),
          keyboard: true,
          title: `${integer(group.rows.length)} detections. Zoom in to inspect.`,
        });
        marker
          .on("click", () =>
            map.fitBounds(
              L.latLngBounds(
                group.rows.map(
                  ({ point }) => [point[2], point[1]] as [number, number],
                ),
              ),
              { maxZoom: 10, padding: [35, 35] },
            ),
          )
          .addTo(layer);
      }
    }
    return () => {
      map.removeLayer(layer);
    };
  }, [groups]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    const marker = L.circleMarker([selected.point[2], selected.point[1]], {
      radius: 8,
      color: "#fff",
      weight: 2,
      fillOpacity: 0,
    }).addTo(map);
    return () => {
      map.removeLayer(marker);
    };
  }, [selected]);
  const fitDetections = () => {
    if (rows.length)
      mapRef.current?.fitBounds(
        L.latLngBounds(
          rows.map(({ point }) => [point[2], point[1]] as [number, number]),
        ),
        { padding: [20, 20], maxZoom: 10 },
      );
  };
  useEffect(() => {
    if (!initialFit.current && rows.length && mapRef.current) {
      mapRef.current.fitBounds(
        L.latLngBounds(
          rows.map(({ point }) => [point[2], point[1]] as [number, number]),
        ),
        { padding: [20, 20], maxZoom: 7, animate: false },
      );
      initialFit.current = true;
    }
  }, [rows]);
  const sourceInfo = manifest.sources[source];
  const pageRows = rows.slice(tablePage * 15, tablePage * 15 + 15);
  const totalPages = Math.max(1, Math.ceil(rows.length / 15));

  return (
    <div className="detection-review">
      <aside className="review-warning">
        <strong>REAL DETECTIONS · UNREVIEWED</strong>
        <p>
          Brazil-wide download; no Pantanal boundary or regional clipping is
          applied. Coverage is unknown; detections are not individual fires.
        </p>
        <p>
          Separate from the synthetic calendar. Source and date filters below
          apply only to this delivery.
        </p>
      </aside>
      {corrected && (
        <p role="status" className="notice">
          Invalid review filters were replaced with available dates and sources.
          These filters apply only to the detection explorer.
        </p>
      )}
      <div className="review-controls">
        <label>
          Detection source
          <select
            aria-label="Detection source"
            value={source}
            onChange={(event) =>
              update({
                source: event.target.value as ReviewSelection["source"],
              })
            }
          >
            <option value="viirs">VIIRS · S-NPP</option>
            <option value="modis">MODIS · Terra + Aqua</option>
          </select>
        </label>
        <label>
          From (UTC)
          <input
            type="date"
            min={manifest.start_date}
            max={manifest.end_date}
            value={start}
            onChange={(event) => {
              if (event.target.validity.valid && event.target.value)
                update({ start: event.target.value });
            }}
          />
        </label>
        <label>
          To (UTC, inclusive)
          <input
            type="date"
            min={manifest.start_date}
            max={manifest.end_date}
            value={end}
            onChange={(event) => {
              if (event.target.validity.valid && event.target.value)
                update({ end: event.target.value });
            }}
          />
        </label>
        <label>
          Platform
          <select
            aria-label="Detection platform"
            value={satellite}
            onChange={(event) => update({ satellite: event.target.value })}
          >
            <option value="all">All available platforms</option>
            {(source === "modis" ? ["Terra", "Aqua"] : ["S-NPP"]).map(
              (platform) => (
                <option key={platform}>{platform}</option>
              ),
            )}
          </select>
        </label>
      </div>
      <div className="review-toolbar">
        <label className="review-check">
          <input
            type="checkbox"
            checked={imagery}
            onChange={(event) => update({ imagery: event.target.checked })}
          />
          Satellite context
        </label>
        {imagery && (
          <label>
            Imagery opacity
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(event) => setOpacity(Number(event.target.value))}
            />
          </label>
        )}
        <button
          onClick={fitDetections}
          disabled={!current || !rows.length}
          aria-label="Fit selected detections"
        >
          Fit detections
        </button>
      </div>
      {imagery && (
        <p className="footnote">
          MODIS Terra true-color context for {end} UTC (the end of the range).
          It does not represent the full selected period or the selected
          detection platform.
        </p>
      )}
      <div className="review-summary" role="status" aria-live="polite">
        {error
          ? "Detection layer unavailable."
          : !current
            ? "Loading and checking detection files…"
            : `${integer(rows.length)} detections · ${sourceLabel(source)} · ${start} to ${end} UTC`}
      </div>
      {error && (
        <div className="notice" role="alert">
          <p>{error}</p>
          <button onClick={() => setAttempt((value) => value + 1)}>
            Retry detection files
          </button>
        </div>
      )}
      {current && rows.length === 0 && (
        <p className="notice">
          No detection records match these filters. This does not establish zero
          fire activity or adequate sensor coverage.
        </p>
      )}
      <div className="review-map-layout">
        <div>
          <div
            ref={canvas}
            className="map-canvas review-map-canvas"
            role="region"
            tabIndex={0}
            aria-label="Map of unreviewed satellite detections from the Brazil archive download. Use the detection table below for keyboard inspection."
          />
          <p className="review-legend">
            <span className="review-dot" /> Orange: detection · Numbered group:
            detections grouped for display
          </p>
          <p className="footnote">
            Point size does not represent burned area or FRP. Groups change with
            zoom and are not fire events. At zoom 10+, each point is a
            detection.
          </p>
          <p className="map-status" role="status">
            {baseStatus} {imagery && imageryStatus}{" "}
            <button
              className="text-button"
              onClick={() => setBaseAttempt((value) => value + 1)}
            >
              Reload background
            </button>
          </p>
        </div>
        <aside
          ref={details}
          tabIndex={-1}
          className="review-details"
          aria-label="Detection details"
        >
          <span className="eyebrow">INSPECT A DETECTION</span>
          {selected ? (
            <>
              <h3>
                {selected.point[4]} · {selected.date}
              </h3>
              <dl>
                <dt>Acquired (UTC)</dt>
                <dd>
                  {selected.date} {selected.point[3]}
                </dd>
                <dt>FRP</dt>
                <dd>
                  {selected.point[5].toLocaleString("en-US", {
                    maximumFractionDigits: 3,
                  })}{" "}
                  MW
                </dd>
                <dt>Raw confidence</dt>
                <dd>{selected.point[6]}</dd>
                <dt>Coordinates</dt>
                <dd>
                  {selected.point[2]}, {selected.point[1]} (lat, lon)
                </dd>
                <dt>Source type</dt>
                <dd>{selected.point[7] ?? "Not supplied"}</dd>
                <dt>Original CSV record</dt>
                <dd>{integer(selected.point[0])}</dd>
              </dl>
              <p className="footnote">
                Confidence is source-specific. Low-confidence and static-source
                records are retained; no scientific quality filter is applied.
              </p>
            </>
          ) : (
            <>
              <h3>Where was it detected?</h3>
              <p>
                Select an orange point or use the table below. Select a numbered
                group to zoom in.
              </p>
            </>
          )}
          <hr />
          <h3>Delivery context</h3>
          <p>
            {sourceInfo.source_dataset} · Request {sourceInfo.request_id}
          </p>
          <p className="footnote">
            Raw collection values:{" "}
            {sourceInfo.collection_values.join(", ") || "Not supplied"}.
            Normalizer {sourceInfo.normalization_version}.
          </p>
          <p className="footnote">
            {integer(sourceInfo.record_count)} records in the supplied Brazil
            CSV for the full delivered period. All records are retained; no
            Pantanal subset or quality filter has been applied.
          </p>
          <details>
            <summary>Provenance and limitations</summary>
            <p className="footnote">{manifest.notice}</p>
            <p className="footnote review-hash">
              Original CSV SHA-256: {sourceInfo.input_sha256}
            </p>
            <a
              href="https://firms.modaps.eosdis.nasa.gov/download/"
              target="_blank"
              rel="noreferrer"
            >
              NASA FIRMS archive ↗
            </a>
          </details>
        </aside>
      </div>
      <section
        className="review-table-section"
        aria-label="Accessible detection records"
      >
        <h3>Inspect records without using the map</h3>
        <p className="footnote">
          Original CSV order, across the selected dates and platform. All{" "}
          {integer(rows.length)} matching records are accessible through
          pagination.
        </p>
        {current && (
          <>
            <div className="review-table-scroll">
              <table className="review-table">
                <caption className="sr-only">
                  Unreviewed detection records for {sourceLabel(source)},{" "}
                  {start} to {end} UTC
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date / time (UTC)</th>
                    <th scope="col">Platform</th>
                    <th scope="col">FRP (MW)</th>
                    <th scope="col">Confidence</th>
                    <th scope="col">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr
                      key={row.point[0]}
                      aria-selected={selected?.point[0] === row.point[0]}
                    >
                      <td>
                        {row.date}
                        <br />
                        {row.point[3]}
                      </td>
                      <td>{row.point[4]}</td>
                      <td>{row.point[5]}</td>
                      <td>{row.point[6]}</td>
                      <td>
                        <button
                          onClick={() => inspect(row, true)}
                          aria-label={`Inspect ${row.point[4]} detection, CSV record ${row.point[0]}`}
                        >
                          #{row.point[0]}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="review-pagination">
              <button
                disabled={tablePage <= 0}
                onClick={() => setTablePage((page) => page - 1)}
              >
                Previous records
              </button>
              <label className="review-page-number">
                Page
                <input
                  aria-label="Detection table page"
                  type="number"
                  min={1}
                  max={totalPages}
                  value={Math.min(tablePage + 1, totalPages)}
                  onChange={(event) => {
                    const value = event.target.valueAsNumber;
                    if (
                      Number.isInteger(value) &&
                      value >= 1 &&
                      value <= totalPages
                    )
                      setTablePage(value - 1);
                  }}
                />
                of {totalPages}
              </label>
              <button
                disabled={tablePage + 1 >= totalPages}
                onClick={() => setTablePage((page) => page + 1)}
              >
                Next records
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
