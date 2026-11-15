# Observation export contract for the app

Ownership: Claude Code owns scientific approval registration, frozen-model application,
source acquisition and the export below. Codex owns the browser consumer, calendar,
same-source comparison, validation panel and UI tests. Neither side changes the frozen
v2 engine, model, registered test, thresholds or historical reports for this integration.

The project owner relayed André's written approval of Plan A, limited to days with
both complete MODIS platforms. Record that reply before exporting approved estimates.
Keep native Terra solar dates unchanged. Only harmonized inference uses the registered
Terra-night alignment to the following reference date.

## Files

Export real aggregates, not raw detections, to `app/public/data/observations/v1/`.
Do not add generated placeholder values when data are unavailable.

`manifest.json`:

```json
{
  "schema_version": "chronoflare-observations/1.0.0",
  "region_id": "pantanal_ibge_2025_reference",
  "region_name": "Brazilian Pantanal",
  "solar_offset_seconds": -13596,
  "coverage_status": "unknown",
  "quality_rule_version": "indicator-sp-quality/1.0.0",
  "dedup_rule_version": "indicator-exact-key/python-float64-round-1.1.0",
  "source_observation_sha256": ["64-character source reconstruction hashes"],
  "approval": {
    "decision": "plan_a",
    "reviewed_by": "André Salles",
    "scope": "both_complete_platforms",
    "model_sha256": "3c39071a245d071c60e0838d6092a793190f98e2416e2074bbf75911e00aa3ba",
    "record_path": "science/configs/harmonization_decision.json",
    "approved_claim": "Harmonized series for the Pantanal, validated in an independent 2020–2026 test, with limited coverage in 2025–2026 and no independent backward test."
  },
  "years": [
    {"year": 2020, "path": "/data/observations/v1/2020.json", "sha256": "64-character hash", "bytes": 123, "day_count": 366}
  ]
}
```

The example values `bytes`, `day_count` and `years` illustrate structure only;
calculate them from the actual export. `approval` may be null for native-only export;
the consumer must reject non-null harmonized values without matching approval.

Each year JSON has `schema_version: "chronoflare-observation-year/1.0.0"`, `year`
and chronologically sorted `days`. Include one row for each actually acquired
solar date. Missing dates mean not acquired, not zero. An acquired date with no
selected positives still has its row and null turns.

Each day:

```json
{
  "date": "2020-08-01",
  "terra": {"day": {"frp_mw": 12.3, "count": 2}, "night": null},
  "aqua": {"day": null, "night": null},
  "snpp": {"day": null, "night": null},
  "harmonized": null
}
```

A non-null native turn requires finite strictly positive FRP and a positive integer
count after the frozen SP quality/dedup rules. No positive selected rows means null.
A native daily sum is displayed as partial when only one turn is available; two
turns do not establish cloud-free coverage or a complete fire census.

A published non-null `harmonized` object has these fields:

- `value_mw`, `lower_mw`, `upper_mw`: finite values, nonnegative ordered interval; point estimate strictly positive.
- `is_extrapolated`: boolean from the frozen inference policy.
- `regime`: exactly `Terra+Aqua_weighted` (no single-platform publication).
- `inputs`: strictly positive `terra_day_mw`, `terra_night_mw`, `aqua_day_mw`,
  `aqua_night_mw`, and `terra_night_source_date` (previous civil date).
  These are input native turn aggregates, not predictions. Other turn inputs are
  on the row date. This makes complete-platform publication auditable without
  changing native dates. Verify values against reconstructed source observations
  in the exporter; never infer completeness from flags alone.

Do not alter a model interval to force it to contain the point estimate.
Source provenance, approval, safe output paths, SHA-256 and byte counts must be
verified. Preserve gaps and reconcile counts with the underlying reconstruction.

## Division and delivery

Claude Code: register the exact owner reply, implement/export with focused tests,
open a separate PR, and report actual output paths and any contract conflicts.
Do not rerun the single-use independent score. Applying a frozen model for
publication is inference, not a repeat validation or new fit.

Codex: consume this contract, retain source/coverage/partial-turn warnings, gate
harmonized publication on the approval and model identity, preserve URL and browser
history, show the measured v1/v2 history and test the UI on desktop/mobile.
No anomaly/season classification is approved merely by approval of harmonization.

## Integrated delivery

PR #49 supplied the recorded Plan A approval and the complete export: 4,318
acquired dates, 635 published estimates. The approval record lives under
`science/configs/`; the consumer allows this fixed repository directory as well
as `docs/`, with traversal rejected. `sample_role` is consumed via a derived
research sidecar, preserving the exact hashed yearly assets.
