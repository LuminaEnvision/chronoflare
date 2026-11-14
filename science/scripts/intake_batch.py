"""Normalize an explicit manifest of local FIRMS CSVs without scientific approval."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile

from normalize_detections import NormalizationError, PLATFORMS, file_hash, normalize_csv


def intake_batch(manifest: Path, output: Path) -> dict:
    manifest = manifest.resolve()
    digest = file_hash(manifest)
    try:
        config = json.loads(manifest.read_text(encoding="utf-8"))
    except (ValueError, UnicodeError):
        raise NormalizationError("Manifest must be valid UTF-8 JSON.") from None
    if not isinstance(config, dict) or set(config) != {"schema_version", "files"} or config["schema_version"] != "raw-intake/1.0.0":
        raise NormalizationError("Manifest requires schema_version raw-intake/1.0.0 and files only.")
    files = config["files"]
    if not isinstance(files, list) or not files:
        raise NormalizationError("Manifest files must be a nonempty list.")
    entries, ids = [], set()
    for entry in files:
        if not isinstance(entry, dict) or not {"id", "input", "source"}.issubset(entry) or set(entry) - {"id", "input", "source", "provenance"}:
            raise NormalizationError("Each file requires id, input, source and optional provenance only.")
        identifier = entry["id"]
        if not isinstance(identifier, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", identifier) or identifier in ids:
            raise NormalizationError("File IDs must be unique lowercase letters, digits, underscores or hyphens (1–64 characters).")
        ids.add(identifier)
        if not isinstance(entry["source"], str) or entry["source"] not in PLATFORMS:
            raise NormalizationError("Each file requires a supported explicit SP source.")
        paths = {}
        for key in ("input", "provenance"):
            if key in entry:
                if not isinstance(entry[key], str) or not entry[key].strip():
                    raise NormalizationError("Input and provenance paths must be nonempty strings.")
                paths[key] = (manifest.parent / entry[key]).resolve()
        entries.append((entry, paths))
    project = Path(__file__).resolve().parents[2]
    output = output.resolve()
    if any(output.is_relative_to(project / name) for name in ("app", "dist")):
        raise NormalizationError("Unreviewed batches cannot be written into app/ or dist/.")
    if output.exists():
        raise NormalizationError("Output already exists; choose a new directory.")
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".intake-", dir=output.parent))
    try:
        reports, hashes = [], {}
        for entry, paths in entries:
            try:
                report = normalize_csv(input_path=paths["input"], source=entry["source"], output=staging / entry["id"], provenance=paths.get("provenance"))
            except NormalizationError as error:
                raise NormalizationError(f"File {entry['id']}: {error}") from None
            hashes.setdefault(report["input_sha256"], []).append(entry["id"])
            reports.append({"id": entry["id"], "report_file": f"{entry['id']}/report.json", "report_sha256": file_hash(staging / entry["id"] / "report.json"), **report})
        if file_hash(manifest) != digest:
            raise NormalizationError("Manifest changed during intake; retry with a stable file.")
        summary = {
            "schema_version": "raw-intake/1.0.0", "manifest_sha256": digest,
            "file_count": len(reports), "record_count": sum(item["record_count"] for item in reports),
            "scientific_status": "unreviewed", "coverage_status": "unknown",
            "repeated_input_groups": [group for group in hashes.values() if len(group) > 1],
            "notice": "Counts include repeated files and records. No merging, cross-file deduplication, AOI filtering, coverage inference or frontend export was performed. Acquisition ranges describe detections only; provenance consistency does not authenticate NASA origin.",
            "files": reports,
        }
        (staging / "batch-report.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        # Reserve the destination before publishing; never replace an existing package.
        output.mkdir()
        try:
            for item in staging.iterdir():
                item.rename(output / item.name)
        except OSError:
            shutil.rmtree(output)
            raise
        return summary
    finally:
        shutil.rmtree(staging)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        report = intake_batch(**vars(args))
    except NormalizationError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except OSError:
        print("Error: cannot read inputs or save output; check paths and permissions.", file=sys.stderr)
        return 1
    print(f"Normalized {report['file_count']} files with {report['record_count']} records. Scientific status is unreviewed; coverage is unknown.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
