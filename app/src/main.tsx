import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { loadDataset, calendarSlot } from "./data/load";
import type { ActivityAggregate, Dataset } from "./data/schema";
import "./style.css";
const ContextMap = lazy(() => import("./components/ContextMap"));

const months = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];
const number = (v: number | null) =>
  v === null
    ? "Não disponível"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v);
const dateLabel = (s: string) =>
  new Date(s + "T12:00:00Z").toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
type Page = "calendar" | "map" | "methodology";
function App() {
  const [dataset, setDataset] = useState<Dataset>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const initial = new URLSearchParams(location.search);
  const [page, setPage] = useState<Page>(
    (["calendar", "map", "methodology"].includes(initial.get("view") ?? "")
      ? initial.get("view")
      : "calendar") as Page,
  );
  const [basis, setBasis] = useState(
    initial.get("basis") === "modis" ? "modis" : "viirs",
  );
  const [selectedDate, setSelectedDate] = useState(
    initial.get("date") ?? "2025-09-01",
  );
  const [compare, setCompare] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    loadDataset()
      .then((d) => {
        if (active) setDataset(d);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Falha ao carregar dados");
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    const p = new URLSearchParams({
      view: page,
      basis,
      date: selectedDate,
      region: "pantanal-pilot",
    });
    history.replaceState(null, "", "?" + p);
  }, [page, basis, selectedDate]);
  const records = useMemo(
    () =>
      dataset?.calendar.records.filter((r) =>
        basis === "harmonized"
          ? r.metric_name === "harmonized_frp_index"
          : r.metric_name === `${basis}_frp_sum`,
      ) ?? [],
    [dataset, basis],
  );
  const years = useMemo(
    () =>
      [...new Set(records.map((r) => r.period_start.slice(0, 4)))]
        .sort()
        .reverse(),
    [records],
  );
  const byDate = useMemo(
    () => new Map(records.map((r) => [r.period_start, r])),
    [records],
  );
  const selected = records.find((r) => r.period_start === selectedDate);
  const fixture = dataset?.manifest.data_status === "fixture";
  const maximum = Math.max(1, ...records.map((r) => r.metric_value ?? 0));
  const changeBasis = (value: string) => {
    setBasis(value);
    setCompare("");
  };
  return (
    <>
      <header className="topbar">
        <a
          className="brand"
          href="?view=calendar"
          aria-label="ChronoFlare início"
        >
          <span className="brand-icon">◈</span> Chrono<span>Flare</span>
          <small>EARTH / TIME / INSIGHT</small>
        </a>
        <nav aria-label="Navegação principal">
          {(
            [
              ["calendar", "Calendário"],
              ["map", "Mapa"],
              ["methodology", "Metodologia"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
              aria-current={page === id ? "page" : undefined}
            >
              {label}
            </button>
          ))}
        </nav>
        <span className="project-tag">NASA SPACE APPS · PROJETO</span>
      </header>
      <main>
        <div className="eyebrow">OBSERVAR O PASSADO. ENTENDER OS PADRÕES.</div>
        <div className="heading">
          <div>
            <h1>O fogo tem uma história.</h1>
            <p>
              Explore a atividade de queima através do tempo, com a origem e os
              limites de cada observação.
            </p>
          </div>
          <span className="status">
            <i /> Ciência em construção
          </span>
        </div>
        {error ? (
          <section role="alert" className="notice">
            <h2>Não foi possível interpretar os dados</h2>
            <p>{error}</p>
            <button onClick={() => setAttempt((v) => v + 1)}>
              Tentar novamente
            </button>
          </section>
        ) : !dataset ? (
          <p role="status">Carregando e verificando os artefatos…</p>
        ) : (
          <>
            {fixture && (
              <aside className="fixture" role="status">
                <strong>DEMONSTRAÇÃO · DADOS FICTÍCIOS</strong>
                <span>
                  Os valores ilustram a interface. Não são observações FIRMS nem
                  resultados validados.
                </span>
              </aside>
            )}
            <section className="context">
              <div>
                <span className="mini">REGIÃO PILOTO PROPOSTA</span>
                <strong>↗ Pantanal brasileiro</strong>
                <small>AOI e limites aguardam confirmação</small>
              </div>
              <div>
                <span className="mini">
                  {fixture ? "INTERVALO SIMULADO" : "INTERVALO DO DATASET"}
                </span>
                <strong>
                  {fixture
                    ? `${years.at(-1) ?? "—"} — ${years[0] ?? "—"}`
                    : `${dataset.manifest.actual_date_range?.start} — ${dataset.manifest.actual_date_range?.end}`}
                </strong>
                <small>
                  {fixture
                    ? "Sem alegação de cobertura histórica"
                    : "Consulte lacunas e cobertura nos detalhes"}
                </small>
              </div>
              <div>
                <span className="mini">VALIDAÇÃO CIENTÍFICA</span>
                <strong>
                  {dataset.validation.status === "not_run"
                    ? "Não realizada"
                    : dataset.validation.status === "passed"
                      ? "Aprovada"
                      : "Não aprovada"}
                </strong>
                <small>
                  {dataset.manifest.decision === "pending"
                    ? "Decisão A/B pendente"
                    : dataset.manifest.decision === "plan_a"
                      ? "Plano A"
                      : "Plano B · sensores separados"}
                </small>
              </div>
            </section>
            {page === "calendar" && (
              <>
                <section className="panel calendar-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">BURNING ACTIVITY CALENDAR</span>
                      <h2>Um novo olhar para cada temporada</h2>
                      <p>
                        {fixture
                          ? "Padrões sintéticos para explorar o produto."
                          : "Atividade diária detectada na região selecionada."}{" "}
                        Selecione um dia para conhecer sua base.
                      </p>
                    </div>
                    <label className="select-label">
                      Base dos dados
                      <select
                        value={basis}
                        onChange={(e) => changeBasis(e.target.value)}
                      >
                        <option value="viirs">VIIRS original</option>
                        <option value="modis">MODIS original</option>
                        <option value="harmonized" disabled={!dataset.approved}>
                          Harmonizado
                          {!dataset.approved ? " · aguarda validação" : ""}
                        </option>
                      </select>
                    </label>
                  </div>
                  <p className="sensor-note">
                    <span className={"dot " + basis} /> {basis.toUpperCase()} ·{" "}
                    {basis === "harmonized"
                      ? "Índice relativo em escala VIIRS equivalente"
                      : "Soma diária de FRP (MW), escala original do sensor"}
                    . Bases originais não são diretamente comparáveis.
                  </p>
                  <div
                    className="calendar-scroll"
                    aria-label="Calendário por ano e dia; use também os seletores abaixo"
                  >
                    <div className="calendar">
                      <div className="month-row">
                        <span />
                        {months.map((m, i) => (
                          <span
                            key={m}
                            style={{
                              gridColumn: `${Math.floor(calendarSlot(`2000-${String(i + 1).padStart(2, "0")}-01`)) + 2} / span 28`,
                            }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                      {years.map((year) => (
                        <div className="year-row" key={year}>
                          <span className="year">{year}</span>
                          {Array.from({ length: 366 }, (_, slot) => {
                            const date = new Date(Date.UTC(2000, 0, 1 + slot));
                            const suffix = date.toISOString().slice(4, 10);
                            const r = byDate.get(year + suffix);
                            if (!r)
                              return (
                                <span
                                  key={slot}
                                  className={
                                    new Date(`${year}${suffix}T00:00:00Z`)
                                      .toISOString()
                                      .slice(0, 10) ===
                                    year + suffix
                                      ? "day no_data"
                                      : "day nonexistent"
                                  }
                                  title={
                                    new Date(`${year}${suffix}T00:00:00Z`)
                                      .toISOString()
                                      .slice(0, 10) ===
                                    year + suffix
                                      ? "Sem registro; não significa zero"
                                      : "Dia inexistente neste ano"
                                  }
                                />
                              );
                            return (
                              <button
                                key={slot}
                                tabIndex={-1}
                                className={`day ${r.coverage_flag} ${r.value_basis === "estimated_from_modis" ? "estimated" : ""} ${r.is_unusual ? "unusual" : ""} ${r.period_start === selectedDate ? "selected" : ""}`}
                                style={{
                                  backgroundColor:
                                    r.metric_value === null
                                      ? undefined
                                      : `color-mix(in srgb, #ed6b35 ${15 + (85 * r.metric_value) / maximum}%, #f8f3e9)`,
                                }}
                                onClick={() => setSelectedDate(r.period_start)}
                                title={`${dateLabel(r.period_start)} · ${r.metric_value === null ? "Sem dados" : number(r.metric_value)}${fixture ? " · sintético" : ""}`}
                                aria-label={`${dateLabel(r.period_start)}, ${number(r.metric_value)}`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="legend">
                    <span>
                      <i className="swatch observed" /> Observado
                      {fixture ? " (simulado)" : ""}
                    </span>
                    <span>
                      <i className="swatch estimated" /> Estimado*
                    </span>
                    <span>
                      <i className="swatch no_data" /> Sem dados
                    </span>
                    <span>
                      <i className="swatch zero" /> Zero / cobertura adequada
                    </span>
                    <span>
                      <i className="swatch unusual" /> Incomum
                    </span>
                    <span>
                      <i className="swatch partial" /> Cobertura parcial
                    </span>
                    <span className="scale">
                      Menor <i /> Maior
                    </span>
                  </div>
                  <p className="footnote">
                    * Estimativas só são disponibilizadas após validação. Antes
                    de 2012: extrapolação sem validação direta contra VIIRS.
                    Intensidade de cor não representa confiança.
                  </p>
                </section>
                <section className="bottom-grid">
                  <article className="panel details">
                    <div className="eyebrow">EXPLORAR UM DIA</div>
                    <div className="detail-controls">
                      <label>
                        Data
                        <input
                          type="date"
                          min={records.at(0)?.period_start}
                          max={records.at(-1)?.period_start}
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                        />
                      </label>
                      <label>
                        Comparar mesmo mês/dia
                        <select
                          value={compare}
                          onChange={(e) => setCompare(e.target.value)}
                        >
                          <option value="">Escolher ano</option>
                          {years
                            .filter((y) => y !== selectedDate.slice(0, 4))
                            .map((y) => (
                              <option key={y}>{y}</option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <div className="comparison">
                      <Detail record={selected} fixture={!!fixture} />
                      {compare && (
                        <Detail
                          record={records.find(
                            (r) =>
                              r.period_start ===
                              compare + selectedDate.slice(4),
                          )}
                          fixture={!!fixture}
                        />
                      )}
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPage("map")}
                    >
                      Ver contexto espacial deste dia ↗
                    </button>
                  </article>
                  <article className="panel explanation">
                    <span className="eyebrow">A LEITURA ALÉM DA COR</span>
                    <h2>Comparar exige contexto.</h2>
                    <p>
                      MODIS e VIIRS têm resoluções, horários de passagem e
                      critérios de confiança diferentes. Uma mudança no sensor
                      pode parecer uma mudança na atividade.
                    </p>
                    <p>
                      Aqui, ausência de dado permanece ausência. Cada valor
                      mantém sua base, versão e cobertura.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => setPage("methodology")}
                    >
                      Entenda a metodologia ↗
                    </button>
                  </article>
                </section>
              </>
            )}
            {page === "map" && (
              <section className="panel map-page">
                <span className="eyebrow">CONTEXTO ESPACIAL</span>
                <h2>Pantanal · {dateLabel(selectedDate)}</h2>
                <p>
                  Base selecionada: {basis.toUpperCase()}. A seleção do
                  calendário foi preservada.
                </p>
                <label className="map-date-control">
                  Data da imagem de contexto (UTC)
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      if (e.target.value) setSelectedDate(e.target.value);
                    }}
                  />
                </label>
                <Suspense fallback={<p role="status">Preparando mapa…</p>}>
                  <ContextMap date={selectedDate} />
                </Suspense>
                <div className="notice map-pending">
                  <strong>Camada de atividade aguardando dados do André</strong>
                  <p>
                    As células H3/GeoJSON, a cobertura e o limite confirmado da
                    AOI serão integrados após a entrega científica. As imagens
                    de fundo não validam os números do calendário.
                  </p>
                </div>
                <button
                  className="text-button"
                  onClick={() => setPage("calendar")}
                >
                  ← Voltar ao calendário
                </button>
              </section>
            )}
            {page === "methodology" && (
              <section className="panel methodology">
                <span className="eyebrow">MÉTODO, PROVENIÊNCIA E LIMITES</span>
                <h2>Transparência faz parte do resultado.</h2>
                <div className="method-grid">
                  <article>
                    <h3>01 / O que estamos medindo</h3>
                    <p>
                      A fonte prevista é o{" "}
                      <a
                        href="https://firms.modaps.eosdis.nasa.gov/content/active_fire/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        NASA FIRMS
                      </a>
                      , com registros MODIS e VIIRS. FRP é potência radiativa do
                      fogo em MW; sua soma diária é um indicador relativo, não
                      energia total, área queimada ou número de incêndios.
                    </p>
                    <p>
                      {fixture
                        ? "Esta demonstração não contém registros FIRMS. Todos os números são sintéticos."
                        : "O intervalo disponível é declarado no manifesto do dataset."}
                    </p>
                  </article>
                  <article>
                    <h3>02 / Por que harmonizar?</h3>
                    <p>
                      MODIS (~1 km) e VIIRS (~375 m no nadir) não têm a mesma
                      detectabilidade. A comparação requer uma calibração
                      testada fora da amostra, com Terra e Aqua avaliados
                      separadamente.
                    </p>
                    <p>
                      Os gráficos de comparação e as métricas serão apresentados
                      com os resultados do André. Não há resultado empírico
                      nesta versão.
                    </p>
                  </article>
                  <article>
                    <h3>03 / Decisão científica</h3>
                    <p>
                      Status:{" "}
                      <strong>
                        {dataset.validation.status === "not_run"
                          ? "não realizado"
                          : dataset.validation.status}
                      </strong>
                      . Harmonização{" "}
                      {dataset.approved ? "habilitada" : "bloqueada"}. Plano A
                      exige aprovação; plano B mantém sensores separados.
                      Limiares devem ser registrados antes dos testes.
                    </p>
                    <p>
                      Estimativas pré-2012 são extrapolações sem validação
                      direta contra VIIRS.
                    </p>
                  </article>
                  <article>
                    <h3>04 / Cobertura e referência</h3>
                    <p>
                      Sem dados não significa zero. Detecções positivas,
                      sozinhas, não comprovam cobertura nos dias sem registros.
                      Nuvens, fumaça e horários de passagem limitam a
                      observação.
                    </p>
                    <p>
                      Referência proposta: janela de ±15 dias, excluindo o
                      próprio ano. Incomum: acima do P90 por pelo menos três
                      dias consecutivos. A série diária preserva 29 de
                      fevereiro.
                    </p>
                  </article>
                </div>
                <div className="notice">
                  <strong>Não é previsão ou alerta de incêndios.</strong>
                  <p>
                    As detecções não confirmam ocorrências individuais. O
                    produto não deve ser usado isoladamente para proteger vidas
                    ou propriedades.
                  </p>
                </div>
                <dl className="metadata">
                  <div>
                    <dt>Dataset</dt>
                    <dd>{dataset.manifest.dataset_version}</dd>
                  </div>
                  <div>
                    <dt>Metodologia</dt>
                    <dd>{dataset.manifest.methodology_version}</dd>
                  </div>
                  <div>
                    <dt>Cobertura</dt>
                    <dd>{dataset.manifest.coverage_method}</dd>
                  </div>
                  <div>
                    <dt>Calibração</dt>
                    <dd>
                      {dataset.validation.calibration_version ??
                        "Não executada"}
                    </dd>
                  </div>
                </dl>
                <a
                  href="/data/v1/manifest.json"
                  target="_blank"
                  rel="noreferrer"
                >
                  Consultar manifesto ↗
                </a>
              </section>
            )}
          </>
        )}
        <footer>
          <span>
            ChronoFlare <small>Understanding fire activity through time.</small>
          </span>
          <span>
            Focos térmicos ≠ incêndios confirmados · Projeto independente
          </span>
        </footer>
      </main>
    </>
  );
}
function Detail({
  record: r,
  fixture,
}: {
  record?: ActivityAggregate;
  fixture: boolean;
}) {
  if (!r)
    return (
      <div className="detail-card">
        <h3>Sem registro para esta data</h3>
        <p>Ausência de registro não significa zero. Escolha outro dia.</p>
      </div>
    );
  const basis = {
    observed_modis: "MODIS original",
    observed_viirs: "VIIRS original",
    observed_both: "Ambos os sensores",
    estimated_from_modis: "Estimado a partir do MODIS",
  }[r.value_basis];
  return (
    <div className="detail-card">
      <h3>{dateLabel(r.period_start)}</h3>
      <div className="value">
        {number(r.metric_value)}
        <small>
          {r.metric_value === null
            ? "sem dados"
            : r.metric_name === "harmonized_frp_index"
              ? "índice relativo"
              : "MW · soma diária FRP"}
        </small>
      </div>
      <span className="chip">
        {fixture ? "Sintético · " : ""}
        {basis}
      </span>
      <dl>
        <div>
          <dt>Cobertura</dt>
          <dd>
            {r.coverage_flag === "ok"
              ? "Adequada"
              : r.coverage_flag === "partial"
                ? "Parcial"
                : "Sem dados"}
            {fixture ? " (simulada)" : ""}
          </dd>
        </div>
        <div>
          <dt>Intervalo de incerteza</dt>
          <dd>
            {r.uncertainty_lower === null
              ? "Não disponível"
              : `${number(r.uncertainty_lower)} – ${number(r.uncertainty_upper)} (${number((r.interval_level ?? 0) * 100)}%)`}
          </dd>
        </div>
        <div>
          <dt>Mediana / P10–P90</dt>
          <dd>
            {number(r.baseline_median)} / {number(r.baseline_p10)}–
            {number(r.baseline_p90)}
          </dd>
        </div>
        <div>
          <dt>Anos de referência</dt>
          <dd>{r.baseline_n_years || "Referência insuficiente"}</dd>
        </div>
        <div>
          <dt>Percentil / z robusto</dt>
          <dd>
            {number(
              r.percentile_rank === null ? null : r.percentile_rank * 100,
            )}{" "}
            / {number(r.robust_z)}
          </dd>
        </div>
        <div>
          <dt>Passagens</dt>
          <dd>{number(r.overpass_count)}</dd>
        </div>
      </dl>
      {r.is_extrapolated && (
        <p className="notice">
          Extrapolação sem validação direta contra VIIRS.
        </p>
      )}
      <small>
        Dataset: {r.dataset_version} · Método: {r.methodology_version}
      </small>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
