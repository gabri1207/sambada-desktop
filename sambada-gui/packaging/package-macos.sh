#!/usr/bin/env bash
# Produces the standalone macOS executable: sambada-gui/dist/SAMBADA-Studio-macOS.zip
# (contains "SAMBADA Studio.app"; no Python dependency for the end user)
# Requirements: GCC (brew install gcc), CMake (brew install cmake), Python 3.11/3.12.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
GUI="$(cd "$HERE/.." && pwd)"

echo "==> 1/4  Building the SAMBADA binaries (if needed)"
if [ ! -f "$GUI/bin/macos/sambada" ]; then
  bash "$GUI/build/build-macos.sh"
fi

echo "==> 2/4  Python environment + PyInstaller"
cd "$GUI"
PY="$(command -v python3.12 || command -v python3.11 || command -v python3)"
echo "    Python: $PY"
[ -d .venv ] || "$PY" -m venv .venv
.venv/bin/python -m pip install --quiet --upgrade pip
.venv/bin/python -m pip install --quiet pyinstaller pywebview  # pywebview = native window

echo "==> 3/4  Packaging (PyInstaller)"
.venv/bin/pyinstaller --noconfirm --clean --distpath dist --workpath build/pyi packaging/SambadaStudio.spec

echo "==> 4/4  Downloadable archive"
cd dist
rm -f "SAMBADA-Studio-macOS.zip"
ditto -c -k --sequesterRsrc --keepParent "SAMBADA Studio.app" "SAMBADA-Studio-macOS.zip"
echo ""
echo "OK -> sambada-gui/dist/SAMBADA-Studio-macOS.zip"
