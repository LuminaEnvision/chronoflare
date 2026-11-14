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
        <strong>Imagem de contexto real · NASA GIBS</strong>
        <span>
          MODIS Terra · cores naturais · {date || "data inválida"} (UTC)
        </span>
      </div>
      {supported ? (
        <>
          <div
            ref={container}
            className="map-canvas"
            role="region"
            aria-label={`Mapa interativo com imagem MODIS Terra de ${date}. Sem camada de focos térmicos.`}
          />
          <div className="map-status" role="status" aria-live="polite">
            {status === "loading" && "Carregando imagens do NASA GIBS…"}
            {status === "loaded" &&
              "Imagens recebidas. Áreas vazias podem indicar falta de imagem; não comprovam ausência de fogo."}
            {status === "partial" &&
              "Algumas imagens não carregaram. O contexto espacial está incompleto."}
            {status === "error" &&
              "Imagens indisponíveis ou conexão interrompida. O calendário continua disponível."}
            {(status === "error" || status === "partial") && (
              <button
                className="text-button"
                onClick={() => setAttempt((n) => n + 1)}
              >
                Tentar novamente
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="notice">
          Escolha uma data válida entre 24/02/2000 e hoje para consultar esta
          camada.
        </p>
      )}
      <p className="footnote">
        Imagem de fundo independente da base {"MODIS/VIIRS"} do calendário. A
        data GIBS é UTC, não o dia solar local dos agregados. Nuvens e lacunas
        podem ocultar a superfície. A câmera é aproximada; nenhum limite da AOI
        foi confirmado e nenhuma detecção foi sobreposta.
      </p>
      <a href={GIBS_DOCUMENTATION} target="_blank" rel="noreferrer">
        Sobre a fonte das imagens ↗
      </a>
    </div>
  );
}
