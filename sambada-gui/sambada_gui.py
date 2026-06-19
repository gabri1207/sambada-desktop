#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SAMBADA Studio — interface graphique locale pour SAMBADA.

Ce programme N'IMPLEMENTE AUCUNE logique scientifique : c'est une simple
surcouche (wrapper) qui construit le fichier de paramètres et appelle les
binaires compilés (sambada, supervision, recode-plink, recode-plink-lfmm).
Le comportement de SAMBADA est donc strictement inchangé.

Dépendances : bibliothèque standard de Python 3 uniquement (aucun pip).
Lancement   : python3 sambada_gui.py   (un navigateur s'ouvre automatiquement)
"""

import json
import os
import sys
import socket
import subprocess
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

# --------------------------------------------------------------------------- #
# Chemins & détection de plateforme
# --------------------------------------------------------------------------- #
def resource_base():
    """Dossier des ressources : normal (à côté du script) ou empaqueté (PyInstaller)."""
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

# Mode d'affichage : "native" (fenêtre intégrée), "browser" (navigateur), "managed" (test/preview)
RUN_MODE = "browser"


def binary_path(tool):
    """Chemin attendu du binaire pour la plateforme courante."""
    return os.path.join(BIN_DIR, PLATFORM, tool + EXE_SUFFIX)


def available_binaries():
    return {t: os.path.isfile(binary_path(t)) for t in TOOLS}


# --------------------------------------------------------------------------- #
# Utilitaires
# --------------------------------------------------------------------------- #
def open_in_os(path):
    """Ouvre un fichier / dossier avec l'application par défaut du système."""
    try:
        if PLATFORM == "macos":
            subprocess.Popen(["open", path])
        elif PLATFORM == "windows":
            os.startfile(path)  # type: ignore[attr-defined]
        else:
            subprocess.Popen(["xdg-open", path])
        return True, ""
    except Exception as exc:  # pragma: no cover - dépend de l'OS
        return False, str(exc)


def list_dir(path):
    """Liste un dossier de façon sûre, pour le sélecteur de fichiers."""
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
    # dossiers d'abord, puis fichiers
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
    return 0  # laisse l'OS choisir


# --------------------------------------------------------------------------- #
# Serveur HTTP
# --------------------------------------------------------------------------- #
class Handler(BaseHTTPRequestHandler):
    server_version = "SambadaStudio/1.0"

    # --- helpers d'envoi --------------------------------------------------- #
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
            self._send_json({"error": "Fichier introuvable: " + fs_path}, 404)

    def log_message(self, *args):  # silence les logs HTTP par défaut
        pass

    # --- GET --------------------------------------------------------------- #
    def do_GET(self):
        parsed = urlparse(self.path)
        route = parsed.path
        qs = parse_qs(parsed.query)

        if route == "/" or route == "/index.html":
            return self._send_file(os.path.join(WEB_DIR, "index.html"), "text/html; charset=utf-8")
        if route == "/style.css":
            return self._send_file(os.path.join(WEB_DIR, "style.css"), "text/css; charset=utf-8")
        if route == "/app.js":
            return self._send_file(os.path.join(WEB_DIR, "app.js"), "application/javascript; charset=utf-8")

        if route == "/api/info":
            return self._send_json({
                "platform": PLATFORM,
                "exe_suffix": EXE_SUFFIX,
                "native": RUN_MODE == "native",
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
                return self._send_json({"error": "introuvable"}, 404)
            try:
                with open(path, "r", encoding="utf-8", errors="replace") as fh:
                    data = fh.read(400_000)  # aperçu (400 ko max)
            except OSError as exc:
                return self._send_json({"error": str(exc)}, 500)
            return self._send_json({"path": path, "content": data, "truncated": len(data) >= 400_000})

        if route == "/api/doc":
            name = unquote(qs.get("name", [""])[0])
            safe = os.path.basename(name)
            fs = os.path.join(DOCS_DIR, safe)
            if os.path.isfile(fs):
                return self._send_file(fs, "text/markdown; charset=utf-8")
            return self._send_json({"error": "doc introuvable"}, 404)

        return self._send_json({"error": "route inconnue: " + route}, 404)

    # --- POST -------------------------------------------------------------- #
    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/run":
            return self._send_json({"error": "route inconnue"}, 404)

        length = int(self.headers.get("Content-Length", 0))
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception as exc:
            return self._send_json({"error": "JSON invalide: " + str(exc)}, 400)

        self._run_streaming(payload)

    # --- exécution d'un binaire avec streaming du log ---------------------- #
    def _run_streaming(self, payload):
        tool = payload.get("tool")
        if tool not in TOOLS:
            return self._send_json({"error": "outil inconnu: " + str(tool)}, 400)

        exe = binary_path(tool)
        if not os.path.isfile(exe):
            return self._send_json(
                {"error": f"Binaire manquant pour '{tool}' ({PLATFORM}). "
                          f"Compilez-le d'abord (voir docs / scripts de build). Attendu : {exe}"}, 400)

        # Assure le bit exécutable (peut être perdu après extraction d'un paquet)
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
            return self._send_json({"error": "Dossier de sortie invalide: " + str(exc)}, 400)

        # Écriture éventuelle du fichier de paramètres
        cmd = [exe]
        param_text = payload.get("paramText")
        param_name = payload.get("paramFileName") or "parametres-sambada.txt"
        written_param = None
        if param_text is not None:
            written_param = os.path.join(cwd, os.path.basename(param_name))
            try:
                with open(written_param, "w", encoding="utf-8", newline="\n") as fh:
                    fh.write(param_text)
            except OSError as exc:
                return self._send_json({"error": "Écriture du fichier de paramètres impossible: " + str(exc)}, 400)
            cmd.append(os.path.basename(written_param))

        # Arguments supplémentaires (fichiers de données pour sambada, ou tous les args pour recode)
        for a in payload.get("args", []):
            cmd.append(str(a))

        # Instantané des fichiers avant exécution (pour lister les nouveautés)
        try:
            before = {f: os.path.getmtime(os.path.join(cwd, f)) for f in os.listdir(cwd)}
        except OSError:
            before = {}

        # Réponse en streaming (texte, connexion fermée à la fin)
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
        emit("  (dossier de travail : %s)\n\n" % cwd)

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
            emit("\n[ERREUR] Binaire introuvable: " + exe + "\n")
            exit_code = -1
        except Exception as exc:  # pragma: no cover
            emit("\n[ERREUR] " + str(exc) + "\n")
            exit_code = -1

        # Fichiers nouveaux / modifiés
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
# Démarrage
# --------------------------------------------------------------------------- #
def main():
    global RUN_MODE
    # Mode "géré" : un port est passé en argument (lancé par un outil de test/preview).
    managed = len(sys.argv) > 1 and sys.argv[1].isdigit()
    port = int(sys.argv[1]) if managed else free_port()
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}/"

    bins = available_binaries()
    ready = [t for t, ok in bins.items() if ok]
    missing = [t for t, ok in bins.items() if not ok]
    print("=" * 60)
    print("  SAMBADA Studio  |  platform: %s" % PLATFORM)
    print("  binaries ready : %s" % (", ".join(ready) if ready else "(none)"))
    if missing:
        print("  missing        : %s" % ", ".join(missing))
    print("  address        : %s" % url)
    print("=" * 60)

    # Mode test/preview : sert simplement, sans fenêtre ni navigateur.
    if managed:
        RUN_MODE = "managed"
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            httpd.shutdown()
        return

    # Serveur local en arrière-plan
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    # 1) Fenêtre native intégrée (pas de navigateur)
    if not os.environ.get("SAMBADA_FORCE_BROWSER"):
        try:
            import webview  # pywebview
            RUN_MODE = "native"
            webview.create_window("SAMBADA Studio", url,
                                  width=1280, height=900, min_size=(940, 640), maximized=True)
            webview.start()          # bloque jusqu'à la fermeture de la fenêtre
            os._exit(0)
        except Exception as exc:
            RUN_MODE = "browser"
            print("Native window unavailable (%s) -> opening in the default browser." % exc)

    # 2) Repli : navigateur par défaut
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
