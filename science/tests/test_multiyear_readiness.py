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
