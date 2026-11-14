import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  gibsTileUrl,
  GIBS_DOCUMENTATION,
  GIBS_MAX_ZOOM,
  isImageryDateSupported,
} from "../data/gibs";

/** Context imagery only. No AOI boundary or fire detections are inferred. */
export default function ContextMap({ date }: { date: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<
    "loading" | "loaded" | "partial" | "error"
  >("loading");
  const [attempt, setAttempt] = useState(0);
  const supported = isImageryDateSupported(date);

  useEffect(() => {
    if (!container.current || !supported) return;
    setStatus("loading");
    // Approximate initial camera, not a confirmed scientific AOI.
    const map = L.map(container.current, {
      center: [-18.5, -56.5],
      zoom: 6,
      minZoom: 3,
      maxZoom: GIBS_MAX_ZOOM,
      scrollWheelZoom: false,
    });
    const layer = L.tileLayer(gibsTileUrl(date), {
      maxZoom: GIBS_MAX_ZOOM,
      noWrap: true,
      attribution:
        'Imagery: <a href="https://www.earthdata.nasa.gov/centers/gibs" target="_blank" rel="noreferrer">NASA GIBS / MODIS Terra</a>',
    });
    let successes = 0;
    let failures = 0;
    const refreshStatus = () =>
      setStatus(successes ? (failures ? "partial" : "loaded") : "error");
    const timeout = window.setTimeout(refreshStatus, 20000);
    layer.on("tileload", () => {
      successes++;
      setStatus(failures ? "partial" : "loaded");
    });
    layer.on("tileerror", () => {
      failures++;
      refreshStatus();
    });
    layer.on("load", () => {
      window.clearTimeout(timeout);
      refreshStatus();
    });
    layer.addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    return () => {
      window.clearTimeout(timeout);
      layer.off();
      map.remove();
    };
  }, [date, attempt, supported]);

  return (
    <div className="context-map">
      <div className="map-source">
        <strong>Real context imagery · NASA GIBS</strong>
        <span>MODIS Terra · true color · {date || "invalid date"} (UTC)</span>
      </div>
      {supported ? (
        <>
          <div
            ref={container}
            className="map-canvas"
            role="region"
            aria-label={`Interactive map with MODIS Terra imagery for ${date}. No thermal detection layer.`}
          />
          <div className="map-status" role="status" aria-live="polite">
            {status === "loading" && "Loading NASA GIBS imagery…"}
            {status === "loaded" &&
              "Imagery received. Blank areas may indicate missing imagery; they do not establish the absence of fire."}
            {status === "partial" &&
              "Some imagery failed to load. Spatial context is incomplete."}
            {status === "error" &&
              "Imagery is unavailable or the connection was interrupted. The calendar remains available."}
            {(status === "error" || status === "partial") && (
              <button
                className="text-button"
                onClick={() => setAttempt((n) => n + 1)}
              >
                Try again
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="notice">
          Choose a valid date between February 24, 2000 and today to view this
          layer.
        </p>
      )}
      <p className="footnote">
        Background imagery is independent of the {"MODIS/VIIRS"} calendar basis.
        GIBS uses UTC dates, not the aggregates’ local solar day. Clouds and
        gaps may obscure the surface. The camera position is approximate; no AOI
        boundary has been confirmed and no detections have been overlaid.
      </p>
      <a href={GIBS_DOCUMENTATION} target="_blank" rel="noreferrer">
        About the imagery source ↗
      </a>
    </div>
  );
}
