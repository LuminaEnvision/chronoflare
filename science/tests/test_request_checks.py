import csv
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from intake_batch import intake_batch
from normalize_detections import NormalizationError
from request_checks import validate_request
from verify_intake import verify_intake


class RequestChecksTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifest = self.root / 'manifest.json'
        self.output = self.root / 'batch'
        self.request = {'id':'848303','start_date':'2020-08-01','end_date':'2020-08-15'}

    def intake(self, days):
        with (self.root / 'raw.csv').open('w',newline='') as stream:
            writer=csv.writer(stream)
            writer.writerow(['latitude','longitude','acq_date','acq_time','satellite','confidence','frp'])
            for day in days:writer.writerow([-18,-56,day,'2359','T',10,0])
        self.manifest.write_text(json.dumps({'schema_version':'raw-intake/1.0.0','files':[{'id':'modis','input':'raw.csv','source':'MODIS_SP','request':self.request}]}))
        return intake_batch(self.manifest,self.output)

    def test_inclusive_dates_and_verifier(self):
        report=self.intake(['2020-08-01','2020-08-15'])
        check=report['request_checks']['modis']
        self.assertEqual(check['status'],'within_window')
        self.assertEqual(check['within_window_count'],2)
        self.assertEqual(verify_intake(self.output)['record_count'],2)

    def test_outside_records_flagged_but_retained(self):
        report=self.intake(['2020-07-31','2020-08-01','2020-08-16'])
        check=report['request_checks']['modis']
        self.assertEqual(check['status'],'outside_window')
        self.assertEqual([check[k] for k in ['before_window_count','within_window_count','after_window_count']],[1,1,1])
        self.assertEqual(verify_intake(self.output)['record_count'],3)

    def test_empty_file_has_no_records_status(self):
        report=self.intake([])
        self.assertEqual(report['request_checks']['modis']['status'],'no_records')
        self.assertEqual(report['coverage_status'],'unknown')

    def test_invalid_request_rejected_before_output(self):
        for changes in [{'id':123},{'id':'bad-id'},{'start_date':'2020-02-30'},{'end_date':'2019-01-01'},{'end_date':None},{'extra':True}]:
            with self.subTest(changes=changes):
                request={**self.request,**changes}
                with self.assertRaises(NormalizationError):validate_request(request)
                self.assertFalse(self.output.exists())

    def test_tampered_window_result_rejected(self):
        self.intake(['2020-08-01'])
        path=self.output / 'batch-report.json'
        report=json.loads(path.read_text())
        report['request_checks']['modis']['within_window_count']=99
        path.write_text(json.dumps(report))
        with self.assertRaisesRegex(NormalizationError,'inconsistent'):verify_intake(self.output)

    def test_unknown_file_reference_rejected(self):
        self.intake(['2020-08-01'])
        path=self.output / 'batch-report.json'
        report=json.loads(path.read_text())
        report['request_checks']['missing']=report['request_checks']['modis']
        path.write_text(json.dumps(report))
        with self.assertRaisesRegex(NormalizationError,'unknown file'):verify_intake(self.output)
