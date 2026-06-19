#!/usr/bin/env bash
# Produit l'exécutable macOS autonome : sambada-gui/dist/SAMBADA-Studio-macOS.zip
# (contient "SAMBADA Studio.app", aucune dépendance Python pour l'utilisateur final)
# Prérequis : GCC (brew install gcc), CMake (brew install cmake), Python 3.11/3.12.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
GUI="$(cd "$HERE/.." && pwd)"

echo "==> 1/4  Compilation des binaires SAMBADA (si nécessaire)"
if [ ! -f "$GUI/bin/macos/sambada" ]; then
  bash "$GUI/build/build-macos.sh"
fi

echo "==> 2/4  Environnement Python + PyInstaller"
cd "$GUI"
PY="$(command -v python3.12 || command -v python3.11 || command -v python3)"
echo "    Python : $PY"
[ -d .venv ] || "$PY" -m venv .venv
.venv/bin/python -m pip install --quiet --upgrade pip
.venv/bin/python -m pip install --quiet pyinstaller pywebview  # pywebview = fenêtre native

echo "==> 3/4  Empaquetage (PyInstaller)"
.venv/bin/pyinstaller --noconfirm --clean --distpath dist --workpath build/pyi packaging/SambadaStudio.spec

echo "==> 4/4  Archive téléchargeable"
cd dist
rm -f "SAMBADA-Studio-macOS.zip"
ditto -c -k --sequesterRsrc --keepParent "SAMBADA Studio.app" "SAMBADA-Studio-macOS.zip"
echo ""
echo "OK -> sambada-gui/dist/SAMBADA-Studio-macOS.zip"
