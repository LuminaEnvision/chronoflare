"""Reproduce frozen solar evidence offline and export exact day/platform records."""
import argparse
import json
from pathlib import Path
import shutil
import sys
import tempfile

from firms_pilot import cached_downloader
from normalize_detections import NormalizationError, file_hash
from solar_preview import prepare_preview

FIELDS = ("request_id", "source_record", "source_file_sha256", "acquired_at_utc",
          "longitude", "latitude", "frp_mw", "confidence_raw", "source_type",
          "candidate_quality_pass", "candidate_quality_reasons")
SLUGS = {"Terra": "terra", "Aqua": "aqua", "S-NPP": "snpp"}


def export_records(*, evidence, preview, output):
    output = output.resolve()
    project = Path(__file__).resolve().parents[2]
    allowed = project / "app/public/data/experimental/records-v1"
    if output.exists() or (output.is_relative_to(project / "app") and output != allowed) or output.is_relative_to(project / "dist"):
        raise NormalizationError("Choose a new offline destination or the explicit solar record asset directory.")
    preview_digest = file_hash(preview)
    expected = json.loads(preview.read_text())
    with tempfile.TemporaryDirectory(prefix="solar-records-") as temporary:
        root = Path(temporary)
        reproduced = prepare_preview(evidence=evidence, output=root / "evidence", map_key="offline-replay", downloader=cached_downloader(evidence))
        if reproduced != expected:
            raise NormalizationError("Reproduced evidence does not match the frozen calendar snapshot.")
        records = [json.loads(line) for line in (root / "evidence/regional-detections.jsonl").read_text().splitlines()]
        assets = root / "assets"
        assets.mkdir()
        entries = []
        for cell in reproduced["records"]:
            rows = [row for row in records if row["satellite"] == cell["platform"] and row["local_solar_date"] == cell["solar_date"]]
            if len(rows) != (cell["all_detections"]["detection_count"] or 0) or sum(row["candidate_quality_pass"] for row in rows) != (cell["proposed_filter"]["detection_count"] or 0):
                raise NormalizationError("Exported rows do not reconcile with calendar counts.")
            identities = [(row["source_file_sha256"], row["source_record"]) for row in rows]
            if len(set(identities)) != len(identities):
                raise NormalizationError("A source row was repeated during export.")
            path = assets / SLUGS[cell["platform"]] / (cell["solar_date"] + ".json")
            path.parent.mkdir(exist_ok=True)
            value = {"schema_version": "solar-records/1.0.0", "solar_date": cell["solar_date"], "platform": cell["platform"],
                     "period_start_utc": cell["period_start_utc"], "period_end_utc_exclusive": cell["period_end_utc_exclusive"],
                     "records": [{key: row[key] for key in FIELDS} for row in rows]}
            path.write_text(json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n")
            entries.append({"path": path.relative_to(assets).as_posix(), "sha256": file_hash(path), "bytes": path.stat().st_size,
                            "solar_date": cell["solar_date"], "platform": cell["platform"], "record_count": len(rows),
                            "proposed_filter_count": sum(row["candidate_quality_pass"] for row in rows)})
        manifest = {"schema_version": "solar-record-manifest/1.0.0", "status": "real_unreviewed",
                    "preview_sha256": preview_digest, "quality_rule": reproduced["quality_rule"],
                    "record_count": len(records), "entries": entries}
        (assets / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        output.parent.mkdir(parents=True, exist_ok=True)
        if file_hash(preview) != preview_digest:
            raise NormalizationError("Calendar snapshot changed during export.")
        output.mkdir()
        try:
            shutil.copytree(assets, output, dirs_exist_ok=True)
        except OSError:
            shutil.rmtree(output)
            raise
        return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--preview", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        report = export_records(**vars(args))
    except (NormalizationError, OSError, ValueError, KeyError):
        parser.exit(1, "Error: solar record export failed validation; no dataset should be promoted.\n")
    print(f"Exported {report['record_count']} traceable records in {len(report['entries'])} day/platform shards.")


if __name__ == "__main__":
    main()
