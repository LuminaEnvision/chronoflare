import { useEffect, useState } from "react";
import { formatMetric } from "../data/format";
import { researchEvidenceSchema } from "../data/research-evidence";
import type { ResearchEvidence } from "../data/research-evidence";
import { loadObservationManifest } from "../data/observations";
import type { ObservationManifest } from "../data/observations";
import { ChronoLoader } from "./ChronoLoader";
const repo = "https://github.com/j-c-fstk-dev/chronoflare/blob/main/";
export default function ResearchMethodology() {
  const [evidence, setEvidence] = useState<ResearchEvidence>();
  const [manifest, setManifest] = useState<ObservationManifest>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/data/research-summary.json", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Research evidence is unavailable");
        return r.json();
      })
      .then((r) => {
        if (!controller.signal.aborted)
          setEvidence(researchEvidenceSchema.parse(r));
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Unable to read evidence");
      });
    loadObservationManifest(controller.signal)
      .then((m) => {
        if (!controller.signal.aborted) setManifest(m);
      })
      .catch(() => {
        /* Publication remains gated by the calendar's own verified manifest. */
      });
    return () => controller.abort();
  }, [attempt]);
  const percent = (v: number) => `${(v * 100).toFixed(1)}%`;
  return (
    <div className="research-experience">
      <section className="panel">
        <span className="eyebrow">METHOD · EVIDENCE · LIMITATIONS</span>
        <h2>Different sensors. A tested relationship.</h2>
        <p>
          ChronoFlare measures the sum of fire radiative power (FRP, MW) from
          selected NASA FIRMS thermal detections. This is an activity indicator,
          not total energy, burned area or a count of individual fires.
        </p>
        <p>
          MODIS Terra, MODIS Aqua and VIIRS Suomi-NPP observe at different
          resolutions and overpass times. Native records remain separate.
          Harmonized values are estimates on a common VIIRS reference scale,
          with empirical uncertainty.
        </p>
      </section>
      {error ? (
        <section className="panel notice" role="alert">
          <p>{error}</p>
          <button onClick={() => setAttempt((a) => a + 1)}>
            Retry research evidence
          </button>
        </section>
      ) : !evidence ? (
        <ChronoLoader
          open
          variant="panel"
          message="Loading scientific evidence…"
        />
      ) : (
        <>
          <section className="panel research-result">
            <span className="eyebrow">V2 · REGISTERED INDEPENDENT TEST</span>
            <h2>All registered combined-view checks passed.</h2>
            <p>
              Registered before acquisition. The frozen model was scored once,
              without adjustment. This forward test covers previously unexamined
              dates within 2020–2026; it is distinct from the earlier post-hoc
              evaluation.
            </p>
            <div className="research-stat-grid">
              <article>
                <strong>{evidence.v2.combined_forward.paired_days}</strong>
                <span>paired days</span>
              </article>
              <article>
                <strong>{evidence.v2.combined_forward.weekly.weeks}</strong>
                <span>eligible ISO weeks</span>
              </article>
              <article>
                <strong>
                  {percent(evidence.v2.combined_forward.weekly.pbias)}
                </strong>
                <span>weekly bias</span>
              </article>
              <article>
                <strong>
                  {evidence.v2.combined_forward.weekly.spearman.toFixed(3)}
                </strong>
                <span>weekly Spearman</span>
              </article>
            </div>
            <div className="research-table-scroll">
              <table>
                <caption>
                  Combined Terra + Aqua · independent forward test
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Metric</th>
                    <th scope="col">Frozen v2</th>
                    <th scope="col">Native benchmark, same days</th>
                    <th scope="col">Registered criterion</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Weekly PBias</th>
                    <td>
                      {percent(evidence.v2.combined_forward.weekly.pbias)}
                    </td>
                    <td>{percent(evidence.v2.combined_forward.naive.pbias)}</td>
                    <td>−25% to +25%</td>
                  </tr>
                  <tr>
                    <th scope="row">Weekly Spearman</th>
                    <td>
                      {evidence.v2.combined_forward.weekly.spearman.toFixed(3)}
                    </td>
                    <td>
                      {evidence.v2.combined_forward.naive.spearman.toFixed(3)}
                    </td>
                    <td>At least 0.75</td>
                  </tr>
                  <tr>
                    <th scope="row">Weekly MAE (MW)</th>
                    <td>
                      {formatMetric(evidence.v2.combined_forward.weekly.mae)}
                    </td>
                    <td>
                      {formatMetric(evidence.v2.combined_forward.naive.mae)}
                    </td>
                    <td>Below the matched benchmark</td>
                  </tr>
                  <tr>
                    <th scope="row">Relative MAE</th>
                    <td>
                      {evidence.v2.combined_forward.weekly.relative_mae.toFixed(
                        3,
                      )}
                    </td>
                    <td>
                      {evidence.v2.combined_forward.naive.relative_mae.toFixed(
                        3,
                      )}
                    </td>
                    <td>At most 0.45</td>
                  </tr>
                  <tr>
                    <th scope="row">Daily 80% interval coverage</th>
                    <td>{percent(evidence.v2.combined_forward.picp_daily)}</td>
                    <td>Not applicable</td>
                    <td>70%–92%</td>
                  </tr>
                  <tr>
                    <th scope="row">Median relative interval width</th>
                    <td>
                      {evidence.v2.combined_forward.median_relative_width.toFixed(
                        2,
                      )}
                    </td>
                    <td>Not applicable</td>
                    <td>At most 2.0</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="footnote">
              Weekly metrics use the mean of matched valid daily values, with at
              least five paired days per ISO week. Interval coverage is daily,
              not weekly. The benchmark ranks weeks slightly better; calibration
              improves magnitude and bias.
            </p>
            {manifest?.approval ? (
              <aside className="observation-notice">
                <strong>PLAN A · SCIENTIFIC OWNER APPROVAL</strong>
                <span>{manifest.approval.approved_claim}</span>
                <span>
                  Publication scope: both complete MODIS platforms only.{" "}
                  <a href={repo + manifest.approval.record_path}>
                    Read the decision ↗
                  </a>
                </span>
              </aside>
            ) : (
              <p className="notice">
                Test success and publication approval are separate records. The
                calendar enables calibrated estimates only when its export
                contains the scientific owner's matching approval and
                complete-platform scope.
              </p>
            )}
          </section>
          <section className="panel">
            <span className="eyebrow">KEEP THE LIMITATIONS VISIBLE</span>
            <h2>Strongest evidence is in 2020–2024.</h2>
            <aside className="notice">
              <strong>
                Published calendar: {evidence.publication.total_days} estimates,
                not {evidence.v2.combined_forward.paired_days} validation dates.
              </strong>
              <p>
                Only {evidence.publication.by_year["2025"]} published estimates
                in 2025 and {evidence.publication.by_year["2026"]} in 2026. Of
                all published dates,{" "}
                {evidence.publication.by_sample_role.training_window_in_sample}{" "}
                are in the training period and provide no validation evidence;{" "}
                {evidence.publication.by_sample_role.post_hoc_examined_holdout}{" "}
                were previously examined;{" "}
                {evidence.publication.by_sample_role.independent_holdout} belong
                to the registered independent holdout. The scientific owner
                limited publication to both complete platforms, a stricter
                availability condition than the validation cohort.
              </p>
              <p>
                {evidence.publication.extrapolated_days} published dates are
                marked beyond the training range. No independent backward test
                is available.
              </p>
            </aside>
            <p>
              Paired test days by year:{" "}
              {Object.entries(evidence.v2.paired_days_by_year)
                .map(([year, count]) => `${year}: ${count}`)
                .join(" · ")}
              .
            </p>
            <ul>
              <li>
                Only 28 paired days in 2025 and 13 in 2026. Recent-year
                performance is less well supported.
              </li>
              <li>
                There is no independent backward test. The earlier 2012–2015
                result is descriptive evidence, not independent validation.
              </li>
              <li>
                Daily interval coverage is{" "}
                {percent(evidence.v2.combined_forward.picp_daily)}, near the
                registered 70% floor.
              </li>
              <li>
                Native and calibrated dates without sufficient inputs remain
                gaps. Positive-only detections do not establish cloud-free
                coverage or true zeros.
              </li>
              <li>
                Passing calibration does not approve seasonal anomaly detection,
                future predictions or fire alerts.
              </li>
            </ul>
          </section>
          <section className="panel">
            <span className="eyebrow">RESEARCH HISTORY</span>
            <h2>The rejected model remains in the record.</h2>
            <ol className="research-history">
              <li>
                <strong>V1 rejected.</strong> The forward candidate had bias{" "}
                {percent(evidence.v1.combined_forward.weekly.pbias)} and MAE{" "}
                {formatMetric(evidence.v1.combined_forward.weekly.mae)} MW,
                worse than its matched benchmark. Its Plan B outcome is
                preserved.
              </li>
              <li>
                <strong>Diagnosis and revised v2.</strong> The revised model
                extrapolates its quantile tails and aligns Terra night to the
                following reference date. Selection uses training-only weekly
                performance. The earlier test was already examined, so its v2
                rerun is labeled post-hoc.
              </li>
              <li>
                <strong>Independent test registered before acquisition.</strong>{" "}
                {evidence.v2.completed_blocks} blocks completed,{" "}
                {evidence.v2.missing_blocks} missing. V2 passed the registered
                combined forward checks. Scientific approval and publication
                scope are recorded separately.
              </li>
            </ol>
            <p className="footnote">
              V1 and v2 evaluations use different cohorts; do not interpret
              their displayed metrics as a paired head-to-head improvement
              estimate.
            </p>
            <details>
              <summary>Evidence and model identity</summary>
              <p className="research-hash">
                V2 SHA-256: {evidence.v2.model_sha256}
              </p>
              <p>Registration: {evidence.v2.registered_at_utc}</p>
              <ul>
                {evidence.provenance.map((p) => (
                  <li key={p.path}>
                    <a href={repo + p.path}>{p.path}</a>
                    <small className="research-hash">SHA-256 {p.sha256}</small>
                  </li>
                ))}
              </ul>
              <a href={repo + "docs/harmonization-v2-candidate.md"}>
                Full scientific protocol ↗
              </a>
            </details>
          </section>
        </>
      )}
      <section className="panel">
        <h2>Sources and AI assistance</h2>
        <ul>
          <li>
            <a href="https://firms.modaps.eosdis.nasa.gov/">NASA FIRMS</a>:
            Standard Processing MODIS Terra/Aqua and VIIRS Suomi-NPP
            observations and FRP.
          </li>
          <li>
            <a href="https://geoftp.ibge.gov.br/informacoes_ambientais/estudos_ambientais/biomas/vetores/2025_Biomas-e-Sistema-Costeiro-Marinho-do-Brasil-1-250000_shp.zip">
              IBGE 2025
            </a>
            : official Pantanal biome boundary, 1:250,000.
          </li>
          <li>
            <a href="https://brasil.mapbiomas.org/">MapBiomas Collection 11</a>:
            optional 2020 land-cover context, 30 m, coverage asset v3.
          </li>
          <li>
            <a href="https://nasa-gibs.github.io/gibs-api-docs/access-basics/">
              NASA GIBS
            </a>
            : optional MODIS Terra true-color context imagery.
          </li>
          <li>
            <a href="https://www.openstreetmap.org/copyright">
              OpenStreetMap contributors
            </a>
            : basemap.
          </li>
        </ul>
        <p>
          Context imagery and land cover do not generate fire detections or
          prove sensor coverage. AI assistants helped implement code, tests,
          documentation and research diagnostics; original NASA observations
          were not generated by AI. Separate demonstration fixtures are
          synthetic and labeled.
        </p>
        <a href="/ai-disclosure.json">Machine-readable AI disclosure</a> ·{" "}
        <a href={repo + "docs/ai-disclosure.md"}>AI use and provenance</a>
      </section>
    </div>
  );
}
