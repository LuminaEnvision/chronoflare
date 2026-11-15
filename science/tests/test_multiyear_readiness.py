from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from acquire_multiyear import acquire
from multiyear_readiness import reconstruct, support_audit
from scientific_thresholds import load_thresholds
from test_acquire_multiyear import fake_download
from test_scientific_thresholds import synthetic_evidence


class MultiyearReadinessTests(unittest.TestCase):
    def test_empty_or_partial_cache_does_not_manufacture_complete_blocks(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);cache=root/"cache"
            acquire(root=cache,max_new_requests=1,downloader=fake_download,sleep=lambda _:None)
            result=reconstruct(cache=cache,output=root/"observed")
            self.assertEqual(result["completed_blocks"],[])
            self.assertEqual(result["pairs"],[])
            self.assertFalse(result["complete_acquisition"])
            self.assertFalse(result["sample_readiness"]["all_samples_sufficient"])

    def test_complete_empty_block_keeps_null_observations(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);cache=root/"cache"
            acquire(root=cache,max_new_requests=26,downloader=fake_download,sleep=lambda _:None)
            result=reconstruct(cache=cache,output=root/"observed")
            self.assertEqual(result["completed_blocks"],["2017-dry"])
            self.assertEqual(len(result["cells"]),63*6)
            self.assertTrue(all(row["observed_frp_sum_mw"] is None for row in result["cells"]))
            self.assertFalse(result["sample_readiness"]["all_samples_sufficient"])

    def test_sample_support_is_not_model_approval(self):
        pairs,_=synthetic_evidence()
        result=support_audit(pairs,load_thresholds())
        self.assertTrue(result["all_samples_sufficient"])
        self.assertFalse(result["fit_performed"])
        self.assertFalse(result["validation_performed"])
        self.assertFalse(result["harmonization_approved"])
        without_night=[row for row in pairs if row["day_night"]=="D"]
        result=support_audit(without_night,load_thresholds())
        self.assertFalse(result["all_samples_sufficient"])
        self.assertEqual(result["experiments"]["forward_validation_primary"]["candidate_complete_test_days"],0)

    def test_negative_source_row_is_retained_but_never_wins_or_aggregates(self):
        import json
        from normalize_detections import file_hash
        def download(**kw):
            meta=fake_download(**kw)
            if kw["source"]=="MODIS_SP" and kw["start"]=="2017-08-01":
                path=kw["output"]/"detections.csv"
                path.write_text("latitude,longitude,acq_date,acq_time,satellite,confidence,frp,instrument,daynight,type\n"
                                "-18.5,-56.5,2017-08-01,0430,Terra,85,-999,MODIS,D,0\n"
                                "-18.5,-56.5,2017-08-01,0430,Terra,85,12.5,MODIS,D,0\n")
                meta.update(sha256=file_hash(path),bytes=path.stat().st_size,row_count=2)
                (kw["output"]/"provenance.json").write_text(json.dumps(meta))
            return meta
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);cache=root/"cache"
            acquire(root=cache,max_new_requests=26,downloader=download,sleep=lambda _:None)
            result=reconstruct(cache=cache,output=root/"observed")
            audit=result["block_audits"][0]
            self.assertEqual(audit["regional_rows"],2)
            self.assertEqual(audit["selected_count"],1)
            self.assertEqual(audit["raw_negative_frp_rows"],1)
            self.assertEqual(audit["quality_reason_counts"]["non_positive_frp"],1)
            self.assertEqual(audit["exclusion_counts"]["quality_rejected"],1)
            self.assertEqual(sum(r["observed_frp_sum_mw"] or 0 for r in result["cells"]),12.5)
            rejected=[json.loads(line) for line in (root/"observed/2017-dry-dispositions.jsonl").read_text().splitlines() if json.loads(line)["frp_mw"]<0]
            self.assertEqual(len(rejected),1)
            self.assertIn("non_positive_frp",rejected[0]["quality_reasons"])
            self.assertFalse(rejected[0]["indicator_included"])
