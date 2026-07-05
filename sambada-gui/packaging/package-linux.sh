#!/usr/bin/env bash
# Produces the standalone Linux executable: sambada-gui/dist/SAMBADA-Studio-Linux.tar.gz
# (contains the single "SambadaStudio" executable; no Python dependency for the end user)
# Requirements: g++ (build-essential), cmake, python3 (>=3.9) + venv.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
GUI="$(cd "$HERE/.." && pwd)"

echo "==> 1/4  Building the SAMBADA binaries (if needed)"
if [ ! -f "$GUI/bin/linux/sambada" ]; then
  bash "$GUI/build/build-linux.sh"
fi

echo "==> 2/4  Python environment + PyInstaller"
cd "$GUI"
PY="$(command -v python3.12 || command -v python3.11 || command -v python3)"
echo "    Python: $PY"
[ -d .venv ] || "$PY" -m venv .venv
.venv/bin/python -m pip install --quiet --upgrade pip
.venv/bin/python -m pip install --quiet pyinstaller pywebview  # pywebview = native window (browser fallback if webkit2gtk is absent)

echo "==> 3/4  Packaging (PyInstaller)"
.venv/bin/pyinstaller --noconfirm --clean --distpath dist --workpath build/pyi packaging/SambadaStudio.spec

echo "==> 4/4  Downloadable archive"
cd dist
chmod +x SambadaStudio
rm -f SAMBADA-Studio-Linux.tar.gz
tar czf SAMBADA-Studio-Linux.tar.gz SambadaStudio
echo ""
echo "OK -> sambada-gui/dist/SAMBADA-Studio-Linux.tar.gz"
