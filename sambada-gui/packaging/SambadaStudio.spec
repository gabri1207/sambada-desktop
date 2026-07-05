# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for SAMBADA Studio.
# Run FROM the sambada-gui/ folder:
#     pyinstaller packaging/SambadaStudio.spec
# Produces:
#   - macOS   : dist/SAMBADA Studio.app  (standalone application)
#   - Windows : dist/SambadaStudio.exe   (single executable)
#   - Linux   : dist/SambadaStudio       (single executable)
import sys, os

if sys.platform.startswith("darwin"):
    osdir = "macos"
elif sys.platform.startswith("win"):
    osdir = "windows"
else:
    osdir = "linux"

# Root = the sambada-gui folder (parent of packaging/), independent of the working directory
ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))

# Bundled resources (interface, docs, examples, binaries for the current OS)
datas = [
    (os.path.join(ROOT, "web"), "web"),
    (os.path.join(ROOT, "docs"), "docs"),
    (os.path.join(ROOT, "examples"), "examples"),
    (os.path.join(ROOT, "bin", osdir), "bin/%s" % osdir),
]

# Bundle pywebview (native window) when present. If it is absent, the app
# automatically falls back to the browser (see sambada_gui.main()).
binaries = []
hiddenimports = ["webview"]
try:
    from PyInstaller.utils.hooks import collect_all
    _d, _b, _h = collect_all("webview")
    datas += _d
    binaries += _b
    hiddenimports += _h
except Exception as _e:
    print("Spec: pywebview not bundled (%s) -> browser fallback mode." % _e)

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
    # macOS: .app application (onedir + bundle), no console window
    exe = EXE(pyz, a.scripts, [], exclude_binaries=True,
              name="SAMBADA Studio", console=False, disable_windowed_traceback=False,
              argv_emulation=False, target_arch=None, codesign_identity=None, entitlements_file=None)
    coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name="SAMBADA Studio")
    app = BUNDLE(coll, name="SAMBADA Studio.app",
                 icon=os.path.join(SPECPATH, "icon.icns"), bundle_identifier="ch.epfl.lasig.sambadastudio",
                 info_plist={
                     "CFBundleName": "SAMBADA Studio",
                     "CFBundleDisplayName": "SAMBADA Studio",
                     "CFBundleShortVersionString": "1.0.0",
                     "NSHighResolutionCapable": True,
                     "LSBackgroundOnly": False,
                 })
else:
    # Windows / Linux: single executable (onefile)
    console = not sys.platform.startswith("win")  # console visible on Linux, hidden on Windows
    # onefile: include binaries + datas directly in the EXE (no COLLECT)
    exe = EXE(pyz, a.scripts, a.binaries, a.datas, [],
              name="SambadaStudio", console=console,
              icon=os.path.join(SPECPATH, "icon.ico"),
              disable_windowed_traceback=False, upx=False)
