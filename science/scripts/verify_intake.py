"""Verify local intake package integrity, not NASA authenticity or scientific validity."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from normalize_detections import NormalizationError, file_hash
from request_checks import check_request


def read_object(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, UnicodeError):
        raise NormalizationError("Package metadata must be valid UTF-8 JSON.") from None
    if not isinstance(value, dict):
        raise NormalizationError("Package metadata must be a JSON object.")
    return value


def member(root: Path, relative: str) -> Path:
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
        raise NormalizationError("Package member paths must be relative.")
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise NormalizationError("Package member is missing or escapes the package.")
    return path


def verify_intake(package: Path, expected_sha256: str | None = None) -> dict:
    root = package.resolve()
    batch_path = member(root, "batch-report.json")
    digest = file_hash(batch_path)
    if expected_sha256 is not None and digest != expected_sha256:
        raise NormalizationError("Batch report hash differs from the trusted expected hash.")
    batch = read_object(batch_path)
    if batch.get("schema_version") != "raw-intake/1.0.0" or batch.get("scientific_status") != "unreviewed" or batch.get("coverage_status") != "unknown":
        raise NormalizationError("Unsupported intake schema or scientific/coverage status.")
    files = batch.get("files")
    if not isinstance(files, list) or not files or type(batch.get("file_count")) is not int or batch["file_count"] != len(files):
        raise NormalizationError("Batch file count is inconsistent.")
    requests = batch.get("request_checks", {})
    if not isinstance(requests, dict):
        raise NormalizationError("Request checks must be an object keyed by file ID.")
    ids, paths, hashes = set(), set(), {}
    total = 0
    for entry in files:
        if not isinstance(entry, dict) or not isinstance(entry.get("id"), str) or entry["id"] in ids:
            raise NormalizationError("Batch file IDs must be unique strings.")
        ids.add(entry["id"])
        report_path = member(root, entry.get("report_file"))
        if report_path in paths:
            raise NormalizationError("Batch entries must reference distinct reports.")
        paths.add(report_path)
        if file_hash(report_path) != entry.get("report_sha256"):
            raise NormalizationError(f"File {entry['id']}: report hash mismatch.")
        report = read_object(report_path)
        embedded = {key: value for key, value in entry.items() if key not in {"id", "report_file", "report_sha256"}}
        if embedded != report:
            raise NormalizationError(f"File {entry['id']}: embedded report differs from the individual report.")
        if report.get("schema_version") != "raw-detection/1.0.0" or report.get("scientific_status") != "unreviewed" or report.get("coverage_status") != "unknown":
            raise NormalizationError("Unsupported raw report schema or scientific/coverage status.")
        rows_path = member(report_path.parent, report.get("output_file"))
        if file_hash(rows_path) != report.get("output_sha256"):
            raise NormalizationError(f"File {entry['id']}: detections hash mismatch.")
        count = 0
        try:
            with rows_path.open(encoding="utf-8") as stream:
                for count, line in enumerate(stream, 1):
                    row = json.loads(line)
                    if not isinstance(row, dict) or row.get("source_file_sha256") != report.get("input_sha256") or row.get("source_dataset") != report.get("source_dataset") or type(row.get("source_record")) is not int or row["source_record"] != count:
                        raise NormalizationError(f"File {entry['id']}: record provenance or sequence mismatch.")
        except (ValueError, UnicodeError):
            raise NormalizationError("Detections must contain one valid UTF-8 JSON object per line.") from None
        if type(report.get("record_count")) is not int or count != report["record_count"]:
            raise NormalizationError(f"File {entry['id']}: record count mismatch.")
        if entry["id"] in requests:
            declared = requests[entry["id"]]
            if not isinstance(declared, dict) or check_request(rows_path, declared.get("request")) != declared:
                raise NormalizationError("Request window check is inconsistent with detections.")
        source_hash = report.get("input_sha256")
        if not isinstance(source_hash, str):
            raise NormalizationError("Input hash must be a string.")
        hashes.setdefault(source_hash, []).append(entry["id"])
        total += count
    if set(requests) - ids:
        raise NormalizationError("Request checks reference an unknown file ID.")
    if type(batch.get("record_count")) is not int or batch["record_count"] != total:
        raise NormalizationError("Batch record count is inconsistent.")
    if batch.get("repeated_input_groups") != [group for group in hashes.values() if len(group) > 1]:
        raise NormalizationError("Repeated input groups are inconsistent.")
    return {"batch_sha256": digest, "file_count": len(files), "record_count": total, "trusted_hash_checked": expected_sha256 is not None}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--expected-sha256", help="Batch report hash received through a trusted separate channel")
    args = parser.parse_args(argv)
    try:
        report = verify_intake(args.package, args.expected_sha256)
    except NormalizationError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    except OSError:
        print("Error: cannot read package; check paths and permissions.", file=sys.stderr)
        return 1
    print(json.dumps(report, indent=2))
    print("Integrity checks passed. NASA authenticity, raw-file availability, coverage and scientific approval were not verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
