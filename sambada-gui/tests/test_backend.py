#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unit tests for the SAMBADA Studio wrapper (sambada_gui.py).

These test ONLY the overlay logic (p-value computation, results parsing,
demo pre-fill, and the local-API authorization). They do not touch SAMBADA's
own numerical behaviour.

Run from the sambada-gui/ folder:
    python3 -m unittest discover -s tests -v
"""
import http.client
import os
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer

# Make sambada_gui importable when running from tests/.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import sambada_gui as g  # noqa: E402


class TestChi2(unittest.TestCase):
    def test_known_values(self):
        cases = [
            (0.0, 1, 1.0),
            (3.841459, 1, 0.05),        # chi2 0.95 quantile, df=1
            (1.0, 1, 0.3173105),
            (5.991465, 2, 0.05),        # chi2 0.95 quantile, df=2
            (2.0, 2, 0.3678794),        # exp(-1)
            (10.0, 2, 0.006737947),     # exp(-5)
            (11.344867, 3, 0.01),       # chi2 0.99 quantile, df=3
        ]
        for stat, df, expected in cases:
            got = g.chi2_sf(stat, df)
            self.assertAlmostEqual(got, expected, places=5,
                                   msg=f"chi2_sf({stat},{df})={got}, expected {expected}")

    def test_bounds(self):
        self.assertEqual(g.chi2_sf(-5, 1), 1.0)
        self.assertTrue(0.0 <= g.chi2_sf(1000.0, 1) <= 1.0)


class TestAnalyzeResults(unittest.TestCase):
    def _write(self, text):
        fd, path = tempfile.mkstemp(suffix="-Out-1.txt")
        with os.fdopen(fd, "w") as fh:
            fh.write(text)
        self.addCleanup(os.remove, path)
        return path

    def test_basic_parse_sort_and_pvalues(self):
        text = (
            "Marker,Env_1,Loglikelihood,Gscore,WaldScore,NumError,Nagelkerke,AIC,Beta_0,Beta_1\n"
            "m1,E1,-1,10.0,2.0,0,0.5,100,0.1,0.2\n"
            "m2,E1,-1,0.5,0.1,0,0.01,120,0.0,0.01\n"
            "m3,E1,-1,50.0,5.0,3,0.9,90,0.0,1.0\n"   # NumError=3 -> invalid
        )
        path = self._write(text)
        r = g.analyze_results(path, sort="gscore")
        self.assertNotIn("error", r)
        self.assertEqual(r["dimension"], 1)                 # one Env_ column
        self.assertEqual(r["summary"]["total"], 3)
        self.assertEqual(r["summary"]["valid"], 2)          # m3 excluded
        self.assertEqual(r["summary"]["n01"], 1)            # only m1 has p<0.01
        self.assertEqual(r["summary"]["n001"], 0)
        self.assertEqual(r["rows"][0]["marker"], "m1")      # highest G-score first
        self.assertAlmostEqual(r["rows"][0]["pvalue"], g.chi2_sf(10.0, 1), places=9)
        self.assertEqual(r["rows"][0]["beta"], 0.2)         # last Beta_ column

    def test_filter_and_query(self):
        text = (
            "Marker,Env_1,Gscore,NumError\n"
            "alpha,E1,20.0,0\n"
            "beta,E1,0.2,0\n"
        )
        path = self._write(text)
        r = g.analyze_results(path, filt="p01")
        self.assertEqual(r["returned"], 1)                  # only alpha passes p<0.01
        self.assertEqual(r["rows"][0]["marker"], "alpha")
        r2 = g.analyze_results(path, query="beta")
        self.assertEqual([row["marker"] for row in r2["rows"]], ["beta"])

    def test_no_gscore_column(self):
        path = self._write("Marker,Env_1,Something\nm1,E1,1\n")
        self.assertIn("error", g.analyze_results(path))

    def test_missing_file(self):
        self.assertIn("error", g.analyze_results("/no/such/file"))


class TestBuildDemo(unittest.TestCase):
    def test_parses_all_keys(self):
        d = tempfile.mkdtemp()
        self.addCleanup(lambda: __import__("shutil").rmtree(d, ignore_errors=True))
        with open(os.path.join(d, "parameters.txt"), "w") as fh:
            fh.write(
                'HEADERS Yes\nWORDDELIM ","\nNUMVARENV 5\nNUMMARK 1\nNUMINDIV 100\n'
                'IDINDIV "ID"\nCOLSUPENV "ID" x y\nSPATIAL x y CARTESIAN BISQUARE 5\n'
                'AUTOCORR BOTH BOTH 9999\nGWR\nSHAPEFILE\nDIMMAX 1\nSAVETYPE END ALL 0.01\n'
                'INPUTFILE data.txt\n'
            )
        c = g.build_demo(d)
        self.assertTrue(c["headers"])
        self.assertEqual(c["worddelim"], ",")
        self.assertEqual(c["numvarenv"], "5")
        self.assertEqual(c["idindiv"], "ID")
        self.assertEqual(c["colsupenv"], "ID x y")
        self.assertTrue(c["spatial"])
        self.assertEqual((c["spatialLon"], c["spatialLat"]), ("x", "y"))
        self.assertEqual(c["spatialCoord"], "CARTESIAN")
        self.assertEqual(c["spatialNeigh"], "BISQUARE")
        self.assertEqual(c["spatialScale"], "5")
        self.assertTrue(c["autocorr"])
        self.assertEqual(c["autocorrPerm"], "9999")
        self.assertTrue(c["gwr"])
        self.assertTrue(c["shapefile"])
        self.assertEqual(c["savetypeScope"], "ALL")
        self.assertEqual(c["dataFile1"], os.path.join(d, "data.txt"))

    def test_missing_folder(self):
        self.assertIsNone(g.build_demo("/no/such/folder"))

    def test_bundled_example_config(self):
        # The shipped example must yield a complete, self-consistent config.
        c = g.example_config()
        if c is None:
            self.skipTest("bundled example not present")
        self.assertFalse(c["twoFiles"])
        self.assertTrue(c["dataFile1"].endswith("random-sample.txt"))
        self.assertTrue(os.path.isfile(c["dataFile1"]))
        self.assertTrue(c["spatial"])
        self.assertEqual(c["numvarenv"], "5")


class TestApiAuthorization(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), g.Handler)
        cls.port = cls.httpd.server_address[1]
        cls.t = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.t.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def _req(self, path, host=None, token=None, method="GET"):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.putrequest(method, path, skip_host=(host is not None))
        if host is not None:
            conn.putheader("Host", host)
        if token is not None:
            conn.putheader("X-Sambada-Token", token)
        conn.endheaders()
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", "replace")
        conn.close()
        return resp.status, body

    def test_api_requires_token(self):
        status, _ = self._req("/api/info")
        self.assertEqual(status, 403)

    def test_api_accepts_valid_token(self):
        status, body = self._req("/api/info", token=g.TOKEN)
        self.assertEqual(status, 200)
        self.assertIn("version", body)

    def test_api_rejects_wrong_token(self):
        status, _ = self._req("/api/info", token="wrong")
        self.assertEqual(status, 403)

    def test_rejects_foreign_host(self):
        status, _ = self._req("/api/info", host="evil.example.com", token=g.TOKEN)
        self.assertEqual(status, 403)

    def test_index_injects_token(self):
        status, body = self._req("/")
        self.assertEqual(status, 200)
        self.assertIn("SAMBADA_TOKEN", body)


if __name__ == "__main__":
    unittest.main(verbosity=2)
