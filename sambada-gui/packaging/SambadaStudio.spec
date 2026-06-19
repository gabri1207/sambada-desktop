# -*- mode: python ; coding: utf-8 -*-
# Spec PyInstaller pour SAMBADA Studio.
# À exécuter DEPUIS le dossier sambada-gui/ :
#     pyinstaller packaging/SambadaStudio.spec
# Produit :
#   - macOS   : dist/SAMBADA Studio.app  (application autonome)
#   - Windows : dist/SambadaStudio.exe   (exécutable unique)
#   - Linux   : dist/SambadaStudio       (exécutable unique)
import sys, os

if sys.platform.startswith("darwin"):
    osdir = "macos"
elif sys.platform.startswith("win"):
    osdir = "windows"
else:
    osdir = "linux"

# Racine = dossier sambada-gui (parent de packaging/), indépendant du dossier d'exécution
ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))

# Ressources embarquées (interface, doc, exemples, binaires de l'OS courant)
datas = [
    (os.path.join(ROOT, "web"), "web"),
    (os.path.join(ROOT, "docs"), "docs"),
    (os.path.join(ROOT, "examples"), "examples"),
    (os.path.join(ROOT, "bin", osdir), "bin/%s" % osdir),
]

# Embarque pywebview (fenêtre native) si présent. S'il est absent, l'app
# se rabat automatiquement sur le navigateur (voir sambada_gui.main()).
binaries = []
hiddenimports = ["webview"]
try:
    from PyInstaller.utils.hooks import collect_all
    _d, _b, _h = collect_all("webview")
    datas += _d
    binaries += _b
    hiddenimports += _h
except Exception as _e:
    print("Spec: pywebview non empaqueté (%s) -> mode navigateur en repli." % _e)

a = Analysis(
    [os.path.join(ROOT, "sambada_gui.py")],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["numpy", "test", "unittest"],
    noarchive=False,
)
pyz = PYZ(a.pure)

if sys.platform.startswith("darwin"):
    # macOS : application .app (onedir + bundle), sans fenêtre console
    exe = EXE(pyz, a.scripts, [], exclude_binaries=True,
              name="SAMBADA Studio", console=False, disable_windowed_traceback=False,
              argv_emulation=False, target_arch=None, codesign_identity=None, entitlements_file=None)
    coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name="SAMBADA Studio")
    app = BUNDLE(coll, name="SAMBADA Studio.app",
                 icon=None, bundle_identifier="ch.epfl.lasig.sambadastudio",
                 info_plist={
                     "CFBundleName": "SAMBADA Studio",
                     "CFBundleDisplayName": "SAMBADA Studio",
                     "CFBundleShortVersionString": "1.0",
                     "NSHighResolutionCapable": True,
                     "LSBackgroundOnly": False,
                 })
else:
    # Windows / Linux : exécutable unique (onefile)
    console = not sys.platform.startswith("win")  # console visible sous Linux, masquée sous Windows
    # onefile : on inclut binaries + datas directement dans l'EXE (pas de COLLECT)
    exe = EXE(pyz, a.scripts, a.binaries, a.datas, [],
              name="SambadaStudio", console=console,
              disable_windowed_traceback=False, upx=False)
