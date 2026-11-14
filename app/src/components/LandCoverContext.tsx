import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  LAND_COVER_VIEWER,
  landCoverClasses,
  loadLandCover,
} from "../data/mapbiomas";

/** Annual background context only; never assigns a land-cover class to a fire record. */
export default function LandCoverContext({ map }: { map: L.Map | null }) {
  const [attempt, setAttempt] = useState(0);
  const [opacity, setOpacity] = useState(0.65);
  const [status, setStatus] = useState("Preparing land-cover context…");
  const layerRef = useRef<L.TileLayer | null>(null);
  useEffect(() => {
    if (!map) return;
    const controller = new AbortController();
    let layer: L.TileLayer | undefined;
    let timer: number | undefined;
    let successes = 0,
      failures = 0;
    setStatus(
      "Checking the provider's Collection 11 definition and requesting 2020 context…",
    );
    loadLandCover(controller.signal)
      .then(({ tileUrl }) => {
        if (controller.signal.aborted) return;
        setStatus("Loading MapBiomas 2020 context tiles…");
        layer = L.tileLayer(tileUrl, {
          maxZoom: 14,
          opacity,
          zIndex: 250,
          noWrap: true,
          attribution:
            'Land cover: <a href="' +
            LAND_COVER_VIEWER.replaceAll("&", "&amp;") +
            '" target="_blank" rel="noreferrer">MapBiomas Collection 11 · 2020</a>',
        });
        layerRef.current = layer;
        const refresh = () =>
          setStatus(
            failures
              ? "Some land-cover tiles are unavailable. Reload this context if its temporary session expired; detection records are unchanged."
              : successes
                ? "MapBiomas 2020 context loaded."
                : "Land-cover tiles are unavailable. Detection records remain available.",
          );
        layer.on("tileload", () => {
          successes++;
          refresh();
        });
        layer.on("tileerror", () => {
          failures++;
          refresh();
        });
        timer = window.setTimeout(refresh, 20000);
        layer.addTo(map);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const detail =
          error instanceof Error && error.name === "AbortError"
            ? "The MapBiomas request timed out."
            : error instanceof Error && error.name !== "ZodError"
              ? error.message
              : "MapBiomas metadata was not recognized.";
        setStatus(
          detail +
            " Detection records are unchanged. Retry or open the provider platform.",
        );
      });
    return () => {
      controller.abort();
      if (timer) window.clearTimeout(timer);
      if (layer) {
        layer.off("tileload tileerror");
        map.removeLayer(layer);
      }
      layerRef.current = null;
    };
    // Opacity updates do not generate another provider session.
  }, [map, attempt]);
  useEffect(() => {
    layerRef.current?.setOpacity(opacity);
  }, [opacity]);

  return (
    <section
      className="land-cover-context"
      aria-label="MapBiomas land-cover context"
    >
      <strong>Land cover · 2020 · MapBiomas Collection 11 · 30 m</strong>
      <p>
        Annual land-cover context for the Pantanal. It does not measure fire
        activity or daily observation coverage.
      </p>
      <label>
        Land-cover opacity
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={opacity}
          onChange={(event) => setOpacity(Number(event.target.value))}
        />
      </label>
      <p role="status" aria-live="polite">
        {status}
      </p>
      <button onClick={() => setAttempt((value) => value + 1)}>
        Reload land-cover context
      </button>{" "}
      <a href={LAND_COVER_VIEWER} target="_blank" rel="noreferrer">
        Open provider platform ↗
      </a>
      <details>
        <summary>Land-cover class legend and attribution</summary>
        <ul
          className="land-cover-legend"
          tabIndex={0}
          aria-label="MapBiomas class legend"
        >
          {landCoverClasses.map((item) => (
            <li key={item.value}>
              <span
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              {item.label} <small>({item.value})</small>
            </li>
          ))}
        </ul>
        <p className="footnote">
          MapBiomas Project – Collection 11 of the Annual Series of Land Cover
          and Land Use Maps of Brazil. Year 2020, asset coverage v3. Accessed{" "}
          {new Date().toLocaleDateString("en-US")} via the provider platform.
          Source attribution under CC-BY; provider classification accuracy and
          mapping limitations apply.
        </p>
      </details>
    </section>
  );
}
