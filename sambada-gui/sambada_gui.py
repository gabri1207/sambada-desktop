#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SAMBADA Studio -- local graphical interface for SAMBADA.

This program implements NO scientific logic: it is a thin wrapper that builds
the parameter file and calls the compiled binaries (sambada, supervision,
recode-plink, recode-plink-lfmm). SAMBADA's behaviour is therefore strictly
unchanged.

Dependencies : Python 3 standard library only (no pip).
Launch       : python3 sambada_gui.py   (a native window or browser opens).
"""

import json
import math
import heapq
import hmac
import os
import secrets
import sys
import socket
import subprocess
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

# Single source of truth for the version shown across the app.
APP_VERSION = "1.0.0"

# Random per-session secret. It is injected into the served page and required
# on every /api call, so that other pages open in the same browser cannot
# reach the local API (CSRF protection). Regenerated on every launch.
TOKEN = secrets.token_urlsafe(24)

# Host names accepted in the HTTP Host header (loopback only). Together with the
# token this blocks DNS-rebinding attacks that would resolve an external name to
# 127.0.0.1 to talk to the local server.
ALLOWED_HOSTS = {"127.0.0.1", "localhost", "::1"}

# --------------------------------------------------------------------------- #
# Paths & platform detection
# --------------------------------------------------------------------------- #
def resource_base():
    """Resource folder: normal (next to the script) or frozen (PyInstaller)."""
    if getattr(sys, "frozen", False):
        return getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


APP_DIR = resource_base()
WEB_DIR = os.path.join(APP_DIR, "web")
DOCS_DIR = os.path.join(APP_DIR, "docs")
BIN_DIR = os.path.join(APP_DIR, "bin")


def platform_key():
    if sys.platform.startswith("darwin"):
        return "macos"
    if sys.platform.startswith("win"):
        return "windows"
    return "linux"


PLATFORM = platform_key()
EXE_SUFFIX = ".exe" if PLATFORM == "windows" else ""

TOOLS = ("sambada", "supervision", "recode-plink", "recode-plink-lfmm")

# Display mode: "native" (embedded window), "browser" (default browser),
# "managed" (test/preview server only).
RUN_MODE = "browser"


def binary_path(tool):
    """Expected binary path for the current platform."""
    return os.path.join(BIN_DIR, PLATFORM, tool + EXE_SUFFIX)


def available_binaries():
    return {t: os.path.isfile(binary_path(t)) for t in TOOLS}


def bundled_example_dir():
    """Folder of the shipped demo dataset, if present (used by 'Load example')."""
    d = os.path.join(APP_DIR, "examples", "random-data")
    if os.path.isfile(os.path.join(d, "parameters.txt")) and \
       os.path.isfile(os.path.join(d, "random-sample.txt")):
        return d
    return None


# --------------------------------------------------------------------------- #
# Utilities
# --------------------------------------------------------------------------- #
def open_in_os(path):
    """Open a file / folder with the system's default application."""
    try:
        if PLATFORM == "macos":
            subprocess.Popen(["open", path])
        elif PLATFORM == "windows":
            os.startfile(path)  # type: ignore[attr-defined]
        else:
            subprocess.Popen(["xdg-open", path])
        return True, ""
    except Exception as exc:  # pragma: no cover - OS dependent
        return False, str(exc)


def list_dir(path):
    """Safely list a folder, for the file picker."""
    path = os.path.abspath(os.path.expanduser(path or os.path.expanduser("~")))
    if not os.path.isdir(path):
        path = os.path.expanduser("~")
    entries = []
    try:
        for name in sorted(os.listdir(path), key=str.lower):
            if name.startswith("."):
                continue
            full = os.path.join(path, name)
            is_dir = os.path.isdir(full)
            try:
                size = os.path.getsize(full) if not is_dir else 0
            except OSError:
                size = 0
            entries.append({"name": name, "path": full, "is_dir": is_dir, "size": size})
    except PermissionError:
        pass
    # folders first, then files
    entries.sort(key=lambda e: (not e["is_dir"], e["name"].lower()))
    parent = os.path.dirname(path)
    return {
        "path": path,
        "parent": parent if parent != path else None,
        "sep": os.sep,
        "entries": entries,
    }


def free_port(preferred=8765):
    for port in [preferred] + list(range(8766, 8800)):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return 0  # let the OS choose


# --------------------------------------------------------------------------- #
# Results analysis (-Out-N): p-values + sort/filter
# --------------------------------------------------------------------------- #
def chi2_sf(g, df):
    """Upper-tail p-value of a chi-square statistic g with df degrees of freedom."""
    if g <= 0:
        return 1.0
    if df == 1:
        return math.erfc(math.sqrt(g / 2.0))
    a = df / 2.0
    x = g / 2.0
    try:
        if x < a + 1.0:                       # series for the lower incomplete gamma
            ap = a; s = 1.0 / a; d = s
            for _ in range(2000):
                ap += 1.0; d *= x / ap; s += d
                if abs(d) < abs(s) * 1e-14:
                    break
            return max(0.0, min(1.0, 1.0 - s * math.exp(-x + a * math.log(x) - math.lgamma(a))))
        tiny = 1e-300                          # continued fraction for the upper incomplete gamma
        b = x + 1.0 - a; c = 1.0 / tiny; d = 1.0 / b; h = d
        for i in range(1, 2000):
            an = -i * (i - a); b += 2.0
            d = an * d + b
            if abs(d) < tiny: d = tiny
            c = b + an / c
            if abs(c) < tiny: c = tiny
            d = 1.0 / d; delt = d * c; h *= delt
            if abs(delt - 1.0) < 1e-14:
                break
        return max(0.0, min(1.0, math.exp(-x + a * math.log(x) - math.lgamma(a)) * h))
    except (ValueError, OverflowError):
        return 0.0


def _detect_delim(header):
    for delim in (None, ",", "\t", ";"):
        cols = [c.strip() for c in (header.split(delim) if delim else header.split())]
        if "Gscore" in cols:
            return delim, cols
    return None, [c.strip() for c in header.split()]


def analyze_results(path, sort="gscore", filt="all", query="", limit=200):
    """Scan a SAMBADA -Out-N file and return a summary plus the best rows."""
    if not path or not os.path.isfile(path):
        return {"error": "File not found: " + (path or "")}
    try:
        fh = open(path, "r", encoding="utf-8", errors="replace")
    except OSError as exc:
        return {"error": str(exc)}
    with fh:
        header = fh.readline().rstrip("\r\n")
        delim, cols = _detect_delim(header)
        idx = {c: i for i, c in enumerate(cols)}
        if "Gscore" not in idx:
            return {"error": "This file has no association scores. Open an -Out-1 (or higher) file."}
        env_cols = [i for i, c in enumerate(cols) if c.startswith("Env_")]
        beta_cols = [i for i, c in enumerate(cols) if c.startswith("Beta_")]
        i_g = idx["Gscore"]; i_w = idx.get("WaldScore"); i_ne = idx.get("NumError")
        i_nag = idx.get("Nagelkerke"); i_aic = idx.get("AIC")
        # The G-score is a likelihood-ratio statistic; its degrees of freedom equal
        # the number of environmental predictors in the model (the model dimension).
        dim = len(env_cols) or 1
        i_sort = {"gscore": i_g, "wald": i_w, "nagelkerke": i_nag, "aic": i_aic}.get(sort, i_g)
        if i_sort is None: i_sort = i_g
        asc = (sort == "aic")
        pcut = {"all": 1.1, "p01": 0.01, "p001": 0.001, "p1e5": 1e-5}.get(filt, 1.1)
        query = query.lower()

        total = valid = n01 = n001 = n1e5 = 0
        errc = {}; minp = 1.0; heap = []; counter = 0
        for line in fh:
            parts = line.split(delim) if delim else line.split()
            if len(parts) <= i_g:
                continue
            total += 1
            try: ne = int(parts[i_ne]) if i_ne is not None else 0
            except ValueError: ne = -1
            errc[ne] = errc.get(ne, 0) + 1
            if ne != 0:
                continue
            valid += 1
            try: g = float(parts[i_g])
            except ValueError: continue
            p = chi2_sf(g, dim)
            if p < 0.01: n01 += 1
            if p < 0.001: n001 += 1
            if p < 1e-5: n1e5 += 1
            if p < minp: minp = p
            if p >= pcut:
                continue
            env = " x ".join(parts[i] for i in env_cols) if env_cols else ""
            marker = parts[0]
            if query and query not in marker.lower() and query not in env.lower():
                continue

            def num(i):
                try: return float(parts[i])
                except (ValueError, TypeError, IndexError): return None

            sv = num(i_sort)
            key = (-sv if asc else sv) if sv is not None else -1e300
            row = {"marker": marker, "env": env, "gscore": g, "pvalue": p,
                   "wald": num(i_w), "nagelkerke": num(i_nag), "aic": num(i_aic),
                   "beta": num(beta_cols[-1]) if beta_cols else None, "numerror": ne}
            counter += 1
            if len(heap) < limit:
                heapq.heappush(heap, (key, counter, row))
            elif key > heap[0][0]:
                heapq.heapreplace(heap, (key, counter, row))
    rows = [r for _, _, r in sorted(heap, key=lambda t: (t[0], t[1]), reverse=True)]
    return {
        "path": path, "dimension": dim,
        "summary": {"total": total, "valid": valid, "errors": errc,
                    "n01": n01, "n001": n001, "n1e5": n1e5,
                    "minp": (minp if valid else None),
                    "bonf": (0.05 / valid if valid else None)},
        "rows": rows, "returned": len(rows), "sort": sort, "filter": filt,
    }


def build_demo(folder):
    """Build a pre-fill config from a parameters.txt (demo / example mode)."""
    if not folder or not os.path.isdir(folder):
        return None
    pf = os.path.join(folder, "parameters.txt")
    if not os.path.isfile(pf):
        return None
    cfg = {"outputDir": folder}
    files = []

    def unq(v):
        return v.strip().strip('"')

    fh = None
    try:
        fh = open(pf, encoding="utf-8", errors="replace")
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            key = parts[0].upper(); vals = parts[1:]
            if key == "INPUTFILE":
                files = [os.path.join(folder, unq(v)) for v in vals]
            elif key == "HEADERS":
                cfg["headers"] = bool(vals) and vals[0].upper().startswith("Y")
            elif key == "WORDDELIM" and vals:
                cfg["worddelim"] = unq(vals[0])
            elif key == "NUMVARENV" and vals: cfg["numvarenv"] = unq(vals[0])
            elif key == "NUMMARK" and vals: cfg["nummark"] = unq(vals[0])
            elif key == "NUMINDIV" and vals: cfg["numindiv"] = unq(vals[0])
            elif key == "IDINDIV" and vals: cfg["idindiv"] = unq(vals[0])
            elif key == "COLSUPENV" and vals: cfg["colsupenv"] = " ".join(unq(v) for v in vals)
            elif key == "COLSUPMARK" and vals: cfg["colsupmark"] = " ".join(unq(v) for v in vals)
            elif key == "SUBSETVARENV" and vals: cfg["subsetvarenv"] = " ".join(unq(v) for v in vals)
            elif key == "SUBSETMARK" and vals: cfg["subsetmark"] = " ".join(unq(v) for v in vals)
            elif key == "DIMMAX" and vals: cfg["dimmax"] = unq(vals[0])
            elif key == "OUTPUTFILE" and vals: cfg["outputBase"] = unq(vals[0])
            elif key == "LOG" and vals: cfg["logName"] = unq(vals[0])
            elif key == "UNCONVERGEDMODELS" and vals: cfg["unconverged"] = unq(vals[0])
            elif key == "POPULATIONVAR" and vals: cfg["populationvar"] = unq(vals[0]).upper()
            elif key == "STOREY": cfg["storey"] = True
            elif key == "GWR": cfg["gwr"] = True
            elif key == "SHAPEFILE": cfg["shapefile"] = True
            elif key == "SPATIAL":
                cfg["spatial"] = True
                if len(vals) >= 1: cfg["spatialLon"] = unq(vals[0])
                if len(vals) >= 2: cfg["spatialLat"] = unq(vals[1])
                if len(vals) >= 3: cfg["spatialCoord"] = unq(vals[2]).upper()
                if len(vals) >= 4: cfg["spatialNeigh"] = unq(vals[3]).upper()
                if len(vals) >= 5: cfg["spatialScale"] = unq(vals[4])
            elif key == "AUTOCORR":
                cfg["autocorr"] = True
                if len(vals) >= 1: cfg["autocorrType"] = unq(vals[0]).upper()
                if len(vals) >= 2: cfg["autocorrVars"] = unq(vals[1]).upper()
                if len(vals) >= 3: cfg["autocorrPerm"] = unq(vals[2])
            elif key == "SAVETYPE":
                if len(vals) >= 1: cfg["savetypeTiming"] = unq(vals[0]).upper()
                if len(vals) >= 2: cfg["savetypeScope"] = unq(vals[1]).upper()
                if len(vals) >= 3: cfg["savetypePval"] = unq(vals[2])
    except OSError:
        return None
    finally:
        if fh is not None:
            fh.close()
    cfg["twoFiles"] = len(files) >= 2
    if files: cfg["dataFile1"] = files[0]
    if len(files) >= 2: cfg["dataFile2"] = files[1]
    cfg.setdefault("outputBase", os.path.basename(folder.rstrip("/\\")) + "-results")
    return cfg


def example_config():
    """Config for the shipped example, written to a writable output folder."""
    ex_dir = bundled_example_dir()
    cfg = build_demo(ex_dir)
    if not cfg:
        return None
    # The reference param file passes the data file on the command line rather
    # than via INPUTFILE, so set it explicitly, and steer output to a writable
    # folder (the bundled examples directory is read-only when packaged).
    cfg["dataFile1"] = os.path.join(ex_dir, "random-sample.txt")
    cfg["twoFiles"] = False
    cfg.pop("dataFile2", None)
    cfg["outputDir"] = os.path.join(os.path.expanduser("~"), "SAMBADA-example-results")
    cfg["outputBase"] = "random-sample-results"
    return cfg


# --------------------------------------------------------------------------- #
# HTTP server
# --------------------------------------------------------------------------- #
class Handler(BaseHTTPRequestHandler):
    server_version = "SambadaStudio/" + APP_VERSION

    # --- send helpers ------------------------------------------------------ #
    def _send_json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_bytes(self, body, content_type, code=200, download_name=None):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        if download_name:
            self.send_header("Content-Disposition", f'inline; filename="{download_name}"')
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, fs_path, content_type):
        try:
            with open(fs_path, "rb") as fh:
                self._send_bytes(fh.read(), content_type)
        except OSError:
            self._send_json({"error": "File not found: " + fs_path}, 404)

    def _send_index(self):
        """Serve index.html with the session token injected into the page."""
        try:
            with open(os.path.join(WEB_DIR, "index.html"), "r", encoding="utf-8") as fh:
                html = fh.read()
        except OSError:
            return self._send_json({"error": "index not found"}, 404)
        inject = "<script>window.SAMBADA_TOKEN=%s;</script>" % json.dumps(TOKEN)
        if "</head>" in html:
            html = html.replace("</head>", inject + "</head>", 1)
        else:
            html = inject + html
        self._send_bytes(html.encode("utf-8"), "text/html; charset=utf-8")

    # --- request authorization -------------------------------------------- #
    def _host_ok(self):
        host = self.headers.get("Host", "")
        if not host:
            return False
        if host.startswith("["):                      # IPv6 literal, e.g. [::1]:8765
            hostname = host[1:host.index("]")] if "]" in host else host
        else:
            hostname = host.rsplit(":", 1)[0]
        return hostname in ALLOWED_HOSTS

    def _token_ok(self):
        tok = self.headers.get("X-Sambada-Token", "")
        return bool(tok) and hmac.compare_digest(tok, TOKEN)

    def log_message(self, *args):  # silence the default HTTP logs
        pass

    # --- GET --------------------------------------------------------------- #
    def do_GET(self):
        if not self._host_ok():
            return self._send_json({"error": "forbidden host"}, 403)

        parsed = urlparse(self.path)
        route = parsed.path
        qs = parse_qs(parsed.query)

        # Every API call must carry the session token.
        if route.startswith("/api/") and not self._token_ok():
            return self._send_json({"error": "unauthorized"}, 403)

        if route == "/" or route == "/index.html":
            return self._send_index()
        if route == "/style.css":
            return self._send_file(os.path.join(WEB_DIR, "style.css"), "text/css; charset=utf-8")
        if route == "/app.js":
            return self._send_file(os.path.join(WEB_DIR, "app.js"), "application/javascript; charset=utf-8")
        if route.startswith("/assets/"):
            name = os.path.basename(route)
            fs = os.path.join(WEB_DIR, "assets", name)
            if os.path.isfile(fs):
                ct = "image/png" if name.lower().endswith(".png") else "application/octet-stream"
                return self._send_file(fs, ct)
            return self._send_json({"error": "asset not found"}, 404)

        if route == "/api/info":
            return self._send_json({
                "version": APP_VERSION,
                "platform": PLATFORM,
                "exe_suffix": EXE_SUFFIX,
                "native": RUN_MODE == "native",
                "demo": build_demo(os.environ.get("SAMBADA_DEMO_DIR")),
                "example": example_config(),
                "binaries": available_binaries(),
                "bin_dir": os.path.join(BIN_DIR, PLATFORM),
                "home": os.path.expanduser("~"),
                "app_dir": APP_DIR,
                "examples_dir": os.path.join(APP_DIR, "examples"),
                "python": sys.version.split()[0],
            })

        if route == "/api/browse":
            path = unquote(qs.get("path", [""])[0])
            return self._send_json(list_dir(path))

        if route == "/api/open":
            path = unquote(qs.get("path", [""])[0])
            ok, err = open_in_os(path)
            return self._send_json({"ok": ok, "error": err})

        if route == "/api/quit":
            self._send_json({"ok": True})
            threading.Timer(0.4, lambda: os._exit(0)).start()
            return

        if route == "/api/file":
            path = unquote(qs.get("path", [""])[0])
            if not os.path.isfile(path):
                return self._send_json({"error": "not found"}, 404)
            try:
                with open(path, "r", encoding="utf-8", errors="replace") as fh:
                    data = fh.read(400_000)  # preview (400 kB max)
            except OSError as exc:
                return self._send_json({"error": str(exc)}, 500)
            return self._send_json({"path": path, "content": data, "truncated": len(data) >= 400_000})

        if route == "/api/doc":
            name = unquote(qs.get("name", [""])[0])
            safe = os.path.basename(name)
            fs = os.path.join(DOCS_DIR, safe)
            if os.path.isfile(fs):
                return self._send_file(fs, "text/markdown; charset=utf-8")
            return self._send_json({"error": "doc not found"}, 404)

        if route == "/api/results":
            path = unquote(qs.get("path", [""])[0])
            sort = qs.get("sort", ["gscore"])[0]
            filt = qs.get("filter", ["all"])[0]
            query = unquote(qs.get("q", [""])[0])
            try:
                limit = max(1, min(2000, int(qs.get("limit", ["200"])[0])))
            except ValueError:
                limit = 200
            return self._send_json(analyze_results(path, sort, filt, query, limit))

        return self._send_json({"error": "unknown route: " + route}, 404)

    # --- POST -------------------------------------------------------------- #
    def do_POST(self):
        if not self._host_ok():
            return self._send_json({"error": "forbidden host"}, 403)

        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/") and not self._token_ok():
            return self._send_json({"error": "unauthorized"}, 403)

        if parsed.path != "/api/run":
            return self._send_json({"error": "unknown route"}, 404)

        length = int(self.headers.get("Content-Length", 0))
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception as exc:
            return self._send_json({"error": "Invalid JSON: " + str(exc)}, 400)

        self._run_streaming(payload)

    # --- run a binary while streaming its log ------------------------------ #
    def _run_streaming(self, payload):
        tool = payload.get("tool")
        if tool not in TOOLS:
            return self._send_json({"error": "unknown tool: " + str(tool)}, 400)

        exe = binary_path(tool)
        if not os.path.isfile(exe):
            return self._send_json(
                {"error": f"Binary missing for '{tool}' ({PLATFORM}). "
                          f"Build it first (see docs / build scripts). Expected: {exe}"}, 400)

        # Ensure the executable bit (it can be lost when a package is extracted).
        if PLATFORM != "windows":
            try:
                os.chmod(exe, 0o755)
            except OSError:
                pass

        cwd = payload.get("cwd") or os.path.expanduser("~")
        cwd = os.path.abspath(os.path.expanduser(cwd))
        try:
            os.makedirs(cwd, exist_ok=True)
        except OSError as exc:
            return self._send_json({"error": "Invalid output folder: " + str(exc)}, 400)

        # Optionally write the parameter file.
        cmd = [exe]
        param_text = payload.get("paramText")
        param_name = payload.get("paramFileName") or "parameters-sambada.txt"
        written_param = None
        if param_text is not None:
            written_param = os.path.join(cwd, os.path.basename(param_name))
            try:
                with open(written_param, "w", encoding="utf-8", newline="\n") as fh:
                    fh.write(param_text)
            except OSError as exc:
                return self._send_json({"error": "Cannot write the parameter file: " + str(exc)}, 400)
            cmd.append(os.path.basename(written_param))

        # Extra arguments (data files for sambada, or all args for recode).
        for a in payload.get("args", []):
            cmd.append(str(a))

        # Snapshot the files before the run (to list what is new afterwards).
        try:
            before = {f: os.path.getmtime(os.path.join(cwd, f)) for f in os.listdir(cwd)}
        except OSError:
            before = {}

        # Streaming response (plain text, connection closed at the end).
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()

        def emit(line):
            try:
                self.wfile.write(line.encode("utf-8", errors="replace"))
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                raise

        emit("$ " + " ".join(_q(c) for c in cmd) + "\n")
        emit("  (working directory: %s)\n\n" % cwd)

        exit_code = None
        try:
            proc = subprocess.Popen(
                cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                bufsize=1, text=True, encoding="utf-8", errors="replace",
            )
            for line in proc.stdout:  # type: ignore[union-attr]
                emit(line)
            proc.wait()
            exit_code = proc.returncode
        except FileNotFoundError:
            emit("\n[ERROR] Binary not found: " + exe + "\n")
            exit_code = -1
        except Exception as exc:  # pragma: no cover
            emit("\n[ERROR] " + str(exc) + "\n")
            exit_code = -1

        # New / modified files.
        produced = []
        try:
            for f in sorted(os.listdir(cwd)):
                full = os.path.join(cwd, f)
                if not os.path.isfile(full):
                    continue
                mt = os.path.getmtime(full)
                if f not in before or mt > before[f]:
                    if written_param and os.path.basename(written_param) == f:
                        continue
                    produced.append({"name": f, "path": full, "size": os.path.getsize(full)})
        except OSError:
            pass

        summary = {"exitCode": exit_code, "cwd": cwd, "produced": produced,
                   "paramFile": written_param}
        emit("\n__SAMBADA_DONE__ " + json.dumps(summary) + "\n")


def _q(s):
    return '"%s"' % s if " " in s else s


# --------------------------------------------------------------------------- #
# Startup
# --------------------------------------------------------------------------- #
def main():
    global RUN_MODE
    # "Managed" mode: a port is passed as an argument (launched by a test/preview tool).
    managed = len(sys.argv) > 1 and sys.argv[1].isdigit()
    port = int(sys.argv[1]) if managed else free_port()
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    port = httpd.server_address[1]   # actual bound port (in case free_port returned 0)
    url = f"http://127.0.0.1:{port}/"

    bins = available_binaries()
    ready = [t for t, ok in bins.items() if ok]
    missing = [t for t, ok in bins.items() if not ok]
    print("=" * 60)
    print("  SAMBADA Studio %s |  platform: %s" % (APP_VERSION, PLATFORM))
    print("  binaries ready : %s" % (", ".join(ready) if ready else "(none)"))
    if missing:
        print("  missing        : %s" % ", ".join(missing))
    print("  address        : %s" % url)
    print("=" * 60)

    # Test/preview mode: just serve, without a window or browser.
    if managed:
        RUN_MODE = "managed"
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            httpd.shutdown()
        return

    # Local server in the background.
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    # 1) Native embedded window (no browser).
    if not os.environ.get("SAMBADA_FORCE_BROWSER"):
        try:
            import webview  # pywebview
            RUN_MODE = "native"
            webview.create_window("SAMBADA Studio", url,
                                  width=1280, height=900, min_size=(940, 640), maximized=True)
            webview.start()          # blocks until the window is closed
            os._exit(0)
        except Exception as exc:
            RUN_MODE = "browser"
            print("Native window unavailable (%s) -> opening in the default browser." % exc)

    # 2) Fallback: default browser.
    if not os.environ.get("SAMBADA_NO_BROWSER"):
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    print("  (close this window or press Ctrl+C to quit)")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        os._exit(0)


if __name__ == "__main__":
    main()
