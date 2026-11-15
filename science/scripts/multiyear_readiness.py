"""Reconstruct complete frozen blocks and audit actual support without fitting."""
from collections import Counter, defaultdict
from datetime import date, timedelta
import argparse
import json
from pathlib import Path
import shutil
import tempfile

from shapely import intersects_xy
from acquisition_plan import fingerprint, load_plan
from acquire_multiyear import DEFAULT_PLAN, PROJECT, verify_entry, write_json
from firms_pilot import load_pinned_boundary
from indicator_methods import DEDUP_VERSION, observed_turns, paired_iso_weeks, quality_then_deduplicate
from indicator_quality import RULE_VERSION
from normalize_detections import file_hash, normalize_csv
from scientific_thresholds import assess_strata, load_thresholds
from solar_time import local_solar_date
from validation_preflight import Experiment, TurnObservation, pair_observations


def experiment_for(thresholds, name):
    section=thresholds["temporal_splits"][name]
    return Experiment(section["train_period"]["start_solar_date"],section["train_period"]["end_solar_date"],
                      section["test_period_out_of_sample"]["start_solar_date"],section["test_period_out_of_sample"]["end_solar_date"])


def support_audit(pairs, thresholds):
    """Native positive support is a prerequisite, never an empirical model score."""
    report={}
    for name in ("forward_validation_primary","backward_transfer_validation"):
        experiment=experiment_for(thresholds,name)
        strata=assess_strata(pairs,thresholds,name)
        groups=defaultdict(set)
        for row in pairs:
            if row["metric"]=="frp_sum_mw" and experiment.split(row["solar_date"])=="test":
                groups[(row["predictor_platform"],row["solar_date"])].add(row["day_night"])
        days=sorted({day for (_,day),turns in groups.items() if turns=={"D","N"}})
        weeks=paired_iso_weeks([{"solar_date":day,"observed":1.,"estimated":1.} for day in days],experiment.test_start,
                               (date.fromisoformat(experiment.test_end)+timedelta(days=1)).isoformat())
        valid_weeks=sum(row["eligible_weekly_support"] for row in weeks)
        limits=thresholds["minimum_sample_requirements"]["aoi_level_validation"]
        prefix="forward" if name=="forward_validation_primary" else "backward"
        global_pass=len(days)>=limits[prefix+"_test_min_valid_days"] and valid_weeks>=limits[prefix+"_test_min_valid_weeks"]
        report[name]={"strata":strata,"candidate_complete_test_days":len(days),"candidate_valid_test_weeks":valid_weeks,
                      "global_support_sufficient":global_pass,"sample_sufficient":global_pass and strata["all_required_strata_eligible"],
                      "note":"Week support only, computed from date membership; no fabricated metric values are reported"}
    return {"experiments":report,"all_samples_sufficient":all(row["sample_sufficient"] for row in report.values()),
            "fit_performed":False,"validation_performed":False,"harmonization_approved":False}


def reconstruct(*, cache, output):
    cache=cache.resolve();output=output.resolve()
    if output.exists() or any(output.is_relative_to(PROJECT/name) for name in ("app","dist")):
        raise ValueError("Choose a new offline output directory")
    plan=load_plan(cache/"plan.json")
    acquisition=json.loads((cache/"manifest.json").read_text())
    failures=[{"id":r["id"],"reason":r["reason"]} for r in acquisition.get("failures",[]) if r.get("id") in {q["id"] for q in plan["requests"]} and r.get("reason") in {"rate_limit","response_schema","transport_or_validation","attempt_budget_exhausted", "provider_or_transport_failed_or_budget_exhausted", "connectivity", "csv_structure", "response_too_large", "csv_non_finite_value", "csv_outside_requested_bbox", "csv_negative_frp", "csv_outside_requested_dates", "csv_invalid_clock", "csv_missing_required_value"} | {"http_"+str(n) for n in range(100,600)}]
    entries=[]
    for request in plan["requests"]:
        if (cache/"raw"/request["id"]).exists(): entries.append(verify_entry(cache,request))
    available={row["id"] for row in entries}
    complete_blocks=[block for block in plan["blocks"] if all(r["id"] in available for r in plan["requests"] if r["block_id"]==block["id"])]
    polygon,manifest=load_pinned_boundary(PROJECT/"app/public/data/detection-review/v1")
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="multiyear-observed-",dir=output.parent) as temporary:
        staging=Path(temporary);cells=[];audits=[]
        for block in complete_blocks:
            rows=[]
            for request in (r for r in plan["requests"] if r["block_id"]==block["id"]):
                raw=cache/"raw"/request["id"];normal=staging/"normal"
                normalize_csv(input_path=raw/"detections.csv",source=request["source"],output=normal,provenance=raw/"provenance.json")
                normalized=[json.loads(line) for line in (normal/"detections.jsonl").read_text().splitlines()]
                mask=intersects_xy(polygon,[r["longitude"] for r in normalized],[r["latitude"] for r in normalized]) if normalized else []
                for row,inside in zip(normalized,mask):
                    day=local_solar_date(row["acquired_at_utc"])
                    if inside and block["solar_start"]<=day<=block["solar_end"]:
                        rows.append({**row,"region_id":plan["region_id"],"local_solar_date":day,"request_id":request["id"]})
                shutil.rmtree(normal)
            winners,dispositions=quality_then_deduplicate(rows)
            cells.extend(observed_turns(winners,block["solar_start"],block["solar_end"]))
            disposition_path=staging/(block["id"]+"-dispositions.jsonl")
            with disposition_path.open("w") as stream:
                for row in dispositions: stream.write(json.dumps(row,allow_nan=False)+"\n")
            audits.append({"block_id":block["id"],"regional_rows":len(rows),"quality_pass_count":sum(row["quality_pass"] for row in dispositions),
                           "selected_count":len(winners),"exclusion_counts":dict(Counter(row["indicator_exclusion"] or "included" for row in dispositions)),
                           "dispositions_sha256":file_hash(disposition_path)})
            print(f"Reconstructed {block['id']}: {len(winners)} selected records",flush=True)
        observations=[TurnObservation(region_id=plan["region_id"],solar_date=row["solar_date"],platform=row["platform"],day_night=row["day_night"],
                      metric="frp_sum_mw",value=row["observed_frp_sum_mw"],dataset_version="multiyear-observed/1.0.0",quality_rule_version=RULE_VERSION,dedup_rule_version=DEDUP_VERSION) for row in cells]
        thresholds=load_thresholds();experiment=experiment_for(thresholds,"forward_validation_primary")
        pairs=[]
        for platform in ("Terra","Aqua"):
            pairs.extend(pair_observations([r for r in observations if r.platform in (platform,"S-NPP")],platform,"S-NPP",experiment)["pairs"])
        readiness=support_audit(pairs,thresholds)
        summary={"schema_version":"multiyear-observed/1.0.0","plan_fingerprint":fingerprint(plan),"region_id":plan["region_id"],
                 "boundary_sha256":manifest["pantanal"]["boundary"]["sha256"],"source_entries":entries,
                 "acquisition_failures":failures,"complete_acquisition":len(entries)==plan["request_count"],"completed_blocks":[r["id"] for r in complete_blocks],
                 "missing_blocks":[r["id"] for r in plan["blocks"] if r not in complete_blocks],"block_audits":audits,"cells":cells,"pairs":pairs,
                 "sample_readiness":readiness,"fit_performed":False,"validation_performed":False,"harmonization_approved":False}
        write_json(staging/"observations.json",summary)
        public={key:value for key,value in summary.items() if key not in ("cells","pairs")}
        write_json(staging/"readiness.json",public)
        output.mkdir();shutil.copytree(staging,output,dirs_exist_ok=True)
        return summary


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    try: result=reconstruct(**vars(args))
    except (ValueError,OSError,KeyError): parser.exit(1,"Error: source-bound reconstruction failed validation.\n")
    print(json.dumps({"completed_blocks":result["completed_blocks"],"all_samples_sufficient":result["sample_readiness"]["all_samples_sufficient"]}))
